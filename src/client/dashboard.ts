import { and, desc, eq, gte, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { HttpError, type AppDb } from '../kyc/errors';
import { manilaToday } from '../kyc/service';
import { centsFromDb, centsToDecimal, daysBetween } from '../../shared/lending';
import { normaliseKycStatus } from '../../shared/kyc-core';
import { clientLoans, type LendingClient } from '../lending/service';
import { listAccounts } from '../savings/service';
import { membershipOf } from '../groups/rules';
import { paymentRows, register } from '../lending/tables';
import { transactionView } from './transactions';
import type { ClientDashboardView } from '../../shared/client';

/**
 * Everything the member's home screen shows, in one call shared by the web
 * portal and the mobile app. Money is exact decimal strings; dates are
 * YYYY-MM-DD. Every query is scoped to the signed-in member.
 */
export async function clientDashboard(db: AppDb, client: LendingClient): Promise<ClientDashboardView> {
  const [member] = await db
    .select({ id: schema.borrowers.id, fullName: schema.borrowers.fullName, number: schema.borrowers.borrowerNumber, kycStatus: schema.borrowers.kycStatus })
    .from(schema.borrowers)
    .where(eq(schema.borrowers.id, client.borrowerId))
    .limit(1);
  if (!member) throw new HttpError(404, 'Your member record was not found.', 'NOT_FOUND');

  const loans = await clientLoans(db, member.id);
  const accounts = await listAccounts(db, client);
  const open = accounts.filter((a) => a.status !== 'CLOSED');

  // Repayments per month for the last six months (posted payments only).
  const today = manilaToday();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const paid = await db
    .select({ month: sql<string>`substr(${paymentRows.paymentDate}, 1, 7)`, total: sql<string>`sum(${paymentRows.amount})::text` })
    .from(paymentRows)
    .where(and(eq(paymentRows.borrowerId, member.id), eq(paymentRows.status, 'POSTED'), gte(paymentRows.paymentDate, `${months[0]}-01`)))
    .groupBy(sql`substr(${paymentRows.paymentDate}, 1, 7)`);
  const repayments = months.map((m) => ({ month: m, amount: centsToDecimal(centsFromDb(paid.find((p) => p.month === m)?.total ?? '0')) }));

  const recent = await db
    .select()
    .from(register)
    .where(eq(register.clientId, member.id))
    .orderBy(desc(register.transactionDate), desc(register.createdAt))
    .limit(6);

  const feed = and(eq(schema.branchNotifications.audience, 'CLIENT'), eq(schema.branchNotifications.borrowerId, member.id));
  const [unread] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.branchNotifications).where(and(feed, eq(schema.branchNotifications.isRead, false)));
  const latest = await db.select().from(schema.branchNotifications).where(feed).orderBy(desc(schema.branchNotifications.createdAt)).limit(3);

  const membership = await membershipOf(db, member.id);
  // The next unpaid installment is the oldest one; past its due date the loan is behind.
  const daysBehind = (l: (typeof loans.running)[number]) => (l.nextDue && l.nextDue.dueDate < today ? daysBetween(l.nextDue.dueDate, today) : 0);
  const overdue = loans.running.filter((l) => daysBehind(l) > 0);

  return {
    member: { id: member.id, fullName: member.fullName, memberNumber: member.number, kycStatus: normaliseKycStatus(member.kycStatus) },
    loans: {
      running: loans.running.map((l) => ({
        id: l.id,
        loanNumber: l.loanNumber,
        productName: l.productName,
        status: l.status,
        principal: l.principal,
        totalPayable: l.totalPayable,
        totalPaid: l.totalPaid,
        remainingBalance: l.remainingBalance,
        nextDue: l.nextDue,
        daysBehind: daysBehind(l),
      })),
      pendingApplications: loans.pending.map((l) => ({ id: l.id, loanNumber: l.loanNumber, productName: l.productName, status: l.status, principal: l.principal, applicationDate: l.applicationDate })),
      outstanding: loans.summary.outstanding,
      nextDue: loans.summary.nextDue
        ? { ...loans.summary.nextDue, loanNumber: loans.running.find((l) => l.nextDue?.dueDate === loans.summary.nextDue!.dueDate)?.loanNumber ?? null }
        : null,
      overdueCount: overdue.length,
    },
    savings: {
      total: centsToDecimal(open.reduce((s, a) => s + centsFromDb(a.balance), 0)),
      accounts: open.map((a) => ({ id: a.id, passbookNumber: a.passbookNumber, productName: a.product.name, kind: a.product.kind, status: a.status, balance: a.balance, available: a.available })),
    },
    group: membership ? { id: membership.group.id, name: membership.group.groupName, role: membership.member.role, status: membership.group.status } : null,
    repayments,
    recentActivity: recent.map(transactionView),
    notifications: {
      unread: Number(unread?.n ?? 0),
      latest: latest.map((n) => ({ id: n.id, title: n.title, message: n.message, isRead: Boolean(n.isRead), createdAt: n.createdAt ? String(n.createdAt) : null })),
    },
  };
}

