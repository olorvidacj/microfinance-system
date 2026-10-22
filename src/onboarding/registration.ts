import crypto from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  manilaToday,
  type StaffActor,
} from '../kyc/service';
import {
  validateRegistration,
  type FieldErrors,
  type NormalizedRegistration,
  type RegistrationInput,
} from '../../shared/kyc-core';
import { HttpError, translateDbError, type AppDb } from '../kyc/errors';
import { consumeEmailToken } from './emailVerification';
import type { GeoResolver, ResolvedAddress } from './geography';

/** Creates the login credential: a local password hash, or a Supabase Auth user. */
export interface AccountProvider {
  create(input: { email: string; password: string; fullName: string; phone: string }): Promise<{ id: string; passwordHash: string }>;
  /** Undoes `create` when the database transaction fails. */
  remove(id: string): Promise<void>;
}

export interface RegisteredMember {
  user: { id: string; email: string; fullName: string; role: 'CLIENT'; staffRole: null; staffId: null; borrowerId: string; phone: string; avatar: null; isActive: true };
  borrowerId: string;
  borrowerNumber: string;
  /** True when the login was attached to a member the branch had already registered. */
  linkedExisting: boolean;
}

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function invalid(errors: FieldErrors): HttpError {
  const first = Object.values(errors)[0];
  return new HttpError(400, first ?? 'Please check the form.', 'VALIDATION', { errors });
}

async function nextMemberNumber(tx: AppDb, year: number): Promise<string> {
  const res: any = await tx.execute(sql`
    INSERT INTO id_sequences (name, year, last_value, updated_at)
    VALUES ('client_number', ${year}, 1, NOW())
    ON CONFLICT (name) DO UPDATE
      SET last_value = CASE WHEN id_sequences.year = EXCLUDED.year THEN id_sequences.last_value + 1 ELSE 1 END,
          year = EXCLUDED.year,
          updated_at = NOW()
    RETURNING last_value`);
  const value = Number(res.rows?.[0]?.last_value);
  if (!Number.isFinite(value)) throw new Error('Could not reserve a member number.');
  return `CLI-${year}-${String(value).padStart(4, '0')}`;
}

const emailKey = sql`lower(btrim(${schema.borrowers.email}))`;
const phoneKeySql = sql`right(regexp_replace(${schema.borrowers.phone}, '\\D', '', 'g'), 10)`;
const idKeySql = sql`upper(regexp_replace(${schema.borrowers.idNumber}, '[^A-Za-z0-9]', '', 'g'))`;

/** Field-level duplicate check against existing members (the unique indexes back this up under races). */
async function duplicateFields(tx: AppDb, v: NormalizedRegistration, excludeBorrowerId?: string): Promise<FieldErrors> {
  const errors: FieldErrors = {};
  const others = excludeBorrowerId ? sql`${schema.borrowers.id} <> ${excludeBorrowerId}` : sql`true`;
  const exists = async (cond: ReturnType<typeof sql>) =>
    (await tx.select({ id: schema.borrowers.id }).from(schema.borrowers).where(and(cond, others)).limit(1)).length > 0;
  if (v.email && (await exists(sql`${emailKey} = ${v.email}`))) errors.email = 'A member with this email address is already registered.';
  if (await exists(sql`${phoneKeySql} = ${v.phoneKey}`)) errors.phone = 'A member with this mobile number is already registered.';
  if (v.idNumberNormalized && (await exists(sql`${idKeySql} = ${v.idNumberNormalized}`))) {
    errors.idNumber = 'A member with this government ID number is already registered.';
  }
  return errors;
}

function memberRow(v: NormalizedRegistration, names: ResolvedAddress, extra: { id: string; borrowerNumber: string; branchId: string; today: string }) {
  const a = v.address;
  return {
    id: extra.id,
    borrowerNumber: extra.borrowerNumber,
    fullName: v.fullName,
    firstName: v.firstName,
    middleName: v.middleName,
    lastName: v.lastName,
    suffix: v.suffix,
    hasNoMiddleName: v.hasNoMiddleName,
    idType: v.idType,
    idNumber: v.idNumber ?? '',
    phone: v.phone,
    email: v.email ?? '',
    dateOfBirth: v.dateOfBirth,
    gender: v.gender,
    civilStatus: v.civilStatus,
    address: [a.street, `Brgy. ${names.barangay}`, names.city, names.province, a.postalCode].filter(Boolean).join(', '),
    region: names.region,
    regionCode: a.regionCode,
    province: names.province,
    provinceCode: a.provinceCode,
    cityMunicipality: names.city,
    cityCode: a.cityCode,
    barangay: names.barangay,
    barangayCode: a.barangayCode,
    postalCode: a.postalCode,
    branchId: extra.branchId,
    employmentStatus: v.employmentStatus,
    employerOrBusiness: v.employerOrBusiness,
    occupation: v.occupation,
    sourceOfIncome: v.sourceOfIncome,
    monthlyIncome: v.monthlyIncome,
    monthlyExpenses: v.monthlyExpenses,
    creditScore: 0,
    creditTier: 'PENDING',
    kycStatus: 'NOT_STARTED',
    memberStatus: 'Pending',
    membershipDate: extra.today,
    profileCompleted: false,
    avatar: '',
    joinedDate: extra.today,
    lastActivityDate: extra.today,
  };
}

