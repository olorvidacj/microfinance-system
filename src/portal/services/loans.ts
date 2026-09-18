import { ApiError, clientRequest } from './clientApi';
import { ClientLoan, LoanApplication, LoanCalculation, LoanProduct, ScheduleItem } from '../types';

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
    const payload = await clientRequest('/api/client/loans');
    return {
      activeLoans: normalizeLoans(payload?.activeLoans),
      completedLoans: normalizeLoans(payload?.completedLoans),
      allLoans: normalizeLoans(payload?.allLoans),
    };
  },

  async schedule(loanId: string): Promise<ScheduleItem[]> {
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

  async products(): Promise<LoanProduct[]> {
    const payload = await clientRequest('/api/client/loan-products');
    if (Array.isArray(payload?.products)) return payload.products;
    if (Array.isArray(payload)) return payload;
    return [];
  },

  async calculate(input: {
    amount: number;
    termMonths: number;
    interestRatePerMonth: number;
    interestType?: string;
  }): Promise<LoanCalculation> {
    const payload = await clientRequest('/api/client/calculate-loan', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload?.calculation;
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
};
