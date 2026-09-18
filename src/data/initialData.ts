import {
  Borrower,
  Branch,
  Loan,
  LoanProduct,
  PaymentRecord,
  UserStaff,
  AuditLogEntry,
  MembershipApplication,
  MemberUpdateRequest,
  MemberFollowUpLog,
  SavingsAccount,
  SavingsTransaction,
  SavingsWithdrawalRequest,
  InterestCreditLog,
  SolidarityGroup,
  GroupLoan,
  GroupMeetingLog,
  FinancialTransaction,
  FinancialAccount,
  FinancialSupplier,
  FinancialSupplierBill,
  FinancialBillPayment,
  FinancialBudget,
  FinancialTaxRecord,
  FinancialJournalEntry,
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
} from '../types';

/**
 * Cooperative configuration/reference data only. Every monetary field is zero —
 * balances, counts, and financial history must come from real database
 * transactions, never from hardcoded seed constants.
 */

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'br-main',
    code: 'TAC-MAIN',
    name: 'Tacloban Main Branch',
    city: 'Tacloban City',
    address: 'HOSCOMCO Cooperative Building, Real Street, Tacloban City, Leyte',
    phone: '+63 (053) 832-4190',
    managerName: 'Eduardo Manalo',
    managerEmail: 'e.manalo@HOSCOMCO.coop',
    activeDisbursedPool: 0,
    cashVaultBalance: 0,
    activeLoansCount: 0,
    color: '#F59E0B',
  },
  {
    id: 'br-west',
    code: 'WB-02',
    name: 'Malolos Agri-Micro Hub',
    city: 'Malolos City',
    address: '45 McArthur Highway, Guinhawa',
    phone: '+63 (044) 796-5120',
    managerName: 'Corazon Reyes',
    managerEmail: 'c.reyes@sanjosecoop.ph',
    activeDisbursedPool: 0,
    cashVaultBalance: 0,
    activeLoansCount: 0,
    color: '#10B981',
  },
  {
    id: 'br-downtown',
    code: 'DT-03',
    name: 'Meycauayan Commercial Branch',
    city: 'Meycauayan City',
    address: '77 St. Francis Plaza, Banga',
    phone: '+63 (044) 815-9923',
    managerName: 'Rosario Bautista',
    managerEmail: 'r.bautista@sanjosecoop.ph',
    activeDisbursedPool: 0,
    cashVaultBalance: 0,
    activeLoansCount: 0,
    color: '#8B5CF6',
  },
];

export const INITIAL_STAFF: UserStaff[] = [
  {
    id: 'staff-10',
    name: 'Danilo Aquino',
    email: 'unassigned.staff@HOSCOMCO.coop',
    role: 'LOAN_OFFICER',
    assignedBranchId: '',
    title: 'Field Credit Officer (Pending Assignment)',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    committee: 'Operations',
  },
  {
    id: 'staff-08',
    name: 'Elena Rostata',
    email: 'admin@HOSCOMCO.coop',
    role: 'ADMINISTRATOR',
    assignedBranchId: 'all',
    title: 'System Administrator & Operations Head',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    committee: 'Management',
  },
  {
    id: 'staff-09',
    name: 'Camille Bernardo',
    email: 'clientservices@HOSCOMCO.coop',
    role: 'CLIENT_SERVICES_STAFF',
    assignedBranchId: 'br-main',
    title: 'Client Services & KYC Onboarding Officer',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    committee: 'Operations',
  },
  {
    id: 'staff-02',
    name: 'Grace Mendoza',
    email: 'loanofficer@HOSCOMCO.coop',
    role: 'LOAN_OFFICER',
    assignedBranchId: 'br-main',
    title: 'Senior Loan Officer & Credit Underwriter',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    committee: 'Operations',
  },
  {
    id: 'staff-07',
    name: 'Chloe Simmons',
    email: 'teller@HOSCOMCO.coop',
    role: 'CASHIER_TELLER',
    assignedBranchId: 'br-main',
    title: 'Cashier & Savings Counter Teller',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    committee: 'Operations',
  },
  {
    id: 'staff-01',
    name: 'Eduardo Manalo',
    email: 'e.manalo@sanjosecoop.ph',
    role: 'MANAGER',
    assignedBranchId: 'br-main',
    title: 'General Manager',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    committee: 'Management',
  },
  {
    id: 'staff-03',
    name: 'Ricardo Santos, CPA',
    email: 'r.santos@sanjosecoop.ph',
    role: 'BOOKKEEPER',
    assignedBranchId: 'br-main',
    title: 'Head Bookkeeper / Accounting',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    committee: 'Operations',
  },
  {
    id: 'staff-04',
    name: 'Atty. Benjamin Cruz',
    email: 'b.cruz@sanjosecoop.ph',
    role: 'CREDIT_COMMITTEE',
    assignedBranchId: 'all',
    title: 'Credit Committee Chairperson',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    committee: 'Credit Committee',
  },
  {
    id: 'staff-05',
    name: 'Prof. Lourdes Dizon',
    email: 'l.dizon@sanjosecoop.ph',
    role: 'EDUCATION_COMMITTEE',
    assignedBranchId: 'all',
    title: 'Education Committee Head',
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
    committee: 'Education Committee',
  },
  {
    id: 'staff-06',
    name: 'Hon. Francisco Del Rosario',
    email: 'f.delrosario@sanjosecoop.ph',
    role: 'BOARD_OF_DIRECTORS',
    assignedBranchId: 'all',
    title: 'BOD Chairman',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    committee: 'Board of Directors',
  },
];

