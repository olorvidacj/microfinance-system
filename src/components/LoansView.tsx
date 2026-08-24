import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  PlusCircle,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  ArrowUpDown,
  Building2,
  Layers,
  Wrench,
  ShieldCheck,
  FileSpreadsheet,
  Clock,
  UserCheck,
  FileCheck,
  DollarSign,
  Receipt,
  Scale,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { Loan, LoanStatus, CoopLoanStep, CreditCommitteeEvaluation, LoanDisbursementVoucher } from '../types';

interface LoansViewProps {
  onSelectLoan: (loan: Loan) => void;
  onOpenNewLoan: () => void;
  onOpenRecordPaymentForLoan: (loan: Loan) => void;
  onOpenRestructureForLoan: (loan: Loan) => void;
  onOpenApprovalDesk?: (loan: Loan) => void;
  onOpenDisbursementDesk?: (loan: Loan) => void;
}

export const LoansView: React.FC<LoansViewProps> = ({
  onSelectLoan,
  onOpenNewLoan,
  onOpenRecordPaymentForLoan,
  onOpenRestructureForLoan,
  onOpenApprovalDesk,
  onOpenDisbursementDesk,
}) => {
  const {
    filteredLoans,
    loanProducts,
    branches,
    borrowers,
    currentUser,
    loanProcessorVerifyLoan,
    bookkeeperVerifyLoan,
    creditCommitteeInterviewLoan,
    prepareLoanVoucher,
    managerApproveLoanVoucher,
    disburseLoan,
    rejectLoan,
    evaluateMultiLoanEligibility,
  } = useLoan();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [stepFilter, setStepFilter] = useState<string>('ALL');

  // Modals for pipeline steps
  const [selectedLoanForCC, setSelectedLoanForCC] = useState<Loan | null>(null);
  const [selectedLoanForVoucher, setSelectedLoanForVoucher] = useState<Loan | null>(null);
  const [selectedMemberForEligibility, setSelectedMemberForEligibility] = useState<string | null>(null);

  // Credit Committee Form State
  const [ccForm, setCcForm] = useState<CreditCommitteeEvaluation>({
    committeeChair: 'Maria Santos (Credit Committee Chair)',
    interviewDate: new Date().toISOString().split('T')[0],
    characterRating: 'High',
    capacityToPayRating: 'Adequate',
    collateralOrGuarantorRating: 'Acceptable',
    debtServiceRatio: 28,
    existingCoopLoansCheck: 'Clear - Good standing on existing savings and share capital',
    approvalVerdict: 'Approved',
    approvedAmount: 40000,
    approvedTermMonths: 12,
    committeeNotes: 'Passed comprehensive credit interview. Debt servicing capacity verified within limits.',
  });

  // Disbursement Voucher Form State
  const [voucherForm, setVoucherForm] = useState({
    paymentMode: 'Bank Transfer' as 'Cash' | 'Check' | 'Bank Transfer' | 'GCash',
    checkNumberOrRef: 'BNK-TX-984210',
  });

  // Filtered loans list
  const displayLoans = useMemo(() => {
    return filteredLoans.filter((loan) => {
      const matchesSearch =
        loan.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.borrowerPhone.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && (loan.status === 'Disbursed' || loan.status === 'In Arrears')) ||
        loan.status === statusFilter;

      const matchesProduct = productFilter === 'ALL' || loan.productId === productFilter;
      const matchesStep = stepFilter === 'ALL' || loan.coopStep === stepFilter;

      return matchesSearch && matchesStatus && matchesProduct && matchesStep;
    });
  }, [filteredLoans, searchTerm, statusFilter, productFilter, stepFilter]);

  const getCoopStepBadge = (step?: CoopLoanStep) => {
    switch (step) {
      case 'SUBMITTED':
        return { label: 'Step 1: Submitted', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'PROCESSOR_VERIFIED':
        return { label: 'Step 2: Processor Verified', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'BOOKKEEPER_VERIFIED':
        return { label: 'Step 3: Bookkeeper Checked', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
      case 'CREDIT_COMM_INTERVIEW':
        return { label: 'Step 4: Credit Comm. Approved', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'VOUCHER_PREPARED':
        return { label: 'Step 5: Voucher Ready', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'MANAGER_APPROVED':
        return { label: 'Step 6: Manager Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'DISBURSED':
        return { label: 'Disbursed & Active', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'REJECTED':
        return { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: 'In Review', color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  const handleOpenCreditCommModal = (loan: Loan) => {
    setSelectedLoanForCC(loan);
    setCcForm({
      committeeChair: 'Maria Santos (Credit Committee Chair)',
      interviewDate: new Date().toISOString().split('T')[0],
      characterRating: 'High',
      capacityToPayRating: 'Adequate',
      collateralOrGuarantorRating: 'Acceptable',
      debtServiceRatio: 28,
      existingCoopLoansCheck: 'Verified good standing in cooperative records',
      approvalVerdict: 'Approved',
      approvedAmount: loan.principalAmount,
      approvedTermMonths: loan.termMonths,
      committeeNotes: `Interviewed ${loan.borrowerName}. Verified purpose: ${loan.purpose}. Recommended for full approval.`,
    });
  };

  const handleSaveCreditComm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForCC) return;
    creditCommitteeInterviewLoan(selectedLoanForCC.id, ccForm);
    setSelectedLoanForCC(null);
  };

  const handleOpenVoucherModal = (loan: Loan) => {
    setSelectedLoanForVoucher(loan);
    setVoucherForm({
      paymentMode: 'Bank Transfer',
      checkNumberOrRef: `BNK-${Date.now().toString().slice(-6)}`,
    });
  };

  const handleSaveVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForVoucher) return;
    prepareLoanVoucher(selectedLoanForVoucher.id, voucherForm);
    setSelectedLoanForVoucher(null);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Top Banner: Cooperative 6-Step Loan Pipeline */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider">
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-300" />
              3. Loans Services Module
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">6-Step Cooperative Loan Pipeline & Vouchers</h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Enforcing the cooperative loan workflow: Member Application &rarr; Loan Processor Check &rarr; Accounting Bookkeeper &rarr; Credit Committee Interview &rarr; Disbursement Voucher &rarr; Manager Sign-off & Payout.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenNewLoan}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Apply for Member Loan</span>
            </button>
          </div>
        </div>

        {/* 6-Step Visual Diagram */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-6 border-t border-white/10 text-xs">
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="flex items-center gap-1.5 font-bold text-blue-300">
              <span className="w-4 h-4 rounded-full bg-blue-500/30 flex items-center justify-center text-[10px] text-white">1</span>
              Application
            </div>
            <p className="text-slate-300 mt-1 text-[11px]">Member submission</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="flex items-center gap-1.5 font-bold text-indigo-300">
              <span className="w-4 h-4 rounded-full bg-indigo-500/30 flex items-center justify-center text-[10px] text-white">2</span>
              Processor
            </div>
            <p className="text-slate-300 mt-1 text-[11px]">Check capacity & docs</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <span className="w-4 h-4 rounded-full bg-cyan-500/30 flex items-center justify-center text-[10px] text-white">3</span>
              Bookkeeper
            </div>
            <p className="text-slate-300 mt-1 text-[11px]">Financial validation</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="flex items-center gap-1.5 font-bold text-purple-300">
              <span className="w-4 h-4 rounded-full bg-purple-500/30 flex items-center justify-center text-[10px] text-white">4</span>
              Credit Comm.
            </div>
            <p className="text-slate-300 mt-1 text-[11px]">Interview & DTI eval</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <span className="w-4 h-4 rounded-full bg-amber-500/30 flex items-center justify-center text-[10px] text-white">5</span>
              Voucher
            </div>
            <p className="text-slate-300 mt-1 text-[11px]">CBU, fees & net proceeds</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="flex items-center gap-1.5 font-bold text-emerald-300">
              <span className="w-4 h-4 rounded-full bg-emerald-500/30 flex items-center justify-center text-[10px] text-white">6</span>
              Manager
            </div>
            <p className="text-slate-300 mt-1 text-[11px]">Approval & Release</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by loan #, borrower name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="sm:w-56">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 focus:outline-none"
            >
              <option value="ALL">All Loan Products</option>
              {loanProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:w-56">
            <select
              value={stepFilter}
              onChange={(e) => setStepFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 focus:outline-none font-semibold text-blue-900"
            >
              <option value="ALL">All Cooperative Steps</option>
              <option value="SUBMITTED">1. Submitted (Pending Processor)</option>
              <option value="PROCESSOR_VERIFIED">2. Processor Checked (Pending Bookkeeper)</option>
              <option value="BOOKKEEPER_VERIFIED">3. Bookkeeper Checked (Pending Credit Comm)</option>
              <option value="CREDIT_COMM_INTERVIEW">4. Credit Comm Interviewed (Pending Voucher)</option>
              <option value="VOUCHER_PREPARED">5. Voucher Prepared (Pending Manager)</option>
              <option value="MANAGER_APPROVED">6. Manager Approved (Ready for Release)</option>
              <option value="DISBURSED">Disbursed & Active</option>
            </select>
          </div>
        </div>

        {/* Status Pill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar text-xs">
          {[
            { id: 'ALL', label: 'All Contracts' },
            { id: 'Draft', label: 'Drafts' },
            { id: 'Submitted', label: 'Submitted' },
            { id: 'Under Review', label: 'Under Review' },
            { id: 'Approved', label: 'Approved (Ready to Disburse)' },
            { id: 'Disbursed', label: 'Disbursed' },
            { id: 'Active', label: 'Active & Current' },
            { id: 'In Arrears', label: 'In Arrears' },
            { id: 'Completed', label: 'Completed' },
            { id: 'Defaulted', label: 'Defaulted' },
            { id: 'Rejected', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full font-medium transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loans Grid / Cards */}
      <div className="space-y-4">
        {displayLoans.map((loan) => {
          const stepInfo = getCoopStepBadge(loan.coopStep);
          const percentPaid = Math.min(100, Math.round((loan.totalPaid / (loan.totalPayable || 1)) * 100));

          return (
            <div
              key={loan.id}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:border-blue-200 transition space-y-4"
            >
              {/* Top Row: Borrower & Step Info */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <img
                    src={loan.borrowerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={loan.borrowerName}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{loan.borrowerName}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                        {loan.loanNumber}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                        {loan.productName}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                      <span>📞 {loan.borrowerPhone}</span>
                      <span>Frequency: <strong>{loan.repaymentFrequency}</strong></span>
                      <span>Interest: {loan.interestRate}% ({loan.interestType})</span>
                      <span>Term: {loan.termMonths} mos.</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${stepInfo.color}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {stepInfo.label}
                  </span>

                  {loan.isIrregularAccount && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Irregular Account
                    </span>
                  )}
                </div>
              </div>

              {/* Middle Financial Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400">Principal Amount:</span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">{formatCurrency(loan.principalAmount)}</p>
                </div>
                <div>
                  <span className="text-slate-400">Remaining Balance:</span>
                  <p className="text-base font-bold text-blue-700 mt-0.5">{formatCurrency(loan.remainingBalance)}</p>
                </div>
                <div>
                  <span className="text-slate-400">Total Repaid ({percentPaid}%):</span>
                  <p className="text-base font-bold text-emerald-700 mt-0.5">{formatCurrency(loan.totalPaid)}</p>
                </div>
                <div>
                  <span className="text-slate-400">Next Payment Due:</span>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    {loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Disbursement Voucher Snapshot (if prepared) */}
              {loan.disbursementVoucher && (
                <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-amber-700" />
                    <div>
                      <span className="font-bold text-amber-900">Voucher {loan.disbursementVoucher.voucherNumber}:</span>{' '}
                      Gross ₱{loan.disbursementVoucher.grossAmount.toLocaleString()} &minus; Deductions (CBU ₱{loan.disbursementVoucher.capitalBuildUpDeduction.toLocaleString()}, Proc ₱{loan.disbursementVoucher.processingFee.toLocaleString()}, Ins ₱{loan.disbursementVoucher.insuranceFee.toLocaleString()}) =&gt; <strong className="text-emerald-800">Net Proceeds: ₱{loan.disbursementVoucher.netProceeds.toLocaleString()}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-amber-800 font-mono">
                    Mode: {loan.disbursementVoucher.paymentMode} {loan.disbursementVoucher.approvedByManager ? '• Approved by Manager' : '• Awaiting Manager Sign'}
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectLoan(loan)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
                  >
                    View Full Schedule & Details
                  </button>

                  <button
                    onClick={() => setSelectedMemberForEligibility(loan.borrowerId)}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-medium transition flex items-center gap-1"
                  >
                    <Scale className="w-3 h-3" />
                    Multi-Loan Capacity Check
                  </button>
                </div>

                {/* Pipeline Step Actions */}
                <div className="flex items-center gap-2">
                  {loan.status === 'Draft' && (
                    <button
                      onClick={() => onSelectLoan(loan)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      Submit Application
                    </button>
                  )}

                  {(loan.status === 'Submitted' || loan.status === 'Under Review') && onOpenApprovalDesk && (
                    <button
                      onClick={() => onOpenApprovalDesk(loan)}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Review & Approve / Reject
                    </button>
                  )}

                  {loan.status === 'Approved' && onOpenDisbursementDesk && (
                    <button
                      onClick={() => onOpenDisbursementDesk(loan)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      Disburse Net Proceeds
                    </button>
                  )}

                  {(loan.status === 'Disbursed' || loan.status === 'In Arrears' || loan.status === 'Active') && (
                    <button
                      onClick={() => onOpenRecordPaymentForLoan(loan)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      Collect Payment (OR)
                    </button>
                  )}

                  {loan.status !== 'Disbursed' && loan.status !== 'Active' && loan.status !== 'Completed' && loan.status !== 'Rejected' && onOpenApprovalDesk && (
                    <button
                      onClick={() => onOpenApprovalDesk(loan)}
                      className="px-2.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-medium transition"
                    >
                      Decision Desk
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================== */}
      {/* MODAL 1: CREDIT COMMITTEE INTERVIEW */}
      {/* ========================================== */}
      {selectedLoanForCC && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Credit Committee Evaluation</h3>
                  <p className="text-xs text-slate-400">Step 4: Interview & Capacity Assessment for {selectedLoanForCC.borrowerName}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLoanForCC(null)} className="text-slate-400 text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveCreditComm} className="mt-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Committee Chairperson *</label>
                  <input
                    type="text"
                    required
                    value={ccForm.committeeChair}
                    onChange={(e) => setCcForm({ ...ccForm, committeeChair: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Interview Date</label>
                  <input
                    type="date"
                    required
                    value={ccForm.interviewDate}
                    onChange={(e) => setCcForm({ ...ccForm, interviewDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Character Rating</label>
                  <select
                    value={ccForm.characterRating}
                    onChange={(e) => setCcForm({ ...ccForm, characterRating: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="High">High (Very Reliable)</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Capacity to Pay</label>
                  <select
                    value={ccForm.capacityToPayRating}
                    onChange={(e) => setCcForm({ ...ccForm, capacityToPayRating: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Strong">Strong</option>
                    <option value="Adequate">Adequate</option>
                    <option value="Marginal">Marginal</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">DTI Ratio (%)</label>
                  <input
                    type="number"
                    value={ccForm.debtServiceRatio}
                    onChange={(e) => setCcForm({ ...ccForm, debtServiceRatio: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Committee Findings & Interview Notes</label>
                <textarea
                  rows={2}
                  value={ccForm.committeeNotes}
                  onChange={(e) => setCcForm({ ...ccForm, committeeNotes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedLoanForCC(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold"
                >
                  Approve Interview & Forward to Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: PREPARE DISBURSEMENT VOUCHER */}
      {/* ========================================== */}
      {selectedLoanForVoucher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Prepare Loan Disbursement Voucher</h3>
                  <p className="text-xs text-slate-400">Step 5: Itemized deductions for {selectedLoanForVoucher.borrowerName}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLoanForVoucher(null)} className="text-slate-400 text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveVoucher} className="mt-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Principal Amount:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(selectedLoanForVoucher.principalAmount)}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>Less: Processing Fee (2%):</span>
                  <span>- {formatCurrency(Math.round(selectedLoanForVoucher.principalAmount * 0.02))}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>Less: Service / Admin Fee:</span>
                  <span>- ₱500.00</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>Less: Capital Build-Up (CBU 2%):</span>
                  <span>- {formatCurrency(Math.round(selectedLoanForVoucher.principalAmount * 0.02))}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>Less: Credit Life Insurance:</span>
                  <span>- ₱300.00</span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between text-sm font-black text-emerald-800">
                  <span>Net Loan Proceeds:</span>
                  <span>
                    {formatCurrency(
                      selectedLoanForVoucher.principalAmount -
                        Math.round(selectedLoanForVoucher.principalAmount * 0.04) -
                        800
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Disbursement Mode *</label>
                  <select
                    value={voucherForm.paymentMode}
                    onChange={(e) => setVoucherForm({ ...voucherForm, paymentMode: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="GCash">GCash Transfer</option>
                    <option value="Check">Manager Check</option>
                    <option value="Cash">Cash Vault Payout</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Check / Reference #</label>
                  <input
                    type="text"
                    required
                    value={voucherForm.checkNumberOrRef}
                    onChange={(e) => setVoucherForm({ ...voucherForm, checkNumberOrRef: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedLoanForVoucher(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold"
                >
                  Save Voucher & Request Manager Sign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: MULTI-LOAN ELIGIBILITY CHECK */}
      {/* ========================================== */}
      {selectedMemberForEligibility && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            {(() => {
              const evalResult = evaluateMultiLoanEligibility(selectedMemberForEligibility);
              const member = borrowers.find((b) => b.id === selectedMemberForEligibility);

              return (
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${evalResult.isEligible ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        <Scale className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Multi-Loan Eligibility Check</h3>
                        <p className="text-xs text-slate-400">{member?.fullName}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedMemberForEligibility(null)} className="text-slate-400 text-lg">✕</button>
                  </div>

                  <div className="mt-6 space-y-4 text-xs">
                    <div className={`p-4 rounded-2xl border ${evalResult.isEligible ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                      <div className="font-bold text-sm">
                        {evalResult.isEligible ? 'Eligible for Concurrent Loan' : 'Ineligible for Additional Loan'}
                      </div>
                      <p className="mt-1 text-[11px]">{evalResult.reasons.join('. ')}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-slate-400 block text-[10px]">Active Loan Count</span>
                        <span className="font-bold text-slate-900">{evalResult.activeLoanCount} of 3 Max</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-slate-400 block text-[10px]">Total Active Debt</span>
                        <span className="font-bold text-blue-700">{formatCurrency(evalResult.activeLoanBalance)}</span>
                      </div>
                    </div>

                    <div className="pt-3 flex justify-end">
                      <button
                        onClick={() => setSelectedMemberForEligibility(null)}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
                      >
                        Close Assessment
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
