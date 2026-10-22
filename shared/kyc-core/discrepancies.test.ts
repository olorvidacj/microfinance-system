import { describe, expect, it } from 'vitest';
import { findDiscrepancies, nameSimilarity } from './discrepancies';
import { classifyFaceMatch, faceCheckBlocksSubmission } from './types';

const TODAY = '2026-10-20';

describe('nameSimilarity', () => {
  it('ignores case, accents, punctuation and word order', () => {
    expect(nameSimilarity('DELA CRUZ, JUAN SANTOS', 'Juan Santos Dela Cruz')).toBe(1);
    expect(nameSimilarity('José Peña', 'JOSE PENA')).toBe(1);
  });
  it('tolerates a single OCR slip but not a different person', () => {
    expect(nameSimilarity('Juan Santos Dela Cruz', 'Juan Sant0s Dela Cruz')).toBeGreaterThan(0.85);
    expect(nameSimilarity('Juan Santos Dela Cruz', 'Maria Reyes')).toBeLessThan(0.5);
  });
});

describe('findDiscrepancies', () => {
  const declared = { fullName: 'Juan Santos Dela Cruz', dateOfBirth: '1990-05-15', idNumber: '0111-2345678-9' };

  it('returns nothing when the scan agrees or found nothing', () => {
    expect(findDiscrepancies(declared, { fullName: 'DELA CRUZ JUAN SANTOS', dateOfBirth: '1990-05-15', idNumber: '011123456789' }, TODAY)).toEqual([]);
    expect(findDiscrepancies(declared, null, TODAY)).toEqual([]);
    expect(findDiscrepancies(declared, {}, TODAY)).toEqual([]);
  });

  it('flags name, birth date, ID number and expiry differences', () => {
    const found = findDiscrepancies(
      declared,
      { fullName: 'Maria Reyes', dateOfBirth: '1991-05-15', idNumber: '0111-2345678-0', expirationDate: '2025-01-01' },
      TODAY,
    );
    expect(found.map((d) => d.field)).toEqual(['fullName', 'dateOfBirth', 'idNumber', 'expirationDate']);
    expect(found.find((d) => d.field === 'expirationDate')?.severity).toBe('MEDIUM');
  });
});

describe('face match classification', () => {
  it.each([
    [95, 'MATCH'],
    [80, 'MATCH'],
    [79, 'LOW_CONFIDENCE'],
    [55, 'LOW_CONFIDENCE'],
    [54, 'NO_MATCH'],
  ])('confidence %d is %s', (c, s) => {
    expect(classifyFaceMatch(c)).toBe(s);
  });

  it('only a clear mismatch blocks submission', () => {
    const base = { provider: null, confidence: null, details: null, idDocumentId: null, selfieDocumentId: null, processedAt: '' };
    expect(faceCheckBlocksSubmission({ ...base, status: 'NO_MATCH' })).toBe(true);
    expect(faceCheckBlocksSubmission({ ...base, status: 'UNAVAILABLE' })).toBe(false);
    expect(faceCheckBlocksSubmission({ ...base, status: 'LOW_CONFIDENCE' })).toBe(false);
    expect(faceCheckBlocksSubmission(null)).toBe(false);
  });
});
