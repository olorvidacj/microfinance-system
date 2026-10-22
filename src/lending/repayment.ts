import { and, asc, desc, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  FREQUENCY_LABELS,
  GROUP_FUND_ACCOUNT,
  SOLIDARITY_FUND_METHOD,
  paymentMethodLabel,
  PAYMENT_METHOD_LABELS,
  allocatePayment,
  assertLoanTransition,
  centsFromDb,
  centsToDecimal,
  daysPastDue,
  formatPeso,
  installmentStatus,
  normaliseLoanStatus,
  outstandingOf,
  payoffAmount,
  amountDueAsOf,
  paymentJournal,
  penaltiesToCharge,
  penaltyJournal,
  portfolioAtRisk,
  ppmFromDb,
  ppmToPercent,
  reversalJournal,
  unapplyAllocation,
  validatePayment,
  type AllocationLine,
  type InstallmentBalance,
  type PaymentInput,
  type PaymentKind,
  type PaymentMethod,
  type ReceiptDocument,
} from '../../shared/lending';
import { HttpError, type AppDb } from '../kyc/errors';
import { manilaToday } from '../kyc/service';
import { putKycObject } from '../kyc/storage';
import { sniffMime } from '../kyc/imageDecode';
import { UPLOAD_LIMITS } from '../../shared/kyc-core';
import { journalLines, postJournal } from './ledger';
import { alertOverdueGroups } from '../groups/rules';
import type { PaymentView, PayoffQuoteView, ProofView } from '../../shared/client';

export type { PaymentView, PayoffQuoteView, ProofView };
import {
  audit,
  has,
  inTransaction,
  loanDetail,
  newId,
  nextSequence,
  notify,
  nowIso,
  recordTransition,
  statusOf,
  transition,
  assertLoanInScope,
  type LendingClient,
  type LendingStaff,
} from './service';
import { loans as loanTable, paymentRows, proofRows, register, type LoanRow, type PaymentRow, type ProofRow } from './tables';

type ScheduleRow = typeof schema.loanSchedule.$inferSelect;

/** The overdue check runs as this actor in audit rows. */
export const SYSTEM_ACTOR: LendingStaff = {
  kind: 'staff',
  userId: 'system',
  staffId: null,
  name: 'Overdue check',
  role: 'SYSTEM',
  branchId: null,
  viewAll: true,
  permissions: [],
};

// ---------------------------------------------------------------------------
// Installments
// ---------------------------------------------------------------------------

function balanceOf(r: ScheduleRow): InstallmentBalance {
  return {
    number: r.installmentNumber,
    dueDate: r.dueDate,
    principalDue: centsFromDb(r.principalDue),
    interestDue: centsFromDb(r.interestDue),
    penaltyDue: centsFromDb(r.penaltyDue),
    principalPaid: centsFromDb(r.principalPaid),
    interestPaid: centsFromDb(r.interestPaid),
    penaltyPaid: centsFromDb(r.penaltyPaid),
  };
}

async function lockSchedule(tx: AppDb, loanId: string): Promise<ScheduleRow[]> {
  return tx.select().from(schema.loanSchedule).where(eq(schema.loanSchedule.loanId, loanId)).orderBy(asc(schema.loanSchedule.installmentNumber)).for('update');
}

/** Saves changed balances and statuses. `paidAt` stamps installments that become fully paid. */
async function writeInstallments(tx: AppDb, rows: ScheduleRow[], after: InstallmentBalance[], today: string, paidAt: string | null) {
  const byNumber = new Map(after.map((b) => [b.number, b]));
  for (const r of rows) {
    const b = byNumber.get(r.installmentNumber);
    if (!b) continue;
    const status = installmentStatus(b, today);
    const before = balanceOf(r);
    const changed =
      status !== r.status ||
      b.penaltyDue !== before.penaltyDue ||
      b.penaltyPaid !== before.penaltyPaid ||
      b.interestPaid !== before.interestPaid ||
      b.principalPaid !== before.principalPaid;
    if (!changed) continue;
    await tx
      .update(schema.loanSchedule)
      .set({
        penaltyDue: centsToDecimal(b.penaltyDue),
        penaltyPaid: centsToDecimal(b.penaltyPaid),
        interestPaid: centsToDecimal(b.interestPaid),
        principalPaid: centsToDecimal(b.principalPaid),
        amountPaid: centsToDecimal(b.penaltyPaid + b.interestPaid + b.principalPaid),
        status,
        paidAt: status === 'PAID' ? r.paidAt ?? paidAt : null,
      })
      .where(eq(schema.loanSchedule.id, r.id));
  }
}

/** Recomputes the loan's running totals from its installments. */
async function refreshLoanTotals(tx: AppDb, loan: LoanRow, balances: InstallmentBalance[], today: string, extra: Partial<typeof loanTable.$inferInsert> = {}) {
  const paid = balances.reduce((s, b) => s + b.principalPaid + b.interestPaid + b.penaltyPaid, 0);
  const penalties = balances.reduce((s, b) => s + b.penaltyDue, 0);
  const next = balances.filter((b) => outstandingOf(b).total > 0).sort((a, b) => a.number - b.number)[0];
  await tx
    .update(loanTable)
    .set({
      totalPaid: centsToDecimal(paid),
      remainingBalance: centsToDecimal(payoffAmount(balances)),
      nextPaymentDate: next ? next.dueDate : null,
      daysInArrears: daysPastDue(balances, today),
      updatedAt: nowIso(),
      ...extra,
    })
    .where(eq(loanTable.id, loan.id));
  await tx.execute(sql`update loans set total_late_penalties_charged = ${centsToDecimal(penalties)}::numeric where id = ${loan.id}`);
}

async function lockLoanRow(tx: AppDb, loanId: string): Promise<LoanRow> {
  const rows = await tx.select().from(loanTable).where(eq(loanTable.id, loanId)).for('update').limit(1);
  if (!rows[0]) throw new HttpError(404, 'Loan not found.', 'NOT_FOUND');
  return rows[0];
}

// ---------------------------------------------------------------------------
// Penalties
// ---------------------------------------------------------------------------

