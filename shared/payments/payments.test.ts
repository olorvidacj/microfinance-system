import { describe, expect, it } from 'vitest';
import { checkDepositAmount, checkPayoutAccountNumber, instantWithdrawalRoom, isOwnName, maskAccountNumber, payoutChannel } from './index';

describe('isOwnName', () => {
  const juan = { firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz' };
  it('accepts the member’s name with or without the middle name, any case, accents or punctuation', () => {
    expect(isOwnName('Juan Dela Cruz', juan)).toBe(true);
    expect(isOwnName('JUAN S. DELA CRUZ', juan)).toBe(true);
    expect(isOwnName('juan santos dela cruz', juan)).toBe(true);
    expect(isOwnName('Ma. Niña Reyes', { firstName: 'Ma. Nina', middleName: null, lastName: 'Reyes' })).toBe(true);
  });
  it('refuses another person, a missing name or extra names', () => {
    expect(isOwnName('Pedro Dela Cruz', juan)).toBe(false);
    expect(isOwnName('Juan Cruz', juan)).toBe(false);
    expect(isOwnName('Juan Dela Cruz Jr', juan)).toBe(false);
    expect(isOwnName('Juan Dela Cruz and Maria Dela Cruz', juan)).toBe(false);
    expect(isOwnName('', juan)).toBe(false);
  });
});

describe('payout account numbers', () => {
  const gcash = payoutChannel('PH_GCASH')!;
  const bdo = payoutChannel('PH_BDO')!;
  it('takes an e-wallet mobile number in any common form', () => {
    expect(checkPayoutAccountNumber(gcash, '0917 123 4567').value).toBe('09171234567');
    expect(checkPayoutAccountNumber(gcash, '+63 917 123 4567').value).toBe('09171234567');
    expect(checkPayoutAccountNumber(gcash, '12345').ok).toBe(false);
  });
  it('takes a 10 to 16 digit bank account', () => {
    expect(checkPayoutAccountNumber(bdo, '0012-3456-7890').value).toBe('001234567890');
    expect(checkPayoutAccountNumber(bdo, '123').ok).toBe(false);
  });
  it('masks all but the last four digits', () => {
    expect(maskAccountNumber('09171234567')).toBe('•••• 4567');
  });
  it('knows only the listed channels', () => {
    expect(payoutChannel('PH_UNKNOWN')).toBeNull();
  });
});

describe('limits', () => {
  it('checks the deposit amount exactly', () => {
    expect(checkDepositAmount('100').value).toBe(10_000);
    expect(checkDepositAmount('99.99').ok).toBe(false);
    expect(checkDepositAmount('50000').ok).toBe(true);
    expect(checkDepositAmount('50000.01').ok).toBe(false);
    expect(checkDepositAmount('1.005').ok).toBe(false);
  });
  it('measures an instant withdrawal against what is left today', () => {
    expect(instantWithdrawalRoom({ amount: 500_000, usedToday: 0, dailyLimit: 500_000 }).ok).toBe(true);
    expect(instantWithdrawalRoom({ amount: 500_001, usedToday: 0, dailyLimit: 500_000 })).toMatchObject({ ok: false, code: 'OVER_DAILY_LIMIT', remaining: 500_000 });
    expect(instantWithdrawalRoom({ amount: 200_000, usedToday: 400_000, dailyLimit: 500_000 })).toMatchObject({ ok: false, remaining: 100_000 });
    expect(instantWithdrawalRoom({ amount: 5_000, usedToday: 0, dailyLimit: 500_000 })).toMatchObject({ ok: false, code: 'BELOW_MINIMUM' });
  });
});
