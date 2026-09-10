import crypto from 'crypto';
import { getDb, schema } from '../db/index';
import { initDbSchema } from '../db/initDb';
import { getServerSupabase } from '../db/supabaseServer';
import { eq, or, ilike } from 'drizzle-orm';

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'STAFF' | 'CLIENT';
  staffRole?: string | null;
  staffId?: string | null;
  borrowerId?: string | null;
  phone?: string | null;
  avatar?: string | null;
  isActive?: boolean | null;
  branchId?: string | null;
}

export interface TokenPayload {
  sub: string;
  role: 'STAFF' | 'CLIENT';
  staffRole?: string | null;
  email: string;
  borrowerId?: string | null;
  staffId?: string | null;
  branchId?: string | null;
  exp: number;
}

const AUTH_SECRET = process.env.AUTH_SECRET || 'hoscomo-dev-secret-change-me';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------- Password Hashing (scrypt, no external deps) ----------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    if (!stored) return false;
    const [salt, expectedHash] = stored.split(':');
    if (!salt || !expectedHash) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ---------- Signed Tokens (HMAC-SHA256) ----------

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signToken(user: {
  id: string;
  role: string;
  staffRole?: string | null;
  email: string;
  borrowerId?: string | null;
  staffId?: string | null;
  branchId?: string | null;
}): string {
  const payload: TokenPayload = {
    sub: user.id,
    role: user.role as 'STAFF' | 'CLIENT',
    staffRole: user.staffRole || null,
    email: user.email,
    borrowerId: user.borrowerId || null,
    staffId: user.staffId || null,
    branchId: user.branchId || null,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Real Database & Supabase User Store ----------

class AuthStore {
  async resolveBranchId(staffId?: string | null): Promise<string | null> {
    if (!staffId) return null;
    const db = getDb();
    if (db) {
      try {
        const rows = await db
          .select()
          .from(schema.staff)
          .where(eq(schema.staff.id, staffId))
          .limit(1);
        if (rows.length > 0 && rows[0].assignedBranchId && rows[0].assignedBranchId !== 'all') {
          return rows[0].assignedBranchId;
        }
      } catch (err) {
        console.warn('[AuthStore] resolveBranchId warning:', err);
      }
    }
    return null;
  }

  private async decorate(record: AuthUserRecord | null): Promise<AuthUserRecord | null> {
    if (!record) return null;
    if (record.branchId == null) {
      record.branchId = await this.resolveBranchId(record.staffId);
    }
    return record;
  }

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const normalized = email.trim().toLowerCase();
    
    // 1. Check Primary Postgres Database (Drizzle ORM)
    const db = getDb();
    if (db) {
      try {
        const rows = await db.select().from(schema.users).where(eq(schema.users.email, normalized)).limit(1);
        if (rows.length > 0) return this.decorate(rows[0] as unknown as AuthUserRecord);
      } catch (err) {
        console.warn('[AuthStore] DB query by email warning:', err);
      }
    }

    // 2. Check Supabase Server Client
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .ilike('email', normalized)
          .maybeSingle();
        if (!error && data) {
          const rec: AuthUserRecord = {
            id: data.id,
            email: data.email,
            passwordHash: data.password_hash || data.passwordHash || '',
            fullName: data.full_name || data.fullName || data.email,
            role: data.role || 'CLIENT',
            staffRole: data.staff_role || data.staffRole || null,
            staffId: data.staff_id || data.staffId || null,
            borrowerId: data.borrower_id || data.borrowerId || null,
            phone: data.phone || null,
            avatar: data.avatar || null,
            isActive: data.is_active !== undefined ? data.is_active : true,
          };
          return this.decorate(rec);
        }
      } catch (sbErr) {
        console.warn('[AuthStore] Supabase findByEmail error:', sbErr);
      }
    }

    return null;
  }

  async findByEmailOrPhone(identifier: string): Promise<AuthUserRecord | null> {
    if (!identifier) return null;
    const cleanRaw = String(identifier).trim();
    const normalizedEmail = cleanRaw.toLowerCase();
    const cleanDigits = cleanRaw.replace(/\D/g, '');

    // 1. Direct Email Lookup
    if (cleanRaw.includes('@')) {
      return this.findByEmail(normalizedEmail);
    }

    // 2. Lookup in PostgreSQL DB
    const db = getDb();
    if (db) {
      try {
        const rows = await db.select().from(schema.users);
        const match = rows.find((u) => {
          if (u.email && u.email.toLowerCase() === normalizedEmail) return true;
          if (!u.phone) return false;
          const uDigits = String(u.phone).replace(/\D/g, '');
          return cleanDigits.length > 0 && uDigits === cleanDigits;
        });
        if (match) return this.decorate(match as unknown as AuthUserRecord);
      } catch (err) {
        console.warn('[AuthStore] DB query by phone warning:', err);
      }
    }

    // 3. Lookup in Supabase Table
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*');
        if (!error && Array.isArray(data)) {
          const match = data.find((u: any) => {
            const uEmail = (u.email || '').toLowerCase();
            if (uEmail === normalizedEmail) return true;
            const uPhone = String(u.phone || '');
            const uDigits = uPhone.replace(/\D/g, '');
            return cleanDigits.length > 0 && uDigits === cleanDigits;
          });
          if (match) {
            const rec: AuthUserRecord = {
              id: match.id,
              email: match.email,
              passwordHash: match.password_hash || match.passwordHash || '',
              fullName: match.full_name || match.fullName || match.email,
              role: match.role || 'CLIENT',
              staffRole: match.staff_role || match.staffRole || null,
              staffId: match.staff_id || match.staffId || null,
              borrowerId: match.borrower_id || match.borrowerId || null,
              phone: match.phone || null,
              avatar: match.avatar || null,
              isActive: match.is_active !== undefined ? match.is_active : true,
            };
            return this.decorate(rec);
          }
        }
      } catch (sbErr) {
        console.warn('[AuthStore] Supabase findByEmailOrPhone error:', sbErr);
      }
    }

    return null;
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    if (!id) return null;
    const db = getDb();
    if (db) {
      try {
        const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
        if (rows.length > 0) return this.decorate(rows[0] as unknown as AuthUserRecord);
      } catch (err) {
        console.warn('[AuthStore] DB findById warning:', err);
      }
    }

    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
        if (!error && data) {
          const rec: AuthUserRecord = {
            id: data.id,
            email: data.email,
            passwordHash: data.password_hash || data.passwordHash || '',
            fullName: data.full_name || data.fullName || data.email,
            role: data.role || 'CLIENT',
            staffRole: data.staff_role || data.staffRole || null,
            staffId: data.staff_id || data.staffId || null,
            borrowerId: data.borrower_id || data.borrowerId || null,
            phone: data.phone || null,
            avatar: data.avatar || null,
            isActive: data.is_active !== undefined ? data.is_active : true,
          };
          return this.decorate(rec);
        }
      } catch (sbErr) {
        console.warn('[AuthStore] Supabase findById error:', sbErr);
      }
    }

    return null;
  }

  async updateUser(id: string, updates: Partial<AuthUserRecord>): Promise<AuthUserRecord | null> {
    const db = getDb();
    if (db) {
      try {
        await db
          .update(schema.users)
          .set({
            ...(updates.fullName ? { fullName: updates.fullName } : {}),
            ...(updates.email ? { email: updates.email.toLowerCase() } : {}),
            ...(updates.phone ? { phone: updates.phone } : {}),
            ...(updates.avatar ? { avatar: updates.avatar } : {}),
            ...(updates.borrowerId ? { borrowerId: updates.borrowerId } : {}),
            ...(updates.staffId !== undefined ? { staffId: updates.staffId } : {}),
            ...(updates.staffRole !== undefined ? { staffRole: updates.staffRole } : {}),
            ...(updates.role !== undefined ? { role: updates.role } : {}),
            ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
          })
          .where(eq(schema.users.id, id));
      } catch (err) {
        console.warn('[AuthStore] DB updateUser error:', err);
      }
    }

    const supabase = getServerSupabase();
    if (supabase) {
      try {
        await supabase
          .from('users')
          .update({
            ...(updates.fullName ? { full_name: updates.fullName } : {}),
            ...(updates.email ? { email: updates.email.toLowerCase() } : {}),
            ...(updates.phone ? { phone: updates.phone } : {}),
            ...(updates.avatar ? { avatar: updates.avatar } : {}),
            ...(updates.borrowerId ? { borrower_id: updates.borrowerId } : {}),
            ...(updates.staffId !== undefined ? { staff_id: updates.staffId } : {}),
            ...(updates.staffRole !== undefined ? { staff_role: updates.staffRole } : {}),
            ...(updates.role !== undefined ? { role: updates.role } : {}),
            ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
          })
          .eq('id', id);
      } catch (sbErr) {
        console.warn('[AuthStore] Supabase updateUser error:', sbErr);
      }
    }

    return this.findById(id);
  }

  async createUser(data: Omit<AuthUserRecord, 'id'> & { id?: string }): Promise<AuthUserRecord> {
    const userId = data.id || `u-${crypto.randomUUID()}`;
    const user: AuthUserRecord = {
      id: userId,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      role: data.role,
      staffRole: data.staffRole || null,
      staffId: data.staffId || null,
      borrowerId: data.borrowerId || null,
      phone: data.phone || null,
      avatar: data.avatar || null,
      isActive: true,
    };

    // 1. Insert into PostgreSQL Database
    const db = getDb();
    if (db) {
      try {
        await db.insert(schema.users).values({
          id: user.id,
          email: user.email,
          passwordHash: user.passwordHash,
          fullName: user.fullName,
          role: user.role,
          staffRole: user.staffRole,
          staffId: user.staffId,
          borrowerId: user.borrowerId,
          phone: user.phone,
          avatar: user.avatar,
        });
      } catch (err: any) {
        console.warn('[AuthStore] DB insert user:', err.message);
      }
    }

    // 2. Sync to Supabase table
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        await supabase.from('users').upsert({
          id: user.id,
          email: user.email,
          password_hash: user.passwordHash,
          full_name: user.fullName,
          role: user.role,
          staff_role: user.staffRole,
          staff_id: user.staffId,
          borrower_id: user.borrowerId,
          phone: user.phone,
          avatar: user.avatar,
          is_active: true,
        });
      } catch (sbErr) {
        console.warn('[AuthStore] Supabase table insert error:', sbErr);
      }
    }

    return this.decorate(user);
  }

  async touchLogin(id: string): Promise<void> {
    const db = getDb();
    if (db) {
      try {
        await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, id));
      } catch {}
    }
  }
}

