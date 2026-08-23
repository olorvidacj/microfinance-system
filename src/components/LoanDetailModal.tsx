import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  Building2,
  DollarSign,
  User,
  ShieldAlert,
  Percent,
  Layers,
  FileCheck,
  FileSpreadsheet,
  ShieldCheck,
  Tag,
  Clock,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { Loan } from '../types';

interface LoanDetailModalProps {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenRecordPayment: (loan: Loan) => void;
  onOpenRestructure: (loan: Loan) => void;
}

export const LoanDetailModal: React.FC<LoanDetailModalProps> = ({
  loan,
  isOpen,
  onClose,
  onOpenRecordPayment,
  onOpenRestructure,
}) => {
  const { branches, currentUser } = useLoan();
  const [activeTab, setActiveTab] = useState<'schedule' | 'pipeline' | 'voucher' | 'collateral'>('schedule');

  if (!isOpen || !loan) return null;

  const branch = branches.find((b) => b.id === loan.branchId);
  const percentPaid = Math.min(100, Math.round((loan.totalPaid / (loan.totalPayable || 1)) * 100));

  const exportScheduleToCSV = () => {
    const headers = [
      'Installment #',
      'Due Date',
      'Principal (PHP)',
      'Interest (PHP)',
      'Total Due (PHP)',
      'Paid (PHP)',
      'Remaining Balance (PHP)',
      'Status',
    ];

    const rows = loan.schedule.map((s) => [
      s.installmentNumber,
      s.dueDate,
      s.principal,
      s.interest,
      s.totalDue,
      s.amountPaid,
      s.remainingBalance,
      s.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `coop_loan_schedule_${loan.loanNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-emerald-100 text-emerald-800 font-semibold';
      case 'Overdue':
        return 'bg-rose-100 text-rose-800 font-bold';
      case 'Due Today':
        return 'bg-amber-100 text-amber-800 font-bold';
      case 'Partially Paid':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full my-8 shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src={loan.borrowerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={loan.borrowerName}
              className="w-12 h-12 rounded-2xl object-cover border border-slate-300"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{loan.borrowerName}</h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {loan.loanNumber}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    loan.status === 'In Arrears'
                      ? 'bg-rose-100 text-rose-800'
                      : loan.status === 'Disbursed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {loan.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {loan.productName} • {branch?.name} • Frequency: {loan.repaymentFrequency}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(loan.status === 'Disbursed' || loan.status === 'In Arrears') && (
              <button
                onClick={() => {
                  onClose();
                  onOpenRecordPayment(loan);
                }}
                className="flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Record Payment (OR)</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Financial KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-white border-b border-slate-100">
          <div>
            <span className="text-xs text-slate-400">Principal Approved</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{formatCurrency(loan.principalAmount)}</div>
            <span className="text-[11px] text-slate-500">Rate: {loan.interestRate}% ({loan.interestType})</span>
          </div>

          <div>
            <span className="text-xs text-slate-400">Total Payable</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{formatCurrency(loan.totalPayable)}</div>
            <span className="text-[11px] text-slate-500">Interest: {formatCurrency(loan.totalInterest)}</span>
          </div>

          <div>
            <span className="text-xs text-slate-400">Total Paid ({percentPaid}%)</span>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">{formatCurrency(loan.totalPaid)}</div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${percentPaid}%` }} />
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-400">Remaining Balance</span>
            <div className="text-lg font-bold text-blue-700 mt-0.5">{formatCurrency(loan.remainingBalance)}</div>
            <span className="text-[11px] text-slate-500">
              Next Due: {loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Modal Sub-Tabs */}
        <div className="flex border-b border-slate-200 px-6 gap-6 bg-slate-50/60 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Amortization Schedule ({loan.schedule.length} Installments)
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'pipeline' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            6-Step Cooperative Approval Log
          </button>
          <button
            onClick={() => setActiveTab('voucher')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'voucher' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Disbursement Voucher & Deductions
          </button>
        </div>

        {/* Sub-Tab Content */}
        <div className="p-6 max-h-[420px] overflow-y-auto text-xs">
          {activeTab === 'schedule' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  {loan.repaymentFrequency} Installment Breakdown
                </span>
                <button
                  onClick={exportScheduleToCSV}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Principal</th>
                      <th className="py-2.5 px-3">Interest</th>
                      <th className="py-2.5 px-3">Total Due</th>
                      <th className="py-2.5 px-3">Amount Paid</th>
                      <th className="py-2.5 px-3">Balance After</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loan.schedule.map((item) => (
                      <tr key={item.installmentNumber} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-500">{item.installmentNumber}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{formatDate(item.dueDate)}</td>
                        <td className="py-2.5 px-3">{formatCurrency(item.principal)}</td>
                        <td className="py-2.5 px-3">{formatCurrency(item.interest)}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{formatCurrency(item.totalDue)}</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-700">{formatCurrency(item.amountPaid)}</td>
                        <td className="py-2.5 px-3 text-slate-600">{formatCurrency(item.remainingBalance)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${getStatusBadge(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200/80 p-4 rounded-2xl text-blue-900">
                <span className="font-bold">6-Stage Cooperative Governance Chain:</span>
                <p className="mt-0.5 text-xs text-blue-800">
                  Every cooperative loan undergoes strict segregation of duties between Loan Processor, Bookkeeper, Credit Committee, and Manager.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">1</span>
                  <div>
                    <span className="font-bold text-slate-900">Loan Origination & Application</span>
                    <p className="text-slate-500 mt-0.5">Submitted on {loan.applicationDate} for purpose: {loan.purpose}</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">2</span>
                  <div>
                    <span className="font-bold text-slate-900">Loan Processor Check</span>
                    <p className="text-slate-500 mt-0.5">Verified member documents and basic repayment capacity.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-xs">3</span>
                  <div>
                    <span className="font-bold text-slate-900">Bookkeeper / Accounting Check</span>
                    <p className="text-slate-500 mt-0.5">Confirmed member share capital equity and verified no conflicting records.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">4</span>
                  <div>
                    <span className="font-bold text-slate-900">Credit Committee Interview & Evaluation</span>
                    <p className="text-slate-500 mt-0.5">
                      {loan.creditCommitteeEval
                        ? `Interviewed on ${loan.creditCommitteeEval.interviewDate}. Verdict: ${loan.creditCommitteeEval.approvalVerdict}. Notes: ${loan.creditCommitteeEval.committeeNotes}`
                        : 'Credit Committee evaluation logged and approved.'}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs">5</span>
                  <div>
                    <span className="font-bold text-slate-900">Loan Disbursement Voucher Prepared</span>
                    <p className="text-slate-500 mt-0.5">
                      {loan.disbursementVoucher
                        ? `Voucher ${loan.disbursementVoucher.voucherNumber} prepared by ${loan.disbursementVoucher.preparedByBookkeeper}`
                        : 'Voucher ready.'}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">6</span>
                  <div>
                    <span className="font-bold text-slate-900">Manager Approval & Fund Release</span>
                    <p className="text-slate-500 mt-0.5">
                      {loan.disbursementVoucher?.approvedByManager
                        ? `Authorized by ${loan.disbursementVoucher.approvedByManager} on ${loan.disbursementVoucher.approvedDate}`
                        : 'Manager authorization verified.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'voucher' && (
            <div className="space-y-4">
              {loan.disbursementVoucher ? (
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <span className="text-xs text-slate-400">Cooperative Voucher Number</span>
                      <div className="font-mono font-bold text-slate-900 text-sm">{loan.disbursementVoucher.voucherNumber}</div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">
                      {loan.disbursementVoucher.paymentMode} Payout
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-600">Gross Principal Amount</span>
                      <span className="font-bold text-slate-900">{formatCurrency(loan.disbursementVoucher.grossAmount)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-rose-700">
                      <span>Less: Processing Fee</span>
                      <span>- {formatCurrency(loan.disbursementVoucher.processingFee)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-rose-700">
                      <span>Less: Service / Admin Fee</span>
                      <span>- {formatCurrency(loan.disbursementVoucher.serviceFee)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-rose-700">
                      <span>Less: Capital Build-Up (CBU Contribution)</span>
                      <span>- {formatCurrency(loan.disbursementVoucher.capitalBuildUpDeduction)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-rose-700">
                      <span>Less: Credit Life Insurance</span>
                      <span>- {formatCurrency(loan.disbursementVoucher.insuranceFee)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-t-2 border-slate-300 text-sm font-black text-emerald-800">
                      <span>Net Proceeds Released to Member</span>
                      <span>{formatCurrency(loan.disbursementVoucher.netProceeds)}</span>
                    </div>
                  </div>

                  <div className="pt-2 text-[11px] text-slate-400">
                    Prepared by: {loan.disbursementVoucher.preparedByBookkeeper} • Approved by: {loan.disbursementVoucher.approvedByManager || 'Pending Sign'}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <span>Disbursement voucher will be generated during Stage 5 of the pipeline.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            Originated by {loan.loanOfficerName} • Loan ID: {loan.id}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
