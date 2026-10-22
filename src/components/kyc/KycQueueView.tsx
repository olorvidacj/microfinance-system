import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Eye, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';
import type { kycQueue } from '../../kyc/service';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { Input } from '../../portal/components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { KycStatusBadge } from '../KycStatusBadge';
import { KycReviewPanel, type KycReviewApi } from './KycReviewPanel';

export type KycQueueResultView = Awaited<ReturnType<typeof kycQueue>>;
export type KycQueueRow = KycQueueResultView['items'][number];

type Tab = 'AWAITING' | 'UNDER_REVIEW' | 'CORRECTION_REQUIRED' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'ALL';

const TABS: Array<{ key: Tab; label: string; count: (c: KycQueueResultView['counts']) => number; icon: React.ReactNode }> = [
  { key: 'AWAITING', label: 'Waiting for review', count: (c) => c.pending + c.underReview, icon: <Clock className="h-4 w-4 text-amber-500" /> },
  { key: 'UNDER_REVIEW', label: 'Under review', count: (c) => c.underReview, icon: <Eye className="h-4 w-4 text-blue-500" /> },
  { key: 'CORRECTION_REQUIRED', label: 'Resubmission required', count: (c) => c.correctionRequired, icon: <AlertTriangle className="h-4 w-4 text-orange-500" /> },
  { key: 'APPROVED', label: 'Verified', count: (c) => c.approved, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
  { key: 'REJECTED', label: 'Rejected', count: (c) => c.rejected, icon: <XCircle className="h-4 w-4 text-rose-500" /> },
  { key: 'IN_PROGRESS', label: 'Started, not submitted', count: (c) => c.inProgress + c.notStarted, icon: <ShieldCheck className="h-4 w-4 text-slate-400" /> },
  { key: 'ALL', label: 'All members', count: (c) => c.all, icon: null },
];

const POLL_MS = 15_000;

export interface KycQueueViewProps {
  title: string;
  subtitle: string;
  load: (params: { status?: string; search?: string }) => Promise<{ data: KycQueueRow[]; counts: KycQueueResultView['counts'] }>;
  api: KycReviewApi;
  canDecide: boolean;
  showBranch?: boolean;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export const KycQueueView: React.FC<KycQueueViewProps> = ({ title, subtitle, load, api, canDecide, showBranch }) => {
  const [tab, setTab] = useState<Tab>('AWAITING');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<{ data: KycQueueRow[]; counts: KycQueueResultView['counts'] } | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = tab === 'ALL' ? undefined : tab === 'IN_PROGRESS' ? undefined : tab;
      const r = await load({ status, search: search.trim() || undefined });
      const data = tab === 'IN_PROGRESS' ? r.data.filter((i) => i.kycStatus === 'IN_PROGRESS' || i.kycStatus === 'NOT_STARTED') : r.data;
      setResult({ data, counts: r.counts });
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load the KYC queue.');
    }
  }, [load, tab, search]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const counts = useMemo(() => result?.counts, [result]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="w-64 pl-9" placeholder="Name, member no., reference…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search KYC applications" />
            </div>
            <Button variant="outline" size="sm" onClick={refresh} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${tab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {t.icon}
            {t.label}
            {counts && <span className={`rounded-full px-2 py-0.5 text-[10px] ${tab === t.key ? 'bg-slate-700' : 'bg-slate-200'}`}>{t.count(counts)}</span>}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !result ? (
        <LoadingState label="Loading KYC applications…" />
      ) : result.data.length === 0 ? (
        <EmptyState title="Nothing here" description={tab === 'AWAITING' ? 'No applications are waiting for review.' : 'No members match this filter.'} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm" id="kyc-queue-table">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  {showBranch && <th className="px-4 py-3">Branch</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Automated checks</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.data.map((i) => (
                  <tr key={i.borrowerId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{i.fullName}</p>
                      <p className="text-xs text-slate-500">{i.borrowerNumber} · {i.phone}</p>
                    </td>
                    {showBranch && <td className="px-4 py-3 text-xs text-slate-600">{i.branchId}</td>}
                    <td className="px-4 py-3">
                      <KycStatusBadge status={i.kycStatus} size="xs" />
                      {i.claimedByName && i.kycStatus === 'UNDER_REVIEW' && <p className="mt-1 text-[11px] text-slate-500">by {i.claimedByName}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {i.referenceNumber ?? '—'}
                      {i.submissionCount > 1 && <span className="ml-1 rounded bg-indigo-50 px-1 text-[10px] text-indigo-700">v{i.submissionCount}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{fmt(i.submittedAt)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={i.faceCheckStatus === 'NO_MATCH' ? 'text-rose-700' : i.faceCheckStatus === 'MATCH' ? 'text-emerald-700' : 'text-slate-500'}>
                        Face: {i.faceCheckStatus ? i.faceCheckStatus.replace('_', ' ').toLowerCase() : 'not run'}
                        {i.faceConfidence != null ? ` (${i.faceConfidence}%)` : ''}
                      </span>
                      {i.discrepancyCount > 0 && <span className="ml-2 text-rose-700">· {i.discrepancyCount} mismatch{i.discrepancyCount > 1 ? 'es' : ''}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant={i.kycStatus === 'SUBMITTED' || i.kycStatus === 'UNDER_REVIEW' ? 'brand' : 'outline'} onClick={() => setSelected(i.borrowerId)}>
                        {canDecide && (i.kycStatus === 'SUBMITTED' || i.kycStatus === 'UNDER_REVIEW') ? 'Review' : 'View'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selected && (
        <KycReviewPanel
          clientId={selected}
          api={api}
          canDecide={canDecide}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            refresh();
          }}
        />
      )}
    </div>
  );
};

export default KycQueueView;
