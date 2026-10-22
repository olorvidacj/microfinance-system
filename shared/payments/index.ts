/**
 * Online savings payments: rules shared by the server and the portal.
 *
 * Deposits are paid on the provider's checkout page and credited only when the
 * provider confirms them to the server. Withdrawals up to a daily limit are
 * paid out at once, with a one-time code, to a verified account in the
 * member's own name; larger ones go to staff as a withdrawal request.
 */
import { formatPeso, parsePesos, type Cents } from '../lending';

export const PAYMENT_PROVIDERS = ['mock', 'xendit'] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

/** Per online deposit. */
export const ONLINE_DEPOSIT_MIN: Cents = 10_000; // PHP 100
export const ONLINE_DEPOSIT_MAX: Cents = 5_000_000; // PHP 50,000
/** Per instant withdrawal; the daily limit caps the day's total. */
export const INSTANT_WITHDRAWAL_MIN: Cents = 10_000; // PHP 100
export const DEFAULT_INSTANT_DAILY_LIMIT: Cents = 500_000; // PHP 5,000

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300;
export const OTP_MAX_ATTEMPTS = 5;

export type PayoutChannelKind = 'E_WALLET' | 'BANK';
export interface PayoutChannel {
  /** The provider's channel code (Xendit Payouts v2). */
  code: string;
  label: string;
  kind: PayoutChannelKind;
}

export const PAYOUT_CHANNELS: readonly PayoutChannel[] = [
  { code: 'PH_GCASH', label: 'GCash', kind: 'E_WALLET' },
  { code: 'PH_PAYMAYA', label: 'Maya', kind: 'E_WALLET' },
  { code: 'PH_BDO', label: 'BDO Unibank', kind: 'BANK' },
  { code: 'PH_BPI', label: 'BPI', kind: 'BANK' },
  { code: 'PH_LBP', label: 'Landbank', kind: 'BANK' },
  { code: 'PH_MET', label: 'Metrobank', kind: 'BANK' },
  { code: 'PH_UBP', label: 'UnionBank', kind: 'BANK' },
];

export function payoutChannel(code: unknown): PayoutChannel | null {
  return PAYOUT_CHANNELS.find((c) => c.code === code) ?? null;
}

export const DEPOSIT_STATUSES = ['PENDING', 'CREDITED', 'EXPIRED', 'FAILED', 'NEEDS_REVIEW', 'DISMISSED'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];
export const DEPOSIT_STATUS_LABELS: Readonly<Record<DepositStatus, string>> = {
  PENDING: 'Waiting for payment',
  CREDITED: 'Credited',
  EXPIRED: 'Expired, not paid',
  FAILED: 'Payment failed',
  NEEDS_REVIEW: 'Being checked by staff',
  DISMISSED: 'Closed by staff',
};

export const PAYOUT_STATUSES = ['AWAITING_OTP', 'CANCELLED', 'SUBMITTING', 'PROCESSING', 'PAID', 'REFUNDED', 'NEEDS_REVIEW'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];
export const PAYOUT_STATUS_LABELS: Readonly<Record<PayoutStatus, string>> = {
  AWAITING_OTP: 'Waiting for your code',
  CANCELLED: 'Cancelled, nothing taken',
  SUBMITTING: 'Sending',
  PROCESSING: 'On its way',
  PAID: 'Paid out',
  REFUNDED: 'Failed, money returned to your savings',
  NEEDS_REVIEW: 'Being checked by staff',
};

