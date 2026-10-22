// ---------------------------------------------------------------------------
// Client Portal domain types.
// These mirror the shapes returned by the /api/client* REST endpoints and the
// mock fallback service. Page components must never hardcode financial data —
// they consume these types via the service layer.
// ---------------------------------------------------------------------------

import type { ClientProfileView, KycStatusFullView } from '../../shared/client/contracts';

export type PaymentStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'PENDING_TELLER_VERIFICATION' | 'VERIFIED' | 'REJECTED';

/** shared/lending LOAN_STATUSES as codes: 'Under Review' -> 'UNDER_REVIEW'. */
export type LoanStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'
  | 'ACTIVE'
  | 'CLOSED'
  | 'WRITTEN_OFF'
  | 'CANCELLED';

export type KYCStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'CORRECTION_REQUIRED'
  | 'VERIFIED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'EXPIRED';

export type NotificationCategory =
  | 'loan_update'
  | 'approval_rejection'
  | 'upcoming_payment'
  | 'overdue_payment'
  | 'payment_confirmation'
  | 'savings_update'
  | 'announcement';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'GCASH' | 'MAYA' | 'EWALLET' | 'OVER_THE_COUNTER';

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** Exactly what GET /api/client/profile sends (shared/client/contracts.ts). */
export type ClientProfile = ClientProfileView;

/** GET /api/client/kyc-status: the shared full view plus the fields older portal pages read. */
export type KycStatusData = KycStatusFullView & {
  submissionId: string | null;
  uploadedDocuments: Array<{ type?: string; documentType?: string; fileUrl?: string | null }>;
};

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export interface ClientLoan {
  id: string;
  loanNumber: string;
  productName: string;
  principalAmount: number;
  interestRate: number;
  interestType?: string;
  termMonths: number;
  /** The regular installment at the loan's frequency (not necessarily monthly). */
  monthlyInstallment: number;
  /** "Weekly", "Bi-weekly" or "Monthly". */
  frequency?: string;
  remainingBalance: number;
  paidAmount?: number;
  totalPayable?: number;
  totalInterest?: number;
  totalFees?: number;
  netProceeds?: number;
  overdue?: boolean;
  status: LoanStatus;
  startDate?: string;
  disbursedDate?: string;
  applicationDate?: string;
  maturityDate?: string;
  nextPaymentDate?: string;
  purpose?: string;
  repaymentsMade?: number;
  repaymentsTotal?: number;
}

export interface ScheduleItem {
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  principal: number;
  interest: number;
  remainingBalance: number;
  status: 'PAID' | 'PARTIAL' | 'DUE' | 'UPCOMING' | 'OVERDUE';
  paidDate?: string | null;
  receiptNumber?: string | null;
}

export type { LoanProduct } from '../../shared/lending';


export interface LoanApplication {
  id: string;
  loanNumber?: string;
  productId?: string;
  productName: string;
  principalAmount: number;
  termMonths: number;
  applicationDate: string;
  status: LoanStatus;
  coopStep?: string;
  rejectionReason?: string | null;
  /** Why staff returned the application for changes. */
  returnedReason?: string | null;
  decisionReason?: string | null;
  disbursedAt?: string | null;
  repaymentFrequency?: string;
  purpose?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface PaymentRecordItem {
  id: string;
  loanId: string;
  loanNumber: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  officialReceiptNumber?: string;
  status: PaymentStatus;
  notes?: string;
}

export interface PaymentProofResult {
  id: string;
  borrowerId: string;
  loanId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  verificationStatus: string;
  submittedAt: string;
}

// ---------------------------------------------------------------------------
// Savings
// ---------------------------------------------------------------------------

export interface SavingsAccount {
  id: string;
  memberId?: string;
  balance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  latestTransaction?: SavingsTransaction;
  goal?: number;
  goalName?: string;
}

export interface SavingsTransaction {
  id: string;
  date: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST';
  amount: number;
  referenceNumber: string;
  balanceAfter: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  notes?: string;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  requestDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISBURSED';
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface PortalNotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  isRead: boolean;
  createdAt: string;
  meta?: Record<string, any>;
}

export interface NotificationsData {
  notifications: PortalNotification[];
  unreadCount: number;
}

// ---------------------------------------------------------------------------
// Group lending
// ---------------------------------------------------------------------------

export interface GroupMemberSummary {
  borrowerId: string;
  name: string;
  role?: string;
  contributionStatus: 'PAID' | 'PENDING' | 'LATE';
  loanStatus?: string;
}

export interface ClientGroup {
  id: string;
  name: string;
  leaderName: string;
  memberCount: number;
  status: 'ACTIVE' | 'INACTIVE' | 'FORMING';
  centerName?: string;
  branch?: string;
  members: GroupMemberSummary[];
  groupLoan?: ClientGroupLoan;
}

export interface ClientGroupLoan {
  id: string;
  totalAmount: number;
  outstandingBalance: number;
  nextPayment: number;
  nextPaymentDate: string;
  paidAmount: number;
  repaymentProgress: number; // 0-100
  schedule: ScheduleItem[];
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface PortalDocument {
  id: string;
  name: string;
  type: string;
  date: string;
  relatedLoanNumber?: string;
  hasFile?: boolean;
  fileName?: string;
  sizeLabel?: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  paymentReminders: boolean;
  loanUpdates: boolean;
  savingsUpdates: boolean;
  announcements: boolean;
}

export interface LoginActivityItem {
  id: string;
  device: string;
  location: string;
  time: string;
  ip?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

export interface PrivacyPreferences {
  shareDataAnalytics: boolean;
  allowSmsMarketing: boolean;
  allowEmailAlerts: boolean;
}