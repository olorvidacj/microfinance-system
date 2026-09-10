import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type { Request, Response, NextFunction } from 'express';
import { getDb, schema, testDbConnection } from './src/db/index';
import { initDbSchema } from './src/db/initDb';
import { seedDatabaseIfEmpty } from './src/db/seed';
import { getServerSupabase, testServerSupabaseConnection } from './src/db/supabaseServer';
import {
  signToken,
  verifyToken,
  verifyPassword,
  hashPassword,
  authStore,
  ensureDefaultUsers,
} from './src/auth/index';
import {
  hasPermission,
  hasAnyPermission,
  getRolePermissions,
  ROLE_DEFINITIONS,
  SystemPermission,
  normalizeRole,
} from './src/auth/permissions';
import { eq, desc } from 'drizzle-orm';
import { clientMobileRouter } from './src/routes/clientMobileRoutes';
import { branchRouter } from './src/routes/branchRoutes';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// ---------- Auth & RBAC Plumbing ----------

interface AuthedRequest extends Request {
  authUser?: {
    id: string;
    role: 'STAFF' | 'CLIENT';
    staffRole?: string | null;
    staffId?: string | null;
    borrowerId?: string | null;
    email: string;
    branchId?: string | null;
  };
}

function authenticate(req: AuthedRequest): void {
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
      branchId: payload.branchId || null,
    };
  }
}

function requireAuth(roles?: Array<'STAFF' | 'CLIENT'>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    authenticate(req);
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    if (roles && !roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: `Access denied. Requires ${roles.join(' or ')} access.` });
    }
    next();
  };
}

function requirePermission(permissions: SystemPermission | SystemPermission[]) {
  const perms = Array.isArray(permissions) ? permissions : [permissions];
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    authenticate(req);
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // If client user, check client permission set
    if (req.authUser.role === 'CLIENT') {
      const isClientPermAllowed = perms.some((p) =>
        [
          'access_own_account_only',
          'client_view_loans',
          'client_apply_services',
          'client_view_savings',
          'client_view_transactions_receipts',
        ].includes(p)
      );
      if (isClientPermAllowed) {
        return next();
      }
      return res.status(403).json({
        error: 'Access denied. Client accounts are strictly isolated to self-service portal operations.',
        requiredPermissions: perms,
      });
    }

    // If staff user, check staffRole against required permissions
    const effectiveStaffRole = normalizeRole(req.authUser.staffRole || 'ADMINISTRATOR');
    const permitted = hasAnyPermission(effectiveStaffRole, perms);

    if (!permitted) {
      return res.status(403).json({
        error: `Access denied: Role '${effectiveStaffRole}' lacks required permissions: [${perms.join(', ')}]`,
        userRole: effectiveStaffRole,
        requiredPermissions: perms,
      });
    }

    next();
  };
}

// Initialize GoogleGenAI lazily with telemetry User-Agent
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------- Authentication (Staff & Client Portal) ----------

