export type UserRole =
  | 'SUPER_ADMIN'
  | 'MANAGER'
  | 'LOAN_PROCESSOR'
  | 'BOOKKEEPER'
  | 'CREDIT_COMMITTEE'
  | 'EDUCATION_COMMITTEE'
  | 'BOARD_OF_DIRECTORS'
  | 'TELLER'
  | 'AUDITOR';

export interface UserStaff {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedBranchId: string; // 'all' or specific branchId
  title: string;
  avatar: string;
  committee?: 'Credit Committee' | 'Education Committee' | 'Board of Directors' | 'Management' | 'Operations';
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  managerName: string;
  managerEmail: string;
  activeDisbursedPool: number;
  cashVaultBalance: number;
  activeLoansCount: number;
  color: string;
}

export type InterestType = 'Reducing Balance' | 'Flat Rate';
export type RepaymentFrequency = 'Daily' | 'Weekly' | 'Semi-monthly' | 'Monthly' | 'Bi-Weekly';

export interface LoanProduct {
  id: string;
  code: string;
  name: string;
  category: string;
  interestRate: number; // annual %
  interestType: InterestType;
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  repaymentFrequency?: RepaymentFrequency;
  defaultRepaymentFrequency: RepaymentFrequency;
  processingFeePercentage: number;
  latePenaltyRate: number; // % monthly on overdue amount
  earlySettlementRebateRate: number; // % rebate on remaining unaccrued interest for advance payment
  requiresCollateral: boolean;
  requiresGuarantor: boolean;
  description: string;
  badgeColor: string;
}

export type KycStatus = 'Verified' | 'Pending Review' | 'Correction Requested' | 'Incomplete' | 'Rejected';
export type CreditTier = 'Excellent' | 'Good' | 'Fair' | 'High Risk';
export type ClientStatus = 'Pending' | 'Active' | 'Inactive' | 'Suspended' | 'Rejected' | 'Irregular' | 'Under Review' | 'Resigned' | 'Probationary';
export type MemberStatus = ClientStatus;

export type KycDocumentType =
  | 'Government ID (Primary)'
  | 'Government ID (Secondary)'
  | 'Proof of Income / Payslip / ITR'
  | 'Business Permit / DTI'
  | 'Proof of Billing / Residence'
  | '2x2 ID Photo'
  | 'Barangay Clearance'
  | 'Signature Specimen'
  | 'Other Document';

export type KycDocumentStatus = 'Verified' | 'Pending Review' | 'Correction Requested' | 'Rejected';

export interface KycDocument {
  id: string;
  docType: KycDocumentType;
  fileName: string;
  fileUrl?: string;
  fileSize?: string;
  uploadedAt: string;
  uploadedBy?: string;
  status: KycDocumentStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  correctionNotes?: string;
  rejectionReason?: string;
}

export interface ClientStatusLog {
  id: string;
  date: string;
  fromStatus: ClientStatus;
  toStatus: ClientStatus;
  changedBy: string;
  reason: string;
}

export interface KycReviewLog {
  id: string;
  date: string;
  reviewerName: string;
  reviewerRole: string;
  decision: 'APPROVED' | 'CORRECTION_REQUESTED' | 'REJECTED';
  notes: string;
  itemsChecked?: string[];
}

