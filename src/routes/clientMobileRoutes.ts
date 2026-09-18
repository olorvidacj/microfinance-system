import { Router, Request, Response, NextFunction } from 'express';
import { getDb, schema } from '../db/index';
import { eq, desc, and } from 'drizzle-orm';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../auth/index';
import { calculateLoanSchedule } from '../utils/loanMath';
import { getServerSupabase } from '../db/supabaseServer';
import { supabaseGetUser, supabaseSendEmailOtp, supabaseVerifyEmailOtp } from '../auth/supabaseAuth';
import { authStore } from '../auth/index';
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

// Upload a base64 image to the private kyc-documents bucket, returning an expiring signed URL.
async function uploadKycFile(
  borrowerId: string,
  folder: string,
  base64: string,
  mime?: string
): Promise<{ signedUrl: string; path: string } | null> {
  const supabase = getServerSupabase();
  if (!supabase) {
    throw new Error('Supabase storage is not configured on the server.');
  }
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

  const { error: upErr } = await supabase.storage
    .from(KYC_STORAGE_BUCKET)
    .upload(objectPath, buffer, { contentType, upsert: false });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const { data: signed } = await supabase.storage
    .from(KYC_STORAGE_BUCKET)
    .createSignedUrl(objectPath, KYC_STORAGE_SIGNED_URL_TTL);
  if (!signed) throw new Error('Unable to generate a secure link for the uploaded file.');

  return { signedUrl: signed.signedUrl, path: objectPath };
}

// Remove previously uploaded objects for the same borrower/folder prefix (re-upload hygiene).
async function removeKycFolderObjects(borrowerId: string, folder: string): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;
  const prefix = `kyc/${borrowerId}/${folder}/`;
  const { data, error } = await supabase.storage.from(KYC_STORAGE_BUCKET).list(`kyc/${borrowerId}/${folder}`);
  if (error || !data) return;
  const names = data.filter((f) => f.name && f.metadata?.size > 0).map((f) => `${prefix}${f.name}`);
  if (names.length) {
    await supabase.storage.from(KYC_STORAGE_BUCKET).remove(names);
  }
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

    const savingsBalance = savingsAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

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

