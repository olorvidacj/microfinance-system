import { describe, expect, it } from 'vitest';
import { QuoteError, dueDate, installmentCount, levelPayment, quoteLoan, type QuoteInput } from './calculator';

const base: QuoteInput = {
  principal: 1_000_000, // 10,000.00
  termMonths: 6,
  annualRate: 120_000, // 12%
  method: 'DIMINISHING',
  frequency: 'MONTHLY',
  startDate: '2026-01-15',
};

function checkInvariants(q: ReturnType<typeof quoteLoan>) {
  const principalSum = q.schedule.reduce((s, l) => s + l.principal, 0);
  const interestSum = q.schedule.reduce((s, l) => s + l.interest, 0);
  expect(principalSum).toBe(q.principal);
  expect(interestSum).toBe(q.totalInterest);
  expect(q.totalPayable).toBe(q.principal + q.totalInterest);
  expect(q.schedule[q.schedule.length - 1].balanceAfter).toBe(0);
  for (const line of q.schedule) {
    expect(Number.isSafeInteger(line.principal) && line.principal >= 0).toBe(true);
    expect(Number.isSafeInteger(line.interest) && line.interest >= 0).toBe(true);
    expect(line.total).toBe(line.principal + line.interest);
  }
  expect(q.schedule).toHaveLength(q.installments);
}

describe('installment counts and dates', () => {
  it('converts months to installments for each frequency', () => {
    expect(installmentCount(6, 'MONTHLY')).toBe(6);
    expect(installmentCount(12, 'BI_WEEKLY')).toBe(26);
    expect(installmentCount(12, 'WEEKLY')).toBe(52);
    expect(installmentCount(3, 'WEEKLY')).toBe(13);
    // 3 x 26 / 12 = 6.5 rounds half up
    expect(installmentCount(3, 'BI_WEEKLY')).toBe(7);
  });

  it('keeps the start day for monthly dates and clamps short months', () => {
    expect(dueDate('2026-01-31', 'MONTHLY', 1)).toBe('2026-02-28');
    expect(dueDate('2026-01-31', 'MONTHLY', 2)).toBe('2026-03-31');
    expect(dueDate('2026-01-31', 'MONTHLY', 3)).toBe('2026-04-30');
    expect(dueDate('2027-12-31', 'MONTHLY', 2)).toBe('2028-02-29');
    expect(dueDate('2026-12-15', 'MONTHLY', 1)).toBe('2027-01-15');
  });

  it('steps weekly and bi-weekly dates by 7 and 14 days', () => {
    expect(dueDate('2026-12-28', 'WEEKLY', 1)).toBe('2027-01-04');
    expect(dueDate('2026-01-01', 'BI_WEEKLY', 2)).toBe('2026-01-29');
  });
});

describe('flat interest', () => {
  it('charges principal x rate x term evenly', () => {
    const q = quoteLoan({ ...base, method: 'FLAT' });
    expect(q.totalInterest).toBe(60_000);
    expect(q.schedule.map((l) => l.interest)).toEqual([10_000, 10_000, 10_000, 10_000, 10_000, 10_000]);
    expect(q.schedule.map((l) => l.principal)).toEqual([166_667, 166_667, 166_667, 166_667, 166_666, 166_666]);
    expect(q.installmentAmount).toBe(176_667);
    expect(q.firstDueDate).toBe('2026-02-15');
    expect(q.maturityDate).toBe('2026-07-15');
    checkInvariants(q);
  });

  it('keeps flat interest on the months, not on the installment count', () => {
    const weekly = quoteLoan({ ...base, method: 'FLAT', frequency: 'WEEKLY', termMonths: 3 });
    // 10,000 x 12% x 3/12 = 300.00 over 13 weekly installments
    expect(weekly.totalInterest).toBe(30_000);
    expect(weekly.installments).toBe(13);
    checkInvariants(weekly);
  });
});

describe('diminishing balance', () => {
  it('matches the textbook annuity: 10,000 at 1% a month for 6 months pays 1,725.48', () => {
    expect(levelPayment(1_000_000, 120_000, 'MONTHLY', 6)).toBe(172_548);
    const q = quoteLoan(base);
    expect(q.installmentAmount).toBe(172_548);
    expect(q.schedule[0]).toMatchObject({ interest: 10_000, principal: 162_548, balanceAfter: 837_452 });
    // 8,374.52 x 1% = 83.7452 -> 83.75
    expect(q.schedule[1].interest).toBe(8_375);
    checkInvariants(q);
    // every installment but the last is the level payment
    q.schedule.slice(0, -1).forEach((l) => expect(l.total).toBe(172_548));
    expect(Math.abs(q.schedule[5].total - 172_548)).toBeLessThanOrEqual(5);
  });

  it('agrees with a floating-point model to within a centavo per line', () => {
    for (const frequency of ['WEEKLY', 'BI_WEEKLY', 'MONTHLY'] as const) {
      const q = quoteLoan({ ...base, principal: 12_345_678, termMonths: 24, annualRate: 185_000, frequency });
      checkInvariants(q);
      const periods = { WEEKLY: 52, BI_WEEKLY: 26, MONTHLY: 12 }[frequency];
      const r = 0.185 / periods;
      const n = q.installments;
      const a = (123_456.78 * r) / (1 - (1 + r) ** -n);
      expect(Math.abs(q.installmentAmount / 100 - a)).toBeLessThan(0.006);
    }
  });

  it('handles a zero rate as straight principal repayment', () => {
    const q = quoteLoan({ ...base, annualRate: 0 });
    expect(q.totalInterest).toBe(0);
    checkInvariants(q);
  });
});

describe('fees', () => {
  it('computes percent and fixed fees and the net proceeds', () => {
    const q = quoteLoan({
      ...base,
      principal: 1_234_567,
      fees: [
        { code: 'PROCESSING', label: 'Processing fee', kind: 'PERCENT', value: 20_000 },
        { code: 'NOTARIAL', label: 'Notarial fee', kind: 'FIXED', value: 15_000 },
      ],
    });
    expect(q.fees).toEqual([
      { code: 'PROCESSING', label: 'Processing fee', amount: 24_691 },
      { code: 'NOTARIAL', label: 'Notarial fee', amount: 15_000 },
    ]);
    expect(q.totalFees).toBe(39_691);
    expect(q.netProceeds).toBe(1_234_567 - 39_691);
  });

  it('refuses fees that would consume the loan', () => {
    expect(() => quoteLoan({ ...base, principal: 10_000, fees: [{ code: 'X', label: 'x', kind: 'FIXED', value: 10_000 }] })).toThrow(QuoteError);
  });
});

describe('input validation', () => {
  it('rejects bad inputs with the field named', () => {
    const bad: Array<[Partial<QuoteInput>, string]> = [
      [{ principal: 0 }, 'principal'],
      [{ principal: 10.5 }, 'principal'],
      [{ termMonths: 0 }, 'termMonths'],
      [{ termMonths: 121 }, 'termMonths'],
      [{ annualRate: -1 }, 'annualRate'],
      [{ method: 'SIMPLE' as any }, 'method'],
      [{ frequency: 'DAILY' as any }, 'frequency'],
      [{ startDate: '2026-02-30' }, 'startDate'],
    ];
    for (const [patch, field] of bad) {
      try {
        quoteLoan({ ...base, ...patch });
        throw new Error(`accepted ${JSON.stringify(patch)}`);
      } catch (err) {
        expect(err).toBeInstanceOf(QuoteError);
        expect((err as QuoteError).field).toBe(field);
      }
    }
  });
});
