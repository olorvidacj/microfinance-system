import crypto from 'crypto';
import { getDb, schema, markConnectionStringFailed } from '../db/index';
import { initDbSchema } from '../db/initDb';
import { getServerSupabase } from '../db/supabaseServer';
import { INITIAL_STAFF, INITIAL_BORROWERS } from '../data/initialData';
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

export const DEFAULT_ADMIN_PASS_HASH = hashPassword(process.env.HOSCOMO_BOOTSTRAP_PASSWORD || 'Admin@123');
export const DEFAULT_CLIENT_PASS_HASH = hashPassword('Client@123');

export function verifyPassword(password: string, stored: string): boolean {
  try {
    if (!stored || !password) return false;
    // Allow direct match
    if (stored === password) return true;

    // Standard demo passwords accepted for initial demo accounts
    const devPasswords = ['Admin@123', 'Staff@123', 'Client@123', 'admin123', 'staff123', 'client123', 'password123'];
    if (devPasswords.includes(password)) {
      if (stored === DEFAULT_ADMIN_PASS_HASH || stored === DEFAULT_CLIENT_PASS_HASH) {
        return true;
      }
    }

    const [salt, expectedHash] = stored.split(':');
    if (!salt || !expectedHash) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ---------- In-Memory Fallback User Store ----------

const inMemoryUsers = new Map<string, AuthUserRecord>();

// Pre-seed default Administrator
const defaultAdmin: AuthUserRecord = {
  id: 'u-bootstrap-admin',
  email: (process.env.HOSCOMO_BOOTSTRAP_EMAIL || 'admin@hoscomo.coop').toLowerCase(),
  passwordHash: DEFAULT_ADMIN_PASS_HASH,
  fullName: 'System Administrator',
  role: 'STAFF',
  staffRole: 'ADMINISTRATOR',
  staffId: 'staff-08',
  phone: '+63 917 555 0100',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  isActive: true,
  branchId: 'all',
};
inMemoryUsers.set(defaultAdmin.id, defaultAdmin);

// Seed initial staff
for (const s of INITIAL_STAFF) {
  const staffUserId = `u-${s.id}`;
  if (!inMemoryUsers.has(staffUserId)) {
    inMemoryUsers.set(staffUserId, {
      id: staffUserId,
      email: s.email.toLowerCase(),
      passwordHash: DEFAULT_ADMIN_PASS_HASH,
      fullName: s.name,
      role: 'STAFF',
      staffRole: s.role,
      staffId: s.id,
      phone: '+63 917 555 0100',
      avatar: s.avatar,
      isActive: true,
      branchId: s.assignedBranchId || null,
    });
  }
}

// Seed initial client borrowers
for (const b of INITIAL_BORROWERS) {
  const clientUserId = `u-${b.id}`;
  if (!inMemoryUsers.has(clientUserId)) {
    inMemoryUsers.set(clientUserId, {
      id: clientUserId,
      email: b.email.toLowerCase(),
      passwordHash: DEFAULT_CLIENT_PASS_HASH,
      fullName: b.fullName,
      role: 'CLIENT',
      staffRole: null,
      staffId: null,
      borrowerId: b.id,
      phone: b.phone,
      avatar: null,
      isActive: b.memberStatus !== 'Inactive' && b.memberStatus !== 'Rejected' && b.memberStatus !== 'Resigned',
      branchId: b.branchId || null,
    });
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

// ---------- Real Database & In-Memory Fallback User Store ----------

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
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('ENOTFOUND') || msg.includes('tenant') || msg.includes('ECONNREFUSED')) {
          markConnectionStringFailed();
        }
      }
    }

    // Check in-memory staff
    const match = INITIAL_STAFF.find((s) => s.id === staffId);
    if (match && match.assignedBranchId && match.assignedBranchId !== 'all') {
      return match.assignedBranchId;
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
    
    // 1. Check Primary Postgres Database (Drizzle ORM) if available
    const db = getDb();
    if (db) {
      try {
        const rows = await db.select().from(schema.users).where(eq(schema.users.email, normalized)).limit(1);
        if (rows.length > 0) return this.decorate(rows[0] as unknown as AuthUserRecord);
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('ENOTFOUND') || msg.includes('tenant') || msg.includes('ECONNREFUSED')) {
          markConnectionStringFailed();
        }
      }
    }

    // 2. Check Supabase Server Client if configured
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
      } catch {
        /* ignore */
      }
    }

    // 3. Check In-Memory Store
    for (const u of inMemoryUsers.values()) {
      if (u.email && u.email.toLowerCase() === normalized) {
        return this.decorate({ ...u });
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

    // 2. Lookup in PostgreSQL DB if available
    const db = getDb();
    if (db) {
      try {
        const rows = await db.select().from(schema.users);
        const match = rows.find((u) => {
          if (u.email && u.email.toLowerCase() === normalizedEmail) return true;
          if (!u.phone) return false;
          const uDigits = String(u.phone).replace(/\D/g, '');
          return cleanDigits.length > 0 && (uDigits === cleanDigits || cleanDigits.endsWith(uDigits.slice(-10)) || uDigits.endsWith(cleanDigits.slice(-10)));
        });
        if (match) return this.decorate(match as unknown as AuthUserRecord);
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('ENOTFOUND') || msg.includes('tenant') || msg.includes('ECONNREFUSED')) {
          markConnectionStringFailed();
        }
      }
    }

    // 3. Lookup in Supabase Table if available
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
            return cleanDigits.length > 0 && (uDigits === cleanDigits || cleanDigits.endsWith(uDigits.slice(-10)) || uDigits.endsWith(cleanDigits.slice(-10)));
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
      } catch {
        /* ignore */
      }
    }

    // 4. Fallback to In-Memory Store
    for (const u of inMemoryUsers.values()) {
      if (u.email && u.email.toLowerCase() === normalizedEmail) {
        return this.decorate({ ...u });
      }
      if (u.phone && cleanDigits.length >= 7) {
        const uDigits = String(u.phone).replace(/\D/g, '');
        if (
          uDigits === cleanDigits ||
          (cleanDigits.length >= 10 && uDigits.endsWith(cleanDigits.slice(-10))) ||
          (uDigits.length >= 10 && cleanDigits.endsWith(uDigits.slice(-10)))
        ) {
          return this.decorate({ ...u });
        }
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
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('ENOTFOUND') || msg.includes('tenant') || msg.includes('ECONNREFUSED')) {
          markConnectionStringFailed();
        }
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
      } catch {
        /* ignore */
      }
    }

    const inMem = inMemoryUsers.get(id);
    if (inMem) {
      return this.decorate({ ...inMem });
    }

    return null;
  }

  async updateUser(id: string, updates: Partial<AuthUserRecord>): Promise<AuthUserRecord | null> {
    const existing = inMemoryUsers.get(id);
    if (existing) {
      const updated: AuthUserRecord = {
        ...existing,
        ...updates,
        email: updates.email ? updates.email.toLowerCase() : existing.email,
      };
      inMemoryUsers.set(id, updated);
    }

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
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('ENOTFOUND') || msg.includes('tenant') || msg.includes('ECONNREFUSED')) {
          markConnectionStringFailed();
        }
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
      } catch {
        /* ignore */
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

    // Save to in-memory store
    inMemoryUsers.set(user.id, { ...user });

    // Try primary PostgreSQL Database if healthy
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
        const msg = String(err?.message || '');
        if (msg.includes('ENOTFOUND') || msg.includes('tenant') || msg.includes('ECONNREFUSED')) {
          markConnectionStringFailed();
        }
      }
    }

    // Try Supabase table if configured
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
      } catch {
        /* ignore */
      }
    }

    return (await this.decorate(user))!;
  }

  async touchLogin(id: string): Promise<void> {
    const mem = inMemoryUsers.get(id);
    if (mem) {
      inMemoryUsers.set(id, { ...mem });
    }
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
  // Initializes DB schema tables if database connection is available
  await initDbSchema().catch(() => {});

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
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('ENOTFOUND') || msg.includes('tenant') || msg.includes('ECONNREFUSED')) {
      markConnectionStringFailed();
    }
  }
}

