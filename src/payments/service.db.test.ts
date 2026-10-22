import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import { HttpError, type AppDb } from '../kyc/errors';
import { seedBranch, seedMember } from '../kyc/testFixtures';
import { getRolePermissions } from '../auth/permissions';
import type { LendingClient, LendingStaff } from '../lending/service';
import { manilaToday, openAccount, saveSavingsProduct, withdraw } from '../savings/service';
import type { PaymentDeps } from './config';
import { MockProvider } from './mockProvider';
import { ProviderError, type PayoutRequest } from './provider';
import {
  addPayoutAccount,
  confirmPayout,
  dailyReport,
  decidePayoutAccount,
  myDeposit,
  needsReview,
  receiveWebhook,
  refreshMyDeposit,
  resolveDeposit,
  resolvePayout,
  startDeposit,
  startPayout,
  sweepOnlinePayments,
} from './service';
import { deposits, events, payouts } from './tables';
import { accounts as savingsAccounts } from '../savings/tables';

/**
 * Online payments: credited once, never from the browser, never overdrawn,
 * refunded once, and one member can never reach another member's money.
 */
let pg: PGlite;
let db: AppDb;
let seq = 0;
const key = () => `pay-key-${++seq}-${Date.now()}`;
const staff = (userId: string, role: string, branchId: string | null = 'br-a'): LendingStaff => ({
  kind: 'staff',
  userId,
  staffId: `st-${userId}`,
  name: `${role} ${userId}`,
  role,
  branchId,
  viewAll: branchId === null,
  permissions: getRolePermissions(role),
});
const admin = staff('admin', 'ADMINISTRATOR', null);
const teller = staff('tel', 'CASHIER_TELLER');
const otherTeller = staff('tel-b', 'CASHIER_TELLER', 'br-b');
const officer = staff('off', 'LOAN_OFFICER');
const client = (borrowerId: string): LendingClient => ({ kind: 'client', userId: `u-${borrowerId}`, name: 'Juan', borrowerId });

const provider = new MockProvider({ baseUrl: 'http://pay.test', webhookToken: 'mock-token' });
const codes: string[] = [];
const deps: PaymentDeps = {
  provider,
  dailyLimit: 500_000,
  publicBaseUrl: 'http://pay.test',
  otpSecret: 'otp-secret',
  sendOtp: async (_to, code) => {
    codes.push(code);
  },
};
const lastCode = () => codes[codes.length - 1];
let productId: string;
let numberSeq = 0;
const nextNumber = () => `0917${String(++numberSeq).padStart(7, '0')}`;

async function expectHttp(p: Promise<unknown>, status: number, code?: string): Promise<HttpError> {
  try {
    await p;
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    expect(e.status).toBe(status);
    if (code) expect(e.code).toBe(code);
    return e;
  }
  throw new Error(`expected HTTP ${status}`);
}

