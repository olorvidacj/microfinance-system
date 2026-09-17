import React, { useMemo, useState } from 'react';
import { PiggyBank, Wallet, CheckCircle2, Clock, Eye, PlusCircle, MinusCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
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
    showToast(`${mode === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${formatPHP(amount)} processed for ${account.clientName}.`);
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

  const inputCls = "w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition";

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Savings Management' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Savings Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage member savings accounts, products, and deposits.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Savings Accounts" value={accounts.length} icon={PiggyBank} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Total Savings Balance" value={formatPHP(totalBalance)} icon={Wallet} iconColor="text-amber-600" iconBg="bg-amber-50" change={4.8} changeLabel="vs last month" />
        <StatCard title="Active Accounts" value={activeAccounts} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Pending / Suspended" value={pendingCount} icon={Clock} iconColor="text-red-500" iconBg="bg-red-50" />
      </div>

      {/* Savings products */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Savings Products</h3>
          <button onClick={() => showToast('New savings product form opens here.')} className="text-xs font-medium text-blue-600 hover:underline">+ Add Product</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {SAMPLE_PRODUCTS.map((p) => (
            <div key={p.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:shadow-sm transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-semibold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded">{p.code}</span>
                <Badge dot>{p.status}</Badge>
              </div>
              <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Interest</span>
                  <span className="font-medium text-slate-700">{p.interestRate}% p.a.</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Maintaining</span>
                  <span className="font-medium text-slate-700">{formatPHP(p.maintainingBalance)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Min. Deposit</span>
                  <span className="font-medium text-slate-700">{formatPHP(p.minimumDeposit)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Withdrawal</span>
                  <span className={`font-medium ${p.withdrawalAllowed ? 'text-emerald-600' : 'text-amber-600'}`}>{p.withdrawalAllowed ? 'Allowed' : 'Restricted'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Account list */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by account number, client name, or ID..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Statuses" className="w-full md:w-40" />
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={ACCOUNT_TYPES.map((t) => ({ value: t, label: t }))} placeholder="All Types" className="w-full md:w-48" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            { key: 'accountNumber', header: 'Account Number', render: (a) => <span className="font-mono text-xs text-blue-600">{a.accountNumber}</span> },
            {
              key: 'client', header: 'Client',
              render: (a) => (
                <div>
                  <p className="font-medium text-slate-800">{a.clientName}</p>
                  <p className="text-[11px] text-slate-400">{a.clientId}</p>
                </div>
              ),
            },
            { key: 'accountType', header: 'Account Type', render: (a) => <Badge variant="indigo">{a.accountType}</Badge> },
            { key: 'balance', header: 'Balance', render: (a) => <span className="font-semibold text-slate-800">{formatPHP(a.balance)}</span> },
            { key: 'status', header: 'Status', render: (a) => <Badge dot>{a.status}</Badge> },
            { key: 'openedDate', header: 'Opened', render: (a) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(a.openedDate)}</span> },
            { key: 'lastTransaction', header: 'Last Transaction', render: (a) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(a.lastTransaction)}</span> },
            { key: 'branch', header: 'Branch', render: (a) => <span className="text-xs text-slate-500">{a.branch}</span> },
            {
              key: 'actions', header: 'Actions',
              render: (a) => (
                <div className="flex items-center gap-1">
                  <button onClick={() => setSelected(a)} title="View details" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => setTxnModal({ mode: 'deposit', account: a })} title="Deposit" className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition"><PlusCircle className="w-4 h-4" /></button>
                  <button onClick={() => setTxnModal({ mode: 'withdrawal', account: a })} title="Withdraw" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition"><MinusCircle className="w-4 h-4" /></button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Account details */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Savings Account Details" subtitle={selected?.accountNumber} maxWidth="2xl">
        {selected && (
          <div>
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white mb-5">
              <p className="text-[11px] uppercase tracking-wide text-emerald-100">Current Balance</p>
              <p className="text-3xl font-bold mt-1">{formatPHP(selected.balance)}</p>
              <div className="flex gap-4 mt-3 text-xs text-emerald-100">
                <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Total Deposited: {formatPHP(selected.balance * 2.2)}</span>
                <span className="flex items-center gap-1"><ArrowDownRight className="w-3 h-3" /> Total Withdrawn: {formatPHP(selected.balance * 1.2)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Client</p>
                <p className="font-medium text-slate-800 text-sm">{selected.clientName}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Account Type</p>
                <p className="font-medium text-slate-800 text-sm">{selected.accountType}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Interest</p>
                <p className="font-medium text-slate-800 text-sm">1.0% p.a.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Status</p>
                <Badge>{selected.status}</Badge>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-800 mb-3">Transaction History</h4>
            <DataTable
              data={sampleHistory}
              keyField="ref"
              columns={[
                { key: 'ref', header: 'Receipt / Ref', render: (t) => <span className="font-mono text-xs text-slate-600">{t.ref}</span> },
                { key: 'type', header: 'Type', render: (t) => (
                  <Badge variant={t.type === 'Deposit' ? 'success' : 'warning'}>{t.type}</Badge>
                )},
                { key: 'amount', header: 'Amount', render: (t) => <span className={`font-medium ${t.type === 'Deposit' ? 'text-emerald-600' : 'text-red-500'}`}>{t.type === 'Deposit' ? '+' : '-'}{formatPHP(t.amount)}</span> },
                { key: 'balance', header: 'Balance After', render: (t) => <span className="font-medium text-slate-800">{formatPHP(t.balance)}</span> },
                { key: 'date', header: 'Date & Time', render: (t) => <span className="text-xs text-slate-500">{t.date}</span> },
                { key: 'by', header: 'Processed By', render: (t) => <span className="text-xs text-slate-500">{t.by}</span> },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* Deposit / Withdraw modal */}
      <Modal
        isOpen={!!txnModal}
        onClose={() => setTxnModal(null)}
        title={txnModal?.mode === 'deposit' ? 'Savings Deposit' : 'Savings Withdrawal'}
        subtitle={txnModal?.account.clientName}
        maxWidth="sm"
      >
        {txnModal && (
          <div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Current Balance</span>
                <span className="font-bold text-slate-900">{formatPHP(txnModal.account.balance)}</span>
              </div>
              {txnModal.mode === 'withdrawal' && (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Maintaining balance: {formatPHP(1000)} · Withdrawals above available balance require manager approval.
                </p>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">P</span>
                <input type="number" value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} className={`${inputCls} pl-8`} placeholder="0.00" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <input value={txnNote} onChange={(e) => setTxnNote(e.target.value)} className={inputCls} placeholder="Optional notes" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setTxnModal(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
                Cancel
              </button>
              <button
                onClick={processTxn}
                className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition ${txnModal.mode === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                Process {txnModal.mode === 'deposit' ? 'Deposit' : 'Withdrawal'}
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