import React, { useState, useMemo } from 'react';
import {
  PiggyBank,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Receipt,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  Calendar,
  Lock,
  XCircle,
  Coins,
  Plus,
  Eye,
  History,
  ShieldAlert,
  Ban,
  RefreshCw,
  UserCheck,
  CreditCard,
  ChevronRight,
  Check,
  Printer,
  Download,
  Filter,
  User,
  Info,
  Building,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import {
  Borrower,
  SavingsAccount,
  SavingsAccountStatus,
  SavingsAccountType,
  SavingsTransaction,
  SavingsWithdrawalRequest,
} from '../types';
import { calculateMonthlySavingsInterest, formatCurrency, formatDate } from '../utils/loanMath';
import { SavingsReceiptModal } from './SavingsReceiptModal';

export const SavingsView: React.FC = () => {
  const {
    borrowers,
    savingsAccounts,
    savingsTransactions,
    withdrawalRequests,
    interestLogs,
    stats,
    currentUser,
    branches,
    openSavingsAccount,
    recordSavingsDeposit,
    recordSavingsWithdrawal,
    updateSavingsAccountStatus,
    requestSavingsWithdrawal,
    managerApproveWithdrawal,
    managerRejectWithdrawal,
    runMonthlyInterestCrediting,
  } = useLoan();

  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions' | 'withdrawals' | 'interest'>('accounts');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');

  // Modal States
  const [showOpenAccountModal, setShowOpenAccountModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Selected State
  const [selectedAccount, setSelectedAccount] = useState<SavingsAccount | null>(null);
  const [activeReceiptTx, setActiveReceiptTx] = useState<SavingsTransaction | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [interestSuccess, setInterestSuccess] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Forms
  const [openAccountForm, setOpenAccountForm] = useState({
    clientId: borrowers[0]?.id || '',
    accountType: 'Regular Savings' as SavingsAccountType,
    initialDeposit: 1000,
    paymentMethod: 'Cash',
    referenceNumber: '',
    notes: 'Initial savings account opening & passbook registration',
    maintainingBalance: 1000,
    interestRate: 1.0,
    branchId: 'br-main',
  });

  const [depositForm, setDepositForm] = useState({
    accountId: '',
    amount: 1000,
    paymentMethod: 'Cash',
    referenceNumber: '',
    date: new Date().toISOString().split('T')[0],
    notes: 'Regular over-the-counter savings deposit',
  });

  const [withdrawForm, setWithdrawForm] = useState({
    accountId: '',
    amount: 1000,
    paymentMethod: 'Cash',
    referenceNumber: '',
    date: new Date().toISOString().split('T')[0],
    reason: 'Emergency household expenses',
    mode: 'direct' as 'direct' | 'request',
  });

  const [statusForm, setStatusForm] = useState({
    accountId: '',
    newStatus: 'Active' as SavingsAccountStatus,
    reason: '',
  });

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return savingsAccounts.filter((account) => {
      const matchesSearch =
        account.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.clientNumber && account.clientNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (account.passbookNumber && account.passbookNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (account.clientPhone && account.clientPhone.includes(searchTerm));

      const matchesStatus = statusFilter === 'ALL' || account.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [savingsAccounts, searchTerm, statusFilter]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return savingsTransactions.filter((tx) => {
      const matchesSearch =
        tx.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.referenceNumber && tx.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.officialReceiptNumber && tx.officialReceiptNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        tx.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.accountNumber && tx.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = txTypeFilter === 'ALL' || tx.type === txTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [savingsTransactions, searchTerm, txTypeFilter]);

  const pendingWithdrawals = withdrawalRequests.filter((w) => w.status === 'Pending Approval');

  // Stats Calculations
  const totalSavingsBalance = savingsAccounts.reduce((acc, a) => acc + a.balance, 0);
  const activeSaversCount = savingsAccounts.filter((a) => a.status === 'Active').length;
  const dormantCount = savingsAccounts.filter((a) => a.status === 'Dormant').length;
  const suspendedCount = savingsAccounts.filter((a) => a.status === 'Suspended').length;
  const closedCount = savingsAccounts.filter((a) => a.status === 'Closed').length;

  // Handlers
  const handleOpenAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpenError(null);

    const client = borrowers.find((b) => b.id === openAccountForm.clientId);
    if (!client) {
      setOpenError('Please select a valid cooperative client.');
      return;
    }

    if (openAccountForm.initialDeposit < openAccountForm.maintainingBalance) {
      setOpenError(
        `Initial deposit must be at least ₱${openAccountForm.maintainingBalance.toLocaleString()} to cover the mandatory maintaining balance.`
      );
      return;
    }

    const res = openSavingsAccount({
      clientId: openAccountForm.clientId,
      accountType: openAccountForm.accountType,
      initialDeposit: Number(openAccountForm.initialDeposit),
      paymentMethod: openAccountForm.paymentMethod,
      referenceNumber: openAccountForm.referenceNumber.trim() || undefined,
      notes: openAccountForm.notes,
      maintainingBalance: Number(openAccountForm.maintainingBalance),
      interestRate: Number(openAccountForm.interestRate),
      branchId: openAccountForm.branchId || client.branchId,
    });

    if (!res.success || !res.account) {
      setOpenError(res.error || 'Failed to open savings account.');
      return;
    }

    setShowOpenAccountModal(false);
    setActionSuccess(`Savings Account ${res.account.accountNumber} successfully created for ${res.account.clientName}!`);
    setTimeout(() => setActionSuccess(null), 5000);

    if (res.transaction) {
      setActiveReceiptTx(res.transaction);
      setSelectedAccount(res.account);
      setShowReceiptModal(true);
    }
  };

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);

    if (!depositForm.accountId) {
      setDepositError('Please select a savings account.');
      return;
    }

    if (depositForm.amount <= 0) {
      setDepositError('Deposit amount must be greater than zero.');
      return;
    }

    const res = recordSavingsDeposit({
      accountId: depositForm.accountId,
      amount: Number(depositForm.amount),
      paymentMethod: depositForm.paymentMethod,
      referenceNumber: depositForm.referenceNumber.trim() || undefined,
      date: depositForm.date,
      notes: depositForm.notes,
    });

    if (!res.success || !res.transaction) {
      setDepositError(res.error || 'Failed to record savings deposit.');
      return;
    }

    const targetAccount = savingsAccounts.find((a) => a.id === depositForm.accountId);

    setShowDepositModal(false);
    setActionSuccess(`Successfully deposited ₱${depositForm.amount.toLocaleString()} to account!`);
    setTimeout(() => setActionSuccess(null), 5000);

    setActiveReceiptTx(res.transaction);
    setSelectedAccount(targetAccount || null);
    setShowReceiptModal(true);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);

    if (!withdrawForm.accountId) {
      setWithdrawError('Please select a savings account.');
      return;
    }

    const targetAccount = savingsAccounts.find((a) => a.id === withdrawForm.accountId);
    if (!targetAccount) {
      setWithdrawError('Savings account not found.');
      return;
    }

    if (withdrawForm.amount <= 0) {
      setWithdrawError('Withdrawal amount must be greater than zero.');
      return;
    }

    // Direct Cashier Withdrawal
    if (withdrawForm.mode === 'direct') {
      const res = recordSavingsWithdrawal({
        accountId: targetAccount.id,
        amount: Number(withdrawForm.amount),
        paymentMethod: withdrawForm.paymentMethod,
        referenceNumber: withdrawForm.referenceNumber.trim() || undefined,
        date: withdrawForm.date,
        reason: withdrawForm.reason,
      });

      if (!res.success || !res.transaction) {
        setWithdrawError(res.error || 'Failed to process withdrawal.');
        return;
      }

      setShowWithdrawModal(false);
      setActionSuccess(`Successfully processed withdrawal of ₱${withdrawForm.amount.toLocaleString()}!`);
      setTimeout(() => setActionSuccess(null), 5000);

      setActiveReceiptTx(res.transaction);
      setSelectedAccount(targetAccount);
      setShowReceiptModal(true);
    } else {
      // Manager Workflow Request
      const res = requestSavingsWithdrawal({
        memberId: targetAccount.clientId,
        amount: Number(withdrawForm.amount),
        reason: withdrawForm.reason,
      });

      if (!res.success) {
        setWithdrawError(res.error || 'Failed to submit withdrawal request.');
        return;
      }

      setShowWithdrawModal(false);
      setActionSuccess(`Withdrawal request submitted for Manager sign-off!`);
      setTimeout(() => setActionSuccess(null), 5000);
      setActiveTab('withdrawals');
    }
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError(null);

    if (!statusForm.accountId) {
      setStatusError('Please select an account.');
      return;
    }

    if (!statusForm.reason.trim()) {
      setStatusError('Please provide an audit justification reason for this status change.');
      return;
    }

    const res = updateSavingsAccountStatus(statusForm.accountId, statusForm.newStatus, statusForm.reason);

    if (!res.success) {
      setStatusError(res.error || 'Failed to update account status.');
      return;
    }

    setShowStatusModal(false);
    setActionSuccess(`Account status updated to ${statusForm.newStatus}!`);
    setTimeout(() => setActionSuccess(null), 5000);
  };

  const handleRunInterestBatch = () => {
    const res = runMonthlyInterestCrediting();
    setInterestSuccess(
      `Successfully credited 1.0% annual interest to ${res.membersCount} active savers! Total interest distributed: ₱${res.totalCredited.toFixed(
        2
      )}`
    );
    setTimeout(() => setInterestSuccess(null), 6000);
  };

  const openDepositForAccount = (account: SavingsAccount) => {
    setSelectedAccount(account);
    setDepositForm({
      accountId: account.id,
      amount: 1000,
      paymentMethod: 'Cash',
      referenceNumber: `OR-SAV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      notes: `Over-the-counter deposit to ${account.accountNumber}`,
    });
    setDepositError(null);
    setShowDepositModal(true);
  };

  const openWithdrawForAccount = (account: SavingsAccount) => {
    setSelectedAccount(account);
    const avail = Math.max(0, account.balance - account.maintainingBalance);
    setWithdrawForm({
      accountId: account.id,
      amount: Math.min(1000, avail > 0 ? avail : 500),
      paymentMethod: 'Cash',
      referenceNumber: `WD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      reason: 'Household & personal living expenses',
      mode: 'direct',
    });
    setWithdrawError(null);
    setShowWithdrawModal(true);
  };

  const openStatusForAccount = (account: SavingsAccount) => {
    setSelectedAccount(account);
    setStatusForm({
      accountId: account.id,
      newStatus: account.status,
      reason: '',
    });
    setStatusError(null);
    setShowStatusModal(true);
  };

  const openDetailsForAccount = (account: SavingsAccount) => {
    setSelectedAccount(account);
    setShowDetailsModal(true);
  };

  const viewReceiptForTx = (tx: SavingsTransaction) => {
    const matchedAccount = savingsAccounts.find(
      (a) => a.id === tx.savingsAccountId || a.accountNumber === tx.accountNumber
    );
    setActiveReceiptTx(tx);
    setSelectedAccount(matchedAccount || null);
    setShowReceiptModal(true);
  };

  const getStatusBadge = (status: SavingsAccountStatus) => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Active
          </span>
        );
      case 'Dormant':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Dormant
          </span>
        );
      case 'Suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <Ban className="w-3 h-3 text-rose-600" />
            Suspended
          </span>
        );
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">
            <Lock className="w-3 h-3 text-slate-500" />
            Closed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner: Savings Services Hub */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30 text-xs font-semibold uppercase tracking-wider">
              <PiggyBank className="w-3.5 h-3.5 text-amber-300" />
              Savings Account Management
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cooperative Savings & Capital Build-Up</h1>
            <p className="text-sm text-amber-100/90 max-w-2xl leading-relaxed">
              Open accounts with unique Savings IDs, record deposits, process withdrawals with maintaining balance guard (₱1,000.00 min), track account statuses (Active, Dormant, Suspended, Closed), and generate official transaction receipts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="open-savings-acc-btn"
              onClick={() => {
                setOpenAccountForm({
                  clientId: borrowers[0]?.id || '',
                  accountType: 'Regular Savings',
                  initialDeposit: 1000,
                  paymentMethod: 'Cash',
                  referenceNumber: `OR-SAV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                  notes: 'Initial savings account opening & passbook registration',
                  maintainingBalance: 1000,
                  interestRate: 1.0,
                  branchId: 'br-main',
                });
                setOpenError(null);
                setShowOpenAccountModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold rounded-xl text-sm transition shadow-md"
            >
              <Plus className="w-4 h-4" />
              Open Savings Account
            </button>

            <button
              id="deposit-savings-btn"
              onClick={() => {
                const first = savingsAccounts[0];
                setDepositForm({
                  accountId: first?.id || '',
                  amount: 1000,
                  paymentMethod: 'Cash',
                  referenceNumber: `OR-SAV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                  date: new Date().toISOString().split('T')[0],
                  notes: 'Over-the-counter savings deposit',
                });
                setDepositError(null);
                setShowDepositModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition shadow-md"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Record Deposit
            </button>

            <button
              id="withdraw-savings-btn"
              onClick={() => {
                const first = savingsAccounts[0];
                const avail = first ? Math.max(0, first.balance - first.maintainingBalance) : 1000;
                setWithdrawForm({
                  accountId: first?.id || '',
                  amount: Math.min(1000, avail > 0 ? avail : 500),
                  paymentMethod: 'Cash',
                  referenceNumber: `WD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                  date: new Date().toISOString().split('T')[0],
                  reason: 'Medical / Emergency household expenses',
                  mode: 'direct',
                });
                setWithdrawError(null);
                setShowWithdrawModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-medium transition"
            >
              <ArrowUpRight className="w-4 h-4" />
              Record Withdrawal
            </button>

            <button
              id="run-interest-btn"
              onClick={handleRunInterestBatch}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600/80 hover:bg-amber-600 text-white font-medium rounded-xl text-sm border border-amber-400/30 transition shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              Run 1% Interest Batch
            </button>
          </div>
        </div>

        {/* Highlight Stats Strip */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-xs text-amber-200">Total Savings Balance</div>
            <div className="text-xl font-bold text-white mt-0.5">{formatCurrency(totalSavingsBalance)}</div>
            <div className="text-[11px] text-amber-200/70 mt-0.5">{savingsAccounts.length} Total Accounts</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-xs text-amber-200">Account Statuses</div>
            <div className="text-xl font-bold text-white mt-0.5">{activeSaversCount} Active</div>
            <div className="text-[11px] text-amber-200/70 mt-0.5">
              {dormantCount} Dormant • {suspendedCount} Suspended • {closedCount} Closed
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-xs text-amber-200">Maintaining Balance Rule</div>
            <div className="text-xl font-bold text-white mt-0.5">₱1,000.00 Locked</div>
            <div className="text-[11px] text-amber-200/70 mt-0.5">Withdrawals blocked if &lt; ₱1k</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-xs text-amber-200">Annual Interest Rate</div>
            <div className="text-xl font-bold text-white mt-0.5">1.0% p.a.</div>
            <div className="text-[11px] text-amber-200/70 mt-0.5">Credited monthly to passbooks</div>
          </div>
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-sm font-semibold">{actionSuccess}</div>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-xs text-emerald-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Interest Success Alert */}
      {interestSuccess && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-sm font-semibold">{interestSuccess}</div>
          </div>
          <button onClick={() => setInterestSuccess(null)} className="text-xs text-amber-800 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 overflow-x-auto pb-1 gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'accounts'
                ? 'border-amber-600 text-amber-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PiggyBank className="w-4 h-4" />
            <span>Savings Accounts ({savingsAccounts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'border-amber-600 text-amber-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Transaction Ledger ({savingsTransactions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'withdrawals'
                ? 'border-amber-600 text-amber-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>
              Withdrawal Approvals{' '}
              {pendingWithdrawals.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs ml-1 font-bold">
                  {pendingWithdrawals.length}
                </span>
              )}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('interest')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'interest'
                ? 'border-amber-600 text-amber-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Percent className="w-4 h-4" />
            <span>1% Interest Logs ({interestLogs.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB 1: SAVINGS ACCOUNTS MASTER LIST */}
      {/* ========================================== */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* Search & Status Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID, name, or passbook..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Status:</span>
              {['ALL', 'Active', 'Dormant', 'Suspended', 'Closed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {st === 'ALL' ? 'All Accounts' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((account) => {
              const currentBalance = account.balance;
              const withdrawableAmount = Math.max(0, currentBalance - account.maintainingBalance);
              const monthlyInterestProj = calculateMonthlySavingsInterest(currentBalance, 0.01);
              const isLocked = account.status === 'Closed' || account.status === 'Suspended';

              return (
                <div
                  key={account.id}
                  className={`bg-white rounded-2xl p-5 border shadow-xs transition space-y-4 hover:shadow-md ${
                    account.status === 'Suspended'
                      ? 'border-rose-200'
                      : account.status === 'Closed'
                      ? 'border-slate-300 opacity-80'
                      : 'border-slate-100 hover:border-amber-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {account.clientAvatar ? (
                        <img
                          src={account.clientAvatar}
                          alt={account.clientName}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                          {account.clientName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">{account.clientName}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            {account.accountNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{account.passbookNumber}</span>
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(account.status)}
                  </div>

                  {/* Balance Display */}
                  <div className="bg-gradient-to-br from-amber-50/80 to-amber-100/40 p-4 rounded-xl border border-amber-200/60">
                    <div className="flex items-center justify-between text-xs text-amber-800 font-medium">
                      <span>Total Savings Balance</span>
                      <span className="text-[10px] bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded font-semibold">
                        {account.accountType}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-amber-950 mt-1">
                      {formatCurrency(currentBalance)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-amber-900/80 mt-2.5 pt-2 border-t border-amber-200/60">
                      <span>Available for Withdrawal:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(withdrawableAmount)}</span>
                    </div>
                  </div>

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <span className="text-slate-400 block text-[10px]">Monthly 1% Int</span>
                      <span className="font-bold text-emerald-700">+{formatCurrency(monthlyInterestProj)}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <span className="text-slate-400 block text-[10px]">Maintaining</span>
                      <span className="font-semibold text-slate-700">₱{account.maintainingBalance.toLocaleString()}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <span className="text-slate-400 block text-[10px]">Total Earned</span>
                      <span className="font-bold text-amber-700">{formatCurrency(account.totalInterestEarned || 0)}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openDepositForAccount(account)}
                        disabled={isLocked}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                          isLocked
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        Deposit
                      </button>

                      <button
                        onClick={() => openWithdrawForAccount(account)}
                        disabled={isLocked || withdrawableAmount <= 0}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1 ${
                          isLocked || withdrawableAmount <= 0
                            ? 'border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50'
                            : 'border-amber-400 text-amber-900 hover:bg-amber-50 bg-white'
                        }`}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Withdraw
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openDetailsForAccount(account)}
                        className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View History & Logs
                      </button>

                      <button
                        onClick={() => openStatusForAccount(account)}
                        className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-medium transition"
                        title="Update Account Status"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredAccounts.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 text-slate-400 space-y-3">
              <PiggyBank className="w-10 h-10 mx-auto text-slate-300" />
              <div className="font-semibold text-slate-700">No savings accounts found</div>
              <p className="text-xs max-w-sm mx-auto">
                No accounts match your current search and status filter. Click "Open Savings Account" to create a new one.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: GENERAL SAVINGS TRANSACTION LEDGER */}
      {/* ========================================== */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Savings Account Transaction Ledger</h3>
              <p className="text-xs text-slate-400">Complete audit trail of deposits, withdrawals, opening entries & interest credits</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by ref, name, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              >
                <option value="ALL">All Types</option>
                <option value="Deposit">Deposit</option>
                <option value="Withdrawal">Withdrawal</option>
                <option value="Account Opening">Account Opening</option>
                <option value="Interest Credited">Interest Credited</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Tx Number</th>
                  <th className="py-2.5 px-3">Reference / OR #</th>
                  <th className="py-2.5 px-3">Account Number</th>
                  <th className="py-2.5 px-3">Member Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Balance After</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Processed By</th>
                  <th className="py-2.5 px-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{tx.date}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 font-bold">{tx.transactionNumber}</td>
                    <td className="py-2.5 px-3 font-mono text-amber-800 font-semibold">
                      {tx.referenceNumber || tx.officialReceiptNumber || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{tx.accountNumber || '-'}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{tx.memberName}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          tx.type === 'Deposit'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : tx.type === 'Withdrawal'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : tx.type === 'Account Opening'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-3 font-bold ${
                        tx.type === 'Withdrawal' ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {tx.type === 'Withdrawal' ? '-' : '+'}
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-blue-700">{formatCurrency(tx.balanceAfter)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{tx.paymentMethod || 'Cash'}</td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">{tx.processedBy}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => viewReceiptForTx(tx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
                      >
                        <Receipt className="w-3.5 h-3.5 text-amber-700" />
                        View OR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs">No transactions match your search filter.</div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: MANAGER WITHDRAWAL QUEUE */}
      {/* ========================================== */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-4">
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-sm text-amber-900">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Cooperative Withdrawal Protocol:</span> Tellers record withdrawal requests after confirming the maintaining balance (≥ ₱1,000). The Manager reviews and authorizes the cash release before funds are paid out.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {withdrawalRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:border-slate-200 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900">{req.memberName}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-bold">
                        {req.requestId}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Recorded by: {req.tellerName} on {req.requestDate}
                    </div>
                  </div>

                  <div>
                    {req.status === 'Approved & Released' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Approved & Released by Manager
                      </span>
                    ) : req.status === 'Rejected' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Awaiting Manager Sign-Off
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400">Current Balance:</span>
                    <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(req.currentBalance)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Requested Amount:</span>
                    <p className="font-bold text-rose-600 mt-0.5">{formatCurrency(req.requestedAmount)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Balance After:</span>
                    <p className="font-bold text-emerald-700 mt-0.5">
                      {formatCurrency(req.remainingBalanceAfter)} (≥ ₱1,000 OK)
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Purpose / Reason:</span>
                    <p className="font-medium text-slate-700 mt-0.5 truncate">{req.reason}</p>
                  </div>
                </div>

                {req.status === 'Pending Approval' && (
                  <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => managerRejectWithdrawal(req.id, 'Insufficient maintaining balance or irregular account status')}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-medium text-slate-700"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => managerApproveWithdrawal(req.id)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Manager Approve & Release Payout
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: MONTHLY 1% INTEREST LOGS */}
      {/* ========================================== */}
      {activeTab === 'interest' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly 1.0% p.a. Savings Interest Audit Logs</h3>
              <p className="text-xs text-slate-400">Compounded and credited directly to member passbooks each month</p>
            </div>
            <button
              onClick={handleRunInterestBatch}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Execute Batch Now
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Calculation Date</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3">Annual Rate</th>
                  <th className="py-2.5 px-3">Members Credited</th>
                  <th className="py-2.5 px-3">Total Distributed</th>
                  <th className="py-2.5 px-3">Executed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {interestLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{log.calculationDate}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{log.periodMonth}</td>
                    <td className="py-2.5 px-3 font-semibold text-amber-700">{log.annualRate}% p.a.</td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{log.totalMembersCredited} Members</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">{formatCurrency(log.totalInterestDistributed)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{log.executedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 1: OPEN NEW SAVINGS ACCOUNT */}
      {/* ========================================== */}
      {showOpenAccountModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Open Savings Account</h3>
                  <p className="text-xs text-slate-400">Generate Account ID, Passbook & Initial Deposit</p>
                </div>
              </div>
              <button
                onClick={() => setShowOpenAccountModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {openError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{openError}</span>
              </div>
            )}

            <form onSubmit={handleOpenAccountSubmit} className="mt-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Cooperative Client / Member *</label>
                <select
                  required
                  value={openAccountForm.clientId}
                  onChange={(e) => {
                    const selected = borrowers.find((b) => b.id === e.target.value);
                    setOpenAccountForm({
                      ...openAccountForm,
                      clientId: e.target.value,
                      branchId: selected?.branchId || 'br-main',
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName} ({b.borrowerNumber}) - {b.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Type *</label>
                  <select
                    value={openAccountForm.accountType}
                    onChange={(e) =>
                      setOpenAccountForm({ ...openAccountForm, accountType: e.target.value as SavingsAccountType })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Regular Savings">Regular Savings</option>
                    <option value="Time Deposit / Capital Build-up">Time Deposit / Capital Build-up</option>
                    <option value="Youth / Junior Savings">Youth / Junior Savings</option>
                    <option value="Emergency Fund Savings">Emergency Fund Savings</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Branch *</label>
                  <select
                    value={openAccountForm.branchId}
                    onChange={(e) => setOpenAccountForm({ ...openAccountForm, branchId: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    {branches.map((br) => (
                      <option key={br.id} value={br.id}>
                        {br.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Deposit (₱) *</label>
                  <input
                    type="number"
                    min="1000"
                    step="100"
                    required
                    value={openAccountForm.initialDeposit}
                    onChange={(e) => setOpenAccountForm({ ...openAccountForm, initialDeposit: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Minimum ₱1,000 maintaining balance</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={openAccountForm.paymentMethod}
                    onChange={(e) => setOpenAccountForm({ ...openAccountForm, paymentMethod: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Cash">Cash (Over the counter)</option>
                    <option value="Bank Transfer">Bank Transfer / Deposit</option>
                    <option value="GCash">GCash Transfer</option>
                    <option value="Payroll Deduction">Payroll Deduction</option>
                    <option value="Check">Check Deposit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Receipt (OR) / Reference Number</label>
                <input
                  type="text"
                  placeholder="OR-SAV-2026-XXXX"
                  value={openAccountForm.referenceNumber}
                  onChange={(e) => setOpenAccountForm({ ...openAccountForm, referenceNumber: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opening Notes / Remarks</label>
                <input
                  type="text"
                  value={openAccountForm.notes}
                  onChange={(e) => setOpenAccountForm({ ...openAccountForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              {/* Summary Preview Box */}
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 text-xs space-y-1.5 text-amber-900">
                <div className="font-bold flex items-center justify-between">
                  <span>New Account Specs</span>
                  <span className="text-[11px] bg-amber-200 px-2 py-0.5 rounded-full font-bold">1.0% p.a. Rate</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Target Account ID:</span>
                  <span className="font-mono font-bold text-slate-900">SAV-2026-{String(savingsAccounts.length + 101).padStart(5, '0')}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Maintaining Balance:</span>
                  <span className="font-bold text-slate-900">₱1,000.00 (Locked)</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Available Balance:</span>
                  <span className="font-bold text-emerald-700">
                    ₱{Math.max(0, openAccountForm.initialDeposit - 1000).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOpenAccountModal(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-md"
                >
                  Open Account & Generate Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: RECORD SAVINGS DEPOSIT */}
      {/* ========================================== */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Record Savings Deposit</h3>
                  <p className="text-xs text-slate-400">Issues instant Official Receipt (OR)</p>
                </div>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {depositError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{depositError}</span>
              </div>
            )}

            <form onSubmit={handleDepositSubmit} className="mt-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Savings Account *</label>
                <select
                  required
                  value={depositForm.accountId}
                  onChange={(e) => setDepositForm({ ...depositForm, accountId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none"
                >
                  {savingsAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountNumber} - {a.clientName} (Bal: {formatCurrency(a.balance)} • {a.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Deposit Amount (₱) *</label>
                  <input
                    type="number"
                    min="50"
                    step="50"
                    required
                    value={depositForm.amount}
                    onChange={(e) => setDepositForm({ ...depositForm, amount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={depositForm.paymentMethod}
                    onChange={(e) => setDepositForm({ ...depositForm, paymentMethod: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Cash">Cash (Over the counter)</option>
                    <option value="GCash">GCash Transfer</option>
                    <option value="Bank Transfer">Bank Deposit / Transfer</option>
                    <option value="Check">Check</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Receipt Number / Ref #</label>
                <input
                  type="text"
                  placeholder="OR-SAV-2026-XXXX"
                  value={depositForm.referenceNumber}
                  onChange={(e) => setDepositForm({ ...depositForm, referenceNumber: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deposit Notes</label>
                <input
                  type="text"
                  value={depositForm.notes}
                  onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md"
                >
                  Confirm & Credit Passbook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: RECORD SAVINGS WITHDRAWAL */}
      {/* ========================================== */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Record Savings Withdrawal</h3>
                  <p className="text-xs text-slate-400">Guarded by ₱1,000 maintaining balance</p>
                </div>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {withdrawError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{withdrawError}</span>
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} className="mt-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Savings Account *</label>
                <select
                  required
                  value={withdrawForm.accountId}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, accountId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none"
                >
                  {savingsAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountNumber} - {a.clientName} (Bal: {formatCurrency(a.balance)} • Avail: {formatCurrency(Math.max(0, a.balance - a.maintainingBalance))})
                    </option>
                  ))}
                </select>
              </div>

              {/* Real-time Account Balance Gauge */}
              {(() => {
                const acct = savingsAccounts.find((a) => a.id === withdrawForm.accountId);
                if (!acct) return null;
                const avail = Math.max(0, acct.balance - acct.maintainingBalance);
                const afterWithdrawal = acct.balance - withdrawForm.amount;

                return (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-slate-700 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current Total Balance:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(acct.balance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Maintaining Balance:</span>
                      <span className="font-bold text-slate-900">₱{acct.maintainingBalance.toLocaleString()} (Locked)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Max Withdrawable:</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(avail)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Balance After Withdrawal:</span>
                      <span
                        className={`font-bold ${
                          afterWithdrawal >= acct.maintainingBalance ? 'text-emerald-700' : 'text-rose-600 font-black'
                        }`}
                      >
                        {formatCurrency(afterWithdrawal)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Withdrawal Amount (₱) *</label>
                  <input
                    type="number"
                    min="50"
                    step="50"
                    required
                    value={withdrawForm.amount}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-rose-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payout Method</label>
                  <select
                    value={withdrawForm.paymentMethod}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, paymentMethod: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Cash">Cash (Vault Payout)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Check">Check</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Withdrawal *</label>
                <textarea
                  rows={2}
                  required
                  value={withdrawForm.reason}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, reason: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  placeholder="Medical, tuition, household emergency..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md"
                >
                  Process Withdrawal & Issue Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 4: UPDATE ACCOUNT STATUS */}
      {/* ========================================== */}
      {showStatusModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Update Account Status</h3>
                  <p className="text-xs text-slate-400">{selectedAccount.accountNumber} ({selectedAccount.clientName})</p>
                </div>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {statusError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{statusError}</span>
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="mt-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Status</label>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Current Status:</span>
                  {getStatusBadge(selectedAccount.status)}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Account Status *</label>
                <select
                  value={statusForm.newStatus}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, newStatus: e.target.value as SavingsAccountStatus })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none"
                >
                  <option value="Active">Active (Normal deposits & withdrawals allowed)</option>
                  <option value="Dormant">Dormant (Inactivity hold - auto-reactivates on deposit)</option>
                  <option value="Suspended">Suspended (Blocked for AMLA / Compliance hold)</option>
                  <option value="Closed">Closed (Terminated upon member payout)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audit Justification / Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                  placeholder="Provide audit explanation for this status update..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-md"
                >
                  Save Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 5: ACCOUNT DETAILS, PASSBOOK & STATUS AUDIT */}
      {/* ========================================== */}
      {showDetailsModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg">
                  <PiggyBank className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">{selectedAccount.clientName}</h3>
                    {getStatusBadge(selectedAccount.status)}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Account: {selectedAccount.accountNumber} • Passbook: {selectedAccount.passbookNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200">
                <span className="text-[10px] text-amber-800 font-semibold uppercase">Total Balance</span>
                <p className="text-lg font-black text-amber-950 mt-0.5">{formatCurrency(selectedAccount.balance)}</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Available Balance</span>
                <p className="text-lg font-bold text-emerald-700 mt-0.5">
                  {formatCurrency(Math.max(0, selectedAccount.balance - selectedAccount.maintainingBalance))}
                </p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Total Deposited</span>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{formatCurrency(selectedAccount.totalDeposited)}</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Total Withdrawn</span>
                <p className="text-lg font-bold text-rose-600 mt-0.5">{formatCurrency(selectedAccount.totalWithdrawn)}</p>
              </div>
            </div>

            {/* Status Change Audit History */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-600" />
                Status Change Audit Trail
              </h4>
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 divide-y divide-slate-100 max-h-40 overflow-y-auto">
                {selectedAccount.statusLogs && selectedAccount.statusLogs.length > 0 ? (
                  selectedAccount.statusLogs.map((log) => (
                    <div key={log.id} className="py-2 first:pt-0 last:pb-0 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {log.fromStatus} → <strong className="text-amber-700">{log.toStatus}</strong>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{log.date}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-0.5">{log.reason}</p>
                      <span className="text-[10px] text-slate-400 italic">By: {log.changedBy}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 text-xs py-2 text-center">No status history records found.</div>
                )}
              </div>
            </div>

            {/* Recent Account Transactions */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-amber-600" />
                Account Passbook Entries
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Tx Number</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Balance</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {savingsTransactions
                      .filter(
                        (t) =>
                          t.savingsAccountId === selectedAccount.id ||
                          t.accountNumber === selectedAccount.accountNumber ||
                          t.memberId === selectedAccount.clientId
                      )
                      .map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono text-slate-600">{tx.date}</td>
                          <td className="py-2 px-3 font-mono text-slate-500">{tx.transactionNumber}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                tx.type === 'Deposit'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : tx.type === 'Withdrawal'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td
                            className={`py-2 px-3 font-bold ${
                              tx.type === 'Withdrawal' ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {tx.type === 'Withdrawal' ? '-' : '+'}
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-2 px-3 font-bold text-blue-700">{formatCurrency(tx.balanceAfter)}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => {
                                setActiveReceiptTx(tx);
                                setShowReceiptModal(true);
                              }}
                              className="text-[11px] font-bold text-amber-700 hover:underline"
                            >
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Close Passbook View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 6: OFFICIAL SAVINGS RECEIPT MODAL */}
      {/* ========================================== */}
      <SavingsReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        transaction={activeReceiptTx}
        account={selectedAccount}
      />
    </div>
  );
};