/**
 * Charges the penalties a running loan should have by `today` and marks its
 * overdue installments. Each (installment, month) is charged once: the loan
 * row is locked, already-charged months are read under that lock, and
 * loan_penalties is unique on (installment, month) as a backstop.
 */
async function chargePenalties(tx: AppDb, loan: LoanRow, rows: ScheduleRow[], today: string): Promise<{ rows: ScheduleRow[]; count: number; amount: number }> {
  const balances = rows.map(balanceOf);
  const rate = ppmFromDb(loan.penaltyRate ?? '0');
  const already = await tx
    .select({ number: schema.loanPenalties.installmentNumber, period: schema.loanPenalties.period })
    .from(schema.loanPenalties)
    .where(eq(schema.loanPenalties.loanId, loan.id));
  const plan = penaltiesToCharge(balances, rate, today, new Set(already.map((p) => `${p.number}:${p.period}`)));
  const at = nowIso();

  if (plan.length) {
    const total = plan.reduce((s, p) => s + p.amount, 0);
    const entryId = await postJournal(tx, {
      lines: penaltyJournal(total),
      entryDate: today,
      description: `Late payment penalties on ${loan.loanNumber} (${plan.map((p) => `#${p.number} month ${p.period}`).join(', ')})`,
      reference: loan.loanNumber,
      sourceModule: 'loan_penalties',
      sourceRef: loan.id,
      branchId: loan.branchId,
      postedBy: SYSTEM_ACTOR.userId,
      postedByName: SYSTEM_ACTOR.name,
      idempotencyKey: `penalty:${loan.id}:${plan.map((p) => `${p.number}.${p.period}`).join(',')}`,
      at,
    });
    const scheduleId = new Map(rows.map((r) => [r.installmentNumber, r.id]));
    for (const p of plan) {
      await tx.insert(schema.loanPenalties).values({
        id: newId('pen'),
        loanId: loan.id,
        scheduleId: scheduleId.get(p.number) as string,
        installmentNumber: p.number,
        period: p.period,
        assessedOn: p.assessedOn,
        baseAmount: centsToDecimal(p.base),
        rate: ppmToPercent(rate),
        amount: centsToDecimal(p.amount),
        journalEntryId: entryId,
        createdAt: at,
      });
    }
    for (const p of plan) {
      const b = balances.find((x) => x.number === p.number)!;
      b.penaltyDue += p.amount;
    }
    await audit(tx, loan, SYSTEM_ACTOR, 'LOAN_PENALTY_CHARGED', `${loan.loanNumber}: ${formatPeso(total)} late penalty at ${ppmToPercent(rate).replace(/\.?0+$/, '')}% a month (${plan.map((p) => `installment ${p.number}, month ${p.period}: ${formatPeso(p.amount)}`).join('; ')}).`, at);
    await notify(tx, loan, 'CLIENT', 'LOAN_PENALTY', 'Late payment penalty', `A late payment penalty of ${formatPeso(total)} was added to ${loan.loanNumber}. Please settle your overdue installment to stop further penalties.`, at);
  }

  await writeInstallments(tx, rows, balances, today, null);
  await refreshLoanTotals(tx, loan, balances, today);
  return { rows: await lockSchedule(tx, loan.id), count: plan.length, amount: plan.reduce((s, p) => s + p.amount, 0) };
}

/**
 * The overdue check: marks overdue installments and charges penalties on every
 * running loan. Safe to run any number of times a day.
 */
export async function runOverdueCheck(db: AppDb, today = manilaToday(), options: { branchId?: string | null } = {}) {
  const candidates = await db
    .selectDistinct({ loanId: schema.loanSchedule.loanId })
    .from(schema.loanSchedule)
    .innerJoin(loanTable, eq(loanTable.id, schema.loanSchedule.loanId))
    .where(
      and(
        lt(schema.loanSchedule.dueDate, today),
        ne(schema.loanSchedule.status, 'PAID'),
        eq(loanTable.status, 'Active'),
        options.branchId ? eq(loanTable.branchId, options.branchId) : undefined,
      ),
    );
  let penalties = 0;
  let amount = 0;
  const loansCharged: string[] = [];
  for (const { loanId } of candidates) {
    const r = await inTransaction(db, async (tx) => {
      const loan = await lockLoanRow(tx, loanId);
      if (statusOf(loan) !== 'Active') return { count: 0, amount: 0, loanNumber: loan.loanNumber };
      const res = await chargePenalties(tx, loan, await lockSchedule(tx, loanId), today);
      return { ...res, loanNumber: loan.loanNumber };
    });
    penalties += r.count;
    amount += r.amount;
    if (r.count) loansCharged.push(r.loanNumber);
  }
  // Joint liability: the groups of members now overdue are told (once per installment).
  const groupAlerts = await alertOverdueGroups(db, today);
  return { date: today, loansChecked: candidates.length, penaltiesCharged: penalties, amountCharged: centsToDecimal(amount), loansCharged, groupAlerts };
}

// ---------------------------------------------------------------------------
// Posting payments
// ---------------------------------------------------------------------------

export interface PostPaymentOptions {
  proofId?: string;
  /** How far back the payment date may be (proofs can arrive late). */
  maxBackdateDays?: number;
  /** The group's solidarity fund pays (a cover): debit 2040 instead of cash; method SOLIDARITY_FUND. */
  fromSolidarityFund?: { groupName: string };
}

function allocationJson(lines: AllocationLine[]) {
  return lines.map((l) => ({ number: l.number, penalty: centsToDecimal(l.penalty), interest: centsToDecimal(l.interest), principal: centsToDecimal(l.principal) }));
}

function allocationFromJson(raw: unknown): AllocationLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l: any) => ({ number: Number(l.number), penalty: centsFromDb(l.penalty), interest: centsFromDb(l.interest), principal: centsFromDb(l.principal) }));
}

/**
 * Inside a transaction: allocates and posts one payment. The caller has checked
 * the key and permissions. Exported for callers that post several payments in
 * one transaction (group collections, solidarity covers).
 */
