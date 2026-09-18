export type SystemPermissionKey = string;

export interface BranchPersonnel {
  staffId: string | null;
  name: string;
  email: string;
  role: string;
  title: string;
  avatar: string;
  accountStatus?: string;
}

export interface BranchInfo {
  id: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  branchManager?: string;
  contactPhone?: string;
  status?: string;
}

export interface BranchContextData {
  personnel: BranchPersonnel;
  branch: BranchInfo | null;
  permissions: SystemPermissionKey[];
  viewAll: boolean;
}

export interface StaffBranchAssignmentResponse {
  success: boolean;
  staff: {
    id: string;
    name: string;
    email: string;
    role: string;
    title?: string;
    avatar?: string;
    branch: {
      id: string;
      name: string;
      code: string;
      address: string;
      city?: string;
      phone?: string;
      status: string;
    } | null;
  };
  requiredBranch?: {
    id: string;
    name: string;
    code: string;
    address: string;
    city?: string;
    phone?: string;
  };
  adminContact?: {
    name: string;
    email: string;
    title?: string;
    phone?: string;
    location?: string;
  };
  token?: string;
  message?: string;
}

export interface ClientSummary {
  id: string;
  borrowerNumber: string;
  fullName: string;
  phone: string;
  email: string;
  branchId: string;
  memberStatus: string;
  kycStatus: string;
  membershipDate: string;
  joinedDate: string;
  savingsBalance?: number;
  shareCapital?: number;
  activeLoansCount?: number;
  totalBorrowed?: number;
  totalRepaid?: number;
  avatar?: string;
  creditScore?: number;
  creditTier?: string;
  submittedDocuments?: number;
}

export interface ClientDetail extends ClientSummary {
  idNumber: string;
  dateOfBirth: string;
  gender: string;
  civilStatus: string;
  address: string;
  facebookAccount?: string | null;
  employmentStatus: string;
  employerOrBusiness: string;
  occupation: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  notes?: string | null;
  lastActivityDate: string;
}

export interface BranchClientProfile {
  client: ClientDetail;
  loans: BranchLoan[];
  documents: BranchDocument[];
  savingsAccounts: BranchSavingsAccount[];
}

export interface BranchLoan {
  id: string;
  loanNumber: string;
  borrowerId: string;
  borrowerName: string;
  borrowerPhone?: string;
  borrowerAvatar?: string;
  branchId: string;
  productName: string;
  principalAmount: number;
  interestRate: number;
  interestType?: string;
  repaymentFrequency?: string;
  termMonths: number;
  totalInstallments?: number;
  processingFee?: number;
  totalInterest?: number;
  totalPayable: number;
  totalPaid?: number;
  remainingBalance: number;
  status: string;
  coopStep?: string;
  applicationDate?: string;
  startDate?: string | null;
  maturityDate?: string;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  loanOfficerName?: string;
  purpose?: string;
  daysInArrears?: number;
  underwritingReport?: any;
  schedule?: any[];
}

export interface InstallmentRow {
  installmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  fees: number;
  totalDue: number;
  amountPaid: number;
  remainingBalance: number;
  status: string;
  paidDate?: string;
}

export interface BranchLoanDetail {
  loan: BranchLoan;
  amortization: InstallmentRow[];
  payments: BranchPayment[];
  borrower: ClientDetail | null;
}

export interface BranchPayment {
  id: string;
  receiptNumber: string;
  loanId: string;
  loanNumber: string;
  borrowerId: string;
  borrowerName: string;
  branchId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  transactionReference?: string;
  collectedBy?: string;
  principalPortion?: number;
  interestPortion?: number;
  notes?: string | null;
}

export interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  loanId: string;
  loanNumber: string;
  clientId: string;
  clientName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference: string;
  processedBy: string;
  principalPortion: number;
  interestPortion: number;
  remainingBalance: number;
}

export interface BranchSavingsAccount {
  id: string;
  memberId?: string;
  memberName?: string;
  balance: number;
  totalDeposits?: number;
  totalWithdrawals?: number;
  maintainingBalance?: number;
  accountNumber?: string;
}

