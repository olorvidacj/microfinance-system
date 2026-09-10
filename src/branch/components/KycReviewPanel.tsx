import React, { useState } from 'react';
import { FileCheck2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Modal } from '../../portal/components/ui/Modal';
import { Button } from '../../portal/components/ui/Button';
import { Field, Select, Textarea } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { kycService } from '../services';
import { ClientDetail } from '../types';

const DECISIONS = [
  { value: 'APPROVED', label: 'Approve' },
  { value: 'REJECTED', label: 'Reject' },
  { value: 'CORRECTION_REQUESTED', label: 'Request Correction' },
  { value: 'UNDER_REVIEW', label: 'Mark Under Review' },
];

export const KycReviewPanel: React.FC<{
  client: ClientDetail | null;
  onClose: () => void;
  onDone?: (status: string) => void;
}> = ({ client, onClose, onDone }) => {
  const toast = useToast();
  const [decision, setDecision] = useState('APPROVED');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!client) return null;

  const needsReason = decision === 'REJECTED' || decision === 'CORRECTION_REQUESTED';

  const submit = async () => {
    if (needsReason && !notes.trim()) {
      toast.error('A reason is required for this decision.');
      return;
    }
    setLoading(true);
    try {
      const res = await kycService.review(client.id, decision, notes.trim());
      toast.success(`KYC marked ${res?.status || decision}`);
      onDone?.(res?.status || decision);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to submit KYC decision.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!client}
      onClose={onClose}
      title="KYC Verification Review"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={decision === 'REJECTED' ? 'danger' : 'brand'} onClick={submit} loading={loading}>
            <ShieldCheck className="h-4 w-4" /> Submit decision
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 ring-1 ring-blue-100">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{client.fullName}</p>
            <p className="text-xs text-slate-500">
              {client.borrowerNumber} · {client.kycStatus} · {client.memberStatus}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-400">Valid ID</p>
            <p className="text-sm font-medium text-slate-700">{client.idNumber || '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-400">Occupation</p>
            <p className="text-sm font-medium text-slate-700">{client.occupation || '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-400">Monthly income</p>
            <p className="text-sm font-medium text-slate-700">₱{(client.monthlyIncome || 0).toLocaleString()}</p>
          </div>
        </div>

        <Field label="Decision" required>
          <Select value={decision} onChange={(e) => setDecision(e.target.value)}>
            {DECISIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Notes / reason"
          required={needsReason}
          hint={needsReason ? 'Required when rejecting or requesting a correction.' : 'Optional supporting notes.'}
        >
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Verification notes…" />
        </Field>

        {client.notes && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-slate-600">{client.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};