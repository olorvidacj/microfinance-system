import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AuditLogEntry,
  Borrower,
  Branch,
  ClientStatus,
  ClientStatusLog,
  CreditCommitteeEvaluation,
  InstallmentScheduleItem,
  InterestCreditLog,
  KycDocument,
  KycDocumentType,
  KycReviewLog,
  KycStatus,
  Loan,
  LoanApprovalInfo,
  LoanDisbursementInfo,
  LoanDisbursementVoucher,
  LoanProduct,
  LoanRejectionInfo,
  LoanStatus,
  MemberFollowUpLog,
  MembershipApplication,
  MemberUpdateRequest,
  PaymentRecord,
  ReminderItem,
  SavingsAccount,
  SavingsAccountStatus,
  SavingsAccountType,
  SavingsAccountStatusLog,
  SavingsTransaction,
  SavingsWithdrawalRequest,
  UserStaff,
  SolidarityGroup,
  SolidarityGroupMember,
  GroupLoan,
  GroupLoanMemberObligation,
  GroupLoanStatus,
  GroupMeetingLog,
  GroupMeetingAttendance,
  GroupMeetingCollection,
  FinancialTransaction,
  FinancialTransactionStatus,
  FinancialTransactionType,
  FinancialAccount,
  FinancialSupplier,
  FinancialSupplierBill,
  FinancialBillPayment,
  FinancialBudget,
  FinancialTaxRecord,
  FinancialJournalEntry,
  FinancialJournalEntryLine,
  FinancialCashTransaction,
  FinancialMonthlyCashFlow,
  FinancialMonthlyDisbursement,
  FinancialMonthlyCollection,
  OversightLoanPortfolioSnapshot,
  OversightCollectionMonitoring,
  OversightDisbursementTracker,
  OversightAuditEngagement,
  OversightAuditFinding,
  OversightCorrectiveAction,
  OversightComplianceRequirement,
  OversightComplianceReview,
  OversightControlException,
  OversightReport,
  OversightDashboardMetric,
  OversightSystemSettings,
  FindingStatus,
  CorrectiveActionStatus,
  TrackingStatus,
} from '../types';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_BORROWERS,
  INITIAL_BRANCHES,
  INITIAL_FOLLOW_UP_LOGS,
  INITIAL_INTEREST_LOGS,
  INITIAL_LOAN_PRODUCTS,
  INITIAL_LOANS,
  INITIAL_MEMBERSHIP_APPLICATIONS,
  INITIAL_PAYMENTS,
  INITIAL_SAVINGS_ACCOUNTS,
  INITIAL_SAVINGS_TRANSACTIONS,
  INITIAL_STAFF,
  INITIAL_UPDATE_REQUESTS,
  INITIAL_WITHDRAWAL_REQUESTS,
  INITIAL_SOLIDARITY_GROUPS,
  INITIAL_GROUP_LOANS,
  INITIAL_GROUP_MEETING_LOGS,
  INITIAL_FINANCIAL_TRANSACTIONS,
  INITIAL_FINANCIAL_ACCOUNTS,
  INITIAL_FINANCIAL_SUPPLIERS,
  INITIAL_FINANCIAL_SUPPLIER_BILLS,
  INITIAL_FINANCIAL_BILL_PAYMENTS,
  INITIAL_FINANCIAL_BUDGETS,
  INITIAL_FINANCIAL_TAX_RECORDS,
  INITIAL_FINANCIAL_JOURNAL_ENTRIES,
  INITIAL_FINANCIAL_CASH_TRANSACTIONS,
  INITIAL_FINANCIAL_MONTHLY_CASH_FLOW,
  INITIAL_FINANCIAL_MONTHLY_DISBURSEMENTS,
  INITIAL_FINANCIAL_MONTHLY_COLLECTIONS,
  INITIAL_OVERSIGHT_SNAPSHOTS,
  INITIAL_OVERSIGHT_COLLECTION_MONITORING,
  INITIAL_OVERSIGHT_DISBURSEMENT_TRACKER,
  INITIAL_OVERSIGHT_AUDIT_ENGAGEMENTS,
  INITIAL_OVERSIGHT_AUDIT_FINDINGS,
  INITIAL_OVERSIGHT_CORRECTIVE_ACTIONS,
  INITIAL_OVERSIGHT_COMPLIANCE_REQUIREMENTS,
  INITIAL_OVERSIGHT_COMPLIANCE_REVIEWS,
  INITIAL_OVERSIGHT_CONTROL_EXCEPTIONS,
  INITIAL_OVERSIGHT_REPORTS,
  INITIAL_OVERSIGHT_METRICS,
  INITIAL_OVERSIGHT_SETTINGS,
} from '../data/initialData';
import { authFetch } from './AuthContext';
import {
  calculateAdvancePaymentRebate,
  calculateLatePenalty,
  calculateLoanSchedule,
  calculateMonthlySavingsInterest,
  allocatePaymentToSchedule,
  getComputedInstallmentStatus,
} from '../utils/loanMath';

interface LoanContextType {
  branches: Branch[];
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
  activeBranch: Branch | null;
  staffList: UserStaff[];
  currentUser: UserStaff;
  setCurrentUser: (user: UserStaff) => void;
  loanProducts: LoanProduct[];
  borrowers: Borrower[];
  loans: Loan[];
  payments: PaymentRecord[];
  auditLogs: AuditLogEntry[];
  reminders: ReminderItem[];

  // 1. Membership Services State
  membershipApplications: MembershipApplication[];
  memberUpdateRequests: MemberUpdateRequest[];
  memberFollowUpLogs: MemberFollowUpLog[];

  // 2. Savings Services State
  savingsTransactions: SavingsTransaction[];
  withdrawalRequests: SavingsWithdrawalRequest[];
  interestLogs: InterestCreditLog[];

  // 3. Group Lending & Solidarity Mechanism State
  solidarityGroups: SolidarityGroup[];
  groupLoans: GroupLoan[];
  groupMeetingLogs: GroupMeetingLog[];
  filteredSolidarityGroups: SolidarityGroup[];
  filteredGroupLoans: GroupLoan[];

  // 7. Financial Transactions Core State & Actions
  financialTransactions: FinancialTransaction[];
  filteredFinancialTransactions: FinancialTransaction[];
  createFinancialTransaction: (
    data: Omit<FinancialTransaction, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  ) => FinancialTransaction;
  reverseFinancialTransaction: (
    transactionId: string,
    reason: string,
    reversedBy?: string
  ) => {
    success: boolean;
    reversedTransaction?: FinancialTransaction;
    adjustmentTransaction?: FinancialTransaction;
    error?: string;
    message?: string;
  };
  updateFinancialTransactionStatus: (
    transactionId: string,
    newStatus: FinancialTransactionStatus,
    notes?: string
  ) => { success: boolean; error?: string };

  // 8. Financial Submodule State & Actions (financial.*)
  financialAccounts: FinancialAccount[];
  financialSuppliers: FinancialSupplier[];
  financialSupplierBills: FinancialSupplierBill[];
  financialBillPayments: FinancialBillPayment[];
  financialBudgets: FinancialBudget[];
  financialTaxRecords: FinancialTaxRecord[];
  financialJournalEntries: FinancialJournalEntry[];
  financialCashTransactions: FinancialCashTransaction[];
  financialMonthlyCashFlow: FinancialMonthlyCashFlow[];
  financialMonthlyDisbursements: FinancialMonthlyDisbursement[];
  financialMonthlyCollections: FinancialMonthlyCollection[];
  addFinancialAccount: (acc: Omit<FinancialAccount, 'id'>) => FinancialAccount;
  addFinancialJournalEntry: (entry: Omit<FinancialJournalEntry, 'id'>) => FinancialJournalEntry;
  addSupplierBill: (bill: Omit<FinancialSupplierBill, 'id' | 'billCode' | 'paidAmount' | 'archived'>) => FinancialSupplierBill;
  paySupplierBill: (billId: string, amount: number, paymentMethod: 'Cash' | 'Bank Transfer' | 'Cheque' | 'GCash', referenceNumber?: string) => { success: boolean; error?: string };
  addFinancialTaxRecord: (rec: Omit<FinancialTaxRecord, 'id'>) => FinancialTaxRecord;
  updateFinancialBudget: (department: string, allocated: number, used: number) => void;
  addCashTransaction: (tx: Omit<FinancialCashTransaction, 'id' | 'transactionCode'>) => FinancialCashTransaction;

  // 9. Oversight Submodule State & Actions (oversight.* KALASAG)
  oversightSnapshots: OversightLoanPortfolioSnapshot[];
  oversightCollectionMonitoring: OversightCollectionMonitoring[];
  oversightDisbursementTracker: OversightDisbursementTracker[];
  oversightAuditEngagements: OversightAuditEngagement[];
  oversightAuditFindings: OversightAuditFinding[];
  oversightCorrectiveActions: OversightCorrectiveAction[];
  oversightComplianceRequirements: OversightComplianceRequirement[];
  oversightComplianceReviews: OversightComplianceReview[];
  oversightControlExceptions: OversightControlException[];
  oversightReports: OversightReport[];
  oversightMetrics: OversightDashboardMetric[];
  oversightSettings: OversightSystemSettings;
  addAuditFinding: (finding: Omit<OversightAuditFinding, 'findingId' | 'createdAt' | 'updatedAt'>) => OversightAuditFinding;
  updateAuditFindingStatus: (findingId: string, status: FindingStatus, closureEvidence?: string) => void;
  addCorrectiveAction: (cap: Omit<OversightCorrectiveAction, 'correctiveActionId' | 'createdAt' | 'updatedAt'>) => OversightCorrectiveAction;
  verifyCorrectiveAction: (capId: string, verifiedBy: string) => void;
  addComplianceReview: (rev: Omit<OversightComplianceReview, 'reviewId' | 'createdAt' | 'updatedAt'>) => OversightComplianceReview;
  addControlException: (exc: Omit<OversightControlException, 'exceptionId' | 'identifiedAt' | 'createdAt' | 'updatedAt'>) => OversightControlException;
  resolveControlException: (excId: string, resolutionDate?: string) => void;
  generateOversightReport: (report: Omit<OversightReport, 'reportId' | 'generatedAt' | 'createdAt' | 'updatedAt'>) => OversightReport;
  approveOversightReport: (reportId: string, approvedBy: string, remarks?: string) => void;
  updateOversightSettings: (newSettings: Partial<OversightSystemSettings>) => void;
  updateCollectionMonitoring: (monitoringId: string, data: Partial<OversightCollectionMonitoring>) => void;
  updateDisbursementTracking: (trackerId: string, status: TrackingStatus, verifiedBy?: string) => void;

  // Filtered views based on activeBranchId
  filteredLoans: Loan[];
  filteredBorrowers: Borrower[];
  filteredPayments: PaymentRecord[];
  filteredMembershipApps: MembershipApplication[];
  filteredWithdrawals: SavingsWithdrawalRequest[];

  // Database Synchronization
  dbStatus: { connected: boolean; database: string };
  isSyncingDb: boolean;
  syncWithDatabase: () => Promise<void>;

  // Computed KPIs
  stats: {
    totalPortfolio: number;
    totalOutstanding: number;
    totalDisbursed: number;
    totalCollected: number;
    activeLoansCount: number;
    overdueLoansCount: number;
    par30Ratio: number;
    par30: number;
    collectionRate: number;
    collectionEfficiency: number;
    totalVaultCash: number;
    activeBorrowersCount: number;
    totalSavingsPool: number;
    inactiveMembersCount: number;
    pendingMembershipCount: number;
  };

  // 1. Membership Actions
  submitMembershipApplication: (app: Partial<MembershipApplication>) => MembershipApplication;
  staffVerifyMembershipApp: (appId: string, initialShareCapital?: number) => void;
  educationCommRecordBI: (
    appId: string,
    biData: MembershipApplication['backgroundInvestigation']
  ) => void;
  bodApproveMembershipApp: (appId: string) => Borrower | null;
  rejectMembershipApp: (appId: string, reason: string) => void;

  submitMemberUpdateRequest: (req: Partial<MemberUpdateRequest>) => MemberUpdateRequest;
  approveMemberUpdateRequest: (reqId: string) => void;
  rejectMemberUpdateRequest: (reqId: string, reason: string) => void;

  logMemberFollowUp: (followUp: Partial<MemberFollowUpLog>) => void;
  reactivateMember: (memberId: string) => void;

  // 2. Savings Actions
  savingsAccounts: SavingsAccount[];
  openSavingsAccount: (params: {
    clientId: string;
    accountType?: SavingsAccountType;
    initialDeposit: number;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
    maintainingBalance?: number;
    interestRate?: number;
    branchId?: string;
  }) => { success: boolean; account?: SavingsAccount; transaction?: SavingsTransaction; error?: string };
  recordSavingsDeposit: (params: {
    accountId: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    date?: string;
    notes?: string;
  }) => { success: boolean; transaction?: SavingsTransaction; error?: string };
  recordSavingsWithdrawal: (params: {
    accountId: string;
    amount: number;
    paymentMethod?: string;
    referenceNumber?: string;
    date?: string;
    reason: string;
  }) => { success: boolean; transaction?: SavingsTransaction; error?: string };
  updateSavingsAccountStatus: (
    accountId: string,
    newStatus: SavingsAccountStatus,
    reason: string
  ) => { success: boolean; error?: string };
  creditMonthlySavingsInterest: () => { totalCredited: number; membersCount: number };
  depositSavings: (params: {
    memberId: string;
    amount: number;
    paymentMethod?: string;
    notes?: string;
  }) => SavingsTransaction | null;
  requestSavingsWithdrawal: (params: {
    memberId: string;
    amount: number;
    reason: string;
  }) => { success: boolean; error?: string; request?: SavingsWithdrawalRequest };
  managerApproveWithdrawal: (requestId: string) => boolean;
  managerRejectWithdrawal: (requestId: string, reason: string) => void;
  runMonthlyInterestCrediting: () => { totalCredited: number; membersCount: number };

  // 3. Client & Loans Actions
  registerClient: (clientData: Partial<Borrower>) => Borrower;
  updateClientStatus: (clientId: string, newStatus: ClientStatus, reason: string) => void;
  uploadKycDocument: (
    clientId: string,
    doc: {
      docType: KycDocumentType;
      fileName: string;
      fileSize?: string;
      fileUrl?: string;
      notes?: string;
    }
  ) => void;
  reviewKyc: (
    clientId: string,
    decision: 'APPROVED' | 'CORRECTION_REQUESTED' | 'REJECTED',
    notes: string,
    itemsChecked?: string[]
  ) => void;
  deleteKycDocument: (clientId: string, documentId: string) => void;
  addBorrower: (borrower: Partial<Borrower>) => Borrower;
  createBorrower: (borrower: Partial<Borrower>) => Borrower;
  updateBorrower: (id: string, updates: Partial<Borrower>) => void;
  deleteBorrower: (id: string) => void;
  createLoanApplication: (loanData: any, initialStatus?: LoanStatus | boolean) => Loan;
  submitLoanForApproval: (loanId: string, notes?: string) => void;
  startLoanReview: (loanId: string, notes?: string) => void;
  approveLoanApplication: (loanId: string, approvalData: LoanApprovalInfo) => void;
  rejectLoanApplication: (loanId: string, rejectionData: LoanRejectionInfo) => void;
  disburseLoanRecord: (loanId: string, disbursementData: LoanDisbursementInfo) => { success: boolean; message?: string };
  markLoanCompleted: (loanId: string) => void;
  markLoanDefaulted: (loanId: string, reason?: string) => void;
  
  // Coop Loan Steps
  loanProcessorVerifyLoan: (loanId: string, notes?: string) => void;
  bookkeeperVerifyLoan: (loanId: string, notes?: string) => void;
  creditCommitteeInterviewLoan: (loanId: string, evaluation: CreditCommitteeEvaluation) => void;
  prepareLoanVoucher: (loanId: string, voucher: Partial<LoanDisbursementVoucher>) => void;
  managerApproveLoanVoucher: (loanId: string) => void;
  disburseLoan: (loanId: string, method?: string) => void;
  rejectLoan: (loanId: string, reason?: string) => void;

  // Check multi-loan eligibility
  evaluateMultiLoanEligibility: (memberId: string) => {
    isEligible: boolean;
    activeLoanCount: number;
    activeLoanBalance: number;
    hasArrears: boolean;
    savingsEquityRatio: number;
    reasons: string[];
  };

  // 4. Payment Actions (Cash, Bank, GCash + OR + Rebates & Penalties)
  recordPayment: (payment: {
    loanId: string;
    amount: number;
    paymentMethod: PaymentRecord['paymentMethod'];
    transactionReference: string;
    notes?: string;
    date?: string;
    isAdvancePayment?: boolean;
  }) => PaymentRecord | null;

  // 5. Group Lending & Solidarity Actions
  createSolidarityGroup: (groupData: Partial<SolidarityGroup>) => SolidarityGroup;
  updateSolidarityGroup: (groupId: string, updates: Partial<SolidarityGroup>) => void;
  deleteSolidarityGroup: (groupId: string) => void;
  addMemberToGroup: (groupId: string, member: SolidarityGroupMember) => void;
  removeMemberFromGroup: (groupId: string, borrowerId: string) => void;
  assignGroupLeader: (groupId: string, leaderBorrowerId: string) => void;
  createGroupLoan: (loanData: Partial<GroupLoan>) => GroupLoan;
  approveGroupLoan: (groupLoanId: string) => void;
  disburseGroupLoan: (groupLoanId: string) => void;
  recordCenterMeeting: (meetingData: Partial<GroupMeetingLog>) => GroupMeetingLog;
  recordGroupRepayment: (params: {
    groupLoanId: string;
    borrowerId: string;
    amount: number;
    solidarityContribution?: number;
    paymentMethod?: string;
    notes?: string;
  }) => { success: boolean; error?: string };
  activateSolidarityBridge: (params: {
    groupId: string;
    borrowerId: string;
    shortfallAmount: number;
    reason: string;
  }) => { success: boolean; message: string };

  addBranch: (branch: Partial<Branch>) => void;
  updateBranch: (id: string, updates: Partial<Branch>) => void;
  addLoanProduct: (product: Partial<LoanProduct>) => void;
  updateLoanProduct: (id: string, updates: Partial<LoanProduct>) => void;
  sendReminder: (reminder: Partial<ReminderItem>) => void;
  restructureLoan: (
    loanId: string,
    optionsOrTenor: number | { newTermMonths: number; newInterestRate?: number; newInterestType?: any; reason?: string },
    reason?: string
  ) => void;
  logAudit: (
    action: string,
    details: string,
    type: AuditLogEntry['type'],
    extra?: { targetType?: string; targetId?: string; userName?: string; userRole?: string; ipAddress?: string }
  ) => void;
  clearAuditLogs: () => void;
  resetToDefaults: () => void;
}

const LoanContext = createContext<LoanContextType | null>(null);

const STORAGE_KEY = 'coop_lms_master_data_v2';

