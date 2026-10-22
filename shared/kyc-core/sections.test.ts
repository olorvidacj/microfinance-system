import { describe, expect, it } from 'vitest';
import { parseSections, scopeApplication, sectionOfDocument, sectionOpen } from './sections';

const payload = {
  personalInfo: { firstName: 'Ana' },
  contactInfo: { mobileNumber: '09170000000' },
  address: { current: { cityCode: '083747' } },
  employment: { employmentStatus: 'Employed' },
  governmentId: { idType: 'UMID' },
  declarations: { truthfulInformation: true },
};

describe('KYC correction sections', () => {
  it('keeps only known sections, in order, without repeats', () => {
    expect(parseSections(['address', 'PERSONAL_INFO', 'ADDRESS', 'nope'])).toEqual(['PERSONAL_INFO', 'ADDRESS']);
    expect(parseSections('ADDRESS')).toEqual([]);
  });

  it('opens everything when nothing was requested, and a new ID reopens the selfie', () => {
    expect(sectionOpen('FINANCIAL', null)).toBe(true);
    expect(sectionOpen('FINANCIAL', ['ADDRESS'])).toBe(false);
    expect(sectionOpen('FACE_MATCH', ['ID_UPLOAD'])).toBe(true);
    expect(sectionOfDocument('ID_BACK')).toBe('ID_UPLOAD');
    expect(sectionOfDocument('PROOF_OF_INCOME')).toBe('DOCUMENTS');
  });

  it('sends only the requested parts and the declarations', () => {
    expect(scopeApplication(payload, null)).toBe(payload);
    expect(scopeApplication(payload, ['ADDRESS'])).toEqual({ address: payload.address, declarations: payload.declarations });
    expect(scopeApplication(payload, ['PERSONAL_INFO', 'ID_UPLOAD'])).toEqual({
      personalInfo: payload.personalInfo,
      contactInfo: payload.contactInfo,
      governmentId: payload.governmentId,
      declarations: payload.declarations,
    });
  });
});
