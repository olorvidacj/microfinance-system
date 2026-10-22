import { parsePesos, type Cents } from '../../shared/lending';
import { DEFAULT_INSTANT_DAILY_LIMIT, PAYMENT_PROVIDERS, type PaymentProviderName } from '../../shared/payments';
import { HttpError } from '../kyc/errors';
import { resolveActiveConnectionString } from '../db/index';
import { sendOtpEmail } from '../services/emailService';
import { MockProvider } from './mockProvider';
import type { PaymentProvider } from './provider';
import { XenditProvider } from './xenditProvider';

/**
 * Online payment settings (server environment):
 *
 *   PAYMENT_PROVIDER               mock | xendit. Defaults to mock outside production.
 *                                  Mock moves no real money, so it runs only against a
 *                                  local database (never production, never Supabase).
 *   XENDIT_SECRET_KEY              Xendit secret API key (server only).
 *   XENDIT_WEBHOOK_TOKEN           Xendit webhook verification token.
 *   ONLINE_WITHDRAWAL_DAILY_LIMIT  Instant withdrawals per member per day, in pesos (default 5000).
 *   PUBLIC_BASE_URL                Where members reach this server, for checkout return links.
 *   AUTH_SECRET                    Also keys the one-time withdrawal codes.
 */
export interface PaymentDeps {
  provider: PaymentProvider;
  dailyLimit: Cents;
  publicBaseUrl: string;
  /** Keys the stored hash of each one-time code. */
  otpSecret: string;
  sendOtp: (to: { email: string; name: string }, code: string) => Promise<void>;
}

let cached: PaymentDeps | null = null;
let schemaMissing: string | null = null;
const reported = new Set<string>();

/** Online payments are off. The reason stays on the server; the answer sent is plain. */
export class PaymentsUnavailableError extends HttpError {
  constructor(readonly reason: string) {
    super(503, 'Online payments are not available right now.', 'PAYMENTS_UNAVAILABLE');
  }
}

/** The reason goes to the server log (once); members and staff get no configuration details. */
function unavailable(reason: string): never {
  if (!reported.has(reason)) {
    reported.add(reason);
    console.warn(`[Online payments] not available: ${reason}`);
  }
  throw new PaymentsUnavailableError(reason);
}

/** The migration that creates the payment tables. */
export const PAYMENTS_MIGRATION = '0030_online_payments.sql';

/** The server found PAYMENTS_MIGRATION pending: no payments until the tables exist. */
export function markPaymentsSchemaMissing(pending: string): void {
  schemaMissing = `the database needs migration ${pending} (npm run db:migrate).`;
}

/** Whether online payments can run, and if not, why (for the server log). */
export function paymentsAvailability(): { ok: boolean; reason: string } {
  try {
    paymentDeps();
    return { ok: true, reason: '' };
  } catch (err) {
    if (!(err instanceof PaymentsUnavailableError)) throw err;
    return { ok: false, reason: err.reason };
  }
}

/** A database on this machine: the only place the mock provider may run. */
export function isLocalDatabase(connectionString = resolveActiveConnectionString()): boolean {
  if (!connectionString) return false;
  try {
    // URL keeps IPv6 hosts in brackets ("[::1]").
    const host = new URL(connectionString).hostname.replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
}

export function paymentDeps(): PaymentDeps {
  if (schemaMissing) unavailable(schemaMissing);
  if (cached) return cached;
  const production = process.env.NODE_ENV === 'production';
  const name = (process.env.PAYMENT_PROVIDER || (production ? '' : 'mock')).trim().toLowerCase() as PaymentProviderName;
  if (!name) unavailable('PAYMENT_PROVIDER is not set.');
  if (!(PAYMENT_PROVIDERS as readonly string[]).includes(name)) unavailable(`unknown PAYMENT_PROVIDER "${name}".`);
  if (name === 'mock' && production) unavailable('the mock provider moves no real money and is refused in production.');
  if (name === 'mock' && !isLocalDatabase()) {
    unavailable('the mock provider moves no real money, so it only runs against a local database (npm run db:local). Against this database, set PAYMENT_PROVIDER=xendit with test-mode keys.');
  }

  const otpSecret = process.env.AUTH_SECRET || '';
  if (!otpSecret) unavailable('AUTH_SECRET is not set.');

  const rawLimit = process.env.ONLINE_WITHDRAWAL_DAILY_LIMIT;
  const dailyLimit = rawLimit === undefined || rawLimit === '' ? DEFAULT_INSTANT_DAILY_LIMIT : parsePesos(rawLimit);
  if (dailyLimit === null || dailyLimit < 0) unavailable('ONLINE_WITHDRAWAL_DAILY_LIMIT must be an amount in pesos.');

  const base = publicBaseUrl();
  let provider: PaymentProvider;
  if (name === 'xendit') {
    const secretKey = process.env.XENDIT_SECRET_KEY || '';
    const webhookToken = process.env.XENDIT_WEBHOOK_TOKEN || '';
    if (!secretKey || !webhookToken) unavailable('XENDIT_SECRET_KEY and XENDIT_WEBHOOK_TOKEN are required.');
    provider = new XenditProvider({ secretKey, webhookToken });
  } else {
    // Confirmations go to this server's own webhook route, as a real provider's would.
    const mock: MockProvider = new MockProvider({
      baseUrl: base,
      settlePayoutsAfterMs: 1500,
      deliver: async (body, headers) => {
        const res = await fetch(`${base}/api/payments/webhooks/mock`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`webhook answered ${res.status}`);
      },
    });
    provider = mock;
  }

  cached = {
    provider,
    dailyLimit,
    publicBaseUrl: base,
    otpSecret,
    sendOtp: async (to, code) => {
      await sendOtpEmail({ to: to.email, code, purpose: 'withdrawal' });
    },
  };
  return cached;
}

/** The mock provider of this process, for its checkout page; null when another provider is in use. */
export function mockProvider(): MockProvider | null {
  const p = paymentDeps().provider;
  return p instanceof MockProvider ? p : null;
}
