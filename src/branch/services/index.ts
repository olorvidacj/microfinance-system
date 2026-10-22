import { productFromDto, type LoanProduct, type ProductDto, type ReceiptDocument, type SavingsProductDto } from '../../../shared/lending';
import type { LoanDetailView } from '../../lending/service';
import type { PaymentView, ProofView } from '../../lending/repayment';
import { branchRequest } from './api';
import type { KycDossierView } from '../../components/kyc/KycReviewPanel';
import type { KycDecision } from '../../../shared/kyc-core';
import {
  BranchContextData,
  BranchDashboard,
  BranchLoan,
  BranchLoanDetail,
  BranchNotification,
  BranchDocument,
  BranchPayment,
  BranchPersonnel,
  BranchSavingsAccount,
  ClientDetail,
  ClientSummary,
  FinancialTransactionRow,
  LoanAssessment,
  PerformanceData,
  ReportRow,
  SavingsTransactionRow,
  SolidarityGroup,
  TodayCollections,
  StaffBranchAssignmentResponse,
  KycQueueResult,
} from '../types';

const unwrap = (p: any) => p?.data;

export type QueryFilters = Record<string, string | number | boolean | null | undefined>;

/**
 * Serializes filters into a query string, dropping empty values.
 *
 * `new URLSearchParams({ status: undefined })` stringifies to the literal
 * text "undefined", which the server then treats as a real filter value and
 * matches against. Every unset filter must be omitted entirely, so callers
 * can pass `value || undefined` freely without corrupting the query.
 */
function toQuery(filters?: QueryFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export const branchService = {
  context: async (): Promise<BranchContextData> => {
    const payload = await branchRequest('/api/branch/context');
    return {
      personnel: payload.personnel,
      branch: payload.branch,
      permissions: payload.permissions || [],
      viewAll: !!payload.viewAll,
    };
  },

  personnel: async (): Promise<{ personnel: BranchPersonnel; branch: any; permissions: string[] }> => {
    const payload = await branchRequest('/api/branch/personnel');
    return { personnel: payload.personnel, branch: payload.branch, permissions: payload.permissions || [] };
  },

  getBranchAssignment: async (): Promise<StaffBranchAssignmentResponse> => {
    return branchRequest('/api/staff/branch-assignment');
  },

  assignBranch: async (
    staffId: string,
    branchId: string,
    adminPassword?: string
  ): Promise<{ success: boolean; message: string; staffId: string; branchId: string }> => {
    return branchRequest('/api/admin/staff/assign-branch', {
      method: 'POST',
      body: JSON.stringify({ staffId, branchId, adminPassword }),
    });
  },

  requestAssignment: async (): Promise<{ success: boolean; message: string }> => {
    return branchRequest('/api/staff/request-assignment', {
      method: 'POST',
    });
  },
};

export const dashboardService = {
  get: async (): Promise<BranchDashboard> => {
    const payload = await branchRequest('/api/branch/dashboard');
    return payload?.data as BranchDashboard;
  },

  performance: async (range: string = 'month'): Promise<PerformanceData> => {
    const payload = await branchRequest(`/api/branch/performance?range=${encodeURIComponent(range)}`);
    return payload?.data as PerformanceData;
  },

  activities: async (limit = 15) => {
    const payload = await branchRequest(`/api/branch/activities?limit=${limit}`);
    return payload?.data || [];
  },
};

export const clientsService = {
  list: async (filters?: QueryFilters): Promise<ClientSummary[]> => {
    const qs = toQuery(filters);
    const payload = await branchRequest(`/api/branch/clients${qs ? `?${qs}` : ''}`);
    return payload?.data || [];
  },

  get: async (id: string) =>
    (await branchRequest(`/api/branch/clients/${id}`, undefined, unwrap)) || null,

  create: async (data: Record<string, any>) =>
    branchRequest('/api/branch/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: async (id: string, data: Record<string, any>) =>
    branchRequest(`/api/branch/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

export const kycService = {
  queue: async (params?: { status?: string; search?: string }): Promise<KycQueueResult> => {
    const qs = toQuery({ status: params?.status && params.status !== 'ALL' ? params.status : undefined, search: params?.search });
    const payload = await branchRequest(`/api/branch/kyc-queue${qs ? `?${qs}` : ''}`);
    return { data: payload?.data || [], counts: payload?.counts };
  },

  get: async (clientId: string): Promise<KycDossierView> => {
    const payload = await branchRequest(`/api/branch/kyc/${encodeURIComponent(clientId)}`);
    return payload.data;
  },

  claim: async (clientId: string) =>
    branchRequest(`/api/branch/kyc/${encodeURIComponent(clientId)}/claim`, { method: 'POST' }),

  release: async (clientId: string) =>
    branchRequest(`/api/branch/kyc/${encodeURIComponent(clientId)}/release`, { method: 'POST' }),

  decide: async (clientId: string, body: { decision: KycDecision; reason: string; sections: string[] }, idempotencyKey: string) =>
    branchRequest(`/api/branch/kyc/${encodeURIComponent(clientId)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    }),
};

const jsonPost = (url: string, body: unknown, idempotencyKey?: string) =>
  branchRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    body: JSON.stringify(body ?? {}),
  });

