import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  UserSession,
  KycRequiredDocumentItem,
  KycSubmissionPayload,
  KycReviewDecision,
  BranchContextData,
  BranchKycQueueItem,
} from '../types';
import type {
  ClientDashboardView,
  ClientDocumentView,
  ClientLoansView,
  ClientNotificationView,
  ClientProfileView,
  ClientTransactionView,
  FaceMatchView,
  FaqView,
  IdScanView,
  KycStatusView,
  KycUploadView,
  PsgcPlaceView,
  LoanDetailView,
  MyGroupView,
  PaymentView,
  PayoffQuoteView,
  ProofView,
  SavingsAccountView,
  SavingsStatementView,
  SignInView,
  SupportContactView,
  SupportRequestInput,
  SupportRequestView,
  TransactionKind,
  WithdrawalRequestView,
} from '../shared/client';
import type { ProductDto, ReceiptDocument, quoteToDto } from '../shared/lending';
import type { KycApplicationPayload } from '../shared/kyc';

/**
 * The mobile app talks to the same /api/client endpoints as the web portal
 * (src/portal/services) and gets the same response shapes (shared/client).
 */

const BACKEND_PORT = 3000;

function resolveApiBaseUrl(): string {
  // 1. Explicit override (production build / remote API / tunnel)
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) {
    const isLocalhost = override.includes('localhost') || override.includes('127.0.0.1');
    if (!isLocalhost || Platform.OS === 'web') {
      return override.replace(/\/+$/, '');
    }
  }

  // 2. Web: reuse the page origin (the Express server serves both API & frontend)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/api`;
  }

  // 3. Native (Expo Go / dev build): resolve the Metro dev-server host and point
  //    at the backend port, which listens on 0.0.0.0 for LAN access from devices.
  const constantsAny = Constants as any;
  const rawHostCandidates = [
    Constants.expoConfig?.hostUri,
    constantsAny.expoGoConfig?.debuggerHost,
    constantsAny.manifest?.debuggerHost,
    constantsAny.manifest2?.extra?.expoGo?.debuggerHost,
    constantsAny.manifest2?.extra?.expoClient?.hostUri,
    constantsAny.experienceUrl,
    constantsAny.linkingUri,
  ];
  for (const candidate of rawHostCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const stripped = candidate.replace(/^[a-zA-Z]+:\/\//, '');
      const host = stripped.split('/')[0].split(':')[0].trim();
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:${BACKEND_PORT}/api`;
      }
    }
  }

  // 4. Fallback to localhost
  return `http://localhost:${BACKEND_PORT}/api`;
}

export const API_BASE_URL = resolveApiBaseUrl();

/** A list the server must send; a missing one is a broken response, not an empty list. */
function listOf<T>(value: T[] | undefined, what: string): T[] {
  if (!Array.isArray(value)) throw new ApiError(`The server's response had no ${what}. Please try again.`, 0, 'BAD_RESPONSE');
  return value;
}

/** A refused request: the server's message, code and per-field messages. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly fields: Record<string, string> = {},
    /** Everything else the server sent with the refusal, e.g. { requiredStep, issues } for KYC. */
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Field messages from a refused request, for showing next to the inputs. */
export const fieldErrorsOf = (err: unknown): Record<string, string> => (err instanceof ApiError ? err.fields : {});
export const messageOf = (err: unknown, fallback: string): string => (err instanceof Error && err.message ? err.message : fallback);

/** One key per attempt of a money action, so a retry after a timeout cannot post twice. */
export const newIdempotencyKey = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export type LoanQuoteDto = ReturnType<typeof quoteToDto>;

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
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    } catch {
      throw new ApiError(
        `Cannot reach the server at ${API_BASE_URL}. Check that it is running and that this device is on the same network.`,
        0,
        'NETWORK',
      );
    }
    const text = await response.text();
    let data: any = {};
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }
    if (!response.ok) {
      throw new ApiError(data.error || data.message || `Request failed (${response.status})`, response.status, data.code, data.fields && typeof data.fields === 'object' ? data.fields : {}, data);
    }
    return data as T;
  }

  private post<T>(endpoint: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
  }

  // -------------------------------------------------------------------------
  // Sign-in and password
  // -------------------------------------------------------------------------

  async login(identifier: string, password: string): Promise<UserSession> {
    const data = await this.post<{ token: string; user: any }>('/auth/login', { identifier, password });
    this.setToken(data.token);
    return { token: data.token, user: data.user };
  }

  async register(payload: Record<string, unknown>): Promise<UserSession & { message?: string }> {
    const data = await this.post<{ token: string; user: any; message?: string }>('/auth/register', payload);
    this.setToken(data.token);
    return { token: data.token, user: data.user, message: data.message };
  }

  async sendRegistrationOtp(phone: string, email?: string): Promise<{ success: boolean; message: string; email?: string; formattedPhone?: string; expiresInSeconds?: number }> {
    return this.post('/client/auth/send-registration-otp', { phone, email });
  }

  async verifyRegistrationOtp(phone: string, otp: string, email?: string): Promise<{ success: boolean; verified: boolean; message: string }> {
    return this.post('/client/auth/verify-registration-otp', { phone, otp, email });
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return this.post('/client/auth/forgot-password', { email });
  }

  async verifyOtp(email: string, otp: string): Promise<{ success: boolean; message: string }> {
    return this.post('/client/auth/verify-otp', { email, otp });
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.post('/client/auth/reset-password', { email, otp, newPassword });
  }

  /** Changes the signed-in member's password; the current one is required. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.post('/client/auth/change-password', { currentPassword, newPassword });
  }

  async logout(): Promise<void> {
    try {
      await this.post('/client/auth/logout', {});
    } catch {
      // Signing out locally does not depend on the server answering.
    }
    this.setToken(null);
  }

  // -------------------------------------------------------------------------
  // Home and profile
  // -------------------------------------------------------------------------

  async getDashboard(): Promise<ClientDashboardView> {
    return (await this.request<{ data: ClientDashboardView }>('/client/dashboard')).data;
  }

  async getProfile(): Promise<ClientProfileView> {
    return (await this.request<{ profile: ClientProfileView }>('/client/profile')).profile;
  }

  /** Contact and work details only (shared/kyc-core/profile.ts). */
  async updateProfile(updates: Record<string, string>): Promise<void> {
    await this.request('/client/profile', { method: 'PATCH', body: JSON.stringify(updates) });
  }

  async getSignIns(): Promise<SignInView[]> {
    return listOf((await this.request<{ sessions?: SignInView[] }>('/client/settings/sessions')).sessions, 'sessions');
  }

  // -------------------------------------------------------------------------
  // KYC
  // -------------------------------------------------------------------------

  async getKycStatus(): Promise<KycStatusView> {
    return this.request<KycStatusView>('/client/kyc-status');
  }

  /** A KYC document photo (ID back, proof of income, ...). */
  async uploadKycDocument(payload: { documentType: string; documentName: string; fileName: string; side?: 'FRONT' | 'BACK'; imageBase64: string }): Promise<KycUploadView> {
    return this.post<KycUploadView>('/client/kyc/documents/upload', payload);
  }

  /** Stores the ID photo(s) and runs the automated reader on them. */
  async processKycId(payload: { frontImageBase64: string; backImageBase64?: string; fileName?: string }): Promise<IdScanView> {
    return this.post<IdScanView>('/client/kyc/process-id', payload);
  }

  /** Stores the selfie and compares it with the stored ID photo. */
  async matchKycFace(selfieImageBase64: string): Promise<FaceMatchView> {
    return this.post<FaceMatchView>('/client/kyc/match-face', { selfieImageBase64 });
  }

  async saveKycDraft(payload: KycApplicationPayload & { currentStep: number }): Promise<void> {
    await this.post('/client/kyc/save-draft', payload);
  }

  async submitKyc(payload: KycApplicationPayload): Promise<{ message: string; referenceNumber: string; statusLabel: string }> {
    return this.post('/client/kyc/submit', payload);
  }

  // Philippine Standard Geographic Code lists (same endpoints as the web portal).
  async getRegions(): Promise<PsgcPlaceView[]> {
    return listOf((await this.request<{ data?: PsgcPlaceView[] }>('/geography/regions')).data, 'regions');
  }

  async getProvinces(regionCode: string): Promise<PsgcPlaceView[]> {
    return listOf((await this.request<{ data?: PsgcPlaceView[] }>(`/geography/provinces?regionCode=${encodeURIComponent(regionCode)}`)).data, 'provinces');
  }

  async getCities(regionCode: string, provinceCode?: string): Promise<PsgcPlaceView[]> {
    const q = `regionCode=${encodeURIComponent(regionCode)}${provinceCode ? `&provinceCode=${encodeURIComponent(provinceCode)}` : ''}`;
    return listOf((await this.request<{ data?: PsgcPlaceView[] }>(`/geography/cities?${q}`)).data, 'cities');
  }

  async getBarangays(cityCode: string): Promise<PsgcPlaceView[]> {
    return listOf((await this.request<{ data?: PsgcPlaceView[] }>(`/geography/barangays?cityCode=${encodeURIComponent(cityCode)}`)).data, 'barangays');
  }

  async getPostalCode(cityCode: string, barangayCode?: string): Promise<string> {
    const q = `cityCode=${encodeURIComponent(cityCode)}${barangayCode ? `&barangayCode=${encodeURIComponent(barangayCode)}` : ''}`;
    return (await this.request<{ postalCode?: string }>(`/geography/postal-code?${q}`)).postalCode ?? '';
  }

  // -------------------------------------------------------------------------
  // Loans
  // -------------------------------------------------------------------------

  async getLoanProducts(): Promise<ProductDto[]> {
    return listOf((await this.request<{ products?: ProductDto[] }>('/client/loan-products')).products, 'products');
  }

  /** The same quote the server will apply (shared/lending calculator). */
  async quoteLoan(productId: string, amount: string, termMonths: string): Promise<LoanQuoteDto> {
    return (await this.post<{ quote: LoanQuoteDto }>('/client/calculate-loan', { productId, amount, termMonths })).quote;
  }

  async applyForLoan(
    input: { productId: string; amount: string; termMonths: string; purpose: string; purposeDetails?: Record<string, string> },
    idempotencyKey: string,
  ): Promise<{ application: LoanDetailView; replayed: boolean }> {
    const data = await this.post<{ application: LoanDetailView; replayed?: boolean }>('/client/apply-loan', input, { 'Idempotency-Key': idempotencyKey });
    return { application: data.application, replayed: !!data.replayed };
  }

  async getLoans(): Promise<ClientLoansView> {
    return this.request<ClientLoansView>('/client/loans');
  }

  async getLoan(loanId: string): Promise<{ loan: LoanDetailView }> {
    return this.request(`/client/loans/${encodeURIComponent(loanId)}`);
  }

  async getLoanPayments(loanId: string): Promise<PaymentView[]> {
    return listOf((await this.request<{ payments?: PaymentView[] }>(`/client/loans/${encodeURIComponent(loanId)}/payments`)).payments, 'payments');
  }

  async getPayoff(loanId: string): Promise<PayoffQuoteView> {
    return (await this.request<{ payoff: PayoffQuoteView }>(`/client/loans/${encodeURIComponent(loanId)}/payoff`)).payoff;
  }

  async cancelApplication(loanId: string, reason: string): Promise<LoanDetailView> {
    return (await this.post<{ loan: LoanDetailView }>(`/client/loans/${encodeURIComponent(loanId)}/cancel`, { reason })).loan;
  }

  // -------------------------------------------------------------------------
  // Payments
  // -------------------------------------------------------------------------

  async getPayments(): Promise<PaymentView[]> {
    return listOf((await this.request<{ payments?: PaymentView[] }>('/client/payments')).payments, 'payments');
  }

  async getReceipt(paymentId: string): Promise<ReceiptDocument> {
    return (await this.request<{ receipt: ReceiptDocument }>(`/client/payments/${encodeURIComponent(paymentId)}/receipt`)).receipt;
  }

  async getPaymentProofs(): Promise<Omit<ProofView, 'storageRef'>[]> {
    return listOf((await this.request<{ proofs?: Omit<ProofView, 'storageRef'>[] }>('/client/payment-proofs')).proofs, 'proofs');
  }

  /** Proof of a bank or e-wallet transfer; staff verify it before anything is posted. */
  async submitPaymentProof(input: {
    loanId: string;
    amount: string;
    method: string;
    referenceNumber: string;
    paymentDate: string;
    notes?: string;
    fileBase64: string;
    fileName: string;
  }): Promise<Omit<ProofView, 'storageRef'>> {
    return (await this.post<{ proof: Omit<ProofView, 'storageRef'> }>('/client/submit-payment-proof', input)).proof;
  }

  // -------------------------------------------------------------------------
  // Savings
  // -------------------------------------------------------------------------

  async getSavingsAccounts(): Promise<SavingsAccountView[]> {
    return listOf((await this.request<{ accounts?: SavingsAccountView[] }>('/client/savings')).accounts, 'accounts');
  }

  async getSavingsStatement(accountId: string, range: { from?: string; to?: string } = {}): Promise<SavingsStatementView> {
    const qs = [range.from ? `from=${range.from}` : '', range.to ? `to=${range.to}` : ''].filter(Boolean).join('&');
    return (await this.request<{ statement: SavingsStatementView }>(`/client/savings/${encodeURIComponent(accountId)}/statement${qs ? `?${qs}` : ''}`)).statement;
  }

  async getWithdrawalRequests(): Promise<WithdrawalRequestView[]> {
    return listOf((await this.request<{ requests?: WithdrawalRequestView[] }>('/client/savings/withdrawal-requests')).requests, 'requests');
  }

  async requestWithdrawal(input: { accountId: string; amount: string; destination: string; destinationAccount?: string; reason: string }): Promise<WithdrawalRequestView> {
    return (await this.post<{ request: WithdrawalRequestView }>('/client/savings/withdraw', input)).request;
  }

  async cancelWithdrawalRequest(id: string): Promise<WithdrawalRequestView> {
    return (await this.post<{ request: WithdrawalRequestView }>(`/client/savings/withdrawal-requests/${encodeURIComponent(id)}/cancel`, {})).request;
  }

  // -------------------------------------------------------------------------
  // Group, notifications, transactions, documents, support
  // -------------------------------------------------------------------------

  async getMyGroup(): Promise<MyGroupView | null> {
    return (await this.request<{ group: MyGroupView | null }>('/client/groups/my')).group;
  }

  async consentToGroupLoan(loanId: string, decision: 'CONSENT' | 'DECLINE', note?: string): Promise<MyGroupView | null> {
    return (await this.post<{ group: MyGroupView | null }>(`/client/groups/loans/${encodeURIComponent(loanId)}/consent`, { decision, note })).group;
  }

  async getNotifications(): Promise<{ notifications: ClientNotificationView[]; unreadCount: number }> {
    return this.request('/client/notifications');
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await this.request(`/client/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.post('/client/notifications/mark-all-read', {});
  }

  async getTransactions(filter: { kind?: TransactionKind | 'ALL'; search?: string; from?: string | null } = {}): Promise<ClientTransactionView[]> {
    const params: string[] = [];
    if (filter.kind && filter.kind !== 'ALL') params.push(`kind=${encodeURIComponent(filter.kind)}`);
    if (filter.search) params.push(`search=${encodeURIComponent(filter.search)}`);
    if (filter.from) params.push(`from=${encodeURIComponent(filter.from)}`);
    return listOf((await this.request<{ transactions?: ClientTransactionView[] }>(`/client/transactions${params.length ? `?${params.join('&')}` : ''}`)).transactions, 'transactions');
  }

  async getDocuments(): Promise<ClientDocumentView[]> {
    return listOf((await this.request<{ documents?: ClientDocumentView[] }>('/client/documents')).documents, 'documents');
  }

  async getDocumentUrl(id: string): Promise<string> {
    return (await this.request<{ url: string }>(`/client/documents/${encodeURIComponent(id)}/file`)).url;
  }

  async getFaqs(): Promise<FaqView[]> {
    return listOf((await this.request<{ faqs?: FaqView[] }>('/client/support/faqs')).faqs, 'faqs');
  }

  async getSupportContact(): Promise<SupportContactView> {
    return (await this.request<{ contact: SupportContactView }>('/client/support/contact')).contact;
  }

  async getSupportRequests(): Promise<SupportRequestView[]> {
    return listOf((await this.request<{ tickets?: SupportRequestView[] }>('/client/support/tickets')).tickets, 'tickets');
  }

  async sendSupportRequest(input: SupportRequestInput): Promise<SupportRequestView> {
    return (await this.post<{ ticket: SupportRequestView }>('/client/support/submit', input)).ticket;
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
    const res = await api.request<{ success: boolean; data?: BranchKycQueueItem[] }>('/branch/kyc-queue');
    return listOf(res.data, 'queue');
  }

  async reviewKyc(payload: {
    clientId: string;
    decision: KycReviewDecision;
    notes?: string;
    correctionReason?: string;
    rejectedDocumentIds?: string[];
    reason?: string;
  }): Promise<{ success: boolean; status?: string; reviewedAt?: string; reviewerName?: string }> {
    const { clientId, ...body } = payload;
    return api.request(`/branch/kyc/${encodeURIComponent(clientId)}/review`, { method: 'POST', body: JSON.stringify(body) });
  }
}

export const api = new ApiService();

export const branchApi = new BranchApiService();