async function member(verified = true, branchId = 'br-a') {
  const id = await seedMember(db, { branchId });
  if (verified) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('hoscomo.kyc_actor', 'reconcile', true)`);
      await tx.update(schema.borrowers).set({ kycStatus: 'APPROVED' }).where(eq(schema.borrowers.id, id));
    });
  }
  return id;
}

async function account(opening = '6000') {
  const memberId = await member();
  const a = await openAccount(db, teller, { memberId, productId, openingDeposit: opening }, key());
  return { memberId, accountId: a.id };
}

const balance = async (accountId: string) => (await db.select({ b: savingsAccounts.balance }).from(savingsAccounts).where(eq(savingsAccounts.id, accountId)))[0].b;
const txnsWithKey = async (k: string) => (await db.select().from(schema.savingsTransactions).where(eq(schema.savingsTransactions.idempotencyKey, k))).length;

async function ledger1030() {
  const r = await db.execute(sql`select coalesce(sum(l.debit), 0)::text as d, coalesce(sum(l.credit), 0)::text as c
                                   from journal_entry_lines l join accounts a on a.account_id = l.account_id where a.account_code = '1030'`);
  const row = ((r as { rows?: { d: string; c: string }[] }).rows ?? (r as unknown as { d: string; c: string }[]))[0];
  return { debits: Number(row.d), credits: Number(row.c) };
}

const webhook = (kind: 'checkout' | 'payout', providerRef: string, reference: string, headers = provider.signedHeaders()) =>
  receiveWebhook(db, deps, 'mock', headers, provider.webhookBody(kind, providerRef, reference));

async function verifiedPayoutAccount(memberId: string, accountNumber = nextNumber()) {
  const pa = await addPayoutAccount(db, client(memberId), { channelCode: 'PH_GCASH', accountNumber, accountName: 'Juan Dela Cruz' });
  await decidePayoutAccount(db, teller, pa.id, { decision: 'VERIFY', reason: 'Saw the GCash app showing the name.' });
  return pa.id;
}

async function payoutRow(id: string) {
  return (await db.select().from(payouts).where(eq(payouts.id, id)))[0];
}

beforeAll(async () => {
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await seedBranch(db, 'br-a');
  await seedBranch(db, 'br-b');
  const p = await saveSavingsProduct(db, admin, null, {
    code: 'SAV-ONLINE',
    name: 'Regular savings',
    kind: 'REGULAR',
    annualRate: '1',
    accrualMethod: 'AVERAGE_DAILY_BALANCE',
    minimumBalance: '1000',
    minimumOpeningDeposit: '500',
    maxWithdrawalAmount: '',
    maxWithdrawalsPerMonth: '',
    termMonths: '',
    status: 'ACTIVE',
  });
  productId = p.id;
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

// ---------------------------------------------------------------------------
describe('online deposits', () => {
  it('is not credited when the member only comes back from checkout', async () => {
    const { memberId, accountId } = await account();
    const d = await startDeposit(db, deps, client(memberId), { accountId, amount: '1500' });
    expect(d.status).toBe('PENDING');
    expect(d.checkoutUrl).toContain('/api/payments/mock/checkout/');
    const back = await refreshMyDeposit(db, deps, client(memberId), d.id);
    expect(back.status).toBe('PENDING');
    expect(await balance(accountId)).toBe('6000.00');
  });

  it('is credited exactly once, however many times the provider confirms it', async () => {
    const { memberId, accountId } = await account();
    const before = await ledger1030();
    const d = await startDeposit(db, deps, client(memberId), { accountId, amount: '2500.50' });
    const row = await myDeposit(db, client(memberId), d.id);
    provider.pay(row.providerRef!);
    const first = await webhook('checkout', row.providerRef!, row.reference);
    expect(first).toEqual({ status: 200, outcome: 'CREDITED' });
    // Repeats, one after another and at the same moment.
    expect((await webhook('checkout', row.providerRef!, row.reference)).outcome).toBe('ALREADY_CREDITED');
    const together = await Promise.all([1, 2, 3].map(() => webhook('checkout', row.providerRef!, row.reference)));
    expect(together.every((r) => r.status === 200 && r.outcome === 'ALREADY_CREDITED')).toBe(true);
    expect(await refreshMyDeposit(db, deps, client(memberId), d.id)).toMatchObject({ status: 'CREDITED' });

    expect(await balance(accountId)).toBe('8500.50');
    expect(await txnsWithKey(`online-deposit:${d.id}`)).toBe(1);
    const after = await ledger1030();
    expect(after.debits - before.debits).toBeCloseTo(2500.5, 2);
    const received = await db.select().from(events).where(eq(events.providerRef, row.providerRef!));
    expect(received).toHaveLength(5);
  });

  it('refuses a confirmation that does not come from the provider', async () => {
    const { memberId, accountId } = await account();
    const d = await startDeposit(db, deps, client(memberId), { accountId, amount: '1000' });
    const row = await myDeposit(db, client(memberId), d.id);
    provider.pay(row.providerRef!);
    expect(await webhook('checkout', row.providerRef!, row.reference, { 'x-mock-signature': 'forged' })).toEqual({ status: 401, outcome: 'REJECTED_UNVERIFIED' });
    expect(await webhook('checkout', row.providerRef!, row.reference, {})).toMatchObject({ status: 401 });
    expect(await receiveWebhook(db, deps, 'xendit', provider.signedHeaders(), provider.webhookBody('checkout', row.providerRef!, row.reference))).toMatchObject({ status: 401 });
    expect(await balance(accountId)).toBe('6000.00');
    const [ev] = await db.select().from(events).where(and(eq(events.verified, false)));
    expect(ev).toBeTruthy();
  });

  it('trusts the provider, not the confirmation: an unpaid checkout is not credited', async () => {
    const { memberId, accountId } = await account();
    const d = await startDeposit(db, deps, client(memberId), { accountId, amount: '1000' });
    const row = await myDeposit(db, client(memberId), d.id);
    // Correctly signed, but the provider has not been paid.
    expect((await webhook('checkout', row.providerRef!, row.reference)).outcome).toBe('PENDING');
    expect(await balance(accountId)).toBe('6000.00');
  });

  it('sends a different paid amount to staff, who credit what the provider confirms', async () => {
    const { memberId, accountId } = await account();
    const d = await startDeposit(db, deps, client(memberId), { accountId, amount: '3000' });
    const row = await myDeposit(db, client(memberId), d.id);
    provider.pay(row.providerRef!, 2_000_00);
    expect((await webhook('checkout', row.providerRef!, row.reference)).outcome).toBe('NEEDS_REVIEW');
    expect(await balance(accountId)).toBe('6000.00');
    const review = await needsReview(db, teller);
    expect(review.deposits.map((x) => x.id)).toContain(d.id);
    await expectHttp(resolveDeposit(db, deps, officer, d.id, { action: 'CREDIT_PAID', note: 'Checked the dashboard.' }), 403);
    await expectHttp(resolveDeposit(db, deps, otherTeller, d.id, { action: 'CREDIT_PAID', note: 'Checked the dashboard.' }), 404);
    await expectHttp(resolveDeposit(db, deps, teller, d.id, { action: 'CREDIT_PAID', note: '' }), 400, 'NOTE_REQUIRED');
    const done = await resolveDeposit(db, deps, teller, d.id, { action: 'CREDIT_PAID', note: 'Member confirmed paying 2,000.' });
    expect(done.status).toBe('CREDITED');
    expect(await balance(accountId)).toBe('8000.00');
    await expectHttp(resolveDeposit(db, deps, teller, d.id, { action: 'CREDIT_PAID', note: 'Second time.' }), 409, 'NOT_IN_REVIEW');
    expect((await webhook('checkout', row.providerRef!, row.reference)).outcome).toBe('ALREADY_CREDITED');
    expect(await txnsWithKey(`online-deposit:${d.id}`)).toBe(1);
  });

  it('keeps members to their own deposits and accounts', async () => {
    const a = await account();
    const b = await account();
    const d = await startDeposit(db, deps, client(a.memberId), { accountId: a.accountId, amount: '1000' });
    await expectHttp(myDeposit(db, client(b.memberId), d.id), 404);
    await expectHttp(refreshMyDeposit(db, deps, client(b.memberId), d.id), 404);
    await expectHttp(startDeposit(db, deps, client(b.memberId), { accountId: a.accountId, amount: '1000' }), 404);
  });

  it('checks the member and the amount', async () => {
    const unverified = await member(false);
    const { accountId } = await account();
    await expectHttp(startDeposit(db, deps, client(unverified), { accountId, amount: '1000' }), 403, 'KYC_REQUIRED');
    const { memberId, accountId: own } = await account();
    await expectHttp(startDeposit(db, deps, client(memberId), { accountId: own, amount: '50' }), 400, 'INVALID_AMOUNT');
    await expectHttp(startDeposit(db, deps, client(memberId), { accountId: own, amount: '100000' }), 400, 'INVALID_AMOUNT');
    await expectHttp(startDeposit(db, deps, client(memberId), { accountId: own, amount: '10.555' }), 400, 'INVALID_AMOUNT');
  });

  it('credits a payment whose confirmation never arrived, on the next sweep', async () => {
    const { memberId, accountId } = await account();
    const d = await startDeposit(db, deps, client(memberId), { accountId, amount: '1200' });
    const row = await myDeposit(db, client(memberId), d.id);
    provider.pay(row.providerRef!);
    await db.update(deposits).set({ createdAt: new Date(Date.now() - 10 * 60_000).toISOString() }).where(eq(deposits.id, d.id));
    const swept = await sweepOnlinePayments(db, deps);
    expect(swept.errors).toEqual([]);
    expect(await balance(accountId)).toBe('7200.00');
  });
});

// ---------------------------------------------------------------------------
describe('payout accounts', () => {
  it('accepts only accounts in the member’s own name, once, and only after branch verification', async () => {
    const { memberId, accountId } = await account();
    const number = nextNumber();
    await expectHttp(addPayoutAccount(db, client(memberId), { channelCode: 'PH_GCASH', accountNumber: number, accountName: 'Pedro Reyes' }), 400, 'NOT_OWN_NAME');
    await expectHttp(addPayoutAccount(db, client(memberId), { channelCode: 'PH_GCASH', accountNumber: number, accountName: 'Juan Dela Cruz Jr Smith' }), 400, 'NOT_OWN_NAME');
    await expectHttp(addPayoutAccount(db, client(memberId), { channelCode: 'PH_GCASH', accountNumber: '12345', accountName: 'Juan Dela Cruz' }), 400, 'INVALID_ACCOUNT');
    const pa = await addPayoutAccount(db, client(memberId), { channelCode: 'PH_GCASH', accountNumber: number, accountName: 'JUAN S. DELA CRUZ' });
    expect(pa.status).toBe('PENDING_VERIFICATION');
    expect(pa.accountNumber).not.toContain(number.slice(0, 6));
    await expectHttp(addPayoutAccount(db, client(memberId), { channelCode: 'PH_GCASH', accountNumber: number, accountName: 'Juan Dela Cruz' }), 409, 'DUPLICATE_ACCOUNT');

    await expectHttp(startPayout(db, deps, client(memberId), { accountId, payoutAccountId: pa.id, amount: '500' }), 409, 'ACCOUNT_NOT_VERIFIED');
    await expectHttp(decidePayoutAccount(db, officer, pa.id, { decision: 'VERIFY', reason: 'Looked at it.' }), 403);
    await expectHttp(decidePayoutAccount(db, otherTeller, pa.id, { decision: 'VERIFY', reason: 'Looked at it.' }), 404);
    await decidePayoutAccount(db, teller, pa.id, { decision: 'VERIFY', reason: 'Saw the GCash app showing the name.' });
    await expectHttp(decidePayoutAccount(db, teller, pa.id, { decision: 'REJECT', reason: 'Changed my mind.' }), 409, 'ALREADY_DECIDED');

    // The same number cannot be added, or verified, for another member.
    const other = await member();
    await expectHttp(addPayoutAccount(db, client(other), { channelCode: 'PH_GCASH', accountNumber: number, accountName: 'Juan Dela Cruz' }), 409, 'ACCOUNT_IN_USE');
  });

  it('never pays out to another member’s account', async () => {
    const a = await account();
    const b = await account();
    const aAccount = await verifiedPayoutAccount(a.memberId);
    await expectHttp(startPayout(db, deps, client(b.memberId), { accountId: b.accountId, payoutAccountId: aAccount, amount: '500' }), 404);
    await expectHttp(startPayout(db, deps, client(b.memberId), { accountId: a.accountId, payoutAccountId: aAccount, amount: '500' }), 404);
  });
});

// ---------------------------------------------------------------------------
describe('instant withdrawals', () => {
  it('takes nothing until the code is right, then pays out', async () => {
    const { memberId, accountId } = await account();
    const target = await verifiedPayoutAccount(memberId);
    const before = await ledger1030();
    const started = await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '2000' });
    expect(started.payout.status).toBe('AWAITING_OTP');
    expect(started.codeSentTo).toMatch(/@example\.com$/);
    expect(await balance(accountId)).toBe('6000.00');
    const wrong = lastCode() === '000000' ? '111111' : '000000';
    await expectHttp(confirmPayout(db, deps, client(memberId), started.payout.id, { code: wrong }), 400, 'WRONG_OTP');
    expect(await balance(accountId)).toBe('6000.00');

    const sent = await confirmPayout(db, deps, client(memberId), started.payout.id, { code: lastCode() });
    expect(sent.status).toBe('PROCESSING');
    expect(await balance(accountId)).toBe('4000.00');
    // A second confirm (double click) takes nothing more.
    expect((await confirmPayout(db, deps, client(memberId), started.payout.id, { code: lastCode() })).status).toBe('PROCESSING');
    expect(await txnsWithKey(`online-payout:${started.payout.id}`)).toBe(1);

    const row = await payoutRow(started.payout.id);
    provider.settlePayout(row.providerRef!, 'SUCCEEDED');
    expect((await webhook('payout', row.providerRef!, row.reference)).outcome).toBe('PAID');
    expect((await webhook('payout', row.providerRef!, row.reference)).outcome).toBe('ALREADY_PAID');
    expect(await balance(accountId)).toBe('4000.00');
    expect((await ledger1030()).credits - before.credits).toBeCloseTo(2000, 2);
  });

  it('stops at the daily limit; the rest becomes a branch request', async () => {
    const { memberId, accountId } = await account('20000');
    const target = await verifiedPayoutAccount(memberId);
    await expectHttp(startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '5000.01' }), 409, 'OVER_DAILY_LIMIT');
    const s = await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '4000' });
    await confirmPayout(db, deps, client(memberId), s.payout.id, { code: lastCode() });
    const over = await expectHttp(startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '1500' }), 409, 'OVER_DAILY_LIMIT');
    expect((over.details as { remaining: string }).remaining).toBe('1000.00');
    await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '1000' });
  });

  it('returns the money exactly once when the payout fails', async () => {
    const { memberId, accountId } = await account();
    const target = await verifiedPayoutAccount(memberId);
    const s = await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '3000' });
    await confirmPayout(db, deps, client(memberId), s.payout.id, { code: lastCode() });
    expect(await balance(accountId)).toBe('3000.00');
    const row = await payoutRow(s.payout.id);
    provider.settlePayout(row.providerRef!, 'FAILED');
    const results = await Promise.all([1, 2, 3].map(() => webhook('payout', row.providerRef!, row.reference)));
    expect(results.map((r) => r.outcome).sort()).toEqual(['ALREADY_REFUNDED', 'ALREADY_REFUNDED', 'REFUNDED']);
    expect(await balance(accountId)).toBe('6000.00');
    expect(await txnsWithKey(`online-payout-refund:${s.payout.id}`)).toBe(1);
    expect((await payoutRow(s.payout.id)).status).toBe('REFUNDED');
    // The failed payout no longer counts against today's limit.
    await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '5000' });
  });

  it('returns the money at once when the provider refuses the payout', async () => {
    const { memberId, accountId } = await account();
    const target = await verifiedPayoutAccount(memberId, '09170009999');
    const s = await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '1000' });
    const done = await confirmPayout(db, deps, client(memberId), s.payout.id, { code: lastCode() });
    expect(done.status).toBe('REFUNDED');
    expect(await balance(accountId)).toBe('6000.00');
  });

  it('cancels on an expired code or too many wrong ones, taking nothing', async () => {
    const { memberId, accountId } = await account();
    const target = await verifiedPayoutAccount(memberId);
    const s1 = await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '1000' });
    await db.update(payouts).set({ otpExpiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(payouts.id, s1.payout.id));
    await expectHttp(confirmPayout(db, deps, client(memberId), s1.payout.id, { code: lastCode() }), 410, 'OTP_EXPIRED');
    expect((await payoutRow(s1.payout.id)).status).toBe('CANCELLED');

    const s2 = await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '1000' });
    const good = lastCode();
    const bad = good === '123456' ? '654321' : '123456';
    for (let i = 0; i < 4; i++) await expectHttp(confirmPayout(db, deps, client(memberId), s2.payout.id, { code: bad }), 400, 'WRONG_OTP');
    await expectHttp(confirmPayout(db, deps, client(memberId), s2.payout.id, { code: bad }), 429, 'OTP_LOCKED');
    expect((await confirmPayout(db, deps, client(memberId), s2.payout.id, { code: good })).status).toBe('CANCELLED');
    expect(await balance(accountId)).toBe('6000.00');
  });

  it('keeps one member out of another’s withdrawal and code', async () => {
    const a = await account();
    const b = await account();
    const target = await verifiedPayoutAccount(a.memberId);
    const s = await startPayout(db, deps, client(a.memberId), { accountId: a.accountId, payoutAccountId: target, amount: '1000' });
    await expectHttp(confirmPayout(db, deps, client(b.memberId), s.payout.id, { code: lastCode() }), 404);
    expect(await balance(a.accountId)).toBe('6000.00');
    expect((await payoutRow(s.payout.id)).status).toBe('AWAITING_OTP');
  });

  it('cannot overdraw when an instant withdrawal and a counter withdrawal happen at once', async () => {
    // 6,000 with a 1,000 minimum: 5,000 can leave. 4,000 online and 3,000 at the counter cannot both.
    const { memberId, accountId } = await account();
    const target = await verifiedPayoutAccount(memberId);
    const s = await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '4000' });
    const results = await Promise.allSettled([
      confirmPayout(db, deps, client(memberId), s.payout.id, { code: lastCode() }),
      withdraw(db, teller, accountId, { amount: '3000', method: 'CASH' }, key()),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toBeInstanceOf(HttpError);
    expect((refused[0].reason as HttpError).status).toBe(409);
    expect(Number(await balance(accountId))).toBeGreaterThanOrEqual(1000);
  });

  it('allows one code at a time, so two devices cannot double the limit', async () => {
    const { memberId, accountId } = await account('20000');
    const target = await verifiedPayoutAccount(memberId);
    const first = await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '5000' });
    const firstCode = lastCode();
    const second = await startPayout(db, deps, client(memberId), { accountId, payoutAccountId: target, amount: '5000' });
    const [r1, r2] = await Promise.all([
      confirmPayout(db, deps, client(memberId), first.payout.id, { code: firstCode }),
      confirmPayout(db, deps, client(memberId), second.payout.id, { code: lastCode() }),
    ]);
    expect(r1.status).toBe('CANCELLED');
    expect(r2.status).toBe('PROCESSING');
    expect(await balance(accountId)).toBe('15000.00');
  });

  it('sends a payout again under the same reference when the provider never received it', async () => {
    const { memberId, accountId } = await account();
    const target = await verifiedPayoutAccount(memberId);
    const flaky: PaymentDeps = {
      ...deps,
      provider: Object.assign(Object.create(provider), {
        createPayout: async (_input: PayoutRequest) => {
          throw new ProviderError('timed out', false);
        },
      }),
    };
    const s = await startPayout(db, flaky, client(memberId), { accountId, payoutAccountId: target, amount: '1000' });
    expect((await confirmPayout(db, flaky, client(memberId), s.payout.id, { code: lastCode() })).status).toBe('SUBMITTING');
    expect(await balance(accountId)).toBe('5000.00');
    // Staff cannot refund while the outcome is unknown at the provider... it has no record, so a retry is offered.
    await db.update(payouts).set({ updatedAt: new Date(Date.now() - 5 * 60_000).toISOString() }).where(eq(payouts.id, s.payout.id));
    const swept = await sweepOnlinePayments(db, deps);
    expect(swept.sentAgain).toBeGreaterThanOrEqual(1);
    const row = await payoutRow(s.payout.id);
    expect(row.status).toBe('PROCESSING');
    await expectHttp(resolvePayout(db, deps, teller, s.payout.id, { action: 'REFUND', note: 'Member asked for the money back.' }), 409, 'AT_PROVIDER');
    provider.settlePayout(row.providerRef!, 'SUCCEEDED');
    expect((await resolvePayout(db, deps, teller, s.payout.id, { action: 'RECHECK', note: 'Checked with the provider.' })).status).toBe('PAID');
    expect(await txnsWithKey(`online-payout:${s.payout.id}`)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('daily report', () => {
  it('matches the ledger and the provider, and lists a payment the provider has that was not credited', async () => {
    const today = manilaToday();
    const clean = await dailyReport(db, deps, admin, today);
    expect(clean.mismatches.filter((m) => m.kind === 'ledger')).toEqual([]);

    const { memberId, accountId } = await account();
    const d = await startDeposit(db, deps, client(memberId), { accountId, amount: '1000' });
    const row = await myDeposit(db, client(memberId), d.id);
    provider.pay(row.providerRef!);
    const missed = await dailyReport(db, deps, admin, today);
    expect(missed.ok).toBe(false);
    expect(missed.mismatches.map((m) => m.code)).toContain('PAID_NOT_CREDITED');

    await webhook('checkout', row.providerRef!, row.reference);
    const fixed = await dailyReport(db, deps, admin, today);
    expect(fixed.mismatches.filter((m) => m.code === 'PAID_NOT_CREDITED' && m.reference === row.reference)).toEqual([]);
    expect(fixed.mismatches.filter((m) => m.kind === 'ledger')).toEqual([]);
    await expectHttp(dailyReport(db, deps, staff('x', 'CLIENT'), today), 403);
  });
});

describe('records', () => {
  it('keeps provider confirmations as received', async () => {
    await expect(db.update(events).set({ outcome: 'changed' })).rejects.toThrow();
    await expect(db.delete(events)).rejects.toThrow();
  });
});