export const loansService = {
  products: async (): Promise<LoanProduct[]> => {
    const payload = await branchRequest('/api/branch/loan-products');
    return ((payload?.data || []) as ProductDto[]).map(productFromDto);
  },

  applications: async (filters?: QueryFilters): Promise<BranchLoan[]> => {
    const qs = toQuery(filters);
    const payload = await branchRequest(`/api/branch/loan-applications${qs ? `?${qs}` : ''}`);
    return payload?.data || [];
  },

  /** Files an application for a member; the key makes a double submit return the first one. */
  createApplication: async (data: Record<string, unknown>, idempotencyKey: string): Promise<LoanDetailView> =>
    (await jsonPost('/api/branch/loan-applications', data, idempotencyKey))?.data,

  list: async (filters?: QueryFilters): Promise<BranchLoan[]> => {
    const qs = toQuery(filters);
    const payload = await branchRequest(`/api/branch/loans${qs ? `?${qs}` : ''}`);
    return payload?.data || [];
  },

  get: async (id: string): Promise<BranchLoanDetail> => {
    const payload = await branchRequest(`/api/branch/loans/${encodeURIComponent(id)}`);
    return payload?.data as BranchLoanDetail;
  },

  submit: async (id: string, changes?: Record<string, unknown>): Promise<LoanDetailView> =>
    (await jsonPost(`/api/branch/loans/${encodeURIComponent(id)}/submit`, changes))?.data,

  startReview: async (id: string): Promise<LoanDetailView> => (await jsonPost(`/api/branch/loans/${encodeURIComponent(id)}/review`, {}))?.data,

  decide: async (
    id: string,
    input: { decision: 'APPROVE' | 'REJECT' | 'RETURN'; reason: string; approvedAmount?: string; approvedTermMonths?: string },
  ): Promise<{ replayed: boolean; loan: LoanDetailView }> => (await jsonPost(`/api/branch/loans/${encodeURIComponent(id)}/decision`, input))?.data,

  cancel: async (id: string, reason: string): Promise<LoanDetailView> => (await jsonPost(`/api/branch/loans/${encodeURIComponent(id)}/cancel`, { reason }))?.data,

  /** Releases the funds. Reuse the same key for retries of one release. */
  disburse: async (
    id: string,
    input: { method: string; referenceNumber?: string; destinationAccount?: string; disbursementDate: string; notes?: string },
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; loan: LoanDetailView; receipt: ReceiptDocument }> =>
    (await jsonPost(`/api/branch/loans/${encodeURIComponent(id)}/disburse`, input, idempotencyKey))?.data,

  assess: async (id: string, data?: Record<string, any>): Promise<LoanAssessment> => {
    const payload = await jsonPost(`/api/branch/loans/${encodeURIComponent(id)}/assessment`, data || {});
    return payload?.data || {};
  },
};

