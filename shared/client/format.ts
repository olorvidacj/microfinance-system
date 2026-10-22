import { centsFromDb, formatPeso } from '../lending';

/**
 * Display formatting shared by the web portal and the mobile app.
 *
 * Dates: "YYYY-MM-DD" values are calendar dates and are shown as that date on
 * any device (parsing them as local time shifted them by a day west of UTC).
 * Timestamps are shown in Philippine time, where the cooperative operates.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_OPTS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

export function formatDisplayDate(value?: string | null): string {
  if (!value) return '—';
  if (DATE_ONLY.test(value)) return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-PH', { ...DATE_OPTS, timeZone: 'UTC' });
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('en-PH', { ...DATE_OPTS, timeZone: 'Asia/Manila' });
}

export function formatDisplayDateTime(value?: string | null): string {
  if (!value) return '—';
  if (DATE_ONLY.test(value)) return formatDisplayDate(value);
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('en-PH', { ...DATE_OPTS, hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
}

/** Money from the API (exact decimal string) or a peso number, as "₱1,234.50". */
export function formatMoney(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  try {
    return formatPeso(centsFromDb(value));
  } catch {
    return '—';
  }
}

/** Today's calendar date in the Philippines ("YYYY-MM-DD"), whatever the device's time zone. */
export function manilaToday(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}
