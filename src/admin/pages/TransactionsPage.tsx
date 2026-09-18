import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, CreditCard, Wallet, RefreshCw, Eye, Printer, Download, FileText, CheckCircle2, ShieldCheck, Building2,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { AdminTransaction, formatPHP } from '../data/mockData';
import { adminApi } from '../services/adminApi';

const TYPES = ['Deposit', 'Withdrawal', 'Loan Payment', 'Loan Disbursement', 'Savings Deposit', 'Savings Withdrawal'];
const STATUSES = ['Completed', 'Pending', 'Failed', 'Cancelled'];
const METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Maya', 'Cheque'];

export const FinancialTransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selected, setSelected] = useState<AdminTransaction | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    adminApi.transactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);

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
      showToast('Official receipt rendered for printing.');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Financial Transactions & General Ledger' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Financial Transactions Ledger</h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Audit-Locked
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time cashiering, electronic collections, loan releases, and member ledger entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast('Financial transactions report exported (CSV / XLSX).')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </button>
          <button
            onClick={() => showToast('Day-end cash transaction summary generated.')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#091527] hover:bg-[#132c52] text-white rounded-xl text-xs font-bold transition shadow-sm border border-slate-800"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" /> Daily Summary
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Cash Deposits" value={formatPHP(totals.deposits)} icon={ArrowDownToLine} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Member Withdrawals" value={formatPHP(totals.withdrawals)} icon={ArrowUpFromLine} iconColor="text-rose-500" iconBg="bg-rose-50" />
        <StatCard title="Loan Collections" value={formatPHP(totals.loanPayments)} icon={CreditCard} iconColor="text-gold-600" iconBg="bg-gold-500/10" accentBorder />
        <StatCard title="Loan Releases" value={formatPHP(totals.disbursements)} icon={Wallet} iconColor="text-gold-600" iconBg="bg-gold-500/10" />
        <StatCard title="Total Volume (Turnover)" value={formatPHP(totals.totalVolume)} icon={RefreshCw} iconColor="text-amber-600" iconBg="bg-amber-50" subtitle="Aggregate ledger flux" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by transaction ID, member name, or reference serial..." className="flex-1" />
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={TYPES.map((t) => ({ value: t, label: t }))} placeholder="All Transaction Types" className="w-full md:w-48" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Statuses" className="w-full md:w-40" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition text-slate-700 w-full md:w-44"
          />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            {
              key: 'transactionId',
              header: 'Txn ID',
              render: (t) => <span className="font-mono text-xs font-bold text-[#091527]">{t.transactionId}</span>,
            },
            {
              key: 'client',
              header: 'Member / Client',
              render: (t) => (
                <div>
                  <p className="font-bold text-slate-900">{t.clientName}</p>
                  <p className="text-[11px] font-mono text-slate-400">{t.clientId}</p>
                </div>
              ),
            },
            {
              key: 'type',
              header: 'Transaction Type',
              render: (t) => <Badge>{t.type}</Badge>,
            },
            {
              key: 'amount',
              header: 'Amount Transacted',
              render: (t) => (
                <span className={`font-bold text-xs ${t.amount >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatPHP(t.amount)}
                </span>
              ),
            },
            {
              key: 'paymentMethod',
              header: 'Channel / Method',
              render: (t) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                  {t.paymentMethod}
                </span>
              ),
            },
            {
              key: 'dateTime',
              header: 'Date & Timestamp',
              render: (t) => <span className="text-xs text-slate-500 whitespace-nowrap">{t.dateTime}</span>,
            },
            {
              key: 'processedBy',
              header: 'Teller / Station',
              render: (t) => <span className="text-xs text-slate-600 font-medium">{t.processedBy}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (t) => <Badge dot>{t.status}</Badge>,
            },
            {
              key: 'referenceNumber',
              header: 'OR Reference',
              render: (t) => <span className="font-mono text-[11px] font-semibold text-slate-600">{t.referenceNumber}</span>,
            },
            {
              key: 'actions',
              header: 'Action',
              render: (t) => (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelected(t)}
                    title="View details & receipt"
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <button
                    onClick={printReceipt}
                    title="Print official receipt"
                    className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-700 transition"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-600" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Transaction details + receipt modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Transaction Dossier & Official Receipt" subtitle={selected?.transactionId} maxWidth="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Ledger Type</p>
                <Badge className="mt-1">{selected.type}</Badge>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Total Amount</p>
                <p className="font-bold text-sm text-slate-900 mt-1">{formatPHP(selected.amount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Execution Status</p>
                <Badge dot className="mt-1">{selected.status}</Badge>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Payment Method</p>
                <p className="font-bold text-xs text-slate-800 mt-1">{selected.paymentMethod}</p>
              </div>
            </div>

            {/* Official Digital Receipt preview */}
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-white">
              <div className="bg-[#091527] text-white px-5 py-4 text-center border-b border-amber-500/30">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <p className="font-black text-sm tracking-wide text-white uppercase">HOSCOMCO Microfinance Cooperative</p>
                </div>
                <p className="text-[11px] text-slate-300">CDA Registration No. 9520-08000123 · Tacloban City, Leyte</p>
                <p className="text-[11px] font-mono text-amber-300/90 font-bold mt-1">OFFICIAL CASH RECEIPT: {selected.referenceNumber}</p>
              </div>

              <div className="p-5 space-y-2.5 bg-slate-50/40">
                <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Received From (Member):</span>
                  <span className="font-bold text-slate-900">{selected.clientName}</span>
                </div>
                <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Cooperative Member ID:</span>
                  <span className="font-mono text-slate-800 font-bold">{selected.clientId}</span>
                </div>
                <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Transaction Classification:</span>
                  <span className="font-semibold text-slate-800">{selected.type}</span>
                </div>
                <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Timestamp of Execution:</span>
                  <span className="font-medium text-slate-700">{selected.dateTime}</span>
                </div>
                <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Disbursing / Collecting Staff:</span>
                  <span className="font-medium text-slate-800">{selected.processedBy}</span>
                </div>

                <div className="pt-3 mt-2 border-t-2 border-dashed border-slate-300 flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">Total Net Amount</span>
                  <span className="text-xl font-black text-slate-900">{formatPHP(selected.amount)}</span>
                </div>

                {selected.notes ? (
                  <div className="flex justify-between text-[11px] pt-1 text-slate-500">
                    <span>General Ledger Note:</span>
                    <span className="font-mono max-w-[60%] text-right">{selected.notes}</span>
                  </div>
                ) : null}
              </div>

              <div className="bg-slate-100 px-5 py-2.5 text-center text-[10px] text-slate-500 border-t border-slate-200">
                System-generated microfinance transaction record. Approved under HOSCOMCO Cooperative By-Laws.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={printReceipt}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Receipt
              </button>
              <button
                onClick={() => showToast('Official receipt exported as encrypted PDF.')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#091527] hover:bg-[#132c52] rounded-xl transition shadow-sm"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" /> Download PDF Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#091527] border border-amber-500/40 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {toast}
        </div>
      )}
    </div>
  );
};