export const collectionsService = {
  today: async (): Promise<TodayCollections> => {
    const payload = await branchRequest('/api/branch/collections/today');
    return payload?.data as TodayCollections;
  },


  overdue: async (): Promise<CollectionsOverview> => (await branchRequest('/api/branch/collections/overdue'))?.data,

  /** Marks overdue installments and charges penalties for this branch; safe to run again. */
  runOverdueCheck: async (): Promise<{ loansChecked: number; penaltiesCharged: number; amountCharged: string; loansCharged: string[] }> =>
    (await jsonPost('/api/branch/collections/run-overdue-check', {}))?.data,
};

export const paymentsService = {
  payoff: async (loanId: string): Promise<PayoffQuote> => (await branchRequest(`/api/branch/loans/${encodeURIComponent(loanId)}/payoff`))?.data,

  forLoan: async (loanId: string): Promise<PaymentView[]> => (await branchRequest(`/api/branch/loans/${encodeURIComponent(loanId)}/payments`))?.data || [],

  /** Posts a payment. Reuse the key when retrying the same payment. */
  post: async (
    loanId: string,
    input: { amount: string; method: string; referenceNumber?: string; paymentDate: string; notes?: string },
    idempotencyKey: string,
  ): Promise<PaymentResult> => (await jsonPost(`/api/branch/loans/${encodeURIComponent(loanId)}/payments`, input, idempotencyKey))?.data,

  receipt: async (paymentId: string): Promise<ReceiptDocument> => (await branchRequest(`/api/branch/payments/${encodeURIComponent(paymentId)}/receipt`))?.data,

  reverse: async (paymentId: string, reason: string): Promise<PaymentResult> => (await jsonPost(`/api/branch/payments/${encodeURIComponent(paymentId)}/reverse`, { reason }))?.data,

  proofs: async (status?: string): Promise<{ proofs: (ProofView & { fileUrl: string | null })[]; counts: Record<string, number> }> =>
    (await branchRequest(`/api/branch/payment-proofs${status ? `?status=${encodeURIComponent(status)}` : ''}`))?.data,

  claimProof: async (id: string): Promise<ProofView> => (await jsonPost(`/api/branch/payment-proofs/${encodeURIComponent(id)}/claim`, {}))?.data,

  verifyProof: async (id: string, amount?: string): Promise<PaymentResult> =>
    (await jsonPost(`/api/branch/payment-proofs/${encodeURIComponent(id)}/verify`, amount ? { amount } : {}))?.data,

  rejectProof: async (id: string, reason: string): Promise<ProofView> => (await jsonPost(`/api/branch/payment-proofs/${encodeURIComponent(id)}/reject`, { reason }))?.data,
};

export type PayoffQuote = Awaited<ReturnType<typeof import('../../lending/repayment').payoffQuote>>;
export type CollectionsOverview = Awaited<ReturnType<typeof import('../../lending/repayment').collectionsOverview>>;
export type PaymentResult = { replayed: boolean; payment: PaymentView; receipt: ReceiptDocument; loan: LoanDetailView };

export type SavingsAccountView = import('../../savings/service').SavingsAccountView;
export type SavingsStatement = Awaited<ReturnType<typeof import('../../savings/service').statement>>;
export type SavingsTxnResult = Awaited<ReturnType<typeof import('../../savings/service').transactionResult>>;
export type WithdrawalRequestView = ReturnType<typeof import('../../savings/service').requestView>;
export type SavingsReconciliation = Awaited<ReturnType<typeof import('../../savings/service').reconcileSavings>>;
export type SavingsCounterInput = { amount: string; method: string; referenceNumber?: string; destinationAccount?: string; notes?: string };

