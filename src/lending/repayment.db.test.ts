import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import { HttpError, type AppDb } from '../kyc/errors';
import { manilaToday } from '../kyc/service';
import { seedBranch, seedMember, textJpeg } from '../kyc/testFixtures';
import { getRolePermissions } from '../auth/permissions';
import { createApplication, decideApplication, disburseLoan, loanDetail, saveProduct, trialBalance, type LendingClient, type LendingStaff } from './service';
import { claimProof, collectionsOverview, payoffQuote, postPayment, rejectProof, reversePayment, runOverdueCheck, submitProof, verifyProof } from './repayment';

let pg: PGlite;
let db: AppDb;
let productId: string;
let seq = 0;

const staff = (userId: string, role: string, branchId: string | null = 'br-a'): LendingStaff => ({
  kind: 'staff',
  userId,
  staffId: `st-${userId}`,
  name: `${role} ${userId}`,
  role,
  branchId,
  viewAll: false,
  permissions: getRolePermissions(role),
});
const admin = { ...staff('admin', 'ADMINISTRATOR', null), viewAll: true };
const officer = staff('off1', 'LOAN_OFFICER');
const teller = staff('tel1', 'CASHIER_TELLER');
const teller2 = staff('tel2', 'CASHIER_TELLER');
const manager = staff('mgr', 'MANAGER');
const client = (borrowerId: string): LendingClient => ({ kind: 'client', userId: `u-${borrowerId}`, name: 'Juan', borrowerId });
const key = () => `test-key-${++seq}-${Date.now()}`;
const today = manilaToday();
const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

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

