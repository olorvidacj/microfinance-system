import { describe, expect, it } from 'vitest';
import { ProviderError } from './provider';
import { XenditProvider } from './xenditProvider';

/** The Xendit adapter against recorded request and response shapes (no network). */
interface Sent {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
}

function fakeXendit(respond: (s: Sent) => { status: number; body: unknown } | Error) {
  const sent: Sent[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const s: Sent = { url: String(input), method: init?.method ?? 'GET', headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined };
    sent.push(s);
    const r = respond(s);
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { sent, provider: new XenditProvider({ secretKey: 'xnd_test_key', webhookToken: 'cb-token', fetchImpl }) };
}

describe('XenditProvider', () => {
  it('opens a checkout with our reference, the amount in pesos and secret-key auth', async () => {
    const { sent, provider } = fakeXendit(() => ({ status: 200, body: { id: 'inv_1', invoice_url: 'https://checkout.xendit.co/web/inv_1', status: 'PENDING', expiry_date: '2026-10-22T10:00:00.000Z', amount: 2500.5 } }));
    const r = await provider.createCheckout({ reference: 'OD-1', amount: 250_050, description: 'Deposit', payer: { name: 'Juan', email: 'j@x.test', phone: null }, successUrl: 'https://app/ok', failureUrl: 'https://app/no', expiresInSeconds: 3600 });
    expect(r).toEqual({ providerRef: 'inv_1', checkoutUrl: 'https://checkout.xendit.co/web/inv_1', expiresAt: '2026-10-22T10:00:00.000Z' });
    expect(sent[0].url).toBe('https://api.xendit.co/v2/invoices');
    expect(sent[0].headers.get('Authorization')).toBe(`Basic ${Buffer.from('xnd_test_key:').toString('base64')}`);
    expect(sent[0].body).toMatchObject({ external_id: 'OD-1', amount: 2500.5, currency: 'PHP', invoice_duration: 3600, success_redirect_url: 'https://app/ok' });
  });

  it('reads a paid or settled invoice exactly, in centavos', async () => {
    const { provider } = fakeXendit(() => ({ status: 200, body: { id: 'inv_1', external_id: 'OD-1', status: 'SETTLED', amount: 2500.5, paid_amount: 2500.5, paid_at: '2026-10-22T02:00:00.000Z' } }));
    expect(await provider.getCheckout('inv_1')).toEqual({ providerRef: 'inv_1', reference: 'OD-1', state: 'PAID', amount: 250_050, paidAmount: 250_050, fee: null, paidAt: '2026-10-22T02:00:00.000Z' });
  });

  it('sends a payout with our reference as the idempotency key', async () => {
    const { sent, provider } = fakeXendit(() => ({ status: 200, body: { id: 'disb_1', reference_id: 'OP-1', status: 'ACCEPTED', amount: 1000 } }));
    const v = await provider.createPayout({ reference: 'OP-1', amount: 100_000, channelCode: 'PH_GCASH', accountNumber: '09171234567', accountName: 'Juan Dela Cruz', description: 'Withdrawal' });
    expect(v).toEqual({ providerRef: 'disb_1', reference: 'OP-1', state: 'PENDING', amount: 100_000, failureReason: null });
    expect(sent[0].headers.get('Idempotency-key')).toBe('OP-1');
    expect(sent[0].body).toMatchObject({ reference_id: 'OP-1', channel_code: 'PH_GCASH', channel_properties: { account_number: '09171234567', account_holder_name: 'Juan Dela Cruz' }, amount: 1000, currency: 'PHP' });
  });

  it('treats reversed and cancelled payouts as failed', async () => {
    for (const status of ['FAILED', 'CANCELLED', 'REVERSED']) {
      const { provider } = fakeXendit(() => ({ status: 200, body: { id: 'disb_1', reference_id: 'OP-1', status, amount: 1000, failure_code: 'INVALID_DESTINATION' } }));
      expect((await provider.getPayout('disb_1')).state).toBe('FAILED');
    }
  });

  it('says whether a refusal is certain (refund now) or the outcome is unknown (check later)', async () => {
    const refused = fakeXendit(() => ({ status: 400, body: { error_code: 'INVALID_DESTINATION', message: 'bad account' } })).provider;
    await expect(refused.createPayout({ reference: 'OP-1', amount: 100, channelCode: 'PH_GCASH', accountNumber: '1', accountName: 'J', description: '' })).rejects.toMatchObject({ definite: true, status: 400 });
    for (const r of [{ status: 500, body: {} }, { status: 409, body: { error_code: 'DUPLICATE_ERROR' } }, new Error('socket hang up')]) {
      const { provider } = fakeXendit(() => r);
      const err = await provider.createPayout({ reference: 'OP-1', amount: 100, channelCode: 'PH_GCASH', accountNumber: '1', accountName: 'J', description: '' }).catch((e) => e);
      expect(err).toBeInstanceOf(ProviderError);
      expect(err.definite).toBe(false);
    }
  });

  it('finds a payout by reference, or reports that Xendit never received it', async () => {
    expect(await fakeXendit(() => ({ status: 200, body: [] })).provider.findPayout('OP-1')).toBeNull();
    const { sent, provider } = fakeXendit(() => ({ status: 200, body: [{ id: 'disb_1', reference_id: 'OP-1', status: 'SUCCEEDED', amount: 1000 }] }));
    expect((await provider.findPayout('OP-1'))?.state).toBe('SUCCEEDED');
    expect(sent[0].url).toBe('https://api.xendit.co/v2/payouts?reference_id=OP-1');
  });

  it('accepts only confirmations carrying the verification token', () => {
    const { provider } = fakeXendit(() => ({ status: 200, body: {} }));
    expect(provider.verifyWebhook({ 'x-callback-token': 'cb-token' }, {})).toBe(true);
    expect(provider.verifyWebhook({ 'x-callback-token': 'cb-tokeN' }, {})).toBe(false);
    expect(provider.verifyWebhook({}, {})).toBe(false);
  });

  it('reads which payment a confirmation is about', () => {
    const { provider } = fakeXendit(() => ({ status: 200, body: {} }));
    expect(provider.parseWebhook({ id: 'inv_1', external_id: 'OD-1', status: 'PAID' })).toEqual({ kind: 'checkout', providerRef: 'inv_1', reference: 'OD-1' });
    expect(provider.parseWebhook({ event: 'payout.failed', data: { id: 'disb_1', reference_id: 'OP-1' } })).toEqual({ kind: 'payout', providerRef: 'disb_1', reference: 'OP-1' });
    expect(provider.parseWebhook({ hello: 'world' })).toBeNull();
  });
});
