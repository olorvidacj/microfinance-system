import { CIVIL_STATUSES, EMPLOYMENT_STATUSES, GENDERS } from './config';
import { normalizeEmail, normalizePhilippineMobile, validateDateOfBirth, validatePersonName } from './validation';
import { normaliseKycStatus } from './status';

/**
 * What a member may change about themselves in the portal or the app.
 *
 * Contact and work details are self-service. Identity details (name, date of
 * birth, gender) come from the verified KYC and change only through a KYC
 * update; the email is the login and changes only through the branch.
 */
export const PROFILE_EDITABLE_FIELDS = ['phone', 'address', 'barangay', 'cityMunicipality', 'province', 'civilStatus', 'occupation', 'employer', 'monthlyIncome'] as const;
export type ProfileEditableField = (typeof PROFILE_EDITABLE_FIELDS)[number];
export const PROFILE_LOCKED_FIELDS = ['fullName', 'firstName', 'lastName', 'middleName', 'dateOfBirth', 'gender', 'email'] as const;

export const PROFILE_LOCKED_MESSAGE = 'Your name, date of birth and gender come from your verified KYC, and your email is your sign-in. To change them, update your KYC or visit your branch.';

export interface ProfileUpdate {
  phone?: string;
  address?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  civilStatus?: (typeof CIVIL_STATUSES)[number];
  occupation?: string;
  employer?: string;
  /** Exact pesos as a decimal string, e.g. "25000.00". */
  monthlyIncome?: string;
}

// ---------------------------------------------------------------------------
// Field rules shared by the member's own edits and the branch's edits.
// ---------------------------------------------------------------------------

type Field = { value: string } | { error: string };

/** A Philippine mobile number in its stored form ("+63 917 123 4567"). */
export function checkMobile(raw: unknown): Field {
  const p = normalizePhilippineMobile(raw);
  return p ? { value: p } : { error: 'Enter a valid Philippine mobile number, e.g. 0917 123 4567.' };
}

/** Trimmed text with single spaces, at most `max` characters. */
export function checkText(raw: unknown, max: number): Field {
  const v = String(raw ?? '').trim().replace(/\s+/g, ' ');
  return v.length > max ? { error: `Keep this under ${max} characters.` } : { value: v };
}

/** Exact pesos as a decimal string ("25000.00"); never a float. */
export function checkPesoAmount(raw: unknown): Field {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(String(raw ?? '').replace(/,/g, '').trim());
  return m ? { value: `${Number(m[1])}.${(m[2] ?? '').padEnd(2, '0')}` } : { error: 'Enter the amount in pesos, e.g. 25000 or 25000.50.' };
}

function checkChoice(raw: unknown, choices: readonly string[], message: string): Field {
  const v = String(raw ?? '');
  return choices.includes(v) ? { value: v } : { error: message };
}

/** Puts a field's value or error where it belongs. */
function apply<K extends string>(key: K, field: Field, value: Partial<Record<K, string>>, errors: Record<string, string>) {
  if ('error' in field) errors[key] = field.error;
  else value[key] = field.value;
}

export function validateProfileUpdate(dto: Record<string, unknown>): { ok: boolean; value: ProfileUpdate; errors: Record<string, string>; locked: string[] } {
  const errors: Record<string, string> = {};
  const value: ProfileUpdate = {};
  const locked = PROFILE_LOCKED_FIELDS.filter((f) => dto[f] !== undefined);
  const plain = value as Partial<Record<keyof ProfileUpdate, string>>;
  if (dto.phone !== undefined) apply('phone', checkMobile(dto.phone), plain, errors);
  const limits = { address: 200, barangay: 100, cityMunicipality: 100, province: 100, occupation: 100, employer: 120 } as const;
  for (const k of Object.keys(limits) as (keyof typeof limits)[]) if (dto[k] !== undefined) apply(k, checkText(dto[k], limits[k]), plain, errors);
  if (dto.civilStatus !== undefined) apply('civilStatus', checkChoice(dto.civilStatus, CIVIL_STATUSES, 'Choose your civil status.'), plain, errors);
  if (dto.monthlyIncome !== undefined && dto.monthlyIncome !== '') apply('monthlyIncome', checkPesoAmount(dto.monthlyIncome), plain, errors);
  return { ok: Object.keys(errors).length === 0 && locked.length === 0, value, errors, locked };
}