export const INITIAL_LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: 'prod-sme',
    code: 'LP-MICRO',
    name: 'Micro-Enterprise Business Loan',
    category: 'Commercial / Sari-Sari & Retail',
    interestRate: 12.0,
    interestType: 'Reducing Balance',
    minAmount: 10000,
    maxAmount: 250000,
    minTermMonths: 3,
    maxTermMonths: 24,
    defaultRepaymentFrequency: 'Semi-monthly',
    processingFeePercentage: 2.0,
    latePenaltyRate: 2.0,
    earlySettlementRebateRate: 20.0,
    requiresCollateral: false,
    requiresGuarantor: true,
    description: 'Working capital financing for cooperative micro-entrepreneurs, wet market vendors, and retailers.',
    badgeColor: 'blue',
  },
  {
    id: 'prod-regular',
    code: 'LP-REGULAR',
    name: 'Regular Multi-Purpose Member Loan',
    category: 'General / Personal',
    interestRate: 10.5,
    interestType: 'Reducing Balance',
    minAmount: 5000,
    maxAmount: 500000,
    minTermMonths: 6,
    maxTermMonths: 36,
    defaultRepaymentFrequency: 'Monthly',
    processingFeePercentage: 1.5,
    latePenaltyRate: 2.0,
    earlySettlementRebateRate: 25.0,
    requiresCollateral: false,
    requiresGuarantor: true,
    description: 'Low-interest credit line based on member share capital and savings equity.',
    badgeColor: 'emerald',
  },
  {
    id: 'prod-agri',
    code: 'LP-AGRI',
    name: 'Agricultural Crop & Farm Inputs Loan',
    category: 'Agriculture & Livestock',
    interestRate: 9.0,
    interestType: 'Flat Rate',
    minAmount: 15000,
    maxAmount: 300000,
    minTermMonths: 4,
    maxTermMonths: 12,
    defaultRepaymentFrequency: 'Monthly',
    processingFeePercentage: 1.0,
    latePenaltyRate: 1.5,
    earlySettlementRebateRate: 15.0,
    requiresCollateral: true,
    requiresGuarantor: true,
    description: 'Seasonal crop production financing for rice, vegetable, poultry, and fishery cooperative members.',
    badgeColor: 'amber',
  },
  {
    id: 'prod-emergency',
    code: 'LP-EMERGENCY',
    name: 'Emergency & Calamity Assistance Loan',
    category: 'Emergency / Medical',
    interestRate: 6.0,
    interestType: 'Reducing Balance',
    minAmount: 3000,
    maxAmount: 50000,
    minTermMonths: 3,
    maxTermMonths: 12,
    defaultRepaymentFrequency: 'Weekly',
    processingFeePercentage: 0.5,
    latePenaltyRate: 1.0,
    earlySettlementRebateRate: 30.0,
    requiresCollateral: false,
    requiresGuarantor: false,
    description: 'Rapid disbursement facility for medical emergencies, tuition fees, and calamity relief.',
    badgeColor: 'rose',
  },
];