export interface SavingsTransactionRow {
  id: string;
  savingsAccountId: string;
  memberId?: string;
  memberName?: string;
  transactionNumber: string;
  date: string;
  type: string;
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  processedBy?: string;
  notes?: string | null;
  officialReceiptNumber?: string | null;
}

export interface GroupMemberRow {
  borrowerId: string;
  fullName: string;
  phone?: string;
  role?: string;
  status?: string;
  weeklyDues?: number;
  activeLoans?: number;
  outstandingBalance?: number;
  repaymentStatus?: string;
}

export interface SolidarityGroup {
  id: string;
  groupCode: string;
  groupName: string;
  centerName: string;
  branchId: string;
  formedDate: string;
  meetingDay: string;
  meetingTime: string;
  meetingLocation: string;
  loanOfficerName?: string;
  leaderBorrowerId?: string;
  leaderName?: string;
  leaderPhone?: string;
  members: GroupMemberRow[];
  totalActiveLoans?: number;
  totalGroupSavings?: number;
  repaymentRate?: number;
  solidarityFundBalance?: number;
  status?: string;
}

export interface FinancialTransactionRow {
  id: string;
  referenceNumber: string;
  clientId?: string;
  clientName?: string;
  accountOrLoanId?: string;
  accountOrLoanType?: string;
  branchId?: string;
  transactionType: string;
  amount: number;
  transactionDate: string;
  paymentMethod?: string;
  processedBy?: string;
  processedByRole?: string;
  status: string;
  notes?: string | null;
}

export interface BranchDocument {
  id: string;
  docNumber: string;
  branchId: string;
  clientId?: string | null;
  clientName?: string | null;
  loanId?: string | null;
  loanNumber?: string | null;
  docName: string;
  docType: string;
  fileUrl?: string | null;
  uploadedBy?: string;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface BranchNotification {
  id: string;
  branchId: string;
  targetStaffId?: string | null;
  type: string;
  title: string;
  message: string;
  relatedType?: string | null;
  relatedId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogRow {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  performedBy: string;
  branchId?: string;
  type: string;
  userName?: string;
  userRole?: string;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string;
}

export interface BranchDashboard {
  asOf: string;
  summary: {
    totalClients: number;
    activeClients: number;
    pendingVerification: number;
    activeLoans: number;
    outstandingBalance: number;
    todayCollections: number;
    todayTransactionCount: number;
    pendingApplications: number;
    totalSavings: number;
    todayDeposits: number;
    todayWithdrawals: number;
    overdueLoans: number;
    overdueOutstanding: number;
  };
}

export interface PerformanceData {
  range: string;
  portfolio: { active: number; completed: number; overdue: number; pending: number };
  collections: {
    daily: [string, number][];
    weekly: [string, number][];
    monthly: [string, number][];
    total: number;
  };
  clientGrowth: { newClients: number; active: number; inactive: number; monthly: [string, number][] };
  savings: { deposits: number; withdrawals: number; net: number };
}

export interface LoanProduct {
  id: string;
  name: string;
  code: string;
  minAmount?: number;
  maxAmount?: number;
  minTermMonths?: number;
  maxTermMonths?: number;
  interestRatePerMonth?: number;
  interestType?: string;
  processingFeePercentage?: number;
  description?: string;
}

export interface LoanAssessment {
  monthlyIncome: number;
  monthlyExpenses: number;
  existingObligations: number;
  disposableIncome: number;
  repaymentCapacityMonthly: number;
  debtRatio: number;
  recommendedAmount: number;
  estimatedInstallment: number;
  riskIndicators: string[];
  isEstimate: boolean;
  note: string;
  assessedBy: string;
  assessedAt: string;
}

export interface TodayCollections {
  payments: BranchPayment[];
  totals: { total: number; count: number; cash: number; other: number };
}

export interface ReportRow {
  type: string;
  from?: string;
  to: string;
  generatedAt: string;
  summary: Record<string, any>;
  rows: Record<string, any>[];
}