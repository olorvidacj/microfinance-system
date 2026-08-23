import React, { useState } from 'react';
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
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { Borrower, SavingsTransaction, SavingsWithdrawalRequest } from '../types';
import { calculateMonthlySavingsInterest, formatCurrency } from '../utils/loanMath';

export const SavingsView: React.FC = () => {
  const {
    borrowers,
    savingsTransactions,
    withdrawalRequests,
    interestLogs,
    stats,
    currentUser,
    depositSavings,
    requestSavingsWithdrawal,
    managerApproveWithdrawal,
    managerRejectWithdrawal,
    runMonthlyInterestCrediting,
  } = useLoan();

  const [activeTab, setActiveTab] = useState<'overview' | 'withdrawals' | 'transactions' | 'interest'>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal States
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Borrower | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [interestSuccess, setInterestSuccess] = useState<string | null>(null);

  // Forms
  const [depositForm, setDepositForm] = useState({
    memberId: '',
    amount: 1000,
    paymentMethod: 'Cash',
    notes: 'Regular monthly savings contribution',
  });

  const [withdrawForm, setWithdrawForm] = useState({
    memberId: '',
    amount: 1500,
    reason: 'Medical / Emergency household expenses',
  });

  const filteredMembers = borrowers.filter(
    (b) =>
      b.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.borrowerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.phone.includes(searchTerm)
  );

  const pendingWithdrawals = withdrawalRequests.filter((w) => w.status === 'Pending Approval');

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositForm.memberId || depositForm.amount <= 0) return;
    depositSavings(depositForm);
    setShowDepositModal(false);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    const result = requestSavingsWithdrawal(withdrawForm);
    if (!result.success) {
      setWithdrawError(result.error || 'Failed to submit withdrawal request');
      return;
    }
    setShowWithdrawModal(false);
  };

  const handleRunInterestBatch = () => {
    const res = runMonthlyInterestCrediting();
    setInterestSuccess(
      `Successfully credited 1% annual interest to ${res.membersCount} members! Total interest paid out: ₱${res.totalCredited.toFixed(
        2
      )}`
    );
    setTimeout(() => setInterestSuccess(null), 6000);
  };

  const MAINTAINING_BALANCE = 1000;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner: Savings Services Hub */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30 text-xs font-semibold uppercase tracking-wider">
              <PiggyBank className="w-3.5 h-3.5 text-amber-300" />
              2. Savings Services Module
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cooperative Savings & Capital Build-Up</h1>
            <p className="text-sm text-amber-100/90 max-w-2xl leading-relaxed">
              Earn <strong>1% annual interest credited monthly</strong>. Strict <strong>₱1,000 maintaining balance</strong> rule enforced. Withdrawals recorded by Teller and verified & released by the Manager.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="deposit-savings-btn"
              onClick={() => {
                setDepositForm({ memberId: borrowers[0]?.id || '', amount: 1000, paymentMethod: 'Cash', notes: 'Monthly savings contribution' });
                setShowDepositModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition shadow-md"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Record Savings Deposit
            </button>
            <button
              id="withdraw-savings-btn"
              onClick={() => {
                setWithdrawForm({ memberId: borrowers[0]?.id || '', amount: 1000, reason: 'Personal / Household expense' });
                setWithdrawError(null);
                setShowWithdrawModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-medium transition"
            >
              <ArrowUpRight className="w-4 h-4" />
              Request Withdrawal
            </button>
            <button
              id="run-interest-btn"
              onClick={handleRunInterestBatch}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold rounded-xl text-sm transition shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              Run 1% Interest Batch
            </button>
          </div>
        </div>

        {/* Highlight Stats Strip */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-xs text-amber-200">Total Member Savings Pool</div>
            <div className="text-xl font-bold text-white mt-0.5">{formatCurrency(stats.totalSavingsPool)}</div>
            <div className="text-[11px] text-amber-200/70 mt-0.5">{borrowers.length} Active Savers</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-xs text-amber-200">Annual Interest Rate</div>
            <div className="text-xl font-bold text-white mt-0.5">1.0% p.a.</div>
            <div className="text-[11px] text-amber-200/70 mt-0.5">Credited monthly to passbooks</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-xs text-amber-200">Maintaining Balance Rule</div>
            <div className="text-xl font-bold text-white mt-0.5">₱1,000.00</div>
            <div className="text-[11px] text-amber-200/70 mt-0.5">Mandatory minimum account equity</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-xs text-amber-200">Pending Manager Approvals</div>
            <div className="text-xl font-bold text-white mt-0.5">{pendingWithdrawals.length} Requests</div>
            <div className="text-[11px] text-amber-200/70 mt-0.5">Teller recorded queue</div>
          </div>
        </div>
      </div>

      {/* Alert Banner for Interest Run */}
      {interestSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in duration-150">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-sm font-semibold">{interestSuccess}</div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-amber-600 text-amber-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PiggyBank className="w-4 h-4" />
          <span>Member Passbooks ({borrowers.length})</span>
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
            Manager Withdrawal Approvals{' '}
            {pendingWithdrawals.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs ml-1">
                {pendingWithdrawals.length}
              </span>
            )}
          </span>
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
          <span>Savings Ledger ({savingsTransactions.length})</span>
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
          <span>Monthly 1% Interest Logs ({interestLogs.length})</span>
        </button>
      </div>

      {/* ========================================== */}
      {/* TAB 1: PASSBOOK & MEMBER BALANCES */}
      {/* ========================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search member name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredMembers.length} active savings accounts
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member) => {
              const currentBalance = member.savingsBalance || 0;
              const withdrawableAmount = Math.max(0, currentBalance - MAINTAINING_BALANCE);
              const monthlyInterestProj = calculateMonthlySavingsInterest(currentBalance, 0.01);

              return (
                <div
                  key={member.id}
                  className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:border-amber-200 transition space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={member.avatar}
                        alt={member.fullName}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">{member.fullName}</h4>
                        <span className="text-[11px] text-slate-400 font-mono">{member.borrowerNumber}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        currentBalance >= MAINTAINING_BALANCE
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {currentBalance >= MAINTAINING_BALANCE ? 'Compliant' : 'Below ₱1k'}
                    </span>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 rounded-xl border border-amber-200/60">
                    <div className="text-xs text-amber-800 font-medium">Current Savings Balance</div>
                    <div className="text-2xl font-black text-amber-950 mt-0.5">
                      {formatCurrency(currentBalance)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-amber-900/80 mt-2 pt-2 border-t border-amber-200/50">
                      <span>Withdrawable Limit:</span>
                      <span className="font-bold">{formatCurrency(withdrawableAmount)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[10px]">Monthly 1% Int.</span>
                      <span className="font-bold text-emerald-700">+{formatCurrency(monthlyInterestProj)}/mo</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[10px]">Maintaining Bal.</span>
                      <span className="font-semibold text-slate-700">₱1,000 Locked</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        setDepositForm({ memberId: member.id, amount: 1000, paymentMethod: 'Cash', notes: 'Over-the-counter deposit' });
                        setShowDepositModal(true);
                      }}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
                    >
                      Deposit
                    </button>
                    <button
                      onClick={() => {
                        setWithdrawForm({ memberId: member.id, amount: Math.min(1000, withdrawableAmount), reason: 'Household emergency' });
                        setWithdrawError(null);
                        setShowWithdrawModal(true);
                      }}
                      disabled={withdrawableAmount <= 0}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                        withdrawableAmount > 0
                          ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                          : 'border-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: WITHDRAWAL REQUESTS (MANAGER QUEUE) */}
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
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
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
      {/* TAB 3: SAVINGS TRANSACTION LEDGER */}
      {/* ========================================== */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Savings Account General Ledger</h3>
            <span className="text-xs text-slate-500 font-mono">{savingsTransactions.length} Transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Tx Number</th>
                  <th className="py-2.5 px-3">Member Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Balance After</th>
                  <th className="py-2.5 px-3">OR / Ref</th>
                  <th className="py-2.5 px-3">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {savingsTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{tx.date}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{tx.transactionNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{tx.memberName}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
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
                    <td className="py-2.5 px-3 font-bold text-slate-900">{formatCurrency(tx.amount)}</td>
                    <td className="py-2.5 px-3 font-bold text-blue-700">{formatCurrency(tx.balanceAfter)}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{tx.officialReceiptNumber || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">{tx.processedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <h3 className="text-sm font-bold text-slate-900">Monthly 1% p.a. Savings Interest Audit Logs</h3>
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
      {/* MODAL 1: RECORD SAVINGS DEPOSIT */}
      {/* ========================================== */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
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
              <button onClick={() => setShowDepositModal(false)} className="text-slate-400 text-lg">✕</button>
            </div>

            <form onSubmit={handleDepositSubmit} className="mt-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Cooperative Member *</label>
                <select
                  required
                  value={depositForm.memberId}
                  onChange={(e) => setDepositForm({ ...depositForm, memberId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                >
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName} (Current Bal: {formatCurrency(b.savingsBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deposit Amount (₱) *</label>
                <input
                  type="number"
                  min="100"
                  step="50"
                  required
                  value={depositForm.amount}
                  onChange={(e) => setDepositForm({ ...depositForm, amount: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900"
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
                </select>
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
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs"
                >
                  Confirm & Credit Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: REQUEST SAVINGS WITHDRAWAL */}
      {/* ========================================== */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Request Savings Withdrawal</h3>
                  <p className="text-xs text-slate-400">Teller check & Manager approval workflow</p>
                </div>
              </div>
              <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 text-lg">✕</button>
            </div>

            {withdrawError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{withdrawError}</span>
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} className="mt-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Cooperative Member *</label>
                <select
                  required
                  value={withdrawForm.memberId}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, memberId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                >
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName} (Bal: {formatCurrency(b.savingsBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Withdrawal Amount (₱) *</label>
                <input
                  type="number"
                  min="100"
                  step="50"
                  required
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-rose-600"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600">
                <span className="font-semibold block text-slate-800">Maintaining Balance Rule:</span>
                Account must retain at least <strong>₱1,000.00</strong>.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Withdrawal</label>
                <textarea
                  rows={2}
                  value={withdrawForm.reason}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, reason: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold"
                >
                  Submit for Manager Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
