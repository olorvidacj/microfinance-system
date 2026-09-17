export interface User {
  id: string;
  email: string;
  fullName: string;
  name?: string;
  role: 'CLIENT' | 'STAFF';
  staffRole?: string | null;
  borrowerId?: string | null;
  phone?: string;
  avatar?: string;
}

export type Role = 'CLIENT' | 'STAFF';

export interface UserSession {
  token: string;
  user: User;
}

export interface FinancialTransaction {
  id: string;
  type: 'LOAN_PAYMENT' | 'SAVINGS_DEPOSIT' | 'LOAN_DISBURSEMENT' | 'SAVINGS_WITHDRAWAL' | 'FEE' | 'ADJUSTMENT' | 'REPAYMENT';
  amount: number;
  date: string;
  referenceNumber: string;
  paymentMethod: 'GCASH' | 'MAYA' | 'OVER_THE_COUNTER' | 'BANK_TRANSFER' | 'CASH' | 'CARD';
  status: string;
  description?: string;
  loanId?: string;
  loanNumber?: string;
  category?: 'loan' | 'savings' | 'payment' | 'kyc' | 'system';
}

export interface ClientDashboardData {
  borrowerName: string;
  totalBalance?: number;
  memberNumber: string;
  totalActiveLoan: number;
  remainingBalance: number;
  nextPayment: number;
  nextPaymentDueDate: string;
  loanStatus: string;
  activeLoansCount: number;
  savingsBalance: number;
  totalSavingsDeposits: number;
  savingsGoal: number;
  savingsGoalName: string;
  totalPaid: number;
  totalPayments: number;
  kycStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING' | 'UNDER_REVIEW' | 'CORRECTION_REQUIRED' | 'REJECTED' | 'VERIFIED';
  recentTransactions: FinancialTransaction[];
  recentNotifications?: MobileNotification[];
}

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
  employer?: string;
  monthlyIncome: number;
  avatar: string;
  memberNumber: string;
  membershipDate: string;
  kycStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING' | 'UNDER_REVIEW' | 'CORRECTION_REQUIRED' | 'REJECTED' | 'VERIFIED';
  creditScore: number;
  creditTier: string;
}