// All entity collections below are intentionally EMPTY. Real member, loan,
// savings, and financial data is created exclusively through database
// transactions (registration, deposits, repayments, etc.).

export const INITIAL_BORROWERS: Borrower[] = [];
export const INITIAL_MEMBERSHIP_APPLICATIONS: MembershipApplication[] = [];
export const INITIAL_UPDATE_REQUESTS: MemberUpdateRequest[] = [];
export const INITIAL_FOLLOW_UP_LOGS: MemberFollowUpLog[] = [];
export const INITIAL_SAVINGS_ACCOUNTS: SavingsAccount[] = [];
export const INITIAL_SAVINGS_TRANSACTIONS: SavingsTransaction[] = [];
export const INITIAL_WITHDRAWAL_REQUESTS: SavingsWithdrawalRequest[] = [];
export const INITIAL_INTEREST_LOGS: InterestCreditLog[] = [];
export const INITIAL_LOANS: Loan[] = [];
export const INITIAL_PAYMENTS: PaymentRecord[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];
export const INITIAL_SOLIDARITY_GROUPS: SolidarityGroup[] = [];
export const INITIAL_GROUP_LOANS: GroupLoan[] = [];
export const INITIAL_GROUP_MEETING_LOGS: GroupMeetingLog[] = [];
export const INITIAL_FINANCIAL_TRANSACTIONS: FinancialTransaction[] = [];
export const INITIAL_FINANCIAL_ACCOUNTS: FinancialAccount[] = [];
export const INITIAL_FINANCIAL_SUPPLIERS: FinancialSupplier[] = [];
export const INITIAL_FINANCIAL_SUPPLIER_BILLS: FinancialSupplierBill[] = [];
export const INITIAL_FINANCIAL_BILL_PAYMENTS: FinancialBillPayment[] = [];
export const INITIAL_FINANCIAL_BUDGETS: FinancialBudget[] = [];
export const INITIAL_FINANCIAL_TAX_RECORDS: FinancialTaxRecord[] = [];
export const INITIAL_FINANCIAL_JOURNAL_ENTRIES: FinancialJournalEntry[] = [];
export const INITIAL_FINANCIAL_CASH_TRANSACTIONS: FinancialCashTransaction[] = [];
export const INITIAL_FINANCIAL_MONTHLY_CASH_FLOW: FinancialMonthlyCashFlow[] = [];
export const INITIAL_FINANCIAL_MONTHLY_DISBURSEMENTS: FinancialMonthlyDisbursement[] = [];
export const INITIAL_FINANCIAL_MONTHLY_COLLECTIONS: FinancialMonthlyCollection[] = [];
export const INITIAL_OVERSIGHT_SNAPSHOTS: OversightLoanPortfolioSnapshot[] = [];
export const INITIAL_OVERSIGHT_COLLECTION_MONITORING: OversightCollectionMonitoring[] = [];
export const INITIAL_OVERSIGHT_DISBURSEMENT_TRACKER: OversightDisbursementTracker[] = [];
export const INITIAL_OVERSIGHT_AUDIT_ENGAGEMENTS: OversightAuditEngagement[] = [];
export const INITIAL_OVERSIGHT_AUDIT_FINDINGS: OversightAuditFinding[] = [];
export const INITIAL_OVERSIGHT_CORRECTIVE_ACTIONS: OversightCorrectiveAction[] = [];
export const INITIAL_OVERSIGHT_COMPLIANCE_REQUIREMENTS: OversightComplianceRequirement[] = [];
export const INITIAL_OVERSIGHT_COMPLIANCE_REVIEWS: OversightComplianceReview[] = [];
export const INITIAL_OVERSIGHT_CONTROL_EXCEPTIONS: OversightControlException[] = [];
export const INITIAL_OVERSIGHT_REPORTS: OversightReport[] = [];
export const INITIAL_OVERSIGHT_METRICS: OversightDashboardMetric[] = [];
export const INITIAL_OVERSIGHT_SETTINGS: OversightSystemSettings = {} as OversightSystemSettings;