import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Input } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { kycService } from '../services';
import { KycReviewPanel } from '../components/KycReviewPanel';
import { ClientDetail } from '../types';

const KycQueuePage: React.FC = () => {
  const toast = useToast();
  const fetcher = useCallback(() => kycService.queue(), []);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientDetail | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data || [];
    return (data || []).filter(
      (c) => c.fullName.toLowerCase().includes(q) || c.borrowerNumber.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [data, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="KYC verification queue"
        subtitle="Clients whose documents or membership status still require review"
        actions={
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="w-64 pl-9"
              placeholder="Search queue…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      />

      {loading ? (
        <LoadingState label="Loading KYC queue…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Queue is clear" description="No clients awaiting KYC verification." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Client', 'Borrower No.', 'KYC status', 'Member status', 'Docs submitted', 'Member since', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-xs font-bold text-white">
                          {(c.fullName || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{c.fullName}</div>
                          <Link to={`/staff/app/clients/${c.id}`} className="text-xs text-blue-700 hover:text-blue-900">
                            View profile
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{c.borrowerNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={c.kycStatus} /></td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={c.memberStatus} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{c.submittedDocuments || 0}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{c.membershipDate}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button variant="brand" size="sm" onClick={() => setSelected(c as unknown as ClientDetail)}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <KycReviewPanel
        client={selected}
        onClose={() => setSelected(null)}
        onDone={(status) => {
          toast.success(`KYC review submitted (${status})`);
          reload();
        }}
      />
    </div>
  );
};

export default KycQueuePage;