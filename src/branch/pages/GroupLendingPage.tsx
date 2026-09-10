import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, MapPin, Plus, UsersRound } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { Amount } from '../../portal/components/ui/Amount';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { groupsService } from '../services';

const GroupLendingPage: React.FC = () => {
  const toast = useToast();
  const canCreate = useBranchPermission(['manage_group_loans', 'assist_clients']);
  const fetcher = useCallback(() => groupsService.list(), []);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Group lending"
        subtitle="Solidarity lending groups and their weekly centers"
        actions={
          canCreate && (
            <Button variant="brand" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Form group
            </Button>
          )
        }
      />

      {loading ? (
        <LoadingState label="Loading solidarity groups…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && data.length === 0 ? (
        <EmptyState icon={<UsersRound className="h-6 w-6" />} title="No groups" description="Formed solidarity lending groups will appear here." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {(data || []).map((g) => (
            <Link key={g.id} to={`/staff/app/groups/${g.id}`} className="block">
              <Card className="h-full transition hover:border-blue-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white">
                    <UsersRound className="h-5 w-5" />
                  </div>
                  <StatusBadge status={g.status || 'Active'} />
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-900">{g.groupName}</h3>
                <p className="text-xs text-slate-400">{g.groupCode} · {g.centerName}</p>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <MiniStat label="Members" value={g.members.length} />
                  <MiniStat label="Active loans" value={g.totalActiveLoans ?? 0} />
                  <MiniStat label="Repayment" value={`${g.repaymentRate ?? 0}%`} />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <CalendarCheck className="h-3.5 w-3.5" /> {g.meetingDay} · {g.meetingTime}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {g.meetingLocation}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-500">Group savings</span>
                  <Amount value={g.totalGroupSavings ?? 0} className="text-sm font-bold text-emerald-700" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {canCreate && (
        <CreateGroupModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false);
            toast.success('Group formed');
            reload();
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

const CreateGroupModal: React.FC<{ open: boolean; onClose: () => void; onDone: () => void }> = ({ open, onClose, onDone }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    groupName: '',
    centerName: '',
    meetingDay: 'Saturday',
    meetingTime: '9:00 AM',
    meetingLocation: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.groupName.trim() || !form.meetingLocation.trim()) {
      toast.error('Group name and meeting location are required.');
      return;
    }
    setLoading(true);
    try {
      await groupsService.create(form);
      onDone();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to form group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Form solidarity group"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={loading}>
            <UsersRound className="h-4 w-4" /> Form group
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Group name" required>
            <Input value={form.groupName} onChange={set('groupName')} placeholder="e.g. Bambang Farmers" />
          </Field>
        </div>
        <Field label="Center name">
          <Input value={form.centerName} onChange={set('centerName')} placeholder="e.g. Center 1" />
        </Field>
        <Field label="Meeting time">
          <Input value={form.meetingTime} onChange={set('meetingTime')} placeholder="9:00 AM" />
        </Field>
        <Field label="Meeting day">
          <select value={form.meetingDay} onChange={set('meetingDay')} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Meeting location" required>
          <Input value={form.meetingLocation} onChange={set('meetingLocation')} placeholder="e.g. Brgy. Hall" />
        </Field>
      </div>
    </Modal>
  );
};

export default GroupLendingPage;