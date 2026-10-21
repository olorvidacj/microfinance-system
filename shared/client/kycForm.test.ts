import { describe, expect, it } from 'vitest';
import { validateKycApplication } from '../kyc-core';
import { EMPTY_KYC_FORM, buildKycApplication, kycFormErrors, kycFormFrom, kycStepsValid, type KycFormState } from './kycForm';
import type { KycApplicationView, KycMemberPrefillView } from './contracts';

const member: KycMemberPrefillView = {
  firstName: 'Maria',
  middleName: 'Santos',
  lastName: 'Dela Cruz',
  suffix: null,
  hasNoMiddleName: false,
  dateOfBirth: '1990-05-14',
  gender: 'Female',
  civilStatus: 'Married',
  phone: '+63 917 123 4567',
  email: 'maria@example.com',
  emailVerified: true,
  street: '12 Rizal St',
  region: 'Eastern Visayas',
  regionCode: '08',
  province: 'Leyte',
  provinceCode: '0837',
  city: 'Tacloban City',
  cityCode: '083747',
  barangay: 'Barangay 1',
  barangayCode: '083747001',
  postalCode: '6500',
  employmentStatus: 'Self-Employed',
  employerOrBusiness: 'Sari-sari store',
  occupation: 'Store owner',
  sourceOfIncome: 'Business',
  monthlyIncome: 25000,
  monthlyExpenses: 12000,
  idType: 'PHILSYS_ID',
  idNumber: '123456789012',
};
const noApplication: KycApplicationView = { personalInfo: null, address: null, contactInfo: null, employment: null, governmentId: null, declarations: null };
const TODAY = '2026-10-21';

const complete = (): KycFormState => ({
  ...kycFormFrom({ member, submission: noApplication }),
  placeOfBirth: 'Tacloban City',
  truthfulInformation: true,
  documentOwnership: true,
  privacyNotice: true,
});

describe('KYC form (web and app)', () => {
  it('prefills from the member record, PSGC codes included', () => {
    const f = kycFormFrom({ member, submission: noApplication });
    expect(f.currentRegionCode).toBe('08');
    expect(f.currentCityCode).toBe('083747');
    expect(f.currentBarangayCode).toBe('083747001');
    expect(f.currentStreet).toBe('12 Rizal St');
    expect(f.mobileNumber).toBe('+63 917 123 4567');
    expect(f.monthlyIncome).toBe('25000');
    expect(f.nameOnId).toBe('Maria Santos Dela Cruz');
  });

  it('prefers what the member already saved in the application', () => {
    const f = kycFormFrom({
      member,
      submission: { ...noApplication, personalInfo: { firstName: 'Ma.', placeOfBirth: 'Palo' }, employment: { monthlyIncome: '30000.50' } },
    });
    expect(f.firstName).toBe('Ma.');
    expect(f.lastName).toBe('Dela Cruz');
    expect(f.placeOfBirth).toBe('Palo');
    expect(f.monthlyIncome).toBe('30000.50');
  });

  it('builds a payload the server accepts once every step is filled', () => {
    expect(validateKycApplication(buildKycApplication(complete()), TODAY)).toEqual([]);
  });

  it('sends monthly amounts exactly as typed, never through floating point', () => {
    const p = buildKycApplication({ ...complete(), monthlyIncome: '25,000.10' });
    expect(p.employment?.monthlyIncome).toBe('25000.10');
  });

  it('reports the server rules per step and per field', () => {
    const f: KycFormState = { ...EMPTY_KYC_FORM, firstName: 'J0hn', mobileNumber: '12345' };
    const errors = kycFormErrors(f, ['PERSONAL_INFO', 'CONTACT'], TODAY);
    expect(errors.firstName).toMatch(/letters/);
    expect(errors.mobileNumber).toMatch(/mobile number/);
    expect(errors.currentCityCode).toBeUndefined();
    expect(kycStepsValid(complete(), ['PERSONAL_INFO', 'ADDRESS', 'CONTACT', 'FINANCIAL', 'ID_UPLOAD', 'CONSENT'], TODAY)).toBe(true);
    expect(kycStepsValid({ ...complete(), privacyNotice: false }, ['CONSENT'], TODAY)).toBe(false);
  });
});
