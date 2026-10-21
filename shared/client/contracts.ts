/**
 * Response shapes of the member API (/api/client/*), shared by the server,
 * the web portal and the mobile app. The server's view functions are typed
 * with these, so a change here is checked everywhere at compile time.
 *
 * Money is an exact decimal string ("1234.50"); dates are "YYYY-MM-DD";
 * timestamps are ISO strings.
 */
import type {
  AccrualMethod,
  DisbursementMethod,
  GroupRole,
  GroupStatus,
  LoanStatus,
  PaymentKind,
  ReceiptDocument,
  SavingsKind,
  SavingsStatus,
  SavingsTxnKind,
} from '../lending';
import type { KycStatus, QualityMetrics } from '../kyc-core';
import type { TransactionKind } from './transactions';

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export type InstallmentDisplayStatus = 'PAID' | 'PARTIAL' | 'OVERDUE' | 'DUE' | 'UPCOMING';

export interface ScheduleRowView {
  number: number;
  dueDate: string;
  principal: string;
  interest: string;
  total: string;
  /** Late penalties charged on this installment. */
  penalty: string;
  paid: string;
  /** Still owed on this installment, penalties included. */
  outstanding: string;
  balanceAfter: string;
  status: InstallmentDisplayStatus;
}

export interface LoanSummaryView {
  id: string;
  loanNumber: string;
  status: LoanStatus;
  borrowerId: string;
  borrowerName: string;
  branchId: string;
  productId: string;
  productName: string;
  lendingType: string;
  channel: string | null;
  principal: string;
  annualRate: string;
  interestMethod: string;
  frequency: string;
  termMonths: number;
  installments: number;
  installmentAmount: string | null;
  totalInterest: string;
  fees: { code: string; label: string; amount: string }[];
  totalFees: string;
  netProceeds: string | null;
  totalPayable: string;
  totalPaid: string;
  remainingBalance: string;
  applicationDate: string;
  submittedAt: string | null;
  approvalDate: string | null;
  disbursedDate: string | null;
  maturityDate: string;
  nextDue: { dueDate: string; amount: string } | null;
  overdue: boolean;
  purpose: string;
  loanOfficerName: string | null;
  decidedByName: string | null;
  createdBy: string | null;
  decisionReason: string | null;
  returnedReason: string | null;
  cancellationReason: string | null;
}

export interface LoanDetailView extends LoanSummaryView {
  scheduleKind: 'STORED' | 'PROJECTED';
  schedule: ScheduleRowView[];
  history: { from: string | null; to: string; reason: string | null; actorName: string | null; actorRole: string | null; at: string }[];
  disbursement: {
    receiptNumber: string;
    method: DisbursementMethod;
    referenceNumber: string | null;
    destinationAccount: string | null;
    disbursementDate: string;
    grossAmount: string;
    totalFees: string;
    netAmount: string;
    disbursedByName: string;
    journalEntryId: string;
  } | null;
  receipt: ReceiptDocument | null;
}

export interface ClientLoansView {
  running: LoanSummaryView[];
  pending: LoanSummaryView[];
  finished: LoanSummaryView[];
  all: LoanSummaryView[];
  summary: { runningCount: number; pendingCount: number; finishedCount: number; outstanding: string; nextDue: { dueDate: string; amount: string } | null };
}

// ---------------------------------------------------------------------------
// Payments and proofs
// ---------------------------------------------------------------------------

export interface PaymentView {
  id: string;
  receiptNumber: string;
  loanId: string;
  loanNumber: string;
  borrowerName: string;
  amount: string;
  paymentDate: string;
  /** CASH, BANK_TRANSFER, E_WALLET or SOLIDARITY_FUND (paymentMethodLabel shows it). */
  method: string;
  reference: string | null;
  kind: PaymentKind | null;
  penalty: string;
  interest: string;
  principal: string;
  excess: string;
  status: 'POSTED' | 'REVERSED';
  collectedBy: string;
  postedBy: string | null;
  proofId: string | null;
  reversal: { reference: string | null; at: string | null; by: string | null; reason: string | null } | null;
}

