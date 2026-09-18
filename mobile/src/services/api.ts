import {
  UserSession,
  ClientDashboardData,
  ClientProfile,
  LoanProduct,
  LoanApplication,
  LoanItem,
  InstallmentScheduleItem,
  PaymentItem,
  MobileNotification,
  KycRequiredDocumentItem,
  KycSubmission,
  KycSubmissionPayload,
  KycStatusData,
  KycDocumentItem,
  TransactionType,
  FinancialTransaction,
  SavingsAccount,
  SavingsTransaction,
  PortalDocument,
  ClientGroup,
  FaqItem,
  SupportTicket,
  NotificationPreferences,
  PrivacyPreferences,
  LoginActivityItem,
  PaymentReceipt,
  PaymentMethod,
  InstallmentScheduleItem as InstallmentScheduleItemAlias,
  KycReviewDecision,
  AuditLogEntry,
  BranchContextData,
  BranchKycQueueItem,
  KycSubmission as KycSubmissionAlias,
  BranchContextDataStaffContext,
} from '../types';

import Constants from 'expo-constants';

const BACKEND_PORT = 3000;

function resolveApiBaseUrl(): string {
  // 1. Explicit override (production build / self-hosted API)
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) {
    return override.replace(/\/+$/, '');
  }

  // 2. Web: reuse the page origin (the Express server serves both API & frontend)
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/api`;
  }

  // 3. Native (Expo Go / dev build): resolve the Metro dev-server host and point
  //    at the backend port, which listens on 0.0.0.0 for LAN access from devices.
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    '';
  const host = (hostUri || '').split(':')[0].trim();
  if (host) {
    return `http://${host}:${BACKEND_PORT}/api`;
  }

  // 4. Last-resort fallback
  return `http://localhost:${BACKEND_PORT}/api`;
}

