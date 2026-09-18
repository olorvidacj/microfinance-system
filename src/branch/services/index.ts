import { branchRequest } from './api';
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
  LoanProduct,
  PerformanceData,
  ReportRow,
  SavingsTransactionRow,
  SolidarityGroup,
  TodayCollections,
  StaffBranchAssignmentResponse,
} from '../types';

const unwrap = (p: any) => p?.data;
const unwrapReceipt = (p: any) => p?.data?.receipt;

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
  list: async (filters?: Record<string, string>): Promise<ClientSummary[]> => {
    const qs = new URLSearchParams(filters || {}).toString();
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
  queue: async (): Promise<(ClientDetail & { submittedDocuments?: number })[]> => {
    const payload = await branchRequest('/api/branch/kyc-queue');
    return payload?.data || [];
  },

  review: async (clientId: string, decision: string, notes?: string) =>
    branchRequest(`/api/branch/kyc/${clientId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, notes }),
    }),
};

export const loansService = {
  products: async (): Promise<LoanProduct[]> => {
    const payload = await branchRequest('/api/branch/loan-products');
    return payload?.data || [];
  },

  applications: async (filters?: Record<string, string>): Promise<BranchLoan[]> => {
    const qs = new URLSearchParams(filters || {}).toString();
    const payload = await branchRequest(`/api/branch/loan-applications${qs ? `?${qs}` : ''}`);
    return payload?.data || [];
  },

  createApplication: async (data: Record<string, any>) =>
    branchRequest('/api/branch/loan-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  list: async (filters?: Record<string, string>): Promise<BranchLoan[]> => {
    const qs = new URLSearchParams(filters || {}).toString();
    const payload = await branchRequest(`/api/branch/loans${qs ? `?${qs}` : ''}`);
    return payload?.data || [];
  },

  get: async (id: string): Promise<BranchLoanDetail> => {
    const payload = await branchRequest(`/api/branch/loans/${id}`);
    return payload?.data as BranchLoanDetail;
  },

  action: async (id: string, action: string, payload?: { notes?: string; reason?: string }) =>
    branchRequest(`/api/branch/loans/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    }),

  assess: async (id: string, data?: Record<string, any>): Promise<LoanAssessment> => {
    const payload = await branchRequest(`/api/branch/loans/${id}/assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    return payload?.data || {};
  },
};

export const collectionsService = {
  today: async (): Promise<TodayCollections> => {
    const payload = await branchRequest('/api/branch/collections/today');
    return payload?.data as TodayCollections;
  },

  recordPayment: async (data: Record<string, any>): Promise<{ receipt: any }> =>
    await branchRequest('/api/branch/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, unwrapReceipt),
};

export const savingsService = {
  list: async (): Promise<BranchSavingsAccount[]> => {
    const payload = await branchRequest('/api/branch/savings');
    return payload?.data || [];
  },

  transactions: async (accountId: string): Promise<SavingsTransactionRow[]> => {
    const payload = await branchRequest(`/api/branch/savings/${accountId}/transactions`);
    return payload?.data || [];
  },

  deposit: async (data: Record<string, any>) =>
    branchRequest('/api/branch/savings/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  withdrawal: async (data: Record<string, any>) =>
    branchRequest('/api/branch/savings/withdrawal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

export const groupsService = {
  list: async (): Promise<SolidarityGroup[]> => {
    const payload = await branchRequest('/api/branch/groups');
    return payload?.data || [];
  },

  get: async (id: string) => {
    const payload = await branchRequest(`/api/branch/groups/${id}`);
    return payload?.data;
  },

  create: async (data: Record<string, any>) =>
    branchRequest('/api/branch/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  addMember: async (id: string, data: Record<string, any>) =>
    branchRequest(`/api/branch/groups/${id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  removeMember: async (id: string, borrowerId: string) =>
    branchRequest(`/api/branch/groups/${id}/members/${borrowerId}`, { method: 'DELETE' }),
};

export const transactionsService = {
  list: async (filters?: Record<string, string>): Promise<FinancialTransactionRow[]> => {
    const qs = new URLSearchParams(filters || {}).toString();
    const payload = await branchRequest(`/api/branch/transactions${qs ? `?${qs}` : ''}`);
    return payload?.data || [];
  },

  record: async (data: Record<string, any>) =>
    branchRequest('/api/branch/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

export const documentsService = {
  list: async (filters?: Record<string, string>): Promise<BranchDocument[]> => {
    const qs = new URLSearchParams(filters || {}).toString();
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
  log: async (filters?: Record<string, string>) => {
    const qs = new URLSearchParams(filters || {}).toString();
    const payload = await branchRequest(`/api/branch/activity-log${qs ? `?${qs}` : ''}`);
    return payload?.data || [];
  },
};

export type { BranchPayment, ClientDetail };