const enc = encodeURIComponent;

export const savingsService = {
  list: async (filters?: { status?: string; search?: string }): Promise<SavingsAccountView[]> =>
    (await branchRequest(`/api/branch/savings${toQuery(filters) ? `?${toQuery(filters)}` : ''}`))?.data || [],

  get: async (id: string): Promise<SavingsAccountView> => (await branchRequest(`/api/branch/savings/${enc(id)}`))?.data,

  products: async (): Promise<(SavingsProductDto & { id: string })[]> => (await branchRequest('/api/branch/savings/products'))?.data || [],

  statement: async (id: string, range?: { from?: string; to?: string }): Promise<SavingsStatement> =>
    (await branchRequest(`/api/branch/savings/${enc(id)}/statement${toQuery(range) ? `?${toQuery(range)}` : ''}`))?.data,

  /** Opens an account for a KYC-verified member. Reuse the key when retrying. */
  open: async (
    input: { memberId: string; productId: string; openingDeposit: string; method: string; referenceNumber?: string },
    idempotencyKey: string,
  ): Promise<SavingsAccountView> => (await jsonPost('/api/branch/savings/open', input, idempotencyKey))?.data,

  /** Reuse the key when retrying the same deposit. */
  deposit: async (id: string, input: SavingsCounterInput, idempotencyKey: string): Promise<SavingsTxnResult> =>
    (await jsonPost(`/api/branch/savings/${enc(id)}/deposit`, input, idempotencyKey))?.data,

  /** Reuse the key when retrying the same withdrawal. */
  withdraw: async (id: string, input: SavingsCounterInput, idempotencyKey: string): Promise<SavingsTxnResult> =>
    (await jsonPost(`/api/branch/savings/${enc(id)}/withdraw`, input, idempotencyKey))?.data,

  close: async (id: string, input: { reason: string; method: string; referenceNumber?: string; destinationAccount?: string }, idempotencyKey: string): Promise<SavingsAccountView> =>
    (await jsonPost(`/api/branch/savings/${enc(id)}/close`, { ...input, amount: '0' }, idempotencyKey))?.data,

  changeStatus: async (id: string, action: 'FREEZE' | 'UNFREEZE' | 'REACTIVATE', reason: string): Promise<SavingsAccountView> =>
    (await jsonPost(`/api/branch/savings/${enc(id)}/status`, { action, reason }))?.data,

  requests: async (status = 'PENDING'): Promise<WithdrawalRequestView[]> =>
    (await branchRequest(`/api/branch/savings/withdrawal-requests?status=${enc(status)}`))?.data || [],

  decideRequest: async (id: string, input: { decision: 'APPROVE' | 'REJECT'; reason?: string; referenceNumber?: string }): Promise<WithdrawalRequestView> =>
    (await jsonPost(`/api/branch/savings/withdrawal-requests/${enc(id)}/decision`, input))?.data,

  reconcile: async (): Promise<SavingsReconciliation> => (await branchRequest('/api/branch/savings/reconcile'))?.data,

  runInterest: async (): Promise<{ date: string; accountsChecked: number; interestPostings: number; interestTotal: string; madeDormant: number }> =>
    (await jsonPost('/api/branch/savings/run-interest', {}))?.data,
};

export type GroupSummary = Awaited<ReturnType<typeof import('../../groups/service').listGroups>>[number];
export type GroupDetailView = import('../../groups/service').GroupDetailView;
export type GroupFundView = Awaited<ReturnType<typeof import('../../groups/service').fundView>>;
export type GroupMeetingView = Awaited<ReturnType<typeof import('../../groups/service').groupMeetings>>[number];
export type PendingGroupLoan = Awaited<ReturnType<typeof import('../../groups/service').pendingGroupLoans>>[number];
export type GroupCollectionView = Awaited<ReturnType<typeof import('../../groups/service').collectionView>>;
export type GroupCoverView = ReturnType<typeof import('../../groups/service').coverView>;
export type GroupForm = { groupName: string; centerName: string; meetingDay: string; meetingTime: string; meetingFrequency: string; meetingLocation: string; loanOfficerId: string; arrearsThresholdDays: string };