export async function postPaymentTx(tx: AppDb, actor: LendingStaff, loanId: string, input: PaymentInput, key: string, options: PostPaymentOptions) {
  const today = manilaToday();
  const v = validatePayment(input, today, options.maxBackdateDays ?? 30);
  if (!v.ok || !v.value) throw new HttpError(400, 'Check the highlighted payment fields.', 'INVALID_PAYMENT', { fields: v.errors });
  const p = v.value;
  const fund = options.fromSolidarityFund;
  const storedMethod = fund ? SOLIDARITY_FUND_METHOD : p.method;
  const methodLabel = paymentMethodLabel(storedMethod);
  const at = nowIso();

  const loan = await lockLoanRow(tx, loanId);
  assertLoanInScope(actor, loan);
  const prior = await tx.select().from(paymentRows).where(eq(paymentRows.idempotencyKey, key)).limit(1);
  if (prior[0]) {
    if (prior[0].loanId !== loan.id) throw new HttpError(409, 'This idempotency key belongs to another payment.', 'KEY_REUSED');
    return { replayed: true, paymentId: prior[0].id };
  }
  if (statusOf(loan) !== 'Active') throw new HttpError(409, `Payments can only be posted to an active loan; ${loan.loanNumber} is ${loan.status.toLowerCase()}.`, 'LOAN_NOT_ACTIVE');

  let rows = await lockSchedule(tx, loan.id);
  if (!rows.length) throw new HttpError(409, `${loan.loanNumber} has no stored schedule, so a payment cannot be allocated. It was released before schedules were stored.`, 'NO_SCHEDULE');
  // Bring penalties up to date first, so the payment pays what is really owed.
  rows = (await chargePenalties(tx, loan, rows, today)).rows;

  const alloc = allocatePayment(rows.map(balanceOf), p.amount, p.paymentDate);
  const seq = await nextSequence(tx, 'payment_receipt_seq');
  const receiptNumber = `OR-${today.slice(0, 4)}-${String(seq).padStart(6, '0')}`;
  const entryId = await postJournal(tx, {
    lines: paymentJournal({ method: p.method, penalty: alloc.penalty, interest: alloc.interest, principal: alloc.principal, excess: alloc.excess, source: fund ? { accountCode: GROUP_FUND_ACCOUNT, label: `the solidarity fund of ${fund.groupName}` } : undefined }),
    entryDate: p.paymentDate,
    description: `Payment on ${loan.loanNumber} ${fund ? `for ${loan.borrowerName} from the solidarity fund of ${fund.groupName}` : `from ${loan.borrowerName} (${methodLabel})`}`,
    reference: receiptNumber,
    sourceModule: 'loan_payments',
    sourceRef: loan.id,
    branchId: loan.branchId,
    postedBy: actor.userId,
    postedByName: actor.name,
    idempotencyKey: `loan-payment:${key}`,
    at,
  });

  const paymentId = newId('pay');
  await tx.insert(paymentRows).values({
    id: paymentId,
    receiptNumber,
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    borrowerId: loan.borrowerId,
    borrowerName: loan.borrowerName,
    branchId: loan.branchId,
    amount: centsToDecimal(p.amount),
    paymentDate: p.paymentDate,
    paymentMethod: storedMethod,
    transactionReference: p.referenceNumber ?? '',
    collectedBy: actor.name,
    principalPortion: centsToDecimal(alloc.principal),
    interestPortion: centsToDecimal(alloc.interest),
    penaltyPortion: centsToDecimal(alloc.penalty),
    rebateDiscount: '0.00',
    paymentScheduleType: loan.repaymentFrequency,
    isAdvancePayment: alloc.kind === 'ADVANCE',
    notes: p.notes,
    createdAt: at,
    status: 'POSTED',
    paymentKind: alloc.kind,
    excessAmount: centsToDecimal(alloc.excess),
    allocation: allocationJson(alloc.lines),
    idempotencyKey: key,
    journalEntryId: entryId,
    proofId: options.proofId ?? null,
    postedBy: actor.userId,
    postedAt: at,
  });

  await writeInstallments(tx, rows, alloc.after, today, at);
  await refreshLoanTotals(tx, loan, alloc.after, today, { lastPaymentDate: p.paymentDate });

  await tx
    .update(schema.borrowers)
    .set({ totalRepaid: sql`coalesce(${schema.borrowers.totalRepaid}, 0) + ${centsToDecimal(alloc.applied)}::numeric`, lastActivityDate: p.paymentDate })
    .where(eq(schema.borrowers.id, loan.borrowerId));

  await tx.insert(register).values({
    id: newId('txn'),
    referenceNumber: receiptNumber,
    clientId: loan.borrowerId,
    clientName: loan.borrowerName,
    accountOrLoanId: loan.id,
    accountOrLoanType: 'Loan',
    branchId: loan.branchId,
    transactionType: 'Loan Repayment',
    amount: centsToDecimal(p.amount),
    transactionDate: p.paymentDate,
    paymentMethod: methodLabel,
    processedBy: actor.name,
    processedByRole: actor.role,
    status: 'Completed',
    notes: `${loan.loanNumber}: penalty ${formatPeso(alloc.penalty)}, interest ${formatPeso(alloc.interest)}, principal ${formatPeso(alloc.principal)}${alloc.excess ? `, overpayment ${formatPeso(alloc.excess)}` : ''}.`,
    metadata: { receiptNumber, paymentId, journalEntryId: entryId, kind: alloc.kind, proofId: options.proofId ?? null },
    createdAt: at,
    updatedAt: at,
  });

  await audit(
    tx,
    loan,
    actor,
    'PAYMENT_POSTED',
    `${receiptNumber}: ${formatPeso(p.amount)} on ${loan.loanNumber} (${alloc.kind.toLowerCase()}) by ${methodLabel}${p.referenceNumber ? ` ref ${p.referenceNumber}` : ''}. Penalty ${formatPeso(alloc.penalty)}, interest ${formatPeso(alloc.interest)}, principal ${formatPeso(alloc.principal)}${alloc.excess ? `, overpayment ${formatPeso(alloc.excess)}` : ''}.`,
    at,
  );
  await notify(
    tx,
    loan,
    'CLIENT',
    fund ? 'SOLIDARITY_COVER' : 'PAYMENT_RECEIVED',
    fund ? 'Your group covered your installment' : 'Payment received',
    fund
      ? `The solidarity fund of ${fund.groupName} paid ${formatPeso(p.amount)} on ${loan.loanNumber} (receipt ${receiptNumber}) because it was overdue. You owe this amount back to the fund.`
      : `We received ${formatPeso(p.amount)} for ${loan.loanNumber} (receipt ${receiptNumber}).${alloc.excess ? ` ${formatPeso(alloc.excess)} was more than you owed; the branch will refund it or move it to your savings.` : ''}`,
    at,
  );

  if (alloc.settles) {
    assertLoanTransition('Active', 'Closed', 'SYSTEM');
    const closedAt = new Date(Date.parse(at) + 1).toISOString();
    await tx.update(loanTable).set({ status: 'Closed', coopStep: 'CLOSED', closedAt, nextPaymentDate: null, updatedAt: closedAt }).where(eq(loanTable.id, loan.id));
    await recordTransition(tx, loan, 'Active', 'Closed', 'SYSTEM', `Paid in full by ${receiptNumber}`, closedAt);
    await tx
      .update(schema.borrowers)
      .set({ activeLoansCount: sql`greatest(coalesce(${schema.borrowers.activeLoansCount}, 0) - 1, 0)` })
      .where(eq(schema.borrowers.id, loan.borrowerId));
    await audit(tx, loan, actor, 'LOAN_CLOSED', `${loan.loanNumber} paid in full and closed (${receiptNumber}).`, closedAt);
    await notify(tx, loan, 'CLIENT', 'LOAN_CLOSED', 'Loan fully paid', `${loan.loanNumber} is fully paid and now closed. Thank you!`, closedAt);
  }
  return { replayed: false, paymentId };
}

