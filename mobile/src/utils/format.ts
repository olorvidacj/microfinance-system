import { colors } from '../theme';

export function formatCurrency(value?: number | string | null): string {
  const num = Number(value || 0);
  if (isNaN(num)) return '₱ 0.00';
  const sign = num < 0 ? '-₱ ' : '₱ ';
  return `${sign}${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPeso(value?: number | string | null): string {
  const num = Number(value || 0);
  if (isNaN(num)) return '₱0.00';
  return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCompact(value?: number | string | null): string {
  const num = Number(value || 0);
  if (isNaN(num)) return '0';
  if (num >= 1000000) return `₱${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `₱${(num / 1000).toFixed(1)}k`;
  return `₱${num.toFixed(0)}`;
}

export function formatDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', ...opts });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${formatDate(iso)}, ${d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function titleCase(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function initials(name?: string | null): string {
  if (!name) return 'H';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
    || 'H';
}

export function statusColor(status: string): string {
  const s = status.toUpperCase().replace(/\s+/g, '_');
  if (['VERIFIED', 'COMPLETED', 'PAID', 'PAID_OFF', 'ACTIVE', 'APPROVED', 'SUCCESS', 'COMPLETED', 'CONFIRMED'].includes(s)) return colors.green;
  if (['PENDING', 'UNDER_REVIEW', 'IN_PROGRESS', 'PENDING_TELLER_VERIFICATION', 'FORMING'].includes(s)) return colors.warning;
  if (['REJECTED', 'OVERDUE', 'FAILED', 'LATE', 'IN_ARREARS', 'CANCELLED', 'EXPIRED'].includes(s)) return colors.danger;
  if (['CORRECTION_REQUIRED', 'DISBURSED'].includes(s)) return colors.info;
  return colors.textMuted;
}

export function statusBgColor(status: string): string {
  const s = status.toUpperCase().replace(/\s+/g, '_');
  if (['VERIFIED', 'COMPLETED', 'PAID', 'PAID_OFF', 'ACTIVE', 'APPROVED', 'SUCCESS', 'CONFIRMED'].includes(s)) return colors.greenSoft;
  if (['PENDING', 'UNDER_REVIEW', 'IN_PROGRESS', 'PENDING_TELLER_VERIFICATION', 'FORMING'].includes(s)) return colors.warningSoft;
  if (['REJECTED', 'OVERDUE', 'FAILED', 'LATE', 'IN_ARREARS', 'CANCELLED', 'EXPIRED'].includes(s)) return colors.dangerSoft;
  if (['CORRECTION_REQUIRED', 'DISBURSED'].includes(s)) return colors.infoSoft;
  return colors.background;
}

export function humanizeStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

type DateInput = string | Date;
export function addDays(iso: string | Date, days: number): string {
  const d = iso instanceof Date ? new Date(iso) : new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysAgo(n: number): string {
  return addDays(new Date(), -n);
}

export function daysUntil(iso?: string | null): number {
  if (!iso) return 0;
  const target = new Date(iso).getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

export function percentComplete(paid: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((paid / total) * 100)));
}