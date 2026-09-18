import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  DollarSign,
  Receipt,
  User,
  Calendar,
  Building2,
  Sparkles,
  AlertTriangle,
  Tag,
  ArrowRight,
  Calculator,
  Percent,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import {
  formatCurrency,
  formatDate,
  calculateAdvancePaymentRebate,
  calculateLatePenalty,
  allocatePaymentToSchedule,
} from '../utils/loanMath';
import { Loan, PaymentMethod, PaymentRecord } from '../types';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLoan?: Loan | null;
  onPaymentSuccess: (receipt: PaymentRecord) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  targetLoan,
  onPaymentSuccess,
}) => {
  const { filteredLoans, loanProducts, recordPayment, currentUser } = useLoan();

  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('Official installment remittance');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAdvancePayment, setIsAdvancePayment] = useState<boolean>(false);

  const activeLoans = filteredLoans.filter(
    (l) => l.status === 'Disbursed' || l.status === 'In Arrears' || l.status === 'Active'
  );

  useEffect(() => {
    if (isOpen) {
      const loan = targetLoan || activeLoans[0];
      if (loan) {
        setSelectedLoanId(loan.id);
        const nextInst = loan.schedule?.find((s) => s.status !== 'Paid');
        const suggestedAmount = nextInst
          ? Math.round((nextInst.totalDue - (nextInst.amountPaid || 0)) * 100) / 100
          : Math.min(2500, loan.remainingBalance);
        setAmount(suggestedAmount > 0 ? suggestedAmount : loan.remainingBalance);
        setIsAdvancePayment(false);
      }
      setReference(`OR-REF-${Date.now().toString().slice(-6)}`);
    }
  }, [isOpen, targetLoan, activeLoans.length]);

  const selectedLoan = activeLoans.find((l) => l.id === selectedLoanId) || targetLoan;
  const product = selectedLoan ? loanProducts.find((p) => p.id === selectedLoan.productId) : null;

  const nextInstallment = selectedLoan?.schedule?.find((s) => s.status !== 'Paid');
  const exactDue = nextInstallment
    ? Math.round((nextInstallment.totalDue - (nextInstallment.amountPaid || 0)) * 100) / 100
    : selectedLoan?.remainingBalance || 0;

  const handleLoanChange = (id: string) => {
    setSelectedLoanId(id);
    const l = activeLoans.find((loan) => loan.id === id);
    if (l) {
      const nextInst = l.schedule?.find((s) => s.status !== 'Paid');
      const suggested = nextInst
        ? Math.round((nextInst.totalDue - (nextInst.amountPaid || 0)) * 100) / 100
        : l.remainingBalance;
      setAmount(suggested);
    }
  };

  // Real-time calculation of late penalty or early rebate
  const latePenaltyPreview = useMemo(() => {
    if (selectedLoan && selectedLoan.daysInArrears && selectedLoan.daysInArrears > 0) {
      return calculateLatePenalty(amount, selectedLoan.daysInArrears, product?.latePenaltyRate || 2);
    }
    return 0;
  }, [selectedLoan, amount, product]);

  const advanceRebatePreview = useMemo(() => {
    if (selectedLoan && isAdvancePayment) {
      const unpaidInterest = selectedLoan.totalInterest * (selectedLoan.remainingBalance / (selectedLoan.totalPayable || 1));
      return calculateAdvancePaymentRebate(
        selectedLoan.remainingBalance,
        unpaidInterest,
        product?.earlySettlementRebateRate || 20
      );
    }
    return 0;
  }, [selectedLoan, isAdvancePayment, product]);

  // Real-time allocation simulation
  const allocationPreview = useMemo(() => {
    if (!selectedLoan || amount <= 0) {
      return { principal: 0, interest: 0, penalty: 0, newBalance: selectedLoan?.remainingBalance || 0 };
    }
    const penalty = Math.min(amount, latePenaltyPreview);
    const effectiveScheduleAmount = (amount - penalty) + advanceRebatePreview;

    const { principalPaid, interestPaid } = allocatePaymentToSchedule(
      selectedLoan.schedule || [],
      effectiveScheduleAmount,
      paymentDate
    );

    const deduction = amount - penalty + advanceRebatePreview;
    const newBal = Math.max(0, Math.round((selectedLoan.remainingBalance - deduction) * 100) / 100);

    return {
      principal: principalPaid,
      interest: interestPaid,
      penalty,
      rebate: advanceRebatePreview,
      newBalance: newBal,
    };
  }, [selectedLoan, amount, latePenaltyPreview, advanceRebatePreview, paymentDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || amount <= 0) return;

    const receipt = recordPayment({
      loanId: selectedLoan.id,
      amount: Number(amount),
      paymentMethod,
      transactionReference: reference || `TRX-${Date.now().toString().slice(-6)}`,
      notes,
      date: paymentDate,
      isAdvancePayment,
    });

    onClose();
    if (receipt) {
      onPaymentSuccess(receipt);
    }
  };

  return (
    <div id="record-payment-modal-backdrop" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div id="record-payment-modal-card" className="bg-white rounded-3xl max-w-2xl w-full my-6 shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Record Loan Payment & Issue OR</h2>
              <p className="text-xs text-slate-400">Cooperative installment collections & real-time amortization sync</p>
            </div>
          </div>
          <button id="close-record-payment-btn" onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Select Active Loan Account *</label>
            <select
              id="select-loan-dropdown"
              value={selectedLoanId}
              onChange={(e) => handleLoanChange(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {activeLoans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.borrowerName} • {l.loanNumber} (Bal: {formatCurrency(l.remainingBalance)} • {l.repaymentFrequency})
                </option>
              ))}
            </select>
          </div>

          {selectedLoan && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Borrower Member</span>
                <span className="font-bold text-slate-900 text-xs truncate block">{selectedLoan.borrowerName}</span>
                <span className="text-[10px] text-slate-500">{selectedLoan.loanNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Balance</span>
                <span className="font-mono font-bold text-gold-700 text-sm">{formatCurrency(selectedLoan.remainingBalance)}</span>
                <span className="text-[10px] text-slate-500">of {formatCurrency(selectedLoan.totalPayable)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Next Installment Due</span>
                <span className="font-mono font-bold text-slate-900 text-xs">
                  {selectedLoan.nextPaymentDate ? formatDate(selectedLoan.nextPaymentDate) : 'N/A'}
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold">{formatCurrency(exactDue)} due</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Account Status</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedLoan.status === 'In Arrears' || (selectedLoan.daysInArrears && selectedLoan.daysInArrears > 0)
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {selectedLoan.status === 'In Arrears' || (selectedLoan.daysInArrears && selectedLoan.daysInArrears > 0)
                    ? `${selectedLoan.daysInArrears}d Overdue`
                    : 'Current / Active'}
                </span>
              </div>
            </div>
          )}

          {/* Quick Preset Buttons */}
          {selectedLoan && (
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1.5">Quick Payment Presets:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  id="preset-exact-due-btn"
                  onClick={() => { setAmount(exactDue); setIsAdvancePayment(false); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    amount === exactDue && !isAdvancePayment
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Exact Installment ({formatCurrency(exactDue)})
                </button>
                {selectedLoan.remainingBalance > exactDue * 2 && (
                  <button
                    type="button"
                    id="preset-two-installments-btn"
                    onClick={() => { setAmount(exactDue * 2); setIsAdvancePayment(false); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                      amount === exactDue * 2 && !isAdvancePayment
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    2 Installments ({formatCurrency(exactDue * 2)})
                  </button>
                )}
                <button
                  type="button"
                  id="preset-full-settlement-btn"
                  onClick={() => { setAmount(selectedLoan.remainingBalance); setIsAdvancePayment(true); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    amount === selectedLoan.remainingBalance && isAdvancePayment
                      ? 'bg-navy-900 text-white border-gold-500 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Full Settlement ({formatCurrency(selectedLoan.remainingBalance)})
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Payment Amount (₱) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-sm">₱</span>
                <input
                  id="payment-amount-input"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-base font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Payment Method *</label>
              <select
                id="payment-method-select"
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="Cash">Cash (Over the counter)</option>
                <option value="GCash">GCash Remittance</option>
                <option value="Bank Transfer">Bank Transfer / Online Deposit</option>
                <option value="Debit Card">Debit Card POS</option>
                <option value="Cheque">PDC / Cooperative Cheque</option>
                <option value="Mobile Money">Mobile Money (Maya / ShopeePay)</option>
              </select>
            </div>
          </div>

          {/* Advance Payment Rebate Toggle */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Early Settlement / Advance Payment Rebate
              </span>
              <input
                id="advance-payment-toggle"
                type="checkbox"
                checked={isAdvancePayment}
                onChange={(e) => setIsAdvancePayment(e.target.checked)}
                className="rounded text-gold-600 w-4 h-4 cursor-pointer"
              />
            </label>
            {isAdvancePayment && advanceRebatePreview > 0 && (
              <div className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 p-2 rounded-xl border border-emerald-200 flex items-center justify-between">
                <span>Advance settlement qualifies for interest discount:</span>
                <span className="font-mono font-bold text-emerald-700">- {formatCurrency(advanceRebatePreview)}</span>
              </div>
            )}
          </div>

          {/* Late Penalty Notice if in arrears */}
          {latePenaltyPreview > 0 && (
            <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-[11px] text-rose-800 flex items-center justify-between font-medium">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Overdue surcharge ({selectedLoan?.daysInArrears} days in arrears):</span>
              </div>
              <span className="font-mono font-bold text-rose-700">+{formatCurrency(latePenaltyPreview)}</span>
            </div>
          )}

          {/* Real-time Dynamic Apportionment Simulation */}
          <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
              <span className="flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                Live Payment Apportionment & Balance Calculation
              </span>
              <span className="font-mono text-emerald-700">{formatCurrency(amount)}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px]">
              <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                <span className="text-slate-500 block">Principal Repaid:</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{formatCurrency(allocationPreview.principal)}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                <span className="text-slate-500 block">Interest Service:</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{formatCurrency(allocationPreview.interest)}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                <span className="text-slate-500 block">Late Penalty:</span>
                <span className="font-mono font-bold text-rose-600 text-xs">{formatCurrency(allocationPreview.penalty)}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                <span className="text-slate-500 block">New Remaining Bal:</span>
                <span className="font-mono font-bold text-gold-700 text-xs">{formatCurrency(allocationPreview.newBalance)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Payment Remittance Date</label>
              <input
                id="payment-date-input"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Transaction Reference / OR Ref</label>
              <input
                id="payment-ref-input"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. TRX-904128 or GCash Ref"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Notes & Official Remarks</label>
            <input
              id="payment-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-500 flex items-center justify-between">
            <span>Collecting Officer:</span>
            <span className="font-bold text-slate-800">
              {currentUser.name} ({currentUser.title})
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              id="cancel-payment-btn"
              onClick={onClose}
              className="py-2.5 px-4 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-record-payment-btn"
              className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-2 transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Collect & Issue Official Receipt (OR)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

