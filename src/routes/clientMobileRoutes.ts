import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { getDb, schema } from '../db/index';
import { storeDocument } from '../db/documentStorage';
import { eq, desc, and } from 'drizzle-orm';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../auth/index';
import { calculateLoanSchedule, computeLoanRemainingBalance, canWithdrawFromSavings, sumSavingsAccountBalances } from '../utils/loanMath';
import { getServerSupabase } from '../db/supabaseServer';
import { supabaseGetUser, supabaseSendEmailOtp, supabaseVerifyEmailOtp } from '../auth/supabaseAuth';
import { authStore } from '../auth/index';
import { normalizeRole } from '../auth/permissions';
import { findBorrowerByContact } from '../db/clientProvisioning';

const KYC_STORAGE_BUCKET = 'kyc-documents';
const KYC_STORAGE_SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days for staff review

// Accepted image payloads for KYC document uploads
const KYC_ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const KYC_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function mimeFromBase64(base64: string): string {
  const match = /^data:([a-zA-Z0-9./+-]+);base64,/.exec(base64 || '');
  return match ? match[1] : 'image/jpeg';
}

// Produce a filesystem-safe lowercase slug from a document type.
function stringToId(value: string): string {
  return (value || 'doc')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function stripDataUrlPrefix(base64: string): string {
  const idx = (base64 || '').indexOf(',');
  return idx >= 0 ? base64.slice(idx + 1) : base64;
}

function saveLocalKycFile(
  borrowerId: string,
  folder: string,
  fileName: string,
  buffer: Buffer,
  contentType: string = 'image/jpeg'
): { signedUrl: string; path: string } {
  const safeBorrower = stringToId(borrowerId);
  const safeFolder = stringToId(folder);
  try {
    const localDir = path.join(process.cwd(), 'uploads', 'kyc', safeBorrower, safeFolder);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const filePath = path.join(localDir, fileName);
    fs.writeFileSync(filePath, buffer);
    const objectPath = `kyc/${safeBorrower}/${safeFolder}/${fileName}`;
    const localUrl = `/api/storage/kyc/${safeBorrower}/${safeFolder}/${fileName}`;
    return { signedUrl: localUrl, path: objectPath };
  } catch (fsErr: any) {
    console.warn(`[KYC Storage] Local filesystem write warning (${fsErr.message}), returning data URL fallback.`);
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    return { signedUrl: dataUrl, path: `kyc/${safeBorrower}/${safeFolder}/${fileName}` };
  }
}

// Upload a base64 image to the private kyc-documents bucket (or local storage fallback), returning a secure view URL.
async function uploadKycFile(
  borrowerId: string,
  folder: string,
  base64: string,
  mime?: string
): Promise<{ signedUrl: string; path: string }> {
  const payload = stripDataUrlPrefix(base64);
  const buffer = Buffer.from(payload, 'base64');
  if (buffer.length < 128) throw new Error('The uploaded image appears to be empty or corrupted.');
  if (buffer.length > KYC_MAX_FILE_BYTES) {
    throw new Error('The uploaded image exceeds the 10 MB limit.');
  }
  const contentType = mime && KYC_ACCEPTED_MIME.includes(mime) ? mime : mimeFromBase64(base64);
  if (!KYC_ACCEPTED_MIME.includes(contentType)) {
    throw new Error('Only JPG, PNG, and WEBP images are accepted.');
  }
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const objectPath = `kyc/${borrowerId}/${folder}/${fileName}`;

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { error: upErr } = await supabase.storage
        .from(KYC_STORAGE_BUCKET)
        .upload(objectPath, buffer, { contentType, upsert: false });

      if (!upErr) {
        const { data: signed } = await supabase.storage
          .from(KYC_STORAGE_BUCKET)
          .createSignedUrl(objectPath, KYC_STORAGE_SIGNED_URL_TTL);
        if (signed?.signedUrl) {
          return { signedUrl: signed.signedUrl, path: objectPath };
        }
      } else {
        console.warn(`[KYC Storage] Supabase upload failed (${upErr.message}), saving to local storage.`);
      }
    } catch (e: any) {
      console.warn(`[KYC Storage] Supabase upload exception (${e.message}), saving to local storage.`);
    }
  }

  // Fallback to local server storage if Supabase is unconfigured, RLS policy fails, or network is down
  return saveLocalKycFile(borrowerId, folder, fileName, buffer, contentType);
}

// Remove previously uploaded objects for the same borrower/folder prefix (re-upload hygiene).
async function removeKycFolderObjects(borrowerId: string, folder: string): Promise<void> {
  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const prefix = `kyc/${borrowerId}/${folder}/`;
      const { data, error } = await supabase.storage.from(KYC_STORAGE_BUCKET).list(`kyc/${borrowerId}/${folder}`);
      if (!error && data) {
        const names = data.filter((f) => f.name && f.metadata?.size > 0).map((f) => `${prefix}${f.name}`);
        if (names.length) {
          await supabase.storage.from(KYC_STORAGE_BUCKET).remove(names);
        }
      }
    } catch {}
  }
  try {
    const safeBorrower = stringToId(borrowerId);
    const safeFolder = stringToId(folder);
    const localDir = path.join(process.cwd(), 'uploads', 'kyc', safeBorrower, safeFolder);
    if (fs.existsSync(localDir)) {
      fs.rmSync(localDir, { recursive: true, force: true });
    }
  } catch {}
}

export interface AuthedRequest extends Request {
  authUser?: {
    id: string;
    role: 'STAFF' | 'CLIENT';
    staffRole?: string | null;
    staffId?: string | null;
    borrowerId?: string | null;
    email: string;
    fullName?: string | null;
    phone?: string | null;
    avatar?: string | null;
  };
}

function requireAuth(roles?: Array<'STAFF' | 'CLIENT'>) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = token ? verifyToken(token) : null;
    if (payload) {
      req.authUser = {
        id: payload.sub,
        role: payload.role,
        staffRole: payload.staffRole || null,
        staffId: payload.staffId || null,
        borrowerId: payload.borrowerId || null,
        email: payload.email,
        fullName: payload.fullName || null,
      };
    } else if (token) {
      try {
        const sbUser = await supabaseGetUser(token);
        if (sbUser) {
          const email = String(sbUser.email || sbUser.user_metadata?.email || '').toLowerCase();
          let record = await authStore.findById(sbUser.id);
          if (!record && email) {
            record = await authStore.findByEmailOrPhone(email);
          }
          if (record && record.isActive !== false) {
            req.authUser = {
              id: record.id,
              role: record.role as 'STAFF' | 'CLIENT',
              staffRole: record.staffRole || null,
              staffId: record.staffId || null,
              borrowerId: record.borrowerId || null,
              email: record.email,
              fullName: record.fullName,
              phone: record.phone || null,
            };
          }
        }
      } catch {}
    }

    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    // Auto-heal missing borrowerId for client if needed
    if (req.authUser.role === 'CLIENT' && !req.authUser.borrowerId) {
      const db = getDb();
      if (db) {
        try {
          const userRows = await db.select().from(schema.users).where(eq(schema.users.id, req.authUser.id)).limit(1);
          if (userRows[0]?.borrowerId) {
            req.authUser.borrowerId = userRows[0].borrowerId;
          } else {
            const match = await findBorrowerByContact(req.authUser.phone, req.authUser.email);
            if (match?.id) {
              req.authUser.borrowerId = match.id;
              await db.update(schema.users).set({ borrowerId: match.id }).where(eq(schema.users.id, req.authUser.id));
            }
          }
        } catch {}
      }
    }

    if (roles && roles.length > 0 && !roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: 'Access forbidden: Insufficient role permissions.' });
    }
    next();
  };
}

export const clientMobileRouter = Router();

// In-memory OTP storage for password recovery & phone/email verification
interface OtpEntry {
  email: string;
  otp: string;
  expiresAt: number;
  verified: boolean;
}
const otpStore = new Map<string, OtpEntry>();

// Notifications are stored in the branch_notifications table.

// Helper to get client identifier (borrowerId or userId)
function getClientBorrowerId(req: AuthedRequest): string | null {
  return req.authUser?.borrowerId || null;
}

// -------------------------------------------------------------
// 1. Mobile Authentication & OTP Verification
// -------------------------------------------------------------

