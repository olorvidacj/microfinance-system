import React, { useMemo, useState } from 'react';
import { PiggyBank, Wallet, CheckCircle2, Clock, Eye, PlusCircle, MinusCircle, ArrowUpRight, ArrowDownRight, Plus, Download } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { MOCK_SAVINGS_ACCOUNTS, AdminSavingsAccount, formatPHP, formatDate } from '../data/mockData';

const STATUSES = ['Active', 'Dormant', 'Suspended', 'Closed'];
const ACCOUNT_TYPES = ['Regular Savings', 'Capital Build-up', 'Time Deposit', 'Special Savings', 'Youth Savings'];

export interface SavingsProduct {
  id: string;
  code: string;
  name: string;
  interestRate: number;
  maintainingBalance: number;
  minimumDeposit: number;
  withdrawalAllowed: boolean;
  status: 'Active' | 'Inactive';
}

const SAMPLE_PRODUCTS: SavingsProduct[] = [
  { id: 'SP-001', code: 'REG-SAV', name: 'Regular Savings', interestRate: 1.0, maintainingBalance: 1000, minimumDeposit: 100, withdrawalAllowed: true, status: 'Active' },
  { id: 'SP-002', code: 'CBU', name: 'Capital Build-up', interestRate: 2.0, maintainingBalance: 500, minimumDeposit: 200, withdrawalAllowed: false, status: 'Active' },
  { id: 'SP-003', code: 'TIME-DEP', name: 'Time Deposit', interestRate: 3.5, maintainingBalance: 10000, minimumDeposit: 5000, withdrawalAllowed: false, status: 'Active' },
  { id: 'SP-004', code: 'YOUTH-SAV', name: 'Youth Savings', interestRate: 1.5, maintainingBalance: 500, minimumDeposit: 50, withdrawalAllowed: true, status: 'Active' },
];

