import React, { useState } from 'react';
import { FileCheck2, ShieldCheck, AlertTriangle, Home, Briefcase, UserRound } from 'lucide-react';
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

  const submission = (client as any).kycSubmission as
    | { status?: string; personalInfo?: Record<string, any>; address?: Record<string, any>; employment?: Record<string, any>; submittedAt?: string; reviewedAt?: string; reviewedByName?: string; correctionReason?: string; rejectionReason?: string }
    | undefined;

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

  const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-slate-400">{label}</span>
      <span className="text-right text-xs font-medium text-slate-700">{value || '—'}</span>
    </div>
  );

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
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 ring-1 ring-emerald-100">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{client.fullName}</p>
            <p className="text-xs text-slate-500">
              {client.borrowerNumber} · {submission?.status || client.kycStatus} · {client.memberStatus}
            </p>
            {submission?.submittedAt && (
              <p className="text-[11px] text-slate-400">Submitted {new Date(submission.submittedAt).toLocaleString()}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-400">Valid ID</p>
            <p className="text-sm font-medium text-slate-700">{client.idNumber || '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-400">Occupation</p>
            <p className="text-sm font-medium text-slate-700">{submission?.employment?.occupation || client.occupation || '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-400">Monthly income</p>
            <p className="text-sm font-medium text-slate-700">
              ₱{(Number(submission?.employment?.monthlyIncome) || client.monthlyIncome || 0).toLocaleString()}
            </p>
          </div>
        </div>

        {(submission?.personalInfo || submission?.address || submission?.employment) && (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <UserRound className="h-3.5 w-3.5" /> Personal info
                </p>
                <Row label="Full name" value={[submission.personalInfo?.firstName, submission.personalInfo?.middleName, submission.personalInfo?.lastName].filter(Boolean).join(' ')} />
                <Row label="Date of birth" value={submission.personalInfo?.dateOfBirth} />
                <Row label="Gender" value={submission.personalInfo?.gender} />
                <Row label="Civil status" value={submission.personalInfo?.civilStatus} />
                <Row label="Phone" value={submission.personalInfo?.phone} />
                <Row label="Email" value={submission.personalInfo?.email} />
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Home className="h-3.5 w-3.5" /> Address
                </p>
                <Row label="House / Unit" value={submission.address?.houseUnit} />
                <Row label="Street" value={submission.address?.street} />
                <Row label="Barangay" value={submission.address?.barangay} />
                <Row label="City" value={submission.address?.city} />
                <Row label="Province" value={submission.address?.province} />
                <Row label="Postal code" value={submission.address?.postalCode} />
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Briefcase className="h-3.5 w-3.5" /> Employment
                </p>
                <Row label="Occupation" value={submission.employment?.occupation} />
                <Row label="Employment status" value={submission.employment?.employmentStatus} />
                <Row label="Employer" value={submission.employment?.employer} />
                <Row label="Monthly income" value={submission.employment?.monthlyIncome ? `₱${Number(submission.employment.monthlyIncome).toLocaleString()}` : undefined} />
                <Row label="Source of income" value={submission.employment?.sourceOfIncome} />
              </div>
            </div>
          </>
        )}

        {submission?.reviewedByName && (
          <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-500">
            Last reviewed {submission.reviewedAt ? `on ${new Date(submission.reviewedAt).toLocaleString()}` : ''} by{' '}
            <span className="font-semibold text-slate-700">{submission.reviewedByName}</span>
          </div>
        )}

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

        {(submission?.correctionReason || submission?.rejectionReason) && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-slate-600">
              {submission?.correctionReason
                ? `Previous correction request: ${submission.correctionReason}`
                : `Previous rejection: ${submission.rejectionReason}`}
            </p>
          </div>
        )}

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