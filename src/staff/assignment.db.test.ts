import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import { HttpError, type AppDb } from '../kyc/errors';
import { seedBranch } from '../kyc/testFixtures';
import { assignStaffBranch, branchFilter, checkAssignableBranch, HEAD_OFFICE, staffBranches } from './assignment';

/** A staff login's branch is set from the admin console and audited; unknown branches are refused. */
let pg: PGlite;
let db: AppDb;
const admin = { userId: 'u-admin', name: 'Head Admin', role: 'ADMINISTRATOR' };

async function expectHttp(p: Promise<unknown>, status: number, code?: string): Promise<void> {
  try {
    await p;
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    expect(e.status).toBe(status);
    if (code) expect(e.code).toBe(code);
    return;
  }
  throw new Error(`expected HTTP ${status}`);
}

async function seedUser(id: string, role: 'STAFF' | 'CLIENT', staffRole: string | null, staffId: string | null = null) {
  await db.insert(schema.users).values({ id, email: `${id}@coop.test`, passwordHash: 'x', fullName: `Person ${id}`, role, staffRole, staffId });
}

const auditFor = (userId: string) => db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, userId));

beforeAll(async () => {
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await seedBranch(db, 'br-a');
  await seedBranch(db, 'br-b');
});

afterAll(async () => {
  await pg?.close();
});

describe('branchFilter', () => {
  it('reads nothing, an empty value or "all" as every branch', async () => {
    expect(await branchFilter(db, undefined)).toBeNull();
    expect(await branchFilter(db, '')).toBeNull();
    expect(await branchFilter(db, HEAD_OFFICE)).toBeNull();
  });

  it('keeps a branch that exists and refuses one that does not', async () => {
    expect(await branchFilter(db, 'br-b')).toBe('br-b');
    await expectHttp(branchFilter(db, 'br-nowhere'), 400, 'INVALID_BRANCH');
    await expectHttp(branchFilter(db, ['br-a', 'br-b']), 400, 'INVALID_BRANCH');
  });
});

describe('checkAssignableBranch', () => {
  it('requires a branch', async () => {
    await expectHttp(checkAssignableBranch(db, 'TELLER', ''), 400, 'BRANCH_REQUIRED');
    await expectHttp(checkAssignableBranch(db, 'TELLER', undefined), 400, 'BRANCH_REQUIRED');
  });

  it('gives head office only to roles with all-branch access', async () => {
    expect(await checkAssignableBranch(db, 'ADMINISTRATOR', HEAD_OFFICE)).toBe(HEAD_OFFICE);
    await expectHttp(checkAssignableBranch(db, 'Teller', HEAD_OFFICE), 400, 'INVALID_BRANCH');
    await expectHttp(checkAssignableBranch(db, 'LOAN_OFFICER', HEAD_OFFICE), 400, 'INVALID_BRANCH');
  });
});

describe('assignStaffBranch', () => {
  it('creates the staff record of a login that has none, links it, and audits the move', async () => {
    await seedUser('u-new', 'STAFF', 'TELLER');
    const a = await assignStaffBranch(db, admin, { userId: 'u-new', branchId: 'br-a' });
    expect(a).toMatchObject({ userId: 'u-new', branchId: 'br-a', branchName: 'Branch br-a' });

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, 'u-new'));
    expect(user.staffId).toBe(a.staffId);
    const [record] = await db.select().from(schema.staff).where(eq(schema.staff.id, a.staffId));
    expect(record).toMatchObject({ assignedBranchId: 'br-a', role: 'TELLER', email: 'u-new@coop.test' });

    const logs = await auditFor('u-new');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'STAFF_BRANCH_ASSIGNMENT', branchId: 'br-a', performedBy: 'u-admin', userName: 'Head Admin' });
    expect(logs[0].details).toBe('Person u-new (u-new@coop.test) moved from no branch to Branch br-a.');
  });

  it('moves an existing staff record to another branch, naming both branches', async () => {
    const a = await assignStaffBranch(db, admin, { userId: 'u-new', branchId: 'br-b' });
    const [record] = await db.select().from(schema.staff).where(eq(schema.staff.id, a.staffId));
    expect(record.assignedBranchId).toBe('br-b');
    expect(await db.select().from(schema.staff).where(eq(schema.staff.email, 'u-new@coop.test'))).toHaveLength(1);
    const logs = await auditFor('u-new');
    expect(logs.map((l) => l.details)).toContain('Person u-new (u-new@coop.test) moved from Branch br-a to Branch br-b.');
  });

  it('records nothing when the branch does not change', async () => {
    const before = (await auditFor('u-new')).length;
    await assignStaffBranch(db, admin, { userId: 'u-new', branchId: 'br-b' });
    expect(await auditFor('u-new')).toHaveLength(before);
  });

  it('finds a staff record by email when the login is not linked to it', async () => {
    await db.insert(schema.staff).values({ id: 'st-old', name: 'Old', email: 'u-unlinked@coop.test', role: 'LOAN_OFFICER', assignedBranchId: 'br-a', title: 'Loan Officer', avatar: '' });
    await seedUser('u-unlinked', 'STAFF', 'LOAN_OFFICER');
    const a = await assignStaffBranch(db, admin, { userId: 'u-unlinked', branchId: 'br-b' });
    expect(a.staffId).toBe('st-old');
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, 'u-unlinked'));
    expect(user.staffId).toBe('st-old');
  });

  it('puts an administrator at head office', async () => {
    await seedUser('u-ho', 'STAFF', 'ADMINISTRATOR');
    expect(await assignStaffBranch(db, admin, { userId: 'u-ho', branchId: HEAD_OFFICE })).toMatchObject({ branchId: HEAD_OFFICE, branchName: 'All branches (head office)' });
  });

  it('refuses members, unknown accounts, unknown branches and head office for a teller, changing nothing', async () => {
    await seedUser('u-member', 'CLIENT', null);
    await expectHttp(assignStaffBranch(db, admin, { userId: 'u-member', branchId: 'br-a' }), 400, 'NOT_STAFF');
    await expectHttp(assignStaffBranch(db, admin, { userId: 'u-nobody', branchId: 'br-a' }), 404, 'NOT_FOUND');
    await expectHttp(assignStaffBranch(db, admin, { userId: 'u-new', branchId: 'br-nowhere' }), 400, 'INVALID_BRANCH');
    await expectHttp(assignStaffBranch(db, admin, { userId: 'u-new', branchId: HEAD_OFFICE }), 400, 'INVALID_BRANCH');
    const [record] = await db.select().from(schema.staff).where(eq(schema.staff.email, 'u-new@coop.test'));
    expect(record.assignedBranchId).toBe('br-b');
    expect(await auditFor('u-member')).toHaveLength(0);
  });
});

describe('staffBranches', () => {
  it('names each staff login’s branch, by link or by email, and skips logins with none', async () => {
    await seedUser('u-none', 'STAFF', 'TELLER');
    const map = await staffBranches(db, ['u-new', 'u-unlinked', 'u-ho', 'u-none']);
    expect(map.get('u-new')).toEqual({ branchId: 'br-b', branchName: 'Branch br-b' });
    expect(map.get('u-unlinked')).toEqual({ branchId: 'br-b', branchName: 'Branch br-b' });
    expect(map.get('u-ho')).toEqual({ branchId: HEAD_OFFICE, branchName: 'All branches (head office)' });
    expect(map.has('u-none')).toBe(false);
  });
});
