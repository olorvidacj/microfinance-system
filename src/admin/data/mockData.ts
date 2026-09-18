// HOSCOMCO Microfinance Cooperative - Admin Mock Data
// Tacloban, Leyte, Philippines

export const COOP_INFO = {
  name: 'HOSCOMCO Microfinance Cooperative',
  shortName: 'HOSCOMCO',
  address: 'Magallanes Street, Tacloban City, Leyte 6500, Philippines',
  phone: '+63 (053) 321-8765',
  email: 'admin@HOSCOMCO.coop',
  website: 'www.HOSCOMCO.coop',
  registrationNumber: 'CDA-RO8-2019-0042',
  motto: 'Fair loans, secure savings, and member services for communities across Leyte.',
};

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'Administrator' | 'Manager' | 'Loan Officer' | 'Teller' | 'Client Services Staff' | 'Bookkeeper' | 'Auditor';
  status: 'Active' | 'Inactive' | 'Pending' | 'Suspended';
  dateRegistered: string;
  avatar: string;
  branch: string;
}

export interface AdminClient {
  id: string;
  clientId: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  occupation: string;
  monthlyIncome: number;
  employmentInfo: string;
  registrationDate: string;
  status: 'Pending' | 'Active' | 'Inactive' | 'Suspended' | 'Rejected' | 'Closed';
  branch: string;
  kycStatus: string;
  avatar: string;
  savingsBalance: number;
  activeLoans: number;
  totalBorrowed: number;
}

export interface KycRequest {
  id: string;
  clientId: string;
  clientName: string;
  submissionDate: string;
  status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Requires Correction';
  assignedStaff: string;
  documents: string;
  idType: string;
}

export interface AdminLoan {
  id: string;
  loanId: string;
  clientName: string;
  clientId: string;
  loanProduct: string;
  loanAmount: number;
  loanTerm: number;
  interestRate: number;
  paymentFrequency: string;
  applicationDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Active' | 'Completed' | 'Disbursed' | 'Under Review';
  outstandingBalance: number;
  monthlyPayment: number;
  branch: string;
  schedule?: any[];
  purpose?: string;
  releaseDate?: string;
  maturityDate?: string;
  loanOfficer?: string;
}

export interface AdminSavingsAccount {
  id: string;
  accountNumber: string;
  clientName: string;
  clientId: string;
  accountType: string;
  balance: number;
  status: 'Active' | 'Dormant' | 'Suspended' | 'Closed';
  openedDate: string;
  lastTransaction: string;
  branch: string;
  interestRate?: number;
}

export interface AdminTransaction {
  id: string;
  transactionId: string;
  clientName: string;
  clientId: string;
  type: 'Deposit' | 'Withdrawal' | 'Loan Payment' | 'Loan Disbursement' | 'Savings Deposit' | 'Savings Withdrawal';
  amount: number;
  paymentMethod: string;
  dateTime: string;
  processedBy: string;
  status: 'Completed' | 'Pending' | 'Failed' | 'Cancelled';
  referenceNumber: string;
  branch: string;
  notes?: string;
}

export interface LendingGroup {
  id: string;
  groupId: string;
  groupName: string;
  leader: string;
  memberCount: number;
  status: 'Active' | 'Pending' | 'Inactive' | 'Graduated';
  totalGroupLoan: number;
  branch: string;
  formedDate: string;
  meetingDay: string;
  repaymentRate: number;
  meetingTime?: string;
  meetingLocation?: string;
}

export interface AdminBranch {
  id: string;
  branchCode: string;
  branchName: string;
  address: string;
  branchManager: string;
  staffCount: number;
  status: 'Active' | 'Inactive' | 'Under Review';
  phone: string;
  totalClients: number;
  totalLoans: number;
  totalSavings: number;
}

export interface AuditLog {
  id: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  dateTime: string;
  ipAddress: string;
  status: 'Success' | 'Failed' | 'Warning';
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'KYC' | 'Client' | 'Loan' | 'Transaction' | 'System';
  isRead: boolean;
}

export const MOCK_USERS: AdminUser[] = [];

export const MOCK_CLIENTS: AdminClient[] = [];

export const MOCK_KYC_REQUESTS: KycRequest[] = [];

export const MOCK_LOANS: AdminLoan[] = [];

export const MOCK_SAVINGS_ACCOUNTS: AdminSavingsAccount[] = [];

export const MOCK_TRANSACTIONS: AdminTransaction[] = [];

export const MOCK_LENDING_GROUPS: LendingGroup[] = [];

export const MOCK_BRANCHES: AdminBranch[] = [];

export const MOCK_AUDIT_LOGS: AuditLog[] = [];

export const MOCK_NOTIFICATIONS: AdminNotification[] = [];

export const LOAN_TREND_DATA = [];

export const TRANSACTION_CHART_DATA = [];

export const CLIENT_REGISTRATION_DATA = [];

export const KYC_STATUS_DATA = [];

export const BRANCH_PERFORMANCE_DATA = [];

export function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}