export interface Borrower {
  id: string;
  borrowerNumber: string;
  clientId?: string;
  fullName: string;
  idNumber: string;
  idType?: string;
  phone: string;
  secondaryPhone?: string;
  email: string;
  dateOfBirth: string;
  placeOfBirth?: string;
  nationality?: string;
  gender: 'Male' | 'Female' | 'Other';
  civilStatus: 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Divorced';
  address: string;
  barangay?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  homeOwnership?: 'Owned' | 'Rented' | 'Living with Parents/Family' | 'Mortgaged';
  yearsAtAddress?: number;
  facebookAccount?: string;
  branchId: string;
  employmentStatus: 'Employed' | 'Self-Employed' | 'Business Owner' | 'Contractor' | 'Farmer' | 'OFW / Overseas Worker' | 'Retired';
  employerOrBusiness: string;
  employer?: string;
  businessNature?: string;
  occupation: string;
  yearsInBusinessOrJob?: number;
  workAddress?: string;
  workPhone?: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  creditScore: number;
  creditTier: CreditTier;
  kycStatus: KycStatus;
  memberStatus: MemberStatus;
  clientStatus?: ClientStatus;
  kycDocuments?: KycDocument[];
  kycReviewLogs?: KycReviewLog[];
  kycCorrectionNotes?: string;
  kycRejectionReason?: string;
  statusChangeReason?: string;
  kycReviewedBy?: string;
  kycReviewedAt?: string;
  statusLogs?: ClientStatusLog[];
  membershipDate: string;
  savingsBalance: number;
  shareCapital: number;
  activeLoansCount: number;
  totalBorrowed: number;
  totalRepaid: number;
  avatar: string;
  joinedDate: string;
  lastActivityDate: string;
  notes?: string;
}

// 1. MEMBERSHIP APPLICATION & APPROVAL PIPELINE (5-step process ~1 month)
export type MembershipStep =
  | 'SUBMITTED' // Step 1: Form & Docs submitted
  | 'STAFF_VERIFIED' // Step 2: Staff checked completeness & encoded
  | 'PAYMENT_PROCESSED' // Step 3: Membership fee (₱500) + Share Capital processed
  | 'EDUCATION_COMM_BI' // Step 4: Education Committee B.I. & PMES seminar
  | 'BOD_APPROVED' // Step 5: Board of Directors Final Approval
  | 'REJECTED';

export interface BackgroundInvestigation {
  investigatorName: string;
  investigationDate: string;
  communityReputation: 'Excellent' | 'Good' | 'Satisfactory' | 'Poor';
  residenceConfirmed: boolean;
  incomeSourceVerified: boolean;
  pmesSeminarAttended: boolean; // Pre-Membership Education Seminar
  recommendation: 'RECOMMEND_APPROVAL' | 'CONDITIONAL' | 'DEFER' | 'REJECT';
  findingsNotes: string;
}

export interface MembershipApplication {
  id: string;
  applicationNumber: string;
  applicantName: string;
  dateOfBirth: string;
  civilStatus: 'Single' | 'Married' | 'Widowed' | 'Separated';
  phone: string;
  email: string;
  facebookAccount?: string;
  address: string;
  occupation: string;
  employerOrBusiness: string;
  monthlyIncome: number;
  branchId: string;
  submittedDate: string;
  currentStep: MembershipStep;
  step?: MembershipStep; // convenience alias
  
  // Required Docs
  validIdAttached: boolean;
  proofOfIncomeAttached: boolean;
  twoByTwoPhotoAttached: boolean;
  membershipFeePaid: boolean; // ₱500
  initialShareCapital: number; // e.g. ₱2,000
  
  // Investigation & Approvals
  encodedBy?: string;
  encodedDate?: string;
  backgroundInvestigation?: BackgroundInvestigation;
  bodReviewDate?: string;
  bodApprovedBy?: string[];
  bodNotes?: string;
  rejectionReason?: string;
  targetCompletionDate: string; // approx 1 month
  createdBorrowerId?: string;
}

// 1.2 MEMBER INFO UPDATE REQUESTS
export type UpdateChannel = 'Office Visit' | 'Mobile Phone' | 'Facebook Account';
export type UpdateRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface MemberUpdateRequest {
  id: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  branchId: string;
  requestDate: string;
  channel: UpdateChannel;
  fieldToUpdate: 'Civil Status' | 'Address' | 'Contact Number' | 'Employment' | 'Beneficiary';
  oldValue: string;
  newValue: string;
  reason: string;
  supportingDocType: 'Marriage Contract' | 'Barangay Certificate' | 'Valid ID' | 'Proof of Billing' | 'Other';
  supportingDocFileName?: string;
  supportingDocVerified: boolean;
  status: UpdateRequestStatus;
  reviewedBy?: string;
  reviewDate?: string;
  remarks?: string;
}

