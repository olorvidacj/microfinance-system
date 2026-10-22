import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PiggyBank, Wallet, CheckCircle2, Lock, Eye, ArrowUpRight, ArrowDownRight, Plus, Download, Pencil } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { AdminSavingsAccount, formatDate } from '../data/mockData';
import { peso } from '../../components/lending';
import { adminApi, AdminApiError, SavingsDetail } from '../services/adminApi';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../auth/permissions';
import {
  ACCRUAL_METHODS,
  ACCRUAL_METHOD_LABELS,
  SAVINGS_KINDS,
  SAVINGS_KIND_LABELS,
  centsFromDb,
  centsToDecimal,
  validateSavingsProduct,
  type SavingsProductDto,
  displayPercent,
} from '../../../shared/lending';
import { useAdminBranch } from '../branchScope';

const STATUSES = ['Active', 'Dormant', 'Frozen', 'Closed'];
// Money to the centavo (the API sends plain numbers with up to 2 decimals).
const php = (n: number | string | null | undefined) => peso(n === null || n === undefined ? null : String(n));
const dateOrDash = (d: string | null | undefined) => (d ? formatDate(d) : '—');
type ProductRow = SavingsProductDto & { id: string };

const EMPTY_PRODUCT: SavingsProductDto = {
  code: '',
  name: '',
  kind: 'REGULAR',
  annualRate: '',
  accrualMethod: 'AVERAGE_DAILY_BALANCE',
  minimumBalance: '0',
  minimumOpeningDeposit: '0',
  maxWithdrawalAmount: '',
  maxWithdrawalsPerMonth: '',
  termMonths: '',
  status: 'ACTIVE',
};

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Head-office view of savings: products (rates, accrual, minimums, limits) and
 * every account across branches. Counter deposits and withdrawals are posted
 * by branch tellers, where they are ledgered and receipted.
 */
