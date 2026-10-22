/**
 * Repayment rules shared by the payment screens and the server.
 *
 * ALLOCATION ORDER: installments are settled oldest first. Within each
 * installment the money goes to penalty, then interest, then principal, before
 * moving to the next installment. Whatever is left after every installment is
 * settled is an overpayment, held for the member (refund or transfer).
 *
 * PAYMENT KINDS, comparing the amount with what is due on the payment date
 * (everything with a due date on or before it, penalties included) and with
 * the payoff (everything still owed):
 *   PARTIAL      less than is due
 *   FULL         exactly what is due (or exactly the payoff when nothing extra is due)
 *   ADVANCE      more than is due, up to the payoff; pays future installments
 *   OVERPAYMENT  more than the payoff
 *
 * PENALTIES: the product's monthly penalty rate is charged on an installment's
 * unpaid principal and interest. The first charge falls on the day after the
 * due date and one more each month after that, while it stays unpaid. Each
 * (installment, month) is charged once; re-running the overdue check never
 * charges it again.
 */

import { dueDate as scheduleDate, isIsoDate } from './calculator';
import { DISBURSEMENT_METHODS, DISBURSEMENT_METHOD_LABELS, DISBURSEMENT_SOURCE_ACCOUNT, LEDGER_ACCOUNTS, type DisbursementMethod, type JournalLine } from './disbursement';
import { applyRate, divRoundHalfUp, parsePesos, sumCents, type Cents, type Ppm } from './money';

export interface InstallmentBalance {
  number: number;
  dueDate: string;
  principalDue: Cents;
  interestDue: Cents;
  penaltyDue: Cents;
  principalPaid: Cents;
  interestPaid: Cents;
  penaltyPaid: Cents;
}

export const INSTALLMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export function outstandingOf(i: InstallmentBalance) {
  const penalty = i.penaltyDue - i.penaltyPaid;
  const interest = i.interestDue - i.interestPaid;
  const principal = i.principalDue - i.principalPaid;
  return { penalty, interest, principal, total: penalty + interest + principal };
}

/** Paid when nothing is owed; overdue when past its due date and not paid; partial when some was paid. */
export function installmentStatus(i: InstallmentBalance, today: string): InstallmentStatus {
  if (outstandingOf(i).total === 0) return 'PAID';
  if (i.dueDate < today) return 'OVERDUE';
  return i.principalPaid + i.interestPaid + i.penaltyPaid > 0 ? 'PARTIAL' : 'PENDING';
}

/** Everything due on or before `date`, penalties included. */
export function amountDueAsOf(installments: readonly InstallmentBalance[], date: string): Cents {
  return sumCents(installments.filter((i) => i.dueDate <= date).map((i) => outstandingOf(i).total));
}

/** Everything still owed on the loan. */
export function payoffAmount(installments: readonly InstallmentBalance[]): Cents {
  return sumCents(installments.map((i) => outstandingOf(i).total));
}

