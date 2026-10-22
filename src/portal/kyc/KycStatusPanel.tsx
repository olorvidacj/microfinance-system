import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, AlertTriangle, XCircle, Ban, ChevronRight, FileSearch } from 'lucide-react';
import { KYC_SECTION_LABELS, parseSections } from '../../../shared/kyc-core';
import { formatDisplayDate, manilaToday } from '../../../shared/client';
import type { KycStatusData } from '../types';
import { kycProgress } from './wizard';

/**
 * The member's verification status: what it means, what is still missing,
 * what staff said, and what to do next. Used on the KYC page and the dashboard.
 */
export interface KycStatusPanelProps {
  status: KycStatusData;
  /** "card" for the dashboard; "page" when it is the whole KYC page. */
  variant?: 'card' | 'page';
  /** Where the action button goes (the KYC page, or a callback on that page). */
  onAction?: () => void;
}

interface Tone {
  ring: string;
  badge: string;
  Icon: React.FC<{ className?: string }>;
}

const TONES: Readonly<Record<string, Tone>> = {
  start: { ring: 'ring-slate-200', badge: 'bg-slate-100 text-slate-700', Icon: ShieldCheck },
  waiting: { ring: 'ring-sky-200', badge: 'bg-sky-50 text-sky-800', Icon: Clock },
  review: { ring: 'ring-sky-200', badge: 'bg-sky-50 text-sky-800', Icon: FileSearch },
  action: { ring: 'ring-amber-300', badge: 'bg-amber-50 text-amber-800', Icon: AlertTriangle },
  done: { ring: 'ring-emerald-200', badge: 'bg-emerald-50 text-emerald-800', Icon: ShieldCheck },
  bad: { ring: 'ring-rose-200', badge: 'bg-rose-50 text-rose-800', Icon: XCircle },
  blocked: { ring: 'ring-slate-300', badge: 'bg-slate-100 text-slate-700', Icon: Ban },
};

export const KycStatusPanel: React.FC<KycStatusPanelProps> = ({ status, variant = 'card', onAction }) => {
  const s = status.kycStatus;
  const progress = kycProgress(status, manilaToday());
  const sections = parseSections(status.correctionDetails?.sections ?? []);

  let tone = TONES.start;
  let message: React.ReactNode;
  let action: string | null = null;
  switch (s) {
    case 'NOT_STARTED':
      message = 'Verify your identity to apply for loans and open savings. It takes about 10 minutes.';
      action = 'Start verification';
      break;
    case 'IN_PROGRESS':
      message = `You have finished ${progress.done} of ${progress.total} steps. Your progress is saved.`;
      action = 'Continue verification';
      break;
    case 'SUBMITTED':
      tone = TONES.waiting;
      message = `Submitted ${formatDisplayDate(status.submittedAt)}. A branch officer will review it, and we will notify you of the result.`;
      break;
    case 'UNDER_REVIEW':
      tone = TONES.review;
      message = 'A branch officer is reviewing your application now. We will notify you of the result.';
      break;
    case 'CORRECTION_REQUIRED':
      tone = TONES.action;
      message = 'Your branch needs more information before they can verify you.';
      action = 'Update my application';
      break;
    case 'APPROVED':
      tone = TONES.done;
      message = `Your identity was verified${status.verifiedAt ? ` on ${formatDisplayDate(status.verifiedAt)}` : ''}. You can apply for loans and open savings.`;
      break;
    case 'REJECTED':
      tone = TONES.bad;
      message = status.resubmissionAllowed
        ? 'Your application was not approved. Review the reason below, update your application and submit it again.'
        : 'Your application was not approved. Please contact your branch for help.';
      action = status.resubmissionAllowed ? 'Update and resubmit' : null;
      break;
    case 'SUSPENDED':
      tone = TONES.blocked;
      message = 'Your verification is suspended. Please contact your branch.';
      break;
  }

  const feedback = s === 'CORRECTION_REQUIRED' ? status.correctionReason : s === 'REJECTED' ? status.rejectionReason || status.decisionReason : null;
  const { Icon } = tone;
  const button = action && (
    <span className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-gold-400 px-4 py-3 text-base font-bold text-navy-950 hover:bg-gold-300 sm:w-auto">
      {action} <ChevronRight className="h-5 w-5" aria-hidden="true" />
    </span>
  );

  return (
    <section aria-label="Identity verification status" className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${tone.ring} ${variant === 'page' ? 'mx-auto max-w-xl' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.badge}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identity verification</p>
          <h2 className="text-lg font-bold text-navy-950">{status.statusLabel}</h2>
          <p className="mt-1 text-sm text-slate-600">{message}</p>
        </div>
      </div>

      {s === 'IN_PROGRESS' && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <div className="h-full rounded-full bg-gold-400" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          {progress.outstanding.length > 0 && <p className="mt-2 text-sm text-slate-600">Still to do: {progress.outstanding.join(', ')}.</p>}
        </div>
      )}

      {(feedback || sections.length > 0) && (
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {feedback && (
            <p>
              <span className="font-semibold">Message from your branch:</span> {feedback}
            </p>
          )}
          {sections.length > 0 && <p className="mt-1">Please update: {sections.map((x) => KYC_SECTION_LABELS[x]).join(', ')}.</p>}
        </div>
      )}

      {status.referenceNumber && (s === 'SUBMITTED' || s === 'UNDER_REVIEW' || s === 'APPROVED') && (
        <p className="mt-3 text-xs text-slate-500">
          Reference number <span className="font-mono font-semibold text-slate-700">{status.referenceNumber}</span>
        </p>
      )}

      {button && (
        <div className="mt-4">
          {onAction ? (
            <button type="button" onClick={onAction} className="w-full sm:w-auto">
              {button}
            </button>
          ) : (
            <Link to="/portal/kyc" className="block sm:inline-block">
              {button}
            </Link>
          )}
        </div>
      )}
    </section>
  );
};
