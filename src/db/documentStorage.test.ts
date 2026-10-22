import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Branch documents: stored in Supabase Storage; on this server's disk only in
 * development or when ALLOW_LOCAL_FILE_STORAGE=true, under an unguessable name,
 * and handed back as a signed link, never a raw path.
 */

let supabase: SupabaseClient | null = null;
vi.mock('./supabaseServer', () => ({ getServerSupabase: () => supabase }));

const { storeDocument } = await import('./documentStorage');
const { verifyUploadToken } = await import('./localFiles');

const failingSupabase = (): SupabaseClient =>
  ({ storage: { from: () => ({ upload: async () => ({ error: new Error('bucket unreachable') }) }) } }) as unknown as SupabaseClient;
const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 '.padEnd(400, 'x')).toString('base64')}`;
const store = () => storeDocument({ scope: 'branch-documents', ownerId: 'cli-1', folder: 'Loan Agreement', base64: pdf, fileName: 'agreement.pdf' });

let dir: string;
const env = { ...process.env };
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-store-'));
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  process.env.FILE_LINK_SECRET = 'doc-store-test-secret';
  supabase = null;
});
afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...env };
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('storing branch documents', () => {
  it('in development, saves to uploads/ under a random UUID name and returns a signed link', async () => {
    const doc = await store();
    expect(doc.path).toMatch(/^branch-documents\/cli-1\/loan-agreement\/[0-9a-f-]{36}\.pdf$/);
    expect(fs.existsSync(path.join(dir, 'uploads', doc.path))).toBe(true);
    expect(doc.signedUrl).toMatch(/^\/api\/storage\/[^/]+$/);
    expect(verifyUploadToken(doc.signedUrl.replace('/api/storage/', ''))).toEqual({ path: doc.path });
  });

  it('two uploads never share a name', async () => {
    const [a, b] = await Promise.all([store(), store()]);
    expect(a.path).not.toBe(b.path);
  });

  it('in production, a Supabase failure fails the upload with a clear error and writes nothing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    supabase = failingSupabase();
    await expect(store()).rejects.toThrow(/could not be stored right now/);
    expect(fs.existsSync(path.join(dir, 'uploads'))).toBe(false);
  });

  it('in production without Supabase, refuses too', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(store()).rejects.toThrow(/could not be stored right now/);
  });

  it('in production, falls back to disk only when ALLOW_LOCAL_FILE_STORAGE=true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ALLOW_LOCAL_FILE_STORAGE', 'true');
    supabase = failingSupabase();
    const doc = await store();
    expect(fs.existsSync(path.join(dir, 'uploads', doc.path))).toBe(true);
  });
});
