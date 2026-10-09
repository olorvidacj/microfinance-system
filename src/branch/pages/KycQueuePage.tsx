import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  RefreshCw,
  Eye,
  Building2,
  Mail,
  Phone,
  RotateCcw,
  Sparkles,
  UserCheck,
  Scan,
  Check,
  AlertCircle,
} from 'lucide-react';
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
import { KycQueueItem } from '../types';
import { getSupabaseClient } from '../../lib/supabase';

type TabKey = 'ALL' | 'PENDING' | 'UNDER_REVIEW' | 'CORRECTION_REQUIRED' | 'RESUBMITTED' | 'APPROVED' | 'REJECTED';

export const KycQueuePage: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const fetcher = useCallback(
    () => kycService.queue({ status: activeTab, search }),
    [activeTab, search]
  );
  const { data, loading, error, reload } = useBranchData(fetcher);

  const queueItems: KycQueueItem[] = useMemo(() => data?.data || [], [data]);
  const counts = useMemo(
    () =>
      data?.counts || {
        all: 0,
        pending: 0,
        underReview: 0,
        correctionRequired: 0,
        resubmitted: 0,
        approved: 0,
        rejected: 0,
        notStarted: 0,
      },
    [data]
  );

  // ---------------------------------------------------------------------------
  // Real-Time Live Updates via Supabase Channels (with polling fallback)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let subChannel: any = null;
    const client = getSupabaseClient();

    if (client) {
      try {
        subChannel = client
          .channel('staff-kyc-queue-live')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'kyc_submissions' },
            () => {
              reload();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'kyc_documents' },
            () => {
              reload();
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'borrowers' },
            () => {
              reload();
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('[Staff KYC Realtime] Supabase subscription warning:', e);
      }
    }

    // Interval polling fallback (every 15s)
    const interval = setInterval(() => {
      reload();
    }, 15000);

    return () => {
      clearInterval(interval);
      if (subChannel && client) {
        client.removeChannel(subChannel).catch(() => {});
      }
    };
  }, [reload]);

  const tabConfigs: { key: TabKey; label: string; count: number; icon: React.ReactNode; colorClass: string }[] = [
    { key: 'ALL', label: 'All Applications', count: counts.all, icon: <Users className="h-4 w-4" />, colorClass: 'text-slate-600' },
    { key: 'PENDING', label: 'Pending Verification', count: counts.pending, icon: <Clock className="h-4 w-4 text-amber-500" />, colorClass: 'text-amber-600' },
    { key: 'RESUBMITTED', label: 'Resubmitted', count: counts.resubmitted, icon: <RotateCcw className="h-4 w-4 text-indigo-500" />, colorClass: 'text-indigo-600' },
    { key: 'UNDER_REVIEW', label: 'Under Review', count: counts.underReview, icon: <Eye className="h-4 w-4 text-blue-500" />, colorClass: 'text-blue-600' },
    { key: 'CORRECTION_REQUIRED', label: 'Correction Required', count: counts.correctionRequired, icon: <AlertTriangle className="h-4 w-4 text-rose-500" />, colorClass: 'text-rose-600' },
    { key: 'APPROVED', label: 'Approved', count: counts.approved, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, colorClass: 'text-emerald-600' },
    { key: 'REJECTED', label: 'Rejected', count: counts.rejected, icon: <XCircle className="h-4 w-4 text-red-500" />, colorClass: 'text-red-600' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff KYC Verification & Client Due Diligence"
        subtitle="Review real-time submitted identity, biometric face match, and livelihood documents"
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="w-72 pl-9"
                placeholder="Search name, client no, phone, status…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => reload()} title="Refresh KYC Queue">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Real-Time KPI Stats Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div
          onClick={() => setActiveTab('PENDING')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
            activeTab === 'PENDING'
              ? 'border-amber-400 bg-amber-50/80 shadow-sm ring-2 ring-amber-400/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-amber-700">
            <span>Pending</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{counts.pending}</p>
          <p className="text-[11px] text-slate-500">Requires verification</p>
        </div>

        <div
          onClick={() => setActiveTab('RESUBMITTED')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
            activeTab === 'RESUBMITTED'
              ? 'border-indigo-400 bg-indigo-50/80 shadow-sm ring-2 ring-indigo-400/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-indigo-700">
            <span>Resubmitted</span>
            <RotateCcw className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{counts.resubmitted}</p>
          <p className="text-[11px] text-slate-500">Updated after correction</p>
        </div>

        <div
          onClick={() => setActiveTab('UNDER_REVIEW')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
            activeTab === 'UNDER_REVIEW'
              ? 'border-blue-400 bg-blue-50/80 shadow-sm ring-2 ring-blue-400/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-blue-700">
            <span>Under Review</span>
            <Eye className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{counts.underReview}</p>
          <p className="text-[11px] text-slate-500">Currently audited</p>
        </div>

        <div
          onClick={() => setActiveTab('CORRECTION_REQUIRED')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
            activeTab === 'CORRECTION_REQUIRED'
              ? 'border-rose-400 bg-rose-50/80 shadow-sm ring-2 ring-rose-400/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-rose-700">
            <span>Correction</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{counts.correctionRequired}</p>
          <p className="text-[11px] text-slate-500">Awaiting client fix</p>
        </div>

        <div
          onClick={() => setActiveTab('APPROVED')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
            activeTab === 'APPROVED'
              ? 'border-emerald-400 bg-emerald-50/80 shadow-sm ring-2 ring-emerald-400/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-700">
            <span>Approved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{counts.approved}</p>
          <p className="text-[11px] text-slate-500">Verified & active</p>
        </div>

        <div
          onClick={() => setActiveTab('REJECTED')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
            activeTab === 'REJECTED'
              ? 'border-red-400 bg-red-50/80 shadow-sm ring-2 ring-red-400/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-red-700">
            <span>Rejected</span>
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{counts.rejected}</p>
          <p className="text-[11px] text-slate-500">Declined applications</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {tabConfigs.map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Applications Table */}
      {loading ? (
        <LoadingState label="Loading KYC verification queue from database…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : queueItems.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-8 w-8 text-emerald-500" />}
          title={`No KYC applications found in "${tabConfigs.find((t) => t.key === activeTab)?.label}"`}
          description={
            search
              ? `No records matched your search query "${search}". Try clearing the search.`
              : 'No client applications are currently waiting in this queue.'
          }
        />
      ) : (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Client & Legal Name</th>
                  <th className="px-4 py-3.5">Application Ref</th>
                  <th className="px-4 py-3.5">Contact Details</th>
                  <th className="px-4 py-3.5">Submission Time</th>
                  <th className="px-4 py-3.5">KYC Status</th>
                  <th className="px-4 py-3.5">ID Verification</th>
                  <th className="px-4 py-3.5">Face Biometrics</th>
                  <th className="px-4 py-3.5">Assigned Staff</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {queueItems.map((item) => {
                  const sub = item.kycSubmission;
                  const effectiveStatus = item.effectiveKycStatus || item.kycStatus || 'NOT_STARTED';

                  const idPassed = item.idVerificationStatus === 'PASSED';
                  const facePassed = item.faceVerificationStatus === 'PASSED';

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
                      {/* Client info */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-bold text-amber-400 ring-1 ring-amber-400/30">
                            {(item.fullName || '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{item.fullName}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono">{item.borrowerNumber || 'No Member No.'}</span>
                              <span>·</span>
                              <Link
                                to={`/staff/app/clients/${item.id}`}
                                className="font-medium text-amber-600 hover:text-amber-700 hover:underline"
                              >
                                View Profile
                              </Link>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Application Reference */}
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-semibold text-slate-700">
                        {item.applicationNumber || sub?.id || '—'}
                      </td>

                      {/* Contact Info */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="space-y-0.5 text-xs">
                          {item.phone && (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span>{item.phone}</span>
                            </div>
                          )}
                          {item.email && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Mail className="h-3 w-3 text-slate-400" />
                              <span className="truncate max-w-[140px]">{item.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Submitted Date */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">
                        {sub?.submittedAt ? (
                          <div>
                            <p className="font-medium text-slate-800">
                              {new Date(sub.submittedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {new Date(sub.submittedAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        ) : item.membershipDate ? (
                          <span>{item.membershipDate}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <StatusBadge status={effectiveStatus} />
                      </td>

                      {/* ID Verification Indicator */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs">
                        {idPassed ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                            <Check className="h-3 w-3" />
                            <span>Passed {item.ocrConfidence ? `(${item.ocrConfidence}%)` : ''}</span>
                          </span>
                        ) : item.idVerificationStatus === 'NEEDS_REVIEW' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-600/20">
                            <AlertCircle className="h-3 w-3" />
                            <span>Needs Review</span>
                          </span>
                        ) : item.idVerificationStatus === 'FAILED' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 ring-1 ring-rose-600/20">
                            <XCircle className="h-3 w-3" />
                            <span>Failed</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not uploaded</span>
                        )}
                      </td>

                      {/* Face Biometric Indicator */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs">
                        {facePassed ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                            <Check className="h-3 w-3" />
                            <span>Match {item.faceMatchConfidence ? `${item.faceMatchConfidence}%` : '✓'}</span>
                          </span>
                        ) : item.faceVerificationStatus === 'LOW_CONFIDENCE' || item.faceVerificationStatus === 'NEEDS_REVIEW' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-600/20">
                            <AlertCircle className="h-3 w-3" />
                            <span>{item.faceMatchConfidence ? `${item.faceMatchConfidence}% Review` : 'Needs Review'}</span>
                          </span>
                        ) : item.faceVerificationStatus === 'FAILED' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 ring-1 ring-rose-600/20">
                            <XCircle className="h-3 w-3" />
                            <span>Mismatch</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No selfie</span>
                        )}
                      </td>

                      {/* Reviewer / Assigned Staff */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs">
                        {sub?.reviewedByName ? (
                          <div>
                            <p className="font-medium text-slate-800">{sub.reviewedByName}</p>
                            {sub.reviewedAt && (
                              <p className="text-[10px] text-slate-400">
                                {new Date(sub.reviewedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="italic text-slate-400">Unassigned</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <Button
                          variant="brand"
                          size="sm"
                          onClick={() => setSelectedClientId(item.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Review Dossier</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Complete KYC Review Dossier Panel */}
      {selectedClientId && (
        <KycReviewPanel
          clientId={selectedClientId}
          onClose={() => setSelectedClientId(null)}
          onDone={(status) => {
            toast.success(`KYC status successfully updated to ${status.replace(/_/g, ' ')}.`);
            reload();
          }}
        />
      )}
    </div>
  );
};

export default KycQueuePage;