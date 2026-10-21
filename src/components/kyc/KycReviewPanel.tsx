import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, History, Lock, RefreshCw, ShieldAlert, Unlock, XCircle } from 'lucide-react';
import type { kycDossier } from '../../kyc/service';
import { Modal } from '../../portal/components/ui/Modal';
import { Button } from '../../portal/components/ui/Button';
import { KycStatusBadge } from '../KycStatusBadge';
import type { KycDecision } from '../../../shared/kyc-core';

export type KycDossierView = Awaited<ReturnType<typeof kycDossier>>;

/** The calls the panel needs; the branch app and the head-office console bind their own endpoints. */
export interface KycReviewApi {
  get(borrowerId: string): Promise<KycDossierView>;
  claim(borrowerId: string): Promise<unknown>;
  release(borrowerId: string): Promise<unknown>;
  decide(borrowerId: string, body: { decision: KycDecision; reason: string; sections: string[] }, idempotencyKey: string): Promise<unknown>;
}

export interface KycReviewPanelProps {
  clientId: string;
  api: KycReviewApi;
  /** Whether the viewer may claim and decide (manage_kyc). */
  canDecide: boolean;
  onClose: () => void;
  onDone?: () => void;
}

const SECTIONS = [
  { key: 'ID_UPLOAD', label: 'Government ID photo' },
  { key: 'FACE_MATCH', label: 'Selfie' },
  { key: 'PERSONAL_INFO', label: 'Personal information' },
  { key: 'ADDRESS', label: 'Address' },
  { key: 'FINANCIAL', label: 'Work and income' },
  { key: 'DOCUMENTS', label: 'Supporting documents' },
];

const DECISION_COPY: Record<KycDecision, { title: string; button: string; variant: 'success' | 'danger' | 'primary'; placeholder: string }> = {
  APPROVE: { title: 'Approve and verify this member', button: 'Approve', variant: 'success', placeholder: 'e.g. ID and selfie checked against the original card at the branch.' },
  REJECT: { title: 'Reject this application', button: 'Reject', variant: 'danger', placeholder: 'e.g. The ID photo belongs to a different person.' },
  REQUEST_RESUBMISSION: { title: 'Ask the member to fix and resubmit', button: 'Request changes', variant: 'primary', placeholder: 'e.g. The proof of address is older than 3 months; upload a recent bill.' },
};

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const peso = (n: unknown) => (typeof n === 'number' ? n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) : '—');

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-xs last:border-0">
    <span className="text-slate-500">{label}</span>
    <span className="text-right font-medium text-slate-800">{value || '—'}</span>
  </div>
);