export const groupsService = {
  list: async (filters?: { status?: string; search?: string }): Promise<GroupSummary[]> =>
    (await branchRequest(`/api/branch/groups${toQuery(filters) ? `?${toQuery(filters)}` : ''}`))?.data || [],
  get: async (id: string): Promise<GroupDetailView> => (await branchRequest(`/api/branch/groups/${enc(id)}`))?.data,
  officers: async (): Promise<{ id: string; name: string; role: string; title: string }[]> => (await branchRequest('/api/branch/groups/officers'))?.data || [],
  create: async (form: GroupForm): Promise<GroupDetailView> => (await jsonPost('/api/branch/groups', form))?.data,
  update: async (id: string, form: GroupForm): Promise<GroupDetailView> => (await jsonPost(`/api/branch/groups/${enc(id)}`, form))?.data,
  changeStatus: async (id: string, action: 'ACTIVATE' | 'SUSPEND' | 'REINSTATE' | 'DISSOLVE', reason: string): Promise<GroupDetailView> =>
    (await jsonPost(`/api/branch/groups/${enc(id)}/status`, { action, reason }))?.data,
  addMember: async (id: string, borrowerId: string, role: string): Promise<GroupDetailView> => (await jsonPost(`/api/branch/groups/${enc(id)}/members`, { borrowerId, role }))?.data,
  removeMember: async (id: string, borrowerId: string, reason: string): Promise<GroupDetailView> =>
    (await jsonPost(`/api/branch/groups/${enc(id)}/members/${enc(borrowerId)}/remove`, { reason }))?.data,
  setRole: async (id: string, borrowerId: string, role: string): Promise<GroupDetailView> => (await jsonPost(`/api/branch/groups/${enc(id)}/members/${enc(borrowerId)}/role`, { role }))?.data,
  pendingLoans: async (id: string): Promise<PendingGroupLoan[]> => (await branchRequest(`/api/branch/groups/${enc(id)}/loans`))?.data || [],
  recordConsent: async (loanId: string, borrowerId: string, decision: 'CONSENT' | 'DECLINE', note?: string): Promise<PendingGroupLoan[]> =>
    (await jsonPost(`/api/branch/loans/${enc(loanId)}/group-consent`, { borrowerId, decision, note }))?.data || [],
  meetings: async (id: string): Promise<GroupMeetingView[]> => (await branchRequest(`/api/branch/groups/${enc(id)}/meetings`))?.data || [],
  recordMeeting: async (id: string, input: { meetingDate: string; location?: string; notes?: string; attendance: { borrowerId: string; status: string }[] }): Promise<GroupMeetingView[]> =>
    (await jsonPost(`/api/branch/groups/${enc(id)}/meetings`, input))?.data || [],
  fund: async (id: string): Promise<GroupFundView> => (await branchRequest(`/api/branch/groups/${enc(id)}/fund`))?.data,
  /** Posts every line in one transaction. Reuse the key when retrying. */
  collect: async (
    id: string,
    input: { method: string; referenceNumber?: string; lines: { borrowerId: string; loanId?: string | null; loanAmount?: string; fundAmount?: string; coverRepayment?: string }[] },
    idempotencyKey: string,
  ): Promise<GroupCollectionView> => (await jsonPost(`/api/branch/groups/${enc(id)}/collections`, input, idempotencyKey))?.data,
  cover: async (id: string, input: { loanId: string; amount?: string; reason: string }, idempotencyKey: string): Promise<GroupCoverView> =>
    (await jsonPost(`/api/branch/groups/${enc(id)}/covers`, input, idempotencyKey))?.data,
  refund: async (id: string, input: { amount: string; method: string; referenceNumber?: string; reason: string }, idempotencyKey: string): Promise<GroupFundView> =>
    (await jsonPost(`/api/branch/groups/${enc(id)}/fund-refunds`, input, idempotencyKey))?.data,
};