export interface ProofView {
  id: string;
  loanId: string;
  loanNumber: string | null;
  borrowerId: string;
  borrowerName: string | null;
  amount: string;
  method: string;
  referenceNumber: string | null;
  paymentDate: string;
  notes: string | null;
  fileName: string | null;
  status: string;
  submittedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  paymentId: string | null;
  /** Storage reference "backend:path" for staff to open the file; not sent to members. */
  storageRef: string | null;
}

/** What it takes to settle or catch up on a loan today (GET /loans/:id/payoff). */
export interface PayoffQuoteView {
  loanId: string;
  loanNumber: string;
  status: LoanStatus;
  /** The date the figures are for. */
  asOf: string;
  /** Due now: installments due up to asOf, penalties included. */
  due: string;
  /** Settles the whole loan today. */
  payoff: string;
  daysPastDue: number;
  penaltyRate: string;
  installments: {
    number: number;
    dueDate: string;
    principalDue: string;
    interestDue: string;
    penaltyDue: string;
    principalPaid: string;
    interestPaid: string;
    penaltyPaid: string;
    status: string;
  }[];
}

// ---------------------------------------------------------------------------
// Savings
// ---------------------------------------------------------------------------

export interface SavingsAccountView {
  id: string;
  passbookNumber: string;
  memberId: string;
  memberName: string;
  branchId: string | null;
  product: {
    id: string;
    code: string;
    name: string;
    kind: SavingsKind;
    annualRate: string;
    accrualMethod: AccrualMethod;
    minimumBalance: string;
    maxWithdrawalAmount: string | null;
    maxWithdrawalsPerMonth: number | null;
  };
  status: SavingsStatus;
  statusReason: string | null;
  balance: string;
  /** What could be withdrawn now under the product rules (0 when blocked). */
  available: string;
  withdrawalBlockedBy: string | null;
  openedAt: string | null;
  closedAt: string | null;
  maturityDate: string | null;
  lastActivityDate: string | null;
  groupId: string | null;
}

export interface SavingsStatementLine {
  id: string;
  number: string;
  date: string;
  kind: SavingsTxnKind;
  label: string;
  moneyIn: string | null;
  moneyOut: string | null;
  /** Running balance after this line. */
  balance: string;
  method: string | null;
  reference: string | null;
  destinationAccount: string | null;
  processedBy: string;
  notes: string | null;
  interestPeriod: string | null;
}

export interface SavingsStatementView {
  account: SavingsAccountView;
  from: string | null;
  to: string;
  openingBalance: string;
  totalIn: string;
  totalOut: string;
  closingBalance: string;
  lines: SavingsStatementLine[];
}

