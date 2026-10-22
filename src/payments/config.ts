import { parsePesos, type Cents } from '../../shared/lending';
import { DEFAULT_INSTANT_DAILY_LIMIT, PAYMENT_PROVIDERS, type PaymentProviderName } from '../../shared/payments';
import { HttpError } from '../kyc/errors';
import { sendOtpEmail } from '../services/emailService';
import { MockProvider } from './mockProvider';
import type { PaymentProvider } from './provider';
import { XenditProvider } from './xenditProvider';

/**
 * Online payment settings (server environment):
 *
 *   PAYMENT_PROVIDER               mock | xendit. Defaults to mock outside production;
 *                                  required in production, where mock is refused.
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

function unavailable(message: string): never {
  throw new HttpError(503, `Online payments are not available: ${message}`, 'PAYMENTS_UNAVAILABLE');
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
}

export function paymentDeps(): PaymentDeps {
  if (cached) return cached;
  const production = process.env.NODE_ENV === 'production';
  const name = (process.env.PAYMENT_PROVIDER || (production ? '' : 'mock')).trim().toLowerCase() as PaymentProviderName;
  if (!name) unavailable('PAYMENT_PROVIDER is not set.');
  if (!(PAYMENT_PROVIDERS as readonly string[]).includes(name)) unavailable(`unknown PAYMENT_PROVIDER "${name}".`);
  if (name === 'mock' && production) unavailable('the mock provider moves no real money and is refused in production.');

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
