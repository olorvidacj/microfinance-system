import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { HttpError, type AppDb } from '../kyc/errors';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import { seedBranch, seedMember } from '../kyc/testFixtures';

/**
 * Item #4: staff edits of a member's phone and email follow the member's own
 * rules (shared/kyc-core/profile.ts), stay unique, and move the login with them.
 */

let supabase: SupabaseClient | null = null;
vi.mock('../db/supabaseServer', () => ({ getServerSupabase: () => supabase, isSupabaseConfigured: () => supabase !== null }));
const { updateMemberByStaff } = await import('./staffEdit');

const TODAY = '2026-10-23';
let pg: PGlite;
let db: AppDb;
const officerA = { userId: 'u-off-a', name: 'Officer A', role: 'CLIENT_SERVICES_STAFF', branchId: 'br-a', viewAll: false };
const officerB = { ...officerA, userId: 'u-off-b', name: 'Officer B', branchId: 'br-b' };

async function expectHttp(p: Promise<unknown>, status: number, code?: string): Promise<HttpError> {
  try {
    await p;
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    expect(e.status).toBe(status);
    if (code) expect(e.code).toBe(code);
    return e;
  }
  throw new Error(`expected HTTP ${status}`);
}
const borrower = async (id: string) => (await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, id)))[0];
const login = async (id: string) => (await db.select().from(schema.users).where(eq(schema.users.borrowerId, id)))[0];
const fieldsOf = (e: HttpError) => (e.details as { fields: Record<string, string> }).fields;

beforeAll(async () => {
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await seedBranch(db, 'br-a');
  await seedBranch(db, 'br-b');
}, 120_000);
afterAll(async () => {
  await pg?.close();
});
beforeEach(() => {
  supabase = null;
});

describe('staff edit of a member', () => {
  it('refuses an invalid phone or email, with a message for each field, and changes nothing', async () => {
    const id = await seedMember(db, { branchId: 'br-a' });
    const before = await borrower(id);
    const e = await expectHttp(updateMemberByStaff(db, officerA, id, { phone: '12345', email: 'not-an-email', monthlyIncome: 'lots' }, TODAY), 400, 'INVALID_CLIENT');
    expect(Object.keys(fieldsOf(e)).sort()).toEqual(['email', 'monthlyIncome', 'phone']);
    expect(await borrower(id)).toEqual(before);
  });

  it('refuses a phone number another member or account already uses (any format)', async () => {
    const other = await seedMember(db, { branchId: 'br-b', phone: '+63 917 444 5555' });
    const id = await seedMember(db, { branchId: 'br-a' });
    const e = await expectHttp(updateMemberByStaff(db, officerA, id, { phone: '0917-444-5555' }, TODAY), 409, 'PHONE_TAKEN');
    expect(fieldsOf(e).phone).toBeTruthy();
    await db.update(schema.users).set({ phone: '+63 918 222 3333' }).where(eq(schema.users.borrowerId, other));
    await expectHttp(updateMemberByStaff(db, officerA, id, { phone: '639182223333' }, TODAY), 409, 'PHONE_TAKEN');
  });

  it('refuses an email another account or member already uses', async () => {
    const other = await seedMember(db, { branchId: 'br-b' });
    const id = await seedMember(db, { branchId: 'br-a' });
    const otherLogin = (await login(other)).email;
    const e = await expectHttp(updateMemberByStaff(db, officerA, id, { email: otherLogin.toUpperCase() }, TODAY), 409, 'EMAIL_TAKEN');
    expect(fieldsOf(e).email).toBeTruthy();
    await expectHttp(updateMemberByStaff(db, officerA, id, { email: (await borrower(other)).email }, TODAY), 409, 'EMAIL_TAKEN');
  });

  it('changes the phone and email on the member and the login together, and audits old and new', async () => {
    const id = await seedMember(db, { branchId: 'br-a' });
    const oldPhone = (await borrower(id)).phone;
    const res = await updateMemberByStaff(db, officerA, id, { phone: '0919 876 5432', email: 'New.Address@Example.test', monthlyIncome: '25,000.50' }, TODAY);
    expect(res.changed.sort()).toEqual(['email', 'monthlyIncome', 'phone']);
    const b = await borrower(id);
    expect([b.phone, b.email, b.monthlyIncome]).toEqual(['+63 919 876 5432', 'new.address@example.test', 25000.5]);
    const u = await login(id);
    expect([u.phone, u.email]).toEqual(['+63 919 876 5432', 'new.address@example.test']);
    const audit = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, id));
    expect(audit.at(-1)?.details).toContain(`phone ${oldPhone} → +63 919 876 5432`);
    expect(audit.at(-1)?.details).toContain('email');
  });

  it('answers 404 for a member of another branch, even when only notes are sent', async () => {
    const id = await seedMember(db, { branchId: 'br-a' });
    await expectHttp(updateMemberByStaff(db, officerB, id, { notes: 'Visited.' }, TODAY), 404, 'NOT_FOUND');
    expect((await borrower(id)).notes ?? null).toBeNull();
  });

  it('with an approved KYC: identity fields sent unchanged do not block other edits; a real change is refused', async () => {
    const id = await seedMember(db, { branchId: 'br-a', gender: 'Not specified' });
    await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('hoscomo.kyc_actor', 'reconcile', true)`);
      await tx.update(schema.borrowers).set({ kycStatus: 'APPROVED' }).where(eq(schema.borrowers.id, id));
    });
    const b = await borrower(id);
    // The form sends everything, including a legacy gender value it shows as is.
    const form = { fullName: b.fullName, phone: b.phone, email: b.email, dateOfBirth: b.dateOfBirth, gender: b.gender, notes: 'Prefers SMS.' };
    expect((await updateMemberByStaff(db, officerA, id, form, TODAY)).changed).toEqual(['notes']);
    const e = await expectHttp(updateMemberByStaff(db, officerA, id, { ...form, phone: '0920 111 2222' }, TODAY), 409, 'IDENTITY_LOCKED');
    expect(fieldsOf(e).phone).toBeTruthy();
  });

  it('changes the sign-in email in Supabase Auth too, and rolls everything back when Supabase refuses', async () => {
    const calls: Array<{ id: string; email?: string }> = [];
    let refuse = false;
    supabase = {
      auth: {
        admin: {
          updateUserById: async (uid: string, attrs: { email?: string }) => {
            calls.push({ id: uid, email: attrs.email });
            return { data: null, error: refuse ? { message: 'Service unavailable' } : null };
          },
        },
      },
    } as unknown as SupabaseClient;
    const id = await seedMember(db, { branchId: 'br-a' });
    await updateMemberByStaff(db, officerA, id, { email: 'moved@example.test' }, TODAY);
    expect(calls).toEqual([{ id: `u-${id}`, email: 'moved@example.test' }]);

    refuse = true;
    await expectHttp(updateMemberByStaff(db, officerA, id, { email: 'again@example.test', phone: '0921 333 4444' }, TODAY), 502, 'AUTH_PROVIDER');
    const b = await borrower(id);
    expect([b.email, (await login(id)).email]).toEqual(['moved@example.test', 'moved@example.test']);
    expect(b.phone).not.toBe('+63 921 333 4444');
  });
});