export interface WithdrawalRequestView {
  id: string;
  requestNumber: string;
  accountId: string | null;
  memberId: string;
  memberName: string;
  branchId: string;
  amount: string;
  destination: string | null;
  destinationAccount: string | null;
  reason: string;
  status: string;
  requestedOn: string;
  rejectionReason: string | null;
  decidedAt: string | null;
  transactionId: string | null;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface GroupMemberLoanView {
  id: string;
  loanNumber: string;
  status: string;
  remaining: string;
  overdue: string;
  dueToday: string;
  oldestOverdue: string | null;
}

export interface CoverView {
  id: string;
  coverNumber: string;
  loanId: string;
  borrowerId: string;
  paymentId: string;
  amount: string;
  repaid: string;
  outstanding: string;
  status: string;
  reason: string;
  createdAt: string;
  createdByName: string | null;
  repaidAt: string | null;
}

/** The member's own group as the portal and app show it (GET /groups/my). */
export interface MyGroupView {
  group: {
    id: string;
    groupCode: string;
    groupName: string;
    centerName: string;
    branchId: string;
    status: GroupStatus;
    statusReason: string | null;
    formedDate: string;
    meetingDay: string;
    meetingTime: string;
    meetingFrequency: string;
    meetingLocation: string;
    loanOfficerName: string;
    leaderBorrowerId: string | null;
    leaderName: string | null;
    arrearsThresholdDays: number;
    fundBalance: string;
  };
  /** Other members' names, roles and whether they are up to date; never their amounts. */
  members: { borrowerId: string; fullName: string; role: GroupRole; standing: 'GOOD' | 'BEHIND' }[];
  me: { role: GroupRole; coverOwed: string; loans: GroupMemberLoanView[] } | null;
  blocked: boolean;
  fund: { balance: string; myCovers: (CoverView & { memberName: string; loanNumber: string })[] };
  pendingLoans: {
    id: string;
    loanNumber: string;
    borrowerName: string;
    principalAmount: string;
    termMonths: number;
    mine: boolean;
    myDecision: string | null;
    consented: number;
    required: number;
  }[];
  meetings: { meetingDate: string; present: number; total: number; me: string | null }[];
}

// ---------------------------------------------------------------------------
// Home, notifications, profile, account
// ---------------------------------------------------------------------------

export interface ClientDashboardView {
  member: { id: string; fullName: string; memberNumber: string; kycStatus: KycStatus };
  loans: {
    running: {
      id: string;
      loanNumber: string;
      productName: string;
      status: LoanStatus;
      principal: string;
      totalPayable: string;
      totalPaid: string;
      remainingBalance: string;
      nextDue: { dueDate: string; amount: string } | null;
      daysBehind: number;
    }[];
    pendingApplications: { id: string; loanNumber: string; productName: string; status: LoanStatus; principal: string; applicationDate: string }[];
    outstanding: string;
    nextDue: { dueDate: string; amount: string; loanNumber: string | null } | null;
    overdueCount: number;
  };
  savings: {
    total: string;
    accounts: { id: string; passbookNumber: string; productName: string; kind: SavingsKind; status: SavingsStatus; balance: string; available: string }[];
  };
  group: { id: string; name: string; role: string; status: string } | null;
  /** Posted repayments per month, oldest first ("YYYY-MM"). */
  repayments: { month: string; amount: string }[];
  recentActivity: ClientTransactionView[];
  notifications: { unread: number; latest: { id: string; title: string; message: string; isRead: boolean; createdAt: string | null }[] };
}

/** One row of the member's transaction history (GET /api/client/transactions). */
export interface ClientTransactionView {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  kind: TransactionKind;
  /** What happened, e.g. "Loan repayment" or "Solidarity Fund Contribution". */
  label: string;
  reference: string;
  /** Decimal pesos, always positive; see direction. */
  amount: string;
  direction: 'IN' | 'OUT';
  /** Loan, Savings or Solidarity Fund. */
  account: string;
  method: string;
  status: string;
  notes: string | null;
}

export interface ClientNotificationView {
  id: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  createdAt: string;
}

/** The signed-in member's own record (GET /api/client/profile). Missing text is ''. */
export interface ClientProfileView {
  id: string;
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  email: string;
  phone: string;
  address: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  postalCode: string;
  gender: string;
  dateOfBirth: string;
  civilStatus: string;
  employmentStatus: string;
  occupation: string;
  employer: string;
  /** Declared monthly income, decimal pesos ("25000.00"). */
  monthlyIncome: string;
  /** Uploaded photo, or null (screens then show initials). */
  avatar: string | null;
  memberNumber: string;
  membershipDate: string;
  kycStatus: string;
  creditScore: number;
  creditTier: string;
}

export interface ClientDocumentView {
  id: string;
  name: string;
  type: string;
  date: string;
  relatedLoanNumber?: string;
  hasFile: boolean;
}

export interface SignInView {
  id: string;
  time: string;
}

/** The member's own branch, which answers their messages (GET /api/client/support/contact). */
export interface SupportContactView {
  branchName: string;
  address: string;
  city: string;
  phone: string;
}

export interface FaqView {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface SupportRequestView {
  id: string;
  subject: string;
  category: string;
  sentAt: string | null;
  read: boolean;
}

// ---------------------------------------------------------------------------
// KYC (GET /api/client/kyc-status)
// ---------------------------------------------------------------------------

export interface KycRequirementStatusView {
  /** Document kind, e.g. ID_FRONT, SELFIE, PROOF_OF_INCOME. */
  type: string;
  name: string;
  submitted: boolean;
  /** The document's review status, or NOT_UPLOADED. */
  status: string;
  fileUrl: string | null;
  fileName: string | null;
}

/** What the member record already holds, used to prefill the KYC form. */
export interface KycMemberPrefillView {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  hasNoMiddleName: boolean | null;
  dateOfBirth: string;
  gender: string;
  civilStatus: string;
  phone: string;
  email: string;
  emailVerified: boolean;
  street: string;
  region: string | null;
  regionCode: string | null;
  province: string | null;
  provinceCode: string | null;
  city: string | null;
  cityCode: string | null;
  barangay: string | null;
  barangayCode: string | null;
  postalCode: string | null;
  employmentStatus: string;
  employerOrBusiness: string;
  occupation: string;
  sourceOfIncome: string | null;
  monthlyIncome: number;
  monthlyExpenses: number;
  idType: string | null;
  idNumber: string;
}

/** The saved application (draft or submitted), section by section. */
export interface KycApplicationView {
  personalInfo: Record<string, unknown> | null;
  address: Record<string, unknown> | null;
  contactInfo: Record<string, unknown> | null;
  employment: Record<string, unknown> | null;
  governmentId: Record<string, unknown> | null;
  declarations: Record<string, unknown> | null;
}

export interface KycStatusView {
  kycStatus: KycStatus;
  statusLabel: string;
  isVerified: boolean;
  /** Whether the member may change and (re)submit the application now. */
  editable: boolean;
  applicationStatus: KycStatus;
  currentStep: number;
  referenceNumber: string | null;
  submissionCount: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  verifiedAt: string | null;
  decisionReason: string | null;
  rejectionReason: string | null;
  correctionReason: string | null;
  correctionDetails: { sections: string[]; reason: string | null } | null;
  requiredDocuments: KycRequirementStatusView[];
  member: KycMemberPrefillView;
  submission: KycApplicationView;
}

/** What the automated scanner read from an ID photo (null fields were not found). */
export interface IdScanFieldsView {
  status: string;
  provider: string | null;
  isReadable: boolean | null;
  confidenceScore: number | null;
  detectedType: string | null;
  validationWarnings: string[];
  idType: string | null;
  idNumber: string | null;
  fullName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  issueDate: string | null;
  expirationDate: string | null;
}

/** POST /api/client/kyc/process-id */
export interface IdScanView {
  validation: {
    status: 'COMPLETED' | 'UNAVAILABLE' | 'FAILED';
    isReadable: boolean | null;
    confidenceScore: number | null;
    detectedType: string | null;
    validationWarnings: string[];
    qualityChecks: QualityMetrics | null;
    /** What to tell the member about the photo and the reading. */
    qualityMessage: string;
  };
  extractedData: IdScanFieldsView | null;
  document: { id: string; frontFileUrl: string | null; backFileUrl: string | null };
}

export interface FaceMatchResultView {
  status: 'MATCH' | 'LOW_CONFIDENCE' | 'NO_MATCH' | 'UNAVAILABLE' | 'FAILED';
  matchStatus: 'MATCH' | 'LOW_CONFIDENCE' | 'NO_MATCH' | 'UNAVAILABLE' | 'FAILED';
  isMatch: boolean;
  matchConfidence: number | null;
  details: string | null;
  recommendation: 'RETRY_SELFIE' | 'CONTINUE' | 'MANUAL_REVIEW';
  processedAt: string;
}

/** POST /api/client/kyc/match-face */
export interface FaceMatchView {
  matchResult: FaceMatchResultView | null;
  selfie: { id: string; fileUrl: string | null };
}

/** POST /api/client/kyc/documents/upload */
export interface KycUploadView {
  document: { id: string; documentType: string; fileName: string | null; fileUrl: string | null; status: string };
}

/** A PSGC region, province, city/municipality or barangay (GET /api/geography/*). */
export interface PsgcPlaceView {
  code: string;
  name: string;
}
