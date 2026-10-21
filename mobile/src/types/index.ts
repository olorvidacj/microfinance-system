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
  // GET /client/loan-applications returns raw `loans` rows, whose status is the
  // server's pipeline text (Draft / Submitted / Under Review / For Assessment /
  // Approved / Rejected / Cancelled), so the union has to cover those too.
  status:
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'DISBURSED'
    | 'DRAFT'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'FOR_ASSESSMENT'
    | 'CANCELLED'
    | (string & {});
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

export interface ExtractedIdData {
  idType?: string;
  idTypeName?: string;
  idNumber?: string;
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  dateOfBirth?: string;
  gender?: string;
  civilStatus?: string;
  nationality?: string;
  address?: string;
  houseNumber?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  issueDate?: string | null;
  expirationDate?: string | null;
  isExpired?: boolean;
  autoFilledFields?: string[];
  confidenceScore?: number;
}

export interface FaceMatchResult {
  isMatch: boolean;
  matchConfidence: number;
  matchStatus: 'MATCH' | 'MISMATCH' | 'UNCERTAIN';
  details: string;
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
  ocrData?: ExtractedIdData;
  ocrConfidence?: number;
  faceMatchResult?: FaceMatchResult;
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
  // Optional: the branch KYC queue response does not include a submission
  // number, and nothing in the app reads it.
  submissionNumber?: string;
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
  memberStatus?: string;
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

// ---------------------------------------------------------------------------
// Receipts / payments
// ---------------------------------------------------------------------------

export interface PaymentReceipt {
  id?: string;
  amount: number;
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