function requireKey(key: unknown): string {
  const k = typeof key === 'string' ? key.trim().slice(0, 100) : '';
  if (k.length < 8) throw new HttpError(400, 'An Idempotency-Key header (8+ characters) is required to post a payment.', 'IDEMPOTENCY_KEY_REQUIRED');
  return k;
}

/** Records a payment received at the branch. */
export async function postPayment(db: AppDb, actor: LendingStaff, loanId: string, input: PaymentInput, idempotencyKey: unknown) {
  if (!has(actor, 'process_loan_repayments')) throw new HttpError(403, 'Your role cannot record loan payments.', 'FORBIDDEN');
  const key = requireKey(idempotencyKey);
  const r = await inTransaction(db, (tx) => postPaymentTx(tx, actor, loanId, input, key, {}));
  return paymentResult(db, actor, r.paymentId, r.replayed);
}

async function paymentResult(db: AppDb, actor: LendingStaff | LendingClient, paymentId: string, replayed: boolean) {
  const payment = await loadPayment(db, paymentId);
  const loan = await loanDetail(db, actor, payment.loanId);
  return { replayed, payment: paymentView(payment), receipt: await paymentReceipt(db, payment), loan };
}

// ---------------------------------------------------------------------------
// Reversal
// ---------------------------------------------------------------------------

/**
 * Reverses a posted payment: the installments get back exactly what it paid,
 * a mirror journal entry is posted, the payment row is kept and marked
 * REVERSED, and a loan it closed is reopened. Only the latest posted payment
 * on a loan can be reversed (undo in order), and not by the person who posted it.
 */
