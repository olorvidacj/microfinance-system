import { describe, expect, it } from 'vitest';
import { findDiscrepancies, nameSimilarity } from './discrepancies';
import { faceCheckIsVerification, faceCheckSummary, type FaceCheck } from './types';

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

describe('face checks', () => {
  const base: FaceCheck = { status: 'MATCH', provider: 'aws-rekognition', confidence: 98, details: null, idDocumentId: null, selfieDocumentId: null, processedAt: '' };

  it('counts only a match from a face-verification service as verification', () => {
    expect(faceCheckIsVerification(base)).toBe(true);
    expect(faceCheckIsVerification({ ...base, status: 'LOW_CONFIDENCE' })).toBe(false);
    expect(faceCheckIsVerification({ ...base, provider: 'gemini:gemini-2.5-flash' })).toBe(false);
    expect(faceCheckIsVerification({ ...base, provider: null, status: 'UNAVAILABLE' })).toBe(false);
    expect(faceCheckIsVerification(null)).toBe(false);
  });

  it('never describes an estimate or an unavailable check as a match', () => {
    expect(faceCheckSummary({ ...base, provider: 'gemini:gemini-2.5-flash' })).toMatch(/Not verified/);
    expect(faceCheckSummary({ ...base, provider: null, status: 'UNAVAILABLE' })).toMatch(/compare the photos yourself/);
    expect(faceCheckSummary(base)).toMatch(/Matches the ID portrait \(98% similarity\)/);
    expect(faceCheckSummary({ ...base, status: 'NO_MATCH', confidence: 30 })).toMatch(/May not match/);
  });
});