async function assertBranch(tx: AppDb, branchId: string | null | undefined): Promise<string> {
  const id = String(branchId ?? '').trim();
  if (!id) throw invalid({ branchId: 'Choose a branch.' });
  const rows = await tx.select({ id: schema.branches.id }).from(schema.branches).where(eq(schema.branches.id, id)).limit(1);
  if (!rows[0]) throw invalid({ branchId: 'Choose a valid branch.' });
  return id;
}

async function recordRegistration(
  tx: AppDb,
  input: { borrowerId: string; borrowerNumber: string; fullName: string; branchId: string; action: string; actorId: string; actorName: string; actorRole: string; actorType: 'CLIENT' | 'STAFF'; channel: string; now: string },
) {
  const kycId = newId('kyc');
  await tx
    .insert(schema.kycSubmissions)
    .values({ id: kycId, borrowerId: input.borrowerId, status: 'NOT_STARTED', currentStep: 0, createdAt: input.now, updatedAt: input.now })
    .onConflictDoNothing();
  await tx.insert(schema.kycAuditLog).values({
    id: newId('kal'),
    borrowerId: input.borrowerId,
    kycSubmissionId: null,
    staffUserId: input.actorType === 'STAFF' ? input.actorId : null,
    staffName: input.actorType === 'STAFF' ? input.actorName : null,
    action: input.action,
    previousStatus: null,
    newStatus: 'NOT_STARTED',
    actorType: input.actorType,
    actorUserId: input.actorId,
    metadata: { channel: input.channel, borrowerNumber: input.borrowerNumber },
    createdAt: input.now,
  });
  await tx.insert(schema.auditLogs).values({
    id: newId('aud'),
    timestamp: input.now,
    action: input.action,
    details: `${input.fullName} (${input.borrowerNumber}) via ${input.channel === 'SELF' ? 'portal self-registration' : 'branch registration'}`,
    performedBy: input.actorId,
    branchId: input.branchId,
    type: 'REGISTRATION',
    userName: input.actorName,
    userRole: input.actorRole,
    targetType: 'Borrower',
    targetId: input.borrowerId,
  });
  await tx.insert(schema.branchNotifications).values({
    id: newId('ntf'),
    branchId: input.branchId,
    audience: 'STAFF',
    type: 'CLIENT_REGISTRATION',
    title: input.channel === 'SELF' ? 'New member registered online' : 'New member registered',
    message: `${input.fullName} (${input.borrowerNumber}) ${input.action === 'ACCOUNT_ACTIVATED' ? 'activated their portal account' : 'registered'}; KYC not started yet.`,
    relatedType: 'Borrower',
    relatedId: input.borrowerId,
    isRead: false,
    createdAt: input.now,
  });
}

export interface SelfRegistrationInput extends RegistrationInput {
  branchId?: string;
  password?: string;
  confirmPassword?: string;
  emailVerificationToken?: string;
}

/**
 * Portal self-registration. The email must have been verified with a code
 * first; the token is consumed in the same transaction that creates the login.
 * A member the branch already registered with this (now verified) email is
 * linked instead of duplicated, provided the date of birth matches.
 */
