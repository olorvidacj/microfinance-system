import { ApiError, clientRequest } from './clientApi';
import { ClientLoan, LoanApplication, LoanCalculation, LoanProduct, ScheduleItem } from '../types';

export interface LoanMetrics {
  totalLoans: number;
  activeLoansCount: number;
  pendingApplicationsCount: number;
  completedLoansCount: number;
  totalOutstandingBalance: number;
  totalPrincipalBorrowed: number;
  totalAmountPaid: number;
  nextPaymentAmount: number;
  nextPaymentDueDate: string | null;
}

export interface LoanSummary {
  activeLoans: ClientLoan[];
  completedLoans: ClientLoan[];
  pendingApplications: LoanApplication[];
  allLoans: ClientLoan[];
  summary: LoanMetrics;
}

export interface ClientPaymentRow {
  id: string;
  loanId?: string;
  loanNumber?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  receiptNumber?: string;
  officialReceiptNumber?: string;
  principalPortion?: number;
  interestPortion?: number;
  collectedBy?: string;
  status: string;
  notes?: string;
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
    disbursedDate: l.disbursedDate || l.startDate,
    applicationDate: l.applicationDate,
    maturityDate: l.maturityDate,
    nextPaymentDate: l.nextPaymentDate,
    purpose: l.purpose,
  }));

const normalizeApplications = (raw: any[]): LoanApplication[] =>
  (raw || []).map((a) => ({
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
    repaymentFrequency: a.repaymentFrequency,
    purpose: a.purpose,
    notes: a.notes,
  }));

export const loanService = {
  async list(): Promise<LoanSummary> {
    const payload = await clientRequest('/api/client/loans');
    const activeLoans = normalizeLoans(payload?.activeLoans);
    const completedLoans = normalizeLoans(payload?.completedLoans);
    const pendingApplications = normalizeApplications(payload?.pendingApplications);
    const allLoans = normalizeLoans(payload?.allLoans);

    const summary: LoanMetrics = payload?.summary || {
      totalLoans: allLoans.length,
      activeLoansCount: activeLoans.length,
      pendingApplicationsCount: pendingApplications.length,
      completedLoansCount: completedLoans.length,
      totalOutstandingBalance: activeLoans.reduce((sum, l) => sum + (l.remainingBalance || 0), 0),
      totalPrincipalBorrowed: allLoans.reduce((sum, l) => sum + (l.principalAmount || 0), 0),
      totalAmountPaid: allLoans.reduce((sum, l) => sum + (l.paidAmount || 0), 0),
      nextPaymentAmount: activeLoans[0]?.monthlyInstallment || 0,
      nextPaymentDueDate: activeLoans[0]?.nextPaymentDate || null,
    };

    return {
      activeLoans,
      completedLoans,
      pendingApplications,
      allLoans,
      summary,
    };
  },

  async get(loanId: string): Promise<{ loan: ClientLoan; schedule: ScheduleItem[]; payments: ClientPaymentRow[] }> {
    const payload = await clientRequest(`/api/client/loans/${loanId}`);
    const rawLoan = payload?.loan;
    const loan = rawLoan ? normalizeLoans([rawLoan])[0] : (null as any);
    const schedule = (payload?.schedule || []).map((s: any) => ({
      installmentNumber: Number(s.installmentNumber),
      dueDate: s.dueDate,
      amountDue: Number(s.amountDue || s.totalDue) || 0,
      principal: Number(s.principal) || 0,
      interest: Number(s.interest) || 0,
      remainingBalance: Number(s.remainingBalance) || 0,
      status: s.status as ScheduleItem['status'],
      paidDate: s.paidDate,
      receiptNumber: s.receiptNumber,
    }));
    const payments = (payload?.payments || []).map((p: any) => ({
      id: p.id,
      loanId: p.loanId,
      loanNumber: p.loanNumber,
      amount: Number(p.amount) || 0,
      paymentDate: p.paymentDate || p.createdAt,
      paymentMethod: p.paymentMethod || 'OTHER',
      referenceNumber: p.referenceNumber || '',
      officialReceiptNumber: p.officialReceiptNumber,
      status: p.status || 'COMPLETED',
      notes: p.notes,
    }));
    return { loan, schedule, payments };
  },

  async schedule(loanId: string): Promise<ScheduleItem[]> {
    const payload = await clientRequest(`/api/client/loans/${loanId}/schedule`);
    return (payload?.schedule || []).map((s: any) => ({
      installmentNumber: Number(s.installmentNumber),
      dueDate: s.dueDate,
      amountDue: Number(s.amountDue || s.totalDue) || 0,
      principal: Number(s.principal) || 0,
      interest: Number(s.interest) || 0,
      remainingBalance: Number(s.remainingBalance) || 0,
      status: s.status as ScheduleItem['status'],
      paidDate: s.paidDate,
      receiptNumber: s.receiptNumber,
    }));
  },

  async payments(loanId?: string): Promise<ClientPaymentRow[]> {
    const url = loanId ? `/api/client/loans/${loanId}/payments` : '/api/client/payments';
    const payload = await clientRequest(url);
    const rawList = payload?.payments || payload || [];
    return (Array.isArray(rawList) ? rawList : []).map((p: any) => ({
      id: p.id,
      loanId: p.loanId,
      loanNumber: p.loanNumber,
      amount: Number(p.amount) || 0,
      paymentDate: p.paymentDate || p.createdAt,
      paymentMethod: p.paymentMethod || 'OTHER',
      referenceNumber: p.referenceNumber || '',
      officialReceiptNumber: p.officialReceiptNumber,
      status: p.status || 'COMPLETED',
      notes: p.notes,
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
    purposeDetails?: any;
    guarantorName?: string;
    guarantorPhone?: string;
    guarantorRelationship?: string;
    collateralDescription?: string;
    collateralValue?: number;
    documents?: { docName: string; docType: string; fileName: string; base64?: string; fileUrl?: string; mimeType?: string }[];
    declarations?: boolean;
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
    return normalizeApplications(apps);
  },
};
