import { describe, expect, it } from 'vitest';
import {
  ageOn,
  firstIssueStep,
  normalizeEmail,
  normalizeIdNumber,
  normalizePhilippineMobile,
  parseMonthlyAmount,
  phoneKey,
  validateIdNumber,
  validateKycApplication,
  validateRegistration,
  type RegistrationInput,
} from './validation';

const TODAY = '2026-10-20';

const validRegistration = (): RegistrationInput => ({
  firstName: 'Juan',
  middleName: 'Santos',
  lastName: 'Dela Cruz',
  email: '  Juan.DelaCruz@Example.com ',
  phone: '0917 123 4567',
  dateOfBirth: '1990-05-15',
  gender: 'Male',
  civilStatus: 'Married',
  address: { street: '12 Rizal St', regionCode: '08', provinceCode: '0837', cityCode: '083747', barangayCode: '083747018', postalCode: '6500' },
  employmentStatus: 'Self-Employed',
  occupation: 'Sari-sari store owner',
  employerOrBusiness: 'JDC Store',
  sourceOfIncome: 'Business',
  monthlyIncome: '25,000.50',
  monthlyExpenses: 12000,
  idType: 'UMID',
  idNumber: '0111-2345678-9',
});

describe('primitive normalisers', () => {
  it.each([
    ['09171234567', '+63 917 123 4567'],
    ['+63 917 123 4567', '+63 917 123 4567'],
    ['639171234567', '+63 917 123 4567'],
    ['9171234567', '+63 917 123 4567'],
  ])('normalises mobile %s', (raw, out) => {
    expect(normalizePhilippineMobile(raw)).toBe(out);
    expect(phoneKey(raw)).toBe('9171234567');
  });

  it.each(['0217123456', '0817123456', '12345', '+1 415 555 0100', '631171234567', ''])('rejects %j as a PH mobile', (raw) => {
    expect(normalizePhilippineMobile(raw)).toBeNull();
    expect(phoneKey(raw)).toBeNull();
  });

  it('normalises email and id numbers for comparison', () => {
    expect(normalizeEmail(' A@B.Co ')).toBe('a@b.co');
    expect(normalizeEmail('a@b')).toBeNull();
    expect(normalizeIdNumber('n01-23 456789')).toBe('N0123456789');
  });

  it('computes age across the birthday boundary and rejects impossible dates', () => {
    expect(ageOn('2008-10-20', TODAY)).toBe(18);
    expect(ageOn('2008-10-21', TODAY)).toBe(17);
    expect(ageOn('2001-02-30', TODAY)).toBeNull();
  });

  it('parses declared monthly amounts strictly', () => {
    expect(parseMonthlyAmount('15,000.50', 'x')).toEqual({ value: 15000.5, error: null });
    expect(parseMonthlyAmount(0, 'x').value).toBe(0);
    expect(parseMonthlyAmount('-1', 'x').error).toBeTruthy();
    expect(parseMonthlyAmount('12.345', 'x').error).toBeTruthy();
    expect(parseMonthlyAmount('', 'x').error).toMatch(/required/);
  });
});

describe('validateIdNumber', () => {
  it.each([
    ['PHILSYS_ID', '1234-5678-9012-3456'],
    ['PHILSYS_ID', '123456789012'],
    ['DRIVERS_LICENSE', 'N01-23-456789'],
    ['PASSPORT', 'P1234567A'],
    ['PASSPORT', 'EB1234567'],
    ['UMID', '0111-2345678-9'],
    ['SSS_ID', '04-1234567-8'],
    ['PRC_ID', '0123456'],
    ['TIN_ID', '123-456-789-000'],
  ])('accepts a %s of %s', (type, num) => {
    expect(validateIdNumber(type, num)).toBeNull();
  });

  it.each([
    ['PHILSYS_ID', '1234-5678'],
    ['DRIVERS_LICENSE', '0123456789'],
    ['PASSPORT', 'P123456'],
    ['UMID', 'ABC'],
    ['NOT_A_TYPE', '123456'],
    ['UMID', ''],
  ])('rejects a %s of %j', (type, num) => {
    expect(validateIdNumber(type, num)).toBeTruthy();
  });
});

