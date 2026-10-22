import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The server's service-role client must stay service-role. supabase-js sends a
 * signed-in session's token instead of the key, so a user sign-in on the shared
 * client turned every later server upload into that user's request, which the
 * private bucket's RLS refused ("new row violates row-level security policy").
 */
const URL_ = 'https://proj.supabase.test';
const SERVICE = 'service-role-key';
const ANON = 'anon-key';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const userJwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-1', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

interface Sent {
  url: string;
  authorization: string | null;
  apikey: string | null;
}

function fakeSupabase() {
  const sent: Sent[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    sent.push({ url, authorization: headers.get('Authorization'), apikey: headers.get('apikey') });
    if (url.includes('/auth/v1/token')) {
      return new Response(
        JSON.stringify({
          access_token: userJwt,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'refresh',
          user: { id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'member@coop.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ Key: 'kyc-documents/x', Id: 'obj-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const uploads = () => sent.filter((s) => s.url.includes('/storage/v1/object/'));
  return { sent, fetchImpl, uploads };
}

const upload = (client: SupabaseClient) => client.storage.from('kyc-documents').upload('kyc/b-1/doc.jpg', Buffer.from('x'), { contentType: 'image/jpeg' });

describe('supabase-js session behaviour (why the upload failed)', () => {
  it('a plain client sends the signed-in user’s token instead of its key', async () => {
    const fake = fakeSupabase();
    const plain = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fake.fetchImpl } });
    await plain.auth.signInWithPassword({ email: 'member@coop.test', password: 'pw' });
    await upload(plain);
    expect(fake.uploads().at(-1)?.authorization).toBe(`Bearer ${userJwt}`);
  });
});

describe('createServiceRoleClient', () => {
  it('stays service-role even after something signs in on it', async () => {
    const { createServiceRoleClient } = await import('./supabaseServer');
    const fake = fakeSupabase();
    const service = createServiceRoleClient(URL_, SERVICE, fake.fetchImpl);
    await upload(service);
    await service.auth.signInWithPassword({ email: 'member@coop.test', password: 'pw' });
    await upload(service);
    expect(fake.uploads().map((u) => u.authorization)).toEqual([`Bearer ${SERVICE}`, `Bearer ${SERVICE}`]);
  });
});

describe('server sign-in', () => {
  const saved = { ...process.env };
  let fake: ReturnType<typeof fakeSupabase>;

  beforeEach(() => {
    vi.resetModules();
    fake = fakeSupabase();
    vi.stubGlobal('fetch', fake.fetchImpl);
    process.env.SUPABASE_URL = URL_;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
    process.env.SUPABASE_ANON_KEY = ANON;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...saved };
  });

  it('signs users in on their own client, so later uploads still go as the service role', async () => {
    const { supabaseSignIn } = await import('../auth/supabaseAuth');
    const { getServerSupabase } = await import('./supabaseServer');
    const result = await supabaseSignIn('member@coop.test', 'pw');
    expect(result.sessionToken).toBe(userJwt);

    const signIn = fake.sent.find((s) => s.url.includes('/auth/v1/token'));
    expect(signIn?.apikey).toBe(ANON);

    await upload(getServerSupabase()!);
    expect(fake.uploads().at(-1)?.authorization).toBe(`Bearer ${SERVICE}`);
  });

  it('has no service-role client without the service-role key (never the anon key)', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getServerSupabase, createAuthFlowClient } = await import('./supabaseServer');
    expect(getServerSupabase()).toBeNull();
    expect(createAuthFlowClient()).not.toBeNull();
  });

  it('refuses an upload rather than storing it on local disk when the key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { putKycObject } = await import('../kyc/storage');
    await expect(putKycObject({ borrowerId: 'b-1', kind: 'loan-OTHER', buffer: Buffer.from([0xff, 0xd8, 0xff]), mime: 'image/jpeg' })).rejects.toMatchObject({
      status: 503,
      code: 'STORAGE_UNAVAILABLE',
    });
  });
});
