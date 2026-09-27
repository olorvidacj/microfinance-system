import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MinusCircle,
  AlertCircle,
} from 'lucide-react';
import { KycStatus } from '../types';

export type KycStatusTone = 'green' | 'red' | 'yellow' | 'orange' | 'slate';

export interface KycStatusConfig {
  key: string;
  tone: KycStatusTone;
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
  dotClass: string;
  IconComponent: React.ComponentType<{ className?: string }>;
}

/**
 * Resolves comprehensive styling, semantic color tones, labels, and icons
 * for any KYC status string (case-insensitive and alias-tolerant).
 */
export function getKycStatusConfig(status?: KycStatus | string | null): KycStatusConfig {
  const normalized = (status || '').toString().trim().toUpperCase().replace(/[\s-]+/g, '_');

  // 1. APPROVED / VERIFIED -> GREEN
  if (
    [
      'APPROVED',
      'VERIFIED',
      'PASSED',
      'ACCEPTED',
      'COMPLETED',
      'ACTIVE',
      'VERIFIED_PMES_COMPLETED',
    ].includes(normalized) ||
    normalized.includes('APPROV') ||
    normalized.includes('VERIF')
  ) {
    const isVerifiedLabel = normalized.includes('VERIF');
    return {
      key: 'APPROVED',
      tone: 'green',
      label: isVerifiedLabel ? 'Verified' : 'Approved',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
      ringClass: 'ring-emerald-500/20',
      dotClass: 'bg-emerald-500',
      IconComponent: CheckCircle2,
    };
  }

  // 2. REJECTED / SUSPENDED / FAILED / EXPIRED -> RED
  if (
    [
      'REJECTED',
      'FAILED',
      'SUSPENDED',
      'EXPIRED',
      'DENIED',
      'BLOCKED',
      'DECLINED',
    ].includes(normalized) ||
    normalized.includes('REJECT')
  ) {
    let label = 'Rejected';
    if (normalized.includes('SUSPEND')) label = 'Suspended';
    if (normalized.includes('EXPIR')) label = 'Expired';
    return {
      key: 'REJECTED',
      tone: 'red',
      label,
      bgClass: 'bg-rose-50',
      textClass: 'text-rose-700',
      borderClass: 'border-rose-200',
      ringClass: 'ring-rose-500/20',
      dotClass: 'bg-rose-500',
      IconComponent: XCircle,
    };
  }

  // 3. CORRECTION REQUIRED -> ORANGE
  if (
    [
      'CORRECTION_REQUIRED',
      'CORRECTION_REQUESTED',
      'REQUIRES_CORRECTION',
      'ACTION_REQUIRED',
      'CHANGES_REQUESTED',
      'RESUBMIT',
    ].includes(normalized) ||
    normalized.includes('CORRECT')
  ) {
    return {
      key: 'CORRECTION_REQUIRED',
      tone: 'orange',
      label: 'Correction Required',
      bgClass: 'bg-orange-50',
      textClass: 'text-orange-700',
      borderClass: 'border-orange-200',
      ringClass: 'ring-orange-500/20',
      dotClass: 'bg-orange-500',
      IconComponent: AlertTriangle,
    };
  }

  // 4. PENDING / UNDER REVIEW / SUBMITTED / IN PROGRESS -> YELLOW / AMBER
  if (
    [
      'PENDING',
      'UNDER_REVIEW',
      'IN_REVIEW',
      'SUBMITTED',
      'IN_PROGRESS',
      'PROCESSING',
      'AWAITING_REVIEW',
      'INVESTIGATION',
    ].includes(normalized) ||
    normalized.includes('PENDING') ||
    normalized.includes('REVIEW')
  ) {
    let label = 'Pending';
    if (normalized.includes('UNDER_REVIEW') || normalized.includes('IN_REVIEW')) {
      label = 'Under Review';
    } else if (normalized.includes('IN_PROGRESS')) {
      label = 'In Progress';
    } else if (normalized.includes('SUBMIT')) {
      label = 'Submitted';
    }
    return {
      key: 'PENDING',
      tone: 'yellow',
      label,
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-800',
      borderClass: 'border-amber-200',
      ringClass: 'ring-amber-500/20',
      dotClass: 'bg-amber-500',
      IconComponent: Clock,
    };
  }

  // 5. NOT STARTED / INCOMPLETE / DRAFT / DEFAULT -> SLATE / GRAY
  return {
    key: 'NOT_STARTED',
    tone: 'slate',
    label: normalized ? (normalized === 'NOT_STARTED' ? 'Not Started' : normalized.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())) : 'Not Started',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
    borderClass: 'border-slate-200',
    ringClass: 'ring-slate-400/20',
    dotClass: 'bg-slate-400',
    IconComponent: MinusCircle,
  };
}

