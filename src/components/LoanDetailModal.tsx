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
  Receipt,
  XCircle,
  ArrowRight,
  Lock,
  Filter,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate, getComputedInstallmentStatus } from '../utils/loanMath';
import { Loan } from '../types';

interface LoanDetailModalProps {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenRecordPayment: (loan: Loan) => void;
  onOpenRestructure: (loan: Loan) => void;
  onOpenApprovalDesk?: (loan: Loan) => void;
  onOpenDisbursementDesk?: (loan: Loan) => void;
}

export const LoanDetailModal: React.FC<LoanDetailModalProps> = ({
  loan,
  isOpen,
  onClose,
  onOpenRecordPayment,
  onOpenRestructure,
  onOpenApprovalDesk,
  onOpenDisbursementDesk,
}) => {
  const { branches, currentUser, submitLoanForApproval, startLoanReview } = useLoan();
  const [activeTab, setActiveTab] = useState<'schedule' | 'approval' | 'voucher' | 'collateral'>('schedule');
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'OVERDUE' | 'UPCOMING' | 'PAID' | 'PARTIAL'>('ALL');

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
      getComputedInstallmentStatus(s),
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
        return 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200';
      case 'Overdue':
        return 'bg-rose-100 text-rose-800 font-bold border border-rose-200 animate-pulse';
      case 'Due Today':
      case 'Due':
        return 'bg-amber-100 text-amber-800 font-bold border border-amber-200';
      case 'Partially Paid':
      case 'Partial':
        return 'bg-gold-500/20 text-gold-800 font-bold border border-gold-400/30';
      case 'Upcoming':
      case 'Pending':
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 font-medium';
    }
  };

  const getLoanStatusBadge = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'Submitted':
        return 'bg-gold-500/20 text-gold-800 border-gold-400/30';
      case 'Under Review':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Disbursed':
      case 'Active':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'Completed':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'In Arrears':
      case 'Defaulted':
      case 'Rejected':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const filteredSchedule = loan.schedule.filter((item) => {
    const computed = getComputedInstallmentStatus(item);
    if (scheduleFilter === 'OVERDUE') return computed === 'Overdue';
    if (scheduleFilter === 'UPCOMING') return computed === 'Upcoming' || computed === 'Due';
    if (scheduleFilter === 'PAID') return computed === 'Paid';
    if (scheduleFilter === 'PARTIAL') return computed === 'Partially Paid';
    return true;
  });

  const paidCount = loan.schedule.filter((s) => getComputedInstallmentStatus(s) === 'Paid').length;
  const overdueCount = loan.schedule.filter((s) => getComputedInstallmentStatus(s) === 'Overdue').length;
  const upcomingCount = loan.schedule.filter((s) => {
    const comp = getComputedInstallmentStatus(s);
    return comp === 'Upcoming' || comp === 'Due';
  }).length;


  return (
    <div id="loan-detail-modal" className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
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
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gold-500/20 text-gold-800">
                  {loan.loanNumber}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getLoanStatusBadge(loan.status)}`}
                >
                  {loan.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {loan.productName} • {branch?.name || 'Main Branch'} • Repayment: {loan.repaymentFrequency}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dynamic Action Buttons based on Loan Lifecycle */}
            {loan.status === 'Draft' && (
              <button
                onClick={() => submitLoanForApproval(loan.id, 'Submitted from loan detail')}
                className="px-3.5 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <FileCheck className="w-4 h-4" />
                Submit for Approval
              </button>
            )}

            {(loan.status === 'Submitted' || loan.status === 'Under Review') && onOpenApprovalDesk && (
              <button
                onClick={() => {
                  onClose();
                  onOpenApprovalDesk(loan);
                }}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-purple-600/20"
              >
                <FileCheck className="w-4 h-4" />
                Review & Decision Desk
              </button>
            )}

            {loan.status === 'Approved' && onOpenDisbursementDesk && (
              <button
                onClick={() => {
                  onClose();
                  onOpenDisbursementDesk(loan);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Receipt className="w-4 h-4" />
                Disburse Funds Now
              </button>
            )}

            {(loan.status === 'Disbursed' || loan.status === 'In Arrears' || loan.status === 'Active') && (
              <button
                onClick={() => {
                  onClose();
                  onOpenRecordPayment(loan);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <CreditCard className="w-4 h-4" />
                Record Payment
              </button>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loan Lifecycle Stepper Progress */}
        <div className="px-6 py-3 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            {[
              { key: 'Draft', label: '1. Draft' },
              { key: 'Submitted', label: '2. Submitted' },
              { key: 'Under Review', label: '3. Under Review' },
              { key: 'Approved', label: '4. Approved' },
              { key: 'Disbursed', label: '5. Disbursed' },
              { key: 'Completed', label: '6. Completed' },
            ].map((step, idx) => {
              const statusOrder = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Disbursed', 'Completed'];
              const currentIdx = statusOrder.indexOf(loan.status === 'Active' ? 'Disbursed' : loan.status);
              const stepIdx = idx;
              const isPast = currentIdx > stepIdx;
              const isCurrent = currentIdx === stepIdx || (loan.status === 'In Arrears' && step.key === 'Disbursed');
              const isRejected = loan.status === 'Rejected' && step.key === 'Approved';
              const isDefaulted = loan.status === 'Defaulted' && step.key === 'Completed';

              return (
                <div key={step.key} className="flex items-center gap-1">
                  <div
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] ${
                      isCurrent
                        ? 'bg-gold-500 text-white font-bold'
                        : isPast
                        ? 'bg-emerald-500/30 text-emerald-300 font-medium'
                        : isRejected
                        ? 'bg-rose-500 text-white font-bold'
                        : isDefaulted
                        ? 'bg-amber-500 text-white font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : null}
                    {isCurrent && <Clock className="w-3 h-3 text-slate-300" />}
                    <span>{step.label}</span>
                  </div>
                  {idx < 5 && <ArrowRight className="w-3 h-3 text-slate-600 mx-0.5" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border-b border-slate-100">
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
            <span className="text-xs text-slate-500 block">Principal Amount</span>
            <span className="text-base font-bold text-slate-900 block mt-0.5">
              {formatCurrency(loan.principalAmount)}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">Interest: {loan.interestRate}% ({loan.interestType})</span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
            <span className="text-xs text-slate-500 block">Remaining Balance</span>
            <span className="text-base font-bold text-gold-700 block mt-0.5">
              {formatCurrency(loan.remainingBalance)}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">Total Due: {formatCurrency(loan.totalPayable)}</span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
            <span className="text-xs text-slate-500 block">Total Repaid</span>
            <span className="text-base font-bold text-emerald-700 block mt-0.5">
              {formatCurrency(loan.totalPaid)}
            </span>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percentPaid}%` }} />
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
            <span className="text-xs text-slate-500 block">Next Due Date</span>
            <span className="text-base font-bold text-amber-700 block mt-0.5">
              {loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A (Pending)'}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">Maturity: {formatDate(loan.maturityDate)}</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 px-6 gap-6 bg-slate-50/50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-3.5 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'schedule'
                ? 'border-gold-500 text-gold-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Amortization Schedule ({loan.schedule.length})
          </button>
          <button
            onClick={() => setActiveTab('approval')}
            className={`py-3.5 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'approval'
                ? 'border-gold-500 text-gold-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            Approval & Governance
            {loan.approvalInfo && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          </button>
          <button
            onClick={() => setActiveTab('voucher')}
            className={`py-3.5 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'voucher'
                ? 'border-gold-500 text-gold-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Disbursement Voucher
            {loan.disbursementVoucher && <span className="w-2 h-2 rounded-full bg-gold-500" />}
          </button>
          <button
            onClick={() => setActiveTab('collateral')}
            className={`py-3.5 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'collateral'
                ? 'border-gold-500 text-gold-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Guarantors & Security
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 max-h-[55vh] overflow-y-auto space-y-4 text-xs">
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Installment Repayment Schedule</h3>
                  <p className="text-xs text-slate-500">
                    {loan.totalInstallments} total installments • {loan.repaymentFrequency} schedule • {paidCount} paid, {upcomingCount} upcoming, {overdueCount} overdue
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportScheduleToCSV}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Installment Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setScheduleFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    scheduleFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({loan.schedule.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleFilter('UPCOMING')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    scheduleFilter === 'UPCOMING' ? 'bg-white text-gold-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Upcoming ({upcomingCount})
                </button>
                {overdueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setScheduleFilter('OVERDUE')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      scheduleFilter === 'OVERDUE' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-600 hover:bg-rose-100'
                    }`}
                  >
                    Overdue ({overdueCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setScheduleFilter('PAID')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    scheduleFilter === 'PAID' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Paid ({paidCount})
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3.5">#</th>
                      <th className="py-2.5 px-3.5">Due Date</th>
                      <th className="py-2.5 px-3.5">Principal</th>
                      <th className="py-2.5 px-3.5">Interest</th>
                      <th className="py-2.5 px-3.5">Total Due</th>
                      <th className="py-2.5 px-3.5">Amount Paid</th>
                      <th className="py-2.5 px-3.5">Remaining Bal</th>
                      <th className="py-2.5 px-3.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredSchedule.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No installments match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredSchedule.map((item) => {
                        const computedStatus = getComputedInstallmentStatus(item);
                        return (
                          <tr
                            key={item.installmentNumber}
                            className={`hover:bg-slate-50/80 transition ${
                              computedStatus === 'Paid'
                                ? 'bg-emerald-50/20'
                                : computedStatus === 'Overdue'
                                ? 'bg-rose-50/30'
                                : ''
                            }`}
                          >
                            <td className="py-2.5 px-3.5 font-bold text-slate-900">{item.installmentNumber}</td>
                            <td className="py-2.5 px-3.5 font-medium">{formatDate(item.dueDate)}</td>
                            <td className="py-2.5 px-3.5 font-mono">{formatCurrency(item.principal)}</td>
                            <td className="py-2.5 px-3.5 font-mono text-slate-500">{formatCurrency(item.interest)}</td>
                            <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                              {formatCurrency(item.totalDue)}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono text-emerald-700 font-semibold">
                              {item.amountPaid > 0 ? formatCurrency(item.amountPaid) : '-'}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono font-medium">
                              {formatCurrency(item.remainingBalance)}
                            </td>
                            <td className="py-2.5 px-3.5 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] ${getStatusBadge(
                                  computedStatus
                                )}`}
                              >
                                {computedStatus}
                              </span>
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

          {activeTab === 'approval' && (
            <div className="space-y-4">
              {loan.approvalInfo ? (
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-emerald-950 text-sm">Credit Committee Official Approval Record</h4>
                        <p className="text-xs text-emerald-700">Resolution #{loan.approvalInfo.resolutionNumber || 'CRECOM-STANDARD'}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-xs border border-emerald-300">
                      APPROVED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-emerald-700 block font-medium">Approved Principal</span>
                      <span className="font-bold text-emerald-950 text-sm">{formatCurrency(loan.approvalInfo.approvedAmount)}</span>
                    </div>
                    <div>
                      <span className="text-emerald-700 block font-medium">Approved Interest Rate</span>
                      <span className="font-bold text-emerald-950">{loan.approvalInfo.approvedInterestRate}% p.a.</span>
                    </div>
                    <div>
                      <span className="text-emerald-700 block font-medium">Approved Tenor</span>
                      <span className="font-bold text-emerald-950">{loan.approvalInfo.approvedTermMonths} Months</span>
                    </div>
                    <div>
                      <span className="text-emerald-700 block font-medium">Approval Date</span>
                      <span className="font-bold text-emerald-950">{formatDate(loan.approvalInfo.approvalDate)}</span>
                    </div>
                  </div>

                  <div className="border-t border-emerald-200/80 pt-3 text-xs">
                    <span className="text-emerald-800 font-semibold block mb-1">Approving Authority:</span>
                    <p className="text-emerald-950">{loan.approvalInfo.approvedBy} — <span className="text-emerald-700">{loan.approvalInfo.approvedByRole}</span></p>
                  </div>

                  {loan.approvalInfo.conditions && loan.approvalInfo.conditions.length > 0 && (
                    <div className="border-t border-emerald-200/80 pt-3 text-xs space-y-1.5">
                      <span className="text-emerald-800 font-semibold block">Prerequisite Approval Conditions:</span>
                      {loan.approvalInfo.conditions.map((cond, i) => (
                        <div key={i} className="flex items-center gap-2 text-emerald-900 bg-white/80 p-2 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{cond}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {loan.approvalInfo.notes && (
                    <div className="border-t border-emerald-200/80 pt-3 text-xs">
                      <span className="text-emerald-800 font-semibold block mb-1">Committee Justification Notes:</span>
                      <p className="text-emerald-900 bg-white/70 p-2.5 rounded-lg italic border border-emerald-100">{loan.approvalInfo.notes}</p>
                    </div>
                  )}
                </div>
              ) : loan.rejectionInfo ? (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-rose-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
                        <XCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-rose-950 text-sm">Loan Application Rejection Record</h4>
                        <p className="text-xs text-rose-700">Recorded on {formatDate(loan.rejectionInfo.rejectionDate)}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-rose-100 text-rose-800 font-bold rounded-full text-xs border border-rose-300">
                      REJECTED
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-rose-700 font-medium block">Reason for Rejection:</span>
                      <p className="font-bold text-rose-900">{loan.rejectionInfo.rejectionReason}</p>
                    </div>
                    {loan.rejectionInfo.remarks && (
                      <div>
                        <span className="text-rose-700 font-medium block">Remarks:</span>
                        <p className="text-rose-900 italic bg-white/80 p-2.5 rounded-lg border border-rose-200">{loan.rejectionInfo.remarks}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-rose-700 font-medium block">Decided By:</span>
                      <p className="text-rose-900">{loan.rejectionInfo.rejectedBy} ({loan.rejectionInfo.rejectedByRole})</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <Clock className="w-10 h-10 text-slate-400 mx-auto" />
                  <h4 className="font-bold text-slate-800">Pending Credit Committee Decision</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    This loan application is currently in <strong>{loan.status}</strong> status. Open the Review Desk to record formal approval or rejection.
                  </p>
                  {onOpenApprovalDesk && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenApprovalDesk(loan);
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                    >
                      Open Credit Approval Desk
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'voucher' && (
            <div className="space-y-4">
              {loan.disbursementVoucher || loan.disbursementInfo ? (
                <div className="bg-gold-500/10 border border-gold-400/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-gold-400/30 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-navy-950 text-sm">Disbursement Check Voucher</h4>
                        <p className="text-xs text-gold-700">Voucher #: {loan.disbursementVoucher?.voucherNumber || loan.loanNumber}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-xs">
                      RELEASED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-xl border border-gold-400/30">
                    <div>
                      <span className="text-slate-500 block">Gross Loan Amount</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">{formatCurrency(loan.principalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Processing & Deductions</span>
                      <span className="font-bold text-rose-600 font-mono">
                        - {formatCurrency(loan.processingFee + (loan.disbursementVoucher?.insuranceFee || 300) + (loan.disbursementVoucher?.capitalBuildUpDeduction || 0))}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Net Proceeds Released</span>
                      <span className="font-extrabold text-emerald-700 font-mono text-sm">
                        {formatCurrency(loan.disbursementVoucher?.netProceeds || loan.principalAmount - loan.processingFee)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Payment Mode</span>
                      <span className="font-semibold text-slate-900">{loan.disbursementVoucher?.paymentMode || loan.disbursementMethod || 'Bank Transfer'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Reference / Check #</span>
                      <span className="font-mono font-bold text-gold-800">{loan.disbursementVoucher?.checkNumberOrRef || loan.disbursementInfo?.referenceNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Disbursed Date</span>
                      <span className="font-semibold text-slate-900">{loan.disbursedDate ? formatDate(loan.disbursedDate) : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <Lock className="w-10 h-10 text-slate-400 mx-auto" />
                  <h4 className="font-bold text-slate-800">No Disbursement Voucher Generated</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {loan.status === 'Approved'
                      ? 'This loan is approved and ready for disbursement voucher generation and release.'
                      : `Disbursement is prohibited while loan is in "${loan.status}" status. Approval is required.`}
                  </p>
                  {loan.status === 'Approved' && onOpenDisbursementDesk && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenDisbursementDesk(loan);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                    >
                      Open Disbursement Desk
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'collateral' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-2">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <User className="w-4 h-4 text-gold-600" />
                  Co-Makers & Guarantors
                </h4>
                {loan.guarantors && loan.guarantors.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {loan.guarantors.map((g) => (
                      <div key={g.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{g.fullName}</p>
                          <p className="text-[11px] text-slate-500">{g.relationship} • Phone: {g.phone}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 block text-[10px]">Monthly Income</span>
                          <span className="font-bold text-emerald-700 font-mono">{formatCurrency(g.monthlyIncome)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-2 italic">No secondary guarantor required for this loan product tier.</p>
                )}
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-2">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Pledged Collateral & Assets
                </h4>
                {loan.collaterals && loan.collaterals.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {loan.collaterals.map((c) => (
                      <div key={c.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{c.type}: {c.description}</p>
                          <p className="text-[11px] text-slate-500">Reg/Serial: {c.registrationNumber || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 block text-[10px]">Estimated Value</span>
                          <span className="font-bold text-gold-700 font-mono">{formatCurrency(c.estimatedValue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-2 italic">Clean loan facility (uncollateralized / chattel mortgage not registered).</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-500">
            Originated by: <strong className="text-slate-800">{loan.loanOfficerName || 'Loan Officer'}</strong> on {formatDate(loan.applicationDate)}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
