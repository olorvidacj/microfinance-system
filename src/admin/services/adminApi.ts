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
  KycRequest,
  LendingGroup,
} from '../data/mockData';

export interface AdminStats {
  totalUsers: number;
  activeClients: number;
  pendingKyc: number;
  totalLoanApplications: number;
  approvedLoans: number;
  approvalRate: number;
  totalSavingsLiquidity: number;
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
  group: LendingGroup;
  members: {
    id: string;
    name: string;
    phone: string;
    role: string;
    loanAmount: number;
    balance: number;
    status: string;
  }[];
  loans: {
    id: string;
    loanId: string;
    clientName: string;
    product: string;
    amount: number;
    paid: number;
    balance: number;
    issued: string;
    status: string;
  }[];
  collections: {
    id: string;
    date: string;
    collected: number;
    principal: number;
    interest: number;
    by: string;
    method: string;
  }[];
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
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error || body?.message || '';
    } catch {}
    if (res.status === 401) throw new Error('Your session has expired. Please sign in again.');
    if (res.status === 403) throw new Error(detail || 'You do not have permission to perform this action.');
    throw new Error(detail || `Admin data request failed (${res.status})`);
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
}

export const adminApi = {
  users: (): Promise<AdminUser[]> =>
    get<{ success: boolean; users?: AdminUserRecord[] }>('/api/admin/users').then(
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
          branch: '',
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
  }): Promise<AdminUserRecord> =>
    post<{ success: boolean; user: AdminUserRecord }>('/api/admin/users', input).then((r) => r.user),

  updateUser: (
    id: string,
    patch: { fullName?: string; staffRole?: string; role?: string; staffId?: string | null; isActive?: boolean; phone?: string }
  ): Promise<{ success: boolean; message?: string }> => put<{ success: boolean; message?: string }>(`/api/admin/users/${id}`, patch),

  systemSettings: (): Promise<Record<string, any>> => get<{ success: boolean; settings: Record<string, any> }>('/api/admin/system-settings').then((r) => r.settings),

  saveSystemSettings: (patch: Record<string, unknown>): Promise<Record<string, any>> =>
    put<{ success: boolean; settings: Record<string, any> }>('/api/admin/system-settings', patch).then((r) => r.settings),

  /**
   * Triggers a real password reset link. The endpoint is deliberately
   * non-enumerating, so it returns the same message whether or not the account
   * exists; the console must not claim delivery on its own.
   */
  sendPasswordReset: (email: string): Promise<{ success: boolean; message?: string }> =>
    post<{ success: boolean; message?: string }>('/api/auth/forgot-password', { email }),

  approveSensitive: (input: {
    operationType: string;
    targetId: string;
    amount?: number;
    justification?: string;
  }): Promise<{ success: boolean }> => post<{ success: boolean }>('/api/admin/approve-sensitive', input),
  clients: (): Promise<AdminClient[]> => get<{ clients: AdminClient[] }>('/api/admin/clients').then((r) => r.clients || []),
  loans: (): Promise<AdminLoan[]> => get<{ loans: AdminLoan[] }>('/api/admin/loans').then((r) => r.loans || []),
  savings: (): Promise<AdminSavingsAccount[]> => get<{ accounts: AdminSavingsAccount[] }>('/api/admin/savings').then((r) => r.accounts || []),
  transactions: (): Promise<AdminTransaction[]> => get<{ transactions: AdminTransaction[] }>('/api/admin/transactions').then((r) => r.transactions || []),
  groups: (): Promise<LendingGroup[]> => get<{ groups: LendingGroup[] }>('/api/admin/groups').then((r) => r.groups || []),
  kycRequests: (): Promise<KycRequest[]> => get<{ requests: KycRequest[] }>('/api/admin/kyc-requests').then((r) => r.requests || []),
  notifications: (): Promise<AdminNotification[]> => get<{ notifications: AdminNotification[] }>('/api/admin/notifications').then((r) => r.notifications || []),
  auditLogs: (): Promise<AuditLog[]> => get<{ logs: AuditLog[] }>('/api/admin/audit-logs').then((r) => r.logs || []),
  branches: (): Promise<AdminBranch[]> => get<{ branches: AdminBranch[] }>('/api/admin/branches').then((r) => r.branches || []),
  clientDetail: (id: string): Promise<ClientDetail> => get<{ data: ClientDetail }>(`/api/admin/clients/${id}`).then((r) => r.data),
  loansDetail: (id: string): Promise<LoanDetail> => get<{ data: LoanDetail }>(`/api/admin/loans/${id}`).then((r) => r.data),
  savingsDetail: (id: string): Promise<SavingsDetail> => get<{ data: SavingsDetail }>(`/api/admin/savings/${id}`).then((r) => r.data),
  groupDetail: (id: string): Promise<GroupDetail> => get<{ data: GroupDetail }>(`/api/admin/groups/${id}`).then((r) => r.data),
  overview: (): Promise<AdminOverview> => get<{ data: AdminOverview }>('/api/admin/overview').then((r) => r.data),
  reports: (): Promise<ReportsData> =>
    get<{ charts: ReportsData['charts']; cards: ReportsData['cards']; tableRows: ReportsData['tableRows'] }>('/api/admin/reports').then((r) => ({
      charts: r.charts || { client: [], kyc: [], loan: [], repayment: [], savings: [], transactions: [], groups: [], branches: [] },
      cards: r.cards || {},
      tableRows: r.tableRows || {},
    })),
};