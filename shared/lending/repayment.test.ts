import { describe, expect, it } from 'vitest';
import { isBalanced } from './disbursement';
import {
  allocatePayment,
  amountDueAsOf,
  daysPastDue,
  formatBps,
  installmentStatus,
  paymentJournal,
  payoffAmount,
  penaltiesToCharge,
  penaltyDates,
  penaltyJournal,
  portfolioAtRisk,
  reversalJournal,
  unapplyAllocation,
  validatePayment,
  type InstallmentBalance,
} from './repayment';

// Three monthly installments of 1,000.00 principal + 100.00 interest.
const inst = (number: number, dueDate: string, extra: Partial<InstallmentBalance> = {}): InstallmentBalance => ({
  number,
  dueDate,
  principalDue: 100_000,
  interestDue: 10_000,
  penaltyDue: 0,
  principalPaid: 0,
  interestPaid: 0,
  penaltyPaid: 0,
  ...extra,
});
const loan = () => [inst(1, '2026-01-15'), inst(2, '2026-02-15'), inst(3, '2026-03-15')];

describe('allocation: penalty, then interest, then principal, oldest first', () => {
  it('partial payment covers interest before principal', () => {
    const a = allocatePayment(loan(), 50_000, '2026-01-15');
    expect(a.kind).toBe('PARTIAL');
    expect(a.due).toBe(110_000);
    expect(a.lines).toEqual([{ number: 1, penalty: 0, interest: 10_000, principal: 40_000 }]);
    expect(a.excess).toBe(0);
    expect(installmentStatus(a.after[0], '2026-01-15')).toBe('PARTIAL');
    expect(installmentStatus(a.after[0], '2026-01-16')).toBe('OVERDUE');
  });

  it('partial payment on an overdue installment pays the penalty first', () => {
    const items = [inst(1, '2026-01-15', { penaltyDue: 3_300 }), inst(2, '2026-02-15')];
    const a = allocatePayment(items, 10_000, '2026-01-20');
    expect(a.lines).toEqual([{ number: 1, penalty: 3_300, interest: 6_700, principal: 0 }]);
    expect(a.penalty).toBe(3_300);
  });

  it('full payment of what is due settles that installment exactly', () => {
    const a = allocatePayment(loan(), 110_000, '2026-01-15');
    expect(a.kind).toBe('FULL');
    expect(a.lines).toEqual([{ number: 1, penalty: 0, interest: 10_000, principal: 100_000 }]);
    expect(installmentStatus(a.after[0], '2026-02-01')).toBe('PAID');
    expect(installmentStatus(a.after[1], '2026-02-01')).toBe('PENDING');
    expect(a.settles).toBe(false);
  });

  it('advance payment flows into the next installments in order', () => {
    const a = allocatePayment(loan(), 160_000, '2026-01-10');
    expect(a.kind).toBe('ADVANCE');
    expect(a.due).toBe(0);
    expect(a.lines).toEqual([
      { number: 1, penalty: 0, interest: 10_000, principal: 100_000 },
      { number: 2, penalty: 0, interest: 10_000, principal: 40_000 },
    ]);
  });

  it('paying exactly the payoff settles the loan', () => {
    const a = allocatePayment(loan(), 330_000, '2026-01-10');
    expect(a.kind).toBe('FULL');
    expect(a.settles).toBe(true);
    expect(payoffAmount(a.after)).toBe(0);
  });

  it('overpayment settles everything and keeps the excess separate', () => {
    const items = [inst(1, '2026-01-15', { penaltyDue: 3_300 }), inst(2, '2026-02-15'), inst(3, '2026-03-15')];
    const a = allocatePayment(items, 400_000, '2026-01-20');
    expect(a.kind).toBe('OVERPAYMENT');
    expect(a.payoff).toBe(333_300);
    expect(a.applied).toBe(333_300);
    expect(a.excess).toBe(66_700);
    expect(a.penalty + a.interest + a.principal).toBe(a.applied);
    expect(a.settles).toBe(true);
    expect(a.after.every((i) => installmentStatus(i, '2026-01-20') === 'PAID')).toBe(true);
  });

  it('refuses a zero or fractional-centavo amount', () => {
    expect(() => allocatePayment(loan(), 0, '2026-01-15')).toThrow();
    expect(() => allocatePayment(loan(), 10.5, '2026-01-15')).toThrow();
  });

  it('reversal restores the installments exactly', () => {
    const before = loan();
    const a = allocatePayment(before, 160_000, '2026-01-10');
    expect(unapplyAllocation(a.after, a.lines)).toEqual(before);
    expect(() => unapplyAllocation(before, a.lines)).toThrow();
  });

  it('counts what is due as of a date', () => {
    expect(amountDueAsOf(loan(), '2026-02-15')).toBe(220_000);
    expect(amountDueAsOf(loan(), '2026-01-14')).toBe(0);
  });
});

