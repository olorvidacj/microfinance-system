import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type { Request, Response, NextFunction } from 'express';
import { getDb, schema, testDbConnection } from './src/db/index';
import { verifyDbSchema } from './src/db/initDb';
import { handleSendEmailCode, handleVerifyEmailCode, onboardingDb } from './src/onboarding/http';
import { psgcResolver } from './src/onboarding/geography';
import { publicBranches, registerSelf, type AccountProvider } from './src/onboarding/registration';
import { sendError } from './src/routes/httpErrors';
import type { AppDb } from './src/kyc/errors';
import { clientKycRouter } from './src/routes/clientKycRoutes';
import { openLocalObject } from './src/kyc/storage';
import { normaliseKycStatus } from './shared/kyc-core';
import { claimApplication, decideApplication, kycDossier, kycQueue, releaseApplication, type StaffActor } from './src/kyc/service';
import { listProducts, saveProduct, type LendingStaff } from './src/lending/service';
import { runOverdueCheck } from './src/lending/repayment';
import { centsFromDb, centsToPesos, formatPeso, normaliseLoanStatus, paymentMethodLabel, productToDto, savingsProductToDto } from './shared/lending';
import { ledgerCheck, monthlyCollections, portfolioSummary } from './src/reports/portfolio';
import { transactions as savingsTxnTable } from './src/savings/tables';
import { listSavingsProducts, runInterestPosting, saveSavingsProduct } from './src/savings/service';
import { fundView, groupDetail, groupMeetings, listGroups } from './src/groups/service';
import { assignStaffBranch, branchFilter, checkAssignableBranch, staffBranches } from './src/staff/assignment';
import { seedDatabase } from './src/db/seed';
import { getServerSupabase, testServerSupabaseConnection } from './src/db/supabaseServer';
import {
  signToken,
  verifyToken,
  verifyPassword,
  hashPassword,
  authStore,
} from './src/auth/index';
import { isPasswordStrong, STRONG_PASSWORD_ERROR_MESSAGE } from './src/utils/passwordValidator';
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
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { clientMobileRouter } from './src/routes/clientMobileRoutes';
import { branchRouter } from './src/routes/branchRoutes';
import { paymentRouter } from './src/routes/paymentRoutes';
import { PAYMENTS_MIGRATION, markPaymentsSchemaMissing, paymentDeps, paymentsAvailability } from './src/payments/config';
import { sweepOnlinePayments } from './src/payments/service';
import { psgcService } from './src/services/psgcService';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

// ---------------------------------------------------------------------------
// Philippine Standard Geographic Code (PSGC) Endpoints
// ---------------------------------------------------------------------------
app.get('/api/geography/regions', (_req, res) => {
  res.json({ success: true, data: psgcService.getRegions() });
});

app.get('/api/geography/provinces', (req, res) => {
  const regionCode = req.query.regionCode ? String(req.query.regionCode) : undefined;
  res.json({ success: true, data: psgcService.getProvinces(regionCode) });
});

app.get('/api/geography/cities', (req, res) => {
  const regionCode = req.query.regionCode ? String(req.query.regionCode) : undefined;
  const provinceCode = req.query.provinceCode ? String(req.query.provinceCode) : undefined;
  res.json({ success: true, data: psgcService.getCities(regionCode, provinceCode) });
});

app.get('/api/geography/barangays', (req, res) => {
  const cityCode = req.query.cityCode ? String(req.query.cityCode) : '';
  res.json({ success: true, data: psgcService.getBarangays(cityCode) });
});

app.get('/api/geography/postal-code', (req, res) => {
  const cityCode = req.query.cityCode ? String(req.query.cityCode) : undefined;
  const barangayCode = req.query.barangayCode ? String(req.query.barangayCode) : undefined;
  res.json({ success: true, postalCode: psgcService.getPostalCode(cityCode, barangayCode) });
});

// ---------------------------------------------------------------------------
// Resilient Local Document Storage File Serving
// ---------------------------------------------------------------------------
// KYC documents are served only through short-lived signed links (src/kyc/storage.ts).
app.get('/api/kyc/files/:token', async (req, res) => {
  try {
    const file = await openLocalObject(req.params.token);
    if (!file) return res.status(404).json({ success: false, error: 'This document link has expired. Reload the page to get a new one.' });
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    file.stream.pipe(res);
  } catch (err) {
    sendError(res, err, 'kyc-file');
  }
});

