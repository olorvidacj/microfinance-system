import crypto from 'crypto';
import type { Cents } from '../../shared/lending';
import { ProviderError, type CheckoutRequest, type CheckoutView, type Headers, type PaymentProvider, type PayoutRequest, type PayoutView, type WebhookNotice } from './provider';

/**
 * A stand-in provider for testing the whole flow locally, without an account.
 * Its checkout page is served by this server (/api/payments/mock/checkout/:ref)
 * and its confirmations are signed with a per-process token and sent to the
 * same webhook route a real provider uses. State lives in memory.
 *
 * Test hooks on payouts, by account number ending:
 *   ...0000  accepted, then fails (the money comes back)
 *   ...9999  refused at once
 */
export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

interface MockCheckout {
  view: CheckoutView;
  expiresAt: string;
  returnUrl: string;
}

interface MockOptions {
  /** Shared secret for signing confirmations; random per process by default. */
  webhookToken?: string;
  /** Where this server is reachable, for the checkout page links. */
  baseUrl: string;
  /** Sends a confirmation to the webhook route. Omitted in tests, which deliver by hand. */
  deliver?: (body: unknown, headers: Record<string, string>) => Promise<void>;
  /** Settles accepted payouts after this many milliseconds (omitted: by hand). */
  settlePayoutsAfterMs?: number;
}

export class MockProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  readonly webhookToken: string;
  private readonly checkouts = new Map<string, MockCheckout>();
  private readonly payoutsById = new Map<string, PayoutView>();

  constructor(private readonly opts: MockOptions) {
    this.webhookToken = opts.webhookToken ?? crypto.randomBytes(24).toString('hex');
  }

  async createCheckout(input: CheckoutRequest) {
    const providerRef = `mock_cs_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
    this.checkouts.set(providerRef, {
      view: { providerRef, reference: input.reference, state: 'PENDING', amount: input.amount, paidAmount: null, fee: null, paidAt: null },
      expiresAt,
      returnUrl: input.successUrl,
    });
    return { providerRef, checkoutUrl: `${this.opts.baseUrl}/api/payments/mock/checkout/${encodeURIComponent(providerRef)}`, expiresAt };
  }

  async getCheckout(providerRef: string): Promise<CheckoutView> {
    const c = this.checkouts.get(providerRef);
    if (!c) throw new ProviderError('The mock provider has no such checkout.', false, 404, 'NOT_FOUND');
    if (c.view.state === 'PENDING' && c.expiresAt < new Date().toISOString()) c.view = { ...c.view, state: 'EXPIRED' };
    return { ...c.view };
  }

  async listPaidCheckouts(fromIso: string, toIso: string): Promise<CheckoutView[]> {
    return [...this.checkouts.values()].map((c) => c.view).filter((v) => v.state === 'PAID' && v.paidAt !== null && v.paidAt >= fromIso && v.paidAt < toIso);
  }

  /** The checkout as the mock page shows it, with where to send the member back. */
  checkout(providerRef: string): { view: CheckoutView; returnUrl: string } | null {
    const c = this.checkouts.get(providerRef);
    return c ? { view: { ...c.view }, returnUrl: c.returnUrl } : null;
  }

  /** The member paid on the mock checkout page (optionally a different amount, to test review). */
  pay(providerRef: string, paidAmount?: Cents): CheckoutView {
    const c = this.checkouts.get(providerRef);
    if (!c) throw new ProviderError('No such checkout.', true, 404);
    if (c.view.state !== 'PENDING') return { ...c.view };
    c.view = { ...c.view, state: 'PAID', paidAmount: paidAmount ?? c.view.amount, fee: 0, paidAt: new Date().toISOString() };
    return { ...c.view };
  }

  cancel(providerRef: string): CheckoutView {
    const c = this.checkouts.get(providerRef);
    if (!c) throw new ProviderError('No such checkout.', true, 404);
    if (c.view.state === 'PENDING') c.view = { ...c.view, state: 'FAILED' };
    return { ...c.view };
  }

  async createPayout(input: PayoutRequest): Promise<PayoutView> {
    const existing = [...this.payoutsById.values()].find((p) => p.reference === input.reference);
    if (existing) return { ...existing };
    if (input.accountNumber.endsWith('9999')) throw new ProviderError('The receiving account was refused (mock).', true, 400, 'INVALID_DESTINATION');
    const view: PayoutView = { providerRef: `mock_po_${crypto.randomUUID()}`, reference: input.reference, state: 'PENDING', amount: input.amount, failureReason: null };
    this.payoutsById.set(view.providerRef, view);
    if (this.opts.settlePayoutsAfterMs !== undefined) {
      const fail = input.accountNumber.endsWith('0000');
      setTimeout(() => {
        this.settlePayout(view.providerRef, fail ? 'FAILED' : 'SUCCEEDED');
        void this.notify('payout', view.providerRef, view.reference);
      }, this.opts.settlePayoutsAfterMs);
    }
    return { ...view };
  }

  /** Completes a payout (tests call this; the server does it on a timer). */
  settlePayout(providerRef: string, state: 'SUCCEEDED' | 'FAILED'): PayoutView {
    const p = this.payoutsById.get(providerRef);
    if (!p) throw new ProviderError('No such payout.', true, 404);
    if (p.state === 'PENDING') this.payoutsById.set(providerRef, { ...p, state, failureReason: state === 'FAILED' ? 'The receiving account rejected the transfer (mock).' : null });
    return { ...this.payoutsById.get(providerRef)! };
  }

  async getPayout(providerRef: string): Promise<PayoutView> {
    const p = this.payoutsById.get(providerRef);
    if (!p) throw new ProviderError('The mock provider has no such payout.', false, 404, 'NOT_FOUND');
    return { ...p };
  }

  async findPayout(reference: string): Promise<PayoutView | null> {
    const p = [...this.payoutsById.values()].find((x) => x.reference === reference);
    return p ? { ...p } : null;
  }

  webhookBody(kind: 'checkout' | 'payout', providerRef: string, reference: string) {
    return { type: kind, id: providerRef, reference };
  }

  signedHeaders(): Record<string, string> {
    return { [MOCK_SIGNATURE_HEADER]: this.webhookToken };
  }

  /** Sends a confirmation to the webhook route, as a provider would. */
  async notify(kind: 'checkout' | 'payout', providerRef: string, reference: string): Promise<void> {
    if (!this.opts.deliver) return;
    try {
      await this.opts.deliver(this.webhookBody(kind, providerRef, reference), this.signedHeaders());
    } catch (err) {
      console.error('[mock payments] confirmation not delivered:', err);
    }
  }

  verifyWebhook(headers: Headers, _body: unknown): boolean {
    const given = headers[MOCK_SIGNATURE_HEADER];
    return typeof given === 'string' && safeEqual(given, this.webhookToken);
  }

  parseWebhook(body: unknown): WebhookNotice | null {
    const b = body as { type?: unknown; id?: unknown; reference?: unknown } | null;
    if (!b || (b.type !== 'checkout' && b.type !== 'payout')) return null;
    return { kind: b.type, providerRef: typeof b.id === 'string' ? b.id : null, reference: typeof b.reference === 'string' ? b.reference : null };
  }
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
