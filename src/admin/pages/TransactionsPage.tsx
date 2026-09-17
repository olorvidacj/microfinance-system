import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, CreditCard, Wallet, RefreshCw, Eye, Printer, Download, FileText,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { MOCK_TRANSACTIONS, AdminTransaction, formatPHP } from '../data/mockData';

const TYPES = ['Deposit', 'Withdrawal', 'Loan Payment', 'Loan Disbursement', 'Savings Deposit', 'Savings Withdrawal'];
const STATUSES = ['Completed', 'Pending', 'Failed', 'Cancelled'];
const METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Maya', 'Cheque'];

export const FinancialTransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<AdminTransaction[]>(MOCK_TRANSACTIONS);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selected, setSelected] = useState<AdminTransaction | null>(null);
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch = t.clientName.toLowerCase().includes(q) || t.transactionId.toLowerCase().includes(q) || t.referenceNumber.toLowerCase().includes(q);
      const matchesType = !typeFilter || t.type === typeFilter;
      const matchesStatus = !statusFilter || t.status === statusFilter;
      const matchesDate = !dateFilter || t.dateTime.startsWith(dateFilter);
      return matchesSearch && matchesType && matchesStatus && matchesDate;
    });
  }, [transactions, search, typeFilter, statusFilter, dateFilter]);

  const totals = {
    deposits: transactions.filter((t) => t.type === 'Deposit' || t.type === 'Savings Deposit').reduce((s, t) => s + t.amount, 0),
    withdrawals: transactions.filter((t) => t.type === 'Withdrawal' || t.type === 'Savings Withdrawal').reduce((s, t) => s + t.amount, 0),
    loanPayments: transactions.filter((t) => t.type === 'Loan Payment').reduce((s, t) => s + t.amount, 0),
    disbursements: transactions.filter((t) => t.type === 'Loan Disbursement').reduce((s, t) => s + t.amount, 0),
    totalVolume: transactions.reduce((s, t) => s + t.amount, 0),
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const printReceipt = () => {
    if (window && typeof window.open === 'function') {
      showToast('Opening receipt preview...');
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Financial Transactions' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Transactions</h1>
          <p className="mt-0.5 text-sm text-slate-500">Track deposits, withdrawals, loan payments, and disbursements.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => showToast('Report export initiated.')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm">
            <Download className="w-4 h-4" /> Export Report
          </button>
          <button onClick={() => showToast('Transaction report sent to printer.')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition shadow-md">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Deposits" value={formatPHP(totals.deposits)} icon={ArrowDownToLine} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Total Withdrawals" value={formatPHP(totals.withdrawals)} icon={ArrowUpFromLine} iconColor="text-rose-500" iconBg="bg-rose-50" />
        <StatCard title="Loan Payments" value={formatPHP(totals.loanPayments)} icon={CreditCard} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Disbursements" value={formatPHP(totals.disbursements)} icon={Wallet} iconColor="text-indigo-600" iconBg="bg-indigo-50" />
        <StatCard title="Transaction Volume" value={formatPHP(totals.totalVolume)} icon={RefreshCw} iconColor="text-amber-600" iconBg="bg-amber-50" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by transaction ID, client, or reference..." className="flex-1" />
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={TYPES.map((t) => ({ value: t, label: t }))} placeholder="All Types" className="w-full md:w-44" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Statuses" className="w-full md:w-40" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-slate-700 w-full md:w-44"
          />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            { key: 'transactionId', header: 'Transaction ID', render: (t) => <span className="font-mono text-xs text-blue-600">{t.transactionId}</span> },
            {
              key: 'client', header: 'Client',
              render: (t) => (
                <div>
                  <p className="font-medium text-slate-800">{t.clientName}</p>
                  <p className="text-[11px] text-slate-400">{t.clientId}</p>
                </div>
              ),
            },
            { key: 'type', header: 'Type', render: (t) => <Badge>{t.type}</Badge> },
            { key: 'amount', header: 'Amount', render: (t) => <span className={`font-bold ${t.amount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatPHP(t.amount)}</span> },
            { key: 'paymentMethod', header: 'Method', render: (t) => <Badge variant="default">{t.paymentMethod}</Badge> },
            { key: 'dateTime', header: 'Date & Time', render: (t) => <span className="text-xs text-slate-500 whitespace-nowrap">{t.dateTime}</span> },
            { key: 'processedBy', header: 'Processed By', render: (t) => <span className="text-xs text-slate-500">{t.processedBy}</span> },
            { key: 'status', header: 'Status', render: (t) => <Badge dot>{t.status}</Badge> },
            { key: 'referenceNumber', header: 'Reference', render: (t) => <span className="font-mono text-[11px] text-slate-500">{t.referenceNumber}</span> },
            {
              key: 'actions', header: 'Actions',
              render: (t) => (
                <div className="flex items-center gap-1">
                  <button onClick={() => setSelected(t)} title="View details" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Eye className="w-4 h-4" /></button>
                  <button onClick={printReceipt} title="Print receipt" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition"><Printer className="w-4 h-4" /></button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Transaction details + receipt */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Transaction Details" subtitle={selected?.transactionId} maxWidth="lg">
        {selected && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Type</p>
                <Badge>{selected.type}</Badge>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Amount</p>
                <p className="font-bold text-slate-900">{formatPHP(selected.amount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Status</p>
                <Badge dot>{selected.status}</Badge>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Method</p>
                <p className="font-medium text-slate-800 text-sm">{selected.paymentMethod}</p>
              </div>
            </div>

            {/* Receipt preview */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden mb-5">
              <div className="bg-slate-900 text-white px-5 py-4 text-center">
                <p className="font-bold tracking-tight">HOSCOMO Microfinance Cooperative</p>
                <p className="text-[11px] text-slate-300">Magallanes St., Tacloban City, Leyte 6500</p>
                <p className="text-[11px] text-slate-300">Official Receipt {selected.referenceNumber}</p>
              </div>
              <div className="p-5 space-y-2.5">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Received From</span><span className="font-medium text-slate-800">{selected.clientName}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Client ID</span><span className="font-medium text-slate-800">{selected.clientId}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Transaction Type</span><span className="font-medium text-slate-800">{selected.type}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Reference Number</span><span className="font-medium font-mono text-blue-600">{selected.referenceNumber}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Date & Time</span><span className="font-medium text-slate-800">{selected.dateTime}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Payment Method</span><span className="font-medium text-slate-800">{selected.paymentMethod}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Processed By</span><span className="font-medium text-slate-800">{selected.processedBy}</span></div>
                <div className="pt-3 mt-2 border-t border-dashed border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Amount</span>
                  <span className="text-xl font-bold text-slate-900">{formatPHP(selected.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Payment Breakdown</span>
                  <span className="text-xs text-slate-400">Principal: {formatPHP(selected.amount * 0.85)} · Interest: {formatPHP(selected.amount * 0.15)}</span>
                </div>
              </div>
              <div className="bg-slate-50 px-5 py-3 text-center text-[11px] text-slate-400 border-t border-slate-100">
                This is an official receipt generated by HOSCOMO Microfinance Cooperative. Keep for record keeping.
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button onClick={printReceipt} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button onClick={() => showToast('Receipt downloaded as PDF.')} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition">
                <FileText className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};