// Send Registration SMS OTP
clientMobileRouter.post('/auth/send-registration-otp', async (req: Request, res: Response) => {
  try {
    const { phone, email } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Philippine mobile number is required' });
    }
    const cleanPhone = String(phone).replace(/\s+/g, '');
    const digitsOnly = cleanPhone.replace(/\D/g, '');

    // Validate Philippine mobile number (must be 10 digits starting with 9, or 11 digits starting with 09, or 12 digits starting with 639)
    let formattedPhone = cleanPhone;
    if (digitsOnly.length === 10 && digitsOnly.startsWith('9')) {
      formattedPhone = `+63 ${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 6)} ${digitsOnly.slice(6)}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('09')) {
      formattedPhone = `+63 ${digitsOnly.slice(1, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7)}`;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('639')) {
      formattedPhone = `+63 ${digitsOnly.slice(2, 5)} ${digitsOnly.slice(5, 8)} ${digitsOnly.slice(8)}`;
    } else if (digitsOnly.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid Philippine mobile number (e.g. 0917 123 4567 or +63 917 123 4567)',
      });
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address (Gmail) is required to receive your 6-digit verification code.',
      });
    }

    // Send authentic 6-digit OTP code to Gmail using Supabase
    await supabaseSendEmailOtp(cleanEmail);

    const expiresAt = Date.now() + 10 * 60 * 1000;
    const otpKey = digitsOnly.slice(-10);

    otpStore.set(`phone:${otpKey}`, {
      email: cleanEmail,
      otp: '',
      expiresAt,
      verified: false,
    });
    otpStore.set(cleanEmail, {
      email: cleanEmail,
      otp: '',
      expiresAt,
      verified: false,
    });

    console.log(`[Mobile Auth] Supabase email OTP dispatched to Gmail: ${cleanEmail}`);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please check your Gmail inbox.`,
      email: cleanEmail,
      formattedPhone,
      expiresInSeconds: 600,
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Verify Registration SMS/Email OTP via Supabase
clientMobileRouter.post('/auth/verify-registration-otp', async (req: Request, res: Response) => {
  try {
    const { phone, email, otp } = req.body;
    const cleanOtp = String(otp || '').trim().replace(/\D/g, '');
    if (!cleanOtp || cleanOtp.length < 6 || cleanOtp.length > 8) {
      return res.status(400).json({ success: false, error: 'Please enter the verification code sent to your email.' });
    }

    let targetEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const otpKey = cleanPhone.slice(-10);

    if (!targetEmail && otpKey) {
      const entry = otpStore.get(`phone:${otpKey}`);
      if (entry?.email) {
        targetEmail = entry.email;
      }
    }

    if (!targetEmail) {
      return res.status(400).json({ success: false, error: 'Email address is required for verification.' });
    }

    // Real Supabase verification (No demo OTP accepted)
    await supabaseVerifyEmailOtp(targetEmail, cleanOtp);

    const entry = otpStore.get(`phone:${otpKey}`) || otpStore.get(targetEmail);
    if (entry) {
      entry.verified = true;
    }

    res.json({
      success: true,
      verified: true,
      message: 'Email verified successfully via Supabase.',
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message || 'Invalid or expired verification code. Please check your Gmail.' });
  }
});

// Forgot password - Send 6-digit OTP via Supabase
clientMobileRouter.post('/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }
    const normEmail = String(email).trim().toLowerCase();
    await supabaseSendEmailOtp(normEmail);

    console.log(`[Mobile Auth] Supabase password reset OTP sent to ${normEmail}`);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normEmail}. Please check your Gmail inbox.`,
      expiresInMinutes: 15,
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Verify OTP
clientMobileRouter.post('/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and 6-digit OTP code are required' });
    }
    const normEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim().replace(/\D/g, '');

    await supabaseVerifyEmailOtp(normEmail, cleanOtp);

    res.json({
      success: true,
      message: 'Email verified successfully with Supabase. You may now set your new password.',
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message || 'Invalid or expired verification code.' });
  }
});

// Reset Password with verified OTP
clientMobileRouter.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, OTP, and new password are required' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }

    const normEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim().replace(/\D/g, '');

    await supabaseVerifyEmailOtp(normEmail, cleanOtp);

    const db = getDb();
    if (db) {
      await db
        .update(schema.users)
        .set({ passwordHash: hashPassword(String(newPassword)) })
        .where(eq(schema.users.email, normEmail));
    }

    otpStore.delete(normEmail);
    res.json({
      success: true,
      message: 'Your password has been successfully reset. Please log in with your new credentials.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Secure Logout
clientMobileRouter.post('/auth/logout', requireAuth(), (req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out securely' });
});

// -------------------------------------------------------------
// 2. Client Dashboard
// -------------------------------------------------------------
clientMobileRouter.get('/dashboard', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();

    if (!borrowerId) {
      return res.json({
        success: true,
        data: {
          borrowerName: req.authUser?.fullName || '',
          memberNumber: 'PENDING',
          totalActiveLoan: 0,
          remainingBalance: 0,
          nextPayment: 0,
          nextPaymentDueDate: null,
          loanStatus: 'NO_ACTIVE_LOAN',
          activeLoansCount: 0,
          savingsBalance: 0,
          shareCapital: 0,
          recentTransactions: [],
        },
      });
    }

    let clientLoans: any[] = [];
    let clientPayments: any[] = [];
    let savingsAccounts: any[] = [];
    let savingsTxns: any[] = [];
    let borrowerInfo: any = null;

    if (db) {
      clientLoans = await db.select().from(schema.loans).where(eq(schema.loans.borrowerId, borrowerId));
      clientPayments = await db.select().from(schema.payments).where(eq(schema.payments.borrowerId, borrowerId));
      savingsAccounts = await db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.memberId, borrowerId));
      if (savingsAccounts.length > 0) {
        savingsTxns = await db.select().from(schema.savingsTransactions)
          .where(eq(schema.savingsTransactions.memberId, borrowerId))
          .orderBy(desc(schema.savingsTransactions.createdAt));
      }
      const bRows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
      if (bRows.length > 0) borrowerInfo = bRows[0];
    }

    // Calculations
    const activeLoans = clientLoans.filter((l) => ['ACTIVE', 'DISBURSED', 'OVERDUE', 'APPROVED'].includes(l.status));
    const totalActiveLoan = activeLoans.reduce((sum, l) => sum + (Number(l.principalAmount) || 0), 0);
    const remainingBalance = activeLoans.reduce((sum, l) => sum + (Number(l.remainingBalance) || 0), 0);

    const primaryLoan = activeLoans[0] || null;
    const nextPayment = primaryLoan ? Number(primaryLoan.monthlyInstallment) || remainingBalance : 0;
    const nextPaymentDueDate = primaryLoan?.nextPaymentDate || null;
    const loanStatus = primaryLoan ? primaryLoan.status : 'NO_ACTIVE_LOAN';

    const recentTransactions = [
      ...clientPayments.slice(0, 3).map((p) => ({
        id: p.id,
        type: 'REPAYMENT',
        amount: Number(p.amount) || 0,
        date: p.paymentDate || p.createdAt,
        referenceNumber: p.referenceNumber || `OR-${p.id}`,
        paymentMethod: p.paymentMethod || 'CASH',
        status: 'COMPLETED',
      })),
      ...savingsTxns.slice(0, 3).map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount) || 0,
        date: t.date || t.createdAt,
        referenceNumber: t.transactionNumber || t.id,
        paymentMethod: t.processedBy || 'CASH',
        status: 'COMPLETED',
      })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);

    const savingsBalance = sumSavingsAccountBalances(savingsAccounts as any);

    res.json({
      success: true,
      data: {
        borrowerName: borrowerInfo?.fullName || req.authUser?.fullName || '',
        memberNumber: borrowerInfo?.borrowerNumber || 'PENDING',
        totalActiveLoan,
        remainingBalance,
        nextPayment,
        nextPaymentDueDate,
        loanStatus,
        activeLoansCount: activeLoans.length,
        savingsBalance,
        shareCapital: Number(borrowerInfo?.shareCapital) || 0,
        recentTransactions,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 3. Client Profile & Allowed Edits & KYC Verification
// -------------------------------------------------------------
clientMobileRouter.get('/profile', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let borrower: any = null;
    let userRow: any = null;

    if (db) {
      if (borrowerId) {
        const rows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
        if (rows.length > 0) borrower = rows[0];
      }
      if (req.authUser?.id) {
        const uRows = await db.select().from(schema.users).where(eq(schema.users.id, req.authUser.id)).limit(1);
        if (uRows.length > 0) userRow = uRows[0];
      }
    }

    const defaultName = req.authUser?.fullName || userRow?.fullName || borrower?.fullName || 'New Member';
    const defaultEmail = req.authUser?.email || userRow?.email || borrower?.email || '';
    const defaultPhone = req.authUser?.phone || userRow?.phone || borrower?.phone || '';

    const profileData = {
      id: borrower?.id || borrowerId,
      fullName: borrower?.fullName || defaultName,
      email: borrower?.email || defaultEmail,
      phone: borrower?.phone || defaultPhone,
      address: borrower?.address || '',
      dateOfBirth: borrower?.dateOfBirth || '',
      civilStatus: borrower?.civilStatus || '',
      occupation: borrower?.occupation || '',
      employer: borrower?.employerOrBusiness || '',
      monthlyIncome: Number(borrower?.monthlyIncome) || 0,
      avatar: req.authUser?.avatar || userRow?.avatar || borrower?.avatar || `https://ui-avatars.com/api/?background=059669&color=fff&name=${encodeURIComponent(defaultName)}`,
      memberNumber: borrower?.borrowerNumber || 'PENDING',
      membershipDate: borrower?.createdAt ? String(borrower.createdAt).split('T')[0] : (borrower?.membershipDate || ''),
      kycStatus: borrower?.kycStatus || 'NOT_STARTED',
      creditScore: Number(borrower?.creditScore) || 0,
      creditTier: borrower?.creditTier || 'PENDING',
    };

    res.json({ success: true, profile: profileData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Edit & Fill Profile Info (Full Name, Email, Phone, Address, Civil Status, Occupation, Employer, Monthly Income, DOB)
clientMobileRouter.patch('/profile', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const { fullName, email, phone, address, dateOfBirth, civilStatus, occupation, employer, employerOrBusiness, monthlyIncome, barangay, cityMunicipality, province, gender } = req.body;
    const db = getDb();

    // 1. Update Borrower Record
    if (db && borrowerId) {
      await db
        .update(schema.borrowers)
        .set({
          ...(fullName !== undefined ? { fullName: String(fullName).trim() } : {}),
          ...(email !== undefined ? { email: String(email).trim().toLowerCase() } : {}),
          ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
          ...(address !== undefined ? { address: String(address).trim() } : {}),
          ...(dateOfBirth !== undefined ? { dateOfBirth: String(dateOfBirth).trim() } : {}),
          ...(civilStatus !== undefined ? { civilStatus: String(civilStatus).trim() } : {}),
          ...(occupation !== undefined ? { occupation: String(occupation).trim() } : {}),
          ...(employerOrBusiness !== undefined ? { employerOrBusiness: String(employerOrBusiness).trim() } : {}),
          ...(employer !== undefined ? { employerOrBusiness: String(employer).trim() } : {}),
          ...(monthlyIncome !== undefined ? { monthlyIncome: Number(monthlyIncome) || 0 } : {}),
          ...(barangay !== undefined ? { barangay: String(barangay).trim() } : {}),
          ...(cityMunicipality !== undefined ? { cityMunicipality: String(cityMunicipality).trim() } : {}),
          ...(province !== undefined ? { province: String(province).trim() } : {}),
          ...(gender !== undefined ? { gender: String(gender).trim() } : {}),
          profileCompleted: true,
        })
        .where(eq(schema.borrowers.id, borrowerId));
    }

    // 2. Update User Record & AuthStore
    if (req.authUser?.id) {
      const updates: any = {};
      if (fullName !== undefined) updates.fullName = String(fullName).trim();
      if (email !== undefined) updates.email = String(email).trim().toLowerCase();
      if (phone !== undefined) updates.phone = String(phone).trim();
      
      if (Object.keys(updates).length > 0) {
        if (db) {
          await db.update(schema.users).set(updates).where(eq(schema.users.id, req.authUser.id));
        }
      }
    }

    res.json({
      success: true,
      message: 'Profile details saved and updated successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload/Update Profile Picture
clientMobileRouter.post('/upload-avatar', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl) {
      return res.status(400).json({ success: false, error: 'Avatar URL or image data is required' });
    }

    const db = getDb();
    if (db && req.authUser?.id) {
      await db.update(schema.users).set({ avatar: avatarUrl }).where(eq(schema.users.id, req.authUser.id));
    }

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      avatarUrl,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// View KYC / Verification Status & Progress
clientMobileRouter.get('/kyc-status', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let kycStatus = 'NOT_STARTED';
    let submissionId: string | undefined;
    let submittedAt: string | undefined;
    let reviewedAt: string | undefined;
    let correctionReason: string | undefined;
    let correctionDetails: any = null;
    let rejectionReason: string | undefined;
    let verifiedAt: string | undefined;
    let reviewedByName: string | undefined;
    let staffRemarks: string | undefined;
    let currentStep = 0;
    let profile: any = null;
    let personalInfo: any = null;
    let address: any = null;
    let contactInfo: any = null;
    let employment: any = null;
    let governmentId: any = null;
    let declarations: any = null;
    let documents: any[] = [];

    if (db) {
      const bRows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
      if (bRows.length > 0) {
        profile = bRows[0];
        kycStatus = profile.kycStatus || 'NOT_STARTED';
        staffRemarks = profile.notes || undefined;
      }
      const subRows = await db.select().from(schema.kycSubmissions)
        .where(eq(schema.kycSubmissions.borrowerId, borrowerId))
        .orderBy(desc(schema.kycSubmissions.createdAt)).limit(1);
      if (subRows.length > 0) {
        const sub = subRows[0];
        submissionId = sub.id;
        kycStatus = sub.status || kycStatus;
        submittedAt = sub.submittedAt || undefined;
        reviewedAt = sub.reviewedAt || undefined;
        correctionReason = sub.correctionReason || undefined;
        correctionDetails = (sub as any).correctionDetails || null;
        rejectionReason = sub.rejectionReason || undefined;
        verifiedAt = sub.verifiedAt || undefined;
        reviewedByName = sub.reviewedByName || undefined;
        personalInfo = sub.personalInfo || null;
        address = sub.address || null;
        contactInfo = (sub as any).contactInfo || null;
        employment = sub.employment || null;
        governmentId = (sub as any).governmentId || null;
        declarations = (sub as any).declarations || null;
        currentStep = (sub as any).currentStep || 0;
      }

      // If personalInfo not yet in submission, pre-fill from registration profile
      if (!personalInfo && profile) {
        personalInfo = {
          firstName: profile.firstName || (profile.fullName ? profile.fullName.split(' ')[0] : ''),
          middleName: profile.middleName || '',
          hasNoMiddleName: Boolean(profile.hasNoMiddleName),
          lastName: profile.lastName || (profile.fullName ? profile.fullName.split(' ').slice(1).join(' ') : ''),
          suffix: profile.suffix || '',
          dateOfBirth: profile.dateOfBirth || '',
          placeOfBirth: '',
          gender: profile.gender || '',
          civilStatus: profile.civilStatus || '',
          nationality: 'Filipino',
          citizenship: 'Filipino',
        };
      }

      // If contactInfo not yet in submission, pre-fill from registration
      if (!contactInfo && profile) {
        contactInfo = {
          mobileNumber: profile.phone || '',
          mobileVerified: true,
          email: profile.email || '',
          emailVerified: Boolean(profile.emailVerified),
          alternativeMobile: '',
          emergencyContactName: '',
          emergencyContactRelationship: '',
        };
      }

      // If address not yet in submission, pre-fill from profile
      if (!address && profile && (profile.barangay || profile.cityMunicipality || profile.province || profile.address)) {
        address = {
          current: {
            region: '',
            regionCode: '',
            province: profile.province || '',
            provinceCode: '',
            city: profile.cityMunicipality || '',
            cityCode: '',
            barangay: profile.barangay || '',
            barangayCode: '',
            postalCode: '',
            houseNumber: '',
            street: profile.address || '',
            subdivision: '',
            landmark: '',
            additionalDetails: '',
          },
          isPermanentSameAsCurrent: true,
          permanent: null,
        };
      }

      // If employment not yet in submission, pre-fill from profile
      if (!employment && profile) {
        employment = {
          employmentStatus: profile.employmentStatus && profile.employmentStatus !== 'Pending' ? profile.employmentStatus : '',
          otherStatusExplanation: '',
          employerName: profile.employerOrBusiness || '',
          jobPosition: profile.occupation || '',
          employmentType: 'Regular / Permanent',
          yearsOfEmployment: 1,
          employerAddress: '',
          businessName: profile.employerOrBusiness || '',
          natureOfBusiness: profile.occupation || '',
          yearsInBusiness: 1,
          businessAddress: '',
          monthlyIncome: Number(profile.monthlyIncome) || 0,
          monthlyExpenses: Number(profile.monthlyExpenses) || 0,
          sourceOfIncome: profile.sourceOfIncome || '',
          sourceOfFunds: 'Employment / Business',
        };
      }

      const docRows = await db.select().from(schema.kycDocuments)
        .where(eq(schema.kycDocuments.borrowerId, borrowerId));
      documents = docRows.map((d: any) => ({
        id: d.id,
        type: d.documentType,
        name: d.documentName,
        submitted: !!d.fileUrl || !!d.fileName,
        status: d.status || 'UPLOADED',
        fileName: d.fileName,
        fileUrl: d.fileUrl || undefined,
        storagePath: d.storagePath || undefined,
        rejectionReason: d.rejectionReason || undefined,
      }));
    }

    const defaultRequired = [
      { documentType: 'GOVERNMENT_ID', documentName: 'Government-Issued Photo ID', description: 'Clear photo of valid government ID (PhilSys, Passport, Driver License, UMID).', isActive: true, sortOrder: 1 },
      { documentType: 'PROOF_OF_ADDRESS', documentName: 'Proof of Address', description: 'Utility bill, Barangay clearance, or lease contract dated within 3 months.', isActive: true, sortOrder: 2 },
      { documentType: 'PROOF_OF_INCOME', documentName: 'Proof of Income / Livelihood', description: 'Recent payslip, ITR, Certificate of Employment, or Business Permit.', isActive: true, sortOrder: 3 },
      { documentType: 'SELFIE_WITH_ID', documentName: 'Selfie with Government ID', description: 'Clear photo of your face holding your government ID beside you.', isActive: true, sortOrder: 4 },
    ];

    const requiredDocs = defaultRequired.map((r) => {
      const matched = documents.find((d: any) => d.type === r.documentType || (r.documentType === 'GOVERNMENT_ID' && (d.type === 'VALID_ID' || d.type === 'ID_FRONT')) || (r.documentType === 'SELFIE_WITH_ID' && (d.type === 'SELFIE' || d.type === 'PHOTO_2X2')));
      return {
        type: r.documentType,
        name: r.documentName,
        description: r.description,
        submitted: !!matched?.submitted,
        status: matched?.status || 'NOT_UPLOADED',
        fileUrl: matched?.fileUrl,
        fileName: matched?.fileName,
      };
    });

    const isVerified = ['APPROVED', 'VERIFIED'].includes(String(kycStatus).toUpperCase());

    res.json({
      success: true,
      kycStatus,
      isVerified,
      currentStep,
      requiredDocuments: requiredDocs,
      uploadedDocuments: documents,
      submissionId,
      submittedAt,
      reviewedAt,
      correctionReason,
      correctionDetails,
      rejectionReason,
      staffRemarks,
      verifiedAt,
      reviewedByName,
      referenceNumber: submissionId,
      submission: {
        personalInfo,
        address,
        contactInfo,
        employment,
        governmentId,
        declarations,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save KYC progress / draft without submitting
clientMobileRouter.post('/kyc/save-draft', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const { personalInfo, address, contactInfo, employment, governmentId, declarations, currentStep } = req.body || {};
    const now = new Date().toISOString();
    const db = getDb();

    if (!db) {
      return res.json({ success: true, message: 'Draft saved.' });
    }

    const existing = await db.select().from(schema.kycSubmissions)
      .where(eq(schema.kycSubmissions.borrowerId, borrowerId))
      .orderBy(desc(schema.kycSubmissions.createdAt)).limit(1);

    let submissionId: string;
    if (existing.length > 0) {
      submissionId = existing[0].id;
      const currentStatus = existing[0].status;
      const nextStatus = currentStatus === 'NOT_STARTED' ? 'IN_PROGRESS' : currentStatus;
      await db.update(schema.kycSubmissions).set({
        personalInfo: personalInfo || existing[0].personalInfo,
        address: address || existing[0].address,
        contactInfo: contactInfo || (existing[0] as any).contactInfo,
        employment: employment || existing[0].employment,
        governmentId: governmentId || (existing[0] as any).governmentId,
        declarations: declarations || (existing[0] as any).declarations,
        currentStep: typeof currentStep === 'number' ? currentStep : (existing[0] as any).currentStep || 0,
        status: nextStatus,
        updatedAt: now,
      } as any).where(eq(schema.kycSubmissions.id, submissionId));

      if (currentStatus === 'NOT_STARTED') {
        await db.update(schema.borrowers).set({ kycStatus: 'IN_PROGRESS' }).where(eq(schema.borrowers.id, borrowerId));
      }
    } else {
      submissionId = `KYC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(schema.kycSubmissions).values({
        id: submissionId,
        borrowerId,
        status: 'IN_PROGRESS',
        personalInfo: personalInfo || null,
        address: address || null,
        contactInfo: contactInfo || null,
        employment: employment || null,
        governmentId: governmentId || null,
        declarations: declarations || null,
        currentStep: typeof currentStep === 'number' ? currentStep : 0,
        createdAt: now,
        updatedAt: now,
      } as any);
      await db.update(schema.borrowers).set({ kycStatus: 'IN_PROGRESS' }).where(eq(schema.borrowers.id, borrowerId));
    }

    res.json({ success: true, message: 'KYC draft saved successfully.', submissionId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit KYC application with thorough backend validation
clientMobileRouter.post('/kyc/submit', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const {
      personalInfo,
      address,
      contactInfo,
      employment,
      governmentId,
      declarations,
    } = req.body || {};

    const missingFields: string[] = [];

    // 1. Personal Information Validation
    if (!personalInfo) {
      missingFields.push('Personal Information');
    } else {
      if (!personalInfo.firstName?.trim()) missingFields.push('Legal First Name');
      if (!personalInfo.lastName?.trim()) missingFields.push('Legal Last Name');
      if (!personalInfo.dateOfBirth?.trim()) missingFields.push('Date of Birth');
      if (!personalInfo.placeOfBirth?.trim()) missingFields.push('Place of Birth');
      if (!personalInfo.gender?.trim()) missingFields.push('Sex / Gender');
      if (!personalInfo.civilStatus?.trim()) missingFields.push('Civil Status');
      if (!personalInfo.nationality?.trim()) missingFields.push('Nationality');
    }

    // 2. Address Validation
    const curAddr = address?.current;
    if (!curAddr) {
      missingFields.push('Current Address');
    } else {
      if (!curAddr.region?.trim() && !curAddr.regionCode?.trim()) missingFields.push('Current Address Region');
      if (!curAddr.city?.trim() && !curAddr.cityCode?.trim()) missingFields.push('Current Address City / Municipality');
      if (!curAddr.barangay?.trim() && !curAddr.barangayCode?.trim()) missingFields.push('Current Address Barangay');
      if (!curAddr.houseNumber?.trim() && !curAddr.street?.trim()) missingFields.push('Current Address House / Street details');
      if (!curAddr.postalCode?.trim()) missingFields.push('Current Address ZIP / Postal Code');
    }

    if (address && address.isPermanentSameAsCurrent === false) {
      const permAddr = address.permanent;
      if (!permAddr) {
        missingFields.push('Permanent Address');
      } else {
        if (!permAddr.region?.trim() && !permAddr.regionCode?.trim()) missingFields.push('Permanent Address Region');
        if (!permAddr.city?.trim() && !permAddr.cityCode?.trim()) missingFields.push('Permanent Address City / Municipality');
        if (!permAddr.barangay?.trim() && !permAddr.barangayCode?.trim()) missingFields.push('Permanent Address Barangay');
        if (!permAddr.houseNumber?.trim() && !permAddr.street?.trim()) missingFields.push('Permanent Address House / Street details');
        if (!permAddr.postalCode?.trim()) missingFields.push('Permanent Address ZIP Code');
      }
    }

    // 3. Contact Information Validation
    if (!contactInfo) {
      missingFields.push('Contact Information');
    } else {
      if (!contactInfo.mobileNumber?.trim()) missingFields.push('Mobile Number');
    }

    // 4. Employment & Financial Information Validation
    if (!employment) {
      missingFields.push('Employment & Financial Information');
    } else {
      if (!employment.employmentStatus?.trim()) missingFields.push('Employment Status');
      if (employment.employmentStatus === 'Other' && !employment.otherStatusExplanation?.trim()) {
        missingFields.push('Explanation for Other Employment Status');
      }
      const isEmployed = ['Employed', 'Government Employee', 'Private Employee'].includes(employment.employmentStatus);
      if (isEmployed && !employment.employerName?.trim()) {
        missingFields.push('Employer Name');
      }
      const isBusiness = ['Self-Employed', 'Business Owner'].includes(employment.employmentStatus);
      if (isBusiness && !employment.businessName?.trim()) {
        missingFields.push('Business Name');
      }
      if (typeof employment.monthlyIncome !== 'number' || employment.monthlyIncome < 0) {
        missingFields.push('Valid Monthly Income (cannot be negative)');
      }
      if (typeof employment.monthlyExpenses !== 'number' || employment.monthlyExpenses < 0) {
        missingFields.push('Valid Monthly Expenses (cannot be negative)');
      }
      if (!employment.sourceOfIncome?.trim()) missingFields.push('Source of Income');
    }

    // 5. Government ID Validation
    if (!governmentId) {
      missingFields.push('Government ID Information');
    } else {
      if (!governmentId.idType?.trim()) missingFields.push('Government ID Type');
      if (!governmentId.idNumber?.trim()) missingFields.push('Government ID Number');
      if (!governmentId.nameOnId?.trim()) missingFields.push('Name on Government ID');
    }

    // 6. Declarations Validation
    if (!declarations) {
      missingFields.push('Required Declarations & Consent');
    } else {
      if (!declarations.truthfulInformation) missingFields.push('Confirmation of Truthful Information');
      if (!declarations.documentOwnership) missingFields.push('Confirmation of Document Ownership');
      if (!declarations.authorizedReview) missingFields.push('Authorization to Review Information');
      if (!declarations.privacyNotice) missingFields.push('Data Privacy Notice Consent (RA 10173)');
      if (!declarations.penaltyAcknowledgment) missingFields.push('Acknowledgement of False Information Penalties');
    }

    // 7. Documents Validation
    const db = getDb();
    if (db) {
      const docs = await db.select().from(schema.kycDocuments).where(eq(schema.kycDocuments.borrowerId, borrowerId));
      const hasGovId = docs.some((d: any) => ['GOVERNMENT_ID', 'VALID_ID', 'ID_FRONT'].includes(d.documentType) && (d.fileUrl || d.fileName));
      const hasAddressProof = docs.some((d: any) => d.documentType === 'PROOF_OF_ADDRESS' && (d.fileUrl || d.fileName));
      const hasIncomeProof = docs.some((d: any) => d.documentType === 'PROOF_OF_INCOME' && (d.fileUrl || d.fileName));
      const hasSelfie = docs.some((d: any) => ['SELFIE_WITH_ID', 'SELFIE', 'PHOTO_2X2'].includes(d.documentType) && (d.fileUrl || d.fileName));

      if (!hasGovId) missingFields.push('Government ID Document Upload');
      if (!hasAddressProof) missingFields.push('Proof of Address Document Upload');
      if (!hasIncomeProof) missingFields.push('Proof of Income Document Upload');
      if (!hasSelfie) missingFields.push('Selfie with ID Document Upload');
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Please complete all required items before submitting: ${missingFields.slice(0, 5).join(', ')}${missingFields.length > 5 ? ` and ${missingFields.length - 5} more` : ''}.`,
        missingFields,
      });
    }

    const now = new Date().toISOString();

    if (db) {
      const existing = await db.select().from(schema.kycSubmissions)
        .where(eq(schema.kycSubmissions.borrowerId, borrowerId))
        .orderBy(desc(schema.kycSubmissions.createdAt)).limit(1);

      let submissionId: string;
      let previousStatus = existing.length > 0 ? existing[0].status : 'NOT_STARTED';

      if (existing.length > 0) {
        submissionId = existing[0].id;
        await db.update(schema.kycSubmissions).set({
          personalInfo,
          address,
          contactInfo,
          employment,
          governmentId,
          declarations,
          currentStep: 6,
          status: 'SUBMITTED',
          submittedAt: now,
          updatedAt: now,
          correctionReason: null,
          correctionDetails: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewedByName: null,
        } as any).where(eq(schema.kycSubmissions.id, submissionId));
      } else {
        submissionId = `KYC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        await db.insert(schema.kycSubmissions).values({
          id: submissionId,
          borrowerId,
          status: 'SUBMITTED',
          personalInfo,
          address,
          contactInfo,
          employment,
          governmentId,
          declarations,
          currentStep: 6,
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
        } as any);
      }

      const formattedCurAddr = [
        curAddr.houseNumber,
        curAddr.street,
        curAddr.subdivision,
        curAddr.barangay ? `Brgy. ${curAddr.barangay}` : null,
        curAddr.city,
        curAddr.province,
        curAddr.postalCode,
      ].filter(Boolean).join(', ');

      const composedFullName = [
        personalInfo.firstName,
        (!personalInfo.hasNoMiddleName && personalInfo.middleName) ? personalInfo.middleName : null,
        personalInfo.lastName,
        personalInfo.suffix,
      ].filter(Boolean).join(' ');

      await db.update(schema.borrowers).set({
        kycStatus: 'SUBMITTED',
        profileCompleted: true,
        fullName: composedFullName || undefined,
        firstName: personalInfo.firstName || null,
        middleName: (!personalInfo.hasNoMiddleName && personalInfo.middleName) ? personalInfo.middleName : null,
        lastName: personalInfo.lastName || null,
        suffix: personalInfo.suffix || null,
        hasNoMiddleName: Boolean(personalInfo.hasNoMiddleName),
        dateOfBirth: personalInfo.dateOfBirth || '',
        gender: personalInfo.gender || '',
        civilStatus: personalInfo.civilStatus || '',
        address: formattedCurAddr || '',
        barangay: curAddr.barangay || null,
        cityMunicipality: curAddr.city || null,
        province: curAddr.province || null,
        occupation: employment.jobPosition || employment.natureOfBusiness || employment.employmentStatus || '',
        employerOrBusiness: employment.employerName || employment.businessName || '',
        monthlyIncome: Number(employment.monthlyIncome) || 0,
        monthlyExpenses: Number(employment.monthlyExpenses) || 0,
        sourceOfIncome: employment.sourceOfIncome || '',
        idNumber: governmentId.idNumber || '',
      }).where(eq(schema.borrowers.id, borrowerId));

      await db.insert(schema.kycAuditLog).values({
        id: `AUDIT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        borrowerId,
        kycSubmissionId: submissionId,
        action: 'SUBMITTED',
        previousStatus,
        newStatus: 'SUBMITTED',
        createdAt: now,
      });

      // Notify branch staff about new KYC submission
      try {
        const borrowerRows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
        const branchId = borrowerRows[0]?.branchId || 'br-main';
        await db.insert(schema.branchNotifications).values({
          id: `NOTIF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          branchId,
          type: 'KYC',
          title: 'KYC Application Submitted',
          message: `${composedFullName || 'A member'} submitted complete KYC verification documents.`,
          relatedType: 'Borrower',
          relatedId: borrowerId,
          isRead: false,
          createdAt: now,
        });
      } catch (notifErr) {
        console.warn('[KYC Submit] Notification creation warning:', notifErr);
      }

      res.json({
        success: true,
        message: 'KYC verification application submitted successfully and queued for staff review.',
        status: 'SUBMITTED',
        referenceNumber: submissionId,
      });
    } else {
      res.json({
        success: true,
        message: 'KYC verification application submitted successfully.',
        status: 'SUBMITTED',
        referenceNumber: `KYC-${Date.now().toString(36)}`,
      });
    }
  } catch (err: any) {
    console.error('[KYC Submit] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error during KYC submission' });
  }
});

// List KYC required documents (configurable by institution) with upload status
clientMobileRouter.get('/kyc/required-documents', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const db = getDb();
    let configDocs: any[] = [];
    if (db) {
      configDocs = await db.select().from(schema.kycRequiredDocuments).where(eq(schema.kycRequiredDocuments.isActive, true));
    }
    const defaults = [
      { documentType: 'VALID_ID', documentName: 'Primary Government ID (UMID / Driver License / Passport)', description: 'A valid, current government-issued photo ID.', isActive: true, sortOrder: 1 },
      { documentType: 'PROOF_OF_ADDRESS', documentName: 'Barangay Clearance or Utility Bill', description: 'Recent proof of residence within the last 3 months.', isActive: true, sortOrder: 2 },
      { documentType: 'PROOF_OF_INCOME', documentName: 'Payslip / Business Permit / Bank Statement', description: 'Evidence of regular income or business operations.', isActive: true, sortOrder: 3 },
      { documentType: 'PHOTO_2X2', documentName: 'Recent 2x2 ID Photo', description: 'A recent photograph with white background.', isActive: true, sortOrder: 4 },
    ];
    const docs = configDocs.length > 0 ? configDocs : defaults;
    res.json({ success: true, documents: docs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get uploaded KYC documents for the current borrower
clientMobileRouter.get('/kyc/documents', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let documents: any[] = [];
    if (db) {
      const docRows = await db.select().from(schema.kycDocuments)
        .where(eq(schema.kycDocuments.borrowerId, borrowerId));
      documents = docRows.map((d: any) => ({
        id: d.id,
        documentType: d.documentType,
        documentName: d.documentName,
        fileName: d.fileName,
        status: d.status,
        rejectionReason: d.rejectionReason,
      }));
    }
    res.json({ success: true, documents });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
clientMobileRouter.post('/kyc/documents/upload', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    // Use borrowerId if available, otherwise fall back to userId so new users can still upload
    const borrowerId = getClientBorrowerId(req) || req.authUser?.id || null;
    if (!borrowerId) {
      return res.status(400).json({ success: false, error: 'Cannot identify your account. Please log out and sign in again.' });
    }
    const { documentType, documentName, fileName, imageBase64, side, mime } = req.body || {};
    if (!documentType || !documentName) {
      return res.status(400).json({ success: false, error: 'documentType and documentName are required.' });
    }
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required for upload. Please select a photo from your gallery.' });
    }
    const now = new Date().toISOString();
    const db = getDb();

    // Upload the real bytes to secure storage (server-side service role).
    let safeUrl: string | null = null;
    try {
      const folder = side ? `doc-${stringToId(documentType)}-${side}` : `doc-${stringToId(documentType)}`;
      console.log(`[KYC Upload] Uploading ${documentType} for borrower/user: ${borrowerId}`);
      const uploaded = await uploadKycFile(borrowerId, folder, imageBase64, mime);
      safeUrl = uploaded?.signedUrl ?? null;
      if (uploaded) {
        // Best effort removal of older copies for the same doc/side.
        removeKycFolderObjects(borrowerId, folder).catch(() => {});
      }
    } catch (storageErr: any) {
      console.error(`[KYC Upload] Storage error:`, storageErr.message);
      return res.status(400).json({ success: false, error: storageErr.message });
    }

    const docId = `DOC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const savedName = fileName || `${documentType}_${Date.now()}.jpg`;
    if (db) {
      try {
        const subRows = await db.select().from(schema.kycSubmissions)
          .where(eq(schema.kycSubmissions.borrowerId, borrowerId))
          .orderBy(desc(schema.kycSubmissions.createdAt)).limit(1);
        const subId = subRows.length > 0 ? subRows[0].id : 'PENDING';
        await db.insert(schema.kycDocuments).values({
          id: docId,
          kycSubmissionId: subId,
          borrowerId,
          documentType,
          documentName,
          fileName: savedName,
          fileUrl: safeUrl || undefined,
          status: 'PENDING',
          createdAt: now,
        });
      } catch (dbErr: any) {
        // DB insert failed but file is already in storage — still return success so user can continue
        console.warn(`[KYC Upload] DB insert warning (file uploaded OK):`, dbErr.message);
      }
    }
    console.log(`[KYC Upload] ✅ ${documentType} uploaded successfully for ${borrowerId}`);
    res.json({
      success: true,
      document: {
        id: docId,
        documentType,
        documentName,
        fileName: savedName,
        fileUrl: safeUrl,
        status: 'PENDING',
      },
    });
  } catch (err: any) {
    console.error(`[KYC Upload] Unexpected error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload a selfie used for face verification against the submitted ID.
clientMobileRouter.post('/kyc/selfie', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req) || req.authUser?.id || null;
    if (!borrowerId) {
      return res.status(400).json({ success: false, error: 'Cannot identify your account. Please log out and sign in again.' });
    }
    const { imageBase64, mime } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required for the selfie.' });
    }
    const now = new Date().toISOString();
    const db = getDb();

    let safeUrl: string | null = null;
    try {
      const uploaded = await uploadKycFile(borrowerId, 'selfie', imageBase64, mime);
      safeUrl = uploaded?.signedUrl ?? null;
      if (uploaded) removeKycFolderObjects(borrowerId, 'selfie').catch(() => {});
    } catch (storageErr: any) {
      return res.status(400).json({ success: false, error: storageErr.message });
    }

    const docId = `DOC-SELFIE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    if (db) {
      const subRows = await db.select().from(schema.kycSubmissions)
        .where(eq(schema.kycSubmissions.borrowerId, borrowerId))
        .orderBy(desc(schema.kycSubmissions.createdAt)).limit(1);
      const subId = subRows.length > 0 ? subRows[0].id : 'PENDING';
      await db.insert(schema.kycDocuments).values({
        id: docId,
        kycSubmissionId: subId,
        borrowerId,
        documentType: 'SELFIE',
        documentName: 'Profile Selfie',
        fileName: `selfie_${Date.now()}.jpg`,
        fileUrl: safeUrl || undefined,
        status: 'PENDING',
        createdAt: now,
      });
    }
    res.json({ success: true, selfie: { id: docId, fileUrl: safeUrl, status: 'PENDING' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 4. Loan Products, Calculator & Application Flow
// -------------------------------------------------------------
clientMobileRouter.get('/loan-products', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    let products: any[] = [];
    if (db) {
      products = await db.select().from(schema.loanProducts);
    }

    if (products.length === 0) {
      products = [
        {
          id: 'prod-1',
          name: 'Micro-Enterprise Working Capital',
          code: 'ME-001',
          minAmount: 10000,
          maxAmount: 150000,
          minTermMonths: 3,
          maxTermMonths: 24,
          interestRatePerMonth: 1.5,
          interestType: 'REDUCING_BALANCE',
          processingFeePercentage: 2.0,
          description: 'Working capital financing for sari-sari stores, market stalls, and small trade shops.',
        },
        {
          id: 'prod-2',
          name: 'Solidarity Group Microloan',
          code: 'SG-002',
          minAmount: 5000,
          maxAmount: 50000,
          minTermMonths: 3,
          maxTermMonths: 12,
          interestRatePerMonth: 1.25,
          interestType: 'FLAT_RATE',
          processingFeePercentage: 1.5,
          description: 'Zero-collateral group loan backed by peer mutual guarantee circle.',
        },
        {
          id: 'prod-3',
          name: 'Salary & Multi-Purpose Loan',
          code: 'SL-003',
          minAmount: 15000,
          maxAmount: 250000,
          minTermMonths: 6,
          maxTermMonths: 36,
          interestRatePerMonth: 1.2,
          interestType: 'REDUCING_BALANCE',
          processingFeePercentage: 2.0,
          description: 'Flexible personal loan for medical, education, home renovation, or equipment.',
        },
        {
          id: 'prod-4',
          name: 'Emergency Relief Loan',
          code: 'ER-004',
          minAmount: 5000,
          maxAmount: 30000,
          minTermMonths: 3,
          maxTermMonths: 6,
          interestRatePerMonth: 1.0,
          interestType: 'FLAT_RATE',
          processingFeePercentage: 0.5,
          description: 'Rapid-disbursement financial assistance for emergencies and hospitalizations.',
        },
      ];
    }

    res.json({ success: true, products });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Loan Calculation Endpoint
clientMobileRouter.post('/calculate-loan', (req: Request, res: Response) => {
  try {
    const { amount, termMonths, interestRatePerMonth, interestType = 'REDUCING_BALANCE' } = req.body;
    const principal = Number(amount) || 25000;
    const term = Number(termMonths) || 6;
    const monthlyRate = Number(interestRatePerMonth) || 1.5;

    let estimatedMonthlyPayment = 0;
    let totalInterest = 0;

    if (interestType === 'FLAT_RATE') {
      totalInterest = principal * (monthlyRate / 100) * term;
      const totalRepayable = principal + totalInterest;
      estimatedMonthlyPayment = totalRepayable / term;
    } else {
      // Reducing Balance Amortization
      const r = monthlyRate / 100;
      if (r === 0) {
        estimatedMonthlyPayment = principal / term;
      } else {
        estimatedMonthlyPayment = (principal * r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1);
      }
      totalInterest = (estimatedMonthlyPayment * term) - principal;
    }

    const processingFee = principal * 0.02;
    const netProceeds = principal - processingFee;

    res.json({
      success: true,
      calculation: {
        principal,
        termMonths: term,
        monthlyInterestRate: monthlyRate,
        estimatedMonthlyPayment: Math.round(estimatedMonthlyPayment * 100) / 100,
        estimatedTotalInterest: Math.round(totalInterest * 100) / 100,
        totalRepayable: Math.round((principal + totalInterest) * 100) / 100,
        processingFee: Math.round(processingFee * 100) / 100,
        estimatedNetProceeds: Math.round(netProceeds * 100) / 100,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit Loan Application
clientMobileRouter.post('/apply-loan', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req) || req.authUser?.id || null;
    if (!borrowerId) {
      return res.status(400).json({ success: false, error: 'Cannot identify your account. Please log out and sign in again.' });
    }

    // --- KYC verification gate ---
    const db = getDb();
    let kycStatus = 'NOT_STARTED';
    if (db) {
      try {
        const bRows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
        if (bRows.length > 0) kycStatus = bRows[0].kycStatus || 'NOT_STARTED';
        const subRows = await db.select().from(schema.kycSubmissions)
          .where(eq(schema.kycSubmissions.borrowerId, borrowerId))
          .orderBy(desc(schema.kycSubmissions.createdAt)).limit(1);
        if (subRows.length > 0) kycStatus = subRows[0].status || kycStatus;
      } catch {}
    }

    // Block unapproved KYC users — loans require approved KYC
    const isApproved = ['VERIFIED', 'APPROVED'].includes(String(kycStatus).toUpperCase());
    if (!isApproved) {
      const messages: Record<string, string> = {
        NOT_STARTED: 'Please complete your KYC verification before applying for a loan. Go to Profile → Complete KYC Verification.',
        IN_PROGRESS: 'Please complete and submit your KYC verification before applying for a loan.',
        SUBMITTED: 'Your KYC submission is currently under review by our compliance team. You can apply for a loan once approved.',
        PENDING: 'Your KYC submission is currently under review. You can apply for a loan once approved.',
        UNDER_REVIEW: 'Your KYC verification is currently under review. You can apply for a loan once approved.',
        CORRECTION_REQUIRED: 'Your KYC requires corrections. Please update your information/documents and resubmit before applying for a loan.',
        REJECTED: 'Your KYC was rejected. Please review the branch notes and resubmit your KYC verification.',
        SUSPENDED: 'Your account KYC is currently suspended. Please contact your branch.',
      };
      return res.status(403).json({
        success: false,
        error: messages[String(kycStatus).toUpperCase()] || 'Your KYC verification must be approved before you can apply for a loan.',
        kycStatus,
      });
    }

    const {
      productId,
      productName,
      amount,
      termMonths,
      repaymentFrequency = 'Monthly',
      purpose,
      purposeDetails,
      guarantorName,
      guarantorPhone,
      guarantorRelationship,
      collateralDescription,
      collateralValue,
      documents = [],
      declarations,
    } = req.body;

    if (!amount || !termMonths || !purpose) {
      return res.status(400).json({ success: false, error: 'Amount, term, and loan purpose are required' });
    }

    const principal = Number(amount);
    const term = Number(termMonths);
    if (!Number.isFinite(principal) || principal <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter a valid loan amount.' });
    }
    if (!Number.isFinite(term) || term <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter a valid loan term.' });
    }

    // Resolve the real product terms from loan_products so the client's quoted
    // figures match exactly what the branch and admin views compute.
    let product: any = null;
    let resolvedProductId = productId ? String(productId) : '';
    let resolvedProductName = productName ? String(productName) : '';
    if (db && resolvedProductId) {
      try {
        product = (await db.select().from(schema.loanProducts).where(eq(schema.loanProducts.id, resolvedProductId)).limit(1))[0] || null;
      } catch {}
    }
    if (product) {
      resolvedProductId = String(product.id);
      resolvedProductName = String(product.name);
    }

    const annualRate = Number(product?.interestRate) || 12;
    const interestType = String(product?.interestType || 'Reducing Balance');
    const processingFeePct = Number(product?.processingFeePercentage) || 2;
    const frequency = product?.defaultRepaymentFrequency
      ? String(product.defaultRepaymentFrequency)
      : String(repaymentFrequency || 'Monthly');

    if (product?.minAmount != null && principal < Number(product.minAmount)) {
      return res.status(400).json({ success: false, error: `Minimum amount for this loan is ₱${Number(product.minAmount).toLocaleString()}.` });
    }
    if (product?.maxAmount != null && principal > Number(product.maxAmount)) {
      return res.status(400).json({ success: false, error: `Maximum amount for this loan is ₱${Number(product.maxAmount).toLocaleString()}.` });
    }
    if (product?.minTermMonths != null && term < Number(product.minTermMonths)) {
      return res.status(400).json({ success: false, error: `Minimum term for this loan is ${product.minTermMonths} months.` });
    }
    if (product?.maxTermMonths != null && term > Number(product.maxTermMonths)) {
      return res.status(400).json({ success: false, error: `Maximum term for this loan is ${product.maxTermMonths} months.` });
    }

    const todayString = new Date().toISOString().split('T')[0];
    const calc = calculateLoanSchedule({
      principal,
      annualInterestRate: annualRate,
      termMonths: term,
      interestType: interestType as any,
      repaymentFrequency: frequency as any,
      processingFeePercentage: processingFeePct,
      startDate: todayString,
    });
    const monthlyInstallment = calc.installmentAmount;
    const totalInterest = calc.totalInterest;
    const totalPayable = calc.totalPayable;

    const applicationId = `LA-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    let borrowerName = req.authUser?.fullName || '';
    let borrowerPhone = req.authUser?.phone || '';
    let borrowerAvatar = req.authUser?.avatar || null;

    // Resolve branch + the responsible loan officer from the borrower's own record.
    let branchId = 'br-main';
    try {
      const bRows = await db
        .select({
          branchId: schema.borrowers.branchId,
          fullName: schema.borrowers.fullName,
          phone: schema.borrowers.phone,
          avatar: schema.borrowers.avatar,
        })
        .from(schema.borrowers)
        .where(eq(schema.borrowers.id, borrowerId))
        .limit(1);
      if (bRows.length > 0) {
        if (bRows[0].branchId) branchId = String(bRows[0].branchId);
        if (!borrowerName && bRows[0].fullName) borrowerName = String(bRows[0].fullName);
        if (!borrowerPhone && bRows[0].phone) borrowerPhone = String(bRows[0].phone);
        if (!borrowerAvatar && bRows[0].avatar) borrowerAvatar = String(bRows[0].avatar);
      }
    } catch {}

    let loanOfficerId: string | null = null;
    let loanOfficerName: string | null = null;
    try {
      const officers = await db
        .select()
        .from(schema.staff)
        .where(eq(schema.staff.assignedBranchId, branchId));
      const OFFICER_ROLES = ['LOAN_OFFICER', 'MANAGER', 'ADMINISTRATOR', 'CREDIT_COMMITTEE', 'BRANCH_MANAGER'];
      const officer: any = (officers as any[]).find((s: any) => OFFICER_ROLES.includes(normalizeRole(s.role))) || officers[0];
      if (officer) {
        loanOfficerId = String(officer.id);
        loanOfficerName = String(officer.name);
      }
    } catch {}

    if (!loanOfficerId) {
      loanOfficerId = 'staff-system';
      loanOfficerName = 'Loan Processing Team';
    }

    // Canonical invariant: outstanding = total amount due - valid payments.
    const remainingBalance = computeLoanRemainingBalance(totalPayable, 0);

    const fullPurposeString = purposeDetails
      ? typeof purposeDetails === 'object'
        ? `${purpose} - ${Object.entries(purposeDetails).map(([k, v]) => `${k}: ${v}`).join('; ')}`
        : `${purpose} - ${purposeDetails}`
      : purpose;

    const guarantorObject = guarantorName
      ? [{ name: guarantorName, phone: guarantorPhone || '', relationship: guarantorRelationship || 'Guarantor' }]
      : null;

    const collateralObject = collateralDescription
      ? { description: collateralDescription, estimatedValue: Number(collateralValue) || 0 }
      : null;

    const maturityDateStr = calc.schedule && calc.schedule.length > 0
      ? calc.schedule[calc.schedule.length - 1].dueDate
      : new Date(Date.now() + term * 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const newApplication = {
      id: applicationId,
      loanNumber: applicationId,
      borrowerId,
      borrowerName,
      borrowerPhone,
      borrowerAvatar,
      productId: resolvedProductId || null,
      productName: resolvedProductName || null,
      branchId,
      principalAmount: principal,
      interestRate: annualRate,
      interestType,
      repaymentFrequency: frequency,
      termMonths: term,
      totalInstallments: calc.totalInstallments,
      processingFee: calc.processingFee,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayable,
      totalPaid: 0,
      remainingBalance,
      status: 'Submitted',
      coopStep: 'CREDIT_INVESTIGATION',
      applicationDate: todayString,
      maturityDate: maturityDateStr,
      loanOfficerId,
      loanOfficerName,
      purpose: fullPurposeString,
      collateral: collateralObject,
      guarantors: guarantorObject,
      schedule: calc.schedule,
    };

    if (db) {
      try {
        await db.insert(schema.loans).values(newApplication as any);

        // Store any attached supporting documents
        if (Array.isArray(documents) && documents.length > 0) {
          for (const doc of documents) {
            if (doc && (doc.fileUrl || doc.fileName || doc.base64)) {
              const docId = `DOC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
              let docUrl = doc.fileUrl || '';
              let docPath = doc.storagePath || '';
              if (doc.base64 && !docUrl) {
                try {
                  const uploaded = await uploadKycFile(borrowerId, 'loan-docs', doc.base64, doc.mimeType);
                  docUrl = uploaded.signedUrl;
                  docPath = uploaded.path;
                } catch (upErr: any) {
                  console.warn('[Loan Apply] Document upload fallback:', upErr?.message);
                }
              }
              await db.insert(schema.documents).values({
                id: docId,
                docNumber: `DOC-${Date.now().toString().slice(-6)}`,
                branchId,
                clientId: borrowerId,
                clientName: borrowerName,
                loanId: applicationId,
                loanNumber: applicationId,
                docName: String(doc.docName || doc.name || 'Supporting Document'),
                docType: String(doc.docType || doc.type || 'LOAN_ATTACHMENT'),
                fileUrl: docUrl,
                storagePath: docPath,
                fileName: String(doc.fileName || doc.name || 'document.pdf'),
                uploadedBy: borrowerName,
                status: 'Active',
                notes: `Submitted with loan application ${applicationId}`,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }

        // Create branch staff notification
        await db.insert(schema.branchNotifications).values({
          id: `NOTIF-LOAN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          branchId,
          type: 'LOAN_APPLICATION',
          title: 'New Loan Application',
          message: `${borrowerName} submitted application ${applicationId} for ₱${principal.toLocaleString()} (${resolvedProductName || 'Loan'}).`,
          relatedType: 'Loan',
          relatedId: applicationId,
          isRead: false,
          createdAt: new Date().toISOString(),
        });

        // Create audit log
        await db.insert(schema.auditLogs).values({
          id: `AUDIT-LOAN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          action: 'LOAN_APPLICATION_SUBMITTED',
          details: `Client ${borrowerName} submitted loan application ${applicationId} for ₱${principal.toLocaleString()}.`,
          performedBy: borrowerName,
          branchId,
          type: 'LOAN',
          userName: borrowerName,
          userRole: 'CLIENT',
          targetType: 'Loan',
          targetId: applicationId,
        });
      } catch (dbErr) {
        console.error('[Mobile Apply] DB insert failed:', dbErr);
        return res.status(500).json({
          success: false,
          error: 'Your application could not be saved. Please try again, and contact your branch if this persists.',
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully and routed to the Credit Committee.',
      application: newApplication,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// View Submitted Applications with Status & Rejection Reason
clientMobileRouter.get('/loan-applications', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let applications: any[] = [];

    if (db && borrowerId) {
      applications = await db.select().from(schema.loans).where(eq(schema.loans.borrowerId, borrowerId));
    }

    res.json({ success: true, applications });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 5. Loans List & Payment Schedule
// -------------------------------------------------------------
clientMobileRouter.get('/loans', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let allLoans: any[] = [];

    if (db && borrowerId) {
      allLoans = await db.select().from(schema.loans).where(eq(schema.loans.borrowerId, borrowerId));
    }

    const activeLoans = allLoans.filter((l) => ['ACTIVE', 'DISBURSED', 'OVERDUE', 'APPROVED'].includes(l.status));
    const completedLoans = allLoans.filter((l) => ['COMPLETED', 'PAID_OFF', 'CLOSED'].includes(l.status));

    res.json({
      success: true,
      activeLoans,
      completedLoans,
      allLoans,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Full Payment Schedule for a Specific Loan
clientMobileRouter.get('/loans/:loanId/schedule', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const { loanId } = req.params;
    const db = getDb();
    let loan: any = null;
    let schedule: any[] = [];

    if (db) {
      const lRows = await db.select().from(schema.loans).where(eq(schema.loans.id, loanId)).limit(1);
      if (lRows.length > 0) {
        loan = lRows[0];
        if (Array.isArray(loan.schedule)) {
          schedule = loan.schedule;
        } else if (typeof loan.schedule === 'string') {
          try { schedule = JSON.parse(loan.schedule); } catch {}
        }
      } else {
        return res.status(404).json({ success: false, error: 'Loan not found.' });
      }
    }

    res.json({ success: true, loanId, schedule });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 6. Payments History & Submit Payment Proof
// -------------------------------------------------------------
clientMobileRouter.get('/payments', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let payments: any[] = [];

    if (db && borrowerId) {
      payments = await db.select().from(schema.payments).where(eq(schema.payments.borrowerId, borrowerId)).orderBy(desc(schema.payments.createdAt));
    }

    res.json({ success: true, payments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit Payment Proof (Digital Repayment slip / GCash screenshot / Bank receipt)
clientMobileRouter.post('/submit-payment-proof', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    if (!borrowerId) {
      return res.status(400).json({ success: false, error: 'Cannot identify your account. Please sign in again.' });
    }
    const {
      loanId,
      amount,
      paymentMethod,
      referenceNumber,
      receiptProofUrl,
      receiptProofBase64,
      receiptProofName,
      receiptProofMime,
      paymentDate,
      notes,
    } = req.body;

    const proofAmount = Number(amount);
    if (!proofAmount || proofAmount <= 0 || !referenceNumber || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Amount, payment method, and transaction reference number are required',
      });
    }

    const db = getDb();
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database unavailable. Please try again.' });
    }

    const borrowerRows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
    const borrower: any = borrowerRows[0];
    const branchId = String(borrower?.branchId || 'br-main');
    const paymentDateValue = paymentDate || new Date().toISOString().split('T')[0];

    // Resolve the loan and enforce ownership. Previously this endpoint stored
    // nothing at all, so a submitted proof vanished while the client was told a
    // cashier would credit their account.
    let targetLoan: any = null;
    const requestedLoanId = loanId ? String(loanId) : '';
    if (requestedLoanId) {
      const loanRows = await db.select().from(schema.loans).where(eq(schema.loans.id, requestedLoanId)).limit(1);
      targetLoan = loanRows[0];
      if (!targetLoan) {
        return res.status(404).json({ success: false, error: 'That loan could not be found.' });
      }
      if (String(targetLoan.borrowerId) !== String(borrowerId)) {
        return res.status(403).json({ success: false, error: 'That loan does not belong to your account.' });
      }
      if (proofAmount > Number(targetLoan.remainingBalance) + 0.01) {
        return res.status(400).json({
          success: false,
          error: `That exceeds your remaining balance of ${Number(targetLoan.remainingBalance).toLocaleString()}.`,
        });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Select the loan this payment is for.' });
    }

    const now = new Date().toISOString();
    const proofId = `proof-${Date.now()}`;

    // Retain the receipt itself. Without this the submission was unrecoverable.
    let storedPath: string | null = null;
    // Durable bucket path, set only when we stored the bytes ourselves. A
    // caller-supplied http(s) link has no storage path of our own, so durablePath
    // stays null rather than holding a link that will expire.
    let durablePath: string | null = null;
    let storedFileName: string | null = receiptProofName ? String(receiptProofName) : null;
    if (receiptProofBase64) {
      try {
        const stored = await storeDocument({
          scope: 'payment-proofs',
          ownerId: borrowerId,
          folder: targetLoan.loanNumber || targetLoan.id,
          base64: String(receiptProofBase64),
          fileName: receiptProofName ? String(receiptProofName) : undefined,
          mime: receiptProofMime ? String(receiptProofMime) : undefined,
        });
        storedPath = stored.path;
        durablePath = stored.path;
        storedFileName = stored.fileName;
      } catch (storageErr: any) {
        console.error('[Payment Proof] storage failed:', storageErr?.message || storageErr);
        return res.status(400).json({ success: false, error: storageErr?.message || 'The receipt could not be stored.' });
      }
    } else if (receiptProofUrl) {
      const candidate = String(receiptProofUrl);
      if (!/^https?:\/\//i.test(candidate)) {
        return res.status(400).json({ success: false, error: 'receiptProofUrl must be an http(s) link.' });
      }
      storedPath = candidate;
    } else {
      return res.status(400).json({ success: false, error: 'Attach the receipt image or bank reference slip.' });
    }

    // Deliberately NOT written to `payments`: that table is the posted ledger
    // and requires a teller to verify the payment and compute the
    // principal/interest/penalty split. Crediting it here would post money that
    // no one has confirmed.
    await db.insert(schema.documents).values({
      id: `doc-${proofId}`,
      docNumber: `PROOF-${String(targetLoan.loanNumber || targetLoan.id)}-${String(Date.now()).slice(-6)}`,
      branchId,
      clientId: borrowerId,
      clientName: String(borrower?.fullName || req.authUser?.fullName || ''),
      loanId: String(targetLoan.id),
      loanNumber: String(targetLoan.loanNumber || targetLoan.id),
      docName: `Payment proof - ${proofAmount.toLocaleString()} (${String(paymentMethod)})`,
      docType: 'Payment Proof',
      fileUrl: storedPath,
      storagePath: durablePath,
      fileName: storedFileName,
      uploadedBy: String(borrower?.fullName || req.authUser?.fullName || 'Client'),
      status: 'Pending Verification',
      notes: [
        `Amount: ${proofAmount}`,
        `Method: ${paymentMethod}`,
        `Reference: ${referenceNumber}`,
        `Payment date: ${paymentDateValue}`,
        notes ? `Notes: ${notes}` : '',
        'Status: PENDING_TELLER_VERIFICATION',
      ]
        .filter(Boolean)
        .join(' | '),
      createdAt: now,
    });

    // The real verification queue (0016). Until this existed the only trace of
    // a pending payment was a documents row whose status was the literal string
    // 'Pending Verification' plus a notification - nothing a teller could filter,
    // count, or record a decision against. This row is that queue entry.
    //
    // It stays PENDING_REVIEW and is NOT written to `payments`: posting the money
    // requires a teller to verify the claim and compute the principal/interest/
    // penalty split, exactly as the documents row above already explained.
    await db.insert(schema.paymentProofs).values({
      id: proofId,
      borrowerId,
      loanId: String(targetLoan.id),
      loanNumber: String(targetLoan.loanNumber || targetLoan.id),
      amount: proofAmount,
      currency: 'PHP',
      paymentMethod: String(paymentMethod),
      paymentDate: String(paymentDateValue),
      referenceNumber: referenceNumber ? String(referenceNumber) : null,
      notes: notes ? String(notes) : null,
      documentId: `doc-${proofId}`,
      storagePath: durablePath,
      fileName: storedFileName,
      branchId,
      submittedBy: String(borrower?.fullName || req.authUser?.fullName || 'Client'),
      submittedAt: now,
      status: 'PENDING_REVIEW',
      createdAt: now,
      updatedAt: now,
    });

    // Surface it to the branch so a teller actually has a queue to work.
    await db.insert(schema.branchNotifications).values({
      id: `n-${proofId}`,
      branchId,
      targetStaffId: null,
      type: 'PAYMENT',
      title: 'Payment proof awaiting verification',
      message: `${borrower?.fullName || 'A member'} submitted ${proofAmount.toLocaleString()} via ${paymentMethod} (ref ${referenceNumber}) for loan ${targetLoan.loanNumber || targetLoan.id}.`,
      relatedType: 'Loan',
      relatedId: String(targetLoan.id),
      isRead: false,
      createdAt: now,
    });

    const proofRecord = {
      id: proofId,
      borrowerId,
      borrowerName: String(borrower?.fullName || req.authUser?.fullName || ''),
      loanId: String(targetLoan.id),
      loanNumber: String(targetLoan.loanNumber || targetLoan.id),
      amount: proofAmount,
      paymentMethod,
      referenceNumber: String(referenceNumber).trim(),
      receiptProofUrl: storedPath,
      paymentDate: paymentDateValue,
      notes: notes || '',
      verificationStatus: 'PENDING_TELLER_VERIFICATION',
      submittedAt: now,
    };

    res.status(201).json({
      success: true,
      message: 'Payment proof submitted successfully. A cashier will verify and credit your loan account.',
      proof: proofRecord,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 6b. Payment proof status
//
// A member could submit a proof and then never learn what happened to
// it: a rejection reason was recorded but unreachable, and a verified
// payment credited their loan without telling them. These close that
// loop.
//
// The database status vocabulary (PENDING_REVIEW / UNDER_REVIEW /
// VERIFIED / REJECTED) is mapped onto the vocabulary the app already
// renders, so no new status string is introduced for the client to
// fail to style. See mobile/src/utils/format.ts, which already colours
// PENDING_TELLER_VERIFICATION and UNDER_REVIEW as warning, VERIFIED as
// green, and REJECTED as danger.
// -------------------------------------------------------------

/** Maps a stored proof status onto the status the client already understands. */
function proofStatusForClient(status: string): string {
  switch (String(status || '').toUpperCase()) {
    case 'PENDING_REVIEW':
      return 'PENDING_TELLER_VERIFICATION';
    case 'UNDER_REVIEW':
      return 'UNDER_REVIEW';
    case 'VERIFIED':
      return 'VERIFIED';
    case 'REJECTED':
      return 'REJECTED';
    default:
      return 'PENDING_TELLER_VERIFICATION';
  }
}

clientMobileRouter.get('/payment-proofs', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    if (!borrowerId) {
      return res.status(401).json({ success: false, error: 'Client authentication required.' });
    }
    const db = getDb();
    if (!db) return res.json({ success: true, proofs: [], counts: {} });

    const rows = await db
      .select()
      .from(schema.paymentProofs)
      .where(eq(schema.paymentProofs.borrowerId, borrowerId))
      .orderBy(desc(schema.paymentProofs.submittedAt));

    const proofs = (rows as any[]).map((p) => ({
      id: p.id,
      loanId: p.loanId,
      loanNumber: p.loanNumber,
      amount: p.amount,
      currency: p.currency,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      referenceNumber: p.referenceNumber,
      // `status` stays the raw stored value for anything reading the
      // database vocabulary; `verificationStatus` is what the UI renders.
      status: p.status,
      verificationStatus: proofStatusForClient(p.status),
      reviewedAt: p.reviewedAt,
      // Present only once a decision exists. This is the whole point of
      // the endpoint: the member can see why a proof was declined.
      rejectionReason: p.status === 'REJECTED' ? p.rejectionReason : null,
      reviewedByName: p.reviewedByName,
      fileName: p.fileName,
      submittedAt: p.submittedAt,
      // Set once the claim was credited, so the member can tie the
      // proof to the resulting receipt.
      paymentId: p.paymentId,
    }));

    const counts = {
      total: proofs.length,
      pending: proofs.filter((p) => p.status === 'PENDING_REVIEW' || p.status === 'UNDER_REVIEW').length,
      verified: proofs.filter((p) => p.status === 'VERIFIED').length,
      rejected: proofs.filter((p) => p.status === 'REJECTED').length,
    };

    res.json({ success: true, proofs, counts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

clientMobileRouter.get('/payment-proofs/:id', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    if (!borrowerId) {
      return res.status(401).json({ success: false, error: 'Client authentication required.' });
    }
    const db = getDb();
    if (!db) return res.status(404).json({ success: false, error: 'Payment proof not found.' });

    // Scoped by borrowerId in the same query, so one member cannot read
    // another's proof by guessing an id.
    const rows = await db
      .select()
      .from(schema.paymentProofs)
      .where(and(eq(schema.paymentProofs.id, String(req.params.id || '')), eq(schema.paymentProofs.borrowerId, borrowerId)))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment proof not found.' });
    }
    const p = rows[0] as any;

    res.json({
      success: true,
      proof: {
        id: p.id,
        loanId: p.loanId,
        loanNumber: p.loanNumber,
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
        status: p.status,
        verificationStatus: proofStatusForClient(p.status),
        reviewedAt: p.reviewedAt,
        rejectionReason: p.status === 'REJECTED' ? p.rejectionReason : null,
        reviewedByName: p.reviewedByName,
        fileName: p.fileName,
        submittedAt: p.submittedAt,
        paymentId: p.paymentId,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 7. Client Notifications
// -------------------------------------------------------------
clientMobileRouter.get('/notifications', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let notifications: any[] = [];

    if (db && borrowerId) {
      const rows = await db
        .select()
        .from(schema.branchNotifications)
        .where(eq(schema.branchNotifications.relatedId, borrowerId))
        .orderBy(desc(schema.branchNotifications.createdAt))
        .limit(50);
      notifications = rows.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        category: n.type || 'announcement',
        isRead: Boolean(n.isRead),
        createdAt: n.createdAt ? String(n.createdAt) : new Date().toISOString(),
        meta: {},
      }));
    }

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark Notification as Read
clientMobileRouter.patch('/notifications/:id/read', requireAuth(), async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  if (db) {
    try {
      await db.update(schema.branchNotifications).set({ isRead: true }).where(eq(schema.branchNotifications.id, id));
    } catch {}
  }
  res.json({ success: true, message: 'Notification marked as read' });
});

// Mark All Notifications as Read
clientMobileRouter.post('/notifications/mark-all-read', requireAuth(), async (req: AuthedRequest, res: Response) => {
  const borrowerId = getClientBorrowerId(req);
  const db = getDb();
  if (db && borrowerId) {
    try {
      const rows = await db.select().from(schema.branchNotifications).where(eq(schema.branchNotifications.relatedId, borrowerId));
      for (const row of rows) {
        await db.update(schema.branchNotifications).set({ isRead: true }).where(eq(schema.branchNotifications.id, row.id));
      }
    } catch {}
  }
  res.json({ success: true, message: 'All notifications marked as read' });
});

// -------------------------------------------------------------
// 8. Client Savings
// -------------------------------------------------------------
clientMobileRouter.get('/savings', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let account: any = null;

    if (db && borrowerId) {
      const rows = await db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.memberId, borrowerId)).limit(1);
      if (rows.length > 0) {
        const acc = rows[0];
        account = {
          id: acc.id,
          memberId: borrowerId,
          balance: Number(acc.balance) || 0,
          totalDeposits: Number(acc.balance) || 0,
          totalWithdrawals: 0,
          goal: 0,
          goalName: '',
        };
      }
    }

    if (!account) {
      account = {
        id: 'sav-none',
        memberId: borrowerId,
        balance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        goal: 0,
        goalName: '',
      };
    }

    res.json({ success: true, account });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

clientMobileRouter.get('/savings/transactions', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let transactions: any[] = [];

    if (db && borrowerId) {
      try {
        const accRows = await db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.memberId, borrowerId)).limit(1);
        if (accRows.length > 0) {
          transactions = await db.select().from(schema.savingsTransactions).where(eq(schema.savingsTransactions.savingsAccountId, accRows[0].id)).orderBy(desc(schema.savingsTransactions.createdAt));
        }
      } catch {}
    }

    res.json({ success: true, transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

clientMobileRouter.post('/savings/withdraw', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const { amount, reason } = req.body;

    if (!borrowerId) {
      return res.status(403).json({ success: false, error: 'No member profile linked to this account yet.' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid withdrawal amount is required.' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Please provide a reason for withdrawal.' });
    }

    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const requestedAmount = Number(amount);
    let memberName = req.authUser?.fullName || '';
    let memberBranch = 'br-main';
    let accountRows: any[] = [];

    if (db) {
      const borrowerRows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
      if (borrowerRows.length > 0) {
        memberName = borrowerRows[0].fullName;
        memberBranch = borrowerRows[0].branchId || 'br-main';
        const kycStatus = borrowerRows[0].kycStatus || 'NOT_STARTED';
        const isApproved = ['VERIFIED', 'APPROVED'].includes(String(kycStatus).toUpperCase());
        if (!isApproved) {
          return res.status(403).json({
            success: false,
            error: 'KYC verification must be approved before you can submit savings withdrawals. Please complete KYC verification.',
            kycStatus,
          });
        }
      }
      accountRows = await db
        .select()
        .from(schema.savingsAccounts)
        .where(eq(schema.savingsAccounts.memberId, borrowerId));
    }

    if (accountRows.length === 0) {
      return res.status(400).json({ success: false, error: 'No savings account is linked to your membership yet.' });
    }

    // Withdraw against a SPECIFIC account, and validate against that account's
    // own balance and minimum maintaining balance - never against the
    // member-wide total, which is a different number entirely.
    const accountId = String(req.body?.accountId || accountRows[0].id);
    const account = accountRows.find((a: any) => String(a.id) === accountId) || accountRows[0];
    const maintaining = Number(account.maintainingBalance) || 0;
    const check = canWithdrawFromSavings(account.balance, requestedAmount, maintaining);

    if (!check.allowed) {
      return res.status(400).json({
        success: false,
        error: `Withdrawal exceeds the available balance. This account holds ₱${(Number(account.balance) || 0).toLocaleString()} and must maintain ₱${maintaining.toLocaleString()}, so ₱${check.available.toLocaleString()} is available.`,
      });
    }

    const memberTotalBefore = sumSavingsAccountBalances(accountRows);
    const memberTotalAfter = Math.max(0, Math.round((memberTotalBefore - requestedAmount) * 100) / 100);

    const request = {
      id: `WDRQ-${Date.now()}`,
      requestId: `WDR-${Date.now().toString().slice(-6)}`,
      borrowerId,
      accountId: String(account.id),
      amount: requestedAmount,
      requestDate: today,
      reason,
      status: 'Pending Approval',
    };

    if (db) {
      // account.balance is the figure read from the ledger before this debit,
      // so it is the account-level "before" balance. memberTotalBefore is a
      // different number (the sum across every account the member holds) and
      // must not be written here.
      const accountBalanceBefore = Number(account.balance) || 0;
      await db.insert(schema.savingsWithdrawalRequests).values({
        id: `swr-${Date.now()}`,
        requestId: request.requestId,
        memberId: borrowerId,
        memberName,
        branchId: memberBranch,
        accountId: String(account.id),
        currentBalance: memberTotalBefore,
        accountBalanceBefore,
        requestedAmount,
        remainingBalanceAfter: memberTotalAfter,
        requestDate: today,
        reason,
        tellerName: req.authUser?.fullName || '',
        tellerRecordedDate: today,
        status: 'Pending Approval',
      });
      // Apply to the single account, then re-derive the member total as the sum
      // of all accounts so the cached column can never disagree with the ledger.
      await db
        .update(schema.savingsAccounts)
        .set({ balance: check.balanceAfter })
        .where(eq(schema.savingsAccounts.id, String(account.id)));
      await db.update(schema.borrowers).set({ savingsBalance: memberTotalAfter }).where(eq(schema.borrowers.id, borrowerId));

      await db.insert(schema.savingsTransactions).values({
        id: `stx-${Date.now()}`,
        savingsAccountId: String(account.id),
        memberId: borrowerId,
        memberName,
        transactionNumber: `STW-${today.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`,
        date: today,
        type: 'Withdrawal',
        amount: requestedAmount,
        balanceBefore: Number(account.balance) || 0,
        balanceAfter: check.balanceAfter,
        processedBy: req.authUser?.fullName || memberName,
        notes: reason,
        officialReceiptNumber: null,
      });

      await db.insert(schema.financialTransactions).values({
        id: `txn-${Date.now()}`,
        referenceNumber: `TX-WDR-${request.requestId}`,
        clientId: borrowerId,
        clientName: memberName,
        accountOrLoanId: String(account.id),
        accountOrLoanType: 'Savings',
        branchId: memberBranch,
        transactionType: 'Savings Withdrawal',
        amount: requestedAmount,
        transactionDate: today,
        paymentMethod: 'Cash',
        processedBy: req.authUser?.fullName || memberName,
        processedByRole: 'CLIENT',
        status: 'Pending Approval',
        notes: reason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({ success: true, request });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 9. Client Financial Transactions (History)
// -------------------------------------------------------------
clientMobileRouter.get('/transactions', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let transactions: any[] = [];

    if (db && borrowerId) {
      try {
        transactions = await db.select().from(schema.financialTransactions).where(eq(schema.financialTransactions.clientId, borrowerId)).orderBy(desc(schema.financialTransactions.createdAt));
      } catch {}
    }

    res.json({ success: true, transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

clientMobileRouter.get('/transactions/:id', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let transaction: any = null;

    if (db && borrowerId) {
      try {
        const rows = await db.select().from(schema.financialTransactions).where(and(eq(schema.financialTransactions.id, id), eq(schema.financialTransactions.clientId, borrowerId))).limit(1);
        if (rows.length > 0) transaction = rows[0];
      } catch {}
    }

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found.' });
    }

    res.json({ success: true, transaction });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 10. Client Group Lending
// -------------------------------------------------------------
clientMobileRouter.get('/groups/my', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let group: any = null;

    if (db && borrowerId) {
      try {
        const rows = await db.select().from(schema.solidarityGroups);
        const mine = rows.find((g) => {
          if (g.leaderBorrowerId === borrowerId) return true;
          const members = Array.isArray(g.members) ? g.members : (typeof g.members === 'string' ? (() => { try { return JSON.parse(g.members); } catch { return []; } })() : []);
          return members.some((m: any) => m?.borrowerId === borrowerId);
        });
        if (mine) {
          const membersList = Array.isArray(mine.members) ? mine.members : (typeof mine.members === 'string' ? (() => { try { return JSON.parse(mine.members); } catch { return []; } })() : []);
          group = {
            id: mine.id,
            name: mine.groupName,
            leaderName: mine.leaderName,
            memberCount: membersList.length,
            status: mine.status,
            centerName: mine.centerName,
            branch: mine.branchId,
            members: membersList,
          };
        }
      } catch {}
    }

    res.json({ success: true, group });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 11. Client Documents
// -------------------------------------------------------------
clientMobileRouter.get('/documents', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let documents: any[] = [];

    if (db && borrowerId) {
      try {
        const rows = await db.select().from(schema.documents).where(eq(schema.documents.clientId, borrowerId)).orderBy(desc(schema.documents.createdAt));
        documents = rows.map((d) => ({
          id: d.id,
          name: d.docName,
          type: d.docType,
          date: d.createdAt || '',
          relatedLoanNumber: d.loanNumber || undefined,
        }));
      } catch {}
    }

    res.json({ success: true, documents });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 12. Client Settings
// -------------------------------------------------------------
clientMobileRouter.get('/settings/notifications', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    res.json({
      success: true,
      preferences: {
        paymentReminders: true,
        loanUpdates: true,
        savingsUpdates: true,
        announcements: false,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

clientMobileRouter.patch('/settings/notifications', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    res.json({ success: true, preferences: req.body });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

clientMobileRouter.get('/settings/sessions', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    res.json({
      success: true,
      sessions: [
        { id: 'sess-1', device: 'Chrome on Windows', location: 'Tacloban City, PH', time: new Date().toISOString(), ip: '192.168.1.10', status: 'ACTIVE' },
        { id: 'sess-2', device: 'Safari on iPhone', location: 'Tacloban City, PH', time: new Date(Date.now() - 3 * 86400000).toISOString(), ip: '192.168.1.24', status: 'EXPIRED' },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

clientMobileRouter.get('/settings/privacy', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    res.json({
      success: true,
      preferences: {
        shareDataAnalytics: true,
        allowSmsMarketing: false,
        allowEmailAlerts: true,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

clientMobileRouter.patch('/settings/privacy', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    res.json({ success: true, preferences: req.body });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 13. Client Help & Support
// -------------------------------------------------------------
clientMobileRouter.get('/support/faqs', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    res.json({
      success: true,
      faqs: [
        { id: 'faq-l1', category: 'Loans', question: 'How do I know if my loan was approved?', answer: 'You will receive a notification once the Credit Committee makes a decision. You can also track the status on the "Loan Applications" page.' },
        { id: 'faq-l2', category: 'Loans', question: 'When will my loan be disbursed?', answer: 'Approved loans are usually disbursed within 1-3 banking days after approval once all requirements are complete.' },
        { id: 'faq-p1', category: 'Payments', question: 'What payment methods are accepted?', answer: 'You may pay over the counter at any branch, or via GCash, Maya, and bank transfer through the portal.' },
        { id: 'faq-p2', category: 'Payments', question: 'Can I pay my loan in full early?', answer: 'Yes. Early settlement is allowed and may qualify for an interest rebate. Contact your branch for the exact amount.' },
        { id: 'faq-s1', category: 'Savings', question: 'How do I make a savings deposit?', answer: 'You can deposit over the counter at any branch. Withdrawal requests can be filed from the Savings page.' },
        { id: 'faq-s2', category: 'Savings', question: 'What is the interest rate on savings?', answer: 'Savings earn 1% per annum, credited quarterly.' },
        { id: 'faq-a1', category: 'Account', question: 'How do I reset my password?', answer: 'Use the "Forgot password" option on the login page. A verification code will be sent to your registered email.' },
        { id: 'faq-a2', category: 'Account', question: 'How do I update my contact details?', answer: 'Go to My Profile and click "Update Profile". Changes are reviewed by staff when required.' },
        { id: 'faq-g1', category: 'Groups', question: 'What is a solidarity group?', answer: 'A solidarity group is a circle of members who mutually guarantee each other\'s loans. Group members support timely repayments together.' },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

clientMobileRouter.get('/support/tickets', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    res.json({
      success: true,
      tickets: [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

clientMobileRouter.post('/support/submit', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const { subject, category, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, error: 'Subject and message are required.' });
    }

    const ticket = {
      id: `TKT-${Date.now()}`,
      subject,
      category: category || 'General',
      message,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'OPEN',
      lastUpdate: new Date().toISOString().split('T')[0],
    };

    res.status(201).json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