export const SavingsManagementPage: React.FC = () => {
  const [accounts, setAccounts] = useState<AdminSavingsAccount[]>(MOCK_SAVINGS_ACCOUNTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<AdminSavingsAccount | null>(null);
  const [txnModal, setTxnModal] = useState<{ mode: 'deposit' | 'withdrawal'; account: AdminSavingsAccount } | null>(null);
  const [txnAmount, setTxnAmount] = useState('');
  const [txnNote, setTxnNote] = useState('');
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch = a.clientName.toLowerCase().includes(q) || a.accountNumber.toLowerCase().includes(q) || a.clientId.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || a.status === statusFilter;
      const matchesType = !typeFilter || a.accountType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [accounts, search, statusFilter, typeFilter]);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const activeAccounts = accounts.filter((a) => a.status === 'Active').length;
  const pendingCount = accounts.filter((a) => a.status === 'Suspended').length;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const processTxn = () => {
    if (!txnModal) return;
    const amount = parseFloat(txnAmount);
    if (!amount || amount <= 0) return;
    const { mode, account } = txnModal;
    const newBalance = mode === 'deposit' ? account.balance + amount : Math.max(0, account.balance - amount);
    setAccounts(accounts.map((a) => a.id === account.id ? { ...a, balance: newBalance, lastTransaction: new Date().toISOString().slice(0, 10) } : a));
    setSelected(accounts.find((a) => a.id === account.id) ? { ...account, balance: newBalance } : null);
    showToast(`${mode === 'deposit' ? 'Cash Deposit' : 'Withdrawal'} of ${formatPHP(amount)} logged for ${account.clientName}.`);
    setTxnModal(null);
    setTxnAmount('');
    setTxnNote('');
  };

  const sampleHistory = [
    { ref: 'OR-2025-1840', type: 'Deposit', amount: 5000, balance: 15200, date: '2025-09-10 09:00', by: 'Juan Dela Cruz' },
    { ref: 'GC-8723451', type: 'Deposit', amount: 2000, balance: 10200, date: '2025-08-01 14:05', by: 'Grace Bautista' },
    { ref: 'OR-2025-1712', type: 'Withdrawal', amount: 3000, balance: 8200, date: '2025-07-18 11:30', by: 'Juan Dela Cruz' },
    { ref: 'OR-2025-1650', type: 'Deposit', amount: 4200, balance: 11200, date: '2025-06-15 10:15', by: 'Juan Dela Cruz' },
  ];

  const inputCls = "w-full px-3.5 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition text-slate-800";

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Savings & Capital Build-up' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Savings & Capital Build-Up (CBU)</h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Coop Mandate
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitor member deposit portfolios, compulsory equity build-up, and yield calculation schedules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast('Savings portfolio report exported.')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export Portfolio
          </button>
          <button
            onClick={() => showToast('New savings product configuration modal.')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#091527] hover:bg-[#132c52] text-white rounded-xl text-xs font-bold transition shadow-sm border border-slate-800"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" /> New Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Savings Accounts" value={accounts.length} icon={PiggyBank} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Aggregated Savings Balance" value={formatPHP(totalBalance)} icon={Wallet} iconColor="text-amber-600" iconBg="bg-amber-50" change={4.8} changeLabel="vs last month" accentBorder />
        <StatCard title="Active Member Portfolios" value={activeAccounts} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Suspended / Inactive" value={pendingCount} icon={Clock} iconColor="text-rose-500" iconBg="bg-rose-50" subtitle="Action needed" />
      </div>

      {/* Savings products section */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Active Savings & Equity Programs</h3>
            <p className="text-[11px] text-slate-500">Cooperative dividend yielding products and required reserves.</p>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full">
            4 Configured Products
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {SAMPLE_PRODUCTS.map((p) => (
            <div key={p.id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-amber-400/60 hover:shadow-xs transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold text-[#091527] bg-white border border-slate-200 px-2 py-0.5 rounded">
                  {p.code}
                </span>
                <Badge dot>{p.status}</Badge>
              </div>
              <p className="font-bold text-slate-900 text-sm">{p.name}</p>
              <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-200/60">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Yield Rate:</span>
                  <span className="font-bold text-amber-600">{p.interestRate}% p.a.</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Maintaining:</span>
                  <span className="font-semibold text-slate-800">{formatPHP(p.maintainingBalance)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Min. Deposit:</span>
                  <span className="font-semibold text-slate-800">{formatPHP(p.minimumDeposit)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Withdrawal:</span>
                  <span className={`font-bold ${p.withdrawalAllowed ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {p.withdrawalAllowed ? 'Unrestricted' : 'Compulsory Lock'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Account list table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by account number, member name, or ID..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Account Statuses" className="w-full md:w-44" />
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={ACCOUNT_TYPES.map((t) => ({ value: t, label: t }))} placeholder="All Product Types" className="w-full md:w-48" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            {
              key: 'accountNumber',
              header: 'Account No.',
              render: (a) => <span className="font-mono text-xs font-bold text-[#091527]">{a.accountNumber}</span>,
            },
            {
              key: 'client',
              header: 'Member / Client',
              render: (a) => (
                <div>
                  <p className="font-bold text-slate-900">{a.clientName}</p>
                  <p className="text-[11px] font-mono text-slate-400">{a.clientId}</p>
                </div>
              ),
            },
            {
              key: 'accountType',
              header: 'Product Category',
              render: (a) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/60">
                  {a.accountType}
                </span>
              ),
            },
            {
              key: 'balance',
              header: 'Current Balance',
              render: (a) => <span className="font-bold text-slate-900 text-xs">{formatPHP(a.balance)}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (a) => <Badge dot>{a.status}</Badge>,
            },
            {
              key: 'openedDate',
              header: 'Date Opened',
              render: (a) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(a.openedDate)}</span>,
            },
            {
              key: 'lastTransaction',
              header: 'Last Activity',
              render: (a) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(a.lastTransaction)}</span>,
            },
            {
              key: 'branch',
              header: 'Branch Station',
              render: (a) => <span className="text-xs font-medium text-slate-600">{a.branch}</span>,
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (a) => (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelected(a)}
                    title="View details & statement"
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <button
                    onClick={() => setTxnModal({ mode: 'deposit', account: a })}
                    title="Quick Deposit"
                    className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700 transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  </button>
                  <button
                    onClick={() => setTxnModal({ mode: 'withdrawal', account: a })}
                    title="Quick Withdrawal"
                    className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-700 transition"
                  >
                    <MinusCircle className="w-3.5 h-3.5 text-amber-600" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Account details modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Savings Ledger Dossier" subtitle={selected?.accountNumber} maxWidth="2xl">
        {selected && (
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-[#091527] text-white border border-amber-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Total Available Balance</p>
                  <p className="text-2xl sm:text-3xl font-black mt-0.5 text-white tracking-tight">{formatPHP(selected.balance)}</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/10 text-slate-200 border border-white/20">
                    {selected.accountType}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-700/60 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> Cumulative Inflows: {formatPHP(selected.balance * 2.2)}
                </span>
                <span className="flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" /> Cumulative Outflows: {formatPHP(selected.balance * 1.2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Member Name</p>
                <p className="font-bold text-slate-800 text-xs mt-1">{selected.clientName}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Member ID</p>
                <p className="font-mono text-slate-700 text-xs font-semibold mt-1">{selected.clientId}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Yield Rate</p>
                <p className="font-bold text-amber-600 text-xs mt-1">1.0% p.a.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Status</p>
                <Badge className="mt-1">{selected.status}</Badge>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-2.5 uppercase tracking-wider">Recent Passbook Ledger Activity</h4>
              <DataTable
                data={sampleHistory}
                keyField="ref"
                columns={[
                  { key: 'ref', header: 'Receipt Ref', render: (t) => <span className="font-mono text-xs font-bold text-slate-700">{t.ref}</span> },
                  {
                    key: 'type',
                    header: 'Entry Type',
                    render: (t) => <Badge variant={t.type === 'Deposit' ? 'success' : 'warning'}>{t.type}</Badge>,
                  },
                  {
                    key: 'amount',
                    header: 'Amount',
                    render: (t) => (
                      <span className={`font-bold text-xs ${t.type === 'Deposit' ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {t.type === 'Deposit' ? '+' : '-'}{formatPHP(t.amount)}
                      </span>
                    ),
                  },
                  { key: 'balance', header: 'Balance After', render: (t) => <span className="font-bold text-slate-800 text-xs">{formatPHP(t.balance)}</span> },
                  { key: 'date', header: 'Date & Time', render: (t) => <span className="text-xs text-slate-500">{t.date}</span> },
                  { key: 'by', header: 'Teller', render: (t) => <span className="text-xs font-medium text-slate-600">{t.by}</span> },
                ]}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Deposit / Withdraw modal */}
      <Modal
        isOpen={!!txnModal}
        onClose={() => setTxnModal(null)}
        title={txnModal?.mode === 'deposit' ? 'Cash Deposit Transaction' : 'Savings Withdrawal Transaction'}
        subtitle={txnModal?.account.clientName}
        maxWidth="sm"
      >
        {txnModal && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Available Balance:</span>
                <span className="font-bold text-slate-900">{formatPHP(txnModal.account.balance)}</span>
              </div>
              {txnModal.mode === 'withdrawal' && (
                <p className="text-[11px] text-amber-700 mt-1.5 font-medium">
                  Maintaining balance requirement: {formatPHP(1000)}. Over-the-counter authorization applies.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Amount to Transact (PHP)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₱</span>
                <input
                  type="number"
                  value={txnAmount}
                  onChange={(e) => setTxnAmount(e.target.value)}
                  className={`${inputCls} pl-8`}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Transaction Remarks / Reference</label>
              <input
                value={txnNote}
                onChange={(e) => setTxnNote(e.target.value)}
                className={inputCls}
                placeholder="e.g., Member OTC deposit, Counter 2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setTxnModal(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={processTxn}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition shadow-xs ${
                  txnModal.mode === 'deposit'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[#091527] hover:bg-[#132c52] border border-amber-500/40 text-amber-300'
                }`}
              >
                Confirm {txnModal.mode === 'deposit' ? 'Cash Deposit' : 'Withdrawal'}
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