/** A released loan: 30,000.00 flat 12% a year over 3 months = three installments of 10,300.00. */
async function activeLoan() {
  const id = await seedMember(db);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('hoscomo.kyc_actor', 'reconcile', true)`);
    await tx.update(schema.borrowers).set({ kycStatus: 'APPROVED', activeLoansCount: 0 }).where(eq(schema.borrowers.id, id));
  });
  const { loan } = await createApplication(db, client(id), { productId, amount: '30000', termMonths: 3, purpose: 'BUSINESS' });
  await decideApplication(db, officer, loan.id, { decision: 'APPROVE', reason: 'Good standing' });
  await disburseLoan(db, teller, loan.id, { method: 'CASH', disbursementDate: today }, key());
  return { loanId: loan.id, borrowerId: id };
}

/** Moves installment due dates so that installment 1 falls `days` days after today (negative = past). */
async function moveDueDates(loanId: string, firstDue: string) {
  const rows = await db.select().from(schema.loanSchedule).where(eq(schema.loanSchedule.loanId, loanId));
  for (const r of rows) {
    await db.update(schema.loanSchedule).set({ dueDate: shift(firstDue, (r.installmentNumber - 1) * 30) }).where(eq(schema.loanSchedule.id, r.id));
  }
}

const schedule = async (loanId: string) =>
  (await db.select().from(schema.loanSchedule).where(eq(schema.loanSchedule.loanId, loanId))).sort((a, b) => a.installmentNumber - b.installmentNumber);
const cash = (amount: string, extra: Record<string, unknown> = {}) => ({ amount, method: 'CASH', paymentDate: today, ...extra });
const balanced = async () => {
  const tb = await trialBalance(db);
  return tb.reduce((s, a) => s + a.debit, 0) === tb.reduce((s, a) => s + a.credit, 0);
};

beforeAll(async () => {
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await seedBranch(db, 'br-a');
  const p = await saveProduct(db, admin, null, {
    code: 'FLAT-3',
    name: 'Flat test loan',
    category: 'Test',
    description: '',
    interestMethod: 'FLAT',
    annualRate: '12',
    minAmount: '1000',
    maxAmount: '100000',
    minTermMonths: 1,
    maxTermMonths: 12,
    frequency: 'MONTHLY',
    fees: [],
    penaltyRate: '3',
    lendingType: 'INDIVIDUAL',
    requiresCollateral: false,
    requiresGuarantor: false,
    status: 'ACTIVE',
  });
  productId = p.id;
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

describe('posting payments', () => {
  it('partial payment: interest first, then principal; ledger, receipt, audit and notification', async () => {
    const { loanId } = await activeLoan();
    await moveDueDates(loanId, today);
    const before = await trialBalance(db);
    const r = await postPayment(db, teller, loanId, cash('5000'), key());
    expect(r.payment).toMatchObject({ kind: 'PARTIAL', interest: '300.00', principal: '4700.00', penalty: '0.00', excess: '0.00', status: 'POSTED' });
    expect(r.receipt.receiptNumber).toMatch(/^OR-\d{4}-\d{6}$/);
    expect(r.receipt.lines.map((l) => [l.label, l.amount])).toEqual([
      ['Interest', '300.00'],
      ['Principal', '4700.00'],
    ]);
    const s = await schedule(loanId);
    expect(s[0]).toMatchObject({ status: 'PARTIAL', interestPaid: '300.00', principalPaid: '4700.00', amountPaid: '5000.00' });
    expect(r.loan.remainingBalance).toBe('25900.00');
    const after = await trialBalance(db);
    const delta = (code: string, side: 'debit' | 'credit') => (after.find((a) => a.accountCode === code)?.[side] ?? 0) - (before.find((a) => a.accountCode === code)?.[side] ?? 0);
    expect([delta('1010', 'debit'), delta('4010', 'credit'), delta('1110', 'credit')]).toEqual([500_000, 30_000, 470_000]);
    expect(await balanced()).toBe(true);
    const audits = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.targetId, loanId), eq(schema.auditLogs.action, 'PAYMENT_POSTED')));
    expect(audits).toHaveLength(1);
    const notes = await db.select().from(schema.branchNotifications).where(and(eq(schema.branchNotifications.relatedId, loanId), eq(schema.branchNotifications.type, 'PAYMENT_RECEIVED')));
    expect(notes).toHaveLength(1);
  });

  it('full payment of what is due today settles that installment', async () => {
    const { loanId } = await activeLoan();
    await moveDueDates(loanId, today);
    const r = await postPayment(db, teller, loanId, cash('10300'), key());
    expect(r.payment.kind).toBe('FULL');
    const s = await schedule(loanId);
    expect(s.map((i) => i.status)).toEqual(['PAID', 'PENDING', 'PENDING']);
    expect(s[0].paidAt).toBeTruthy();
    expect(r.loan.status).toBe('Active');
  });

  it('advance payment pays future installments in order', async () => {
    const { loanId } = await activeLoan();
    const r = await postPayment(db, teller, loanId, cash('15000'), key());
    expect(r.payment.kind).toBe('ADVANCE');
    const s = await schedule(loanId);
    expect(s.map((i) => [i.status, i.amountPaid])).toEqual([
      ['PAID', '10300.00'],
      ['PARTIAL', '4700.00'],
      ['PENDING', '0.00'],
    ]);
  });

  it('the final payment closes the loan', async () => {
    const { loanId, borrowerId } = await activeLoan();
    await postPayment(db, teller, loanId, cash('10300'), key());
    const last = await postPayment(db, teller, loanId, cash('20600'), key());
    expect(last.payment.kind).toBe('FULL');
    expect(last.loan.status).toBe('Closed');
    expect(last.loan.remainingBalance).toBe('0.00');
    expect(last.loan.history.slice(-1)[0]).toMatchObject({ from: 'Active', to: 'Closed' });
    expect(last.receipt.footer).toBe('This loan is fully paid.');
    const [b] = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId));
    expect(b.activeLoansCount).toBe(0);
    await expectHttp(postPayment(db, teller, loanId, cash('100'), key()), 409, 'LOAN_NOT_ACTIVE');
  });

  it('overpayment settles the loan, closes it and holds the excess for the member', async () => {
    const { loanId } = await activeLoan();
    const before = await trialBalance(db);
    const r = await postPayment(db, teller, loanId, cash('31000'), key());
    expect(r.payment).toMatchObject({ kind: 'OVERPAYMENT', excess: '100.00', principal: '30000.00', interest: '900.00' });
    expect(r.loan.status).toBe('Closed');
    const after = await trialBalance(db);
    const payable = (after.find((a) => a.accountCode === '2030')?.credit ?? 0) - (before.find((a) => a.accountCode === '2030')?.credit ?? 0);
    expect(payable).toBe(10_000);
    expect(r.receipt.lines.find((l) => l.label === 'Overpayment')?.amount).toBe('100.00');
  });

  it('is idempotent and refuses a reused bank reference', async () => {
    const { loanId } = await activeLoan();
    const k = key();
    const a = await postPayment(db, teller, loanId, { amount: '1000', method: 'BANK_TRANSFER', referenceNumber: 'BDO-778', paymentDate: today }, k);
    const b = await postPayment(db, teller, loanId, { amount: '1000', method: 'BANK_TRANSFER', referenceNumber: 'BDO-778', paymentDate: today }, k);
    expect(b.replayed).toBe(true);
    expect(b.payment.id).toBe(a.payment.id);
    await expectHttp(postPayment(db, teller, loanId, { amount: '1000', method: 'BANK_TRANSFER', referenceNumber: 'bdo-778', paymentDate: today }, key()), 409);
    await expectHttp(postPayment(db, teller, loanId, cash('1000'), 'short'), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    await expectHttp(postPayment(db, officer, loanId, cash('1000'), key()), 403, 'FORBIDDEN');
    await expectHttp(postPayment(db, staff('telb', 'CASHIER_TELLER', 'br-b'), loanId, cash('1000'), key()), 404);
    const e = await expectHttp(postPayment(db, teller, loanId, { amount: '0', method: 'E_WALLET', paymentDate: shift(today, 1) }, key()), 400, 'INVALID_PAYMENT');
    expect(Object.keys((e.details as any).fields).sort()).toEqual(['amount', 'paymentDate', 'referenceNumber']);
  });

  it('payments cannot be deleted', async () => {
    const { loanId } = await activeLoan();
    await postPayment(db, teller, loanId, cash('1000'), key());
    const err = await db.delete(schema.payments).where(eq(schema.payments.loanId, loanId)).then(() => null, (e) => e);
    expect(String(err?.cause?.message ?? err?.message)).toMatch(/never deleted/);
    expect(await db.select().from(schema.payments).where(eq(schema.payments.loanId, loanId))).toHaveLength(1);
  });
});

describe('overdue check and penalties', () => {
  it('charges each overdue installment exactly once, however often it runs', async () => {
    const { loanId } = await activeLoan();
    const [first] = await schedule(loanId);
    const day = shift(first.dueDate, 5);
    const run1 = await runOverdueCheck(db, day);
    expect(run1.penaltiesCharged).toBeGreaterThanOrEqual(1);
    const pens = () => db.select().from(schema.loanPenalties).where(eq(schema.loanPenalties.loanId, loanId));
    expect((await pens()).map((p) => [p.installmentNumber, p.period, p.amount])).toEqual([[1, 1, '309.00']]); // 3% of 10,300.00
    const run2 = await runOverdueCheck(db, day);
    const run3 = await runOverdueCheck(db, shift(day, 3));
    expect((await pens()).filter((p) => p.loanId === loanId)).toHaveLength(1);
    expect(run2.loansCharged).not.toContain(run1.loansCharged.find((n) => n));
    expect(run3.loansCharged).toEqual(expect.not.arrayContaining(run1.loansCharged));
    const s = await schedule(loanId);
    expect(s[0]).toMatchObject({ status: 'OVERDUE', penaltyDue: '309.00' });
    const [loan] = await db.select().from(schema.loans).where(eq(schema.loans.id, loanId));
    expect(loan.totalLatePenaltiesCharged).toBe(309);
    expect(loan.daysInArrears).toBe(8); // as of the last (simulated) run, 8 days after the due date
    expect(await balanced()).toBe(true);
    const entries = await db.select().from(schema.journalEntries).where(and(eq(schema.journalEntries.sourceRef, loanId), eq(schema.journalEntries.sourceModule, 'loan_penalties')));
    expect(entries).toHaveLength(1);
    // A month later the second month (and the next installment's first) are charged once more.
    await runOverdueCheck(db, shift(first.dueDate, 32));
    await runOverdueCheck(db, shift(first.dueDate, 32));
    expect((await pens()).map((p) => `${p.installmentNumber}:${p.period}`).sort()).toEqual(['1:1', '1:2', '2:1']);
  });

  it('a payment pays the penalty before interest and principal', async () => {
    const { loanId } = await activeLoan();
    await moveDueDates(loanId, shift(today, -10));
    const r = await postPayment(db, teller, loanId, cash('1000'), key());
    expect(r.payment).toMatchObject({ penalty: '309.00', interest: '300.00', principal: '391.00', kind: 'PARTIAL' });
    const q = await payoffQuote(db, teller, loanId);
    expect(q.daysPastDue).toBe(10);
    expect(q.installments[0].status).toBe('OVERDUE');
  });

  it('reports overdue loans and portfolio at risk', async () => {
    const { loanId } = await activeLoan();
    await moveDueDates(loanId, shift(today, -40));
    const c = await collectionsOverview(db, teller);
    const row = c.overdue.find((o) => o.loanId === loanId)!;
    expect(row.daysPastDue).toBe(40);
    expect(c.par.find((b) => b.days === 30)!.ratioBps).toBeGreaterThan(0);
    expect(Number(c.portfolio)).toBeGreaterThan(0);
  });
});

describe('reversal', () => {
  it('restores the installments, posts a mirror entry, keeps the payment and reopens a closed loan', async () => {
    const { loanId } = await activeLoan();
    const p1 = await postPayment(db, teller, loanId, cash('10300'), key());
    const p2 = await postPayment(db, teller, loanId, cash('20600'), key());
    expect(p2.loan.status).toBe('Closed');
    await expectHttp(reversePayment(db, teller, p2.payment.id, 'Wrong loan'), 403, 'FORBIDDEN');
    await expectHttp(reversePayment(db, manager, p1.payment.id, 'Wrong loan'), 409, 'NOT_LATEST');
    await expectHttp(reversePayment(db, { ...manager, userId: teller.userId }, p2.payment.id, 'Wrong loan'), 403, 'SAME_REVERSER');
    await expectHttp(reversePayment(db, manager, p2.payment.id, ''), 400, 'REASON_REQUIRED');
    const r = await reversePayment(db, manager, p2.payment.id, 'Posted to the wrong member');
    expect(r.payment.status).toBe('REVERSED');
    expect(r.payment.reversal?.reference).toMatch(/^RV-/);
    expect(r.loan.status).toBe('Active');
    expect(r.loan.remainingBalance).toBe('20600.00');
    const s = await schedule(loanId);
    expect(s.map((i) => i.status)).toEqual(['PAID', 'PENDING', 'PENDING']);
    expect(await balanced()).toBe(true);
    const rows = await db.select().from(schema.payments).where(eq(schema.payments.loanId, loanId));
    expect(rows).toHaveLength(2);
    await expectHttp(reversePayment(db, manager, p2.payment.id, 'again please'), 409, 'ALREADY_REVERSED');
    const audits = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.targetId, loanId), eq(schema.auditLogs.action, 'PAYMENT_REVERSED')));
    expect(audits).toHaveLength(1);
  });
});

describe('payment proofs', () => {
  const jpeg = `data:image/jpeg;base64,${textJpeg(400, 300).toString('base64')}`;

  it('member uploads proof; staff verify and only then the payment posts', async () => {
    const { loanId, borrowerId } = await activeLoan();
    await expectHttp(submitProof(db, client(borrowerId), { loanId, amount: '2000', method: 'CASH', paymentDate: today, fileBase64: jpeg }), 400, 'INVALID_PROOF');
    await expectHttp(submitProof(db, client(borrowerId), { loanId, amount: '2000', method: 'E_WALLET', referenceNumber: 'GC-0001', paymentDate: today, fileBase64: '' }), 400, 'INVALID_PROOF');
    const proof = await submitProof(db, client(borrowerId), { loanId, amount: '2000', method: 'E_WALLET', referenceNumber: 'GC-0001', paymentDate: today, fileBase64: jpeg, fileName: 'gcash.jpg' });
    expect(proof.status).toBe('PENDING_REVIEW');
    expect(await db.select().from(schema.payments).where(eq(schema.payments.loanId, loanId))).toHaveLength(0);
    await expectHttp(submitProof(db, client(borrowerId), { loanId, amount: '2000', method: 'E_WALLET', referenceNumber: 'gc-0001', paymentDate: today, fileBase64: jpeg }), 409, 'DUPLICATE_REFERENCE');

    await claimProof(db, teller2, proof.id);
    await expectHttp(verifyProof(db, teller, proof.id), 409, 'CLAIMED');
    await expectHttp(verifyProof(db, teller2, proof.id, { amount: '2500' }), 400, 'ABOVE_CLAIM');
    const v = await verifyProof(db, teller2, proof.id, { amount: '1800' });
    expect(v.payment).toMatchObject({ amount: '1800.00', method: 'E_WALLET', reference: 'GC-0001', proofId: proof.id });
    const [row] = await db.select().from(schema.paymentProofs).where(eq(schema.paymentProofs.id, proof.id));
    expect(row.status).toBe('VERIFIED');
    expect(row.paymentId).toBe(v.payment.id);
    await expectHttp(verifyProof(db, teller2, proof.id), 409, 'ALREADY_DECIDED');
  });

  it('a rejected proof posts nothing and tells the member why', async () => {
    const { loanId, borrowerId } = await activeLoan();
    const proof = await submitProof(db, client(borrowerId), { loanId, amount: '2000', method: 'BANK_TRANSFER', referenceNumber: 'BPI-123', paymentDate: today, fileBase64: jpeg });
    await expectHttp(rejectProof(db, teller, proof.id, 'no'), 400, 'REASON_REQUIRED');
    const r = await rejectProof(db, teller, proof.id, 'The transfer is not in our account statement.');
    expect(r.status).toBe('REJECTED');
    expect(await db.select().from(schema.payments).where(eq(schema.payments.loanId, loanId))).toHaveLength(0);
    const notes = await db.select().from(schema.branchNotifications).where(and(eq(schema.branchNotifications.borrowerId, borrowerId), eq(schema.branchNotifications.type, 'PAYMENT_PROOF_REJECTED')));
    expect(notes[0]?.message).toMatch(/not in our account statement/);
  });
});

describe('member view', () => {
  it('shows payments against the stored schedule', async () => {
    const { loanId, borrowerId } = await activeLoan();
    await postPayment(db, teller, loanId, cash('5000'), key());
    const v = await loanDetail(db, client(borrowerId), loanId);
    expect(v.schedule[0]).toMatchObject({ status: 'PARTIAL', paid: '5000.00', outstanding: '5300.00', penalty: '0.00' });
    expect(v.nextDue).toEqual({ dueDate: v.schedule[0].dueDate, amount: '5300.00' });
  });
});
