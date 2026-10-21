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
import { KYC_STATUS_LABELS, normaliseKycStatus, type KycStatus as CanonicalKycStatus } from '../../shared/kyc-core';

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

const STYLES: Record<KycStatusTone, Omit<KycStatusConfig, 'key' | 'tone' | 'label' | 'IconComponent'>> = {
  green: { bgClass: 'bg-emerald-50', textClass: 'text-emerald-700', borderClass: 'border-emerald-200', ringClass: 'ring-emerald-500/20', dotClass: 'bg-emerald-500' },
  red: { bgClass: 'bg-rose-50', textClass: 'text-rose-700', borderClass: 'border-rose-200', ringClass: 'ring-rose-500/20', dotClass: 'bg-rose-500' },
  orange: { bgClass: 'bg-orange-50', textClass: 'text-orange-700', borderClass: 'border-orange-200', ringClass: 'ring-orange-500/20', dotClass: 'bg-orange-500' },
  yellow: { bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200', ringClass: 'ring-amber-500/20', dotClass: 'bg-amber-500' },
  slate: { bgClass: 'bg-slate-100', textClass: 'text-slate-600', borderClass: 'border-slate-200', ringClass: 'ring-slate-500/20', dotClass: 'bg-slate-400' },
};

const TONES: Record<CanonicalKycStatus, { tone: KycStatusTone; IconComponent: React.ComponentType<{ className?: string }> }> = {
  APPROVED: { tone: 'green', IconComponent: CheckCircle2 },
  REJECTED: { tone: 'red', IconComponent: XCircle },
  SUSPENDED: { tone: 'red', IconComponent: AlertCircle },
  CORRECTION_REQUIRED: { tone: 'orange', IconComponent: AlertTriangle },
  SUBMITTED: { tone: 'yellow', IconComponent: Clock },
  UNDER_REVIEW: { tone: 'yellow', IconComponent: Clock },
  IN_PROGRESS: { tone: 'yellow', IconComponent: Clock },
  NOT_STARTED: { tone: 'slate', IconComponent: MinusCircle },
};

/**
 * Styling and label for any stored KYC status. Spellings are normalised by
 * shared/kyc-core, so an unknown value shows as Not started, never as verified.
 */
export function getKycStatusConfig(status?: KycStatus | string | null): KycStatusConfig {
  const key = normaliseKycStatus(status);
  const { tone, IconComponent } = TONES[key];
  return { key, tone, label: KYC_STATUS_LABELS[key], IconComponent, ...STYLES[tone] };
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