export const transactionsService = {
  list: async (filters?: QueryFilters): Promise<FinancialTransactionRow[]> => {
    const qs = toQuery(filters);
    const payload = await branchRequest(`/api/branch/transactions${qs ? `?${qs}` : ''}`);
    return payload?.data || [];
  },
};

export const documentsService = {
  list: async (filters?: QueryFilters): Promise<BranchDocument[]> => {
    const qs = toQuery(filters);
    const payload = await branchRequest(`/api/branch/documents${qs ? `?${qs}` : ''}`);
    return payload?.data || [];
  },

  create: async (data: Record<string, any>) =>
    branchRequest('/api/branch/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: async (id: string, data: Record<string, any>) =>
    branchRequest(`/api/branch/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

export const notificationsService = {
  list: async (): Promise<{ notifications: BranchNotification[]; unreadCount: number }> => {
    const payload = await branchRequest('/api/branch/notifications');
    return { notifications: payload?.data || [], unreadCount: payload?.unreadCount || 0 };
  },

  markRead: async (id: string) =>
    branchRequest(`/api/branch/notifications/${id}/read`, { method: 'POST' }),

  markAllRead: async () =>
    branchRequest('/api/branch/notifications/read-all', { method: 'POST' }),
};

export const reportsService = {
  get: async (type: string, from?: string, to?: string): Promise<ReportRow> => {
    const qs = new URLSearchParams({ type });
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const payload = await branchRequest(`/api/branch/reports?${qs.toString()}`);
    return payload?.data as ReportRow;
  },
};

export const activityService = {
  log: async (filters?: QueryFilters) => {
    const qs = toQuery(filters);
    const payload = await branchRequest(`/api/branch/activity-log${qs ? `?${qs}` : ''}`);
    return payload?.data || [];
  },
};

export type { BranchPayment, ClientDetail };
// ---------------------------------------------------------------------------
// Online payments (src/payments/service.ts)
// ---------------------------------------------------------------------------

export type OnlineReview = Awaited<ReturnType<typeof import('../../payments/service').needsReview>>;
export type OnlineDailyReport = Awaited<ReturnType<typeof import('../../payments/service').dailyReport>>;

export const onlinePaymentsService = {
  /** Problem payments and payout accounts waiting for verification, in your branch. */
  review: async (): Promise<OnlineReview> => (await branchRequest('/api/branch/payments/review'))?.data,

  /** One day's online payments against the ledger and the provider. */
  dailyReport: async (date: string): Promise<OnlineDailyReport> => (await branchRequest(`/api/branch/payments/daily-report?date=${enc(date)}`))?.data,

  decidePayoutAccount: async (id: string, decision: 'VERIFY' | 'REJECT', reason: string) =>
    (await jsonPost(`/api/branch/payments/payout-accounts/${enc(id)}/decision`, { decision, reason }))?.data,

  resolveDeposit: async (id: string, action: 'CREDIT_PAID' | 'DISMISS', note: string) => (await jsonPost(`/api/branch/payments/deposits/${enc(id)}/resolve`, { action, note }))?.data,

  resolvePayout: async (id: string, action: 'RECHECK' | 'RETRY' | 'REFUND', note: string) => (await jsonPost(`/api/branch/payments/payouts/${enc(id)}/resolve`, { action, note }))?.data,

  /** Asks the provider now about payments whose confirmation has not arrived. */
  checkNow: async (): Promise<{ depositsChecked: number; payoutsChecked: number; sentAgain: number; toReview: number; errors: string[] }> =>
    (await jsonPost('/api/branch/payments/check-now', {}))?.data,
};