export const PAYMENT_KINDS = ['PARTIAL', 'FULL', 'ADVANCE', 'OVERPAYMENT'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export function paymentKind(amount: Cents, due: Cents, payoff: Cents): PaymentKind {
  if (amount > payoff) return 'OVERPAYMENT';
  if (amount === due || (due === 0 && amount === payoff)) return 'FULL';
  return amount < due ? 'PARTIAL' : 'ADVANCE';
}

export interface AllocationLine {
  number: number;
  penalty: Cents;
  interest: Cents;
  principal: Cents;
}

export interface Allocation {
  kind: PaymentKind;
  amount: Cents;
  due: Cents;
  payoff: Cents;
  applied: Cents;
  excess: Cents;
  penalty: Cents;
  interest: Cents;
  principal: Cents;
  lines: AllocationLine[];
  after: InstallmentBalance[];
  /** True when the payment settles everything owed. */
  settles: boolean;
}

export function allocatePayment(installments: readonly InstallmentBalance[], amount: Cents, paymentDate: string): Allocation {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RangeError('The payment must be more than zero.');
  const sorted = [...installments].sort((a, b) => a.number - b.number);
  const due = amountDueAsOf(sorted, paymentDate);
  const payoff = payoffAmount(sorted);
  let left = amount;
  const lines: AllocationLine[] = [];
  const after = sorted.map((i) => {
    const o = outstandingOf(i);
    if (left === 0 || o.total === 0) return { ...i };
    const penalty = Math.min(left, o.penalty);
    left -= penalty;
    const interest = Math.min(left, o.interest);
    left -= interest;
    const principal = Math.min(left, o.principal);
    left -= principal;
    if (penalty + interest + principal > 0) lines.push({ number: i.number, penalty, interest, principal });
    return { ...i, penaltyPaid: i.penaltyPaid + penalty, interestPaid: i.interestPaid + interest, principalPaid: i.principalPaid + principal };
  });
  const applied = amount - left;
  return {
    kind: paymentKind(amount, due, payoff),
    amount,
    due,
    payoff,
    applied,
    excess: left,
    penalty: sumCents(lines.map((l) => l.penalty)),
    interest: sumCents(lines.map((l) => l.interest)),
    principal: sumCents(lines.map((l) => l.principal)),
    lines,
    after,
    settles: payoffAmount(after) === 0,
  };
}

/** Undoes an allocation (for a reversal). Refuses if it would take an installment below zero. */
export function unapplyAllocation(installments: readonly InstallmentBalance[], lines: readonly AllocationLine[]): InstallmentBalance[] {
  const byNumber = new Map(lines.map((l) => [l.number, l]));
  return installments.map((i) => {
    const l = byNumber.get(i.number);
    if (!l) return { ...i };
    const next = { ...i, penaltyPaid: i.penaltyPaid - l.penalty, interestPaid: i.interestPaid - l.interest, principalPaid: i.principalPaid - l.principal };
    if (next.penaltyPaid < 0 || next.interestPaid < 0 || next.principalPaid < 0) throw new RangeError(`Installment ${i.number} cannot be reversed below zero.`);
    return next;
  });
}

// ---------------------------------------------------------------------------
// Penalties and arrears
// ---------------------------------------------------------------------------

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The dates on which penalty months 1, 2, ... fall for an installment, up to `today`. */
export function penaltyDates(installmentDueDate: string, today: string): string[] {
  const dates: string[] = [];
  for (let k = 0; k < 600; k++) {
    const d = nextDay(k === 0 ? installmentDueDate : scheduleDate(installmentDueDate, 'MONTHLY', k));
    if (d > today) break;
    dates.push(d);
  }
  return dates;
}

export interface PenaltyCharge {
  number: number;
  period: number;
  assessedOn: string;
  base: Cents;
  amount: Cents;
}

/**
 * The penalty charges an installment should have by `today` that are not yet
 * in `charged` (keys "installment:period"). The base is the unpaid principal
 * and interest now; nothing is charged on penalties.
 */
export function penaltiesToCharge(
  installments: readonly InstallmentBalance[],
  monthlyRate: Ppm,
  today: string,
  charged: ReadonlySet<string>,
): PenaltyCharge[] {
  if (monthlyRate <= 0) return [];
  const out: PenaltyCharge[] = [];
  for (const i of installments) {
    const o = outstandingOf(i);
    const base = o.principal + o.interest;
    if (base <= 0 || i.dueDate >= today) continue;
    penaltyDates(i.dueDate, today).forEach((assessedOn, idx) => {
      const period = idx + 1;
      if (charged.has(`${i.number}:${period}`)) return;
      const amount = applyRate(base, monthlyRate);
      if (amount > 0) out.push({ number: i.number, period, assessedOn, base, amount });
    });
  }
  return out;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Days since the oldest unpaid installment fell due (0 when nothing is overdue). */
export function daysPastDue(installments: readonly InstallmentBalance[], today: string): number {
  const oldest = installments
    .filter((i) => outstandingOf(i).total > 0 && i.dueDate < today)
    .map((i) => i.dueDate)
    .sort()[0];
  return oldest ? daysBetween(oldest, today) : 0;
}

export interface ParBucket {
  days: number;
  /** Outstanding principal of loans more than `days` past due. */
  atRisk: Cents;
  /** atRisk / portfolio in basis points (1/100 of a percent), rounded half-up. */
  ratioBps: number;
}

/** Portfolio at risk: the share of outstanding principal in loans past due by more than N days. */
export function portfolioAtRisk(loans: ReadonlyArray<{ outstandingPrincipal: Cents; daysPastDue: number }>, thresholds: readonly number[] = [0, 30, 60, 90]) {
  const portfolio = sumCents(loans.map((l) => l.outstandingPrincipal));
  const buckets: ParBucket[] = thresholds.map((days) => {
    const atRisk = sumCents(loans.filter((l) => l.daysPastDue > days).map((l) => l.outstandingPrincipal));
    return { days, atRisk, ratioBps: portfolio === 0 ? 0 : Number(divRoundHalfUp(BigInt(atRisk) * 10_000n, BigInt(portfolio))) };
  });
  return { portfolio, buckets };
}

export function formatBps(bps: number): string {
  return `${Math.floor(bps / 100)}.${String(bps % 100).padStart(2, '0')}%`;
}

// ---------------------------------------------------------------------------
// Payment input and journal entries
// ---------------------------------------------------------------------------

export const PAYMENT_METHODS = DISBURSEMENT_METHODS;
export type PaymentMethod = DisbursementMethod;
export const PAYMENT_METHOD_LABELS = DISBURSEMENT_METHOD_LABELS;

export const PAYMENT_LEDGER_ACCOUNTS = {
  ...LEDGER_ACCOUNTS,
  PENALTIES_RECEIVABLE: '1116',
  INTEREST_INCOME: '4010',
  PENALTY_INCOME: '4020',
  OVERPAYMENTS_PAYABLE: '2030',
} as const;

export interface PaymentInput {
  amount: unknown;
  method: unknown;
  referenceNumber?: unknown;
  paymentDate: unknown;
  notes?: unknown;
}

export interface PaymentDetails {
  amount: Cents;
  method: PaymentMethod;
  referenceNumber: string | null;
  paymentDate: string;
  notes: string | null;
}

export type PaymentErrors = Partial<Record<keyof PaymentInput, string>>;

const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/ ]{3,59}$/;

/**
 * Bank and e-wallet payments need the transfer reference. The payment date
 * cannot be in the future or more than `maxBackdateDays` back.
 */
export function validatePayment(input: PaymentInput, today: string, maxBackdateDays = 30): { ok: boolean; value: PaymentDetails | null; errors: PaymentErrors } {
  const errors: PaymentErrors = {};
  const amount = parsePesos(input.amount);
  if (amount === null || amount <= 0) errors.amount = 'Enter the amount received (pesos and centavos only).';
  const method = String(input.method ?? '') as PaymentMethod;
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) errors.method = 'Choose cash, bank transfer or e-wallet.';
  const ref = typeof input.referenceNumber === 'string' ? input.referenceNumber.trim() : '';
  if (ref && !REFERENCE_PATTERN.test(ref)) errors.referenceNumber = 'Use 4-60 letters, digits, dashes or slashes.';
  else if (!ref && method !== 'CASH' && !errors.method) errors.referenceNumber = 'Enter the bank or e-wallet reference number.';
  const date = input.paymentDate;
  if (!isIsoDate(date)) errors.paymentDate = 'Choose the payment date.';
  else if (date > today) errors.paymentDate = 'The payment date cannot be in the future.';
  else if (daysBetween(date, today) > maxBackdateDays) errors.paymentDate = `The payment date cannot be more than ${maxBackdateDays} days ago.`;
  const notes = typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim().slice(0, 500) : null;
  if (Object.keys(errors).length > 0) return { ok: false, value: null, errors };
  return { ok: true, errors, value: { amount: amount as Cents, method, referenceNumber: ref || null, paymentDate: date as string, notes } };
}