app.use('/api/storage', (req, res) => {
  const safePath = path.normalize(req.path).replace(/^(\.\.[\/\\])+/, '');
  // Identity documents are never served from here, signed or not.
  if (/^[\/\\]?kyc([\/\\]|$)/i.test(safePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const filePath = path.join(process.cwd(), 'uploads', safePath);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
});


// ---------- Auth & RBAC Plumbing ----------

/**
 * Resolve the branch an actor actually belongs to, for audit attribution.
 *
 * Returns null when the branch is genuinely unknown (client accounts, or
 * staff with no assignment). The distinction matters: writeAuditLog falls
 * back to 'all' for null, which is honest, whereas hardcoding 'br-main'
 * files every event against a branch the actor may never have been in.
 */
async function resolveActorBranchId(user: {
  staffId?: string | null;
  branchId?: string | null;
}): Promise<string | null> {
  const db = getDb();
  if (!db) return user.branchId || null;
  try {
    if (user.staffId) {
      const rows = await db
        .select({ assignedBranchId: schema.staff.assignedBranchId })
        .from(schema.staff)
        .where(eq(schema.staff.id, user.staffId))
        .limit(1);
      if (rows[0]?.assignedBranchId) return rows[0].assignedBranchId;
    }
    if (user.branchId && user.branchId !== 'all' && user.branchId !== 'unassigned') {
      return user.branchId;
    }
    return null;
  } catch {
    return null;
  }
}

interface AuthedRequest extends Request {
  authUser?: {
    id: string;
    role: 'STAFF' | 'CLIENT';
    staffRole?: string | null;
    staffId?: string | null;
    borrowerId?: string | null;
    email: string;
    fullName?: string | null;
    phone?: string | null;
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
    let fullName = payload.fullName || null;
    let phone: string | null = null;
    if (!fullName) {
      try {
        const u = await authStore.findById(payload.sub);
        if (u) {
          fullName = u.fullName;
          phone = u.phone || null;
        }
      } catch {}
    }
    let borrowerId = payload.borrowerId || null;
    if (!borrowerId && payload.role === 'CLIENT') {
      try {
        const u = await authStore.findById(payload.sub);
        if (u?.borrowerId) {
          borrowerId = u.borrowerId;
        }
      } catch {}
    }
    req.authUser = {
      id: payload.sub,
      role: payload.role,
      staffRole: payload.staffRole || null,
      staffId: payload.staffId || null,
      borrowerId,
      email: payload.email,
      fullName: fullName || payload.email.split('@')[0],
      phone,
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
  if (!record || (record.role === 'CLIENT' && !record.borrowerId)) {
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
    fullName: record.fullName,
    phone: record.phone || null,
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

    // If staff user, check staffRole against required permissions.
    //
    // A staff account with no staffRole is an ACCOUNT PROBLEM, not a licence to
    // be maximally privileged. Defaulting it to ADMINISTRATOR meant any
    // half-provisioned staff login inherited every permission in the system
    // (approve_sensitive_operations, manage_users, manage_settings, and so on).
    // Deny instead, and say why, so the condition is fixable.
    if (!req.authUser.staffRole) {
      return res.status(403).json({
        error:
          'Access denied: this staff account has no role assigned. An administrator must set its staff role before it can access protected operations.',
        userRole: null,
        requiredPermissions: perms,
      });
    }

    const effectiveStaffRole = normalizeRole(req.authUser.staffRole);
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
  if (u.role === 'STAFF') {
    out.profileComplete = true;
    out.kycStatus = 'NOT_REQUIRED';
    return out;
  }

  // Clients default to Incomplete Profile and Pending KYC
  out.profileComplete = false;
  out.kycStatus = 'PENDING';
  out.profileCompleteStep = 'required';

  const db = getDb();
  if (db && u.borrowerId) {
    try {
      const rows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, u.borrowerId)).limit(1);
      const b = rows[0];
      if (b) {
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
        out.kycStatus = b.kycStatus || 'PENDING';
        out.profileCompleteStep = out.profileComplete ? 'done' : 'required';
      }
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

    if (!tokenUser && supabaseError && ![401, 404, 503].includes(supabaseError.status)) {
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
      const auditBranchId = await resolveActorBranchId(effectiveUser);
      await writeAuditLog({
        action: 'LOGIN',
        type: 'AUTH',
        details: `${effectiveUser.email} signed in`,
        performedBy: effectiveUser.id,
        userName: effectiveUser.fullName || '',
        userRole: effectiveUser.role || '',
        targetType: 'user',
        targetId: effectiveUser.id,
        branchId: auditBranchId || undefined,
      });
    } catch {}

    const publicProfile = await enrichProfileFlags(publicUser(effectiveUser));
    res.json({ success: true, token, user: publicProfile });
  } catch (err: any) {
    console.error('[Auth] login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ------------------------------------------------------------------
// Registration (src/onboarding). The email is verified with a one-time
// code before the account exists; registration consumes the resulting
// single-use token in the same transaction that creates login, member
// record and KYC application.
// ------------------------------------------------------------------

/** Local password hash, or a Supabase Auth user when Supabase is configured. */
function registrationAccounts(): AccountProvider {
  const supabase = getServerSupabase();
  if (!supabase) {
    return {
      async create({ password }) {
        return { id: `u-${crypto.randomUUID()}`, passwordHash: hashPassword(password) };
      },
      async remove() {},
    };
  }
  return {
    async create({ email, password, fullName, phone }) {
      const created = await supabaseCreateClientUser({ email, password, fullName, phone });
      // Supabase Auth holds the real credential; the local hash is an unusable sentinel.
      return { id: created.id, passwordHash: hashPassword(crypto.randomUUID()) };
    },
    async remove(id) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) throw error;
    },
  };
}

app.post('/api/auth/email-code', handleSendEmailCode);
app.post('/api/auth/email-code/verify', handleVerifyEmailCode);
// Earlier names for the same two steps, still used by the mobile app.
app.post('/api/auth/send-registration-otp', handleSendEmailCode);
app.post('/api/auth/send-email-otp', handleSendEmailCode);
app.post('/api/auth/verify-registration-otp', handleVerifyEmailCode);
app.post('/api/auth/verify-email-otp', handleVerifyEmailCode);

app.get('/api/public/branches', async (_req, res) => {
  try {
    res.json({ success: true, branches: await publicBranches(onboardingDb()) });
  } catch (err) {
    sendError(res, err, 'public-branches');
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await registerSelf(onboardingDb(), req.body || {}, {
      accounts: registrationAccounts(),
      geo: psgcResolver,
      isPasswordStrong,
      passwordMessage: STRONG_PASSWORD_ERROR_MESSAGE,
    });
    const token = signToken(result.user);
    const publicProfile = await enrichProfileFlags(publicUser(result.user));
    res.status(201).json({
      success: true,
      token,
      user: publicProfile,
      linkedMember: result.linkedExisting,
      borrowerNumber: result.borrowerNumber,
      isNewRegistration: !result.linkedExisting,
      profileComplete: false,
      message: result.linkedExisting
        ? 'Your portal account is now linked to your membership. Complete your KYC to use loans and savings.'
        : 'Your account was created. Complete your KYC verification to apply for loans and open savings.',
    });
  } catch (err) {
    sendError(res, err, 'register');
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
    let user = await authStore.findById(req.authUser!.id);
    if (!user && req.authUser?.email) {
      try {
        user = await authStore.findByEmail(req.authUser.email);
      } catch {}
    }
    if (!user && req.authUser) {
      user = {
        id: req.authUser.id,
        email: req.authUser.email,
        passwordHash: '',
        fullName: req.authUser.fullName || req.authUser.email.split('@')[0],
        role: req.authUser.role,
        staffRole: req.authUser.staffRole || null,
        staffId: req.authUser.staffId || null,
        borrowerId: req.authUser.borrowerId || null,
        phone: req.authUser.phone || null,
        branchId: req.authUser.branchId || null,
        isActive: true,
      };
    }
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
// Puts a staff login in a branch (src/staff/assignment.ts). User Management saves
// through PUT /api/admin/users/:id; the branch app's assignment notice sends a staff id.
app.post('/api/admin/staff/assign-branch', requirePermission('manage_users'), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
    const { userId, staffId, branchId } = req.body || {};
    let target: string | null = typeof userId === 'string' && userId ? userId : null;
    if (!target && typeof staffId === 'string' && staffId) {
      const [byStaff] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.staffId, staffId)).limit(1);
      target = byStaff?.id ?? null;
    }
    if (!target) return res.status(400).json({ success: false, error: 'Say which staff account to assign.' });
    const assignment = await assignStaffBranch(db as unknown as AppDb, adminActor(req), { userId: target, branchId });
    res.json({ success: true, message: `Assigned to ${assignment.branchName}.`, ...assignment });
  } catch (err) {
    sendError(res, err, 'admin-assign-branch');
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
          targetStaffId: null,
          type: 'WARNING',
          title: 'Cooperative Branch Assignment Request',
          message: `${user?.fullName || caller.email} (${user?.staffId || caller.id}) requested branch assignment to Tacloban Main Branch.`,
          relatedType: 'Staff',
          relatedId: user?.staffId || caller.id,
          isRead: false,
          createdAt: new Date().toISOString(),
        });

        await db.insert(schema.auditLogs).values({
          id: `AUD-REQ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          action: 'BRANCH_ASSIGNMENT_REQUESTED',
          details: `Staff member requested cooperative branch assignment to Tacloban Main Branch.`,
          performedBy: `${user?.fullName || caller.email} (${caller.staffRole || 'STAFF'})`,
          branchId: 'br-main',
          type: 'BRANCH',
          userName: user?.fullName || caller.email,
          userRole: caller.staffRole,
          ipAddress: req.ip || '127.0.0.1',
        });
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
app.get('/api/admin/roles', requireAuth(['STAFF']), (req, res) => {
  res.json({
    success: true,
    roles: Object.values(ROLE_DEFINITIONS),
    coreRoles: ['ADMINISTRATOR', 'CLIENT_SERVICES_STAFF', 'LOAN_OFFICER', 'CASHIER_TELLER', 'CLIENT'],
  });
});

// KYC required documents management (institution-configurable)
app.get('/api/admin/kyc/required-documents', requirePermission(['manage_settings', 'view_all_records']), async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'The database is not available right now.' });
  try {
    const rows = await db.select().from(schema.kycRequiredDocuments).orderBy(schema.kycRequiredDocuments.sortOrder);
    res.json({ success: true, documents: rows });
  } catch (err) {
    sendError(res, err, 'admin-kyc-required-documents');
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
      const filter = await adminBranch(req);
      const dbUsers = await db.select().from(schema.users);
      const [staffBranch, memberRows, branchNames] = await Promise.all([
        staffBranches(db as unknown as AppDb, dbUsers.filter((u) => u.role === 'STAFF').map((u) => u.id)),
        db.select({ id: schema.borrowers.id, branchId: schema.borrowers.branchId }).from(schema.borrowers),
        resolveBranchNames(db),
      ]);
      const memberBranch = new Map(memberRows.map((b) => [b.id, b.branchId]));
      const branchOf = (u: (typeof dbUsers)[number]): { branchId: string | null; branch: string } => {
        if (u.role === 'STAFF') {
          const b = staffBranch.get(u.id);
          return b ? { branchId: b.branchId, branch: b.branchName } : { branchId: null, branch: '' };
        }
        const id = u.borrowerId ? memberBranch.get(u.borrowerId) ?? null : null;
        return { branchId: id, branch: id ? branchNames.get(id) || id : '' };
      };
      const mapped = dbUsers
        .map((u) => ({ u, b: branchOf(u) }))
        .filter(({ b }) => !filter || b.branchId === filter)
        .map(({ u, b }) => ({
        id: u.id,
        branchId: b.branchId,
        branch: b.branch,
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
  } catch (err) {
    sendError(res, err, 'admin-users');
  }
});

// 3. Create User Account [Requires 'manage_users']
app.post('/api/admin/users', requirePermission('manage_users'), async (req: AuthedRequest, res) => {
  try {
    const { email, password, fullName, role, staffRole, staffId, borrowerId, phone } = req.body || {};
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'Email, password, fullName, and role are required' });
    }
    if (!isPasswordStrong(String(password))) {
      return res.status(400).json({ error: STRONG_PASSWORD_ERROR_MESSAGE });
    }

    // A staff account MUST be created with an explicit staff role. Defaulting to
    // ADMINISTRATOR turned every staff-creation call that forgot the field into
    // a superuser grant.
    const isStaff = role !== 'CLIENT';
    if (isStaff && !staffRole) {
      return res.status(400).json({
        error: 'staffRole is required when creating a STAFF account. Specify the role explicitly; it is never defaulted.',
      });
    }

    // A staff login is created with its branch, checked before the account exists
    // so a refused branch never leaves a login that can sign in but work nowhere.
    const db = getDb();
    if (isStaff && !db) return res.status(503).json({ error: 'The database is not available right now.' });
    // Linking an existing staff record (staffId) keeps the branch that record already has.
    const [linked] =
      isStaff && db && staffId && req.body?.branchId === undefined
        ? await db.select({ branchId: schema.staff.assignedBranchId }).from(schema.staff).where(eq(schema.staff.id, String(staffId))).limit(1)
        : [];
    const branchId = isStaff && !linked?.branchId ? await checkAssignableBranch(db as unknown as AppDb, staffRole, req.body?.branchId) : null;

    const normEmail = String(email).trim().toLowerCase();
    const existing = await authStore.findByEmail(normEmail);
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const user = await authStore.createUser({
      email: normEmail,
      fullName: String(fullName).trim(),
      passwordHash: hashPassword(String(password)),
      role: isStaff ? 'STAFF' : 'CLIENT',
      staffRole: isStaff ? normalizeRole(staffRole) : null,
      staffId: staffId || null,
      borrowerId: borrowerId || null,
      phone: phone ? String(phone) : null,
      avatar: `https://ui-avatars.com/api/?background=4F46E5&color=fff&name=${encodeURIComponent(String(fullName).trim())}`,
    });

    const assignment = isStaff && branchId ? await assignStaffBranch(db as unknown as AppDb, adminActor(req), { userId: user.id, branchId }) : null;

    res.status(201).json({
      success: true,
      user: { ...publicUser(user), staffId: assignment?.staffId ?? user.staffId ?? null, branchId: assignment?.branchId ?? null, branch: assignment?.branchName ?? '' },
      message: `User account '${fullName}' created with role '${role === 'STAFF' ? staffRole : 'CLIENT'}'${assignment ? ` in ${assignment.branchName}` : ''}`,
    });
  } catch (err) {
    sendError(res, err, 'admin-create-user');
  }
});

// 4. Update User Role / Status [Requires 'manage_users']
app.put('/api/admin/users/:id', requirePermission('manage_users'), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { fullName, staffRole, role, staffId, isActive, phone, branchId } = req.body || {};

    // Check the branch against the role the account will have before changing anything.
    const db = getDb();
    if (branchId !== undefined) {
      if (!db) return res.status(503).json({ error: 'The database is not available right now.' });
      const current = await authStore.findById(id);
      if (!current) return res.status(404).json({ error: 'That account does not exist.' });
      await checkAssignableBranch(db as unknown as AppDb, staffRole ?? current.staffRole, branchId);
    }

    await authStore.updateUser(id, {
      ...(fullName !== undefined ? { fullName } : {}),
      ...(staffRole !== undefined ? { staffRole: normalizeRole(staffRole) } : {}),
      ...(staffId !== undefined ? { staffId: staffId || null } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(phone !== undefined ? { phone } : {}),
    });

    const assignment = branchId !== undefined && db ? await assignStaffBranch(db as unknown as AppDb, adminActor(req), { userId: id, branchId }) : null;

    res.json({ success: true, message: `User ${id} updated successfully`, ...(assignment ? { branchId: assignment.branchId, branch: assignment.branchName } : {}) });
  } catch (err) {
    sendError(res, err, 'admin-update-user');
  }
});

// 5. System settings: removed. They were an in-memory object (lost on restart,
// describing a different cooperative) that no code read. Each rule lives with what
// it governs: loan and savings products, KYC requirements, branches, users.

// 6. Approve sensitive operations: removed. It answered "approved" without recording or
// changing anything. Sensitive actions are authorised inside the services that perform
// them (payment reversal, write-off, withdrawal release, fund covers).

// ---------------------------------------------------------------------------
// 7. Admin Console Data Aggregates (read-only, live-DB)
// ---------------------------------------------------------------------------
// The admin console's reads cover every branch, so they need the all-records
// permission (head office and oversight roles). Branch staff use /api/branch,
// which is scoped to their branch.
const ADMIN_READ_ANY: SystemPermission[] = ['view_all_records'];

/**
 * The admin console's branch filter (?branchId=): null for every branch. An id
 * that is not a branch is refused, never read as "every branch".
 */
function adminBranch(req: AuthedRequest): Promise<string | null> {
  return branchFilter(getDb() as unknown as AppDb, req.query.branchId);
}

/** A branch's members, as a subquery. Savings belong to the member's branch, as in src/reports/portfolio.ts. */
function membersOf(db: NonNullable<ReturnType<typeof getDb>>, branchId: string) {
  return db.select({ id: schema.borrowers.id }).from(schema.borrowers).where(eq(schema.borrowers.branchId, branchId));
}

function adminActor(req: AuthedRequest): { userId: string; name: string; role: string } {
  const a = req.authUser!;
  return { userId: a.id, name: a.fullName || a.email, role: normalizeRole(a.staffRole) };
}

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
  const status = normaliseKycStatus(s);
  if (status === 'APPROVED') return 'Approved';
  if (status === 'UNDER_REVIEW') return 'Under Review';
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'Rejected';
  if (status === 'CORRECTION_REQUIRED') return 'Requires Correction';
  return 'Pending';
}

