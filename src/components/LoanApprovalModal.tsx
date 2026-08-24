import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Building2,
  Calendar,
  DollarSign,
  Percent,
  Clock,
  ShieldCheck,
  User,
  HelpCircle,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { Loan, LoanApprovalInfo, LoanRejectionInfo } from '../types';
import { formatCurrency, formatDate } from '../utils/loanMath';

interface LoanApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
}

export const LoanApprovalModal: React.FC<LoanApprovalModalProps> = ({
  isOpen,
  onClose,
  loan,
}) => {
  const { approveLoanApplication, rejectLoanApplication, currentUser, borrowers } = useLoan();

  const [mode, setMode] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [approvedInterestRate, setApprovedInterestRate] = useState<number>(0);
  const [approvedTermMonths, setApprovedTermMonths] = useState<number>(12);
  const [resolutionNumber, setResolutionNumber] = useState<string>('');
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState<string>('');

  // Rejection form
  const [rejectionReason, setRejectionReason] = useState<string>('Debt service burden exceeds disposable income capacity');
  const [rejectionRemarks, setRejectionRemarks] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loan && isOpen) {
      setMode('APPROVE');
      setApprovedAmount(loan.principalAmount);
      setApprovedInterestRate(loan.interestRate);
      setApprovedTermMonths(loan.termMonths);
      setResolutionNumber(`CRECOM-RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setApprovalNotes('Applicant demonstrated satisfactory repayment capacity and verified business/income cash flow.');
      setConditions([
        'Promissory Note and Loan Agreement signed by Borrower and Co-maker',
        'Post-Dated Checks or Auto-Debit Arrangement on file',
      ]);
      setRejectionReason('Debt service burden exceeds 50% net member income threshold');
      setRejectionRemarks('');
      setSuccessMessage(null);
    }
  }, [loan, isOpen]);

  if (!isOpen || !loan) return null;

  const borrower = borrowers.find((b) => b.id === loan.borrowerId);

  const handleAddCondition = () => {
    if (conditionInput.trim()) {
      setConditions([...conditions, conditionInput.trim()]);
      setConditionInput('');
    }
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleApprove = () => {
    if (!approvedAmount || approvedAmount <= 0) return;
    setIsSubmitting(true);

    const approvalData: LoanApprovalInfo = {
      approvedBy: currentUser.name,
      approvedByRole: currentUser.role === 'MANAGER' || currentUser.role === 'SUPER_ADMIN' ? 'General Manager & Credit Committee Chair' : 'Credit Committee Evaluator',
      approvalDate: new Date().toISOString().split('T')[0],
      approvedAmount: Number(approvedAmount),
      approvedInterestRate: Number(approvedInterestRate),
      approvedTermMonths: Number(approvedTermMonths),
      resolutionNumber: resolutionNumber.trim() || undefined,
      conditions: conditions.length > 0 ? conditions : undefined,
      notes: approvalNotes.trim() || 'Approved pursuant to Credit Committee review standards.',
    };

    approveLoanApplication(loan.id, approvalData);
    setSuccessMessage(`Loan #${loan.loanNumber} has been officially APPROVED for ₱${Number(approvedAmount).toLocaleString()}`);

    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 1200);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    setIsSubmitting(true);

    const rejectionData: LoanRejectionInfo = {
      rejectedBy: currentUser.name,
      rejectedByRole: currentUser.role === 'MANAGER' || currentUser.role === 'SUPER_ADMIN' ? 'General Manager' : 'Credit Committee Evaluator',
      rejectionDate: new Date().toISOString().split('T')[0],
      rejectionReason: rejectionReason.trim(),
      remarks: rejectionRemarks.trim() || undefined,
    };

    rejectLoanApplication(loan.id, rejectionData);
    setSuccessMessage(`Loan #${loan.loanNumber} has been REJECTED.`);

    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 1200);
  };

  return (
    <div id="loan-approval-modal" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Credit Committee Review Desk</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/30 text-purple-200 border border-purple-400/40">
                  {loan.loanNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400">Review loan parameters and record formal committee decision</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-lg p-1.5 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Application Summary Strip */}
        <div className="px-6 py-3 bg-slate-50 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-gray-500 block">Applicant Member</span>
            <span className="font-semibold text-gray-900 flex items-center gap-1 mt-0.5">
              <User className="w-3.5 h-3.5 text-gray-400" />
              {loan.borrowerName}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Product</span>
            <span className="font-semibold text-gray-900 mt-0.5 block truncate">{loan.productName}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Requested Principal</span>
            <span className="font-bold text-blue-700 mt-0.5 block">{formatCurrency(loan.principalAmount)}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Current Status</span>
            <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold mt-0.5 ${
              loan.status === 'Approved'
                ? 'bg-emerald-100 text-emerald-800'
                : loan.status === 'Rejected'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {loan.status}
            </span>
          </div>
        </div>

        {successMessage ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Decision Recorded Successfully</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">{successMessage}</p>
          </div>
        ) : (
          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-xs">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-3 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('APPROVE')}
                className={`py-2.5 px-4 rounded-lg font-bold transition flex items-center justify-center gap-2 ${
                  mode === 'APPROVE'
                    ? 'bg-white text-emerald-700 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Approve Application
              </button>
              <button
                type="button"
                onClick={() => setMode('REJECT')}
                className={`py-2.5 px-4 rounded-lg font-bold transition flex items-center justify-center gap-2 ${
                  mode === 'REJECT'
                    ? 'bg-white text-rose-700 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                Reject Application
              </button>
            </div>

            {mode === 'APPROVE' ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-900 text-xs">Loan Approval Decision Record</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Once approved, the loan will advance to <strong>Approved</strong> status, authorizing the disbursement officer to release funds.
                    </p>
                  </div>
                </div>

                {/* Approved Terms Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Approved Principal (₱)</label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={approvedAmount}
                        onChange={(e) => setApprovedAmount(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Approved Rate (% p.a.)</label>
                    <div className="relative">
                      <Percent className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                      <input
                        type="number"
                        min={1}
                        max={60}
                        step={0.5}
                        value={approvedInterestRate}
                        onChange={(e) => setApprovedInterestRate(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg font-semibold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Approved Term (Months)</label>
                    <div className="relative">
                      <Clock className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={approvedTermMonths}
                        onChange={(e) => setApprovedTermMonths(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg font-semibold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Resolution & Approver Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Board / Committee Resolution #</label>
                    <input
                      type="text"
                      value={resolutionNumber}
                      onChange={(e) => setResolutionNumber(e.target.value)}
                      placeholder="e.g. CRECOM-RES-2026-0089"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-medium text-gray-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Approving Officer / Authority</label>
                    <input
                      type="text"
                      disabled
                      value={`${currentUser.name} (${currentUser.role.toUpperCase()})`}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg font-medium text-gray-600"
                    />
                  </div>
                </div>

                {/* Special Approval Conditions */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Special Approval Conditions</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={conditionInput}
                      onChange={(e) => setConditionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCondition();
                        }
                      }}
                      placeholder="Add prerequisite condition (e.g. Post-dated checks, co-maker signature)..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCondition}
                      className="px-3 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-black transition text-xs"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {conditions.map((cond, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                        <span className="text-gray-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {cond}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(idx)}
                          className="text-gray-400 hover:text-rose-600 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Committee Evaluation Notes */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Committee Justification & Notes</label>
                  <textarea
                    rows={2}
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Enter rationale, member evaluation notes, and credit justification..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-900 text-xs">Loan Application Rejection</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      This will update the loan status to <strong>Rejected</strong> and log formal grounds for denial in the member audit trail.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Primary Rejection Reason *</label>
                  <select
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Debt service burden exceeds 50% net member income threshold">Debt service burden exceeds 50% net member income threshold</option>
                    <option value="Unsatisfactory credit repayment history on past facilities">Unsatisfactory credit repayment history on past facilities</option>
                    <option value="Insufficient or unverified guarantor / co-maker capacity">Insufficient or unverified guarantor / co-maker capacity</option>
                    <option value="Inadequate collateral valuation or encumbered security">Inadequate collateral valuation or encumbered security</option>
                    <option value="KYC document discrepancies or unverified employment/business">KYC document discrepancies or unverified employment/business</option>
                    <option value="Maximum cooperative credit exposure limit reached">Maximum cooperative credit exposure limit reached</option>
                    <option value="Other compliance or policy grounds">Other compliance or policy grounds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Detailed Remarks & Recommendations for Applicant</label>
                  <textarea
                    rows={3}
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    placeholder="Provide specific feedback or guidance (e.g. recommend lower requested amount or adding a salaried co-maker)..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        {!successMessage && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition text-xs"
            >
              Cancel
            </button>

            {mode === 'APPROVE' ? (
              <button
                type="button"
                disabled={isSubmitting || approvedAmount <= 0}
                onClick={handleApprove}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2 text-xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting ? 'Recording Approval...' : 'Confirm Loan Approval'}
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting || !rejectionReason.trim()}
                onClick={handleReject}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-600/20 transition flex items-center gap-2 text-xs disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {isSubmitting ? 'Recording Rejection...' : 'Confirm Rejection'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
