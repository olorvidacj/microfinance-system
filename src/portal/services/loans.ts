import { ApiError, clientRequest, withMockFallback } from './clientApi';
import { ClientLoan, LoanApplication, LoanCalculation, LoanProduct, ScheduleItem } from '../types';
import { mockApplications, mockLoans, mockProducts, mockSchedule } from './mock';

export interface LoanSummary {
  activeLoans: ClientLoan[];
  completedLoans: ClientLoan[];
  allLoans: ClientLoan[];
}

const normalizeLoans = (raw: any[]): ClientLoan[] =>
  (raw || []).map((l) => ({
    id: l.id || l.loanNumber,
    loanNumber: l.loanNumber || l.id,
    productName: l.productName || 'Loan',
    principalAmount: Number(l.principalAmount) || 0,
    interestRate: Number(l.interestRate) || 0,
    interestType: l.interestType,
    termMonths: Number(l.termMonths) || 1,
    monthlyInstallment: Number(l.monthlyInstallment) || 0,
    remainingBalance: Number(l.remainingBalance) ?? Number(l.principalAmount) ?? 0,
    paidAmount: l.paidAmount !== undefined ? Number(l.paidAmount) : undefined,
    status: (l.status || 'PENDING').toUpperCase() as ClientLoan['status'],
    startDate: l.startDate,
    applicationDate: l.applicationDate,
    maturityDate: l.maturityDate,
    nextPaymentDate: l.nextPaymentDate,
    purpose: l.purpose,
  }));

export const loanService = {
  async list(): Promise<LoanSummary> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/loans');
        return {
          activeLoans: normalizeLoans(payload?.activeLoans),
          completedLoans: normalizeLoans(payload?.completedLoans),
          allLoans: normalizeLoans(payload?.allLoans),
        };
      },
      async () => ({
        activeLoans: mockLoans.filter((l) => !['COMPLETED', 'PAID_OFF'].includes(l.status)),
        completedLoans: mockLoans.filter((l) => ['COMPLETED', 'PAID_OFF'].includes(l.status)),
        allLoans: mockLoans,
      })
    );
  },

  async schedule(loanId: string): Promise<ScheduleItem[]> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest(`/api/client/loans/${loanId}/schedule`);
        return (payload?.schedule || []).map((s: any) => ({
          installmentNumber: Number(s.installmentNumber),
          dueDate: s.dueDate,
          amountDue: Number(s.amountDue) || 0,
          principal: Number(s.principal) || 0,
          interest: Number(s.interest) || 0,
          remainingBalance: Number(s.remainingBalance) || 0,
          status: s.status as ScheduleItem['status'],
          paidDate: s.paidDate,
          receiptNumber: s.receiptNumber,
        }));
      },
      async () => mockSchedule
    );
  },

  async products(): Promise<LoanProduct[]> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/loan-products');
        if (Array.isArray(payload?.products)) return payload.products;
        if (Array.isArray(payload)) return payload;
        return mockProducts;
      },
      async () => mockProducts
    );
  },

  async calculate(input: {
    amount: number;
    termMonths: number;
    interestRatePerMonth: number;
    interestType?: string;
  }): Promise<LoanCalculation> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/calculate-loan', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        return payload?.calculation;
      },
      async () => {
        const principal = input.amount;
        const term = input.termMonths;
        const r = input.interestRatePerMonth / 100;
        const installment = (principal * r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1);
        const totalInterest = installment * term - principal;
        const processingFee = principal * 0.02;
        return {
          principal,
          termMonths: term,
          monthlyInterestRate: input.interestRatePerMonth,
          estimatedMonthlyPayment: Math.round(installment * 100) / 100,
          estimatedTotalInterest: Math.round(totalInterest * 100) / 100,
          totalRepayable: Math.round((principal + totalInterest) * 100) / 100,
          processingFee: Math.round(processingFee * 100) / 100,
          estimatedNetProceeds: Math.round((principal - processingFee) * 100) / 100,
        };
      }
    );
  },

  async apply(input: {
    productId: string;
    productName: string;
    amount: number;
    termMonths: number;
    repaymentFrequency?: string;
    purpose: string;
    guarantorName?: string;
    guarantorPhone?: string;
    collateralDescription?: string;
  }): Promise<{ application: LoanApplication; message: string }> {
    const payload = await clientRequest('/api/client/apply-loan', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (payload?.error) throw new ApiError(payload.error);
    return {
      application: payload?.application || (null as any),
      message: payload?.message || 'Loan application submitted.',
    };
  },

  async applications(): Promise<LoanApplication[]> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/loan-applications');
        const apps = payload?.applications || payload || [];
        return apps.map((a: any) => ({
          id: a.id,
          loanNumber: a.loanNumber || a.id,
          productId: a.productId,
          productName: a.productName || 'Loan',
          principalAmount: Number(a.principalAmount) || 0,
          termMonths: Number(a.termMonths) || 1,
          applicationDate: a.applicationDate,
          status: (a.status || 'PENDING').toUpperCase() as LoanApplication['status'],
          coopStep: a.coopStep,
          rejectionReason: a.rejectionReason,
          disbursedAt: a.disbursedAt,
        }));
      },
      async () => mockApplications
    );
  },
};