// 1.3 INACTIVE MEMBER MONITORING & FOLLOW-UP VISITS
export interface MemberFollowUpLog {
  id: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  branchId: string;
  date: string;
  contactChannel: 'Facebook' | 'SMS' | 'Phone Call' | 'Education Committee Field Visit';
  conductedBy: string;
  hasOutstandingLoan: boolean;
  outstandingLoanAmount: number;
  purpose: 'Inactivity Check' | 'Loan Follow-up' | 'Savings Reactivation' | 'General Welfare';
  memberResponse: string;
  nextFollowUpDate?: string;
  actionTaken: 'Payment Promised' | 'Restructuring Requested' | 'Contact Updated' | 'No Answer' | 'Reactivated';
}

// 2. SAVINGS MANAGEMENT (1% p.a., ₱1,000 maintaining balance, flexible withdrawal with Manager approval)
export type SavingsAccountStatus = 'Active' | 'Dormant' | 'Suspended' | 'Closed';
export type SavingsAccountType = 'Regular Savings' | 'Capital Build-up' | 'Time Deposit' | 'Special Savings' | 'Youth Savings';
export type SavingsTransactionType = 'Deposit' | 'Withdrawal' | 'Interest Credited' | 'Account Opening' | 'Transfer' | 'Fee / Charge';

export interface SavingsAccountStatusLog {
  id: string;
  date: string;
  fromStatus: SavingsAccountStatus;
  toStatus: SavingsAccountStatus;
  changedBy: string;
  reason: string;
}

export interface SavingsAccount {
  id: string;
  accountNumber: string; // Unique Savings Account ID (e.g. SAV-2026-00101)
  clientId: string; // Member / Borrower ID
  clientName: string;
  memberId?: string;
  memberName?: string;
  clientNumber?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAvatar?: string;
  branchId: string;
  accountType: SavingsAccountType;
  balance: number; // Current balance
  availableBalance: number; // Balance minus maintaining balance
  maintainingBalance: number; // e.g. 1000
  interestRate: number; // e.g. 1.0% p.a.
  status: SavingsAccountStatus;
  statusReason?: string;
  openedDate: string;
  lastTransactionDate: string;
  totalDeposited: number;
  totalWithdrawn: number;
  totalInterestEarned: number;
  notes?: string;
  passbookNumber?: string;
  statusLogs?: SavingsAccountStatusLog[];
}

export interface SavingsTransaction {
  id: string;
  savingsAccountId: string;
  accountNumber?: string;
  memberId: string;
  clientId?: string;
  memberName: string;
  branchId?: string;
  transactionNumber: string;
  referenceNumber?: string;
  date: string;
  type: SavingsTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentMethod?: string;
  processedBy: string;
  processedByRole?: string;
  notes?: string;
  officialReceiptNumber?: string;
}

export type WithdrawalStatus = 'Pending Approval' | 'Approved & Released' | 'Rejected';

export interface SavingsWithdrawalRequest {
  id: string;
  requestId: string;
  memberId: string;
  memberName: string;
  branchId: string;
  currentBalance: number;
  requestedAmount: number;
  maintainingBalance: number; // ₱1,000
  remainingBalanceAfter: number;
  requestDate: string;
  reason: string;
  tellerName: string;
  tellerRecordedDate: string;
  status: WithdrawalStatus;
  approvedByManager?: string;
  approvalDate?: string;
  disbursedDate?: string;
  rejectionReason?: string;
}

export interface InterestCreditLog {
  id: string;
  periodMonth: string; // e.g. "August 2026"
  calculationDate: string;
  annualRate: number; // 1.0%
  totalMembersCredited: number;
  totalInterestDistributed: number;
  executedBy: string;
}

// 3. LOAN MANAGEMENT WITH COOPERATIVE 6-STEP APPROVAL & VOUCHERS
export type CoopLoanStep =
  | 'SUBMITTED' // Step 1: Member applied with requirements
  | 'PROCESSOR_VERIFIED' // Step 2: Loan processor eligibility & capacity-to-pay check
  | 'BOOKKEEPER_VERIFIED' // Step 3: Accounting / Bookkeeper verification
  | 'CREDIT_COMM_INTERVIEW' // Step 4: Credit Committee interview & evaluation
  | 'VOUCHER_PREPARED' // Step 5: Accounting prepares loan voucher
  | 'MANAGER_APPROVED' // Step 6: Manager signs off voucher
  | 'DISBURSED' // Released funds
  | 'REJECTED';

