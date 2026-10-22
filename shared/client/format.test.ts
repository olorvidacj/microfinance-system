import { describe, expect, it } from 'vitest';
import { formatDisplayDate, formatDisplayDateTime, formatMoney } from './format';

describe('display formatting', () => {
  it('shows calendar dates as the same day whatever the device time zone', () => {
    expect(formatDisplayDate('2026-10-21')).toBe('Oct 21, 2026');
    expect(formatDisplayDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatDisplayDate(null)).toBe('—');
    expect(formatDisplayDate('not a date')).toBe('not a date');
  });

  it('shows timestamps in Philippine time', () => {
    // 2026-10-20 18:30 UTC is 2026-10-21 02:30 in Manila.
    expect(formatDisplayDate('2026-10-20T18:30:00Z')).toBe('Oct 21, 2026');
    expect(formatDisplayDateTime('2026-10-20T18:30:00Z')).toMatch(/Oct 21, 2026.*2:30/);
  });

  it('formats money exactly, from strings or numbers', () => {
    expect(formatMoney('1234.5')).toBe('₱1,234.50');
    expect(formatMoney('10609.00')).toBe('₱10,609.00');
    expect(formatMoney(0.1 + 0.2)).toBe('₱0.30');
    expect(formatMoney('-50.25')).toBe('-₱50.25');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney('abc')).toBe('—');
  });
});
