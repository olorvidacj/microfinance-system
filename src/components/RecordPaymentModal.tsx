import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate, calculateAdvancePaymentRebate, calculateLatePenalty } from '../utils/loanMath';
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
  const { filteredLoans, loanProducts, recordPayment, currentUser, branches } = useLoan();

  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('Official installment remittance');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAdvancePayment, setIsAdvancePayment] = useState<boolean>(false);

  const activeLoans = filteredLoans.filter(
    (l) => l.status === 'Disbursed' || l.status === 'In Arrears'
  );

  useEffect(() => {
    if (isOpen) {
      const loan = targetLoan || activeLoans[0];
      if (loan) {
        setSelectedLoanId(loan.id);
        const nextInst = loan.schedule.find((s) => s.status !== 'Paid');
        const suggestedAmount = nextInst ? nextInst.totalDue - nextInst.amountPaid : Math.min(2500, loan.remainingBalance);
        setAmount(suggestedAmount > 0 ? suggestedAmount : loan.remainingBalance);
        setIsAdvancePayment(false);
      }
      setReference(`OR-REF-${Date.now().toString().slice(-6)}`);
    }
  }, [isOpen, targetLoan, filteredLoans]);

  const selectedLoan = activeLoans.find((l) => l.id === selectedLoanId) || targetLoan;
  const product = selectedLoan ? loanProducts.find((p) => p.id === selectedLoan.productId) : null;

  const handleLoanChange = (id: string) => {
    setSelectedLoanId(id);
    const l = activeLoans.find((loan) => loan.id === id);
    if (l) {
      const nextInst = l.schedule.find((s) => s.status !== 'Paid');
      const suggested = nextInst ? nextInst.totalDue - nextInst.amountPaid : l.remainingBalance;
      setAmount(suggested);
    }
  };

  if (!isOpen) return null;

  // Real-time calculation of late penalty or early rebate
  let latePenaltyPreview = 0;
  if (selectedLoan && selectedLoan.daysInArrears && selectedLoan.daysInArrears > 0) {
    latePenaltyPreview = calculateLatePenalty(amount, selectedLoan.daysInArrears, product?.latePenaltyRate || 2);
  }

  let advanceRebatePreview = 0;
  if (selectedLoan && isAdvancePayment) {
    const unpaidInterest = selectedLoan.totalInterest * (selectedLoan.remainingBalance / selectedLoan.totalPayable);
    advanceRebatePreview = calculateAdvancePaymentRebate(selectedLoan.remainingBalance, unpaidInterest, product?.earlySettlementRebateRate || 20);
  }

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full my-8 shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Issue Official Receipt (OR)</h2>
              <p className="text-xs text-slate-400">Cooperative collection & early settlement rebate engine</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Select Active Loan Account *</label>
            <select
              value={selectedLoanId}
              onChange={(e) => handleLoanChange(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
            >
              {activeLoans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.borrowerName} • {l.loanNumber} (Bal: {formatCurrency(l.remainingBalance)} - {l.repaymentFrequency})
                </option>
              ))}
            </select>
          </div>

          {selectedLoan && (
            <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">{selectedLoan.borrowerName}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {selectedLoan.loanNumber} • Schedule: {selectedLoan.repaymentFrequency}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-blue-800 font-mono">
                  Balance: {formatCurrency(selectedLoan.remainingBalance)}
                </div>
                <div className="text-[10px] text-slate-400">Next due: {formatDate(selectedLoan.nextPaymentDate)}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Payment Amount (₱) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-emerald-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
              >
                <option value="Cash">Cash (Over the counter)</option>
                <option value="GCash">GCash Payment</option>
                <option value="Bank Transfer">Bank Transfer / Deposit</option>
              </select>
            </div>
          </div>

          {/* Advance Payment Rebate Toggle */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Early Settlement / Advance Payment Rebate
              </span>
              <input
                type="checkbox"
                checked={isAdvancePayment}
                onChange={(e) => setIsAdvancePayment(e.target.checked)}
                className="rounded text-blue-600 w-4 h-4"
              />
            </label>
            {isAdvancePayment && advanceRebatePreview > 0 && (
              <div className="text-[11px] text-emerald-700 font-medium bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                Qualifies for <strong>₱{advanceRebatePreview.toFixed(2)}</strong> interest discount / rebate on unearned interest!
              </div>
            )}
          </div>

          {/* Late Penalty Notice if in arrears */}
          {latePenaltyPreview > 0 && (
            <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-[11px] text-rose-800 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Account is {selectedLoan?.daysInArrears} days in arrears. Includes ₱{latePenaltyPreview.toFixed(2)} late penalty fee.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Remittance Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">OR / Reference Number</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. OR-2026-8921"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Notes & Official Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 flex items-center justify-between">
            <span>Collecting Officer:</span>
            <span className="font-semibold text-slate-800">
              {currentUser.name} ({currentUser.title})
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-2"
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