export interface CreditCommitteeEvaluation {
  committeeChair?: string;
  evaluatorNames?: string[];
  interviewDate: string;
  characterRating?: 'High' | 'Medium' | 'Low';
  capacityToPayRating?: 'Strong' | 'Adequate' | 'Marginal';
  collateralOrGuarantorRating?: 'Acceptable' | 'Marginal' | 'None';
  debtServiceRatio?: number;
  capacityToPayScore?: number; // 0-100
  existingCoopLoansCheck?: string;
  existingLoansStatus?: 'No Existing Loan' | 'Existing Loan Performing Well' | 'Multiple Loans Allowed' | 'Delinquent';
  dtiPercentage?: number; // Debt-to-Income
  interviewNotes?: string;
  committeeNotes?: string;
  approvalVerdict: 'Approved' | 'Approved with Conditions' | 'Rejected' | 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED';
  approvedAmount: number;
  approvedTermMonths?: number;
}

export interface LoanDisbursementVoucher {
  voucherNumber: string;
  preparedByBookkeeper: string;
  preparedDate: string;
  grossAmount: number;
  processingFee: number;
  serviceFee: number;
  capitalBuildUpDeduction: number; // Coop standard deduction
  insuranceFee: number;
  netProceeds: number;
  approvedByManager?: string;
  approvedDate?: string;
  checkNumberOrRef?: string;
  paymentMode: 'Cash' | 'Check' | 'Bank Transfer' | 'GCash';
}

export interface CollateralItem {
  id: string;
  type: string;
  description: string;
  estimatedValue: number;
  documentRefNumber?: string;
  registrationNumber?: string;
  verified?: boolean;
  valuationDate?: string;
}

export type Collateral = CollateralItem;

export interface GuarantorItem {
  id: string;
  fullName: string;
  relationship: string;
  phone: string;
  idNumber: string;
  occupation?: string;
  monthlyIncome: number;
  verified?: boolean;
}

export type Guarantor = GuarantorItem;

export type InstallmentStatus = 'Upcoming' | 'Due' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Due Today' | 'Pending' | 'Partial';

export interface InstallmentScheduleItem {
  installmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  fees: number;
  totalDue: number;
  amountPaid: number;
  remainingBalance: number;
  status: InstallmentStatus;
  paidDate?: string;
  lateFeeApplied?: number;
  earlyRebateApplied?: number;
}

export type LoanStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Disbursed'
  | 'Active'
  | 'Completed'
  | 'Defaulted'
  | 'Underwriting'
  | 'In Arrears'
  | 'Settled';

export interface LoanApprovalInfo {
  approvedBy: string;
  approvedByRole: string;
  approvalDate: string;
  approvedAmount: number;
  approvedInterestRate: number;
  approvedTermMonths: number;
  resolutionNumber?: string;
  conditions?: string[];
  notes: string;
}

export interface LoanRejectionInfo {
  rejectedBy: string;
  rejectedByRole: string;
  rejectionDate: string;
  rejectionReason: string;
  remarks?: string;
}

export interface LoanDisbursementInfo {
  disbursedBy: string;
  disbursedByRole: string;
  disbursementDate: string;
  disbursementMethod: string;
  referenceNumber: string;
  grossAmount: number;
  processingFee: number;
  insuranceFee: number;
  capitalBuildUpDeduction: number;
  otherDeductions: number;
  netProceeds: number;
  notes?: string;
}

export interface AIUnderwritingReport {
  recommendation: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'MANUAL_REVIEW' | 'REJECTED';
  confidenceScore: number;
  riskRating: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
  debtToIncomeRatio: number;
  netDisposableIncome: number;
  collateralCoverageRatio: number;
  maxRecommendedAmount: number;
  summary: string;
  strengths: string[];
  riskFactors: string[];
  recommendedConditions: string[];
  recommendedTenorMonths: number;
  evaluatedAt: string;
}

