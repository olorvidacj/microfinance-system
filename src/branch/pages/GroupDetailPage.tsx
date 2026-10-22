import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarCheck, CheckCircle2, HandCoins, Pencil, PiggyBank, Search, ShieldAlert, UserMinus, UserPlus, UsersRound, Wallet } from 'lucide-react';
import {
  GROUP_FUND_KIND_LABELS,
  GROUP_ROLES,
  GROUP_ROLE_LABELS,
  GROUP_STATUS_LABELS,
  MEETING_FREQUENCY_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  centsFromDb,
  centsToDecimal,
  membershipOpen,
  parsePesos,
  validateCollection,
  type GroupFundKind,
  type GroupRole,
  type MeetingFrequency,
} from '../../../shared/lending';
import { isKycVerified } from '../../../shared/kyc-core';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { InfoRow } from '../../portal/components/common';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { Tabs } from '../../portal/components/ui/Tabs';
import { useToast } from '../../portal/components/ui/Toast';
import { manilaToday, peso } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { clientsService, groupsService, type GroupDetailView, type GroupFundView, type GroupMeetingView, type PendingGroupLoan } from '../services';
import type { ClientSummary } from '../types';
import { GroupFormModal, groupTone } from './GroupLendingPage';
import { newKey } from '../components/SavingsDialogs';

type Member = GroupDetailView['members'][number];
type StatusAction = 'ACTIVATE' | 'SUSPEND' | 'REINSTATE' | 'DISSOLVE';
const STANDING: Record<string, { label: string; tone: 'green' | 'red' | 'amber' }> = {
  GOOD: { label: 'Good standing', tone: 'green' },
  IN_ARREARS: { label: 'Behind', tone: 'red' },
  OWES_FUND: { label: 'Owes the fund', tone: 'amber' },
};
const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export interface GroupPermissions {
  manage: boolean;
  sensitive: boolean;
  collect: boolean;
}

/**
 * The group's header, banners, facts and member table. Pure (props in, markup
 * out) so it renders the same for every shape the server can send, including
 * a forming group with no members and a migrated group with no leader.
 */
