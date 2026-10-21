import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Inbox, PiggyBank, Plus, Scale, Users, Wallet } from 'lucide-react';
import { SAVINGS_STATUSES, centsFromDb, centsToDecimal } from '../../../shared/lending';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { Input, Select } from '../../portal/components/ui/Field';
import { StatCard } from '../../portal/components/common';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { peso } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { savingsService } from '../services';
import { OpenAccountModal, SavingsStatusBadge } from '../components/SavingsDialogs';

const SavingsPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [opening, setOpening] = useState(false);
  const canOpen = useBranchPermission(['process_savings_deposits']);
  const canRelease = useBranchPermission(['process_savings_withdrawals']);
  const canReconcile = useBranchPermission(['view_all_records', 'approve_sensitive_operations', 'manage_settings']);

  const fetcher = useCallback(() => savingsService.list({ status: status || undefined, search: search.trim() || undefined }), [status, search]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const rows = data || [];
  const requestsFetcher = useCallback(() => (canRelease ? savingsService.requests('PENDING') : Promise.resolve([])), [canRelease]);
  const pending = useBranchData(requestsFetcher);

  // Totals in integer centavos, formatted once.
  const summary = useMemo(() => {
    const open = rows.filter((a) => a.status !== 'CLOSED');
    return {
      total: centsToDecimal(open.reduce((s, a) => s + centsFromDb(a.balance), 0)),
      open: open.length,
      frozen: rows.filter((a) => a.status === 'FROZEN').length,
    };
  }, [rows]);

  const reconcile = async () => {
    try {
      const r = await savingsService.reconcile();
      if (r.ok) toast.success(`Ledger reconciled: ${r.accountsChecked} accounts match the general ledger.`);
      else toast.error(`${r.mismatches.length} account(s) do not match the ledger. ${r.generalLedger.filter((g) => !g.ok).map((g) => `GL ${g.accountCode}: ${g.generalLedger} vs ${g.accounts}`).join('; ')}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reconciliation failed.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Savings"
        subtitle="Member savings accounts in this branch. Balances come from the posted transactions."
        actions={
          <div className="flex flex-wrap gap-2">
            {canReconcile && <Button variant="outline" onClick={reconcile}><Scale className="h-4 w-4" /> Reconcile</Button>}
            {canRelease && (
              <Link to="/staff/app/savings/requests">
                <Button variant="outline"><Inbox className="h-4 w-4" /> Withdrawal requests{pending.data?.length ? ` (${pending.data.length})` : ''}</Button>
              </Link>
            )}
            {canOpen && <Button variant="brand" onClick={() => setOpening(true)}><Plus className="h-4 w-4" /> Open account</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Balances (open accounts)" value={peso(summary.total)} icon={PiggyBank} tone="violet" />
        <StatCard label="Open accounts" value={summary.open} icon={Users} tone="blue" />
        <StatCard label="Frozen" value={summary.frozen} icon={Wallet} tone="amber" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="Search member or passbook" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <Select className="max-w-[12rem]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {SAVINGS_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingState label="Loading savings accounts…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<PiggyBank className="h-6 w-6" />} title="No savings accounts" description="Accounts are opened when a member's KYC is approved, or here with Open account." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Passbook', 'Member', 'Product', 'Status', 'Balance', 'Withdrawable', ''].map((h) => (
                    <th key={h} className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${['Balance', 'Withdrawable'].includes(h) ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((acc) => (
                  <tr key={acc.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/staff/app/savings/${acc.id}`)}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-800">{acc.passbookNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{acc.memberName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{acc.product.name}</td>
                    <td className="whitespace-nowrap px-4 py-3"><SavingsStatusBadge status={acc.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{peso(acc.balance)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600" title={acc.withdrawalBlockedBy ?? undefined}>
                      {acc.withdrawalBlockedBy ? '—' : peso(acc.available)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link to={`/staff/app/savings/${acc.id}`} className="text-xs font-medium text-emerald-700 hover:text-emerald-900" onClick={(e) => e.stopPropagation()}>
                        Statement →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {opening && (
        <OpenAccountModal
          onClose={() => setOpening(false)}
          onDone={(a) => {
            setOpening(false);
            toast.success(`Account ${a.passbookNumber} opened for ${a.memberName}.`);
            navigate(`/staff/app/savings/${a.id}`);
          }}
        />
      )}
    </div>
  );
};

export default SavingsPage;
