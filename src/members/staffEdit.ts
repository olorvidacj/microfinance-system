import crypto from 'crypto';
import { and, eq, type SQL } from 'drizzle-orm';
import * as schema from '../db/schema';
import { HttpError, type AppDb } from '../kyc/errors';
import { getServerSupabase } from '../db/supabaseServer';
import {
  MEMBER_IDENTITY_FIELDS,
  STAFF_MEMBER_FIELDS,
  identityLockedByKyc,
  kycStatusLabel,
  normaliseKycStatus,
  normalizeEmail,
  phoneKey,
  validateStaffMemberEdit,
  type StaffMemberEdit,
  type StaffMemberField,
} from '../../shared/kyc-core';

/**
 * Branch staff edit a member's record (PUT /api/branch/clients/:id) under the
 * same rules as the member's own edits (shared/kyc-core/profile.ts). The phone
 * number and email are sign-in identifiers: they must be valid and unused by
 * any other account or member, and the member's login changes with them, in
 * the same transaction (and in Supabase Auth when sign-in goes through it).
 */

export interface StaffEditor {
  userId: string;
  name: string;
  role: string;
  branchId: string | null;
  viewAll: boolean;
}

type Borrower = typeof schema.borrowers.$inferSelect;

/** The fields in the request whose value differs from what is stored, as sent. */
function changedFields(dto: Record<string, unknown>, b: Borrower): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const same: Record<StaffMemberField, (raw: unknown) => boolean> = {
    fullName: (r) => String(r ?? '').trim().replace(/\s+/g, ' ') === b.fullName,
    phone: (r) => phoneKey(r) !== null && phoneKey(r) === phoneKey(b.phone),
    email: (r) => normalizeEmail(r) !== null && normalizeEmail(r) === normalizeEmail(b.email),
    address: (r) => String(r ?? '').trim() === (b.address ?? '').trim(),
    dateOfBirth: (r) => String(r ?? '').trim() === b.dateOfBirth,
    gender: (r) => String(r ?? '') === b.gender,
    civilStatus: (r) => String(r ?? '') === b.civilStatus,
    employmentStatus: (r) => String(r ?? '') === b.employmentStatus,
    employerOrBusiness: (r) => String(r ?? '').trim() === (b.employerOrBusiness ?? '').trim(),
    occupation: (r) => String(r ?? '').trim() === (b.occupation ?? '').trim(),
    monthlyIncome: (r) => String(r ?? '').trim() !== '' && Number(String(r).replace(/,/g, '')) === Number(b.monthlyIncome),
    monthlyExpenses: (r) => String(r ?? '').trim() !== '' && Number(String(r).replace(/,/g, '')) === Number(b.monthlyExpenses),
    notes: (r) => String(r ?? '').trim() === (b.notes ?? '').trim(),
  };
  for (const k of STAFF_MEMBER_FIELDS) if (dto[k] !== undefined && !same[k](dto[k])) out[k] = dto[k];
  return out;
}

const fieldError = (status: number, message: string, code: string, fields: Record<string, string>) => new HttpError(status, message, code, { fields });