describe('validateRegistration', () => {
  it('accepts a complete self-registration and normalises it', () => {
    const r = validateRegistration(validRegistration(), 'SELF', TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fullName).toBe('Juan Santos Dela Cruz');
    expect(r.value.email).toBe('juan.delacruz@example.com');
    expect(r.value.phone).toBe('+63 917 123 4567');
    expect(r.value.phoneKey).toBe('9171234567');
    expect(r.value.monthlyIncome).toBe(25000.5);
    expect(r.value.idNumberNormalized).toBe('011123456789');
    expect(r.value.address.cityCode).toBe('083747');
  });

  it('requires email for self-registration but not for a branch registration', () => {
    const noEmail = { ...validRegistration(), email: '' };
    const self = validateRegistration(noEmail, 'SELF', TODAY);
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.errors.email).toMatch(/required/);
    expect(validateRegistration(noEmail, 'BRANCH', TODAY).ok).toBe(true);
  });

  it('requires a government ID for a branch registration', () => {
    const r = validateRegistration({ ...validRegistration(), idType: '', idNumber: '' }, 'BRANCH', TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.idNumber).toBeTruthy();
    expect(validateRegistration({ ...validRegistration(), idType: '', idNumber: '' }, 'SELF', TODAY).ok).toBe(true);
  });

  it('reports every bad field at once', () => {
    const r = validateRegistration(
      { ...validRegistration(), firstName: 'J4n', phone: '123', dateOfBirth: '2010-01-01', gender: 'X', address: { street: '' } },
      'SELF',
      TODAY,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors)).toEqual(
      expect.arrayContaining(['firstName', 'phone', 'dateOfBirth', 'gender', 'address.street', 'address.regionCode', 'address.cityCode', 'address.barangayCode', 'address.postalCode']),
    );
    expect(r.errors.dateOfBirth).toMatch(/18/);
  });

  it('drops the middle name when the member has none', () => {
    const r = validateRegistration({ ...validRegistration(), middleName: '', hasNoMiddleName: true }, 'SELF', TODAY);
    expect(r.ok && r.value.fullName).toBe('Juan Dela Cruz');
  });
});

describe('validateKycApplication', () => {
  const complete = () => ({
    personalInfo: { firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz', dateOfBirth: '1990-05-15', placeOfBirth: 'Tacloban', gender: 'Male', civilStatus: 'Married', nationality: 'Filipino' },
    address: { current: { regionCode: '08', cityCode: '083747', barangayCode: '083747018', street: 'Rizal St', postalCode: '6500' }, isPermanentSameAsCurrent: true },
    contactInfo: { mobileNumber: '09171234567', email: 'juan@example.com' },
    employment: { employmentStatus: 'Self-Employed', businessName: 'JDC Store', monthlyIncome: 25000, monthlyExpenses: 12000, sourceOfIncome: 'Business' },
    governmentId: { idType: 'UMID', idNumber: '0111-2345678-9', nameOnId: 'JUAN SANTOS DELA CRUZ' },
    declarations: { truthfulInformation: true, documentOwnership: true, privacyNotice: true },
  });

  it('accepts a complete application', () => {
    expect(validateKycApplication(complete(), TODAY)).toEqual([]);
  });

  it('flags missing consent, a bad ID number and an expired ID, and points to the first step', () => {
    const p = complete();
    p.declarations.privacyNotice = false;
    (p.governmentId as any).idNumber = '12';
    (p.governmentId as any).expirationDate = '2020-01-01';
    const issues = validateKycApplication(p, TODAY);
    expect(issues.map((i) => i.field)).toEqual(
      expect.arrayContaining(['declarations.privacyNotice', 'governmentId.idNumber', 'governmentId.expirationDate']),
    );
    expect(firstIssueStep(issues)).toBe('ID_UPLOAD');
  });

  it('requires the permanent address only when it differs', () => {
    const p = complete();
    (p.address as any).isPermanentSameAsCurrent = false;
    expect(validateKycApplication(p, TODAY).some((i) => i.field === 'address.permanent')).toBe(true);
  });

  it('requires an employer for employed members', () => {
    const p = complete();
    p.employment = { ...p.employment, employmentStatus: 'Employed', businessName: '' } as any;
    expect(validateKycApplication(p, TODAY).some((i) => i.field === 'employment.employerName')).toBe(true);
  });
});
