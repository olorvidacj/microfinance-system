/**
 * The one amortization calculator. The portal preview, the branch application
 * form, CalculatorView, approval and disbursement all call `quoteLoan`, so the
 * schedule a member is shown is the schedule that gets stored.
 *
 * Conventions:
 * - The product rate is an ANNUAL percentage.
 * - The term is in months. The number of installments is the term converted to
 *   the repayment frequency: monthly = term, bi-weekly = term x 26 / 12,
 *   weekly = term x 52 / 12, each rounded half-up to a whole installment.
 * - FLAT: total interest = principal x annual rate x term / 12, charged evenly.
 *   Principal and interest are each split evenly across the installments
 *   (`splitEvenly`), so they add back to the totals exactly.
 * - DIMINISHING: the periodic rate is annual rate / installments per year
 *   (12, 26 or 52). The level installment is the annuity payment, computed as
 *   an exact fraction and rounded half-up. Each period's interest is the
 *   outstanding principal x periodic rate, rounded half-up; the rest of the
 *   installment repays principal; the final installment repays whatever
 *   principal is left, so the balance always ends at exactly zero.
 * - Fees are charged once and deducted from the proceeds at disbursement; they
 *   are not part of the installments.
 * - Due dates: the first installment falls one period after the start date.
 *   Monthly dates keep the start day, clamped to the end of shorter months.
 */

import { applyRate, centsToDecimal, divRoundHalfUp, ppmToPercent, splitEvenly, sumCents, type Cents, type Ppm } from './money';

export const INTEREST_METHODS = ['FLAT', 'DIMINISHING'] as const;
export type InterestMethod = (typeof INTEREST_METHODS)[number];

export const REPAYMENT_FREQUENCIES = ['WEEKLY', 'BI_WEEKLY', 'MONTHLY'] as const;
export type RepaymentFrequency = (typeof REPAYMENT_FREQUENCIES)[number];

export const INTEREST_METHOD_LABELS: Readonly<Record<InterestMethod, string>> = {
  FLAT: 'Flat rate',
  DIMINISHING: 'Diminishing balance',
};

export const FREQUENCY_LABELS: Readonly<Record<RepaymentFrequency, string>> = {
  WEEKLY: 'Weekly',
  BI_WEEKLY: 'Bi-weekly',
  MONTHLY: 'Monthly',
};

export const PERIODS_PER_YEAR: Readonly<Record<RepaymentFrequency, number>> = {
  WEEKLY: 52,
  BI_WEEKLY: 26,
  MONTHLY: 12,
};

export const MAX_TERM_MONTHS = 120;
const MAX_RATE_PPM = 1_000_000; // 100% a year

export function isInterestMethod(v: unknown): v is InterestMethod {
  return typeof v === 'string' && (INTEREST_METHODS as readonly string[]).includes(v);
}

export function isRepaymentFrequency(v: unknown): v is RepaymentFrequency {
  return typeof v === 'string' && (REPAYMENT_FREQUENCIES as readonly string[]).includes(v);
}

export const FEE_KINDS = ['PERCENT', 'FIXED'] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

/** A product fee. `value` is ppm of principal for PERCENT, centavos for FIXED. */
export interface FeeRule {
  code: string;
  label: string;
  kind: FeeKind;
  value: number;
}

export interface FeeCharge {
  code: string;
  label: string;
  amount: Cents;
}

export interface QuoteInput {
  principal: Cents;
  termMonths: number;
  annualRate: Ppm;
  method: InterestMethod;
  frequency: RepaymentFrequency;
  fees?: readonly FeeRule[];
  /** YYYY-MM-DD; the first installment falls one period later. */
  startDate: string;
}

export interface ScheduleLine {
  number: number;
  dueDate: string;
  principal: Cents;
  interest: Cents;
  total: Cents;
  balanceAfter: Cents;
}

export interface LoanQuote {
  principal: Cents;
  termMonths: number;
  annualRate: Ppm;
  method: InterestMethod;
  frequency: RepaymentFrequency;
  installments: number;
  /** The regular installment (the first one); others differ by at most a few centavos. */
  installmentAmount: Cents;
  totalInterest: Cents;
  totalPayable: Cents;
  fees: FeeCharge[];
  totalFees: Cents;
  netProceeds: Cents;
  startDate: string;
  firstDueDate: string;
  maturityDate: string;
  schedule: ScheduleLine[];
}

export class QuoteError extends Error {
  constructor(readonly field: keyof QuoteInput | 'fees', message: string) {
    super(message);
    this.name = 'QuoteError';
  }
}

