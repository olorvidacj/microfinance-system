import type { Cents } from '../../shared/lending';
import type { PaymentProviderName } from '../../shared/payments';

/**
 * What the payments service needs from a provider. A confirmation (webhook)
 * only says which payment changed: the service always fetches the payment
 * again with getCheckout / getPayout before crediting or refunding anything.
 */

export type CheckoutState = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';

export interface CheckoutView {
  providerRef: string;
  /** Our reference, as the provider has it. */
  reference: string;
  state: CheckoutState;
  amount: Cents;
  /** What the payer actually paid, once paid. */
  paidAmount: Cents | null;
  /** The provider's fee, when it reports one. */
  fee: Cents | null;
  paidAt: string | null;
}

/** FAILED covers failed, cancelled and reversed payouts: the money did not reach the member. */
export type PayoutState = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface PayoutView {
  providerRef: string;
  reference: string;
  state: PayoutState;
  amount: Cents;
  failureReason: string | null;
}

export interface WebhookNotice {
  kind: 'checkout' | 'payout';
  providerRef: string | null;
  reference: string | null;
}

export interface CheckoutRequest {
  reference: string;
  amount: Cents;
  description: string;
  payer: { name: string; email: string | null; phone: string | null };
  successUrl: string;
  failureUrl: string;
  expiresInSeconds: number;
}

export interface PayoutRequest {
  /** Also the provider's idempotency key: sending it twice pays once. */
  reference: string;
  amount: Cents;
  channelCode: string;
  accountNumber: string;
  accountName: string;
  description: string;
}

export type Headers = Record<string, string | string[] | undefined>;

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createCheckout(input: CheckoutRequest): Promise<{ providerRef: string; checkoutUrl: string; expiresAt: string | null }>;
  getCheckout(providerRef: string): Promise<CheckoutView>;
  /** Paid checkouts in a period, for the daily report. */
  listPaidCheckouts(fromIso: string, toIso: string): Promise<CheckoutView[]>;
  createPayout(input: PayoutRequest): Promise<PayoutView>;
  getPayout(providerRef: string): Promise<PayoutView>;
  /** The payout sent with this reference, or null when the provider never received it. */
  findPayout(reference: string): Promise<PayoutView | null>;
  /** Whether a confirmation really comes from the provider. */
  verifyWebhook(headers: Headers, body: unknown): boolean;
  parseWebhook(body: unknown): WebhookNotice | null;
}

/**
 * A provider refusal or outage. `definite` means the provider has certainly
 * not taken the request (for a payout: no money will move), so it can be
 * refunded at once; otherwise the outcome is unknown and must be checked.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly definite: boolean,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