export const PAYOUT_ACCOUNT_STATUSES = ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REMOVED'] as const;
export type PayoutAccountStatus = (typeof PAYOUT_ACCOUNT_STATUSES)[number];
export const PAYOUT_ACCOUNT_STATUS_LABELS: Readonly<Record<PayoutAccountStatus, string>> = {
  PENDING_VERIFICATION: 'Waiting for branch verification',
  VERIFIED: 'Verified',
  REJECTED: 'Not accepted',
  REMOVED: 'Removed',
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** A checked input: the value when ok, the per-field messages when not. */
export interface Check<T> {
  ok: boolean;
  value: T | null;
  errors: Record<string, string>;
}
const pass = <T>(value: T): Check<T> => ({ ok: true, value, errors: {} });
const fail = <T>(errors: Record<string, string>): Check<T> => ({ ok: false, value: null, errors });

export function checkDepositAmount(raw: unknown): Check<Cents> {
  const amount = parsePesos(raw);
  if (amount === null || amount <= 0) return fail({ amount: 'Enter the amount (pesos and centavos only).' });
  if (amount < ONLINE_DEPOSIT_MIN) return fail({ amount: `The smallest online deposit is ${formatPeso(ONLINE_DEPOSIT_MIN)}.` });
  if (amount > ONLINE_DEPOSIT_MAX) return fail({ amount: `The largest online deposit is ${formatPeso(ONLINE_DEPOSIT_MAX)}. Deposit more at the branch.` });
  return pass(amount);
}

export interface InstantRoom {
  ok: boolean;
  code: 'OK' | 'BELOW_MINIMUM' | 'OVER_DAILY_LIMIT';
  message: string;
  /** What is left of today's limit. */
  remaining: Cents;
}

/**
 * Where an instant withdrawal stands against the day's limit. Anything above
 * what is left goes to staff as a withdrawal request.
 */
export function instantWithdrawalRoom(input: { amount: Cents; usedToday: Cents; dailyLimit: Cents }): InstantRoom {
  const remaining = Math.max(0, input.dailyLimit - input.usedToday);
  if (input.amount < INSTANT_WITHDRAWAL_MIN) return { ok: false, code: 'BELOW_MINIMUM', message: `The smallest instant withdrawal is ${formatPeso(INSTANT_WITHDRAWAL_MIN)}.`, remaining };
  if (input.amount > remaining) {
    return {
      ok: false,
      code: 'OVER_DAILY_LIMIT',
      message: `Instant withdrawals are limited to ${formatPeso(input.dailyLimit)} a day; ${formatPeso(remaining)} is left today. Send a withdrawal request to the branch for more.`,
      remaining,
    };
  }
  return { ok: true, code: 'OK', message: 'OK', remaining };
}

const digits = (s: string) => s.replace(/\D/g, '');

/** The payout account number for a channel: an 11-digit 09 mobile for e-wallets, 10-16 digits for banks. */
export function checkPayoutAccountNumber(channel: PayoutChannel, raw: unknown): Check<string> {
  const d = digits(String(raw ?? ''));
  if (channel.kind === 'E_WALLET') {
    const local = d.startsWith('63') && d.length === 12 ? `0${d.slice(2)}` : d;
    if (!/^09\d{9}$/.test(local)) return fail({ accountNumber: `Enter the ${channel.label} mobile number (09xx xxx xxxx).` });
    return pass(local);
  }
  if (!/^\d{10,16}$/.test(d)) return fail({ accountNumber: 'Enter the 10 to 16 digit account number.' });
  return pass(d);
}

/** Upper-case words without accents or punctuation: "Ma. Niña dela Cruz" -> ["MA", "NINA", "DELA", "CRUZ"]. */
export function nameWords(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Whether an account holder name is the member's own: it must carry every word
 * of the member's first and last names, and nothing that is not part of the
 * member's name (a middle name may be given in full, as an initial, or left out).
 */
export function isOwnName(holder: string, member: { firstName: string; middleName?: string | null; lastName: string }): boolean {
  const h = nameWords(holder);
  const first = nameWords(member.firstName);
  const last = nameWords(member.lastName);
  const middle = nameWords(member.middleName ?? '');
  if (!h.length || !first.length || !last.length) return false;
  const required = [...first, ...last];
  if (!required.every((w) => h.includes(w))) return false;
  const allowed = new Set([...required, ...middle, ...middle.map((w) => w[0])]);
  return h.every((w) => allowed.has(w));
}

/** Shows only the last four digits of an account number. */
export function maskAccountNumber(n: string): string {
  const d = digits(n);
  return d.length <= 4 ? d : `•••• ${d.slice(-4)}`;
}
