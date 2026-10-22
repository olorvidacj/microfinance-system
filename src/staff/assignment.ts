import crypto from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { HttpError, type AppDb } from '../kyc/errors';
import { getRoleDefinition, hasPermission, normalizeRole } from '../auth/permissions';

/**
 * Which branch a staff login works in, and the admin console's branch filter.
 *
 * A staff login's branch lives on its staff record (staff.assigned_branch_id):
 * an existing branch id, or HEAD_OFFICE for accounts that work across every
 * branch (only roles with view_all_records). The branch app reads it on every
 * request, so a change applies at once.
 */
export const HEAD_OFFICE = 'all';

export interface BranchAssignment {
  userId: string;
  staffId: string;
  branchId: string;
  /** The branch's name, or "All branches (head office)". */
  branchName: string;
}

export interface AssigningActor {
  userId: string;
  name: string;
  role: string;
}

const HEAD_OFFICE_NAME = 'All branches (head office)';

async function branchName(db: AppDb, branchId: string): Promise<string | null> {
  if (branchId === HEAD_OFFICE) return HEAD_OFFICE_NAME;
  const rows = await db.select({ name: schema.branches.name }).from(schema.branches).where(eq(schema.branches.id, branchId)).limit(1);
  return rows[0]?.name ?? null;
}

/**
 * The admin console's branch filter from a query string value: null for every
 * branch, else the id of a branch that exists. An unknown id is refused rather
 * than read as "every branch".
 */
export async function branchFilter(db: AppDb, raw: unknown): Promise<string | null> {
  if (raw === undefined || raw === null || raw === '' || raw === HEAD_OFFICE) return null;
  if (typeof raw !== 'string') throw new HttpError(400, 'Choose one branch.', 'INVALID_BRANCH');
  const name = await branchName(db, raw);
  if (!name) throw new HttpError(400, 'That branch does not exist.', 'INVALID_BRANCH', { fields: { branchId: 'Unknown branch' } });
  return raw;
}

/**
 * Refuses a branch a staff role may not be given: a branch that does not exist,
 * or head office for a role without all-branch access. Run before creating an
 * account so a refused assignment never leaves a login without a branch.
 */
export async function checkAssignableBranch(db: AppDb, staffRole: string | null | undefined, branchId: unknown): Promise<string> {
  if (typeof branchId !== 'string' || !branchId.trim()) {
    throw new HttpError(400, 'Choose the branch this staff member works in.', 'BRANCH_REQUIRED', { fields: { branchId: 'Required' } });
  }
  const id = branchId.trim();
  if (id === HEAD_OFFICE) {
    if (!hasPermission(normalizeRole(staffRole), 'view_all_records')) {
      throw new HttpError(400, `A ${getRoleDefinition(staffRole).name} works in one branch. Choose a branch, not head office.`, 'INVALID_BRANCH', {
        fields: { branchId: 'Choose a branch' },
      });
    }
    return id;
  }
  if (!(await branchName(db, id))) throw new HttpError(400, 'That branch does not exist.', 'INVALID_BRANCH', { fields: { branchId: 'Unknown branch' } });
  return id;
}

/**
 * Puts a staff login in a branch. Creates the staff record when the login has
 * none, and records who moved whom, from where to where, in the audit log.
 */
export async function assignStaffBranch(
  db: AppDb,
  actor: AssigningActor,
  input: { userId: string; branchId: unknown },
  at = new Date().toISOString(),
): Promise<BranchAssignment> {
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, input.userId)).for('update').limit(1);
    if (!user) throw new HttpError(404, 'That account does not exist.', 'NOT_FOUND');
    if (user.role !== 'STAFF') throw new HttpError(400, 'Only staff accounts work in a branch. A member belongs to the branch they joined.', 'NOT_STAFF');
    const branchId = await checkAssignableBranch(tx, user.staffRole, input.branchId);
    const toName = (await branchName(tx, branchId)) as string;

    let [record] = user.staffId ? await tx.select().from(schema.staff).where(eq(schema.staff.id, user.staffId)).for('update').limit(1) : [];
    if (!record) {
      [record] = await tx.select().from(schema.staff).where(eq(schema.staff.email, user.email)).for('update').limit(1);
    }
    const previous = record?.assignedBranchId ?? null;

    let staffId: string;
    if (record) {
      staffId = record.id;
      if (previous !== branchId) await tx.update(schema.staff).set({ assignedBranchId: branchId }).where(eq(schema.staff.id, staffId));
    } else {
      staffId = `stf-${crypto.randomUUID()}`;
      const role = normalizeRole(user.staffRole);
      await tx.insert(schema.staff).values({
        id: staffId,
        name: user.fullName,
        email: user.email,
        role,
        assignedBranchId: branchId,
        title: getRoleDefinition(role).name,
        avatar: user.avatar ?? '',
      });
    }
    if (user.staffId !== staffId) await tx.update(schema.users).set({ staffId }).where(eq(schema.users.id, user.id));

    if (previous !== branchId) {
      const fromName = previous ? ((await branchName(tx, previous)) ?? previous) : 'no branch';
      await tx.insert(schema.auditLogs).values({
        id: `aud-${crypto.randomUUID()}`,
        timestamp: at,
        action: 'STAFF_BRANCH_ASSIGNMENT',
        details: `${user.fullName} (${user.email}) moved from ${fromName} to ${toName}.`,
        performedBy: actor.userId,
        branchId,
        type: 'BRANCH',
        userName: actor.name,
        userRole: actor.role,
        targetType: 'User',
        targetId: user.id,
      });
    }
    return { userId: user.id, staffId, branchId, branchName: toName };
  });
}

/** Each staff login's branch, by user id, for the user list. */
export async function staffBranches(db: AppDb, userIds: string[]): Promise<Map<string, { branchId: string; branchName: string }>> {
  const out = new Map<string, { branchId: string; branchName: string }>();
  if (!userIds.length) return out;
  const users = await db
    .select({ id: schema.users.id, staffId: schema.users.staffId, email: schema.users.email })
    .from(schema.users)
    .where(inArray(schema.users.id, userIds));
  const records = await db.select({ id: schema.staff.id, email: schema.staff.email, branchId: schema.staff.assignedBranchId }).from(schema.staff);
  const branches = await db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches);
  const names = new Map(branches.map((b) => [b.id, b.name]));
  const byId = new Map(records.map((r) => [r.id, r]));
  const byEmail = new Map(records.map((r) => [r.email.toLowerCase(), r]));
  for (const u of users) {
    const r = (u.staffId && byId.get(u.staffId)) || byEmail.get(u.email.toLowerCase());
    if (!r || !r.branchId || r.branchId === 'unassigned') continue;
    out.set(u.id, { branchId: r.branchId, branchName: r.branchId === HEAD_OFFICE ? HEAD_OFFICE_NAME : (names.get(r.branchId) ?? r.branchId) });
  }
  return out;
}