/**
 * A repayment (interest and penalties are income when collected or charged):
 *   Dr Cash on Hand / Cash in Bank       amount received
 *     Cr Penalties Receivable            penalty portion
 *     Cr Interest Income on Loans        interest portion
 *     Cr Loans Receivable                principal portion
 *     Cr Member Overpayments Payable     excess
 */
/** Payments the group's solidarity fund makes for a member are stored with this method. */
export const SOLIDARITY_FUND_METHOD = 'SOLIDARITY_FUND';

/** Label for a stored payment method, including the solidarity fund. */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (method === SOLIDARITY_FUND_METHOD) return 'Solidarity fund';
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? String(method ?? '');
}

export function paymentJournal(p: {
  method: PaymentMethod;
  penalty: Cents;
  interest: Cents;
  principal: Cents;
  excess: Cents;
  /** Paid from somewhere other than the till or bank, e.g. the group's solidarity fund (2040). */
  source?: { accountCode: string; label: string };
}): JournalLine[] {
  const total = p.penalty + p.interest + p.principal + p.excess;
  if (total <= 0) throw new RangeError('Nothing to post.');
  const lines: JournalLine[] = [
    p.source
      ? { accountCode: p.source.accountCode, debit: total, credit: 0, memo: `Payment from ${p.source.label}` }
      : { accountCode: DISBURSEMENT_SOURCE_ACCOUNT[p.method], debit: total, credit: 0, memo: `Payment received (${PAYMENT_METHOD_LABELS[p.method]})` },
  ];
  if (p.penalty > 0) lines.push({ accountCode: PAYMENT_LEDGER_ACCOUNTS.PENALTIES_RECEIVABLE, debit: 0, credit: p.penalty, memo: 'Penalty collected' });
  if (p.interest > 0) lines.push({ accountCode: PAYMENT_LEDGER_ACCOUNTS.INTEREST_INCOME, debit: 0, credit: p.interest, memo: 'Interest collected' });
  if (p.principal > 0) lines.push({ accountCode: PAYMENT_LEDGER_ACCOUNTS.LOANS_RECEIVABLE, debit: 0, credit: p.principal, memo: 'Principal repaid' });
  if (p.excess > 0) lines.push({ accountCode: PAYMENT_LEDGER_ACCOUNTS.OVERPAYMENTS_PAYABLE, debit: 0, credit: p.excess, memo: 'Overpayment held for the member' });
  return lines;
}

/** Penalties charged: Dr Penalties Receivable, Cr Penalty Income. */
export function penaltyJournal(amount: Cents): JournalLine[] {
  if (amount <= 0) throw new RangeError('Nothing to post.');
  return [
    { accountCode: PAYMENT_LEDGER_ACCOUNTS.PENALTIES_RECEIVABLE, debit: amount, credit: 0, memo: 'Late payment penalty charged' },
    { accountCode: PAYMENT_LEDGER_ACCOUNTS.PENALTY_INCOME, debit: 0, credit: amount, memo: 'Late payment penalty charged' },
  ];
}

/** The mirror image of an entry, for a reversal. */
export function reversalJournal(lines: readonly JournalLine[]): JournalLine[] {
  return lines.map((l) => ({ accountCode: l.accountCode, debit: l.credit, credit: l.debit, memo: `Reversal: ${l.memo}` }));
}
