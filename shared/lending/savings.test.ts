import { describe, expect, it } from 'vitest';
import { isBalanced } from './disbursement';
import {
  checkWithdrawal,
  completePeriods,
  dailyBalances,
  interestForPeriod,
  periodBounds,
  savingsJournal,
  savingsProductToDto,
  validateSavingsProduct,
  type SavingsProduct,
} from './savings';

const regular: SavingsProduct = {
  id: 'sp-1',
  code: 'REG',
  name: 'Regular',
  kind: 'REGULAR',
  annualRate: 10_000, // 1%
  accrualMethod: 'AVERAGE_DAILY_BALANCE',
  minimumBalance: 100_000,
  minimumOpeningDeposit: 100_000,
  maxWithdrawalAmount: 2_000_000,
  maxWithdrawalsPerMonth: 4,
  termMonths: null,
  status: 'ACTIVE',
};
const base = { status: 'ACTIVE' as const, balance: 5_000_000, product: regular, withdrawalsThisMonth: 0, maturityDate: null, today: '2026-10-21' };

describe('withdrawal rules', () => {
  it('allows a withdrawal within balance, minimum and limits', () => {
    expect(checkWithdrawal({ ...base, amount: 1_000_000 })).toMatchObject({ ok: true, available: 4_900_000 });
  });

  it('refuses one over the per-withdrawal limit', () => {
    expect(checkWithdrawal({ ...base, amount: 2_000_001 })).toMatchObject({ ok: false, code: 'OVER_LIMIT' });
  });

  it('refuses one that breaks the minimum balance, and one over the balance', () => {
    expect(checkWithdrawal({ ...base, balance: 1_000_000, amount: 950_000 })).toMatchObject({ ok: false, code: 'BELOW_MINIMUM', available: 900_000 });
    expect(checkWithdrawal({ ...base, balance: 1_000_000, amount: 1_500_000 })).toMatchObject({ ok: false, code: 'INSUFFICIENT' });
  });

  it('refuses frozen, dormant and closed accounts', () => {
    expect(checkWithdrawal({ ...base, status: 'FROZEN', amount: 100 }).code).toBe('ACCOUNT_FROZEN');
    expect(checkWithdrawal({ ...base, status: 'DORMANT', amount: 100 }).code).toBe('ACCOUNT_DORMANT');
    expect(checkWithdrawal({ ...base, status: 'CLOSED', amount: 100 }).code).toBe('ACCOUNT_CLOSED');
  });

  it('enforces the monthly count, compulsory savings and time-deposit maturity', () => {
    expect(checkWithdrawal({ ...base, withdrawalsThisMonth: 4, amount: 100 }).code).toBe('MONTHLY_LIMIT');
    expect(checkWithdrawal({ ...base, product: { ...regular, kind: 'COMPULSORY' }, amount: 100 }).code).toBe('NOT_WITHDRAWABLE');
    expect(checkWithdrawal({ ...base, product: { ...regular, kind: 'TIME_DEPOSIT' }, maturityDate: '2027-01-01', amount: 100 }).code).toBe('NOT_MATURED');
    expect(checkWithdrawal({ ...base, product: { ...regular, kind: 'TIME_DEPOSIT' }, maturityDate: '2026-10-01', amount: 100 }).ok).toBe(true);
  });

  it('closing pays out everything, ignoring the minimum and the limits', () => {
    expect(checkWithdrawal({ ...base, product: { ...regular, kind: 'COMPULSORY' }, amount: 5_000_000, closing: true })).toMatchObject({ ok: true, available: 5_000_000 });
  });
});

describe('interest', () => {
  it('builds daily closing balances', () => {
    const b = dailyBalances(100_000, [{ date: '2026-09-11', amount: 200_000 }, { date: '2026-09-21', amount: -50_000 }], '2026-09');
    expect(b).toHaveLength(30);
    expect([b[0], b[9], b[10], b[19], b[20], b[29]]).toEqual([100_000, 100_000, 300_000, 300_000, 250_000, 250_000]);
  });

  it('average daily balance: 10,000.00 all of September at 1% = 8.22', () => {
    // 1,000,000 cents x 30 days x 1% / 365 = 821.9 -> 822
    expect(interestForPeriod({ opening: 1_000_000, movements: [], period: '2026-09', annualRate: 10_000, method: 'AVERAGE_DAILY_BALANCE', minimumBalance: 100_000 })).toEqual({ base: 1_000_000, interest: 822 });
  });

  it('minimum balance method uses the lowest day', () => {
    const r = interestForPeriod({ opening: 1_000_000, movements: [{ date: '2026-09-15', amount: -800_000 }], period: '2026-09', annualRate: 10_000, method: 'MINIMUM_BALANCE', minimumBalance: 100_000 });
    expect(r).toEqual({ base: 200_000, interest: 164 }); // 200,000 x 30 x 1% / 365 = 164.38
  });

  it('pays nothing below the minimum balance or at a zero rate', () => {
    expect(interestForPeriod({ opening: 50_000, movements: [], period: '2026-09', annualRate: 10_000, method: 'AVERAGE_DAILY_BALANCE', minimumBalance: 100_000 }).interest).toBe(0);
    expect(interestForPeriod({ opening: 5_000_000, movements: [], period: '2026-09', annualRate: 0, method: 'AVERAGE_DAILY_BALANCE', minimumBalance: 0 }).interest).toBe(0);
  });

  it('lists only complete months', () => {
    expect(completePeriods('2026-08-15', '2026-10-21')).toEqual(['2026-08', '2026-09']);
    expect(completePeriods('2026-10-01', '2026-10-21')).toEqual([]);
    expect(completePeriods('2026-11-20', '2027-01-05')).toEqual(['2026-11', '2026-12']);
    expect(periodBounds('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29', days: 29 });
  });
});

describe('products and ledger', () => {
  it('validates products and round-trips the form shape', () => {
    const v = validateSavingsProduct({ code: 'td-12', name: 'Time deposit 12 months', kind: 'TIME_DEPOSIT', annualRate: '4', accrualMethod: 'AVERAGE_DAILY_BALANCE', minimumBalance: '10000', minimumOpeningDeposit: '10000', maxWithdrawalAmount: '', maxWithdrawalsPerMonth: '', termMonths: '12', status: 'ACTIVE' });
    expect(v.ok).toBe(true);
    const p = { id: 'x', ...v.value! };
    expect(validateSavingsProduct(savingsProductToDto(p)).value).toEqual(v.value);
    expect(validateSavingsProduct({ ...savingsProductToDto(p), termMonths: '' }).errors.termMonths).toBeTruthy();
    expect(validateSavingsProduct({ ...savingsProductToDto(p), kind: 'REGULAR' }).errors.termMonths).toBeTruthy();
  });

  it('posts balanced entries to the right liability account', () => {
    const dep = savingsJournal('DEPOSIT', 'REGULAR', 50_000, 'CASH');
    expect(dep.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([['1010', 50_000, 0], ['2010', 0, 50_000]]);
    const wd = savingsJournal('WITHDRAWAL', 'TIME_DEPOSIT', 50_000, 'BANK_TRANSFER');
    expect(wd.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([['2020', 50_000, 0], ['1020', 0, 50_000]]);
    const int = savingsJournal('INTEREST', 'REGULAR', 822);
    expect(int.map((l) => l.accountCode)).toEqual(['4040', '2010']);
    expect([dep, wd, int].every(isBalanced)).toBe(true);
  });
});