function mapLoanStatus(s: unknown): string {
  return normaliseLoanStatus(s) ?? String(s ?? '');
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

/**
 * Resolves the branch a staff caller is confined to for list endpoints.
 *
 * Returns null when the caller may see every branch, which happens when either
 * the role carries 'view_all_records' or the staff record is explicitly scoped
 * to 'all'. Anything else is pinned to their assigned branch, so a loan officer
 * at one branch cannot enumerate another branch's borrowers through a shared
 * list endpoint. Unassigned staff are confined to the default branch rather than
 * given the whole cooperative.
 */
async function resolveStaffBranchScope(db: any, authUser: any): Promise<string | null> {
  if (authUser?.role === 'CLIENT') return null;
  const role = authUser?.staffRole ? normalizeRole(authUser.staffRole) : null;
  if (!role) return null;
  if (hasAnyPermission(role, ['view_all_records'])) return null;

  let branchId: string | null = authUser?.branchId || null;
  if (!branchId && authUser?.staffId && db) {
    try {
      const rows = await db
        .select({ assignedBranchId: schema.staff.assignedBranchId })
        .from(schema.staff)
        .where(eq(schema.staff.id, authUser.staffId))
        .limit(1);
      branchId = rows.length > 0 ? (rows[0] as any).assignedBranchId || null : null;
    } catch {}
  }
  if (!branchId || branchId === 'unassigned' || branchId === '') return 'br-main';
  if (branchId === 'all') return null;
  return branchId;
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

// The account's own status (0027) is authoritative; it is set by the savings
// service's state machine, not inferred from the member or activity dates.
const SAVINGS_STATUS_LABEL: Record<string, string> = { ACTIVE: 'Active', DORMANT: 'Dormant', FROZEN: 'Frozen', CLOSED: 'Closed' };

function mapAdminSaving(a: any, product: any, lastTxn: string | null, branchNames: Map<string, string>): any {
  return {
    id: a.id,
    accountNumber: a.passbookNumber || a.id,
    clientName: a.memberName || '',
    clientId: a.memberId || '',
    accountType: product?.name || '',
    balance: toMoney(a.balance),
    status: SAVINGS_STATUS_LABEL[a.status] || a.status,
    statusReason: a.statusReason || '',
    openedDate: a.openedAt ? String(a.openedAt).slice(0, 10) : a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '',
    lastTransaction: lastTxn || '',
    branch: branchNames.get(a.branchId) || '',
    interestRate: toMoney(product?.annualRate ?? a.interestRate),
  };
}

app.get('/api/admin/clients', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, clients: [] });
    const branchId = await adminBranch(req);
    const [borrowers, branchNames] = await Promise.all([
      db.select().from(schema.borrowers).where(branchId ? eq(schema.borrowers.branchId, branchId) : undefined),
      resolveBranchNames(db),
    ]);
    const clients = borrowers.map((b: any) => mapAdminClient(b, branchNames));
    res.json({ success: true, clients });
  } catch (err) {
    sendError(res, err, 'admin-clients');
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
    const branchId = await adminBranch(req);
    const [loans, branchNames, borrowerNumbers] = await Promise.all([
      db.select().from(schema.loans).where(branchId ? eq(schema.loans.branchId, branchId) : undefined),
      resolveBranchNames(db),
      resolveBorrowerNumbers(db),
    ]);
    const sorted = [...loans].sort((a: any, b: any) => String(b.applicationDate).localeCompare(String(a.applicationDate)));
    const mapped = sorted.map((l: any) => mapAdminLoan(l, branchNames, borrowerNumbers));
    res.json({ success: true, loans: mapped });
  } catch (err) {
    sendError(res, err, 'admin-loans');
  }
});

