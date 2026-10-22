import React, { useCallback, useState } from 'react';
import { FileCheck2, ExternalLink } from 'lucide-react';
import { PAYMENT_METHOD_LABELS, type ReceiptDocument } from '../../../shared/lending';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input, Textarea } from '../../portal/components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { ReceiptModal } from '../../components/ReceiptModal';
import { peso } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { paymentsService } from '../services';

const TABS = [
  { value: 'PENDING_REVIEW', label: 'Waiting' },
  { value: 'UNDER_REVIEW', label: 'Being checked' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];

type Proof = Awaited<ReturnType<typeof paymentsService.proofs>>['proofs'][number];

const PaymentProofsPage: React.FC = () => {
  const toast = useToast();
  const [status, setStatus] = useState('PENDING_REVIEW');
  const fetcher = useCallback(() => paymentsService.proofs(status), [status]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [verifying, setVerifying] = useState<Proof | null>(null);
  const [rejecting, setRejecting] = useState<Proof | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDocument | null>(null);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      setVerifying(null);
      setRejecting(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The request failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Payment proofs" subtitle="Members' bank and e-wallet transfers. Check each against the statement; nothing is posted until you verify it." />
      <Card className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === t.value ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              {t.label}
              {data?.counts?.[t.value] ? ` (${data.counts[t.value]})` : ''}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading proofs…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.proofs.length === 0 ? (
        <EmptyState icon={<FileCheck2 className="h-6 w-6" />} title="Nothing here" description="No payment proofs with this status." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Submitted', 'Member', 'Loan', 'Amount', 'Method / reference', 'Paid on', 'File', 'Status', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.proofs.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(p.submittedAt).toLocaleString('en-PH')}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{p.borrowerName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-emerald-700">{p.loanNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">{peso(p.amount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method} · {p.referenceNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{p.paymentDate}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {p.fileUrl ? (
                        <a href={p.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={p.status} />
                      {p.rejectionReason && <span className="block text-[11px] text-rose-600">{p.rejectionReason}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {(p.status === 'PENDING_REVIEW' || p.status === 'UNDER_REVIEW') && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="text-rose-600" onClick={() => { setRejecting(p); setReason(''); }}>
                            Reject
                          </Button>
                          <Button size="sm" variant="brand" onClick={() => { setVerifying(p); setAmount(p.amount); }}>
                            Verify
                          </Button>
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

      <Modal
        open={!!verifying}
        onClose={() => setVerifying(null)}
        title="Verify and post payment"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setVerifying(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="brand"
              loading={busy}
              onClick={() =>
                act(async () => {
                  const r = await paymentsService.verifyProof(verifying!.id, amount.trim() || undefined);
                  setReceipt(r.receipt);
                }, 'Payment verified and posted.')
              }
            >
              Verify and post
            </Button>
          </>
        }
      >
        {verifying && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              {verifying.borrowerName} says they paid {peso(verifying.amount)} by {PAYMENT_METHOD_LABELS[verifying.method as keyof typeof PAYMENT_METHOD_LABELS] ?? verifying.method} (ref {verifying.referenceNumber}) on {verifying.paymentDate}. Post only what actually reached the cooperative.
            </p>
            <Field label="Amount received (₱)" hint="You can lower it to what arrived, never raise it">
              <Input id="proof-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject payment proof"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={() => act(() => paymentsService.rejectProof(rejecting!.id, reason.trim()), 'Proof rejected; the member was told why.')}>
              Reject
            </Button>
          </>
        }
      >
        <Field label="Reason" required hint="The member sees this message">
          <Textarea id="proof-reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
};

export default PaymentProofsPage;