export async function updateMemberByStaff(
  db: AppDb,
  editor: StaffEditor,
  borrowerId: string,
  dto: Record<string, unknown>,
  today: string,
): Promise<{ changed: StaffMemberField[] }> {
  return db.transaction(async (tx) => {
    const scope: SQL | undefined = editor.viewAll || !editor.branchId ? undefined : eq(schema.borrowers.branchId, editor.branchId);
    const [b] = await tx.select().from(schema.borrowers).where(and(eq(schema.borrowers.id, borrowerId), scope)).limit(1);
    if (!b) throw new HttpError(404, 'Client not found in this branch.', 'NOT_FOUND');

    const v = validateStaffMemberEdit(changedFields(dto, b), today);
    if (!v.ok) throw fieldError(400, 'Check the highlighted fields.', 'INVALID_CLIENT', v.errors);
    const u: StaffMemberEdit = v.value;
    const changed = Object.keys(u) as StaffMemberField[];
    if (!changed.length) return { changed };

    const identity = changed.filter((k) => MEMBER_IDENTITY_FIELDS.includes(k));
    const kyc = normaliseKycStatus(b.kycStatus);
    if (identity.length && identityLockedByKyc(kyc)) {
      throw fieldError(
        409,
        `The member's KYC is ${kycStatusLabel(kyc).toLowerCase()}, so ${identity.join(', ')} cannot be changed here. Ask the member to update their KYC application instead.`,
        'IDENTITY_LOCKED',
        Object.fromEntries(identity.map((k) => [k, 'Fixed by the member’s KYC.'])),
      );
    }

    // The member's own login, if they have one.
    const [login] = await tx.select().from(schema.users).where(eq(schema.users.borrowerId, b.id)).limit(1);

    if (u.phone) {
      const key = phoneKey(u.phone);
      const users = await tx.select({ id: schema.users.id, phone: schema.users.phone }).from(schema.users);
      const members = await tx.select({ id: schema.borrowers.id, phone: schema.borrowers.phone }).from(schema.borrowers);
      if (users.some((o) => o.id !== login?.id && o.phone && phoneKey(o.phone) === key) || members.some((o) => o.id !== b.id && o.phone && phoneKey(o.phone) === key)) {
        throw fieldError(409, 'This mobile number is already used by another account.', 'PHONE_TAKEN', { phone: 'Already used by another account or member.' });
      }
    }
    if (u.email) {
      const users = await tx.select({ id: schema.users.id, email: schema.users.email }).from(schema.users);
      const members = await tx.select({ id: schema.borrowers.id, email: schema.borrowers.email }).from(schema.borrowers);
      if (users.some((o) => o.id !== login?.id && normalizeEmail(o.email) === u.email) || members.some((o) => o.id !== b.id && normalizeEmail(o.email) === u.email)) {
        throw fieldError(409, 'This email is already used by another account.', 'EMAIL_TAKEN', { email: 'Already used by another account or member.' });
      }
    }

    await tx
      .update(schema.borrowers)
      .set({
        ...(u.fullName !== undefined ? { fullName: u.fullName } : {}),
        ...(u.phone !== undefined ? { phone: u.phone } : {}),
        ...(u.email !== undefined ? { email: u.email } : {}),
        ...(u.address !== undefined ? { address: u.address } : {}),
        ...(u.dateOfBirth !== undefined ? { dateOfBirth: u.dateOfBirth } : {}),
        ...(u.gender !== undefined ? { gender: u.gender } : {}),
        ...(u.civilStatus !== undefined ? { civilStatus: u.civilStatus } : {}),
        ...(u.employmentStatus !== undefined ? { employmentStatus: u.employmentStatus } : {}),
        ...(u.employerOrBusiness !== undefined ? { employerOrBusiness: u.employerOrBusiness } : {}),
        ...(u.occupation !== undefined ? { occupation: u.occupation } : {}),
        // Validated exact decimals; the columns are still double precision (AUDIT 4.2).
        ...(u.monthlyIncome !== undefined ? { monthlyIncome: Number(u.monthlyIncome) } : {}),
        ...(u.monthlyExpenses !== undefined ? { monthlyExpenses: Number(u.monthlyExpenses) } : {}),
        ...(u.notes !== undefined ? { notes: u.notes || null } : {}),
      })
      .where(eq(schema.borrowers.id, b.id));

    if (login && (u.phone || u.email || u.fullName)) {
      await tx
        .update(schema.users)
        .set({
          ...(u.phone ? { phone: u.phone } : {}),
          ...(u.email ? { email: u.email } : {}),
          ...(u.fullName ? { fullName: u.fullName } : {}),
        })
        .where(eq(schema.users.id, login.id));
    }

    const trail: string[] = [];
    if (u.phone) trail.push(`phone ${b.phone || '(none)'} → ${u.phone}`);
    if (u.email) trail.push(`email ${b.email || '(none)'} → ${u.email}`);
    const others = changed.filter((k) => k !== 'phone' && k !== 'email');
    if (others.length) trail.push(`also ${others.join(', ')}`);
    await tx.insert(schema.auditLogs).values({
      id: `aud-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      action: 'CLIENT_UPDATED',
      details: `${editor.name} updated member ${b.borrowerNumber}: ${trail.join('; ')}.`,
      performedBy: editor.userId,
      branchId: b.branchId ?? 'all',
      type: 'BORROWER',
      userName: editor.name,
      userRole: editor.role,
      targetType: 'Borrower',
      targetId: b.id,
    });

    // Sign-in by email goes through Supabase Auth when it is configured: its
    // record changes with ours, or the new email could not sign in. Last, so
    // a refusal there rolls the whole change back.
    const supabase = getServerSupabase();
    if (login && u.email && supabase) {
      const { error } = await supabase.auth.admin.updateUserById(login.id, { email: u.email, email_confirm: true });
      // Logins created before Supabase Auth was connected exist only locally.
      if (error && !/not.?found|user_not_found|invalid.*uuid/i.test(`${error.message} ${(error as { code?: string }).code ?? ''}`)) {
        throw new HttpError(502, 'The sign-in email could not be changed right now. Please try again.', 'AUTH_PROVIDER');
      }
    }
    return { changed };
  });
}