export async function reversePayment(db: AppDb, actor: LendingStaff, paymentId: string, reasonInput: unknown) {
  if (!has(actor, 'approve_sensitive_operations')) throw new HttpError(403, 'Only a manager or administrator can reverse a payment.', 'FORBIDDEN');
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
  if (reason.length < 5) throw new HttpError(400, 'Give the reason for the reversal (at least 5 characters).', 'REASON_REQUIRED');
  const today = manilaToday();

  await inTransaction(db, async (tx) => {
    const found = await tx.select().from(paymentRows).where(eq(paymentRows.id, paymentId)).limit(1);
    if (!found[0]) throw new HttpError(404, 'Payment not found.', 'NOT_FOUND');
    const loan = await lockLoanRow(tx, found[0].loanId);
    assertLoanInScope(actor, loan);
    const [payment] = await tx.select().from(paymentRows).where(eq(paymentRows.id, paymentId)).for('update').limit(1);
    if (payment.status !== 'POSTED') throw new HttpError(409, `${payment.receiptNumber} is already reversed.`, 'ALREADY_REVERSED');
    if (!payment.allocation || !payment.journalEntryId) throw new HttpError(409, `${payment.receiptNumber} was recorded before allocations were stored and cannot be reversed here.`, 'LEGACY_PAYMENT');
    if (payment.paymentMethod === SOLIDARITY_FUND_METHOD) {
      throw new HttpError(409, `${payment.receiptNumber} was paid by the group's solidarity fund; it is part of a cover and cannot be reversed on its own.`, 'COVER_PAYMENT');
    }
    if (payment.postedBy === actor.userId) throw new HttpError(403, 'You posted this payment, so another authorised officer must reverse it.', 'SAME_REVERSER');
    const latest = await tx
      .select({ id: paymentRows.id })
      .from(paymentRows)
      .where(and(eq(paymentRows.loanId, loan.id), eq(paymentRows.status, 'POSTED')))
      .orderBy(desc(paymentRows.postedAt))
      .limit(1);
    if (latest[0]?.id !== payment.id) throw new HttpError(409, 'Reverse the later payments on this loan first; payments are undone newest first.', 'NOT_LATEST');

    const at = nowIso();
    const rows = await lockSchedule(tx, loan.id);
    const after = unapplyAllocation(rows.map(balanceOf), allocationFromJson(payment.allocation));
    const seq = await nextSequence(tx, 'payment_reversal_seq');
    const reference = `RV-${today.slice(0, 4)}-${String(seq).padStart(6, '0')}`;
    const entryId = await postJournal(tx, {
      lines: reversalJournal(await journalLines(tx, payment.journalEntryId)),
      entryDate: today,
      description: `Reversal of ${payment.receiptNumber} on ${loan.loanNumber}: ${reason}`,
      reference,
      sourceModule: 'loan_payments',
      sourceRef: loan.id,
      branchId: loan.branchId,
      postedBy: actor.userId,
      postedByName: actor.name,
      idempotencyKey: `loan-payment-reversal:${payment.id}`,
      at,
    });
    await tx
      .update(paymentRows)
      .set({ status: 'REVERSED', reversalReference: reference, reversalJournalEntryId: entryId, reversedAt: at, reversedBy: actor.userId, reversedByName: actor.name, reversalReason: reason })
      .where(eq(paymentRows.id, payment.id));

    const previous = await tx
      .select({ paymentDate: paymentRows.paymentDate })
      .from(paymentRows)
      .where(and(eq(paymentRows.loanId, loan.id), eq(paymentRows.status, 'POSTED')))
      .orderBy(desc(paymentRows.postedAt))
      .limit(1);
    await writeInstallments(tx, rows, after, today, null);
    await refreshLoanTotals(tx, loan, after, today, { lastPaymentDate: previous[0]?.paymentDate ?? null });

    const applied = centsFromDb(payment.amount) - centsFromDb(payment.excessAmount);
    await tx
      .update(schema.borrowers)
      .set({ totalRepaid: sql`greatest(coalesce(${schema.borrowers.totalRepaid}, 0) - ${centsToDecimal(applied)}::numeric, 0)` })
      .where(eq(schema.borrowers.id, loan.borrowerId));

    if (statusOf(loan) === 'Closed') {
      transition('Closed', 'Active', actor);
      await tx.update(loanTable).set({ status: 'Active', coopStep: 'ACTIVE', closedAt: null }).where(eq(loanTable.id, loan.id));
      await recordTransition(tx, loan, 'Closed', 'Active', actor, `Payment ${payment.receiptNumber} reversed: ${reason}`, at);
      await tx
        .update(schema.borrowers)
        .set({ activeLoansCount: sql`coalesce(${schema.borrowers.activeLoansCount}, 0) + 1` })
        .where(eq(schema.borrowers.id, loan.borrowerId));
    }

    await tx.insert(register).values({
      id: newId('txn'),
      referenceNumber: reference,
      clientId: loan.borrowerId,
      clientName: loan.borrowerName,
      accountOrLoanId: loan.id,
      accountOrLoanType: 'Loan',
      branchId: loan.branchId,
      transactionType: 'Reversal',
      amount: payment.amount,
      transactionDate: today,
      paymentMethod: paymentMethodLabel(payment.paymentMethod),
      processedBy: actor.name,
      processedByRole: actor.role,
      status: 'Completed',
      notes: `Reversal of ${payment.receiptNumber}: ${reason}`,
      metadata: { reversalOf: payment.receiptNumber, paymentId: payment.id, journalEntryId: entryId },
      createdAt: at,
      updatedAt: at,
    });
    await audit(tx, loan, actor, 'PAYMENT_REVERSED', `${payment.receiptNumber} (${formatPeso(centsFromDb(payment.amount))}) on ${loan.loanNumber} reversed as ${reference}. Reason: ${reason}`, at);
    await notify(tx, loan, 'CLIENT', 'PAYMENT_REVERSED', 'Payment reversed', `Payment ${payment.receiptNumber} of ${formatPeso(centsFromDb(payment.amount))} on ${loan.loanNumber} was reversed. Reason: ${reason}`, at);
    await notify(tx, loan, 'STAFF', 'PAYMENT_REVERSED', 'Payment reversed', `${actor.name} reversed ${payment.receiptNumber} on ${loan.loanNumber}: ${reason}`, at);
  });
  return paymentResult(db, actor, paymentId, false);
}

// ---------------------------------------------------------------------------
// Payment proofs
// ---------------------------------------------------------------------------

export interface ProofInput extends PaymentInput {
  loanId: unknown;
  fileBase64: unknown;
  fileName?: unknown;
}