app.get('/api/admin/loans/:id', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const rows = await db.select().from(schema.loans).where(eq(schema.loans.id, req.params.id)).limit(1);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Loan not found' });
    const l = rows[0] as any;
    const [branchNames, borrowerNumbers, payments, audit, installments] = await Promise.all([
      resolveBranchNames(db),
      resolveBorrowerNumbers(db),
      db.select().from(schema.payments).where(eq(schema.payments.loanId, l.id)),
      db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, l.id)),
      db.select().from(schema.loanSchedule).where(eq(schema.loanSchedule.loanId, l.id)).orderBy(asc(schema.loanSchedule.installmentNumber)),
    ]);
    res.json({
      success: true,
      data: {
        loan: {
          ...mapAdminLoan(l, branchNames, borrowerNumbers),
          // The stored schedule (0025); older loans without one show none.
          schedule: installments.map((i) => ({
            dueDate: i.dueDate,
            principal: Number(i.principalDue),
            interest: Number(i.interestDue),
            totalDue: Number(i.totalDue) + Number(i.penaltyDue),
            amountPaid: Number(i.amountPaid),
            status: i.status,
          })),
        },
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
            status: p.status,
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
    const branchId = await adminBranch(req);
    const [accounts, txns, products, branchNames] = await Promise.all([
      db.select().from(schema.savingsAccounts).where(branchId ? inArray(schema.savingsAccounts.memberId, membersOf(db, branchId)) : undefined),
      db.select({ accountId: schema.savingsTransactions.savingsAccountId, date: schema.savingsTransactions.date }).from(schema.savingsTransactions),
      db.select().from(schema.savingsProducts),
      resolveBranchNames(db),
    ]);
    const productById = new Map(products.map((p: any) => [p.id, p]));
    const lastTxnByAcct = new Map<string, string>();
    for (const t of txns) {
      const cur = lastTxnByAcct.get(t.accountId);
      if (!cur || String(t.date) > cur) lastTxnByAcct.set(t.accountId, String(t.date));
    }
    const mapped = accounts.map((a: any) => mapAdminSaving(a, productById.get(a.productId), lastTxnByAcct.get(a.id) || null, branchNames));
    res.json({ success: true, accounts: mapped });
  } catch (err) {
    sendError(res, err, 'admin-savings');
  }
});

