// HOSCOMO Microfinance Cooperative - Admin Mock Data
// Tacloban, Leyte, Philippines

export const COOP_INFO = {
  name: 'HOSCOMO Microfinance Cooperative',
  shortName: 'HOSCOMO',
  address: 'Magallanes Street, Tacloban City, Leyte 6500, Philippines',
  phone: '+63 (053) 321-8765',
  email: 'admin@hoscomo.coop',
  website: 'www.hoscomo.coop',
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

export const MOCK_USERS: AdminUser[] = [
  { id: 'USR-001', fullName: 'Elena Rostata', email: 'elena.rostata@hoscomo.coop', phone: '+63 917 123 4567', role: 'Administrator', status: 'Active', dateRegistered: '2023-01-15', avatar: 'https://i.pravatar.cc/150?u=usr001', branch: 'All Branches' },
  { id: 'USR-002', fullName: 'Roberto Villanueva', email: 'roberto.v@hoscomo.coop', phone: '+63 918 234 5678', role: 'Manager', status: 'Active', dateRegistered: '2023-03-22', avatar: 'https://i.pravatar.cc/150?u=usr002', branch: 'Tacloban Main' },
  { id: 'USR-003', fullName: 'Maria Santos', email: 'maria.santos@hoscomo.coop', phone: '+63 919 345 6789', role: 'Loan Officer', status: 'Active', dateRegistered: '2023-06-10', avatar: 'https://i.pravatar.cc/150?u=usr003', branch: 'Tacloban Main' },
  { id: 'USR-004', fullName: 'Juan Dela Cruz', email: 'juan.delacruz@hoscomo.coop', phone: '+63 920 456 7890', role: 'Teller', status: 'Active', dateRegistered: '2023-08-05', avatar: 'https://i.pravatar.cc/150?u=usr004', branch: 'Palo Branch' },
  { id: 'USR-005', fullName: 'Ana Reyes', email: 'ana.reyes@hoscomo.coop', phone: '+63 921 567 8901', role: 'Client Services Staff', status: 'Active', dateRegistered: '2024-01-20', avatar: 'https://i.pravatar.cc/150?u=usr005', branch: 'Tacloban Main' },
  { id: 'USR-006', fullName: 'Pedro Mendoza', email: 'pedro.mendoza@hoscomo.coop', phone: '+63 922 678 9012', role: 'Bookkeeper', status: 'Active', dateRegistered: '2024-02-14', avatar: 'https://i.pravatar.cc/150?u=usr006', branch: 'Tacloban Main' },
  { id: 'USR-007', fullName: 'Liza Garcia', email: 'liza.garcia@hoscomo.coop', phone: '+63 923 789 0123', role: 'Loan Officer', status: 'Inactive', dateRegistered: '2024-04-01', avatar: 'https://i.pravatar.cc/150?u=usr007', branch: 'Palo Branch' },
  { id: 'USR-008', fullName: 'Carlos Tan', email: 'carlos.tan@hoscomo.coop', phone: '+63 924 890 1234', role: 'Auditor', status: 'Active', dateRegistered: '2024-05-18', avatar: 'https://i.pravatar.cc/150?u=usr008', branch: 'All Branches' },
  { id: 'USR-009', fullName: 'Grace Bautista', email: 'grace.b@hoscomo.coop', phone: '+63 925 901 2345', role: 'Teller', status: 'Pending', dateRegistered: '2025-08-10', avatar: 'https://i.pravatar.cc/150?u=usr009', branch: 'Dulag Branch' },
  { id: 'USR-010', fullName: 'Ricardo Lim', email: 'ricardo.lim@hoscomo.coop', phone: '+63 926 012 3456', role: 'Manager', status: 'Suspended', dateRegistered: '2024-07-22', avatar: 'https://i.pravatar.cc/150?u=usr010', branch: 'Palo Branch' },
];

export const MOCK_CLIENTS: AdminClient[] = [
  { id: 'CLT-001', clientId: 'HCM-2024-0001', fullName: 'Teresa Alcantara', phone: '+63 917 111 2222', email: 'teresa.alcantara@email.com', address: 'Barangay San Jose, Tacloban City, Leyte', occupation: 'Sari-Sari Store Owner', monthlyIncome: 25000, employmentInfo: 'Self-Employed - Sari-Sari Store', registrationDate: '2024-01-10', status: 'Active', branch: 'Tacloban Main', kycStatus: 'Verified', avatar: 'https://i.pravatar.cc/150?u=clt001', savingsBalance: 15200, activeLoans: 1, totalBorrowed: 50000 },
  { id: 'CLT-002', clientId: 'HCM-2024-0002', fullName: 'Fernando Aquino', phone: '+63 918 222 3333', email: 'fernando.a@email.com', address: 'Barangay Sagkahan, Tacloban City, Leyte', occupation: 'Tricycle Driver', monthlyIncome: 18000, employmentInfo: 'Self-Employed - Tricycle Operator', registrationDate: '2024-02-15', status: 'Active', branch: 'Tacloban Main', kycStatus: 'Verified', avatar: 'https://i.pravatar.cc/150?u=clt002', savingsBalance: 8500, activeLoans: 1, totalBorrowed: 30000 },
  { id: 'CLT-003', clientId: 'HCM-2024-0003', fullName: 'Rosario Dizon', phone: '+63 919 333 4444', email: 'rosario.d@email.com', address: 'Barangay San Jose, Palo, Leyte', occupation: 'Public School Teacher', monthlyIncome: 35000, employmentInfo: 'Employed - Dept. of Education', registrationDate: '2024-03-20', status: 'Active', branch: 'Palo Branch', kycStatus: 'Verified', avatar: 'https://i.pravatar.cc/150?u=clt003', savingsBalance: 32000, activeLoans: 0, totalBorrowed: 75000 },
  { id: 'CLT-004', clientId: 'HCM-2024-0004', fullName: 'Miguel Ramos', phone: '+63 920 444 5555', email: 'miguel.r@email.com', address: 'Barangay Puricao, Dulag, Leyte', occupation: 'Fisherman', monthlyIncome: 15000, employmentInfo: 'Self-Employed - Fishing', registrationDate: '2024-04-05', status: 'Pending', branch: 'Dulag Branch', kycStatus: 'Pending', avatar: 'https://i.pravatar.cc/150?u=clt004', savingsBalance: 3000, activeLoans: 0, totalBorrowed: 0 },
  { id: 'CLT-005', clientId: 'HCM-2024-0005', fullName: 'Carmen Lopez', phone: '+63 921 555 6666', email: 'carmen.l@email.com', address: 'Barangay San Jose, Tacloban City, Leyte', occupation: 'Market Vendor', monthlyIncome: 20000, employmentInfo: 'Self-Employed - Wet Market Vendor', registrationDate: '2024-05-12', status: 'Active', branch: 'Tacloban Main', kycStatus: 'Verified', avatar: 'https://i.pravatar.cc/150?u=clt005', savingsBalance: 12800, activeLoans: 1, totalBorrowed: 40000 },
  { id: 'CLT-006', clientId: 'HCM-2024-0006', fullName: 'Antonio Cruz', phone: '+63 922 666 7777', email: 'antonio.c@email.com', address: 'Barangay Hall, Palo, Leyte', occupation: 'Construction Worker', monthlyIncome: 22000, employmentInfo: 'Contractor - Building Construction', registrationDate: '2024-06-18', status: 'Active', branch: 'Palo Branch', kycStatus: 'Verified', avatar: 'https://i.pravatar.cc/150?u=clt006', savingsBalance: 9700, activeLoans: 1, totalBorrowed: 25000 },
  { id: 'CLT-007', clientId: 'HCM-2024-0007', fullName: 'Patricia Soriano', phone: '+63 923 777 8888', email: 'patricia.s@email.com', address: 'Barangay Magallanes, Tacloban City, Leyte', occupation: 'Seamstress', monthlyIncome: 16000, employmentInfo: 'Self-Employed - Garment Shop', registrationDate: '2024-07-25', status: 'Inactive', branch: 'Tacloban Main', kycStatus: 'Verified', avatar: 'https://i.pravatar.cc/150?u=clt007', savingsBalance: 5200, activeLoans: 0, totalBorrowed: 20000 },
  { id: 'CLT-008', clientId: 'HCM-2024-0008', fullName: 'Eduardo Navarro', phone: '+63 924 888 9999', email: 'eduardo.n@email.com', address: 'Barangay San Jose, Dulag, Leyte', occupation: 'Farmer', monthlyIncome: 12000, employmentInfo: 'Self-Employed - Rice Farmer', registrationDate: '2024-08-30', status: 'Active', branch: 'Dulag Branch', kycStatus: 'Under Review', avatar: 'https://i.pravatar.cc/150?u=clt008', savingsBalance: 6800, activeLoans: 1, totalBorrowed: 35000 },
  { id: 'CLT-009', clientId: 'HCM-2025-0009', fullName: 'Isabelle Fernandez', phone: '+63 925 999 0000', email: 'isabelle.f@email.com', address: 'Barangay Abucay, Tacloban City, Leyte', occupation: 'OFW (Saudi Arabia)', monthlyIncome: 50000, employmentInfo: 'Overseas Filipino Worker - Nurse', registrationDate: '2025-01-05', status: 'Active', branch: 'Tacloban Main', kycStatus: 'Verified', avatar: 'https://i.pravatar.cc/150?u=clt009', savingsBalance: 85000, activeLoans: 0, totalBorrowed: 100000 },
  { id: 'CLT-010', clientId: 'HCM-2025-0010', fullName: 'Ricardo Guevarra', phone: '+63 926 000 1111', email: 'ricardo.g@email.com', address: 'Barangay San Jose, Palo, Leyte', occupation: 'Sari-Sari Store Owner', monthlyIncome: 20000, employmentInfo: 'Self-Employed', registrationDate: '2025-02-14', status: 'Suspended', branch: 'Palo Branch', kycStatus: 'Verified', avatar: 'https://i.pravatar.cc/150?u=clt010', savingsBalance: 2100, activeLoans: 0, totalBorrowed: 15000 },
];

export const MOCK_KYC_REQUESTS: KycRequest[] = [
  { id: 'KYC-001', clientId: 'HCM-2024-0004', clientName: 'Miguel Ramos', submissionDate: '2025-08-20', status: 'Pending', assignedStaff: 'Ana Reyes', documents: '5 of 6 uploaded', idType: 'Philippine National ID' },
  { id: 'KYC-002', clientId: 'HCM-2024-0008', clientName: 'Eduardo Navarro', submissionDate: '2025-08-25', status: 'Under Review', assignedStaff: 'Ana Reyes', documents: '6 of 6 uploaded', idType: "Driver's License" },
  { id: 'KYC-003', clientId: 'HCM-2025-0011', clientName: 'Sofia Mendoza', submissionDate: '2025-09-01', status: 'Pending', assignedStaff: 'Maria Santos', documents: '3 of 6 uploaded', idType: 'Philippine National ID' },
  { id: 'KYC-004', clientId: 'HCM-2025-0012', clientName: 'Ramon Villanueva', submissionDate: '2025-09-05', status: 'Requires Correction', assignedStaff: 'Ana Reyes', documents: '6 of 6 uploaded', idType: 'Passport' },
  { id: 'KYC-005', clientId: 'HCM-2025-0013', clientName: 'Lourdes Palencia', submissionDate: '2025-09-08', status: 'Approved', assignedStaff: 'Maria Santos', documents: '6 of 6 uploaded', idType: "Driver's License" },
  { id: 'KYC-006', clientId: 'HCM-2025-0014', clientName: 'Victor Sy', submissionDate: '2025-09-10', status: 'Rejected', assignedStaff: 'Ana Reyes', documents: '4 of 6 uploaded', idType: 'Philippine National ID' },
  { id: 'KYC-007', clientId: 'HCM-2025-0015', clientName: 'Angela Torres', submissionDate: '2025-09-12', status: 'Pending', assignedStaff: 'Maria Santos', documents: '6 of 6 uploaded', idType: 'SSS ID' },
  { id: 'KYC-008', clientId: 'HCM-2025-0016', clientName: 'Daniel Pascua', submissionDate: '2025-09-14', status: 'Under Review', assignedStaff: 'Ana Reyes', documents: '6 of 6 uploaded', idType: 'Philippine National ID' },
];

export const MOCK_LOANS: AdminLoan[] = [
  { id: 'LN-001', loanId: 'LN-2025-0042', clientName: 'Teresa Alcantara', clientId: 'HCM-2024-0001', loanProduct: 'Regular Microloan', loanAmount: 50000, loanTerm: 12, interestRate: 2.5, paymentFrequency: 'Monthly', applicationDate: '2025-06-15', status: 'Active', outstandingBalance: 32500, monthlyPayment: 4688, branch: 'Tacloban Main' },
  { id: 'LN-002', loanId: 'LN-2025-0043', clientName: 'Fernando Aquino', clientId: 'HCM-2024-0002', loanProduct: 'Livelihood Loan', loanAmount: 30000, loanTerm: 6, interestRate: 2.0, paymentFrequency: 'Monthly', applicationDate: '2025-07-01', status: 'Active', outstandingBalance: 18000, monthlyPayment: 5200, branch: 'Tacloban Main' },
  { id: 'LN-003', loanId: 'LN-2025-0044', clientName: 'Carmen Lopez', clientId: 'HCM-2024-0005', loanProduct: 'Regular Microloan', loanAmount: 40000, loanTerm: 10, interestRate: 2.5, paymentFrequency: 'Monthly', applicationDate: '2025-07-15', status: 'Active', outstandingBalance: 28000, monthlyPayment: 4250, branch: 'Tacloban Main' },
  { id: 'LN-004', loanId: 'LN-2025-0045', clientName: 'Antonio Cruz', clientId: 'HCM-2024-0006', loanProduct: 'Emergency Loan', loanAmount: 25000, loanTerm: 6, interestRate: 1.5, paymentFrequency: 'Monthly', applicationDate: '2025-08-01', status: 'Pending', outstandingBalance: 25000, monthlyPayment: 4375, branch: 'Palo Branch' },
  { id: 'LN-005', loanId: 'LN-2025-0046', clientName: 'Eduardo Navarro', clientId: 'HCM-2024-0008', loanProduct: 'Agricultural Loan', loanAmount: 35000, loanTerm: 12, interestRate: 2.0, paymentFrequency: 'Monthly', applicationDate: '2025-08-10', status: 'Approved', outstandingBalance: 35000, monthlyPayment: 3167, branch: 'Dulag Branch' },
  { id: 'LN-006', loanId: 'LN-2025-0047', clientName: 'Sofia Mendoza', clientId: 'HCM-2025-0011', loanProduct: 'Regular Microloan', loanAmount: 60000, loanTerm: 12, interestRate: 2.5, paymentFrequency: 'Monthly', applicationDate: '2025-09-01', status: 'Pending', outstandingBalance: 60000, monthlyPayment: 5375, branch: 'Tacloban Main' },
  { id: 'LN-007', loanId: 'LN-2025-0048', clientName: 'Ramon Villanueva', clientId: 'HCM-2025-0012', loanProduct: 'Business Loan', loanAmount: 80000, loanTerm: 18, interestRate: 2.0, paymentFrequency: 'Monthly', applicationDate: '2025-09-05', status: 'Under Review', outstandingBalance: 80000, monthlyPayment: 4889, branch: 'Palo Branch' },
  { id: 'LN-008', loanId: 'LN-2025-0049', clientName: 'Patricia Soriano', clientId: 'HCM-2024-0007', loanProduct: 'Livelihood Loan', loanAmount: 20000, loanTerm: 6, interestRate: 2.0, paymentFrequency: 'Monthly', applicationDate: '2025-03-10', status: 'Completed', outstandingBalance: 0, monthlyPayment: 3467, branch: 'Tacloban Main' },
  { id: 'LN-009', loanId: 'LN-2025-0050', clientName: 'Isabelle Fernandez', clientId: 'HCM-2025-0009', loanProduct: 'Regular Microloan', loanAmount: 100000, loanTerm: 24, interestRate: 2.0, paymentFrequency: 'Monthly', applicationDate: '2025-02-20', status: 'Active', outstandingBalance: 62500, monthlyPayment: 4583, branch: 'Tacloban Main' },
  { id: 'LN-010', loanId: 'LN-2025-0051', clientName: 'Ricardo Guevarra', clientId: 'HCM-2025-0010', loanProduct: 'Emergency Loan', loanAmount: 15000, loanTerm: 3, interestRate: 1.5, paymentFrequency: 'Monthly', applicationDate: '2025-06-01', status: 'Rejected', outstandingBalance: 0, monthlyPayment: 5150, branch: 'Palo Branch' },
];

export const MOCK_SAVINGS_ACCOUNTS: AdminSavingsAccount[] = [
  { id: 'SAV-001', accountNumber: 'SAV-2024-0001', clientName: 'Teresa Alcantara', clientId: 'HCM-2024-0001', accountType: 'Regular Savings', balance: 15200, status: 'Active', openedDate: '2024-01-10', lastTransaction: '2025-09-10', branch: 'Tacloban Main' },
  { id: 'SAV-002', accountNumber: 'SAV-2024-0002', clientName: 'Fernando Aquino', clientId: 'HCM-2024-0002', accountType: 'Capital Build-up', balance: 8500, status: 'Active', openedDate: '2024-02-15', lastTransaction: '2025-09-08', branch: 'Tacloban Main' },
  { id: 'SAV-003', accountNumber: 'SAV-2024-0003', clientName: 'Rosario Dizon', clientId: 'HCM-2024-0003', accountType: 'Regular Savings', balance: 32000, status: 'Active', openedDate: '2024-03-20', lastTransaction: '2025-09-12', branch: 'Palo Branch' },
  { id: 'SAV-004', accountNumber: 'SAV-2024-0004', clientName: 'Miguel Ramos', clientId: 'HCM-2024-0004', accountType: 'Regular Savings', balance: 3000, status: 'Active', openedDate: '2024-04-05', lastTransaction: '2025-08-15', branch: 'Dulag Branch' },
  { id: 'SAV-005', accountNumber: 'SAV-2024-0005', clientName: 'Carmen Lopez', clientId: 'HCM-2024-0005', accountType: 'Time Deposit', balance: 12800, status: 'Active', openedDate: '2024-05-12', lastTransaction: '2025-09-01', branch: 'Tacloban Main' },
  { id: 'SAV-006', accountNumber: 'SAV-2024-0006', clientName: 'Antonio Cruz', clientId: 'HCM-2024-0006', accountType: 'Regular Savings', balance: 9700, status: 'Active', openedDate: '2024-06-18', lastTransaction: '2025-09-05', branch: 'Palo Branch' },
  { id: 'SAV-007', accountNumber: 'SAV-2024-0007', clientName: 'Patricia Soriano', clientId: 'HCM-2024-0007', accountType: 'Regular Savings', balance: 5200, status: 'Dormant', openedDate: '2024-07-25', lastTransaction: '2025-04-20', branch: 'Tacloban Main' },
  { id: 'SAV-008', accountNumber: 'SAV-2025-0008', clientName: 'Isabelle Fernandez', clientId: 'HCM-2025-0009', accountType: 'Time Deposit', balance: 85000, status: 'Active', openedDate: '2025-01-05', lastTransaction: '2025-09-14', branch: 'Tacloban Main' },
  { id: 'SAV-009', accountNumber: 'SAV-2025-0009', clientName: 'Ricardo Guevarra', clientId: 'HCM-2025-0010', accountType: 'Regular Savings', balance: 2100, status: 'Suspended', openedDate: '2025-02-14', lastTransaction: '2025-06-10', branch: 'Palo Branch' },
  { id: 'SAV-010', accountNumber: 'SAV-2024-0010', clientName: 'Eduardo Navarro', clientId: 'HCM-2024-0008', accountType: 'Regular Savings', balance: 6800, status: 'Active', openedDate: '2024-08-30', lastTransaction: '2025-09-07', branch: 'Dulag Branch' },
];

export const MOCK_TRANSACTIONS: AdminTransaction[] = [
  { id: 'TXN-001', transactionId: 'TXN-2025-0912-001', clientName: 'Teresa Alcantara', clientId: 'HCM-2024-0001', type: 'Loan Payment', amount: 4688, paymentMethod: 'Cash', dateTime: '2025-09-12 09:30:00', processedBy: 'Juan Dela Cruz (Teller)', status: 'Completed', referenceNumber: 'OR-2025-1847', branch: 'Tacloban Main' },
  { id: 'TXN-002', transactionId: 'TXN-2025-0912-002', clientName: 'Fernando Aquino', clientId: 'HCM-2024-0002', type: 'Savings Deposit', amount: 2000, paymentMethod: 'GCash', dateTime: '2025-09-12 10:15:00', processedBy: 'Grace Bautista (Teller)', status: 'Completed', referenceNumber: 'GC-8723451', branch: 'Tacloban Main' },
  { id: 'TXN-003', transactionId: 'TXN-2025-0912-003', clientName: 'Rosario Dizon', clientId: 'HCM-2024-0003', type: 'Savings Withdrawal', amount: 5000, paymentMethod: 'Cash', dateTime: '2025-09-12 11:00:00', processedBy: 'Juan Dela Cruz (Teller)', status: 'Completed', referenceNumber: 'OR-2025-1848', branch: 'Palo Branch' },
  { id: 'TXN-004', transactionId: 'TXN-2025-0912-004', clientName: 'Carmen Lopez', clientId: 'HCM-2024-0005', type: 'Loan Payment', amount: 4250, paymentMethod: 'Bank Transfer', dateTime: '2025-09-12 14:20:00', processedBy: 'Juan Dela Cruz (Teller)', status: 'Completed', referenceNumber: 'BT-20250912-441', branch: 'Tacloban Main' },
  { id: 'TXN-005', transactionId: 'TXN-2025-0911-001', clientName: 'Isabelle Fernandez', clientId: 'HCM-2025-0009', type: 'Savings Deposit', amount: 10000, paymentMethod: 'GCash', dateTime: '2025-09-11 08:45:00', processedBy: 'Grace Bautista (Teller)', status: 'Completed', referenceNumber: 'GC-8730192', branch: 'Tacloban Main' },
  { id: 'TXN-006', transactionId: 'TXN-2025-0911-002', clientName: 'Eduardo Navarro', clientId: 'HCM-2024-0008', type: 'Loan Disbursement', amount: 35000, paymentMethod: 'Cash', dateTime: '2025-09-11 15:00:00', processedBy: 'Roberto Villanueva (Manager)', status: 'Completed', referenceNumber: 'VD-2025-0089', branch: 'Dulag Branch' },
  { id: 'TXN-007', transactionId: 'TXN-2025-0911-003', clientName: 'Antonio Cruz', clientId: 'HCM-2024-0006', type: 'Deposit', amount: 3000, paymentMethod: 'Cash', dateTime: '2025-09-11 16:30:00', processedBy: 'Juan Dela Cruz (Teller)', status: 'Pending', referenceNumber: 'OR-2025-1849', branch: 'Palo Branch' },
  { id: 'TXN-008', transactionId: 'TXN-2025-0910-001', clientName: 'Teresa Alcantara', clientId: 'HCM-2024-0001', type: 'Savings Deposit', amount: 5000, paymentMethod: 'Cash', dateTime: '2025-09-10 09:00:00', processedBy: 'Juan Dela Cruz (Teller)', status: 'Completed', referenceNumber: 'OR-2025-1840', branch: 'Tacloban Main' },
  { id: 'TXN-009', transactionId: 'TXN-2025-0910-002', clientName: 'Fernando Aquino', clientId: 'HCM-2024-0002', type: 'Loan Payment', amount: 5200, paymentMethod: 'GCash', dateTime: '2025-09-10 13:45:00', processedBy: 'Grace Bautista (Teller)', status: 'Completed', referenceNumber: 'GC-8718234', branch: 'Tacloban Main' },
  { id: 'TXN-010', transactionId: 'TXN-2025-0910-003', clientName: 'Carmen Lopez', clientId: 'HCM-2024-0005', type: 'Withdrawal', amount: 2000, paymentMethod: 'Cash', dateTime: '2025-09-10 15:15:00', processedBy: 'Juan Dela Cruz (Teller)', status: 'Failed', referenceNumber: 'N/A', branch: 'Tacloban Main' },
];

export const MOCK_LENDING_GROUPS: LendingGroup[] = [
  { id: 'GRP-001', groupId: 'GRP-2024-001', groupName: 'Tigbao Women\'s Solidarity Group', leader: 'Teresa Alcantara', memberCount: 15, status: 'Active', totalGroupLoan: 525000, branch: 'Tacloban Main', formedDate: '2024-02-01', meetingDay: 'Tuesday', repaymentRate: 94 },
  { id: 'GRP-002', groupId: 'GRP-2024-002', groupName: 'San Jose Farmers Association', leader: 'Eduardo Navarro', memberCount: 20, status: 'Active', totalGroupLoan: 700000, branch: 'Dulag Branch', formedDate: '2024-03-15', meetingDay: 'Wednesday', repaymentRate: 88 },
  { id: 'GRP-003', groupId: 'GRP-2024-003', groupName: 'Palo Entrepreneurs Circle', leader: 'Antonio Cruz', memberCount: 12, status: 'Active', totalGroupLoan: 360000, branch: 'Palo Branch', formedDate: '2024-05-20', meetingDay: 'Monday', repaymentRate: 96 },
  { id: 'GRP-004', groupId: 'GRP-2025-004', groupName: 'Tacloban Market Vendors Group', leader: 'Carmen Lopez', memberCount: 18, status: 'Pending', totalGroupLoan: 0, branch: 'Tacloban Main', formedDate: '2025-08-10', meetingDay: 'Thursday', repaymentRate: 0 },
  { id: 'GRP-005', groupId: 'GRP-2024-005', groupName: 'Dulag Fishing Cooperative', leader: 'Miguel Ramos', memberCount: 10, status: 'Inactive', totalGroupLoan: 200000, branch: 'Dulag Branch', formedDate: '2024-07-01', meetingDay: 'Friday', repaymentRate: 72 },
];

export const MOCK_BRANCHES: AdminBranch[] = [
  { id: 'BR-001', branchCode: 'HCM-TB', branchName: 'Tacloban Main Branch', address: 'Magallanes St., Tacloban City, Leyte 6500', branchManager: 'Roberto Villanueva', staffCount: 12, status: 'Active', phone: '+63 (053) 321-8765', totalClients: 485, totalLoans: 12400000, totalSavings: 3200000 },
  { id: 'BR-002', branchCode: 'HCM-PL', branchName: 'Palo Branch', address: 'San Jose St., Palo, Leyte 6501', branchManager: 'Corazon Reyes', staffCount: 8, status: 'Active', phone: '+63 (053) 321-5432', totalClients: 312, totalLoans: 8500000, totalSavings: 2100000 },
  { id: 'BR-003', branchCode: 'HCM-DL', branchName: 'Dulag Branch', address: 'National Highway, Dulag, Leyte 6516', branchManager: 'Ricardo Lim', staffCount: 6, status: 'Active', phone: '+63 (053) 321-9876', totalClients: 198, totalLoans: 5200000, totalSavings: 1400000 },
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: 'AL-001', userName: 'Elena Rostata', userRole: 'Administrator', action: 'Approved KYC Verification', module: 'KYC Verification', dateTime: '2025-09-15 08:30:00', ipAddress: '192.168.1.100', status: 'Success' },
  { id: 'AL-002', userName: 'Maria Santos', userRole: 'Loan Officer', action: 'Created Loan Application LN-2025-0050', module: 'Loan Management', dateTime: '2025-09-15 09:15:00', ipAddress: '192.168.1.105', status: 'Success' },
  { id: 'AL-003', userName: 'Juan Dela Cruz', userRole: 'Teller', action: 'Processed Loan Payment OR-2025-1847', module: 'Financial Transactions', dateTime: '2025-09-15 09:30:00', ipAddress: '192.168.1.110', status: 'Success' },
  { id: 'AL-004', userName: 'Elena Rostata', userRole: 'Administrator', action: 'Updated User Role - Ricardo Lim to Manager', module: 'User Management', dateTime: '2025-09-15 10:00:00', ipAddress: '192.168.1.100', status: 'Success' },
  { id: 'AL-005', userName: 'Roberto Villanueva', userRole: 'Manager', action: 'Approved Loan Application LN-2025-0046', module: 'Loan Management', dateTime: '2025-09-14 14:30:00', ipAddress: '192.168.1.102', status: 'Success' },
  { id: 'AL-006', userName: 'Ana Reyes', userRole: 'Client Services Staff', action: 'Registered New Client HCM-2025-0015', module: 'Client Management', dateTime: '2025-09-14 11:00:00', ipAddress: '192.168.1.108', status: 'Success' },
  { id: 'AL-007', userName: 'Grace Bautista', userRole: 'Teller', action: 'Processed Savings Deposit GC-8730192', module: 'Financial Transactions', dateTime: '2025-09-14 10:45:00', ipAddress: '192.168.1.112', status: 'Success' },
  { id: 'AL-008', userName: 'Elena Rostata', userRole: 'Administrator', action: 'Rejected Loan Application LN-2025-0051', module: 'Loan Management', dateTime: '2025-09-13 16:00:00', ipAddress: '192.168.1.100', status: 'Success' },
  { id: 'AL-009', userName: 'Pedro Mendoza', userRole: 'Bookkeeper', action: 'Generated Monthly Financial Report', module: 'Reports & Analytics', dateTime: '2025-09-13 15:00:00', ipAddress: '192.168.1.106', status: 'Success' },
  { id: 'AL-010', userName: 'Unknown', userRole: 'System', action: 'Failed Login Attempt - Invalid Password', module: 'Security', dateTime: '2025-09-13 03:22:00', ipAddress: '203.177.xx.xx', status: 'Failed' },
  { id: 'AL-011', userName: 'Elena Rostata', userRole: 'Administrator', action: 'Updated System Settings - Interest Rate Cap', module: 'System Settings', dateTime: '2025-09-12 14:00:00', ipAddress: '192.168.1.100', status: 'Success' },
  { id: 'AL-012', userName: 'Maria Santos', userRole: 'Loan Officer', action: 'KYC Correction Requested for Ramon Villanueva', module: 'KYC Verification', dateTime: '2025-09-12 11:30:00', ipAddress: '192.168.1.105', status: 'Warning' },
];

