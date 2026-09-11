import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PiggyBank, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Card } from '../../portal/components/ui/Card';
import { Amount } from '../../portal/components/ui/Amount';
import { StatCard } from '../../portal/components/common';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { useBranchData } from '../hooks/useBranchData';
import { savingsService } from '../services';

const SavingsPage: React.FC = () => {
  const fetcher = useCallback(() => savingsService.list(), []);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const rows = data || [];

  const summary = useMemo(
    () => ({
      total: rows.reduce((s, a) => s + a.balance, 0),
      deposits: rows.reduce((s, a) => s + (a.totalDeposits || 0), 0),
      withdrawals: rows.reduce((s, a) => s + (a.totalWithdrawals || 0), 0),
    }),
    [rows]
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Savings" subtitle="Passbook savings accounts held by members in this branch" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total balances" value={<Amount value={summary.total} />} icon={PiggyBank} tone="violet" />
        <StatCard label="Accounts" value={rows.length} icon={Users} tone="blue" />
        <StatCard label="Cumulative deposits" value={<Amount value={summary.deposits} />} icon={TrendingUp} tone="emerald" />
        <StatCard label="Cumulative withdrawals" value={<Amount value={summary.withdrawals} />} icon={TrendingDown} tone="amber" />
      </div>

      {loading ? (
        <LoadingState label="Loading savings accounts…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<PiggyBank className="h-6 w-6" />} title="No savings accounts" description="Member savings accounts will appear here." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Account', 'Member', 'Balance', 'Total deposits', 'Total withdrawals', 'Maintaining', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">{acc.id}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{acc.memberName}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums font-semibold text-slate-800"><Amount value={acc.balance} /></td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-emerald-700"><Amount value={acc.totalDeposits} /></td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-rose-700"><Amount value={acc.totalWithdrawals} /></td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600"><Amount value={acc.maintainingBalance} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link to={`/staff/app/savings/${acc.id}`} className="text-xs font-medium text-emerald-700 hover:text-emerald-900">
                        Transactions →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SavingsPage;