export async function registerSelf(
  db: AppDb,
  input: SelfRegistrationInput,
  deps: { accounts: AccountProvider; geo: GeoResolver; isPasswordStrong: (p: string) => boolean; passwordMessage: string },
): Promise<RegisteredMember> {
  const today = manilaToday();
  const v = validateRegistration(input, 'SELF', today);
  const errors: FieldErrors = { ...v.errors };
  const password = String(input.password ?? '');
  if (!deps.isPasswordStrong(password)) errors.password = deps.passwordMessage;
  else if (input.confirmPassword !== undefined && input.confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
  if (!v.ok || Object.keys(errors).length > 0) throw invalid(errors);
  const reg = v.value as NormalizedRegistration;
  const email = reg.email as string;

  const geo = deps.geo.resolve(reg.address);
  if (!geo.ok) throw invalid(geo.errors);

  const existingUser = await db.select({ id: schema.users.id }).from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`).limit(1);
  if (existingUser[0]) throw new HttpError(409, 'An account with this email already exists. Please sign in instead.', 'ACCOUNT_EXISTS', { errors: { email: 'Already registered.' } });

  const branchMember = (
    await db.select().from(schema.borrowers).where(sql`${emailKey} = ${email}`).limit(1)
  )[0];
  if (branchMember) {
    const linked = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.borrowerId, branchMember.id)).limit(1);
    if (linked[0]) throw new HttpError(409, 'This member already has a portal account. Please sign in instead.', 'ACCOUNT_EXISTS');
    if (branchMember.dateOfBirth !== reg.dateOfBirth) {
      throw new HttpError(409, 'A member with this email is registered at a branch, but the details do not match. Please contact your branch.', 'MEMBER_MISMATCH');
    }
  } else {
    await assertBranch(db, input.branchId);
    const dups = await duplicateFields(db, reg);
    if (Object.keys(dups).length > 0) {
      throw new HttpError(409, `${Object.values(dups)[0]} If this is you, please contact your branch.`, 'DUPLICATE', { errors: dups });
    }
  }

  const account = await deps.accounts.create({ email, password, fullName: reg.fullName, phone: reg.phone });
  const now = new Date();
  const nowIso = now.toISOString();
  try {
    return await db.transaction(async (raw) => {
      const tx = raw as unknown as AppDb;
      await consumeEmailToken(tx, email, input.emailVerificationToken, account.id, now);

      let borrowerId: string;
      let borrowerNumber: string;
      let branchId: string;
      let fullName = reg.fullName;
      if (branchMember) {
        borrowerId = branchMember.id;
        borrowerNumber = branchMember.borrowerNumber;
        branchId = branchMember.branchId;
        fullName = branchMember.fullName;
        await tx.update(schema.borrowers).set({ emailVerified: 1, emailVerifiedAt: nowIso }).where(eq(schema.borrowers.id, borrowerId));
      } else {
        branchId = await assertBranch(tx, input.branchId);
        borrowerId = newId('bor');
        borrowerNumber = await nextMemberNumber(tx, Number(today.slice(0, 4)));
        await tx.insert(schema.borrowers).values({
          ...memberRow(reg, geo.names, { id: borrowerId, borrowerNumber, branchId, today }),
          emailVerified: 1,
          emailVerifiedAt: nowIso,
          registrationChannel: 'SELF',
          registeredBy: account.id,
        });
      }

      await tx.insert(schema.users).values({
        id: account.id,
        email,
        passwordHash: account.passwordHash,
        fullName,
        role: 'CLIENT',
        borrowerId,
        phone: branchMember ? branchMember.phone : reg.phone,
        isActive: true,
      });

      await recordRegistration(tx, {
        borrowerId,
        borrowerNumber,
        fullName,
        branchId,
        action: branchMember ? 'ACCOUNT_ACTIVATED' : 'REGISTERED',
        actorId: account.id,
        actorName: fullName,
        actorRole: 'CLIENT',
        actorType: 'CLIENT',
        channel: 'SELF',
        now: nowIso,
      });

      return {
        user: { id: account.id, email, fullName, role: 'CLIENT' as const, staffRole: null, staffId: null, borrowerId, phone: branchMember ? branchMember.phone : reg.phone, avatar: null, isActive: true as const },
        borrowerId,
        borrowerNumber,
        linkedExisting: Boolean(branchMember),
      };
    });
  } catch (err) {
    await deps.accounts.remove(account.id).catch((e) => console.error('[registration] could not remove orphaned login', account.id, e));
    translateDbError(err);
  }
}

/** Staff-assisted registration at the branch. The member activates portal access later by self-registering with the same email. */
export async function registerByBranch(
  db: AppDb,
  actor: StaffActor,
  input: RegistrationInput & { branchId?: string },
  deps: { geo: GeoResolver },
): Promise<{ borrowerId: string; borrowerNumber: string }> {
  const today = manilaToday();
  const v = validateRegistration(input, 'BRANCH', today);
  if (!v.ok) throw invalid(v.errors);
  const reg = v.value as NormalizedRegistration;
  const geo = deps.geo.resolve(reg.address);
  if (!geo.ok) throw invalid(geo.errors);
  const nowIso = new Date().toISOString();

  try {
    return await db.transaction(async (raw) => {
      const tx = raw as unknown as AppDb;
      const branchId = await assertBranch(tx, actor.viewAll ? input.branchId || actor.branchId : actor.branchId);
      const dups = await duplicateFields(tx, reg);
      if (Object.keys(dups).length > 0) throw new HttpError(409, Object.values(dups)[0], 'DUPLICATE', { errors: dups });

      const borrowerId = newId('bor');
      const borrowerNumber = await nextMemberNumber(tx, Number(today.slice(0, 4)));
      await tx.insert(schema.borrowers).values({
        ...memberRow(reg, geo.names, { id: borrowerId, borrowerNumber, branchId, today }),
        emailVerified: 0,
        registrationChannel: 'BRANCH',
        registeredBy: actor.userId,
      });
      await recordRegistration(tx, {
        borrowerId,
        borrowerNumber,
        fullName: reg.fullName,
        branchId,
        action: 'REGISTERED',
        actorId: actor.userId,
        actorName: actor.name,
        actorRole: actor.role,
        actorType: 'STAFF',
        channel: 'BRANCH',
        now: nowIso,
      });
      return { borrowerId, borrowerNumber };
    });
  } catch (err) {
    translateDbError(err);
  }
}

/** Branches a member can choose at self-registration. */
export async function publicBranches(db: AppDb) {
  return db.select({ id: schema.branches.id, name: schema.branches.name, city: schema.branches.city }).from(schema.branches).orderBy(schema.branches.name);
}
