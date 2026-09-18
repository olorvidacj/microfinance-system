// ---------------------------------------------------------------------------
// Development mock data. Mirrors the /api/client* and /api/branch* response
// shapes so the app renders meaningful content when the backend is offline.
// No screen imports this directly — it is served by the Service layer.
// ---------------------------------------------------------------------------

import {
  BranchContextData,
  BranchKycQueueItem,
  ClientDashboardData,
  ClientGroup,
  ClientProfile,
  FinancialTransaction,
  KycDocumentItem,
  KycRequiredDocumentItem,
  KycStatusData,
  KYCStatus,
  LoanApplication,
  LoanCalculation,
  LoanProduct,
  LoanItem,
  InstallmentScheduleItem,
  MobileNotification,
  NotificationsData,
  PaymentItem,
  PaymentReceipt,
  PortalDocument,
  SavingsAccount,
  SavingsTransaction,
  UserSession,
} from '../types';
import { addDays } from '../utils/format';

export const daysAgo = (n: number) => addDays(new Date(), -n);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const mockUserSession: UserSession = {
  token: 'mock-token-HOSCOMCO-client-001',
  user: {
    id: 'b-1',
    email: 'teresa.alcantara@example.com',
    fullName: 'Teresa Alcantara',
    name: 'Teresa Alcantara',
    role: 'CLIENT',
    borrowerId: 'b-1',
    phone: '+63 917 123 4567',
    avatar: 'https://i.pravatar.cc/150?img=47',
  },
};

