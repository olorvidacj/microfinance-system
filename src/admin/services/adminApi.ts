import type { KycDecisionBody, KycDossierView } from '../../components/kyc/KycReviewPanel';
import type { KycQueueParams, KycQueueResultView, KycQueueRow } from '../../components/kyc/KycQueueView';
import type { ProductDto, SavingsProductDto } from '../../../shared/lending';
import { authFetch } from '../../context/AuthContext';
import type {
  AdminBranch,
  AdminClient,
  AdminLoan,
  AdminNotification,
  AdminSavingsAccount,
  AdminTransaction,
  AdminUser,
  AuditLog,
  LendingGroup,
} from '../data/mockData';
import type { PortfolioSummary } from '../../reports/portfolio';

export interface AdminStats {
  totalUsers: number;
  activeClients: number;
  pendingKyc: number;
  totalLoanApplications: number;
  approvedLoans: number;
  approvalRate: number;
  /** Decimal pesos (src/reports/portfolio.ts). */
  totalSavingsLiquidity: string;
  transactionsRecorded: number;
  activeGroups: number;
  totalClients: number;
  verifiedKyc: number;
  pendingKycCount: number;
  rejectedKyc: number;
  underReviewKyc: number;
  correctionKyc: number;
}

export interface AdminOverview {
  /** The figures shared with the branch app and the member portal. */
  portfolio: PortfolioSummary;
  stats: AdminStats;
  loanTrend: { month: string; applications: number; approved: number }[];
  transactionChart: { month: string; deposits: number; withdrawals: number; loanPayments: number }[];
  registrationData: { month: string; registrations: number }[];
  recentLoans: AdminLoan[];
  recentTxns: AdminTransaction[];
  notifications: AdminNotification[];
}

export interface ReportsData {
  charts: {
    [key: string]: any;
    client: { month: string; value: number }[];
    kyc: { name: string; value: number; color: string }[];
    loan: { month: string; value: number }[];
    repayment: { month: string; value: number }[];
    savings: { month: string; value: number }[];
    transactions: { month: string; value: number }[];
    groups: { month: string; value: number }[];
    branches: { name: string; value: number; color: string }[];
  };
  cards: Record<string, { title: string; value: string; highlight: string }[]>;
  tableRows: Record<string, { label: string; value: string }[]>;
  /** The selected branch, or every branch (null), exact (src/reports/portfolio.ts). */
  portfolio: PortfolioSummary;
  branchId: string | null;
  branches: { id: string; name: string; portfolio: PortfolioSummary }[];
  /** Trial balance of every posted journal line. */
  ledger: { debits: string; credits: string; difference: string; balanced: boolean };
}

export interface SavingsLedgerEntry {
  id: string;
  ref: string;
  type: string;
  amount: number;
  balance: number;
  date: string;
  by: string;
}

export interface ClientDetail {
  client: AdminClient;
  loans: AdminLoan[];
  transactions: AdminTransaction[];
  savings: {
    id: string;
    accountNumber: string;
    balance: number;
    interestRate: number;
    inflows: number;
    outflows: number;
    ledger: SavingsLedgerEntry[];
  }[];
}

export interface SavingsDetail {
  account: AdminSavingsAccount;
  inflows: number;
  outflows: number;
  ledger: SavingsLedgerEntry[];
}

export interface GroupDetail {
  members: { id: string; name: string; phone: string; role: string; loanAmount: number; balance: number; coverOwed: number; status: string }[];
  loans: { id: string; loanId: string; clientName: string; product: string; amount: number; paid: number; balance: number; issued: string; status: string }[];
  collections: { id: string; date: string; collected: number; principal: number; interest: number; by: string; method: string }[];
  fund: Awaited<ReturnType<typeof import('../../groups/service').fundView>>;
  meetings: { date: string; present: number; total: number; recordedBy: string }[];
  block: { blocked: boolean; reasons: string[] };
  statusReason: string | null;
}

export interface LoanDetail {
  loan: AdminLoan;
  payments: {
    id: string;
    receiptNumber: string;
    loanNumber: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    principalPortion: number;
    interestPortion: number;
    penaltyPortion: number;
    collectedBy: string;
  }[];
  auditHistory: {
    date: string;
    action: string;
    details: string;
    by: string;
    status: string;
  }[];
}

/**
 * Admin requests MUST carry the caller's bearer token.
 *
 * Every /api/admin read is gated by requirePermission(...), so an unauthenticated
 * request is rejected - which is why the console must not fall back to a plain
 * fetch. It also means a silent 401/403 here is a real authorization failure and
 * must surface as an error rather than an empty dashboard.
 */