export interface Loan {
  id: string;
  loanNumber: string;
  borrowerId: string;
  borrowerName: string;
  borrowerPhone: string;
  borrowerAvatar?: string;
  branchId: string;
  productId: string;
  productName: string;
  principalAmount: number;
  interestRate: number;
  interestType: InterestType;
  repaymentFrequency: RepaymentFrequency;
  termMonths: number;
  totalInstallments: number;
  processingFee: number;
  totalInterest: number;
  totalPayable: number;
  totalPaid: number;
  remainingBalance: number;
  status: LoanStatus;
  coopStep: CoopLoanStep; // 6-step cooperative pipeline
  applicationDate: string;
  startDate?: string; // convenient alias for origination date
  approvalDate?: string;
  disbursedDate?: string;
  nextPaymentDate?: string;
  maturityDate: string;
  loanOfficerId: string;
  loanOfficerName: string;
  purpose: string;
  collateral: CollateralItem[];
  collaterals: CollateralItem[];
  guarantors: GuarantorItem[];
  schedule: InstallmentScheduleItem[];
  underwritingReport?: AIUnderwritingReport;
  creditCommitteeEval?: CreditCommitteeEvaluation;
  disbursementVoucher?: LoanDisbursementVoucher;
  lastPaymentDate?: string;
  daysInArrears?: number;
  isIrregularAccount?: boolean; // Late payments flag account as irregular
  totalLatePenaltiesCharged?: number;
  totalRebatesAwarded?: number; // Advance payment rebates
  disbursementMethod?: string;
  disbursementAccount?: string;
  officerInCharge?: string;
  approvalInfo?: LoanApprovalInfo;
  rejectionInfo?: LoanRejectionInfo;
  disbursementInfo?: LoanDisbursementInfo;
  approvedBy?: string;
  disbursedBy?: string;
  rejectionReason?: string;
}

// 4. PAYMENT SERVICES & OFFICIAL RECEIPTS
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'GCash' | 'Debit Card' | 'Cheque' | 'Mobile Money';

export interface PaymentRecord {
  id: string;
  receiptNumber: string; // Official Receipt (OR) Number
  loanId: string;
  loanNumber: string;
  borrowerId: string;
  borrowerName: string;
  branchId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference: string; // GCash ref # or Bank deposit slip #
  collectedBy: string;
  principalPortion: number;
  interestPortion: number;
  penaltyPortion: number;
  rebateDiscount: number; // Early settlement rebate discount
  paymentScheduleType: RepaymentFrequency; // Daily, Weekly, Semi-monthly, Monthly
  isAdvancePayment: boolean;
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  performedBy: string;
  branchId: string;
  type: 'MEMBERSHIP' | 'SAVINGS' | 'LOAN' | 'PAYMENT' | 'BORROWER' | 'SYSTEM' | 'SECURITY';
  userName?: string;
  userRole?: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
}

export interface ReminderItem {
  id: string;
  borrowerId: string;
  borrowerName: string;
  borrowerPhone: string;
  borrowerEmail: string;
  borrowerFacebook?: string;
  loanId: string;
  loanNumber: string;
  amountDue: number;
  dueDate: string;
  daysOverdue: number;
  channel: 'SMS' | 'Facebook' | 'Phone Call' | 'Field Visit';
  status: 'Sent' | 'Delivered' | 'Pending';
  sentAt?: string;
  messagePreview?: string;
}

export interface SolidarityGroupMember {
  borrowerId: string;
  borrowerNumber?: string;
  fullName: string;
  phone: string;
  role: 'Leader' | 'Treasurer' | 'Secretary' | 'Member';
  activeLoanAmount: number;
  remainingBalance: number;
  savingsBalance: number;
  status: 'Good Standing' | 'Due' | 'Arrears' | 'Solidarity Covered';
  weeklyDues: number;
  totalPaidToDate?: number;
  daysLate?: number;
  isAttendingMeeting?: boolean;
  meetingPaymentPaid?: boolean;
}

