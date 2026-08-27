export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'CLIENT' | 'STAFF';
  staffRole?: string | null;
  borrowerId?: string | null;
  phone?: string;
  avatar?: string;
}

export interface UserSession {
  token: string;
  user: User;
}

export interface ClientDashboardData {
  borrowerName: string;
  memberNumber: string;
  totalActiveLoan: number;
  remainingBalance: number;
  nextPayment: number;
  nextPaymentDueDate: string;
  loanStatus: string;
  activeLoansCount: number;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    date: string;
    referenceNumber: string;
    paymentMethod: string;
    status: string;
  }>;
}

export interface ClientProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  civilStatus: string;
  occupation: string;
  employer: string;
  monthlyIncome: number;
  avatar: string;
  memberNumber: string;
  membershipDate: string;
  kycStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  creditScore: number;
  creditTier: string;
}

export interface KycDocument {
  type: string;
  name: string;
  submitted: boolean;
  status: 'VERIFIED' | 'PENDING' | 'REJECTED';
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISBURSED';
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
  termMonths: number;
  monthlyInstallment: number;
  remainingBalance: number;
  paidAmount: number;
  status: 'ACTIVE' | 'COMPLETED' | 'PAID_OFF' | 'OVERDUE' | 'APPROVED';
  startDate: string;
  maturityDate: string;
  nextPaymentDate?: string;
  purpose: string;
}

export interface InstallmentScheduleItem {
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  principal: number;
  interest: number;
  remainingBalance: number;
  status: 'PAID' | 'DUE' | 'UPCOMING' | 'OVERDUE';
  paidDate?: string | null;
  receiptNumber?: string | null;
}

export interface PaymentItem {
  id: string;
  loanId: string;
  loanNumber: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  officialReceiptNumber?: string;
  status: string;
  notes?: string;
}

export interface MobileNotification {
  id: string;
  borrowerId: string;
  title: string;
  message: string;
  category: 'loan_update' | 'approval_rejection' | 'upcoming_payment' | 'overdue_payment' | 'payment_confirmation' | 'announcement';
  isRead: boolean;
  createdAt: string;
  meta?: any;
}
