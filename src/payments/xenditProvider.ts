import { centsToPesos, parsePesos, type Cents } from '../../shared/lending';
import { safeEqual } from './mockProvider';
import { ProviderError, type CheckoutRequest, type CheckoutState, type CheckoutView, type Headers, type PaymentProvider, type PayoutRequest, type PayoutState, type PayoutView, type WebhookNotice } from './provider';

/**
 * Xendit (https://developers.xendit.co): hosted checkout through Invoices
 * (/v2/invoices) and payouts through Payouts v2 (/v2/payouts). Confirmations
 * carry the account's verification token in x-callback-token.
 *
 * Settings: XENDIT_SECRET_KEY (server only) and XENDIT_WEBHOOK_TOKEN. Use a
 * test-mode key until the flow has been checked end to end in Xendit's sandbox.
 */
export const XENDIT_TOKEN_HEADER = 'x-callback-token';
const API = 'https://api.xendit.co';

interface XenditOptions {
  secretKey: string;
  webhookToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function pesosToCents(value: unknown, what: string): Cents {
  const cents = parsePesos(typeof value === 'number' ? value.toFixed(2) : String(value ?? ''));
  if (cents === null) throw new ProviderError(`Xendit sent an unreadable ${what}.`, false);
  return cents;
}

const INVOICE_STATE: Readonly<Record<string, CheckoutState>> = { PENDING: 'PENDING', PAID: 'PAID', SETTLED: 'PAID', EXPIRED: 'EXPIRED' };
/** Xendit's JSON, unchecked: every field is read through a check. */
interface XenditInvoice {
  id?: unknown;
  external_id?: unknown;
  status?: unknown;
  amount?: unknown;
  paid_amount?: unknown;
  fees_paid_amount?: unknown;
  paid_at?: unknown;
  invoice_url?: unknown;
  expiry_date?: unknown;
}
interface XenditPayout {
  id?: unknown;
  reference_id?: unknown;
  status?: unknown;
  amount?: unknown;
  failure_code?: unknown;
}

const PAYOUT_STATE: Readonly<Record<string, PayoutState>> = {
  ACCEPTED: 'PENDING',
  REQUESTED: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'FAILED',
  REVERSED: 'FAILED',
};

export class XenditProvider implements PaymentProvider {
  readonly name = 'xendit' as const;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: XenditOptions) {
    if (!opts.secretKey || !opts.webhookToken) throw new Error('Xendit needs XENDIT_SECRET_KEY and XENDIT_WEBHOOK_TOKEN.');
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.opts.secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 15_000),
      });
    } catch (err) {
      // Timed out or unreachable: the request may or may not have arrived.
      throw new ProviderError(`Xendit could not be reached (${err instanceof Error ? err.message : 'network error'}).`, false);
    }
    const data = (await res.json().catch(() => null)) as { error_code?: string; message?: string } | null;
    if (!res.ok) {
      // 4xx: Xendit refused the request, so it did nothing (409 is a repeat; look it up instead).
      const definite = res.status >= 400 && res.status < 500 && res.status !== 409 && res.status !== 429;
      throw new ProviderError(`Xendit refused the request: ${data?.message ?? res.statusText} (${data?.error_code ?? res.status}).`, definite, res.status, data?.error_code);
    }
    return data as T;
  }

  private invoiceView(inv: XenditInvoice | null): CheckoutView {
    const state = INVOICE_STATE[String(inv?.status)];
    if (!state || typeof inv?.id !== 'string') throw new ProviderError('Xendit sent an invoice this server does not understand.', false);
    const paid = state === 'PAID';
    return {
      providerRef: inv.id,
      reference: String(inv.external_id ?? ''),
      state,
      amount: pesosToCents(inv.amount, 'invoice amount'),
      paidAmount: paid ? pesosToCents(inv.paid_amount ?? inv.amount, 'paid amount') : null,
      fee: paid && inv.fees_paid_amount !== undefined ? pesosToCents(inv.fees_paid_amount, 'fee') : null,
      paidAt: paid && typeof inv.paid_at === 'string' ? inv.paid_at : null,
    };
  }

  private payoutView(p: XenditPayout | null): PayoutView {
    const state = PAYOUT_STATE[String(p?.status)];
    if (!state || typeof p?.id !== 'string') throw new ProviderError('Xendit sent a payout this server does not understand.', false);
    return {
      providerRef: p.id,
      reference: String(p.reference_id ?? ''),
      state,
      amount: pesosToCents(p.amount, 'payout amount'),
      failureReason: state === 'FAILED' ? String(p.failure_code ?? p.status) : null,
    };
  }

  async createCheckout(input: CheckoutRequest) {
    const inv = await this.call<XenditInvoice | null>('POST', '/v2/invoices', {
      external_id: input.reference,
      amount: centsToPesos(input.amount),
      currency: 'PHP',
      description: input.description,
      invoice_duration: input.expiresInSeconds,
      success_redirect_url: input.successUrl,
      failure_redirect_url: input.failureUrl,
      payer_email: input.payer.email ?? undefined,
      customer: { given_names: input.payer.name, email: input.payer.email ?? undefined, mobile_number: input.payer.phone ?? undefined },
    });
    if (typeof inv?.id !== 'string' || typeof inv?.invoice_url !== 'string') throw new ProviderError('Xendit did not return a checkout page.', false);
    return { providerRef: inv.id, checkoutUrl: inv.invoice_url, expiresAt: typeof inv.expiry_date === 'string' ? inv.expiry_date : null };
  }

  async getCheckout(providerRef: string) {
    return this.invoiceView(await this.call<XenditInvoice | null>('GET', `/v2/invoices/${encodeURIComponent(providerRef)}`));
  }

  async listPaidCheckouts(fromIso: string, toIso: string) {
    const out: CheckoutView[] = [];
    let after: string | null = null;
    for (let page = 0; page < 50; page++) {
      const qs = new URLSearchParams({ statuses: JSON.stringify(['PAID', 'SETTLED']), paid_after: fromIso, paid_before: toIso, limit: '100' });
      if (after) qs.set('last_invoice_id', after);
      const rows = await this.call<XenditInvoice[] | null>('GET', `/v2/invoices?${qs}`);
      if (!Array.isArray(rows)) throw new ProviderError('Xendit sent an unreadable invoice list.', false);
      out.push(...rows.map((r) => this.invoiceView(r)));
      if (rows.length < 100) return out;
      const last = rows[rows.length - 1].id;
      if (typeof last !== 'string') throw new ProviderError('Xendit sent an unreadable invoice list.', false);
      after = last;
    }
    throw new ProviderError('Too many invoices to list for one day.', false);
  }

  async createPayout(input: PayoutRequest) {
    return this.payoutView(
      await this.call<XenditPayout | null>(
        'POST',
        '/v2/payouts',
        {
          reference_id: input.reference,
          channel_code: input.channelCode,
          channel_properties: { account_number: input.accountNumber, account_holder_name: input.accountName },
          amount: centsToPesos(input.amount),
          currency: 'PHP',
          description: input.description,
        },
        { 'Idempotency-key': input.reference },
      ),
    );
  }

  async getPayout(providerRef: string) {
    return this.payoutView(await this.call<XenditPayout | null>('GET', `/v2/payouts/${encodeURIComponent(providerRef)}`));
  }

  async findPayout(reference: string) {
    const rows = await this.call<XenditPayout[] | null>('GET', `/v2/payouts?reference_id=${encodeURIComponent(reference)}`);
    if (!Array.isArray(rows)) throw new ProviderError('Xendit sent an unreadable payout list.', false);
    return rows.length ? this.payoutView(rows[0]) : null;
  }

  verifyWebhook(headers: Headers, _body: unknown): boolean {
    const given = headers[XENDIT_TOKEN_HEADER];
    return typeof given === 'string' && safeEqual(given, this.opts.webhookToken);
  }

  parseWebhook(body: unknown): WebhookNotice | null {
    if (!body || typeof body !== 'object') return null;
    const b = body as { event?: unknown; data?: XenditPayout; id?: unknown; external_id?: unknown };
    // Payouts v2: { event: 'payout.succeeded', data: { id, reference_id, ... } }
    if (typeof b.event === 'string' && b.event.startsWith('payout.') && b.data && typeof b.data === 'object') {
      return { kind: 'payout', providerRef: typeof b.data.id === 'string' ? b.data.id : null, reference: typeof b.data.reference_id === 'string' ? b.data.reference_id : null };
    }
    // Invoice callback: { id, external_id, status, ... }
    if (typeof b.external_id === 'string' && typeof b.id === 'string') return { kind: 'checkout', providerRef: b.id, reference: b.external_id };
    return null;
  }
}