/** A member's claim that they paid by bank or e-wallet. Nothing is posted until staff verify it. */
export async function submitProof(db: AppDb, actor: LendingClient, input: ProofInput) {
  const today = manilaToday();
  const v = validatePayment(input, today, 30);
  const errors: Record<string, string> = { ...(v.errors as Record<string, string>) };
  if (v.value && v.value.method === 'CASH') errors.method = 'Cash is paid at the branch counter; upload proof only for bank or e-wallet payments.';
  const raw = typeof input.fileBase64 === 'string' ? input.fileBase64 : '';
  const comma = raw.indexOf(',');
  const payload = raw.startsWith('data:') && comma >= 0 ? raw.slice(comma + 1) : raw;
  const buffer = payload && /^[A-Za-z0-9+/=\s]+$/.test(payload) ? Buffer.from(payload, 'base64') : Buffer.alloc(0);
  const mime = buffer.length ? sniffMime(buffer) : null;
  if (!buffer.length) errors.fileBase64 = 'Attach the receipt or screenshot of the transfer.';
  else if (buffer.length > UPLOAD_LIMITS.maxBytes) errors.fileBase64 = 'The file must be 10 MB or smaller.';
  else if (!mime || !UPLOAD_LIMITS.mimeTypes.includes(mime)) errors.fileBase64 = 'Attach a JPEG, PNG, WebP or PDF file.';
  if (Object.keys(errors).length || !v.value || !mime) throw new HttpError(400, 'Check the highlighted fields.', 'INVALID_PROOF', { fields: errors });
  const p = v.value;

  const loanRows = await db.select().from(loanTable).where(eq(loanTable.id, String(input.loanId ?? ''))).limit(1);
  const loan = loanRows[0];
  if (!loan || loan.borrowerId !== actor.borrowerId) throw new HttpError(404, 'Loan not found.', 'NOT_FOUND');
  if (statusOf(loan) !== 'Active') throw new HttpError(409, `${loan.loanNumber} is not an active loan.`, 'LOAN_NOT_ACTIVE');
  const dup = await db
    .select({ id: proofRows.id })
    .from(proofRows)
    .where(and(eq(proofRows.paymentMethod, p.method), sql`upper(${proofRows.referenceNumber}) = upper(${p.referenceNumber})`, ne(proofRows.status, 'REJECTED')))
    .limit(1);
  if (dup[0]) throw new HttpError(409, 'A proof with this reference number was already submitted.', 'DUPLICATE_REFERENCE', { fields: { referenceNumber: 'Already submitted.' } });

  const ref = await putKycObject({ borrowerId: actor.borrowerId, kind: 'payment-proof', buffer, mime });
  const fileName = typeof input.fileName === 'string' && input.fileName.trim() ? input.fileName.trim().slice(0, 120) : `proof.${mime.split('/')[1]}`;
  const id = newId('proof');
  const at = nowIso();
  await inTransaction(db, async (tx) => {
    await tx.insert(schema.documents).values({
      id: `doc-${id}`,
      docNumber: `PROOF-${loan.loanNumber}-${id.slice(-6)}`,
      branchId: loan.branchId,
      clientId: loan.borrowerId,
      clientName: loan.borrowerName,
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      docName: `Payment proof ${formatPeso(p.amount)} (${PAYMENT_METHOD_LABELS[p.method]})`,
      docType: 'Payment Proof',
      fileUrl: null,
      storagePath: ref.path,
      fileName,
      uploadedBy: actor.name,
      status: 'Pending Verification',
      notes: `Reference ${p.referenceNumber}, paid ${p.paymentDate}`,
      createdAt: at,
    });
    await tx.insert(proofRows).values({
      id,
      borrowerId: loan.borrowerId,
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      amount: centsToDecimal(p.amount),
      currency: 'PHP',
      paymentMethod: p.method,
      paymentDate: p.paymentDate,
      referenceNumber: p.referenceNumber,
      notes: p.notes,
      documentId: `doc-${id}`,
      storagePath: `${ref.backend}:${ref.path}`,
      fileName,
      branchId: loan.branchId,
      submittedBy: actor.name,
      submittedAt: at,
      status: 'PENDING_REVIEW',
      createdAt: at,
      updatedAt: at,
    });
    await audit(tx, loan, actor, 'PAYMENT_PROOF_SUBMITTED', `${loan.borrowerName} submitted proof of ${formatPeso(p.amount)} by ${PAYMENT_METHOD_LABELS[p.method]} (ref ${p.referenceNumber}) for ${loan.loanNumber}.`, at);
    await notify(tx, loan, 'STAFF', 'PAYMENT_PROOF', 'Payment proof to verify', `${loan.borrowerName} sent proof of ${formatPeso(p.amount)} (${PAYMENT_METHOD_LABELS[p.method]}, ref ${p.referenceNumber}) for ${loan.loanNumber}.`, at);
  });
  const [row] = await db.select().from(proofRows).where(eq(proofRows.id, id)).limit(1);
  return proofView(row);
}

async function lockProof(tx: AppDb, actor: LendingStaff, proofId: string): Promise<ProofRow> {
  const rows = await tx.select().from(proofRows).where(eq(proofRows.id, proofId)).for('update').limit(1);
  const proof = rows[0];
  if (!proof || (!actor.viewAll && proof.branchId !== actor.branchId)) throw new HttpError(404, 'Payment proof not found in your branch.', 'NOT_FOUND');
  if (proof.status === 'VERIFIED' || proof.status === 'REJECTED') throw new HttpError(409, `This proof was already ${proof.status.toLowerCase()}.`, 'ALREADY_DECIDED');
  if (proof.status === 'UNDER_REVIEW' && proof.reviewedBy && proof.reviewedBy !== actor.userId) {
    throw new HttpError(409, `${proof.reviewedByName || 'Another teller'} is reviewing this proof.`, 'CLAIMED');
  }
  return proof;
}

export async function claimProof(db: AppDb, actor: LendingStaff, proofId: string) {
  if (!has(actor, 'process_loan_repayments')) throw new HttpError(403, 'Your role cannot verify payments.', 'FORBIDDEN');
  await inTransaction(db, async (tx) => {
    await lockProof(tx, actor, proofId);
    await tx.update(proofRows).set({ status: 'UNDER_REVIEW', reviewedBy: actor.userId, reviewedByName: actor.name, updatedAt: nowIso() }).where(eq(proofRows.id, proofId));
  });
  const [row] = await db.select().from(proofRows).where(eq(proofRows.id, proofId)).limit(1);
  return proofView(row);
}

/**
 * Verifies a proof and posts the payment in the same transaction. The amount
 * may be corrected downward to what actually arrived, never upward.
 */
export async function verifyProof(db: AppDb, actor: LendingStaff, proofId: string, input: { amount?: unknown } = {}) {
  if (!has(actor, 'process_loan_repayments')) throw new HttpError(403, 'Your role cannot verify payments.', 'FORBIDDEN');
  const r = await inTransaction(db, async (tx) => {
    const proof = await lockProof(tx, actor, proofId);
    const claimed = centsFromDb(proof.amount);
    const amount = input.amount === undefined || input.amount === '' ? centsToDecimal(claimed) : input.amount;
    const v = validatePayment({ amount, method: 'CASH', paymentDate: manilaToday() }, manilaToday());
    if (v.errors.amount) throw new HttpError(400, v.errors.amount, 'INVALID_PAYMENT', { fields: { amount: v.errors.amount } });
    if (v.value && v.value.amount > claimed) throw new HttpError(400, `The verified amount cannot exceed what the member submitted (${formatPeso(claimed)}).`, 'ABOVE_CLAIM');
    const posted = await postPaymentTx(
      tx,
      actor,
      proof.loanId,
      { amount, method: proof.paymentMethod, referenceNumber: proof.referenceNumber ?? '', paymentDate: proof.paymentDate, notes: `Verified payment proof ${proof.id}` },
      `proof:${proof.id}`,
      { proofId: proof.id, maxBackdateDays: 60 },
    );
    const at = nowIso();
    await tx
      .update(proofRows)
      .set({ status: 'VERIFIED', amount: centsToDecimal(v.value!.amount), reviewedBy: actor.userId, reviewedByName: actor.name, reviewedAt: at, paymentId: posted.paymentId, updatedAt: at })
      .where(eq(proofRows.id, proof.id));
    if (proof.documentId) await tx.update(schema.documents).set({ status: 'Verified' }).where(eq(schema.documents.id, proof.documentId));
    const loan = await lockLoanRow(tx, proof.loanId);
    await audit(tx, loan, actor, 'PAYMENT_PROOF_VERIFIED', `Proof ${proof.id} verified and posted (${formatPeso(v.value!.amount)}${v.value!.amount !== claimed ? `, claimed ${formatPeso(claimed)}` : ''}).`, at);
    return posted;
  });
  return paymentResult(db, actor, r.paymentId, r.replayed);
}

