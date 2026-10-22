import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { HttpError } from '../kyc/errors';

/**
 * The local file store under uploads/, used for branch documents when
 * Supabase Storage is not available (development, or production with
 * ALLOW_LOCAL_FILE_STORAGE=true). Files are served only through signed,
 * expiring links, like Supabase signed URLs:
 *
 *   /api/storage/<token>    token = base64url({ k, p, e }) "." HMAC-SHA256
 *
 * k is fixed to "uploads", so a KYC file token (src/kyc/storage.ts) never
 * opens a file here, and no token opens a file outside uploads/ or under kyc/.
 */

export const LOCAL_FILE_LINK_TTL_SECONDS = 600;
const KIND = 'uploads';

export function uploadsRoot(): string {
  return path.resolve(process.cwd(), 'uploads');
}

function secret(): string {
  const s = process.env.FILE_LINK_SECRET || process.env.AUTH_SECRET;
  if (!s) throw new HttpError(500, 'FILE_LINK_SECRET (or AUTH_SECRET) must be set to serve stored files.', 'CONFIG');
  return s;
}

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hmac = (payload: string) => b64url(crypto.createHmac('sha256', secret()).update(payload).digest());

/**
 * The absolute path of a stored file, or null when the path would leave
 * uploads/ (after resolving "..", absolute paths and backslashes) or point
 * into kyc/, where identity documents never live.
 */
export function resolveUploadPath(relative: string): string | null {
  const rel = String(relative ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.includes('\0')) return null;
  const root = uploadsRoot();
  const full = path.resolve(root, rel);
  if (!full.startsWith(root + path.sep)) return null;
  const first = path.relative(root, full).split(path.sep)[0].toLowerCase();
  if (first === 'kyc') return null;
  return full;
}

/** Whether a file is in the local store. */
export function existsInUploads(relative: string): boolean {
  const full = resolveUploadPath(relative);
  return Boolean(full && fs.existsSync(full) && fs.statSync(full).isFile());
}

/** A signed link to a file under uploads/, valid for ttlSeconds. */
export function signedUploadLink(relative: string, ttlSeconds = LOCAL_FILE_LINK_TTL_SECONDS, now = Date.now()): string {
  if (!resolveUploadPath(relative)) throw new HttpError(404, 'File not found.', 'NOT_FOUND');
  const rel = relative.replace(/\\/g, '/').replace(/^\/+/, '');
  const payload = b64url(Buffer.from(JSON.stringify({ k: KIND, p: rel, e: Math.floor(now / 1000) + ttlSeconds })));
  return `/api/storage/${payload}.${hmac(payload)}`;
}

export type UploadTokenCheck = { path: string } | { refused: 'FORGED' | 'EXPIRED' };

/** Checks a token's signature and expiry; the path it names is returned only when both hold. */
export function verifyUploadToken(token: string, now = Date.now()): UploadTokenCheck {
  const [payload, sig, extra] = String(token ?? '').split('.');
  if (!payload || !sig || extra !== undefined) return { refused: 'FORGED' };
  const expected = hmac(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return { refused: 'FORGED' };
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    // A payload we signed is always JSON; anything else was not made by this server.
    return { refused: 'FORGED' };
  }
  const t = decoded as { k?: unknown; p?: unknown; e?: unknown };
  if (t.k !== KIND || typeof t.p !== 'string' || typeof t.e !== 'number') return { refused: 'FORGED' };
  if (t.e * 1000 < now) return { refused: 'EXPIRED' };
  return { path: t.p };
}

/** A new, unguessable file name (no timestamp, no Math.random). */
export function newStoredFileName(ext: string): string {
  return `${crypto.randomUUID()}.${ext}`;
}
