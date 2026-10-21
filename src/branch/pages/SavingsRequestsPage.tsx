import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Inbox, X } from 'lucide-react';
import { WITHDRAWAL_DESTINATION_LABELS, type WithdrawalDestination } from '../../../shared/lending';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { Field, Input, Textarea } from '../../portal/components/ui/Field';
import { Modal } from '../../portal/components/ui/Modal';
import { Tabs } from '../../portal/components/ui/Tabs';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { peso } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { savingsService, type WithdrawalRequestView } from '../services';

const TABS = [
  { id: 'PENDING', label: 'Waiting' },
  { id: 'APPROVED', label: 'Released' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

/** Members' withdrawal requests. Approving posts the withdrawal; rejecting needs a reason the member sees. */
const SavingsRequestsPage: React.FC = () => {
  const toast = useToast();
  const [tab, setTab] = useState('PENDING');
  const [deciding, setDeciding] = useState<{ request: WithdrawalRequestView; decision: 'APPROVE' | 'REJECT' } | null>(null);
  const fetcher = useCallback(() => savingsService.requests(tab), [tab]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const rows = data || [];

  return (
    <div className="space-y-5">
      <Link to="/staff/app/savings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Savings
      </Link>
      <PageHeader title="Withdrawal requests" subtitle="Requests members filed from the portal. The account rules are checked again when you release." />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {loading ? (
        <LoadingState label="Loading requests…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />} title="No requests" description="Nothing in this list." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Request', 'Member', 'Filed', 'Amount', 'Receive by', 'Reason', 'Status', ''].map((h) => (
                    <th key={h} className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.requestNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {r.accountId ? <Link className="text-emerald-700 hover:underline" to={`/staff/app/savings/${r.accountId}`}>{r.memberName}</Link> : r.memberName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{r.requestedOn}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{peso(r.amount)}</td>
                    <td className="px-4 py-3">
                      {r.destination ? WITHDRAWAL_DESTINATION_LABELS[r.destination as WithdrawalDestination] ?? r.destination : '—'}
                      {r.destinationAccount && <span className="block text-xs text-slate-500">{r.destinationAccount}</span>}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">
                      {r.reason}
                      {r.rejectionReason && <span className="block text-xs text-rose-600">Rejected: {r.rejectionReason}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {r.status === 'PENDING' && (
                        <div className="flex justify-end gap-2">
                          <Button variant="brand" onClick={() => setDeciding({ request: r, decision: 'APPROVE' })}><Check className="h-4 w-4" /> Release</Button>
                          <Button variant="outline" onClick={() => setDeciding({ request: r, decision: 'REJECT' })}><X className="h-4 w-4" /> Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {deciding && (
        <DecisionModal
          request={deciding.request}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
          onDone={(message) => {
            setDeciding(null);
            toast.success(message);
            reload();
          }}
        />
      )}
    </div>
  );
};

const DecisionModal: React.FC<{
  request: WithdrawalRequestView;
  decision: 'APPROVE' | 'REJECT';
  onClose: () => void;
  onDone: (message: string) => void;
}> = ({ request, decision, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const transfer = request.destination && request.destination !== 'CASH_PICKUP';
  const submit = async () => {
    if (decision === 'REJECT' && reason.trim().length < 5) return setError('Tell the member why (at least 5 characters).');
    if (decision === 'APPROVE' && transfer && !reference.trim()) return setError('Enter the transfer reference.');
    setSaving(true);
    setError('');
    try {
      const r = await savingsService.decideRequest(request.id, { decision, reason: reason.trim() || undefined, referenceNumber: reference.trim() || undefined });
      onDone(decision === 'APPROVE' ? `${request.requestNumber} released (${peso(r.amount)}).` : `${request.requestNumber} rejected.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request could not be decided.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`${decision === 'APPROVE' ? 'Release' : 'Reject'} ${request.requestNumber}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={saving}>{decision === 'APPROVE' ? 'Release withdrawal' : 'Reject request'}</Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-600">
        {request.memberName} asks for <strong className="tabular-nums">{peso(request.amount)}</strong>
        {request.destination ? ` by ${WITHDRAWAL_DESTINATION_LABELS[request.destination as WithdrawalDestination]?.toLowerCase() ?? request.destination}` : ''}
        {request.destinationAccount ? ` to ${request.destinationAccount}` : ''}.
      </p>
      {decision === 'APPROVE' && transfer && (
        <Field label="Transfer reference" required>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} aria-label="Transfer reference" />
        </Field>
      )}
      {decision === 'REJECT' && (
        <Field label="Reason (shown to the member)" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
        </Field>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};

export default SavingsRequestsPage;
