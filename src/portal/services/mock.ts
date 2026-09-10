import {
  ClientDashboard,
  ClientGroup,
  ClientProfile,
  FinancialTransaction,
  KYCStatus,
  LoanApplication,
  LoanProduct,
  NotificationsData,
  PortalDocument,
  PortalNotification,
  SavingsAccount,
  SavingsTransaction,
  ScheduleItem,
  SupportTicket,
  LoginActivityItem,
  NotificationPreferences,
  PrivacyPreferences,
  ClientLoan,
  PaymentRecordItem,
} from '../types';

// ---------------------------------------------------------------------------
// Mock fallback data. Mirrors the real /api/client* response shapes so the
// portal renders meaningful content until those endpoints exist or return data.
// No page component imports this file directly — it is served by the services.
// ---------------------------------------------------------------------------

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];

export const mockDashboard: ClientDashboard = {
  borrowerName: 'Teresa Alcantara',
  memberNumber: 'MBR-2024-001',
  totalActiveLoan: 50000,
  remainingBalance: 24250,
  nextPayment: 4850,
  nextPaymentDueDate: daysAgo(-9),
  loanStatus: 'ACTIVE',
  activeLoansCount: 1,
  savingsBalance: 18500,
  totalSavingsDeposits: 23500,
  lastSavingsDepositDate: daysAgo(6),
  totalPaid: 29100,
  totalPayments: 6,
  recentTransactions: [
    { id: 'tx-1', type: 'REPAYMENT', amount: 4850, date: daysAgo(8), referenceNumber: 'OR-2026-0091', paymentMethod: 'GCASH', status: 'COMPLETED', description: 'Loan repayment — LN-2026-001' },
    { id: 'tx-2', type: 'SAVINGS_DEPOSIT', amount: 1500, date: daysAgo(6), referenceNumber: 'DEP-2026-0422', paymentMethod: 'OVER_THE_COUNTER', status: 'COMPLETED', description: 'Savings deposit' },
    { id: 'tx-3', type: 'LOAN_DISBURSEMENT', amount: 50000, date: daysAgo(150), referenceNumber: 'DISB-2026-011', paymentMethod: 'BANK_TRANSFER', status: 'COMPLETED', description: 'Loan disbursement — LN-2026-001' },
  ],
};

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

export const mockLoans: ClientLoan[] = [
  {
    id: 'LN-2026-001',
    loanNumber: 'LN-2026-001',
    productName: 'Micro-Enterprise Revolving Loan',
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
    nextPaymentDate: daysAgo(-9),
    purpose: 'Store inventory replenishment',
    repaymentsMade: 6,
    repaymentsTotal: 12,
  },
  {
    id: 'LN-2025-088',
    loanNumber: 'LN-2025-088',
    productName: 'Solidarity Group Microloan',
    principalAmount: 25000,
    interestRate: 15,
    interestType: 'FLAT_RATE',
    termMonths: 6,
    monthlyInstallment: 4479,
    remainingBalance: 0,
    paidAmount: 26875,
    totalPayable: 26875,
    totalInterest: 1875,
    status: 'COMPLETED',
    startDate: '2025-06-01',
    maturityDate: '2025-12-01',
    purpose: 'Working capital for dry goods stall',
    repaymentsMade: 6,
    repaymentsTotal: 6,
  },
];

export const mockSchedule: ScheduleItem[] = Array.from({ length: 12 }, (_, i) => {
  const due = new Date(Date.now() + i * 30 * 86400000);
  const paid = i < 6;
  const bal = Math.max(0, 50000 - (i + 1) * 2916.67);
  return {
    installmentNumber: i + 1,
    dueDate: due.toISOString().split('T')[0],
    amountDue: 4850,
    principal: Math.round(2916.67),
    interest: Math.round(1933.33),
    remainingBalance: Math.round(bal),
    status: paid ? 'PAID' : i === 6 ? 'DUE' : 'UPCOMING',
    paidDate: paid ? new Date(due.getTime() - 86400000).toISOString().split('T')[0] : null,
    receiptNumber: paid ? `OR-2026-00${i + 1}` : null,
  };
});

export const mockProducts: LoanProduct[] = [
  { id: 'prod-1', name: 'Micro-Enterprise Working Capital', code: 'ME-001', minAmount: 10000, maxAmount: 150000, minTermMonths: 3, maxTermMonths: 24, interestRatePerMonth: 1.5, interestType: 'REDUCING_BALANCE', processingFeePercentage: 2.0, description: 'Working capital financing for sari-sari stores, market stalls, and small trade shops.' },
  { id: 'prod-2', name: 'Solidarity Group Microloan', code: 'SG-002', minAmount: 5000, maxAmount: 50000, minTermMonths: 3, maxTermMonths: 12, interestRatePerMonth: 1.25, interestType: 'FLAT_RATE', processingFeePercentage: 1.5, description: 'Zero-collateral group loan backed by a peer mutual guarantee circle.' },
  { id: 'prod-3', name: 'Salary & Multi-Purpose Loan', code: 'SL-003', minAmount: 15000, maxAmount: 250000, minTermMonths: 6, maxTermMonths: 36, interestRatePerMonth: 1.2, interestType: 'REDUCING_BALANCE', processingFeePercentage: 2.0, description: 'Flexible personal loan for medical, education, home renovation, or equipment.' },
  { id: 'prod-4', name: 'Emergency Relief Loan', code: 'ER-004', minAmount: 5000, maxAmount: 30000, minTermMonths: 3, maxTermMonths: 6, interestRatePerMonth: 1.0, interestType: 'FLAT_RATE', processingFeePercentage: 0.5, description: 'Rapid-disbursement financial assistance for emergencies and hospitalizations.' },
];