export const MOCK_NOTIFICATIONS: AdminNotification[] = [
  { id: 'NTF-001', title: 'New KYC Submission', message: 'Sofia Mendoza submitted KYC documents for verification.', timestamp: '2025-09-15 08:00:00', type: 'KYC', isRead: false },
  { id: 'NTF-002', title: 'New Loan Application', message: 'Sofia Mendoza applied for a Regular Microloan of P60,000.', timestamp: '2025-09-15 07:45:00', type: 'Loan', isRead: false },
  { id: 'NTF-003', title: 'Client Registration', message: 'New client Daniel Pascua completed registration at Dulag Branch.', timestamp: '2025-09-14 16:30:00', type: 'Client', isRead: false },
  { id: 'NTF-004', title: 'Large Transaction Alert', message: 'Loan disbursement of P35,000 processed for Eduardo Navarro.', timestamp: '2025-09-14 15:00:00', type: 'Transaction', isRead: false },
  { id: 'NTF-005', title: 'System Maintenance', message: 'Scheduled system maintenance on September 20, 2025, from 2:00 AM to 4:00 AM.', timestamp: '2025-09-14 09:00:00', type: 'System', isRead: true },
  { id: 'NTF-006', title: 'KYC Verification Completed', message: 'Lourdes Palencia KYC has been approved and verified.', timestamp: '2025-09-13 14:30:00', type: 'KYC', isRead: true },
  { id: 'NTF-007', title: 'Loan Application Approved', message: 'Loan LN-2025-0046 for Eduardo Navarro has been approved by the manager.', timestamp: '2025-09-13 10:00:00', type: 'Loan', isRead: true },
  { id: 'NTF-008', title: 'Pending Withdrawal Requests', message: '3 savings withdrawal requests are pending manager approval.', timestamp: '2025-09-12 08:00:00', type: 'Transaction', isRead: true },
  { id: 'NTF-009', title: 'New Member Registration', message: 'Angela Torres submitted a membership application at Tacloban Main.', timestamp: '2025-09-11 15:00:00', type: 'Client', isRead: true },
  { id: 'NTF-010', title: 'Weekly Meeting Scheduled', message: 'Tigbao Women\'s Solidarity Group meeting scheduled for Tuesday, Sept 16.', timestamp: '2025-09-11 09:00:00', type: 'System', isRead: true },
];

