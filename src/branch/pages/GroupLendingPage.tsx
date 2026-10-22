import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, MapPin, Plus, UsersRound } from 'lucide-react';
import { GROUP_STATUSES, GROUP_STATUS_LABELS, MEETING_DAYS, MEETING_FREQUENCIES, MEETING_FREQUENCY_LABELS, validateGroup } from '../../../shared/lending';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input, Select } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { peso } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { groupsService, type GroupForm } from '../services';
import { BranchApiError } from '../services/api';

export const groupTone = (s: string) => (s === 'ACTIVE' ? 'green' : s === 'SUSPENDED' ? 'red' : s === 'FORMING' ? 'amber' : 'slate') as 'green' | 'red' | 'amber' | 'slate';

const GroupLendingPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const canCreate = useBranchPermission(['manage_loan_applications']);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const fetcher = useCallback(() => groupsService.list({ status: status || undefined, search: search.trim() || undefined }), [status, search]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Group lending"
        subtitle="Solidarity groups: members borrow individually and guarantee each other's loans"
        actions={
          canCreate && (
            <Button variant="brand" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Form group
            </Button>
          )
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="Search name, code or center" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <Select className="max-w-[12rem]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {GROUP_STATUSES.map((s) => (
            <option key={s} value={s}>{GROUP_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingState label="Loading solidarity groups…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && data.length === 0 ? (
        <EmptyState icon={<UsersRound className="h-6 w-6" />} title="No groups" description="Formed solidarity lending groups will appear here." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {(data || []).map((g) => (
            <Link key={g.id} to={`/staff/app/groups/${g.id}`} className="block" data-testid="group-card">
              <Card className="h-full p-5 transition hover:border-amber-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#091527] text-amber-400 ring-1 ring-amber-400/30">
                    <UsersRound className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {g.blocked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200" title={g.blockReasons.join(' ')}>
                        <AlertTriangle className="h-3 w-3" /> No new loans
                      </span>
                    )}
                    <StatusBadge status={GROUP_STATUS_LABELS[g.status]} tone={groupTone(g.status)} />
                  </div>
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-900">{g.groupName}</h3>
                <p className="text-xs text-slate-400">{g.groupCode} · {g.centerName} · officer {g.loanOfficerName}</p>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <MiniStat label="Members" value={g.memberCount} />
                  <MiniStat label="Running loans" value={g.runningLoans} />
                  <MiniStat label="Behind" value={g.membersInArrears} />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <CalendarCheck className="h-3.5 w-3.5" /> {g.meetingDay} · {g.meetingTime}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {g.meetingLocation}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">Solidarity fund</span>
                  <span className="text-sm font-bold tabular-nums text-emerald-700">{peso(g.fundBalance)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {createOpen && (
        <GroupFormModal
          onClose={() => setCreateOpen(false)}
          onSaved={(id, name) => {
            setCreateOpen(false);
            toast.success(`${name} formed. Add members, then activate it.`);
            navigate(`/staff/app/groups/${id}`);
          }}
        />
      )}
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 p-2">
    <p className="text-sm font-bold tabular-nums text-slate-800">{value}</p>
    <p className="text-[11px] text-slate-400">{label}</p>
  </div>
);

const EMPTY: GroupForm = { groupName: '', centerName: '', meetingDay: 'Saturday', meetingTime: '09:00', meetingFrequency: 'WEEKLY', meetingLocation: '', loanOfficerId: '', arrearsThresholdDays: '7' };

/** Create or edit a group's details, schedule and officer. */
export const GroupFormModal: React.FC<{ groupId?: string; initial?: GroupForm; onClose: () => void; onSaved: (id: string, name: string) => void }> = ({ groupId, initial, onClose, onSaved }) => {
  const [form, setForm] = useState<GroupForm>(initial ?? EMPTY);
  const [officers, setOfficers] = useState<{ id: string; name: string; role: string; title: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    groupsService.officers().then((o) => {
      setOfficers(o);
      setForm((f) => (f.loanOfficerId ? f : { ...f, loanOfficerId: o.find((x) => x.role === 'LOAN_OFFICER')?.id ?? o[0]?.id ?? '' }));
    }, (err) => setError(err instanceof Error ? err.message : 'Staff list could not be loaded.'));
  }, []);

  const set = (k: keyof GroupForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    // Same rules as the server (shared/lending/groups.ts).
    const v = validateGroup(form);
    setErrors(v.errors);
    setError('');
    if (!v.ok) return;
    setSaving(true);
    try {
      const d = groupId ? await groupsService.update(groupId, form) : await groupsService.create(form);
      onSaved(d.group.id, d.group.groupName);
    } catch (err) {
      if (err instanceof BranchApiError) setErrors(err.fieldErrors);
      setError(err instanceof Error ? err.message : 'The group could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={groupId ? 'Edit group' : 'Form solidarity group'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={saving}>
            <UsersRound className="h-4 w-4" /> {groupId ? 'Save changes' : 'Form group'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Group name" required error={errors.groupName}>
            <Input value={form.groupName} onChange={set('groupName')} placeholder="e.g. Bambang Farmers" aria-label="Group name" />
          </Field>
        </div>
        <Field label="Center" required error={errors.centerName}>
          <Input value={form.centerName} onChange={set('centerName')} placeholder="e.g. Center 1" aria-label="Center" />
        </Field>
        <Field label="Loan officer" required error={errors.loanOfficerId}>
          <Select value={form.loanOfficerId} onChange={set('loanOfficerId')} aria-label="Loan officer">
            <option value="">Choose…</option>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({o.title})</option>
            ))}
          </Select>
        </Field>
        <Field label="Meeting day" required error={errors.meetingDay}>
          <Select value={form.meetingDay} onChange={set('meetingDay')} aria-label="Meeting day">
            {MEETING_DAYS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Meeting time" required error={errors.meetingTime}>
          <Input type="time" value={form.meetingTime} onChange={set('meetingTime')} aria-label="Meeting time" />
        </Field>
        <Field label="How often" required error={errors.meetingFrequency}>
          <Select value={form.meetingFrequency} onChange={set('meetingFrequency')} aria-label="Meeting frequency">
            {MEETING_FREQUENCIES.map((f) => (
              <option key={f} value={f}>{MEETING_FREQUENCY_LABELS[f]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Meeting location" required error={errors.meetingLocation}>
          <Input value={form.meetingLocation} onChange={set('meetingLocation')} placeholder="e.g. Brgy. Hall" aria-label="Meeting location" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Arrears limit (days)" required error={errors.arrearsThresholdDays} hint="The group takes no new loans while any member is this many days behind, or owes the solidarity fund.">
            <Input inputMode="numeric" value={form.arrearsThresholdDays} onChange={set('arrearsThresholdDays')} aria-label="Arrears limit" />
          </Field>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};

export default GroupLendingPage;