export async function rejectProof(db: AppDb, actor: LendingStaff, proofId: string, reasonInput: unknown) {
  if (!has(actor, 'process_loan_repayments')) throw new HttpError(403, 'Your role cannot verify payments.', 'FORBIDDEN');
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
  if (reason.length < 5) throw new HttpError(400, 'Give the member a reason (at least 5 characters).', 'REASON_REQUIRED');
  await inTransaction(db, async (tx) => {
    const proof = await lockProof(tx, actor, proofId);
    const at = nowIso();
    await tx.update(proofRows).set({ status: 'REJECTED', rejectionReason: reason, reviewedBy: actor.userId, reviewedByName: actor.name, reviewedAt: at, updatedAt: at }).where(eq(proofRows.id, proof.id));
    if (proof.documentId) await tx.update(schema.documents).set({ status: 'Rejected', notes: reason }).where(eq(schema.documents.id, proof.documentId));
    const loan = await lockLoanRow(tx, proof.loanId);
    await audit(tx, loan, actor, 'PAYMENT_PROOF_REJECTED', `Proof ${proof.id} (${formatPeso(centsFromDb(proof.amount))}) rejected: ${reason}`, at);
    await notify(tx, loan, 'CLIENT', 'PAYMENT_PROOF_REJECTED', 'Payment proof not accepted', `Your proof of ${formatPeso(centsFromDb(proof.amount))} for ${loan.loanNumber} was not accepted: ${reason}`, at);
  });
  const [row] = await db.select().from(proofRows).where(eq(proofRows.id, proofId)).limit(1);
  return proofView(row);
}

export function proofView(p: ProofRow): ProofView {
  return {
    id: p.id,
    loanId: p.loanId,
    loanNumber: p.loanNumber,
    borrowerId: p.borrowerId,
    borrowerName: p.submittedBy,
    amount: centsToDecimal(centsFromDb(p.amount)),
    method: p.paymentMethod,
    referenceNumber: p.referenceNumber,
    paymentDate: p.paymentDate,
    notes: p.notes,
    fileName: p.fileName,
    status: p.status,
    submittedAt: p.submittedAt,
    reviewedByName: p.reviewedByName,
    reviewedAt: p.reviewedAt,
    rejectionReason: p.rejectionReason,
    paymentId: p.paymentId,
    storageRef: p.storagePath,
  };
}

export async function proofQueue(db: AppDb, actor: LendingStaff, status?: string) {
  const rows = await db
    .select()
    .from(proofRows)
    .where(and(actor.viewAll ? undefined : eq(proofRows.branchId, actor.branchId ?? '__none__'), status && status !== 'ALL' ? eq(proofRows.status, status) : undefined))
    .orderBy(desc(proofRows.submittedAt));
  return rows.map(proofView);
}