// A staff session is used by the branch personnel demo login.
export const mockBranchUserSession: UserSession = {
  token: 'mock-token-HOSCOMCO-staff-001',
  user: {
    id: 'u-201',
    email: 'branch.officer@HOSCOMCO.ph',
    fullName: 'Elena Santos',
    name: 'Elena Santos',
    role: 'STAFF',
    staffRole: 'BRANCH_OFFICER',
    phone: '+63 917 555 0001',
  },
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const mockDashboard: ClientDashboardData = {
  borrowerName: 'Teresa Alcantara',
  memberNumber: 'MBR-2024-001',
  totalActiveLoan: 50000,
  remainingBalance: 24250,
  nextPayment: 4850,
  nextPaymentDueDate: daysAgo(-5),
  loanStatus: 'ACTIVE',
  activeLoansCount: 1,
  savingsBalance: 18500,
  totalSavingsDeposits: 23500,
  savingsGoal: 30000,
  savingsGoalName: 'Emergency Fund',
  totalPaid: 29100,
  totalPayments: 6,
  kycStatus: 'VERIFIED',
  recentTransactions: [
    { id: 'tx-1', type: 'REPAYMENT', amount: 4850, date: daysAgo(8), referenceNumber: 'OR-2026-0091', paymentMethod: 'GCASH', status: 'COMPLETED', description: 'Loan repayment — LN-2026-001' },
    { id: 'tx-2', type: 'SAVINGS_DEPOSIT', amount: 1500, date: daysAgo(6), referenceNumber: 'DEP-2026-0422', paymentMethod: 'OVER_THE_COUNTER', status: 'COMPLETED', description: 'Savings deposit' },
    { id: 'tx-3', type: 'LOAN_DISBURSEMENT', amount: 50000, date: daysAgo(150), referenceNumber: 'DISB-2026-011', paymentMethod: 'BANK_TRANSFER', status: 'COMPLETED', description: 'Loan disbursement — LN-2026-001' },
  ],
};

// A KYC-gated dashboard variant used to demonstrate the "Complete KYC first" flow.
export const mockDashboardKycBlocked: ClientDashboardData = {
  ...mockDashboard,
  kycStatus: 'NOT_STARTED',
  loanStatus: 'NO_ACTIVE_LOAN',
  totalActiveLoan: 0,
  remainingBalance: 0,
  nextPayment: 0,
  nextPaymentDueDate: '—',
  activeLoansCount: 0,
  totalPaid: 0,
  totalPayments: 0,
  recentTransactions: [],
};

// ---------------------------------------------------------------------------
// Profile & KYC
// ---------------------------------------------------------------------------

export const mockProfile: ClientProfile = {
  id: 'b-1',
  fullName: 'Teresa Alcantara',
  firstName: 'Teresa',
  middleName: 'R.',
  lastName: 'Alcantara',
  email: 'teresa.alcantara@example.com',
  phone: '+63 917 123 4567',
  secondaryPhone: '0918 234 5678',
  address: '14 San Pedro St, Poblacion, Tacloban City, Leyte 6500',
  houseUnit: '14',
  street: 'San Pedro St',
  barangay: 'Poblacion',
  city: 'Tacloban City',
  province: 'Leyte',
  postalCode: '6500',
  dateOfBirth: '1988-06-15',
  gender: 'Female',
  civilStatus: 'Married',
  nationality: 'Filipino',
  occupation: 'Store Owner / Proprietor',
  employer: 'Santos General Merchandise & Bakery',
  monthlyIncome: 45000,
  avatar: 'https://i.pravatar.cc/150?img=47',
  memberNumber: 'MBR-2024-001',
  membershipDate: '2024-01-18',
  kycStatus: 'VERIFIED',
  creditScore: 710,
  creditTier: 'STANDARD',
};

export const mockKycDocuments: KycDocumentItem[] = [
  { type: 'VALID_ID', name: 'Primary Government ID (UMID / Driver License / Passport)', submitted: true, status: 'VERIFIED', description: 'A valid, current government-issued photo ID.' },
  { type: 'PROOF_OF_ADDRESS', name: 'Barangay Clearance or Utility Bill', submitted: true, status: 'VERIFIED', description: 'Recent proof of residence within the last 3 months.' },
  { type: 'PROOF_OF_INCOME', name: 'Payslip / Business Permit / Bank Statement', submitted: true, status: 'VERIFIED', description: 'Evidence of regular income or business operations.' },
  { type: 'PHOTO_2X2', name: 'Recent 2x2 ID Photo', submitted: true, status: 'VERIFIED', description: 'A recent photograph with white background.' },
];

export const mockKycRequiredDocs: KycRequiredDocumentItem[] = [
  { id: 'doc-1', documentType: 'VALID_ID', documentName: 'Primary Government ID (UMID / Driver License / Passport)', description: 'A valid, current government-issued photo ID.', sortOrder: 1, isActive: true },
  { id: 'doc-2', documentType: 'PROOF_OF_ADDRESS', documentName: 'Barangay Clearance or Utility Bill', description: 'Recent proof of residence within the last 3 months.', sortOrder: 2, isActive: true },
  { id: 'doc-3', documentType: 'PROOF_OF_INCOME', documentName: 'Payslip / Business Permit / Bank Statement', description: 'Evidence of regular income or business operations.', sortOrder: 3, isActive: true },
  { id: 'doc-4', documentType: 'PHOTO_2X2', documentName: 'Recent 2x2 ID Photo', description: 'A recent photograph with white background.', sortOrder: 4, isActive: true },
];

export const mockKycStatus: KycStatusData = {
  kycStatus: 'VERIFIED',
  isVerified: true,
  requiredDocuments: mockKycDocuments,
  uploadedDocuments: mockKycDocuments,
  submissionId: 'KYC-2026-00382',
  submittedAt: '2026-01-12T09:24:00.000Z',
  reviewedAt: '2026-01-14T14:02:00.000Z',
  verifiedAt: '2026-01-14T14:02:00.000Z',
  reviewedByName: 'Elena Santos',
};

export const mockKycStatusPending: KycStatusData = {
  kycStatus: 'PENDING',
  isVerified: false,
  requiredDocuments: mockKycDocuments,
  uploadedDocuments: mockKycDocuments,
  submissionId: 'KYC-2026-00411',
  submittedAt: daysAgo(2),
  reviewedByName: undefined,
};

export const mockKycStatusCorrection: KycStatusData = {
  kycStatus: 'CORRECTION_REQUIRED',
  isVerified: false,
  requiredDocuments: mockKycDocuments,
  uploadedDocuments: mockKycDocuments,
  submissionId: 'KYC-2026-00398',
  submittedAt: daysAgo(5),
  correctionReason: 'The uploaded government ID is unclear. Please upload a higher-resolution photo of the ID.',
};

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export const mockLoanProducts: LoanProduct[] = [
  { id: 'prod-1', name: 'Micro Business Loan', code: 'MB-001', minAmount: 10000, maxAmount: 150000, minTermMonths: 3, maxTermMonths: 24, interestRatePerMonth: 1.5, interestType: 'REDUCING_BALANCE', processingFeePercentage: 2.0, description: 'Working capital financing for small businesses, market stalls, and trade shops.' },
  { id: 'prod-2', name: 'Agricultural Loan', code: 'AG-002', minAmount: 5000, maxAmount: 100000, minTermMonths: 3, maxTermMonths: 18, interestRatePerMonth: 1.25, interestType: 'FLAT_RATE', processingFeePercentage: 1.5, description: 'Financing for farming inputs, crop production, and farm equipment.' },
  { id: 'prod-3', name: 'Emergency Loan', code: 'EM-003', minAmount: 5000, maxAmount: 30000, minTermMonths: 3, maxTermMonths: 6, interestRatePerMonth: 1.0, interestType: 'FLAT_RATE', processingFeePercentage: 0.5, description: 'Rapid-disbursement assistance for emergencies and hospitalization.' },
  { id: 'prod-4', name: 'Education Loan', code: 'ED-004', minAmount: 10000, maxAmount: 120000, minTermMonths: 6, maxTermMonths: 24, interestRatePerMonth: 1.2, interestType: 'REDUCING_BALANCE', processingFeePercentage: 1.5, description: 'Tuition and school expenses for members and dependents.' },
];

export const mockLoans: LoanItem[] = [
  {
    id: 'LN-2026-001',
    loanNumber: 'LN-2026-001',
    productName: 'Micro Business Loan',
    principalAmount: 50000,
    interestRate: 18,
    interestType: 'REDUCING_BALANCE',
    termMonths: 12,
    monthlyInstallment: 4850,
    remainingBalance: 24250,
    paidAmount: 29100,
    totalPayable: 58200,
    totalInterest: 8200,
    status: 'ACTIVE',
    startDate: '2026-01-15',
    maturityDate: '2027-01-15',
    nextPaymentDate: daysAgo(-5),
    purpose: 'Store inventory replenishment',
    repaymentsMade: 6,
    repaymentsTotal: 12,
  },
  {
    id: 'LN-2025-088',
    loanNumber: 'LN-2025-088',
    productName: 'Agricultural Loan',
    principalAmount: 25000,
    interestRate: 15,
    interestType: 'FLAT_RATE',
    termMonths: 6,
    monthlyInstallment: 4479,
    remainingBalance: 0,
    paidAmount: 26875,
    totalPayable: 26875,
    totalInterest: 1875,
    status: 'PAID_OFF',
    startDate: '2025-06-01',
    maturityDate: '2025-12-01',
    purpose: 'Working capital for dry goods stall',
    repaymentsMade: 6,
    repaymentsTotal: 6,
  },
];

export const mockLoanApplications: LoanApplication[] = [
  { id: 'LN-APP-2026-004', productName: 'Micro Business Loan', principalAmount: 25000, termMonths: 6, applicationDate: daysAgo(12), status: 'UNDER_REVIEW', coopStep: 'CREDIT_INVESTIGATION', rejectionReason: null },
  { id: 'LN-2026-001', productName: 'Micro Business Loan', principalAmount: 50000, termMonths: 12, applicationDate: daysAgo(150), status: 'APPROVED', coopStep: 'DISBURSED', rejectionReason: null, disbursedAt: daysAgo(148) },
];

export const mockSchedule: InstallmentScheduleItem[] = Array.from({ length: 12 }, (_, i) => {
  const bal = Math.max(0, 50000 - (i + 1) * 2916.67);
  return {
    installmentNumber: i + 1,
    dueDate: addDays(new Date(), (i - 4) * 30),
    amountDue: 4850,
    principal: Math.round(2916.67),
    interest: Math.round(1933.33),
    remainingBalance: Math.round(bal),
    status: i < 6 ? 'PAID' : i === 6 ? 'DUE' : 'UPCOMING',
    paidDate: i < 6 ? addDays(new Date(), (i - 10) * 30) : null,
    receiptNumber: i < 6 ? `OR-2026-00${90 + i}` : null,
  };
});

export const mockLoanCalculation: LoanCalculation = {
  principal: 25000,
  termMonths: 6,
  monthlyInterestRate: 1.5,
  estimatedMonthlyPayment: 4, // filled below
  estimatedTotalInterest: 0,
  totalRepayable: 0,
  processingFee: 0,
  estimatedNetProceeds: 0,
};

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const mockPayments: PaymentItem[] = [
  { id: 'pay-101', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001', amount: 4850, paymentDate: daysAgo(8), paymentMethod: 'GCASH', referenceNumber: 'GCASH-98214981', officialReceiptNumber: 'OR-2026-0091', status: 'COMPLETED', notes: 'August 2026 installment paid on time' },
  { id: 'pay-102', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001', amount: 4850, paymentDate: daysAgo(38), paymentMethod: 'MAYA', referenceNumber: 'MAYA-44129881', officialReceiptNumber: 'OR-2026-0082', status: 'COMPLETED', notes: 'July 2026 installment' },
  { id: 'pay-103', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001', amount: 4850, paymentDate: daysAgo(68), paymentMethod: 'OVER_THE_COUNTER', referenceNumber: 'OTC-TAC-0412', officialReceiptNumber: 'OR-2026-0071', status: 'COMPLETED', notes: 'June installment paid at Main Branch' },
];

export function buildMockReceipt(input: {
  amount: number;
  loanId: string;
  loanNumber: string;
  loanProduct?: string;
  paymentMethod: string;
  referenceNumber: string;
  notes?: string;
}): PaymentReceipt {
  return {
    id: `pay-${Date.now()}`,
    referenceNumber: input.referenceNumber,
    amount: input.amount,
    paymentDate: new Date().toISOString(),
    loanId: input.loanId,
    loanNumber: input.loanNumber,
    loanProduct: input.loanProduct || 'Loan',
    paymentMethod: input.paymentMethod,
    status: 'PENDING_TELLER_VERIFICATION',
    remainingBalance: Math.max(0, 24250 - input.amount),
    notes: input.notes,
  };
}

// ---------------------------------------------------------------------------
// Savings
// ---------------------------------------------------------------------------

export const mockSavingsAccount: SavingsAccount = {
  id: 'sav-1',
  memberId: 'b-1',
  accountNumber: 'SAV-2024-000891',
  balance: 18500,
  totalDeposits: 23500,
  totalWithdrawals: 5000,
  goal: 30000,
  goalName: 'Emergency Fund',
};

export const mockSavingsTransactions: SavingsTransaction[] = [
  { id: 'st-1', date: daysAgo(6), type: 'DEPOSIT', amount: 1500, referenceNumber: 'DEP-2026-0422', balanceAfter: 18500, status: 'COMPLETED', notes: 'Over-the-counter deposit' },
  { id: 'st-2', date: daysAgo(36), type: 'DEPOSIT', amount: 1500, referenceNumber: 'DEP-2026-0391', balanceAfter: 17000, status: 'COMPLETED', notes: 'Weekly savings' },
  { id: 'st-3', date: daysAgo(66), type: 'WITHDRAWAL', amount: 5000, referenceNumber: 'WDL-2026-0102', balanceAfter: 15500, status: 'COMPLETED', notes: 'Medical emergency withdrawal' },
  { id: 'st-4', date: daysAgo(96), type: 'DEPOSIT', amount: 1500, referenceNumber: 'DEP-2026-0330', balanceAfter: 20500, status: 'COMPLETED', notes: 'Weekly savings' },
  { id: 'st-5', date: daysAgo(126), type: 'INTEREST', amount: 12, referenceNumber: 'ITR-2026-001', balanceAfter: 19000, status: 'COMPLETED', notes: '1% p.a. crediting' },
];

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const mockTransactions: FinancialTransaction[] = [
  { id: 'tx-1', type: 'LOAN_PAYMENT', amount: 4850, date: daysAgo(8), referenceNumber: 'OR-2026-0091', paymentMethod: 'GCASH', status: 'COMPLETED', description: 'Loan payment — LN-2026-001', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001' },
  { id: 'tx-2', type: 'SAVINGS_DEPOSIT', amount: 1500, date: daysAgo(6), referenceNumber: 'DEP-2026-0422', paymentMethod: 'OVER_THE_COUNTER', status: 'COMPLETED', description: 'Savings deposit' },
  { id: 'tx-3', type: 'LOAN_DISBURSEMENT', amount: 50000, date: daysAgo(150), referenceNumber: 'DISB-2026-011', paymentMethod: 'BANK_TRANSFER', status: 'COMPLETED', description: 'Loan disbursement — LN-2026-001', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001' },
  { id: 'tx-4', type: 'SAVINGS_WITHDRAWAL', amount: 5000, date: daysAgo(66), referenceNumber: 'WDL-2026-0102', paymentMethod: 'OVER_THE_COUNTER', status: 'COMPLETED', description: 'Savings withdrawal' },
  { id: 'tx-5', type: 'FEE', amount: 1000, date: daysAgo(150), referenceNumber: 'FEE-2026-003', paymentMethod: 'CASH', status: 'COMPLETED', description: 'Processing fee — LN-2026-001', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001' },
  { id: 'tx-6', type: 'ADJUSTMENT', amount: -250, date: daysAgo(200), referenceNumber: 'ADJ-2026-014', paymentMethod: 'CASH', status: 'COMPLETED', description: 'Round-off adjustment' },
];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const mockNotifications: MobileNotification[] = [
  { id: 'notif-1', borrowerId: 'b-1', title: 'Loan Payment Reminder', message: 'Your monthly installment of ₱4,850.00 for Loan LN-2026-001 is due soon.', category: 'upcoming_payment', isRead: false, createdAt: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: 'notif-2', borrowerId: 'b-1', title: 'Payment Confirmed', message: 'Your repayment of ₱4,850.00 has been verified. Receipt OR-2026-0091 is available.', category: 'payment_confirmation', isRead: true, createdAt: new Date(Date.now() - 48 * 3600000).toISOString() },
  { id: 'notif-3', borrowerId: 'b-1', title: 'Savings Deposit Completed', message: 'Your savings deposit of ₱1,500.00 has been posted to your account.', category: 'savings_update', isRead: false, createdAt: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: 'notif-4', borrowerId: 'b-1', title: 'KYC Verified', message: 'Your KYC information has been verified by the branch.', category: 'kyc_update', isRead: true, createdAt: new Date(Date.now() - 72 * 3600000).toISOString() },
  { id: 'notif-5', borrowerId: 'b-1', title: 'Cooperative Announcement', message: 'Annual General Membership Assembly scheduled for November 15, 2026.', category: 'announcement', isRead: true, createdAt: new Date(Date.now() - 96 * 3600000).toISOString() },
];

export const mockNotificationsData: NotificationsData = {
  notifications: mockNotifications,
  unreadCount: mockNotifications.filter((n) => !n.isRead).length,
};

// ---------------------------------------------------------------------------
// Group lending
// ---------------------------------------------------------------------------

export const mockGroup: ClientGroup = {
  id: 'grp-201',
  name: 'Mater Dei Solidarity Circle',
  leaderName: 'Teresa Alcantara',
  memberCount: 6,
  status: 'ACTIVE',
  centerName: 'Poblacion Center',
  branch: 'Tacloban Main',
  members: [
    { borrowerId: 'b-1', name: 'Teresa Alcantara', role: 'Leader', contributionStatus: 'PAID', loanStatus: 'ACTIVE' },
    { borrowerId: 'b-2', name: 'Rolando Dela Cruz', contributionStatus: 'PAID' },
    { borrowerId: 'b-3', name: 'Mary Jane Ramos', contributionStatus: 'PENDING' },
    { borrowerId: 'b-4', name: 'Antonio Batula', contributionStatus: 'PAID' },
    { borrowerId: 'b-5', name: 'Elena Soriano', contributionStatus: 'PAID' },
    { borrowerId: 'b-6', name: 'Fernando Gabaldon', contributionStatus: 'LATE' },
  ],
  groupLoan: {
    id: 'GL-2026-014',
    totalAmount: 120000,
    outstandingBalance: 72000,
    nextPayment: 9000,
    nextPaymentDate: daysAgo(-2),
    paidAmount: 48000,
    repaymentProgress: 40,
    schedule: Array.from({ length: 12 }, (_, i) => ({
      installmentNumber: i + 1,
      dueDate: addDays(new Date(), (i - 5) * 30),
      amountDue: 9000,
      principal: 6000,
      interest: 3000,
      remainingBalance: Math.max(0, 120000 - (i + 1) * 10000),
      status: i < 5 ? 'PAID' : i === 5 ? 'DUE' : 'UPCOMING',
    })),
  },
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const mockDocuments: PortalDocument[] = [
  { id: 'doc-1', name: 'Loan Agreement — LN-2026-001', type: 'Loan Agreement', date: '2026-01-15', relatedLoanNumber: 'LN-2026-001' },
  { id: 'doc-2', name: 'Official Receipt OR-2026-0091', type: 'Payment Receipt', date: daysAgo(8), relatedLoanNumber: 'LN-2026-001' },
  { id: 'doc-3', name: 'Account Statement — August 2026', type: 'Account Statement', date: daysAgo(1) },
  { id: 'doc-4', name: 'Loan Statement — LN-2026-001', type: 'Loan Statement', date: daysAgo(1), relatedLoanNumber: 'LN-2026-001' },
  { id: 'doc-5', name: 'Truth in Lending Disclosure', type: 'Disclosure', date: '2026-01-15', relatedLoanNumber: 'LN-2026-001' },
];

// ---------------------------------------------------------------------------
// Branch personnel — KYC verification
// ---------------------------------------------------------------------------

export const mockBranchContext: BranchContextData = {
  staffId: 'u-201',
  staffName: 'Elena Santos',
  staffRole: 'BRANCH_OFFICER',
  branchId: 'br-1',
  branchName: 'Tacloban Main Branch',
};

const kycQueueBase: Array<Partial<BranchKycQueueItem>> = [
  {
    id: 'b-10',
    borrowerNumber: 'MBR-2026-112',
    fullName: 'John Carlo Mendoza',
    phone: '0917 444 2211',
    email: 'jc.mendoza@example.com',
    kycStatus: 'PENDING',
    submittedDocuments: 3,
    gender: 'Male',
    dateOfBirth: '1992-03-18',
    civilStatus: 'Single',
    address: 'Brgy. 42, Sagkahan, Tacloban City',
    barangay: 'Sagkahan',
    city: 'Tacloban City',
    province: 'Leyte',
    occupation: 'Tricycle Operator',
    employerOrBusiness: 'Self-Employed',
    monthlyIncome: 18000,
  },
  {
    id: 'b-11',
    borrowerNumber: 'MBR-2026-118',
    fullName: 'Reynaldo Bacus',
    phone: '0918 777 8890',
    email: 'reynaldo.bacus@example.com',
    kycStatus: 'UNDER_REVIEW',
    submittedDocuments: 4,
    gender: 'Male',
    dateOfBirth: '1985-11-02',
    civilStatus: 'Married',
    address: 'Purok 3, Barangay 54, Tacloban City',
    barangay: 'Barangay 54',
    city: 'Tacloban City',
    province: 'Leyte',
    occupation: 'Farmer',
    employerOrBusiness: 'Self-Employed',
    monthlyIncome: 15000,
  },
  {
    id: 'b-12',
    borrowerNumber: 'MBR-2026-124',
    fullName: 'Jennifer Ocampo',
    phone: '0905 111 3344',
    email: 'jennifer.ocampo@example.com',
    kycStatus: 'CORRECTION_REQUIRED',
    submittedDocuments: 2,
    gender: 'Female',
    dateOfBirth: '1990-07-25',
    civilStatus: 'Married',
    address: 'Brgy. 88 San Jose, Tacloban City',
    barangay: 'San Jose',
    city: 'Tacloban City',
    province: 'Leyte',
    occupation: 'Sari-sari Store Owner',
    employerOrBusiness: 'Ocampo Variety Store',
    monthlyIncome: 22000,
  },
  {
    id: 'b-13',
    borrowerNumber: 'MBR-2026-130',
    fullName: 'Manuelito Reyes',
    phone: '0929 555 6677',
    email: 'manuelito.reyes@example.com',
    kycStatus: 'PENDING',
    submittedDocuments: 1,
    gender: 'Male',
    dateOfBirth: '1995-01-30',
    civilStatus: 'Single',
    address: 'Brgy. Utap, Palo, Leyte',
    barangay: 'Utap',
    city: 'Palo',
    province: 'Leyte',
    occupation: 'Laborer',
    employerOrBusiness: 'Local Construction',
    monthlyIncome: 12000,
  },
  {
    id: 'b-14',
    borrowerNumber: 'MBR-2026-135',
    fullName: 'Rosalinda Tiu',
    phone: '0917 222 4433',
    email: 'rosalinda.tiu@example.com',
    kycStatus: 'PENDING',
    submittedDocuments: 4,
    gender: 'Female',
    dateOfBirth: '1987-09-14',
    civilStatus: 'Widowed',
    address: 'Market St, Poblacion, Palo, Leyte',
    barangay: 'Poblacion',
    city: 'Palo',
    province: 'Leyte',
    occupation: 'Market Vendor',
    employerOrBusiness: 'Self-Employed',
    monthlyIncome: 20000,
  },
];

export const mockKycQueue: BranchKycQueueItem[] = kycQueueBase.map((q, i) => ({
  borrowerNumber: q.borrowerNumber as string,
  id: q.id as string,
  fullName: q.fullName as string,
  phone: q.phone ?? '',
  email: q.email ?? '',
  kycStatus: q.kycStatus as string,
  submittedDocuments: q.submittedDocuments ?? 0,
  gender: q.gender,
  dateOfBirth: q.dateOfBirth,
  civilStatus: q.civilStatus,
  address: q.address,
  barangay: q.barangay,
  city: q.city,
  province: q.province,
  occupation: q.occupation,
  employerOrBusiness: q.employerOrBusiness,
  monthlyIncome: q.monthlyIncome,
  kycSubmission: {
    id: `KYC-SUB-${i + 1}`,
    status: q.kycStatus as KYCStatus,
    submittedAt: daysAgo(1 + i * 2),
    reviewedAt: q.kycStatus === 'CORRECTION_REQUIRED' ? daysAgo(2) : undefined,
    reviewedByName: q.kycStatus === 'CORRECTION_REQUIRED' ? 'Elena Santos' : undefined,
    correctionReason: q.kycStatus === 'CORRECTION_REQUIRED' ? 'The proof of address submitted is more than 3 months old.' : undefined,
    personalInfo: {
      firstName: q.fullName?.split(' ')[0] ?? '',
      middleName: q.fullName && q.fullName.split(' ').length > 2 ? q.fullName.split(' ')[1].charAt(0) + '.' : '',
      lastName: q.fullName?.split(' ').slice(-1)[0] ?? '',
      dateOfBirth: q.dateOfBirth ?? '1990-01-01',
      gender: q.gender ?? 'Male',
      civilStatus: q.civilStatus ?? 'Single',
      phone: q.phone ?? '',
      email: q.email ?? '',
    },
    address: {
      barangay: q.barangay ?? '',
      city: q.city ?? '',
      province: q.province ?? '',
      houseUnit: '',
      street: '',
    },
    employment: {
      occupation: q.occupation ?? '',
      employer: q.employerOrBusiness ?? '',
      monthlyIncome: q.monthlyIncome ?? 0,
      sourceOfIncome: 'Business / Self-Employment',
    },
  },
}));