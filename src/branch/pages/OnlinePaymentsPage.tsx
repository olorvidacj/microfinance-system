import React, { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { Field, Input, Textarea } from '../../portal/components/ui/Field';
import { Modal } from '../../portal/components/ui/Modal';
import { Tabs } from '../../portal/components/ui/Tabs';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { manilaToday, peso } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { onlinePaymentsService, type OnlineDailyReport, type OnlineReview } from '../services';

const TABS = [
  { id: 'review', label: 'Needs review' },
  { id: 'report', label: 'Daily report' },
];

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—');

interface PendingAction {
  title: string;
  description: React.ReactNode;
  noteLabel: string;
  confirmLabel: string;
  run: (note: string) => Promise<unknown>;
  done: string;
}

/**
 * Online deposits and instant withdrawals that need a person: payout accounts
 * to verify, payments the provider and the ledger disagree on, payouts the
 * provider has not confirmed; and the daily check of provider totals against
 * the ledger.
 */
const OnlinePaymentsPage: React.FC = () => {
  const toast = useToast();
  const [tab, setTab] = useState('review');
  const [action, setAction] = useState<PendingAction | null>(null);
  const [checking, setChecking] = useState(false);
  const fetcher = useCallback(() => onlinePaymentsService.review(), []);
  const { data, loading, error, reload } = useBranchData(fetcher);

  const checkNow = async () => {
    setChecking(true);
    try {
      const r = await onlinePaymentsService.checkNow();
      toast.success(`Checked ${r.depositsChecked} deposits and ${r.payoutsChecked} withdrawals with the provider.${r.errors.length ? ` ${r.errors.length} could not be checked.` : ''}`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The provider could not be asked.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Online payments"
        subtitle="Deposits paid through the payment provider and instant withdrawals. Money is credited or returned only on the provider's confirmation."
        actions={
          <Button variant="outline" onClick={checkNow} loading={checking}>
            <RefreshCw className="h-4 w-4" /> Check with the provider now
          </Button>
        }
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'review' ? (
        loading ? (
          <LoadingState label="Loading…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data ? (
          <ReviewLists data={data} onAction={setAction} />
        ) : null
      ) : (
        <DailyReport />
      )}
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onDone={() => {
            toast.success(action.done);
            setAction(null);
            reload();
          }}
        />
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; count: number; empty: string; children: React.ReactNode }> = ({ title, count, empty, children }) => (
  <Card>
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <span className="text-xs text-slate-500">{count}</span>
    </div>
    {count === 0 ? <p className="px-5 py-4 text-sm text-slate-500">{empty}</p> : <div className="divide-y divide-slate-100">{children}</div>}
  </Card>
);

const ReviewLists: React.FC<{ data: OnlineReview; onAction: (a: PendingAction) => void }> = ({ data, onAction }) => {
  if (!data.payoutAccounts.length && !data.deposits.length && !data.payouts.length) {
    return <EmptyState icon={<Inbox className="h-6 w-6" />} title="Nothing needs review" description="Every online payment in your branch is settled." />;
  }
  return (
    <div className="space-y-5">
      <Section title="Payout accounts to verify" count={data.payoutAccounts.length} empty="No accounts waiting.">
        {data.payoutAccounts.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <p className="font-semibold text-slate-800">{a.memberName} · {a.channelLabel} {a.accountNumber}</p>
              <p className="text-xs text-slate-500">Account name: {a.accountName} · added {when(a.createdAt)}</p>
              <p className="text-xs text-slate-500">Confirm with the member that the account is theirs (for example the app or passbook showing their name) before verifying.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="brand"
                onClick={() =>
                  onAction({
                    title: `Verify ${a.channelLabel} ${a.accountNumber}`,
                    description: <>Instant withdrawals for <strong>{a.memberName}</strong> can then be sent to this account in the name <strong>{a.accountName}</strong>.</>,
                    noteLabel: 'How you confirmed it is the member’s',
                    confirmLabel: 'Verify account',
                    run: (note) => onlinePaymentsService.decidePayoutAccount(a.id, 'VERIFY', note),
                    done: `${a.channelLabel} ${a.accountNumber} verified.`,
                  })
                }
              >
                Verify
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  onAction({
                    title: `Reject ${a.channelLabel} ${a.accountNumber}`,
                    description: <>The member is told why and can add another account.</>,
                    noteLabel: 'Reason (shown to the member)',
                    confirmLabel: 'Reject account',
                    run: (note) => onlinePaymentsService.decidePayoutAccount(a.id, 'REJECT', note),
                    done: `${a.channelLabel} ${a.accountNumber} rejected.`,
                  })
                }
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Deposits" count={data.deposits.length} empty="No deposits waiting.">
        {data.deposits.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <p className="font-semibold text-slate-800">{d.reference} · {d.memberName} · <span className="tabular-nums">{peso(d.amount)}</span>{d.paidAmount !== null && d.paidAmount !== d.amount ? <> (paid <span className="tabular-nums">{peso(d.paidAmount)}</span>)</> : null}</p>
              <p className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> {d.reviewReason}</p>
              <p className="text-xs text-slate-500">{d.provider} {d.providerRef} · opened {when(d.createdAt)}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="brand"
                onClick={() =>
                  onAction({
                    title: `Credit ${d.reference}`,
                    description: <>The provider is asked again; only what it confirms was paid is credited to {d.memberName}’s savings.</>,
                    noteLabel: 'What you checked',
                    confirmLabel: 'Credit what was paid',
                    run: (note) => onlinePaymentsService.resolveDeposit(d.id, 'CREDIT_PAID', note),
                    done: `${d.reference} credited.`,
                  })
                }
              >
                Credit paid amount
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  onAction({
                    title: `Close ${d.reference} without credit`,
                    description: <>Use this only when the money was handled outside, for example refunded from the provider’s dashboard. Nothing is posted.</>,
                    noteLabel: 'What happened to the money',
                    confirmLabel: 'Close without credit',
                    run: (note) => onlinePaymentsService.resolveDeposit(d.id, 'DISMISS', note),
                    done: `${d.reference} closed.`,
                  })
                }
              >
                Close
              </Button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Instant withdrawals" count={data.payouts.length} empty="No withdrawals waiting.">
        {data.payouts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <p className="font-semibold text-slate-800">{p.reference} · {p.memberName} · <span className="tabular-nums">{peso(p.amount)}</span> to {p.destination}</p>
              <p className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> {p.reviewReason ?? p.failureReason ?? `Not confirmed by the provider since ${when(p.submittedAt)}.`}</p>
              <p className="text-xs text-slate-500"><StatusBadge status={p.statusLabel} tone="amber" /> {p.provider} {p.providerRef ?? '(no provider id yet)'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['RECHECK', 'RETRY', 'REFUND'] as const).map((act) => (
                <Button
                  key={act}
                  variant={act === 'RECHECK' ? 'brand' : 'outline'}
                  onClick={() =>
                    onAction({
                      title: `${act === 'RECHECK' ? 'Recheck' : act === 'RETRY' ? 'Send again' : 'Refund'} ${p.reference}`,
                      description:
                        act === 'RECHECK'
                          ? 'Asks the provider and applies its answer: paid, or failed and returned to savings.'
                          : act === 'RETRY'
                            ? 'Sends the payout again under the same reference. Allowed only when the provider has no record of it, so it cannot be paid twice.'
                            : 'Returns the money to the member’s savings. Allowed only when the provider has no record of the payout or reports it failed.',
                      noteLabel: 'What you checked',
                      confirmLabel: act === 'RECHECK' ? 'Recheck' : act === 'RETRY' ? 'Send again' : 'Refund to savings',
                      run: (note) => onlinePaymentsService.resolvePayout(p.id, act, note),
                      done: `${p.reference}: done.`,
                    })
                  }
                >
                  {act === 'RECHECK' ? 'Recheck' : act === 'RETRY' ? 'Send again' : 'Refund'}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
};

const ActionModal: React.FC<{ action: PendingAction; onClose: () => void; onDone: () => void }> = ({ action, onClose, onDone }) => {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (note.trim().length < 5) return setError('Write at least 5 characters.');
    setSaving(true);
    setError('');
    try {
      await action.run(note.trim());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That could not be done.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={action.title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={saving}>{action.confirmLabel}</Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-600">{action.description}</p>
      <Field label={action.noteLabel} required>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} aria-label={action.noteLabel} />
      </Field>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};

const DailyReport: React.FC = () => {
  const [date, setDate] = useState(manilaToday());
  const fetcher = useCallback(() => onlinePaymentsService.dailyReport(date), [date]);
  const { data, loading, error, reload } = useBranchData<OnlineDailyReport>(fetcher);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Day">
          <Input type="date" value={date} max={manilaToday()} onChange={(e) => setDate(e.target.value)} aria-label="Report day" />
        </Field>
        <Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Run again</Button>
      </div>
      {loading ? (
        <LoadingState label="Asking the provider…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <>
          <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${data.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            {data.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {data.ok ? 'The provider, the ledger and the accounts agree for this day.' : `${data.mismatches.length} difference${data.mismatches.length === 1 ? '' : 's'} to look at.`}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <div className="space-y-1 p-5 text-sm">
                <h3 className="mb-2 font-semibold text-slate-800">Our records</h3>
                <p>Deposits credited: <strong className="tabular-nums">{peso(data.ours.depositsCredited.amount)}</strong> ({data.ours.depositsCredited.count})</p>
                <p>Instant withdrawals taken: <strong className="tabular-nums">{peso(data.ours.withdrawalsTaken.amount)}</strong> ({data.ours.withdrawalsTaken.count})</p>
                <p>Paid out: <strong className="tabular-nums">{peso(data.ours.withdrawalsPaid.amount)}</strong> ({data.ours.withdrawalsPaid.count})</p>
                <p>Returned after failing: <strong className="tabular-nums">{peso(data.ours.withdrawalsReturned.amount)}</strong> ({data.ours.withdrawalsReturned.count})</p>
              </div>
            </Card>
            <Card>
              <div className="space-y-1 p-5 text-sm">
                <h3 className="mb-2 font-semibold text-slate-800">Ledger ({data.ledger.account} Due from Payment Provider)</h3>
                <p>Money in: <strong className="tabular-nums">{peso(data.ledger.moneyIn)}</strong></p>
                <p>Money out: <strong className="tabular-nums">{peso(data.ledger.moneyOut)}</strong></p>
              </div>
            </Card>
            <Card>
              <div className="space-y-1 p-5 text-sm">
                <h3 className="mb-2 font-semibold text-slate-800">Provider ({data.provider})</h3>
                <p>Deposits received: <strong className="tabular-nums">{peso(data.providerTotals.depositsReceived)}</strong></p>
                <p>Payouts paid: <strong className="tabular-nums">{peso(data.providerTotals.payoutsPaid)}</strong></p>
              </div>
            </Card>
          </div>
          {data.mismatches.length > 0 && (
            <Card>
              <div className="divide-y divide-slate-100">
                {data.mismatches.map((m, i) => (
                  <div key={`${m.code}-${m.reference}-${i}`} className="px-5 py-3 text-sm">
                    <p className="font-semibold text-slate-800">{m.reference ?? (m.kind === 'ledger' ? 'Ledger' : 'Provider')} · <span className="font-mono text-xs text-rose-700">{m.code}</span></p>
                    <p className="text-slate-600">{m.message}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
};

export default OnlinePaymentsPage;