export async function clientProofs(db: AppDb, borrowerId: string) {
  const rows = await db.select().from(proofRows).where(eq(proofRows.borrowerId, borrowerId)).orderBy(desc(proofRows.submittedAt));
  return rows.map(proofView);
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

async function loadPayment(db: AppDb, id: string): Promise<PaymentRow> {
  const rows = await db.select().from(paymentRows).where(eq(paymentRows.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, 'Payment not found.', 'NOT_FOUND');
  return rows[0];
}

export function paymentView(p: PaymentRow): PaymentView {
  return {
    id: p.id,
    receiptNumber: p.receiptNumber,
    loanId: p.loanId,
    loanNumber: p.loanNumber,
    borrowerName: p.borrowerName,
    amount: centsToDecimal(centsFromDb(p.amount)),
    paymentDate: p.paymentDate,
    method: p.paymentMethod,
    reference: p.transactionReference || null,
    kind: (p.paymentKind as PaymentKind | null) ?? null,
    penalty: centsToDecimal(centsFromDb(p.penaltyPortion)),
    interest: centsToDecimal(centsFromDb(p.interestPortion)),
    principal: centsToDecimal(centsFromDb(p.principalPortion)),
    excess: centsToDecimal(centsFromDb(p.excessAmount)),
    status: p.status === 'REVERSED' ? 'REVERSED' : 'POSTED',
    collectedBy: p.collectedBy,
    postedBy: p.postedBy,
    proofId: p.proofId,
    reversal: p.status === 'REVERSED' ? { reference: p.reversalReference, at: p.reversedAt, by: p.reversedByName, reason: p.reversalReason } : null,
  };
}

export async function loanPayments(db: AppDb, loanId: string): Promise<PaymentView[]> {
  const rows = await db.select().from(paymentRows).where(eq(paymentRows.loanId, loanId)).orderBy(desc(paymentRows.createdAt));
  return rows.map(paymentView);
}

export async function paymentReceipt(db: AppDb, p: PaymentRow): Promise<ReceiptDocument> {
  const loan = (await db.select().from(loanTable).where(eq(loanTable.id, p.loanId)).limit(1))[0];
  const branch = (await db.select({ name: schema.branches.name, address: schema.branches.address }).from(schema.branches).where(eq(schema.branches.id, p.branchId)).limit(1))[0];
  const member = (await db.select({ number: schema.borrowers.borrowerNumber }).from(schema.borrowers).where(eq(schema.borrowers.id, p.borrowerId)).limit(1))[0];
  const lines: ReceiptDocument['lines'] = [];
  const add = (label: string, v: string, detail?: string) => {
    if (centsFromDb(v) > 0) lines.push({ label, amount: centsToDecimal(centsFromDb(v)), detail: detail ?? null });
  };
  add('Penalty', p.penaltyPortion);
  add('Interest', p.interestPortion);
  add('Principal', p.principalPortion);
  add('Overpayment', p.excessAmount, 'Held for you: refund or transfer to savings');
  const remaining = loan ? centsFromDb(loan.remainingBalance) : 0;
  return {
    kind: 'PAYMENT',
    title: p.status === 'REVERSED' ? 'Official receipt (reversed)' : 'Official receipt',
    receiptNumber: p.receiptNumber,
    issuedAt: p.postedAt ?? p.createdAt ?? p.paymentDate,
    branchName: branch?.name ?? null,
    branchAddress: branch?.address ?? null,
    partyLabel: 'Received from',
    partyName: p.borrowerName,
    partyNumber: member?.number ?? null,
    accountLabel: 'Loan number',
    accountNumber: p.loanNumber,
    accountDetail: loan ? `${loan.productName} · ${FREQUENCY_LABELS[loan.repaymentFrequency as keyof typeof FREQUENCY_LABELS] ?? loan.repaymentFrequency} payments` : null,
    lines,
    totalLabel: 'Total received',
    totalAmount: centsToDecimal(centsFromDb(p.amount)),
    method: paymentMethodLabel(p.paymentMethod),
    reference: p.transactionReference || null,
    destination: null,
    processedBy: p.collectedBy,
    notes: p.status === 'REVERSED' ? `Reversed ${p.reversalReference ?? ''}: ${p.reversalReason ?? ''}` : p.notes,
    footer: loan
      ? normaliseLoanStatus(loan.status) === 'Closed'
        ? 'This loan is fully paid.'
        : `Balance after this payment: ${formatPeso(remaining)}${loan.nextPaymentDate ? ` · next due ${loan.nextPaymentDate}` : ''}.`
      : null,
  };
}

export async function receiptFor(db: AppDb, actor: LendingStaff | LendingClient, paymentId: string) {
  const p = await loadPayment(db, paymentId);
  const loan = (await db.select().from(loanTable).where(eq(loanTable.id, p.loanId)).limit(1))[0];
  if (!loan) throw new HttpError(404, 'Payment not found.', 'NOT_FOUND');
  assertLoanInScope(actor, loan);
  return paymentReceipt(db, p);
}

/** What is due now and what would close the loan, with each installment's outstanding parts. */
export async function payoffQuote(db: AppDb, actor: LendingStaff | LendingClient, loanId: string, date = manilaToday()): Promise<PayoffQuoteView> {
  const loan = (await db.select().from(loanTable).where(eq(loanTable.id, loanId)).limit(1))[0];
  if (!loan) throw new HttpError(404, 'Loan not found.', 'NOT_FOUND');
  assertLoanInScope(actor, loan);
  const rows = await db.select().from(schema.loanSchedule).where(eq(schema.loanSchedule.loanId, loanId)).orderBy(asc(schema.loanSchedule.installmentNumber));
  const balances = rows.map(balanceOf);
  return {
    loanId,
    loanNumber: loan.loanNumber,
    status: statusOf(loan),
    asOf: date,
    due: centsToDecimal(amountDueAsOf(balances, date)),
    payoff: centsToDecimal(payoffAmount(balances)),
    daysPastDue: daysPastDue(balances, date),
    penaltyRate: ppmToPercent(ppmFromDb(loan.penaltyRate ?? '0')),
    installments: balances.map((b) => ({
      number: b.number,
      dueDate: b.dueDate,
      principalDue: centsToDecimal(b.principalDue),
      interestDue: centsToDecimal(b.interestDue),
      penaltyDue: centsToDecimal(b.penaltyDue),
      principalPaid: centsToDecimal(b.principalPaid),
      interestPaid: centsToDecimal(b.interestPaid),
      penaltyPaid: centsToDecimal(b.penaltyPaid),
      status: installmentStatus(b, date),
    })),
  };
}

/** Overdue loans and portfolio at risk for a branch (or all branches). */
export async function collectionsOverview(db: AppDb, actor: LendingStaff, today = manilaToday()) {
  const running = await db
    .select()
    .from(loanTable)
    .where(and(eq(loanTable.status, 'Active'), actor.viewAll ? undefined : eq(loanTable.branchId, actor.branchId ?? '__none__')));
  const ids = running.map((l) => l.id);
  const rows = ids.length ? await db.select().from(schema.loanSchedule).where(inArray(schema.loanSchedule.loanId, ids)) : [];
  const byLoan = new Map<string, InstallmentBalance[]>();
  for (const r of rows) {
    const list = byLoan.get(r.loanId) ?? [];
    list.push(balanceOf(r));
    byLoan.set(r.loanId, list);
  }
  const loans = running
    .filter((l) => byLoan.has(l.id))
    .map((l) => {
      const b = byLoan.get(l.id)!;
      const overdue = b.filter((i) => i.dueDate < today);
      return {
        loanId: l.id,
        loanNumber: l.loanNumber,
        borrowerId: l.borrowerId,
        borrowerName: l.borrowerName,
        borrowerPhone: l.borrowerPhone,
        productName: l.productName,
        loanOfficerName: l.loanOfficerName,
        daysPastDue: daysPastDue(b, today),
        overdueAmount: overdue.reduce((s, i) => s + outstandingOf(i).total, 0),
        penaltiesOutstanding: b.reduce((s, i) => s + outstandingOf(i).penalty, 0),
        outstandingPrincipal: b.reduce((s, i) => s + outstandingOf(i).principal, 0),
        payoff: payoffAmount(b),
        nextDueDate: b.filter((i) => outstandingOf(i).total > 0).map((i) => i.dueDate).sort()[0] ?? null,
      };
    });
  const par = portfolioAtRisk(loans);
  return {
    asOf: today,
    portfolio: centsToDecimal(par.portfolio),
    activeLoans: loans.length,
    par: par.buckets.map((b) => ({ days: b.days, atRisk: centsToDecimal(b.atRisk), ratioBps: b.ratioBps })),
    overdue: loans
      .filter((l) => l.daysPastDue > 0)
      .sort((a, b) => b.daysPastDue - a.daysPastDue)
      .map((l) => ({
        ...l,
        overdueAmount: centsToDecimal(l.overdueAmount),
        penaltiesOutstanding: centsToDecimal(l.penaltiesOutstanding),
        outstandingPrincipal: centsToDecimal(l.outstandingPrincipal),
        payoff: centsToDecimal(l.payoff),
      })),
  };
}
