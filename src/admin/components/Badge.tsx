import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'purple' | 'indigo' | 'gold';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'xs';
  dot?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
  danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
  info: 'bg-blue-50 text-blue-700 border-blue-200/80',
  default: 'bg-slate-100/80 text-slate-700 border-slate-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  gold: 'bg-amber-500/10 text-amber-700 border-amber-400/30',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-blue-500',
  default: 'bg-slate-400',
  purple: 'bg-purple-500',
  indigo: 'bg-indigo-500',
  gold: 'bg-amber-500',
};

export function getStatusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (['active', 'approved', 'completed', 'verified', 'success', 'paid', 'disbursed', 'good standing'].includes(s)) return 'success';
  if (['pending', 'under review', 'processing', 'partially paid', 'in review', 'requires correction', 'correction required', 'due'].includes(s)) return 'warning';
  if (['rejected', 'failed', 'cancelled', 'suspended', 'inactive', 'closed', 'overdue', 'defaulted', 'in arrears'].includes(s)) return 'danger';
  if (['dormant', 'graduated'].includes(s)) return 'default';
  if (['gold', 'vip', 'premium'].includes(s)) return 'gold';
  return 'info';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant, size = 'sm', dot = false, className = '' }) => {
  const resolvedVariant: BadgeVariant = variant || getStatusVariant(String(children).toLowerCase());
  
  const sizeClasses = size === 'xs' 
    ? 'px-2 py-0.5 text-[10px] font-medium' 
    : size === 'sm' 
      ? 'px-2.5 py-0.5 text-[11px] font-medium' 
      : 'px-3 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border shadow-[0_1px_2px_rgba(0,0,0,0.02)] whitespace-nowrap tracking-tight ${VARIANT_CLASSES[resolvedVariant]} ${sizeClasses} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASSES[resolvedVariant]} shrink-0`} />}
      {children}
    </span>
  );
};