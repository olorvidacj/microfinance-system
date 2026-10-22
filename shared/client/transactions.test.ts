import { describe, expect, it } from 'vitest';
import { periodStart, transactionDirection, transactionKindOf } from './transactions';
import { transactionsCsv } from './statement';

describe('member transaction history', () => {
  it('classifies every register type the server writes', () => {
    expect(transactionKindOf('Loan Repayment')).toBe('LOAN_REPAYMENT');
    expect(transactionKindOf('Loan Disbursement')).toBe('LOAN_DISBURSEMENT');
    expect(transactionKindOf('Reversal')).toBe('PAYMENT_REVERSAL');
    expect(transactionKindOf('Savings Deposit')).toBe('SAVINGS_DEPOSIT');
    expect(transactionKindOf('Savings Withdrawal')).toBe('SAVINGS_WITHDRAWAL');
    expect(transactionKindOf('Savings Interest')).toBe('SAVINGS_INTEREST');
    expect(transactionKindOf('Solidarity Fund Contribution')).toBe('GROUP_FUND');
    expect(transactionKindOf('Something new')).toBe('OTHER');
  });

  it('signs money from the member side', () => {
    expect(transactionDirection('Loan Repayment')).toBe('OUT');
    expect(transactionDirection('Savings Withdrawal')).toBe('OUT');
    expect(transactionDirection('Loan Disbursement')).toBe('IN');
    expect(transactionDirection('Savings Deposit')).toBe('IN');
    expect(transactionDirection('Solidarity Fund Contribution')).toBe('OUT');
    expect(transactionDirection('Solidarity Fund Cover paid back')).toBe('OUT');
    expect(transactionDirection('Solidarity Fund Covered a member')).toBe('IN');
  });

  it('counts periods back in calendar days', () => {
    expect(periodStart('ALL', '2026-10-21')).toBeNull();
    expect(periodStart('30D', '2026-03-01')).toBe('2026-01-30');
    expect(periodStart('1Y', '2024-12-31')).toBe('2024-01-01');
  });

  it('exports signed amounts and quotes text with commas', () => {
    const csv = transactionsCsv([
      { id: 't1', date: '2026-10-01', kind: 'LOAN_REPAYMENT', label: 'Loan Repayment', reference: 'OR-1', amount: '1500.00', direction: 'OUT', account: 'Loan', method: 'Cash', status: 'Completed', notes: 'LN-1: penalty ₱0.00, interest ₱100.00' },
    ]);
    expect(csv.split('\r\n')[1]).toBe('2026-10-01,Loan Repayment,Loan,OR-1,-1500.00,Cash,Completed,"LN-1: penalty ₱0.00, interest ₱100.00"');
  });
});
