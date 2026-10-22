import express, { Router, type Request, type Response } from 'express';
import { formatPeso, parsePesos } from '../../shared/lending';
import { getDb } from '../db/index';
import type { AppDb } from '../kyc/errors';
import { mockProvider, paymentDeps } from '../payments/config';
import { receiveWebhook } from '../payments/service';
import { sendError } from './httpErrors';

/**
 * Public payment routes (no sign-in): provider confirmations, and the mock
 * provider's checkout page for local testing.
 *
 * A confirmation is accepted only when it verifies against the provider's
 * secret; even then it only says which payment changed, and the server asks
 * the provider again before crediting or refunding anything.
 */
export const paymentRouter = Router();

paymentRouter.post('/api/payments/webhooks/:provider', async (req: Request, res: Response) => {
  const db = getDb();
  // 503 makes the provider send the confirmation again later.
  if (!db) return res.status(503).json({ received: false });
  try {
    const r = await receiveWebhook(db as unknown as AppDb, paymentDeps(), String(req.params.provider), req.headers, req.body);
    res.status(r.status).json({ received: r.status === 200 });
  } catch (err) {
    sendError(res, err, 'payment-webhook');
  }
});

// ---------------------------------------------------------------------------
// Mock provider checkout (development only: the mock provider is refused in production)
// ---------------------------------------------------------------------------

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function mockPage(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 32px 16px; background: #f1f5f9; color: #0f172a; }
  main { max-width: 420px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
  @media (prefers-color-scheme: dark) { body { background: #0f172a; color: #e2e8f0; } main { background: #1e293b; border-color: #334155; } }
  .tag { display: inline-block; font-size: 12px; font-weight: 700; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 999px; }
  .amount { font-size: 32px; font-weight: 800; margin: 12px 0 4px; }
  label { display: block; font-size: 13px; margin-top: 16px; }
  select, input { width: 100%; box-sizing: border-box; padding: 8px; margin-top: 4px; border-radius: 8px; border: 1px solid #cbd5e1; font: inherit; }
  .row { display: flex; gap: 8px; margin-top: 20px; }
  button { flex: 1; padding: 10px; border-radius: 10px; border: 0; font-weight: 700; cursor: pointer; }
  .pay { background: #059669; color: #fff; } .cancel { background: #e2e8f0; color: #0f172a; }
  p.small { font-size: 12px; color: #64748b; }
</style></head><body><main>${body}</main></body></html>`;
}

paymentRouter.get('/api/payments/mock/checkout/:ref', (req: Request, res: Response) => {
  try {
    const mock = mockProvider();
    const c = mock?.checkout(String(req.params.ref));
    if (!mock || !c) return res.status(404).send(mockPage('Not found', '<p>This test checkout does not exist (the server may have restarted).</p>'));
    const v = c.view;
    const done = v.state !== 'PENDING';
    res.send(
      mockPage(
        'Test checkout',
        `<span class="tag">Test payment provider: no real money moves</span>
<p>Reference ${escape(v.reference)}</p>
<div class="amount">${escape(formatPeso(v.amount))}</div>
${
  done
    ? `<p>This checkout is ${escape(v.state.toLowerCase())}.</p><p><a href="${escape(c.returnUrl)}">Back to HOSCOMCO</a></p>`
    : `<form method="post">
  <label>Confirmation to HOSCOMCO
    <select name="confirmations">
      <option value="1" selected>Send it once</option>
      <option value="2">Send it twice at once (duplicate test)</option>
      <option value="0">Do not send it (missed confirmation test)</option>
    </select>
  </label>
  <label>Amount actually paid (leave empty to pay the full amount)
    <input name="paidAmount" inputmode="decimal" placeholder="${escape(formatPeso(v.amount))}">
  </label>
  <div class="row">
    <button class="cancel" name="action" value="cancel">Cancel</button>
    <button class="pay" name="action" value="pay">Pay</button>
  </div>
</form>
<p class="small">Paying here only tells the test provider. HOSCOMCO credits the account when the provider's confirmation reaches its server.</p>`
}`,
      ),
    );
  } catch (err) {
    sendError(res, err, 'mock-checkout');
  }
});

paymentRouter.post('/api/payments/mock/checkout/:ref', express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
  try {
    const mock = mockProvider();
    const ref = String(req.params.ref);
    const c = mock?.checkout(ref);
    if (!mock || !c) return res.status(404).send(mockPage('Not found', '<p>This test checkout does not exist.</p>'));
    if (req.body?.action === 'cancel') {
      mock.cancel(ref);
    } else {
      const raw = typeof req.body?.paidAmount === 'string' ? req.body.paidAmount.replace(/[₱,\s]/g, '') : '';
      const paid = raw ? parsePesos(raw) : null;
      if (raw && paid === null) return res.status(400).send(mockPage('Check the amount', '<p>Enter the amount in pesos and centavos.</p>'));
      mock.pay(ref, paid ?? undefined);
    }
    const times = Math.max(0, Math.min(2, Number(req.body?.confirmations ?? 1)));
    await Promise.all(Array.from({ length: times }, () => mock.notify('checkout', ref, c.view.reference)));
    res.redirect(303, c.returnUrl);
  } catch (err) {
    sendError(res, err, 'mock-checkout-pay');
  }
});