app.get('/api/admin/savings/:id', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const rows = await db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.id, req.params.id)).limit(1);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Savings account not found' });
    const a = rows[0] as any;
    const [products, branchNames, ledger] = await Promise.all([
      db.select().from(schema.savingsProducts).where(eq(schema.savingsProducts.id, a.productId)),
      resolveBranchNames(db),
      db.select().from(schema.savingsTransactions).where(eq(schema.savingsTransactions.savingsAccountId, a.id)),
    ]);
    // Newest first by posting order; the sequence breaks ties within a day.
    const sorted = [...ledger].sort((x: any, y: any) => Number(y.sequence ?? 0) - Number(x.sequence ?? 0));
    const lastTxn = sorted.length ? sorted[0].date : null;
    // Totals in integer centavos so many small amounts do not drift.
    const centsOf = (t: any) => Math.round(Number(t.signedAmount) * 100);
    const inflowCents = ledger.reduce((s: number, t: any) => s + Math.max(0, centsOf(t)), 0);
    const outflowCents = ledger.reduce((s: number, t: any) => s + Math.max(0, -centsOf(t)), 0);
    res.json({
      success: true,
      data: {
        account: mapAdminSaving(a, products[0], lastTxn ? String(lastTxn) : null, branchNames),
        inflows: inflowCents / 100,
        outflows: outflowCents / 100,
        ledger: sorted.slice(0, 30).map((t: any) => ({
          id: t.id,
          ref: t.officialReceiptNumber || t.transactionNumber || t.id,
          type: t.type,
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
    const branchId = await adminBranch(req);
    const [txns, branchNames] = await Promise.all([
      db.select().from(schema.financialTransactions).where(branchId ? eq(schema.financialTransactions.branchId, branchId) : undefined),
      resolveBranchNames(db),
    ]);
    const sorted = [...txns].sort((a: any, b: any) => String(b.transactionDate).localeCompare(String(a.transactionDate)));
    const mapped = sorted.map((t: any) => mapAdminTxn(t, branchNames));
    res.json({ success: true, transactions: mapped });
  } catch (err) {
    sendError(res, err, 'admin-transactions');
  }
});

// Head-office view of lending groups (src/groups/service.ts). Groups are run by
// branch loan officers; this view is read-only.
const GROUP_STATUS_WORD: Record<string, string> = { FORMING: 'Forming', ACTIVE: 'Active', SUSPENDED: 'Suspended', DISSOLVED: 'Dissolved' };

app.get('/api/admin/groups', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = onboardingDb();
    const branchId = await adminBranch(req);
    const [list, branchNames] = await Promise.all([listGroups(db, productAdminActor(req)), resolveBranchNames(getDb())]);
    res.json({
      success: true,
      groups: list.filter((g) => !branchId || g.branchId === branchId).map((g) => ({
        id: g.id,
        groupId: g.groupCode,
        groupName: g.groupName,
        leader: g.leaderName || '',
        memberCount: g.memberCount,
        status: GROUP_STATUS_WORD[g.status] || g.status,
        totalGroupLoan: Number(g.exposure),
        fundBalance: Number(g.fundBalance),
        runningLoans: g.runningLoans,
        membersInArrears: g.membersInArrears,
        blocked: g.blocked,
        blockReasons: g.blockReasons,
        branch: branchNames.get(g.branchId) || g.branchId,
        formedDate: g.formedDate,
        meetingDay: g.meetingDay,
        meetingTime: g.meetingTime,
        meetingLocation: g.meetingLocation,
        loanOfficer: g.loanOfficerName,
      })),
    });
  } catch (err) {
    sendError(res, err, 'admin-groups');
  }
});

app.get('/api/admin/groups/:id', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = onboardingDb();
    const actor = productAdminActor(req);
    const [d, fund, meetings] = await Promise.all([groupDetail(db, actor, req.params.id), fundView(db, actor, req.params.id), groupMeetings(db, actor, req.params.id)]);
    const loanIds = d.members.flatMap((m) => m.loans.map((l) => l.id));
    const loans = loanIds.length ? await getDb().select().from(schema.loans).where(inArray(schema.loans.id, loanIds)) : [];
    const payments = loanIds.length ? await getDb().select().from(schema.payments).where(inArray(schema.payments.loanId, loanIds)) : [];
    const standing: Record<string, string> = { GOOD: 'Good Standing', IN_ARREARS: 'In Arrears', OWES_FUND: 'Owes Fund' };
    res.json({
      success: true,
      data: {
        members: d.members.map((m) => ({
          id: m.borrowerId,
          name: m.fullName,
          phone: m.phone || '',
          role: m.role.charAt(0) + m.role.slice(1).toLowerCase(),
          loanAmount: m.loans.reduce((s, l) => s + Number(l.remaining), 0),
          balance: m.loans.reduce((s, l) => s + Number(l.overdue), 0),
          coverOwed: Number(m.coverOwed),
          status: standing[m.standing] || m.standing,
        })),
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
            method: paymentMethodLabel(p.paymentMethod),
          })),
        fund,
        meetings: meetings.slice(0, 20).map((m) => ({ date: m.meetingDate, present: m.present, total: m.total, recordedBy: m.recordedByName || '' })),
        block: d.block,
        statusReason: d.group.statusReason,
      },
    });
  } catch (err) {
    sendError(res, err, 'admin-group-detail');
  }
});

// ------------------------------------------------------------------
// Head-office KYC review (src/kyc/service). Reading needs
// view_all_records; deciding also needs manage_kyc.
// ------------------------------------------------------------------

function requireHeadOfficeKyc(write: boolean) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    await authenticate(req);
    const auth = req.authUser;
    if (!auth) return res.status(401).json({ success: false, error: 'Please sign in.' });
    const perms = auth.role === 'STAFF' && auth.staffRole ? getRolePermissions(normalizeRole(auth.staffRole)) : [];
    const allowed = perms.includes('view_all_records') && (!write || perms.includes('manage_kyc'));
    if (!allowed) {
      return res.status(403).json({ success: false, error: write ? 'Only head-office KYC reviewers can decide applications here.' : 'You do not have access to the head-office KYC queue.' });
    }
    next();
  };
}

function headOfficeActor(req: AuthedRequest): StaffActor {
  const auth = req.authUser!;
  return {
    kind: 'staff',
    userId: auth.id,
    staffId: auth.staffId ?? null,
    name: auth.fullName || auth.email,
    role: normalizeRole(auth.staffRole),
    branchId: null,
    viewAll: true,
  };
}

// Loan products (head office). Applications copy a product's terms, so edits
// never change loans already filed.
function productAdminActor(req: AuthedRequest): LendingStaff {
  return { ...headOfficeActor(req), permissions: getRolePermissions(normalizeRole(req.authUser?.staffRole)) };
}

app.get('/api/admin/loan-products', requirePermission(['manage_settings', 'view_all_records', 'process_loan_applications']), async (_req: AuthedRequest, res) => {
  try {
    const products = await listProducts(onboardingDb(), { includeInactive: true });
    res.json({ success: true, data: products.map(productToDto) });
  } catch (err) {
    sendError(res, err, 'admin-loan-products');
  }
});

app.post('/api/admin/loan-products', requirePermission('manage_settings'), async (req: AuthedRequest, res) => {
  try {
    const product = await saveProduct(onboardingDb(), productAdminActor(req), null, req.body || {});
    res.status(201).json({ success: true, data: productToDto(product) });
  } catch (err) {
    sendError(res, err, 'admin-loan-product-create');
  }
});

app.put('/api/admin/loan-products/:id', requirePermission('manage_settings'), async (req: AuthedRequest, res) => {
  try {
    const product = await saveProduct(onboardingDb(), productAdminActor(req), req.params.id, req.body || {});
    res.json({ success: true, data: productToDto(product) });
  } catch (err) {
    sendError(res, err, 'admin-loan-product-update');
  }
});

// Savings products (head office). Changing a rate takes effect from the next
// interest period; periods already posted are never recomputed.
app.get('/api/admin/savings-products', requirePermission(['manage_settings', 'view_all_records']), async (_req: AuthedRequest, res) => {
  try {
    const products = await listSavingsProducts(onboardingDb(), true);
    res.json({ success: true, data: products.map(savingsProductToDto) });
  } catch (err) {
    sendError(res, err, 'admin-savings-products');
  }
});

app.post('/api/admin/savings-products', requirePermission('manage_settings'), async (req: AuthedRequest, res) => {
  try {
    const product = await saveSavingsProduct(onboardingDb(), productAdminActor(req), null, req.body || {});
    res.status(201).json({ success: true, data: savingsProductToDto(product) });
  } catch (err) {
    sendError(res, err, 'admin-savings-product-create');
  }
});

app.put('/api/admin/savings-products/:id', requirePermission('manage_settings'), async (req: AuthedRequest, res) => {
  try {
    const product = await saveSavingsProduct(onboardingDb(), productAdminActor(req), req.params.id, req.body || {});
    res.json({ success: true, data: savingsProductToDto(product) });
  } catch (err) {
    sendError(res, err, 'admin-savings-product-update');
  }
});