export function installmentCount(termMonths: number, frequency: RepaymentFrequency): number {
  if (frequency === 'MONTHLY') return termMonths;
  return Number(divRoundHalfUp(BigInt(termMonths * PERIODS_PER_YEAR[frequency]), 12n));
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The due date of installment `index` (1-based) for a loan starting on `startDate`. */
export function dueDate(startDate: string, frequency: RepaymentFrequency, index: number): string {
  const m = ISO_DATE.exec(startDate);
  if (!m) throw new RangeError(`Bad date: ${startDate}`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (frequency === 'MONTHLY') {
    const target = new Date(Date.UTC(y, mo + index, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return isoOf(target);
  }
  const days = (frequency === 'WEEKLY' ? 7 : 14) * index;
  return isoOf(new Date(Date.UTC(y, mo, day + days)));
}

export function computeFees(principal: Cents, rules: readonly FeeRule[] = []): FeeCharge[] {
  return rules.map((r) => ({
    code: r.code,
    label: r.label,
    amount: r.kind === 'PERCENT' ? applyRate(principal, r.value) : r.value,
  }));
}

/** Exact level payment for a diminishing-balance loan, rounded half-up. */
export function levelPayment(principal: Cents, annualRate: Ppm, frequency: RepaymentFrequency, n: number): Cents {
  if (annualRate === 0) return Number(divRoundHalfUp(BigInt(principal), BigInt(n)));
  // periodic rate r = annualRate / D with D = 1e6 x periods per year.
  // A = P r (1+r)^n / ((1+r)^n - 1) = P * rate * B^n / (D * (B^n - D^n)), B = D + rate.
  const D = 1_000_000n * BigInt(PERIODS_PER_YEAR[frequency]);
  const B = D + BigInt(annualRate);
  const Bn = B ** BigInt(n);
  const Dn = D ** BigInt(n);
  return Number(divRoundHalfUp(BigInt(principal) * BigInt(annualRate) * Bn, D * (Bn - Dn)));
}

function validate(input: QuoteInput): void {
  if (!Number.isSafeInteger(input.principal) || input.principal <= 0) throw new QuoteError('principal', 'Enter a loan amount greater than zero.');
  if (!Number.isInteger(input.termMonths) || input.termMonths < 1 || input.termMonths > MAX_TERM_MONTHS) {
    throw new QuoteError('termMonths', `The term must be a whole number of months from 1 to ${MAX_TERM_MONTHS}.`);
  }
  if (!Number.isInteger(input.annualRate) || input.annualRate < 0 || input.annualRate > MAX_RATE_PPM) {
    throw new QuoteError('annualRate', 'The interest rate must be between 0% and 100% a year.');
  }
  if (!isInterestMethod(input.method)) throw new QuoteError('method', 'Unknown interest method.');
  if (!isRepaymentFrequency(input.frequency)) throw new QuoteError('frequency', 'Unknown repayment frequency.');
  if (!isIsoDate(input.startDate)) throw new QuoteError('startDate', 'The start date must be a calendar date (YYYY-MM-DD).');
}

export function quoteLoan(input: QuoteInput): LoanQuote {
  validate(input);
  const { principal, termMonths, annualRate, method, frequency, startDate } = input;
  const n = installmentCount(termMonths, frequency);
  const lines: ScheduleLine[] = [];

  if (method === 'FLAT') {
    const totalInterest = applyRate(principal, annualRate, termMonths, 12);
    const principalParts = splitEvenly(principal, n);
    const interestParts = splitEvenly(totalInterest, n);
    let balance = principal;
    for (let i = 0; i < n; i++) {
      balance -= principalParts[i];
      lines.push({
        number: i + 1,
        dueDate: dueDate(startDate, frequency, i + 1),
        principal: principalParts[i],
        interest: interestParts[i],
        total: principalParts[i] + interestParts[i],
        balanceAfter: balance,
      });
    }
  } else if (annualRate === 0) {
    const principalParts = splitEvenly(principal, n);
    let balance = principal;
    principalParts.forEach((p, i) => {
      balance -= p;
      lines.push({ number: i + 1, dueDate: dueDate(startDate, frequency, i + 1), principal: p, interest: 0, total: p, balanceAfter: balance });
    });
  } else {
    const payment = levelPayment(principal, annualRate, frequency, n);
    const periods = PERIODS_PER_YEAR[frequency];
    let balance = principal;
    for (let i = 1; i <= n; i++) {
      const interest = applyRate(balance, annualRate, 1, periods);
      const principalPart = i === n ? balance : Math.min(balance, Math.max(0, payment - interest));
      balance -= principalPart;
      lines.push({
        number: i,
        dueDate: dueDate(startDate, frequency, i),
        principal: principalPart,
        interest,
        total: principalPart + interest,
        balanceAfter: balance,
      });
    }
  }

  const fees = computeFees(principal, input.fees);
  const totalFees = sumCents(fees.map((f) => f.amount));
  if (totalFees >= principal) throw new QuoteError('fees', 'The fees would take the whole loan amount.');
  const totalInterest = sumCents(lines.map((l) => l.interest));

  return {
    principal,
    termMonths,
    annualRate,
    method,
    frequency,
    installments: n,
    installmentAmount: lines[0].total,
    totalInterest,
    totalPayable: principal + totalInterest,
    fees,
    totalFees,
    netProceeds: principal - totalFees,
    startDate,
    firstDueDate: lines[0].dueDate,
    maturityDate: lines[lines.length - 1].dueDate,
    schedule: lines,
  };
}

/** A quote as JSON, with amounts as decimal strings. */
export function quoteToDto(q: LoanQuote) {
  return {
    principal: centsToDecimal(q.principal),
    termMonths: q.termMonths,
    annualRate: ppmToPercent(q.annualRate),
    method: q.method,
    frequency: q.frequency,
    installments: q.installments,
    installmentAmount: centsToDecimal(q.installmentAmount),
    totalInterest: centsToDecimal(q.totalInterest),
    totalPayable: centsToDecimal(q.totalPayable),
    fees: q.fees.map((f) => ({ code: f.code, label: f.label, amount: centsToDecimal(f.amount) })),
    totalFees: centsToDecimal(q.totalFees),
    netProceeds: centsToDecimal(q.netProceeds),
    firstDueDate: q.firstDueDate,
    maturityDate: q.maturityDate,
    schedule: q.schedule.map((l) => ({
      number: l.number,
      dueDate: l.dueDate,
      principal: centsToDecimal(l.principal),
      interest: centsToDecimal(l.interest),
      total: centsToDecimal(l.total),
      balanceAfter: centsToDecimal(l.balanceAfter),
    })),
  };
}
