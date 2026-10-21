import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import { HttpError, type AppDb } from '../kyc/errors';
import type { StaffActor } from '../kyc/service';
import { seedBranch } from '../kyc/testFixtures';
import { requestEmailCode, verifyEmailCode, type CodeMailer } from './emailVerification';
import { psgcResolver } from './geography';
import { registerByBranch, registerSelf, type AccountProvider } from './registration';

let pg: PGlite;
let db: AppDb;

const outbox: Array<{ to: string; code: string }> = [];
const mailer: CodeMailer = {
  async sendCode(to, code) {
    outbox.push({ to, code });
    return true;
  },
};
const removed: string[] = [];
let accountSeq = 0;
const accounts: AccountProvider = {
  async create() {
    accountSeq += 1;
    return { id: `u-test-${accountSeq}`, passwordHash: 'hash' };
  },
  async remove(id) {
    removed.push(id);
  },
};
const deps = { accounts, geo: psgcResolver, isPasswordStrong: (p: string) => p.length >= 8 && /\d/.test(p), passwordMessage: 'Password too weak.' };
const officer: StaffActor = { kind: 'staff', userId: 'u-officer', staffId: 'st-1', name: 'Officer', role: 'CLIENT_SERVICES_STAFF', branchId: 'br-a', viewAll: false };

/** Tacloban City, Leyte, Region VIII. */
const ADDRESS = { street: '12 Rizal St', regionCode: '08', provinceCode: '0837', cityCode: '083747', barangayCode: '083747018', postalCode: '6500' };

function form(n: number, extra: Record<string, unknown> = {}) {
  return {
    firstName: 'Ana',
    middleName: 'Lopez',
    lastName: `Reyes${String.fromCharCode(64 + n)}`,
    email: `ana${n}@example.com`,
    phone: `0918 000 ${String(1000 + n)}`,
    dateOfBirth: '1992-03-04',
    gender: 'Female',
    civilStatus: 'Single',
    address: ADDRESS,
    employmentStatus: 'Employed',
    occupation: 'Teacher',
    employerOrBusiness: 'DepEd',
    sourceOfIncome: 'Salary',
    monthlyIncome: '28000',
    monthlyExpenses: '15000',
    branchId: 'br-a',
    password: 'Secret123!',
    confirmPassword: 'Secret123!',
    ...extra,
  };
}

async function verifiedToken(email: string): Promise<string> {
  await requestEmailCode(db, email, mailer);
  const code = outbox.filter((m) => m.to === email).pop()!.code;
  return (await verifyEmailCode(db, email, code)).verificationToken;
}

async function expectHttp(p: Promise<unknown>, status: number, code?: string): Promise<HttpError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(status);
    if (code) expect((e as HttpError).code).toBe(code);
    return e as HttpError;
  }
  throw new Error(`expected HTTP ${status}`);
}

