import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Links to stored documents are always signed now, from the storage path, in
 * the private bucket. The retired public 'documents' bucket is never served.
 */

let supabase: SupabaseClient | null = null;
vi.mock('./supabaseServer', () => ({
  getServerSupabase: () => supabase,
  isSupabaseConfigured: () => supabase !== null,
}));

const { documentFileLink, supabaseObjectOf } = await import('./documentLinks');
const { verifyLocalToken } = await import('../kyc/storage');
const { verifyUploadToken } = await import('./localFiles');

const PROJECT = 'https://proj.supabase.co';
const fakeSupabase = (): SupabaseClient => {
  const client = {
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (objectPath: string, ttl: number) => ({
          data: { signedUrl: `${PROJECT}/storage/v1/object/sign/${bucket}/${objectPath}?token=fresh&ttl=${ttl}` },
          error: null,
        }),
      }),
    },
  };
  return client as unknown as SupabaseClient;
};

beforeEach(() => {
  supabase = fakeSupabase();
  process.env.AUTH_SECRET = 'test-secret';
});

describe('document file links', () => {
  it('signs the storage path now, ignoring the expired link saved at upload', async () => {
    const link = await documentFileLink({
      storagePath: 'kyc/bor-1/loan-docs/a.jpg',
      fileUrl: `${PROJECT}/storage/v1/object/sign/kyc-documents/kyc/bor-1/loan-docs/a.jpg?token=expired`,
    });
    expect(link).toEqual({ url: `${PROJECT}/storage/v1/object/sign/kyc-documents/kyc/bor-1/loan-docs/a.jpg?token=fresh&ttl=600`, expiresInSeconds: 600 });
  });

  it('re-signs an old private-bucket link that has no storage path', async () => {
    const link = await documentFileLink({ storagePath: null, fileUrl: `${PROJECT}/storage/v1/object/sign/kyc-documents/branch-documents/x/y.pdf?token=old` });
    expect(link.url).toBe(`${PROJECT}/storage/v1/object/sign/kyc-documents/branch-documents/x/y.pdf?token=fresh&ttl=600`);
  });

  it('never serves the public documents bucket', async () => {
    await expect(documentFileLink({ storagePath: null, fileUrl: `${PROJECT}/storage/v1/object/public/documents/loan/a.pdf` })).rejects.toMatchObject({ status: 404 });
  });

  it('returns a link to a file hosted elsewhere as it is', async () => {
    expect(await documentFileLink({ storagePath: null, fileUrl: 'https://files.example.test/agreement.pdf' })).toEqual({
      url: 'https://files.example.test/agreement.pdf',
      expiresInSeconds: null,
    });
  });

  it('answers 404 when there is no file', async () => {
    await expect(documentFileLink({ storagePath: null, fileUrl: null })).rejects.toMatchObject({ status: 404 });
  });

  it('without Supabase, signs KYC paths in the KYC store, and a missing branch file is "not found"', async () => {
    supabase = null;
    const link = await documentFileLink({ storagePath: 'kyc/bor-1/loan-docs/a.jpg', fileUrl: null });
    expect(link.url).toMatch(/^\/api\/kyc\/files\//);
    expect(verifyLocalToken(link.url.split('/').pop() ?? '')).toBe('kyc/bor-1/loan-docs/a.jpg');
    await expect(documentFileLink({ storagePath: 'branch-documents/x/y.pdf', fileUrl: null })).rejects.toMatchObject({ status: 404 });
  });

  describe('files in the local store (uploads/)', () => {
    let dir: string;
    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-links-'));
      vi.spyOn(process, 'cwd').mockReturnValue(dir);
      fs.mkdirSync(path.join(dir, 'uploads', 'branch-documents', 'cli-1', 'loan'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'uploads', 'branch-documents', 'cli-1', 'loan', 'f.pdf'), 'pdf');
    });
    afterEach(() => {
      vi.restoreAllMocks();
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('get a signed /api/storage link, even on a server that also has Supabase', async () => {
      const link = await documentFileLink({ storagePath: 'branch-documents/cli-1/loan/f.pdf', fileUrl: null });
      expect(link.expiresInSeconds).toBe(600);
      expect(verifyUploadToken(link.url.replace('/api/storage/', ''))).toEqual({ path: 'branch-documents/cli-1/loan/f.pdf' });
    });

    it('re-sign an old row that stored a bare /api/storage/<path> link', async () => {
      const link = await documentFileLink({ storagePath: null, fileUrl: '/api/storage/branch-documents/cli-1/loan/f.pdf' });
      expect(verifyUploadToken(link.url.replace('/api/storage/', ''))).toEqual({ path: 'branch-documents/cli-1/loan/f.pdf' });
    });
  });

  it('reads the bucket and path out of Supabase storage URLs only', () => {
    expect(supabaseObjectOf(`${PROJECT}/storage/v1/object/public/documents/a/b%20c.pdf`)).toEqual({ bucket: 'documents', path: 'a/b c.pdf' });
    expect(supabaseObjectOf('https://files.example.test/a.pdf')).toBeNull();
  });
});