export const authStore = new AuthStore();

export async function ensureDefaultUsers(): Promise<void> {
  // Initializes DB schema tables if not yet created. No demo/mock accounts are inserted.
  await initDbSchema().catch(() => {});

  // Bootstrap a single initial administrator account so that the first staff users
  // can be provisioned through the admin console. Created only when the users table
  // is completely empty (idempotent) and can be disabled with HOSCOMO_SKIP_BOOTSTRAP=1.
  if (process.env.HOSCOMO_SKIP_BOOTSTRAP === '1') return;
  try {
    const db = getDb();
    if (!db) return;
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
    if (existing) return;

    const password = process.env.HOSCOMO_BOOTSTRAP_PASSWORD || 'Admin@123';
    await db.insert(schema.users).values({
      id: 'u-bootstrap-admin',
      email: process.env.HOSCOMO_BOOTSTRAP_EMAIL || 'admin@hoscomo.coop',
      passwordHash: hashPassword(password),
      fullName: 'System Administrator',
      role: 'STAFF',
      staffRole: 'ADMINISTRATOR',
      staffId: 'staff-08',
      isActive: true,
    });
    console.warn('[Auth] Bootstrap administrator created: admin@hoscomo.coop (change the password immediately).');
  } catch (err: any) {
    console.warn('[Auth] Bootstrap admin creation skipped:', err.message);
  }
}