export const API_BASE_URL = resolveApiBaseUrl();

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP Error ${response.status}`);
      }
      return data as T;
    } catch (err: any) {
      console.warn(`[API] Error fetching ${endpoint}:`, err.message);
      if (err instanceof TypeError) {
        throw new Error(`Unable to reach the server (${API_BASE_URL}).\n\nMake sure the backend is running on port ${BACKEND_PORT} and your device is on the same network.`);
      }
      throw err;
    }
  }

  // 1. Authentication
  async login(identifier: string, password: string): Promise<UserSession> {
    const data = await this.request<{ success: boolean; token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    this.setToken(data.token);
    return { token: data.token, user: data.user };
  }

  async register(payload: {
    phone: string;
    password?: string;
    fullName?: string;
    email?: string;
    borrowerNumber?: string;
    dateOfBirth?: string;
    address?: string;
    civilStatus?: string;
    occupation?: string;
    employerOrBusiness?: string;
    monthlyIncome?: number;
  }): Promise<UserSession> {
    const data = await this.request<{ success: boolean; token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(data.token);
    return { token: data.token, user: data.user };
  }

  async sendRegistrationOtp(phone: string, email?: string): Promise<{
    success: boolean;
    message: string;
    email?: string;
    formattedPhone?: string;
    expiresInSeconds?: number;
  }> {
    return this.request('/auth/send-registration-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, email }),
    });
  }

  async verifyRegistrationOtp(phone: string, otp: string, email?: string): Promise<{
    success: boolean;
    verified: boolean;
    message: string;
  }> {
    return this.request('/auth/verify-registration-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, email }),
    });
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyOtp(email: string, otp: string): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {}
    this.setToken(null);
  }

  // 2. Dashboard
  async getDashboard(): Promise<ClientDashboardData> {
    const res = await this.request<{ success: boolean; data: ClientDashboardData }>('/client/dashboard');
    return res.data;
  }

  // 3. Profile
  async getProfile(): Promise<ClientProfile> {
    const res = await this.request<{ success: boolean; profile: ClientProfile }>('/client/profile');
    return res.profile;
  }

  async updateProfile(updates: Partial<ClientProfile>): Promise<{ success: boolean; message: string }> {
    return this.request('/client/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async uploadAvatar(avatarUrl: string): Promise<{ success: boolean; message: string }> {
    return this.request('/client/upload-avatar', {
      method: 'POST',
      body: JSON.stringify({ avatarUrl }),
    });
  }

  async getKycStatus(): Promise<{ success: boolean; kycStatus: string; isVerified: boolean; requiredDocuments: any[] }> {
    return this.request('/client/kyc-status');
  }

  // 8. KYC — required documents, uploads (real file bytes → Supabase Storage), submit, resubmit
  async getKycRequiredDocuments(): Promise<KycRequiredDocumentItem[]> {
    const res = await this.request<{ success: boolean; documents: KycRequiredDocumentItem[] }>(
      '/client/kyc/required-documents'
    );
    return res.documents;
  }

  async uploadKycDocument(payload: {
    documentType: string;
    documentName: string;
    fileName: string;
    side?: 'front' | 'back';
    imageBase64: string;   // base64-encoded image (e.g. data:image/jpeg;base64,...)
    mime?: string;
  }): Promise<any> {
    return this.request('/client/kyc/documents/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async uploadKycSelfie(payload: { imageBase64: string; mime?: string }): Promise<any> {
    return this.request('/client/kyc/selfie', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async submitKyc(payload: KycSubmissionPayload): Promise<{ success: boolean; message: string; referenceNumber: string }> {
    return this.request('/client/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async resubmitKyc(payload: KycSubmissionPayload): Promise<{ success: boolean; message: string; referenceNumber: string }> {
    return this.request('/client/kyc/submit', {
      method: 'POST',
      body: JSON.stringify({ ...payload, resubmission: true }),
    });
  }

  // 4. Loan Application
  async getLoanProducts(): Promise<LoanProduct[]> {
    const res = await this.request<{ success: boolean; products: LoanProduct[] }>('/client/loan-products');
    return res.products;
  }

  async calculateLoan(payload: {
    amount: number;
    termMonths: number;
    interestRatePerMonth: number;
    interestType?: string;
  }): Promise<any> {
    const res = await this.request<{ success: boolean; calculation: any }>('/client/calculate-loan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.calculation;
  }

  async submitLoanApplication(payload: {
    productId: string;
    productName: string;
    amount: number;
    termMonths: number;
    repaymentFrequency?: string;
    purpose: string;
    guarantorName?: string;
    guarantorPhone?: string;
    collateralDescription?: string;
    documents?: string[];
  }): Promise<{ success: boolean; message: string; application: any }> {
    return this.request('/client/apply-loan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getLoanApplications(): Promise<LoanApplication[]> {
    const res = await this.request<{ success: boolean; applications: LoanApplication[] }>('/client/loan-applications');
    return res.applications;
  }

  // 5. Loans
  async getLoans(): Promise<{ activeLoans: LoanItem[]; completedLoans: LoanItem[]; allLoans: LoanItem[] }> {
    return this.request('/client/loans');
  }

  async getLoanSchedule(loanId: string): Promise<InstallmentScheduleItem[]> {
    const res = await this.request<{ success: boolean; schedule: InstallmentScheduleItem[] }>(`/client/loans/${loanId}/schedule`);
    return res.schedule;
  }

  // 6. Payments
  async getPayments(): Promise<PaymentItem[]> {
    const res = await this.request<{ success: boolean; payments: PaymentItem[] }>('/client/payments');
    return res.payments;
  }

  async submitPaymentProof(payload: {
    loanId: string;
    amount: number;
    paymentMethod: string;
    referenceNumber: string;
    receiptProofUrl?: string;
    paymentDate?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request('/client/submit-payment-proof', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 7. Notifications
  async getNotifications(): Promise<{ notifications: MobileNotification[]; unreadCount: number }> {
    return this.request('/client/notifications');
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await this.request(`/client/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.request('/client/notifications/mark-all-read', { method: 'POST' });
  }

  // 8. Transactions (financial activity)
  async getTransactions(payload: { search?: string; type?: TransactionType }): Promise<FinancialTransaction[]> {
    const res = await this.request<{ success: boolean; transactions: FinancialTransaction[] }>('/client/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.transactions;
  }

  // 9. Savings
  async getSavings(): Promise<SavingsAccount> {
    const res = await this.request<{ success: boolean; account: SavingsAccount }>('/client/savings');
    return res.account;
  }

  async getSavingsTransactions(): Promise<SavingsTransaction[]> {
    const res = await this.request<{ success: boolean; transactions: SavingsTransaction[] }>('/client/savings/transactions');
    return res.transactions;
  }

  async requestSavingsWithdrawal(payload: { amount: number; reason: string }): Promise<{ success: boolean; message: string }> {
    return this.request('/client/savings/request-withdrawal', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 10. Documents
  async getDocuments(): Promise<PortalDocument[]> {
    const res = await this.request<{ success: boolean; documents: PortalDocument[] }>('/client/documents');
    return res.documents;
  }

  // 11. Group Lending
  async getMyGroup(): Promise<ClientGroup> {
    const res = await this.request<{ success: boolean; group: ClientGroup }>('/client/groups/my');
    return res.group;
  }

  // 12. Help & Support
  async getFaqs(): Promise<FaqItem[]> {
    const res = await this.request<{ success: boolean; faqs: FaqItem[] }>('/client/faqs');
    return res.faqs;
  }

  async getSupportTickets(): Promise<SupportTicket[]> {
    const res = await this.request<{ success: boolean; tickets: SupportTicket[] }>('/client/support-tickets');
    return res.tickets;
  }

  async submitSupportTicket(payload: {
    subject: string;
    category: string;
    message: string;
    priority?: string;
    attachments?: string[];
  }): Promise<{ success: boolean; message: string; ticket: SupportTicket }> {
    return this.request('/client/support-tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 13. Settings
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const res = await this.request<{ success: boolean; preferences: NotificationPreferences }>('/client/settings/notification-preferences');
    return res.preferences;
  }

  async updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<{ success: boolean; message: string }> {
    return this.request('/client/settings/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    });
  }

  async getPrivacyPreferences(): Promise<PrivacyPreferences> {
    const res = await this.request<{ success: boolean; preferences: PrivacyPreferences }>('/client/settings/privacy-preferences');
    return res.preferences;
  }

  async updatePrivacyPreferences(preferences: Partial<PrivacyPreferences>): Promise<{ success: boolean; message: string }> {
    return this.request('/client/settings/privacy-preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    });
  }

  async getLoginActivity(): Promise<LoginActivityItem[]> {
    const res = await this.request<{ success: boolean; activity: LoginActivityItem[] }>('/client/settings/login-activity');
    return res.activity;
  }
}

// ---------------------------------------------------------------------------
// Branch (staff) — BranchApiService mirrors the branch staff screens' needs
// ---------------------------------------------------------------------------

class BranchApiService {
  async getContext(): Promise<BranchContextData> {
    return api.request('/branch/context');
  }

  async getKycQueue(): Promise<BranchKycQueueItem[]> {
    const res = await api.request<{ success: boolean; queue: BranchKycQueueItem[] }>('/branch/kyc/queue');
    return res.queue;
  }

  async reviewKyc(payload: {
    clientId: string;
    decision: KycReviewDecision;
    notes?: string;
    CorrectionReason?: string;
    rejectedDocumentIds?: string[];
    reason?: string;
  }): Promise<{ success: boolean; message: string; auditLogEntry?: AuditLogEntry }> {
    const res = await api.request<{ success: boolean; message: string; auditLogEntry?: AuditLogEntry }>('/branch/kyc/review', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res;
  }
}

export const api = new ApiService();

export const branchApi = new BranchApiService();
