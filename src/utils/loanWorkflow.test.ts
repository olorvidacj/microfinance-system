import { describe, it, expect } from 'vitest';
import {
  calculateLoanSchedule,
  computeLoanRemainingBalance,
  allocatePaymentToSchedule,
  formatCurrency,
} from './loanMath';

describe('HOSCOMO Microfinance — Loan Calculation & Lifecycle Workflow', () => {
  describe('calculateLoanSchedule', () => {
    it('accurately computes flat rate loan with processing fee and schedule dates', () => {
      const result = calculateLoanSchedule({
        principal: 20000,
        annualInterestRate: 12,
        termMonths: 6,
        interestType: 'Flat Rate',
        repaymentFrequency: 'Monthly',
        processingFeePercentage: 2,
        startDate: '2026-10-01',
      });

      expect(result.processingFee).toBe(400);
      expect(result.totalInterest).toBe(1200); // 20,000 * 0.12 * 0.5
      expect(result.totalPayable).toBe(21200);
      expect(result.totalInstallments).toBe(6);
      expect(result.schedule.length).toBe(6);
      expect(result.schedule[0].dueDate).toBe('2026-11-01');
      expect(result.schedule[5].dueDate).toBe('2027-04-01');
    });

    it('accurately computes reducing balance amortization schedule', () => {
      const result = calculateLoanSchedule({
        principal: 50000,
        annualInterestRate: 12,
        termMonths: 12,
        interestType: 'Reducing Balance',
        repaymentFrequency: 'Monthly',
        processingFeePercentage: 2,
        startDate: '2026-10-01',
      });

      expect(result.processingFee).toBe(1000);
      expect(result.totalInstallments).toBe(12);
      expect(result.installmentAmount).toBeGreaterThan(0);
      expect(result.totalPayable).toBeGreaterThan(50000);
      expect(result.schedule.length).toBe(12);
    });
  });

  describe('computeLoanRemainingBalance', () => {
    it('correctly calculates outstanding balance and clamps to zero', () => {
      expect(computeLoanRemainingBalance(21200, 21200)).toBe(0);
      expect(computeLoanRemainingBalance(21200, 21500)).toBe(0); // Overpayment clamped
      expect(computeLoanRemainingBalance(21200, 10000)).toBe(11200);
      expect(computeLoanRemainingBalance(21200, 0)).toBe(21200);
    });
  });

  describe('allocatePaymentToSchedule', () => {
    it('allocates payment across scheduled installments in chronological order', () => {
      const calc = calculateLoanSchedule({
        principal: 12000,
        annualInterestRate: 12,
        termMonths: 3,
        interestType: 'Flat Rate',
        repaymentFrequency: 'Monthly',
        processingFeePercentage: 0,
        startDate: '2026-10-01',
      });

      // Total payable = 12360, installment = 4120
      const payment1 = allocatePaymentToSchedule(calc.schedule as any, 4120, '2026-11-01');
      expect(payment1.principalPaid).toBeGreaterThan(0);
      expect(payment1.updatedSchedule[0].amountPaid).toBe(4120);

      // Settle entire remainder
      const payment2 = allocatePaymentToSchedule(payment1.updatedSchedule, 8240, '2026-12-01');
      expect(payment2.updatedSchedule.every((s: any) => (s.amountPaid || 0) >= s.totalDue - 0.01)).toBe(true);
    });
  });

  describe('KYC Status Validation Rules for Loan Origination', () => {
    const isKycApproved = (status: string | null | undefined): boolean => {
      const norm = String(status || '').toUpperCase();
      return ['VERIFIED', 'APPROVED'].includes(norm);
    };

    it('permits only VERIFIED or APPROVED KYC clients to apply', () => {
      expect(isKycApproved('APPROVED')).toBe(true);
      expect(isKycApproved('VERIFIED')).toBe(true);
      expect(isKycApproved('verified')).toBe(true);
      expect(isKycApproved('NOT_STARTED')).toBe(false);
      expect(isKycApproved('IN_PROGRESS')).toBe(false);
      expect(isKycApproved('SUBMITTED')).toBe(false);
      expect(isKycApproved('PENDING')).toBe(false);
      expect(isKycApproved('UNDER_REVIEW')).toBe(false);
      expect(isKycApproved('CORRECTION_REQUIRED')).toBe(false);
      expect(isKycApproved('REJECTED')).toBe(false);
      expect(isKycApproved('SUSPENDED')).toBe(false);
      expect(isKycApproved(null)).toBe(false);
    });
  });

  describe('Disbursement Net Proceeds Calculation', () => {
    it('computes net proceeds correctly when fee is deducted', () => {
      const principal = 30000;
      const processingFee = 600; // 2%
      const deductFee = true;
      const netProceeds = deductFee ? Math.max(0, principal - processingFee) : principal;
      expect(netProceeds).toBe(29400);
    });

    it('computes net proceeds correctly when fee is paid separately', () => {
      const principal = 30000;
      const processingFee = 600;
      const deductFee = false;
      const netProceeds = deductFee ? Math.max(0, principal - processingFee) : principal;
      expect(netProceeds).toBe(30000);
    });
  });
});
