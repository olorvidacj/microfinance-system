import { clientRequest } from './clientApi';
import { ClientLoan, LoanApplication, LoanStatus, ScheduleItem } from '../types';
import {
  FREQUENCY_LABELS,
  INTEREST_METHOD_LABELS,
  centsFromDb,
  centsToPesos,
  productFromDto,
  type LoanProduct,
  type ProductDto,
  type ReceiptDocument,
} from '../../../shared/lending';
import type { LoanDetailView, LoanSummaryView, ScheduleRowView } from '../../lending/service';

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

export interface ClientLoanDetail {
  loan: ClientLoan;
  view: LoanDetailView;
  schedule: ScheduleItem[];
  payments: ClientPaymentRow[];
  receipt: ReceiptDocument | null;
}

// Display values: amounts arrive as exact decimal strings and become numbers only for formatting.
const pesos = (v: string | null | undefined) => (v === null || v === undefined ? 0 : centsToPesos(centsFromDb(v)));

export const statusCode = (status: string): LoanStatus => status.toUpperCase().replace(/ /g, '_') as LoanStatus;

function toClientLoan(v: LoanSummaryView): ClientLoan {
  return {
    id: v.id,
    loanNumber: v.loanNumber,
    productName: v.productName,
    principalAmount: pesos(v.principal),
    interestRate: Number(v.annualRate),
    interestType: INTEREST_METHOD_LABELS[v.interestMethod as keyof typeof INTEREST_METHOD_LABELS] ?? v.interestMethod,
    termMonths: v.termMonths,
    monthlyInstallment: pesos(v.installmentAmount),
    frequency: FREQUENCY_LABELS[v.frequency as keyof typeof FREQUENCY_LABELS] ?? v.frequency,
    remainingBalance: pesos(v.remainingBalance),
    paidAmount: pesos(v.totalPaid),
    totalPayable: pesos(v.totalPayable),
    totalInterest: pesos(v.totalInterest),
    totalFees: pesos(v.totalFees),
    netProceeds: v.netProceeds === null ? undefined : pesos(v.netProceeds),
    overdue: v.overdue,
    status: statusCode(v.status),
    startDate: v.disbursedDate ?? undefined,
    disbursedDate: v.disbursedDate ?? undefined,
    applicationDate: v.applicationDate,
    maturityDate: v.maturityDate,
    nextPaymentDate: v.nextDue?.dueDate,
    purpose: v.purpose,
    repaymentsTotal: v.installments,
  };
}

function toApplication(v: LoanSummaryView): LoanApplication {
  return {
    id: v.id,
    loanNumber: v.loanNumber,
    productId: v.productId,
    productName: v.productName,
    principalAmount: pesos(v.principal),
    termMonths: v.termMonths,
    applicationDate: v.applicationDate,
    status: statusCode(v.status),
    coopStep: v.status === 'Draft' && v.returnedReason ? 'RETURNED' : undefined,
    rejectionReason: v.status === 'Rejected' ? v.decisionReason : v.status === 'Cancelled' ? v.cancellationReason : null,
    returnedReason: v.status === 'Draft' ? v.returnedReason : null,
    decisionReason: v.decisionReason,
    disbursedAt: v.disbursedDate,
    repaymentFrequency: FREQUENCY_LABELS[v.frequency as keyof typeof FREQUENCY_LABELS] ?? v.frequency,
    purpose: v.purpose,
  };
}

function toScheduleItem(r: ScheduleRowView): ScheduleItem {
  return {
    installmentNumber: r.number,
    dueDate: r.dueDate,
    amountDue: pesos(r.total),
    principal: pesos(r.principal),
    interest: pesos(r.interest),
    remainingBalance: pesos(r.balanceAfter),
    status: r.status,
  };
}

function toPayment(p: any): ClientPaymentRow {
  return {
    id: p.id,
    loanId: p.loanId,
    loanNumber: p.loanNumber,
    amount: Number(p.amount) || 0,
    paymentDate: p.paymentDate || p.createdAt,
    paymentMethod: p.method || p.paymentMethod || 'OTHER',
    referenceNumber: p.reference || p.transactionReference || '',
    receiptNumber: p.receiptNumber,
    officialReceiptNumber: p.officialReceiptNumber,
    principalPortion: Number(p.principal ?? p.principalPortion) || 0,
    interestPortion: Number(p.interest ?? p.interestPortion) || 0,
    collectedBy: p.collectedBy,
    status: p.status || 'COMPLETED',
    notes: p.notes,
  };
}