export const LOAN_TREND_DATA = [
  { month: 'Apr', applications: 12, approved: 9 },
  { month: 'May', applications: 15, approved: 12 },
  { month: 'Jun', applications: 18, approved: 14 },
  { month: 'Jul', applications: 22, approved: 18 },
  { month: 'Aug', applications: 20, approved: 16 },
  { month: 'Sep', applications: 25, approved: 19 },
];

export const TRANSACTION_CHART_DATA = [
  { month: 'Apr', deposits: 185000, withdrawals: 42000, loanPayments: 210000 },
  { month: 'May', deposits: 210000, withdrawals: 38000, loanPayments: 235000 },
  { month: 'Jun', deposits: 195000, withdrawals: 55000, loanPayments: 248000 },
  { month: 'Jul', deposits: 240000, withdrawals: 48000, loanPayments: 262000 },
  { month: 'Aug', deposits: 225000, withdrawals: 51000, loanPayments: 275000 },
  { month: 'Sep', deposits: 268000, withdrawals: 45000, loanPayments: 290000 },
];

export const CLIENT_REGISTRATION_DATA = [
  { month: 'Apr', registrations: 28 },
  { month: 'May', registrations: 35 },
  { month: 'Jun', registrations: 42 },
  { month: 'Jul', registrations: 38 },
  { month: 'Aug', registrations: 45 },
  { month: 'Sep', registrations: 32 },
];

export const KYC_STATUS_DATA = [
  { name: 'Approved', value: 680, color: '#10b981' },
  { name: 'Pending', value: 45, color: '#f59e0b' },
  { name: 'Under Review', value: 22, color: '#3b82f6' },
  { name: 'Rejected', value: 12, color: '#ef4444' },
  { name: 'Correction Required', value: 8, color: '#8b5cf6' },
];

export const BRANCH_PERFORMANCE_DATA = [
  { name: 'Tacloban Main', clients: 485, loans: 12400000, savings: 3200000 },
  { name: 'Palo', clients: 312, loans: 8500000, savings: 2100000 },
  { name: 'Dulag', clients: 198, loans: 5200000, savings: 1400000 },
];

export function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}