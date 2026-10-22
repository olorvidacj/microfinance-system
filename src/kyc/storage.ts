import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getServerSupabase, isSupabaseConfigured } from '../db/supabaseServer';
import { HttpError } from './errors';

/**
 * Private storage for KYC documents.
 *
 * With Supabase configured, objects go to the private 'kyc-documents' bucket
 * (0018/0023) through the service-role client. Without it (local development),
 * they are written outside every publicly served directory. In both cases the
 * database stores only the object path, and viewers get a short-lived signed
 * URL minted after an authorization check.
 */

export const KYC_BUCKET = 'kyc-documents';
export const SIGNED_URL_TTL_SECONDS = 300;

export type StorageBackend = 'supabase' | 'local';

export interface StoredObjectRef {
  backend: StorageBackend;
  path: string;
}

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export function localStorageRoot(): string {
  return path.resolve(process.env.KYC_LOCAL_STORAGE_DIR || path.join(process.cwd(), '.data', 'kyc-documents'));
}

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new HttpError(500, 'AUTH_SECRET must be set to serve private documents.', 'CONFIG');
  return secret;
}

function safeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'x';
}

export function activeBackend(): StorageBackend {
  return getServerSupabase() ? 'supabase' : 'local';
}

/**
 * The service-role client uploads go through. On a server pointed at Supabase
 * without the service-role key, uploads are refused: the public key would be
 * refused by the bucket's RLS, and the server's own disk is not where a
 * deployment's documents belong.
 */
function uploadClient() {
  const supabase = getServerSupabase();
  if (!supabase && isSupabaseConfigured() && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(503, 'Document storage is not set up on this server (SUPABASE_SERVICE_ROLE_KEY is missing).', 'STORAGE_UNAVAILABLE');
  }
  return supabase;
}

export async function putKycObject(input: {
  borrowerId: string;
  kind: string;
  buffer: Buffer;
  mime: string;
}): Promise<StoredObjectRef> {
  const ext = EXTENSIONS[input.mime];
  if (!ext) throw new HttpError(415, 'Unsupported file type.', 'UNSUPPORTED_TYPE');
  const objectPath = `kyc/${safeSegment(input.borrowerId)}/${safeSegment(input.kind)}/${crypto.randomUUID()}.${ext}`;

  const supabase = uploadClient();
  if (supabase) {
    const { error } = await supabase.storage
      .from(KYC_BUCKET)
      .upload(objectPath, input.buffer, { contentType: input.mime, upsert: false });
    if (error) throw new HttpError(502, `The document could not be stored (${error.message}). Please try again.`, 'STORAGE_FAILED');
    return { backend: 'supabase', path: objectPath };
  }

  const full = path.join(localStorageRoot(), objectPath);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, input.buffer, { flag: 'wx' });
  return { backend: 'local', path: objectPath };
}

export async function readKycObject(ref: StoredObjectRef): Promise<Buffer> {
  if (ref.backend === 'supabase') {
    const supabase = getServerSupabase();
    if (!supabase) throw new HttpError(503, 'Document storage is not configured on this server.', 'STORAGE_UNAVAILABLE');
    const { data, error } = await supabase.storage.from(KYC_BUCKET).download(ref.path);
    if (error || !data) throw new HttpError(502, `The document could not be read (${error?.message ?? 'empty'}).`, 'STORAGE_FAILED');
    return Buffer.from(await data.arrayBuffer());
  }
  return fs.promises.readFile(resolveLocalPath(ref.path));
}

function resolveLocalPath(objectPath: string): string {
  const root = localStorageRoot();
  const full = path.resolve(root, objectPath);
  if (!full.startsWith(root + path.sep)) throw new HttpError(400, 'Invalid document path.', 'BAD_PATH');
  return full;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hmac(payload: string): string {
  return b64url(crypto.createHmac('sha256', signingSecret()).update(payload).digest());
}

export function signLocalToken(objectPath: string, ttlSeconds: number, now = Date.now()): string {
  const payload = b64url(Buffer.from(JSON.stringify({ p: objectPath, e: Math.floor(now / 1000) + ttlSeconds })));
  return `${payload}.${hmac(payload)}`;
}

/** Returns the object path a local file token grants, or null if it is forged or expired. */
export function verifyLocalToken(token: string, now = Date.now()): string | null {
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const { p, e } = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (typeof p !== 'string' || typeof e !== 'number' || e * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}

export async function signedKycUrl(ref: StoredObjectRef, ttlSeconds = SIGNED_URL_TTL_SECONDS): Promise<string> {
  if (ref.backend === 'supabase') {
    const supabase = getServerSupabase();
    if (!supabase) throw new HttpError(503, 'Document storage is not configured on this server.', 'STORAGE_UNAVAILABLE');
    const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUrl(ref.path, ttlSeconds);
    if (error || !data?.signedUrl) throw new HttpError(502, 'Could not create a document link.', 'STORAGE_FAILED');
    return data.signedUrl;
  }
  return `/api/kyc/files/${signLocalToken(ref.path, ttlSeconds)}`;
}

export async function openLocalObject(token: string): Promise<{ stream: fs.ReadStream; mime: string } | null> {
  const objectPath = verifyLocalToken(token);
  if (!objectPath) return null;
  const full = resolveLocalPath(objectPath);
  try {
    await fs.promises.access(full);
  } catch {
    return null;
  }
  const ext = path.extname(full).slice(1);
  const mime = Object.entries(EXTENSIONS).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
  return { stream: fs.createReadStream(full), mime };
}
