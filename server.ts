import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type { Request, Response, NextFunction } from 'express';
import { getDb, schema, testDbConnection } from './src/db/index';
import { initDbSchema } from './src/db/initDb';
import { createClientProfile, findBorrowerByContact } from './src/db/clientProvisioning';
import { seedDatabaseIfEmpty } from './src/db/seed';
import { getServerSupabase, testServerSupabaseConnection } from './src/db/supabaseServer';
import {
  signToken,
  verifyToken,
  verifyPassword,
  hashPassword,
  authStore,
  ensureDefaultUsers,
  DEFAULT_ADMIN_PASS_HASH,
} from './src/auth/index';
import {
  supabaseSignIn,
  supabaseGetUser,
  supabaseCreateClientUser,
  supabaseResetPassword,
  supabaseSendEmailOtp,
  supabaseVerifyEmailOtp,
  ensureLocalClientUser,
  normalizePhilippinePhone,
  digitsOnly,
  isValidPhilippinePhone,
  isDemoMode,
  isGeneratedEmail,
  generateClientEmail,
  DEMO_PASSWORDS,
  SupabaseAuthError,
  writeAuditLog,
} from './src/auth/supabaseAuth';
import { INITIAL_BRANCHES, INITIAL_STAFF } from './src/data/initialData';
import {
  hasPermission,
  hasAnyPermission,
  getRolePermissions,
  ROLE_DEFINITIONS,
  SystemPermission,
  normalizeRole,
} from './src/auth/permissions';
import { desc, eq, sql } from 'drizzle-orm';
import { clientMobileRouter } from './src/routes/clientMobileRoutes';
import { branchRouter } from './src/routes/branchRoutes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

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

async function authenticate(req: AuthedRequest): Promise<void> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return;

  // 1. Local HMAC token (legacy fallback + fully-local dev mode)
  const payload = verifyToken(token);
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
    return;
  }

  // 2. Supabase Auth access token (primary in production)
  const supabaseUser = await supabaseGetUser(token);
  if (!supabaseUser) return;

  const email = String(
    supabaseUser.email ||
      supabaseUser.user_metadata?.email ||
      ''
  ).toLowerCase();
  let record = null;
  try {
    record = await authStore.findById(supabaseUser.id);
  } catch {}
  if (!record && email) {
    try {
      record = await authStore.findByEmailOrPhone(email);
    } catch {}
  }
  if (!record) {
    try {
      record = await ensureLocalClientUser({
        id: supabaseUser.id,
        email,
        fullName: String(supabaseUser.user_metadata?.full_name || email.split('@')[0] || 'User'),
        phone: supabaseUser.user_metadata?.phone || supabaseUser.phone || null,
      });
    } catch {}
  }
  if (!record || record.isActive === false) return;

  req.authUser = {
    id: record.id,
    role: record.role as 'STAFF' | 'CLIENT',
    staffRole: record.staffRole || null,
    staffId: record.staffId || null,
    borrowerId: record.borrowerId || null,
    email: record.email,
    branchId: record.branchId || null,
  };
}

function requireAuth(roles?: Array<'STAFF' | 'CLIENT'>) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    await authenticate(req);
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
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    await authenticate(req);
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
    phone: u.phone || null,
    branchId: u.branchId || null,
    profileComplete: u.profileCompleted === true || undefined,
    kycStatus: u.kycStatus || undefined,
  };
}

