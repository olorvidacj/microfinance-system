import crypto from 'crypto';
import { getDb, schema } from '../db/index';
import { initDbSchema } from '../db/initDb';
import { eq } from 'drizzle-orm';

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
}

export interface TokenPayload {
  sub: string;
  role: 'STAFF' | 'CLIENT';
  email: string;
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

export function signToken(user: { id: string; role: string; email: string }): string {
  const payload: TokenPayload = {
    sub: user.id,
    role: user.role as 'STAFF' | 'CLIENT',
    email: user.email,
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

// ---------- User Store (DB-backed, in-memory fallback when no database) ----------

interface MemoryUser extends AuthUserRecord {
  createdAt: Date;
}

class AuthStore {
  private memoryUsers: Map<string, MemoryUser> = new Map();

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const normalized = email.trim().toLowerCase();
    const db = getDb();
    if (db) {
      try {
        const rows = await db.select().from(schema.users).where(eq(schema.users.email, normalized)).limit(1);
        if (rows.length > 0) return rows[0] as unknown as AuthUserRecord;
        return null;
      } catch (err: any) {
        // If relation doesn't exist yet, attempt table initialization and retry once
        try {
          await initDbSchema();
          const retryRows = await db.select().from(schema.users).where(eq(schema.users.email, normalized)).limit(1);
          if (retryRows.length > 0) return retryRows[0] as unknown as AuthUserRecord;
          return null;
        } catch (innerErr: any) {
          console.warn('[Auth] DB user lookup failed, falling back to memory store:', innerErr.message);
        }
      }
    }
    return this.memoryUsers.get(normalized) || null;
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const db = getDb();
    if (db) {
      try {
        const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
        if (rows.length > 0) return rows[0] as unknown as AuthUserRecord;
        return null;
      } catch {}
    }
    for (const u of this.memoryUsers.values()) {
      if (u.id === id) return u;
    }
    return null;
  }

  async createUser(data: Omit<AuthUserRecord, 'id'>): Promise<AuthUserRecord> {
    const user: AuthUserRecord = { ...data, id: `u-${crypto.randomUUID()}` };
    const db = getDb();
    if (db) {
      try {
        await db.insert(schema.users).values(user as any);
        return user;
      } catch (err: any) {
        try {
          await initDbSchema();
          await db.insert(schema.users).values(user as any);
          return user;
        } catch (innerErr: any) {
          console.warn('[Auth] DB insert failed, using memory store:', innerErr.message);
        }
      }
    }
    this.memoryUsers.set(user.email.toLowerCase(), { ...user, createdAt: new Date() });
    return user;
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

// ---------- Default Accounts ----------

const DEFAULT_USERS: Array<Omit<AuthUserRecord, 'id'> & { password: string }> = [
  {
    email: 'elena.rostata@hoscomo.coop',
    password: 'Admin@123',
    fullName: 'Elena Rostata',
    passwordHash: '',
    role: 'STAFF',
    staffRole: 'SUPER_ADMIN',
    staffId: 's-1',
    borrowerId: null,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  },
  {
    email: 'grace.m@hoscomo.coop',
    password: 'Staff@123',
    fullName: 'Grace Mendoza',
    passwordHash: '',
    role: 'STAFF',
    staffRole: 'LOAN_PROCESSOR',
    staffId: 's-4',
    borrowerId: null,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  {
    email: 'teresa.alcantara@gmail.com',
    password: 'Client@123',
    fullName: 'Teresa Alcantara',
    passwordHash: '',
    role: 'CLIENT',
    staffRole: null,
    staffId: null,
    borrowerId: 'b-1',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
  },
];

let defaultsReady = false;

export async function ensureDefaultUsers(): Promise<void> {
  if (defaultsReady) return;
  defaultsReady = true;
  await initDbSchema().catch(() => {});
  for (const def of DEFAULT_USERS) {
    const existing = await authStore.findByEmail(def.email);
    if (existing) continue;
    await authStore.createUser({
      email: def.email.toLowerCase(),
      fullName: def.fullName,
      passwordHash: hashPassword(def.password),
      role: def.role,
      staffRole: def.staffRole,
      staffId: def.staffId,
      borrowerId: def.borrowerId,
      phone: def.phone ?? null,
      avatar: def.avatar,
    });
  }
}
