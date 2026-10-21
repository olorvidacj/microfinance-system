import { normalizeIdNumber } from './validation';

export interface DeclaredIdentity {
  fullName: string;
  dateOfBirth?: string | null;
  idNumber?: string | null;
}

/** Fields read from the ID by the automated scan. Any field may be missing. */
export interface ExtractedIdentity {
  fullName?: string | null;
  dateOfBirth?: string | null;
  idNumber?: string | null;
  expirationDate?: string | null;
}

export type DiscrepancySeverity = 'HIGH' | 'MEDIUM';

export interface Discrepancy {
  field: 'fullName' | 'dateOfBirth' | 'idNumber' | 'expirationDate';
  declared: string | null;
  extracted: string | null;
  severity: DiscrepancySeverity;
  message: string;
}

/** Digits OCR commonly reads in place of letters inside names. */
const OCR_DIGIT_LETTERS: Readonly<Record<string, string>> = { '0': 'o', '1': 'l', '5': 's', '8': 'b' };

/** Lowercase, accents stripped, punctuation removed, tokens sorted, so "DELA CRUZ, Juan" equals "Juan Dela Cruz". */
export function nameTokens(name: string | null | undefined): string[] {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0158]/g, (d) => OCR_DIGIT_LETTERS[d])
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .sort();
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** 0..1 similarity of two names, tolerant of word order and small OCR errors. */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const x = nameTokens(a).join(' ');
  const y = nameTokens(b).join(' ');
  if (!x || !y) return 0;
  const longest = Math.max(x.length, y.length);
  return 1 - levenshtein(x, y) / longest;
}

/** Below this the names are treated as different people rather than OCR noise. */
export const NAME_MATCH_THRESHOLD = 0.85;

export function findDiscrepancies(
  declared: DeclaredIdentity,
  extracted: ExtractedIdentity | null | undefined,
  today: string,
): Discrepancy[] {
  if (!extracted) return [];
  const out: Discrepancy[] = [];

  if (extracted.fullName && declared.fullName) {
    const score = nameSimilarity(declared.fullName, extracted.fullName);
    if (score < NAME_MATCH_THRESHOLD) {
      out.push({
        field: 'fullName',
        declared: declared.fullName,
        extracted: extracted.fullName,
        severity: 'HIGH',
        message: `The name on the ID does not match the declared name (similarity ${Math.round(score * 100)}%).`,
      });
    }
  }

  if (extracted.dateOfBirth && declared.dateOfBirth && extracted.dateOfBirth !== declared.dateOfBirth) {
    out.push({
      field: 'dateOfBirth',
      declared: declared.dateOfBirth,
      extracted: extracted.dateOfBirth,
      severity: 'HIGH',
      message: 'The date of birth on the ID does not match the declared date of birth.',
    });
  }

  if (extracted.idNumber && declared.idNumber) {
    if (normalizeIdNumber(extracted.idNumber) !== normalizeIdNumber(declared.idNumber)) {
      out.push({
        field: 'idNumber',
        declared: declared.idNumber,
        extracted: extracted.idNumber,
        severity: 'HIGH',
        message: 'The ID number read from the card does not match the number entered.',
      });
    }
  }

  if (extracted.expirationDate && /^\d{4}-\d{2}-\d{2}$/.test(extracted.expirationDate) && extracted.expirationDate < today) {
    out.push({
      field: 'expirationDate',
      declared: null,
      extracted: extracted.expirationDate,
      severity: 'MEDIUM',
      message: 'The ID appears to be expired.',
    });
  }

  return out;
}
