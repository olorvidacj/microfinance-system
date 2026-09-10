import React from 'react';
import { LoanStatus, NotificationCategory, PaymentStatus, KYCStatus } from '../../types';

type Tone = 'green' | 'red' | 'amber' | 'blue' | 'slate' | 'purple' | 'teal';

const tones: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
};

export const StatusBadge: React.FC<{
  status: string;
  tone?: Tone;
  className?: string;
}> = ({ status, tone, className = '' }) => {
  const effective = tone || toneFor(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[effective]} ${className}`}
    >
      {humanize(status)}
    </span>
  );
};

export function toneFor(status: string): Tone {
  const s = status?.toUpperCase() || '';
  if (['VERIFIED', 'ACTIVE', 'COMPLETED', 'PAID_OFF', 'APPROVED', 'DISBURSED', 'SUCCESS', 'CONFIRMED'].some((k) => s.includes(k)))
    return 'green';
  if (['REJECTED', 'FAILED', 'OVERDUE', 'LATE', 'CANCELLED', 'BLOCKED', 'ARREARS'].some((k) => s.includes(k))) return 'red';
  if (['PENDING', 'UNDER_REVIEW', 'SUBMITTED', 'PROCESSING', 'IN_PROGRESS'].some((k) => s.includes(k))) return 'amber';
  if (['PAID', 'CLOSED', 'RESOLVED'].some((k) => s.includes(k))) return 'blue';
  if (['UPCOMING'].includes(s)) return 'slate';
  if (['OPEN'].includes(s)) return 'purple';
  return 'green';
}

function humanize(status: string): string {
  return (status || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const loanStatusTone = (s: string): string => toneFor(s);
export const paymentStatusTone = (s: string): string => toneFor(s);
export const kycStatusTone = (s: string): string => toneFor(s);
export const categoryTone = (c: NotificationCategory): string => {
  switch (c) {
    case 'payment_confirmation':
    case 'savings_update':
      return 'green';
    case 'overdue_payment':
      return 'red';
    case 'upcoming_payment':
      return 'amber';
    case 'announcement':
      return 'purple';
    default:
      return 'blue';
  }
};