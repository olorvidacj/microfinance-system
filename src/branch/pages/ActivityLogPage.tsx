import React, { useCallback, useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Card } from '../../portal/components/ui/Card';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Field, Input, Select } from '../../portal/components/ui/Field';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { activityService } from '../services';

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'BORROWER', label: 'Client' },
  { value: 'LOAN', label: 'Loan' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'USER', label: 'User' },
  { value: 'SYSTEM', label: 'System' },
];

const ActivityLogPage: React.FC = () => {
  const canView = useBranchPermission(['view_audit_trail', 'view_transaction_records']);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');

  const fetcher = useCallback(
    async () =>
      activityService.log({
        type: type || undefined,
        search: search || undefined,
      }),
    [type, search]
  );
  const { data, loading, error, reload } = useBranchData(fetcher);
  const rows = data || [];

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.timestamp || '';
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [rows]);

  if (!canView) {
    return <EmptyState icon={<History className="h-6 w-6" />} title="Access limited" description="You don't have permission to view the activity log." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Activity log" subtitle="Audit trail of actions performed in this branch" />

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by user, action, or detail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="lg:w-40">
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading activity log…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" />} title="No activity" description="Tracked actions will appear here." />
      ) : (
        grouped.map(([ts, entries]) => (
          <Card key={ts || 'unknown'}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
              <History className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-600">{new Date(ts).toLocaleString()}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                        entry.type === 'PAYMENT' ? 'bg-emerald-50 text-emerald-700' :
                        entry.type === 'LOAN' ? 'bg-blue-50 text-blue-700' :
                        entry.type === 'BORROWER' ? 'bg-indigo-50 text-indigo-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {entry.type}
                      </span>
                      <p className="text-sm font-semibold text-slate-800">{entry.action}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{entry.details}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {entry.userName || entry.performedBy} {entry.userRole ? `(${entry.userRole})` : ''} · {entry.ipAddress || 'branch-portal'}
                      {entry.targetType && entry.targetId ? ` · ${entry.targetType} ${entry.targetId}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default ActivityLogPage;