/**
 * The member's KYC application form, shared by the web portal and the mobile
 * app: its fields, how it is prefilled from what the server already holds,
 * the exact payload sent to POST /api/client/kyc/submit (and save-draft), and
 * per-step checks that are the server's own (validateKycApplication).
 */
import { findIdType, validateKycApplication, type KycApplicationPayload, type KycIssue, type KycStep } from '../kyc-core';
import type { KycApplicationView, KycMemberPrefillView } from './contracts';

export interface KycFormState {
  firstName: string;
  middleName: string;
  hasNoMiddleName: boolean;
  lastName: string;
  suffix: string;
  dateOfBirth: string;
  placeOfBirth: string;
  gender: string;
  civilStatus: string;
  nationality: string;
  citizenship: string;

  currentRegionCode: string;
  currentRegionName: string;
  currentProvinceCode: string;
  currentProvinceName: string;
  currentCityCode: string;
  currentCityName: string;
  currentBarangayCode: string;
  currentBarangayName: string;
  currentPostalCode: string;
  currentHouseNumber: string;
  currentStreet: string;
  currentSubdivision: string;
  currentLandmark: string;
  currentAdditionalDetails: string;

  isPermanentSameAsCurrent: boolean;
  permRegionCode: string;
  permRegionName: string;
  permProvinceCode: string;
  permProvinceName: string;
  permCityCode: string;
  permCityName: string;
  permBarangayCode: string;
  permBarangayName: string;
  permPostalCode: string;
  permHouseNumber: string;
  permStreet: string;
  permSubdivision: string;
  permLandmark: string;
  permAdditionalDetails: string;

  mobileNumber: string;
  email: string;
  alternativeMobile: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;

  employmentStatus: string;
  otherStatusExplanation: string;
  employerName: string;
  jobPosition: string;
  employmentType: string;
  yearsOfEmployment: number;
  employerAddress: string;
  businessName: string;
  natureOfBusiness: string;
  yearsInBusiness: number;
  businessAddress: string;
  /** Decimal pesos as typed ("25000" or "25000.50"); checked by parseMonthlyAmount. */
  monthlyIncome: string;
  monthlyExpenses: string;
  sourceOfIncome: string;
  sourceOfFunds: string;

  idType: string;
  idNumber: string;
  nameOnId: string;
  idDateOfBirth: string;
  idIssueDate: string;
  idExpiryDate: string;

  truthfulInformation: boolean;
  documentOwnership: boolean;
  authorizedReview: boolean;
  privacyNotice: boolean;
  /** Consent to use the selfie (biometric data) to check it against the ID photo. */
  biometricConsent: boolean;
  penaltyAcknowledgment: boolean;
}

export const EMPTY_KYC_FORM: KycFormState = {
  firstName: '',
  middleName: '',
  hasNoMiddleName: false,
  lastName: '',
  suffix: '',
  dateOfBirth: '',
  placeOfBirth: '',
  gender: '',
  civilStatus: '',
  nationality: 'Filipino',
  citizenship: 'Filipino',

  currentRegionCode: '',
  currentRegionName: '',
  currentProvinceCode: '',
  currentProvinceName: '',
  currentCityCode: '',
  currentCityName: '',
  currentBarangayCode: '',
  currentBarangayName: '',
  currentPostalCode: '',
  currentHouseNumber: '',
  currentStreet: '',
  currentSubdivision: '',
  currentLandmark: '',
  currentAdditionalDetails: '',

  isPermanentSameAsCurrent: true,
  permRegionCode: '',
  permRegionName: '',
  permProvinceCode: '',
  permProvinceName: '',
  permCityCode: '',
  permCityName: '',
  permBarangayCode: '',
  permBarangayName: '',
  permPostalCode: '',
  permHouseNumber: '',
  permStreet: '',
  permSubdivision: '',
  permLandmark: '',
  permAdditionalDetails: '',

  mobileNumber: '',
  email: '',
  alternativeMobile: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',

  employmentStatus: '',
  otherStatusExplanation: '',
  employerName: '',
  jobPosition: '',
  employmentType: '',
  yearsOfEmployment: 0,
  employerAddress: '',
  businessName: '',
  natureOfBusiness: '',
  yearsInBusiness: 0,
  businessAddress: '',
  monthlyIncome: '',
  monthlyExpenses: '',
  sourceOfIncome: '',
  sourceOfFunds: 'Employment',

  idType: 'PHILSYS_ID',
  idNumber: '',
  nameOnId: '',
  idDateOfBirth: '',
  idIssueDate: '',
  idExpiryDate: '',

  truthfulInformation: false,
  documentOwnership: false,
  authorizedReview: false,
  privacyNotice: false,
  biometricConsent: false,
  penaltyAcknowledgment: false,
};

