import crypto from 'crypto';
import { and, asc, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { HttpError, type AppDb } from '../kyc/errors';
import { centsFromDb, consentStatus, groupLoanBlock, type ConsentDecision, type GroupStatus } from '../../shared/lending';
import { consents, covers, groups, members, type GroupRow, type MemberRow } from './tables';

/**
 * Group checks used by the loan workflow (src/lending/service.ts). Kept apart
 * from the group service so the loan service can use them without a cycle.
 */

const RUNNING = ['Disbursed', 'Active'];

/** The member's active membership, if any, with its group. */
export async function membershipOf(tx: AppDb, borrowerId: string): Promise<{ group: GroupRow; member: MemberRow } | null> {
  const rows = await tx
    .select({ group: groups, member: members })
    .from(members)
    .innerJoin(groups, eq(groups.id, members.groupId))
    .where(and(eq(members.borrowerId, borrowerId), eq(members.status, 'ACTIVE')))
    .limit(1);
  return rows[0] ?? null;
}

export async function activeMemberIds(tx: AppDb, groupId: string): Promise<string[]> {
  const rows = await tx.select({ id: members.borrowerId }).from(members).where(and(eq(members.groupId, groupId), eq(members.status, 'ACTIVE'))).orderBy(asc(members.joinedAt), asc(members.createdAt), asc(members.id));
  return rows.map((r) => r.id);
}

/** Whether the group may take a new loan now (see shared/lending/groups.ts). */
export async function groupBlock(tx: AppDb, group: Pick<GroupRow, 'id' | 'arrearsThresholdDays'>, today: string) {
  const ids = await activeMemberIds(tx, group.id);
  const arrears = ids.length
    ? await tx
        .select({ borrowerName: schema.loans.borrowerName, loanNumber: schema.loans.loanNumber, oldestDueDate: sql<string>`min(${schema.loanSchedule.dueDate})` })
        .from(schema.loanSchedule)
        .innerJoin(schema.loans, eq(schema.loans.id, schema.loanSchedule.loanId))
        .where(and(inArray(schema.loans.borrowerId, ids), inArray(schema.loans.status, RUNNING), lt(schema.loanSchedule.dueDate, today), ne(schema.loanSchedule.status, 'PAID')))
        .groupBy(schema.loans.borrowerName, schema.loans.loanNumber)
    : [];
  const owed = await tx
    .select({ borrowerName: schema.borrowers.fullName, coverNumber: covers.coverNumber, amount: covers.amount, repaid: covers.repaid })
    .from(covers)
    .innerJoin(schema.borrowers, eq(schema.borrowers.id, covers.borrowerId))
    .where(and(eq(covers.groupId, group.id), eq(covers.status, 'OUTSTANDING')));
  return groupLoanBlock({
    today,
    thresholdDays: group.arrearsThresholdDays,
    arrears: arrears.map((a) => ({ borrowerName: a.borrowerName, loanNumber: a.loanNumber, oldestDueDate: String(a.oldestDueDate).slice(0, 10) })),
    covers: owed.map((c) => ({ borrowerName: c.borrowerName, coverNumber: c.coverNumber, outstanding: centsFromDb(c.amount) - centsFromDb(c.repaid) })),
  });
}

/**
 * Joint liability: when a group member's installment becomes overdue, the
 * leader, the other members and the branch are told, once per installment
 * (group_overdue_alerts is keyed on loan and installment). Run after the
 * overdue check; safe to run any number of times.
 */
export async function alertOverdueGroups(db: AppDb, today: string): Promise<number> {
  const due = await db
    .select({
      loanId: schema.loans.id,
      loanNumber: schema.loans.loanNumber,
      borrowerId: schema.loans.borrowerId,
      borrowerName: schema.loans.borrowerName,
      groupId: groups.id,
      groupName: groups.groupName,
      branchId: groups.branchId,
      leaderBorrowerId: groups.leaderBorrowerId,
      installmentNumber: schema.loanSchedule.installmentNumber,
      dueDate: schema.loanSchedule.dueDate,
    })
    .from(schema.loanSchedule)
    .innerJoin(schema.loans, eq(schema.loans.id, schema.loanSchedule.loanId))
    .innerJoin(groups, eq(groups.id, schema.loans.groupId))
    .where(
      and(
        inArray(schema.loans.status, RUNNING),
        lt(schema.loanSchedule.dueDate, today),
        ne(schema.loanSchedule.status, 'PAID'),
        sql`not exists (select 1 from group_overdue_alerts a where a.loan_id = ${schema.loanSchedule.loanId} and a.installment_number = ${schema.loanSchedule.installmentNumber})`,
      ),
    );
  let sent = 0;
  for (const d of due) {
    await db.transaction(async (tx) => {
      const t = tx as unknown as AppDb;
      const inserted = await t.execute(sql`insert into group_overdue_alerts (loan_id, installment_number, group_id, alerted_at)
                                           values (${d.loanId}, ${d.installmentNumber}, ${d.groupId}, ${new Date().toISOString()})
                                           on conflict do nothing returning loan_id`);
      const rows = (inserted as { rows?: unknown[] }).rows ?? (inserted as unknown as unknown[]);
      if (!rows.length) return;
      const at = new Date().toISOString();
      const others = (await activeMemberIds(t, d.groupId)).filter((id) => id !== d.borrowerId);
      const note = (borrowerId: string | null, audience: 'CLIENT' | 'STAFF', title: string, message: string) =>
        t.insert(schema.branchNotifications).values({
          id: `ntf-${crypto.randomUUID()}`,
          branchId: d.branchId,
          audience,
          borrowerId,
          type: 'GROUP_MEMBER_OVERDUE',
          title,
          message,
          relatedType: 'SolidarityGroup',
          relatedId: d.groupId,
          isRead: false,
          createdAt: at,
        });
      for (const id of others) {
        const leader = id === d.leaderBorrowerId;
        await note(
          id,
          'CLIENT',
          leader ? 'A member of your group is overdue' : 'Your group has an overdue installment',
          `${d.borrowerName}'s installment ${d.installmentNumber} on ${d.loanNumber} (due ${d.dueDate}) is overdue. ${leader ? 'As leader, please follow up before the next meeting; ' : ''}the group is jointly liable and may have to cover it from the solidarity fund.`,
        );
      }
      await note(null, 'STAFF', `Group member overdue: ${d.groupName}`, `${d.borrowerName} (${d.groupName}) is overdue on ${d.loanNumber}, installment ${d.installmentNumber} due ${d.dueDate}.`);
      await t.insert(schema.auditLogs).values({
        id: `aud-${crypto.randomUUID()}`,
        timestamp: at,
        action: 'GROUP_MEMBER_OVERDUE',
        details: `${d.groupName}: ${d.borrowerName} overdue on ${d.loanNumber} installment ${d.installmentNumber} (due ${d.dueDate}); leader and ${others.length} member(s) notified.`,
        performedBy: 'system',
        branchId: d.branchId,
        type: 'GROUP',
        userName: 'Overdue check',
        userRole: 'SYSTEM',
        targetType: 'SolidarityGroup',
        targetId: d.groupId,
      });
      sent += 1;
    });
  }
  return sent;
}

export async function loanConsentStatus(tx: AppDb, loan: { id: string; borrowerId: string; groupId: string | null }) {
  if (!loan.groupId) return null;
  const ids = await activeMemberIds(tx, loan.groupId);
  const rows = await tx.select({ borrowerId: consents.borrowerId, decision: consents.decision }).from(consents).where(eq(consents.loanId, loan.id));
  return consentStatus({ applicantId: loan.borrowerId, memberIds: ids, consents: rows.map((r) => ({ borrowerId: r.borrowerId, decision: r.decision as ConsentDecision })) });
}

/**
 * Before a group loan is approved or released: the group is active, the
 * borrower is still one of its members, the group is not blocked, and (for
 * approval) every other member has consented.
 */
export async function assertGroupLoanAllowed(tx: AppDb, loan: { id: string; loanNumber: string; borrowerId: string; groupId: string | null }, today: string, step: 'approve' | 'release') {
  if (!loan.groupId) throw new HttpError(409, `${loan.loanNumber} is a group loan but is not linked to a group.`, 'GROUP_REQUIRED');
  const [group] = await tx.select().from(groups).where(eq(groups.id, loan.groupId)).for('update').limit(1);
  if (!group || (group.status as GroupStatus) !== 'ACTIVE') throw new HttpError(409, `The member's group is ${group ? String(group.status).toLowerCase() : 'missing'}; group loans need an active group.`, 'GROUP_NOT_ACTIVE');
  const m = await tx.select({ id: members.id }).from(members).where(and(eq(members.groupId, group.id), eq(members.borrowerId, loan.borrowerId), eq(members.status, 'ACTIVE'))).limit(1);
  if (!m[0]) throw new HttpError(409, `The borrower is no longer a member of ${group.groupName}.`, 'NOT_A_MEMBER');
  const block = await groupBlock(tx, group, today);
  if (block.blocked) throw new HttpError(409, `${group.groupName} cannot take new loans: ${block.reasons.join(' ')}`, 'GROUP_IN_ARREARS', { reasons: block.reasons });
  if (step === 'approve') {
    const c = await loanConsentStatus(tx, loan);
    if (!c?.complete) {
      throw new HttpError(
        409,
        c && c.declined.length
          ? `${c.declined.length} group member(s) declined to guarantee this loan.`
          : `Every other member of ${group.groupName} must consent first (${c?.missing.length ?? 0} still to record).`,
        'CONSENT_REQUIRED',
        { consent: c },
      );
    }
  }
  return group;
}