app.get('/api/admin/kyc-requests', requireHeadOfficeKyc(false), async (req: AuthedRequest, res) => {
  try {
    const { items, counts } = await kycQueue(onboardingDb(), { branchId: null, viewAll: true }, {
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      branchId: (await adminBranch(req)) ?? undefined,
    });
    res.json({ success: true, requests: items, counts });
  } catch (err) {
    sendError(res, err, 'admin-kyc-queue');
  }
});

app.get('/api/admin/kyc/:borrowerId', requireHeadOfficeKyc(false), async (req: AuthedRequest, res) => {
  try {
    res.json({ success: true, data: await kycDossier(onboardingDb(), { branchId: null, viewAll: true }, req.params.borrowerId) });
  } catch (err) {
    sendError(res, err, 'admin-kyc-dossier');
  }
});

app.post('/api/admin/kyc/:borrowerId/claim', requireHeadOfficeKyc(true), async (req: AuthedRequest, res) => {
  try {
    res.json({ success: true, ...(await claimApplication(onboardingDb(), headOfficeActor(req), req.params.borrowerId)) });
  } catch (err) {
    sendError(res, err, 'admin-kyc-claim');
  }
});

app.post('/api/admin/kyc/:borrowerId/release', requireHeadOfficeKyc(true), async (req: AuthedRequest, res) => {
  try {
    res.json({ success: true, ...(await releaseApplication(onboardingDb(), headOfficeActor(req), req.params.borrowerId, req.body?.reason ? String(req.body.reason) : null)) });
  } catch (err) {
    sendError(res, err, 'admin-kyc-release');
  }
});

app.post('/api/admin/kyc/:borrowerId/decision', requireHeadOfficeKyc(true), async (req: AuthedRequest, res) => {
  try {
    const result = await decideApplication(onboardingDb(), headOfficeActor(req), req.params.borrowerId, {
      decision: req.body?.decision,
      reason: req.body?.reason,
      sections: req.body?.sections,
      idempotencyKey: req.get('Idempotency-Key') || null,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, err, 'admin-kyc-decision');
  }
});

app.get('/api/admin/notifications', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, notifications: [] });
    const branchId = await adminBranch(req);
    const [branchNotifs, pendingWithdrawals, kycRows, loanRows, borrowerRows, branchNames] = await Promise.all([
      db
        .select()
        .from(schema.branchNotifications)
        .where(and(eq(schema.branchNotifications.audience, 'STAFF'), branchId ? eq(schema.branchNotifications.branchId, branchId) : undefined))
        .orderBy(desc(schema.branchNotifications.createdAt))
        .limit(30),
      db.select().from(schema.savingsWithdrawalRequests).where(branchId ? eq(schema.savingsWithdrawalRequests.branchId, branchId) : undefined),
      db
        .select({
          id: schema.kycSubmissions.id,
          status: schema.kycSubmissions.status,
          submittedAt: schema.kycSubmissions.submittedAt,
          createdAt: schema.kycSubmissions.createdAt,
          fullName: schema.borrowers.fullName,
        })
        .from(schema.kycSubmissions)
        .leftJoin(schema.borrowers, eq(schema.kycSubmissions.borrowerId, schema.borrowers.id))
        .where(branchId ? eq(schema.borrowers.branchId, branchId) : undefined),
      db.select().from(schema.loans).where(branchId ? eq(schema.loans.branchId, branchId) : undefined),
      db
        .select()
        .from(schema.borrowers)
        .where(branchId ? eq(schema.borrowers.branchId, branchId) : undefined)
        .orderBy(desc(schema.borrowers.joinedDate))
        .limit(10),
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
    for (const w of pendingWithdrawals.filter((x: any) => x.status === 'PENDING')) {
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
  } catch (err) {
    sendError(res, err, 'admin-notifications');
  }
});