export function LoanProvider({ children }: { children: React.ReactNode }) {
  // Branches
  const [branches, setBranches] = useState<Branch[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_branches`);
      return saved ? JSON.parse(saved) : INITIAL_BRANCHES;
    } catch {
      return INITIAL_BRANCHES;
    }
  });

  const [activeBranchId, setActiveBranchId] = useState<string>('all');

  // Staff
  const [staffList, setStaffList] = useState<UserStaff[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_staff`);
      return saved ? JSON.parse(saved) : INITIAL_STAFF;
    } catch {
      return INITIAL_STAFF;
    }
  });

  const [currentUser, setCurrentUser] = useState<UserStaff>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_currentUser`);
      return saved ? JSON.parse(saved) : INITIAL_STAFF[0];
    } catch {
      return INITIAL_STAFF[0];
    }
  });

  // Loan Products
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_products`);
      return saved ? JSON.parse(saved) : INITIAL_LOAN_PRODUCTS;
    } catch {
      return INITIAL_LOAN_PRODUCTS;
    }
  });

  // Borrowers / Members
  const [borrowers, setBorrowers] = useState<Borrower[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_borrowers`);
      return saved ? JSON.parse(saved) : INITIAL_BORROWERS;
    } catch {
      return INITIAL_BORROWERS;
    }
  });

  // Loans
  const [loans, setLoans] = useState<Loan[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_loans`);
      return saved ? JSON.parse(saved) : INITIAL_LOANS;
    } catch {
      return INITIAL_LOANS;
    }
  });

  // Payments
  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_payments`);
      return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
    } catch {
      return INITIAL_PAYMENTS;
    }
  });

  // Membership Applications
  const [membershipApplications, setMembershipApplications] = useState<MembershipApplication[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_membershipApps`);
      return saved ? JSON.parse(saved) : INITIAL_MEMBERSHIP_APPLICATIONS;
    } catch {
      return INITIAL_MEMBERSHIP_APPLICATIONS;
    }
  });

  // Member Update Requests
  const [memberUpdateRequests, setMemberUpdateRequests] = useState<MemberUpdateRequest[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_updateRequests`);
      return saved ? JSON.parse(saved) : INITIAL_UPDATE_REQUESTS;
    } catch {
      return INITIAL_UPDATE_REQUESTS;
    }
  });

  // Member Inactive & Field Follow-up Logs
  const [memberFollowUpLogs, setMemberFollowUpLogs] = useState<MemberFollowUpLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_followUps`);
      return saved ? JSON.parse(saved) : INITIAL_FOLLOW_UP_LOGS;
    } catch {
      return INITIAL_FOLLOW_UP_LOGS;
    }
  });

  // Savings Accounts Master State
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_savingsAccounts`);
      return saved ? JSON.parse(saved) : INITIAL_SAVINGS_ACCOUNTS;
    } catch {
      return INITIAL_SAVINGS_ACCOUNTS;
    }
  });

  // Savings Transactions
  const [savingsTransactions, setSavingsTransactions] = useState<SavingsTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_savingsTx`);
      return saved ? JSON.parse(saved) : INITIAL_SAVINGS_TRANSACTIONS;
    } catch {
      return INITIAL_SAVINGS_TRANSACTIONS;
    }
  });

  // Savings Withdrawal Requests
  const [withdrawalRequests, setWithdrawalRequests] = useState<SavingsWithdrawalRequest[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_withdrawals`);
      return saved ? JSON.parse(saved) : INITIAL_WITHDRAWAL_REQUESTS;
    } catch {
      return INITIAL_WITHDRAWAL_REQUESTS;
    }
  });

  // Savings Interest Credit Logs
  const [interestLogs, setInterestLogs] = useState<InterestCreditLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_interestLogs`);
      return saved ? JSON.parse(saved) : INITIAL_INTEREST_LOGS;
    } catch {
      return INITIAL_INTEREST_LOGS;
    }
  });

  // Solidarity Groups Master State
  const [solidarityGroups, setSolidarityGroups] = useState<SolidarityGroup[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_solidarityGroups`);
      return saved ? JSON.parse(saved) : INITIAL_SOLIDARITY_GROUPS;
    } catch {
      return INITIAL_SOLIDARITY_GROUPS;
    }
  });

  // Group Loans Master State
  const [groupLoans, setGroupLoans] = useState<GroupLoan[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_groupLoans`);
      return saved ? JSON.parse(saved) : INITIAL_GROUP_LOANS;
    } catch {
      return INITIAL_GROUP_LOANS;
    }
  });

  // Group Meeting Logs Master State
  const [groupMeetingLogs, setGroupMeetingLogs] = useState<GroupMeetingLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_groupMeetings`);
      return saved ? JSON.parse(saved) : INITIAL_GROUP_MEETING_LOGS;
    } catch {
      return INITIAL_GROUP_MEETING_LOGS;
    }
  });

  // Financial Transactions Core Ledger Master State
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_financialTx`);
      return saved ? JSON.parse(saved) : INITIAL_FINANCIAL_TRANSACTIONS;
    } catch {
      return INITIAL_FINANCIAL_TRANSACTIONS;
    }
  });

  // 8. Financial Submodule States (financial.*)
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_finAccounts`);
      return saved ? JSON.parse(saved) : INITIAL_FINANCIAL_ACCOUNTS;
    } catch {
      return INITIAL_FINANCIAL_ACCOUNTS;
    }
  });

  const [financialSuppliers, setFinancialSuppliers] = useState<FinancialSupplier[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_finSuppliers`);
      return saved ? JSON.parse(saved) : INITIAL_FINANCIAL_SUPPLIERS;
    } catch {
      return INITIAL_FINANCIAL_SUPPLIERS;
    }
  });

  const [financialSupplierBills, setFinancialSupplierBills] = useState<FinancialSupplierBill[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_finSupplierBills`);
      return saved ? JSON.parse(saved) : INITIAL_FINANCIAL_SUPPLIER_BILLS;
    } catch {
      return INITIAL_FINANCIAL_SUPPLIER_BILLS;
    }
  });

  const [financialBillPayments, setFinancialBillPayments] = useState<FinancialBillPayment[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_finBillPayments`);
      return saved ? JSON.parse(saved) : INITIAL_FINANCIAL_BILL_PAYMENTS;
    } catch {
      return INITIAL_FINANCIAL_BILL_PAYMENTS;
    }
  });

  const [financialBudgets, setFinancialBudgets] = useState<FinancialBudget[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_finBudgets`);
      return saved ? JSON.parse(saved) : INITIAL_FINANCIAL_BUDGETS;
    } catch {
      return INITIAL_FINANCIAL_BUDGETS;
    }
  });

  const [financialTaxRecords, setFinancialTaxRecords] = useState<FinancialTaxRecord[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_finTaxRecords`);
      return saved ? JSON.parse(saved) : INITIAL_FINANCIAL_TAX_RECORDS;
    } catch {
      return INITIAL_FINANCIAL_TAX_RECORDS;
    }
  });

  const [financialJournalEntries, setFinancialJournalEntries] = useState<FinancialJournalEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_finJournalEntries`);
      return saved ? JSON.parse(saved) : INITIAL_FINANCIAL_JOURNAL_ENTRIES;
    } catch {
      return INITIAL_FINANCIAL_JOURNAL_ENTRIES;
    }
  });

  const [financialCashTransactions, setFinancialCashTransactions] = useState<FinancialCashTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_finCashTx`);
      return saved ? JSON.parse(saved) : INITIAL_FINANCIAL_CASH_TRANSACTIONS;
    } catch {
      return INITIAL_FINANCIAL_CASH_TRANSACTIONS;
    }
  });

  const [financialMonthlyCashFlow, setFinancialMonthlyCashFlow] = useState<FinancialMonthlyCashFlow[]>(INITIAL_FINANCIAL_MONTHLY_CASH_FLOW);
  const [financialMonthlyDisbursements, setFinancialMonthlyDisbursements] = useState<FinancialMonthlyDisbursement[]>(INITIAL_FINANCIAL_MONTHLY_DISBURSEMENTS);
  const [financialMonthlyCollections, setFinancialMonthlyCollections] = useState<FinancialMonthlyCollection[]>(INITIAL_FINANCIAL_MONTHLY_COLLECTIONS);

  // 9. Oversight Submodule States (oversight.* KALASAG)
  const [oversightSnapshots, setOversightSnapshots] = useState<OversightLoanPortfolioSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightSnapshots`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_SNAPSHOTS;
    } catch {
      return INITIAL_OVERSIGHT_SNAPSHOTS;
    }
  });

  const [oversightCollectionMonitoring, setOversightCollectionMonitoring] = useState<OversightCollectionMonitoring[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightCollectionMon`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_COLLECTION_MONITORING;
    } catch {
      return INITIAL_OVERSIGHT_COLLECTION_MONITORING;
    }
  });

  const [oversightDisbursementTracker, setOversightDisbursementTracker] = useState<OversightDisbursementTracker[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightDsbTracker`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_DISBURSEMENT_TRACKER;
    } catch {
      return INITIAL_OVERSIGHT_DISBURSEMENT_TRACKER;
    }
  });

  const [oversightAuditEngagements, setOversightAuditEngagements] = useState<OversightAuditEngagement[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightEngagements`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_AUDIT_ENGAGEMENTS;
    } catch {
      return INITIAL_OVERSIGHT_AUDIT_ENGAGEMENTS;
    }
  });

  const [oversightAuditFindings, setOversightAuditFindings] = useState<OversightAuditFinding[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightFindings`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_AUDIT_FINDINGS;
    } catch {
      return INITIAL_OVERSIGHT_AUDIT_FINDINGS;
    }
  });

  const [oversightCorrectiveActions, setOversightCorrectiveActions] = useState<OversightCorrectiveAction[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightCorrectiveActions`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_CORRECTIVE_ACTIONS;
    } catch {
      return INITIAL_OVERSIGHT_CORRECTIVE_ACTIONS;
    }
  });

  const [oversightComplianceRequirements, setOversightComplianceRequirements] = useState<OversightComplianceRequirement[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightComplianceReqs`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_COMPLIANCE_REQUIREMENTS;
    } catch {
      return INITIAL_OVERSIGHT_COMPLIANCE_REQUIREMENTS;
    }
  });

  const [oversightComplianceReviews, setOversightComplianceReviews] = useState<OversightComplianceReview[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightComplianceReviews`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_COMPLIANCE_REVIEWS;
    } catch {
      return INITIAL_OVERSIGHT_COMPLIANCE_REVIEWS;
    }
  });

  const [oversightControlExceptions, setOversightControlExceptions] = useState<OversightControlException[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightControlExceptions`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_CONTROL_EXCEPTIONS;
    } catch {
      return INITIAL_OVERSIGHT_CONTROL_EXCEPTIONS;
    }
  });

  const [oversightReports, setOversightReports] = useState<OversightReport[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightReports`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_REPORTS;
    } catch {
      return INITIAL_OVERSIGHT_REPORTS;
    }
  });

  const [oversightMetrics, setOversightMetrics] = useState<OversightDashboardMetric[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightMetrics`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_METRICS;
    } catch {
      return INITIAL_OVERSIGHT_METRICS;
    }
  });

  const [oversightSettings, setOversightSettings] = useState<OversightSystemSettings>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_oversightSettings`);
      return saved ? JSON.parse(saved) : INITIAL_OVERSIGHT_SETTINGS;
    } catch {
      return INITIAL_OVERSIGHT_SETTINGS;
    }
  });

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_logs`);
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  // Reminders
  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  // Database Connection & Sync Status
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; database: string }>({
    connected: true,
    database: 'PostgreSQL (Cloud SQL)',
  });
  const [isSyncingDb, setIsSyncingDb] = useState<boolean>(false);

  const syncWithDatabase = async () => {
    try {
      setIsSyncingDb(true);
      const res = await authFetch('/api/db/all');
      if (res.ok) {
        const json = await res.json();
        if (json.connected && json.data) {
          setDbStatus({ connected: true, database: 'PostgreSQL (Cloud SQL)' });
          if (json.data.borrowers && json.data.borrowers.length > 0) setBorrowers(json.data.borrowers);
          if (json.data.loans && json.data.loans.length > 0) setLoans(json.data.loans);
          if (json.data.payments && json.data.payments.length > 0) setPayments(json.data.payments);
          if (json.data.membershipApplications && json.data.membershipApplications.length > 0) setMembershipApplications(json.data.membershipApplications);
          if (json.data.memberUpdateRequests && json.data.memberUpdateRequests.length > 0) setMemberUpdateRequests(json.data.memberUpdateRequests);
          if (json.data.memberFollowUpLogs && json.data.memberFollowUpLogs.length > 0) setMemberFollowUpLogs(json.data.memberFollowUpLogs);
          if (json.data.savingsTransactions && json.data.savingsTransactions.length > 0) setSavingsTransactions(json.data.savingsTransactions);
          if (json.data.savingsWithdrawalRequests && json.data.savingsWithdrawalRequests.length > 0) setWithdrawalRequests(json.data.savingsWithdrawalRequests);
          if (json.data.financialTransactions && json.data.financialTransactions.length > 0) setFinancialTransactions(json.data.financialTransactions);
          if (json.data.auditLogs && json.data.auditLogs.length > 0) setAuditLogs(json.data.auditLogs);
          if (json.data.branches && json.data.branches.length > 0) setBranches(json.data.branches);
          if (json.data.loanProducts && json.data.loanProducts.length > 0) setLoanProducts(json.data.loanProducts);
        }
      }
    } catch (e) {
      console.warn('DB Sync check:', e);
    } finally {
      setIsSyncingDb(false);
    }
  };

  useEffect(() => {
    syncWithDatabase();
  }, []);

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_branches`, JSON.stringify(branches));
      localStorage.setItem(`${STORAGE_KEY}_staff`, JSON.stringify(staffList));
      localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(currentUser));
      localStorage.setItem(`${STORAGE_KEY}_products`, JSON.stringify(loanProducts));
      localStorage.setItem(`${STORAGE_KEY}_borrowers`, JSON.stringify(borrowers));
      localStorage.setItem(`${STORAGE_KEY}_loans`, JSON.stringify(loans));
      localStorage.setItem(`${STORAGE_KEY}_payments`, JSON.stringify(payments));
      localStorage.setItem(`${STORAGE_KEY}_membershipApps`, JSON.stringify(membershipApplications));
      localStorage.setItem(`${STORAGE_KEY}_updateRequests`, JSON.stringify(memberUpdateRequests));
      localStorage.setItem(`${STORAGE_KEY}_followUps`, JSON.stringify(memberFollowUpLogs));
      localStorage.setItem(`${STORAGE_KEY}_savingsAccounts`, JSON.stringify(savingsAccounts));
      localStorage.setItem(`${STORAGE_KEY}_savingsTx`, JSON.stringify(savingsTransactions));
      localStorage.setItem(`${STORAGE_KEY}_withdrawals`, JSON.stringify(withdrawalRequests));
      localStorage.setItem(`${STORAGE_KEY}_interestLogs`, JSON.stringify(interestLogs));
      localStorage.setItem(`${STORAGE_KEY}_solidarityGroups`, JSON.stringify(solidarityGroups));
      localStorage.setItem(`${STORAGE_KEY}_groupLoans`, JSON.stringify(groupLoans));
      localStorage.setItem(`${STORAGE_KEY}_groupMeetings`, JSON.stringify(groupMeetingLogs));
      localStorage.setItem(`${STORAGE_KEY}_financialTx`, JSON.stringify(financialTransactions));
      localStorage.setItem(`${STORAGE_KEY}_logs`, JSON.stringify(auditLogs));
    } catch (e) {
      console.warn('Storage sync error:', e);
    }
  }, [
    branches,
    staffList,
    currentUser,
    loanProducts,
    borrowers,
    loans,
    payments,
    membershipApplications,
    memberUpdateRequests,
    memberFollowUpLogs,
    savingsAccounts,
    savingsTransactions,
    withdrawalRequests,
    interestLogs,
    solidarityGroups,
    groupLoans,
    groupMeetingLogs,
    financialTransactions,
    auditLogs,
  ]);

  // Helper log function
  const logAudit = (
    action: string,
    details: string,
    type: AuditLogEntry['type'],
    extra?: { targetType?: string; targetId?: string; userName?: string; userRole?: string; ipAddress?: string }
  ) => {
    const entry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      performedBy: `${currentUser.name} (${currentUser.title})`,
      userName: extra?.userName || currentUser.name,
      userRole: (extra?.userRole as any) || currentUser.role,
      branchId: activeBranchId === 'all' ? 'br-main' : activeBranchId,
      type,
      targetType: extra?.targetType,
      targetId: extra?.targetId,
      ipAddress: extra?.ipAddress || '192.168.1.104',
    };
    setAuditLogs((prev) => [entry, ...prev.slice(0, 499)]);
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
  };

  // Active Branch
  const activeBranch = activeBranchId === 'all' ? null : branches.find((b) => b.id === activeBranchId) || null;

  // Filtered collections
  const filteredLoans = activeBranchId === 'all' ? loans : loans.filter((l) => l.branchId === activeBranchId);
  const filteredBorrowers = activeBranchId === 'all' ? borrowers : borrowers.filter((b) => b.branchId === activeBranchId);
  const filteredPayments = activeBranchId === 'all' ? payments : payments.filter((p) => p.branchId === activeBranchId);
  const filteredMembershipApps = activeBranchId === 'all' ? membershipApplications : membershipApplications.filter((a) => a.branchId === activeBranchId);
  const filteredWithdrawals = activeBranchId === 'all' ? withdrawalRequests : withdrawalRequests.filter((w) => w.branchId === activeBranchId);
  const filteredSolidarityGroups = activeBranchId === 'all' ? solidarityGroups : solidarityGroups.filter((g) => g.branchId === activeBranchId);
  const filteredGroupLoans = activeBranchId === 'all' ? groupLoans : groupLoans.filter((g) => g.branchId === activeBranchId);
  const filteredFinancialTransactions = activeBranchId === 'all'
    ? financialTransactions
    : financialTransactions.filter((t) => !t.branchId || t.branchId === activeBranchId);

  // ==========================================
  // 7. FINANCIAL TRANSACTION CORE ACTIONS
  // ==========================================

  const createFinancialTransaction = (
    data: Omit<FinancialTransaction, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  ): FinancialTransaction => {
    const now = new Date().toISOString();
    const dateStr = data.transactionDate || now.split('T')[0];
    const newTxn: FinancialTransaction = {
      id: data.id || `TXN-${dateStr.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`,
      referenceNumber: data.referenceNumber || `REF-${Date.now().toString().slice(-6)}`,
      clientId: data.clientId,
      clientName: data.clientName,
      accountOrLoanId: data.accountOrLoanId,
      accountOrLoanType: data.accountOrLoanType || 'General',
      branchId: data.branchId || (activeBranchId === 'all' ? 'br-main' : activeBranchId),
      transactionType: data.transactionType,
      amount: data.amount,
      transactionDate: dateStr,
      paymentMethod: data.paymentMethod || 'Cash',
      processedBy: data.processedBy || `${currentUser.name} (${currentUser.title})`,
      processedByRole: data.processedByRole || currentUser.title || 'Staff',
      status: data.status || 'Completed',
      notes: data.notes,
      reversalOfTxnId: data.reversalOfTxnId,
      reversedByTxnId: data.reversedByTxnId,
      metadata: data.metadata,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };

    setFinancialTransactions((prev) => [newTxn, ...prev]);

    // Async persist to server backend
    authFetch('/api/financial-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTxn),
    }).catch((e) => console.log('Txn API sync:', e.message));

    return newTxn;
  };

  const reverseFinancialTransaction = (
    transactionId: string,
    reason: string,
    reversedBy?: string
  ): {
    success: boolean;
    reversedTransaction?: FinancialTransaction;
    adjustmentTransaction?: FinancialTransaction;
    error?: string;
    message?: string;
  } => {
    const orig = financialTransactions.find((t) => t.id === transactionId);
    if (!orig) {
      return { success: false, error: 'Transaction record not found in ledger.' };
    }
    if (orig.status === 'Reversed') {
      return { success: false, error: 'This transaction is already reversed.' };
    }
    if (orig.status === 'Cancelled' || orig.status === 'Failed') {
      return { success: false, error: `Cannot reverse a transaction in "${orig.status}" status.` };
    }

    const now = new Date().toISOString();
    const dateStr = now.split('T')[0];
    const reversalTxnId = `TXN-REV-${Date.now().toString().slice(-6)}`;
    const adjustmentRef = `REV-ADJ-${Date.now().toString().slice(-4)}`;
    const staffName = reversedBy || `${currentUser.name} (${currentUser.title})`;

    // Create adjustment transaction record linked to the reversed one
    const adjustmentTxn: FinancialTransaction = {
      id: reversalTxnId,
      referenceNumber: adjustmentRef,
      clientId: orig.clientId,
      clientName: orig.clientName,
      accountOrLoanId: orig.accountOrLoanId,
      accountOrLoanType: orig.accountOrLoanType,
      branchId: orig.branchId,
      transactionType: 'Adjustment',
      amount: -Math.abs(orig.amount),
      transactionDate: dateStr,
      paymentMethod: 'Adjustment',
      processedBy: staffName,
      processedByRole: currentUser.title || 'General Manager / Auditor',
      status: 'Completed',
      notes: `Reversal & Adjustment of transaction ${orig.referenceNumber} (${orig.id}). Reason: ${reason || 'Correction of entry'}`,
      reversalOfTxnId: orig.id,
      metadata: {
        reversedTxnId: orig.id,
        reversedTxnRef: orig.referenceNumber,
        originalType: orig.transactionType,
        reason: reason || 'Correction of entry',
        reversedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Update original transaction status to 'Reversed'
    const updatedOrig: FinancialTransaction = {
      ...orig,
      status: 'Reversed',
      reversedByTxnId: reversalTxnId,
      updatedAt: now,
    };

    setFinancialTransactions((prev) => [
      adjustmentTxn,
      ...prev.map((t) => (t.id === transactionId ? updatedOrig : t)),
    ]);

    // Handle financial balance reversions
    if (orig.transactionType === 'Loan Repayment') {
      // Revert repayment on loan
      setLoans((prev) =>
        prev.map((l) => {
          if (l.id === orig.accountOrLoanId || l.loanNumber === orig.accountOrLoanId) {
            const newBal = l.remainingBalance + orig.amount;
            const newPaid = Math.max(0, l.totalPaid - orig.amount);
            return {
              ...l,
              remainingBalance: newBal,
              totalPaid: newPaid,
              status: newBal > 0 && l.status === 'Completed' ? 'Active' : l.status,
            };
          }
          return l;
        })
      );
      setBorrowers((prev) =>
        prev.map((b) =>
          b.id === orig.clientId
            ? { ...b, totalRepaid: Math.max(0, (b.totalRepaid || 0) - orig.amount) }
            : b
        )
      );
    } else if (orig.transactionType === 'Savings Deposit') {
      setSavingsAccounts((prev) =>
        prev.map((a) => {
          if (a.id === orig.accountOrLoanId || a.accountNumber === orig.accountOrLoanId || a.clientId === orig.clientId) {
            const newBal = Math.max(0, a.balance - orig.amount);
            return {
              ...a,
              balance: newBal,
              availableBalance: Math.max(0, newBal - a.maintainingBalance),
              totalDeposited: Math.max(0, a.totalDeposited - orig.amount),
            };
          }
          return a;
        })
      );
      setBorrowers((prev) =>
        prev.map((b) =>
          b.id === orig.clientId
            ? { ...b, savingsBalance: Math.max(0, (b.savingsBalance || 0) - orig.amount) }
            : b
        )
      );
    } else if (orig.transactionType === 'Savings Withdrawal') {
      setSavingsAccounts((prev) =>
        prev.map((a) => {
          if (a.id === orig.accountOrLoanId || a.accountNumber === orig.accountOrLoanId || a.clientId === orig.clientId) {
            const newBal = a.balance + orig.amount;
            return {
              ...a,
              balance: newBal,
              availableBalance: Math.max(0, newBal - a.maintainingBalance),
              totalWithdrawn: Math.max(0, a.totalWithdrawn - orig.amount),
            };
          }
          return a;
        })
      );
      setBorrowers((prev) =>
        prev.map((b) =>
          b.id === orig.clientId
            ? { ...b, savingsBalance: (b.savingsBalance || 0) + orig.amount }
            : b
        )
      );
    }

    logAudit(
      'FINANCIAL_TRANSACTION_REVERSED',
      `Reversed financial transaction ${orig.referenceNumber} (${orig.transactionType}, ₱${orig.amount.toLocaleString()}). Linked adjustment record ${adjustmentRef} generated. Reason: ${reason}`,
      'PAYMENT',
      { targetType: 'FinancialTransaction', targetId: orig.id }
    );

    // Call server API in background
    authFetch(`/api/financial-transactions/${transactionId}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, reversedBy: staffName }),
    }).catch((e) => console.log('Reversal API sync:', e.message));

    return {
      success: true,
      reversedTransaction: updatedOrig,
      adjustmentTransaction: adjustmentTxn,
      message: `Transaction ${orig.referenceNumber} reversed. Linked adjustment ${adjustmentRef} recorded.`,
    };
  };

  const updateFinancialTransactionStatus = (
    transactionId: string,
    newStatus: FinancialTransactionStatus,
    notes?: string
  ): { success: boolean; error?: string } => {
    const orig = financialTransactions.find((t) => t.id === transactionId);
    if (!orig) return { success: false, error: 'Transaction not found.' };

    const now = new Date().toISOString();
    setFinancialTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              status: newStatus,
              notes: notes ? `${t.notes ? t.notes + ' | ' : ''}${notes}` : t.notes,
              updatedAt: now,
            }
          : t
      )
    );

    logAudit(
      'FINANCIAL_TRANSACTION_STATUS_UPDATED',
      `Updated transaction ${orig.referenceNumber} status from ${orig.status} to ${newStatus}`,
      'PAYMENT',
      { targetType: 'FinancialTransaction', targetId: orig.id }
    );

    authFetch(`/api/financial-transactions/${transactionId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, notes }),
    }).catch((e) => console.log('Status API sync:', e.message));

    return { success: true };
  };

  // Computed Stats
  const totalDisbursed = filteredLoans.reduce((sum, l) => sum + (l.status !== 'Draft' && l.status !== 'Rejected' ? l.principalAmount : 0), 0);
  const totalPortfolio = filteredLoans.reduce((sum, l) => (l.status === 'Disbursed' || l.status === 'In Arrears' ? sum + l.remainingBalance : sum), 0);
  const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const activeLoansCount = filteredLoans.filter((l) => l.status === 'Disbursed' || l.status === 'In Arrears').length;
  const overdueLoans = filteredLoans.filter((l) => l.status === 'In Arrears' || (l.daysInArrears && l.daysInArrears > 0));
  const overdueLoansCount = overdueLoans.length;
  const overdueBalance = overdueLoans.reduce((sum, l) => sum + l.remainingBalance, 0);
  const par30Ratio = totalPortfolio > 0 ? (overdueBalance / totalPortfolio) * 100 : 0;
  const collectionRate = totalDisbursed > 0 ? Math.min(100, (totalCollected / totalDisbursed) * 100) : 100;
  const totalVaultCash = activeBranchId === 'all' ? branches.reduce((sum, b) => sum + b.cashVaultBalance, 0) : activeBranch?.cashVaultBalance || 0;
  const activeBorrowersCount = filteredBorrowers.filter((b) => b.memberStatus === 'Active').length;
  const totalSavingsPool = filteredBorrowers.reduce((sum, b) => sum + (b.savingsBalance || 0), 0);
  const inactiveMembersCount = filteredBorrowers.filter((b) => b.memberStatus === 'Inactive' || b.memberStatus === 'Irregular').length;
  const pendingMembershipCount = filteredMembershipApps.filter((a) => a.currentStep !== 'BOD_APPROVED' && a.currentStep !== 'REJECTED').length;

  // ==========================================
  // 1. MEMBERSHIP SERVICES IMPLEMENTATION
  // ==========================================

  // Step 1: Submit Application
  const submitMembershipApplication = (appData: Partial<MembershipApplication>): MembershipApplication => {
    const newApp: MembershipApplication = {
      id: `app-mem-${Date.now()}`,
      applicationNumber: `MEM-APP-${new Date().getFullYear()}-${String(membershipApplications.length + 84).padStart(4, '0')}`,
      applicantName: appData.applicantName || 'New Applicant',
      dateOfBirth: appData.dateOfBirth || '1990-01-01',
      civilStatus: appData.civilStatus || 'Single',
      phone: appData.phone || '',
      email: appData.email || '',
      facebookAccount: appData.facebookAccount || '',
      address: appData.address || '',
      occupation: appData.occupation || '',
      employerOrBusiness: appData.employerOrBusiness || '',
      monthlyIncome: appData.monthlyIncome || 25000,
      branchId: appData.branchId || (activeBranchId === 'all' ? 'br-main' : activeBranchId),
      submittedDate: new Date().toISOString().split('T')[0],
      currentStep: 'SUBMITTED',
      validIdAttached: appData.validIdAttached ?? true,
      proofOfIncomeAttached: appData.proofOfIncomeAttached ?? true,
      twoByTwoPhotoAttached: appData.twoByTwoPhotoAttached ?? true,
      membershipFeePaid: false,
      initialShareCapital: appData.initialShareCapital || 2000,
      targetCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 month
    };

    setMembershipApplications((prev) => [newApp, ...prev]);
    logAudit('MEMBERSHIP_APPLICATION_SUBMITTED', `Received application ${newApp.applicationNumber} from ${newApp.applicantName}`, 'MEMBERSHIP');
    return newApp;
  };

  // Step 2 & 3: Staff Checks completeness, encodes info, and processes payment
  const staffVerifyMembershipApp = (appId: string, initialShareCapital: number = 2000) => {
    setMembershipApplications((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          return {
            ...app,
            currentStep: 'PAYMENT_PROCESSED',
            validIdAttached: true,
            proofOfIncomeAttached: true,
            twoByTwoPhotoAttached: true,
            membershipFeePaid: true, // ₱500 fee paid
            initialShareCapital,
            encodedBy: `${currentUser.name} (${currentUser.title})`,
            encodedDate: new Date().toISOString().split('T')[0],
          };
        }
        return app;
      })
    );
    logAudit('MEMBERSHIP_STAFF_VERIFIED', `Staff encoded and processed ₱500 fee + share capital for application ${appId}`, 'MEMBERSHIP');
  };

  // Step 4: Education Committee Reviews Application & Conducts Background Investigation (B.I.)
  const educationCommRecordBI = (appId: string, biData: MembershipApplication['backgroundInvestigation']) => {
    setMembershipApplications((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          return {
            ...app,
            currentStep: 'EDUCATION_COMM_BI',
            backgroundInvestigation: biData,
          };
        }
        return app;
      })
    );
    logAudit('MEMBERSHIP_BI_COMPLETED', `Education Committee completed Background Investigation for ${appId}`, 'MEMBERSHIP');
  };

  // Step 5: Board of Directors (BOD) Approves Application -> Creates Full Member
  const bodApproveMembershipApp = (appId: string): Borrower | null => {
    const targetApp = membershipApplications.find((a) => a.id === appId);
    if (!targetApp) return null;

    const newBorrowerId = `bor-${Date.now()}`;
    const newBorrower: Borrower = {
      id: newBorrowerId,
      borrowerNumber: `MEM-${new Date().getFullYear()}-${String(borrowers.length + 101).padStart(4, '0')}`,
      fullName: targetApp.applicantName,
      idNumber: `ID-${Math.floor(100000 + Math.random() * 900000)}`,
      phone: targetApp.phone,
      email: targetApp.email,
      dateOfBirth: targetApp.dateOfBirth,
      gender: 'Female',
      civilStatus: targetApp.civilStatus,
      address: targetApp.address,
      facebookAccount: targetApp.facebookAccount,
      branchId: targetApp.branchId,
      employmentStatus: 'Employed',
      employerOrBusiness: targetApp.employerOrBusiness,
      occupation: targetApp.occupation,
      monthlyIncome: targetApp.monthlyIncome,
      monthlyExpenses: Math.round(targetApp.monthlyIncome * 0.45),
      creditScore: 720,
      creditTier: 'Good',
      kycStatus: 'Verified',
      memberStatus: 'Active',
      membershipDate: new Date().toISOString().split('T')[0],
      savingsBalance: targetApp.initialShareCapital || 2000, // Starts above ₱1,000 maintaining balance
      shareCapital: targetApp.initialShareCapital || 2000,
      activeLoansCount: 0,
      totalBorrowed: 0,
      totalRepaid: 0,
      avatar: `https://images.unsplash.com/photo-${1534528741775 + (borrowers.length % 5)}?w=150&auto=format&fit=crop&q=80`,
      joinedDate: new Date().toISOString().split('T')[0],
      lastActivityDate: new Date().toISOString().split('T')[0],
      notes: `Approved by Board of Directors on ${new Date().toLocaleDateString()}. Initial Share Capital & Savings deposited.`,
    };

    setBorrowers((prev) => [newBorrower, ...prev]);

    setMembershipApplications((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          return {
            ...app,
            currentStep: 'BOD_APPROVED',
            bodReviewDate: new Date().toISOString().split('T')[0],
            bodApprovedBy: ['Hon. Francisco Del Rosario (BOD Chair)', 'Eduardo Manalo (GM)'],
            createdBorrowerId: newBorrowerId,
          };
        }
        return app;
      })
    );

    // Also record initial savings deposit
    const initialTx: SavingsTransaction = {
      id: `sav-tx-${Date.now()}`,
      savingsAccountId: newBorrowerId,
      memberId: newBorrowerId,
      memberName: newBorrower.fullName,
      transactionNumber: `SAV-OPN-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      type: 'Deposit',
      amount: newBorrower.savingsBalance,
      balanceBefore: 0,
      balanceAfter: newBorrower.savingsBalance,
      processedBy: 'System Auto-Credit (Initial Membership Deposit)',
      officialReceiptNumber: `OR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: 'Initial Share Capital and Savings Equity on BOD Approval',
    };
    setSavingsTransactions((prev) => [initialTx, ...prev]);

    logAudit('MEMBERSHIP_BOD_APPROVED', `Board of Directors approved application ${targetApp.applicationNumber}. Created member ${newBorrower.fullName} (${newBorrower.borrowerNumber})`, 'MEMBERSHIP');

    return newBorrower;
  };

  const rejectMembershipApp = (appId: string, reason: string) => {
    setMembershipApplications((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, currentStep: 'REJECTED', rejectionReason: reason } : app))
    );
    logAudit('MEMBERSHIP_REJECTED', `Application ${appId} was rejected: ${reason}`, 'MEMBERSHIP');
  };

  // Member Information Update Requests
  const submitMemberUpdateRequest = (reqData: Partial<MemberUpdateRequest>): MemberUpdateRequest => {
    const member = borrowers.find((b) => b.id === reqData.memberId);
    const newReq: MemberUpdateRequest = {
      id: `upd-${Date.now()}`,
      memberId: reqData.memberId || '',
      memberName: member?.fullName || reqData.memberName || '',
      memberNumber: member?.borrowerNumber || reqData.memberNumber || '',
      branchId: member?.branchId || 'br-main',
      requestDate: new Date().toISOString().split('T')[0],
      channel: reqData.channel || 'Office Visit',
      fieldToUpdate: reqData.fieldToUpdate || 'Civil Status',
      oldValue: reqData.oldValue || (member ? String((member as any)[reqData.fieldToUpdate?.toLowerCase() || ''] || '') : ''),
      newValue: reqData.newValue || '',
      reason: reqData.reason || '',
      supportingDocType: reqData.supportingDocType || 'Marriage Contract',
      supportingDocFileName: reqData.supportingDocFileName || 'Supporting_Document.pdf',
      supportingDocVerified: true,
      status: 'Pending',
    };

    setMemberUpdateRequests((prev) => [newReq, ...prev]);
    logAudit('MEMBER_UPDATE_REQUESTED', `Update request for ${newReq.memberName} (${newReq.fieldToUpdate} -> ${newReq.newValue}) via ${newReq.channel}`, 'BORROWER');
    return newReq;
  };

  const approveMemberUpdateRequest = (reqId: string) => {
    const req = memberUpdateRequests.find((r) => r.id === reqId);
    if (!req) return;

    // Apply update to borrower
    setBorrowers((prev) =>
      prev.map((b) => {
        if (b.id === req.memberId) {
          const updated = { ...b };
          if (req.fieldToUpdate === 'Civil Status') {
            const rawVal = req.newValue.toLowerCase();
            if (rawVal.includes('married')) updated.civilStatus = 'Married';
            else if (rawVal.includes('widowed')) updated.civilStatus = 'Widowed';
            else if (rawVal.includes('separated')) updated.civilStatus = 'Separated';
            else updated.civilStatus = 'Single';
          } else if (req.fieldToUpdate === 'Address') {
            updated.address = req.newValue;
          } else if (req.fieldToUpdate === 'Contact Number') {
            updated.phone = req.newValue;
          } else if (req.fieldToUpdate === 'Employment') {
            updated.employerOrBusiness = req.newValue;
          }
          updated.lastActivityDate = new Date().toISOString().split('T')[0];
          return updated;
        }
        return b;
      })
    );

    setMemberUpdateRequests((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'Approved',
              reviewedBy: `${currentUser.name} (${currentUser.title})`,
              reviewDate: new Date().toISOString().split('T')[0],
              remarks: 'Supporting document verified and personal information updated in master file.',
            }
          : r
      )
    );

    logAudit('MEMBER_UPDATE_APPROVED', `Approved ${req.fieldToUpdate} update for ${req.memberName} with ${req.supportingDocType}`, 'BORROWER');
  };

  const rejectMemberUpdateRequest = (reqId: string, reason: string) => {
    setMemberUpdateRequests((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'Rejected',
              reviewedBy: `${currentUser.name} (${currentUser.title})`,
              reviewDate: new Date().toISOString().split('T')[0],
              remarks: reason,
            }
          : r
      )
    );
    logAudit('MEMBER_UPDATE_REJECTED', `Rejected update request ${reqId}: ${reason}`, 'BORROWER');
  };

  // Inactive Member Follow-up & Visits
  const logMemberFollowUp = (followUpData: Partial<MemberFollowUpLog>) => {
    const member = borrowers.find((b) => b.id === followUpData.memberId);
    const newLog: MemberFollowUpLog = {
      id: `fol-${Date.now()}`,
      memberId: followUpData.memberId || '',
      memberName: member?.fullName || followUpData.memberName || '',
      memberNumber: member?.borrowerNumber || followUpData.memberNumber || '',
      branchId: member?.branchId || 'br-main',
      date: new Date().toISOString().split('T')[0],
      contactChannel: followUpData.contactChannel || 'Facebook',
      conductedBy: followUpData.conductedBy || `${currentUser.name} (${currentUser.title})`,
      hasOutstandingLoan: (member?.activeLoansCount || 0) > 0,
      outstandingLoanAmount: followUpData.outstandingLoanAmount || 0,
      purpose: followUpData.purpose || 'Inactivity Check',
      memberResponse: followUpData.memberResponse || 'No response logged',
      nextFollowUpDate: followUpData.nextFollowUpDate,
      actionTaken: followUpData.actionTaken || 'Payment Promised',
    };

    setMemberFollowUpLogs((prev) => [newLog, ...prev]);

    // Update borrower last activity
    if (member) {
      setBorrowers((prev) =>
        prev.map((b) => (b.id === member.id ? { ...b, lastActivityDate: new Date().toISOString().split('T')[0] } : b))
      );
    }

    logAudit('INACTIVE_MEMBER_FOLLOW_UP', `Logged ${newLog.contactChannel} follow-up for ${newLog.memberName} (${newLog.actionTaken})`, 'BORROWER');
  };

  const reactivateMember = (memberId: string) => {
    setBorrowers((prev) =>
      prev.map((b) => (b.id === memberId ? { ...b, memberStatus: 'Active', lastActivityDate: new Date().toISOString().split('T')[0] } : b))
    );
    logAudit('MEMBER_REACTIVATED', `Reactivated member ${memberId} status to Active`, 'BORROWER');
  };

  // ==========================================
  // 2. SAVINGS SERVICES IMPLEMENTATION
  // ==========================================

  // Open a brand-new savings account for a client with unique account ID & initial deposit
  const openSavingsAccount = (params: {
    clientId: string;
    accountType?: SavingsAccountType;
    initialDeposit: number;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
    maintainingBalance?: number;
    interestRate?: number;
    branchId?: string;
  }): { success: boolean; account?: SavingsAccount; transaction?: SavingsTransaction; error?: string } => {
    const client = borrowers.find((b) => b.id === params.clientId);
    if (!client) return { success: false, error: 'Selected client not found in cooperative records.' };

    const MAINTAINING_BAL = params.maintainingBalance ?? 1000;
    if (params.initialDeposit < MAINTAINING_BAL) {
      return {
        success: false,
        error: `Initial deposit of ₱${params.initialDeposit.toLocaleString()} is below the required maintaining balance of ₱${MAINTAINING_BAL.toLocaleString()}.`,
      };
    }

    const year = new Date().getFullYear();
    const accountSeq = String(savingsAccounts.length + 101).padStart(5, '0');
    const accountNumber = `SAV-${year}-${accountSeq}`;
    const accountId = `sav-acc-${Date.now()}`;
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDateTime = `${dateStr} ${timeStr}`;
    const refNo = params.referenceNumber || `OR-SAV-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newAccount: SavingsAccount = {
      id: accountId,
      accountNumber,
      clientId: client.id,
      clientName: client.fullName,
      clientNumber: client.borrowerNumber,
      clientPhone: client.phone,
      clientEmail: client.email,
      clientAvatar: client.avatar,
      branchId: params.branchId || client.branchId || 'br-main',
      accountType: params.accountType || 'Regular Savings',
      balance: params.initialDeposit,
      availableBalance: Math.max(0, params.initialDeposit - MAINTAINING_BAL),
      maintainingBalance: MAINTAINING_BAL,
      interestRate: params.interestRate ?? 1.0,
      status: 'Active',
      openedDate: dateStr,
      lastTransactionDate: dateStr,
      totalDeposited: params.initialDeposit,
      totalWithdrawn: 0,
      totalInterestEarned: 0,
      passbookNumber: `PB-${year}-${accountSeq.slice(-4)}`,
      notes: params.notes || 'Newly opened savings account',
      statusLogs: [
        {
          id: `stat-log-${Date.now()}`,
          date: dateStr,
          fromStatus: 'Active',
          toStatus: 'Active',
          changedBy: `${currentUser.name} (${currentUser.title})`,
          reason: 'Initial account opening with opening deposit.',
        },
      ],
    };

    const initialTx: SavingsTransaction = {
      id: `sav-tx-${Date.now()}`,
      savingsAccountId: accountId,
      accountNumber,
      memberId: client.id,
      clientId: client.id,
      memberName: client.fullName,
      branchId: newAccount.branchId,
      transactionNumber: `TXN-SAV-${Date.now().toString().slice(-6)}`,
      referenceNumber: refNo,
      officialReceiptNumber: refNo,
      date: fullDateTime,
      type: 'Account Opening',
      amount: params.initialDeposit,
      balanceBefore: 0,
      balanceAfter: params.initialDeposit,
      paymentMethod: params.paymentMethod || 'Cash',
      processedBy: `${currentUser.name} (${currentUser.title})`,
      processedByRole: currentUser.title || 'Teller',
      notes: params.notes || 'Initial account opening deposit & passbook activation',
    };

    setSavingsAccounts((prev) => [newAccount, ...prev]);
    setSavingsTransactions((prev) => [initialTx, ...prev]);

    // Update client total savings balance
    setBorrowers((prev) =>
      prev.map((b) =>
        b.id === client.id
          ? {
              ...b,
              savingsBalance: (b.savingsBalance || 0) + params.initialDeposit,
              lastActivityDate: dateStr,
            }
          : b
      )
    );

    if (params.paymentMethod === 'Cash') {
      setBranches((prev) =>
        prev.map((br) =>
          br.id === newAccount.branchId
            ? { ...br, cashVaultBalance: br.cashVaultBalance + params.initialDeposit }
            : br
        )
      );
    }

    logAudit(
      'SAVINGS_ACCOUNT_OPENED',
      `Opened savings account ${accountNumber} for ${client.fullName} with initial deposit ₱${params.initialDeposit.toLocaleString()} (OR: ${refNo})`,
      'SAVINGS',
      { targetType: 'SavingsAccount', targetId: accountId }
    );

    if (params.initialDeposit > 0) {
      createFinancialTransaction({
        referenceNumber: refNo,
        clientId: client.id,
        clientName: client.fullName,
        accountOrLoanId: accountNumber,
        accountOrLoanType: 'Savings',
        branchId: newAccount.branchId,
        transactionType: 'Savings Deposit',
        amount: params.initialDeposit,
        transactionDate: dateStr,
        paymentMethod: params.paymentMethod || 'Cash',
        processedBy: `${currentUser.name} (${currentUser.title})`,
        processedByRole: currentUser.title || 'Teller',
        status: 'Completed',
        notes: `Initial opening deposit for savings account ${accountNumber}`,
      });
    }

    return { success: true, account: newAccount, transaction: initialTx };
  };

  // Record Deposit with automatic balance calculation, receipt reference, and dormant reactivation
  const recordSavingsDeposit = (params: {
    accountId: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    date?: string;
    notes?: string;
  }): { success: boolean; transaction?: SavingsTransaction; error?: string } => {
    const account = savingsAccounts.find(
      (a) => a.id === params.accountId || a.accountNumber === params.accountId
    );
    if (!account) return { success: false, error: 'Savings account not found.' };

    if (account.status === 'Closed') {
      return { success: false, error: 'Cannot deposit funds: This savings account is Closed.' };
    }
    if (account.status === 'Suspended') {
      return { success: false, error: 'Cannot deposit funds: This account is Suspended pending compliance check.' };
    }
    if (params.amount <= 0) {
      return { success: false, error: 'Deposit amount must be greater than zero.' };
    }

    const dateStr = params.date || new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDateTime = `${dateStr} ${timeStr}`;
    const year = new Date().getFullYear();
    const refNo = params.referenceNumber || `OR-SAV-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

    const balanceBefore = account.balance;
    const balanceAfter = balanceBefore + params.amount;
    const availableBalanceAfter = Math.max(0, balanceAfter - account.maintainingBalance);

    const tx: SavingsTransaction = {
      id: `sav-tx-${Date.now()}`,
      savingsAccountId: account.id,
      accountNumber: account.accountNumber,
      memberId: account.clientId,
      clientId: account.clientId,
      memberName: account.clientName,
      branchId: account.branchId,
      transactionNumber: `TXN-SAV-${Date.now().toString().slice(-6)}`,
      referenceNumber: refNo,
      officialReceiptNumber: refNo,
      date: fullDateTime,
      type: 'Deposit',
      amount: params.amount,
      balanceBefore,
      balanceAfter,
      paymentMethod: params.paymentMethod || 'Cash',
      processedBy: `${currentUser.name} (${currentUser.title})`,
      processedByRole: currentUser.title || 'Teller',
      notes: params.notes || `Over-the-counter deposit via ${params.paymentMethod || 'Cash'}`,
    };

    // If account was Dormant, automatically reactivate to Active
    const shouldReactivate = account.status === 'Dormant';

    setSavingsAccounts((prev) =>
      prev.map((a) => {
        if (a.id === account.id) {
          const updatedLogs = shouldReactivate
            ? [
                {
                  id: `stat-log-${Date.now()}`,
                  date: dateStr,
                  fromStatus: 'Dormant' as SavingsAccountStatus,
                  toStatus: 'Active' as SavingsAccountStatus,
                  changedBy: `${currentUser.name} (${currentUser.title})`,
                  reason: 'Reactivated from Dormancy upon member deposit.',
                },
                ...(a.statusLogs || []),
              ]
            : a.statusLogs;

          return {
            ...a,
            balance: balanceAfter,
            availableBalance: availableBalanceAfter,
            totalDeposited: a.totalDeposited + params.amount,
            lastTransactionDate: dateStr,
            status: shouldReactivate ? 'Active' : a.status,
            statusLogs: updatedLogs,
          };
        }
        return a;
      })
    );

    setSavingsTransactions((prev) => [tx, ...prev]);

    // Update borrower savings balance
    setBorrowers((prev) =>
      prev.map((b) =>
        b.id === account.clientId
          ? {
              ...b,
              savingsBalance: (b.savingsBalance || 0) + params.amount,
              lastActivityDate: dateStr,
            }
          : b
      )
    );

    if (params.paymentMethod === 'Cash') {
      setBranches((prev) =>
        prev.map((br) =>
          br.id === account.branchId
            ? { ...br, cashVaultBalance: br.cashVaultBalance + params.amount }
            : br
        )
      );
    }

    logAudit(
      'SAVINGS_DEPOSIT',
      `Recorded deposit of ₱${params.amount.toLocaleString()} on account ${account.accountNumber} (${account.clientName}) - Ref: ${refNo}`,
      'SAVINGS',
      { targetType: 'SavingsAccount', targetId: account.id }
    );

    // Auto-generate Financial Transaction
    createFinancialTransaction({
      referenceNumber: refNo,
      clientId: account.clientId,
      clientName: account.clientName,
      accountOrLoanId: account.accountNumber,
      accountOrLoanType: 'Savings',
      branchId: account.branchId,
      transactionType: 'Savings Deposit',
      amount: params.amount,
      transactionDate: dateStr,
      paymentMethod: params.paymentMethod || 'Cash',
      processedBy: `${currentUser.name} (${currentUser.title})`,
      processedByRole: currentUser.title || 'Teller',
      status: 'Completed',
      notes: params.notes || `Over-the-counter deposit on account ${account.accountNumber}`,
    });

    return { success: true, transaction: tx };
  };

  // Record Withdrawal with strict available balance and maintaining balance validation
  const recordSavingsWithdrawal = (params: {
    accountId: string;
    amount: number;
    paymentMethod?: string;
    referenceNumber?: string;
    date?: string;
    reason: string;
  }): { success: boolean; transaction?: SavingsTransaction; error?: string } => {
    const account = savingsAccounts.find(
      (a) => a.id === params.accountId || a.accountNumber === params.accountId
    );
    if (!account) return { success: false, error: 'Savings account not found.' };

    if (account.status === 'Closed') {
      return { success: false, error: 'Withdrawal rejected: This savings account is Closed.' };
    }
    if (account.status === 'Suspended') {
      return { success: false, error: 'Withdrawal rejected: Account is Suspended pending compliance/KYC hold.' };
    }
    if (account.status === 'Dormant') {
      return { success: false, error: 'Withdrawal rejected: Account is Dormant. Please reactivate the account through customer service first.' };
    }
    if (params.amount <= 0) {
      return { success: false, error: 'Withdrawal amount must be greater than zero.' };
    }

    const available = Math.max(0, account.balance - account.maintainingBalance);

    if (params.amount > account.balance) {
      return {
        success: false,
        error: `Insufficient funds: Requested withdrawal ₱${params.amount.toLocaleString()} exceeds total balance of ₱${account.balance.toLocaleString()}.`,
      };
    }

    if (account.balance - params.amount < account.maintainingBalance) {
      const excess = params.amount - available;
      return {
        success: false,
        error: `Withdrawal exceeds available balance! Account must retain ₱${account.maintainingBalance.toLocaleString()} maintaining balance. Available for withdrawal: ₱${available.toLocaleString()}. Requested: ₱${params.amount.toLocaleString()} (Exceeds by ₱${excess.toLocaleString()}).`,
      };
    }

    const dateStr = params.date || new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDateTime = `${dateStr} ${timeStr}`;
    const year = new Date().getFullYear();
    const refNo = params.referenceNumber || `WD-SLIP-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

    const balanceBefore = account.balance;
    const balanceAfter = balanceBefore - params.amount;
    const availableBalanceAfter = Math.max(0, balanceAfter - account.maintainingBalance);

    const tx: SavingsTransaction = {
      id: `sav-tx-${Date.now()}`,
      savingsAccountId: account.id,
      accountNumber: account.accountNumber,
      memberId: account.clientId,
      clientId: account.clientId,
      memberName: account.clientName,
      branchId: account.branchId,
      transactionNumber: `TXN-SAV-${Date.now().toString().slice(-6)}`,
      referenceNumber: refNo,
      officialReceiptNumber: refNo,
      date: fullDateTime,
      type: 'Withdrawal',
      amount: params.amount,
      balanceBefore,
      balanceAfter,
      paymentMethod: params.paymentMethod || 'Cash',
      processedBy: `${currentUser.name} (${currentUser.title})`,
      processedByRole: currentUser.title || 'Teller / Cashier',
      notes: params.reason || 'Over-the-counter savings withdrawal',
    };

    setSavingsAccounts((prev) =>
      prev.map((a) =>
        a.id === account.id
          ? {
              ...a,
              balance: balanceAfter,
              availableBalance: availableBalanceAfter,
              totalWithdrawn: a.totalWithdrawn + params.amount,
              lastTransactionDate: dateStr,
            }
          : a
      )
    );

    setSavingsTransactions((prev) => [tx, ...prev]);

    // Update borrower savings balance
    setBorrowers((prev) =>
      prev.map((b) =>
        b.id === account.clientId
          ? {
              ...b,
              savingsBalance: Math.max(0, (b.savingsBalance || 0) - params.amount),
              lastActivityDate: dateStr,
            }
          : b
      )
    );

    // Update branch cash vault
    setBranches((prev) =>
      prev.map((br) =>
        br.id === account.branchId
          ? { ...br, cashVaultBalance: Math.max(0, br.cashVaultBalance - params.amount) }
          : br
      )
    );

    logAudit(
      'SAVINGS_WITHDRAWAL',
      `Processed withdrawal of ₱${params.amount.toLocaleString()} from account ${account.accountNumber} (${account.clientName}) - Reason: ${params.reason} (Ref: ${refNo})`,
      'SAVINGS',
      { targetType: 'SavingsAccount', targetId: account.id }
    );

    // Auto-generate Financial Transaction
    createFinancialTransaction({
      referenceNumber: refNo,
      clientId: account.clientId,
      clientName: account.clientName,
      accountOrLoanId: account.accountNumber,
      accountOrLoanType: 'Savings',
      branchId: account.branchId,
      transactionType: 'Savings Withdrawal',
      amount: params.amount,
      transactionDate: dateStr,
      paymentMethod: params.paymentMethod || 'Cash',
      processedBy: `${currentUser.name} (${currentUser.title})`,
      processedByRole: currentUser.title || 'Teller / Cashier',
      status: 'Completed',
      notes: params.reason || `Savings withdrawal from account ${account.accountNumber}`,
    });

    return { success: true, transaction: tx };
  };

  // Update Savings Account Status with Audit Log
  const updateSavingsAccountStatus = (
    accountId: string,
    newStatus: SavingsAccountStatus,
    reason: string
  ): { success: boolean; error?: string } => {
    const account = savingsAccounts.find(
      (a) => a.id === accountId || a.accountNumber === accountId
    );
    if (!account) return { success: false, error: 'Savings account not found.' };

    const dateStr = new Date().toISOString().split('T')[0];
    const statusLog: SavingsAccountStatusLog = {
      id: `stat-log-${Date.now()}`,
      date: dateStr,
      fromStatus: account.status,
      toStatus: newStatus,
      changedBy: `${currentUser.name} (${currentUser.title})`,
      reason: reason || `Status changed from ${account.status} to ${newStatus}`,
    };

    setSavingsAccounts((prev) =>
      prev.map((a) =>
        a.id === account.id
          ? {
              ...a,
              status: newStatus,
              statusReason: reason,
              statusLogs: [statusLog, ...(a.statusLogs || [])],
            }
          : a
      )
    );

    logAudit(
      'SAVINGS_STATUS_UPDATED',
      `Updated savings account ${account.accountNumber} status from ${account.status} to ${newStatus}. Reason: ${reason}`,
      'SAVINGS',
      { targetType: 'SavingsAccount', targetId: account.id }
    );

    return { success: true };
  };

  // Legacy depositSavings adapter
  const depositSavings = (params: {
    memberId: string;
    amount: number;
    paymentMethod?: string;
    notes?: string;
  }): SavingsTransaction | null => {
    const account = savingsAccounts.find((a) => a.clientId === params.memberId);
    if (account) {
      const res = recordSavingsDeposit({
        accountId: account.id,
        amount: params.amount,
        paymentMethod: params.paymentMethod || 'Cash',
        notes: params.notes,
      });
      return res.transaction || null;
    }

    const member = borrowers.find((b) => b.id === params.memberId);
    if (!member || params.amount <= 0) return null;

    const balanceBefore = member.savingsBalance || 0;
    const balanceAfter = balanceBefore + params.amount;
    const orNumber = `OR-SAV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const tx: SavingsTransaction = {
      id: `sav-tx-${Date.now()}`,
      savingsAccountId: member.id,
      memberId: member.id,
      memberName: member.fullName,
      transactionNumber: `SAV-DEP-${Date.now().toString().slice(-6)}`,
      referenceNumber: orNumber,
      officialReceiptNumber: orNumber,
      date: new Date().toISOString().split('T')[0],
      type: 'Deposit',
      amount: params.amount,
      balanceBefore,
      balanceAfter,
      paymentMethod: params.paymentMethod || 'Cash',
      processedBy: `${currentUser.name} (${currentUser.title})`,
      notes: params.notes || `Over-the-counter deposit via ${params.paymentMethod || 'Cash'}`,
    };

    setBorrowers((prev) =>
      prev.map((b) => (b.id === member.id ? { ...b, savingsBalance: balanceAfter, lastActivityDate: new Date().toISOString().split('T')[0] } : b))
    );
    setSavingsTransactions((prev) => [tx, ...prev]);

    return tx;
  };

  // Savings Withdrawal Request (Guarded by ₱1,000 Maintaining Balance)
  const requestSavingsWithdrawal = (params: {
    memberId: string;
    amount: number;
    reason: string;
  }): { success: boolean; error?: string; request?: SavingsWithdrawalRequest } => {
    const member = borrowers.find((b) => b.id === params.memberId);
    if (!member) return { success: false, error: 'Member not found' };

    const MAINTAINING_BALANCE = 1000;
    const currentBalance = member.savingsBalance || 0;
    const remainingBalanceAfter = currentBalance - params.amount;

    // Strict Rule: Withdrawals must not reduce the account below the required maintaining balance (₱1,000)
    if (remainingBalanceAfter < MAINTAINING_BALANCE) {
      return {
        success: false,
        error: `Withdrawal not permitted. Account balance after withdrawal (₱${remainingBalanceAfter.toLocaleString()}) would fall below the mandatory maintaining balance of ₱${MAINTAINING_BALANCE.toLocaleString()}. Maximum allowable withdrawal is ₱${Math.max(0, currentBalance - MAINTAINING_BALANCE).toLocaleString()}.`,
      };
    }

    const newRequest: SavingsWithdrawalRequest = {
      id: `wdr-${Date.now()}`,
      requestId: `WDR-${new Date().getFullYear()}-${String(withdrawalRequests.length + 101).padStart(4, '0')}`,
      memberId: member.id,
      memberName: member.fullName,
      branchId: member.branchId,
      currentBalance,
      requestedAmount: params.amount,
      maintainingBalance: MAINTAINING_BALANCE,
      remainingBalanceAfter,
      requestDate: new Date().toISOString().split('T')[0],
      reason: params.reason,
      tellerName: `${currentUser.name} (Teller)`,
      tellerRecordedDate: new Date().toISOString().split('T')[0],
      status: 'Pending Approval',
    };

    setWithdrawalRequests((prev) => [newRequest, ...prev]);
    logAudit('SAVINGS_WITHDRAWAL_REQUESTED', `Teller recorded withdrawal request ${newRequest.requestId} for ₱${params.amount.toLocaleString()} for ${member.fullName}`, 'SAVINGS');

    return { success: true, request: newRequest };
  };

  // Manager Reviews & Approves Withdrawal
  const managerApproveWithdrawal = (requestId: string): boolean => {
    const req = withdrawalRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'Pending Approval') return false;

    const member = borrowers.find((b) => b.id === req.memberId);
    if (!member) return false;

    const account = savingsAccounts.find((a) => a.clientId === req.memberId);

    const newBalance = (member.savingsBalance || 0) - req.requestedAmount;
    if (newBalance < 1000) return false;

    // Update withdrawal record
    setWithdrawalRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'Approved & Released',
              approvedByManager: `${currentUser.name} (Manager)`,
              approvalDate: new Date().toISOString().split('T')[0],
              disbursedDate: new Date().toISOString().split('T')[0],
            }
          : r
      )
    );

    // Update member balance
    setBorrowers((prev) =>
      prev.map((b) => (b.id === member.id ? { ...b, savingsBalance: newBalance, lastActivityDate: new Date().toISOString().split('T')[0] } : b))
    );

    // Update account if found
    if (account) {
      setSavingsAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id
            ? {
                ...a,
                balance: newBalance,
                availableBalance: Math.max(0, newBalance - a.maintainingBalance),
                totalWithdrawn: a.totalWithdrawn + req.requestedAmount,
                lastTransactionDate: new Date().toISOString().split('T')[0],
              }
            : a
        )
      );
    }

    const orNumber = `WD-OR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Record savings transaction
    const tx: SavingsTransaction = {
      id: `sav-tx-${Date.now()}`,
      savingsAccountId: account ? account.id : member.id,
      accountNumber: account ? account.accountNumber : `SAV-${member.id}`,
      memberId: member.id,
      clientId: member.id,
      memberName: member.fullName,
      branchId: member.branchId,
      transactionNumber: `SAV-WDR-${Date.now().toString().slice(-6)}`,
      referenceNumber: orNumber,
      officialReceiptNumber: orNumber,
      date: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      type: 'Withdrawal',
      amount: req.requestedAmount,
      balanceBefore: member.savingsBalance || 0,
      balanceAfter: newBalance,
      paymentMethod: 'Cash',
      processedBy: `${currentUser.name} (Manager Approval & Cash Payout)`,
      notes: `Manager approved withdrawal for ${req.reason}`,
    };
    setSavingsTransactions((prev) => [tx, ...prev]);

    // Update branch vault
    setBranches((prev) =>
      prev.map((br) => (br.id === member.branchId ? { ...br, cashVaultBalance: Math.max(0, br.cashVaultBalance - req.requestedAmount) } : br))
    );

    logAudit('SAVINGS_WITHDRAWAL_APPROVED', `Manager approved and released ₱${req.requestedAmount.toLocaleString()} withdrawal for ${member.fullName}`, 'SAVINGS');
    return true;
  };

  const managerRejectWithdrawal = (requestId: string, reason: string) => {
    setWithdrawalRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'Rejected',
              approvedByManager: `${currentUser.name} (Manager)`,
              approvalDate: new Date().toISOString().split('T')[0],
              rejectionReason: reason,
            }
          : r
      )
    );
    logAudit('SAVINGS_WITHDRAWAL_REJECTED', `Manager rejected withdrawal request ${requestId}: ${reason}`, 'SAVINGS');
  };

  // Monthly 1% p.a. Savings Interest Crediting Engine
  const runMonthlyInterestCrediting = (): { totalCredited: number; membersCount: number } => {
    let totalInterestDistributed = 0;
    let membersCount = 0;
    const dateStr = new Date().toISOString().split('T')[0];
    const monthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const newTransactions: SavingsTransaction[] = [];

    // Credit in savings accounts
    setSavingsAccounts((prev) =>
      prev.map((account) => {
        if (account.status === 'Active' && account.balance > 0) {
          const monthlyInterest = calculateMonthlySavingsInterest(account.balance, 0.01);
          if (monthlyInterest > 0) {
            const newBal = Math.round((account.balance + monthlyInterest) * 100) / 100;
            const refNo = `INT-CREDIT-${monthName.replace(' ', '-').toUpperCase()}`;

            newTransactions.push({
              id: `sav-tx-int-${Date.now()}-${account.id}`,
              savingsAccountId: account.id,
              accountNumber: account.accountNumber,
              memberId: account.clientId,
              clientId: account.clientId,
              memberName: account.clientName,
              branchId: account.branchId,
              transactionNumber: `SAV-INT-${Date.now().toString().slice(-6)}`,
              referenceNumber: refNo,
              officialReceiptNumber: refNo,
              date: `${dateStr} 08:00`,
              type: 'Interest Credited',
              amount: monthlyInterest,
              balanceBefore: account.balance,
              balanceAfter: newBal,
              paymentMethod: 'Internal Transfer',
              processedBy: `System Batch (1% p.a. Interest Credited by ${currentUser.name})`,
              notes: `${monthName} 1.0% Annual Interest credited to savings balance`,
            });

            return {
              ...account,
              balance: newBal,
              availableBalance: Math.max(0, newBal - account.maintainingBalance),
              totalInterestEarned: (account.totalInterestEarned || 0) + monthlyInterest,
              lastTransactionDate: dateStr,
            };
          }
        }
        return account;
      })
    );

    const updatedBorrowers = borrowers.map((member) => {
      const currentBal = member.savingsBalance || 0;
      if (currentBal > 0) {
        const monthlyInterest = calculateMonthlySavingsInterest(currentBal, 0.01);
        if (monthlyInterest > 0) {
          totalInterestDistributed += monthlyInterest;
          membersCount += 1;
          const newBal = Math.round((currentBal + monthlyInterest) * 100) / 100;
          return { ...member, savingsBalance: newBal };
        }
      }
      return member;
    });

    setBorrowers(updatedBorrowers);
    setSavingsTransactions((prev) => [...newTransactions, ...prev]);

    const log: InterestCreditLog = {
      id: `int-log-${Date.now()}`,
      periodMonth: monthName,
      calculationDate: dateStr,
      annualRate: 1.0,
      totalMembersCredited: membersCount,
      totalInterestDistributed: Math.round(totalInterestDistributed * 100) / 100,
      executedBy: `${currentUser.name} (${currentUser.title})`,
    };
    setInterestLogs((prev) => [log, ...prev]);

    logAudit('SAVINGS_INTEREST_CREDITED', `Executed 1% p.a. interest crediting for ${membersCount} members (Total: ₱${totalInterestDistributed.toFixed(2)})`, 'SAVINGS');

    return { totalCredited: totalInterestDistributed, membersCount };
  };

  // ==========================================
  // 3. CLIENT MANAGEMENT & KYC WORKFLOW
  // ==========================================

  const registerClient = (clientData: Partial<Borrower>): Borrower => {
    const year = new Date().getFullYear();
    const count = borrowers.length + 101;
    const generatedId = `CLI-${year}-${String(count).padStart(4, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const initialStatus: ClientStatus = clientData.clientStatus || clientData.memberStatus || 'Pending';

    // Duplicate check: reject clients with the same phone or email already registered
    if (clientData.phone || clientData.email) {
      const newPhoneDigits = String(clientData.phone || '').replace(/\D/g, '');
      const newEmail = String(clientData.email || '').trim().toLowerCase();
      const duplicate = borrowers.find((b) => {
        const existingPhoneDigits = String(b.phone || '').replace(/\D/g, '');
        const phoneMatch = newPhoneDigits.length > 0 && existingPhoneDigits === newPhoneDigits;
        const emailMatch = newEmail && b.email && b.email.trim().toLowerCase() === newEmail;
        return phoneMatch || emailMatch;
      });
      if (duplicate) {
        throw new Error(
          `A client with this ${newEmail ? 'email' : 'phone number'} is already registered: ${duplicate.fullName} (${duplicate.borrowerNumber}).`
        );
      }
    }

    const newClient: Borrower = {
      id: `bor-${Date.now()}`,
      borrowerNumber: clientData.borrowerNumber || generatedId,
      clientId: clientData.clientId || generatedId,
      fullName: clientData.fullName || 'New Registered Client',
      idNumber: clientData.idNumber || 'ID-PENDING',
      idType: clientData.idType || 'Government ID',
      phone: clientData.phone || '',
      secondaryPhone: clientData.secondaryPhone || '',
      email: clientData.email || '',
      dateOfBirth: clientData.dateOfBirth || '1990-01-01',
      placeOfBirth: clientData.placeOfBirth || '',
      nationality: clientData.nationality || 'Filipino',
      gender: clientData.gender || 'Female',
      civilStatus: clientData.civilStatus || 'Single',
      address: clientData.address || '',
      barangay: clientData.barangay || '',
      city: clientData.city || '',
      province: clientData.province || '',
      postalCode: clientData.postalCode || '',
      homeOwnership: clientData.homeOwnership || 'Owned',
      yearsAtAddress: clientData.yearsAtAddress || 1,
      facebookAccount: clientData.facebookAccount || '',
      branchId: clientData.branchId || (activeBranchId === 'all' ? 'br-main' : activeBranchId),
      employmentStatus: clientData.employmentStatus || 'Employed',
      employerOrBusiness: clientData.employerOrBusiness || '',
      employer: clientData.employerOrBusiness || '',
      businessNature: clientData.businessNature || '',
      occupation: clientData.occupation || '',
      yearsInBusinessOrJob: clientData.yearsInBusinessOrJob || 1,
      workAddress: clientData.workAddress || '',
      workPhone: clientData.workPhone || '',
      monthlyIncome: clientData.monthlyIncome || 25000,
      monthlyExpenses: clientData.monthlyExpenses || 12000,
      emergencyContactName: clientData.emergencyContactName || '',
      emergencyContactPhone: clientData.emergencyContactPhone || '',
      emergencyContactRelation: clientData.emergencyContactRelation || '',
      creditScore: clientData.creditScore || 670,
      creditTier: clientData.creditTier || 'Good',
      kycStatus: clientData.kycStatus || 'Pending Review',
      memberStatus: initialStatus,
      clientStatus: initialStatus,
      kycDocuments: clientData.kycDocuments || [],
      kycReviewLogs: [],
      statusLogs: [
        {
          id: `stat-${Date.now()}`,
          date: today,
          fromStatus: 'Pending',
          toStatus: initialStatus,
          changedBy: `${currentUser.name} (${currentUser.title})`,
          reason: 'Initial client onboarding and KYC registration submitted.',
        },
      ],
      membershipDate: clientData.membershipDate || today,
      savingsBalance: clientData.savingsBalance || 0,
      shareCapital: clientData.shareCapital || 0,
      activeLoansCount: 0,
      totalBorrowed: 0,
      totalRepaid: 0,
      avatar: clientData.avatar || `https://ui-avatars.com/api/?background=2563EB&color=fff&name=${encodeURIComponent(clientData.fullName || 'Client')}`,
      joinedDate: today,
      lastActivityDate: today,
      notes: clientData.notes,
    };

    setBorrowers((prev) => [newClient, ...prev]);
    logAudit('CLIENT_REGISTERED', `Registered new client ${newClient.fullName} (${newClient.borrowerNumber})`, 'BORROWER');
    return newClient;
  };

  const updateClientStatus = (clientId: string, newStatus: ClientStatus, reason: string) => {
    const today = new Date().toISOString().split('T')[0];
    const client = borrowers.find((b) => b.id === clientId);
    if (!client) return;

    const oldStatus = client.clientStatus || client.memberStatus;

    const statusLog: ClientStatusLog = {
      id: `stat-${Date.now()}`,
      date: today,
      fromStatus: oldStatus,
      toStatus: newStatus,
      changedBy: `${currentUser.name} (${currentUser.title})`,
      reason: reason || `Status updated from ${oldStatus} to ${newStatus}`,
    };

    setBorrowers((prev) =>
      prev.map((b) =>
        b.id === clientId
          ? {
              ...b,
              clientStatus: newStatus,
              memberStatus: newStatus,
              statusLogs: [statusLog, ...(b.statusLogs || [])],
              lastActivityDate: today,
            }
          : b
      )
    );

    logAudit('CLIENT_STATUS_UPDATED', `Updated client ${client.fullName} status from ${oldStatus} to ${newStatus}. Reason: ${reason}`, 'BORROWER');
  };

  const uploadKycDocument = (
    clientId: string,
    doc: {
      docType: KycDocumentType;
      fileName: string;
      fileSize?: string;
      fileUrl?: string;
      notes?: string;
    }
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const newDoc: KycDocument = {
      id: `doc-${Date.now()}`,
      docType: doc.docType,
      fileName: doc.fileName,
      fileSize: doc.fileSize || '1.5 MB',
      fileUrl: doc.fileUrl,
      uploadedAt: today,
      uploadedBy: `${currentUser.name} (${currentUser.title})`,
      status: 'Pending Review',
    };

    setBorrowers((prev) =>
      prev.map((b) => {
        if (b.id === clientId) {
          const currentDocs = b.kycDocuments || [];
          return {
            ...b,
            kycDocuments: [newDoc, ...currentDocs],
            kycStatus: b.kycStatus === 'Verified' ? 'Verified' : 'Pending Review',
            lastActivityDate: today,
          };
        }
        return b;
      })
    );

    logAudit('KYC_DOCUMENT_UPLOADED', `Uploaded ${doc.docType} (${doc.fileName}) for client ${clientId}`, 'BORROWER');
  };

  const reviewKyc = (
    clientId: string,
    decision: 'APPROVED' | 'CORRECTION_REQUESTED' | 'REJECTED',
    notes: string,
    itemsChecked?: string[]
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const client = borrowers.find((b) => b.id === clientId);
    if (!client) return;

    let newKycStatus: KycStatus = 'Verified';
    let newClientStatus: ClientStatus = client.clientStatus || client.memberStatus;

    if (decision === 'APPROVED') {
      newKycStatus = 'Verified';
      if (newClientStatus === 'Pending') newClientStatus = 'Active';
    } else if (decision === 'CORRECTION_REQUESTED') {
      newKycStatus = 'Correction Requested';
    } else if (decision === 'REJECTED') {
      newKycStatus = 'Rejected';
      newClientStatus = 'Rejected';
    }

    const reviewLog: KycReviewLog = {
      id: `rev-${Date.now()}`,
      date: today,
      reviewerName: currentUser.name,
      reviewerRole: currentUser.title,
      decision,
      notes,
      itemsChecked,
    };

    setBorrowers((prev) =>
      prev.map((b) => {
        if (b.id === clientId) {
          const updatedDocs = (b.kycDocuments || []).map((doc) => {
            if (decision === 'APPROVED') return { ...doc, status: 'Verified' as const, verifiedAt: today, verifiedBy: currentUser.name };
            if (decision === 'REJECTED') return { ...doc, status: 'Rejected' as const, rejectionReason: notes };
            return doc;
          });

          return {
            ...b,
            kycStatus: newKycStatus,
            clientStatus: newClientStatus,
            memberStatus: newClientStatus,
            kycReviewedBy: `${currentUser.name} (${currentUser.title})`,
            kycReviewedAt: today,
            kycCorrectionNotes: decision === 'CORRECTION_REQUESTED' ? notes : b.kycCorrectionNotes,
            kycRejectionReason: decision === 'REJECTED' ? notes : undefined,
            kycDocuments: updatedDocs,
            kycReviewLogs: [reviewLog, ...(b.kycReviewLogs || [])],
            lastActivityDate: today,
          };
        }
        return b;
      })
    );

    logAudit('KYC_DECISION_RECORDED', `Recorded KYC ${decision} for client ${client.fullName} (${client.borrowerNumber}): ${notes}`, 'BORROWER');
  };

  const deleteKycDocument = (clientId: string, documentId: string) => {
    setBorrowers((prev) =>
      prev.map((b) => {
        if (b.id === clientId) {
          return {
            ...b,
            kycDocuments: (b.kycDocuments || []).filter((d) => d.id !== documentId),
          };
        }
        return b;
      })
    );
    logAudit('KYC_DOCUMENT_DELETED', `Deleted KYC document ${documentId} for client ${clientId}`, 'BORROWER');
  };

  const addBorrower = (borrowerData: Partial<Borrower>): Borrower => {
    const year = new Date().getFullYear();
    const count = borrowers.length + 101;
    const generatedId = `CLI-${year}-${String(count).padStart(4, '0')}`;

    const newBorrower: Borrower = {
      id: `bor-${Date.now()}`,
      borrowerNumber: borrowerData.borrowerNumber || generatedId,
      clientId: borrowerData.clientId || generatedId,
      fullName: borrowerData.fullName || 'Unnamed Member',
      idNumber: borrowerData.idNumber || 'ID-000000',
      idType: borrowerData.idType || 'Government ID',
      phone: borrowerData.phone || '',
      secondaryPhone: borrowerData.secondaryPhone || '',
      email: borrowerData.email || '',
      dateOfBirth: borrowerData.dateOfBirth || '1990-01-01',
      placeOfBirth: borrowerData.placeOfBirth || '',
      nationality: borrowerData.nationality || 'Filipino',
      gender: borrowerData.gender || 'Male',
      civilStatus: borrowerData.civilStatus || 'Single',
      address: borrowerData.address || '',
      barangay: borrowerData.barangay || '',
      city: borrowerData.city || '',
      province: borrowerData.province || '',
      postalCode: borrowerData.postalCode || '',
      homeOwnership: borrowerData.homeOwnership || 'Owned',
      yearsAtAddress: borrowerData.yearsAtAddress || 1,
      facebookAccount: borrowerData.facebookAccount || '',
      branchId: borrowerData.branchId || (activeBranchId === 'all' ? 'br-main' : activeBranchId),
      employmentStatus: borrowerData.employmentStatus || 'Employed',
      employerOrBusiness: borrowerData.employerOrBusiness || '',
      businessNature: borrowerData.businessNature || '',
      occupation: borrowerData.occupation || '',
      yearsInBusinessOrJob: borrowerData.yearsInBusinessOrJob || 1,
      workAddress: borrowerData.workAddress || '',
      monthlyIncome: borrowerData.monthlyIncome || 30000,
      monthlyExpenses: borrowerData.monthlyExpenses || 12000,
      creditScore: borrowerData.creditScore || 700,
      creditTier: borrowerData.creditTier || 'Good',
      kycStatus: borrowerData.kycStatus || 'Verified',
      memberStatus: borrowerData.clientStatus || borrowerData.memberStatus || 'Active',
      clientStatus: borrowerData.clientStatus || borrowerData.memberStatus || 'Active',
      membershipDate: borrowerData.membershipDate || new Date().toISOString().split('T')[0],
      savingsBalance: borrowerData.savingsBalance || 2500,
      shareCapital: borrowerData.shareCapital || 2500,
      activeLoansCount: 0,
      totalBorrowed: 0,
      totalRepaid: 0,
      avatar: borrowerData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      joinedDate: new Date().toISOString().split('T')[0],
      lastActivityDate: new Date().toISOString().split('T')[0],
      notes: borrowerData.notes,
    };

    setBorrowers((prev) => [newBorrower, ...prev]);
    logAudit('BORROWER_CREATED', `Created new cooperative member ${newBorrower.fullName}`, 'BORROWER');
    return newBorrower;
  };

  const updateBorrower = (id: string, updates: Partial<Borrower>) => {
    setBorrowers((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates, lastActivityDate: new Date().toISOString().split('T')[0] } : b))
    );
    logAudit('BORROWER_UPDATED', `Updated member profile ${id}`, 'BORROWER');
  };

  const deleteBorrower = (id: string) => {
    setBorrowers((prev) => prev.filter((b) => b.id !== id));
    logAudit('BORROWER_DELETED', `Deleted member record ${id}`, 'BORROWER');
  };

  // Step 1: Create loan application (Draft, Submitted, or Approved)
  const createLoanApplication = (loanData: any, initialStatusParam?: LoanStatus | boolean): Loan => {
    const product = loanProducts.find((p) => p.id === loanData.productId) || loanProducts[0];
    const borrower = borrowers.find((b) => b.id === loanData.borrowerId);
    const startDateStr = loanData.startDate || new Date().toISOString().split('T')[0];

    const calc = calculateLoanSchedule({
      principal: loanData.principalAmount || product.minAmount,
      annualInterestRate: loanData.interestRate || product.interestRate,
      termMonths: loanData.termMonths || 12,
      interestType: loanData.interestType || product.interestType,
      repaymentFrequency: loanData.repaymentFrequency || product.defaultRepaymentFrequency,
      processingFeePercentage: product.processingFeePercentage,
      startDate: startDateStr,
    });

    let targetStatus: LoanStatus = 'Submitted';
    if (typeof initialStatusParam === 'boolean') {
      targetStatus = initialStatusParam ? 'Disbursed' : 'Submitted';
    } else if (initialStatusParam) {
      targetStatus = initialStatusParam;
    }

    const nextIdNumber = loans.length + 101;
    const generatedLoanNumber = `LN-${new Date().getFullYear()}-${String(nextIdNumber).padStart(4, '0')}`;

    const newLoan: Loan = {
      id: `loan-${Date.now()}`,
      loanNumber: loanData.loanNumber || generatedLoanNumber,
      borrowerId: loanData.borrowerId,
      borrowerName: borrower?.fullName || loanData.borrowerName || 'Unknown Member',
      borrowerPhone: borrower?.phone || loanData.borrowerPhone || '',
      borrowerAvatar: borrower?.avatar,
      branchId: borrower?.branchId || loanData.branchId || (activeBranchId === 'all' ? 'br-main' : activeBranchId),
      productId: product.id,
      productName: product.name,
      principalAmount: loanData.principalAmount || product.minAmount,
      interestRate: loanData.interestRate || product.interestRate,
      interestType: loanData.interestType || product.interestType,
      repaymentFrequency: loanData.repaymentFrequency || product.defaultRepaymentFrequency,
      termMonths: loanData.termMonths || 12,
      totalInstallments: calc.totalInstallments,
      processingFee: calc.processingFee,
      totalInterest: calc.totalInterest,
      totalPayable: calc.totalPayable,
      totalPaid: targetStatus === 'Disbursed' ? 0 : 0,
      remainingBalance: calc.totalPayable,
      status: targetStatus,
      coopStep: targetStatus === 'Disbursed' ? 'DISBURSED' : targetStatus === 'Approved' ? 'MANAGER_APPROVED' : 'SUBMITTED',
      applicationDate: startDateStr,
      startDate: startDateStr,
      disbursedDate: targetStatus === 'Disbursed' ? startDateStr : undefined,
      approvalDate: targetStatus === 'Approved' || targetStatus === 'Disbursed' ? startDateStr : undefined,
      maturityDate: calc.schedule[calc.schedule.length - 1]?.dueDate || '',
      loanOfficerId: currentUser.id,
      loanOfficerName: currentUser.name,
      purpose: loanData.purpose || 'Business Capital & Inventory Financing',
      collateral: loanData.collateral || loanData.collaterals || [],
      collaterals: loanData.collateral || loanData.collaterals || [],
      guarantors: loanData.guarantors || [],
      schedule: calc.schedule,
      isIrregularAccount: false,
      totalLatePenaltiesCharged: 0,
      totalRebatesAwarded: 0,
      disbursementMethod: loanData.disbursementMethod || 'Bank Transfer',
      disbursementAccount: loanData.disbursementAccount,
    };

    if (targetStatus === 'Disbursed' && borrower) {
      setBorrowers((prev) =>
        prev.map((b) =>
          b.id === borrower.id
            ? {
                ...b,
                activeLoansCount: (b.activeLoansCount || 0) + 1,
                totalBorrowed: (b.totalBorrowed || 0) + newLoan.principalAmount,
                lastActivityDate: startDateStr,
              }
            : b
        )
      );
    }

    setLoans((prev) => [newLoan, ...prev]);
    logAudit('LOAN_APPLICATION_CREATED', `Created loan application ${newLoan.loanNumber} (${newLoan.status}) for ${newLoan.borrowerName} for ₱${newLoan.principalAmount.toLocaleString()}`, 'LOAN');
    return newLoan;
  };

  // Submit Draft Loan for Approval
  const submitLoanForApproval = (loanId: string, notes?: string) => {
    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId) {
          return {
            ...l,
            status: 'Submitted',
            coopStep: 'SUBMITTED',
            notes: notes ? `${l.purpose} | Note: ${notes}` : l.purpose,
          };
        }
        return l;
      })
    );
    logAudit('LOAN_SUBMITTED_FOR_APPROVAL', `Submitted loan ${loanId} for credit approval`, 'LOAN');
  };

  // Move Loan to Under Review
  const startLoanReview = (loanId: string, notes?: string) => {
    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId) {
          return {
            ...l,
            status: 'Under Review',
            coopStep: 'PROCESSOR_VERIFIED',
          };
        }
        return l;
      })
    );
    logAudit('LOAN_REVIEW_STARTED', `Credit officer started review on loan ${loanId}`, 'LOAN');
  };

  // Formal Loan Approval
  const approveLoanApplication = (loanId: string, approvalData: LoanApprovalInfo) => {
    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId) {
          const isTermsChanged =
            approvalData.approvedAmount !== l.principalAmount ||
            approvalData.approvedInterestRate !== l.interestRate ||
            approvalData.approvedTermMonths !== l.termMonths;

          let newSchedule = l.schedule;
          let newTotalInterest = l.totalInterest;
          let newTotalPayable = l.totalPayable;
          let newInstallments = l.totalInstallments;
          let newProcFee = l.processingFee;

          if (isTermsChanged) {
            const product = loanProducts.find((p) => p.id === l.productId) || loanProducts[0];
            const reCalc = calculateLoanSchedule({
              principal: approvalData.approvedAmount,
              annualInterestRate: approvalData.approvedInterestRate,
              termMonths: approvalData.approvedTermMonths,
              interestType: l.interestType,
              repaymentFrequency: l.repaymentFrequency,
              processingFeePercentage: product.processingFeePercentage,
              startDate: l.startDate || l.applicationDate,
            });
            newSchedule = reCalc.schedule;
            newTotalInterest = reCalc.totalInterest;
            newTotalPayable = reCalc.totalPayable;
            newInstallments = reCalc.totalInstallments;
            newProcFee = reCalc.processingFee;
          }

          return {
            ...l,
            status: 'Approved',
            coopStep: 'MANAGER_APPROVED',
            approvalDate: approvalData.approvalDate || new Date().toISOString().split('T')[0],
            approvedBy: approvalData.approvedBy,
            principalAmount: approvalData.approvedAmount,
            interestRate: approvalData.approvedInterestRate,
            termMonths: approvalData.approvedTermMonths,
            totalInstallments: newInstallments,
            processingFee: newProcFee,
            totalInterest: newTotalInterest,
            totalPayable: newTotalPayable,
            remainingBalance: newTotalPayable,
            schedule: newSchedule,
            approvalInfo: approvalData,
          };
        }
        return l;
      })
    );

    logAudit(
      'LOAN_APPLICATION_APPROVED',
      `Approved loan ${loanId} for ₱${approvalData.approvedAmount.toLocaleString()} at ${approvalData.approvedInterestRate}% by ${approvalData.approvedBy} (${approvalData.approvedByRole})`,
      'LOAN'
    );
  };

  // Formal Loan Rejection
  const rejectLoanApplication = (loanId: string, rejectionData: LoanRejectionInfo) => {
    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId) {
          return {
            ...l,
            status: 'Rejected',
            coopStep: 'REJECTED',
            rejectionReason: rejectionData.rejectionReason,
            rejectionInfo: rejectionData,
          };
        }
        return l;
      })
    );

    logAudit(
      'LOAN_APPLICATION_REJECTED',
      `Rejected loan ${loanId} by ${rejectionData.rejectedBy}. Reason: ${rejectionData.rejectionReason}`,
      'LOAN'
    );
  };

  // Comprehensive Loan Disbursement Record with strict approval enforcement
  const disburseLoanRecord = (loanId: string, disbursementData: LoanDisbursementInfo) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) {
      return { success: false, message: 'Loan application not found.' };
    }

    // STRICT RULE: Prevent disbursement unless loan has been officially APPROVED
    if (loan.status !== 'Approved') {
      const msg = `Disbursement Blocked: Loan #${loan.loanNumber} is currently in "${loan.status}" status. The system prohibits disbursement until the application is officially Approved.`;
      logAudit('LOAN_DISBURSEMENT_BLOCKED', msg, 'LOAN');
      return { success: false, message: msg };
    }

    const releaseDate = disbursementData.disbursementDate || new Date().toISOString().split('T')[0];

    const voucher: LoanDisbursementVoucher = {
      voucherNumber: `CV-${new Date().getFullYear()}-${String(loans.length + 200).padStart(4, '0')}`,
      preparedByBookkeeper: `${currentUser.name} (Accounting & Disbursing Officer)`,
      preparedDate: releaseDate,
      grossAmount: disbursementData.grossAmount || loan.principalAmount,
      processingFee: disbursementData.processingFee || loan.processingFee || 0,
      serviceFee: 500,
      capitalBuildUpDeduction: disbursementData.capitalBuildUpDeduction || 0,
      insuranceFee: disbursementData.insuranceFee || 0,
      netProceeds: disbursementData.netProceeds,
      paymentMode: (disbursementData.disbursementMethod as any) || 'Bank Transfer',
      checkNumberOrRef: disbursementData.referenceNumber,
      approvedByManager: disbursementData.disbursedBy,
      approvedDate: releaseDate,
    };

    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId) {
          return {
            ...l,
            status: 'Disbursed',
            coopStep: 'DISBURSED',
            disbursedDate: releaseDate,
            disbursedBy: disbursementData.disbursedBy,
            disbursementMethod: disbursementData.disbursementMethod,
            disbursementInfo: disbursementData,
            disbursementVoucher: voucher,
            nextPaymentDate: l.schedule[0]?.dueDate || '',
          };
        }
        return l;
      })
    );

    // Update borrower profile
    setBorrowers((prev) =>
      prev.map((b) =>
        b.id === loan.borrowerId
          ? {
              ...b,
              activeLoansCount: (b.activeLoansCount || 0) + 1,
              totalBorrowed: (b.totalBorrowed || 0) + loan.principalAmount,
              lastActivityDate: releaseDate,
            }
          : b
      )
    );

    logAudit(
      'LOAN_DISBURSED_RELEASED',
      `Disbursed net proceeds ₱${disbursementData.netProceeds.toLocaleString()} for loan ${loan.loanNumber} via ${disbursementData.disbursementMethod} (Ref: ${disbursementData.referenceNumber})`,
      'LOAN'
    );

    // Auto-record Financial Transaction for disbursement
    const refNo = disbursementData.referenceNumber || `DISB-${loan.loanNumber}`;
    createFinancialTransaction({
      referenceNumber: refNo,
      clientId: loan.borrowerId,
      clientName: loan.borrowerName,
      accountOrLoanId: loan.loanNumber || loan.id,
      accountOrLoanType: 'Loan',
      branchId: loan.branchId,
      transactionType: 'Loan Disbursement',
      amount: disbursementData.grossAmount || loan.principalAmount,
      transactionDate: releaseDate,
      paymentMethod: disbursementData.disbursementMethod || 'Bank Transfer',
      processedBy: disbursementData.disbursedBy || `${currentUser.name} (${currentUser.title})`,
      processedByRole: 'Disbursing Officer / Manager',
      status: 'Completed',
      notes: `Loan proceeds disbursed for ${loan.loanNumber}. Net released: ₱${disbursementData.netProceeds.toLocaleString()}`,
      metadata: {
        loanId: loan.id,
        loanNumber: loan.loanNumber,
        netProceeds: disbursementData.netProceeds,
        processingFee: disbursementData.processingFee,
        capitalBuildUp: disbursementData.capitalBuildUpDeduction,
      },
    });

    if (disbursementData.processingFee && disbursementData.processingFee > 0) {
      createFinancialTransaction({
        referenceNumber: `FEE-${refNo}`,
        clientId: loan.borrowerId,
        clientName: loan.borrowerName,
        accountOrLoanId: loan.loanNumber || loan.id,
        accountOrLoanType: 'Loan',
        branchId: loan.branchId,
        transactionType: 'Fee',
        amount: disbursementData.processingFee,
        transactionDate: releaseDate,
        paymentMethod: 'Deducted from Proceeds',
        processedBy: disbursementData.disbursedBy || `${currentUser.name} (${currentUser.title})`,
        processedByRole: 'Disbursing Officer',
        status: 'Completed',
        notes: `Loan processing fee for ${loan.loanNumber}`,
      });
    }

    return { success: true };
  };

  // Mark loan as completed / fully repaid
  const markLoanCompleted = (loanId: string) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;

    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? {
              ...l,
              status: 'Completed',
              remainingBalance: 0,
            }
          : l
      )
    );

    if (loan.borrowerId) {
      setBorrowers((prev) =>
        prev.map((b) =>
          b.id === loan.borrowerId
            ? {
                ...b,
                activeLoansCount: Math.max(0, (b.activeLoansCount || 1) - 1),
                totalRepaid: (b.totalRepaid || 0) + loan.remainingBalance,
              }
            : b
        )
      );
    }

    logAudit('LOAN_COMPLETED', `Marked loan ${loan.loanNumber} as fully Completed and settled`, 'LOAN');
  };

  // Mark loan as defaulted
  const markLoanDefaulted = (loanId: string, reason: string = 'Critical non-repayment default') => {
    setLoans((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, status: 'Defaulted', isIrregularAccount: true } : l))
    );
    logAudit('LOAN_DEFAULTED', `Marked loan ${loanId} as Defaulted. Reason: ${reason}`, 'LOAN');
  };

  // Step 2: Loan Processor Check
  const loanProcessorVerifyLoan = (loanId: string, notes?: string) => {
    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? {
              ...l,
              status: 'Under Review',
              coopStep: 'PROCESSOR_VERIFIED',
              notes: notes ? `${l.purpose} | Processor Note: ${notes}` : l.purpose,
            }
          : l
      )
    );
    logAudit('LOAN_PROCESSOR_VERIFIED', `Loan Processor verified eligibility & capacity for loan ${loanId}`, 'LOAN');
  };

  // Step 3: Accounting / Bookkeeper Verification
  const bookkeeperVerifyLoan = (loanId: string, notes?: string) => {
    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? {
              ...l,
              coopStep: 'BOOKKEEPER_VERIFIED',
            }
          : l
      )
    );
    logAudit('LOAN_BOOKKEEPER_VERIFIED', `Bookkeeper / Accounting verified financial records for loan ${loanId}`, 'LOAN');
  };

  // Step 4: Credit Committee Interview & Evaluation
  const creditCommitteeInterviewLoan = (loanId: string, evaluation: CreditCommitteeEvaluation) => {
    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? {
              ...l,
              coopStep: 'CREDIT_COMM_INTERVIEW',
              creditCommitteeEval: evaluation,
            }
          : l
      )
    );
    logAudit('LOAN_CREDIT_COMM_EVALUATED', `Credit Committee completed interview for loan ${loanId} (${evaluation.approvalVerdict})`, 'LOAN');
  };

  // Step 5: Accounting Prepares Loan Voucher
  const prepareLoanVoucher = (loanId: string, voucherData: Partial<LoanDisbursementVoucher>) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;

    const gross = loan.principalAmount;
    const procFee = loan.processingFee || Math.round(gross * 0.02);
    const serviceFee = 500;
    const cbu = Math.round(gross * 0.02); // 2% CBU
    const ins = 300;
    const net = gross - procFee - serviceFee - cbu - ins;

    const voucher: LoanDisbursementVoucher = {
      voucherNumber: `CV-${new Date().getFullYear()}-${String(loans.length + 140).padStart(4, '0')}`,
      preparedByBookkeeper: `${currentUser.name} (Accounting)`,
      preparedDate: new Date().toISOString().split('T')[0],
      grossAmount: gross,
      processingFee: procFee,
      serviceFee,
      capitalBuildUpDeduction: cbu,
      insuranceFee: ins,
      netProceeds: net,
      paymentMode: voucherData.paymentMode || 'Bank Transfer',
      checkNumberOrRef: voucherData.checkNumberOrRef,
    };

    setLoans((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, coopStep: 'VOUCHER_PREPARED', disbursementVoucher: voucher } : l))
    );
    logAudit('LOAN_VOUCHER_PREPARED', `Bookkeeper prepared disbursement voucher ${voucher.voucherNumber} for loan ${loan.loanNumber}`, 'LOAN');
  };

  // Step 6: Manager Reviews and Approves Voucher
  const managerApproveLoanVoucher = (loanId: string) => {
    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId) {
          const updatedVoucher = l.disbursementVoucher
            ? {
                ...l.disbursementVoucher,
                approvedByManager: `${currentUser.name} (Manager)`,
                approvedDate: new Date().toISOString().split('T')[0],
              }
            : undefined;

          return {
            ...l,
            status: 'Approved',
            coopStep: 'MANAGER_APPROVED',
            approvalDate: new Date().toISOString().split('T')[0],
            approvedBy: currentUser.name,
            disbursementVoucher: updatedVoucher,
          };
        }
        return l;
      })
    );
    logAudit('LOAN_MANAGER_APPROVED', `Manager signed off loan voucher for loan ${loanId}`, 'LOAN');
  };

  // Step 7: Loan Released / Disbursed (Guarded)
  const disburseLoan = (loanId: string, method: string = 'Bank Transfer') => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;

    // PREVENT DISBURSEMENT UNLESS APPROVED
    if (loan.status !== 'Approved') {
      alert(`Cannot disburse loan #${loan.loanNumber}: Current status is "${loan.status}". The loan must be Approved before funds can be released.`);
      logAudit('LOAN_DISBURSEMENT_ATTEMPT_DENIED', `Denied disbursement attempt on unapproved loan ${loan.loanNumber} (status: ${loan.status})`, 'LOAN');
      return;
    }

    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId) {
          return {
            ...l,
            status: 'Disbursed',
            coopStep: 'DISBURSED',
            disbursedDate: new Date().toISOString().split('T')[0],
            disbursedBy: currentUser.name,
            nextPaymentDate: l.schedule[0]?.dueDate || '',
            disbursementMethod: method,
          };
        }
        return l;
      })
    );

    // Update borrower loan count
    setBorrowers((prev) =>
      prev.map((b) =>
        b.id === loan.borrowerId
          ? {
              ...b,
              activeLoansCount: (b.activeLoansCount || 0) + 1,
              totalBorrowed: (b.totalBorrowed || 0) + loan.principalAmount,
              lastActivityDate: new Date().toISOString().split('T')[0],
            }
          : b
      )
    );

    logAudit('LOAN_RELEASED_DISBURSED', `Released loan ${loan.loanNumber} proceeds of ₱${loan.principalAmount.toLocaleString()} via ${method}`, 'LOAN');

    // Auto-record Financial Transaction for disbursement
    const refNo = `DISB-${loan.loanNumber}`;
    createFinancialTransaction({
      referenceNumber: refNo,
      clientId: loan.borrowerId,
      clientName: loan.borrowerName,
      accountOrLoanId: loan.loanNumber || loan.id,
      accountOrLoanType: 'Loan',
      branchId: loan.branchId,
      transactionType: 'Loan Disbursement',
      amount: loan.principalAmount,
      transactionDate: new Date().toISOString().split('T')[0],
      paymentMethod: method,
      processedBy: `${currentUser.name} (${currentUser.title})`,
      processedByRole: currentUser.title || 'Disbursing Officer',
      status: 'Completed',
      notes: `Loan proceeds released for ${loan.loanNumber} via ${method}`,
      metadata: {
        loanId: loan.id,
        loanNumber: loan.loanNumber,
        principalAmount: loan.principalAmount,
      },
    });
  };

  const rejectLoan = (loanId: string, reason: string = 'Did not meet credit criteria') => {
    setLoans((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, status: 'Rejected', coopStep: 'REJECTED', rejectionReason: reason } : l))
    );
    logAudit('LOAN_REJECTED', `Rejected loan application ${loanId}: ${reason}`, 'LOAN');
  };

  // Multiple Loans Eligibility Assessment
  const evaluateMultiLoanEligibility = (memberId: string) => {
    const member = borrowers.find((b) => b.id === memberId);
    if (!member) {
      return {
        isEligible: false,
        activeLoanCount: 0,
        activeLoanBalance: 0,
        hasArrears: false,
        savingsEquityRatio: 0,
        reasons: ['Member not found'],
      };
    }

    const memberLoans = loans.filter((l) => l.borrowerId === memberId && (l.status === 'Disbursed' || l.status === 'In Arrears'));
    const activeBalance = memberLoans.reduce((sum, l) => sum + l.remainingBalance, 0);
    const hasArrears = memberLoans.some((l) => l.status === 'In Arrears' || (l.daysInArrears && l.daysInArrears > 0));

    const totalEquity = (member.savingsBalance || 0) + (member.shareCapital || 0);
    const ratio = totalEquity > 0 ? (activeBalance / totalEquity) : 999;

    const reasons: string[] = [];
    let isEligible = true;

    if (hasArrears) {
      isEligible = false;
      reasons.push('Member has an existing loan in arrears. All overdue installments must be settled first.');
    }

    if (memberLoans.length >= 3) {
      isEligible = false;
      reasons.push('Cooperative maximum limit of 3 concurrent active loans reached.');
    }

    const netDisposable = member.monthlyIncome - member.monthlyExpenses;
    if (netDisposable < 10000) {
      isEligible = false;
      reasons.push(`Net monthly disposable income (₱${netDisposable.toLocaleString()}) is below required safety threshold.`);
    }

    if (isEligible) {
      reasons.push('Member has excellent payment history and sufficient debt servicing capacity for an additional loan product.');
    }

    return {
      isEligible,
      activeLoanCount: memberLoans.length,
      activeLoanBalance: activeBalance,
      hasArrears,
      savingsEquityRatio: Math.round(ratio * 10) / 10,
      reasons,
    };
  };

  // ==========================================
  // 4. PAYMENT SERVICES & OFFICIAL RECEIPTS
  // ==========================================

  const recordPayment = (paymentData: {
    loanId: string;
    amount: number;
    paymentMethod: PaymentRecord['paymentMethod'];
    transactionReference: string;
    notes?: string;
    date?: string;
    isAdvancePayment?: boolean;
  }): PaymentRecord | null => {
    const loan = loans.find((l) => l.id === paymentData.loanId);
    if (!loan || paymentData.amount <= 0) return null;

    const product = loanProducts.find((p) => p.id === loan.productId);
    const dateStr = paymentData.date || new Date().toISOString().split('T')[0];

    // Compute Late Penalty if overdue
    let latePenalty = 0;
    if (loan.daysInArrears && loan.daysInArrears > 0) {
      latePenalty = calculateLatePenalty(paymentData.amount, loan.daysInArrears, product?.latePenaltyRate || 2);
    }

    // Compute Early Settlement Rebate if advance payment
    let rebate = 0;
    if (paymentData.isAdvancePayment) {
      const unpaidInterest = loan.totalInterest * (loan.remainingBalance / loan.totalPayable);
      rebate = calculateAdvancePaymentRebate(loan.remainingBalance, unpaidInterest, product?.earlySettlementRebateRate || 20);
    }

    const penaltyPortion = Math.min(paymentData.amount, latePenalty);
    const amountForSchedule = (paymentData.amount - penaltyPortion) + rebate;

    // Apply sequential allocation across installment schedule (supports partial payments & multiple installments)
    const { updatedSchedule, principalPaid, interestPaid } = allocatePaymentToSchedule(
      loan.schedule || [],
      amountForSchedule,
      dateStr
    );

    const effectivePaymentDeduction = paymentData.amount - penaltyPortion + rebate;
    const newTotalPaid = Math.round((loan.totalPaid + paymentData.amount) * 100) / 100;
    const newRemainingBalance = Math.max(0, Math.round((loan.remainingBalance - effectivePaymentDeduction) * 100) / 100);

    const isSettled = newRemainingBalance <= 0.01;

    // Find next unpaid installment
    const nextPending = updatedSchedule.find((item) => item.status !== 'Paid');
    const remainingOverdueCount = updatedSchedule.filter((item) => item.status === 'Overdue').length;

    const orNumber = `OR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      receiptNumber: orNumber,
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      borrowerId: loan.borrowerId,
      borrowerName: loan.borrowerName,
      branchId: loan.branchId,
      amount: paymentData.amount,
      paymentDate: dateStr,
      paymentMethod: paymentData.paymentMethod,
      transactionReference: paymentData.transactionReference || `TRX-${Date.now().toString().slice(-6)}`,
      collectedBy: `${currentUser.name} (${currentUser.title})`,
      principalPortion: principalPaid,
      interestPortion: interestPaid,
      penaltyPortion,
      rebateDiscount: rebate,
      paymentScheduleType: loan.repaymentFrequency,
      isAdvancePayment: paymentData.isAdvancePayment || false,
      notes: paymentData.notes || (rebate > 0 ? `Includes ₱${rebate.toFixed(2)} advance payment rebate` : undefined),
    };

    setPayments((prev) => [newPayment, ...prev]);

    // Update Loan State
    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loan.id) {
          const newStatus: LoanStatus = isSettled
            ? 'Completed'
            : remainingOverdueCount > 0
            ? 'In Arrears' as any
            : 'Active';

          return {
            ...l,
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            status: newStatus,
            schedule: updatedSchedule,
            nextPaymentDate: nextPending?.dueDate,
            lastPaymentDate: dateStr,
            daysInArrears: remainingOverdueCount > 0 ? l.daysInArrears : 0,
            isIrregularAccount: remainingOverdueCount > 0,
            totalLatePenaltiesCharged: (l.totalLatePenaltiesCharged || 0) + latePenalty,
            totalRebatesAwarded: (l.totalRebatesAwarded || 0) + rebate,
          };
        }
        return l;
      })
    );

    // Update Borrower Stats
    setBorrowers((prev) =>
      prev.map((b) => {
        if (b.id === loan.borrowerId) {
          return {
            ...b,
            totalRepaid: (b.totalRepaid || 0) + paymentData.amount,
            activeLoansCount: isSettled ? Math.max(0, (b.activeLoansCount || 1) - 1) : b.activeLoansCount,
            memberStatus: 'Active',
            lastActivityDate: dateStr,
          };
        }
        return b;
      })
    );

    // Update Branch Vault if Cash
    if (paymentData.paymentMethod === 'Cash') {
      setBranches((prev) =>
        prev.map((br) => (br.id === loan.branchId ? { ...br, cashVaultBalance: br.cashVaultBalance + paymentData.amount } : br))
      );
    }

    logAudit(
      'PAYMENT_RECEIVED_OFFICIAL_RECEIPT',
      `Collected ₱${paymentData.amount.toLocaleString()} (Principal: ₱${principalPaid.toLocaleString()}, Interest: ₱${interestPaid.toLocaleString()}) on loan ${loan.loanNumber} via ${paymentData.paymentMethod} (OR ${orNumber})`,
      'PAYMENT'
    );

    // Auto-generate Financial Transaction Record
    createFinancialTransaction({
      referenceNumber: orNumber,
      clientId: loan.borrowerId,
      clientName: loan.borrowerName,
      accountOrLoanId: loan.loanNumber || loan.id,
      accountOrLoanType: 'Loan',
      branchId: loan.branchId,
      transactionType: 'Loan Repayment',
      amount: paymentData.amount,
      transactionDate: dateStr,
      paymentMethod: paymentData.paymentMethod,
      processedBy: `${currentUser.name} (${currentUser.title})`,
      processedByRole: currentUser.title || 'Cashier / Teller',
      status: 'Completed',
      notes: paymentData.notes || `Installment payment for ${loan.loanNumber}. Principal: ₱${principalPaid.toLocaleString()}, Interest: ₱${interestPaid.toLocaleString()}${penaltyPortion > 0 ? `, Penalty: ₱${penaltyPortion.toLocaleString()}` : ''}`,
      metadata: {
        receiptNumber: orNumber,
        loanId: loan.id,
        loanNumber: loan.loanNumber,
        principalPaid,
        interestPaid,
        penaltyPortion,
        rebateDiscount: rebate,
      },
    });

    return newPayment;
  };

  // Branch and Product actions
  const addBranch = (branchData: Partial<Branch>) => {
    const newBranch: Branch = {
      id: `br-${Date.now()}`,
      code: branchData.code || `BR-${branches.length + 1}`,
      name: branchData.name || 'New Branch',
      city: branchData.city || 'Metro Area',
      address: branchData.address || '',
      phone: branchData.phone || '',
      managerName: branchData.managerName || currentUser.name,
      managerEmail: branchData.managerEmail || '',
      activeDisbursedPool: 0,
      cashVaultBalance: 50000,
      activeLoansCount: 0,
      color: branchData.color || '#3B82F6',
    };
    setBranches((prev) => [...prev, newBranch]);
    logAudit('BRANCH_CREATED', `Added new branch ${newBranch.name}`, 'SYSTEM');
  };

  const updateBranch = (id: string, updates: Partial<Branch>) => {
    setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    logAudit('BRANCH_UPDATED', `Updated branch ${id}`, 'SYSTEM');
  };

  const addLoanProduct = (productData: Partial<LoanProduct>) => {
    const newProduct: LoanProduct = {
      id: `prod-${Date.now()}`,
      code: productData.code || `LP-${loanProducts.length + 1}`,
      name: productData.name || 'New Loan Product',
      category: productData.category || 'General',
      interestRate: productData.interestRate || 12,
      interestType: productData.interestType || 'Reducing Balance',
      minAmount: productData.minAmount || 5000,
      maxAmount: productData.maxAmount || 200000,
      minTermMonths: productData.minTermMonths || 3,
      maxTermMonths: productData.maxTermMonths || 24,
      defaultRepaymentFrequency: productData.defaultRepaymentFrequency || 'Monthly',
      processingFeePercentage: productData.processingFeePercentage || 2,
      latePenaltyRate: productData.latePenaltyRate || 2,
      earlySettlementRebateRate: productData.earlySettlementRebateRate || 20,
      requiresCollateral: productData.requiresCollateral ?? false,
      requiresGuarantor: productData.requiresGuarantor ?? false,
      description: productData.description || '',
      badgeColor: productData.badgeColor || 'blue',
    };
    setLoanProducts((prev) => [...prev, newProduct]);
    logAudit('PRODUCT_CREATED', `Added loan product ${newProduct.name}`, 'SYSTEM');
  };

  const updateLoanProduct = (id: string, updates: Partial<LoanProduct>) => {
    setLoanProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    logAudit('PRODUCT_UPDATED', `Updated loan product ${id}`, 'SYSTEM');
  };

  const sendReminder = (reminderData: Partial<ReminderItem>) => {
    const newReminder: ReminderItem = {
      id: `rem-${Date.now()}`,
      borrowerId: reminderData.borrowerId || '',
      borrowerName: reminderData.borrowerName || '',
      borrowerPhone: reminderData.borrowerPhone || '',
      borrowerEmail: reminderData.borrowerEmail || '',
      borrowerFacebook: reminderData.borrowerFacebook,
      loanId: reminderData.loanId || '',
      loanNumber: reminderData.loanNumber || '',
      amountDue: reminderData.amountDue || 0,
      dueDate: reminderData.dueDate || '',
      daysOverdue: reminderData.daysOverdue || 0,
      channel: reminderData.channel || 'SMS',
      status: 'Sent',
      sentAt: new Date().toISOString(),
      messagePreview: reminderData.messagePreview,
    };
    setReminders((prev) => [newReminder, ...prev]);
    logAudit('REMINDER_DISPATCHED', `Dispatched ${newReminder.channel} reminder to ${newReminder.borrowerName}`, 'LOAN');
  };

  const restructureLoan = (
    loanId: string,
    optionsOrTenor: number | { newTermMonths: number; newInterestRate?: number; newInterestType?: any; reason?: string },
    reasonParam?: string
  ) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;

    let newTenorMonths = typeof optionsOrTenor === 'number' ? optionsOrTenor : optionsOrTenor.newTermMonths;
    let newInterestRate = typeof optionsOrTenor === 'object' && optionsOrTenor.newInterestRate ? optionsOrTenor.newInterestRate : loan.interestRate;
    let reason = typeof optionsOrTenor === 'object' && optionsOrTenor.reason ? optionsOrTenor.reason : reasonParam || 'Loan workout & tenor extension';

    const calc = calculateLoanSchedule({
      principal: loan.remainingBalance,
      annualInterestRate: newInterestRate,
      termMonths: newTenorMonths,
      interestType: loan.interestType,
      repaymentFrequency: loan.repaymentFrequency,
      processingFeePercentage: 0,
    });

    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId) {
          return {
            ...l,
            termMonths: newTenorMonths,
            totalInstallments: calc.totalInstallments,
            totalInterest: calc.totalInterest,
            totalPayable: calc.totalPayable,
            remainingBalance: calc.totalPayable,
            schedule: calc.schedule,
            status: 'Disbursed',
            daysInArrears: 0,
            isIrregularAccount: false,
            notes: `${l.purpose} | Restructured: ${reason}`,
          };
        }
        return l;
      })
    );
    logAudit('LOAN_RESTRUCTURED', `Restructured loan ${loan.loanNumber} to ${newTenorMonths} months: ${reason}`, 'LOAN');
  };

  // ==========================================
  // 5. GROUP LENDING & SOLIDARITY MECHANISM
  // ==========================================

  const createSolidarityGroup = (groupData: Partial<SolidarityGroup>): SolidarityGroup => {
    const nextGroupIndex = solidarityGroups.length + 1;
    const year = new Date().getFullYear();
    const groupCode = groupData.groupCode || `GRP-${year}-${String(nextGroupIndex).padStart(3, '0')}`;
    const members = groupData.members || [];
    const leaderMember = members.find((m) => m.role === 'Leader') || members[0];
    const totalActiveLoans = members.reduce((acc, m) => acc + (m.activeLoanAmount || 0), 0);
    const totalGroupSavings = members.reduce((acc, m) => acc + (m.savingsBalance || 0), 0);

    const newGroup: SolidarityGroup = {
      id: `grp-${Date.now()}`,
      groupCode,
      groupName: groupData.groupName || 'Solidarity Circle',
      centerName: groupData.centerName || 'Center #1',
      branchId: groupData.branchId || (activeBranchId === 'all' ? 'br-main' : activeBranchId),
      formedDate: groupData.formedDate || new Date().toISOString().split('T')[0],
      meetingDay: groupData.meetingDay || 'Wednesday',
      meetingTime: groupData.meetingTime || '09:00 AM',
      meetingLocation: groupData.meetingLocation || 'Barangay Multi-Purpose Center',
      loanOfficerId: groupData.loanOfficerId || currentUser.id,
      loanOfficerName: groupData.loanOfficerName || currentUser.name,
      leaderBorrowerId: leaderMember?.borrowerId || '',
      leaderName: leaderMember?.fullName || 'Group Leader',
      leaderPhone: leaderMember?.phone || '0900-000-0000',
      members,
      totalActiveLoans,
      totalGroupSavings,
      repaymentRate: 100.0,
      solidarityFundBalance: groupData.solidarityFundBalance || members.length * 1000,
      jointLiabilityAgreed: true,
      status: 'Active',
      delinquencyStatus: 'Healthy',
      parRate: 0.0,
      totalMeetingsHeld: 0,
    };

    setSolidarityGroups((prev) => [newGroup, ...prev]);
    logAudit(
      'SOLIDARITY_GROUP_CREATED',
      `Formed solidarity group ${newGroup.groupName} (${newGroup.groupCode}) with ${members.length} members & peer guarantee agreement`,
      'SYSTEM',
      { targetType: 'SolidarityGroup', targetId: newGroup.groupCode }
    );
    return newGroup;
  };

  const updateSolidarityGroup = (groupId: string, updates: Partial<SolidarityGroup>) => {
    setSolidarityGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const updated = { ...g, ...updates };
          if (updates.members) {
            updated.totalActiveLoans = updates.members.reduce((acc, m) => acc + (m.activeLoanAmount || 0), 0);
            updated.totalGroupSavings = updates.members.reduce((acc, m) => acc + (m.savingsBalance || 0), 0);
          }
          return updated;
        }
        return g;
      })
    );
    logAudit('SOLIDARITY_GROUP_UPDATED', `Updated solidarity group configuration for group ID ${groupId}`, 'SYSTEM');
  };

  const deleteSolidarityGroup = (groupId: string) => {
    const grp = solidarityGroups.find((g) => g.id === groupId);
    if (!grp) return;
    setSolidarityGroups((prev) => prev.filter((g) => g.id !== groupId));
    logAudit('SOLIDARITY_GROUP_DELETED', `Removed solidarity group ${grp.groupName} (${grp.groupCode})`, 'SYSTEM');
  };

  const addMemberToGroup = (groupId: string, member: SolidarityGroupMember) => {
    setSolidarityGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const exists = g.members.some((m) => m.borrowerId === member.borrowerId);
          if (exists) return g;
          const updatedMembers = [...g.members, member];
          return {
            ...g,
            members: updatedMembers,
            totalActiveLoans: updatedMembers.reduce((acc, m) => acc + (m.activeLoanAmount || 0), 0),
            totalGroupSavings: updatedMembers.reduce((acc, m) => acc + (m.savingsBalance || 0), 0),
          };
        }
        return g;
      })
    );
    logAudit('SOLIDARITY_MEMBER_ADDED', `Added ${member.fullName} to solidarity group ${groupId}`, 'BORROWER');
  };

  const removeMemberFromGroup = (groupId: string, borrowerId: string) => {
    setSolidarityGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const updatedMembers = g.members.filter((m) => m.borrowerId !== borrowerId);
          return {
            ...g,
            members: updatedMembers,
            totalActiveLoans: updatedMembers.reduce((acc, m) => acc + (m.activeLoanAmount || 0), 0),
            totalGroupSavings: updatedMembers.reduce((acc, m) => acc + (m.savingsBalance || 0), 0),
          };
        }
        return g;
      })
    );
    logAudit('SOLIDARITY_MEMBER_REMOVED', `Removed member ${borrowerId} from solidarity group ${groupId}`, 'BORROWER');
  };

  const assignGroupLeader = (groupId: string, leaderBorrowerId: string) => {
    setSolidarityGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const leaderMember = g.members.find((m) => m.borrowerId === leaderBorrowerId);
          if (!leaderMember) return g;
          const updatedMembers = g.members.map((m) => ({
            ...m,
            role: m.borrowerId === leaderBorrowerId ? ('Leader' as const) : m.role === 'Leader' ? ('Member' as const) : m.role,
          }));
          return {
            ...g,
            leaderBorrowerId,
            leaderName: leaderMember.fullName,
            leaderPhone: leaderMember.phone,
            members: updatedMembers,
          };
        }
        return g;
      })
    );
    logAudit('SOLIDARITY_LEADER_ASSIGNED', `Assigned new Center Leader (${leaderBorrowerId}) for group ${groupId}`, 'SYSTEM');
  };

  const createGroupLoan = (loanData: Partial<GroupLoan>): GroupLoan => {
    const year = new Date().getFullYear();
    const groupLoanNumber = loanData.groupLoanNumber || `GLOAN-${year}-${String(groupLoans.length + 1).padStart(3, '0')}`;
    const obligations = loanData.memberObligations || [];
    const totalPrincipal = obligations.reduce((sum, o) => sum + o.allocatedPrincipal, 0) || loanData.totalPrincipalAmount || 100000;
    const interestRate = loanData.interestRate || 2.5;
    const termMonths = loanData.termMonths || 6;
    const totalInterest = Math.round((totalPrincipal * (interestRate / 100) * termMonths));
    const totalPayable = totalPrincipal + totalInterest;

    const newGroupLoan: GroupLoan = {
      id: `gloan-${Date.now()}`,
      groupLoanNumber,
      groupId: loanData.groupId || '',
      groupCode: loanData.groupCode || 'GRP-2026-001',
      groupName: loanData.groupName || 'Solidarity Group',
      centerName: loanData.centerName || 'Center 1',
      branchId: loanData.branchId || (activeBranchId === 'all' ? 'br-main' : activeBranchId),
      productId: loanData.productId || 'lp-2',
      productName: loanData.productName || 'Micro-Negosyo Group Loan',
      totalPrincipalAmount: totalPrincipal,
      interestRate,
      termMonths,
      repaymentFrequency: loanData.repaymentFrequency || 'Weekly',
      totalInterest,
      totalPayable,
      totalPaid: 0,
      remainingBalance: totalPayable,
      status: 'Active',
      applicationDate: new Date().toISOString().split('T')[0],
      disbursedDate: new Date().toISOString().split('T')[0],
      maturityDate: new Date(Date.now() + termMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      loanOfficerId: currentUser.id,
      loanOfficerName: currentUser.name,
      purpose: loanData.purpose || 'Working capital and inventory replenishment for group members',
      solidarityAgreementSigned: true,
      repaymentRate: 100.0,
      delinquentMembersCount: 0,
      memberObligations: obligations.map((o) => ({
        ...o,
        totalPaid: 0,
        remainingBalance: o.totalObligation,
        status: 'Current',
      })),
    };

    setGroupLoans((prev) => [newGroupLoan, ...prev]);

    // Update group entity
    if (newGroupLoan.groupId) {
      setSolidarityGroups((prev) =>
        prev.map((g) => {
          if (g.id === newGroupLoan.groupId) {
            const updatedMembers = g.members.map((m) => {
              const matchedObligation = obligations.find((o) => o.borrowerId === m.borrowerId);
              if (matchedObligation) {
                return {
                  ...m,
                  activeLoanAmount: matchedObligation.allocatedPrincipal,
                  remainingBalance: matchedObligation.totalObligation,
                  weeklyDues: matchedObligation.periodicDues,
                  status: 'Good Standing' as const,
                };
              }
              return m;
            });
            return {
              ...g,
              activeGroupLoanId: newGroupLoan.id,
              activeGroupLoanNumber: newGroupLoan.groupLoanNumber,
              totalActiveLoans: totalPrincipal,
              members: updatedMembers,
            };
          }
          return g;
        })
      );
    }

    logAudit(
      'GROUP_LOAN_DISBURSED',
      `Originated & disbursed Group Loan ${newGroupLoan.groupLoanNumber} for ₱${totalPrincipal.toLocaleString()} across ${obligations.length} members with peer guarantee`,
      'LOAN',
      { targetType: 'GroupLoan', targetId: newGroupLoan.groupLoanNumber }
    );

    return newGroupLoan;
  };

  const approveGroupLoan = (groupLoanId: string) => {
    setGroupLoans((prev) =>
      prev.map((gl) => (gl.id === groupLoanId ? { ...gl, status: 'Approved', approvalDate: new Date().toISOString().split('T')[0] } : gl))
    );
    logAudit('GROUP_LOAN_APPROVED', `Credit committee approved group loan ${groupLoanId}`, 'LOAN');
  };

  const disburseGroupLoan = (groupLoanId: string) => {
    setGroupLoans((prev) =>
      prev.map((gl) => (gl.id === groupLoanId ? { ...gl, status: 'Disbursed', disbursedDate: new Date().toISOString().split('T')[0] } : gl))
    );
    logAudit('GROUP_LOAN_DISBURSED', `Disbursed funds for group loan ${groupLoanId}`, 'LOAN');
  };

  const recordCenterMeeting = (meetingData: Partial<GroupMeetingLog>): GroupMeetingLog => {
    const year = new Date().getFullYear();
    const meetingNumber = meetingData.meetingNumber || `MTG-${year}-${String(groupMeetingLogs.length + 1).padStart(3, '0')}`;
    const collections = meetingData.collections || [];
    const attendances = meetingData.attendances || [];
    const totalActualCollections = collections.reduce((acc, c) => acc + c.amountPaid, 0);
    const totalExpectedCollections = collections.reduce((acc, c) => acc + c.expectedDue, 0);
    const totalSolidarityFundCollected = collections.reduce((acc, c) => acc + c.solidarityContribution, 0);
    const totalSolidarityCoveredUsed = collections.reduce((acc, c) => acc + (c.solidarityAmountCovered || 0), 0);
    const presentCount = attendances.filter((a) => a.status === 'Present').length;
    const attendanceRate = attendances.length > 0 ? (presentCount / attendances.length) * 100 : 100;

    const newLog: GroupMeetingLog = {
      id: `mtg-${Date.now()}`,
      meetingNumber,
      groupId: meetingData.groupId || '',
      groupCode: meetingData.groupCode || 'GRP-2026-001',
      groupName: meetingData.groupName || 'Solidarity Group',
      centerName: meetingData.centerName || 'Center',
      meetingDate: meetingData.meetingDate || new Date().toISOString().split('T')[0],
      meetingTime: meetingData.meetingTime || '09:00 AM',
      meetingLocation: meetingData.meetingLocation || 'Barangay Hall',
      presidedBy: currentUser.name,
      presidedByRole: currentUser.title,
      attendances,
      collections,
      totalExpectedCollections,
      totalActualCollections,
      totalSolidarityFundCollected,
      totalSolidarityCoveredUsed,
      attendanceRate,
      meetingNotes: meetingData.meetingNotes || 'Weekly center collection & solidarity check-in completed.',
      recordedAt: new Date().toISOString(),
    };

    setGroupMeetingLogs((prev) => [newLog, ...prev]);

    // Update group solidarity fund balance and member loan obligations
    if (newLog.groupId) {
      setSolidarityGroups((prev) =>
        prev.map((g) => {
          if (g.id === newLog.groupId) {
            const updatedFundBalance = Math.max(
              0,
              g.solidarityFundBalance + totalSolidarityFundCollected - totalSolidarityCoveredUsed
            );
            const updatedMembers = g.members.map((m) => {
              const matchedCollection = collections.find((c) => c.borrowerId === m.borrowerId);
              if (matchedCollection) {
                const paid = matchedCollection.amountPaid + (matchedCollection.solidarityAmountCovered || 0);
                const newBalance = Math.max(0, m.remainingBalance - paid);
                const newStatus =
                  matchedCollection.paymentStatus === 'Paid in Full'
                    ? ('Good Standing' as const)
                    : matchedCollection.paymentStatus === 'Covered by Solidarity'
                    ? ('Solidarity Covered' as const)
                    : ('Arrears' as const);

                return {
                  ...m,
                  remainingBalance: newBalance,
                  savingsBalance: m.savingsBalance + matchedCollection.solidarityContribution,
                  status: newStatus,
                  totalPaidToDate: (m.totalPaidToDate || 0) + paid,
                  daysLate: newStatus === 'Arrears' ? 7 : 0,
                };
              }
              return m;
            });

            const delinquentCount = updatedMembers.filter((m) => m.status === 'Arrears').length;
            const hasCovered = updatedMembers.some((m) => m.status === 'Solidarity Covered');

            return {
              ...g,
              solidarityFundBalance: updatedFundBalance,
              totalMeetingsHeld: (g.totalMeetingsHeld || 0) + 1,
              members: updatedMembers,
              totalGroupSavings: updatedMembers.reduce((acc, m) => acc + m.savingsBalance, 0),
              delinquencyStatus: delinquentCount > 0 ? ('At Risk' as const) : hasCovered ? ('Solidarity Covered' as const) : ('Healthy' as const),
              repaymentRate: totalExpectedCollections > 0 ? (totalActualCollections / totalExpectedCollections) * 100 : 100,
            };
          }
          return g;
        })
      );

      // Update Group Loan remaining balance
      setGroupLoans((prev) =>
        prev.map((gl) => {
          if (gl.groupId === newLog.groupId && gl.status === 'Active') {
            const newTotalPaid = gl.totalPaid + totalActualCollections + totalSolidarityCoveredUsed;
            const newRemaining = Math.max(0, gl.totalPayable - newTotalPaid);
            const updatedObligations = gl.memberObligations.map((o) => {
              const matchedCollection = collections.find((c) => c.borrowerId === o.borrowerId);
              if (matchedCollection) {
                const paid = matchedCollection.amountPaid + (matchedCollection.solidarityAmountCovered || 0);
                const newOblRemaining = Math.max(0, o.remainingBalance - paid);
                return {
                  ...o,
                  totalPaid: o.totalPaid + paid,
                  remainingBalance: newOblRemaining,
                  status:
                    newOblRemaining <= 0
                      ? ('Settled' as const)
                      : matchedCollection.paymentStatus === 'Paid in Full'
                      ? ('Current' as const)
                      : matchedCollection.paymentStatus === 'Covered by Solidarity'
                      ? ('Solidarity Covered' as const)
                      : ('In Arrears' as const),
                  solidarityCoveredAmount: (o.solidarityCoveredAmount || 0) + (matchedCollection.solidarityAmountCovered || 0),
                };
              }
              return o;
            });

            return {
              ...gl,
              totalPaid: newTotalPaid,
              remainingBalance: newRemaining,
              status: newRemaining <= 0 ? 'Settled' : gl.status,
              memberObligations: updatedObligations,
              repaymentRate: Math.min(100, (newTotalPaid / gl.totalPayable) * 100),
            };
          }
          return gl;
        })
      );
    }

    logAudit(
      'CENTER_MEETING_RECORDED',
      `Recorded Center Meeting ${newLog.meetingNumber} for group ${newLog.groupName}: Collected ₱${totalActualCollections.toLocaleString()} in dues and ₱${totalSolidarityFundCollected.toLocaleString()} into Solidarity Fund`,
      'PAYMENT',
      { targetType: 'GroupMeetingLog', targetId: newLog.meetingNumber }
    );

    return newLog;
  };

  const recordGroupRepayment = (params: {
    groupLoanId: string;
    borrowerId: string;
    amount: number;
    solidarityContribution?: number;
    paymentMethod?: string;
    notes?: string;
  }) => {
    const loan = groupLoans.find((gl) => gl.id === params.groupLoanId);
    if (!loan) return { success: false, error: 'Group loan not found' };

    setGroupLoans((prev) =>
      prev.map((gl) => {
        if (gl.id === params.groupLoanId) {
          const updatedObligations = gl.memberObligations.map((o) => {
            if (o.borrowerId === params.borrowerId) {
              const newPaid = o.totalPaid + params.amount;
              const newBal = Math.max(0, o.remainingBalance - params.amount);
              return {
                ...o,
                totalPaid: newPaid,
                remainingBalance: newBal,
                status: newBal <= 0 ? ('Settled' as const) : ('Current' as const),
                daysInArrears: 0,
              };
            }
            return o;
          });
          const newTotalPaid = gl.totalPaid + params.amount;
          return {
            ...gl,
            totalPaid: newTotalPaid,
            remainingBalance: Math.max(0, gl.totalPayable - newTotalPaid),
            memberObligations: updatedObligations,
          };
        }
        return gl;
      })
    );

    // Also update member in Solidarity Group
    setSolidarityGroups((prev) =>
      prev.map((g) => {
        if (g.id === loan.groupId) {
          const updatedMembers = g.members.map((m) => {
            if (m.borrowerId === params.borrowerId) {
              return {
                ...m,
                remainingBalance: Math.max(0, m.remainingBalance - params.amount),
                status: 'Good Standing' as const,
                daysLate: 0,
              };
            }
            return m;
          });
          return {
            ...g,
            members: updatedMembers,
            delinquencyStatus: updatedMembers.some((m) => m.status === 'Arrears') ? ('At Risk' as const) : ('Healthy' as const),
          };
        }
        return g;
      })
    );

    logAudit(
      'GROUP_MEMBER_PAYMENT_RECORDED',
      `Recorded individual payment ₱${params.amount.toLocaleString()} for borrower ${params.borrowerId} on group loan ${loan.groupLoanNumber}`,
      'PAYMENT'
    );

    return { success: true };
  };

  const activateSolidarityBridge = (params: {
    groupId: string;
    borrowerId: string;
    shortfallAmount: number;
    reason: string;
  }) => {
    const grp = solidarityGroups.find((g) => g.id === params.groupId);
    if (!grp) return { success: false, message: 'Group not found' };
    if (grp.solidarityFundBalance < params.shortfallAmount) {
      return {
        success: false,
        message: `Insufficient Solidarity Reserve Fund balance (Available: ₱${grp.solidarityFundBalance.toLocaleString()})`,
      };
    }

    setSolidarityGroups((prev) =>
      prev.map((g) => {
        if (g.id === params.groupId) {
          const updatedMembers = g.members.map((m) => {
            if (m.borrowerId === params.borrowerId) {
              return {
                ...m,
                status: 'Solidarity Covered' as const,
                daysLate: 0,
              };
            }
            return m;
          });
          return {
            ...g,
            solidarityFundBalance: g.solidarityFundBalance - params.shortfallAmount,
            delinquencyStatus: 'Solidarity Covered' as const,
            members: updatedMembers,
          };
        }
        return g;
      })
    );

    logAudit(
      'SOLIDARITY_BRIDGE_ACTIVATED',
      `Activated Solidarity Reserve Fund Bridge of ₱${params.shortfallAmount.toLocaleString()} for member ${params.borrowerId} in group ${grp.groupName}: ${params.reason}`,
      'PAYMENT',
      { targetType: 'SolidarityGroup', targetId: grp.groupCode }
    );

    return {
      success: true,
      message: `Solidarity Guarantee Bridge activated! ₱${params.shortfallAmount.toLocaleString()} bridged from Group Solidarity Reserve Fund to protect group rating.`,
    };
  };

  // ==========================================
  // 8. Financial Submodule Actions
  // ==========================================
  const addFinancialAccount = (acc: Omit<FinancialAccount, 'id'>) => {
    const newAcc: FinancialAccount = {
      ...acc,
      id: `acc-${Date.now()}`,
    };
    setFinancialAccounts((prev) => [...prev, newAcc]);
    logAudit('FIN_ACCOUNT_CREATED', `Created Chart of Account ${newAcc.code} - ${newAcc.name}`, 'SYSTEM');
    return newAcc;
  };

  const addFinancialJournalEntry = (entry: Omit<FinancialJournalEntry, 'id'>) => {
    const newEntry: FinancialJournalEntry = {
      ...entry,
      id: `je-${Date.now()}`,
    };
    setFinancialJournalEntries((prev) => [newEntry, ...prev]);
    logAudit('FIN_JOURNAL_POSTED', `Posted Journal Entry ${newEntry.ref} (₱${newEntry.totalDebit.toLocaleString()})`, 'PAYMENT');
    return newEntry;
  };

  const addSupplierBill = (bill: Omit<FinancialSupplierBill, 'id' | 'billCode' | 'paidAmount' | 'archived'>) => {
    const newBill: FinancialSupplierBill = {
      ...bill,
      id: `bill-${Date.now()}`,
      billCode: `BILL-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      paidAmount: 0,
      archived: false,
    };
    setFinancialSupplierBills((prev) => [newBill, ...prev]);
    logAudit('FIN_BILL_RECORDED', `Recorded vendor bill ${newBill.billCode} for ${newBill.supplierName}: ₱${newBill.amount.toLocaleString()}`, 'SYSTEM');
    return newBill;
  };

  const paySupplierBill = (
    billId: string,
    amount: number,
    paymentMethod: 'Cash' | 'Bank Transfer' | 'Cheque' | 'GCash',
    referenceNumber?: string
  ) => {
    const bill = financialSupplierBills.find((b) => b.id === billId);
    if (!bill) return { success: false, error: 'Bill not found' };

    const newPaidAmount = (bill.paidAmount || 0) + amount;
    const newStatus: 'Paid' | 'Partially Paid' | 'Unpaid' =
      newPaidAmount >= bill.amount ? 'Paid' : newPaidAmount > 0 ? 'Partially Paid' : 'Unpaid';

    const newPayment: FinancialBillPayment = {
      id: `bp-${Date.now()}`,
      billId,
      amount,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod,
      referenceNumber: referenceNumber || `REF-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setFinancialSupplierBills((prev) =>
      prev.map((b) => (b.id === billId ? { ...b, paidAmount: newPaidAmount, status: newStatus } : b))
    );
    setFinancialBillPayments((prev) => [newPayment, ...prev]);
    logAudit('FIN_BILL_PAID', `Paid ₱${amount.toLocaleString()} for bill ${bill.billCode} via ${paymentMethod}`, 'PAYMENT');

    return { success: true };
  };

  const addFinancialTaxRecord = (rec: Omit<FinancialTaxRecord, 'id'>) => {
    const newTax: FinancialTaxRecord = {
      ...rec,
      id: `tax-${Date.now()}`,
    };
    setFinancialTaxRecords((prev) => [newTax, ...prev]);
    logAudit('FIN_TAX_RECORDED', `Recorded Tax Entry for ${newTax.period} - ${newTax.taxType} (₱${newTax.taxDue.toLocaleString()})`, 'SYSTEM');
    return newTax;
  };

  const updateFinancialBudget = (department: string, allocated: number, used: number) => {
    setFinancialBudgets((prev) =>
      prev.map((b) =>
        b.department === department
          ? { ...b, allocated, used, remaining: Math.max(0, allocated - used) }
          : b
      )
    );
    logAudit('FIN_BUDGET_UPDATED', `Updated budget for ${department}`, 'SYSTEM');
  };

  const addCashTransaction = (tx: Omit<FinancialCashTransaction, 'id' | 'transactionCode'>) => {
    const newTx: FinancialCashTransaction = {
      ...tx,
      id: `ct-${Date.now()}`,
      transactionCode: `CSH-${tx.transactionType === 'Cash In' ? 'IN' : 'OUT'}-${Date.now().toString().slice(-4)}`,
    };
    setFinancialCashTransactions((prev) => [newTx, ...prev]);
    logAudit('FIN_CASH_TX_RECORDED', `Recorded ${newTx.transactionType} ₱${newTx.amount.toLocaleString()} - ${newTx.description}`, 'PAYMENT');
    return newTx;
  };

  // ==========================================
  // 9. Oversight Submodule Actions (KALASAG)
  // ==========================================
  const addAuditFinding = (finding: Omit<OversightAuditFinding, 'findingId' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newFinding: OversightAuditFinding = {
      ...finding,
      findingId: `fnd-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    setOversightAuditFindings((prev) => [newFinding, ...prev]);
    logAudit('AUDIT_FINDING_LOGGED', `Logged Audit Finding: ${newFinding.engagementArea} - [${newFinding.riskOrImpactRating.toUpperCase()}]`, 'SYSTEM');
    return newFinding;
  };

  const updateAuditFindingStatus = (findingId: string, status: FindingStatus, closureEvidence?: string) => {
    setOversightAuditFindings((prev) =>
      prev.map((f) =>
        f.findingId === findingId
          ? { ...f, status, closureEvidence: closureEvidence || f.closureEvidence, updatedAt: new Date().toISOString() }
          : f
      )
    );
    logAudit('AUDIT_FINDING_STATUS_CHANGED', `Updated audit finding ${findingId} to status ${status}`, 'SYSTEM');
  };

  const addCorrectiveAction = (cap: Omit<OversightCorrectiveAction, 'correctiveActionId' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newCap: OversightCorrectiveAction = {
      ...cap,
      correctiveActionId: `cap-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    setOversightCorrectiveActions((prev) => [newCap, ...prev]);
    logAudit('CORRECTIVE_ACTION_CREATED', `Created Corrective Action Plan for Finding ${cap.findingId}`, 'SYSTEM');
    return newCap;
  };

  const verifyCorrectiveAction = (capId: string, verifiedBy: string) => {
    const now = new Date().toISOString();
    setOversightCorrectiveActions((prev) =>
      prev.map((c) =>
        c.correctiveActionId === capId
          ? { ...c, status: 'completed', verifiedBy, verifiedByName: currentUser.name, verifiedAt: now, updatedAt: now }
          : c
      )
    );
    logAudit('CORRECTIVE_ACTION_VERIFIED', `Verified and closed CAP ${capId}`, 'SYSTEM');
  };

  const addComplianceReview = (rev: Omit<OversightComplianceReview, 'reviewId' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRev: OversightComplianceReview = {
      ...rev,
      reviewId: `rev-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    setOversightComplianceReviews((prev) => [newRev, ...prev]);
    logAudit('COMPLIANCE_REVIEW_RECORDED', `Recorded Compliance Review for ${newRev.requirementDescription}`, 'SYSTEM');
    return newRev;
  };

  const addControlException = (exc: Omit<OversightControlException, 'exceptionId' | 'identifiedAt' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newExc: OversightControlException = {
      ...exc,
      exceptionId: `exc-${Date.now()}`,
      identifiedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    setOversightControlExceptions((prev) => [newExc, ...prev]);
    logAudit('CONTROL_EXCEPTION_LOGGED', `Identified Control Exception in ${newExc.sourceArea}: ${newExc.description}`, 'SYSTEM');
    return newExc;
  };

  const resolveControlException = (excId: string, resolutionDate?: string) => {
    setOversightControlExceptions((prev) =>
      prev.map((e) =>
        e.exceptionId === excId
          ? { ...e, status: 'resolved', resolutionDate: resolutionDate || new Date().toISOString().split('T')[0], updatedAt: new Date().toISOString() }
          : e
      )
    );
    logAudit('CONTROL_EXCEPTION_RESOLVED', `Resolved Control Exception ${excId}`, 'SYSTEM');
  };

  const generateOversightReport = (report: Omit<OversightReport, 'reportId' | 'generatedAt' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRep: OversightReport = {
      ...report,
      reportId: `rep-${Date.now()}`,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    setOversightReports((prev) => [newRep, ...prev]);
    logAudit('OVERSIGHT_REPORT_GENERATED', `Generated Oversight Report: ${newRep.reportName} (${newRep.reportType})`, 'SYSTEM');
    return newRep;
  };

  const approveOversightReport = (reportId: string, approvedBy: string, remarks?: string) => {
    const now = new Date().toISOString();
    setOversightReports((prev) =>
      prev.map((r) =>
        r.reportId === reportId
          ? { ...r, approvalStatus: 'approved', approvedBy, approvedByName: currentUser.name, approvedAt: now, remarks: remarks || r.remarks, updatedAt: now }
          : r
      )
    );
    logAudit('OVERSIGHT_REPORT_APPROVED', `Approved Oversight Report ${reportId}`, 'SYSTEM');
  };

  const updateOversightSettings = (newSettings: Partial<OversightSystemSettings>) => {
    setOversightSettings((prev) => ({
      ...prev,
      ...newSettings,
      updatedBy: currentUser.id,
      updatedAt: new Date().toISOString(),
    }));
    logAudit('OVERSIGHT_SETTINGS_UPDATED', 'Updated KALASAG Institutional Oversight System Settings', 'SYSTEM');
  };

  const updateCollectionMonitoring = (monitoringId: string, data: Partial<OversightCollectionMonitoring>) => {
    setOversightCollectionMonitoring((prev) =>
      prev.map((m) =>
        m.monitoringId === monitoringId ? { ...m, ...data, updatedAt: new Date().toISOString() } : m
      )
    );
    logAudit('COLLECTION_MONITORING_UPDATED', `Updated collection monitoring record ${monitoringId}`, 'PAYMENT');
  };

  const updateDisbursementTracking = (trackerId: string, status: TrackingStatus, verifiedBy?: string) => {
    const now = new Date().toISOString();
    setOversightDisbursementTracker((prev) =>
      prev.map((d) =>
        d.trackerId === trackerId
          ? { ...d, trackingStatus: status, verifiedBy: verifiedBy || d.verifiedBy, verifiedByName: currentUser.name, verifiedAt: now, updatedAt: now }
          : d
      )
    );
    logAudit('DISBURSEMENT_TRACKING_UPDATED', `Updated disbursement tracking ${trackerId} to ${status}`, 'LOAN');
  };

  const resetToDefaults = () => {
    localStorage.removeItem(`${STORAGE_KEY}_branches`);
    localStorage.removeItem(`${STORAGE_KEY}_staff`);
    localStorage.removeItem(`${STORAGE_KEY}_currentUser`);
    localStorage.removeItem(`${STORAGE_KEY}_products`);
    localStorage.removeItem(`${STORAGE_KEY}_borrowers`);
    localStorage.removeItem(`${STORAGE_KEY}_loans`);
    localStorage.removeItem(`${STORAGE_KEY}_payments`);
    localStorage.removeItem(`${STORAGE_KEY}_membershipApps`);
    localStorage.removeItem(`${STORAGE_KEY}_updateRequests`);
    localStorage.removeItem(`${STORAGE_KEY}_followUps`);
    localStorage.removeItem(`${STORAGE_KEY}_savingsAccounts`);
    localStorage.removeItem(`${STORAGE_KEY}_savingsTx`);
    localStorage.removeItem(`${STORAGE_KEY}_withdrawals`);
    localStorage.removeItem(`${STORAGE_KEY}_interestLogs`);
    localStorage.removeItem(`${STORAGE_KEY}_solidarityGroups`);
    localStorage.removeItem(`${STORAGE_KEY}_groupLoans`);
    localStorage.removeItem(`${STORAGE_KEY}_groupMeetings`);
    localStorage.removeItem(`${STORAGE_KEY}_financialTx`);
    localStorage.removeItem(`${STORAGE_KEY}_logs`);
    localStorage.removeItem(`${STORAGE_KEY}_finAccounts`);
    localStorage.removeItem(`${STORAGE_KEY}_finSuppliers`);
    localStorage.removeItem(`${STORAGE_KEY}_finSupplierBills`);
    localStorage.removeItem(`${STORAGE_KEY}_finBillPayments`);
    localStorage.removeItem(`${STORAGE_KEY}_finBudgets`);
    localStorage.removeItem(`${STORAGE_KEY}_finTaxRecords`);
    localStorage.removeItem(`${STORAGE_KEY}_finJournalEntries`);
    localStorage.removeItem(`${STORAGE_KEY}_finCashTx`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightSnapshots`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightCollectionMon`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightDsbTracker`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightEngagements`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightFindings`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightCorrectiveActions`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightComplianceReqs`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightComplianceReviews`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightControlExceptions`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightReports`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightMetrics`);
    localStorage.removeItem(`${STORAGE_KEY}_oversightSettings`);

    setBranches(INITIAL_BRANCHES);
    setStaffList(INITIAL_STAFF);
    setCurrentUser(INITIAL_STAFF[0]);
    setLoanProducts(INITIAL_LOAN_PRODUCTS);
    setBorrowers(INITIAL_BORROWERS);
    setLoans(INITIAL_LOANS);
    setPayments(INITIAL_PAYMENTS);
    setMembershipApplications(INITIAL_MEMBERSHIP_APPLICATIONS);
    setMemberUpdateRequests(INITIAL_UPDATE_REQUESTS);
    setMemberFollowUpLogs(INITIAL_FOLLOW_UP_LOGS);
    setSavingsAccounts(INITIAL_SAVINGS_ACCOUNTS);
    setSavingsTransactions(INITIAL_SAVINGS_TRANSACTIONS);
    setWithdrawalRequests(INITIAL_WITHDRAWAL_REQUESTS);
    setInterestLogs(INITIAL_INTEREST_LOGS);
    setSolidarityGroups(INITIAL_SOLIDARITY_GROUPS);
    setGroupLoans(INITIAL_GROUP_LOANS);
    setGroupMeetingLogs(INITIAL_GROUP_MEETING_LOGS);
    setFinancialTransactions(INITIAL_FINANCIAL_TRANSACTIONS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setFinancialAccounts(INITIAL_FINANCIAL_ACCOUNTS);
    setFinancialSuppliers(INITIAL_FINANCIAL_SUPPLIERS);
    setFinancialSupplierBills(INITIAL_FINANCIAL_SUPPLIER_BILLS);
    setFinancialBillPayments(INITIAL_FINANCIAL_BILL_PAYMENTS);
    setFinancialBudgets(INITIAL_FINANCIAL_BUDGETS);
    setFinancialTaxRecords(INITIAL_FINANCIAL_TAX_RECORDS);
    setFinancialJournalEntries(INITIAL_FINANCIAL_JOURNAL_ENTRIES);
    setFinancialCashTransactions(INITIAL_FINANCIAL_CASH_TRANSACTIONS);
    setOversightSnapshots(INITIAL_OVERSIGHT_SNAPSHOTS);
    setOversightCollectionMonitoring(INITIAL_OVERSIGHT_COLLECTION_MONITORING);
    setOversightDisbursementTracker(INITIAL_OVERSIGHT_DISBURSEMENT_TRACKER);
    setOversightAuditEngagements(INITIAL_OVERSIGHT_AUDIT_ENGAGEMENTS);
    setOversightAuditFindings(INITIAL_OVERSIGHT_AUDIT_FINDINGS);
    setOversightCorrectiveActions(INITIAL_OVERSIGHT_CORRECTIVE_ACTIONS);
    setOversightComplianceRequirements(INITIAL_OVERSIGHT_COMPLIANCE_REQUIREMENTS);
    setOversightComplianceReviews(INITIAL_OVERSIGHT_COMPLIANCE_REVIEWS);
    setOversightControlExceptions(INITIAL_OVERSIGHT_CONTROL_EXCEPTIONS);
    setOversightReports(INITIAL_OVERSIGHT_REPORTS);
    setOversightMetrics(INITIAL_OVERSIGHT_METRICS);
    setOversightSettings(INITIAL_OVERSIGHT_SETTINGS);
  };

  return (
    <LoanContext.Provider
      value={{
        branches,
        activeBranchId,
        setActiveBranchId,
        activeBranch,
        staffList,
        currentUser,
        setCurrentUser,
        loanProducts,
        borrowers,
        loans,
        payments,
        financialTransactions,
        filteredFinancialTransactions,
        createFinancialTransaction,
        reverseFinancialTransaction,
        updateFinancialTransactionStatus,

        // 8. Financial Submodule State & Actions
        financialAccounts,
        financialSuppliers,
        financialSupplierBills,
        financialBillPayments,
        financialBudgets,
        financialTaxRecords,
        financialJournalEntries,
        financialCashTransactions,
        financialMonthlyCashFlow,
        financialMonthlyDisbursements,
        financialMonthlyCollections,
        addFinancialAccount,
        addFinancialJournalEntry,
        addSupplierBill,
        paySupplierBill,
        addFinancialTaxRecord,
        updateFinancialBudget,
        addCashTransaction,

        // 9. Oversight Submodule State & Actions
        oversightSnapshots,
        oversightCollectionMonitoring,
        oversightDisbursementTracker,
        oversightAuditEngagements,
        oversightAuditFindings,
        oversightCorrectiveActions,
        oversightComplianceRequirements,
        oversightComplianceReviews,
        oversightControlExceptions,
        oversightReports,
        oversightMetrics,
        oversightSettings,
        addAuditFinding,
        updateAuditFindingStatus,
        addCorrectiveAction,
        verifyCorrectiveAction,
        addComplianceReview,
        addControlException,
        resolveControlException,
        generateOversightReport,
        approveOversightReport,
        updateOversightSettings,
        updateCollectionMonitoring,
        updateDisbursementTracking,

        auditLogs,
        reminders,

        membershipApplications,
        memberUpdateRequests,
        memberFollowUpLogs,

        savingsAccounts,
        savingsTransactions,
        withdrawalRequests,
        interestLogs,

        solidarityGroups,
        groupLoans,
        groupMeetingLogs,
        filteredSolidarityGroups,
        filteredGroupLoans,

        openSavingsAccount,
        recordSavingsDeposit,
        recordSavingsWithdrawal,
        updateSavingsAccountStatus,
        creditMonthlySavingsInterest: runMonthlyInterestCrediting,

        createSolidarityGroup,
        updateSolidarityGroup,
        deleteSolidarityGroup,
        addMemberToGroup,
        removeMemberFromGroup,
        assignGroupLeader,
        createGroupLoan,
        approveGroupLoan,
        disburseGroupLoan,
        recordCenterMeeting,
        recordGroupRepayment,
        activateSolidarityBridge,

        filteredLoans,
        filteredBorrowers,
        filteredPayments,
        filteredMembershipApps,
        filteredWithdrawals,

        stats: {
          totalPortfolio,
          totalOutstanding: totalPortfolio,
          totalDisbursed,
          totalCollected,
          activeLoansCount,
          overdueLoansCount,
          par30Ratio,
          par30: par30Ratio,
          collectionRate,
          collectionEfficiency: collectionRate,
          totalVaultCash,
          activeBorrowersCount,
          totalSavingsPool,
          inactiveMembersCount,
          pendingMembershipCount,
        },

        dbStatus,
        isSyncingDb,
        syncWithDatabase,

        submitMembershipApplication,
        staffVerifyMembershipApp,
        educationCommRecordBI,
        bodApproveMembershipApp,
        rejectMembershipApp,

        submitMemberUpdateRequest,
        approveMemberUpdateRequest,
        rejectMemberUpdateRequest,

        logMemberFollowUp,
        reactivateMember,

        depositSavings,
        requestSavingsWithdrawal,
        managerApproveWithdrawal,
        managerRejectWithdrawal,
        runMonthlyInterestCrediting,

        registerClient,
        updateClientStatus,
        uploadKycDocument,
        reviewKyc,
        deleteKycDocument,
        addBorrower,
        createBorrower: addBorrower,
        updateBorrower,
        deleteBorrower,
        createLoanApplication,
        submitLoanForApproval,
        startLoanReview,
        approveLoanApplication,
        rejectLoanApplication,
        disburseLoanRecord,
        markLoanCompleted,
        markLoanDefaulted,

        loanProcessorVerifyLoan,
        bookkeeperVerifyLoan,
        creditCommitteeInterviewLoan,
        prepareLoanVoucher,
        managerApproveLoanVoucher,
        disburseLoan,
        rejectLoan,
        evaluateMultiLoanEligibility,

        recordPayment,
        addBranch,
        updateBranch,
        addLoanProduct,
        updateLoanProduct,
        sendReminder,
        restructureLoan,
        logAudit,
        clearAuditLogs,
        resetToDefaults,
      }}
    >
      {children}
    </LoanContext.Provider>
  );
}

export function useLoan(): LoanContextType {
  const context = useContext(LoanContext);
  if (!context) {
    throw new Error('useLoan must be used within a LoanProvider');
  }
  return context;
}
