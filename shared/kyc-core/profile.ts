import { CIVIL_STATUSES } from './config';
import { normalizePhilippineMobile } from './validation';

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

export function validateProfileUpdate(dto: Record<string, unknown>): { ok: boolean; value: ProfileUpdate; errors: Record<string, string>; locked: string[] } {
  const errors: Record<string, string> = {};
  const value: ProfileUpdate = {};
  const locked = PROFILE_LOCKED_FIELDS.filter((f) => dto[f] !== undefined);
  const text = (k: 'address' | 'barangay' | 'cityMunicipality' | 'province' | 'occupation' | 'employer', max: number) => {
    if (dto[k] === undefined) return;
    const v = String(dto[k] ?? '').trim().replace(/\s+/g, ' ');
    if (v.length > max) errors[k] = `Keep this under ${max} characters.`;
    else value[k] = v;
  };
  if (dto.phone !== undefined) {
    const p = normalizePhilippineMobile(dto.phone);
    if (!p) errors.phone = 'Enter a valid Philippine mobile number, e.g. 0917 123 4567.';
    else value.phone = p;
  }
  text('address', 200);
  text('barangay', 100);
  text('cityMunicipality', 100);
  text('province', 100);
  text('occupation', 100);
  text('employer', 120);
  if (dto.civilStatus !== undefined) {
    const c = String(dto.civilStatus);
    if (!(CIVIL_STATUSES as readonly string[]).includes(c)) errors.civilStatus = 'Choose your civil status.';
    else value.civilStatus = c as ProfileUpdate['civilStatus'];
  }
  if (dto.monthlyIncome !== undefined && dto.monthlyIncome !== '') {
    const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(String(dto.monthlyIncome).replace(/,/g, '').trim());
    if (!m) errors.monthlyIncome = 'Enter the amount in pesos, e.g. 25000 or 25000.50.';
    else value.monthlyIncome = `${Number(m[1])}.${(m[2] ?? '').padEnd(2, '0')}`;
  }
  return { ok: Object.keys(errors).length === 0 && locked.length === 0, value, errors, locked };
}