type Section = Record<string, unknown> | null | undefined;

const text = (s: Section, k: string): string => {
  const v = s?.[k];
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
};
const num = (s: Section, k: string): number => {
  const v = Number(s?.[k]);
  return Number.isFinite(v) && v >= 0 ? v : 0;
};
const flag = (s: Section, k: string): boolean => s?.[k] === true;
/** A declared monthly amount, as the text the member edits ("" when none). */
const amount = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(v) : '';
};
const nested = (s: Section, k: string): Section => {
  const v = s?.[k];
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
};

/**
 * The form as the member left it: their saved application first, then what
 * the member record already holds (including the PSGC codes from registration).
 */
export function kycFormFrom(status: { member: KycMemberPrefillView; submission: KycApplicationView }): KycFormState {
  const m = status.member;
  const s = status.submission;
  const pi = s.personalInfo;
  const addr = s.address;
  const cur = nested(addr, 'current');
  const perm = nested(addr, 'permanent');
  const ci = s.contactInfo;
  const emp = s.employment;
  const gid = s.governmentId;
  const dec = s.declarations;
  const or = (...vals: (string | null | undefined)[]) => vals.find((v) => typeof v === 'string' && v.trim() !== '') ?? '';
  const fullName = [m.firstName, m.hasNoMiddleName ? null : m.middleName, m.lastName, m.suffix].filter(Boolean).join(' ');

  return {
    firstName: or(text(pi, 'firstName'), m.firstName),
    middleName: or(text(pi, 'middleName'), m.middleName),
    hasNoMiddleName: pi ? flag(pi, 'hasNoMiddleName') : Boolean(m.hasNoMiddleName),
    lastName: or(text(pi, 'lastName'), m.lastName),
    suffix: or(text(pi, 'suffix'), m.suffix),
    dateOfBirth: or(text(pi, 'dateOfBirth'), m.dateOfBirth),
    placeOfBirth: text(pi, 'placeOfBirth'),
    gender: or(text(pi, 'gender'), m.gender),
    civilStatus: or(text(pi, 'civilStatus'), m.civilStatus),
    nationality: or(text(pi, 'nationality'), 'Filipino'),
    citizenship: or(text(pi, 'citizenship'), 'Filipino'),

    currentRegionCode: or(text(cur, 'regionCode'), m.regionCode),
    currentRegionName: or(text(cur, 'region'), m.region),
    currentProvinceCode: or(text(cur, 'provinceCode'), m.provinceCode),
    currentProvinceName: or(text(cur, 'province'), m.province),
    currentCityCode: or(text(cur, 'cityCode'), m.cityCode),
    currentCityName: or(text(cur, 'city'), m.city),
    currentBarangayCode: or(text(cur, 'barangayCode'), m.barangayCode),
    currentBarangayName: or(text(cur, 'barangay'), m.barangay),
    currentPostalCode: or(text(cur, 'postalCode'), m.postalCode),
    currentHouseNumber: text(cur, 'houseNumber'),
    currentStreet: or(text(cur, 'street'), m.street),
    currentSubdivision: text(cur, 'subdivision'),
    currentLandmark: text(cur, 'landmark'),
    currentAdditionalDetails: text(cur, 'additionalDetails'),

    isPermanentSameAsCurrent: addr?.isPermanentSameAsCurrent !== false,
    permRegionCode: text(perm, 'regionCode'),
    permRegionName: text(perm, 'region'),
    permProvinceCode: text(perm, 'provinceCode'),
    permProvinceName: text(perm, 'province'),
    permCityCode: text(perm, 'cityCode'),
    permCityName: text(perm, 'city'),
    permBarangayCode: text(perm, 'barangayCode'),
    permBarangayName: text(perm, 'barangay'),
    permPostalCode: text(perm, 'postalCode'),
    permHouseNumber: text(perm, 'houseNumber'),
    permStreet: text(perm, 'street'),
    permSubdivision: text(perm, 'subdivision'),
    permLandmark: text(perm, 'landmark'),
    permAdditionalDetails: text(perm, 'additionalDetails'),

    mobileNumber: or(text(ci, 'mobileNumber'), m.phone),
    email: or(text(ci, 'email'), m.email),
    alternativeMobile: text(ci, 'alternativeMobile'),
    emergencyContactName: text(ci, 'emergencyContactName'),
    emergencyContactRelationship: text(ci, 'emergencyContactRelationship'),

    employmentStatus: or(text(emp, 'employmentStatus'), m.employmentStatus),
    otherStatusExplanation: text(emp, 'otherStatusExplanation'),
    employerName: or(text(emp, 'employerName'), m.employerOrBusiness),
    jobPosition: or(text(emp, 'jobPosition'), m.occupation),
    employmentType: text(emp, 'employmentType'),
    yearsOfEmployment: num(emp, 'yearsOfEmployment'),
    employerAddress: text(emp, 'employerAddress'),
    businessName: or(text(emp, 'businessName'), m.employerOrBusiness),
    natureOfBusiness: or(text(emp, 'natureOfBusiness'), m.occupation),
    yearsInBusiness: num(emp, 'yearsInBusiness'),
    businessAddress: text(emp, 'businessAddress'),
    monthlyIncome: amount(emp?.monthlyIncome) || amount(m.monthlyIncome),
    monthlyExpenses: amount(emp?.monthlyExpenses) || amount(m.monthlyExpenses),
    sourceOfIncome: or(text(emp, 'sourceOfIncome'), m.sourceOfIncome),
    sourceOfFunds: or(text(emp, 'sourceOfFunds'), 'Employment'),

    idType: or(text(gid, 'idType'), m.idType, 'PHILSYS_ID'),
    idNumber: or(text(gid, 'idNumber'), m.idNumber),
    nameOnId: or(text(gid, 'nameOnId'), fullName),
    idDateOfBirth: or(text(gid, 'dateOfBirth'), text(pi, 'dateOfBirth'), m.dateOfBirth),
    idIssueDate: text(gid, 'issueDate'),
    idExpiryDate: text(gid, 'expirationDate'),

    truthfulInformation: flag(dec, 'truthfulInformation'),
    documentOwnership: flag(dec, 'documentOwnership'),
    authorizedReview: flag(dec, 'authorizedReview'),
    privacyNotice: flag(dec, 'privacyNotice'),
    biometricConsent: flag(dec, 'biometricConsent'),
    penaltyAcknowledgment: flag(dec, 'penaltyAcknowledgment'),
  };
}

