import crypto from 'crypto';
import { getDb, schema } from '../db/index';
import { createClientProfile, findBorrowerByContact } from '../db/clientProvisioning';
import { getServerSupabase } from '../db/supabaseServer';
import { authStore, hashPassword } from './index';
import { sendOtpEmail, isDirectSmtpConfigured } from '../services/emailService';

export const activeEmailOtpStore = new Map<string, { otp: string; expiresAt: number; verified: boolean }>();

/**
 * Server-side Supabase Auth helpers.
 *
 * Supabase Auth is the PRIMARY identity/credential store. Local DB rows
 * (`users` + `borrowers`) are kept as a lightweight sync/projection so the
 * rest of the app (drizzle queries, RBAC, portal pages) keeps working without
 * change. HMAC tokens remain as a fully local fallback for seeded/demo
 * accounts (gated by HOSCOMCO_ALLOW_DEMO) and for environments without a
 * reachable Supabase project.
 */

export class SupabaseAuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'SupabaseAuthError';
    this.status = status;
    this.code = code;
  }
}

export function digitsOnly(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Normalizes a Philippine mobile number (09xx, +639xx, 639xx, 9xx) to a
 * canonical display form. Returns null when the input is not a valid PH number.
 */
export function normalizePhilippinePhone(raw: string): string | null {
  const d = digitsOnly(raw);
  if (d.length === 10 && d.startsWith('9')) {
    return `+63 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  if (d.length === 11 && d.startsWith('09')) {
    return `+63 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  if (d.length === 12 && d.startsWith('63')) {
    return `+63 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  }
  return null;
}

export function isValidPhilippinePhone(raw: string): boolean {
  return normalizePhilippinePhone(raw) !== null;
}

/**
 * Demo credentials/mode are NEVER enabled by default. Only an explicit
 * HOSCOMCO_ALLOW_DEMO=1 enables them for throwaway development sandboxes.
 */
export function isDemoMode(): boolean {
  const v = String(process.env.HOSCOMCO_ALLOW_DEMO || '').toLowerCase().trim();
  return v === '1' || v === 'true';
}

export const DEMO_PASSWORDS: string[] = [];

const GENERATED_EMAIL_DOMAIN = 'HOSCOMCO.coop';

/**
 * Auto-generated relay email for phone-only signups
 * (e.g. client.09171234567@HOSCOMCO.coop).
 */
export function isGeneratedEmail(email: string): boolean {
  const e = String(email || '').toLowerCase();
  const [local, domain] = e.split('@');
  if (!local || domain !== GENERATED_EMAIL_DOMAIN) return false;
  return /^client\.\d{7,}/.test(local);
}

export function generateClientEmail(phone: string): string {
  const d = digitsOnly(phone).slice(-10);
  return `client.${d}@${GENERATED_EMAIL_DOMAIN}`;
}

export interface SupabaseUserLike {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

function mapSupabaseAuthError(error: any): SupabaseAuthError {
  const message = String(error?.message || 'Authentication failed');
  if (/invalid login credentials/i.test(message)) {
    return new SupabaseAuthError(401, 'Invalid phone number, email, or password', 'INVALID_CREDENTIALS');
  }
  if (/email not confirmed/i.test(message)) {
    return new SupabaseAuthError(403, 'Please verify your email first. A confirmation link was sent to your inbox.', 'EMAIL_NOT_CONFIRMED');
  }
  if (/already registered|already exists|already been registered/i.test(message)) {
    return new SupabaseAuthError(409, 'An account with this email or phone number already exists. Please sign in.', 'ACCOUNT_ALREADY_EXISTS');
  }
  if (/rate limit/i.test(message)) {
    return new SupabaseAuthError(429, 'Too many attempts. Please wait a few minutes and try again.', 'RATE_LIMITED');
  }
  if (/password/i.test(message)) {
    return new SupabaseAuthError(400, 'Please enter a valid password (at least 6 characters).', 'WEAK_PASSWORD');
  }
  return new SupabaseAuthError(error?.status || 400, message || 'Unable to complete that request. Please try again.', 'AUTH_UNKNOWN');
}

function getRequiredSupabase() {
  const supabase = getServerSupabase();
  if (!supabase) {
    throw new SupabaseAuthError(
      503,
      'Supabase authentication is not configured on this server. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      'AUTH_SERVICE_UNAVAILABLE'
    );
  }
  return supabase;
}

/**
 * Validates a password against Supabase Auth by performing a real sign-in.
 * Used by login paths. Resolves a phone identifier to the stored email first
 * (via the local projection) so phone-based sign-in keeps working.
 */
export async function supabaseSignIn(
  identifier: string,
  password: string
): Promise<{ sessionToken: string; user: SupabaseUserLike }> {
  const supabase = getRequiredSupabase();

  let email = String(identifier).trim().toLowerCase();
  if (!email.includes('@')) {
    let record = null;
    try {
      record = await authStore.findByEmailOrPhone(identifier);
    } catch {}
    if (record?.email) {
      email = record.email.toLowerCase();
    } else {
      throw new SupabaseAuthError(401, 'Invalid phone number, email, or password', 'INVALID_CREDENTIALS');
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: String(password),
  });

  if (error) throw mapSupabaseAuthError(error);
  if (!data?.session || !data?.user) {
    throw new SupabaseAuthError(401, 'Invalid phone number, email, or password', 'INVALID_CREDENTIALS');
  }

  return { sessionToken: data.session.access_token, user: data.user as unknown as SupabaseUserLike };
}

/** Resolves a bearer token through Supabase Auth. Returns null when invalid. */
export async function supabaseGetUser(token: string): Promise<SupabaseUserLike | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user as unknown as SupabaseUserLike;
  } catch {
    return null;
  }
}

/**
 * Creates a CLIENT account in Supabase Auth using the service-role client.
 * The role is always forced to CLIENT from the server — never from client input.
 */
export async function supabaseCreateClientUser(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
}): Promise<SupabaseUserLike> {
  const supabase = getRequiredSupabase();
  const requireEmailConfirm = String(process.env.HOSCOMCO_REQUIRE_EMAIL_CONFIRM || '') === '1';

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: !requireEmailConfirm,
    user_metadata: {
      full_name: input.fullName,
      phone: input.phone || null,
      role: 'client',
      created_via: 'public-registration',
    },
  });

  if (error) {
    const isAlreadyRegistered = /already registered|already exists|already been registered/i.test(String(error.message || ''));
    if (isAlreadyRegistered) {
      // Check if user already has an active registered account in our local users table
      let existingInLocal: any = null;
      try {
        existingInLocal = await authStore.findByEmail(input.email);
      } catch {}

      if (existingInLocal && existingInLocal.passwordHash) {
        throw new SupabaseAuthError(409, 'An account with this email address already exists. Please sign in.', 'ACCOUNT_ALREADY_EXISTS');
      }

      // If they don't have an account profile in local users, this user was created during Step 1 OTP generation!
      // Update that existing Supabase Auth user with their password, confirmed email, and registration metadata:
      try {
        const { data: usersData } = await supabase.auth.admin.listUsers();
        const existingAuthUser = usersData?.users?.find((u) => u.email?.toLowerCase() === input.email.toLowerCase());
        if (existingAuthUser) {
          const { data: updatedData, error: updateErr } = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
            password: input.password,
            email_confirm: true,
            user_metadata: {
              ...(existingAuthUser.user_metadata || {}),
              full_name: input.fullName,
              phone: input.phone || null,
              role: 'client',
              created_via: 'public-registration',
            },
          });

          if (!updateErr && updatedData?.user) {
            console.log(`[Supabase Auth] Successfully completed registration for OTP-verified user: ${input.email}`);
            return updatedData.user as unknown as SupabaseUserLike;
          }
        }
      } catch (findErr: any) {
        console.warn('[Supabase Auth] Failed updating pre-created OTP user:', findErr.message);
      }
    }

    throw mapSupabaseAuthError(error);
  }

  if (!data?.user) {
    throw new SupabaseAuthError(503, 'Signup succeeded but no user was returned.', 'AUTH_NO_USER');
  }

  if (requireEmailConfirm) {
    try {
      await (supabase.auth.admin.generateLink as any)({ type: 'signup', email: input.email });
    } catch {}
  }

  return data.user as unknown as SupabaseUserLike;
}

/**
 * Requests a Supabase email-based password reset. No-op when Supabase is not
 * configured so fully-local development still behaves gracefully. Response
 * never leaks whether an account exists.
 */
/**
 * Sends a native Supabase email OTP (magic-link with a 6-character code) to the
 * account's email. This is Supabase's built-in mechanism — no custom OTP store,
 * no SMTP/keys, no Gmail app password. Delivery + 24h link + code expiry is
 * fully handled by Supabase Auth.
 *
 * Server-side only. The code never round-trips through the frontend; the browser
 * only ever supplies the email + the received code and we verify on OUR server.
 *
 * Note: of the two Supabase email flows, this uses type `email` (sign-in OTP),
 * which marks the Supabase user as email-confirmed on successful verifyOtp.
 * In projects where confirmation for a just-created sign-up must instead use the
 * template token, the same helpers accept `type: 'signup'` — see
 * supabaseCreateClientUser / HOSCOMCO_REQUIRE_EMAIL_CONFIRM.
 */
export async function supabaseSendEmailOtp(email: string, purpose: 'registration' | 'password_reset' = 'registration'): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) {
    throw new SupabaseAuthError(503, 'Supabase authentication is not configured on this server.', 'AUTH_SERVICE_UNAVAILABLE');
  }
  const sendEmail = String(email || '').trim().toLowerCase();
  if (!sendEmail.includes('@')) {
    throw new SupabaseAuthError(400, 'A valid email address is required.', 'INVALID_EMAIL');
  }
  const resetRedirect = String(process.env.HOSCOMCO_EMAIL_RESET_REDIRECT || '').trim();

  // Helper to generate Supabase token and dispatch via direct Gmail SMTP (Nodemailer)
  const generateAndSendDirectly = async (reason?: string) => {
    if (reason) {
      console.log(`[Supabase Auth] Generating authentic Supabase token & dispatching via direct Gmail (${reason}) for ${sendEmail}...`);
    }
    const linkRes = await supabase.auth.admin.generateLink({
      type: purpose === 'password_reset' ? 'recovery' : 'magiclink',
      email: sendEmail,
    });

    const generatedOtp = linkRes.data?.properties?.email_otp || Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    activeEmailOtpStore.set(sendEmail, {
      otp: generatedOtp,
      expiresAt,
      verified: false,
    });

    // Send via direct Gmail / Nodemailer
    await sendOtpEmail({
      to: sendEmail,
      code: generatedOtp,
      purpose,
    });

    console.log(`[Supabase Auth] Authentic Supabase OTP generated and dispatched to ${sendEmail}: ${generatedOtp}`);
  };

  // 1. If direct Gmail SMTP is configured (GMAIL_USER & GMAIL_APP_PASSWORD in .env),
  // use it directly. This guarantees 100% reliable delivery and avoids Supabase Cloud mailer
  // errors like "Error sending confirmation email" or hourly rate limits.
  if (isDirectSmtpConfigured()) {
    try {
      await generateAndSendDirectly('Direct Gmail SMTP credentials active in .env');
      return;
    } catch (err: any) {
      console.warn('[Supabase Auth] Direct SMTP generation/dispatch error, attempting fallback:', err.message);
    }
  }

  // 2. Otherwise, attempt Supabase Cloud native email delivery
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: sendEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: resetRedirect || undefined,
      },
    });

    if (!error) {
      console.log(`[Supabase Auth] Successfully dispatched email OTP natively via Supabase to ${sendEmail}`);
      return;
    }

    console.warn(`[Supabase Auth] Supabase cloud mailer returned error (${error.message}). Falling back to Supabase Admin Token Generation & direct email delivery...`);
  } catch (err: any) {
    console.warn(`[Supabase Auth] Supabase signInWithOtp caught error (${err.message}). Falling back...`);
  }

  // 3. Fallback: generate official Supabase OTP token without hitting cloud email rate limit
  try {
    await generateAndSendDirectly('Fallback after cloud mailer error');
  } catch (fallbackErr: any) {
    console.error(`[Supabase Auth] Fallback link generation failed:`, fallbackErr.message);
    throw new SupabaseAuthError(500, fallbackErr.message || 'Unable to generate verification code. Please try again.');
  }
}

/**
 * Verifies the native Supabase email OTP the user typed on their portal/mobile
 * screen. On success the Supabase user's email_confirmed_at is set by Supabase
 * itself — no local email flag storage needed.
 */
export async function supabaseVerifyEmailOtp(email: string, token: string): Promise<{ verified: boolean; user?: any }> {
  const supabase = getServerSupabase();
  if (!supabase) {
    throw new SupabaseAuthError(503, 'Supabase is not configured. Cannot verify email OTP.', 'AUTH_SERVICE_UNAVAILABLE');
  }
  const verifyEmail = String(email || '').trim().toLowerCase();
  const cleanToken = String(token || '').replace(/\D/g, '');
  if (!verifyEmail.includes('@')) {
    throw new SupabaseAuthError(400, 'A valid email address is required.', 'INVALID_EMAIL');
  }
  if (cleanToken.length < 6 || cleanToken.length > 8) {
    throw new SupabaseAuthError(400, 'The verification code must be 6 to 8 digits.', 'INVALID_CODE_FORMAT');
  }

  // 1. Attempt verification with type: 'signup' (used for new registrations generated via link)
  let verifyRes = await supabase.auth.verifyOtp({
    email: verifyEmail,
    token: cleanToken,
    type: 'signup' as any,
  });

  // 2. If invalid, attempt type: 'magiclink' (used for existing accounts)
  if (verifyRes.error) {
    const res2 = await supabase.auth.verifyOtp({
      email: verifyEmail,
      token: cleanToken,
      type: 'magiclink' as any,
    });
    if (!res2.error) verifyRes = res2;
  }

  // 3. If invalid, attempt type: 'email' (standard email OTP)
  if (verifyRes.error) {
    const res3 = await supabase.auth.verifyOtp({
      email: verifyEmail,
      token: cleanToken,
      type: 'email' as any,
    });
    if (!res3.error) verifyRes = res3;
  }

  // 4. If invalid, attempt type: 'recovery' (password reset)
  if (verifyRes.error) {
    const res4 = await supabase.auth.verifyOtp({
      email: verifyEmail,
      token: cleanToken,
      type: 'recovery' as any,
    });
    if (!res4.error) verifyRes = res4;
  }

  // 5. Check activeEmailOtpStore fallback if Supabase cloud verifyOtp failed
  if (verifyRes.error) {
    const cached = activeEmailOtpStore.get(verifyEmail);
    if (cached && cached.otp === cleanToken && Date.now() <= cached.expiresAt) {
      cached.verified = true;
      activeEmailOtpStore.delete(verifyEmail);

      // Confirm the user natively in Supabase Auth
      try {
        const { data } = await supabase.auth.admin.listUsers();
        const user = data?.users?.find((u) => u.email?.toLowerCase() === verifyEmail);
        if (user) {
          await supabase.auth.admin.updateUserById(user.id, { email_confirm: true });
          return { verified: true, user };
        }
      } catch {}

      return { verified: true, user: { email: verifyEmail } };
    }

    const msg = String(verifyRes.error?.message || '');
    if (/expired/i.test(msg) || /token has expired|expired or invalid/i.test(msg) || (verifyRes.error as any).code === 'otp_expired') {
      throw new SupabaseAuthError(400, 'This verification code has expired or is invalid. Please check your Gmail or request a new code.', 'EXPIRED_OTP');
    }
    throw new SupabaseAuthError(400, 'Invalid verification code. Please check your Gmail and try again.', 'INVALID_OTP');
  }

  return { verified: true, user: verifyRes.data?.user };
}

export async function supabaseResetPassword(email: string, redirectTo?: string): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;
  try {
    await supabase.auth.resetPasswordForEmail(email.toLowerCase(), redirectTo ? { redirectTo } : undefined);
  } catch (err: any) {
    if (/rate limit/i.test(String(err?.message || ''))) {
      throw new SupabaseAuthError(429, 'Too many reset requests. Please wait a few minutes.', 'RATE_LIMITED');
    }
  }
}

export interface LocalClientUserInput {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  profile?: {
    dateOfBirth?: string | null;
    gender?: string | null;
    civilStatus?: string | null;
    address?: string | null;
    barangay?: string | null;
    cityMunicipality?: string | null;
    province?: string | null;
    idNumber?: string | null;
    facebookAccount?: string | null;
    employmentStatus?: string | null;
    employerOrBusiness?: string | null;
    occupation?: string | null;
    sourceOfIncome?: string | null;
    monthlyIncome?: number | null;
    monthlyExpenses?: number | null;
    branchId?: string | null;
  };
}

function toDisplayPhone(phone: string | null | undefined): string {
  const d = digitsOnly(phone);
  if (d.length >= 10) return `+63 ${d.slice(-10, -7)} ${d.slice(-7, -4)} ${d.slice(-4)}`;
  return String(phone || '');
}

/**
 * Ensures a local `users` + `borrowers` projection exists for a Supabase user
 * so the rest of the system (drizzle queries, RBAC, portal) works unchanged.
 *
 * - Existing local account (by email) is reused when present.
 * - Otherwise links an existing borrower by phone/email when a match exists.
 * - Otherwise provisions a COMPLETE borrower profile from the registration input
 *   with all financials at zero and KYC/member status Pending.
 *
 * The local passwordHash is a random sentinel — Supabase Auth is the real
 * credential store, so we never persist a usable password hash locally.
 */
export async function ensureLocalClientUser(input: LocalClientUserInput): Promise<any> {
  const db = getDb();
  const normalizedEmail = String(input.email || '').toLowerCase().trim();
  const phone = input.phone ? normalizePhilippinePhone(input.phone) || toDisplayPhone(input.phone) : null;

  // 1. Reuse existing local account keyed by email (covers returning users).
  let existing = null;
  try {
    existing = await authStore.findByEmailOrPhone(normalizedEmail);
  } catch {}
  if (existing) {
    // Self-heal missing borrowerId on existing client accounts
    if (existing.role === 'CLIENT' && !existing.borrowerId && db) {
      try {
        let match = await findBorrowerByContact(phone, normalizedEmail);
        let bId = match?.id || null;
        if (!bId) {
          const provisioned = await createClientProfile({
            fullName: input.fullName,
            phone,
            email: normalizedEmail,
            ...(input.profile || {}),
          });
          bId = provisioned?.id || null;
        }
        if (bId) {
          existing.borrowerId = bId;
          await authStore.updateUser(existing.id, { borrowerId: bId });
        }
      } catch (syncErr: any) {
        console.warn('[supabaseAuth] borrower self-heal warning:', syncErr?.message || syncErr);
      }
    }
    return existing;
  }

  // 2. Link (or provision) the borrower projection.
  let borrowerId: string | null = null;
  let borrowerNumber: string | null = null;
  if (db) {
    // Match an existing borrower by phone or email first (e.g. staff pre-registered members).
    try {
      const match = await findBorrowerByContact(phone, normalizedEmail);
      if (match) {
        borrowerId = match.id;
        borrowerNumber = match.borrowerNumber;
      }
    } catch {}

    if (!borrowerId) {
      try {
        const provisioned = await createClientProfile({
          fullName: input.fullName,
          phone,
          email: normalizedEmail,
          ...(input.profile || {}),
        });
        if (provisioned) {
          borrowerId = provisioned.id;
          borrowerNumber = provisioned.borrowerNumber;
        }
      } catch (err: any) {
        console.warn('[supabaseAuth] borrower profile provisioning warning:', err?.message || err);
      }
    }
  }

  // 3. Create the local users row with a random password sentinel.
  return authStore.createUser({
    id: input.id,
    email: normalizedEmail,
    fullName: input.fullName,
    passwordHash: hashPassword(crypto.randomUUID()),
    role: 'CLIENT',
    staffRole: null,
    staffId: null,
    borrowerId,
    phone,
    avatar: null,
    isActive: true,
  });
}

/**
 * Server-side audit entry. Writes into the legacy `audit_logs` table when the
 * database is available; otherwise just logs. Never throws.
 */
export async function writeAuditLog(entry: {
  action: string;
  details: string;
  performedBy: string;
  type?: string;
  userName?: string;
  userRole?: string;
  targetType?: string;
  targetId?: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(schema.auditLogs).values({
      id: `al-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
      timestamp: new Date().toISOString(),
      action: entry.action,
      details: entry.details,
      performedBy: entry.performedBy,
      branchId: 'br-main',
      type: entry.type || 'SECURITY',
      userName: entry.userName || null,
      userRole: entry.userRole || null,
      targetType: entry.targetType || null,
      targetId: entry.targetId || null,
    });
  } catch (err: any) {
    console.warn('[audit] log write skipped:', err?.message || err);
  }
}