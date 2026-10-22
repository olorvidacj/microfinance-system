import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { storageRouter } from './storageRoutes';
import { signedUploadLink } from '../db/localFiles';
import { signedKycUrl } from '../kyc/storage';

/** /api/storage serves local files only through valid, unexpired signed links. */

const SECRET = 'storage-route-test-secret';
let dir: string;
let server: http.Server;
let base: string;

const get = (url: string) => fetch(`${base}${url}`);
/** A token signed with the real secret, for paths the link maker itself refuses. */
function forge(payload: object): string {
  const p = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = crypto.createHmac('sha256', SECRET).update(p).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `/api/storage/${p}.${sig}`;
}

beforeAll(async () => {
  process.env.FILE_LINK_SECRET = SECRET;
  process.env.AUTH_SECRET ??= 'kyc-test-secret';
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-route-'));
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  fs.mkdirSync(path.join(dir, 'uploads', 'branch-documents', 'cli-1', 'loan'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'uploads', 'branch-documents', 'cli-1', 'loan', 'agreement.pdf'), '%PDF-1.4 test');
  fs.mkdirSync(path.join(dir, 'uploads', 'kyc'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'uploads', 'kyc', 'id.jpg'), 'identity');
  fs.writeFileSync(path.join(dir, 'secret.env'), 'AUTH_SECRET=leak');

  const app = express();
  app.use('/api/storage', storageRouter);
  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('/api/storage', () => {
  it('serves a file through a valid signed link, privately', async () => {
    const res = await get(signedUploadLink('branch-documents/cli-1/loan/agreement.pdf'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('%PDF-1.4 test');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('refuses a request with no token, or an old raw path (401)', async () => {
    expect((await get('/api/storage')).status).toBe(401);
    expect((await get('/api/storage/')).status).toBe(401);
    expect((await get('/api/storage/branch-documents/cli-1/loan/agreement.pdf')).status).toBe(401);
  });

  it('refuses a wrong or tampered token (403)', async () => {
    const good = signedUploadLink('branch-documents/cli-1/loan/agreement.pdf');
    const tampered = good.slice(0, -2) + (good.endsWith('AA') ? 'BB' : 'AA');
    expect((await get(tampered)).status).toBe(403);
    expect((await get('/api/storage/not-a-token')).status).toBe(403);
    // A token for the KYC store is not a token for this one.
    const kycToken = (await signedKycUrl({ backend: 'local', path: 'kyc/bor-1/id/a.jpg' })).split('/').pop();
    expect((await get(`/api/storage/${kycToken}`)).status).toBe(403);
  });

  it('refuses an expired token (403)', async () => {
    const expired = signedUploadLink('branch-documents/cli-1/loan/agreement.pdf', 600, Date.now() - 3_600_000);
    const res = await get(expired);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/expired/);
  });

  it('never leaves uploads/ or opens kyc/, even with a correctly signed token (404)', async () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    expect((await get(forge({ k: 'uploads', p: '../secret.env', e: exp }))).status).toBe(404);
    expect((await get(forge({ k: 'uploads', p: 'branch-documents/../../secret.env', e: exp }))).status).toBe(404);
    expect((await get(forge({ k: 'uploads', p: 'kyc/id.jpg', e: exp }))).status).toBe(404);
    expect((await get(forge({ k: 'uploads', p: 'KYC/id.jpg', e: exp }))).status).toBe(404);
    expect((await get('/api/storage/..%2F..%2Fsecret.env')).status).toBe(403);
    expect(() => signedUploadLink('../secret.env')).toThrow();
  });

  it('answers 404 for a signed link to a file that is gone', async () => {
    expect((await get(signedUploadLink('branch-documents/cli-1/loan/missing.pdf'))).status).toBe(404);
  });
});