export const mockApplications: LoanApplication[] = [
  { id: 'LN-APP-2026-004', productName: 'Micro-Enterprise Working Capital', principalAmount: 25000, termMonths: 6, applicationDate: '2026-08-20', status: 'PENDING', coopStep: 'CREDIT_INVESTIGATION', rejectionReason: null },
  { id: 'LN-2026-001', productName: 'Micro-Enterprise Revolving Loan', principalAmount: 50000, termMonths: 12, applicationDate: '2026-01-10', status: 'APPROVED', coopStep: 'DISBURSED', rejectionReason: null, disbursedAt: '2026-01-15' },
];

export const mockPayments: PaymentRecordItem[] = [
  { id: 'pay-101', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001', amount: 4850, paymentDate: daysAgo(8), paymentMethod: 'GCASH', referenceNumber: 'GCASH-98214981', officialReceiptNumber: 'OR-2026-0091', status: 'COMPLETED', notes: 'August 2026 installment paid on time' },
  { id: 'pay-102', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001', amount: 4850, paymentDate: daysAgo(38), paymentMethod: 'MAYA', referenceNumber: 'MAYA-44129881', officialReceiptNumber: 'OR-2026-0082', status: 'COMPLETED', notes: 'July 2026 installment' },
  { id: 'pay-103', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001', amount: 4850, paymentDate: daysAgo(68), paymentMethod: 'OVER_THE_COUNTER', referenceNumber: 'OTC-TAC-0412', officialReceiptNumber: 'OR-2026-0071', status: 'COMPLETED', notes: 'June installment paid at Main Branch' },
];

export const mockSavingsAccount: SavingsAccount = {
  id: 'sav-1',
  memberId: 'b-1',
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

export const mockTransactions: FinancialTransaction[] = [
  { id: 'tx-1', type: 'REPAYMENT', amount: 4850, date: daysAgo(8), referenceNumber: 'OR-2026-0091', paymentMethod: 'GCASH', status: 'COMPLETED', description: 'Loan payment — LN-2026-001', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001' },
  { id: 'tx-2', type: 'SAVINGS_DEPOSIT', amount: 1500, date: daysAgo(6), referenceNumber: 'DEP-2026-0422', paymentMethod: 'OVER_THE_COUNTER', status: 'COMPLETED', description: 'Savings deposit' },
  { id: 'tx-3', type: 'LOAN_DISBURSEMENT', amount: 50000, date: daysAgo(150), referenceNumber: 'DISB-2026-011', paymentMethod: 'BANK_TRANSFER', status: 'COMPLETED', description: 'Loan disbursement — LN-2026-001', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001' },
  { id: 'tx-4', type: 'SAVINGS_WITHDRAWAL', amount: 5000, date: daysAgo(66), referenceNumber: 'WDL-2026-0102', paymentMethod: 'OVER_THE_COUNTER', status: 'COMPLETED', description: 'Savings withdrawal' },
  { id: 'tx-5', type: 'FEE', amount: 1000, date: daysAgo(150), referenceNumber: 'FEE-2026-003', paymentMethod: 'CASH', status: 'COMPLETED', description: 'Processing fee — LN-2026-001', loanId: 'LN-2026-001', loanNumber: 'LN-2026-001' },
  { id: 'tx-6', type: 'ADJUSTMENT', amount: -250, date: daysAgo(200), referenceNumber: 'ADJ-2026-014', paymentMethod: 'CASH', status: 'COMPLETED', description: 'Round-off adjustment' },
];

export const mockNotifications: PortalNotification[] = [
  { id: 'notif-1', title: 'Loan Payment Reminder', message: 'Your monthly installment of ₱4,850.00 for Loan LN-2026-001 is due soon.', category: 'upcoming_payment', isRead: false, createdAt: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: 'notif-2', title: 'Payment Confirmed', message: 'Your repayment of ₱4,850.00 has been verified. Receipt OR-2026-0091 is available.', category: 'payment_confirmation', isRead: true, createdAt: new Date(Date.now() - 48 * 3600000).toISOString() },
  { id: 'notif-3', title: 'Savings Deposit Completed', message: 'Your savings deposit of ₱1,500.00 has been posted to your account.', category: 'savings_update', isRead: false, createdAt: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: 'notif-4', title: 'Cooperative Announcement', message: 'Annual General Membership Assembly scheduled for November 15, 2026.', category: 'announcement', isRead: true, createdAt: new Date(Date.now() - 72 * 3600000).toISOString() },
];

export const mockUnreadCount = mockNotifications.filter((n) => !n.isRead).length;

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
    nextPaymentDate: daysAgo(-5),
    paidAmount: 48000,
    repaymentProgress: 40,
    schedule: Array.from({ length: 12 }, (_, i) => ({
      installmentNumber: i + 1,
      dueDate: new Date(Date.now() + i * 30 * 86400000).toISOString().split('T')[0],
      amountDue: 9000,
      principal: 6000,
      interest: 3000,
      remainingBalance: Math.max(0, 120000 - (i + 1) * 10000),
      status: i < 5 ? 'PAID' : i === 5 ? 'DUE' : 'UPCOMING',
    })),
  },
};

export const mockDocuments: PortalDocument[] = [
  { id: 'doc-1', name: 'Loan Agreement — LN-2026-001', type: 'Loan Agreement', date: '2026-01-15', relatedLoanNumber: 'LN-2026-001' },
  { id: 'doc-2', name: 'Official Receipt OR-2026-0091', type: 'Payment Receipt', date: daysAgo(8), relatedLoanNumber: 'LN-2026-001' },
  { id: 'doc-3', name: 'Account Statement — August 2026', type: 'Account Statement', date: daysAgo(1) },
  { id: 'doc-4', name: 'Loan Statement — LN-2026-001', type: 'Loan Statement', date: daysAgo(1), relatedLoanNumber: 'LN-2026-001' },
  { id: 'doc-5', name: 'Truth in Lending Disclosure', type: 'Disclosure', date: '2026-01-15', relatedLoanNumber: 'LN-2026-001' },
  { id: 'doc-6', name: 'Membership Certificate', type: 'Certificate', date: '2024-01-18' },
];

export const mockFaqs: Record<string, { id: string; question: string; answer: string }[]> = {
  Loans: [
    { id: 'faq-l1', question: 'How do I know if my loan was approved?', answer: 'You will receive a notification once the Credit Committee makes a decision. You can also track the status on the "Loan Applications" page.' },
    { id: 'faq-l2', question: 'When will my loan be disbursed?', answer: 'Approved loans are usually disbursed within 1–3 banking days after approval once all requirements are complete.' },
  ],
  Payments: [
    { id: 'faq-p1', question: 'What payment methods are accepted?', answer: 'You may pay over the counter at any branch, or via GCash, Maya, and bank transfer through the portal.' },
    { id: 'faq-p2', question: 'Can I pay my loan in full early?', answer: 'Yes. Early settlement is allowed and may qualify for an interest rebate. Contact your branch for the exact amount.' },
  ],
  Savings: [
    { id: 'faq-s1', question: 'How do I make a savings deposit?', answer: 'You can deposit over the counter at any branch. Withdrawal requests can be filed from the Savings page.' },
    { id: 'faq-s2', question: 'What is the interest rate on savings?', answer: 'Savings earn 1% per annum, credited quarterly.' },
  ],
  Account: [
    { id: 'faq-a1', question: 'How do I reset my password?', answer: 'Use the "Forgot password" option on the login page. A verification code will be sent to your registered email.' },
    { id: 'faq-a2', question: 'How do I update my contact details?', answer: 'Go to My Profile and click "Update Profile". Changes are reviewed by staff when required.' },
  ],
  'Group Lending': [
    { id: 'faq-g1', question: 'What is a solidarity group?', answer: 'A solidarity group is a circle of members who mutually guarantee each other\u2019s loans. Group members support timely repayments together.' },
  ],
};

export const mockTickets: SupportTicket[] = [
  { id: 'TKT-2026-031', subject: 'Question about my loan balance', category: 'Loans', message: 'I would like to confirm my remaining balance.', createdAt: '2026-08-10', status: 'IN_PROGRESS', lastUpdate: '2026-08-12' },
  { id: 'TKT-2026-027', subject: 'Update savings passbook records', category: 'Savings', message: 'Please update my passbook records.', createdAt: '2026-07-20', status: 'RESOLVED', lastUpdate: '2026-07-22' },
];

export const mockNotificationPreferences: NotificationPreferences = {
  paymentReminders: true,
  loanUpdates: true,
  savingsUpdates: true,
  announcements: false,
};

export const mockLoginActivity: LoginActivityItem[] = [
  { id: 'sess-1', device: 'Chrome on Windows', location: 'Tacloban City, PH', time: new Date().toISOString(), ip: '192.168.1.10', status: 'ACTIVE' },
  { id: 'sess-2', device: 'Safari on iPhone', location: 'Tacloban City, PH', time: daysAgo(3), ip: '192.168.1.24', status: 'EXPIRED' },
];

export const mockPrivacyPreferences: PrivacyPreferences = {
  shareDataAnalytics: true,
  allowSmsMarketing: false,
  allowEmailAlerts: true,
};

export { }; // keep file as module