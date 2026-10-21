import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Crown, HandCoins, ShieldAlert, Users } from 'lucide-react';
import { GROUP_ROLE_LABELS, GROUP_STATUS_LABELS, MEETING_FREQUENCY_LABELS, centsFromDb, centsToDecimal, type GroupRole, type MeetingFrequency } from '../../../shared/lending';
import { groupService, type MyGroup } from '../services/groups';
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, Field, Input, LoadingState, Modal, StatusBadge } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { peso } from '../../components/lending';
import { formatDate } from '../../utils/loanMath';

const GroupsPage: React.FC = () => {
  const toast = useToast();
  const [group, setGroup] = useState<MyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [declining, setDeclining] = useState<{ id: string; loanNumber: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setGroup(await groupService.myGroup());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your group.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const consent = async (loanId: string) => {
    try {
      setGroup(await groupService.consent(loanId, 'CONSENT'));
      toast.success('Thank you. Your consent is recorded.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Your consent could not be recorded.');
    }
  };

  if (loading) return <LoadingState label="Loading your group…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!group) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My group</h1>
        <EmptyState icon={<Users className="h-6 w-6" />} title="You are not in a lending group" description="Ask your branch's loan officer about joining a solidarity group for group loans." />
      </div>
    );
  }

  const g = group.group;
  const waiting = group.pendingLoans.filter((l) => !l.mine);
  const owed = group.fund.myCovers.reduce((s, c) => s + centsFromDb(c.outstanding), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{g.groupName}</h1>
          <p className="text-sm text-slate-500">{g.groupCode} · {g.centerName}{group.me ? ` · you are the ${GROUP_ROLE_LABELS[group.me.role as GroupRole].toLowerCase()}` : ''}</p>
        </div>
        <StatusBadge status={GROUP_STATUS_LABELS[g.status]} tone={g.status === 'ACTIVE' ? 'green' : g.status === 'SUSPENDED' ? 'red' : 'amber'} />
      </div>

      {group.blocked && (
        <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Your group cannot take new loans until a member's overdue payments, or what the solidarity fund paid for them, are settled.</p>
        </div>
      )}

      {owed > 0 && (
        <Card>
          <CardBody className="flex items-start gap-3">
            <HandCoins className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="text-sm">
              <p className="font-semibold text-slate-800">You owe your group's solidarity fund {peso(centsToDecimal(owed))}</p>
              <p className="text-slate-500">The fund paid your overdue installment. Pay it back at the next meeting or at the branch.</p>
              <ul className="mt-2 text-xs text-slate-500">
                {group.fund.myCovers.map((c) => (
                  <li key={c.id}>{c.coverNumber}: {peso(c.amount)} for {c.loanNumber}, {peso(c.outstanding)} still owed</li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      )}

      {waiting.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Loans waiting for your consent</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-slate-500">Members are jointly liable: if a member cannot pay, the group helps cover it. Consent only if you support this loan.</p>
            {waiting.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm" data-testid="consent-request">
                <div>
                  <p className="font-semibold text-slate-800">{l.borrowerName}: {peso(l.principalAmount)} over {l.termMonths} months</p>
                  <p className="text-xs text-slate-500">{l.loanNumber} · {l.consented} of {l.required} members have consented</p>
                </div>
                {l.myDecision === 'CONSENT' ? (
                  <StatusBadge status="You consented" tone="green" />
                ) : (
                  <div className="flex items-center gap-2">
                    {l.myDecision === 'DECLINE' && <StatusBadge status="You declined" tone="red" />}
                    <Button size="sm" onClick={() => consent(l.id)}>I consent</Button>
                    {l.myDecision !== 'DECLINE' && <Button size="sm" variant="outline" onClick={() => setDeclining({ id: l.id, loanNumber: l.loanNumber })}>Decline</Button>}
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Members ({group.members.length})</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-slate-100 text-sm">
              {group.members.map((m) => (
                <li key={m.borrowerId} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2">
                    {m.role === 'LEADER' && <Crown className="h-4 w-4 text-amber-500" />}
                    {m.fullName}
                    <span className="text-xs text-slate-400">{GROUP_ROLE_LABELS[m.role as GroupRole]}</span>
                  </span>
                  <StatusBadge status={m.standing === 'GOOD' ? 'Up to date' : 'Behind'} tone={m.standing === 'GOOD' ? 'green' : 'amber'} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-4 w-4" /> Meetings</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <p>{g.meetingDay}s at {g.meetingTime}, {MEETING_FREQUENCY_LABELS[g.meetingFrequency as MeetingFrequency]?.toLowerCase() ?? g.meetingFrequency}, {g.meetingLocation}</p>
            <p className="text-slate-500">Loan officer: {g.loanOfficerName}</p>
            <p className="text-slate-500">Solidarity fund: <strong className="text-slate-800">{peso(group.fund.balance)}</strong></p>
            {group.meetings.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100 text-xs text-slate-600">
                {group.meetings.map((m) => (
                  <li key={m.meetingDate} className="flex justify-between py-1.5">
                    <span>{formatDate(m.meetingDate)} · {m.present} of {m.total} present</span>
                    <span>{m.me ? `You: ${m.me.toLowerCase()}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {declining && (
        <DeclineModal
          loanNumber={declining.loanNumber}
          onClose={() => setDeclining(null)}
          onSubmit={async (note) => {
            try {
              setGroup(await groupService.consent(declining.id, 'DECLINE', note));
              setDeclining(null);
              toast.success('Your answer is recorded. The loan officer will follow up.');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Your answer could not be recorded.');
            }
          }}
        />
      )}
    </div>
  );
};

const DeclineModal: React.FC<{ loanNumber: string; onClose: () => void; onSubmit: (note: string) => Promise<void> }> = ({ loanNumber, onClose, onSubmit }) => {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <Modal open onClose={onClose} title={`Decline ${loanNumber}`} size="sm">
      <div className="space-y-4">
        <Field label="Why do you not support this loan?" required error={error}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} aria-label="Reason" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            loading={saving}
            onClick={async () => {
              if (note.trim().length < 3) return setError('Tell the group why.');
              setSaving(true);
              await onSubmit(note.trim());
              setSaving(false);
            }}
          >
            Decline
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default GroupsPage;