/** The payload POST /api/client/kyc/submit and /kyc/save-draft expect. */
export function buildKycApplication(f: KycFormState): KycApplicationPayload {
  const address = (p: 'current' | 'perm') => ({
    region: f[`${p}RegionName`],
    regionCode: f[`${p}RegionCode`],
    province: f[`${p}ProvinceName`],
    provinceCode: f[`${p}ProvinceCode`],
    city: f[`${p}CityName`],
    cityCode: f[`${p}CityCode`],
    barangay: f[`${p}BarangayName`],
    barangayCode: f[`${p}BarangayCode`],
    postalCode: f[`${p}PostalCode`].trim(),
    houseNumber: f[`${p}HouseNumber`].trim(),
    street: f[`${p}Street`].trim(),
    subdivision: f[`${p}Subdivision`].trim(),
    landmark: f[`${p}Landmark`].trim(),
    additionalDetails: f[`${p}AdditionalDetails`].trim(),
  });
  return {
    personalInfo: {
      firstName: f.firstName.trim(),
      middleName: !f.hasNoMiddleName ? f.middleName.trim() : '',
      hasNoMiddleName: f.hasNoMiddleName,
      lastName: f.lastName.trim(),
      suffix: f.suffix.trim(),
      dateOfBirth: f.dateOfBirth.trim(),
      placeOfBirth: f.placeOfBirth.trim(),
      gender: f.gender,
      civilStatus: f.civilStatus,
      nationality: f.nationality.trim(),
      citizenship: f.citizenship.trim(),
    },
    address: {
      current: address('current'),
      isPermanentSameAsCurrent: f.isPermanentSameAsCurrent,
      permanent: f.isPermanentSameAsCurrent ? null : address('perm'),
    },
    contactInfo: {
      mobileNumber: f.mobileNumber.trim(),
      email: f.email.trim(),
      alternativeMobile: f.alternativeMobile.trim(),
      emergencyContactName: f.emergencyContactName.trim(),
      emergencyContactRelationship: f.emergencyContactRelationship.trim(),
    },
    employment: {
      employmentStatus: f.employmentStatus,
      otherStatusExplanation: f.otherStatusExplanation.trim(),
      employerName: f.employerName.trim(),
      jobPosition: f.jobPosition.trim(),
      employmentType: f.employmentType,
      yearsOfEmployment: f.yearsOfEmployment,
      employerAddress: f.employerAddress.trim(),
      businessName: f.businessName.trim(),
      natureOfBusiness: f.natureOfBusiness.trim(),
      yearsInBusiness: f.yearsInBusiness,
      businessAddress: f.businessAddress.trim(),
      // Sent as typed; the server parses it exactly (parseMonthlyAmount).
      monthlyIncome: f.monthlyIncome.replace(/,/g, '').trim(),
      monthlyExpenses: f.monthlyExpenses.replace(/,/g, '').trim(),
      sourceOfIncome: f.sourceOfIncome,
      sourceOfFunds: f.sourceOfFunds,
    },
    governmentId: {
      idType: f.idType,
      idTypeName: findIdType(f.idType)?.label ?? f.idType,
      idNumber: f.idNumber.trim(),
      nameOnId: f.nameOnId.trim(),
      dateOfBirth: f.idDateOfBirth || null,
      issueDate: f.idIssueDate || null,
      expirationDate: f.idExpiryDate || null,
    },
    declarations: {
      truthfulInformation: f.truthfulInformation,
      documentOwnership: f.documentOwnership,
      authorizedReview: f.authorizedReview,
      privacyNotice: f.privacyNotice,
      biometricConsent: f.biometricConsent,
      penaltyAcknowledgment: f.penaltyAcknowledgment,
    },
  };
}

