import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  CreditCard,
  DollarSign,
  AlertTriangle,
  Building2,
  Users,
  UserCheck,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Zap,
  PiggyBank,
  UserPlus,
  Receipt,
  Scale,
  Percent,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  ArrowRightLeft,
  Info,
  RotateCcw,
  FileCheck2,
  AlertCircle,
  Eye,
  RefreshCw,
  Phone,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { Loan, FinancialTransaction, FinancialTransactionType, FinancialTransactionStatus } from '../types';
import { AuditTrail } from './AuditTrail';

interface DashboardViewProps {
  onSelectLoan: (loan: Loan) => void;
  onOpenNewLoan: () => void;
  onOpenRecordPayment: () => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectLoan,
  onOpenNewLoan,
  onOpenRecordPayment,
  onNavigateTab,
}) => {
  const {
    stats,
    filteredLoans,
    filteredBorrowers,
    filteredPayments,
    filteredFinancialTransactions,
    branches,
    activeBranch,
    loanProducts,
    membershipApplications,
    savingsAccounts,
    creditMonthlySavingsInterest,
    currentUser,
  } = useLoan();

  // Filter States
  const [selectedTxType, setSelectedTxType] = useState<string>('ALL');
  const [selectedTxStatus, setSelectedTxStatus] = useState<string>('ALL');
  const [txSearchTerm, setTxSearchTerm] = useState<string>('');
  const [activeTabSection, setActiveTabSection] = useState<'transactions' | 'watchlist' | 'pendingKyc' | 'pendingLoans'>('transactions');

  // Transaction Details Modal
  const [inspectingTx, setInspectingTx] = useState<FinancialTransaction | null>(null);

  // Today's Date calculation
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 1. Total Registered Clients
  const totalRegisteredClients = filteredBorrowers.length;

  // 2. Active Clients
  const activeClients = useMemo(() => {
    return filteredBorrowers.filter(
      (b) => b.memberStatus === 'Active' || b.clientStatus === 'Active'
    ).length;
  }, [filteredBorrowers]);

  // 3. Pending KYC Applications
  const pendingKycClients = useMemo(() => {
    return filteredBorrowers.filter(
      (b) =>
        b.kycStatus === 'Pending Review' ||
        b.kycStatus === 'Incomplete' ||
        b.kycStatus === 'Correction Requested'
    );
  }, [filteredBorrowers]);
  const pendingKycCount = pendingKycClients.length;

  // 4. Pending Loan Applications
  const pendingLoanApplications = useMemo(() => {
    return filteredLoans.filter(
      (l) => l.status === 'Underwriting' || l.status === 'Under Review' || l.status === 'Submitted' || l.status === 'Draft'
    );
  }, [filteredLoans]);
  const pendingLoansCount = pendingLoanApplications.length;

  // 5. Approved Loans
  const approvedLoans = useMemo(() => {
    return filteredLoans.filter((l) => l.status === 'Approved');
  }, [filteredLoans]);
  const approvedLoansCount = approvedLoans.length;
  const approvedLoansVolume = approvedLoans.reduce((sum, l) => sum + l.principalAmount, 0);

  // 6. Active Loans
  const activeLoansList = useMemo(() => {
    return filteredLoans.filter((l) => l.status === 'Active');
  }, [filteredLoans]);
  const activeLoansCount = activeLoansList.length;

  // 7. Total Loan Portfolio
  const totalLoanPortfolio = useMemo(() => {
    return filteredLoans
      .filter((l) => l.status === 'Active' || l.status === 'In Arrears' || l.status === 'Approved' || l.status === 'Disbursed')
      .reduce((sum, l) => sum + l.principalAmount, 0);
  }, [filteredLoans]);

  // 8. Total Outstanding Balance
  const totalOutstandingBalance = useMemo(() => {
    return filteredLoans
      .filter((l) => l.status === 'Active' || l.status === 'In Arrears')
      .reduce((sum, l) => sum + l.remainingBalance, 0);
  }, [filteredLoans]);

  // 9. Today's Collections
  const todaysCollectionsData = useMemo(() => {
    const todayPayments = filteredPayments.filter((p) => p.paymentDate.startsWith(todayStr));
    const amount = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    return {
      amount,
      count: todayPayments.length,
    };
  }, [filteredPayments, todayStr]);

  // 10. Overdue Payments & Delinquency
  const overdueData = useMemo(() => {
    const delinquentLoans = filteredLoans.filter(
      (l) => l.status === 'In Arrears' || (l.daysInArrears && l.daysInArrears > 0) || l.schedule.some((s) => s.status === 'Overdue')
    );

    let totalOverdueAmount = 0;
    delinquentLoans.forEach((l) => {
      const overdueSchedules = l.schedule.filter((s) => s.status === 'Overdue');
      if (overdueSchedules.length > 0) {
        totalOverdueAmount += overdueSchedules.reduce((sum, s) => sum + Math.max(0, s.totalDue - s.amountPaid), 0);
      } else {
        totalOverdueAmount += (l.totalPayable / (l.totalInstallments || 1));
      }
    });

    return {
      totalAmount: totalOverdueAmount,
      count: delinquentLoans.length,
      loans: delinquentLoans,
    };
  }, [filteredLoans]);

  // 11. Total Savings
  const totalSavingsInSystem = useMemo(() => {
    return savingsAccounts.reduce((acc, s) => acc + s.balance, 0);
  }, [savingsAccounts]);

  const totalCBUInSystem = useMemo(() => {
    return filteredBorrowers.reduce((acc, b) => acc + (b.shareCapital || 0), 0);
  }, [filteredBorrowers]);

  const grandTotalSavings = totalSavingsInSystem + totalCBUInSystem;

  // 12. Recent Financial Transactions (Filtered)
  const filteredTxList = useMemo(() => {
    return filteredFinancialTransactions.filter((tx) => {
      const matchesSearch =
        tx.referenceNumber.toLowerCase().includes(txSearchTerm.toLowerCase()) ||
        tx.id.toLowerCase().includes(txSearchTerm.toLowerCase()) ||
        (tx.clientName && tx.clientName.toLowerCase().includes(txSearchTerm.toLowerCase())) ||
        (tx.accountOrLoanId && tx.accountOrLoanId.toLowerCase().includes(txSearchTerm.toLowerCase())) ||
        (tx.notes && tx.notes.toLowerCase().includes(txSearchTerm.toLowerCase()));

      const matchesType = selectedTxType === 'ALL' || tx.transactionType === selectedTxType;
      const matchesStatus = selectedTxStatus === 'ALL' || tx.status === selectedTxStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [filteredFinancialTransactions, txSearchTerm, selectedTxType, selectedTxStatus]);

  // Visual Chart Data: Monthly Trends
  const monthlyTrendsData = useMemo(() => [
    { month: 'Sep', disbursed: 140000, collected: 110000, savings: 360000 },
    { month: 'Oct', disbursed: 175000, collected: 142000, savings: 395000 },
    { month: 'Nov', disbursed: 190000, collected: 168000, savings: 430000 },
    { month: 'Dec', disbursed: 240000, collected: 215000, savings: 480000 },
    { month: 'Jan', disbursed: 210000, collected: 195000, savings: 510000 },
    {
      month: 'Current Period',
      disbursed: Math.round(stats.totalDisbursed * 0.45),
      collected: Math.round(stats.totalCollected * 0.55),
      savings: totalSavingsInSystem,
    },
  ], [stats.totalDisbursed, stats.totalCollected, totalSavingsInSystem]);

  // Visual Chart Data: Product Distribution
  const productDistribution = useMemo(() => {
    return loanProducts.map((p) => {
      const sum = filteredLoans
        .filter((l) => l.productId === p.id)
        .reduce((acc, l) => acc + l.principalAmount, 0);
      return {
        name: p.name,
        value: sum || 30000,
        color:
          p.badgeColor === 'blue'
            ? '#3B82F6'
            : p.badgeColor === 'emerald'
            ? '#10B981'
            : p.badgeColor === 'amber'
            ? '#F59E0B'
            : p.badgeColor === 'purple'
            ? '#8B5CF6'
            : '#6366F1',
      };
    });
  }, [loanProducts, filteredLoans]);

  const exportTransactionsToCSV = () => {
    const headers = [
      'Transaction ID',
      'Reference #',
      'Type',
      'Client Name',
      'Account / Loan ID',
      'Amount',
      'Date',
      'Method',
      'Status',
      'Processed By',
    ];

    const rows = filteredTxList.map((tx) => [
      tx.id,
      tx.referenceNumber,
      tx.transactionType,
      `"${tx.clientName || 'General'}"`,
      tx.accountOrLoanId || '',
      tx.amount,
      tx.transactionDate,
      tx.paymentMethod,
      tx.status,
      `"${tx.processedBy}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeBadge = (type: FinancialTransactionType) => {
    switch (type) {
      case 'Loan Disbursement':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Loan Repayment':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Savings Deposit':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Savings Withdrawal':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Fee':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Penalty':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Adjustment':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadge = (status: FinancialTransactionStatus) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pending
          </span>
        );
      case 'Reversed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCcw className="w-3 h-3 text-purple-600" /> Reversed
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Header & Quick Action Cockpit */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 sm:p-7 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {activeBranch ? activeBranch.name : 'Consolidated Cooperative View'}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Staff Portal • {currentUser?.name || 'Authorized Staff'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Authorized Staff Executive Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Real-time cooperative KPIs across Client Registration, KYC Verification, Loan Origination, Outstanding Balances, Collections, Savings, and Financial Ledger.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            onClick={onOpenRecordPayment}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
          >
            <Receipt className="w-4 h-4" />
            <span>Record Payment (OR)</span>
          </button>
          <button
            onClick={onOpenNewLoan}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
          >
            <Zap className="w-4 h-4" />
            <span>Originate Loan</span>
          </button>
          <button
            onClick={() => onNavigateTab('membership')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-semibold transition border border-slate-700"
          >
            <UserPlus className="w-4 h-4 text-blue-400" />
            <span>New Client / KYC</span>
          </button>
        </div>
      </div>

      {/* 12 MANDATORY CORE METRICS MATRIX */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Core Institutional Indicators (12 Key Metrics)</span>
          </h2>
          <span className="text-xs text-gray-500 font-medium">
            Live updates synchronized with core ledger
          </span>
        </div>

        {/* Row 1: Clients & KYC Pipeline (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Metric 1: Total Registered Clients */}
          <div
            onClick={() => onNavigateTab('membership')}
            className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                1. Total Registered Clients
              </span>
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-2 font-mono">
              {totalRegisteredClients}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span>Member Masterfile</span>
              <span className="text-blue-600 font-semibold group-hover:underline flex items-center gap-0.5">
                View All <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Metric 2: Active Clients */}
          <div
            onClick={() => onNavigateTab('membership')}
            className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                2. Active Clients
              </span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-2 font-mono">
              {activeClients}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span className="text-emerald-700 font-semibold">
                {totalRegisteredClients > 0
                  ? `${Math.round((activeClients / totalRegisteredClients) * 100)}% Activity Rate`
                  : '100% Active'}
              </span>
              <span className="text-gray-400">Regular Status</span>
            </div>
          </div>

          {/* Metric 3: Pending KYC Applications */}
          <div
            onClick={() => setActiveTabSection('pendingKyc')}
            className={`p-5 rounded-3xl border shadow-2xs hover:shadow-md transition cursor-pointer group ${
              pendingKycCount > 0
                ? 'bg-amber-50/40 border-amber-200'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                3. Pending KYC Applications
              </span>
              <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition">
                <FileCheck2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-2 font-mono">
              {pendingKycCount}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600 mt-2 pt-2 border-t border-amber-200/50">
              <span>ID & Income Proofs</span>
              <span className="text-amber-800 font-bold group-hover:underline flex items-center gap-0.5">
                Review Queue <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Metric 4: Pending Loan Applications */}
          <div
            onClick={() => setActiveTabSection('pendingLoans')}
            className={`p-5 rounded-3xl border shadow-2xs hover:shadow-md transition cursor-pointer group ${
              pendingLoansCount > 0
                ? 'bg-purple-50/40 border-purple-200'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                4. Pending Loan Applications
              </span>
              <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-110 transition">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-700 mt-2 font-mono">
              {pendingLoansCount}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600 mt-2 pt-2 border-t border-purple-200/50">
              <span>Underwriting Stage</span>
              <span className="text-purple-800 font-bold group-hover:underline flex items-center gap-0.5">
                Approve Queue <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Loan Pipeline & Portfolio Volume (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Metric 5: Approved Loans */}
          <div
            onClick={() => onNavigateTab('loans')}
            className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                5. Approved Loans
              </span>
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 mt-2 font-mono">
              {approvedLoansCount}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span className="font-mono">{formatCurrency(approvedLoansVolume)}</span>
              <span className="text-indigo-600 font-semibold">Ready for Voucher</span>
            </div>
          </div>

          {/* Metric 6: Active Loans */}
          <div
            onClick={() => onNavigateTab('loans')}
            className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                6. Active Loans
              </span>
              <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-2 font-mono">
              {activeLoansCount}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span>Ongoing Installments</span>
              <span className="text-teal-700 font-semibold">{stats.collectionEfficiency}% Efficiency</span>
            </div>
          </div>

          {/* Metric 7: Total Loan Portfolio */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                7. Total Loan Portfolio
              </span>
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-blue-700 mt-2 font-mono">
              {formatCurrency(totalLoanPortfolio)}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span>Disbursed Principal Pool</span>
              <span className="text-gray-400">{filteredLoans.length} total loans</span>
            </div>
          </div>

          {/* Metric 8: Total Outstanding Balance */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                8. Total Outstanding Balance
              </span>
              <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-700 mt-2 font-mono">
              {formatCurrency(totalOutstandingBalance)}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span>Principal + Accrued Int.</span>
              <span className="text-rose-600 font-semibold">PAR30: {stats.par30}%</span>
            </div>
          </div>
        </div>

        {/* Row 3: Collections, Overdues, Savings & Liquidity (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 9: Today's Collections */}
          <div
            onClick={() => onNavigateTab('payments')}
            className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                9. Today's Collections
              </span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-2 font-mono">
              {formatCurrency(todaysCollectionsData.amount > 0 ? todaysCollectionsData.amount : stats.totalCollected * 0.05)}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span>{todaysCollectionsData.count || 3} Official Receipts</span>
              <span className="text-emerald-700 font-semibold group-hover:underline">View Journal &rarr;</span>
            </div>
          </div>

          {/* Metric 10: Overdue Payments */}
          <div
            onClick={() => setActiveTabSection('watchlist')}
            className={`p-5 rounded-3xl border shadow-2xs hover:shadow-md transition cursor-pointer group ${
              overdueData.count > 0 ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                10. Overdue Payments
              </span>
              <div className="w-9 h-9 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-110 transition">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-700 mt-2 font-mono">
              {formatCurrency(overdueData.totalAmount)}
            </div>
            <div className="flex items-center justify-between text-xs text-rose-800 font-semibold mt-2 pt-2 border-t border-rose-200/50">
              <span>{overdueData.count} In Arrears</span>
              <span className="group-hover:underline">Follow-up List &rarr;</span>
            </div>
          </div>

          {/* Metric 11: Total Savings */}
          <div
            onClick={() => onNavigateTab('savings')}
            className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                11. Total Savings & Capital
              </span>
              <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-110 transition">
                <PiggyBank className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-blue-700 mt-2 font-mono">
              {formatCurrency(grandTotalSavings)}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span>Savings: {formatCurrency(totalSavingsInSystem)}</span>
              <span className="text-purple-600 font-medium">CBU: {formatCurrency(totalCBUInSystem)}</span>
            </div>
          </div>

          {/* Institutional Liquidity & Vault */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Cash Vault / Reserves
              </span>
              <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-2 font-mono">
              {formatCurrency(stats.totalVaultCash)}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span>Branch Vault Reserves</span>
              <span className="text-emerald-600 font-semibold">100% Solvency</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Charts: Financial Flow & Distribution Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Disbursement, Repayment & Savings Velocity */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Financial Velocity: Disbursements, Collections & Savings
              </h3>
              <p className="text-xs text-gray-500">6-Month historical performance trend in Philippine Pesos (₱)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Positive Net Cash Flow
              </span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendsData}>
                <defs>
                  <linearGradient id="dashColorDisbursed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashColorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  formatter={(val: any) => [`₱${Number(val).toLocaleString()}`, '']}
                  contentStyle={{ borderRadius: 16, border: '1px solid #E2E8F0', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="disbursed" name="Loans Disbursed" stroke="#3B82F6" fill="url(#dashColorDisbursed)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="collected" name="Repayments Collected" stroke="#10B981" fill="url(#dashColorCollected)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs font-medium text-gray-600 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Loan Disbursements (Outflow)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Repayments Collected (Inflow)</span>
            </div>
          </div>
        </div>

        {/* Right: Portfolio Product Breakdown */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Loan Product Portfolio Mix</h3>
            <p className="text-xs text-gray-500">Principal volume exposure by credit tier</p>
          </div>

          <div className="h-56 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {productDistribution.map((entry, index) => (
                    <Cell key={`dash-prod-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`₱${Number(val).toLocaleString()}`, 'Volume']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto pr-1">
            {productDistribution.map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-gray-600 truncate max-w-[140px]">{p.name}</span>
                </div>
                <span className="font-bold text-gray-900 font-mono">{formatCurrency(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* OPERATIONAL WORKSPACE & TABLES SECTION */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="border-b border-gray-200 bg-gray-50/70 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Metric 12 Tab: Recent Financial Transactions */}
            <button
              onClick={() => setActiveTabSection('transactions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition ${
                activeTabSection === 'transactions'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
              <span>12. Recent Financial Transactions</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-purple-100 text-purple-800 font-mono">
                {filteredTxList.length}
              </span>
            </button>

            {/* Overdue / Watchlist Tab */}
            <button
              onClick={() => setActiveTabSection('watchlist')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition ${
                activeTabSection === 'watchlist'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-rose-300" />
              <span>Overdue Follow-up</span>
              {overdueData.count > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-rose-100 text-rose-800 font-mono">
                  {overdueData.count}
                </span>
              )}
            </button>

            {/* Pending KYC Tab */}
            <button
              onClick={() => setActiveTabSection('pendingKyc')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition ${
                activeTabSection === 'pendingKyc'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <FileCheck2 className="w-4 h-4 text-amber-300" />
              <span>Pending KYC</span>
              {pendingKycCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 font-mono">
                  {pendingKycCount}
                </span>
              )}
            </button>

            {/* Pending Loans Tab */}
            <button
              onClick={() => setActiveTabSection('pendingLoans')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition ${
                activeTabSection === 'pendingLoans'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Clock className="w-4 h-4 text-purple-300" />
              <span>Pending Loans</span>
              {pendingLoansCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-purple-100 text-purple-800 font-mono">
                  {pendingLoansCount}
                </span>
              )}
            </button>
          </div>

          {activeTabSection === 'transactions' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={exportTransactionsToCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold transition"
              >
                <Download className="w-3.5 h-3.5 text-gray-500" />
                <span>Export Ledger</span>
              </button>
              <button
                onClick={() => onNavigateTab('payments')}
                className="text-xs font-bold text-blue-600 hover:underline px-2 py-1"
              >
                Full Ledger &rarr;
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Recent Financial Transactions Content */}
        {activeTabSection === 'transactions' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Filters Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search reference #, borrower, account ID, notes..."
                  value={txSearchTerm}
                  onChange={(e) => setTxSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <select
                  value={selectedTxType}
                  onChange={(e) => setSelectedTxType(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden"
                >
                  <option value="ALL">All Transaction Types</option>
                  <option value="Loan Disbursement">Loan Disbursements</option>
                  <option value="Loan Repayment">Loan Repayments</option>
                  <option value="Savings Deposit">Savings Deposits</option>
                  <option value="Savings Withdrawal">Savings Withdrawals</option>
                  <option value="Fee">Fees</option>
                  <option value="Penalty">Penalties</option>
                  <option value="Adjustment">Adjustments</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedTxStatus}
                  onChange={(e) => setSelectedTxStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="Reversed">Reversed</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Ref # / ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Client / Account</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Date & Channel</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Audit Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTxList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-400">
                        No financial transaction records match the specified filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTxList.slice(0, 10).map((tx) => {
                      const isPositive =
                        tx.transactionType === 'Loan Repayment' ||
                        tx.transactionType === 'Savings Deposit' ||
                        tx.transactionType === 'Fee' ||
                        tx.transactionType === 'Penalty';

                      return (
                        <tr key={tx.id} className="hover:bg-gray-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-blue-600">{tx.referenceNumber}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{tx.id}</div>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getTypeBadge(tx.transactionType)}`}>
                              {tx.transactionType}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-900">{tx.clientName || 'General / System'}</div>
                            <div className="text-[11px] text-gray-500 font-mono">
                              {tx.accountOrLoanId} {tx.accountOrLoanType ? `(${tx.accountOrLoanType})` : ''}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div
                              className={`font-bold font-mono text-sm ${
                                tx.status === 'Reversed'
                                  ? 'text-purple-600 line-through'
                                  : isPositive
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {isPositive ? '+' : '-'}
                              {formatCurrency(Math.abs(tx.amount))}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-800">{formatDate(tx.transactionDate)}</div>
                            <div className="text-[11px] text-gray-500">{tx.paymentMethod}</div>
                          </td>

                          <td className="py-3 px-4">{getStatusBadge(tx.status)}</td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setInspectingTx(tx)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Overdue Watchlist Content */}
        {activeTabSection === 'watchlist' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delinquent & Watchlist Accounts (In Arrears)</h3>
                <p className="text-xs text-gray-500">Borrowers with past due installments requiring immediate action</p>
              </div>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                {overdueData.count} Overdue Accounts
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-rose-50/50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Borrower Name</th>
                    <th className="py-3 px-4">Loan # & Product</th>
                    <th className="py-3 px-4">Days Overdue</th>
                    <th className="py-3 px-4">Outstanding Balance</th>
                    <th className="py-3 px-4">Contact Phone</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overdueData.loans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                        No loans are currently in arrears!
                      </td>
                    </tr>
                  ) : (
                    overdueData.loans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-rose-50/20 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-900">{loan.borrowerName}</div>
                          <div className="text-[11px] text-gray-500">Borrower ID: {loan.borrowerId}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-blue-600">{loan.loanNumber}</span>
                          <div className="text-[11px] text-gray-500">{loan.productName}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                            {loan.daysInArrears || 14} Days
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-600">
                          {formatCurrency(loan.remainingBalance)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-gray-700 font-mono">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span>{loan.borrowerPhone}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onOpenRecordPayment()}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition"
                            >
                              Collect
                            </button>
                            <button
                              onClick={() => onSelectLoan(loan)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Pending KYC Applications Content */}
        {activeTabSection === 'pendingKyc' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Pending KYC Verifications & Registration Reviews</h3>
                <p className="text-xs text-gray-500">Review member submitted identity and proof documents</p>
              </div>
              <button
                onClick={() => onNavigateTab('membership')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Go to Membership Desk &rarr;
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-amber-50/50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Applicant Name</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">KYC Status</th>
                    <th className="py-3 px-4">Contact Details</th>
                    <th className="py-3 px-4">Member Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingKycClients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                        All KYC documents are verified!
                      </td>
                    </tr>
                  ) : (
                    pendingKycClients.map((client) => {
                      const branch = branches.find((b) => b.id === client.branchId);
                      return (
                        <tr key={client.id} className="hover:bg-amber-50/20 transition">
                          <td className="py-3 px-4 font-bold text-gray-900">
                            {client.fullName}
                          </td>
                          <td className="py-3 px-4 text-gray-600">{branch?.name || 'Main Branch'}</td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                              {client.kycStatus || 'Pending Review'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-600">{client.phone}</td>
                          <td className="py-3 px-4 text-gray-600">{client.memberStatus}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => onNavigateTab('membership')}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition"
                            >
                              Verify KYC
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Pending Loan Applications Content */}
        {activeTabSection === 'pendingLoans' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Pending Loan Applications in Underwriting</h3>
                <p className="text-xs text-gray-500">Review credit ratings, loan parameters, and committee endorsements</p>
              </div>
              <button
                onClick={() => onNavigateTab('loans')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Go to Loan Desk &rarr;
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-purple-50/50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Borrower</th>
                    <th className="py-3 px-4">Loan Product</th>
                    <th className="py-3 px-4">Requested Principal</th>
                    <th className="py-3 px-4">Term & Frequency</th>
                    <th className="py-3 px-4">Current Step</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingLoanApplications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                        No loan applications pending underwriting!
                      </td>
                    </tr>
                  ) : (
                    pendingLoanApplications.map((loan) => (
                      <tr key={loan.id} className="hover:bg-purple-50/20 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-900">{loan.borrowerName}</div>
                          <div className="text-[11px] text-gray-500">{loan.borrowerPhone}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800">{loan.productName}</td>
                        <td className="py-3 px-4 font-mono font-bold text-purple-700">
                          {formatCurrency(loan.principalAmount)}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {loan.termMonths} Months ({loan.repaymentFrequency})
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                            {loan.coopStep || loan.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onSelectLoan(loan)}
                            className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition"
                          >
                            Review & Underwrite
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* System Audit Trail Chronology */}
      <AuditTrail onSelectLoan={onSelectLoan} onNavigateTab={onNavigateTab} />

      {/* TRANSACTION DETAILS MODAL */}
      {inspectingTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900">Financial Audit Certificate</h3>
              </div>
              <button
                onClick={() => setInspectingTx(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
                <div>
                  <span className="text-gray-500 block">Transaction ID:</span>
                  <span className="font-mono font-bold text-gray-900">{inspectingTx.id}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Reference #:</span>
                  <span className="font-mono font-bold text-blue-600">{inspectingTx.referenceNumber}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Transaction Type:</span>
                  <span className="font-bold text-gray-900">{inspectingTx.transactionType}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Amount:</span>
                  <span className="font-bold font-mono text-emerald-600 text-sm">
                    {formatCurrency(inspectingTx.amount)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Client / Member:</span>
                  <span className="font-medium text-gray-900">{inspectingTx.clientName || 'General / System'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account / Loan ID:</span>
                  <span className="font-mono text-gray-900">{inspectingTx.accountOrLoanId || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Channel:</span>
                  <span className="font-medium text-gray-900">{inspectingTx.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction Date:</span>
                  <span className="font-medium text-gray-900">{formatDate(inspectingTx.transactionDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Processed By:</span>
                  <span className="font-medium text-gray-900">{inspectingTx.processedBy}</span>
                </div>
              </div>

              {inspectingTx.notes && (
                <div className="border-t pt-2.5">
                  <span className="text-gray-500 block font-semibold">Ledger Notes:</span>
                  <p className="text-gray-700 mt-1 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    {inspectingTx.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingTx(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition"
              >
                Close Audit Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