// ---------------------------------------------------------------------------
// Branch staff editing a member's record
// ---------------------------------------------------------------------------

/** What branch staff may change on a member's record (PUT /api/branch/clients/:id). */
export const STAFF_MEMBER_FIELDS = [
  'fullName',
  'phone',
  'email',
  'address',
  'dateOfBirth',
  'gender',
  'civilStatus',
  'employmentStatus',
  'employerOrBusiness',
  'occupation',
  'monthlyIncome',
  'monthlyExpenses',
  'notes',
] as const;
export type StaffMemberField = (typeof STAFF_MEMBER_FIELDS)[number];

/** Identity fields, fixed by a submitted or approved KYC; the phone and email are also sign-in identifiers. */
export const MEMBER_IDENTITY_FIELDS: readonly StaffMemberField[] = ['fullName', 'dateOfBirth', 'phone', 'email'];

export type StaffMemberEdit = Partial<Record<StaffMemberField, string>>;

/**
 * The same rules as the member's own edits, for the fields staff send. Only the
 * fields given are checked (the server passes just the ones that change).
 * Money stays an exact decimal string; empty notes become "".
 */
export function validateStaffMemberEdit(dto: Record<string, unknown>, today: string): { ok: boolean; value: StaffMemberEdit; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const value: StaffMemberEdit = {};
  const has = (k: StaffMemberField) => dto[k] !== undefined;
  if (has('fullName')) {
    const name = String(dto.fullName ?? '').trim().replace(/\s+/g, ' ');
    const problem = validatePersonName(name, 'Full name', true);
    if (problem) errors.fullName = problem;
    else value.fullName = name;
  }
  if (has('phone')) apply('phone', checkMobile(dto.phone), value, errors);
  if (has('email')) {
    const email = normalizeEmail(dto.email);
    if (email) value.email = email;
    else errors.email = 'Enter a valid email address.';
  }
  if (has('address')) apply('address', checkText(dto.address, 200), value, errors);
  if (has('dateOfBirth')) {
    const dob = String(dto.dateOfBirth ?? '').trim();
    const problem = validateDateOfBirth(dob, today);
    if (problem) errors.dateOfBirth = problem;
    else value.dateOfBirth = dob;
  }
  if (has('gender')) apply('gender', checkChoice(dto.gender, GENDERS, 'Choose Male or Female.'), value, errors);
  if (has('civilStatus')) apply('civilStatus', checkChoice(dto.civilStatus, CIVIL_STATUSES, 'Choose a civil status.'), value, errors);
  if (has('employmentStatus')) apply('employmentStatus', checkChoice(dto.employmentStatus, EMPLOYMENT_STATUSES, 'Choose an employment status.'), value, errors);
  if (has('employerOrBusiness')) apply('employerOrBusiness', checkText(dto.employerOrBusiness, 120), value, errors);
  if (has('occupation')) apply('occupation', checkText(dto.occupation, 100), value, errors);
  if (has('monthlyIncome')) apply('monthlyIncome', checkPesoAmount(dto.monthlyIncome), value, errors);
  if (has('monthlyExpenses')) apply('monthlyExpenses', checkPesoAmount(dto.monthlyExpenses), value, errors);
  if (has('notes')) apply('notes', checkText(dto.notes, 1000), value, errors);
  return { ok: Object.keys(errors).length === 0, value, errors };
}

/** KYC statuses that fix the identity fields: the member changes them through a KYC update instead. */
export const IDENTITY_LOCKING_KYC_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SUSPENDED'] as const;

export function identityLockedByKyc(kycStatus: string | null | undefined): boolean {
  return (IDENTITY_LOCKING_KYC_STATUSES as readonly string[]).includes(normaliseKycStatus(kycStatus));
}
