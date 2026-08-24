import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  Printer,
  CheckCheck,
  Ban,
  Lock,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { Loan, LoanDisbursementInfo } from '../types';
import { formatCurrency, formatDate } from '../utils/loanMath';

interface LoanDisbursementModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  onDisbursed?: () => void;
}

export const LoanDisbursementModal: React.FC<LoanDisbursementModalProps> = ({
  isOpen,
  onClose,
  loan,
  onDisbursed,
}) => {
  const { disburseLoanRecord, currentUser } = useLoan();

  const [disbursementMethod, setDisbursementMethod] = useState<string>('Bank Transfer');
  const [disbursementDate, setDisbursementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [processingFee, setProcessingFee] = useState<number>(0);
  const [insuranceFee, setInsuranceFee] = useState<number>(300);
  const [capitalBuildUpDeduction, setCapitalBuildUpDeduction] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(500); // Service charge
  const [disbursementNotes, setDisbursementNotes] = useState<string>('');
  const [recipientAccount, setRecipientAccount] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<LoanDisbursementInfo | null>(null);

  useEffect(() => {
    if (loan && isOpen) {
      const gross = loan.principalAmount;
      const procFee = loan.processingFee || Math.round(gross * 0.02);
      const cbu = Math.round(gross * 0.02); // 2% CBU retention
      const ins = 300;
      const other = 500;

      setDisbursementMethod(loan.disbursementMethod || 'Bank Transfer');
      setDisbursementDate(new Date().toISOString().split('T')[0]);
      setReferenceNumber(`TX-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);
      setProcessingFee(procFee);
      setInsuranceFee(ins);
      setCapitalBuildUpDeduction(cbu);
      setOtherDeductions(other);
      setDisbursementNotes(`Disbursement for Loan ${loan.loanNumber} to member ${loan.borrowerName}`);
      setRecipientAccount(loan.disbursementAccount || `${loan.borrowerName} - Bank Account / E-Wallet`);
      setErrorMessage(null);
      setSuccessInfo(null);
    }
  }, [loan, isOpen]);

  if (!isOpen || !loan) return null;

  // Strict check: Is loan approved?
  const isApproved = loan.status === 'Approved';

  const grossAmount = loan.principalAmount;
  const totalDeductions = processingFee + insuranceFee + capitalBuildUpDeduction + otherDeductions;
  const netProceeds = Math.max(0, grossAmount - totalDeductions);

  const handleDisburse = () => {
    if (!isApproved) {
      setErrorMessage(`Disbursement Blocked: Loan #${loan.loanNumber} status is "${loan.status}". Only Approved loans can be disbursed.`);
      return;
    }

    if (!referenceNumber.trim()) {
      setErrorMessage('Please enter a Transaction Reference / Check Number.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const disbursementData: LoanDisbursementInfo = {
      disbursedBy: currentUser.name,
      disbursedByRole: currentUser.role === 'MANAGER' || currentUser.role === 'SUPER_ADMIN' ? 'General Manager & Authorized Disbursing Officer' : 'Loan Cashier / Disbursing Officer',
      disbursementDate,
      disbursementMethod,
      referenceNumber: referenceNumber.trim(),
      grossAmount,
      processingFee,
      insuranceFee,
      capitalBuildUpDeduction,
      otherDeductions,
      netProceeds,
      notes: disbursementNotes.trim(),
    };

    const res = disburseLoanRecord(loan.id, disbursementData);

    if (res.success) {
      setSuccessInfo(disbursementData);
      setIsSubmitting(false);
    } else {
      setErrorMessage(res.message || 'Failed to disburse loan.');
      setIsSubmitting(false);
    }
  };

  return (
    <div id="loan-disbursement-modal" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Loan Disbursement Desk</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                  {loan.loanNumber}
                </span>
              </div>
              <p className="text-xs text-emerald-200/80">Process loan payout, calculate net proceeds, and release funds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-300 hover:text-white rounded-lg p-1.5 hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PROHIBITION BANNER IF NOT APPROVED */}
        {!isApproved && (
          <div className="p-6 bg-rose-50 border-b border-rose-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">Disbursement Blocked by System Policy</h3>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  The system strictly prevents loan disbursement unless the required credit review and approval process has been completed.
                </p>
                <div className="mt-3 p-2.5 bg-white/80 rounded-lg border border-rose-200 text-xs flex items-center justify-between">
                  <span className="text-gray-700">Current Loan Status:</span>
                  <span className="px-2 py-0.5 rounded-md font-bold bg-rose-100 text-rose-800 text-[11px]">
                    {loan.status}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-2 italic">
                  Required Action: Please submit this application for Credit Committee review and obtain an <strong>Approved</strong> verdict before attempting to disburse.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Successful Disbursement Screen */}
        {successInfo ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Funds Released Successfully</h3>
              <p className="text-xs text-gray-500 mt-1">Loan facility has been updated to <strong>Disbursed / Active</strong> status</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-left space-y-2 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-gray-500">Loan Facility:</span>
                <span className="font-bold text-gray-900">{loan.loanNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Borrower:</span>
                <span className="font-semibold text-gray-900">{loan.borrowerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Mode:</span>
                <span className="font-semibold text-gray-900">{successInfo.disbursementMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reference / Check #:</span>
                <span className="font-mono font-bold text-blue-700">{successInfo.referenceNumber}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
                <span className="text-gray-900">Net Proceeds Disbursed:</span>
                <span className="text-emerald-700">{formatCurrency(successInfo.netProceeds)}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition text-xs shadow-md shadow-emerald-600/20"
              >
                Done & Return to Loans
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5 text-xs">
            {/* Applicant Summary */}
            <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-gray-500 block">Member Name</span>
                <span className="font-bold text-gray-900 mt-0.5 block">{loan.borrowerName}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Approved Amount</span>
                <span className="font-bold text-emerald-800 mt-0.5 block">{formatCurrency(loan.principalAmount)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Interest Rate</span>
                <span className="font-semibold text-gray-900 mt-0.5 block">{loan.interestRate}% ({loan.interestType})</span>
              </div>
              <div>
                <span className="text-gray-500 block">Repayment Term</span>
                <span className="font-semibold text-gray-900 mt-0.5 block">{loan.termMonths} Mos ({loan.repaymentFrequency})</span>
              </div>
            </div>

            {/* Financial Deductions & Net Proceeds Calculation Breakdown */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center">
                <span className="font-bold text-gray-800">Disbursement Voucher & Fee Deductions</span>
                <span className="text-[11px] text-gray-500">Cooperative Standard Deduction Schedule</span>
              </div>

              <div className="p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 font-semibold text-gray-900">
                  <span>Gross Approved Principal</span>
                  <span className="text-sm font-bold text-blue-700">{formatCurrency(grossAmount)}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-gray-600 mb-1">Processing Fee (₱)</label>
                    <input
                      type="number"
                      disabled={!isApproved}
                      value={processingFee}
                      onChange={(e) => setProcessingFee(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Loan Insurance Fee (₱)</label>
                    <input
                      type="number"
                      disabled={!isApproved}
                      value={insuranceFee}
                      onChange={(e) => setInsuranceFee(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Capital Build-Up (CBU / Savings) (₱)</label>
                    <input
                      type="number"
                      disabled={!isApproved}
                      value={capitalBuildUpDeduction}
                      onChange={(e) => setCapitalBuildUpDeduction(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Service & Document Charges (₱)</label>
                    <input
                      type="number"
                      disabled={!isApproved}
                      value={otherDeductions}
                      onChange={(e) => setOtherDeductions(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-semibold text-emerald-900">Net Cash / Bank Proceeds Released</span>
                    <span className="text-[11px] text-emerald-700">Gross Principal less ₱{totalDeductions.toLocaleString()} deductions</span>
                  </div>
                  <span className="text-lg font-extrabold text-emerald-800 font-mono">
                    {formatCurrency(netProceeds)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Mode & Release Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Disbursement Channel / Method *</label>
                <select
                  disabled={!isApproved}
                  value={disbursementMethod}
                  onChange={(e) => setDisbursementMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Bank Transfer">Bank Transfer (Direct PESONet / InstaPay)</option>
                  <option value="Check">Manager's Check / Cooperative Check</option>
                  <option value="Cash">Cash Vault Release (Over-the-Counter)</option>
                  <option value="GCash">GCash E-Wallet</option>
                  <option value="Maya">Maya E-Wallet</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Release Date *</label>
                <input
                  type="date"
                  disabled={!isApproved}
                  value={disbursementDate}
                  onChange={(e) => setDisbursementDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Transaction Ref / Check / OR Number *</label>
                <input
                  type="text"
                  disabled={!isApproved}
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. BDO-TRX-994129 or CHK-002914"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Disbursing Officer</label>
                <input
                  type="text"
                  disabled
                  value={`${currentUser.name} (Authorized Disburser)`}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Recipient Account / Destination</label>
              <input
                type="text"
                disabled={!isApproved}
                value={recipientAccount}
                onChange={(e) => setRecipientAccount(e.target.value)}
                placeholder="e.g. BDO Savings 0021-9982-1402 (Maria Santos)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium"
              />
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!successInfo && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition text-xs"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!isApproved || isSubmitting || !referenceNumber.trim()}
              onClick={handleDisburse}
              className={`px-5 py-2.5 rounded-xl font-bold transition flex items-center gap-2 text-xs ${
                isApproved && referenceNumber.trim()
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Receipt className="w-4 h-4" />
              {isSubmitting ? 'Processing Payout...' : 'Confirm & Release Net Proceeds'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