export interface KycDocument {
  type: string;
  name: string;
  submitted: boolean;
  status: 'VERIFIED' | 'PENDING' | 'REJECTED';
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

export interface LoanApplication {
  id: string;
  productName: string;
  principalAmount: number;
  termMonths: number;
  applicationDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISBURSED';
  coopStep?: string;
  rejectionReason?: string | null;
  disbursedAt?: string | null;
}

export interface LoanItem {
  id: string;
  loanNumber: string;
  productName: string;
  principalAmount: number;
  interestRate: number;
  interestType: 'REDUCING_BALANCE' | 'FLAT_RATE';
  termMonths: number;
  monthlyInstallment: number;
  remainingBalance: number;
  paidAmount: number;
  totalPayable?: number;
  totalInterest?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'PAID_OFF' | 'OVERDUE' | 'APPROVED';
  startDate: string;
  maturityDate: string;
  nextPaymentDate?: string;
  purpose: string;
  repaymentsMade?: number;
  repaymentsTotal?: number;
}

export interface InstallmentScheduleItem {
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

export interface PaymentItem {
  id: string;
  loanId: string;
  loanNumber: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  officialReceiptNumber?: string;
  status: string;
  notes?: string;
}

export interface MobileNotification {
  id: string;
  borrowerId: string;
  title: string;
  message: string;
  category: 'loan_update' | 'approval_rejection' | 'upcoming_payment' | 'overdue_payment' | 'payment_confirmation' | 'announcement' | 'savings_update' | 'kyc_update';
  isRead: boolean;
  createdAt: string;
  meta?: any;
  type?: string;
  amount?: number;
  relatedEntityId?: string;
  relatedEntityType?: string;
  linkTo?: string;
  iconColor?: string;
}

export interface NotificationsData {
  notifications: MobileNotification[];
  unreadCount: number;
}

// ---------------------------------------------------------------------------
// KYC â€” mirrors the shapes the Express clientMobile router returns and which the
// backend service layer / mock service / KYC screens consume.
// ---------------------------------------------------------------------------

export type KYCStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING' | 'UNDER_REVIEW' | 'CORRECTION_REQUIRED' | 'CORRECTION_REQUIRED_DONE' | 'REJECTED' | 'VERIFIED' | 'CANCELLED';

export interface KycRequiredDocumentItem {
  id?: string;
  documentType: string;
  documentName: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  type?: string;
  name?: string;
  submitted?: boolean;
  status?: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NOT_SUBMITTED';
  required?: boolean;
  fileName?: string;
}

export interface KycDocumentItem {
  id: string;
  type: string;
  name: string;
  fileName?: string;
  fileUrl?: string;
  submitted?: boolean;
  status: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'CORRECTION_REQUIRED';
  description?: string;
  rejectionReason?: string;
}

export interface KycStatusData {
  kycStatus: KYCStatus;
  isVerified: boolean;
  requiredDocuments: KycRequiredDocumentItem[];
  uploadedDocuments: KycDocumentItem[];
  submissionId?: string;
  submittedAt?: string;
  reviewedAt?: string;
  correctionReason?: string;
  verifiedAt?: string;
  reviewedByName?: string;
}

// ---------------------------------------------------------------------------
// KYC form section payloads (partial steps â€” draft persistence per step)
// ---------------------------------------------------------------------------

export interface KycPersonalInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  dateOfBirth?: string;
  gender?: string;
  civilStatus?: string;
  nationality?: string;
  phone?: string;
  email?: string;
}

export interface KycAddress {
  houseUnit?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  monthsAtAddress?: number;
}

export interface KycEmployment {
  occupation: string;
  employer?: string;
  employerOrBusiness?: string;
  employmentStatus?: string;
  monthlyIncome?: number;
  sourceOfIncome?: string;
  yearsInCurrentEmployment?: number;
}

export interface KycIdInfo {
  idType?: string;
  idTypeName?: string;
  idNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  selfieUrl?: string;
}

export interface KycSubmissionPayload {
  personalInfo?: KycPersonalInfo;
  address?: KycAddress;
  employment?: KycEmployment;
  idInfo?: KycIdInfo;
  uploadedDocumentIds?: string[];
  agreedToTerms?: boolean;
  signatureUrl?: string;
}

export interface KycSubmission {
  id: string;
  submissionNumber: string;
  borrowerId?: string;
  borrowerNumber?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'CORRECTION_REQUIRED' | 'VERIFIED' | 'REJECTED';
  submittedAt?: string;
  reviewedAt?: string;
  reviewedByName?: string;
  correctionReason?: string;
  rejectionReason?: string;
  personalInfo?: KycPersonalInfo;
  address?: KycAddress;
  employment?: KycEmployment;
  idInfo?: KycIdInfo;
}

// ---------------------------------------------------------------------------
// Branch (staff) side â€” KYC queue, review, audit
// ---------------------------------------------------------------------------

export interface BranchContextData {
  staffId: string;
  staffName: string;
  staffRole: 'BRANCH_OFFICER' | 'FIELD_OFFICER' | 'BRANCH_MANAGER';
  branchId: string;
  branchName: string;
  staffNumber?: string;
}

export interface BranchKycQueueItem {
  id: string;
  borrowerNumber?: string;
  fullName: string;
  phone?: string;
  email?: string;
  kycStatus: KYCStatus;
  submittedDocuments?: number;
  gender?: string;
  dateOfBirth?: string;
  civilStatus?: string;
  address?: string;
  barangay?: string;
  city?: string;
  province?: string;
  occupation?: string;
  employerOrBusiness?: string;
  monthlyIncome?: number;
  kycSubmission?: KycSubmission;
  submittedAt?: string;
}

export type KycReviewDecision =
  | 'APPROVED'
  | 'REJECTED'
  | 'CORRECTION_REQUESTED'
  | 'VERIFIED'
  | 'CORRECTION_REQUIRED';

export interface AuditLogEntry {
  id: string;
  action: string;
  actorName?: string;
  actorUserId?: string;
  staffName?: string;
  targetId?: string;
  targetType?: string;
  branchId?: string;
  details?: string;
  performedAt?: string;
  createdAt?: string;
  ipAddress?: string;
  severity?: 'INFO' | 'WARNING' | 'ERROR';
  previousStatus?: string;
  newStatus?: string;
  previousStatusLabel?: string;
  status?: string;
  reason?: string;
  notes?: string;
  correctionReason?: string;
  decision?: KycReviewDecision;
  reviewedByName?: string;
  rejectionReason?: string;
}

export interface BranchKycStats {
  totalPending: number;
  totalUnderReview: number;
  totalCorrectionRequired: number;
  totalVerifiedToday: number;
  totalRejected: number;
}

export interface BranchContextDataStaffContext {
  queue: BranchKycQueueItem[];
  stats: BranchKycStats;
}

// ---------------------------------------------------------------------------
// Receipts / payments
// ---------------------------------------------------------------------------

export interface PaymentReceipt {  amount: number;
  currency?: string;
  referenceNumber?: string;
  paymentDate?: string;
  loanId?: string;
  loanNumber?: string;
  loanProduct?: string;
  paymentMethod?: string;
  status?: string;
  remainingBalance?: number;
  notes?: string;
}

export type PaymentMethod = string;

// ---------------------------------------------------------------------------
// Savings
// ---------------------------------------------------------------------------

export interface SavingsAccount {
  id: string;
  memberId?: string;
  accountNumber: string;
  balance: number;
  totalDeposits?: number;
  totalWithdrawals?: number;
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
  status: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Groups / group lending
// ---------------------------------------------------------------------------

export interface ClientGroupMember {
  borrowerId: string;
  borrowerNumber?: string;
  name: string;
  role?: string;
  contributionStatus?: string;
  loanStatus?: string;
}

export interface ClientGroup {
  id: string;
  name: string;
  leaderName?: string;
  memberCount: number;
  status: string;
  centerName?: string;
  branch?: string;
  members: ClientGroupMember[];
  groupLoan?: {
    id: string;
    totalAmount: number;
    outstandingBalance: number;
    nextPayment?: number;
    nextPaymentDate?: string;
    paidAmount?: number;
    repaymentProgress?: number;
    schedule?: Array<{
      installmentNumber: number;
      dueDate: string;
      amountDue: number;
      principal?: number;
      interest?: number;
      remainingBalance?: number;
      status?: string;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Documents / support / misc
// ---------------------------------------------------------------------------

export interface PortalDocument {
  id: string;
  name: string;
  type: string;
  date: string;
  relatedLoanNumber?: string;
  url?: string;
  size?: number;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message?: string;
  status: string;
  priority?: string;
  category?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LoginActivityItem {
  id: string;
  device?: string;
  time?: string;
  createdAt?: string;
  deviceName?: string;
  location?: string;
  ipAddress?: string;
  loggedInAt: string;
  status?: string;
  isCurrent?: boolean;
}

export interface NotificationPreferences {
  paymentReminders?: boolean;
  loanUpdates?: boolean;
  savingsUpdates?: boolean;
  announcements?: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  categories: Record<string, boolean>;
}

export type TransactionType =
  | 'REPAYMENT'
  | 'LOAN_DISBURSEMENT'
  | 'LOAN_PAYMENT'
  | 'SAVINGS_DEPOSIT'
  | 'SAVINGS_WITHDRAWAL'
  | 'FEE'
  | 'ADJUSTMENT';
export interface PrivacyPreferences {
  shareDataAnalytics?: boolean;
  allowSmsMarketing?: boolean;
  allowEmailAlerts?: boolean;
  shareUsageData?: boolean;
  shareWithPartnerPrograms?: boolean;
  allowAnonymousResearch?: boolean;
  keepLoginHistory?: boolean;
  showProfileToPartners?: boolean;
  enableBiometric?: boolean;
  twoFactorAuth?: boolean;
  dataSharing?: boolean;
  personalization?: boolean;
}
export type DashboardTransaction = FinancialTransaction;

export interface TransactionScreenData {
  transactions: FinancialTransaction[];
  savingsGoal?: number;
  savingsGoalName?: string;
}

// For the in-flight loan application â†’ summary calculation preview.
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

export interface LoanScheduleItem extends InstallmentScheduleItem {}