/** Payload field -> form field, so a server issue lands on the right input. */
const ISSUE_FIELD: Readonly<Record<string, keyof KycFormState>> = {
  'personalInfo.firstName': 'firstName',
  'personalInfo.middleName': 'middleName',
  'personalInfo.lastName': 'lastName',
  'personalInfo.dateOfBirth': 'dateOfBirth',
  'personalInfo.placeOfBirth': 'placeOfBirth',
  'personalInfo.gender': 'gender',
  'personalInfo.civilStatus': 'civilStatus',
  'personalInfo.nationality': 'nationality',
  'address.current.regionCode': 'currentRegionCode',
  'address.current.cityCode': 'currentCityCode',
  'address.current.barangayCode': 'currentBarangayCode',
  'address.current.street': 'currentStreet',
  'address.current.postalCode': 'currentPostalCode',
  'address.permanent.regionCode': 'permRegionCode',
  'address.permanent.cityCode': 'permCityCode',
  'address.permanent.barangayCode': 'permBarangayCode',
  'address.permanent.street': 'permStreet',
  'address.permanent.postalCode': 'permPostalCode',
  'contactInfo.mobileNumber': 'mobileNumber',
  'contactInfo.email': 'email',
  'employment.employmentStatus': 'employmentStatus',
  'employment.otherStatusExplanation': 'otherStatusExplanation',
  'employment.employerName': 'employerName',
  'employment.businessName': 'businessName',
  'employment.monthlyIncome': 'monthlyIncome',
  'employment.monthlyExpenses': 'monthlyExpenses',
  'employment.sourceOfIncome': 'sourceOfIncome',
  'governmentId.idNumber': 'idNumber',
  'governmentId.nameOnId': 'nameOnId',
  'governmentId.expirationDate': 'idExpiryDate',
  'declarations.truthfulInformation': 'truthfulInformation',
  'declarations.documentOwnership': 'documentOwnership',
  'declarations.privacyNotice': 'privacyNotice',
  'declarations.biometricConsent': 'biometricConsent',
};

/** The server's checks for the given steps, as messages per form field. */
export function kycFormErrors(f: KycFormState, steps: readonly KycStep[], today: string): Partial<Record<keyof KycFormState, string>> {
  const out: Partial<Record<keyof KycFormState, string>> = {};
  const issues: KycIssue[] = validateKycApplication(buildKycApplication(f), today).filter((i) => steps.includes(i.step));
  for (const i of issues) {
    const key = ISSUE_FIELD[i.field];
    if (key && !out[key]) out[key] = i.message;
  }
  return out;
}

/** Whether the given steps pass the server's checks. */
export function kycStepsValid(f: KycFormState, steps: readonly KycStep[], today: string): boolean {
  return validateKycApplication(buildKycApplication(f), today).every((i) => !steps.includes(i.step));
}
