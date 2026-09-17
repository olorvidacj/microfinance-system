import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet, CheckCircle2, XCircle, Clock, Wallet, Eye, Download, History as HistoryIcon, ArrowUpRight, Check,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { MOCK_LOANS, AdminLoan, formatPHP, formatDate } from '../data/mockData';

const STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Active', 'Completed', 'Disbursed'];
const PRODUCTS = ['Regular Microloan', 'Livelihood Loan', 'Emergency Loan', 'Agricultural Loan', 'Business Loan'];

type LoanAction = 'approve' | 'reject' | 'disburse';

export const LoanManagementPage: React.FC = () => {
  const [loans, setLoans] = useState<AdminLoan[]>(MOCK_LOANS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [selected, setSelected] = useState<AdminLoan | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'schedule' | 'history'>('overview');
  const [action, setAction] = useState<{ type: LoanAction; loan: AdminLoan } | null>(null);
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    return loans.filter((l) => {
      const q = search.toLowerCase();
      const matchesSearch = l.clientName.toLowerCase().includes(q) || l.loanId.toLowerCase().includes(q) || l.clientId.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || l.status === statusFilter;
      const matchesProduct = !productFilter || l.loanProduct === productFilter;
      return matchesSearch && matchesStatus && matchesProduct;
    });
  }, [loans, search, statusFilter, productFilter]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const performAction = () => {
    if (!action) return;
    const nextStatus = action.type === 'approve' ? 'Approved' : action.type === 'reject' ? 'Rejected' : 'Disbursed';
    setLoans(loans.map((l) => l.id === action.loan.id ? { ...l, status: nextStatus } : l));
    setSelected(loans.find((l) => l.id === action.loan.id) ? { ...action.loan, status: nextStatus } : null);
    showToast(`Loan ${action.loan.loanId} ${action.type === 'approve' ? 'approved' : action.type === 'reject' ? 'rejected' : 'marked for disbursement'}.`);
  };

  const totals = {
    count: loans.length,
    pending: loans.filter((l) => l.status === 'Pending' || l.status === 'Under Review').length,
    approved: loans.filter((l) => l.status === 'Approved').length,
    active: loans.filter((l) => l.status === 'Active').length,
    completed: loans.filter((l) => l.status === 'Completed').length,
    rejected: loans.filter((l) => l.status === 'Rejected').length,
    totalAmount: loans.reduce((s, l) => s + l.loanAmount, 0),
    outstanding: loans.reduce((s, l) => s + l.outstandingBalance, 0),
  };

  const sampleSchedule = [
    { n: 1, due: '2025-07-15', principal: 4167, interest: 521, total: 4688, status: 'Paid' },
    { n: 2, due: '2025-08-15', principal: 4167, interest: 521, total: 4688, status: 'Paid' },
    { n: 3, due: '2025-09-15', principal: 4167, interest: 521, total: 4688, status: 'Paid' },
    { n: 4, due: '2025-10-15', principal: 4167, interest: 521, total: 4688, status: 'Upcoming' },
    { n: 5, due: '2025-11-15', principal: 4167, interest: 521, total: 4688, status: 'Upcoming' },
    { n: 6, due: '2025-12-15', principal: 4167, interest: 521, total: 4688, status: 'Upcoming' },
    { n: 7, due: '2026-01-15', principal: 4167, interest: 521, total: 4688, status: 'Upcoming' },
    { n: 8, due: '2026-02-15', principal: 4167, interest: 521, total: 4688, status: 'Upcoming' },
  ];

  const approvalHistory = [
    { date: '2025-06-20', action: 'Loan Processor verified eligibility & credit score', by: 'Maria Santos', status: 'Complete' },
    { date: '2025-06-22', action: 'Credit Committee appraisal & risk review', by: 'Credit Committee', status: 'Complete' },
    { date: '2025-06-25', action: 'Approved by General Manager', by: 'Roberto Villanueva', status: 'Complete' },
    { date: '2025-06-27', action: 'Disbursement released via Teller Counter', by: 'Cashier Desk', status: 'Complete' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Loan Portfolio & Management' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Loan Portfolio & Approval Desk</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Originate, evaluate, approve, and disburse microfinance and livelihood credit facilities.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Loan Registry" value={totals.count} icon={FileSpreadsheet} iconColor="text-blue-600" iconBg="bg-blue-50" change={15} changeLabel="this quarter" />
        <StatCard title="Pending Appraisal" value={totals.pending} icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50" accentBorder />
        <StatCard title="Approved & Active" value={totals.approved + totals.active} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Rejected Facilities" value={totals.rejected} icon={XCircle} iconColor="text-rose-500" iconBg="bg-rose-50" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Facilities" value={totals.active} icon={Wallet} iconColor="text-indigo-600" iconBg="bg-indigo-50" />
        <StatCard title="Matured / Paid Off" value={totals.completed} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Total Committed Amount" value={formatPHP(totals.totalAmount)} icon={Wallet} iconColor="text-amber-600" iconBg="bg-amber-50" subtitle="Total disbursed capital" />
        <StatCard title="Outstanding Balance" value={formatPHP(totals.outstanding)} icon={Wallet} iconColor="text-blue-600" iconBg="bg-blue-50" subtitle={`${Math.round((totals.outstanding / totals.totalAmount) * 100)}% active exposure`} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by loan ID, borrower name, or member ID..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Loan Statuses" className="w-full md:w-48" />
          <FilterSelect value={productFilter} onChange={setProductFilter} options={PRODUCTS.map((p) => ({ value: p, label: p }))} placeholder="All Loan Products" className="w-full md:w-52" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            {
              key: 'loanId',
              header: 'Loan Reference',
              render: (l) => <span className="font-mono text-xs font-bold text-[#091527]">{l.loanId}</span>,
            },
            {
              key: 'client',
              header: 'Borrower',
              render: (l) => (
                <div>
                  <p className="font-bold text-slate-900">{l.clientName}</p>
                  <p className="text-[11px] font-mono text-slate-400">{l.clientId}</p>
                </div>
              ),
            },
            {
              key: 'loanProduct',
              header: 'Credit Facility',
              render: (l) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200/60">
                  {l.loanProduct}
                </span>
              ),
            },
            {
              key: 'loanAmount',
              header: 'Principal',
              render: (l) => <span className="font-bold text-slate-900">{formatPHP(l.loanAmount)}</span>,
            },
            {
              key: 'loanTerm',
              header: 'Term',
              render: (l) => <span className="text-xs text-slate-600 font-medium">{l.loanTerm} mos</span>,
            },
            {
              key: 'interestRate',
              header: 'Rate',
              render: (l) => <span className="text-xs text-slate-700 font-medium">{l.interestRate}%/mo</span>,
            },
            {
              key: 'paymentFrequency',
              header: 'Frequency',
              render: (l) => <span className="text-xs text-slate-600">{l.paymentFrequency}</span>,
            },
            {
              key: 'applicationDate',
              header: 'Date Filed',
              render: (l) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(l.applicationDate)}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (l) => <Badge dot>{l.status}</Badge>,
            },
            {
              key: 'actions',
              header: 'Action',
              render: (l) => (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setSelected(l); setDetailTab('overview'); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" /> View
                  </button>
                  {l.status === 'Under Review' && (
                    <button
                      onClick={() => setAction({ type: 'approve', loan: l })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                  {l.status === 'Approved' && (
                    <button
                      onClick={() => setAction({ type: 'disburse', loan: l })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#091527] hover:bg-[#132c52] rounded-lg transition shadow-xs"
                    >
                      <Wallet className="w-3.5 h-3.5 text-amber-400" /> Disburse
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Loan Details Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Loan Account File & Lifecycle" subtitle={selected?.loanId} maxWidth="2xl">
        {selected && (
          <div className="space-y-4">
            {/* Header banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-[#091527] via-[#102442] to-[#091527] text-white border border-amber-500/20 shadow-md">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-white">{selected.clientName}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {selected.loanProduct}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono mt-0.5">{selected.clientId} · {selected.branch}</p>
              </div>
              <Badge dot>{selected.status}</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Principal Amount</p>
                <p className="font-bold text-sm text-slate-900 mt-0.5">{formatPHP(selected.loanAmount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Outstanding</p>
                <p className="font-bold text-sm text-slate-900 mt-0.5">{formatPHP(selected.outstandingBalance)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Monthly Interest</p>
                <p className="font-bold text-sm text-amber-700 mt-0.5">{selected.interestRate}% / mo</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Amortization / Mo</p>
                <p className="font-bold text-sm text-slate-900 mt-0.5">{formatPHP(selected.monthlyPayment)}</p>
              </div>
            </div>

            <div className="flex gap-1 border-b border-slate-200">
              {(['overview', 'schedule', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition border-b-2 -mb-px ${
                    detailTab === tab ? 'border-amber-500 text-[#091527]' : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {tab === 'overview' ? 'Account Details' : tab === 'schedule' ? 'Amortization Table' : 'Audit Trail & Approval'}
                </button>
              ))}
            </div>

            {detailTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Loan Product</p>
                    <p className="font-bold text-xs text-slate-800">{selected.loanProduct}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Repayment Term</p>
                    <p className="font-bold text-xs text-slate-800">{selected.loanTerm} calendar months</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Repayment Schedule</p>
                    <p className="font-bold text-xs text-slate-800">{selected.paymentFrequency}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Stated Purpose</p>
                    <p className="font-medium text-xs text-slate-700">Small business working capital and retail inventory</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Filing Date</p>
                    <p className="font-bold text-xs text-slate-800">{formatDate(selected.applicationDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Release Date</p>
                    <p className="font-bold text-xs text-slate-800">{selected.status === 'Disbursed' || selected.status === 'Active' ? 'July 01, 2025' : 'Pending Clearance'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Maturity Date</p>
                    <p className="font-bold text-xs text-slate-800">{selected.status === 'Active' ? 'June 15, 2026' : 'Upon Release'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Assigned Credit Officer</p>
                    <p className="font-bold text-xs text-slate-800">Maria Santos (Branch Officer)</p>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'schedule' && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <DataTable
                  data={sampleSchedule}
                  keyField="n"
                  columns={[
                    { key: 'n', header: 'Inst #', render: (s) => <span className="text-xs font-mono text-slate-500">#{s.n}</span> },
                    { key: 'due', header: 'Due Date', render: (s) => <span className="text-xs font-semibold text-slate-800">{s.due}</span> },
                    { key: 'principal', header: 'Principal', render: (s) => <span className="text-xs font-medium text-slate-700">{formatPHP(s.principal)}</span> },
                    { key: 'interest', header: 'Interest', render: (s) => <span className="text-xs font-medium text-slate-700">{formatPHP(s.interest)}</span> },
                    { key: 'total', header: 'Total Installment', render: (s) => <span className="text-xs font-bold text-slate-900">{formatPHP(s.total)}</span> },
                    { key: 'status', header: 'Status', render: (s) => <Badge>{s.status}</Badge> },
                  ]}
                />
              </div>
            )}

            {detailTab === 'history' && (
              <div className="space-y-3 p-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
                {approvalHistory.map((h, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1 ${h.status === 'Complete' ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-amber-500'}`} />
                      {i < approvalHistory.length - 1 && <span className="w-0.5 flex-1 bg-slate-200 my-1" />}
                    </div>
                    <div className={`pb-3 ${i === approvalHistory.length - 1 ? '' : 'border-b border-slate-200/60'} flex-1`}>
                      <p className="text-xs font-bold text-slate-900">{h.action}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{h.date} · Authorized by <span className="font-semibold text-slate-700">{h.by}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <button className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
                <Download className="w-4 h-4 text-slate-500" /> Export Dossier
              </button>
              {selected.status === 'Pending' || selected.status === 'Under Review' ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAction({ type: 'reject', loan: selected }); }}
                    className="px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition"
                  >
                    Decline Facility
                  </button>
                  <button
                    onClick={() => { setAction({ type: 'approve', loan: selected }); }}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm"
                  >
                    Approve Application
                  </button>
                </div>
              ) : selected.status === 'Approved' ? (
                <button
                  onClick={() => { setAction({ type: 'disburse', loan: selected }); }}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#091527] hover:bg-[#132c52] rounded-xl transition shadow-sm flex items-center gap-1.5"
                >
                  <Wallet className="w-4 h-4 text-amber-400" /> Release Disbursement
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm action */}
      <ConfirmDialog
        isOpen={!!action}
        onClose={() => setAction(null)}
        onConfirm={performAction}
        title={action?.type === 'approve' ? 'Approve Loan Facility?' : action?.type === 'reject' ? 'Reject Loan Application?' : 'Disburse Approved Facility?'}
        message={
          action?.type === 'approve'
            ? `Approve ${action?.loan.loanId} for ${action?.loan.clientName} for the amount of ${formatPHP(action?.loan.loanAmount || 0)}?`
            : action?.type === 'reject'
              ? `Reject loan application ${action?.loan.loanId} for ${action?.loan.clientName}? This decision will be logged to audit.`
              : `Disburse loan capital for ${action?.loan.loanId} (${formatPHP(action?.loan.loanAmount || 0)}) to ${action?.loan.clientName}?`
        }
        confirmLabel={action?.type === 'approve' ? 'Approve Loan' : action?.type === 'reject' ? 'Reject Loan' : 'Confirm Disbursement'}
        variant={action?.type === 'approve' ? 'info' : action?.type === 'reject' ? 'danger' : 'warning'}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#091527] border border-amber-500/40 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {toast}
        </div>
      )}
    </div>
  );
};