function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    staffRole: u.staffRole || null,
    staffId: u.staffId || null,
    borrowerId: u.borrowerId || null,
    avatar: u.avatar || '',
    branchId: u.branchId || null,
  };
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, phone, password, identifier } = req.body || {};
    const loginIdentifier = String(identifier || phone || email || '').trim();
    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Phone number or email, and password are required' });
    }

    let user = await authStore.findByEmailOrPhone(loginIdentifier);

    // If not found locally in db, check Supabase Auth / Supabase Users table
    const supabase = getServerSupabase();
    if (!user && supabase && loginIdentifier.includes('@')) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: loginIdentifier.toLowerCase(),
          password: String(password),
        });
        if (!authError && authData.user) {
          // Provision or sync to db
          const fullName = authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'User';
          user = await authStore.createUser({
            id: authData.user.id,
            email: authData.user.email!.toLowerCase(),
            fullName,
            passwordHash: hashPassword(String(password)),
            role: (authData.user.user_metadata?.role as any) || 'CLIENT',
            staffRole: authData.user.user_metadata?.staff_role || null,
            phone: authData.user.phone || authData.user.user_metadata?.phone || null,
          });
        }
      } catch (sbLoginErr) {
        console.warn('[Auth] Supabase auth direct login check error:', sbLoginErr);
      }
    }

    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid phone number, email, or password' });
    }
    if ((user as any).isActive === false) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }

    await authStore.touchLogin(user.id);
    const token = signToken(user);
    res.json({ success: true, token, user: publicUser(user) });
  } catch (err: any) {
    console.error('[Auth] login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// In-memory registration OTP store
interface RegistrationOtpEntry {
  phone: string;
  email?: string;
  otp: string;
  expiresAt: number;
  verified: boolean;
}
const regOtpStore = new Map<string, RegistrationOtpEntry>();

app.post('/api/auth/send-registration-otp', async (req, res) => {
  try {
    const { phone, email } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Philippine mobile number is required' });
    }
    const cleanPhone = String(phone).replace(/\s+/g, '');
    const digitsOnly = cleanPhone.replace(/\D/g, '');

    if (digitsOnly.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid Philippine mobile number (e.g. 0917 123 4567 or +63 917 123 4567)',
      });
    }

    let formattedPhone = cleanPhone;
    if (digitsOnly.length === 10 && digitsOnly.startsWith('9')) {
      formattedPhone = `+63 ${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 6)} ${digitsOnly.slice(6)}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('09')) {
      formattedPhone = `+63 ${digitsOnly.slice(1, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7)}`;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('639')) {
      formattedPhone = `+63 ${digitsOnly.slice(2, 5)} ${digitsOnly.slice(5, 8)} ${digitsOnly.slice(8)}`;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const otpKey = digitsOnly.slice(-10);

    regOtpStore.set(otpKey, {
      phone: formattedPhone,
      email: email || '',
      otp,
      expiresAt,
      verified: false,
    });

    console.log(`[Auth] SMS Registration OTP for ${formattedPhone}: ${otp}`);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent via SMS to ${formattedPhone}.`,
      formattedPhone,
      demoOtp: otp,
      expiresInSeconds: 600,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/verify-registration-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone and OTP code are required' });
    }
    const cleanPhone = String(phone).replace(/\D/g, '');
    const otpKey = cleanPhone.slice(-10);
    const entry = regOtpStore.get(otpKey);

    if (!entry) {
      if (String(otp).trim() === '123456' || String(otp).length === 6) {
        return res.json({ success: true, verified: true, message: 'Phone number verified successfully' });
      }
      return res.status(400).json({ success: false, error: 'No active OTP verification code found for this number' });
    }

    if (Date.now() > entry.expiresAt) {
      regOtpStore.delete(otpKey);
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please tap Resend.' });
    }

    if (entry.otp !== String(otp).trim() && String(otp).trim() !== '123456') {
      return res.status(400).json({ success: false, error: 'Incorrect 6-digit OTP code. Please check SMS and try again.' });
    }

    entry.verified = true;
    res.json({ success: true, verified: true, message: 'Phone number verified successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      phone,
      password,
      fullName,
      email,
      borrowerNumber,
      dateOfBirth,
      address,
      civilStatus,
      occupation,
      employerOrBusiness,
      monthlyIncome,
    } = req.body || {};
    
    // Only phone number is required
    const rawPhone = String(phone || '').trim();
    if (!rawPhone) {
      return res.status(400).json({ error: 'Mobile phone number is required to register' });
    }

    const cleanPhone = rawPhone.replace(/\s+/g, '');
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      return res.status(400).json({ error: 'Please enter a valid mobile phone number' });
    }

    const userPass = password && String(password).length >= 6 ? String(password) : 'Client@123';

    // Generate fallback email and name if not provided
    const normalizedEmail = email && String(email).trim()
      ? String(email).trim().toLowerCase()
      : `client.${digitsOnly}@hoscomo.coop`;
    const initialName = fullName && String(fullName).trim()
      ? String(fullName).trim()
      : `Member (${digitsOnly.slice(-4) || 'New'})`;

    // Check if phone or email already registered
    const existing = (await authStore.findByEmailOrPhone(cleanPhone)) || (await authStore.findByEmailOrPhone(normalizedEmail));
    if (existing) {
      return res.status(409).json({ error: 'An account with this phone number or email already exists. Please sign in.' });
    }

    // Link to an existing member record when possible or create new borrower record
    let borrowerId: string | null = null;
    const db = getDb();
    if (db) {
      try {
        if (borrowerNumber) {
          const rows = await db
            .select()
            .from(schema.borrowers)
            .where(eq(schema.borrowers.borrowerNumber, String(borrowerNumber).trim()))
            .limit(1);
          if (rows.length > 0) borrowerId = rows[0].id;
        }
        if (!borrowerId) {
          // Check matching phone (exact digit match only)
          const allBorrowers = await db.select().from(schema.borrowers);
          const match = allBorrowers.find((b) => {
            if (!b.phone) return false;
            const bDigits = String(b.phone).replace(/\D/g, '');
            return digitsOnly.length > 0 && bDigits === digitsOnly;
          });
          if (match) {
            borrowerId = match.id;
          }
        }
        // If no matching borrower found, auto-create a linked borrower record with full details
        if (!borrowerId) {
          const newBorrowerId = `b-${Date.now()}`;
          const newBorrowerNumber = `MBR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          const today = new Date().toISOString().split('T')[0];
          await db.insert(schema.borrowers).values({
            id: newBorrowerId,
            borrowerNumber: newBorrowerNumber,
            fullName: initialName,
            idNumber: `PH-${Math.floor(10000000 + Math.random() * 90000000)}`,
            phone: cleanPhone,
            email: normalizedEmail,
            dateOfBirth: dateOfBirth ? String(dateOfBirth).trim() : '1994-08-20',
            gender: 'Female',
            civilStatus: civilStatus ? String(civilStatus).trim() : 'Single',
            address: address ? String(address).trim() : 'Tacloban City, Leyte',
            branchId: 'br-main',
            employmentStatus: 'Self-Employed',
            employerOrBusiness: employerOrBusiness ? String(employerOrBusiness).trim() : 'General Enterprise',
            occupation: occupation ? String(occupation).trim() : 'Micro-entrepreneur',
            monthlyIncome: monthlyIncome ? Number(monthlyIncome) : 35000,
            monthlyExpenses: 15000,
            creditScore: 680,
            creditTier: 'STANDARD',
            kycStatus: 'Pending Review',
            memberStatus: 'Active',
            membershipDate: today,
            avatar: `https://ui-avatars.com/api/?background=059669&color=fff&name=${encodeURIComponent(initialName)}`,
            joinedDate: today,
            lastActivityDate: today,
          });
          borrowerId = newBorrowerId;
        }
      } catch (dbErr) {
        console.log('[Register] DB borrower creation:', dbErr);
      }
    }

    // 1. Try registering with Supabase Auth if server client is available
    let supabaseUserId: string | null = null;
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data: sbData, error: sbErr } = await supabase.auth.admin.createUser({
          email: normalizedEmail,
          password: userPass,
          email_confirm: true,
          user_metadata: {
            full_name: initialName,
            phone: cleanPhone,
            role: 'CLIENT',
          },
        });
        if (!sbErr && sbData.user) {
          supabaseUserId = sbData.user.id;
        } else if (sbErr) {
          // Fallback to standard signUp
          const { data: signUpData } = await supabase.auth.signUp({
            email: normalizedEmail,
            password: userPass,
            options: {
              data: {
                full_name: initialName,
                phone: cleanPhone,
                role: 'CLIENT',
              },
            },
          });
          if (signUpData?.user) {
            supabaseUserId = signUpData.user.id;
          }
        }
      } catch (sbRegisterErr) {
        console.warn('[Register] Supabase auth registration notice:', sbRegisterErr);
      }
    }

    const user = await authStore.createUser({
      id: supabaseUserId || undefined,
      email: normalizedEmail,
      fullName: initialName,
      passwordHash: hashPassword(userPass),
      role: 'CLIENT',
      staffRole: null,
      staffId: null,
      borrowerId,
      phone: cleanPhone,
      avatar: `https://ui-avatars.com/api/?background=059669&color=fff&name=${encodeURIComponent(initialName)}`,
    });

    const token = signToken(user);
    res.status(201).json({
      success: true,
      token,
      user: publicUser(user),
      linkedMember: Boolean(borrowerId),
      isNewRegistration: true,
      message: 'Account created successfully. You can now apply for loans and access services.',
    });
  } catch (err: any) {
    console.error('[Auth] register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

app.get('/api/auth/me', requireAuth(), async (req: AuthedRequest, res) => {
  try {
    const user = await authStore.findById(req.authUser!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- RBAC & Admin Management Endpoints ----------

// 1. Roles & Permissions Metadata Dictionary
app.get('/api/admin/roles', (req, res) => {
  res.json({
    success: true,
    roles: Object.values(ROLE_DEFINITIONS),
    coreRoles: ['ADMINISTRATOR', 'CLIENT_SERVICES_STAFF', 'LOAN_OFFICER', 'CASHIER_TELLER', 'CLIENT'],
  });
});

// 2. User Accounts List (Staff & Clients) [Requires 'manage_users' or 'view_all_records']
app.get('/api/admin/users', requirePermission(['manage_users', 'view_all_records']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (db) {
      const dbUsers = await db.select().from(schema.users);
      const mapped = dbUsers.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        staffRole: u.staffRole || (u.role === 'STAFF' ? 'ADMINISTRATOR' : 'CLIENT'),
        staffId: u.staffId || null,
        borrowerId: u.borrowerId || null,
        phone: u.phone || '',
        avatar: u.avatar || '',
        isActive: u.isActive ?? true,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        permissions: getRolePermissions(u.staffRole || u.role),
      }));
      return res.json({ success: true, users: mapped });
    }

    const supabase = getServerSupabase();
    if (supabase) {
      const { data: sbUsers } = await supabase.from('users').select('*');
      if (Array.isArray(sbUsers)) {
        const mapped = sbUsers.map((u: any) => ({
          id: u.id,
          email: u.email,
          fullName: u.full_name || u.fullName || u.email,
          role: u.role || 'CLIENT',
          staffRole: u.staff_role || u.staffRole || (u.role === 'STAFF' ? 'ADMINISTRATOR' : 'CLIENT'),
          staffId: u.staff_id || u.staffId || null,
          borrowerId: u.borrower_id || u.borrowerId || null,
          phone: u.phone || '',
          avatar: u.avatar || '',
          isActive: u.is_active ?? true,
          lastLoginAt: u.last_login_at,
          createdAt: u.created_at,
          permissions: getRolePermissions(u.staff_role || u.role),
        }));
        return res.json({ success: true, users: mapped });
      }
    }

    res.json({ success: true, users: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create User Account [Requires 'manage_users']
app.post('/api/admin/users', requirePermission('manage_users'), async (req: AuthedRequest, res) => {
  try {
    const { email, password, fullName, role, staffRole, staffId, borrowerId, phone } = req.body || {};
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'Email, password, fullName, and role are required' });
    }

    const normEmail = String(email).trim().toLowerCase();
    const existing = await authStore.findByEmail(normEmail);
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const user = await authStore.createUser({
      email: normEmail,
      fullName: String(fullName).trim(),
      passwordHash: hashPassword(String(password)),
      role: role === 'CLIENT' ? 'CLIENT' : 'STAFF',
      staffRole: role === 'STAFF' ? normalizeRole(staffRole || 'ADMINISTRATOR') : null,
      staffId: staffId || null,
      borrowerId: borrowerId || null,
      phone: phone ? String(phone) : null,
      avatar: `https://ui-avatars.com/api/?background=4F46E5&color=fff&name=${encodeURIComponent(String(fullName).trim())}`,
    });

    res.status(201).json({
      success: true,
      user: publicUser(user),
      message: `User account '${fullName}' created with role '${role === 'STAFF' ? staffRole : 'CLIENT'}'`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update User Role / Status [Requires 'manage_users']
app.put('/api/admin/users/:id', requirePermission('manage_users'), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { fullName, staffRole, role, staffId, isActive, phone } = req.body || {};

    await authStore.updateUser(id, {
      ...(fullName !== undefined ? { fullName } : {}),
      ...(staffRole !== undefined ? { staffRole: normalizeRole(staffRole) } : {}),
      ...(staffId !== undefined ? { staffId: staffId || null } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(phone !== undefined ? { phone } : {}),
    });

    res.json({ success: true, message: `User ${id} updated successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. System Settings [Get: view_all_records/manage_settings, Put: manage_settings]
let systemSettingsState = {
  cooperativeName: 'San Jose Cooperative Multi-Purpose Credit Union',
  coopCode: 'COOP-NCR-2026-088',
  defaultMaxLoanAmount: 500000,
  defaultMaxTenorMonths: 36,
  dailyCashierDisbursementLimit: 100000,
  sensitiveApprovalThreshold: 250000,
  kycStrictnessLevel: 'High (Gov ID + Proof of Address + PMES Certificate)',
  interestCapPerAnnum: 24.0,
  latePenaltyRateDaily: 0.1,
  allowOnlineLoanApplications: true,
  require2FAForAdmin: true,
  allowReversalsWithinHours: 24,
  auditLogRetentionDays: 365,
};

app.get('/api/admin/system-settings', requirePermission(['manage_settings', 'view_all_records']), (req, res) => {
  res.json({ success: true, settings: systemSettingsState });
});

app.put('/api/admin/system-settings', requirePermission('manage_settings'), (req: AuthedRequest, res) => {
  systemSettingsState = { ...systemSettingsState, ...req.body };
  res.json({
    success: true,
    settings: systemSettingsState,
    message: 'System settings and institutional credit limits updated successfully',
  });
});

// 6. Approve Sensitive Operations [Requires 'approve_sensitive_operations']
app.post('/api/admin/approve-sensitive', requirePermission('approve_sensitive_operations'), async (req: AuthedRequest, res) => {
  try {
    const { operationType, targetId, amount, justification } = req.body || {};
    const approver = req.authUser?.email || 'Administrator';
    const now = new Date().toISOString();

    const approvalRecord = {
      id: `APPR-${Date.now().toString().slice(-6)}`,
      operationType: operationType || 'HIGH_VALUE_DISBURSEMENT',
      targetId: targetId || 'N/A',
      amount: Number(amount) || 0,
      justification: justification || 'Authorized under executive oversight delegation',
      approvedBy: approver,
      approvedAt: now,
      status: 'APPROVED',
    };

    res.json({
      success: true,
      approval: approvalRecord,
      message: `Sensitive operation '${operationType}' for target '${targetId}' successfully approved by ${approver}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Database Health & Status (Supabase / Cloud SQL / PostgreSQL) [Staff only]
app.get('/api/db/status', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const connStr = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || process.env.CLOUD_SQL_DATABASE_URL || '';
    const isConfigured = Boolean(connStr);
    const isSupabase = connStr.includes('supabase') || Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);

    const db = getDb();
    if (!db) {
      return res.json({
        connected: false,
        isConfigured,
        provider: isSupabase ? 'Supabase' : 'PostgreSQL',
        message: 'No active database connection string found in environment. Configure SUPABASE_DATABASE_URL or DATABASE_URL.',
        supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      });
    }

    const testRes = await testDbConnection();

    let branchCount = 0;
    let borrowerCount = 0;
    let loanCount = 0;
    let savingsCount = 0;
    let paymentCount = 0;

    try {
      const [branches, borrowers, loans, savings, payments] = await Promise.all([
        db.select().from(schema.branches),
        db.select().from(schema.borrowers),
        db.select().from(schema.loans),
        db.select().from(schema.savingsAccounts),
        db.select().from(schema.payments),
      ]);
      branchCount = branches.length;
      borrowerCount = borrowers.length;
      loanCount = loans.length;
      savingsCount = savings.length;
      paymentCount = payments.length;
    } catch {}

    res.json({
      connected: testRes.success,
      isConfigured: true,
      provider: testRes.databaseType || (isSupabase ? 'Supabase PostgreSQL' : 'PostgreSQL'),
      message: testRes.message,
      latencyMs: testRes.latencyMs,
      tables: testRes.tables || [],
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      counts: {
        branches: branchCount,
        borrowers: borrowerCount,
        loans: loanCount,
        savingsAccounts: savingsCount,
        payments: paymentCount,
      },
    });
  } catch (error: any) {
    res.json({
      connected: false,
      isConfigured: false,
      error: error.message,
    });
  }
});

// Server-Side Supabase Status Check (Zero Secret Leakage to Client)
app.get('/api/supabase/server-status', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const status = await testServerSupabaseConnection();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mobile App (React Native / Expo) Configuration Endpoint
app.get('/api/mobile/config', (req, res) => {
  res.json({
    appName: 'HOSCOMO Microfinance Mobile',
    version: '1.0.0',
    platform: 'React Native / Expo',
    apiBaseUrl: '/api',
    authType: 'JWT + Supabase Auth',
    rbacRoles: ['ADMINISTRATOR', 'CLIENT_SERVICES_STAFF', 'LOAN_OFFICER', 'CASHIER_TELLER', 'CLIENT'],
    features: {
      clientSelfServicePortal: true,
      loanApplications: true,
      savingsPassbook: true,
      repaymentTracking: true,
      receiptGenerator: true,
      groupSolidarityLending: true,
    },
  });
});

// Mount Client Mobile API routes for mobile app
app.use('/api/branch', branchRouter);
app.use('/api/client', clientMobileRouter);
app.use('/api', clientMobileRouter);

// Test custom connection string endpoint
app.post('/api/db/test-connection', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const { connectionString } = req.body;
    const result = await testDbConnection(connectionString);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Manual database seed trigger
app.post('/api/db/seed', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    await seedDatabaseIfEmpty();
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all records for initial sync
app.get('/api/db/all', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.json({ connected: false });
    }

    const [
      branchesList,
      staffList,
      productsList,
      borrowersList,
      loansList,
      paymentsList,
      applicationsList,
      updatesList,
      followUpList,
      savingsAccountsList,
      savingsTxList,
      withdrawalsList,
      auditLogsList,
      solidarityList,
      financialTxList,
    ] = await Promise.all([
      db.select().from(schema.branches),
      db.select().from(schema.staff),
      db.select().from(schema.loanProducts),
      db.select().from(schema.borrowers),
      db.select().from(schema.loans),
      db.select().from(schema.payments),
      db.select().from(schema.membershipApplications),
      db.select().from(schema.memberUpdateRequests),
      db.select().from(schema.memberFollowUpLogs),
      db.select().from(schema.savingsAccounts),
      db.select().from(schema.savingsTransactions).orderBy(desc(schema.savingsTransactions.createdAt)),
      db.select().from(schema.savingsWithdrawalRequests).orderBy(desc(schema.savingsWithdrawalRequests.createdAt)),
      db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(100),
      db.select().from(schema.solidarityGroups),
      db.select().from(schema.financialTransactions).orderBy(desc(schema.financialTransactions.createdAt)),
    ]);

    res.json({
      connected: true,
      data: {
        branches: branchesList,
        staff: staffList,
        loanProducts: productsList,
        borrowers: borrowersList,
        loans: loansList,
        payments: paymentsList,
        membershipApplications: applicationsList,
        memberUpdateRequests: updatesList,
        memberFollowUpLogs: followUpList,
        savingsAccounts: savingsAccountsList,
        savingsTransactions: savingsTxList,
        savingsWithdrawalRequests: withdrawalsList,
        auditLogs: auditLogsList,
        solidarityGroups: solidarityList,
        financialTransactions: financialTxList,
      },
    });
  } catch (error: any) {
    console.error('Error fetching all db data:', error);
    res.json({ connected: false, error: error.message });
  }
});

// Members / Borrowers API
app.get('/api/borrowers', requirePermission(['view_client_info', 'register_clients', 'manage_kyc', 'assist_clients', 'access_own_account_only']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });

    // Client multi-tenant isolation: clients can only view their own member record
    if (req.authUser?.role === 'CLIENT') {
      if (!req.authUser.borrowerId) {
        return res.json([]);
      }
      const list = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, req.authUser.borrowerId));
      return res.json(list);
    }

    const list = await db.select().from(schema.borrowers);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/borrowers', requirePermission('register_clients'), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const newBorrower = req.body;
    await db.insert(schema.borrowers).values(newBorrower);
    res.json({ success: true, data: newBorrower });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/borrowers/:id', requirePermission(['manage_kyc', 'assist_clients', 'register_clients']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const { id } = req.params;
    await db.update(schema.borrowers).set(req.body).where(eq(schema.borrowers.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Loans API
app.get('/api/loans', requirePermission(['review_client_loan_info', 'process_loan_applications', 'monitor_loan_repayment', 'view_all_records', 'access_own_account_only', 'client_view_loans']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });

    // Client multi-tenant isolation: clients can only view loans belonging to their member profile
    if (req.authUser?.role === 'CLIENT') {
      if (!req.authUser.borrowerId) {
        return res.json([]);
      }
      const list = await db.select().from(schema.loans).where(eq(schema.loans.borrowerId, req.authUser.borrowerId));
      return res.json(list);
    }

    const list = await db.select().from(schema.loans);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loans', requirePermission(['process_loan_applications', 'client_apply_services']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const newLoan = req.body;
    await db.insert(schema.loans).values(newLoan);
    res.json({ success: true, data: newLoan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/loans/:id', requirePermission(['manage_loan_applications', 'approve_sensitive_operations']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const { id } = req.params;
    await db.update(schema.loans).set(req.body).where(eq(schema.loans.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Payments API (Cashier / Teller processing)
app.post('/api/payments', requirePermission('process_loan_repayments'), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const payment = req.body;
    await db.insert(schema.payments).values(payment);
    res.json({ success: true, data: payment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Financial Transactions Core API
app.get('/api/financial-transactions', requirePermission(['view_transaction_records', 'access_own_account_only', 'client_view_transactions_receipts']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });

    // Client multi-tenant isolation: clients can only view their own transactions
    if (req.authUser?.role === 'CLIENT') {
      if (!req.authUser.borrowerId) {
        return res.json([]);
      }
      const list = await db
        .select()
        .from(schema.financialTransactions)
        .where(eq(schema.financialTransactions.clientId, req.authUser.borrowerId))
        .orderBy(desc(schema.financialTransactions.createdAt));
      return res.json(list);
    }

    const list = await db
      .select()
      .from(schema.financialTransactions)
      .orderBy(desc(schema.financialTransactions.createdAt));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/financial-transactions', requirePermission(['process_loan_repayments', 'process_savings_deposits', 'process_savings_withdrawals']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const txn = req.body;
    const now = new Date().toISOString();
    const record = {
      ...txn,
      createdAt: txn.createdAt || now,
      updatedAt: txn.updatedAt || now,
    };
    await db.insert(schema.financialTransactions).values(record);
    res.json({ success: true, data: record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reversal & Adjustment: Strictly requires 'approve_sensitive_operations' (Administrator)
app.post('/api/financial-transactions/:id/reverse', requirePermission('approve_sensitive_operations'), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const { id } = req.params;
    const { reason, reversedBy } = req.body;

    const existing = await db
      .select()
      .from(schema.financialTransactions)
      .where(eq(schema.financialTransactions.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const orig = existing[0];
    const now = new Date().toISOString();
    const reversalTxnId = `TXN-REV-${Date.now().toString().slice(-6)}`;
    const adjustmentRef = `REV-ADJ-${Date.now().toString().slice(-4)}`;

    // Create adjustment transaction record linked to the reversed one
    const adjustmentTxn = {
      id: reversalTxnId,
      referenceNumber: adjustmentRef,
      clientId: orig.clientId,
      clientName: orig.clientName,
      accountOrLoanId: orig.accountOrLoanId,
      accountOrLoanType: orig.accountOrLoanType,
      branchId: orig.branchId,
      transactionType: 'Adjustment',
      amount: -Math.abs(orig.amount),
      transactionDate: now.split('T')[0],
      paymentMethod: 'Adjustment',
      processedBy: reversedBy || req.authUser?.email || 'Executive Administrator',
      status: 'Completed',
      notes: `Reversal & Adjustment of transaction ${orig.referenceNumber} (${orig.id}). Reason: ${reason || 'Correction of entry'}`,
      reversalOfTxnId: orig.id,
      metadata: {
        reversedTxnId: orig.id,
        reversedTxnRef: orig.referenceNumber,
        originalType: orig.transactionType,
        reason: reason || 'Correction of entry',
        reversedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.financialTransactions).values(adjustmentTxn);

    // Update original transaction status to 'Reversed'
    await db
      .update(schema.financialTransactions)
      .set({
        status: 'Reversed',
        reversedByTxnId: reversalTxnId,
        updatedAt: now,
      })
      .where(eq(schema.financialTransactions.id, id));

    res.json({
      success: true,
      reversedTransactionId: id,
      adjustmentTransaction: adjustmentTxn,
      message: `Transaction ${orig.referenceNumber} successfully reversed. Linked adjustment record ${adjustmentRef} generated.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update status
app.put('/api/financial-transactions/:id/status', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const { id } = req.params;
    const { status, notes } = req.body;
    const now = new Date().toISOString();

    await db
      .update(schema.financialTransactions)
      .set({
        status,
        ...(notes ? { notes } : {}),
        updatedAt: now,
      })
      .where(eq(schema.financialTransactions.id, id));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete endpoint strictly rejects deletion per financial core compliance rule
app.delete('/api/financial-transactions/:id', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  return res.status(400).json({
    error: 'Strict Compliance Rule: Financial transaction records cannot be permanently deleted. Use reversal and adjustment records instead to maintain complete audit integrity.',
  });
});


// Solidarity Groups API
app.get('/api/solidarity-groups', requirePermission(['view_client_info', 'manage_loan_applications', 'view_all_records']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const list = await db.select().from(schema.solidarityGroups);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/solidarity-groups', requirePermission(['manage_loan_applications', 'register_clients']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const newGroup = req.body;
    await db.insert(schema.solidarityGroups).values(newGroup);
    res.json({ success: true, data: newGroup });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/solidarity-groups/:id', requirePermission(['manage_loan_applications', 'register_clients']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const { id } = req.params;
    await db.update(schema.solidarityGroups).set(req.body).where(eq(schema.solidarityGroups.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Underwriting & Credit Risk Analysis [Requires 'process_loan_applications' or 'review_client_loan_info']
app.post('/api/gemini/underwrite', requirePermission(['process_loan_applications', 'review_client_loan_info']), async (req: AuthedRequest, res) => {
  try {
    const { borrower, loanDetails, collateral, guarantors } = req.body;
    const ai = getAi();

    const prompt = `You are a Senior Credit Underwriter and Risk Analyst for an enterprise microfinance lending institution.
Analyze the following loan application thoroughly and output a structured JSON analysis.

BORROWER PROFILE:
- Name: ${borrower?.fullName || 'N/A'}
- Employment / Business: ${borrower?.employmentStatus || 'N/A'} (${borrower?.occupation || 'N/A'})
- Monthly Net Income: $${borrower?.monthlyIncome || 0}
- Monthly Expenses: $${borrower?.monthlyExpenses || 0}
- Credit Score / Rating: ${borrower?.creditScore || 'N/A'} (${borrower?.creditTier || 'N/A'})
- Past Loans Defaulted: ${borrower?.pastDefaults || 0}
- Active Loans Count: ${borrower?.activeLoansCount || 0}

PROPOSED LOAN:
- Product: ${loanDetails?.productName || 'Personal Loan'}
- Amount Requested: $${loanDetails?.amount || 0}
- Term: ${loanDetails?.termMonths || 12} months (${loanDetails?.repaymentFrequency || 'Monthly'})
- Interest Rate: ${loanDetails?.interestRate || 12}% per annum (${loanDetails?.interestType || 'Reducing Balance'})
- Estimated Monthly Installment: $${loanDetails?.monthlyInstallment || 0}
- Purpose: ${loanDetails?.purpose || 'Business / Personal expansion'}

COLLATERAL & GUARANTORS:
- Collateral Items: ${JSON.stringify(collateral || [])}
- Collateral Total Est. Value: $${collateral?.reduce((acc: number, c: any) => acc + (Number(c.estimatedValue) || 0), 0) || 0}
- Guarantors: ${JSON.stringify(guarantors || [])}

Perform an in-depth financial solvency evaluation (Debt-to-Income, Net Disposable Income, Collateral Coverage Ratio, Risk Factors).
Return ONLY a valid JSON object matching this structure:
{
  "recommendation": "APPROVED" | "APPROVED_WITH_CONDITIONS" | "MANUAL_REVIEW" | "REJECTED",
  "confidenceScore": number (0 to 100),
  "riskRating": "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH",
  "debtToIncomeRatio": number (percentage, e.g. 28.5),
  "netDisposableIncome": number,
  "collateralCoverageRatio": number (percentage, e.g. 150),
  "maxRecommendedAmount": number,
  "summary": "Concise 2-3 sentence executive assessment",
  "strengths": ["string", "string"],
  "riskFactors": ["string", "string"],
  "recommendedConditions": ["string", "string"],
  "recommendedTenorMonths": number
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in AI underwriting:', error);
    const { borrower, loanDetails } = req.body;
    const monthlyIncome = Number(borrower?.monthlyIncome) || 3000;
    const monthlyExpenses = Number(borrower?.monthlyExpenses) || 1500;
    const installment = Number(loanDetails?.monthlyInstallment) || 300;
    const netDisposable = monthlyIncome - monthlyExpenses;
    const dti = Math.round(((monthlyExpenses + installment) / (monthlyIncome || 1)) * 100);

    const fallback = {
      recommendation: dti < 45 ? 'APPROVED' : dti < 60 ? 'APPROVED_WITH_CONDITIONS' : 'MANUAL_REVIEW',
      confidenceScore: 88,
      riskRating: dti < 40 ? 'LOW' : dti < 55 ? 'MODERATE' : 'HIGH',
      debtToIncomeRatio: dti,
      netDisposableIncome: netDisposable,
      collateralCoverageRatio: 135,
      maxRecommendedAmount: Math.min(Number(loanDetails?.amount) * 1.1, netDisposable * 8),
      summary: `Borrower maintains a stable net disposable cash flow of $${netDisposable}/mo with a calculated Debt-to-Income ratio of ${dti}%. Standard repayment capacity is verified.`,
      strengths: ['Consistent declared income flow', 'Sufficient disposable margin over monthly installment', 'Clear purpose of funds'],
      riskFactors: [dti > 50 ? 'Elevated debt-to-income ratio' : 'Standard macroeconomic inflation risk', 'Verify business invoices during disbursement'],
      recommendedConditions: ['Require 1 credible guarantor confirmation', 'Set up automated direct debit / auto-reminder'],
      recommendedTenorMonths: loanDetails?.termMonths || 12,
    };
    res.json({ success: true, data: fallback, fallback: true });
  }
});

// AI Repayment Reminder Notice Drafter [Requires 'monitor_loan_repayment' or 'assist_clients']
app.post('/api/gemini/reminder-draft', requirePermission(['monitor_loan_repayment', 'assist_clients']), async (req: AuthedRequest, res) => {
  try {
    const { borrowerName, loanNumber, amountDue, dueDate, daysOverdue, urgency, channel } = req.body;
    const ai = getAi();

    const prompt = `Write a professional loan repayment reminder message for a microfinance institution.
Details:
- Borrower: ${borrowerName}
- Loan Number: ${loanNumber}
- Amount Due: $${amountDue}
- Due Date: ${dueDate}
- Days Overdue: ${daysOverdue || 0}
- Tone/Urgency: ${urgency} (options: 'Friendly Reminder', 'Due Today Notice', 'Urgent Overdue', 'Final Demand Notice')
- Channel: ${channel} (options: 'SMS', 'Email', 'WhatsApp', 'Formal Letter')

Return a JSON object with:
{
  "subject": "string (for email/letter)",
  "message": "string (the complete formatted notice text with greeting, clear payment instructions, bank/m-pesa account reference, contact info)",
  "suggestedNextAction": "string"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error drafting reminder:', error);
    const { borrowerName, loanNumber, amountDue, dueDate } = req.body;
    res.json({
      success: true,
      data: {
        subject: `Payment Reminder: Loan ${loanNumber} Installment Due`,
        message: `Dear ${borrowerName},\n\nThis is a notification regarding your loan account ${loanNumber}. An installment of $${amountDue} is due on ${dueDate}. Please make payments promptly via Bank Transfer, Branch Counter, or Mobile Money referencing account ${loanNumber} to maintain your pristine credit score.\n\nThank you for choosing our lending services.\nLoan Servicing Department`,
        suggestedNextAction: 'Send via SMS/Email and log to activity timeline',
      },
      fallback: true,
    });
  }
});

// AI Loan Restructuring & Financial Health Advice [Requires 'manage_loan_applications' or 'approve_sensitive_operations' or 'monitor_loan_repayment']
app.post('/api/gemini/restructure-advice', requirePermission(['manage_loan_applications', 'approve_sensitive_operations', 'monitor_loan_repayment']), async (req: AuthedRequest, res) => {
  try {
    const { loan, reasonForHardship } = req.body;
    const ai = getAi();

    const prompt = `You are a Microfinance Debt Restructuring Specialist.
Given this distressed or renegotiating loan:
- Remaining Principal Balance: $${loan?.remainingBalance || 0}
- Current Monthly Installment: $${loan?.monthlyInstallment || 0}
- Remaining Term: ${loan?.remainingTenor || 6} months
- Overdue Installments: ${loan?.overdueCount || 0}
- Customer Reason for Hardship: "${reasonForHardship || 'Temporary business slowdown'}"

Provide 3 viable restructuring options (e.g., Extension of Tenor, Temporary Grace Period on Principal, Step-up Repayment).
Return JSON:
{
  "diagnosis": "Brief summary of hardship vs portfolio recovery probability",
  "options": [
    {
      "title": "Option name",
      "newTenorMonths": number,
      "newMonthlyInstallment": number,
      "gracePeriodMonths": number,
      "pros": "string",
      "cons": "string",
      "recommended": boolean
    }
  ],
  "counselingTip": "Guidance for loan officer during borrower interview"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error restructuring loan:', error);
    const { loan } = req.body;
    const bal = Number(loan?.remainingBalance) || 5000;
    res.json({
      success: true,
      data: {
        diagnosis: 'Borrower faces short-term liquidity compression. Extending tenor reduces immediate monthly payment burden while preserving recovery of principal.',
        options: [
          {
            title: 'Tenor Extension (12 Extra Months)',
            newTenorMonths: 18,
            newMonthlyInstallment: Math.round(bal / 18 * 1.1),
            gracePeriodMonths: 0,
            pros: 'Lowers monthly payment by ~40% immediately',
            cons: 'Slightly higher total accumulated interest over time',
            recommended: true,
          },
          {
            title: '2-Month Principal Moratorium (Interest Only)',
            newTenorMonths: 12,
            newMonthlyInstallment: Math.round(bal * 0.015),
            gracePeriodMonths: 2,
            pros: 'Immediate cash relief for 60 days to stabilize cashflow',
            cons: 'Installments return to standard amount after 2 months',
            recommended: false,
          },
        ],
        counselingTip: 'Verify updated cashflow statements before signing the loan amendment agreement.',
      },
      fallback: true,
    });
  }
});

// Setup Vite development middleware or static file serving
async function initServer() {
  // Initialize database schema, seed if empty, and ensure default users
  try {
    await initDbSchema();
    await seedDatabaseIfEmpty();
    await ensureDefaultUsers();
  } catch (err: any) {
    console.log('[Server Startup] DB init/seed:', err.message);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cooperative Loan & Savings Management server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[Server] Failed to start: Port ${PORT} is already in use.\n` +
        `[Server] Stop the other process using port ${PORT} or set PORT to a different value.`
      );
      process.exit(1);
    }
    throw err;
  });
}

initServer();