export const GroupOverview: React.FC<{
  detail: GroupDetailView;
  can: GroupPermissions;
  onStatus?: (action: StatusAction) => void;
  onEdit?: () => void;
  onAddMember?: () => void;
  onRemove?: (m: Member) => void;
  onRole?: (m: Member, role: GroupRole) => void;
}> = ({ detail, can, onStatus, onEdit, onAddMember, onRemove, onRole }) => {
  const g = detail.group;
  const members = Array.isArray(detail.members) ? detail.members : [];
  const open = membershipOpen(g.status);
  const leader = members.find((m) => m.role === 'LEADER');
  return (
    <div className="space-y-5">
      <PageHeader
        title={g.groupName}
        subtitle={`${g.groupCode} · ${g.centerName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={GROUP_STATUS_LABELS[g.status] ?? g.status} tone={groupTone(g.status)} />
            {can.manage && g.status !== 'DISSOLVED' && <Button variant="outline" onClick={onEdit}><Pencil className="h-4 w-4" /> Edit</Button>}
            {can.manage && g.status === 'FORMING' && <Button variant="brand" onClick={() => onStatus?.('ACTIVATE')} disabled={detail.activationIssues.length > 0}><CheckCircle2 className="h-4 w-4" /> Activate</Button>}
            {can.sensitive && g.status === 'ACTIVE' && <Button variant="outline" onClick={() => onStatus?.('SUSPEND')}>Suspend</Button>}
            {can.sensitive && g.status === 'SUSPENDED' && <Button variant="brand" onClick={() => onStatus?.('REINSTATE')}>Reinstate</Button>}
            {can.sensitive && g.status !== 'DISSOLVED' && <Button variant="outline" onClick={() => onStatus?.('DISSOLVE')}>Dissolve</Button>}
          </div>
        }
      />

      {g.statusReason && g.status !== 'ACTIVE' && <p className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">Status note: {g.statusReason}</p>}
      {detail.activationIssues.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="activation-issues">
          <p className="font-semibold">Before this group can be {g.status === 'FORMING' ? 'activated' : 'reinstated'}:</p>
          <ul className="mt-1 list-disc pl-5">{detail.activationIssues.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      )}
      {detail.block.blocked && (
        <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" data-testid="group-blocked">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">This group cannot take new loans until its arrears are cleared.</p>
            <ul className="mt-1 list-disc pl-5">{detail.block.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-4 w-4" /> Meetings and officer</CardTitle>
          </CardHeader>
          <CardBody>
            <InfoRow label="Meets" value={`${g.meetingDay} · ${g.meetingTime}`} />
            <InfoRow label="How often" value={MEETING_FREQUENCY_LABELS[g.meetingFrequency as MeetingFrequency] ?? g.meetingFrequency} />
            <InfoRow label="Where" value={g.meetingLocation} />
            <InfoRow label="Loan officer" value={g.loanOfficerName || '—'} />
            <InfoRow label="Formed" value={g.formedDate} />
            <InfoRow label="Arrears limit" value={`${g.arrearsThresholdDays} days`} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UsersRound className="h-4 w-4" /> Leadership</CardTitle>
          </CardHeader>
          <CardBody>
            {(['LEADER', 'SECRETARY', 'TREASURER'] as const).map((r) => (
              <InfoRow key={r} label={GROUP_ROLE_LABELS[r]} value={members.find((m) => m.role === r)?.fullName ?? <span className="text-amber-700">Not assigned</span>} />
            ))}
            {leader?.phone && <p className="mt-1 text-xs text-slate-400">Leader's phone: {leader.phone}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Solidarity fund</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-2xl font-bold tabular-nums text-slate-900" data-testid="fund-balance">{peso(g.fundBalance)}</p>
            <p className="mt-1 text-xs text-slate-500">Covers overdue installments of members; what it pays, the member owes back.</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UsersRound className="h-4 w-4" /> Members ({members.length})</CardTitle>
          {can.manage && open && <Button variant="outline" onClick={onAddMember}><UserPlus className="h-4 w-4" /> Add member</Button>}
        </CardHeader>
        <CardBody className="p-0">
          {members.length === 0 ? (
            <EmptyState icon={<UsersRound className="h-6 w-6" />} title="No members yet" description="Add KYC-verified members of this branch." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Member', 'Role', 'Standing', 'Group loan', 'Overdue', 'Owes fund', ''].map((h) => (
                      <th key={h} className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${['Overdue', 'Owes fund'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => {
                    const loans = Array.isArray(m.loans) ? m.loans : [];
                    const st = STANDING[m.standing] ?? { label: m.standing, tone: 'amber' as const };
                    return (
                      <tr key={m.borrowerId} data-testid="member-row">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{m.fullName}</p>
                          <p className="text-xs text-slate-400">{m.memberNumber || ''}{m.kycVerified ? '' : ' · KYC not verified'}</p>
                        </td>
                        <td className="px-4 py-3">
                          {can.manage && open && onRole ? (
                            <Select value={m.role} onChange={(e) => onRole(m, e.target.value as GroupRole)} aria-label={`Role of ${m.fullName}`}>
                              {GROUP_ROLES.map((r) => <option key={r} value={r}>{GROUP_ROLE_LABELS[r]}</option>)}
                            </Select>
                          ) : (
                            GROUP_ROLE_LABELS[m.role] ?? m.role
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={st.label} tone={st.tone} /></td>
                        <td className="px-4 py-3 text-xs">
                          {loans.length === 0 ? '—' : loans.map((l) => <Link key={l.id} to={`/staff/app/loans/${l.id}`} className="block text-emerald-700 hover:underline">{l.loanNumber} · {peso(l.remaining)}</Link>)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{loans.some((l) => centsFromDb(l.overdue) > 0) ? <span className="font-semibold text-rose-700">{peso(centsToDecimal(loans.reduce((s, l) => s + centsFromDb(l.overdue), 0)))}</span> : '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{centsFromDb(m.coverOwed) > 0 ? <span className="font-semibold text-amber-700">{peso(m.coverOwed)}</span> : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {can.manage && open && onRemove && (
                            <button type="button" onClick={() => onRemove(m)} title={`Remove ${m.fullName}`} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50">
                              <UserMinus className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

const GroupDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const toast = useToast();
  const can: GroupPermissions = {
    manage: useBranchPermission(['manage_loan_applications']),
    sensitive: useBranchPermission(['approve_sensitive_operations']),
    collect: useBranchPermission(['process_loan_repayments']),
  };
  const fetcher = useCallback(() => groupsService.get(id), [id]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [tab, setTab] = useState('loans');
  const [dialog, setDialog] = useState<
    | { kind: 'edit' }
    | { kind: 'status'; action: StatusAction }
    | { kind: 'add' }
    | { kind: 'remove'; member: Member }
    | { kind: 'cover'; member: Member; loan: Member['loans'][number] }
    | { kind: 'meeting' }
    | null
  >(null);
  const [version, setVersion] = useState(0);
  const refresh = () => {
    reload();
    setVersion((v) => v + 1);
  };
  const done = (message: string) => {
    setDialog(null);
    toast.success(message);
    refresh();
  };

  if (loading && !data) return <LoadingState label="Loading group…" />;
  if (error || !data) return <ErrorState message={error || 'Group not found.'} onRetry={reload} />;
  const g = data.group;

  const setRole = async (m: Member, role: GroupRole) => {
    try {
      await groupsService.setRole(g.id, m.borrowerId, role);
      toast.success(`${m.fullName} is now ${GROUP_ROLE_LABELS[role].toLowerCase()}.`);
      refresh();
    } catch (err) {
      toast.error(messageOf(err, 'The role could not be changed.'));
    }
  };

  const tabs = [
    { id: 'loans', label: 'Loans and consent' },
    { id: 'fund', label: 'Solidarity fund' },
    { id: 'meetings', label: 'Meetings' },
    ...(can.collect && (g.status === 'ACTIVE' || g.status === 'SUSPENDED') ? [{ id: 'collect', label: 'Collection' }] : []),
  ];

  return (
    <div className="space-y-5">
      <Link to="/staff/app/groups" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Groups
      </Link>
      <GroupOverview
        detail={data}
        can={can}
        onEdit={() => setDialog({ kind: 'edit' })}
        onStatus={(action) => setDialog({ kind: 'status', action })}
        onAddMember={() => setDialog({ kind: 'add' })}
        onRemove={(member) => setDialog({ kind: 'remove', member })}
        onRole={setRole}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'loans' && <LoansTab key={version} detail={data} can={can} onCover={(member, loan) => setDialog({ kind: 'cover', member, loan })} onChanged={refresh} />}
      {tab === 'fund' && <FundTab key={version} groupId={g.id} />}
      {tab === 'meetings' && <MeetingsTab key={version} groupId={g.id} canRecord={can.manage && g.status !== 'DISSOLVED'} onRecord={() => setDialog({ kind: 'meeting' })} />}
      {tab === 'collect' && <CollectionTab detail={data} onPosted={(m) => { toast.success(m); refresh(); }} />}

      {dialog?.kind === 'edit' && (
        <GroupFormModal
          groupId={g.id}
          initial={{ groupName: g.groupName, centerName: g.centerName, meetingDay: g.meetingDay, meetingTime: g.meetingTime, meetingFrequency: g.meetingFrequency, meetingLocation: g.meetingLocation, loanOfficerId: g.loanOfficerId, arrearsThresholdDays: String(g.arrearsThresholdDays) }}
          onClose={() => setDialog(null)}
          onSaved={() => done('Group details saved.')}
        />
      )}
      {dialog?.kind === 'status' && <StatusModal groupId={g.id} groupName={g.groupName} action={dialog.action} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'add' && <AddMemberModal groupId={g.id} taken={data.members.map((m) => m.role)} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'remove' && <RemoveMemberModal groupId={g.id} member={dialog.member} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'cover' && <CoverModal groupId={g.id} fund={g.fundBalance} member={dialog.member} loan={dialog.loan} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'meeting' && <MeetingModal groupId={g.id} members={data.members} location={g.meetingLocation} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const LoansTab: React.FC<{ detail: GroupDetailView; can: GroupPermissions; onCover: (m: Member, l: Member['loans'][number]) => void; onChanged: () => void }> = ({ detail, can, onCover, onChanged }) => {
  const toast = useToast();
  const g = detail.group;
  const [pending, setPending] = useState<PendingGroupLoan[] | null>(null);
  useEffect(() => {
    groupsService.pendingLoans(g.id).then(setPending, (err) => toast.error(messageOf(err, 'Pending loans could not be loaded.')));
  }, [g.id, toast]);
  const nameOf = (id: string) => detail.members.find((m) => m.borrowerId === id)?.fullName ?? id;
  const record = async (loan: PendingGroupLoan, borrowerId: string, decision: 'CONSENT' | 'DECLINE') => {
    let note: string | undefined;
    if (decision === 'DECLINE') {
      note = window.prompt(`Why does ${nameOf(borrowerId)} not support this loan?`) ?? '';
      if (!note.trim()) return;
    }
    try {
      setPending(await groupsService.recordConsent(loan.id, borrowerId, decision, note));
      toast.success(`${nameOf(borrowerId)}: ${decision === 'CONSENT' ? 'consent' : 'refusal'} recorded.`);
      onChanged();
    } catch (err) {
      toast.error(messageOf(err, 'The consent could not be recorded.'));
    }
  };
  const running = detail.members.flatMap((m) => (Array.isArray(m.loans) ? m.loans : []).map((l) => ({ m, l })));
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Applications waiting for the group's consent</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {pending === null ? (
            <LoadingState label="Loading…" />
          ) : pending.length === 0 ? (
            <p className="text-sm text-slate-500">No group loan applications are waiting.</p>
          ) : (
            pending.map((loan) => (
              <div key={loan.id} className="rounded-xl border border-slate-200 p-4" data-testid="pending-group-loan">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">
                    <Link to={`/staff/app/loans/${loan.id}`} className="hover:underline">{loan.loanNumber}</Link> · {loan.borrowerName} · {peso(loan.principalAmount)} over {loan.termMonths} months
                  </p>
                  <StatusBadge status={loan.consent.complete ? 'Consent complete' : `${loan.consent.consented.length} of ${loan.consent.required.length} consented`} tone={loan.consent.complete ? 'green' : loan.consent.declined.length ? 'red' : 'amber'} />
                </div>
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {loan.consent.required.map((id) => {
                    const rec = loan.consent.records.find((r) => r.borrowerId === id);
                    return (
                      <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>
                          {nameOf(id)}{' '}
                          {rec ? (
                            <span className={rec.decision === 'CONSENT' ? 'text-emerald-700' : 'text-rose-700'}>
                              · {rec.decision === 'CONSENT' ? 'consented' : 'declined'} ({rec.channel === 'PORTAL' ? 'in the portal' : `recorded by ${rec.recordedByName}`}){rec.note ? `: ${rec.note}` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">· not yet</span>
                          )}
                        </span>
                        {can.manage && (
                          <span className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => record(loan, id, 'CONSENT')} aria-label={`Consent for ${nameOf(id)}`}>Consents</Button>
                            <Button size="sm" variant="outline" onClick={() => record(loan, id, 'DECLINE')} aria-label={`Decline for ${nameOf(id)}`}>Declines</Button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Running group loans</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {running.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">No running group loans.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Loan', 'Member', 'Remaining', 'Overdue', 'Behind since', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {running.map(({ m, l }) => (
                  <tr key={l.id} data-testid="running-group-loan">
                    <td className="px-4 py-3"><Link to={`/staff/app/loans/${l.id}`} className="text-emerald-700 hover:underline">{l.loanNumber}</Link></td>
                    <td className="px-4 py-3">{m.fullName}</td>
                    <td className="px-4 py-3 tabular-nums">{peso(l.remaining)}</td>
                    <td className="px-4 py-3 tabular-nums">{centsFromDb(l.overdue) > 0 ? <span className="font-semibold text-rose-700">{peso(l.overdue)}</span> : '—'}</td>
                    <td className="px-4 py-3">{l.oldestOverdue ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {can.sensitive && centsFromDb(l.overdue) > 0 && centsFromDb(g.fundBalance) > 0 && (
                        <Button size="sm" variant="brand" onClick={() => onCover(m, l)}><HandCoins className="h-4 w-4" /> Cover from fund</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

const FundTab: React.FC<{ groupId: string }> = ({ groupId }) => {
  const fetcher = useCallback(() => groupsService.fund(groupId), [groupId]);
  const { data, loading, error, reload } = useBranchData<GroupFundView>(fetcher);
  if (loading) return <LoadingState label="Loading the fund…" />;
  if (error || !data) return <ErrorState message={error || 'Fund not found.'} onRetry={reload} />;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HandCoins className="h-4 w-4" /> Covers (owed back to the fund)</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {data.covers.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">The fund has not covered anyone.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>{['Cover', 'Member', 'Loan', 'Covered', 'Paid back', 'Still owed', 'Status'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.covers.map((c) => (
                  <tr key={c.id} data-testid="cover-row">
                    <td className="px-4 py-3 font-mono text-xs">{c.coverNumber}</td>
                    <td className="px-4 py-3">{c.memberName}</td>
                    <td className="px-4 py-3">{c.loanNumber}</td>
                    <td className="px-4 py-3 tabular-nums">{peso(c.amount)}</td>
                    <td className="px-4 py-3 tabular-nums">{peso(c.repaid)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{peso(c.outstanding)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status === 'REPAID' ? 'Repaid' : 'Owed'} tone={c.status === 'REPAID' ? 'green' : 'amber'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Fund history · balance {peso(data.balance)}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {data.transactions.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">Nothing has been paid in yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>{['Date', 'Number', 'What', 'Member', 'Amount', 'Balance'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.transactions.map((t) => (
                  <tr key={t.id} data-testid="fund-row">
                    <td className="px-4 py-3">{t.date}</td>
                    <td className="px-4 py-3 font-mono text-xs">{t.number}</td>
                    <td className="px-4 py-3">{GROUP_FUND_KIND_LABELS[t.kind as GroupFundKind] ?? t.label}</td>
                    <td className="px-4 py-3">{t.memberName ?? '—'}</td>
                    <td className={`px-4 py-3 tabular-nums ${centsFromDb(t.amount) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{peso(t.amount)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{peso(t.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

const MeetingsTab: React.FC<{ groupId: string; canRecord: boolean; onRecord: () => void }> = ({ groupId, canRecord, onRecord }) => {
  const fetcher = useCallback(() => groupsService.meetings(groupId), [groupId]);
  const { data, loading, error, reload } = useBranchData<GroupMeetingView[]>(fetcher);
  if (loading) return <LoadingState label="Loading meetings…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-4 w-4" /> Meetings and attendance</CardTitle>
        {canRecord && <Button variant="brand" onClick={onRecord}>Record meeting</Button>}
      </CardHeader>
      <CardBody className="space-y-3">
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No meetings recorded.</p>
        ) : (
          (data ?? []).map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 p-3 text-sm" data-testid="meeting-row">
              <p className="font-semibold text-slate-800">{m.meetingDate} · {m.present} of {m.total} present · {m.location}</p>
              <p className="mt-1 text-xs text-slate-500">
                {m.attendance.map((a) => `${a.name}: ${a.status.toLowerCase()}`).join(' · ')}
              </p>
              {m.notes && <p className="mt-1 text-xs text-slate-600">{m.notes}</p>}
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
};

/** Several members' payments entered at the meeting and posted in one transaction. */
const CollectionTab: React.FC<{ detail: GroupDetailView; onPosted: (message: string) => void }> = ({ detail, onPosted }) => {
  const g = detail.group;
  type Row = { loanId: string | null; loanAmount: string; fundAmount: string; coverRepayment: string };
  const initial = useMemo(
    () => Object.fromEntries(detail.members.map((m) => [m.borrowerId, { loanId: m.loans[0]?.id ?? null, loanAmount: '', fundAmount: '', coverRepayment: '' } as Row])),
    [detail.members],
  );
  const [rows, setRows] = useState<Record<string, Row>>(initial);
  const [method, setMethod] = useState<string>('CASH');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState(newKey);
  const [result, setResult] = useState<{ number: string; lines: any[] } | null>(null);

  const lines = detail.members.map((m) => ({ borrowerId: m.borrowerId, ...rows[m.borrowerId] }));
  const check = validateCollection(lines);
  const totalOf = (k: keyof Row) => lines.reduce((s, l) => s + (parsePesos(l[k] || '0') ?? 0), 0);

  const set = (id: string, k: keyof Row, v: string) => setRows((r) => ({ ...r, [id]: { ...r[id], [k]: v } }));
  const post = async () => {
    setError('');
    setErrors(check.errors);
    if (!check.ok) return;
    if (method !== 'CASH' && !reference.trim()) return setError('Enter the transfer reference.');
    setSaving(true);
    try {
      const c = await groupsService.collect(g.id, { method, referenceNumber: reference || undefined, lines: lines.filter((l) => l.loanAmount || l.fundAmount || l.coverRepayment) }, key);
      setResult({ number: c.collectionNumber, lines: Array.isArray(c.lines) ? (c.lines as any[]) : [] });
      setRows(initial);
      setKey(newKey());
      onPosted(`Collection ${c.collectionNumber} posted: ${peso(c.total)}.`);
    } catch (err) {
      setError(messageOf(err, 'The collection could not be posted; nothing was recorded.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection at the meeting</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-slate-500">Enter what each member hands over. Everything is posted together: if one line is refused, none are recorded.</p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>{['Member', 'Due now', 'Loan payment', 'Fund contribution', 'Pays back fund'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.members.map((m, i) => {
                const loan = m.loans[0];
                const r = rows[m.borrowerId] ?? { loanId: null, loanAmount: '', fundAmount: '', coverRepayment: '' };
                return (
                  <tr key={m.borrowerId} data-testid="collection-row">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{m.fullName}</p>
                      <p className="text-xs text-slate-400">{loan ? loan.loanNumber : 'no group loan'}</p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{loan ? peso(loan.dueToday) : '—'}</td>
                    <td className="px-3 py-2">
                      <Input inputMode="decimal" disabled={!loan} value={r.loanAmount} onChange={(e) => set(m.borrowerId, 'loanAmount', e.target.value)} aria-label={`Loan payment ${m.fullName}`} placeholder="0.00" />
                      {(errors[`lines.${i}.loanAmount`]) && <p className="text-xs text-rose-600">{errors[`lines.${i}.loanAmount`]}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <Input inputMode="decimal" value={r.fundAmount} onChange={(e) => set(m.borrowerId, 'fundAmount', e.target.value)} aria-label={`Fund contribution ${m.fullName}`} placeholder="0.00" />
                    </td>
                    <td className="px-3 py-2">
                      <Input inputMode="decimal" disabled={centsFromDb(m.coverOwed) <= 0} value={r.coverRepayment} onChange={(e) => set(m.borrowerId, 'coverRepayment', e.target.value)} aria-label={`Fund repayment ${m.fullName}`} placeholder={centsFromDb(m.coverOwed) > 0 ? `owes ${peso(m.coverOwed)}` : '—'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Total {peso(centsToDecimal(check.total))}</td>
                <td className="px-3 py-2 tabular-nums">{peso(centsToDecimal(totalOf('loanAmount')))}</td>
                <td className="px-3 py-2 tabular-nums">{peso(centsToDecimal(totalOf('fundAmount')))}</td>
                <td className="px-3 py-2 tabular-nums">{peso(centsToDecimal(totalOf('coverRepayment')))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Received by">
            <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Collection method">
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
            </Select>
          </Field>
          {method !== 'CASH' && (
            <Field label="Transfer reference" required>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} aria-label="Transfer reference" />
            </Field>
          )}
          <Button variant="brand" onClick={post} loading={saving} disabled={check.total <= 0}>Post collection</Button>
        </div>
        {errors.lines && <p className="text-sm text-rose-600">{errors.lines}</p>}
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" data-testid="collection-result">
            <p className="font-semibold">Posted {result.number}</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.lines.map((l, i) => (
                <li key={i}>
                  {detail.members.find((m) => m.borrowerId === l.borrowerId)?.fullName}: {[l.receiptNumber && `loan ${peso(l.loanAmount)} (${l.receiptNumber})`, l.fundAmount && `fund ${peso(l.fundAmount)}`, l.coverRepayment && `paid back ${peso(l.coverRepayment)}`].filter(Boolean).join(', ')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const STATUS_TEXT: Record<StatusAction, { title: string; verb: string; hint: string; needsReason: boolean }> = {
  ACTIVATE: { title: 'Activate group', verb: 'Activate', hint: 'Members can then apply for group loans.', needsReason: false },
  SUSPEND: { title: 'Suspend group', verb: 'Suspend', hint: 'No new members or loans; collections continue.', needsReason: true },
  REINSTATE: { title: 'Reinstate group', verb: 'Reinstate', hint: 'The group must again have its leader, secretary, treasurer and at least 3 members.', needsReason: true },
  DISSOLVE: { title: 'Dissolve group', verb: 'Dissolve', hint: 'Only when no group loan is open, nothing is owed to the fund and the fund is empty. Members are released.', needsReason: true },
};

const StatusModal: React.FC<{ groupId: string; groupName: string; action: StatusAction; onClose: () => void; onDone: (m: string) => void }> = ({ groupId, groupName, action, onClose, onDone }) => {
  const t = STATUS_TEXT[action];
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (t.needsReason && reason.trim().length < 5) return setError('Give a reason (at least 5 characters).');
    setSaving(true);
    setError('');
    try {
      const d = await groupsService.changeStatus(groupId, action, reason.trim());
      onDone(`${groupName} is now ${GROUP_STATUS_LABELS[d.group.status].toLowerCase()}.`);
    } catch (err) {
      setError(messageOf(err, 'The status could not be changed.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`${t.title} · ${groupName}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="brand" onClick={submit} loading={saving}>{t.verb}</Button></>}>
      <p className="mb-3 text-sm text-slate-600">{t.hint}</p>
      <Field label={t.needsReason ? 'Reason' : 'Note (optional)'} required={t.needsReason}>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
      </Field>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};

const AddMemberModal: React.FC<{ groupId: string; taken: string[]; onClose: () => void; onDone: (m: string) => void }> = ({ groupId, taken, onClose, onDone }) => {
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<ClientSummary[]>([]);
  const [chosen, setChosen] = useState<ClientSummary | null>(null);
  const [role, setRole] = useState<GroupRole>('MEMBER');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const find = async () => {
    try {
      setFound((await clientsService.list({ search: search.trim() })).slice(0, 20));
    } catch (err) {
      setError(messageOf(err, 'Members could not be searched.'));
    }
  };
  const submit = async () => {
    if (!chosen) return setError('Choose the member.');
    setSaving(true);
    setError('');
    try {
      await groupsService.addMember(groupId, chosen.id, role);
      onDone(`${chosen.fullName} added as ${GROUP_ROLE_LABELS[role].toLowerCase()}.`);
    } catch (err) {
      setError(messageOf(err, 'The member could not be added.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Add a member" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="brand" onClick={submit} loading={saving}>Add member</Button></>}>
      <div className="space-y-4">
        {chosen ? (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <span><strong>{chosen.fullName}</strong> · {chosen.borrowerNumber}</span>
            <button type="button" className="text-xs font-medium text-emerald-700" onClick={() => setChosen(null)}>Change</button>
          </div>
        ) : (
          <Field label="Member (KYC-verified, this branch)" required>
            <div className="flex gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} placeholder="Name or member number" aria-label="Find member" />
              <Button variant="outline" onClick={find}><Search className="h-4 w-4" /> Find</Button>
            </div>
            {found.length > 0 && (
              <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {found.map((c) => {
                  const ok = isKycVerified(c.kycStatus);
                  return (
                    <li key={c.id}>
                      <button type="button" disabled={!ok} onClick={() => setChosen(c)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                        <span>{c.fullName} <span className="text-xs text-slate-400">{c.borrowerNumber}</span></span>
                        <span className="text-xs">{ok ? 'Verified' : 'KYC not verified'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Field>
        )}
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as GroupRole)} aria-label="Role">
            {GROUP_ROLES.map((r) => (
              <option key={r} value={r} disabled={r !== 'MEMBER' && taken.includes(r)}>{GROUP_ROLE_LABELS[r]}{r !== 'MEMBER' && taken.includes(r) ? ' (taken)' : ''}</option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};

const RemoveMemberModal: React.FC<{ groupId: string; member: Member; onClose: () => void; onDone: (m: string) => void }> = ({ groupId, member, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (reason.trim().length < 5) return setError('Give a reason (at least 5 characters).');
    setSaving(true);
    setError('');
    try {
      await groupsService.removeMember(groupId, member.borrowerId, reason.trim());
      onDone(`${member.fullName} left the group.`);
    } catch (err) {
      setError(messageOf(err, 'The member could not be removed.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Remove ${member.fullName}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="brand" onClick={submit} loading={saving}>Remove</Button></>}>
      <p className="mb-3 text-sm text-slate-600">A member with an open group loan, or who owes the fund, cannot leave.</p>
      <Field label="Reason" required>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
      </Field>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};

const CoverModal: React.FC<{ groupId: string; fund: string; member: Member; loan: Member['loans'][number]; onClose: () => void; onDone: (m: string) => void }> = ({ groupId, fund, member, loan, onClose, onDone }) => {
  const limit = Math.min(centsFromDb(fund), centsFromDb(loan.overdue));
  const [amount, setAmount] = useState(centsToDecimal(limit));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [key] = useState(newKey);
  const cents = parsePesos(amount);
  const submit = async () => {
    if (cents === null || cents <= 0 || cents > limit) return setError(`Enter an amount up to ${peso(centsToDecimal(limit))}.`);
    if (reason.trim().length < 5) return setError('Give the reason (at least 5 characters).');
    setSaving(true);
    setError('');
    try {
      const c = await groupsService.cover(groupId, { loanId: loan.id, amount, reason: reason.trim() }, key);
      onDone(`${c.coverNumber}: the fund paid ${peso(c.amount)} for ${member.fullName}, who now owes it back.`);
    } catch (err) {
      setError(messageOf(err, 'The cover could not be posted.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Cover ${member.fullName} from the fund`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="brand" onClick={submit} loading={saving}><HandCoins className="h-4 w-4" /> Pay from fund</Button></>}>
      <div className="mb-4 flex gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {loan.loanNumber} is {peso(loan.overdue)} overdue; the fund holds {peso(fund)}. The payment is posted from the fund (GL 2040) and {member.fullName} owes it back. The group takes no new loans until then.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₱)" required>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Cover amount" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Reason" required>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
          </Field>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};

const MeetingModal: React.FC<{ groupId: string; members: Member[]; location: string; onClose: () => void; onDone: (m: string) => void }> = ({ groupId, members, location, onClose, onDone }) => {
  const [date, setDate] = useState(manilaToday());
  const [place, setPlace] = useState(location);
  const [notes, setNotes] = useState('');
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(members.map((m) => [m.borrowerId, 'PRESENT'])));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const list = await groupsService.recordMeeting(groupId, { meetingDate: date, location: place, notes, attendance: members.map((m) => ({ borrowerId: m.borrowerId, status: marks[m.borrowerId] })) });
      onDone(`Meeting on ${date} recorded: ${list[0]?.present ?? 0} of ${members.length} present.`);
    } catch (err) {
      setError(messageOf(err, 'The meeting could not be recorded.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Record meeting" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="brand" onClick={submit} loading={saving}>Save meeting</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" required>
          <Input type="date" max={manilaToday()} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Meeting date" />
        </Field>
        <Field label="Where">
          <Input value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Meeting place" />
        </Field>
      </div>
      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {members.map((m) => (
          <li key={m.borrowerId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>{m.fullName}</span>
            <Select value={marks[m.borrowerId]} onChange={(e) => setMarks((x) => ({ ...x, [m.borrowerId]: e.target.value }))} aria-label={`Attendance ${m.fullName}`}>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="EXCUSED">Excused</option>
            </Select>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Meeting notes" />
        </Field>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};

export default GroupDetailPage;