export type GroupLoanStatus =
  | 'Under Review'
  | 'Approved'
  | 'Disbursed'
  | 'Active'
  | 'Settled'
  | 'In Arrears'
  | 'Defaulted'
  | 'Rejected';

export interface GroupLoanMemberObligation {
  borrowerId: string;
  borrowerName: string;
  borrowerNumber?: string;
  phone?: string;
  role: 'Leader' | 'Treasurer' | 'Secretary' | 'Member';
  allocatedPrincipal: number;
  allocatedInterest: number;
  totalObligation: number;
  periodicDues: number; // e.g. weekly dues amount
  totalPaid: number;
  remainingBalance: number;
  status: 'Current' | 'Due' | 'In Arrears' | 'Settled' | 'Solidarity Covered';
  daysInArrears?: number;
  solidarityCoveredAmount?: number;
}

export interface GroupLoan {
  id: string;
  groupLoanNumber: string; // e.g. GLOAN-2026-0012
  groupId: string;
  groupCode: string;
  groupName: string;
  centerName: string;
  branchId: string;
  productId: string;
  productName: string;
  totalPrincipalAmount: number;
  interestRate: number;
  termMonths: number;
  repaymentFrequency: RepaymentFrequency;
  totalInterest: number;
  totalPayable: number;
  totalPaid: number;
  remainingBalance: number;
  status: GroupLoanStatus;
  applicationDate: string;
  approvalDate?: string;
  disbursedDate?: string;
  maturityDate: string;
  loanOfficerId: string;
  loanOfficerName: string;
  purpose: string;
  memberObligations: GroupLoanMemberObligation[];
  solidarityAgreementSigned: boolean;
  repaymentRate: number; // percentage
  delinquentMembersCount: number;
}

export interface GroupMeetingAttendance {
  borrowerId: string;
  borrowerName: string;
  role: string;
  status: 'Present' | 'Absent' | 'Excused';
  notes?: string;
}

export interface GroupMeetingCollection {
  borrowerId: string;
  borrowerName: string;
  expectedDue: number;
  amountPaid: number;
  solidarityContribution: number; // mandatory savings/emergency fund e.g. ₱100
  paymentStatus: 'Paid in Full' | 'Partial' | 'Unpaid' | 'Covered by Solidarity';
  coveredBySolidarityFund?: boolean;
  solidarityAmountCovered?: number;
  notes?: string;
}

export interface GroupMeetingLog {
  id: string;
  meetingNumber: string; // e.g. MTG-2026-042
  groupId: string;
  groupCode: string;
  groupName: string;
  centerName: string;
  meetingDate: string;
  meetingTime: string;
  meetingLocation: string;
  presidedBy: string;
  presidedByRole: string;
  attendances: GroupMeetingAttendance[];
  collections: GroupMeetingCollection[];
  totalExpectedCollections: number;
  totalActualCollections: number;
  totalSolidarityFundCollected: number;
  totalSolidarityCoveredUsed: number;
  attendanceRate: number; // percentage
  meetingNotes: string;
  recordedAt: string;
}

export interface SolidarityGroup {
  id: string;
  groupCode: string;
  groupName: string;
  centerName: string;
  branchId: string;
  formedDate: string;
  meetingDay: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  meetingTime: string;
  meetingLocation: string;
  loanOfficerId: string;
  loanOfficerName: string;
  leaderBorrowerId: string;
  leaderName: string;
  leaderPhone: string;
  members: SolidarityGroupMember[];
  totalActiveLoans: number;
  totalGroupSavings: number;
  repaymentRate: number;
  solidarityFundBalance: number;
  jointLiabilityAgreed: boolean;
  status: 'Active' | 'Under Review' | 'Graduated' | 'Delinquent';
  activeGroupLoanId?: string;
  activeGroupLoanNumber?: string;
  delinquencyStatus: 'Healthy' | 'At Risk' | 'Delinquent' | 'Solidarity Covered';
  parRate: number; // Portfolio at Risk percentage
  totalMeetingsHeld: number;
}

