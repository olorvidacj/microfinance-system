import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AuditLogEntry,
  Borrower,
  Branch,
  CreditCommitteeEvaluation,
  InstallmentScheduleItem,
  InterestCreditLog,
  Loan,
  LoanDisbursementVoucher,
  LoanProduct,
  MemberFollowUpLog,
  MembershipApplication,
  MemberUpdateRequest,
  PaymentRecord,
  ReminderItem,
  SavingsTransaction,
  SavingsWithdrawalRequest,
  UserStaff,
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
  INITIAL_SAVINGS_TRANSACTIONS,
  INITIAL_STAFF,
  INITIAL_UPDATE_REQUESTS,
  INITIAL_WITHDRAWAL_REQUESTS,
} from '../data/initialData';
import { authFetch } from './AuthContext';
import {
  calculateAdvancePaymentRebate,
  calculateLatePenalty,
  calculateLoanSchedule,
  calculateMonthlySavingsInterest,
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
  savingsAccounts: { id: string; memberId: string; memberName: string; balance: number; passbookNumber: string }[];
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

  // 3. Loans Actions (Cooperative 6-step lifecycle)
  addBorrower: (borrower: Partial<Borrower>) => Borrower;
  createBorrower: (borrower: Partial<Borrower>) => Borrower;
  updateBorrower: (id: string, updates: Partial<Borrower>) => void;
  deleteBorrower: (id: string) => void;
  createLoanApplication: (loanData: any, autoApproveAndDisburse?: boolean) => Loan;
  
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
      localStorage.setItem(`${STORAGE_KEY}_savingsTx`, JSON.stringify(savingsTransactions));
      localStorage.setItem(`${STORAGE_KEY}_withdrawals`, JSON.stringify(withdrawalRequests));
      localStorage.setItem(`${STORAGE_KEY}_interestLogs`, JSON.stringify(interestLogs));
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
    savingsTransactions,
    withdrawalRequests,
    interestLogs,
    auditLogs,
  ]);

  // Helper log function
  const logAudit = (action: string, details: string, type: AuditLogEntry['type']) => {
    const entry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      performedBy: `${currentUser.name} (${currentUser.title})`,
      branchId: activeBranchId === 'all' ? 'br-main' : activeBranchId,
      type,
    };
    setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
  };

  // Active Branch
  const activeBranch = activeBranchId === 'all' ? null : branches.find((b) => b.id === activeBranchId) || null;

  // Filtered collections
  const filteredLoans = activeBranchId === 'all' ? loans : loans.filter((l) => l.branchId === activeBranchId);
  const filteredBorrowers = activeBranchId === 'all' ? borrowers : borrowers.filter((b) => b.branchId === activeBranchId);
  const filteredPayments = activeBranchId === 'all' ? payments : payments.filter((p) => p.branchId === activeBranchId);
  const filteredMembershipApps = activeBranchId === 'all' ? membershipApplications : membershipApplications.filter((a) => a.branchId === activeBranchId);
  const filteredWithdrawals = activeBranchId === 'all' ? withdrawalRequests : withdrawalRequests.filter((w) => w.branchId === activeBranchId);

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

  // Savings Deposit
  const depositSavings = (params: {
    memberId: string;
    amount: number;
    paymentMethod?: string;
    notes?: string;
  }): SavingsTransaction | null => {
    const member = borrowers.find((b) => b.id === params.memberId);
    if (!member || params.amount <= 0) return null;

    const balanceBefore = member.savingsBalance || 0;
    const balanceAfter = balanceBefore + params.amount;
    const orNumber = `OR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const tx: SavingsTransaction = {
      id: `sav-tx-${Date.now()}`,
      savingsAccountId: member.id,
      memberId: member.id,
      memberName: member.fullName,
      transactionNumber: `SAV-DEP-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      type: 'Deposit',
      amount: params.amount,
      balanceBefore,
      balanceAfter,
      processedBy: `${currentUser.name} (${currentUser.title})`,
      officialReceiptNumber: orNumber,
      notes: params.notes || `Over-the-counter deposit via ${params.paymentMethod || 'Cash'}`,
    };

    // Update member savings balance
    setBorrowers((prev) =>
      prev.map((b) => (b.id === member.id ? { ...b, savingsBalance: balanceAfter, lastActivityDate: new Date().toISOString().split('T')[0] } : b))
    );

    setSavingsTransactions((prev) => [tx, ...prev]);

    // Update cash vault balance
    setBranches((prev) =>
      prev.map((br) => (br.id === member.branchId ? { ...br, cashVaultBalance: br.cashVaultBalance + params.amount } : br))
    );

    logAudit('SAVINGS_DEPOSIT', `Deposited ₱${params.amount.toLocaleString()} for ${member.fullName} (OR ${orNumber})`, 'SAVINGS');
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

    // Record savings transaction
    const tx: SavingsTransaction = {
      id: `sav-tx-${Date.now()}`,
      savingsAccountId: member.id,
      memberId: member.id,
      memberName: member.fullName,
      transactionNumber: `SAV-WDR-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      type: 'Withdrawal',
      amount: req.requestedAmount,
      balanceBefore: member.savingsBalance || 0,
      balanceAfter: newBalance,
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

    const updatedBorrowers = borrowers.map((member) => {
      const currentBal = member.savingsBalance || 0;
      if (currentBal > 0) {
        const monthlyInterest = calculateMonthlySavingsInterest(currentBal, 0.01);
        if (monthlyInterest > 0) {
          totalInterestDistributed += monthlyInterest;
          membersCount += 1;

          const newBal = Math.round((currentBal + monthlyInterest) * 100) / 100;

          newTransactions.push({
            id: `sav-tx-int-${Date.now()}-${member.id}`,
            savingsAccountId: member.id,
            memberId: member.id,
            memberName: member.fullName,
            transactionNumber: `SAV-INT-${Date.now().toString().slice(-6)}`,
            date: dateStr,
            type: 'Interest Credited',
            amount: monthlyInterest,
            balanceBefore: currentBal,
            balanceAfter: newBal,
            processedBy: `System Batch (1% p.a. Interest Credited by ${currentUser.name})`,
            notes: `${monthName} 1.0% Annual Interest credited to savings balance`,
          });

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
  // 3. LOAN MANAGEMENT (Cooperative 6-Step Workflow & Vouchers)
  // ==========================================

  const addBorrower = (borrowerData: Partial<Borrower>): Borrower => {
    const newBorrower: Borrower = {
      id: `bor-${Date.now()}`,
      borrowerNumber: `MEM-${new Date().getFullYear()}-${String(borrowers.length + 101).padStart(4, '0')}`,
      fullName: borrowerData.fullName || 'Unnamed Member',
      idNumber: borrowerData.idNumber || 'ID-000000',
      phone: borrowerData.phone || '',
      email: borrowerData.email || '',
      dateOfBirth: borrowerData.dateOfBirth || '1990-01-01',
      gender: borrowerData.gender || 'Male',
      civilStatus: borrowerData.civilStatus || 'Single',
      address: borrowerData.address || '',
      facebookAccount: borrowerData.facebookAccount || '',
      branchId: borrowerData.branchId || (activeBranchId === 'all' ? 'br-main' : activeBranchId),
      employmentStatus: borrowerData.employmentStatus || 'Employed',
      employerOrBusiness: borrowerData.employerOrBusiness || '',
      occupation: borrowerData.occupation || '',
      monthlyIncome: borrowerData.monthlyIncome || 30000,
      monthlyExpenses: borrowerData.monthlyExpenses || 12000,
      creditScore: borrowerData.creditScore || 700,
      creditTier: borrowerData.creditTier || 'Good',
      kycStatus: borrowerData.kycStatus || 'Verified',
      memberStatus: borrowerData.memberStatus || 'Active',
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

  // Step 1: Member submits loan application
  const createLoanApplication = (loanData: any, autoApproveAndDisburse?: boolean): Loan => {
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

    const newLoan: Loan = {
      id: `loan-${Date.now()}`,
      loanNumber: `LN-${new Date().getFullYear()}-${String(loans.length + 101).padStart(4, '0')}`,
      borrowerId: loanData.borrowerId,
      borrowerName: borrower?.fullName || 'Unknown Member',
      borrowerPhone: borrower?.phone || '',
      borrowerAvatar: borrower?.avatar,
      branchId: borrower?.branchId || (activeBranchId === 'all' ? 'br-main' : activeBranchId),
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
      totalPaid: 0,
      remainingBalance: calc.totalPayable,
      status: autoApproveAndDisburse ? 'Disbursed' : 'Underwriting',
      coopStep: autoApproveAndDisburse ? 'DISBURSED' : 'SUBMITTED', // Step 1 or Disbursed
      applicationDate: startDateStr,
      startDate: startDateStr,
      disbursedDate: autoApproveAndDisburse ? startDateStr : undefined,
      approvalDate: autoApproveAndDisburse ? startDateStr : undefined,
      maturityDate: calc.schedule[calc.schedule.length - 1]?.dueDate || '',
      loanOfficerId: currentUser.id,
      loanOfficerName: currentUser.name,
      purpose: loanData.purpose || 'Cooperative Business / Personal financing',
      collateral: loanData.collateral || loanData.collaterals || [],
      collaterals: loanData.collateral || loanData.collaterals || [],
      guarantors: loanData.guarantors || [],
      schedule: calc.schedule,
      isIrregularAccount: false,
      totalLatePenaltiesCharged: 0,
      totalRebatesAwarded: 0,
    };

    if (autoApproveAndDisburse && borrower) {
      setBorrowers((prev) =>
        prev.map((b) =>
          b.id === borrower.id
            ? {
                ...b,
                activeLoansCount: b.activeLoansCount + 1,
                totalBorrowed: b.totalBorrowed + newLoan.principalAmount,
                lastActivityDate: startDateStr,
              }
            : b
        )
      );
    }

    setLoans((prev) => [newLoan, ...prev]);
    logAudit('LOAN_APPLICATION_SUBMITTED', `Originated loan application ${newLoan.loanNumber} for ₱${newLoan.principalAmount.toLocaleString()}`, 'LOAN');
    return newLoan;
  };

  // Step 2: Loan Processor Check
  const loanProcessorVerifyLoan = (loanId: string, notes?: string) => {
    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? {
              ...l,
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
            disbursementVoucher: updatedVoucher,
          };
        }
        return l;
      })
    );
    logAudit('LOAN_MANAGER_APPROVED', `Manager signed off loan voucher for loan ${loanId}`, 'LOAN');
  };

  // Step 7: Loan Released / Disbursed
  const disburseLoan = (loanId: string, method: string = 'Bank Transfer') => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;

    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId) {
          return {
            ...l,
            status: 'Disbursed',
            coopStep: 'DISBURSED',
            disbursedDate: new Date().toISOString().split('T')[0],
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
              activeLoansCount: b.activeLoansCount + 1,
              totalBorrowed: b.totalBorrowed + loan.principalAmount,
              lastActivityDate: new Date().toISOString().split('T')[0],
            }
          : b
      )
    );

    logAudit('LOAN_RELEASED_DISBURSED', `Released loan ${loan.loanNumber} proceeds of ₱${loan.principalAmount.toLocaleString()} via ${method}`, 'LOAN');
  };

  const rejectLoan = (loanId: string, reason: string = 'Did not meet credit criteria') => {
    setLoans((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, status: 'Rejected', coopStep: 'REJECTED' } : l))
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

    const effectivePaymentAmount = paymentData.amount + rebate;

    // Allocate breakdown: Penalty -> Interest -> Principal
    let penaltyPortion = Math.min(paymentData.amount, latePenalty);
    let rem = paymentData.amount - penaltyPortion;
    let interestPortion = Math.min(rem, Math.round(loan.totalInterest * 0.15));
    let principalPortion = rem - interestPortion;

    const newTotalPaid = loan.totalPaid + paymentData.amount;
    const newRemainingBalance = Math.max(0, loan.remainingBalance - effectivePaymentAmount);

    const isSettled = newRemainingBalance <= 0;

    // Update Installment Schedule
    const updatedSchedule = loan.schedule.map((item) => {
      if (item.status === 'Pending' || item.status === 'Overdue') {
        if (effectivePaymentAmount >= item.totalDue) {
          return {
            ...item,
            status: 'Paid' as const,
            amountPaid: item.totalDue,
            paidDate: dateStr,
            lateFeeApplied: latePenalty > 0 ? latePenalty : undefined,
            earlyRebateApplied: rebate > 0 ? rebate : undefined,
          };
        }
      }
      return item;
    });

    const nextPending = updatedSchedule.find((item) => item.status === 'Pending');

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
      principalPortion,
      interestPortion,
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
          return {
            ...l,
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            status: isSettled ? ('Settled' as const) : ('Disbursed' as const),
            schedule: updatedSchedule,
            nextPaymentDate: nextPending?.dueDate,
            lastPaymentDate: dateStr,
            daysInArrears: 0,
            isIrregularAccount: false,
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
            totalRepaid: b.totalRepaid + paymentData.amount,
            activeLoansCount: isSettled ? Math.max(0, b.activeLoansCount - 1) : b.activeLoansCount,
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

    logAudit('PAYMENT_RECEIVED_OFFICIAL_RECEIPT', `Collected ₱${paymentData.amount.toLocaleString()} on loan ${loan.loanNumber} via ${paymentData.paymentMethod} (OR ${orNumber})`, 'PAYMENT');

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
    localStorage.removeItem(`${STORAGE_KEY}_savingsTx`);
    localStorage.removeItem(`${STORAGE_KEY}_withdrawals`);
    localStorage.removeItem(`${STORAGE_KEY}_interestLogs`);
    localStorage.removeItem(`${STORAGE_KEY}_logs`);

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
    setSavingsTransactions(INITIAL_SAVINGS_TRANSACTIONS);
    setWithdrawalRequests(INITIAL_WITHDRAWAL_REQUESTS);
    setInterestLogs(INITIAL_INTEREST_LOGS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
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
        auditLogs,
        reminders,

        membershipApplications,
        memberUpdateRequests,
        memberFollowUpLogs,

        savingsTransactions,
        withdrawalRequests,
        interestLogs,

        savingsAccounts: borrowers.map((b) => ({
          id: `sav-${b.id}`,
          memberId: b.id,
          memberName: b.fullName,
          balance: b.savingsBalance || 1000,
          passbookNumber: `PB-${b.borrowerNumber.replace('MBR-', '')}`,
        })),
        creditMonthlySavingsInterest: runMonthlyInterestCrediting,

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

        addBorrower,
        createBorrower: addBorrower,
        updateBorrower,
        deleteBorrower,
        createLoanApplication,

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