const CheckPill: React.FC<{ tone: 'ok' | 'warn' | 'bad' | 'none'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls = { ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200', warn: 'bg-amber-50 text-amber-800 ring-amber-200', bad: 'bg-rose-50 text-rose-700 ring-rose-200', none: 'bg-slate-100 text-slate-600 ring-slate-200' }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}>{children}</span>;
};

export const KycReviewPanel: React.FC<KycReviewPanelProps> = ({ clientId, api, canDecide, onClose, onDone }) => {
  const [data, setData] = useState<KycDossierView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<KycDecision | null>(null);
  const [reason, setReason] = useState('');
  const [sections, setSections] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.get(clientId));
    } catch (e: any) {
      setError(e?.message || 'Could not load this application.');
    }
  }, [api, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      return true;
    } catch (e: any) {
      setError(e?.message || 'The action failed.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openDecision = (d: KycDecision) => {
    setDecision(d);
    setReason('');
    setSections([]);
    setIdempotencyKey(crypto.randomUUID());
  };

  const submitDecision = async () => {
    if (!decision) return;
    const ok = await act(() => api.decide(clientId, { decision, reason: reason.trim(), sections }, idempotencyKey));
    if (ok) {
      setDecision(null);
      onDone?.();
    }
  };

  const status = data?.kycStatus;
  const awaiting = status === 'SUBMITTED' || status === 'UNDER_REVIEW';
  const ocr = data?.checks.ocr;
  const face = data?.checks.faceCheck;
  const discrepancies = (data?.checks.discrepancies as Array<{ field: string; message: string; declared: string | null; extracted: string | null; severity: string }>) ?? [];
  const app = data?.application as any;
  const currentDocs = data?.documents.filter((d) => d.current) ?? [];
  const olderDocs = data?.documents.filter((d) => !d.current) ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={data ? `KYC review — ${data.member.fullName}` : 'KYC review'}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {canDecide && data && awaiting && (
            <div className="flex flex-wrap gap-2">
              {status === 'SUBMITTED' && (
                <Button variant="outline" disabled={busy} onClick={() => act(() => api.claim(clientId))}>
                  <Lock className="h-4 w-4" /> Start review
                </Button>
              )}
              {status === 'UNDER_REVIEW' && (
                <Button variant="ghost" disabled={busy} onClick={() => act(() => api.release(clientId))}>
                  <Unlock className="h-4 w-4" /> Release
                </Button>
              )}
              <Button variant="primary" disabled={busy} onClick={() => openDecision('REQUEST_RESUBMISSION')}>
                <RefreshCw className="h-4 w-4" /> Request changes
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => openDecision('REJECT')}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button variant="success" disabled={busy} onClick={() => openDecision('APPROVE')}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            </div>
          )}
        </div>
      }
    >
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {!data && !error && <p className="py-10 text-center text-sm text-slate-500">Loading application…</p>}
      {data && (
        <div className="space-y-5" id="kyc-review-panel">
          <div className="flex flex-wrap items-center gap-3">
            <KycStatusBadge status={data.kycStatus} size="sm" />
            <span className="text-xs text-slate-500">
              {data.referenceNumber ? `Ref ${data.referenceNumber}` : 'Not submitted yet'}
              {data.submissionCount > 1 ? ` · version ${data.submissionCount}` : ''}
              {data.submittedAt ? ` · submitted ${fmt(data.submittedAt)}` : ''}
            </span>
            {data.claimedByName && status === 'UNDER_REVIEW' && <span className="text-xs text-slate-500">· reviewing: {data.claimedByName}</span>}
          </div>

          {(data.decisionReason || data.rejectionReason || data.correctionReason) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <strong>Last decision</strong> by {data.reviewedByName ?? '—'} on {fmt(data.reviewedAt)}: {data.decisionReason || data.rejectionReason || data.correctionReason}
            </div>
          )}

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Member record</h3>
              <Row label="Member no." value={data.member.borrowerNumber} />
              <Row label="Name" value={data.member.fullName} />
              <Row label="Date of birth" value={data.member.dateOfBirth} />
              <Row label="Sex / civil status" value={`${data.member.gender} / ${data.member.civilStatus}`} />
              <Row label="Mobile" value={data.member.phone} />
              <Row label="Email" value={`${data.member.email || '—'}${data.member.emailVerified ? ' (verified)' : ''}`} />
              <Row label="Address" value={data.member.address} />
              <Row label="Employment" value={[data.member.employmentStatus, data.member.occupation, data.member.employerOrBusiness].filter(Boolean).join(' · ')} />
              <Row label="Monthly income / expenses" value={`${peso(data.member.monthlyIncome)} / ${peso(data.member.monthlyExpenses)}`} />
              <Row label="Government ID" value={data.member.idNumber ? `${data.member.idType ?? ''} ${data.member.idNumber}` : '—'} />
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automated checks (advisory)</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">ID reading:</span>
                {!ocr ? (
                  <CheckPill tone="none">Not run</CheckPill>
                ) : ocr.status === 'COMPLETED' ? (
                  <CheckPill tone={ocr.readable === false ? 'bad' : 'ok'}>
                    {ocr.readable === false ? 'Unreadable' : 'Read'}
                    {ocr.confidence != null ? ` · ${ocr.confidence}%` : ''}
                  </CheckPill>
                ) : (
                  <CheckPill tone="warn">{ocr.status === 'UNAVAILABLE' ? 'Not available' : 'Failed'}</CheckPill>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Face comparison:</span>
                {!face ? (
                  <CheckPill tone="none">Not run</CheckPill>
                ) : (
                  <CheckPill tone={face.status === 'MATCH' ? 'ok' : face.status === 'NO_MATCH' ? 'bad' : 'warn'}>
                    {face.status.replace('_', ' ').toLowerCase()}
                    {face.confidence != null ? ` · ${face.confidence}%` : ''}
                  </CheckPill>
                )}
              </div>
              {(ocr?.status !== 'COMPLETED' || face?.status === 'UNAVAILABLE' || face?.status === 'FAILED') && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-800">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Some automated checks did not run. Compare the photos and the member record yourself.
                </p>
              )}
              {discrepancies.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-rose-50 p-2 text-[11px] text-rose-800">
                  {discrepancies.map((d) => (
                    <li key={d.field}>
                      <strong>{d.message}</strong> Declared: {d.declared ?? '—'} · On ID: {d.extracted ?? '—'}
                    </li>
                  ))}
                </ul>
              )}
              {app?.governmentId && (
                <div>
                  <Row label="ID type (declared)" value={app.governmentId.idType} />
                  <Row label="ID number (declared)" value={app.governmentId.idNumber} />
                  <Row label="Name on ID (declared)" value={app.governmentId.nameOnId} />
                  <Row label="ID expiry" value={app.governmentId.expirationDate} />
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Documents (links expire after 5 minutes)</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {data.requirements.map((r) => (
                <div key={r.kind} className={`rounded-xl border p-2 ${r.satisfied ? 'border-slate-200' : 'border-dashed border-rose-300 bg-rose-50/40'}`}>
                  <p className="mb-1 text-[11px] font-semibold text-slate-700">{r.label}</p>
                  {r.document?.url ? (
                    r.document.mimeType === 'application/pdf' ? (
                      <a href={r.document.url} target="_blank" rel="noreferrer" className="flex h-28 items-center justify-center gap-1 rounded-lg bg-slate-50 text-xs text-slate-600 hover:underline">
                        <FileText className="h-4 w-4" /> Open PDF
                      </a>
                    ) : (
                      <a href={r.document.url} target="_blank" rel="noreferrer" title="Open full size">
                        <img src={r.document.url} alt={r.label} className="h-28 w-full rounded-lg bg-slate-100 object-contain" />
                      </a>
                    )
                  ) : (
                    <p className="flex h-28 items-center justify-center text-center text-[11px] text-rose-700">{r.satisfied ? 'File link unavailable' : 'Not uploaded'}</p>
                  )}
                  {r.document && <p className="mt-1 text-[10px] text-slate-400">Uploaded {fmt(r.document.uploadedAt)}</p>}
                </div>
              ))}
              {currentDocs
                .filter((d) => !data.requirements.some((r) => r.document?.id === d.id))
                .map((d) => (
                  <a key={d.id} href={d.url ?? undefined} target="_blank" rel="noreferrer" className="flex flex-col justify-between rounded-xl border border-slate-200 p-2 text-[11px] text-slate-700 hover:bg-slate-50">
                    <span className="font-semibold">{d.label}</span>
                    <span className="flex items-center gap-1 text-slate-500">
                      Open <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                ))}
            </div>
          </section>

          <section>
            <button type="button" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:underline" onClick={() => setShowHistory((v) => !v)}>
              <History className="h-3.5 w-3.5" /> {showHistory ? 'Hide' : 'Show'} history ({data.auditTrail.length} events, {data.snapshots.length} submitted versions, {olderDocs.length} replaced files)
            </button>
            {showHistory && (
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <ol className="max-h-64 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2 text-[11px]">
                  {data.auditTrail.map((a) => (
                    <li key={a.id} className="border-b border-slate-100 pb-1 last:border-0">
                      <span className="text-slate-400">{fmt(a.createdAt)}</span> · <strong>{a.action.replace(/_/g, ' ').toLowerCase()}</strong>
                      {a.previousStatus && a.newStatus && a.previousStatus !== a.newStatus ? ` (${a.previousStatus} → ${a.newStatus})` : ''} · {a.actorName ?? a.actorType}
                      {a.reason ? <span className="block text-slate-600">“{a.reason}”</span> : null}
                    </li>
                  ))}
                </ol>
                <div className="space-y-2 text-[11px]">
                  {data.snapshots.map((s) => (
                    <div key={s.version} className="rounded-lg border border-slate-200 p-2">
                      Version {s.version} · {s.referenceNumber} · {fmt(s.submittedAt)}
                      <span className="block truncate font-mono text-[10px] text-slate-400" title={s.sha256}>sha256 {s.sha256}</span>
                    </div>
                  ))}
                  {olderDocs.map((d) => (
                    <a key={d.id} href={d.url ?? undefined} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
                      Replaced {d.label} · uploaded {fmt(d.uploadedAt)}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {decision && (
        <Modal
          open
          onClose={() => setDecision(null)}
          size="md"
          title={DECISION_COPY[decision].title}
          footer={
            <>
              <Button variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
              <Button id="kyc-decision-confirm" variant={DECISION_COPY[decision].variant} loading={busy} disabled={reason.trim().length < 3 || (decision === 'REQUEST_RESUBMISSION' && sections.length === 0)} onClick={submitDecision}>
                {DECISION_COPY[decision].button}
              </Button>
            </>
          }
        >
          <label htmlFor="kyc-decision-reason" className="mb-1 block text-xs font-medium text-slate-600">
            Reason <span className="text-rose-500">*</span> <span className="font-normal text-slate-400">(the member sees this)</span>
          </label>
          <textarea
            id="kyc-decision-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={DECISION_COPY[decision].placeholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {decision === 'REQUEST_RESUBMISSION' && (
            <fieldset className="mt-3">
              <legend className="mb-1 text-xs font-medium text-slate-600">What must the member change? <span className="text-rose-500">*</span></legend>
              <div className="grid grid-cols-2 gap-1.5">
                {SECTIONS.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={sections.includes(s.key)} onChange={(e) => setSections((prev) => (e.target.checked ? [...prev, s.key] : prev.filter((x) => x !== s.key)))} />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </Modal>
      )}
    </Modal>
  );
};

export default KycReviewPanel;
