import { and, eq, inArray, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { AppDb } from '../kyc/errors';
import { manilaToday } from '../kyc/service';
import { centsFromDb, centsToDecimal, daysBetween, OPEN_LOAN_STATUSES, RUNNING_LOAN_STATUSES } from '../../shared/lending';
import { isAwaitingReview, isKycVerified } from '../../shared/kyc-core';
import { loanSummaries, trialBalance } from '../lending/service';
import { loans as loanTable, paymentRows } from '../lending/tables';
import { accounts as savingsAccounts, transactions as savingsTransactions } from '../savings/tables';
import { groups as groupTable } from '../groups/tables';

/**
 * The portfolio figures every report shows, computed once and exactly (cents,
 * returned as decimal strings) from the tables the money modules keep: loans
 * and their schedules, posted payments, savings accounts and transactions, the
 * solidarity funds and the ledger. The admin console (all branches), the
 * branch app (one branch) and, per member, the client portal read the same
 * definitions, so their numbers agree:
 *
 *   outstanding  = sum of remainingBalance of running loans (Disbursed, Active),
 *                  exactly what a member's dashboard sums for their own loans
 *   collections  = posted (not reversed) loan payments
 *   savings      = balances of accounts that are not closed
 */
export interface PortfolioSummary {
  scope: { branchId: string | null };
  asOf: string;
  members: { total: number; active: number; kycVerified: number; kycAwaitingReview: number; kycNotVerified: number };
  loans: {
    applications: number;
    running: number;
    finished: number;
    overdue: number;
    outstanding: string;
    overdueOutstanding: string;
    principalReleased: string;
    totalPaid: string;
  };
  collections: { count: number; amount: string; todayCount: number; todayAmount: string };
  savings: { accounts: number; balance: string; depositsToday: string; withdrawalsToday: string; deposits: string; withdrawals: string; interest: string };
  groups: { total: number; active: number; fundBalance: string };
}

export async function portfolioSummary(db: AppDb, scope: { branchId: string | null }, today = manilaToday()): Promise<PortfolioSummary> {
  const branch = scope.branchId;
  const members = await db
    .select({ id: schema.borrowers.id, kycStatus: schema.borrowers.kycStatus, memberStatus: schema.borrowers.memberStatus })
    .from(schema.borrowers)
    .where(branch ? eq(schema.borrowers.branchId, branch) : undefined);
  const memberIds = members.map((m) => m.id);

  const loanRows = await db.select().from(loanTable).where(branch ? eq(loanTable.branchId, branch) : undefined);
  const views = await loanSummaries(db, loanRows);
  const running = views.filter((v) => RUNNING_LOAN_STATUSES.includes(v.status));
  const behind = (v: (typeof views)[number]) => Boolean(v.nextDue && v.nextDue.dueDate < today && daysBetween(v.nextDue.dueDate, today) > 0);
  const overdue = running.filter(behind);
  const released = views.filter((v) => RUNNING_LOAN_STATUSES.includes(v.status) || v.status === 'Closed' || v.status === 'Written Off');
  const sumOf = (rows: typeof views, pick: (v: (typeof views)[number]) => string) => centsToDecimal(rows.reduce((s, v) => s + centsFromDb(pick(v)), 0));

  const posted = await db
    .select({ amount: paymentRows.amount, date: paymentRows.paymentDate })
    .from(paymentRows)
    .where(and(eq(paymentRows.status, 'POSTED'), branch ? eq(paymentRows.branchId, branch) : undefined));
  const todays = posted.filter((p) => p.date === today);

  const accounts = memberIds.length || !branch
    ? await db
        .select({ balance: savingsAccounts.balance, status: savingsAccounts.status })
        .from(savingsAccounts)
        .where(branch ? inArray(savingsAccounts.memberId, memberIds) : undefined)
    : [];
  const open = accounts.filter((a) => a.status !== 'CLOSED');
  const txns = memberIds.length || !branch
    ? await db
        .select({ kind: savingsTransactions.kind, amount: savingsTransactions.amount, date: savingsTransactions.date })
        .from(savingsTransactions)
        .where(branch ? inArray(savingsTransactions.memberId, memberIds) : undefined)
    : [];
  const cents = (rows: typeof txns, kind: string, day?: string) => rows.filter((t) => t.kind === kind && (!day || t.date === day)).reduce((s, t) => s + centsFromDb(t.amount), 0);
  const total = (rows: typeof txns, kind: string, day?: string) => centsToDecimal(cents(rows, kind, day));
  // An online payout that failed and came back (PAYOUT_REFUND) undoes its withdrawal.
  const withdrawn = (day?: string) => centsToDecimal(cents(txns, 'WITHDRAWAL', day) - cents(txns, 'PAYOUT_REFUND', day));

  const groupRows = await db
    .select({ status: groupTable.status, fund: groupTable.fundBalance })
    .from(groupTable)
    .where(branch ? eq(groupTable.branchId, branch) : undefined);

  return {
    scope: { branchId: branch },
    asOf: today,
    members: {
      total: members.length,
      active: members.filter((m) => m.memberStatus === 'Active').length,
      kycVerified: members.filter((m) => isKycVerified(m.kycStatus)).length,
      kycAwaitingReview: members.filter((m) => isAwaitingReview(m.kycStatus)).length,
      kycNotVerified: members.filter((m) => !isKycVerified(m.kycStatus) && !isAwaitingReview(m.kycStatus)).length,
    },
    loans: {
      applications: views.filter((v) => OPEN_LOAN_STATUSES.includes(v.status) && !RUNNING_LOAN_STATUSES.includes(v.status)).length,
      running: running.length,
      finished: views.filter((v) => !OPEN_LOAN_STATUSES.includes(v.status)).length,
      overdue: overdue.length,
      outstanding: sumOf(running, (v) => v.remainingBalance),
      overdueOutstanding: sumOf(overdue, (v) => v.remainingBalance),
      principalReleased: sumOf(released, (v) => v.principal),
      totalPaid: sumOf(views, (v) => v.totalPaid),
    },
    collections: {
      count: posted.length,
      amount: centsToDecimal(posted.reduce((s, p) => s + centsFromDb(p.amount), 0)),
      todayCount: todays.length,
      todayAmount: centsToDecimal(todays.reduce((s, p) => s + centsFromDb(p.amount), 0)),
    },
    savings: {
      accounts: open.length,
      balance: centsToDecimal(open.reduce((s, a) => s + centsFromDb(a.balance), 0)),
      depositsToday: total(txns, 'DEPOSIT', today),
      withdrawalsToday: withdrawn(today),
      deposits: total(txns, 'DEPOSIT'),
      withdrawals: withdrawn(),
      interest: total(txns, 'INTEREST'),
    },
    groups: {
      total: groupRows.length,
      active: groupRows.filter((g) => g.status === 'ACTIVE').length,
      fundBalance: centsToDecimal(groupRows.reduce((s, g) => s + centsFromDb(g.fund), 0)),
    },
  };
}

/** Debits and credits of every posted journal line; equal when the ledger balances. */
export async function ledgerCheck(db: AppDb): Promise<{ debits: string; credits: string; difference: string; balanced: boolean; accounts: { code: string; debit: string; credit: string }[] }> {
  const tb = await trialBalance(db);
  const debits = tb.reduce((s, a) => s + a.debit, 0);
  const credits = tb.reduce((s, a) => s + a.credit, 0);
  return {
    debits: centsToDecimal(debits),
    credits: centsToDecimal(credits),
    difference: centsToDecimal(debits - credits),
    balanced: debits === credits,
    accounts: tb.map((a) => ({ code: a.accountCode, debit: centsToDecimal(a.debit), credit: centsToDecimal(a.credit) })),
  };
}

/** Months (YYYY-MM) of posted collections, for charts. */
export async function monthlyCollections(db: AppDb, branchId: string | null, months: string[]): Promise<{ month: string; amount: string }[]> {
  const rows = await db
    .select({ month: sql<string>`substr(${paymentRows.paymentDate}, 1, 7)`, total: sql<string>`sum(${paymentRows.amount})::text` })
    .from(paymentRows)
    .where(and(eq(paymentRows.status, 'POSTED'), branchId ? eq(paymentRows.branchId, branchId) : undefined))
    .groupBy(sql`substr(${paymentRows.paymentDate}, 1, 7)`);
  return months.map((m) => ({ month: m, amount: centsToDecimal(centsFromDb(rows.find((r) => r.month === m)?.total ?? '0')) }));
}
