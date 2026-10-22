import { describe, expect, it } from 'vitest';
import { EMPTY_KYC_FORM, type KycFormState } from '../../../shared/client';
import type { KycStatusData } from '../types';
import { WIZARD_STEPS, applicationToSend, kycProgress, requestedSections, resumeStep, stepComplete, stepIndex, stepLocked, stepOfIssue } from './wizard';

const TODAY = '2026-10-22';

const filled: KycFormState = {
  ...EMPTY_KYC_FORM,
  firstName: 'Juan',
  middleName: 'Santos',
  lastName: 'Dela Cruz',
  dateOfBirth: '1990-05-01',
  placeOfBirth: 'Tacloban City',
  gender: 'Male',
  civilStatus: 'Single',
  currentRegionCode: '08',
  currentCityCode: '083747',
  currentBarangayCode: '083747001',
  currentStreet: 'Rizal Ave',
  currentPostalCode: '6500',
  mobileNumber: '09171234567',
  idType: 'UMID',
  idNumber: '0111-2345678-9',
  nameOnId: 'JUAN SANTOS DELA CRUZ',
  biometricConsent: true,
  employmentStatus: 'Employed',
  employerName: 'Leyte Store',
  monthlyIncome: '15000',
  monthlyExpenses: '8000',
  sourceOfIncome: 'Salary',
};

function status(over: Partial<KycStatusData> = {}): KycStatusData {
  const doc = (type: string, submitted: boolean) => ({ type, name: type, submitted, status: submitted ? 'PENDING' : 'NOT_UPLOADED', fileUrl: null, fileName: null });
  return {
    kycStatus: 'IN_PROGRESS',
    statusLabel: 'In progress',
    isVerified: false,
    editable: true,
    applicationStatus: 'IN_PROGRESS',
    currentStep: 1,
    referenceNumber: null,
    submissionCount: 0,
    submittedAt: null,
    reviewedAt: null,
    reviewedByName: null,
    verifiedAt: null,
    decisionReason: null,
    rejectionReason: null,
    correctionReason: null,
    correctionDetails: null,
    resubmissionAllowed: true,
    requiredDocuments: [doc('ID_FRONT', false), doc('ID_BACK', false), doc('SELFIE', false)],
    member: {} as KycStatusData['member'],
    submission: { personalInfo: null, address: null, contactInfo: null, employment: null, governmentId: null, declarations: null },
    submissionId: null,
    uploadedDocuments: [],
    extractedIdData: null,
    faceMatchResult: null,
    discrepancies: [],
    ...over,
  };
}

const withDocs = (...kinds: string[]) =>
  status({
    requiredDocuments: ['ID_FRONT', 'ID_BACK', 'SELFIE'].map((type) => ({ type, name: type, submitted: kinds.includes(type), status: 'PENDING', fileUrl: null, fileName: null })),
  });

describe('KYC wizard steps', () => {
  it('runs in the guided order: personal, ID, ID details, selfie, more, review', () => {
    expect(WIZARD_STEPS.map((s) => s.key)).toEqual(['personal', 'id', 'idReview', 'selfie', 'more', 'review']);
  });

  it('resumes at the first unfinished step', () => {
    expect(resumeStep(EMPTY_KYC_FORM, status(), TODAY)).toBe(0);
    expect(resumeStep(filled, status(), TODAY)).toBe(stepIndex('id'));
    const scanned = { ...withDocs('ID_FRONT', 'ID_BACK'), extractedIdData: { status: 'UNAVAILABLE' } as KycStatusData['extractedIdData'] };
    expect(resumeStep(filled, scanned, TODAY)).toBe(stepIndex('selfie'));
  });

  it('needs the back of an ID that has one, and the reading', () => {
    const id = WIZARD_STEPS[stepIndex('id')];
    const read = { status: 'COMPLETED' } as KycStatusData['extractedIdData'];
    expect(stepComplete(id, filled, { ...withDocs('ID_FRONT'), extractedIdData: read }, TODAY)).toBe(false);
    expect(stepComplete(id, { ...filled, idType: 'PASSPORT' }, { ...withDocs('ID_FRONT'), extractedIdData: read }, TODAY)).toBe(true);
    expect(stepComplete(id, filled, withDocs('ID_FRONT', 'ID_BACK'), TODAY)).toBe(false);
  });

  it('counts progress for the dashboard', () => {
    expect(kycProgress(status(), TODAY)).toMatchObject({ done: 0, total: 5 });
  });

  it('while changes are requested, opens only those parts, starts there, and sends only them', () => {
    const asked = status({ kycStatus: 'CORRECTION_REQUIRED', correctionDetails: { sections: ['ADDRESS'], reason: 'Wrong barangay' } });
    expect(requestedSections(asked)).toEqual(['ADDRESS']);
    expect(stepLocked(WIZARD_STEPS[stepIndex('personal')], ['ADDRESS'])).toBe(false);
    expect(stepLocked(WIZARD_STEPS[stepIndex('id')], ['ADDRESS'])).toBe(true);
    expect(stepLocked(WIZARD_STEPS[stepIndex('review')], ['ADDRESS'])).toBe(false);
    expect(resumeStep(filled, asked, TODAY)).toBe(0);
    expect(Object.keys(applicationToSend(filled, asked)).sort()).toEqual(['address', 'declarations']);
    expect(Object.keys(applicationToSend(filled, status())).sort()).toEqual(['address', 'contactInfo', 'declarations', 'employment', 'governmentId', 'personalInfo']);
  });

  it('sends a refused submission back to the step that fixes it', () => {
    expect(stepOfIssue({ step: 'ADDRESS', field: 'address.current.cityCode' })).toBe(stepIndex('personal'));
    expect(stepOfIssue({ step: 'ID_UPLOAD', field: 'documents.ID_BACK' })).toBe(stepIndex('id'));
    expect(stepOfIssue({ step: 'ID_UPLOAD', field: 'governmentId.idNumber' })).toBe(stepIndex('idReview'));
    expect(stepOfIssue({ step: 'FACE_MATCH', field: 'declarations.biometricConsent' })).toBe(stepIndex('selfie'));
    expect(stepOfIssue({ step: 'DOCUMENTS', field: 'documents.PROOF_OF_INCOME' })).toBe(stepIndex('more'));
    expect(stepOfIssue({ step: 'CONSENT', field: 'declarations.privacyNotice' })).toBe(stepIndex('review'));
  });
});
