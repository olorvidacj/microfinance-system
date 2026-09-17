import { branchRequest, withMockFallback } from './api';
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
import {
  mockBranchContext,
  mockClients,
  mockClientsFiltered,
  mockDashboard,
  mockDocuments,
  mockGroups,
  mockKycQueue,
  mockLoanApplications,
  mockLoanDetail,
  mockLoanProducts,
  mockLoans,
  mockGroupDetail,
  mockNotifications,
  mockPerformance,
  mockReport,
  mockSavingsAccounts,
  mockSavingsTransactions,
  mockTodayCollections,
  mockTransactions,
  mockAuditLogs,
} from './mock';

const unwrap = (p: any) => p?.data;
const unwrapReceipt = (p: any) => p?.data?.receipt;

export const branchService = {
  context: async (): Promise<BranchContextData> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest('/api/branch/context');
        return {
          personnel: payload.personnel,
          branch: payload.branch,
          permissions: payload.permissions || [],
          viewAll: !!payload.viewAll,
        };
      },
      async () => mockBranchContext
    ),

  personnel: async (): Promise<{ personnel: BranchPersonnel; branch: any; permissions: string[] }> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest('/api/branch/personnel');
        return { personnel: payload.personnel, branch: payload.branch, permissions: payload.permissions || [] };
      },
      async () => ({ personnel: mockBranchContext.personnel, branch: mockBranchContext.branch, permissions: mockBranchContext.permissions })
    ),

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
  get: async (): Promise<BranchDashboard> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest('/api/branch/dashboard');
        return payload?.data || mockDashboard;
      },
      async () => mockDashboard
    ),

  performance: async (range: string = 'month'): Promise<PerformanceData> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/performance?range=${encodeURIComponent(range)}`);
        return payload?.data || mockPerformance;
      },
      async () => mockPerformance
    ),

  activities: async (limit = 15) =>
    withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/activities?limit=${limit}`);
        return payload?.data || [];
      },
      async () => mockAuditLogs.slice(0, limit)
    ),
};

export const clientsService = {
  list: async (filters?: Record<string, string>): Promise<ClientSummary[]> => {
    const qs = new URLSearchParams(filters || {}).toString();
    return withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/clients${qs ? `?${qs}` : ''}`);
        return payload?.data || [];
      },
      async () => mockClientsFiltered(filters?.search || '') as unknown as ClientSummary[]
    );
  },

  get: async (id: string) =>
    withMockFallback(
      async () => (await branchRequest(`/api/branch/clients/${id}`, undefined, unwrap)) || null,
      async () => {
        const client = mockClients.find((c) => c.id === id) || mockClients[0];
        return {
          client,
          loans: mockLoans.filter((l) => l.borrowerId === client.id),
          documents: mockDocuments.filter((d) => d.clientId === client.id),
          savingsAccounts: mockSavingsAccounts.filter((a) => a.memberId === client.id),
        };
      }
    ),

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
  queue: async (): Promise<(ClientDetail & { submittedDocuments?: number })[]> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest('/api/branch/kyc-queue');
        return payload?.data || [];
      },
      async () => mockKycQueue
    ),

  review: async (clientId: string, decision: string, notes?: string) =>
    branchRequest(`/api/branch/kyc/${clientId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, notes }),
    }),
};

export const loansService = {
  products: async (): Promise<LoanProduct[]> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest('/api/branch/loan-products');
        return payload?.data || [];
      },
      async () => mockLoanProducts
    ),

  applications: async (filters?: Record<string, string>): Promise<BranchLoan[]> => {
    const qs = new URLSearchParams(filters || {}).toString();
    return withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/loan-applications${qs ? `?${qs}` : ''}`);
        return payload?.data || [];
      },
      async () => mockLoanApplications
    );
  },

  createApplication: async (data: Record<string, any>) =>
    branchRequest('/api/branch/loan-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  list: async (filters?: Record<string, string>): Promise<BranchLoan[]> => {
    const qs = new URLSearchParams(filters || {}).toString();
    return withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/loans${qs ? `?${qs}` : ''}`);
        return payload?.data || [];
      },
      async () => mockLoans.filter((l) => !filters?.status || l.status.includes(filters.status))
    );
  },

  get: async (id: string): Promise<BranchLoanDetail> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/loans/${id}`);
        return payload?.data || mockLoanDetail(id);
      },
      async () => mockLoanDetail(id)
    ),

  action: async (id: string, action: string, payload?: { notes?: string; reason?: string }) =>
    branchRequest(`/api/branch/loans/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    }),

  assess: async (id: string, data?: Record<string, any>): Promise<LoanAssessment> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/loans/${id}/assessment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data || {}),
        });
        return payload?.data || {};
      },
      async () => ({
        monthlyIncome: 18000,
        monthlyExpenses: 9500,
        existingObligations: 4000,
        disposableIncome: 4500,
        repaymentCapacityMonthly: 2250,
        debtRatio: 0.35,
        recommendedAmount: 40000,
        estimatedInstallment: 4600,
        riskIndicators: [],
        isEstimate: true,
        note: 'Automated estimate for assessment guidance only.',
        assessedBy: 'Maria Santos',
        assessedAt: new Date().toISOString(),
      })
    ),
};