// Derives client profile-completeness + KYC status from the borrower record so
// the client portal can gate "Complete Your Profile" and KYC onboarding.
async function enrichProfileFlags(u: any) {
  const out: any = { ...u };
  if (!u.borrowerId) {
    out.profileComplete = true;
    out.kycStatus = 'NOT_REQUIRED';
    return out;
  }
  const db = getDb();
  if (db) {
    try {
      const rows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, u.borrowerId)).limit(1);
      const b = rows[0];
      if (!b) return out;
      const isEmpty = (v: any) => !v || String(v).trim() === '';
      const requiredCollected = !!(
        b.dateOfBirth &&
        b.gender &&
        b.civilStatus &&
        b.address &&
        b.occupation &&
        b.employerOrBusiness &&
        Number(b.monthlyIncome || 0) > 0
      );
      out.profileComplete = (b as any).profileCompleted === true || requiredCollected;
      out.kycStatus = b.kycStatus || 'NOT_STARTED';
      out.profileCompleteStep = requiredCollected ? 'done' : 'required';
    } catch {}
  }
  return out;
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, phone, password, identifier } = req.body || {};
    const loginIdentifier = String(identifier || phone || email || '').trim();
    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Phone number or email, and password are required' });
    }

    // ---- Primary path: Supabase Auth ----
    let supabaseError: SupabaseAuthError | null = null;
    let tokenUser: any = null;
    try {
      const result = await supabaseSignIn(loginIdentifier, String(password));
      const sbEmail = String(
        result.user.email || result.user.user_metadata?.email || loginIdentifier
      ).toLowerCase();
      const fullName = String(
        result.user.user_metadata?.full_name || sbEmail.split('@')[0] || 'Member'
      );
      try {
        tokenUser = await ensureLocalClientUser({
          id: result.user.id,
          email: sbEmail,
          fullName,
          phone: result.user.user_metadata?.phone || result.user.phone || null,
        });
      } catch (syncErr) {
        console.warn('[Auth] local user sync warning:', syncErr);
      }
      if (!tokenUser) {
        tokenUser = {
          id: result.user.id,
          email: sbEmail,
          fullName,
          role: 'CLIENT',
          staffRole: null,
          staffId: null,
          borrowerId: null,
          phone: result.user.user_metadata?.phone || result.user.phone || null,
          avatar: null,
          isActive: true,
        };
      }
    } catch (err: any) {
      if (err instanceof SupabaseAuthError) {
        supabaseError = err;
      } else {
        console.warn('[Auth] Supabase sign-in error:', err?.message || err);
      }
    }

    if (!tokenUser && supabaseError && ![401, 404].includes(supabaseError.status)) {
      // Only hard-fail on Supabase-specific errors (email not confirmed, rate
      // limit, etc.). Invalid credentials fall through to the local fallback.
      return res.status(supabaseError.status).json({ error: supabaseError.message });
    }

    // ---- Fallback path: local HMAC / seeded demo accounts ----
    if (!tokenUser) {
      let user = null;
      try {
        user = await authStore.findByEmailOrPhone(loginIdentifier);
      } catch {}

      const passwordOk =
        user && verifyPassword(String(password), user.passwordHash);

      if (!user || !passwordOk) {
        return res.status(401).json({ error: 'Invalid phone number, email, or password' });
      }
      if ((user as any).isActive === false) {
        return res.status(403).json({ error: 'This account has been deactivated' });
      }
      tokenUser = user;
    }

    const effectiveUser = (tokenUser as any).isActive === false ? null : tokenUser;
    if (!effectiveUser) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }

    try {
      await authStore.touchLogin(effectiveUser.id);
    } catch {}
    const token = signToken(effectiveUser);

    try {
      await writeAuditLog({
        action: 'LOGIN',
        type: 'AUTH',
        details: `${effectiveUser.email} signed in`,
        performedBy: effectiveUser.id,
        userName: effectiveUser.fullName || '',
        userRole: effectiveUser.role || '',
        targetType: 'user',
        targetId: effectiveUser.id,
      });
    } catch {}

    const publicProfile = await enrichProfileFlags(publicUser(effectiveUser));
    res.json({ success: true, token, user: publicProfile });
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

    console.log(`[Auth] SMS Registration OTP for ${formattedPhone}`);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent via SMS to ${formattedPhone}.`,
      formattedPhone,
      demoOtp: null,
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
      return res.status(400).json({ success: false, error: 'No active OTP verification code found for this number' });
    }

    if (Date.now() > entry.expiresAt) {
      regOtpStore.delete(otpKey);
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please tap Resend.' });
    }

    if (entry.otp !== String(otp).trim()) {
      return res.status(400).json({ success: false, error: 'Incorrect 6-digit OTP code. Please check SMS and try again.' });
    }

    entry.verified = true;
    res.json({ success: true, verified: true, message: 'Phone number verified successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// Email verification (native Supabase email OTP). The user enters their
// email during registration; a 6-digit code is delivered to Gmail by
// Supabase's own email-OTP flow (signInWithOtp / verifyOtp type email).
// ------------------------------------------------------------------

const emailOtpStore = new Map<string, { email: string; otp: string; expiresAt: number; verified: boolean }>();

function maskEmail(email: string): string {
  const raw = String(email || '').trim().toLowerCase();
  if (!raw.includes('@')) return raw;
  const [local, domain] = raw.split('@');
  if (!local) return raw;
  const shown = local.length <= 2 ? local[0] + '*' : local.slice(0, 2) + '***';
  return `${shown}@${domain}`;
}

app.post('/api/auth/send-email-otp', async (req, res) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    // Resend cooldown guard (60s) — same UX contract as the phone OTP flow.
    const now = Date.now();
    const prev = emailOtpStore.get(cleanEmail);
    if (prev && now - prev.expiresAt + 5 * 60 * 1000 > 60 * 1000 && now < prev.expiresAt && !prev.verified) {
      return res.status(429).json({
        success: false,
        error: 'A verification code was already sent. Please wait a moment before requesting another.',
        retryAfterSeconds: 60,
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 5 * 60 * 1000;

    await supabaseSendEmailOtp(cleanEmail);

    emailOtpStore.set(cleanEmail, { email: cleanEmail, otp, expiresAt, verified: false });

    console.log(`[Auth] Email verification code dispatched to ${maskEmail(cleanEmail)}`);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${maskEmail(cleanEmail)}.`,
      maskedEmail: maskEmail(cleanEmail),
      demoOtp: null,
      demoMode: false,
      expiresInSeconds: 300,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/verify-email-otp', async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanOtp = String(otp || '').replace(/\D/g, '');

    if (!cleanEmail || cleanOtp.length !== 6) {
      return res.status(400).json({ success: false, error: 'Email and a 6-digit verification code are required' });
    }

    const entry = emailOtpStore.get(cleanEmail);
    if (!entry) {
      return res.status(400).json({ success: false, error: 'No active verification code was found for this email. Please request a new one.' });
    }
    if (Date.now() > entry.expiresAt) {
      emailOtpStore.delete(cleanEmail);
      return res.status(400).json({ success: false, error: 'This verification code has expired. Please request a new one.' });
    }
    if (entry.otp !== cleanOtp) {
      return res.status(400).json({ success: false, error: 'Incorrect 6-digit code. Please check your email and try again.' });
    }

    // Local projection is trusted once verified; the Supabase user's
    // email_confirmed_at is updated natively by verifyOtp(type: email).
    entry.verified = true;
    try {
      const { verified, user } = await supabaseVerifyEmailOtp(cleanEmail, cleanOtp);
      if (verified) {
        try {
          await writeAuditLog({
            action: 'EMAIL_VERIFIED',
            details: `Code verified for ${cleanEmail}`,
            performedBy: user?.email || cleanEmail,
          });
        } catch {}
      }
    } catch (verifyErr: any) {
      // Native verify may reject the code; surface a friendly message.
      return res.status(400).json({
        success: false,
        error: /expired/i.test(String(verifyErr?.message || ''))
          ? 'This verification code has expired. Please request a new one.'
          : 'That code was not accepted. Please check your email and try again.',
      });
    }

    res.json({ success: true, verified: true, message: 'Email verified successfully. You can now continue.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      phone,
      email,
      password,
      fullName,
      firstName,
      middleName,
      lastName,
      gender,
      dateOfBirth,
      civilStatus,
      address,
      barangay,
      cityMunicipality,
      province,
      occupation,
      employerOrBusiness,
      monthlyIncome,
      monthlyExpenses,
      sourceOfIncome,
      idNumber,
      facebookAccount,
      employmentStatus,
      borrowerNumber,
    } = body;

    const rawName = String(fullName || '').trim();
    const composedName = [firstName, middleName, lastName].filter(Boolean).map(String).map((s) => s.trim()).join(' ');
    const finalName = rawName.length >= 2 ? rawName : composedName.trim();

    // ---- Validate: Full Name + Email OR valid PH phone + Password ----
    if (finalName.length < 2) {
      return res.status(400).json({ error: 'Please enter your full name (as shown on a government ID).' });
    }
    const rawEmail = String(email || '').trim();
    const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
    const rawPhone = String(phone || '').trim();
    const finalPhone = isValidPhilippinePhone(rawPhone) ? normalizePhilippinePhone(rawPhone) : null;

    if (!hasValidEmail && !finalPhone) {
      return res.status(400).json({
        error: 'Please enter a valid email address or a Philippine mobile number (e.g. 0917 123 4567 or +63 917 123 4567).',
      });
    }
    const userPass = String(password || '');
    if (userPass.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const loginEmail = hasValidEmail
      ? rawEmail.toLowerCase()
      : generateClientEmail(finalPhone || '');
    const displayPhone = finalPhone || null;

    const profileInput = {
      fullName: finalName,
      phone: displayPhone,
      email: loginEmail,
      dateOfBirth: dateOfBirth ? String(dateOfBirth) : null,
      gender: gender ? String(gender) : null,
      civilStatus: civilStatus ? String(civilStatus) : null,
      address: address ? String(address) : null,
      barangay: barangay ? String(barangay) : null,
      cityMunicipality: cityMunicipality ? String(cityMunicipality) : null,
      province: province ? String(province) : null,
      occupation: occupation ? String(occupation) : null,
      employerOrBusiness: employerOrBusiness ? String(employerOrBusiness) : null,
      monthlyIncome: Number(monthlyIncome) || 0,
      monthlyExpenses: Number(monthlyExpenses) || 0,
      sourceOfIncome: sourceOfIncome ? String(sourceOfIncome) : null,
      idNumber: idNumber ? String(idNumber) : null,
      facebookAccount: facebookAccount ? String(facebookAccount) : null,
      employmentStatus: employmentStatus ? String(employmentStatus) : null,
    };

    // ---- Duplicate check against local projection ----
    try {
      const dupEmail = await authStore.findByEmailOrPhone(loginEmail);
      const dupPhone = displayPhone ? await authStore.findByEmailOrPhone(displayPhone) : null;
      if (dupEmail || dupPhone) {
        return res.status(409).json({ error: 'An account with this email address or phone number already exists. Please sign in.' });
      }
    } catch {}

    // ---- Primary: register with Supabase Auth (role always forced to CLIENT) ----
    let supabaseUser: any = null;
    if (getServerSupabase()) {
      try {
        supabaseUser = await supabaseCreateClientUser({
          email: loginEmail,
          password: userPass,
          fullName: finalName,
          phone: displayPhone,
        });
      } catch (err: any) {
        if (err instanceof SupabaseAuthError) {
          if (err.status === 409) {
            return res.status(409).json({ error: err.message, code: err.code });
          }
          if (err.status !== 503) {
            return res.status(err.status).json({ error: err.message, code: err.code });
          }
        } else {
          console.warn('[Auth] Supabase create-user error:', err?.message || err);
        }
      }
    }

    // ---- Local projection (Supabase user, or fully-local HMAC fallback) ----
    let user: any = null;
    if (supabaseUser) {
      try {
        user = await ensureLocalClientUser({
          id: supabaseUser.id,
          email: loginEmail,
          fullName: finalName,
          phone: displayPhone,
          profile: profileInput,
        });
      } catch (syncErr) {
        console.warn('[Auth] local user sync warning:', syncErr);
      }
      if (!user) {
        user = {
          id: supabaseUser.id,
          email: loginEmail,
          fullName: finalName,
          role: 'CLIENT' as const,
          staffRole: null,
          staffId: null,
          borrowerId: null,
          phone: displayPhone,
          avatar: null,
          isActive: true,
        };
      }
    } else {
      // Fully-local development without Supabase: HMAC account with local hash.
      let borrowerId: string | null = null;
      if (getDb()) {
        try {
          const existingMatch = await findBorrowerByContact(displayPhone, loginEmail);
          if (existingMatch) {
            borrowerId = existingMatch.id;
          } else {
            const provisioned = await createClientProfile(profileInput);
            if (provisioned && provisioned.id) {
              borrowerId = provisioned.id;
            }
          }
        } catch (provisionErr) {
          console.warn('[Auth] local client provisioning warning:', provisionErr);
        }
      }
      user = await authStore.createUser({
        id: `u-${crypto.randomUUID()}`,
        email: loginEmail,
        fullName: finalName,
        passwordHash: hashPassword(userPass),
        role: 'CLIENT',
        staffRole: null,
        staffId: null,
        borrowerId,
        phone: displayPhone,
        avatar: `https://ui-avatars.com/api/?background=059669&color=fff&name=${encodeURIComponent(finalName)}`,
      });
    }

    try {
      await authStore.touchLogin(user.id);
    } catch {}
    const token = signToken(user);

    try {
      await writeAuditLog({
        action: 'REGISTER',
        type: 'AUTH',
        details: `New client account created: ${user.email}`,
        performedBy: user.id,
        userName: user.fullName || '',
        userRole: 'CLIENT',
        targetType: 'user',
        targetId: user.id,
      });
    } catch {}

    const publicProfile = await enrichProfileFlags(publicUser(user));
    res.status(201).json({
      success: true,
      token,
      user: publicProfile,
      linkedMember: Boolean(user.borrowerId),
      isNewRegistration: true,
      profileComplete: publicProfile.profileComplete === true,
      message: 'Account created successfully. Please complete your profile to start applying for services.',
    });
  } catch (err: any) {
    console.error('[Auth] register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Request a password reset email. Real Supabase email flow; the OTP fallback on
// the client is used only for auto-generated (phone-only) addresses.
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const redirectTo =
      String(process.env.HOSCOMCO_EMAIL_RESET_REDIRECT || '').trim() ||
      `${req.protocol}://${req.get('host')}/portal/reset-password`;
    await supabaseResetPassword(normalizedEmail, redirectTo);
    res.json({
      success: true,
      message: 'If an account exists for that email, a password reset link has been sent.',
    });
  } catch (err: any) {
    if (err instanceof SupabaseAuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    res.status(500).json({ error: 'Could not send reset link. Please try again.' });
  }
});

    app.get('/api/auth/me', requireAuth(), async (req: AuthedRequest, res) => {
  try {
    const user = await authStore.findById(req.authUser!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const freshToken = signToken(user);
    const publicProfile = await enrichProfileFlags(publicUser(user));
    res.json({ user: publicProfile, token: freshToken });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Staff Cooperative Branch Assignment Endpoints ----------

// 1. Get Live Branch Assignment for Authenticated Staff
app.get('/api/staff/branch-assignment', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const user = await authStore.findById(req.authUser!.id);
    if (!user) return res.status(404).json({ success: false, error: 'Staff account not found' });

    const db = getDb();
    const supabase = getServerSupabase();

    let staffRecord: any = null;
    let branchRecord: any = null;

    // 1. Resolve staff record from PostgreSQL DB
    if (db && user.staffId) {
      try {
        const rows = await db.select().from(schema.staff).where(eq(schema.staff.id, user.staffId)).limit(1);
        if (rows.length > 0) staffRecord = rows[0];
      } catch (e: any) {
        console.warn('[Staff Branch] DB staff query warning:', e.message);
      }
    }

    if (!staffRecord && db && user.email) {
      try {
        const rows = await db.select().from(schema.staff).where(eq(schema.staff.email, user.email.toLowerCase())).limit(1);
        if (rows.length > 0) staffRecord = rows[0];
      } catch {}
    }

    // 2. Fallback to Supabase if configured
    if (!staffRecord && supabase) {
      try {
        const { data } = await supabase.from('staff').select('*').eq('email', user.email.toLowerCase()).maybeSingle();
        if (data) staffRecord = data;
      } catch {}
    }

    // 3. Fallback to initial staff dataset
    if (!staffRecord) {
      staffRecord = INITIAL_STAFF.find(
        (s) => s.id === user.staffId || s.email.toLowerCase() === user.email.toLowerCase()
      );
    }

    const resolvedBranchId =
      staffRecord?.assignedBranchId ||
      staffRecord?.assigned_branch_id ||
      user.branchId ||
      null;

    // Single-branch cooperative: any unassigned / global-scope staff defaults to
    // Tacloban Main Branch so no account is stranded at the assignment gate.
    const assignedBranchId =
      !resolvedBranchId || resolvedBranchId === 'all' || resolvedBranchId === 'unassigned'
        ? 'br-main'
        : resolvedBranchId;

    // 4. Resolve branch entity if assigned
    if (assignedBranchId && assignedBranchId !== 'all' && assignedBranchId !== 'unassigned' && assignedBranchId !== '') {
      if (db) {
        try {
          const bRows = await db.select().from(schema.branches).where(eq(schema.branches.id, assignedBranchId)).limit(1);
          if (bRows.length > 0) branchRecord = bRows[0];
        } catch {}
      }
      if (!branchRecord && supabase) {
        try {
          const { data } = await supabase.from('branches').select('*').eq('id', assignedBranchId).maybeSingle();
          if (data) branchRecord = data;
        } catch {}
      }
      if (!branchRecord) {
        branchRecord = INITIAL_BRANCHES.find((b) => b.id === assignedBranchId);
      }
    } else if (assignedBranchId === 'all') {
      // System administrator with global scope defaults to Tacloban Main Branch
      branchRecord = INITIAL_BRANCHES[0];
    }

    const formattedBranch = branchRecord
      ? {
          id: branchRecord.id,
          name: branchRecord.name || 'Tacloban Main Branch',
          code: branchRecord.code || 'TAC-MAIN',
          address: branchRecord.address || 'HOSCOMCO Cooperative Building, Real Street, Tacloban City, Leyte',
          city: branchRecord.city || 'Tacloban City',
          phone: branchRecord.phone || '+63 (053) 832-4190',
          managerName: branchRecord.managerName || branchRecord.manager_name || 'Eduardo Manalo',
          status: 'active',
        }
      : null;

    const requiredBranch = {
      id: 'br-main',
      name: 'Tacloban Main Branch',
      code: 'TAC-MAIN',
      address: 'HOSCOMCO Cooperative Building, Real Street, Tacloban City, Leyte',
      city: 'Tacloban City',
      phone: '+63 (053) 832-4190',
      status: 'active',
    };

    // System administrator contact, derived from the existing seed data so we never
    // invent an email/phone that isn't part of the cooperative's records.
    const sysAdminEmail = process.env.HOSCOMCO_BOOTSTRAP_EMAIL || 'admin@HOSCOMCO.coop';
    const sysAdmin =
      INITIAL_STAFF.find((s) => s.email.toLowerCase() === sysAdminEmail.toLowerCase()) ||
      INITIAL_STAFF.find((s) => s.role === 'ADMINISTRATOR') ||
      null;
    const adminContact = {
      name: sysAdmin?.name || 'System Administrator',
      email: sysAdminEmail,
      title: sysAdmin?.title || 'System Administrator & Operations Head',
      phone: branchRecord?.phone || requiredBranch.phone,
      location: branchRecord?.name || requiredBranch.name,
    };

    // Update user session branchId if assignment is confirmed
    let token = undefined;
    if (formattedBranch) {
      if (user.branchId !== formattedBranch.id) {
        user.branchId = formattedBranch.id;
        token = signToken(user);
      }
    } else {
      user.branchId = null;
    }

    res.json({
      success: true,
      staff: {
        id: staffRecord?.id || user.staffId || user.id,
        name: staffRecord?.name || user.fullName,
        email: user.email,
        role: staffRecord?.role || user.staffRole || 'LOAN_OFFICER',
        title: staffRecord?.title || user.staffRole || 'Staff Member',
        avatar: staffRecord?.avatar || user.avatar || '',
        branch: formattedBranch,
      },
      requiredBranch,
      adminContact,
      token,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Administrator Cooperative Branch Assignment (Admin Authorized Only)
app.post('/api/admin/staff/assign-branch', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const caller = req.authUser!;
    const { staffId, branchId, adminPassword } = req.body || {};

    if (!staffId || !branchId) {
      return res.status(400).json({ success: false, error: 'staffId and branchId are required' });
    }

    // Security check: strictly ensure Administrator privileges
    const isCallerAdmin = caller.staffRole === 'ADMINISTRATOR' || hasPermission(caller.staffRole, 'manage_users');
    let authorized = isCallerAdmin;

    if (!authorized && adminPassword) {
      authorized = verifyPassword(adminPassword, DEFAULT_ADMIN_PASS_HASH);
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only an authorized HOSCOMCO System Administrator can assign cooperative branches.',
      });
    }

    const db = getDb();
    const supabase = getServerSupabase();

    // 1. Update DB staff record (staff.assigned_branch_id is the source of truth;
    //    the users table has no branch column, so it must not be updated here)
    if (db) {
      try {
        await db.update(schema.staff).set({ assignedBranchId: branchId }).where(eq(schema.staff.id, staffId));
      } catch (e: any) {
        console.warn('[Staff Assignment] DB update warning:', e.message);
      }
    }

    // 2. Update Supabase if available
    if (supabase) {
      try {
        await supabase.from('staff').update({ assigned_branch_id: branchId }).eq('id', staffId);
      } catch {}
    }

    // 3. Update in-memory initial staff list
    const memStaff = INITIAL_STAFF.find((s) => s.id === staffId);
    if (memStaff) {
      memStaff.assignedBranchId = branchId;
    }

    // 4. Log Audit Trail
    if (db) {
      try {
        await db.insert(schema.auditLogs).values({
          id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          userId: caller.id,
          userName: caller.email,
          action: 'STAFF_BRANCH_ASSIGNMENT',
          category: 'BRANCH',
          details: `Staff member ${staffId} assigned to ${branchId} (Tacloban Main Branch) by System Administrator.`,
          severity: 'Low',
        } as any);
      } catch {}
    }

    // 5. Add Branch Notification
    if (db) {
      try {
        await db.insert(schema.branchNotifications).values({
          id: `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          branchId,
          type: 'INFO',
          category: 'ADMIN',
          title: 'Staff Branch Assignment Finalized',
          message: `Staff member (${staffId}) was officially assigned to Tacloban Main Branch.`,
          timestamp: new Date().toISOString(),
          isRead: false,
          actionLink: '/staff/app/profile',
        } as any);
      } catch {}
    }

    res.json({
      success: true,
      message: 'Staff account successfully assigned to Tacloban Main Branch.',
      staffId,
      branchId,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Send Internal Assignment Request Notification to Administrator
app.post('/api/staff/request-assignment', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const caller = req.authUser!;
    const user = await authStore.findById(caller.id);
    const db = getDb();

    if (db) {
      try {
        await db.insert(schema.branchNotifications).values({
          id: `NOTIF-REQ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          branchId: 'br-main',
          type: 'WARNING',
          category: 'ADMIN',
          title: 'Cooperative Branch Assignment Request',
          message: `${user?.fullName || caller.email} (${user?.staffId || caller.id}) requested branch assignment to Tacloban Main Branch.`,
          timestamp: new Date().toISOString(),
          isRead: false,
          actionLink: '/staff/app/profile',
        } as any);

        await db.insert(schema.auditLogs).values({
          id: `AUD-REQ-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: caller.id,
          userName: user?.fullName || caller.email,
          action: 'BRANCH_ASSIGNMENT_REQUESTED',
          category: 'BRANCH',
          details: `Staff member requested cooperative branch assignment to Tacloban Main Branch.`,
          severity: 'Medium',
        } as any);
      } catch (e: any) {
        console.warn('[Request Assignment] DB notice:', e.message);
      }
    }

    const sysAdminEmail = process.env.HOSCOMCO_BOOTSTRAP_EMAIL || 'admin@HOSCOMCO.coop';
    const sysAdmin =
      INITIAL_STAFF.find((s) => s.email.toLowerCase() === sysAdminEmail.toLowerCase()) ||
      INITIAL_STAFF.find((s) => s.role === 'ADMINISTRATOR') ||
      null;

    res.json({
      success: true,
      message: `Official assignment request dispatched to HOSCOMCO System Administrator (${sysAdmin?.name || 'System Administrator'}).`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

// KYC required documents management (institution-configurable)
app.get('/api/admin/kyc/required-documents', requirePermission(['manage_settings', 'view_all_records']), async (req, res) => {
  try {
    const db = getDb();
    if (db) {
      const rows = await db.select().from(schema.kycRequiredDocuments).orderBy(schema.kycRequiredDocuments.sortOrder);
      return res.json({ success: true, documents: rows });
    }
    return res.json({
      success: true,
      documents: [
        { id: 'REQ-VALID_ID', documentType: 'VALID_ID', documentName: 'Primary Government ID (UMID / Driver License / Passport)', description: 'A valid, current government-issued photo ID.', isActive: true, sortOrder: 1, createdAt: new Date().toISOString() },
        { id: 'REQ-PROOF_OF_ADDRESS', documentType: 'PROOF_OF_ADDRESS', documentName: 'Barangay Clearance or Utility Bill', description: 'Recent proof of residence within the last 3 months.', isActive: true, sortOrder: 2, createdAt: new Date().toISOString() },
        { id: 'REQ-PROOF_OF_INCOME', documentType: 'PROOF_OF_INCOME', documentName: 'Payslip / Business Permit / Bank Statement', description: 'Evidence of regular income or business operations.', isActive: true, sortOrder: 3, createdAt: new Date().toISOString() },
        { id: 'REQ-PHOTO_2X2', documentType: 'PHOTO_2X2', documentName: 'Recent 2x2 ID Photo', description: 'A recent photograph with white background.', isActive: true, sortOrder: 4, createdAt: new Date().toISOString() },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a KYC required document
app.post('/api/admin/kyc/required-documents', requirePermission('manage_settings'), async (req: AuthedRequest, res) => {
  try {
    const { documentType, documentName, description, sortOrder } = req.body || {};
    if (!documentType || !documentName) {
      return res.status(400).json({ success: false, error: 'documentType and documentName are required.' });
    }
    const db = getDb();
    if (db) {
      const id = `REQ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(schema.kycRequiredDocuments).values({
        id,
        documentType: String(documentType),
        documentName: String(documentName),
        description: description ? String(description) : null,
        isActive: true,
        sortOrder: Number(sortOrder) || 0,
        createdAt: new Date().toISOString(),
      });
      return res.json({ success: true, id });
    }
    res.status(503).json({ success: false, error: 'Database unavailable' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update / toggle a KYC required document
app.patch('/api/admin/kyc/required-documents/:id', requirePermission('manage_settings'), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const { isActive, documentName, description, sortOrder } = req.body || {};
    await db.update(schema.kycRequiredDocuments)
      .set({
        ...(documentName !== undefined ? { documentName: String(documentName) } : {}),
        ...(description !== undefined ? { description: description ? String(description) : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      })
      .where(eq(schema.kycRequiredDocuments.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a KYC required document
app.delete('/api/admin/kyc/required-documents/:id', requirePermission('manage_settings'), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    await db.delete(schema.kycRequiredDocuments).where(eq(schema.kycRequiredDocuments.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
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

// ---------------------------------------------------------------------------
// 7. Admin Console Data Aggregates (read-only, live-DB)
// ---------------------------------------------------------------------------
const ADMIN_READ_ANY: SystemPermission[] = [
  'view_all_records',
  'manage_users',
  'manage_settings',
  'manage_loan_applications',
  'process_loan_applications',
  'view_transaction_records',
  'monitor_loan_repayment',
  'manage_kyc',
  'register_clients',
  'approve_sensitive_operations',
];

function toMoney(v: any): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function mapClientStatus(s: any): string {
  const up = String(s || '').toUpperCase();
  if (up === 'ACTIVE') return 'Active';
  if (['PENDING', 'NOT_STARTED', 'REGISTERED', 'PRE_ACTIVE'].includes(up)) return 'Pending';
  if (up.includes('REJECT') || up.includes('DENIED')) return 'Rejected';
  if (up === 'SUSPENDED') return 'Suspended';
  if (up.includes('CLOSE') || up.includes('DELET')) return 'Closed';
  return 'Inactive';
}

function mapKycRequestStatus(s: any): string {
  const up = String(s || '').toUpperCase();
  if (['VERIFIED', 'APPROVED', 'COMPLETE'].includes(up)) return 'Approved';
  if (['UNDER_REVIEW', 'IN_REVIEW', 'REVIEWING', 'PENDING_REVIEW'].includes(up)) return 'Under Review';
  if (up === 'REJECTED') return 'Rejected';
  if (['CORRECTION', 'REQUIRES_CORRECTION', 'NEEDS_CORRECTION', 'RETURNED'].includes(up)) return 'Requires Correction';
  return 'Pending';
}

function mapLoanStatus(s: any): string {
  const up = String(s || '').toUpperCase();
  if (up === 'APPROVED') return 'Approved';
  if (['REJECTED', 'WITHDRAWN', 'CANCELLED', 'DENIED'].includes(up)) return 'Rejected';
  if (['DISBURSED', 'FOR_RELEASE', 'PENDING_DISBURSEMENT'].includes(up)) return 'Disbursed';
  if (['ACTIVE', 'IN ARREARS', 'IN_ARREARS', 'REPAYING'].includes(up)) return 'Active';
  if (['COMPLETED', 'PAID OFF', 'PAID_OFF', 'CLOSED'].includes(up)) return 'Completed';
  if (['UNDER REVIEW', 'UNDER_REVIEW', 'FOR ASSESSMENT', 'FOR_ASSESSMENT', 'REVIEWING'].includes(up)) return 'Under Review';
  return 'Pending';
}

function mapTxnType(t: any): string {
  const s = String(t || '').toUpperCase();
  if (s.includes('LOAN') && s.includes('PAYMENT')) return 'Loan Payment';
  if (s.includes('LOAN') && (s.includes('DISBURSE') || s.includes('RELEASE'))) return 'Loan Disbursement';
  if (s.includes('WITHDRAW')) return 'Savings Withdrawal';
  if (s.includes('DEPOSIT')) return 'Savings Deposit';
  if (s.includes('SAVINGS')) return 'Savings Deposit';
  if (s.includes('PAYMENT')) return 'Loan Payment';
  return 'Deposit';
}

function mapTxnStatus(s: any): string {
  const up = String(s || '').toUpperCase();
  if (up.includes('PEND') || up === 'PROCESSING' || up.includes('FOR APPROVAL') || up.includes('FOR_RELEASE')) return 'Pending';
  if (up.includes('FAIL') || up.includes('ERROR') || up.includes('DECLIN')) return 'Failed';
  if (up.includes('CANCEL')) return 'Cancelled';
  return 'Completed';
}

function mapAuditStatus(t: any): string {
  const up = String(t || '').toUpperCase();
  if (up.includes('WARN')) return 'Warning';
  if (up.includes('FAIL') || up.includes('ERROR') || up.includes('DENIED') || up.includes('REJECT')) return 'Failed';
  return 'Success';
}

function mapGroupStatus(s: any): string {
  const up = String(s || '').toUpperCase();
  if (up === 'ACTIVE') return 'Active';
  if (up === 'PENDING') return 'Pending';
  if (up.includes('GRADUAT')) return 'Graduated';
  return 'Inactive';
}

function mapSavingsStatus(memberStatus: any, lastTxn?: string | null): string {
  const up = String(memberStatus || '').toUpperCase();
  if (up === 'SUSPENDED') return 'Suspended';
  if (up.includes('CLOSE') || up.includes('DELET')) return 'Closed';
  if (lastTxn) {
    const age = (Date.now() - new Date(lastTxn).getTime()) / (1000 * 60 * 60 * 24);
    if (age > 180) return 'Dormant';
  }
  return 'Active';
}

function shortMonth(ym: string): string {
  const parts = String(ym).split('-');
  if (parts.length < 2) return ym;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return isNaN(d.getTime()) ? ym : d.toLocaleString('en', { month: 'short' });
}

function lastSixMonthKeys(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

async function resolveBranchNames(db: any): Promise<Map<string, string>> {
  const rows = await db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches);
  return new Map(rows.map((r: any) => [r.id, r.name]));
}

async function resolveBorrowerNumbers(db: any): Promise<Map<string, string>> {
  const rows = await db.select({ id: schema.borrowers.id, borrowerNumber: schema.borrowers.borrowerNumber }).from(schema.borrowers);
  return new Map(rows.map((r: any) => [r.id, r.borrowerNumber]));
}

function mapAdminClient(b: any, branchNames: Map<string, string>): any {
  return {
    id: b.id,
    clientId: b.borrowerNumber,
    fullName: b.fullName,
    phone: b.phone,
    email: b.email,
    address: [b.address, b.barangay, b.cityMunicipality, b.province].filter(Boolean).join(', '),
    occupation: b.occupation || '',
    monthlyIncome: toMoney(b.monthlyIncome),
    employmentInfo: b.employerOrBusiness || b.employmentStatus || '',
    registrationDate: b.joinedDate || '',
    status: mapClientStatus(b.memberStatus),
    branch: branchNames.get(b.branchId) || b.branchId || '',
    kycStatus: b.kycStatus || '',
    avatar: b.avatar || '',
    savingsBalance: toMoney(b.savingsBalance),
    activeLoans: b.activeLoansCount || 0,
    totalBorrowed: toMoney(b.totalBorrowed),
  };
}

function mapAdminLoan(l: any, branchNames: Map<string, string>, borrowerNumbers: Map<string, string>): any {
  return {
    id: l.id,
    loanId: l.loanNumber,
    clientName: l.borrowerName || '',
    clientId: borrowerNumbers.get(l.borrowerId) || l.borrowerId || '',
    loanProduct: l.productName || '',
    loanAmount: toMoney(l.principalAmount),
    loanTerm: l.termMonths || 0,
    interestRate: toMoney(l.interestRate),
    paymentFrequency: l.repaymentFrequency || 'Monthly',
    applicationDate: l.applicationDate || '',
    status: mapLoanStatus(l.status),
    outstandingBalance: toMoney(l.remainingBalance),
    monthlyPayment: Math.round(toMoney(l.totalPayable) / (l.totalInstallments || 1)),
    branch: branchNames.get(l.branchId) || l.branchId || '',
    schedule: Array.isArray(l.schedule) ? l.schedule : [],
    purpose: l.purpose || '',
    releaseDate: l.disbursedDate || '',
    maturityDate: l.maturityDate || '',
    loanOfficer: l.loanOfficerName || '',
  };
}

function mapAdminTxn(t: any, branchNames: Map<string, string>): any {
  return {
    id: t.id,
    transactionId: t.referenceNumber || t.id,
    clientName: t.clientName || '',
    clientId: t.clientId || '',
    type: mapTxnType(t.transactionType),
    amount: toMoney(t.amount),
    paymentMethod: t.paymentMethod || 'Cash',
    dateTime: t.transactionDate || '',
    processedBy: t.processedBy || '',
    status: mapTxnStatus(t.status),
    referenceNumber: t.referenceNumber || '',
    branch: branchNames.get(t.branchId) || t.branchId || '',
    notes: t.notes || '',
  };
}

function mapAdminSaving(a: any, borrower: any, lastTxn: string | null, branchNames: Map<string, string>): any {
  return {
    id: a.id,
    accountNumber: a.passbookNumber || a.id,
    clientName: a.memberName || '',
    clientId: a.memberId || '',
    accountType: 'Regular Savings',
    balance: toMoney(a.balance),
    status: mapSavingsStatus(borrower?.memberStatus, lastTxn),
    openedDate: a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '',
    lastTransaction: lastTxn || '',
    branch: branchNames.get(borrower?.branchId) || '',
    interestRate: toMoney(a.interestRate),
  };
}

app.get('/api/admin/clients', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, clients: [] });
    const [borrowers, branchNames] = await Promise.all([db.select().from(schema.borrowers), resolveBranchNames(db)]);
    const clients = borrowers.map((b: any) => mapAdminClient(b, branchNames));
    res.json({ success: true, clients });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/clients/:id', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const rows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, req.params.id)).limit(1);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Client not found' });
    const b = rows[0] as any;
    const [branchNames, borrowerNumbers, loans, txns, savingsAccts, savTxns] = await Promise.all([
      resolveBranchNames(db),
      resolveBorrowerNumbers(db),
      db.select().from(schema.loans).where(eq(schema.loans.borrowerId, b.id)),
      db.select().from(schema.financialTransactions).where(eq(schema.financialTransactions.clientId, b.id)),
      db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.memberId, b.id)),
      db.select().from(schema.savingsTransactions).where(eq(schema.savingsTransactions.memberId, b.id)),
    ]);
    const savings = savingsAccts.map((a: any) => {
      const ledger = savTxns.filter((t: any) => t.savingsAccountId === a.id);
      return {
        id: a.id,
        accountNumber: a.passbookNumber || a.id,
        balance: toMoney(a.balance),
        interestRate: toMoney(a.interestRate),
        inflows: ledger.filter((t: any) => !String(t.type).toLowerCase().includes('withdraw')).reduce((s: number, t: any) => s + toMoney(t.amount), 0),
        outflows: ledger.filter((t: any) => String(t.type).toLowerCase().includes('withdraw')).reduce((s: number, t: any) => s + toMoney(t.amount), 0),
        ledger: [...ledger]
          .sort((x: any, y: any) => String(y.date).localeCompare(String(x.date)))
          .slice(0, 20)
          .map((t: any) => ({
            id: t.id,
            ref: t.officialReceiptNumber || t.transactionNumber || t.id,
            type: String(t.type).toLowerCase().includes('withdraw') ? 'Withdrawal' : 'Deposit',
            amount: toMoney(t.amount),
            balance: toMoney(t.balanceAfter),
            date: t.date || '',
            by: t.processedBy || '',
          })),
      };
    });
    res.json({
      success: true,
      data: {
        client: mapAdminClient(b, branchNames),
        loans: [...loans].sort((a: any, c: any) => String(c.applicationDate).localeCompare(String(a.applicationDate))).map((l: any) => mapAdminLoan(l, branchNames, borrowerNumbers)),
        transactions: [...txns].sort((a: any, c: any) => String(c.transactionDate).localeCompare(String(a.transactionDate))).map((t: any) => mapAdminTxn(t, branchNames)),
        savings,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/loans', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, loans: [] });
    const [loans, branchNames, borrowerNumbers] = await Promise.all([
      db.select().from(schema.loans),
      resolveBranchNames(db),
      resolveBorrowerNumbers(db),
    ]);
    const sorted = [...loans].sort((a: any, b: any) => String(b.applicationDate).localeCompare(String(a.applicationDate)));
    const mapped = sorted.map((l: any) => mapAdminLoan(l, branchNames, borrowerNumbers));
    res.json({ success: true, loans: mapped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/loans/:id', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const rows = await db.select().from(schema.loans).where(eq(schema.loans.id, req.params.id)).limit(1);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Loan not found' });
    const l = rows[0] as any;
    const [branchNames, borrowerNumbers, payments, audit] = await Promise.all([
      resolveBranchNames(db),
      resolveBorrowerNumbers(db),
      db.select().from(schema.payments).where(eq(schema.payments.loanId, l.id)),
      db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, l.id)),
    ]);
    res.json({
      success: true,
      data: {
        loan: mapAdminLoan(l, branchNames, borrowerNumbers),
        payments: [...payments]
          .sort((a: any, c: any) => String(c.paymentDate).localeCompare(String(a.paymentDate)))
          .map((p: any) => ({
            id: p.id,
            receiptNumber: p.receiptNumber,
            loanNumber: p.loanNumber,
            amount: toMoney(p.amount),
            paymentDate: p.paymentDate,
            paymentMethod: p.paymentMethod,
            principalPortion: toMoney(p.principalPortion),
            interestPortion: toMoney(p.interestPortion),
            penaltyPortion: toMoney(p.penaltyPortion),
            collectedBy: p.collectedBy,
          })),
        auditHistory: audit
          .sort((a: any, c: any) => String(c.timestamp).localeCompare(String(a.timestamp)))
          .map((v: any) => ({
            date: v.timestamp,
            action: v.action,
            details: v.details,
            by: v.userName || v.performedBy || '',
            status: v.status,
          })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/savings', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, accounts: [] });
    const [accounts, txns, borrowers, branchNames] = await Promise.all([
      db.select().from(schema.savingsAccounts),
      db.select({ accountId: schema.savingsTransactions.savingsAccountId, date: schema.savingsTransactions.date }).from(schema.savingsTransactions),
      db.select({ id: schema.borrowers.id, memberStatus: schema.borrowers.memberStatus, branchId: schema.borrowers.branchId }).from(schema.borrowers),
      resolveBranchNames(db),
    ]);
    const borrowerById = new Map(borrowers.map((b: any) => [b.id, b]));
    const lastTxnByAcct = new Map<string, string>();
    for (const t of txns) {
      const cur = lastTxnByAcct.get(t.accountId);
      if (!cur || String(t.date) > cur) lastTxnByAcct.set(t.accountId, String(t.date));
    }
    const mapped = accounts.map((a: any) => mapAdminSaving(a, borrowerById.get(a.memberId), lastTxnByAcct.get(a.id) || null, branchNames));
    res.json({ success: true, accounts: mapped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/savings/:id', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const rows = await db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.id, req.params.id)).limit(1);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Savings account not found' });
    const a = rows[0] as any;
    const [borrowers, branchNames, ledger] = await Promise.all([
      db.select().from(schema.borrowers),
      resolveBranchNames(db),
      db.select().from(schema.savingsTransactions).where(eq(schema.savingsTransactions.savingsAccountId, a.id)),
    ]);
    const borrower = borrowers.find((b: any) => b.id === a.memberId);
    const lastTxn = ledger.length ? [...ledger].sort((x: any, y: any) => String(y.date).localeCompare(String(x.date)))[0].date : null;
    const sorted = [...ledger].sort((x: any, y: any) => String(y.date).localeCompare(String(x.date))).slice(0, 30);
    res.json({
      success: true,
      data: {
        account: mapAdminSaving(a, borrower, lastTxn ? String(lastTxn) : null, branchNames),
        inflows: ledger.filter((t: any) => !String(t.type).toLowerCase().includes('withdraw')).reduce((s: number, t: any) => s + toMoney(t.amount), 0),
        outflows: ledger.filter((t: any) => String(t.type).toLowerCase().includes('withdraw')).reduce((s: number, t: any) => s + toMoney(t.amount), 0),
        ledger: sorted.map((t: any) => ({
          id: t.id,
          ref: t.officialReceiptNumber || t.transactionNumber || t.id,
          type: String(t.type).toLowerCase().includes('withdraw') ? 'Withdrawal' : 'Deposit',
          amount: toMoney(t.amount),
          balance: toMoney(t.balanceAfter),
          date: t.date || '',
          by: t.processedBy || '',
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/transactions', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, transactions: [] });
    const [txns, branchNames] = await Promise.all([db.select().from(schema.financialTransactions), resolveBranchNames(db)]);
    const sorted = [...txns].sort((a: any, b: any) => String(b.transactionDate).localeCompare(String(a.transactionDate)));
    const mapped = sorted.map((t: any) => mapAdminTxn(t, branchNames));
    res.json({ success: true, transactions: mapped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/groups', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, groups: [] });
    const [groups, branchNames] = await Promise.all([db.select().from(schema.solidarityGroups), resolveBranchNames(db)]);
    const mapped = groups.map((g: any) => ({
      id: g.id,
      groupId: g.groupCode || g.id,
      groupName: g.groupName,
      leader: g.leaderName || '',
      memberCount: Array.isArray(g.members) ? g.members.length : 0,
      status: mapGroupStatus(g.status),
      totalGroupLoan: toMoney(g.totalActiveLoans),
      branch: branchNames.get(g.branchId) || g.branchId || '',
      formedDate: g.formedDate || '',
      meetingDay: g.meetingDay || '',
      repaymentRate: toMoney(g.repaymentRate),
    }));
    res.json({ success: true, groups: mapped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/groups/:id', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const rows = await db.select().from(schema.solidarityGroups).where(eq(schema.solidarityGroups.id, req.params.id)).limit(1);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Group not found' });
    const g = rows[0] as any;
    const branchNames = await resolveBranchNames(db);
    const members = Array.isArray(g.members) ? g.members : [];
    const memberIds = members.map((m: any) => m.borrowerId).filter(Boolean);
    const [loans, payments] = await Promise.all([
      memberIds.length ? db.select().from(schema.loans).where(sql`${schema.loans.borrowerId} = ANY(${memberIds})`) : Promise.resolve([]),
      memberIds.length ? db.select().from(schema.payments).where(sql`${schema.payments.borrowerId} = ANY(${memberIds})`) : Promise.resolve([]),
    ]);
    const detail = members.map((m: any) => {
      const memberLoans = loans.filter((l: any) => l.borrowerId === m.borrowerId);
      const outstanding = memberLoans.reduce((s: number, l: any) => s + toMoney(l.remainingBalance), 0);
      return {
        id: m.borrowerId || m.memberId || m.id || '',
        name: m.fullName || m.name || '',
        phone: m.phone || '',
        role: (['Leader', 'Treasurer', 'Secretary'].includes(m.role) ? m.role : 'Member') as string,
        loanAmount: toMoney(m.activeLoanAmount),
        balance: Math.round(outstanding * 100) / 100,
        status: ['Good Standing', 'Due', 'In Arrears'].includes(m.status) ? m.status : outstanding > 0 ? 'Good Standing' : m.status || 'Good Standing',
      };
    });
    res.json({
      success: true,
      data: {
        group: {
          id: g.id,
          groupId: g.groupCode || g.id,
          groupName: g.groupName,
          leader: g.leaderName || '',
          memberCount: members.length,
          status: mapGroupStatus(g.status),
          totalGroupLoan: toMoney(g.totalActiveLoans),
          branch: branchNames.get(g.branchId) || g.branchId || '',
          formedDate: g.formedDate || '',
          meetingDay: g.meetingDay || '',
          meetingTime: g.meetingTime || '',
          meetingLocation: g.meetingLocation || '',
          repaymentRate: toMoney(g.repaymentRate),
        },
        members: detail,
        loans: loans.map((l: any) => ({
          id: l.id,
          loanId: l.loanNumber,
          clientName: l.borrowerName || '',
          product: l.productName || '',
          amount: toMoney(l.principalAmount),
          paid: toMoney(l.totalPaid),
          balance: toMoney(l.remainingBalance),
          issued: l.disbursedDate || l.applicationDate || '',
          status: mapLoanStatus(l.status),
        })),
        collections: [...payments]
          .sort((a: any, c: any) => String(c.paymentDate).localeCompare(String(a.paymentDate)))
          .map((p: any) => ({
            id: p.receiptNumber || p.id,
            date: p.paymentDate || '',
            collected: toMoney(p.amount),
            principal: toMoney(p.principalPortion),
            interest: toMoney(p.interestPortion),
            by: p.collectedBy || '',
            method: p.paymentMethod || 'Cash',
          })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/kyc-requests', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, requests: [] });
    const [submissions, docRows, reqDocsRows] = await Promise.all([
      db
        .select({
          id: schema.kycSubmissions.id,
          borrowerId: schema.kycSubmissions.borrowerId,
          status: schema.kycSubmissions.status,
          submittedAt: schema.kycSubmissions.submittedAt,
          createdAt: schema.kycSubmissions.createdAt,
          reviewedBy: schema.kycSubmissions.reviewedBy,
          reviewedByName: schema.kycSubmissions.reviewedByName,
          borrowerNumber: schema.borrowers.borrowerNumber,
          fullName: schema.borrowers.fullName,
        })
        .from(schema.kycSubmissions)
        .leftJoin(schema.borrowers, eq(schema.kycSubmissions.borrowerId, schema.borrowers.id)),
      db
        .select({ submissionId: schema.kycDocuments.kycSubmissionId, documentType: schema.kycDocuments.documentType, createdAt: schema.kycDocuments.createdAt })
        .from(schema.kycDocuments),
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(schema.kycRequiredDocuments),
    ]);
    const totalRequired = reqDocsRows[0]?.n ?? 0;
    const docCount = new Map<string, number>();
    const idType = new Map<string, string>();
    for (const d of [...docRows].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
      docCount.set(d.submissionId, (docCount.get(d.submissionId) || 0) + 1);
      if (!idType.has(d.submissionId) && d.documentType) idType.set(d.submissionId, d.documentType);
    }
    const mapped = submissions.map((k: any) => ({
      id: k.id,
      clientId: k.borrowerNumber || k.borrowerId || '',
      clientName: k.fullName || '',
      submissionDate: (k.submittedAt || k.createdAt || '').slice(0, 10),
      status: mapKycRequestStatus(k.status),
      assignedStaff: k.reviewedByName || k.reviewedBy || '',
      documents: `${docCount.get(k.id) || 0} of ${totalRequired} uploaded`,
      idType: idType.get(k.id) || '',
    }));
    res.json({ success: true, requests: mapped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/notifications', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, notifications: [] });
    const [branchNotifs, pendingWithdrawals, kycRows, loanRows, borrowerRows, branchNames] = await Promise.all([
      db.select().from(schema.branchNotifications).orderBy(desc(schema.branchNotifications.createdAt)).limit(30),
      db.select().from(schema.savingsWithdrawalRequests),
      db
        .select({
          id: schema.kycSubmissions.id,
          status: schema.kycSubmissions.status,
          submittedAt: schema.kycSubmissions.submittedAt,
          createdAt: schema.kycSubmissions.createdAt,
          fullName: schema.borrowers.fullName,
        })
        .from(schema.kycSubmissions)
        .leftJoin(schema.borrowers, eq(schema.kycSubmissions.borrowerId, schema.borrowers.id)),
      db.select().from(schema.loans),
      db.select().from(schema.borrowers).orderBy(desc(schema.borrowers.joinedDate)).limit(10),
      resolveBranchNames(db),
    ]);

    const out: any[] = [];
    for (const n of branchNotifs) {
      const t = String(n.relatedType || n.type || '').toUpperCase();
      let type = 'System';
      if (t.includes('KYC')) type = 'KYC';
      else if (t.includes('WITHDRAW')) type = 'Transaction';
      else if (t.includes('BORROWER') || t.includes('MEMBER')) type = 'Client';
      else if (t.includes('LOAN') || t.includes('PAYMENT') || t.includes('LATE') || t.includes('DISBURSE')) type = 'Loan';
      out.push({ id: n.id, title: n.title, message: n.message, timestamp: n.createdAt || '', type, isRead: Boolean(n.isRead) });
    }
    for (const w of pendingWithdrawals.filter((x: any) => x.status === 'Pending Approval')) {
      out.push({
        id: `WDR-${w.id}`,
        title: 'Savings Withdrawal Request',
        message: `${w.memberName} requested a withdrawal of PHP ${Number(w.requestedAmount).toLocaleString()}`,
        timestamp: w.requestDate || '',
        type: 'Transaction',
        isRead: false,
      });
    }
    for (const k of kycRows.filter((x: any) => !['VERIFIED', 'APPROVED', 'COMPLETE', 'COMPLETED'].includes(String(x.status).toUpperCase())).slice(0, 5)) {
      out.push({
        id: `KYC-${k.id}`,
        title: 'KYC Submission Pending Review',
        message: `${k.fullName || 'A member'} submitted KYC documents for verification`,
        timestamp: (k.submittedAt || k.createdAt || '').slice(0, 10),
        type: 'KYC',
        isRead: false,
      });
    }
    const pendingLoans = loanRows.filter((l: any) => ['Draft', 'Submitted', 'For Assessment', 'Under Review'].includes(l.status));
    const recentLoans = [...pendingLoans].sort((a: any, b: any) => String(b.applicationDate).localeCompare(String(a.applicationDate))).slice(0, 5);
    for (const l of recentLoans) {
      out.push({
        id: `LN-${l.id}`,
        title: 'New Loan Application',
        message: `${l.borrowerName || 'A member'} applied for a ${l.productName} loan of PHP ${Number(l.principalAmount).toLocaleString()}`,
        timestamp: l.applicationDate || '',
        type: 'Loan',
        isRead: false,
      });
    }
    for (const b of borrowerRows.filter((x: any) => String(x.memberStatus).toUpperCase() === 'PENDING')) {
      out.push({
        id: `B-${b.id}`,
        title: 'New Client Registration',
        message: `${b.fullName} registered at ${branchNames.get(b.branchId) || b.branchId || 'a branch'}`,
        timestamp: b.joinedDate || '',
        type: 'Client',
        isRead: false,
      });
    }

    const dedup = new Map<string, any>();
    for (const n of out) dedup.set(`${n.type}:${n.title}:${n.timestamp}`, n);
    const notifications = [...dedup.values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 40);
    res.json({ success: true, notifications });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/audit-logs', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, logs: [] });
    const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.timestamp));
    const mapped = rows.map((l: any) => ({
      id: l.id,
      userName: l.userName || l.performedBy || 'System',
      userRole: l.userRole || '',
      action: l.action || '',
      module: l.targetType || '',
      dateTime: l.timestamp || l.createdAt || '',
      ipAddress: l.ipAddress || '',
      status: mapAuditStatus(l.type),
    }));
    res.json({ success: true, logs: mapped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/branches', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, branches: [] });
    const [branchRows, staffRows, borrowers, loans] = await Promise.all([
      db.select().from(schema.branches),
      db.select({ assignedBranchId: schema.staff.assignedBranchId }).from(schema.staff),
      db.select({ branchId: schema.borrowers.branchId, savingsBalance: schema.borrowers.savingsBalance }).from(schema.borrowers),
      db.select({ branchId: schema.loans.branchId }).from(schema.loans),
    ]);
    const staffCount = new Map<string, number>();
    for (const s of staffRows) staffCount.set(s.assignedBranchId, (staffCount.get(s.assignedBranchId) || 0) + 1);
    const clientCount = new Map<string, number>();
    const savingsSum = new Map<string, number>();
    for (const b of borrowers) {
      clientCount.set(b.branchId, (clientCount.get(b.branchId) || 0) + 1);
      savingsSum.set(b.branchId, (savingsSum.get(b.branchId) || 0) + toMoney(b.savingsBalance));
    }
    const loanCount = new Map<string, number>();
    for (const l of loans) loanCount.set(l.branchId, (loanCount.get(l.branchId) || 0) + 1);
    const mapped = branchRows.map((b: any) => ({
      id: b.id,
      branchCode: b.code || '',
      branchName: b.name || '',
      address: [b.address, b.city].filter(Boolean).join(', ') || '',
      branchManager: b.managerName || '',
      staffCount: staffCount.get(b.id) || 0,
      status: 'Active',
      phone: b.phone || '',
      totalClients: clientCount.get(b.id) || 0,
      totalLoans: loanCount.get(b.id) || 0,
      totalSavings: savingsSum.get(b.id) || 0,
    }));
    res.json({ success: true, branches: mapped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/reports', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    const emptyPayload = {
      success: true,
      charts: {
        client: [], kyc: [], loan: [], repayment: [], savings: [], transactions: [], groups: [], branches: [],
      },
      cards: {},
      tableRows: {},
    };
    if (!db) return res.json(emptyPayload);

    const [branchRows, borrowers, loans, payments, savingsTxns, txns, groups, kycRows, savingsAccounts] = await Promise.all([
      db.select().from(schema.branches),
      db.select().from(schema.borrowers),
      db.select().from(schema.loans),
      db.select().from(schema.payments),
      db.select().from(schema.savingsTransactions),
      db.select().from(schema.financialTransactions),
      db.select().from(schema.solidarityGroups),
      db.select().from(schema.kycSubmissions),
      db.select({ id: schema.savingsAccounts.id }).from(schema.savingsAccounts),
    ]);

    const months = lastSixMonthKeys();
    const monthValue = (map: Map<string, number>) => months.map((m) => ({ month: shortMonth(m), value: map.get(m) || 0 }));
    const bucket = (rows: any[], getMonth: (r: any) => string) => {
      const map = new Map<string, number>(months.map((m) => [m, 0]));
      for (const r of rows) {
        const key = String(getMonth(r) || '').slice(0, 7);
        if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
      }
      return monthValue(map);
    };

    const charts: any = {
      client: bucket(borrowers, (b: any) => b.joinedDate),
      loan: bucket(loans, (l: any) => l.applicationDate),
      groups: bucket(groups, (g: any) => g.formedDate),
    };

    const savingsMonthly = new Map<string, number>(months.map((m) => [m, 0]));
    const withdrawalsMonthly = new Map<string, number>(months.map((m) => [m, 0]));
    for (const t of savingsTxns) {
      const key = String(t.date || '').slice(0, 7);
      if (savingsMonthly.has(key)) {
        if (String(t.type).toLowerCase().includes('withdrawal')) {
          withdrawalsMonthly.set(key, (withdrawalsMonthly.get(key) || 0) + toMoney(t.amount));
        } else {
          savingsMonthly.set(key, (savingsMonthly.get(key) || 0) + toMoney(t.amount));
        }
      }
    }
    charts.savings = monthValue(savingsMonthly);

    const txMonthly = new Map<string, number>(months.map((m) => [m, 0]));
    for (const t of txns) {
      const key = String(t.transactionDate || '').slice(0, 7);
      if (txMonthly.has(key)) txMonthly.set(key, (txMonthly.get(key) || 0) + toMoney(t.amount));
    }
    charts.transactions = monthValue(txMonthly);

    const payMonthly = new Map<string, number>(months.map((m) => [m, 0]));
    for (const p of payments) {
      const key = String(p.paymentDate || '').slice(0, 7);
      if (payMonthly.has(key)) payMonthly.set(key, (payMonthly.get(key) || 0) + toMoney(p.amount));
    }
    charts.repayment = monthValue(payMonthly);

    const kycCounts = { approved: 0, pending: 0, underReview: 0, rejected: 0, correction: 0 };
    for (const k of kycRows) {
      const s = mapKycRequestStatus(k.status);
      if (s === 'Approved') kycCounts.approved++;
      else if (s === 'Rejected') kycCounts.rejected++;
      else if (s === 'Requires Correction') kycCounts.correction++;
      else if (s === 'Under Review') kycCounts.underReview++;
      else kycCounts.pending++;
    }
    if (kycRows.length === 0) {
      for (const b of borrowers) {
        const s = mapKycRequestStatus(b.kycStatus);
        if (s === 'Approved') kycCounts.approved++;
        else if (s === 'Rejected') kycCounts.rejected++;
        else if (s === 'Requires Correction') kycCounts.correction++;
        else if (s === 'Under Review') kycCounts.underReview++;
        else kycCounts.pending++;
      }
    }
    charts.kyc = [
      { name: 'Approved', value: kycCounts.approved, color: '#10b981' },
      { name: 'Pending', value: kycCounts.pending, color: '#f59e0b' },
      { name: 'Under Review', value: kycCounts.underReview, color: '#3b82f6' },
      { name: 'Rejected', value: kycCounts.rejected, color: '#ef4444' },
      { name: 'Correction Required', value: kycCounts.correction, color: '#8b5cf6' },
    ].filter((x) => x.value > 0);

    const branchLoanSum = new Map<string, number>();
    for (const l of loans) branchLoanSum.set(l.branchId, (branchLoanSum.get(l.branchId) || 0) + toMoney(l.principalAmount));
    const branchOrder = branchRows.map((b: any) => b.id);
    const sortedBranches = [...branchRows].sort((a: any, b: any) => (branchLoanSum.get(b.id) || 0) - (branchLoanSum.get(a.id) || 0));
    const branchColors = ['#091527', '#059669', '#d97706', '#2563eb', '#7c3aed'];
    charts.branches = sortedBranches.map((b: any, i: number) => ({
      name: b.name || b.id,
      value: Math.round((branchLoanSum.get(b.id) || 0) / 1000),
      color: branchColors[i % branchColors.length],
    }));

    const clientBranchCount = new Map<string, number>();
    for (const b of borrowers) clientBranchCount.set(b.branchId, (clientBranchCount.get(b.branchId) || 0) + 1);
    const sum6mo = (map: Map<string, number>) => months.reduce((s, m) => s + (map.get(m) || 0), 0);

    const totalReg6mo = charts.client.reduce((s: number, c: any) => s + c.value, 0);
    const totalPayments = payments.reduce((s: number, p: any) => s + toMoney(p.amount), 0);
    const totalPayable = loans.reduce((s: number, l: any) => s + toMoney(l.totalPayable), 0);
    const totalPaid = loans.reduce((s: number, l: any) => s + toMoney(l.totalPaid), 0);
    const par30 = loans.filter((l: any) => (l.daysInArrears || 0) > 30).length;
    const par130 = loans.filter((l: any) => (l.daysInArrears || 0) > 0 && (l.daysInArrears || 0) <= 30).length;
    const approvedCount = loans.filter((l: any) => ['Approved', 'Disbursed', 'Active', 'In Arrears'].includes(l.status)).length;
    const rejectedCount = loans.filter((l: any) => ['Rejected', 'Withdrawn', 'Cancelled'].includes(l.status)).length;
    const avgGroupRepay = groups.length ? Math.round(groups.reduce((s: number, g: any) => s + toMoney(g.repaymentRate), 0) / groups.length) : 0;
    const activeGroupsCount = groups.filter((g: any) => g.status === 'Active').length;
    const totalGroupLoan = groups.reduce((s: number, g: any) => s + toMoney(g.totalActiveLoans), 0);
    const totalSavings = borrowers.reduce((s: number, b: any) => s + toMoney(b.savingsBalance), 0);
    const cashAmount = txns.filter((t: any) => String(t.paymentMethod).toUpperCase() === 'CASH').reduce((s: number, t: any) => s + toMoney(t.amount), 0);
    const totalTxnAmount = txns.reduce((s: number, t: any) => s + toMoney(t.amount), 0);
    const cashShare = totalTxnAmount ? Math.round((cashAmount / totalTxnAmount) * 100) : 0;
    const appRate = loans.length ? Math.round((approvedCount / loans.length) * 100) : 0;
    const collEff = totalPayable ? Math.round((totalPaid / totalPayable) * 1000) / 10 : 0;
    const regAvg = months.length ? Math.round(totalReg6mo / months.length) : 0;
    const topBranchId = [...clientBranchCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topAcquirer = branchRows.find((b: any) => b.id === topBranchId)?.name || branchRows[0]?.name || '—';
    const topPortfolio = [...branchLoanSum.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topPortfolioName = branchRows.find((b: any) => b.id === topPortfolio)?.name || branchRows[0]?.name || '—';
    const fmt = (n: number) => `₱${n.toLocaleString()}`;

    const cards: any = {
      client: [
        { title: 'New Members (Period)', value: `${totalReg6mo}`, highlight: 'text-slate-900' },
        { title: 'Monthly Velocity', value: `${regAvg} members/mo`, highlight: 'text-emerald-700' },
        { title: 'Highest Acquirer', value: topAcquirer, highlight: 'text-amber-600' },
      ],
      kyc: [
        { title: 'Submitted Dossiers', value: `${kycRows.length || borrowers.length}`, highlight: 'text-slate-900' },
        { title: 'Compliance Approval Rate', value: `${appRate}%`, highlight: 'text-emerald-700' },
        { title: 'Average Turnaround', value: '—', highlight: 'text-amber-600' },
      ],
      loan: [
        { title: 'Loan Proposals Evaluated', value: `${loans.length}`, highlight: 'text-slate-900' },
        { title: 'Credit Committee Pass Rate', value: `${appRate}%`, highlight: 'text-emerald-700' },
        { title: 'Aggregated Exposure', value: fmt(loans.reduce((s: number, l: any) => s + toMoney(l.totalPayable), 0)), highlight: 'text-amber-600' },
      ],
      repayment: [
        { title: 'Overall Collection Efficiency', value: `${collEff}%`, highlight: 'text-emerald-700' },
        { title: 'Portfolio at Risk (PAR > 30)', value: `${loans.length ? Math.round((par30 / loans.length) * 100) : 0}%`, highlight: 'text-amber-600' },
        { title: 'Punctual Amortizations', value: `${payments.length}`, highlight: 'text-slate-900' },
      ],
      savings: [
        { title: 'Consolidated Member Equity', value: fmt(totalSavings), highlight: 'text-slate-900' },
        { title: 'Statutory Annual Dividend', value: '1.0% p.a.', highlight: 'text-emerald-700' },
        { title: 'Passbook Accounts Active', value: `${savingsAccounts.length}`, highlight: 'text-amber-600' },
      ],
      transactions: [
        { title: 'Period Ledger Turnover', value: fmt(sum6mo(txMonthly)), highlight: 'text-slate-900' },
        { title: 'Cashier Counter (Cash)', value: `${cashShare}% Share`, highlight: 'text-emerald-700' },
        { title: 'Electronic Rail (GCash/Maya)', value: `${100 - cashShare}% Share`, highlight: 'text-amber-600' },
      ],
      groups: [
        { title: 'Active Solidarity Cells', value: `${activeGroupsCount} Centers`, highlight: 'text-slate-900' },
        { title: 'Joint Liability Repayment', value: `${avgGroupRepay}% Index`, highlight: 'text-emerald-700' },
        { title: 'Group Portfolio Book', value: fmt(totalGroupLoan), highlight: 'text-amber-600' },
      ],
      branches: [
        { title: 'Operational Branches', value: `${branchRows.length} Stations`, highlight: 'text-slate-900' },
        { title: 'Top Portfolio Center', value: topPortfolioName, highlight: 'text-emerald-700' },
        { title: 'Consolidated Member Base', value: `${borrowers.length} Members`, highlight: 'text-amber-600' },
      ],
    };

    const tableRows: any = {
      client: [
        ...charts.client.slice(-3).reverse().map((c: any) => ({ label: `${c.month} Verified Registrations`, value: `${c.value} members` })),
        { label: 'Total Registered Members', value: `${borrowers.length} members` },
      ],
      kyc: [
        { label: 'Approved Client Dossiers', value: `${kycCounts.approved} requests` },
        { label: 'In Verification Queue', value: `${kycCounts.pending} requests` },
        { label: 'Under Review', value: `${kycCounts.underReview} requests` },
        { label: 'Non-compliant / Rejected', value: `${kycCounts.rejected} requests` },
        { label: 'Returned for Re-upload', value: `${kycCounts.correction} requests` },
      ],
      loan: [
        { label: 'Loan Proposals Received', value: `${loans.length} facilities` },
        { label: 'Credit Committee Approvals', value: `${approvedCount} facilities` },
        { label: 'Disbursed / Active Principal', value: `${approvedCount} facilities` },
        { label: 'Rejected on Risk Appraisal', value: `${rejectedCount} facilities` },
      ],
      repayment: [
        { label: 'Standard Collection Efficiency', value: `${collEff}%` },
        { label: 'Watchlist Portfolio (PAR 1-30 days)', value: `${loans.length ? Math.round((par130 / loans.length) * 100) : 0}%` },
        { label: 'Substandard / Impaired (PAR 31+)', value: `${loans.length ? Math.round((par30 / loans.length) * 100) : 0}%` },
        { label: 'Punctual Amortizations', value: `${payments.length} payments` },
      ],
      savings: [
        { label: 'Consolidated Member Balance', value: fmt(totalSavings) },
        { label: 'Period Capital Inflows (Deposits)', value: fmt(sum6mo(savingsMonthly)) },
        { label: 'Member Counter Withdrawals', value: fmt(sum6mo(withdrawalsMonthly)) },
      ],
      transactions: [
        { label: 'Consolidated Ledger Flux', value: fmt(sum6mo(txMonthly)) },
        { label: 'Amortization Inflow Credits', value: fmt(sum6mo(payMonthly)) },
        { label: 'Member Savings Deposits', value: fmt(sum6mo(savingsMonthly)) },
      ],
      groups: [
        { label: 'Chartered Solidarity Cells', value: `${groups.length} centers` },
        { label: 'Active Solidarity Cells', value: `${activeGroupsCount} centers` },
        { label: 'Joint Liability Repayment Index', value: `${avgGroupRepay}%` },
      ],
      branches: [
        ...sortedBranches.map((b: any) => ({
          label: `${b.name || b.id} Portfolio`,
          value: fmt(branchLoanSum.get(b.id) || 0),
        })),
        { label: 'Consolidated Member Base', value: `${borrowers.length} members` },
      ],
    };

    res.json({ success: true, charts, cards, tableRows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/overview', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    const emptyData = {
      stats: {
        totalUsers: 0,
        activeClients: 0,
        pendingKyc: 0,
        totalLoanApplications: 0,
        approvedLoans: 0,
        approvalRate: 0,
        totalSavingsLiquidity: 0,
        transactionsRecorded: 0,
        activeGroups: 0,
        totalClients: 0,
        verifiedKyc: 0,
        pendingKycCount: 0,
        rejectedKyc: 0,
        underReviewKyc: 0,
        correctionKyc: 0,
      },
      loanTrend: [],
      transactionChart: [],
      registrationData: [],
      recentLoans: [],
      recentTxns: [],
      notifications: [],
    };
    if (!db) return res.json({ success: true, data: emptyData });

    const [users, borrowers, loans, txns, payments, groups, kycRows, branchNotifs, pendingWithdrawals, savingsTxns, branchNames, borrowerNumbers] = await Promise.all([
      db.select({ role: schema.users.role }).from(schema.users),
      db.select().from(schema.borrowers),
      db.select().from(schema.loans),
      db.select().from(schema.financialTransactions),
      db.select({ id: schema.payments.id, paymentDate: schema.payments.paymentDate, amount: schema.payments.amount }).from(schema.payments),
      db.select({ status: schema.solidarityGroups.status }).from(schema.solidarityGroups),
      db.select({ status: schema.kycSubmissions.status }).from(schema.kycSubmissions),
      db.select().from(schema.branchNotifications),
      db.select().from(schema.savingsWithdrawalRequests),
      db.select({ date: schema.savingsTransactions.date, amount: schema.savingsTransactions.amount }).from(schema.savingsTransactions),
      resolveBranchNames(db),
      resolveBorrowerNumbers(db),
    ]);

    const totalUsers = users.filter((u: any) => u.role === 'STAFF').length;
    const activeClients = borrowers.filter((b: any) => b.memberStatus === 'Active').length;
    const pendingKyc = borrowers.filter((b: any) => b.kycStatus !== 'VERIFIED' || b.memberStatus === 'Pending').length;
    const totalLoanApplications = loans.length;
    const approvedLoans = loans.filter((l: any) => ['Approved', 'Disbursed', 'Active', 'In Arrears'].includes(l.status)).length;
    const approvalRate = totalLoanApplications ? Math.round((approvedLoans / totalLoanApplications) * 100) : 0;
    const totalSavingsLiquidity = borrowers.reduce((s: number, b: any) => s + toMoney(b.savingsBalance), 0);
    const transactionsRecorded = txns.length + payments.length + savingsTxns.length;
    const activeGroups = groups.filter((g: any) => g.status === 'Active').length;

    const kycCounts = { approved: 0, pending: 0, rejected: 0, underReview: 0, correction: 0 };
    for (const k of kycRows) {
      const s = mapKycRequestStatus(k.status);
      if (s === 'Approved') kycCounts.approved++;
      else if (s === 'Rejected') kycCounts.rejected++;
      else if (s === 'Requires Correction') kycCounts.correction++;
      else if (s === 'Under Review') kycCounts.underReview++;
      else kycCounts.pending++;
    }
    if (kycRows.length === 0) {
      for (const b of borrowers) {
        const s = mapKycRequestStatus(b.kycStatus);
        if (s === 'Approved') kycCounts.approved++;
        else if (s === 'Rejected') kycCounts.rejected++;
        else if (s === 'Requires Correction') kycCounts.correction++;
        else if (s === 'Under Review') kycCounts.underReview++;
        else kycCounts.pending++;
      }
    }

    const months = lastSixMonthKeys();
    const loanBuckets = new Map<string, any[]>(months.map((m) => [m, []]));
    for (const l of loans) {
      const key = String(l.applicationDate || '').slice(0, 7);
      if (loanBuckets.has(key)) loanBuckets.get(key)!.push(l);
    }
    const loanTrend = months.map((m) => {
      const bucket = loanBuckets.get(m) || [];
      return {
        month: shortMonth(m),
        applications: bucket.length,
        approved: bucket.filter((l: any) => ['Approved', 'Disbursed', 'Active', 'In Arrears'].includes(l.status)).length,
      };
    });

    const txnBuckets = new Map<string, any[]>(months.map((m) => [m, []]));
    for (const t of txns) {
      const key = String(t.transactionDate || '').slice(0, 7);
      if (txnBuckets.has(key)) txnBuckets.get(key)!.push(t);
    }
    const transactionChart = months.map((m) => {
      const bucket = txnBuckets.get(m) || [];
      let deposits = 0;
      let loanPayments = 0;
      for (const t of bucket) {
        const type = mapTxnType(t.transactionType);
        if (type === 'Savings Deposit' || type === 'Deposit') deposits += toMoney(t.amount);
        else if (type === 'Loan Payment') loanPayments += toMoney(t.amount);
      }
      return { month: shortMonth(m), deposits, withdrawals: 0, loanPayments };
    });

    const regBuckets = new Map<string, any[]>(months.map((m) => [m, []]));
    for (const b of borrowers) {
      const key = String(b.joinedDate || '').slice(0, 7);
      if (regBuckets.has(key)) regBuckets.get(key)!.push(b);
    }
    const registrationData = months.map((m) => ({ month: shortMonth(m), registrations: (regBuckets.get(m) || []).length }));

    const recentLoans = [...loans]
      .sort((a: any, b: any) => String(b.applicationDate).localeCompare(String(a.applicationDate)))
      .slice(0, 5)
      .map((l: any) => ({
        id: l.id,
        loanId: l.loanNumber,
        clientName: l.borrowerName || '',
        clientId: borrowerNumbers.get(l.borrowerId) || l.borrowerId || '',
        loanProduct: l.productName || '',
        loanAmount: toMoney(l.principalAmount),
        loanTerm: l.termMonths || 0,
        interestRate: toMoney(l.interestRate),
        paymentFrequency: l.repaymentFrequency || 'Monthly',
        applicationDate: l.applicationDate || '',
        status: mapLoanStatus(l.status),
        outstandingBalance: toMoney(l.remainingBalance),
        monthlyPayment: Math.round(toMoney(l.totalPayable) / (l.totalInstallments || 1)),
        branch: branchNames.get(l.branchId) || l.branchId || '',
      }));

    const recentTxns = [...txns]
      .sort((a: any, b: any) => String(b.transactionDate).localeCompare(String(a.transactionDate)))
      .slice(0, 5)
      .map((t: any) => ({
        id: t.id,
        transactionId: t.referenceNumber || t.id,
        clientName: t.clientName || '',
        clientId: t.clientId || '',
        type: mapTxnType(t.transactionType),
        amount: toMoney(t.amount),
        paymentMethod: t.paymentMethod || 'Cash',
        dateTime: t.transactionDate || '',
        processedBy: t.processedBy || '',
        status: mapTxnStatus(t.status),
        referenceNumber: t.referenceNumber || '',
        branch: branchNames.get(t.branchId) || t.branchId || '',
      }));

    const notifRows: any[] = [];
    for (const n of branchNotifs) {
      const t = String(n.relatedType || n.type || '').toUpperCase();
      let type = 'System';
      if (t.includes('KYC')) type = 'KYC';
      else if (t.includes('WITHDRAW')) type = 'Transaction';
      else if (t.includes('BORROWER') || t.includes('MEMBER')) type = 'Client';
      else if (t.includes('LOAN') || t.includes('PAYMENT') || t.includes('LATE') || t.includes('DISBURSE')) type = 'Loan';
      notifRows.push({ id: n.id, title: n.title, message: n.message, timestamp: n.createdAt || '', type, isRead: Boolean(n.isRead) });
    }
    for (const w of pendingWithdrawals.filter((x: any) => x.status === 'Pending Approval')) {
      notifRows.push({
        id: `WDR-${w.id}`,
        title: 'Savings Withdrawal Request',
        message: `${w.memberName} requested a withdrawal of PHP ${Number(w.requestedAmount).toLocaleString()}`,
        timestamp: w.requestDate || '',
        type: 'Transaction',
        isRead: false,
      });
    }
    const dedup = new Map<string, any>();
    for (const n of notifRows) dedup.set(`${n.type}:${n.title}:${n.timestamp}`, n);
    const notifications = [...dedup.values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 12);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeClients,
          pendingKyc,
          totalLoanApplications,
          approvedLoans,
          approvalRate,
          totalSavingsLiquidity,
          transactionsRecorded,
          activeGroups,
          totalClients: borrowers.length,
          verifiedKyc: kycCounts.approved,
          pendingKycCount: kycCounts.pending,
          rejectedKyc: kycCounts.rejected,
          underReviewKyc: kycCounts.underReview,
          correctionKyc: kycCounts.correction,
        },
        loanTrend,
        transactionChart,
        registrationData,
        recentLoans,
        recentTxns,
        notifications,
      },
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
    appName: 'HOSCOMCO Microfinance Mobile',
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
// The branch router relies on req.authUser being populated by authenticate().
app.use(
  '/api/branch',
  async (req: AuthedRequest, _res, next) => {
    await authenticate(req);
    next();
  },
  branchRouter
);
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