export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Per-field messages from a validation refusal. */
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    let detail = '';
    let fields: Record<string, string> = {};
    try {
      const body = await res.json();
      detail = body?.error || body?.message || '';
      fields = body?.fields || body?.errors || {};
    } catch {}
    if (res.status === 401) throw new AdminApiError('Your session has expired. Please sign in again.', 401);
    if (res.status === 403) throw new AdminApiError(detail || 'You do not have permission to perform this action.', 403);
    throw new AdminApiError(detail || `Admin data request failed (${res.status})`, res.status, fields);
  }
  return res.json() as Promise<T>;
}

async function get<T>(url: string): Promise<T> {
  return request<T>(url, { method: 'GET' });
}

async function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

async function put<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: 'PUT', body: JSON.stringify(body) });
}

/** Adds the console's branch filter (null: every branch); the server checks it. */
function withBranch(url: string, branchId: string | null | undefined): string {
  if (!branchId) return url;
  return `${url}${url.includes('?') ? '&' : '?'}branchId=${encodeURIComponent(branchId)}`;
}

export interface AdminUserRecord {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: string;
  staffRole?: string | null;
  staffId?: string | null;
  borrowerId?: string | null;
  avatar?: string | null;
  isActive?: boolean | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  /** Staff: the branch they work in ('all' for head office). Members: their branch. */
  branchId?: string | null;
  branch?: string;
}