export const SavingsManagementPage: React.FC = () => {
  const { branchId } = useAdminBranch();
  const { user } = useAuth();
  const canEdit = hasPermission(user?.staffRole, 'manage_settings');
  const [accounts, setAccounts] = useState<AdminSavingsAccount[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<AdminSavingsAccount | null>(null);
  const [detail, setDetail] = useState<SavingsDetail | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; dto: SavingsProductDto } | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [a, p] = await Promise.all([adminApi.savings(branchId), adminApi.savingsProducts.list()]);
      setAccounts(a);
      setProducts(p);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Savings data could not be loaded.');
    }
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    adminApi.savingsDetail(selected.id).then(setDetail, (err) => setLoadError(err instanceof Error ? err.message : 'The account could not be loaded.'));
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        (a.clientName.toLowerCase().includes(q) || a.accountNumber.toLowerCase().includes(q) || a.clientId.toLowerCase().includes(q)) &&
        (!statusFilter || a.status === statusFilter) &&
        (!typeFilter || a.accountType === typeFilter),
    );
  }, [accounts, search, statusFilter, typeFilter]);

  // Sum in centavos so the total is exact.
  const totalBalance = centsToDecimal(accounts.filter((a) => a.status !== 'Closed').reduce((s, a) => s + centsFromDb(String(a.balance)), 0));
  const activeAccounts = accounts.filter((a) => a.status === 'Active').length;
  const frozenCount = accounts.filter((a) => a.status === 'Frozen').length;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const exportPortfolio = () => {
    const header = ['Account', 'Member', 'Member ID', 'Product', 'Status', 'Balance', 'Opened', 'Last activity', 'Branch'];
    const rows = filtered.map((a) => [a.accountNumber, a.clientName, a.clientId, a.accountType, a.status, centsToDecimal(centsFromDb(String(a.balance))), a.openedDate, a.lastTransaction, a.branch]);
    const blob = new Blob(['﻿', [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `savings-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`${rows.length} accounts exported.`);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Savings & Capital Build-up' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Savings & Capital Build-Up (CBU)</h1>
          <p className="text-xs sm:text-sm text-slate-500">Savings products and member accounts across branches. Deposits and withdrawals are posted at the branch counter.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPortfolio}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export Portfolio
          </button>
          {canEdit && (
            <button
              onClick={() => setEditing({ id: null, dto: { ...EMPTY_PRODUCT } })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#091527] hover:bg-[#132c52] text-white rounded-xl text-xs font-bold transition shadow-sm border border-slate-800"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" /> New Product
            </button>
          )}
        </div>
      </div>

      {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{loadError}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Savings Accounts" value={accounts.length} icon={PiggyBank} iconColor="text-gold-600" iconBg="bg-gold-500/10" />
        <StatCard title="Balances (open accounts)" value={peso(totalBalance)} icon={Wallet} iconColor="text-amber-600" iconBg="bg-amber-50" accentBorder />
        <StatCard title="Active Accounts" value={activeAccounts} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Frozen" value={frozenCount} icon={Lock} iconColor="text-rose-500" iconBg="bg-rose-50" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Savings products</h3>
            <p className="text-[11px] text-slate-500">Rate changes apply from the next interest month; months already posted are not recomputed.</p>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full">{products.length} configured</span>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-slate-500">No savings products yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {products.map((p) => (
              <div key={p.id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50" data-testid="savings-product">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold text-[#091527] bg-white border border-slate-200 px-2 py-0.5 rounded">{p.code}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge dot>{p.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge>
                    {canEdit && (
                      <button title="Edit product" onClick={() => setEditing({ id: p.id, dto: { ...p } })} className="p-1 rounded hover:bg-slate-200">
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                <p className="text-[11px] text-slate-500">{SAVINGS_KIND_LABELS[p.kind as keyof typeof SAVINGS_KIND_LABELS] ?? p.kind}</p>
                <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-200/60 text-xs">
                  <Row label="Interest" value={`${displayPercent(p.annualRate)} a year`} strong />
                  <Row label="Accrual" value={ACCRUAL_METHOD_LABELS[p.accrualMethod as keyof typeof ACCRUAL_METHOD_LABELS] ?? p.accrualMethod} />
                  <Row label="Minimum balance" value={php(p.minimumBalance)} />
                  <Row label="Opening deposit" value={php(p.minimumOpeningDeposit)} />
                  <Row
                    label="Withdrawals"
                    value={
                      p.kind === 'COMPULSORY'
                        ? 'Only on closing'
                        : [p.maxWithdrawalAmount ? `≤ ${php(p.maxWithdrawalAmount)}` : null, p.maxWithdrawalsPerMonth !== '' ? `${p.maxWithdrawalsPerMonth}/month` : null].filter(Boolean).join(', ') || 'No limit'
                    }
                  />
                  {p.kind === 'TIME_DEPOSIT' && <Row label="Term" value={`${p.termMonths} months`} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by account number, member name, or ID..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Account Statuses" className="w-full md:w-44" />
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={products.map((p) => ({ value: p.name, label: p.name }))} placeholder="All Products" className="w-full md:w-48" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            { key: 'accountNumber', header: 'Account No.', render: (a) => <span className="font-mono text-xs font-bold text-[#091527]">{a.accountNumber}</span> },
            {
              key: 'client',
              header: 'Member',
              render: (a) => (
                <div>
                  <p className="font-bold text-slate-900">{a.clientName}</p>
                  <p className="text-[11px] font-mono text-slate-400">{a.clientId}</p>
                </div>
              ),
            },
            { key: 'accountType', header: 'Product', render: (a) => <span className="text-[11px] font-semibold text-slate-800">{a.accountType}</span> },
            { key: 'balance', header: 'Balance', render: (a) => <span className="font-bold text-slate-900 text-xs">{php(a.balance)}</span> },
            { key: 'status', header: 'Status', render: (a) => <span title={a.statusReason || undefined}><Badge dot>{a.status}</Badge></span> },
            { key: 'openedDate', header: 'Opened', render: (a) => <span className="text-xs text-slate-500 whitespace-nowrap">{dateOrDash(a.openedDate)}</span> },
            { key: 'lastTransaction', header: 'Last Activity', render: (a) => <span className="text-xs text-slate-500 whitespace-nowrap">{dateOrDash(a.lastTransaction)}</span> },
            { key: 'branch', header: 'Branch', render: (a) => <span className="text-xs font-medium text-slate-600">{a.branch}</span> },
            {
              key: 'actions',
              header: '',
              render: (a) => (
                <button onClick={() => setSelected(a)} title="View statement" className="p-1.5 rounded-lg hover:bg-slate-100 transition">
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                </button>
              ),
            },
          ]}
        />
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Savings account" subtitle={selected?.accountNumber} maxWidth="2xl">
        {selected && (
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-[#091527] text-white border border-amber-500/30">
              <p className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Balance</p>
              <p className="text-2xl sm:text-3xl font-black mt-0.5 tracking-tight">{php(selected.balance)}</p>
              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-700/60 text-xs text-slate-300">
                <span className="flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> Money in: {php(detail?.inflows || 0)}</span>
                <span className="flex items-center gap-1"><ArrowDownRight className="w-3.5 h-3.5 text-amber-400" /> Money out: {php(detail?.outflows || 0)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
              <Info label="Member" value={selected.clientName} />
              <Info label="Product" value={selected.accountType} />
              <Info label="Interest" value={detail?.account?.interestRate ? `${detail.account.interestRate}% a year` : '—'} />
              <Info label="Status" value={selected.statusReason ? `${selected.status} — ${selected.statusReason}` : selected.status} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-2.5 uppercase tracking-wider">Latest transactions</h4>
              <DataTable
                data={detail?.ledger || []}
                keyField="id"
                columns={[
                  { key: 'ref', header: 'Reference', render: (t) => <span className="font-mono text-xs font-bold text-slate-700">{t.ref}</span> },
                  { key: 'type', header: 'Type', render: (t) => <Badge>{t.type}</Badge> },
                  { key: 'amount', header: 'Amount', render: (t) => <span className="font-bold text-xs">{php(t.amount)}</span> },
                  { key: 'balance', header: 'Balance After', render: (t) => <span className="font-bold text-slate-800 text-xs">{php(t.balance)}</span> },
                  { key: 'date', header: 'Date', render: (t) => <span className="text-xs text-slate-500">{t.date}</span> },
                  { key: 'by', header: 'Posted by', render: (t) => <span className="text-xs font-medium text-slate-600">{t.by}</span> },
                ]}
              />
            </div>
          </div>
        )}
      </Modal>

      {editing && (
        <ProductModal
          id={editing.id}
          initial={editing.dto}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setEditing(null);
            showToast(`${p.name} saved.`);
            load();
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#091527] border border-amber-500/40 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {toast}
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex justify-between gap-2">
    <span className="text-slate-500">{label}</span>
    <span className={strong ? 'font-bold text-amber-600' : 'font-semibold text-slate-800 text-right'}>{value}</span>
  </div>
);

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
    <p className="text-[10px] text-slate-400 uppercase font-bold">{label}</p>
    <p className="font-bold text-slate-800 mt-1">{value}</p>
  </div>
);

const inputCls = 'w-full px-3.5 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition text-slate-800';

const ProductModal: React.FC<{ id: string | null; initial: SavingsProductDto; onClose: () => void; onSaved: (p: ProductRow) => void }> = ({ id, initial, onClose, onSaved }) => {
  const [dto, setDto] = useState<SavingsProductDto>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof SavingsProductDto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDto({ ...dto, [k]: e.target.value });

  const save = async () => {
    // Same validation as the server (shared/lending/savings.ts).
    const v = validateSavingsProduct(dto);
    setErrors(v.errors);
    setError('');
    if (!v.ok) return;
    setSaving(true);
    try {
      onSaved(id ? await adminApi.savingsProducts.update(id, dto) : await adminApi.savingsProducts.create(dto));
    } catch (err) {
      if (err instanceof AdminApiError) setErrors(err.fieldErrors);
      setError(err instanceof Error ? err.message : 'The product could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof SavingsProductDto, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>
      {input}
      {errors[k] ? <p className="mt-1 text-[11px] text-rose-600">{errors[k]}</p> : hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );

  return (
    <Modal isOpen onClose={onClose} title={id ? 'Edit savings product' : 'New savings product'} maxWidth="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        {field('code', 'Code', <input className={inputCls} value={dto.code} onChange={set('code')} aria-label="Code" />)}
        {field('name', 'Name', <input className={inputCls} value={dto.name} onChange={set('name')} aria-label="Name" />)}
        {field(
          'kind',
          'Kind',
          <select className={inputCls} value={dto.kind} onChange={set('kind')} aria-label="Kind" disabled={!!id}>
            {SAVINGS_KINDS.map((k) => (
              <option key={k} value={k}>{SAVINGS_KIND_LABELS[k]}</option>
            ))}
          </select>,
          id ? 'The kind cannot change once accounts may use the product.' : undefined,
        )}
        {field('annualRate', 'Annual interest rate (%)', <input className={inputCls} inputMode="decimal" value={dto.annualRate} onChange={set('annualRate')} aria-label="Annual rate" />)}
        {field(
          'accrualMethod',
          'Interest accrues on',
          <select className={inputCls} value={dto.accrualMethod} onChange={set('accrualMethod')} aria-label="Accrual method">
            {ACCRUAL_METHODS.map((m) => (
              <option key={m} value={m}>{ACCRUAL_METHOD_LABELS[m]}</option>
            ))}
          </select>,
        )}
        {field('minimumBalance', 'Minimum balance (₱)', <input className={inputCls} inputMode="decimal" value={dto.minimumBalance} onChange={set('minimumBalance')} aria-label="Minimum balance" />, 'No interest for a month whose base is below this.')}
        {field('minimumOpeningDeposit', 'Minimum opening deposit (₱)', <input className={inputCls} inputMode="decimal" value={dto.minimumOpeningDeposit} onChange={set('minimumOpeningDeposit')} aria-label="Minimum opening deposit" />)}
        {field('maxWithdrawalAmount', 'Largest single withdrawal (₱)', <input className={inputCls} inputMode="decimal" value={dto.maxWithdrawalAmount} onChange={set('maxWithdrawalAmount')} aria-label="Largest withdrawal" />, 'Empty = no limit.')}
        {field('maxWithdrawalsPerMonth', 'Withdrawals per month', <input className={inputCls} inputMode="numeric" value={String(dto.maxWithdrawalsPerMonth)} onChange={set('maxWithdrawalsPerMonth')} aria-label="Withdrawals per month" />, 'Empty = no limit.')}
        {dto.kind === 'TIME_DEPOSIT' && field('termMonths', 'Term (months)', <input className={inputCls} inputMode="numeric" value={String(dto.termMonths)} onChange={set('termMonths')} aria-label="Term" />)}
        {field(
          'status',
          'Status',
          <select className={inputCls} value={dto.status} onChange={set('status')} aria-label="Status">
            <option value="ACTIVE">Active (offered)</option>
            <option value="INACTIVE">Inactive (no new accounts)</option>
          </select>,
        )}
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">Cancel</button>
        <button onClick={save} disabled={saving} className="px-4 py-2 text-xs font-bold text-white rounded-xl bg-[#091527] hover:bg-[#132c52] disabled:opacity-60">
          {saving ? 'Saving…' : 'Save product'}
        </button>
      </div>
    </Modal>
  );
};

export default SavingsManagementPage;