describe('penalties', () => {
  it('fall the day after the due date, then monthly', () => {
    expect(penaltyDates('2026-01-31', '2026-01-31')).toEqual([]);
    expect(penaltyDates('2026-01-31', '2026-02-01')).toEqual(['2026-02-01']);
    expect(penaltyDates('2026-01-31', '2026-03-31')).toEqual(['2026-02-01', '2026-03-01']);
    expect(penaltyDates('2026-01-31', '2026-04-01')).toEqual(['2026-02-01', '2026-03-01', '2026-04-01']);
  });

  it('charges each overdue installment exactly once per month, never again on re-run', () => {
    const items = loan();
    const first = penaltiesToCharge(items, 30_000, '2026-01-20', new Set());
    // 3% of the unpaid 1,100.00 = 33.00, charged once for installment 1
    expect(first).toEqual([{ number: 1, period: 1, assessedOn: '2026-01-16', base: 110_000, amount: 3_300 }]);
    const charged = new Set(first.map((c) => `${c.number}:${c.period}`));
    expect(penaltiesToCharge(items, 30_000, '2026-01-20', charged)).toEqual([]);
    expect(penaltiesToCharge(items, 30_000, '2026-02-10', charged)).toEqual([]);
    // a month later the second month falls due, and installment 2 its first
    const later = penaltiesToCharge(items, 30_000, '2026-02-16', charged);
    expect(later.map((c) => `${c.number}:${c.period}@${c.assessedOn}`)).toEqual(['1:2@2026-02-16', '2:1@2026-02-16']);
  });

  it('charges only on unpaid principal and interest, and nothing once they are paid', () => {
    const partly = [inst(1, '2026-01-15', { interestPaid: 10_000, principalPaid: 50_000, penaltyDue: 3_300 })];
    expect(penaltiesToCharge(partly, 30_000, '2026-01-16', new Set())[0].base).toBe(50_000);
    const paid = [inst(1, '2026-01-15', { interestPaid: 10_000, principalPaid: 100_000 })];
    expect(penaltiesToCharge(paid, 30_000, '2026-03-01', new Set())).toEqual([]);
    expect(penaltiesToCharge(loan(), 0, '2026-03-01', new Set())).toEqual([]);
  });

  it('measures days past due from the oldest unpaid installment', () => {
    expect(daysPastDue(loan(), '2026-01-15')).toBe(0);
    expect(daysPastDue(loan(), '2026-02-20')).toBe(36);
    const firstPaid = [inst(1, '2026-01-15', { interestPaid: 10_000, principalPaid: 100_000 }), inst(2, '2026-02-15')];
    expect(daysPastDue(firstPaid, '2026-02-20')).toBe(5);
  });
});

describe('portfolio at risk', () => {
  it('reports the share of outstanding principal past each threshold', () => {
    const par = portfolioAtRisk([
      { outstandingPrincipal: 600_000, daysPastDue: 0 },
      { outstandingPrincipal: 300_000, daysPastDue: 12 },
      { outstandingPrincipal: 100_000, daysPastDue: 45 },
    ]);
    expect(par.portfolio).toBe(1_000_000);
    expect(par.buckets.map((b) => [b.days, b.atRisk, formatBps(b.ratioBps)])).toEqual([
      [0, 400_000, '40.00%'],
      [30, 100_000, '10.00%'],
      [60, 0, '0.00%'],
      [90, 0, '0.00%'],
    ]);
    expect(portfolioAtRisk([]).buckets[0].ratioBps).toBe(0);
  });
});

describe('payment input and ledger', () => {
  it('validates the payment like the disbursement form', () => {
    expect(validatePayment({ amount: '1100.00', method: 'CASH', paymentDate: '2026-10-21' }, '2026-10-21').ok).toBe(true);
    const bad = validatePayment({ amount: '0', method: 'E_WALLET', paymentDate: '2026-10-22' }, '2026-10-21');
    expect(Object.keys(bad.errors).sort()).toEqual(['amount', 'paymentDate', 'referenceNumber']);
    expect(validatePayment({ amount: '10', method: 'CASH', paymentDate: '2026-08-01' }, '2026-10-21').errors.paymentDate).toMatch(/30 days/);
  });

  it('posts balanced entries in the allocation order', () => {
    const lines = paymentJournal({ method: 'CASH', penalty: 3_300, interest: 10_000, principal: 100_000, excess: 5_000 });
    expect(isBalanced(lines)).toBe(true);
    expect(lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([
      ['1010', 118_300, 0],
      ['1116', 0, 3_300],
      ['4010', 0, 10_000],
      ['1110', 0, 100_000],
      ['2030', 0, 5_000],
    ]);
    expect(isBalanced(penaltyJournal(3_300))).toBe(true);
    const rev = reversalJournal(lines);
    expect(isBalanced(rev)).toBe(true);
    expect(rev[0]).toMatchObject({ accountCode: '1010', debit: 0, credit: 118_300 });
  });
});
