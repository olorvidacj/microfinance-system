import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleDollarSign, HandCoins, Search, TrendingDown } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Card } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { Amount } from '../../portal/components/ui/Amount';
import { StatCard } from '../../portal/components/common';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Input, Select } from '../../portal/components/ui/Field';
import { useBranchData } from '../hooks/useBranchData';
import { loansService } from '../services';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Under Review', label: 'Under Review' },
  { value: 'For Assessment', label: 'For Assessment' },
  { value: 'Recommended', label: 'Recommended' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Disbursed', label: 'Disbursed' },
  { value: 'Active', label: 'Active' },
  { value: 'In Arrears', label: 'In Arrears' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Written Off', label: 'Written Off' },
  { value: 'Rejected', label: 'Rejected' },
];

const LoansPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const fetcher = useCallback(
    async () => loansService.list({ status: status || undefined, search: search || undefined }),
    [status, search]
  );
  const { data, loading, error, reload } = useBranchData(fetcher);

  const rows = data || [];

  const summary = useMemo(
    () => ({
      outstanding: rows.reduce((s, l) => s + (l.remainingBalance || 0), 0),
      active: rows.filter((l) => ['Disbursed', 'Active', 'In Arrears'].includes(l.status)).length,
      arrears: rows.filter((l) => l.status === 'In Arrears').length,
      pipeline: rows.filter((l) => ['Draft', 'Submitted', 'Under Review', 'For Assessment'].includes(l.status)).length,
    }),
    [rows]
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Loans" subtitle="Portfolio monitoring and loan accounts in this branch" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding balance" value={<Amount value={summary.outstanding} />} icon={CircleDollarSign} tone="blue" />
        <StatCard label="Active loans" value={summary.active} icon={HandCoins} tone="emerald" />
        <StatCard label="In arrears" value={summary.arrears} icon={TrendingDown} tone="rose" />
        <StatCard label="In pipeline" value={summary.pipeline} icon={HandCoins} tone="amber" />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by borrower, loan number, or product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-48">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading loans…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<HandCoins className="h-6 w-6" />} title="No loans" description="No loan accounts match your filters." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Loan no.', 'Borrower', 'Product', 'Principal', 'Balance', 'Next payment', 'Officer', 'Status', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/staff/app/loans/${loan.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                        {loan.loanNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">{loan.borrowerName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{loan.productName}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700"><Amount value={loan.principalAmount} /></td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums font-semibold text-slate-800"><Amount value={loan.remainingBalance} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {loan.nextPaymentDate ? (
                        <span className={loan.daysInArrears && loan.daysInArrears > 0 ? 'font-medium text-rose-600' : ''}>
                          {loan.daysInArrears && loan.daysInArrears > 0 ? `${loan.daysInArrears}d overdue` : loan.nextPaymentDate}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{loan.loanOfficerName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={loan.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link to={`/staff/app/loans/${loan.id}`} className="text-xs font-medium text-blue-700 hover:text-blue-900">
                        Details →
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

export default LoansPage;