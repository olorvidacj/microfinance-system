import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck, HandCoins, Phone, PiggyBank, UsersRound } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { Amount } from '../../portal/components/ui/Amount';
import { InfoRow } from '../../portal/components/common';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { useBranchData } from '../hooks/useBranchData';
import { groupsService } from '../services';

const GroupDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const fetcher = useCallback(() => groupsService.get(id), [id]);
  const { data, loading, error, reload } = useBranchData(fetcher);

  if (loading) return <LoadingState label="Loading group…" />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  const { group, members } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={group.groupName}
        subtitle={`${group.groupCode} · ${group.centerName}`}
        actions={<StatusBadge status={group.status || 'Active'} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-4 w-4" /> Meetings</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Day" value={`${group.meetingDay} · ${group.meetingTime}`} />
              <InfoRow label="Location" value={group.meetingLocation} />
              <InfoRow label="Formed" value={group.formedDate} />
              <InfoRow label="Loan officer" value={group.loanOfficerName || '—'} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UsersRound className="h-4 w-4" /> Leadership</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm font-semibold text-slate-800">{group.leaderName}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                <Phone className="h-3 w-3" /> {group.leaderPhone || '—'}
              </p>
            </CardBody>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <CardBody className="rounded-2xl border border-emerald-100 bg-emerald-50/60">
              <p className="text-xs text-slate-500">Active loans</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-900">{group.totalActiveLoans ?? 0}</p>
            </CardBody>
            <CardBody className="rounded-2xl border border-emerald-100 bg-emerald-50/60">
              <p className="text-xs text-slate-500">Repayment rate</p>
              <p className="text-xl font-bold tabular-nums text-emerald-700">{group.repaymentRate ?? 0}%</p>
            </CardBody>
            <CardBody className="flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50/60">
              <PiggyBank className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xs text-slate-500">Group savings</p>
                <p className="text-base font-bold tabular-nums text-amber-800"><Amount value={group.totalGroupSavings ?? 0} /></p>
              </div>
            </CardBody>
            <CardBody className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50">
              <HandCoins className="h-5 w-5 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">Solidarity fund</p>
                <p className="text-base font-bold tabular-nums text-slate-800"><Amount value={group.solidarityFundBalance ?? 0} /></p>
              </div>
            </CardBody>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="h-4 w-4" /> Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Member', 'Role', 'Weekly dues', 'Active loans', 'Outstanding', 'Repayment status'].map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {members.map((m) => (
                      <tr key={m.borrowerId} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-xs font-bold text-white">
                              {(m.fullName || '?').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{m.fullName}</p>
                              <p className="text-xs text-slate-400">{m.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{m.role || 'Member'}</td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700"><Amount value={m.weeklyDues ?? 0} /></td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">{m.activeLoans ?? 0}</td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums font-semibold text-slate-800"><Amount value={m.outstandingBalance ?? 0} /></td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={m.repaymentStatus || m.status || 'Good Standing'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GroupDetailPage;