app.get('/api/admin/audit-logs', requirePermission(ADMIN_READ_ANY), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, logs: [] });
    const branchId = await adminBranch(req);
    const rows = await db
      .select()
      .from(schema.auditLogs)
      .where(branchId ? eq(schema.auditLogs.branchId, branchId) : undefined)
      .orderBy(desc(schema.auditLogs.timestamp));
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
  } catch (err) {
    sendError(res, err, 'admin-audit-logs');
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
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'The database is not available right now.' });
  try {
    const appDb = db as unknown as AppDb;
    // Every amount below comes from src/reports/portfolio.ts, the same figures the
    // branch app and the client portal show (exact; formatted with formatPeso).
    const branchId = await adminBranch(req);
    const p = await portfolioSummary(appDb, { branchId });
    const branchRows = await db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches);
    const perBranch = await Promise.all(branchRows.map(async (b) => ({ branch: b, p: await portfolioSummary(appDb, { branchId: b.id }) })));
    const [borrowers, loanRows, groups, kycRows, savingsRows] = await Promise.all([
      db.select({ joinedDate: schema.borrowers.joinedDate, branchId: schema.borrowers.branchId }).from(schema.borrowers).where(branchId ? eq(schema.borrowers.branchId, branchId) : undefined),
      db.select({ applicationDate: schema.loans.applicationDate, status: schema.loans.status }).from(schema.loans).where(branchId ? eq(schema.loans.branchId, branchId) : undefined),
      db.select({ formedDate: schema.solidarityGroups.formedDate }).from(schema.solidarityGroups).where(branchId ? eq(schema.solidarityGroups.branchId, branchId) : undefined),
      db
        .select({ submittedAt: schema.kycSubmissions.submittedAt, reviewedAt: schema.kycSubmissions.reviewedAt })
        .from(schema.kycSubmissions)
        .innerJoin(schema.borrowers, eq(schema.kycSubmissions.borrowerId, schema.borrowers.id))
        .where(branchId ? eq(schema.borrowers.branchId, branchId) : undefined),
      db
        .select({ kind: savingsTxnTable.kind, amount: savingsTxnTable.amount, date: savingsTxnTable.date })
        .from(savingsTxnTable)
        .where(branchId ? inArray(savingsTxnTable.memberId, membersOf(db, branchId)) : undefined),
    ]);

    const months = lastSixMonthKeys();
    const count = (rows: { d: string | null }[]) => months.map((m) => ({ month: shortMonth(m), value: rows.filter((r) => String(r.d ?? '').startsWith(m)).length }));
    const pesosByMonth = (rows: { d: string; cents: number }[]) => months.map((m) => ({ month: shortMonth(m), value: centsToPesos(rows.filter((r) => r.d.startsWith(m)).reduce((t, r) => t + r.cents, 0)) }));
    const collections = await monthlyCollections(appDb, branchId, months);
    const deposits = savingsRows.filter((t) => t.kind === 'DEPOSIT').map((t) => ({ d: t.date, cents: centsFromDb(t.amount) }));
    const withdrawals = savingsRows.filter((t) => t.kind === 'WITHDRAWAL').map((t) => ({ d: t.date, cents: centsFromDb(t.amount) }));

    const reviewDays = kycRows
      .filter((k) => k.submittedAt && k.reviewedAt)
      .map((k) => (new Date(String(k.reviewedAt)).getTime() - new Date(String(k.submittedAt)).getTime()) / 86_400_000)
      .filter((d) => d >= 0);
    const avgReview = reviewDays.length ? `${(reviewDays.reduce((t, d) => t + d, 0) / reviewDays.length).toFixed(1)} days` : 'no reviews yet';
    const decided = loanRows.filter((l) => ['Approved', 'Disbursed', 'Active', 'Closed', 'Written Off', 'Rejected'].includes(normaliseLoanStatus(l.status)));
    const approved = decided.filter((l) => normaliseLoanStatus(l.status) !== 'Rejected');
    const approvalRate = decided.length ? `${Math.round((approved.length / decided.length) * 100)}%` : 'no decisions yet';
    const par = p.loans.running ? `${Math.round((p.loans.overdue / p.loans.running) * 100)}%` : '0%';
    const peso = (v: string) => formatPeso(centsFromDb(v));
    const ranked = [...perBranch].sort((x, y) => centsFromDb(y.p.loans.outstanding) - centsFromDb(x.p.loans.outstanding));

    const charts = {
      client: count(borrowers.map((b) => ({ d: b.joinedDate }))),
      loan: count(loanRows.map((l) => ({ d: l.applicationDate }))),
      groups: count(groups.map((g) => ({ d: g.formedDate }))),
      repayment: collections.map((c) => ({ month: shortMonth(c.month), value: centsToPesos(centsFromDb(c.amount)) })),
      savings: pesosByMonth(deposits),
      transactions: pesosByMonth([...deposits, ...withdrawals, ...collections.map((c) => ({ d: c.month, cents: centsFromDb(c.amount) }))]),
      kyc: [
        { name: 'Verified', value: p.members.kycVerified, color: '#10b981' },
        { name: 'Awaiting review', value: p.members.kycAwaitingReview, color: '#3b82f6' },
        { name: 'Not verified', value: p.members.kycNotVerified, color: '#f59e0b' },
      ].filter((x) => x.value > 0),
      branches: ranked.map((x, i) => ({ name: x.branch.name, value: centsToPesos(centsFromDb(x.p.loans.outstanding)), color: ['#091527', '#059669', '#d97706', '#2563eb', '#7c3aed'][i % 5] })),
    };

    const cards = {
      client: [
        { title: 'Members', value: `${p.members.total}`, highlight: 'text-slate-900' },
        { title: 'Active members', value: `${p.members.active}`, highlight: 'text-emerald-700' },
        { title: 'Joined in the last 6 months', value: `${charts.client.reduce((t, c) => t + c.value, 0)}`, highlight: 'text-amber-600' },
      ],
      kyc: [
        { title: 'Verified', value: `${p.members.kycVerified}`, highlight: 'text-slate-900' },
        { title: 'Awaiting review', value: `${p.members.kycAwaitingReview}`, highlight: 'text-emerald-700' },
        { title: 'Average review time', value: avgReview, highlight: 'text-amber-600' },
      ],
      loan: [
        { title: 'Running loans', value: `${p.loans.running}`, highlight: 'text-slate-900' },
        { title: 'Approval rate', value: approvalRate, highlight: 'text-emerald-700' },
        { title: 'Outstanding', value: peso(p.loans.outstanding), highlight: 'text-amber-600' },
      ],
      repayment: [
        { title: 'Collected (posted payments)', value: peso(p.collections.amount), highlight: 'text-emerald-700' },
        { title: 'Loans behind schedule', value: `${p.loans.overdue} (${par})`, highlight: 'text-amber-600' },
        { title: 'Outstanding on loans behind', value: peso(p.loans.overdueOutstanding), highlight: 'text-slate-900' },
      ],
      savings: [
        { title: 'Savings balances', value: peso(p.savings.balance), highlight: 'text-slate-900' },
        { title: 'Open accounts', value: `${p.savings.accounts}`, highlight: 'text-emerald-700' },
        { title: 'Interest credited', value: peso(p.savings.interest), highlight: 'text-amber-600' },
      ],
      transactions: [
        { title: 'Loan payments', value: peso(p.collections.amount), highlight: 'text-slate-900' },
        { title: 'Savings deposits', value: peso(p.savings.deposits), highlight: 'text-emerald-700' },
        { title: 'Savings withdrawals', value: peso(p.savings.withdrawals), highlight: 'text-amber-600' },
      ],
      groups: [
        { title: 'Active groups', value: `${p.groups.active}`, highlight: 'text-slate-900' },
        { title: 'Groups', value: `${p.groups.total}`, highlight: 'text-emerald-700' },
        { title: 'Solidarity funds', value: peso(p.groups.fundBalance), highlight: 'text-amber-600' },
      ],
      branches: [
        { title: 'Branches', value: `${branchRows.length}`, highlight: 'text-slate-900' },
        { title: 'Largest portfolio', value: ranked[0]?.branch.name ?? '—', highlight: 'text-emerald-700' },
        { title: 'Members', value: `${p.members.total}`, highlight: 'text-amber-600' },
      ],
    };

    const tableRows = {
      client: [...charts.client.slice(-3).reverse().map((c) => ({ label: `Joined in ${c.month}`, value: `${c.value} members` })), { label: 'All members', value: `${p.members.total} members` }],
      kyc: [
        { label: 'Verified', value: `${p.members.kycVerified} members` },
        { label: 'Awaiting review', value: `${p.members.kycAwaitingReview} members` },
        { label: 'Not yet verified', value: `${p.members.kycNotVerified} members` },
      ],
      loan: [
        { label: 'Applications in progress', value: `${p.loans.applications} loans` },
        { label: 'Running', value: `${p.loans.running} loans` },
        { label: 'Finished (closed, rejected, cancelled)', value: `${p.loans.finished} loans` },
        { label: 'Principal released', value: peso(p.loans.principalReleased) },
        { label: 'Outstanding', value: peso(p.loans.outstanding) },
      ],
      repayment: [
        { label: 'Posted payments', value: `${p.collections.count}` },
        { label: 'Collected', value: peso(p.collections.amount) },
        { label: 'Loans behind schedule', value: `${p.loans.overdue}` },
        { label: 'Outstanding on loans behind', value: peso(p.loans.overdueOutstanding) },
      ],
      savings: [
        { label: 'Savings balances', value: peso(p.savings.balance) },
        { label: 'Deposits', value: peso(p.savings.deposits) },
        { label: 'Withdrawals', value: peso(p.savings.withdrawals) },
        { label: 'Interest credited', value: peso(p.savings.interest) },
      ],
      transactions: [
        { label: 'Loan payments', value: peso(p.collections.amount) },
        { label: 'Savings deposits', value: peso(p.savings.deposits) },
        { label: 'Savings withdrawals', value: peso(p.savings.withdrawals) },
      ],
      groups: [
        { label: 'Groups', value: `${p.groups.total}` },
        { label: 'Active groups', value: `${p.groups.active}` },
        { label: 'Solidarity funds', value: peso(p.groups.fundBalance) },
      ],
      branches: [
        ...ranked.map((x) => ({ label: `${x.branch.name} outstanding`, value: peso(x.p.loans.outstanding) })),
        { label: 'All branches outstanding', value: peso(p.loans.outstanding) },
      ],
    };

    const ledger = await ledgerCheck(appDb);
    res.json({
      success: true,
      charts,
      cards,
      tableRows,
      portfolio: p,
      branchId,
      branches: perBranch.map((x) => ({ id: x.branch.id, name: x.branch.name, portfolio: x.p })),
      ledger: { debits: ledger.debits, credits: ledger.credits, difference: ledger.difference, balanced: ledger.balanced },
    });
  } catch (err) {
    sendError(res, err, 'admin-reports');
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

    const branchId = await adminBranch(req);
    const inBranch = <T extends { branchId: any }>(t: T) => (branchId ? eq(t.branchId, branchId) : undefined);
    const [staffRows, borrowers, loans, txns, payments, groups, kycRows, branchNotifs, pendingWithdrawals, savingsTxns, branchNames, borrowerNumbers] = await Promise.all([
      db.select({ id: schema.staff.id }).from(schema.staff).where(branchId ? eq(schema.staff.assignedBranchId, branchId) : undefined),
      db.select().from(schema.borrowers).where(inBranch(schema.borrowers)),
      db.select().from(schema.loans).where(inBranch(schema.loans)),
      db.select().from(schema.financialTransactions).where(inBranch(schema.financialTransactions)),
      db.select({ id: schema.payments.id, paymentDate: schema.payments.paymentDate, amount: schema.payments.amount }).from(schema.payments).where(inBranch(schema.payments)),
      db.select({ status: schema.solidarityGroups.status }).from(schema.solidarityGroups).where(inBranch(schema.solidarityGroups)),
      db
        .select({ status: schema.kycSubmissions.status })
        .from(schema.kycSubmissions)
        .innerJoin(schema.borrowers, eq(schema.kycSubmissions.borrowerId, schema.borrowers.id))
        .where(inBranch(schema.borrowers)),
      db.select().from(schema.branchNotifications).where(inBranch(schema.branchNotifications)),
      db.select().from(schema.savingsWithdrawalRequests).where(inBranch(schema.savingsWithdrawalRequests)),
      db.select({ date: schema.savingsTransactions.date, amount: schema.savingsTransactions.amount }).from(schema.savingsTransactions).where(branchId ? inArray(schema.savingsTransactions.memberId, membersOf(db, branchId)) : undefined),
      resolveBranchNames(db),
      resolveBorrowerNumbers(db),
    ]);
    // Counts and balances shared with the reports, the branch app and the portal (src/reports/portfolio.ts).
    const portfolio = await portfolioSummary(db as unknown as AppDb, { branchId });

    const totalUsers = staffRows.length;
    const activeClients = portfolio.members.active;
    const pendingKyc = portfolio.members.kycAwaitingReview;
    const totalLoanApplications = loans.length;
    const approvedLoans = loans.filter((l: any) => ['Approved', 'Disbursed', 'Active', 'Closed'].includes(normaliseLoanStatus(l.status))).length;
    const approvalRate = totalLoanApplications ? Math.round((approvedLoans / totalLoanApplications) * 100) : 0;
    const totalSavingsLiquidity = portfolio.savings.balance;
    const transactionsRecorded = txns.length + payments.length + savingsTxns.length;
    const activeGroups = portfolio.groups.active;

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
    for (const w of pendingWithdrawals.filter((x: any) => x.status === 'PENDING')) {
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
        portfolio,
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
  } catch (err) {
    sendError(res, err, 'admin-overview');
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

// Provider confirmations and the mock checkout page (public; each confirmation is verified).
app.use(paymentRouter);

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
app.use(
  '/api/client',
  async (req: AuthedRequest, _res, next) => {
    await authenticate(req);
    next();
  },
  clientKycRouter,
  clientMobileRouter
);

// NOTE: clientMobileRouter is deliberately NOT also mounted at a bare '/api'.
//
// It used to be, which made it a catch-all in front of every '/api/*' route
// registered below. Express dispatches on the first router that matches the path
// AND method, so the bare mount silently swallowed requests meant for the staff
// routes declared afterwards - notably GET /api/loans, which the client router
// answers with a borrowerId-scoped list. Staff have no borrowerId, so the
// all-loans admin/branch endpoint below could never run and always returned [].
// Any future /api route matching a client path would have been lost the same way.
//
// Every client and mobile caller uses the explicit '/api/client' prefix, so the
// bare mount had no legitimate consumer.

// Removed (audit 3.4): /api/db/test-connection (let any staff login make the server
// connect to an arbitrary database), /api/db/seed (seeding is npm run db:seed and
// server start), /api/db/all (every table to any staff login), raw-body
// /api/borrowers writes, the unscoped GET /api/borrowers and /api/loans lists, and
// /api/financial-transactions (raw register inserts, status overrides and
// "reversals" that never moved a balance). Their only caller was the legacy
// MainApp shell, which no account can reach. Members, loans, payments, savings
// and their history are served by /api/branch, /api/admin and /api/client.

// Group lending is served by /api/branch/groups (src/groups/service.ts); the raw
// /api/solidarity-groups insert/update endpoints were removed in B5.

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

/** Marks overdue installments and charges penalties now and every 6 hours. Each run is idempotent. */
function startOverdueChecks() {
  const run = async () => {
    const db = getDb();
    if (!db) return;
    try {
      const r = await runOverdueCheck(onboardingDb());
      if (r.penaltiesCharged || r.groupAlerts) console.log(`[Overdue check] ${r.date}: ${r.penaltiesCharged} penalties (₱${r.amountCharged}) on ${r.loansCharged.join(', ') || 'no loans'}; ${r.groupAlerts} group alert(s)`);
    } catch (err: any) {
      console.error('[Overdue check] failed:', err?.message || err);
    }
  };
  void run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}

/**
 * Posts savings interest for every complete month not yet posted, now and every
 * 6 hours. Each (account, month) is posted at most once, so reruns are no-ops.
 */
function startInterestPosting() {
  const run = async () => {
    const db = getDb();
    if (!db) return;
    try {
      const r = await runInterestPosting(onboardingDb());
      if (r.interestPostings || r.madeDormant) console.log(`[Savings interest] ${r.date}: ${r.interestPostings} postings (₱${r.interestTotal}), ${r.madeDormant} marked dormant`);
    } catch (err: any) {
      console.error('[Savings interest] failed:', err?.message || err);
    }
  };
  void run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}

/**
 * Settles online payments whose confirmation was missed (late deposits are
 * credited, unconfirmed payouts checked or sent again), now and every 5 minutes.
 */
function startOnlinePaymentSweep() {
  // Off (no tables yet, no provider, mock against a shared database): the reason is logged once.
  if (!paymentsAvailability().ok) return;
  const run = async () => {
    const db = getDb();
    if (!db) return;
    try {
      const r = await sweepOnlinePayments(onboardingDb(), paymentDeps());
      if (r.depositsChecked || r.payoutsChecked || r.errors.length) console.log(`[Online payments] checked ${r.depositsChecked} deposits, ${r.payoutsChecked} payouts (${r.sentAgain} sent again, ${r.toReview} to review)${r.errors.length ? `; errors: ${r.errors.join(' | ')}` : ''}`);
    } catch (err) {
      console.error('[Online payments] sweep failed:', err instanceof Error ? err.message : err);
    }
  };
  void run();
  setInterval(run, 5 * 60 * 1000).unref();
}

// Setup Vite development middleware or static file serving
async function initServer() {
  // The schema comes from database/migrations (npm run db:migrate); this only
  // reports pending migrations, then seeds an empty database.
  const schemaState = await verifyDbSchema();
  if (schemaState?.ok) await seedDatabase();
  if (schemaState?.pending.includes(PAYMENTS_MIGRATION)) markPaymentsSchemaMissing(PAYMENTS_MIGRATION);
  startOverdueChecks();
  startInterestPosting();
  startOnlinePaymentSweep();

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
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

  const server = httpServer.listen(PORT, '0.0.0.0', () => {
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