const sumCents = (views: LoanSummaryView[], pick: (v: LoanSummaryView) => string) => centsToPesos(views.reduce((s, v) => s + centsFromDb(pick(v)), 0));

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const loanService = {
  async list(): Promise<LoanSummary> {
    const payload = await clientRequest('/api/client/loans');
    const running: LoanSummaryView[] = payload?.running || [];
    const pending: LoanSummaryView[] = payload?.pending || [];
    const finished: LoanSummaryView[] = payload?.finished || [];
    const all: LoanSummaryView[] = payload?.all || [];
    const nextDue = payload?.summary?.nextDue as { dueDate: string; amount: string } | null;
    return {
      activeLoans: running.map(toClientLoan),
      completedLoans: finished.filter((v) => v.status === 'Closed' || v.status === 'Written Off').map(toClientLoan),
      pendingApplications: pending.map(toApplication),
      allLoans: all.map(toClientLoan),
      summary: {
        totalLoans: all.length,
        activeLoansCount: running.length,
        pendingApplicationsCount: pending.length,
        completedLoansCount: finished.length,
        totalOutstandingBalance: pesos(payload?.summary?.outstanding ?? '0'),
        totalPrincipalBorrowed: sumCents(all.filter((v) => v.disbursedDate), (v) => v.principal),
        totalAmountPaid: sumCents(all, (v) => v.totalPaid),
        nextPaymentAmount: nextDue ? pesos(nextDue.amount) : 0,
        nextPaymentDueDate: nextDue?.dueDate ?? null,
      },
    };
  },

  async get(loanId: string): Promise<ClientLoanDetail> {
    const payload = await clientRequest(`/api/client/loans/${encodeURIComponent(loanId)}`);
    const view = payload.loan as LoanDetailView;
    return {
      loan: toClientLoan(view),
      view,
      schedule: view.schedule.map(toScheduleItem),
      payments: (payload?.payments || []).map(toPayment),
      receipt: view.receipt,
    };
  },

  async schedule(loanId: string): Promise<ScheduleItem[]> {
    const payload = await clientRequest(`/api/client/loans/${encodeURIComponent(loanId)}/schedule`);
    return ((payload?.schedule || []) as ScheduleRowView[]).map(toScheduleItem);
  },

  async payments(loanId?: string): Promise<ClientPaymentRow[]> {
    const url = loanId ? `/api/client/loans/${encodeURIComponent(loanId)}/payments` : '/api/client/payments';
    const payload = await clientRequest(url);
    const rawList = payload?.payments || payload || [];
    return (Array.isArray(rawList) ? rawList : []).map(toPayment);
  },

  async products(): Promise<LoanProduct[]> {
    const payload = await clientRequest('/api/client/loan-products');
    return ((payload?.products || []) as ProductDto[]).map(productFromDto);
  },

  /** A fresh key for one application attempt; resending with it returns the first result. */
  newRequestKey: newKey,

  async apply(
    input: {
      productId: string;
      amount: string;
      termMonths: string;
      purpose: string;
      purposeDetails?: Record<string, string>;
      guarantors?: { name: string; phone: string; relationship: string }[];
      collateral?: { description: string; estimatedValue?: string };
      documents?: { docType: string; fileName: string; base64: string }[];
    },
    requestKey: string,
  ): Promise<{ application: LoanDetailView; replayed: boolean }> {
    const payload = await clientRequest('/api/client/apply-loan', {
      method: 'POST',
      headers: { 'Idempotency-Key': requestKey },
      body: JSON.stringify(input),
    });
    return { application: payload.application as LoanDetailView, replayed: !!payload.replayed };
  },

  async submit(loanId: string): Promise<LoanDetailView> {
    const payload = await clientRequest(`/api/client/loans/${encodeURIComponent(loanId)}/submit`, { method: 'POST', body: '{}' });
    return payload.loan as LoanDetailView;
  },

  async cancel(loanId: string, reason: string): Promise<LoanDetailView> {
    const payload = await clientRequest(`/api/client/loans/${encodeURIComponent(loanId)}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
    return payload.loan as LoanDetailView;
  },

  async applications(): Promise<LoanApplication[]> {
    const payload = await clientRequest('/api/client/loan-applications');
    const finished = ((payload?.finished || []) as LoanSummaryView[]).filter((v) => v.status === 'Rejected' || v.status === 'Cancelled');
    return ((payload?.pending || []) as LoanSummaryView[]).concat(finished).map(toApplication);
  },
};