export const adminApi = {
  users: (branchId?: string | null): Promise<AdminUser[]> =>
    get<{ success: boolean; users?: AdminUserRecord[] }>(withBranch('/api/admin/users', branchId)).then(
      (r) =>
        (r.users || []).map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone || '',
          role: (['Administrator', 'Manager', 'Loan Officer', 'Teller', 'Client Services Staff', 'Bookkeeper', 'Auditor'] as const).includes((u.staffRole || '') as any)
            ? (u.staffRole as AdminUser['role'])
            : ((u.staffRole || (u.role === 'STAFF' ? 'Administrator' : 'Client Services Staff')) as AdminUser['role']),
          status: u.isActive === false ? 'Inactive' : 'Active',
          dateRegistered: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '',
          avatar: u.avatar || '',
          branch: u.branch || '',
          branchId: u.branchId ?? null,
          accountRole: u.role === 'CLIENT' ? 'CLIENT' : 'STAFF',
        })),
    ),

  /**
   * Persists a new user. `role` is the coarse STAFF/CLIENT choice and `staffRole`
   * is the specific staff position; the server requires a password because it
   * provisions the login itself.
   */
  createUser: (input: {
    email: string;
    password: string;
    fullName: string;
    role: 'STAFF' | 'CLIENT';
    staffRole?: string;
    phone?: string;
    borrowerId?: string;
    staffId?: string;
    /** Required for staff: the branch they work in, or 'all' for head office. */
    branchId?: string;
  }): Promise<AdminUserRecord> =>
    post<{ success: boolean; user: AdminUserRecord }>('/api/admin/users', input).then((r) => r.user),

  updateUser: (
    id: string,
    patch: { fullName?: string; staffRole?: string; role?: string; staffId?: string | null; isActive?: boolean; phone?: string; branchId?: string }
  ): Promise<{ success: boolean; message?: string }> => put<{ success: boolean; message?: string }>(`/api/admin/users/${id}`, patch),

  /** The KYC documents members must provide (kyc_required_documents). */
  kycRequiredDocuments: (): Promise<{ id: string; documentType: string; documentName: string; description: string | null; isActive: boolean }[]> =>
    get<{ documents: { id: string; documentType: string; documentName: string; description: string | null; isActive: boolean }[] }>('/api/admin/kyc/required-documents').then((r) => r.documents),

  /**
   * Triggers a real password reset link. The endpoint is deliberately
   * non-enumerating, so it returns the same message whether or not the account
   * exists; the console must not claim delivery on its own.
   */
  sendPasswordReset: (email: string): Promise<{ success: boolean; message?: string }> =>
    post<{ success: boolean; message?: string }>('/api/auth/forgot-password', { email }),

  clients: (branchId?: string | null): Promise<AdminClient[]> => get<{ clients: AdminClient[] }>(withBranch('/api/admin/clients', branchId)).then((r) => r.clients || []),
  loans: (branchId?: string | null): Promise<AdminLoan[]> => get<{ loans: AdminLoan[] }>(withBranch('/api/admin/loans', branchId)).then((r) => r.loans || []),
  savings: (branchId?: string | null): Promise<AdminSavingsAccount[]> => get<{ accounts: AdminSavingsAccount[] }>(withBranch('/api/admin/savings', branchId)).then((r) => r.accounts || []),
  transactions: (branchId?: string | null): Promise<AdminTransaction[]> =>
    get<{ transactions: AdminTransaction[] }>(withBranch('/api/admin/transactions', branchId)).then((r) => r.transactions || []),
  groups: (branchId?: string | null): Promise<LendingGroup[]> => get<{ groups: LendingGroup[] }>(withBranch('/api/admin/groups', branchId)).then((r) => r.groups || []),
  /** Head-office KYC queue: every branch, or one. */
  kycQueue: (params: KycQueueParams & { branchId?: string | null } = {}): Promise<{ data: KycQueueRow[]; counts: KycQueueResultView['counts'] }> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.submittedFrom) qs.set('submittedFrom', params.submittedFrom);
    if (params.submittedTo) qs.set('submittedTo', params.submittedTo);
    return get<{ requests: KycQueueRow[]; counts: KycQueueResultView['counts'] }>(`/api/admin/kyc-requests${qs.toString() ? `?${qs}` : ''}`).then((r) => ({ data: r.requests, counts: r.counts }));
  },
  kyc: {
    get: (borrowerId: string): Promise<KycDossierView> => get<{ data: KycDossierView }>(`/api/admin/kyc/${encodeURIComponent(borrowerId)}`).then((r) => r.data),
    claim: (borrowerId: string) => post(`/api/admin/kyc/${encodeURIComponent(borrowerId)}/claim`, {}),
    release: (borrowerId: string) => post(`/api/admin/kyc/${encodeURIComponent(borrowerId)}/release`, {}),
    decide: (borrowerId: string, body: KycDecisionBody, idempotencyKey: string) =>
      request(`/api/admin/kyc/${encodeURIComponent(borrowerId)}/decision`, { method: 'POST', body: JSON.stringify(body), headers: { 'Idempotency-Key': idempotencyKey } }),
  },
  notifications: (branchId?: string | null): Promise<AdminNotification[]> =>
    get<{ notifications: AdminNotification[] }>(withBranch('/api/admin/notifications', branchId)).then((r) => r.notifications || []),
  auditLogs: (branchId?: string | null): Promise<AuditLog[]> => get<{ logs: AuditLog[] }>(withBranch('/api/admin/audit-logs', branchId)).then((r) => r.logs || []),
  branches: (): Promise<AdminBranch[]> => get<{ branches: AdminBranch[] }>('/api/admin/branches').then((r) => r.branches || []),
  clientDetail: (id: string): Promise<ClientDetail> => get<{ data: ClientDetail }>(`/api/admin/clients/${id}`).then((r) => r.data),
  loansDetail: (id: string): Promise<LoanDetail> => get<{ data: LoanDetail }>(`/api/admin/loans/${id}`).then((r) => r.data),
  savingsDetail: (id: string): Promise<SavingsDetail> => get<{ data: SavingsDetail }>(`/api/admin/savings/${id}`).then((r) => r.data),
  groupDetail: (id: string): Promise<GroupDetail> => get<{ data: GroupDetail }>(`/api/admin/groups/${id}`).then((r) => r.data),
  overview: (branchId?: string | null): Promise<AdminOverview> => get<{ data: AdminOverview }>(withBranch('/api/admin/overview', branchId)).then((r) => r.data),
  reports: (branchId?: string | null): Promise<ReportsData> => get<ReportsData>(withBranch('/api/admin/reports', branchId)),
  savingsProducts: {
    list: (): Promise<(SavingsProductDto & { id: string })[]> => get<{ data: (SavingsProductDto & { id: string })[] }>('/api/admin/savings-products').then((r) => r.data || []),
    create: (dto: SavingsProductDto): Promise<SavingsProductDto & { id: string }> => post<{ data: SavingsProductDto & { id: string } }>('/api/admin/savings-products', dto).then((r) => r.data),
    update: (id: string, dto: SavingsProductDto): Promise<SavingsProductDto & { id: string }> =>
      put<{ data: SavingsProductDto & { id: string } }>(`/api/admin/savings-products/${encodeURIComponent(id)}`, dto).then((r) => r.data),
  },
  loanProducts: {
    list: (): Promise<ProductDto[]> => get<{ data: ProductDto[] }>('/api/admin/loan-products').then((r) => r.data || []),
    create: (dto: ProductDto): Promise<ProductDto> => post<{ data: ProductDto }>('/api/admin/loan-products', dto).then((r) => r.data),
    update: (id: string, dto: ProductDto): Promise<ProductDto> => put<{ data: ProductDto }>(`/api/admin/loan-products/${encodeURIComponent(id)}`, dto).then((r) => r.data),
  },
};