export interface KycStatusBadgeProps {
  /** The KYC status identifier or raw string value */
  status?: KycStatus | string | null;
  /** Optional custom label override */
  label?: string;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Visual presentation mode */
  variant?: 'badge' | 'subtle' | 'pill' | 'dot-only';
  /** Whether to render the status icon */
  showIcon?: boolean;
  /** Whether to render the status dot indicator */
  showDot?: boolean;
  /** Add gentle pulsing animation to pending / under review indicators */
  pulse?: boolean;
  /** Extra CSS class names */
  className?: string;
  /** Tooltip or title attribute */
  title?: string;
}

export const KycStatusBadge: React.FC<KycStatusBadgeProps> = ({
  status,
  label: customLabel,
  size = 'sm',
  variant = 'badge',
  showIcon = true,
  showDot = false,
  pulse = false,
  className = '',
  title,
}) => {
  const config = getKycStatusConfig(status);
  const displayLabel = customLabel || config.label;
  const { IconComponent } = config;

  // Dot-only variant (compact indicator for tight table spaces)
  if (variant === 'dot-only') {
    return (
      <span
        title={title || `KYC: ${displayLabel}`}
        className={`inline-flex items-center gap-1.5 ${className}`}
      >
        <span className="relative flex h-2 w-2">
          {pulse && (config.tone === 'yellow' || config.tone === 'orange') && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotClass}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotClass}`} />
        </span>
        <span className={`text-xs font-semibold ${config.textClass}`}>{displayLabel}</span>
      </span>
    );
  }

  // Size specifications
  const sizeConfig = {
    xs: {
      container: 'px-2 py-0.5 text-[10px] gap-1',
      icon: 'w-3 h-3',
      dot: 'w-1.5 h-1.5',
    },
    sm: {
      container: 'px-2.5 py-0.5 text-[11px] gap-1.5',
      icon: 'w-3.5 h-3.5',
      dot: 'w-1.5 h-1.5',
    },
    md: {
      container: 'px-3 py-1 text-xs gap-1.5',
      icon: 'w-4 h-4',
      dot: 'w-2 h-2',
    },
    lg: {
      container: 'px-3.5 py-1.5 text-sm gap-2',
      icon: 'w-4 h-4',
      dot: 'w-2.5 h-2.5',
    },
  }[size];

  const roundedClass = variant === 'pill' ? 'rounded-full' : 'rounded-lg';
  const borderClass = variant === 'subtle' ? '' : `border ${config.borderClass}`;
  const ringClass = variant === 'subtle' ? '' : `ring-1 ring-inset ${config.ringClass}`;

  const shouldPulse = pulse || config.tone === 'yellow';

  return (
    <span
      title={title || `KYC Status: ${displayLabel}`}
      className={`inline-flex items-center font-bold tracking-tight whitespace-nowrap transition-colors ${config.bgClass} ${config.textClass} ${borderClass} ${ringClass} ${roundedClass} ${sizeConfig.container} ${className}`}
      role="status"
      aria-label={`KYC Status: ${displayLabel}`}
    >
      {showDot && (
        <span className="relative flex items-center justify-center">
          {shouldPulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${config.dotClass}`}
            />
          )}
          <span className={`rounded-full ${config.dotClass} ${sizeConfig.dot}`} />
        </span>
      )}

      {showIcon && <IconComponent className={`${sizeConfig.icon} shrink-0`} />}

      <span className="leading-none">{displayLabel}</span>
    </span>
  );
};

export default KycStatusBadge;
