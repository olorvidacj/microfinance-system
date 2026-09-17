import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'purple' | 'indigo';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  default: 'bg-slate-50 text-slate-600 border-slate-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  default: 'bg-slate-400',
  purple: 'bg-purple-500',
  indigo: 'bg-indigo-500',
};

export function getStatusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (['active', 'approved', 'completed', 'verified', 'success', 'paid', 'disbursed'].includes(s)) return 'success';
  if (['pending', 'under review', 'processing', 'partially paid', 'in review', 'requires correction', 'correction required'].includes(s)) return 'warning';
  if (['rejected', 'failed', 'cancelled', 'suspended', 'inactive', 'closed', 'overdue', 'defaulted'].includes(s)) return 'danger';
  if (['dormant', 'graduated'].includes(s)) return 'default';
  return 'info';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant, size = 'sm', dot = false }) => {
  const resolvedVariant: BadgeVariant = variant || getStatusVariant(String(children).toLowerCase());
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${VARIANT_CLASSES[resolvedVariant]} ${size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASSES[resolvedVariant]}`} />}
      {children}
    </span>
  );
};