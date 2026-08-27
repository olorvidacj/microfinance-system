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
} from '../types';

export const API_BASE_URL = 'http://localhost:3000/api';

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
  }): Promise<UserSession> {
    const data = await this.request<{ success: boolean; token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(data.token);
    return { token: data.token, user: data.user };
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; demoOtp?: string }> {
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
}

export const api = new ApiService();
