// ---------------------------------------------------------------------------
// Client Portal domain types.
// These mirror the shapes returned by the /api/client* REST endpoints and the
// mock fallback service. Page components must never hardcode financial data —
// they consume these types via the service layer.
// ---------------------------------------------------------------------------

export type PaymentStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'PENDING_TELLER_VERIFICATION' | 'VERIFIED' | 'REJECTED';

export type LoanStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'DISBURSED'
  | 'OVERDUE'
  | 'IN_ARREARS'
  | 'COMPLETED'
  | 'PAID_OFF'
  | 'REJECTED'
  | 'CANCELLED';

export type KYCStatus = 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';

export type NotificationCategory =
  | 'loan_update'
  | 'approval_rejection'
  | 'upcoming_payment'
  | 'overdue_payment'
  | 'payment_confirmation'
  | 'savings_update'
  | 'announcement';

export type TransactionType =
  | 'REPAYMENT'
  | 'LOAN_DISBURSEMENT'
  | 'SAVINGS_DEPOSIT'
  | 'SAVINGS_WITHDRAWAL'
  | 'LOAN_APPROVAL'
  | 'FEE'
  | 'ADJUSTMENT';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'GCASH' | 'MAYA' | 'EWALLET' | 'OVER_THE_COUNTER';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  referenceNumber: string;
  paymentMethod?: string;
  status: PaymentStatus | 'COMPLETED';
  description?: string;
}

export interface ClientDashboard {
  borrowerName: string;
  memberNumber: string;
  totalActiveLoan: number;
  remainingBalance: number;
  nextPayment: number;
  nextPaymentDueDate: string;
  loanStatus: LoanStatus | 'NO_ACTIVE_LOAN';
  activeLoansCount: number;
  recentTransactions: DashboardTransaction[];
  // Extended (campaign / mock) — full profile avatar + totals
  savingsBalance?: number;
  totalSavingsDeposits?: number;
  lastSavingsDepositDate?: string;
  totalPaid?: number;
  totalPayments?: number;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface ClientProfile {
  id: string;
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  address: string;
  houseUnit?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  dateOfBirth: string;
  gender?: string;
  civilStatus: string;
  nationality?: string;
  occupation: string;
  employer: string;
  monthlyIncome: number;
  avatar: string;
  memberNumber: string;
  membershipDate: string;
  kycStatus: KYCStatus;
  creditScore: number;
  creditTier: string;
}

export interface KycDocumentItem {
  type: string;
  name: string;
  submitted: boolean;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export interface KycStatusData {
  kycStatus: KYCStatus;
  isVerified: boolean;
  requiredDocuments: KycDocumentItem[];
  uploadedDocuments: any[];
}

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
  monthlyInstallment: number;
  remainingBalance: number;
  paidAmount?: number;
  totalPayable?: number;
  totalInterest?: number;
  status: LoanStatus;
  startDate?: string;
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
  status: 'PAID' | 'DUE' | 'UPCOMING' | 'OVERDUE';
  paidDate?: string | null;
  receiptNumber?: string | null;
}

export interface LoanProduct {
  id: string;
  name: string;
  code: string;
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  interestRatePerMonth: number;
  interestType: 'REDUCING_BALANCE' | 'FLAT_RATE';
  processingFeePercentage: number;
  description: string;
}

export interface LoanCalculation {
  principal: number;
  termMonths: number;
  monthlyInterestRate: number;
  estimatedMonthlyPayment: number;
  estimatedTotalInterest: number;
  totalRepayable: number;
  processingFee: number;
  estimatedNetProceeds: number;
}

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
  disbursedAt?: string | null;
  repaymentFrequency?: string;
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
// Transactions history
// ---------------------------------------------------------------------------

export interface FinancialTransaction extends DashboardTransaction {
  loanId?: string;
  loanNumber?: string;
  description: string;
  balanceAfter?: number;
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
  fileName?: string;
  sizeLabel?: string;
}

// ---------------------------------------------------------------------------
// Help & Support
// ---------------------------------------------------------------------------

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  message: string;
  createdAt: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  lastUpdate: string;
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