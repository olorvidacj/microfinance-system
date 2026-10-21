import {
  AGE_LIMITS,
  CIVIL_STATUSES,
  EMPLOYMENT_STATUSES,
  GENDERS,
  MAX_DECLARED_MONTHLY_AMOUNT,
  findIdType,
} from './config';

export type FieldErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// Primitive normalisers
// ---------------------------------------------------------------------------

export function digitsOnly(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Normalises a Philippine mobile number (09xx…, +639xx…, 639xx…, 9xx…) to
 * "+63 9XX XXX XXXX". Returns null for anything else.
 */
export function normalizePhilippineMobile(raw: unknown): string | null {
  const d = digitsOnly(raw);
  let local: string | null = null;
  if (d.length === 10 && d.startsWith('9')) local = d;
  else if (d.length === 11 && d.startsWith('09')) local = d.slice(1);
  else if (d.length === 12 && d.startsWith('639')) local = d.slice(2);
  if (!local) return null;
  return `+63 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** The 10-digit subscriber number used for duplicate detection ("9171234567"). */
export function phoneKey(raw: unknown): string | null {
  const normalized = normalizePhilippineMobile(raw);
  return normalized ? digitsOnly(normalized).slice(-10) : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw ?? '').trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

/** Uppercase, letters and digits only: the form used for storage comparison and duplicate checks. */
export function normalizeIdNumber(raw: unknown): string {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validateIdNumber(idType: unknown, idNumber: unknown): string | null {
  const type = findIdType(String(idType ?? ''));
  if (!type) return 'Choose a valid government ID type.';
  const normalized = normalizeIdNumber(idNumber);
  if (!normalized) return 'Enter the ID number exactly as printed on the card.';
  if (!type.pattern.test(normalized)) {
    return `That does not look like a valid ${type.label} number (example: ${type.example}).`;
  }
  return null;
}

const NAME_RE = /^[\p{L}][\p{L}\p{M}' .-]*$/u;

export function validatePersonName(raw: unknown, label: string, required: boolean): string | null {
  const v = String(raw ?? '').trim();
  if (!v) return required ? `${label} is required.` : null;
  if (v.length > 80) return `${label} is too long.`;
  if (!NAME_RE.test(v)) return `${label} may only contain letters, spaces, hyphens, apostrophes and periods.`;
  return null;
}

export function composeFullName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  hasNoMiddleName?: boolean | null;
}): string {
  return [
    parts.firstName,
    parts.hasNoMiddleName ? null : parts.middleName,
    parts.lastName,
    parts.suffix,
  ]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Whole years between an ISO date of birth and `today` (both YYYY-MM-DD). */
export function ageOn(dateOfBirth: string, today: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!m || !t) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  let age = Number(t[1]) - y;
  if (Number(t[2]) < mo || (Number(t[2]) === mo && Number(t[3]) < d)) age -= 1;
  return age;
}

export function validateDateOfBirth(raw: unknown, today: string): string | null {
  const v = String(raw ?? '').trim();
  if (!v) return 'Date of birth is required.';
  const age = ageOn(v, today);
  if (age === null) return 'Enter a valid date of birth (YYYY-MM-DD).';
  if (age < AGE_LIMITS.min) return `Members must be at least ${AGE_LIMITS.min} years old.`;
  if (age > AGE_LIMITS.max) return 'Please check the date of birth.';
  return null;
}

/** A declared monthly amount: a non-negative number with at most two decimals. */
export function parseMonthlyAmount(raw: unknown, label: string): { value: number | null; error: string | null } {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { value: null, error: `${label} is required.` };
  }
  const text = String(raw).replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { value: null, error: `${label} must be an amount in pesos, e.g. 15000 or 15000.50.` };
  const value = Number(text);
  if (value > MAX_DECLARED_MONTHLY_AMOUNT) return { value: null, error: `${label} looks too large. Please check it.` };
  return { value, error: null };
}

function oneOf<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  const v = String(raw ?? '').trim();
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export type RegistrationChannel = 'SELF' | 'BRANCH';

export interface RegistrationAddressInput {
  street?: string;
  regionCode?: string;
  provinceCode?: string | null;
  cityCode?: string;
  barangayCode?: string;
  postalCode?: string;
}

export interface RegistrationInput {
  firstName?: string;
  middleName?: string;
  hasNoMiddleName?: boolean;
  lastName?: string;
  suffix?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  civilStatus?: string;
  address?: RegistrationAddressInput;
  employmentStatus?: string;
  occupation?: string;
  employerOrBusiness?: string;
  sourceOfIncome?: string;
  monthlyIncome?: number | string;
  monthlyExpenses?: number | string;
  idType?: string;
  idNumber?: string;
}

export interface NormalizedRegistration {
  firstName: string;
  middleName: string | null;
  hasNoMiddleName: boolean;
  lastName: string;
  suffix: string | null;
  fullName: string;
  email: string | null;
  phone: string;
  phoneKey: string;
  dateOfBirth: string;
  gender: string;
  civilStatus: string;
  address: Required<Omit<RegistrationAddressInput, 'provinceCode'>> & { provinceCode: string | null };
  employmentStatus: string;
  occupation: string;
  employerOrBusiness: string;
  sourceOfIncome: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  idType: string | null;
  idNumber: string | null;
  idNumberNormalized: string | null;
}

/** `value` is set exactly when `ok` is true; `errors` is empty exactly when `ok` is true. */
export interface ValidationResult<T> {
  ok: boolean;
  value: T | null;
  errors: FieldErrors;
}

/**
 * Validates a registration from either channel. Self-registration requires an
 * email (it is verified before the account exists); a branch may register a
 * member with no email, but must record a government ID it has seen.
 */
export function validateRegistration(
  input: RegistrationInput,
  channel: RegistrationChannel,
  today: string,
): ValidationResult<NormalizedRegistration> {
  const errors: FieldErrors = {};
  const set = (field: string, message: string | null) => {
    if (message) errors[field] = message;
  };

  const hasNoMiddleName = Boolean(input.hasNoMiddleName);
  set('firstName', validatePersonName(input.firstName, 'First name', true));
  set('lastName', validatePersonName(input.lastName, 'Last name', true));
  set('middleName', validatePersonName(input.middleName, 'Middle name', !hasNoMiddleName));
  if (input.suffix && String(input.suffix).trim().length > 10) errors.suffix = 'Suffix is too long.';

  const emailRaw = String(input.email ?? '').trim();
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !email) errors.email = 'Enter a valid email address.';
  if (!emailRaw && channel === 'SELF') errors.email = 'Email is required so we can verify your account.';

  const phone = normalizePhilippineMobile(input.phone);
  if (!phone) errors.phone = 'Enter a valid Philippine mobile number, e.g. 0917 123 4567.';

  set('dateOfBirth', validateDateOfBirth(input.dateOfBirth, today));
  const gender = oneOf(input.gender, GENDERS);
  if (!gender) errors.gender = 'Choose a sex.';
  const civilStatus = oneOf(input.civilStatus, CIVIL_STATUSES);
  if (!civilStatus) errors.civilStatus = 'Choose a civil status.';

  const a = input.address ?? {};
  const street = String(a.street ?? '').trim();
  if (!street) errors['address.street'] = 'House number and street are required.';
  if (!/^\d{2}$/.test(String(a.regionCode ?? ''))) errors['address.regionCode'] = 'Choose a region.';
  if (!/^\d{6}$/.test(String(a.cityCode ?? ''))) errors['address.cityCode'] = 'Choose a city or municipality.';
  if (!/^\d{9}$/.test(String(a.barangayCode ?? ''))) errors['address.barangayCode'] = 'Choose a barangay.';
  const provinceCode = a.provinceCode ? String(a.provinceCode) : null;
  if (provinceCode && !/^\d{4}$/.test(provinceCode)) errors['address.provinceCode'] = 'Choose a province.';
  const postalCode = String(a.postalCode ?? '').trim();
  if (!/^\d{4}$/.test(postalCode)) errors['address.postalCode'] = 'Enter the 4-digit ZIP code.';

  const employmentStatus = oneOf(input.employmentStatus, EMPLOYMENT_STATUSES);
  if (!employmentStatus) errors.employmentStatus = 'Choose an employment status.';
  const sourceOfIncome = String(input.sourceOfIncome ?? '').trim();
  if (!sourceOfIncome) errors.sourceOfIncome = 'Source of income is required.';
  const income = parseMonthlyAmount(input.monthlyIncome, 'Monthly income');
  set('monthlyIncome', income.error);
  const expenses = parseMonthlyAmount(input.monthlyExpenses, 'Monthly expenses');
  set('monthlyExpenses', expenses.error);

  const idNumberRaw = String(input.idNumber ?? '').trim();
  const idTypeRaw = String(input.idType ?? '').trim();
  if (idNumberRaw || idTypeRaw || channel === 'BRANCH') {
    set('idNumber', validateIdNumber(idTypeRaw, idNumberRaw));
  }

  if (Object.keys(errors).length > 0) return { ok: false, value: null, errors };

  const firstName = String(input.firstName).trim();
  const lastName = String(input.lastName).trim();
  const middleName = hasNoMiddleName ? null : String(input.middleName ?? '').trim() || null;
  const suffix = String(input.suffix ?? '').trim() || null;
  const idNumberNormalized = idNumberRaw ? normalizeIdNumber(idNumberRaw) : null;

  return {
    ok: true,
    errors: {},
    value: {
      firstName,
      middleName,
      hasNoMiddleName,
      lastName,
      suffix,
      fullName: composeFullName({ firstName, middleName, lastName, suffix, hasNoMiddleName }),
      email,
      phone: phone as string,
      phoneKey: digitsOnly(phone).slice(-10),
      dateOfBirth: String(input.dateOfBirth).trim(),
      gender: gender as string,
      civilStatus: civilStatus as string,
      address: {
        street,
        regionCode: String(a.regionCode),
        provinceCode,
        cityCode: String(a.cityCode),
        barangayCode: String(a.barangayCode),
        postalCode,
      },
      employmentStatus: employmentStatus as string,
      occupation: String(input.occupation ?? '').trim(),
      employerOrBusiness: String(input.employerOrBusiness ?? '').trim(),
      sourceOfIncome,
      monthlyIncome: income.value as number,
      monthlyExpenses: expenses.value as number,
      idType: idNumberNormalized ? idTypeRaw.toUpperCase() : null,
      idNumber: idNumberNormalized ? idNumberRaw : null,
      idNumberNormalized,
    },
  };
}

// ---------------------------------------------------------------------------
// KYC application
// ---------------------------------------------------------------------------

export type KycStep = 'PERSONAL_INFO' | 'ADDRESS' | 'CONTACT' | 'FINANCIAL' | 'ID_UPLOAD' | 'FACE_MATCH' | 'DOCUMENTS' | 'CONSENT';

export interface KycApplicationPayload {
  personalInfo?: Record<string, any> | null;
  address?: { current?: Record<string, any> | null; permanent?: Record<string, any> | null; isPermanentSameAsCurrent?: boolean } | null;
  contactInfo?: Record<string, any> | null;
  employment?: Record<string, any> | null;
  governmentId?: Record<string, any> | null;
  declarations?: Record<string, any> | null;
}

export interface KycIssue {
  step: KycStep;
  field: string;
  message: string;
}

function addressIssues(addr: Record<string, any> | null | undefined, label: string, field: string): KycIssue[] {
  if (!addr) return [{ step: 'ADDRESS', field, message: `${label} is required.` }];
  const out: KycIssue[] = [];
  if (!/^\d{2}$/.test(String(addr.regionCode ?? ''))) out.push({ step: 'ADDRESS', field: `${field}.regionCode`, message: `${label}: choose a region.` });
  if (!/^\d{6}$/.test(String(addr.cityCode ?? ''))) out.push({ step: 'ADDRESS', field: `${field}.cityCode`, message: `${label}: choose a city or municipality.` });
  if (!/^\d{9}$/.test(String(addr.barangayCode ?? ''))) out.push({ step: 'ADDRESS', field: `${field}.barangayCode`, message: `${label}: choose a barangay.` });
  if (!String(addr.houseNumber ?? '').trim() && !String(addr.street ?? '').trim()) {
    out.push({ step: 'ADDRESS', field: `${field}.street`, message: `${label}: house number or street is required.` });
  }
  if (!/^\d{4}$/.test(String(addr.postalCode ?? '').trim())) out.push({ step: 'ADDRESS', field: `${field}.postalCode`, message: `${label}: enter the 4-digit ZIP code.` });
  return out;
}

/**
 * Field-level checks for a KYC application. Document presence, image quality
 * and the automated ID/face results are checked by the server from its own
 * records, never from this payload.
 */
export function validateKycApplication(p: KycApplicationPayload, today: string): KycIssue[] {
  const issues: KycIssue[] = [];
  const push = (step: KycStep, field: string, message: string | null) => {
    if (message) issues.push({ step, field, message });
  };

  const pi = p.personalInfo;
  if (!pi) {
    push('PERSONAL_INFO', 'personalInfo', 'Personal information is required.');
  } else {
    push('PERSONAL_INFO', 'personalInfo.firstName', validatePersonName(pi.firstName, 'First name', true));
    push('PERSONAL_INFO', 'personalInfo.lastName', validatePersonName(pi.lastName, 'Last name', true));
    push('PERSONAL_INFO', 'personalInfo.middleName', validatePersonName(pi.middleName, 'Middle name', !pi.hasNoMiddleName));
    push('PERSONAL_INFO', 'personalInfo.dateOfBirth', validateDateOfBirth(pi.dateOfBirth, today));
    if (!String(pi.placeOfBirth ?? '').trim()) push('PERSONAL_INFO', 'personalInfo.placeOfBirth', 'Place of birth is required.');
    if (!oneOf(pi.gender, GENDERS)) push('PERSONAL_INFO', 'personalInfo.gender', 'Choose a sex.');
    if (!oneOf(pi.civilStatus, CIVIL_STATUSES)) push('PERSONAL_INFO', 'personalInfo.civilStatus', 'Choose a civil status.');
    if (!String(pi.nationality ?? '').trim()) push('PERSONAL_INFO', 'personalInfo.nationality', 'Nationality is required.');
  }

  issues.push(...addressIssues(p.address?.current, 'Current address', 'address.current'));
  if (p.address && p.address.isPermanentSameAsCurrent === false) {
    issues.push(...addressIssues(p.address.permanent, 'Permanent address', 'address.permanent'));
  }

  const ci = p.contactInfo;
  if (!ci || !normalizePhilippineMobile(ci.mobileNumber)) {
    push('CONTACT', 'contactInfo.mobileNumber', 'Enter a valid Philippine mobile number.');
  }
  if (ci?.email && !normalizeEmail(ci.email)) push('CONTACT', 'contactInfo.email', 'Enter a valid email address.');

  const em = p.employment;
  if (!em) {
    push('FINANCIAL', 'employment', 'Employment and income details are required.');
  } else {
    const status = oneOf(em.employmentStatus, EMPLOYMENT_STATUSES);
    if (!status) push('FINANCIAL', 'employment.employmentStatus', 'Choose an employment status.');
    if (status === 'Other' && !String(em.otherStatusExplanation ?? '').trim()) {
      push('FINANCIAL', 'employment.otherStatusExplanation', 'Explain your employment status.');
    }
    if (['Employed', 'Government Employee', 'Private Employee', 'OFW'].includes(String(status)) && !String(em.employerName ?? '').trim()) {
      push('FINANCIAL', 'employment.employerName', 'Employer name is required.');
    }
    if (['Self-Employed', 'Business Owner'].includes(String(status)) && !String(em.businessName ?? '').trim()) {
      push('FINANCIAL', 'employment.businessName', 'Business name is required.');
    }
    push('FINANCIAL', 'employment.monthlyIncome', parseMonthlyAmount(em.monthlyIncome, 'Monthly income').error);
    push('FINANCIAL', 'employment.monthlyExpenses', parseMonthlyAmount(em.monthlyExpenses, 'Monthly expenses').error);
    if (!String(em.sourceOfIncome ?? '').trim()) push('FINANCIAL', 'employment.sourceOfIncome', 'Source of income is required.');
  }

  const gid = p.governmentId;
  if (!gid) {
    push('ID_UPLOAD', 'governmentId', 'Government ID details are required.');
  } else {
    push('ID_UPLOAD', 'governmentId.idNumber', validateIdNumber(gid.idType, gid.idNumber));
    if (!String(gid.nameOnId ?? '').trim()) push('ID_UPLOAD', 'governmentId.nameOnId', 'Enter the name exactly as printed on the ID.');
    if (gid.expirationDate) {
      const exp = String(gid.expirationDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) push('ID_UPLOAD', 'governmentId.expirationDate', 'Enter the expiry date as YYYY-MM-DD.');
      else if (exp < today) push('ID_UPLOAD', 'governmentId.expirationDate', 'This ID has expired. Please use a valid ID.');
    }
  }

  const d = p.declarations;
  if (!d?.truthfulInformation) push('CONSENT', 'declarations.truthfulInformation', 'Confirm that your information is true and correct.');
  if (!d?.documentOwnership) push('CONSENT', 'declarations.documentOwnership', 'Confirm that the documents are yours.');
  if (!d?.privacyNotice) push('CONSENT', 'declarations.privacyNotice', 'Accept the Data Privacy Notice (RA 10173).');

  return issues;
}

const STEP_ORDER: readonly KycStep[] = ['ID_UPLOAD', 'FACE_MATCH', 'PERSONAL_INFO', 'ADDRESS', 'CONTACT', 'FINANCIAL', 'DOCUMENTS', 'CONSENT'];

/** The first step the member should return to, given a list of issues. */
export function firstIssueStep(issues: readonly KycIssue[]): KycStep | null {
  for (const step of STEP_ORDER) if (issues.some((i) => i.step === step)) return step;
  return null;
}
