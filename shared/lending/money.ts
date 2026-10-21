/**
 * Exact money and rate arithmetic for lending.
 *
 * Amounts are integer centavos (`Cents`). Rates are integer parts-per-million
 * of the base (`Ppm`): 12.5% is 125_000 ppm, so a percentage with up to four
 * decimal places is represented exactly. Products of amounts and rates are
 * taken in BigInt and divided once.
 *
 * ROUNDING RULE (the only one used anywhere in lending):
 *   every computed charge (interest, fee, level installment) is rounded
 *   half-up to the nearest centavo. All amounts are non-negative, so half-up
 *   and half-away-from-zero agree.
 * Splitting a fixed total across installments is an allocation, not a
 * rounding: see `splitEvenly`.
 */

export type Cents = number;
export type Ppm = number;

const PPM_PER_UNIT = 1_000_000n;
const PPM_PER_PERCENT = 10_000;
const MAX_SAFE_CENTS = 99_999_999_999_99; // fits numeric(14,2)

/** Divides two non-negative BigInts, rounding half-up. */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('denominator must be positive');
  if (numerator < 0n) throw new RangeError('numerator must be non-negative');
  return (numerator * 2n + denominator) / (denominator * 2n);
}

function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('amount is out of range');
  return Number(value);
}

/**
 * Parses a peso amount ("1234.5", "1,234.50", 1234.5) into centavos.
 * Returns null for anything that is not a non-negative amount with at most
 * two decimal places. Numbers are read through their shortest decimal string,
 * which is exact for any value that was written with two decimals.
 */
export function parsePesos(input: unknown): Cents | null {
  if (input === null || input === undefined) return null;
  let text: string;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    text = String(input);
    if (/e/i.test(text)) return null;
  } else if (typeof input === 'string') {
    text = input.trim().replace(/,/g, '');
  } else {
    return null;
  }
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
  return cents <= MAX_SAFE_CENTS ? cents : null;
}

/** Reads a numeric column value (string from node-postgres, string or number from PGlite). */
export function centsFromDb(value: unknown): Cents {
  if (value === null || value === undefined) return 0;
  const text = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) throw new RangeError(`Not a money value: ${text}`);
  const frac = (m[3] || '').padEnd(2, '0');
  if (frac.length > 2 && /[1-9]/.test(frac.slice(2))) throw new RangeError(`Money value has sub-centavo digits: ${text}`);
  const cents = Number(m[2]) * 100 + Number(frac.slice(0, 2));
  return m[1] ? -cents : cents;
}

/** Centavos as a numeric literal for the database: 123456 -> "1234.56". */
export function centsToDecimal(cents: Cents): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError('cents must be an integer');
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Centavos as a JSON number of pesos for display-only payloads (exact for 2 decimals). */
export function centsToPesos(cents: Cents): number {
  return Number(centsToDecimal(cents));
}

/** "₱12,345.60" */
export function formatPeso(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₱${whole}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Parses a percentage ("12.5", 12.5, "0.0001") into parts per million.
 * At most four decimal places; returns null otherwise.
 */
export function parsePercent(input: unknown): Ppm | null {
  if (input === null || input === undefined || input === '') return null;
  const text = typeof input === 'number' ? (Number.isFinite(input) ? String(input) : '') : String(input).trim();
  const m = /^(\d{1,3})(?:\.(\d{1,4}))?$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * PPM_PER_PERCENT + Number((m[2] || '').padEnd(4, '0'));
}

/** Reads a percentage column (numeric(7,4)) into ppm. */
export function ppmFromDb(value: unknown): Ppm {
  if (value === null || value === undefined) return 0;
  const text = typeof value === 'number' ? value.toFixed(4) : String(value).trim();
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) throw new RangeError(`Not a rate value: ${text}`);
  const frac = (m[2] || '').padEnd(4, '0');
  if (frac.length > 4 && /[1-9]/.test(frac.slice(4))) throw new RangeError(`Rate has more than four decimals: ${text}`);
  return Number(m[1]) * PPM_PER_PERCENT + Number(frac.slice(0, 4));
}

/** ppm as a percentage literal for the database: 125000 -> "12.5000". */
export function ppmToPercent(ppm: Ppm): string {
  return `${Math.floor(ppm / PPM_PER_PERCENT)}.${String(ppm % PPM_PER_PERCENT).padStart(4, '0')}`;
}

/** ppm as a short display string: 125000 -> "12.5%". */
export function formatPercent(ppm: Ppm): string {
  return `${ppmToPercent(ppm).replace(/\.?0+$/, '')}%`;
}

/** A rate as sent over the wire ("3.2500") for display: "3.25%". Unparseable input is shown as given. */
export function displayPercent(value: string | number | null | undefined): string {
  const ppm = parsePercent(value);
  return ppm === null ? `${value ?? ''}%` : formatPercent(ppm);
}

/**
 * amount x rate x (num / den), rounded half-up to the centavo.
 * Used for every interest and percentage-fee charge.
 */
export function applyRate(amount: Cents, rate: Ppm, num = 1, den = 1): Cents {
  if (amount < 0 || rate < 0 || num < 0 || den <= 0) throw new RangeError('applyRate takes non-negative inputs');
  const result = divRoundHalfUp(BigInt(amount) * BigInt(rate) * BigInt(num), PPM_PER_UNIT * BigInt(den));
  return toSafeNumber(result);
}

/**
 * Allocates `total` centavos across `parts` installments with no rounding:
 * each gets floor(total / parts) and the first (total mod parts) get one more
 * centavo, so the parts always add back to the total exactly.
 */
export function splitEvenly(total: Cents, parts: number): Cents[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new RangeError('total must be a non-negative integer');
  if (!Number.isInteger(parts) || parts <= 0) throw new RangeError('parts must be a positive integer');
  const base = Math.floor(total / parts);
  const extra = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  if (!Number.isSafeInteger(total)) throw new RangeError('sum is out of range');
  return total;
}
