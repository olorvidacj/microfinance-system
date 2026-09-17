import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet, CheckCircle2, XCircle, Clock, Wallet, Eye, CheckSquare, Square, Download, History as HistoryIcon,
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
    { date: '2025-06-20', action: 'Loan Processor verified eligibility', by: 'Maria Santos', status: 'Complete' },
    { date: '2025-06-22', action: 'Credit Committee interview conducted', by: 'Credit Committee', status: 'Complete' },
    { date: '2025-06-25', action: 'Approved by Manager', by: 'Roberto Villanueva', status: 'Complete' },
    { date: '2025-06-27', action: 'Disbursed', by: 'Cashier Teller', status: 'Complete' },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Loan Management' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Loan Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">Monitor, review, approve, and manage loan applications.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Applications" value={totals.count} icon={FileSpreadsheet} iconColor="text-blue-600" iconBg="bg-blue-50" change={15} changeLabel="this month" />
        <StatCard title="Pending Applications" value={totals.pending} icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <StatCard title="Approved Loans" value={totals.approved + totals.active} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Rejected Loans" value={totals.rejected} icon={XCircle} iconColor="text-red-500" iconBg="bg-red-50" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Active Loans" value={totals.active} icon={Wallet} iconColor="text-indigo-600" iconBg="bg-indigo-50" />
        <StatCard title="Completed Loans" value={totals.completed} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Total Loan Amount" value={formatPHP(totals.totalAmount)} icon={Wallet} iconColor="text-amber-600" iconBg="bg-amber-50" subtitle="Portfolio total" />
        <StatCard title="Outstanding Balance" value={formatPHP(totals.outstanding)} icon={Wallet} iconColor="text-cyan-600" iconBg="bg-cyan-50" subtitle={`${Math.round((totals.outstanding / totals.totalAmount) * 100)}% of portfolio`} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by loan ID, client name, or client ID..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Statuses" className="w-full md:w-44" />
          <FilterSelect value={productFilter} onChange={setProductFilter} options={PRODUCTS.map((p) => ({ value: p, label: p }))} placeholder="All Products" className="w-full md:w-48" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            { key: 'loanId', header: 'Loan ID', render: (l) => <span className="font-mono text-xs text-blue-600">{l.loanId}</span> },
            {
              key: 'client', header: 'Client',
              render: (l) => (
                <div>
                  <p className="font-medium text-slate-800">{l.clientName}</p>
                  <p className="text-[11px] text-slate-400">{l.clientId}</p>
                </div>
              ),
            },
            { key: 'loanProduct', header: 'Product', render: (l) => <span className="text-xs text-slate-500">{l.loanProduct}</span> },
            { key: 'loanAmount', header: 'Loan Amount', render: (l) => <span className="font-medium text-slate-800">{formatPHP(l.loanAmount)}</span> },
            { key: 'loanTerm', header: 'Term', render: (l) => <span className="text-xs text-slate-500">{l.loanTerm} mo</span> },
            { key: 'interestRate', header: 'Rate', render: (l) => <span className="text-xs text-slate-500">{l.interestRate}%/mo</span> },
            { key: 'paymentFrequency', header: 'Frequency', render: (l) => <span className="text-xs text-slate-500">{l.paymentFrequency}</span> },
            { key: 'applicationDate', header: 'Applied', render: (l) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(l.applicationDate)}</span> },
            { key: 'status', header: 'Status', render: (l) => <Badge dot>{l.status}</Badge> },
            {
              key: 'actions', header: 'Actions',
              render: (l) => (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setSelected(l); setDetailTab('overview'); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  {l.status === 'Under Review' && (
                    <button
                      onClick={() => setAction({ type: 'approve', loan: l })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                  {l.status === 'Approved' && (
                    <button
                      onClick={() => setAction({ type: 'disburse', loan: l })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    >
                      <Wallet className="w-3.5 h-3.5" /> Disburse
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Loan Details Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Loan Details" subtitle={selected?.loanId} maxWidth="2xl">
        {selected && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white mb-5">
              <div>
                <h4 className="font-bold">{selected.clientName}</h4>
                <p className="text-xs text-slate-300">{selected.clientId} · {selected.branch}</p>
              </div>
              <Badge dot>{selected.status}</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Loan Amount</p>
                <p className="font-bold text-slate-900">{formatPHP(selected.loanAmount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Outstanding</p>
                <p className="font-bold text-slate-900">{formatPHP(selected.outstandingBalance)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Interest Rate</p>
                <p className="font-bold text-slate-900">{selected.interestRate}% / mo</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Monthly Payment</p>
                <p className="font-bold text-slate-900">{formatPHP(selected.monthlyPayment)}</p>
              </div>
            </div>

            <div className="flex gap-1 border-b border-slate-100 mb-5">
              {(['overview', 'schedule', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium capitalize transition border-b-2 -mb-px ${
                    detailTab === tab ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'overview' ? 'Overview' : tab === 'schedule' ? 'Payment Schedule' : 'Approval History'}
                </button>
              ))}
            </div>

            {detailTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase">Loan Product</p>
                    <p className="font-medium text-slate-800">{selected.loanProduct}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase">Loan Term</p>
                    <p className="font-medium text-slate-800">{selected.loanTerm} months</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase">Payment Frequency</p>
                    <p className="font-medium text-slate-800">{selected.paymentFrequency}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase">Purpose</p>
                    <p className="font-medium text-slate-800">Business capital / livelihood expansion</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase">Application Date</p>
                    <p className="font-medium text-slate-800">{formatDate(selected.applicationDate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase">Disbursement Date</p>
                    <p className="font-medium text-slate-800">{selected.status === 'Disbursed' || selected.status === 'Active' ? '2025-07-01' : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase">Maturity Date</p>
                    <p className="font-medium text-slate-800">{selected.status === 'Active' ? '2026-06-15' : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase">Loan Officer</p>
                    <p className="font-medium text-slate-800">Maria Santos</p>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'schedule' && (
              <DataTable
                data={sampleSchedule}
                keyField="n"
                columns={[
                  { key: 'n', header: '#', render: (s) => <span className="text-xs text-slate-400">{s.n}</span> },
                  { key: 'due', header: 'Due Date', render: (s) => <span className="text-xs font-medium">{s.due}</span> },
                  { key: 'principal', header: 'Principal', render: (s) => <span className="text-xs">{formatPHP(s.principal)}</span> },
                  { key: 'interest', header: 'Interest', render: (s) => <span className="text-xs">{formatPHP(s.interest)}</span> },
                  { key: 'total', header: 'Total Due', render: (s) => <span className="text-xs font-medium">{formatPHP(s.total)}</span> },
                  { key: 'status', header: 'Status', render: (s) => <Badge>{s.status}</Badge> },
                ]}
              />
            )}

            {detailTab === 'history' && (
              <div className="space-y-3">
                {approvalHistory.map((h, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <span className={`w-2 h-2 rounded-full mt-1.5 ${h.status === 'Complete' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {i < approvalHistory.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                    </div>
                    <div className={`pb-4 ${i === approvalHistory.length - 1 ? '' : 'border-b border-slate-50'} flex-1`}>
                      <p className="text-sm font-medium text-slate-800">{h.action}</p>
                      <p className="text-xs text-slate-400">{h.date} · {h.by}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition">
                <Download className="w-4 h-4" /> View Loan Documents
              </button>
              {selected.status === 'Pending' || selected.status === 'Under Review' ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAction({ type: 'reject', loan: selected }); }}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => { setAction({ type: 'approve', loan: selected }); }}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
                  >
                    Approve
                  </button>
                </div>
              ) : selected.status === 'Approved' ? (
                <button
                  onClick={() => { setAction({ type: 'disburse', loan: selected }); }}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
                >
                  Disburse
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
        title={action?.type === 'approve' ? 'Approve Loan?' : action?.type === 'reject' ? 'Reject Loan?' : 'Disburse Loan?'}
        message={
          action?.type === 'approve'
            ? `Approve ${action?.loan.loanId} for ${action?.loan.clientName} (${formatPHP(action?.loan.loanAmount || 0)})?`
            : action?.type === 'reject'
              ? `Reject ${action?.loan.loanId} for ${action?.loan.clientName}? The client will be notified.`
              : `Disburse ${action?.loan.loanId} (${formatPHP(action?.loan.loanAmount || 0)}) to ${action?.loan.clientName}?`
        }
        confirmLabel={action?.type === 'approve' ? 'Approve Loan' : action?.type === 'reject' ? 'Reject Loan' : 'Confirm Disbursement'}
        variant={action?.type === 'approve' ? 'info' : action?.type === 'reject' ? 'danger' : 'warning'}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};