beforeAll(async () => {
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await seedBranch(db, 'br-a');
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

describe('email verification', () => {
  it('stores only a hash of the code and accepts it once', async () => {
    await requestEmailCode(db, 'Code.Test@Example.com', mailer);
    const sent = outbox.pop()!;
    expect(sent.to).toBe('code.test@example.com');
    const rows = await db.select().from(schema.emailVerifications).where(eq(schema.emailVerifications.email, 'code.test@example.com'));
    expect(rows[0].codeHash).not.toContain(sent.code);

    const wrong = sent.code === '000000' ? '111111' : '000000';
    const err = await expectHttp(verifyEmailCode(db, 'code.test@example.com', wrong), 400, 'WRONG_CODE');
    expect(err.message).toMatch(/4 attempts left/);
    const ok = await verifyEmailCode(db, 'code.test@example.com', sent.code);
    expect(ok.verificationToken.length).toBeGreaterThan(20);
    await expectHttp(verifyEmailCode(db, 'code.test@example.com', sent.code), 400, 'CODE_EXPIRED');
  });

  it('locks a code after five wrong attempts and rate-limits sending', async () => {
    await requestEmailCode(db, 'lock@example.com', mailer);
    for (let i = 0; i < 5; i++) await expectHttp(verifyEmailCode(db, 'lock@example.com', '999999'), 400).catch(() => undefined);
    await expectHttp(verifyEmailCode(db, 'lock@example.com', outbox.pop()!.code), 429, 'TOO_MANY_ATTEMPTS');
    for (let i = 0; i < 4; i++) await requestEmailCode(db, 'lock@example.com', mailer);
    await expectHttp(requestEmailCode(db, 'lock@example.com', mailer), 429, 'RATE_LIMITED');
  });
});

describe('portal self-registration', () => {
  it('creates login, member and an empty KYC application in one go, with no savings account yet', async () => {
    const token = await verifiedToken('ana1@example.com');
    const r = await registerSelf(db, { ...form(1), emailVerificationToken: token }, deps);
    expect(r.borrowerNumber).toMatch(/^CLI-\d{4}-\d{4}$/);
    expect(r.linkedExisting).toBe(false);

    const [m] = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, r.borrowerId));
    expect(m).toMatchObject({
      fullName: 'Ana Lopez ReyesA',
      emailVerified: 1,
      kycStatus: 'NOT_STARTED',
      registrationChannel: 'SELF',
      region: 'Eastern Visayas',
      cityMunicipality: 'Tacloban City',
      barangayCode: '083747018',
      monthlyIncome: 28000,
      sourceOfIncome: 'Salary',
      phone: '+63 918 000 1001',
    });
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.user.id));
    expect(u.borrowerId).toBe(r.borrowerId);
    expect(await db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.memberId, r.borrowerId))).toHaveLength(0);
    const kyc = await db.select().from(schema.kycSubmissions).where(eq(schema.kycSubmissions.borrowerId, r.borrowerId));
    expect(kyc[0].status).toBe('NOT_STARTED');
    const audit = await db.select().from(schema.kycAuditLog).where(eq(schema.kycAuditLog.borrowerId, r.borrowerId));
    expect(audit.map((a) => a.action)).toEqual(['REGISTERED']);
  });

  it('requires a verified email and uses each verification once', async () => {
    await expectHttp(registerSelf(db, { ...form(2) }, deps), 400, 'EMAIL_NOT_VERIFIED');
    expect(removed).toContain(`u-test-${accountSeq}`);
    const token = await verifiedToken('ana2@example.com');
    await expectHttp(registerSelf(db, { ...form(2, { email: 'someone.else@example.com' }), emailVerificationToken: token }, deps), 400, 'EMAIL_NOT_VERIFIED');
    await registerSelf(db, { ...form(2), emailVerificationToken: token }, deps);
    await expectHttp(requestEmailCode(db, 'ana2@example.com', mailer), 409, 'ACCOUNT_EXISTS');
  });

  it('refuses duplicate mobile numbers and national IDs across members', async () => {
    const t3 = await verifiedToken('ana3@example.com');
    await registerSelf(db, { ...form(3, { idType: 'UMID', idNumber: '0111-2222333-4' }), emailVerificationToken: t3 }, deps);

    const t4 = await verifiedToken('ana4@example.com');
    const samePhone = await expectHttp(registerSelf(db, { ...form(4, { phone: '+63 918 000 1003' }), emailVerificationToken: t4 }, deps), 409, 'DUPLICATE');
    expect((samePhone.details as any).errors.phone).toBeTruthy();
    const sameId = await expectHttp(registerSelf(db, { ...form(4, { idType: 'UMID', idNumber: '011122223334' }), emailVerificationToken: t4 }, deps), 409, 'DUPLICATE');
    expect((sameId.details as any).errors.idNumber).toBeTruthy();
  });

  it('validates the address against PSGC and reports every bad field', async () => {
    const t5 = await verifiedToken('ana5@example.com');
    const wrongCity = await expectHttp(
      registerSelf(db, { ...form(5, { address: { ...ADDRESS, barangayCode: '137404001' } }), emailVerificationToken: t5 }, deps),
      400,
      'VALIDATION',
    );
    expect((wrongCity.details as any).errors['address.barangayCode']).toMatch(/not in the selected city/);
    const bad = await expectHttp(registerSelf(db, { ...form(5, { phone: '123', dateOfBirth: '2015-01-01', password: 'x' }), emailVerificationToken: t5 }, deps), 400, 'VALIDATION');
    expect(Object.keys((bad.details as any).errors)).toEqual(expect.arrayContaining(['phone', 'dateOfBirth', 'password']));
  });
});

describe('branch registration', () => {
  it('registers a member scoped to the officer branch and lets them activate a portal login later', async () => {
    const r = await registerByBranch(db, officer, { ...form(6, { idType: 'PHILSYS_ID', idNumber: '1234-5678-9012-3456', branchId: 'br-other' }) }, { geo: psgcResolver });
    const [m] = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, r.borrowerId));
    expect(m).toMatchObject({ branchId: 'br-a', registrationChannel: 'BRANCH', registeredBy: 'u-officer', emailVerified: 0, kycStatus: 'NOT_STARTED' });

    const token = await verifiedToken('ana6@example.com');
    await expectHttp(registerSelf(db, { ...form(6, { dateOfBirth: '1990-01-01' }), emailVerificationToken: token }, deps), 409, 'MEMBER_MISMATCH');
    const token2 = await verifiedToken('ana6@example.com');
    const linked = await registerSelf(db, { ...form(6), emailVerificationToken: token2 }, deps);
    expect(linked.linkedExisting).toBe(true);
    expect(linked.borrowerId).toBe(r.borrowerId);
    const count = await db.select({ n: sql<number>`count(*)::int` }).from(schema.borrowers).where(sql`lower(email) = 'ana6@example.com'`);
    expect(count[0].n).toBe(1);
  });

  it('requires a government ID and refuses duplicates', async () => {
    await expectHttp(registerByBranch(db, officer, { ...form(7) }, { geo: psgcResolver }), 400, 'VALIDATION');
    await expectHttp(
      registerByBranch(db, officer, { ...form(7, { email: 'ana1@example.com', idType: 'SSS_ID', idNumber: '04-1234567-8' }) }, { geo: psgcResolver }),
      409,
      'DUPLICATE',
    );
  });
});
