import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * When online payments may run. The mock provider moves no real money, so it
 * must never run against a shared or production database.
 */
const saved = { ...process.env };

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const k of ['PAYMENT_PROVIDER', 'NODE_ENV', 'DATABASE_URL', 'SUPABASE_DATABASE_URL', 'CLOUD_SQL_DATABASE_URL', 'XENDIT_SECRET_KEY', 'XENDIT_WEBHOOK_TOKEN', 'ONLINE_WITHDRAWAL_DAILY_LIMIT']) delete process.env[k];
  process.env.AUTH_SECRET = 'test-secret';
  Object.assign(process.env, env);
  return import('./config');
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
});

describe('online payments availability', () => {
  it('runs the mock provider against a local database', async () => {
    const c = await load({ DATABASE_URL: 'postgresql://postgres@127.0.0.1:15433/postgres' });
    expect(c.paymentsAvailability()).toEqual({ ok: true, reason: '' });
    expect(c.paymentDeps().provider.name).toBe('mock');
  });

  it('refuses the mock provider against a shared database, even in development', async () => {
    const c = await load({ DATABASE_URL: 'postgresql://postgres.ref:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres' });
    const a = c.paymentsAvailability();
    expect(a.ok).toBe(false);
    expect(a.reason).toMatch(/only runs against a local database/);
    expect(() => c.paymentDeps()).toThrow(c.PaymentsUnavailableError);
  });

  it('refuses the mock provider in production', async () => {
    const c = await load({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'mock', DATABASE_URL: 'postgresql://postgres@localhost/postgres' });
    expect(c.paymentsAvailability().reason).toMatch(/refused in production/);
  });

  it('needs a provider in production, and Xendit needs its keys', async () => {
    expect((await load({ NODE_ENV: 'production' })).paymentsAvailability().reason).toMatch(/PAYMENT_PROVIDER is not set/);
    expect((await load({ PAYMENT_PROVIDER: 'xendit' })).paymentsAvailability().reason).toMatch(/XENDIT_SECRET_KEY/);
    const x = await load({ PAYMENT_PROVIDER: 'xendit', XENDIT_SECRET_KEY: 'xnd_test', XENDIT_WEBHOOK_TOKEN: 'tok', DATABASE_URL: 'postgresql://u:p@db.example.com/postgres' });
    expect(x.paymentDeps().provider.name).toBe('xendit');
  });

  it('is off until the payment tables exist, whatever the provider', async () => {
    const c = await load({ DATABASE_URL: 'postgresql://postgres@127.0.0.1:15433/postgres' });
    expect(c.paymentsAvailability().ok).toBe(true);
    c.markPaymentsSchemaMissing(c.PAYMENTS_MIGRATION);
    expect(c.paymentsAvailability()).toEqual({ ok: false, reason: 'the database needs migration 0030_online_payments.sql (npm run db:migrate).' });
  });

  it('tells members only that payments are unavailable, not why', async () => {
    const c = await load({ DATABASE_URL: 'postgresql://u:p@db.example.com/postgres' });
    try {
      c.paymentDeps();
      throw new Error('expected a refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(c.PaymentsUnavailableError);
      const e = err as InstanceType<typeof c.PaymentsUnavailableError>;
      expect(e.status).toBe(503);
      expect(e.message).toBe('Online payments are not available right now.');
      expect(e.details).toBeUndefined();
    }
  });

  it('recognises local databases', async () => {
    const c = await load({});
    expect(c.isLocalDatabase('postgresql://postgres@localhost:5432/x')).toBe(true);
    expect(c.isLocalDatabase('postgresql://postgres@[::1]:5432/x')).toBe(true);
    expect(c.isLocalDatabase('postgresql://postgres@127.0.0.1/x')).toBe(true);
    expect(c.isLocalDatabase('postgresql://postgres@db.supabase.co/x')).toBe(false);
    expect(c.isLocalDatabase('')).toBe(false);
    expect(c.isLocalDatabase('not a url')).toBe(false);
  });
});