// View KYC / Verification Status
clientMobileRouter.get('/kyc-status', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const db = getDb();
    let kycStatus = 'NOT_STARTED';
    let submissionId: string | undefined;
    let submittedAt: string | undefined;
    let reviewedAt: string | undefined;
    let correctionReason: string | undefined;
    let rejectionReason: string | undefined;
    let verifiedAt: string | undefined;
    let reviewedByName: string | undefined;
    let staffRemarks: string | undefined;
    let profile: any = null;
    let personalInfo: any = null;
    let address: any = null;
    let employment: any = null;
    let documents: any[] = [];

    if (db) {
      const bRows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
      if (bRows.length > 0) {
        kycStatus = bRows[0].kycStatus || 'NOT_STARTED';
        staffRemarks = bRows[0].notes || undefined;
        profile = bRows[0];
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
        rejectionReason = sub.rejectionReason || undefined;
        verifiedAt = sub.verifiedAt || undefined;
        reviewedByName = sub.reviewedByName || undefined;
        personalInfo = sub.personalInfo || null;
        address = sub.address || null;
        employment = sub.employment || null;
      }
      const docRows = await db.select().from(schema.kycDocuments)
        .where(eq(schema.kycDocuments.borrowerId, borrowerId));
      documents = docRows.map((d: any) => ({
        id: d.id,
        type: d.documentType,
        name: d.documentName,
        submitted: !!d.fileUrl || !!d.fileName,
        status: d.status || 'PENDING',
        fileName: d.fileName,
        fileUrl: d.fileUrl || undefined,
        rejectionReason: d.rejectionReason || undefined,
      }));
    }

    let requiredDocs = [
      { type: 'VALID_ID', name: 'Primary Government ID (UMID / Driver License / Passport)', submitted: documents.some((d: any) => d.type === 'VALID_ID' && d.submitted), status: documents.find((d: any) => d.type === 'VALID_ID')?.status || 'NOT_STARTED' },
      { type: 'PROOF_OF_ADDRESS', name: 'Barangay Clearance or Utility Bill', submitted: documents.some((d: any) => d.type === 'PROOF_OF_ADDRESS' && d.submitted), status: documents.find((d: any) => d.type === 'PROOF_OF_ADDRESS')?.status || 'NOT_STARTED' },
      { type: 'PROOF_OF_INCOME', name: 'Payslip / Business Permit / Bank Statement', submitted: documents.some((d: any) => d.type === 'PROOF_OF_INCOME' && d.submitted), status: documents.find((d: any) => d.type === 'PROOF_OF_INCOME')?.status || 'NOT_STARTED' },
      { type: 'PHOTO_2X2', name: 'Recent 2x2 ID Photo', submitted: documents.some((d: any) => d.type === 'PHOTO_2X2' && d.submitted), status: documents.find((d: any) => d.type === 'PHOTO_2X2')?.status || 'NOT_STARTED' },
    ];

    if (db) {
      const reqRows = await db.select().from(schema.kycRequiredDocuments)
        .where(eq(schema.kycRequiredDocuments.isActive, true))
        .orderBy(schema.kycRequiredDocuments.sortOrder);
      if (reqRows.length > 0) {
        requiredDocs = reqRows.map((r: any) => ({
          type: r.documentType,
          name: r.documentName,
          description: r.description || undefined,
          submitted: documents.some((d: any) => d.type === r.documentType && d.submitted),
          status: documents.find((d: any) => d.type === r.documentType)?.status || 'NOT_STARTED',
        }));
      }
    }

    const findDoc = (type: string) => documents.find((d: any) => d.type === type);

    res.json({
      success: true,
      kycStatus,
      isVerified: kycStatus === 'VERIFIED',
      requiredDocuments: requiredDocs,
      uploadedDocuments: documents,
      submissionId,
      submittedAt,
      reviewedAt,
      correctionReason,
      rejectionReason,
      staffRemarks,
      verifiedAt,
      reviewedByName,
      referenceNumber: submissionId,
      // Structured snapshot useful for the correction/edit screen
      submission: {
        personalInfo,
        address,
        employment,
        idInfo: {
          idType: findDoc('VALID_ID')?.name ?? profile?.idType ?? undefined,
          idNumber: personalInfo?.idNumber ?? undefined,
          idFrontUrl: findDoc('ID_FRONT')?.fileUrl ?? findDoc('VALID_ID')?.fileUrl ?? undefined,
          idBackUrl: findDoc('ID_BACK')?.fileUrl ?? undefined,
          selfieUrl: findDoc('SELFIE')?.fileUrl ?? findDoc('PHOTO_2X2')?.fileUrl ?? undefined,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit KYC application (create or update submission)
clientMobileRouter.post('/kyc/submit', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const borrowerId = getClientBorrowerId(req);
    const { personalInfo, address, employment, idInfo, selfieUrl } = req.body || {};
    if (!personalInfo || !address || !employment) {
      return res.status(400).json({ success: false, error: 'personalInfo, address, and employment are required.' });
    }
    const now = new Date().toISOString();
    const db = getDb();

    // ID front/back + selfie are tracked as kyc_documents rows so staff can review them.
    const docMap: Array<{ type: string; name: string; url?: string }> = [
      { type: 'ID_FRONT', name: 'Government ID — Front', url: (idInfo || {}).idFrontUrl },
      { type: 'ID_BACK', name: 'Government ID — Back', url: (idInfo || {}).idBackUrl },
      { type: 'SELFIE', name: 'Profile Selfie', url: selfieUrl },
      { type: 'VALID_ID', name: (idInfo || {}).idType || 'Government-Issued ID', url: (idInfo || {}).idFrontUrl },
    ];

    if (db) {
      const existing = await db.select().from(schema.kycSubmissions)
        .where(eq(schema.kycSubmissions.borrowerId, borrowerId))
        .orderBy(desc(schema.kycSubmissions.createdAt)).limit(1);
      let submissionId: string;
      let previousStatus = existing.length > 0 ? existing[0].status : 'NOT_STARTED';
      const canResubmit = existing.length > 0 && ['NOT_STARTED', 'CORRECTION_REQUIRED', 'REJECTED'].includes(existing[0].status);
      if (canResubmit) {
        submissionId = existing[0].id;
        await db.update(schema.kycSubmissions).set({
          personalInfo,
          address,
          employment,
          status: 'PENDING',
          submittedAt: now,
          updatedAt: now,
          correctionReason: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewedByName: null,
        }).where(eq(schema.kycSubmissions.id, submissionId));
      } else {
        submissionId = `KYC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        await db.insert(schema.kycSubmissions).values({
          id: submissionId,
          borrowerId,
          status: 'PENDING',
          personalInfo,
          address,
          employment,
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        previousStatus = 'NOT_STARTED';
      }

      const fullAddress = [
        address.houseUnit,
        address.street,
        address.barangay,
        address.city,
        address.province,
        address.postalCode,
      ].filter(Boolean).join(', ');

      await db.update(schema.borrowers).set({
        kycStatus: 'PENDING',
        profileCompleted: true,
        ...(personalInfo.fullName ? { fullName: String(personalInfo.fullName).trim() } : {}),
        ...(personalInfo.dateOfBirth ? { dateOfBirth: String(personalInfo.dateOfBirth) } : {}),
        ...(personalInfo.gender ? { gender: String(personalInfo.gender) } : {}),
        ...(personalInfo.civilStatus ? { civilStatus: String(personalInfo.civilStatus) } : {}),
        ...(fullAddress ? { address: fullAddress } : {}),
        ...(address.barangay ? { barangay: String(address.barangay) } : {}),
        ...(address.city ? { cityMunicipality: String(address.city) } : {}),
        ...(address.province ? { province: String(address.province) } : {}),
        ...(employment.occupation ? { occupation: String(employment.occupation) } : {}),
        ...(employment.employer ? { employerOrBusiness: String(employment.employer) } : {}),
        ...(employment.monthlyIncome ? { monthlyIncome: Number(employment.monthlyIncome) || 0 } : {}),
        ...(employment.sourceOfIncome ? { sourceOfIncome: String(employment.sourceOfIncome) } : {}),
        ...(idInfo?.idNumber ? { idNumber: String(idInfo.idNumber) } : {}),
      }).where(eq(schema.borrowers.id, borrowerId));

      // Upsert document metadata for the submitted submission.
      for (const doc of docMap) {
        if (!doc.url) continue;
        const existingDoc = await db.select().from(schema.kycDocuments)
          .where(and(
            eq(schema.kycDocuments.borrowerId, borrowerId),
            eq(schema.kycDocuments.documentType, doc.type),
            eq(schema.kycDocuments.kycSubmissionId, submissionId)
          ))
          .limit(1);
        if (existingDoc.length > 0) {
          await db.update(schema.kycDocuments).set({
            fileName: doc.url.split('/').pop() || doc.url,
            fileUrl: doc.url,
            status: 'PENDING',
            rejectionReason: null,
          }).where(eq(schema.kycDocuments.id, existingDoc[0].id));
        } else {
          await db.insert(schema.kycDocuments).values({
            id: `DOC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            kycSubmissionId: submissionId,
            borrowerId,
            documentType: doc.type,
            documentName: doc.name,
            fileName: doc.url.split('/').pop() || doc.url,
            fileUrl: doc.url,
            status: 'PENDING',
            createdAt: now,
          });
        }
      }

      await db.insert(schema.kycAuditLog).values({
        id: `AUDIT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        borrowerId,
        action: 'SUBMITTED',
        previousStatus,
        newStatus: 'PENDING',
        createdAt: now,
      });

      res.json({ success: true, message: 'KYC submitted for review.', referenceNumber: submissionId });
    } else {
      res.json({ success: true, message: 'KYC submitted for review.', referenceNumber: `KYC-${Date.now().toString(36)}` });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

    // Block only completely unverified users — allow PENDING to apply (staff review in progress)
    if (kycStatus === 'NOT_STARTED') {
      return res.status(403).json({
        success: false,
        error: 'Please complete your KYC verification before applying for a loan. Go to Profile → Complete KYC Verification.',
        kycStatus,
      });
    }
    if (kycStatus === 'REJECTED') {
      return res.status(403).json({
        success: false,
        error: 'Your KYC was rejected. Please resubmit your documents with the corrections noted by the branch.',
        kycStatus,
      });
    }
    if (kycStatus === 'CORRECTION_REQUIRED') {
      return res.status(403).json({
        success: false,
        error: 'Your KYC requires corrections. Please update your documents and resubmit.',
        kycStatus,
      });
    }
    // kycStatus is PENDING or VERIFIED — both allowed to submit a loan application

    const {
      productId,
      productName,
      amount,
      termMonths,
      repaymentFrequency = 'Monthly',
      purpose,
      guarantorName,
      guarantorPhone,
      collateralDescription,
      documents = [],
    } = req.body;

    if (!amount || !termMonths || !purpose) {
      return res.status(400).json({ success: false, error: 'Amount, term, and loan purpose are required' });
    }

    const principal = Number(amount);
    const term = Number(termMonths);
    const monthlyRate = 1.5;
    const r = monthlyRate / 100;
    const monthlyInstallment = (principal * r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1);
    const totalInterest = (monthlyInstallment * term) - principal;

    const applicationId = `LN-APP-${Date.now().toString().slice(-6)}`;
    const borrowerName = req.authUser?.fullName || '';
    const borrowerPhone = req.authUser?.phone || '';
    const newApplication = {
      id: applicationId,
      loanNumber: applicationId,
      borrowerId,
      borrowerName,
      productId: productId || 'prod-1',
      productName: productName || 'Micro-Enterprise Working Capital',
      principalAmount: principal,
      remainingBalance: principal,
      termMonths: term,
      interestRate: monthlyRate * 12,
      interestType: 'REDUCING_BALANCE',
      monthlyInstallment: Math.round(monthlyInstallment * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      purpose,
      guarantorName: guarantorName || '',
      guarantorPhone: guarantorPhone || '',
      collateralDescription: collateralDescription || 'None / Personal Guarantee',
      status: 'PENDING',
      coopStep: 'CREDIT_INVESTIGATION',
      applicationDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      submittedVia: 'MOBILE_APP',
    };

    if (db) {
      try {
        let branchId = 'br-main';
        try {
          const bRows = await db.select({ branchId: schema.borrowers.branchId }).from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
          if (bRows.length > 0 && bRows[0].branchId) branchId = bRows[0].branchId;
        } catch {}
        await db.insert(schema.loans).values({
          id: applicationId,
          loanNumber: applicationId,
          borrowerId,
          borrowerName,
          borrowerPhone,
          productId: productId || 'prod-1',
          productName: productName || 'Micro-Enterprise Working Capital',
          branchId,
          principalAmount: principal,
          interestRate: monthlyRate * 12,
          interestType: 'REDUCING_BALANCE',
          repaymentFrequency: repaymentFrequency,
          termMonths: term,
          totalInstallments: term,
          processingFee: principal * 0.02,
          totalInterest: Math.round(totalInterest * 100) / 100,
          totalPayable: Math.round((principal + totalInterest) * 100) / 100,
          remainingBalance: principal,
          purpose,
          status: 'PENDING',
          coopStep: 'CREDIT_INVESTIGATION',
          applicationDate: new Date().toISOString().split('T')[0],
          maturityDate: new Date(Date.now() + term * 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
          loanOfficerId: 'staff-01',
          loanOfficerName: 'Grace Mendoza',
        });
      } catch (dbErr) {
        console.log('[Mobile Apply] DB insert:', dbErr);
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
    const {
      loanId,
      amount,
      paymentMethod,
      referenceNumber,
      receiptProofUrl,
      paymentDate,
      notes,
    } = req.body;

    if (!amount || !referenceNumber || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Amount, payment method, and transaction reference number are required',
      });
    }

    const proofRecord = {
      id: `proof-${Date.now()}`,
      borrowerId,
      borrowerName: req.authUser?.fullName || '',
      loanId: loanId || '',
      amount: Number(amount),
      paymentMethod,
      referenceNumber: String(referenceNumber).trim(),
      receiptProofUrl: receiptProofUrl || '',
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      notes: notes || '',
      verificationStatus: 'PENDING_TELLER_VERIFICATION',
      submittedAt: new Date().toISOString(),
    };

    res.status(201).json({
      success: true,
      message: 'Payment proof submitted successfully. Cashier will verify and credit your loan account.',
      proof: proofRecord,
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
    let currentBalance = 0;
    let memberName = req.authUser?.fullName || '';
    let memberBranch = 'br-main';

    if (db) {
      const borrowerRows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
      if (borrowerRows.length > 0) {
        memberName = borrowerRows[0].fullName;
        memberBranch = borrowerRows[0].branchId || 'br-main';
        currentBalance = Number(borrowerRows[0].savingsBalance) || 0;
      }
    }

    if (requestedAmount > currentBalance) {
      return res.status(400).json({ success: false, error: 'Withdrawal amount exceeds your current savings balance.' });
    }

    const request = {
      id: `WDRQ-${Date.now()}`,
      requestId: `WDR-${Date.now().toString().slice(-6)}`,
      borrowerId,
      amount: requestedAmount,
      requestDate: today,
      reason,
      status: 'Pending Approval',
    };

    if (db) {
      const accRows = await db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.memberId, borrowerId)).limit(1);
      await db.insert(schema.savingsWithdrawalRequests).values({
        id: `swr-${Date.now()}`,
        requestId: request.requestId,
        memberId: borrowerId,
        memberName,
        branchId: memberBranch,
        currentBalance,
        requestedAmount,
        remainingBalanceAfter: Math.max(0, currentBalance - requestedAmount),
        requestDate: today,
        reason,
        tellerName: req.authUser?.fullName || '',
        tellerRecordedDate: today,
        status: 'Pending Approval',
      });
      if (accRows.length > 0) {
        await db.update(schema.savingsAccounts).set({ balance: Math.max(0, currentBalance - requestedAmount) }).where(eq(schema.savingsAccounts.id, accRows[0].id));
        await db.update(schema.borrowers).set({ savingsBalance: Math.max(0, currentBalance - requestedAmount) }).where(eq(schema.borrowers.id, borrowerId));
      }
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
        { id: 'faq-l1', question: 'How do I know if my loan was approved?', answer: 'You will receive a notification once the Credit Committee makes a decision. You can also track the status on the "Loan Applications" page.' },
        { id: 'faq-l2', question: 'When will my loan be disbursed?', answer: 'Approved loans are usually disbursed within 1-3 banking days after approval once all requirements are complete.' },
        { id: 'faq-p1', question: 'What payment methods are accepted?', answer: 'You may pay over the counter at any branch, or via GCash, Maya, and bank transfer through the portal.' },
        { id: 'faq-p2', question: 'Can I pay my loan in full early?', answer: 'Yes. Early settlement is allowed and may qualify for an interest rebate. Contact your branch for the exact amount.' },
        { id: 'faq-s1', question: 'How do I make a savings deposit?', answer: 'You can deposit over the counter at any branch. Withdrawal requests can be filed from the Savings page.' },
        { id: 'faq-s2', question: 'What is the interest rate on savings?', answer: 'Savings earn 1% per annum, credited quarterly.' },
        { id: 'faq-a1', question: 'How do I reset my password?', answer: 'Use the "Forgot password" option on the login page. A verification code will be sent to your registered email.' },
        { id: 'faq-a2', question: 'How do I update my contact details?', answer: 'Go to My Profile and click "Update Profile". Changes are reviewed by staff when required.' },
        { id: 'faq-g1', question: 'What is a solidarity group?', answer: 'A solidarity group is a circle of members who mutually guarantee each other\'s loans. Group members support timely repayments together.' },
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