export const collectionsService = {
  today: async (): Promise<TodayCollections> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest('/api/branch/collections/today');
        return payload?.data || mockTodayCollections;
      },
      async () => mockTodayCollections
    ),

  recordPayment: async (data: Record<string, any>): Promise<{ receipt: any }> =>
    withMockFallback(
      async () => await branchRequest('/api/branch/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }, unwrapReceipt),
      async () => {
        const loan = mockLoans.find((l) => l.id === String(data.loanId)) || mockLoans[0];
        const amount = Number(data.amount) || 0;
        return {
          receipt: {
            id: 'pay-mock',
            receiptNumber: `OR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
            loanId: loan.id,
            loanNumber: loan.loanNumber,
            clientId: loan.borrowerId,
            clientName: loan.borrowerName,
            amount,
            paymentDate: String(data.date || new Date().toISOString().slice(0, 10)),
            paymentMethod: String(data.paymentMethod || 'Cash'),
            transactionReference: String(data.transactionReference || ''),
            processedBy: mockBranchContext.personnel.name,
            principalPortion: Math.round(amount * 0.74 * 100) / 100,
            interestPortion: Math.round(amount * 0.26 * 100) / 100,
            remainingBalance: Math.max(0, loan.remainingBalance - amount),
          },
        };
      }
    ),
};

export const savingsService = {
  list: async (): Promise<BranchSavingsAccount[]> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest('/api/branch/savings');
        return payload?.data || [];
      },
      async () => mockSavingsAccounts
    ),

  transactions: async (accountId: string): Promise<SavingsTransactionRow[]> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/savings/${accountId}/transactions`);
        return payload?.data || [];
      },
      async () => mockSavingsTransactions(accountId)
    ),

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
  list: async (): Promise<SolidarityGroup[]> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest('/api/branch/groups');
        return payload?.data || [];
      },
      async () => mockGroups
    ),

  get: async (id: string) =>
    withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/groups/${id}`);
        return payload?.data || mockGroupDetail(id);
      },
      async () => mockGroupDetail(id)
    ),

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
    return withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/transactions${qs ? `?${qs}` : ''}`);
        return payload?.data || [];
      },
      async () => mockTransactions
    );
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
    return withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/documents${qs ? `?${qs}` : ''}`);
        return payload?.data || [];
      },
      async () => mockDocuments
    );
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
  list: async (): Promise<{ notifications: BranchNotification[]; unreadCount: number }> =>
    withMockFallback(
      async () => {
        const payload = await branchRequest('/api/branch/notifications');
        return { notifications: payload?.data || [], unreadCount: payload?.unreadCount || 0 };
      },
      async () => ({
        notifications: mockNotifications,
        unreadCount: mockNotifications.filter((n) => !n.isRead).length,
      })
    ),

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
    return withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/reports?${qs.toString()}`);
        return payload?.data || mockReport(type);
      },
      async () => mockReport(type)
    );
  },
};

export const activityService = {
  log: async (filters?: Record<string, string>) => {
    const qs = new URLSearchParams(filters || {}).toString();
    return withMockFallback(
      async () => {
        const payload = await branchRequest(`/api/branch/activity-log${qs ? `?${qs}` : ''}`);
        return payload?.data || [];
      },
      async () => mockAuditLogs
    );
  },
};

export type { BranchPayment, ClientDetail };