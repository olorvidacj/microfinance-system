import React, { useState } from 'react';
import {
  Smartphone,
  CreditCard,
  PiggyBank,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Shield,
  User,
  History,
  Send,
  Sparkles,
  ChevronRight,
  Download,
  Info,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency } from '../utils/loanMath';
import { Borrower, Loan } from '../types';

interface ClientPortalViewProps {
  /** When provided (client session), the portal is locked to this member only */
  lockedBorrowerId?: string;
  /** Hides staff-demo controls and adjusts copy for real client sessions */
  isClientSession?: boolean;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  lockedBorrowerId,
  isClientSession,
}) => {
  const { borrowers, loans, loanProducts, requestSavingsWithdrawal, recordPayment } = useLoan();

  // Selected Portal Member (Locked for authenticated clients; default first member for staff demo)
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    lockedBorrowerId || borrowers[0]?.id || 'b-1'
  );
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(false);
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [portalTab, setPortalTab] = useState<'home' | 'loans' | 'savings' | 'apply' | 'pay'>('home');

  // Self Service Loan Application Form State
  const [applyProductId, setApplyProductId] = useState<string>(loanProducts[0]?.id || '');
  const [applyAmount, setApplyAmount] = useState<number>(20000);
  const [applyTermMonths, setApplyTermMonths] = useState<number>(6);
  const [applyPurpose, setApplyPurpose] = useState<string>('Sari-sari store inventory replenishment');
  const [applySuccessMessage, setApplySuccessMessage] = useState<string>('');

  // Self Service Withdrawal State
  const [withdrawAmount, setWithdrawAmount] = useState<number>(1000);
  const [withdrawReason, setWithdrawReason] = useState<string>('Family emergency / medical allowance');
  const [withdrawSuccessMessage, setWithdrawSuccessMessage] = useState<string>('');

  // Digital Repayment State
  const [payAmount, setPayAmount] = useState<number>(1850);
  const [payMethod, setPayMethod] = useState<string>('GCash');
  const [payRef, setPayRef] = useState<string>('GCASH-' + Math.floor(100000 + Math.random() * 900000));
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string>('');

  const currentMember = borrowers.find((b) => b.id === (lockedBorrowerId || selectedMemberId)) ||
    (lockedBorrowerId ? undefined : borrowers[0]);
  const memberLoans = loans.filter((l) => l.borrowerId === currentMember?.id);
  const activeLoan = memberLoans.find((l) => l.status === 'Disbursed' || l.status === 'In Arrears') || memberLoans[0];

  const handleApplyLoan = (e: React.FormEvent) => {
    e.preventDefault();
    setApplySuccessMessage(`Your online loan application for ₱${applyAmount.toLocaleString()} has been submitted to HOSCOMO Loan Origination Queue! Reference: APP-${Math.floor(10000 + Math.random() * 90000)}`);
    setTimeout(() => setApplySuccessMessage(''), 7000);
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember) return;
    if (withdrawAmount > (currentMember.savingsBalance || 1000) - 1000) {
      alert('Withdrawal exceeds allowable limit. You must maintain ₱1,000 maintaining balance.');
      return;
    }

    const res = requestSavingsWithdrawal({
      memberId: currentMember.id,
      amount: withdrawAmount,
      reason: withdrawReason,
    });

    if (res.success) {
      setWithdrawSuccessMessage(`Withdrawal request of ₱${withdrawAmount.toLocaleString()} submitted for Branch Manager Review!`);
    } else {
      alert(res.error || 'Failed to submit withdrawal');
    }
    setTimeout(() => setWithdrawSuccessMessage(''), 6000);
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoan) return;
    recordPayment({
      loanId: activeLoan.id,
      amount: payAmount,
      paymentMethod: (payMethod as any) || 'GCash',
      transactionReference: payRef,
      notes: 'Self-Service Mobile Payment via Portal',
    });
    setPaymentSuccessMessage(`Payment of ₱${payAmount.toLocaleString()} received! Official Receipt generated in your transaction history.`);
    setTimeout(() => setPaymentSuccessMessage(''), 6000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
              <Smartphone className="w-4 h-4" />
              <span>HOSCOMO Client Self-Service Portal {isClientSession ? '' : '(Staff Demo View)'}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isClientSession ? `Welcome back, ${currentMember?.fullName?.split(' ')[0] || 'Member'}` : 'Member Self-Service & Digital Banking'}
            </h1>
            {!isClientSession && (
              <p className="text-xs text-slate-500 mt-1">
                Simulate the member-facing portal where cooperative clients can monitor passbooks, view active loans, apply for emergency micro-credit, and perform digital repayments.
              </p>
            )}
          </div>

          {/* Member Switcher & Mobile Frame Toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            {!lockedBorrowerId && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-500 font-medium">Viewing Member:</span>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName} ({b.borrowerNumber})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!lockedBorrowerId && (
              <button
                onClick={() => setIsMobileFrame(!isMobileFrame)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  isMobileFrame
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>{isMobileFrame ? 'Exit Phone Frame' : 'Mobile Phone Mode'}</span>
              </button>
            )}
        </div>
      </div>

      {/* Locked member not found (e.g. data not synced yet) */}
      {lockedBorrowerId && !currentMember && (
        <div className="bg-white border border-amber-200 rounded-3xl p-10 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 mt-4">Member Record Unavailable</h2>
          <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
            Your linked member profile could not be loaded right now. Please refresh the page or try
            again shortly — your data remains secure.
          </p>
        </div>
      )}

      {/* Main Container (Responsive Grid or Centered Phone Frame) */}
      <div className={`mx-auto transition-all ${isMobileFrame ? 'max-w-md' : 'max-w-5xl'}`}>
        {/* Phone Mockup Wrapper */}
        <div
          className={`bg-slate-900 text-white transition-all ${
            isMobileFrame
              ? 'rounded-[44px] p-4 shadow-2xl border-4 border-slate-800 ring-8 ring-slate-950'
              : 'rounded-3xl p-6 sm:p-8 shadow-xl'
          }`}
        >
          {/* Mobile Speaker / Camera Notch if in Phone Frame */}
          {isMobileFrame && (
            <div className="flex justify-center mb-4">
              <div className="w-24 h-4 bg-slate-800 rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
              </div>
            </div>
          )}

          {/* Member Header in App */}
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 font-bold text-lg">
                {currentMember?.fullName.charAt(0)}
              </div>
              <div>
                <span className="text-[11px] text-blue-200 block">Mabuhay, Member</span>
                <h3 className="font-bold text-white text-base leading-tight">{currentMember?.fullName}</h3>
                <span className="text-xs text-blue-300/80 font-mono">{currentMember?.borrowerNumber}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {currentMember?.memberStatus || 'Active Member'}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Tier {currentMember?.creditTier}</span>
            </div>
          </div>

          {/* Quick Sub-Navigation within Portal */}
          <div className="flex gap-2 py-4 overflow-x-auto no-scrollbar text-xs">
            <button
              onClick={() => setPortalTab('home')}
              className={`px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                portalTab === 'home' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setPortalTab('savings')}
              className={`px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                portalTab === 'savings' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Passbook & Savings
            </button>
            <button
              onClick={() => setPortalTab('loans')}
              className={`px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                portalTab === 'loans' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              My Loans ({memberLoans.length})
            </button>
            <button
              onClick={() => setPortalTab('pay')}
              className={`px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                portalTab === 'pay' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Pay Online
            </button>
            <button
              onClick={() => setPortalTab('apply')}
              className={`px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                portalTab === 'apply' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              + Apply Micro-Loan
            </button>
          </div>

          {/* Success Alerts */}
          {(applySuccessMessage || withdrawSuccessMessage || paymentSuccessMessage) && (
            <div className="p-3.5 mb-4 bg-emerald-950/80 border border-emerald-500/40 rounded-2xl text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{applySuccessMessage || withdrawSuccessMessage || paymentSuccessMessage}</span>
            </div>
          )}

          {/* Tab 1: Home Overview */}
          {portalTab === 'home' && (
            <div className="space-y-4">
              {/* Virtual ATM / Passbook Card */}
              <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-5 rounded-2xl shadow-lg relative overflow-hidden text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] text-blue-100/80 uppercase tracking-wider font-semibold">
                      HOSCOMO Savings Passbook Balance
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {showBalance ? formatCurrency(currentMember?.savingsBalance || 1500) : '₱ ••••••••'}
                      </span>
                      <button onClick={() => setShowBalance(!showBalance)} className="text-blue-200 hover:text-white">
                        {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <PiggyBank className="w-8 h-8 text-blue-200/50" />
                </div>

                <div className="mt-6 flex justify-between items-end text-xs border-t border-white/10 pt-3">
                  <div>
                    <span className="text-[10px] text-blue-200 block">Share Capital</span>
                    <span className="font-semibold">{formatCurrency(currentMember?.shareCapital || 15000)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-200 block">Interest Yield</span>
                    <span className="font-semibold text-emerald-300">1.0% p.a. Compounded</span>
                  </div>
                </div>
              </div>

              {/* Active Loan Widget */}
              {activeLoan ? (
                <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-blue-400 font-semibold">{activeLoan.loanNumber}</span>
                    <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-semibold">
                      {activeLoan.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Remaining Loan Balance</span>
                      <span className="text-xl font-bold text-white">
                        {formatCurrency(activeLoan.remainingBalance)}
                      </span>
                    </div>
                    <button
                      onClick={() => setPortalTab('pay')}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20"
                    >
                      Pay Due
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400 flex justify-between border-t border-slate-700/60 pt-2">
                    <span>Next Due: {activeLoan.nextPaymentDate || 'Aug 25, 2026'}</span>
                    <span className="text-slate-300 font-medium">
                      Est. Installment: ₱{Math.round(activeLoan.totalPayable / activeLoan.totalInstallments).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl text-center space-y-2">
                  <p className="text-xs text-slate-400">You currently have no active loan balance.</p>
                  <button
                    onClick={() => setPortalTab('apply')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold"
                  >
                    Apply for Member Loan
                  </button>
                </div>
              )}

              {/* Quick Action Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setPortalTab('savings')}
                  className="bg-slate-800 hover:bg-slate-700 p-3.5 rounded-2xl border border-slate-700 text-left transition"
                >
                  <ArrowDownLeft className="w-5 h-5 text-amber-400 mb-1" />
                  <span className="font-semibold text-xs text-white block">Request Withdrawal</span>
                  <span className="text-[10px] text-slate-400">Withdraw from savings</span>
                </button>
                <button
                  onClick={() => setPortalTab('apply')}
                  className="bg-slate-800 hover:bg-slate-700 p-3.5 rounded-2xl border border-slate-700 text-left transition"
                >
                  <Sparkles className="w-5 h-5 text-blue-400 mb-1" />
                  <span className="font-semibold text-xs text-white block">Quick Loan</span>
                  <span className="text-[10px] text-slate-400">Fast micro-credit approval</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Savings Passbook & Withdrawal Request */}
          {portalTab === 'savings' && (
            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center justify-between">
                  <span>Savings Passbook Ledger</span>
                  <span className="text-xs text-emerald-400">Maintaining: ₱1,000.00</span>
                </h4>
                <div className="p-3 bg-slate-900 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Available Withdrawable:</span>
                    <span className="font-bold text-white">
                      {formatCurrency(Math.max(0, (currentMember?.savingsBalance || 1500) - 1000))}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Annual Cooperative Dividend / Interest:</span>
                    <span className="font-semibold text-emerald-400">1.0% per annum</span>
                  </div>
                </div>
              </div>

              {/* Submit Withdrawal Request */}
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3">
                <h4 className="font-bold text-white text-sm">Submit Online Savings Withdrawal</h4>
                <form onSubmit={handleWithdraw} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 block mb-1">Amount to Withdraw (₱)</label>
                    <input
                      type="number"
                      min={100}
                      max={Math.max(100, (currentMember?.savingsBalance || 1500) - 1000)}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">Reason / Purpose</label>
                    <input
                      type="text"
                      value={withdrawReason}
                      onChange={(e) => setWithdrawReason(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md transition"
                  >
                    Submit Withdrawal to Branch Teller
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Tab 3: My Loans */}
          {portalTab === 'loans' && (
            <div className="space-y-4">
              <h4 className="font-bold text-white text-sm">Your Loan Accounts</h4>
              {memberLoans.length > 0 ? (
                memberLoans.map((loan) => (
                  <div key={loan.id} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-blue-400">{loan.loanNumber}</span>
                      <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                        {loan.status}
                      </span>
                    </div>
                    <div className="text-slate-300 font-semibold text-sm">{loan.productName}</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-400 py-1">
                      <div>
                        <span>Principal: </span>
                        <strong className="text-white">{formatCurrency(loan.principalAmount)}</strong>
                      </div>
                      <div>
                        <span>Balance: </span>
                        <strong className="text-emerald-400">{formatCurrency(loan.remainingBalance)}</strong>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 border-t border-slate-700 pt-2 flex justify-between">
                      <span>Term: {loan.termMonths} Months ({loan.repaymentFrequency})</span>
                      <span>Matures: {loan.maturityDate}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 bg-slate-800/40 rounded-2xl text-xs">
                  No active loan records found.
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Pay Online */}
          {portalTab === 'pay' && (
            <div className="space-y-4">
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center justify-between">
                  <span>Digital Loan Repayment</span>
                  <QrCode className="w-5 h-5 text-blue-400" />
                </h4>

                <form onSubmit={handlePay} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 block mb-1">Repayment Amount (₱)</label>
                    <input
                      type="number"
                      value={payAmount}
                      onChange={(e) => setPayAmount(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-base"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1">Payment Method</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    >
                      <option value="GCash">GCash Mobile Wallet</option>
                      <option value="Maya">Maya Wallet</option>
                      <option value="Online Bank Transfer">Online Bank (InstaPay / PESONet)</option>
                      <option value="Branch Counter">Branch Counter Cashier</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1">Transaction Reference</label>
                    <input
                      type="text"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl shadow-lg transition"
                  >
                    Confirm & Submit Repayment
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Tab 5: Apply Micro-Loan */}
          {portalTab === 'apply' && (
            <div className="space-y-4">
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3">
                <h4 className="font-bold text-white text-sm">Self-Service Micro-Loan Origination</h4>
                <p className="text-xs text-slate-400">
                  Instant preliminary credit evaluation powered by HOSCOMO Credit Scoring.
                </p>

                <form onSubmit={handleApplyLoan} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 block mb-1">Select Loan Product</label>
                    <select
                      value={applyProductId}
                      onChange={(e) => setApplyProductId(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    >
                      {loanProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.interestRate}% {p.interestType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 block mb-1">Desired Amount (₱)</label>
                      <input
                        type="number"
                        step={1000}
                        value={applyAmount}
                        onChange={(e) => setApplyAmount(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 block mb-1">Tenor (Months)</label>
                      <input
                        type="number"
                        min={1}
                        max={36}
                        value={applyTermMonths}
                        onChange={(e) => setApplyTermMonths(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1">Stated Purpose of Funds</label>
                    <input
                      type="text"
                      value={applyPurpose}
                      onChange={(e) => setApplyPurpose(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition"
                  >
                    Submit Loan Application
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
