import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/index';
import { storeDocument, DOCUMENT_BUCKET } from '../db/documentStorage';
import { getServerSupabase } from '../db/supabaseServer';
import { hasAnyPermission, getRolePermissions, normalizeRole, SystemPermission } from '../auth/permissions';
import type { InstallmentStatus } from '../types';
import type { AppDb } from '../kyc/errors';
import { assertKycVerified, claimApplication, decideApplication, kycDossier, kycQueue, releaseApplication, type StaffActor } from '../kyc/service';
import { registerByBranch } from '../onboarding/registration';
import { psgcResolver } from '../onboarding/geography';
import { isKycVerified, kycStatusLabel, normaliseKycStatus } from '../../shared/kyc-core';
import { PERIODS_PER_YEAR, RUNNING_LOAN_STATUSES, centsFromDb, centsToDecimal, daysBetween, normaliseLoanStatus, productToDto, savingsProductToDto, type LoanStatus } from '../../shared/lending';
import { loans as lendingLoans, paymentRows } from '../lending/tables';
import {
  cancelApplication,
  createApplication,
  decideApplication as decideLoan,
  disburseLoan,
  listProducts,
  loanDetail,
  loanSummaries,
  startReview,
  submitApplication,
  type LendingStaff,
} from '../lending/service';
import { claimProof, collectionsOverview, loanPayments, payoffQuote, postPayment, proofQueue, receiptFor, rejectProof, reversePayment, runOverdueCheck, verifyProof } from '../lending/repayment';
import {
  accountDetail,
  changeStatus,
  closeAccount,
  decideWithdrawalRequest,
  deposit,
  listAccounts,
  listSavingsProducts,
  openAccount,
  reconcileSavings,
  runInterestPosting,
  statement,
  withdraw,
  withdrawalRequests,
} from '../savings/service';
import { paymentDeps } from '../payments/config';
import { dailyReport, decidePayoutAccount, needsReview, resolveDeposit, resolvePayout, sweepOnlinePayments } from '../payments/service';
import {
  addMember,
  changeGroupStatus,
  coverFromFund,
  createGroup,
  fundView,
  groupDetail,
  groupMeetings,
  listGroups,
  officers as groupOfficers,
  pendingGroupLoans,
  postCollection,
  recordConsent,
  recordMeeting,
  reconcileGroupFunds,
  refundFund,
  removeMember,
  repayCover,
  setRole,
  updateGroup,
} from '../groups/service';
import { signedKycUrl } from '../kyc/storage';
import { manilaToday } from '../kyc/service';
import { sendError } from './httpErrors';
import { portfolioSummary } from '../reports/portfolio';

// Re-declared locally to avoid importing heavy frontend types into the bundle.
interface InstallmentRow {
  installmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  fees: number;
  totalDue: number;
  amountPaid: number;
  remainingBalance: number;
  status: InstallmentStatus;
  paidDate?: string;
}

export const branchRouter = Router();

// ---------------------------------------------------------------------------
// Context & guards
// ---------------------------------------------------------------------------

interface BranchCtx {
  userId: string;
  staffId: string | null;
  staffName: string;
  staffEmail: string;
  staffRole: string;
  title: string;
  avatar: string;
  branchId: string | null;
  viewAll: boolean;
  permissions: SystemPermission[];
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Today's date in the Philippines (YYYY-MM-DD); the UTC date is still yesterday until 8 a.m. Manila time. */
function todayStr(): string {
  return manilaToday();
}

function genId(prefix: string): string {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}-${suffix}`;
}

function genRef(prefix: string): string {
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

// Governance & oversight roles: granted read visibility across the branch, but
// every mutating request is rejected so their view stays strictly read-only.
const OBSERVER_ROLES = new Set([
  'CREDIT_COMMITTEE',
  'EDUCATION_COMMITTEE',
  'BOARD_OF_DIRECTORS',
  'AUDITOR',
  'ADVISER',
  'LEGAL_OFFICER',
]);

const OBSERVER_READ_PERMISSIONS: SystemPermission[] = [
  'view_all_records',
  'view_client_info',
  'view_transaction_records',
  'review_client_loan_info',
  'monitor_loan_repayment',
  'manage_kyc',
];

function requireBranch(permissions: SystemPermission[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).authUser as
      | { id: string; role: string; staffRole?: string | null; staffId?: string | null; branchId?: string | null; email: string }
      | undefined;

    if (!auth || auth.role !== 'STAFF') {
      return res.status(401).json({ error: 'Branch personnel authentication required. Please sign in.' });
    }

    // Fail closed: a staff login with no staffRole must not inherit
    // ADMINISTRATOR permissions, which would expose every branch mutation.
    if (!auth.staffRole) {
      return res.status(403).json({
        error:
          'Access denied: this staff account has no role assigned. An administrator must set its staff role before it can access branch operations.',
      });
    }

    const staffRole = normalizeRole(auth.staffRole);
    const isObserver = OBSERVER_ROLES.has(staffRole);
    const effectivePermissions = isObserver
      ? Array.from(new Set<SystemPermission>([...getRolePermissions(staffRole), ...OBSERVER_READ_PERMISSIONS]))
      : getRolePermissions(staffRole);
    const db = getDb();
    let staffName = auth.email.split('@')[0] || 'Staff';
    let title = staffRole;
    let avatar = '';
    // The staff record is where an administrator sets the branch (src/staff/assignment.ts);
    // reading it here makes a reassignment apply at once, not at the next sign-in.
    let assignedBranchId: string | null = null;

    if (db && auth.staffId) {
      const rows = await db.select().from(schema.staff).where(eq(schema.staff.id, auth.staffId as string)).limit(1);
      if (rows.length > 0) {
        staffName = rows[0].name || staffName;
        title = rows[0].title || title;
        avatar = rows[0].avatar || '';
        assignedBranchId = rows[0].assignedBranchId || null;
      }
    }

    // A head-office record ('all') keeps the branch its session works in.
    const namesBranch = Boolean(assignedBranchId) && !['all', 'unassigned'].includes(String(assignedBranchId).toLowerCase());
    const rawBranchId = namesBranch ? assignedBranchId : auth.branchId || null;
    const isGlobalBranch = !rawBranchId || rawBranchId === 'all' || rawBranchId.toLowerCase() === 'all';
    // Access to every branch comes only from role permissions. A staff account
    // with no branch assignment is refused below, never widened to all branches.
    const viewAll = hasAnyPermission(staffRole, ['view_all_records', 'manage_users', 'manage_settings']);
    const branchId = isGlobalBranch ? null : rawBranchId;

    const ctx: BranchCtx = {
      userId: auth.id,
      staffId: auth.staffId || null,
      staffName,
      staffEmail: auth.email,
      staffRole,
      title,
      avatar,
      branchId,
      viewAll,
      permissions: effectivePermissions,
    };

    if (isObserver && req.method !== 'GET') {
      return res.status(403).json({
        error: `Role '${staffRole}' has read-only access to the cooperative portal.`,
      });
    }

    if (!viewAll && !branchId) {
      return res.status(403).json({
        error: 'This account is not associated with a branch. Please contact your system administrator.',
      });
    }

    if (permissions.length > 0 && !permissions.some((p) => effectivePermissions.includes(p))) {
      return res.status(403).json({
        error: `Access denied: Role '${staffRole}' lacks required permissions: [${permissions.join(', ')}]`,
        requiredPermissions: permissions,
      });
    }

    (req as any).branchCtx = ctx;
    next();
  };
}

/** The branch session as a KYC/onboarding actor. */
function staffActorOf(ctx: BranchCtx): StaffActor {
  return { kind: 'staff', userId: ctx.userId, staffId: ctx.staffId, name: ctx.staffName, role: ctx.staffRole, branchId: ctx.branchId, viewAll: ctx.viewAll };
}

function ctxOf(req: Request): BranchCtx {
  return (req as any).branchCtx as BranchCtx;
}

function scopeCond(ctx: BranchCtx, branchColumn: any, branchIdParam?: string) {
  if (ctx.viewAll || !ctx.branchId || ctx.branchId === 'all' || ctx.branchId.toLowerCase() === 'all') {
    if (branchIdParam && branchIdParam !== 'all' && branchIdParam.toLowerCase() !== 'all') {
      return eq(branchColumn, branchIdParam);
    }
    return undefined;
  }
  if (branchIdParam && branchIdParam !== ctx.branchId) {
    // If the staff has a specific branch and passes a different branch parameter, respect their branch
    return eq(branchColumn, ctx.branchId as string);
  }
  return eq(branchColumn, ctx.branchId as string);
}

async function audit(
  ctx: BranchCtx,
  action: string,
  details: string,
  type: string,
  extra?: { targetType?: string; targetId?: string }
) {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(schema.auditLogs).values({
      id: genId('log'),
      timestamp: nowIso(),
      action,
      details,
      performedBy: `${ctx.staffName} (${ctx.title})`,
      branchId: ctx.branchId || 'all',
      type,
      userName: ctx.staffName,
      userRole: ctx.staffRole,
      targetType: extra?.targetType || null,
      targetId: extra?.targetId || null,
      ipAddress: 'branch-portal',
    });
  } catch {
    /* ignore */
  }
}

async function notify(
  ctx: BranchCtx,
  type: string,
  title: string,
  message: string,
  extra?: { relatedType?: string; relatedId?: string }
) {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(schema.branchNotifications).values({
      id: genId('n'),
      branchId: ctx.branchId || 'all',
      targetStaffId: null,
      type,
      title,
      message,
      relatedType: extra?.relatedType || null,
      relatedId: extra?.relatedId || null,
      isRead: false,
      createdAt: nowIso(),
    });
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Context / personnel / dashboard / performance / activities
// ---------------------------------------------------------------------------

branchRouter.get('/context', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  let branch: any = null;
  if (db && ctx.branchId) {
    try {
      const rows = await db.select().from(schema.branches).where(eq(schema.branches.id, ctx.branchId)).limit(1);
      if (rows.length > 0) branch = rows[0];
    } catch {
      /* ignore */
    }
  }
  res.json({
    success: true,
    personnel: {
      staffId: ctx.staffId,
      name: ctx.staffName,
      email: ctx.staffEmail,
      role: ctx.staffRole,
      title: ctx.title,
      avatar: ctx.avatar,
    },
    branch,
    permissions: getRolePermissions(ctx.staffRole),
    viewAll: ctx.viewAll,
  });
});

branchRouter.get('/personnel', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  let branch: any = null;
  if (db && ctx.branchId) {
    try {
      const rows = await db.select().from(schema.branches).where(eq(schema.branches.id, ctx.branchId)).limit(1);
      if (rows.length > 0) branch = rows[0];
    } catch {
      /* ignore */
    }
  }
  res.json({
    success: true,
    personnel: {
      staffId: ctx.staffId,
      name: ctx.staffName,
      email: ctx.staffEmail,
      role: ctx.staffRole,
      title: ctx.title,
      avatar: ctx.avatar,
      accountStatus: 'Active',
    },
    branch,
    permissions: getRolePermissions(ctx.staffRole),
  });
});

async function loadBranchData(ctx: BranchCtx, req?: Request) {
  const db = getDb();
  const bid = ctx.viewAll && req?.query?.branchId ? String(req.query.branchId) : ctx.branchId;
  if (!db) return { borrowers: [], loans: [], payments: [], savingsAccounts: [], savingsTransactions: [], transactions: [], groups: [], applications: [] };

  const borrowerCond = ctx.viewAll && !bid ? undefined : eq(schema.borrowers.branchId, bid as string);
  const [borrowers, loans, payments, savingsAccounts, savingsTransactions, transactions, groups, applications] = await Promise.all([
    db.select().from(schema.borrowers).where(borrowerCond),
    db.select().from(schema.loans).where(ctx.viewAll && !bid ? undefined : eq(schema.loans.branchId, bid as string)),
    db.select().from(schema.payments).where(ctx.viewAll && !bid ? undefined : eq(schema.payments.branchId, bid as string)),
    db.select().from(schema.savingsAccounts),
    db.select().from(schema.savingsTransactions),
    db.select().from(schema.financialTransactions).where(ctx.viewAll && !bid ? undefined : eq(schema.financialTransactions.branchId, bid as string)),
    db.select().from(schema.solidarityGroups).where(ctx.viewAll && !bid ? undefined : eq(schema.solidarityGroups.branchId, bid as string)),
    db.select().from(schema.membershipApplications).where(ctx.viewAll && !bid ? undefined : eq(schema.membershipApplications.branchId, bid as string)),
  ]);
  const memberIds = new Set(borrowers.map((b: any) => b.id));
  const all = ctx.viewAll && !bid;
  const savingsScoped = all ? savingsAccounts : savingsAccounts.filter((a: any) => memberIds.has(a.memberId));
  const savingsTxScoped = all ? savingsTransactions : savingsTransactions.filter((t: any) => memberIds.has(t.memberId));
  return { borrowers, loans, payments, savingsAccounts: savingsScoped, savingsTransactions: savingsTxScoped, transactions, groups, applications };
}

/** The branch in view: the staff member's own, or (all-branch roles) the one asked for, or every branch. */
function reportBranch(ctx: BranchCtx, req: Request): string | null {
  return ctx.viewAll ? (req.query.branchId ? String(req.query.branchId) : null) : ctx.branchId;
}

branchRouter.get('/dashboard', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'The database is not available right now.' });
  try {
    // The same figures as the admin reports and the member portal (src/reports/portfolio.ts).
    const p = await portfolioSummary(db as unknown as AppDb, { branchId: reportBranch(ctx, req) });
    res.json({
      success: true,
      data: {
        personnel: { name: ctx.staffName, role: ctx.staffRole, title: ctx.title, branchId: ctx.branchId },
        asOf: nowIso(),
        portfolio: p,
        summary: {
          totalClients: p.members.total,
          activeClients: p.members.active,
          pendingVerification: p.members.kycAwaitingReview,
          activeLoans: p.loans.running,
          outstandingBalance: p.loans.outstanding,
          todayCollections: p.collections.todayAmount,
          todayTransactionCount: p.collections.todayCount,
          pendingApplications: p.loans.applications,
          totalSavings: p.savings.balance,
          todayDeposits: p.savings.depositsToday,
          todayWithdrawals: p.savings.withdrawalsToday,
          overdueLoans: p.loans.overdue,
          overdueOutstanding: p.loans.overdueOutstanding,
        },
      },
    });
  } catch (err) {
    sendError(res, err, 'branch-dashboard');
  }
});

branchRouter.get('/performance', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const data = await loadBranchData(ctx, req);
  const range = String(req.query.range || 'month');
  const now = new Date();
  const from = new Date(now);
  if (range === 'today') from.setDate(now.getDate() - 1);
  else if (range === 'week') from.setDate(now.getDate() - 7);
  else if (range === 'year') from.setFullYear(now.getFullYear() - 1);
  else from.setMonth(now.getMonth() - 1);
  const fromStr = from.toISOString().split('T')[0];

  const loansArr = data.loans as any[];
  const portfolio = {
    active: loansArr.filter((l) => ['Disbursed', 'Active'].includes(l.status)).length,
    completed: loansArr.filter((l) => ['Completed', 'Settled', 'Fully Paid'].includes(l.status)).length,
    overdue: loansArr.filter((l) => l.status === 'In Arrears' || (l.daysInArrears && l.daysInArrears > 0)).length,
    pending: loansArr.filter((l) => ['Draft', 'Submitted', 'Under Review', 'For Assessment', 'Approved'].includes(l.status)).length,
  };

  const paymentsArr = (data.payments as any[]).filter((p) => p.paymentDate >= fromStr);
  const byDate = new Map<string, number>();
  paymentsArr.forEach((p) => byDate.set(p.paymentDate, (byDate.get(p.paymentDate) || 0) + p.amount));
  const daily = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const weeklyMap = new Map<string, number>();
  paymentsArr.forEach((p) => {
    const d = new Date(p.paymentDate + 'T00:00:00');
    const wkDate = new Date(d);
    wkDate.setDate(d.getDate() - d.getDay());
    const key = wkDate.toISOString().split('T')[0];
    weeklyMap.set(key, (weeklyMap.get(key) || 0) + p.amount);
  });
  const weekly = [...weeklyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const monthlyMap = new Map<string, number>();
  paymentsArr.forEach((p) => {
    const key = String(p.paymentDate).slice(0, 7);
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + p.amount);
  });
  const monthly = [...monthlyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const borrowersArr = data.borrowers as any[];
  const clientsSince = borrowersArr.filter((b) => (b.membershipDate || b.joinedDate || '') >= fromStr);
  const clientGrowth = new Map<string, number>();
  clientsSince.forEach((b) => {
    const key = String(b.membershipDate || b.joinedDate || '').slice(0, 7);
    clientGrowth.set(key, (clientGrowth.get(key) || 0) + 1);
  });

  const savingsTxArr = (data.savingsTransactions as any[]).filter((t) => t.date >= fromStr);
  const deposits = savingsTxArr.filter((t) => t.type === 'Deposit').reduce((s, t) => s + t.amount, 0);
  const withdrawals = savingsTxArr.filter((t) => t.type === 'Withdrawal').reduce((s, t) => s + t.amount, 0);

  res.json({
    success: true,
    data: {
      range,
      portfolio,
      collections: { daily, weekly, monthly, total: paymentsArr.reduce((s, p) => s + p.amount, 0) },
      clientGrowth: {
        newClients: clientsSince.length,
        active: borrowersArr.filter((b) => b.memberStatus === 'Active').length,
        inactive: borrowersArr.filter((b) => ['Inactive', 'Irregular', 'Suspended', 'Rejected'].includes(b.memberStatus)).length,
        monthly: [...clientGrowth.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      },
      savings: {
        deposits: Math.round(deposits * 100) / 100,
        withdrawals: Math.round(withdrawals * 100) / 100,
        net: Math.round((deposits - withdrawals) * 100) / 100,
      },
    },
  });
});

branchRouter.get('/activities', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  const limit = Math.min(50, Number(req.query.limit) || 20);
  if (!db) return res.json({ success: true, data: [] });
  const rows = await db
    .select()
    .from(schema.auditLogs)
    .where(scopeCond(ctx, schema.auditLogs.branchId, req.query.branchId ? String(req.query.branchId) : undefined))
    .orderBy(desc(schema.auditLogs.timestamp))
    .limit(limit);
  res.json({ success: true, data: rows });
});

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

branchRouter.get('/clients', requireBranch(['view_client_info', 'register_clients', 'manage_kyc', 'assist_clients']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });
  const conditions: any[] = [];
  const scope = scopeCond(ctx, schema.borrowers.branchId, req.query.branchId ? String(req.query.branchId) : undefined);
  if (scope) conditions.push(scope);

  const q = String(req.query.search || '').trim().toLowerCase();
  if (q) {
    conditions.push(
      or(
        ilike(schema.borrowers.fullName, `%${q}%`),
        ilike(schema.borrowers.borrowerNumber, `%${q}%`),
        ilike(schema.borrowers.phone, `%${q}%`)
      ) as any
    );
  }
  const status = String(req.query.status || '');
  if (status) conditions.push(ilike(schema.borrowers.memberStatus, `%${status}%`) as any);
  const kyc = String(req.query.kyc || '');
  if (kyc) conditions.push(ilike(schema.borrowers.kycStatus, `%${kyc}%`) as any);

  let rows = await db.select().from(schema.borrowers).where(conditions.length ? and(...conditions) : undefined);

  const flagHasLoan = req.query.hasActiveLoan === 'true' || req.query.hasOverdueLoan === 'true';
  if (flagHasLoan) {
    const loans = await db.select().from(schema.loans).where(scopeCond(ctx, schema.loans.branchId, req.query.branchId ? String(req.query.branchId) : undefined));
    const withActive = new Set(loans.filter((l: any) => ['Disbursed', 'Active'].includes(l.status)).map((l: any) => l.borrowerId));
    const withOverdue = new Set(loans.filter((l: any) => l.status === 'In Arrears' || (l.daysInArrears && l.daysInArrears > 0)).map((l: any) => l.borrowerId));
    rows = rows.filter((b: any) =>
      req.query.hasActiveLoan === 'true' && req.query.hasOverdueLoan === 'true'
        ? withActive.has(b.id) && withOverdue.has(b.id)
        : req.query.hasActiveLoan === 'true'
          ? withActive.has(b.id)
          : withOverdue.has(b.id)
    );
  }

  const sort = String(req.query.sort || 'joinedDateDesc');
  rows = rows.sort((a: any, b: any) => {
    if (sort === 'nameAsc') return a.fullName.localeCompare(b.fullName);
    if (sort === 'nameDesc') return b.fullName.localeCompare(a.fullName);
    if (sort === 'membershipAsc') return String(a.membershipDate).localeCompare(String(b.membershipDate));
    return String(b.joinedDate || b.membershipDate || '').localeCompare(String(a.joinedDate || a.membershipDate || ''));
  });

  res.json({ success: true, data: rows });
});

branchRouter.get('/clients/:id', requireBranch(['view_client_info', 'register_clients', 'manage_kyc', 'assist_clients']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(404).json({ error: 'Client not found' });
  const rows = await db.select().from(schema.borrowers).where(and(eq(schema.borrowers.id, req.params.id), scopeCond(ctx, schema.borrowers.branchId) as any));
  if (rows.length === 0) return res.status(404).json({ error: 'Client not found in this branch.' });
  const client = rows[0];
  const [loans, docs, savingsAttrs] = await Promise.all([
    db.select().from(schema.loans).where(eq(schema.loans.borrowerId, client.id as string)),
    db.select().from(schema.documents).where(eq(schema.documents.clientId, client.id as string)),
    db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.memberId, client.id as string)),
  ]);
  res.json({ success: true, data: { client, loans, documents: docs, savingsAccounts: savingsAttrs } });
});

/** Staff-assisted registration (src/onboarding/registration.ts): validated, duplicate-checked, audited. */
branchRouter.post('/clients', requireBranch(['register_clients', 'manage_kyc', 'assist_clients']), async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const result = await registerByBranch(db as unknown as AppDb, staffActorOf(ctxOf(req)), req.body || {}, { geo: psgcResolver });
    res.status(201).json({ success: true, data: { id: result.borrowerId, borrowerNumber: result.borrowerNumber } });
  } catch (err) {
    sendError(res, err, 'branch-register');
  }
});

branchRouter.put('/clients/:id', requireBranch(['register_clients', 'manage_kyc', 'assist_clients']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const identityFields = ['fullName', 'dateOfBirth', 'phone', 'email'].filter((k) => body[k] !== undefined);
  if (identityFields.length > 0) {
    const current = await db.select({ kycStatus: schema.borrowers.kycStatus }).from(schema.borrowers).where(and(eq(schema.borrowers.id, req.params.id), scopeCond(ctx, schema.borrowers.branchId) as any)).limit(1);
    if (!current[0]) return res.status(404).json({ error: 'Client not found in this branch.' });
    const status = normaliseKycStatus(current[0].kycStatus);
    if (['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SUSPENDED'].includes(status)) {
      return res.status(409).json({
        error: `The member's KYC is ${kycStatusLabel(status).toLowerCase()}, so ${identityFields.join(', ')} cannot be changed here. Ask the member to update their KYC application instead.`,
      });
    }
  }
  const row: any = {
    ...(body.fullName !== undefined ? { fullName: String(body.fullName) } : {}),
    ...(body.phone !== undefined ? { phone: String(body.phone) } : {}),
    ...(body.email !== undefined ? { email: String(body.email) } : {}),
    ...(body.address !== undefined ? { address: String(body.address) } : {}),
    ...(body.dateOfBirth !== undefined ? { dateOfBirth: String(body.dateOfBirth) } : {}),
    ...(body.gender !== undefined ? { gender: String(body.gender) } : {}),
    ...(body.civilStatus !== undefined ? { civilStatus: String(body.civilStatus) } : {}),
    ...(body.employmentStatus !== undefined ? { employmentStatus: String(body.employmentStatus) } : {}),
    ...(body.employerOrBusiness !== undefined ? { employerOrBusiness: String(body.employerOrBusiness) } : {}),
    ...(body.occupation !== undefined ? { occupation: String(body.occupation) } : {}),
    ...(body.monthlyIncome !== undefined ? { monthlyIncome: Number(body.monthlyIncome) } : {}),
    ...(body.monthlyExpenses !== undefined ? { monthlyExpenses: Number(body.monthlyExpenses) } : {}),
    ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
  };
  if (!ctx.viewAll) finalizeBranchField(row);
  await db.update(schema.borrowers).set(row).where(and(eq(schema.borrowers.id, req.params.id), scopeCond(ctx, schema.borrowers.branchId) as any));
  await audit(ctx, 'CLIENT_UPDATED', `Updated client profile ${req.params.id}`, 'BORROWER', { targetType: 'Borrower', targetId: req.params.id });
  res.json({ success: true });
});

function finalizeBranchField(_row: any) {
  /* explicit no-op: branch assignment is enforced by the scope, not by client payload */
}

// ---------------------------------------------------------------------------
// KYC (Know Your Customer) Review & Verification
// ---------------------------------------------------------------------------

branchRouter.get('/kyc-queue', requireBranch(['manage_kyc', 'view_client_info', 'assist_clients']), async (req, res) => {
  try {
    const ctx = ctxOf(req);
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const { items, counts } = await kycQueue(db as unknown as AppDb, { branchId: ctx.branchId, viewAll: ctx.viewAll }, {
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      branchId: req.query.branchId ? String(req.query.branchId) : undefined,
      submittedFrom: req.query.submittedFrom ? String(req.query.submittedFrom) : undefined,
      submittedTo: req.query.submittedTo ? String(req.query.submittedTo) : undefined,
    });
    res.json({ success: true, data: items, counts });
  } catch (err) {
    sendError(res, err, 'branch-kyc-queue');
  }
});

branchRouter.get('/kyc/:id', requireBranch(['manage_kyc', 'view_client_info', 'assist_clients']), async (req, res) => {
  try {
    const ctx = ctxOf(req);
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    res.json({ success: true, data: await kycDossier(db as unknown as AppDb, { branchId: ctx.branchId, viewAll: ctx.viewAll }, req.params.id) });
  } catch (err) {
    sendError(res, err, 'branch-kyc-dossier');
  }
});

branchRouter.post('/kyc/:id/claim', requireBranch(['manage_kyc']), async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    res.json({ success: true, ...(await claimApplication(db as unknown as AppDb, staffActorOf(ctxOf(req)), req.params.id)) });
  } catch (err) {
    sendError(res, err, 'branch-kyc-claim');
  }
});

branchRouter.post('/kyc/:id/release', requireBranch(['manage_kyc']), async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const reason = req.body?.reason ? String(req.body.reason) : null;
    res.json({ success: true, ...(await releaseApplication(db as unknown as AppDb, staffActorOf(ctxOf(req)), req.params.id, reason)) });
  } catch (err) {
    sendError(res, err, 'branch-kyc-release');
  }
});

/** Approve, reject or request resubmission, always with a reason the member sees. */
branchRouter.post('/kyc/:id/review', requireBranch(['manage_kyc']), async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const body = req.body || {};
    const result = await decideApplication(db as unknown as AppDb, staffActorOf(ctxOf(req)), req.params.id, {
      decision: body.decision,
      reason: body.reason ?? body.notes,
      sections: body.sections,
      allowResubmission: body.allowResubmission,
      faceReviewed: body.faceReviewed,
      idempotencyKey: req.get('Idempotency-Key') || null,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, err, 'branch-kyc-review');
  }
});

// ---------------------------------------------------------------------------
// Loan applications, decisions and disbursement (src/lending/service.ts)
// ---------------------------------------------------------------------------

function lendingStaffOf(ctx: BranchCtx): LendingStaff {
  return { ...staffActorOf(ctx), permissions: ctx.permissions };
}

const LOAN_READ_PERMISSIONS: SystemPermission[] = ['review_client_loan_info', 'process_loan_applications', 'manage_loan_applications', 'monitor_loan_repayment', 'disburse_loans'];

function loanListConditions(ctx: BranchCtx, req: Request) {
  const conditions: any[] = [scopeCond(ctx, schema.loans.branchId, req.query.branchId ? String(req.query.branchId) : undefined)].filter(Boolean);
  const statuses = String(req.query.status || '')
    .split(',')
    .map((s) => normaliseLoanStatus(s.trim()))
    .filter((s): s is LoanStatus => !!s);
  if (statuses.length) conditions.push(inArray(schema.loans.status, statuses));
  const search = String(req.query.search || '').trim();
  if (search) {
    conditions.push(
      or(ilike(schema.loans.borrowerName, `%${search}%`), ilike(schema.loans.loanNumber, `%${search}%`), ilike(schema.loans.borrowerPhone, `%${search}%`)) as any,
    );
  }
  const product = String(req.query.product || '').trim();
  if (product) conditions.push(ilike(schema.loans.productName, `%${product}%`) as any);
  const officer = String(req.query.officer || '').trim();
  if (officer) conditions.push(ilike(schema.loans.loanOfficerName, `%${officer}%`) as any);
  const from = String(req.query.from || '').trim();
  if (from) conditions.push(gte(schema.loans.applicationDate, from));
  const to = String(req.query.to || '').trim();
  if (to) conditions.push(lte(schema.loans.applicationDate, to));
  return conditions;
}

async function listLoans(req: Request, res: Response) {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const conditions = loanListConditions(ctx, req);
  const rows = await db
    .select()
    .from(schema.loans)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.loans.applicationDate));
  res.json({ success: true, data: rows });
}

branchRouter.get('/loan-applications', requireBranch(['process_loan_applications', 'review_client_loan_info', 'manage_loan_applications', 'disburse_loans']), listLoans);
branchRouter.get('/loans', requireBranch(LOAN_READ_PERMISSIONS), listLoans);

branchRouter.get('/loan-products', requireBranch(['process_loan_applications', 'review_client_loan_info', 'monitor_loan_repayment']), async (_req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const products = await listProducts(db as unknown as AppDb);
    res.json({ success: true, data: products.map(productToDto) });
  } catch (err) {
    sendError(res, err, 'branch-loan-products');
  }
});

branchRouter.post('/loan-applications', requireBranch(['process_loan_applications']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const body = req.body || {};
    const result = await createApplication(db as unknown as AppDb, lendingStaffOf(ctx), { ...body, requestKey: req.get('Idempotency-Key') || body.requestKey });
    res.status(result.replayed ? 200 : 201).json({ success: true, replayed: result.replayed, data: result.loan });
  } catch (err) {
    sendError(res, err, 'branch-loan-apply');
  }
});

branchRouter.get('/loans/:id', requireBranch(LOAN_READ_PERMISSIONS), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const view = await loanDetail(db as unknown as AppDb, lendingStaffOf(ctx), req.params.id);
    const payments = await loanPayments(db as unknown as AppDb, view.id);
    const borrower = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, view.borrowerId)).limit(1);
    res.json({ success: true, data: { view, payments, borrower: borrower[0] || null } });
  } catch (err) {
    sendError(res, err, 'branch-loan-detail');
  }
});

function loanAction(
  permissions: SystemPermission[],
  run: (db: AppDb, staff: LendingStaff, req: Request) => Promise<unknown>,
  context: string,
) {
  branchRouter.post(`/loans/:id/${context}`, requireBranch(permissions), async (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    try {
      const result = await run(db as unknown as AppDb, lendingStaffOf(ctxOf(req)), req);
      res.json({ success: true, data: result });
    } catch (err) {
      sendError(res, err, `branch-loan-${context}`);
    }
  });
}

loanAction(['process_loan_applications'], (db, staff, req) => submitApplication(db, staff, req.params.id, req.body || {}), 'submit');
loanAction(['manage_loan_applications'], (db, staff, req) => startReview(db, staff, req.params.id), 'review');
loanAction(['manage_loan_applications'], (db, staff, req) => decideLoan(db, staff, req.params.id, req.body || {}), 'decision');
loanAction(['process_loan_applications', 'manage_loan_applications'], (db, staff, req) => cancelApplication(db, staff, req.params.id, (req.body || {}).reason), 'cancel');
loanAction(
  ['disburse_loans'],
  (db, staff, req) => disburseLoan(db, staff, req.params.id, req.body || {}, req.get('Idempotency-Key')),
  'disburse',
);

branchRouter.post('/loans/:id/assessment', requireBranch(['process_loan_applications', 'review_client_loan_info']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  try {
    const view = await loanDetail(db as unknown as AppDb, lendingStaffOf(ctx), req.params.id);
    const borrower = (await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, view.borrowerId)).limit(1))[0];

    // Income figures are the officer's estimates; they guide the decision and move no money.
    const monthlyIncome = Number(body.monthlyIncome) || Number(borrower?.monthlyIncome) || 0;
    const monthlyExpenses = Number(body.monthlyExpenses) || Number(borrower?.monthlyExpenses) || 0;
    const existingObligations = Number(body.existingObligations) || 0;
    const disposableIncome = Math.max(0, monthlyIncome - monthlyExpenses - existingObligations);
    const repaymentCapacityMonthly = Math.round(disposableIncome * 0.5 * 100) / 100;

    const installment = view.schedule[0] ? centsFromDb(view.schedule[0].total) : 0;
    const perMonth = PERIODS_PER_YEAR[view.frequency as keyof typeof PERIODS_PER_YEAR] / 12;
    const monthlyInstallment = (installment / 100) * perMonth;
    const debtRatio = monthlyIncome > 0 ? (existingObligations + monthlyInstallment) / monthlyIncome : 0;
    const affordableShare = monthlyInstallment > 0 ? Math.min(1, repaymentCapacityMonthly / monthlyInstallment) : 1;
    const recommendedAmount = Math.floor((centsFromDb(view.principal) / 100) * affordableShare / 100) * 100;

    const riskIndicators: string[] = [];
    if (!borrower) riskIndicators.push('No member record found for this application');
    else {
      if (!isKycVerified(borrower.kycStatus)) riskIndicators.push('Member KYC is not verified');
      if (monthlyIncome > 0 && existingObligations / monthlyIncome > 0.4) riskIndicators.push('Existing obligations exceed 40% of declared income');
      if (borrower.memberStatus !== 'Active') riskIndicators.push(`Member is not active (${borrower.memberStatus})`);
      if (debtRatio > 0.6) riskIndicators.push('Repayment debt ratio exceeds 60%');
    }
    if (recommendedAmount < centsFromDb(view.principal) / 100) riskIndicators.push('Requested amount exceeds the estimated affordable amount');

    const assessment = {
      monthlyIncome,
      monthlyExpenses,
      existingObligations,
      disposableIncome,
      repaymentCapacityMonthly,
      debtRatio,
      recommendedAmount,
      estimatedInstallment: installment / 100,
      riskIndicators,
      isEstimate: true,
      note: 'These figures are estimates to guide the decision. Approval is a separate, recorded step.',
      assessedBy: ctx.staffName,
      assessedAt: nowIso(),
    };
    await db.update(schema.loans).set({ underwritingReport: assessment as any }).where(eq(schema.loans.id, view.id));
    await audit(ctx, 'LOAN_ASSESSED', `Assessment recorded for ${view.loanNumber}. Estimated affordable amount ₱${recommendedAmount.toLocaleString()}.`, 'LOAN', { targetType: 'Loan', targetId: view.id });
    res.json({ success: true, data: assessment });
  } catch (err) {
    sendError(res, err, 'branch-loan-assessment');
  }
});

// ---------------------------------------------------------------------------
// Payments, proofs and collections (src/lending/repayment.ts)
// ---------------------------------------------------------------------------

branchRouter.get('/collections/today', requireBranch(['process_loan_repayments', 'view_transaction_records']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const today = manilaToday();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(and(scopeCond(ctx, schema.payments.branchId, req.query.branchId ? String(req.query.branchId) : undefined) as any, eq(schema.payments.paymentDate, today), eq(schema.payments.status, 'POSTED')));
  const views = rows.map((r) => ({ ...r, amountCents: centsFromDb(String(r.amount)) }));
  const total = views.reduce((s, p) => s + p.amountCents, 0);
  const cash = views.filter((p) => p.paymentMethod === 'CASH').reduce((s, p) => s + p.amountCents, 0);
  res.json({
    success: true,
    data: {
      payments: rows,
      totals: { total: centsToDecimal(total), count: rows.length, cash: centsToDecimal(cash), other: centsToDecimal(total - cash) },
    },
  });
});

function repaymentRoute(
  method: 'get' | 'post',
  path: string,
  permissions: SystemPermission[],
  run: (db: AppDb, staff: LendingStaff, req: Request) => Promise<unknown>,
  context: string,
) {
  branchRouter[method](path, requireBranch(permissions), async (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    try {
      res.json({ success: true, data: await run(db as unknown as AppDb, lendingStaffOf(ctxOf(req)), req) });
    } catch (err) {
      sendError(res, err, `branch-${context}`);
    }
  });
}

const PAYMENT_READ: SystemPermission[] = ['process_loan_repayments', 'monitor_loan_repayment', 'review_client_loan_info', 'view_transaction_records'];

repaymentRoute('get', '/loans/:id/payoff', PAYMENT_READ, (db, s, req) => payoffQuote(db, s, req.params.id), 'payoff');
repaymentRoute('get', '/loans/:id/payments', PAYMENT_READ, async (db, s, req) => {
  await loanDetail(db, s, req.params.id);
  return loanPayments(db, req.params.id);
}, 'loan-payments');
repaymentRoute('post', '/loans/:id/payments', ['process_loan_repayments'], (db, s, req) => postPayment(db, s, req.params.id, req.body || {}, req.get('Idempotency-Key')), 'post-payment');
repaymentRoute('get', '/payments/:id/receipt', PAYMENT_READ, (db, s, req) => receiptFor(db, s, req.params.id), 'payment-receipt');
repaymentRoute('post', '/payments/:id/reverse', ['approve_sensitive_operations'], (db, s, req) => reversePayment(db, s, req.params.id, (req.body || {}).reason), 'reverse-payment');

repaymentRoute('get', '/payment-proofs', ['process_loan_repayments'], async (db, s, req) => {
  const proofs = await proofQueue(db, s, req.query.status ? String(req.query.status) : undefined);
  const withFiles = await Promise.all(
    proofs.map(async (p) => {
      const m = /^(local|supabase):(.+)$/.exec(p.storageRef ?? '');
      let fileUrl: string | null = null;
      if (m) {
        try {
          fileUrl = await signedKycUrl({ backend: m[1] as 'local' | 'supabase', path: m[2] });
        } catch {
          fileUrl = null;
        }
      }
      return { ...p, storageRef: undefined, fileUrl };
    }),
  );
  const counts: Record<string, number> = {};
  for (const p of await proofQueue(db, s)) counts[p.status] = (counts[p.status] || 0) + 1;
  return { proofs: withFiles, counts };
}, 'payment-proofs');
repaymentRoute('post', '/payment-proofs/:id/claim', ['process_loan_repayments'], (db, s, req) => claimProof(db, s, req.params.id), 'claim-proof');
repaymentRoute('post', '/payment-proofs/:id/verify', ['process_loan_repayments'], (db, s, req) => verifyProof(db, s, req.params.id, req.body || {}), 'verify-proof');
repaymentRoute('post', '/payment-proofs/:id/reject', ['process_loan_repayments'], (db, s, req) => rejectProof(db, s, req.params.id, (req.body || {}).reason), 'reject-proof');

repaymentRoute('get', '/collections/overdue', ['monitor_loan_repayment', 'process_loan_repayments', 'view_all_records'], (db, s) => collectionsOverview(db, s), 'collections');
repaymentRoute('post', '/collections/run-overdue-check', ['monitor_loan_repayment', 'process_loan_repayments'], (db, s) => runOverdueCheck(db, manilaToday(), { branchId: s.viewAll ? null : s.branchId }), 'overdue-check');

// ---------------------------------------------------------------------------
// Savings (src/savings/service.ts)
// ---------------------------------------------------------------------------

const SAVINGS_READ: SystemPermission[] = ['process_savings_deposits', 'process_savings_withdrawals', 'view_transaction_records', 'view_all_records'];

// Fixed paths are registered before '/savings/:id' so they are not read as account ids.
repaymentRoute('get', '/savings/products', SAVINGS_READ, async (db) => (await listSavingsProducts(db)).map(savingsProductToDto), 'savings-products');
repaymentRoute('get', '/savings/withdrawal-requests', SAVINGS_READ, (db, s, req) => withdrawalRequests(db, s, req.query.status ? String(req.query.status) : 'PENDING'), 'savings-requests');
repaymentRoute('post', '/savings/withdrawal-requests/:id/decision', ['process_savings_withdrawals'], (db, s, req) => decideWithdrawalRequest(db, s, req.params.id, req.body || {}), 'savings-request-decision');
repaymentRoute('get', '/savings/reconcile', ['view_all_records', 'approve_sensitive_operations', 'manage_settings'], (db) => reconcileSavings(db), 'savings-reconcile');
repaymentRoute('post', '/savings/run-interest', ['approve_sensitive_operations', 'manage_settings'], (db) => runInterestPosting(db, manilaToday()), 'savings-interest');
repaymentRoute('post', '/savings/open', ['process_savings_deposits'], (db, s, req) => openAccount(db, s, req.body || {}, req.get('Idempotency-Key')), 'savings-open');

// Online payments (src/payments/service.ts): problem payments, payout accounts to verify, daily report.
repaymentRoute('get', '/payments/review', SAVINGS_READ, (db, s) => needsReview(db, s), 'payments-review');
repaymentRoute('get', '/payments/daily-report', SAVINGS_READ, (db, s, req) => dailyReport(db, paymentDeps(), s, req.query.date), 'payments-daily-report');
repaymentRoute('post', '/payments/deposits/:id/resolve', ['process_savings_deposits'], (db, s, req) => resolveDeposit(db, paymentDeps(), s, req.params.id, req.body || {}), 'payments-deposit-resolve');
repaymentRoute('post', '/payments/payouts/:id/resolve', ['process_savings_withdrawals'], (db, s, req) => resolvePayout(db, paymentDeps(), s, req.params.id, req.body || {}), 'payments-payout-resolve');
repaymentRoute('post', '/payments/payout-accounts/:id/decision', ['process_savings_withdrawals'], (db, s, req) => decidePayoutAccount(db, s, req.params.id, req.body || {}), 'payments-payout-account');
repaymentRoute('post', '/payments/check-now', ['process_savings_deposits', 'process_savings_withdrawals'], (db) => sweepOnlinePayments(db, paymentDeps()), 'payments-sweep');

repaymentRoute('get', '/savings', SAVINGS_READ, (db, s, req) =>
  listAccounts(db, s, { status: req.query.status ? String(req.query.status) : undefined, search: req.query.search ? String(req.query.search) : undefined }), 'savings-list');
repaymentRoute('get', '/savings/:id', SAVINGS_READ, (db, s, req) => accountDetail(db, s, req.params.id), 'savings-detail');
repaymentRoute('get', '/savings/:id/statement', SAVINGS_READ, (db, s, req) =>
  statement(db, s, req.params.id, { from: req.query.from ? String(req.query.from) : undefined, to: req.query.to ? String(req.query.to) : undefined }), 'savings-statement');
repaymentRoute('post', '/savings/:id/deposit', ['process_savings_deposits'], (db, s, req) => deposit(db, s, req.params.id, req.body || {}, req.get('Idempotency-Key')), 'savings-deposit');
repaymentRoute('post', '/savings/:id/withdraw', ['process_savings_withdrawals'], (db, s, req) => withdraw(db, s, req.params.id, req.body || {}, req.get('Idempotency-Key')), 'savings-withdraw');
repaymentRoute('post', '/savings/:id/close', ['process_savings_withdrawals'], (db, s, req) => closeAccount(db, s, req.params.id, req.body || {}, req.get('Idempotency-Key')), 'savings-close');
repaymentRoute('post', '/savings/:id/status', ['approve_sensitive_operations', 'process_savings_withdrawals'], (db, s, req) =>
  changeStatus(db, s, req.params.id, (req.body || {}).action, (req.body || {}).reason), 'savings-status');

// ---------------------------------------------------------------------------
// Groups and the solidarity fund (src/groups/service.ts)
// ---------------------------------------------------------------------------

const GROUP_READ: SystemPermission[] = ['view_client_info', 'manage_loan_applications', 'process_loan_applications', 'process_loan_repayments', 'view_all_records'];

repaymentRoute('get', '/groups/officers', ['manage_loan_applications'], (db, s, req) => groupOfficers(db, s, req.query.branchId ? String(req.query.branchId) : undefined), 'group-officers');
repaymentRoute('get', '/groups/reconcile', ['view_all_records', 'approve_sensitive_operations', 'manage_settings'], (db) => reconcileGroupFunds(db), 'group-reconcile');
repaymentRoute('get', '/groups', GROUP_READ, (db, s, req) =>
  listGroups(db, s, { status: req.query.status ? String(req.query.status) : undefined, search: req.query.search ? String(req.query.search) : undefined }), 'groups');
repaymentRoute('post', '/groups', ['manage_loan_applications'], (db, s, req) => createGroup(db, s, req.body || {}), 'group-create');
repaymentRoute('get', '/groups/:id', GROUP_READ, (db, s, req) => groupDetail(db, s, req.params.id), 'group-detail');
repaymentRoute('post', '/groups/:id', ['manage_loan_applications'], (db, s, req) => updateGroup(db, s, req.params.id, req.body || {}), 'group-update');
repaymentRoute('post', '/groups/:id/status', ['manage_loan_applications', 'approve_sensitive_operations'], (db, s, req) =>
  changeGroupStatus(db, s, req.params.id, (req.body || {}).action, (req.body || {}).reason), 'group-status');
repaymentRoute('post', '/groups/:id/members', ['manage_loan_applications'], (db, s, req) => addMember(db, s, req.params.id, req.body || {}), 'group-add-member');
repaymentRoute('post', '/groups/:id/members/:borrowerId/remove', ['manage_loan_applications'], (db, s, req) =>
  removeMember(db, s, req.params.id, req.params.borrowerId, (req.body || {}).reason), 'group-remove-member');
repaymentRoute('post', '/groups/:id/members/:borrowerId/role', ['manage_loan_applications'], (db, s, req) =>
  setRole(db, s, req.params.id, req.params.borrowerId, (req.body || {}).role), 'group-role');
repaymentRoute('get', '/groups/:id/loans', GROUP_READ, (db, s, req) => pendingGroupLoans(db, s, req.params.id), 'group-loans');
repaymentRoute('post', '/loans/:id/group-consent', ['manage_loan_applications'], (db, s, req) => recordConsent(db, s, req.params.id, req.body || {}), 'group-consent');
repaymentRoute('get', '/groups/:id/meetings', GROUP_READ, (db, s, req) => groupMeetings(db, s, req.params.id), 'group-meetings');
repaymentRoute('post', '/groups/:id/meetings', ['manage_loan_applications'], (db, s, req) => recordMeeting(db, s, req.params.id, req.body || {}), 'group-meeting');
repaymentRoute('get', '/groups/:id/fund', GROUP_READ, (db, s, req) => fundView(db, s, req.params.id), 'group-fund');
repaymentRoute('post', '/groups/:id/collections', ['process_loan_repayments'], (db, s, req) => postCollection(db, s, req.params.id, req.body || {}, req.get('Idempotency-Key')), 'group-collection');
repaymentRoute('post', '/groups/:id/covers', ['approve_sensitive_operations'], (db, s, req) => coverFromFund(db, s, req.params.id, req.body || {}, req.get('Idempotency-Key')), 'group-cover');
repaymentRoute('post', '/groups/:id/cover-repayments', ['process_loan_repayments'], (db, s, req) => repayCover(db, s, req.params.id, req.body || {}, req.get('Idempotency-Key')), 'group-cover-repay');
repaymentRoute('post', '/groups/:id/fund-refunds', ['approve_sensitive_operations'], (db, s, req) => refundFund(db, s, req.params.id, req.body || {}, req.get('Idempotency-Key')), 'group-fund-refund');

// ---------------------------------------------------------------------------
// Transactions ledger
// ---------------------------------------------------------------------------

branchRouter.get('/transactions', requireBranch(['view_transaction_records']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });
  const conditions: any[] = [scopeCond(ctx, schema.financialTransactions.branchId, req.query.branchId ? String(req.query.branchId) : undefined)].filter(Boolean);
  const type = String(req.query.type || '');
  if (type) conditions.push(eq(schema.financialTransactions.transactionType, type));
  const status = String(req.query.status || '');
  if (status) conditions.push(eq(schema.financialTransactions.status, status));
  const q = String(req.query.search || '').trim();
  if (q) {
    conditions.push(or(ilike(schema.financialTransactions.clientName, `%${q}%`), ilike(schema.financialTransactions.referenceNumber, `%${q}%`)) as any);
  }
  const from = String(req.query.from || '');
  if (from) conditions.push(gte(schema.financialTransactions.transactionDate, from));
  const to = String(req.query.to || '');
  if (to) conditions.push(lte(schema.financialTransactions.transactionDate, to));
  const rows = await db
    .select()
    .from(schema.financialTransactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.financialTransactions.transactionDate));
  res.json({ success: true, data: rows });
});

// No POST /transactions: register rows are written only by the service that moved the
// money, with its journal entry (an arbitrary row would show in members' histories).

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

branchRouter.get('/documents', requireBranch(['view_client_info', 'register_clients', 'manage_kyc']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });
  const conditions: any[] = [scopeCond(ctx, schema.documents.branchId, req.query.branchId ? String(req.query.branchId) : undefined)].filter(Boolean);
  const docType = String(req.query.docType || '');
  if (docType) conditions.push(eq(schema.documents.docType, docType));
  const status = String(req.query.status || '');
  if (status) conditions.push(eq(schema.documents.status, status));
  const rows = await db
    .select()
    .from(schema.documents)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.documents.createdAt));
  res.json({ success: true, data: rows });
});

branchRouter.post('/documents', requireBranch(['register_clients', 'manage_kyc']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const now = nowIso();
  const id = genId('doc');
  const docNumber = `DOC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const clientId = body.clientId ? String(body.clientId) : null;
  let clientName = body.clientName ? String(body.clientName) : null;
  if (clientId && !clientName) {
    const borrower = (await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, clientId)).limit(1))[0];
    clientName = (borrower as any)?.fullName || null;
  }

  // Persist the real bytes. The console used to store `mock://<filename>`, which
  // produced document records whose file could never be retrieved again.
  //
  // We store the durable storage OBJECT PATH, not the signed url. A signed url
  // expires in 30 minutes, so persisting one would leave every record with a dead
  // link the next day. GET /documents/:id/file re-signs the path on demand.
  const originalName = body.fileName ? String(body.fileName) : null;
  let fileRef: string;
  // The durable bucket path, known only for content we stored ourselves. A
  // caller-supplied http(s) link has no storage path of our own, so it stays
  // null rather than being filled with a URL that will expire.
  let storagePath: string | null = null;
  let storedFileName: string | null = originalName;
  if (body.fileBase64) {
    try {
      const stored = await storeDocument({
        scope: 'branch-documents',
        ownerId: clientId || ctx.branchId || 'br-main',
        folder: String(body.docType || 'client-document'),
        base64: String(body.fileBase64),
        fileName: originalName || undefined,
        mime: body.mime ? String(body.mime) : undefined,
      });
      fileRef = stored.path;
      storagePath = stored.path;
      storedFileName = stored.fileName;
    } catch (storageErr: any) {
      console.error('[Documents] storage failed:', storageErr?.message || storageErr);
      return res.status(400).json({ error: storageErr?.message || 'The file could not be stored.' });
    }
  } else if (body.fileUrl) {
    // Only honour a caller-supplied url when it is already a real, retrievable
    // link. Arbitrary strings must not be persisted as if they were documents.
    const candidate = String(body.fileUrl);
    if (!/^https?:\/\//i.test(candidate)) {
      return res.status(400).json({
        error: 'fileUrl must be an http(s) link, or upload the file content as fileBase64.',
      });
    }
    fileRef = candidate;
  } else {
    return res.status(400).json({ error: 'A file is required: send fileBase64 or an http(s) fileUrl.' });
  }

  await db.insert(schema.documents).values({
    id,
    docNumber,
    branchId: ctx.branchId || 'br-main',
    clientId,
    clientName,
    loanId: body.loanId ? String(body.loanId) : null,
    loanNumber: body.loanNumber ? String(body.loanNumber) : null,
    docName: String(body.docName || originalName || 'Untitled document'),
    docType: String(body.docType || 'Client Document'),
    fileUrl: fileRef,
    storagePath,
    fileName: storedFileName,
    uploadedBy: ctx.staffName,
    status: 'Active',
    notes: body.notes ? String(body.notes) : null,
    createdAt: now,
  });
  await audit(ctx, 'DOCUMENT_UPLOADED', `Uploaded document ${docNumber} (${body.docName || 'Untitled'})`, 'BORROWER', { targetType: 'Document', targetId: id });
  await notify(ctx, 'DOCUMENT', 'Document uploaded', `${body.docName || 'A document'} was uploaded to the branch records.`, { relatedType: 'Document', relatedId: id });
  res.status(201).json({ success: true, data: { id, docNumber, fileUrl: fileRef, fileName: originalName } });
});

// Re-signs a stored object path on demand so a document stays retrievable long
// after the upload-time signed url would have expired.
branchRouter.get('/documents/:id/file', requireBranch(['view_client_info', 'register_clients', 'manage_kyc']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const rows = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.id, req.params.id), scopeCond(ctx, schema.documents.branchId) as any))
    .limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Document not found in this branch.' });

  const ref = (rows[0] as any).fileUrl as string | null;
  if (!ref) return res.status(404).json({ error: 'This document has no stored file.' });
  // Externally hosted links are already retrievable; hand them back as-is.
  if (/^https?:\/\//i.test(ref)) return res.json({ success: true, url: ref, expiresInSeconds: null });

  const supabase = getServerSupabase();
  if (!supabase) return res.status(503).json({ error: 'Document storage is unavailable.' });
  const { data: signed, error: signErr } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(ref, 60 * 10);
  if (signErr) return res.status(500).json({ error: `Could not sign the document: ${signErr.message}` });
  res.json({ success: true, url: signed.signedUrl, expiresInSeconds: 600 });
});

branchRouter.patch('/documents/:id', requireBranch(['register_clients', 'manage_kyc']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { status, notes } = req.body || {};
  const set: any = {};
  if (status) set.status = String(status);
  if (notes !== undefined) set.notes = notes ? String(notes) : null;
  await db.update(schema.documents).set(set).where(and(eq(schema.documents.id, req.params.id), scopeCond(ctx, schema.documents.branchId) as any));
  await audit(ctx, 'DOCUMENT_UPDATED', `Updated document ${req.params.id} (status: ${status || 'unchanged'})`, 'BORROWER', { targetType: 'Document', targetId: req.params.id });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

branchRouter.get('/notifications', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true, data: [], unreadCount: 0 });
  const rows = await db
    .select()
    .from(schema.branchNotifications)
    .where(
      and(
        eq(schema.branchNotifications.audience, 'STAFF'),
        scopeCond(ctx, schema.branchNotifications.branchId, req.query.branchId ? String(req.query.branchId) : undefined) as any,
        or(eq(schema.branchNotifications.targetStaffId, ctx.staffId as string), isNull(schema.branchNotifications.targetStaffId)),
      )
    )
    .orderBy(desc(schema.branchNotifications.createdAt))
    .limit(100);
  res.json({ success: true, data: rows, unreadCount: rows.filter((n: any) => !n.isRead).length });
});

branchRouter.post('/notifications/:id/read', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true });
  await db.update(schema.branchNotifications).set({ isRead: true }).where(and(eq(schema.branchNotifications.id, req.params.id), eq(schema.branchNotifications.audience, 'STAFF'), scopeCond(ctx, schema.branchNotifications.branchId) as any));
  res.json({ success: true });
});

branchRouter.post('/notifications/read-all', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true });
  await db.update(schema.branchNotifications).set({ isRead: true }).where(and(eq(schema.branchNotifications.audience, 'STAFF'), scopeCond(ctx, schema.branchNotifications.branchId) as any));
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

branchRouter.get('/reports', requireBranch(['view_transaction_records', 'view_all_records', 'monitor_loan_repayment']), async (req, res) => {
  const ctx = ctxOf(req);
  const data = await loadBranchData(ctx, req);
  const type = String(req.query.type || 'portfolio');
  const from = String(req.query.from || '');
  const to = String(req.query.to || todayStr());
  const generatedAt = nowIso();

  const loansArr = data.loans as any[];
  const paymentsArr = data.payments as any[];
  const borrowersArr = data.borrowers as any[];
  const savingsTxArr = data.savingsTransactions as any[];

  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  const money = (n: number) => Math.round(n * 100) / 100;

  let rows: any[] = [];
  const summary: Record<string, any> = {};

  if (type === 'clients') {
    rows = borrowersArr
      .filter((b) => inRange(String(b.membershipDate || b.joinedDate || todayStr())))
      .map((b) => ({
        borrowerNumber: b.borrowerNumber, fullName: b.fullName, phone: b.phone,
        address: b.address, memberStatus: b.memberStatus, kycStatus: b.kycStatus,
        membershipDate: b.membershipDate, savingsBalance: b.savingsBalance,
      }));
    summary.total = rows.length;
    summary.active = rows.filter((r) => r.memberStatus === 'Active').length;
  } else if (type === 'kyc') {
    const counts = new Map<string, number>();
    borrowersArr.forEach((b) => counts.set(String(b.kycStatus), (counts.get(String(b.kycStatus)) || 0) + 1));
    rows = borrowersArr.map((b) => ({ borrowerNumber: b.borrowerNumber, fullName: b.fullName, kycStatus: b.kycStatus, memberStatus: b.memberStatus, phone: b.phone }));
    summary.byStatus = Object.fromEntries(counts);
  } else if (type === 'portfolio' || type === 'overdue') {
    // Exact figures from the loan views the member portal uses (src/reports/portfolio.ts).
    const db = getDb();
    const branchId = reportBranch(ctx, req);
    const p = await portfolioSummary(db as unknown as AppDb, { branchId });
    const loanRows = await (db as unknown as AppDb).select().from(lendingLoans).where(branchId ? eq(lendingLoans.branchId, branchId) : undefined);
    const views = await loanSummaries(db as unknown as AppDb, loanRows);
    const today = todayStr();
    const behind = views.filter((v) => RUNNING_LOAN_STATUSES.includes(v.status) && v.nextDue && v.nextDue.dueDate < today);
    const list = type === 'overdue' ? behind : views;
    rows = list.map((v) => ({
      loanNumber: v.loanNumber, borrowerName: v.borrowerName, productName: v.productName,
      principalAmount: v.principal, remainingBalance: v.remainingBalance, status: v.status,
      nextPaymentDate: v.nextDue?.dueDate ?? null, daysBehind: v.nextDue && v.nextDue.dueDate < today ? daysBetween(v.nextDue.dueDate, today) : 0,
      applicationDate: v.applicationDate,
    }));
    if (type === 'portfolio') {
      const counts = new Map<string, number>();
      views.forEach((v) => counts.set(v.status, (counts.get(v.status) || 0) + 1));
      summary.byStatus = Object.fromEntries(counts);
      summary.outstanding = p.loans.outstanding;
      summary.running = p.loans.running;
    } else {
      summary.count = p.loans.overdue;
      summary.outstanding = p.loans.overdueOutstanding;
    }
  } else if (type === 'applications') {
    rows = loansArr
      .filter((l) => ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Cancelled'].includes(normaliseLoanStatus(l.status)) && inRange(String(l.applicationDate)))
      .map((l) => ({ loanNumber: l.loanNumber, borrowerName: l.borrowerName, productName: l.productName, principalAmount: l.principalAmount, termMonths: l.termMonths, applicationDate: l.applicationDate, status: normaliseLoanStatus(l.status), loanOfficerName: l.loanOfficerName }));
    summary.count = rows.length;
    summary.pending = rows.filter((r) => ['Draft', 'Submitted', 'Under Review'].includes(r.status)).length;
  } else if (type === 'repayments' || type === 'collections') {
    // Posted payments only: a reversed payment is not money collected.
    const db = getDb();
    const branchId = reportBranch(ctx, req);
    const posted = (await (db as unknown as AppDb)
      .select()
      .from(paymentRows)
      .where(and(eq(paymentRows.status, 'POSTED'), branchId ? eq(paymentRows.branchId, branchId) : undefined)))
      .filter((p) => inRange(String(p.paymentDate)));
    rows = posted.map((p) => ({ receiptNumber: p.receiptNumber, loanNumber: p.loanNumber, borrowerName: p.borrowerName, amount: centsToDecimal(centsFromDb(p.amount)), paymentDate: p.paymentDate, paymentMethod: p.paymentMethod, collectedBy: p.collectedBy }));
    const sumBy = (key: (p: (typeof posted)[number]) => string) => {
      const m = new Map<string, number>();
      posted.forEach((p) => m.set(key(p), (m.get(key(p)) || 0) + centsFromDb(p.amount)));
      return Object.fromEntries([...m.entries()].sort().map(([k, v]) => [k, centsToDecimal(v)]));
    };
    summary.total = centsToDecimal(posted.reduce((t, p) => t + centsFromDb(p.amount), 0));
    summary.count = posted.length;
    summary.daily = sumBy((p) => String(p.paymentDate));
    if (type === 'collections') {
      summary.weekly = sumBy((p) => {
        const d = new Date(`${p.paymentDate}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - d.getUTCDay());
        return d.toISOString().slice(0, 10);
      });
      summary.monthly = sumBy((p) => String(p.paymentDate).slice(0, 7));
    }
  } else if (type === 'savings') {
    const scoped = (savingsTxArr as any[]).filter((t) => inRange(String(t.date)));
    rows = scoped.map((t) => ({ transactionNumber: t.transactionNumber, memberName: t.memberName, type: t.kind, amount: centsToDecimal(centsFromDb(t.amount)), balanceAfter: centsToDecimal(centsFromDb(t.balanceAfter)), date: t.date, processedBy: t.processedBy }));
    const total = (kind: string) => centsToDecimal(scoped.filter((t) => t.kind === kind).reduce((s: number, t: any) => s + centsFromDb(t.amount), 0));
    summary.deposits = total('DEPOSIT');
    summary.withdrawals = total('WITHDRAWAL');
    summary.interest = total('INTEREST');
    const db = getDb();
    summary.totalBalances = (await portfolioSummary(db as unknown as AppDb, { branchId: reportBranch(ctx, req) })).savings.balance;
  } else if (type === 'groups') {
    // Live figures from group_members and the fund ledger (the old cached columns are no longer kept).
    const db = getDb();
    const list = db ? await listGroups(db as unknown as AppDb, lendingStaffOf(ctx)) : [];
    rows = list.map((g) => ({ groupCode: g.groupCode, groupName: g.groupName, centerName: g.centerName, leaderName: g.leaderName ?? '', members: g.memberCount, fundBalance: g.fundBalance, status: g.status, blocked: g.blocked }));
    summary.count = rows.length;
    summary.blocked = list.filter((g) => g.blocked).length;
    summary.fundBalance = centsToDecimal(list.reduce((t, g) => t + centsFromDb(g.fundBalance), 0));
  } else {
    return res.status(400).json({ error: `Unknown report type '${type}'` });
  }

  res.json({ success: true, data: { type, from: from || undefined, to, generatedAt, summary, rows } });
});

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

branchRouter.get('/activity-log', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  const limit = Math.min(200, Number(req.query.limit) || 100);
  if (!db) return res.json({ success: true, data: [] });
  const conditions: any[] = [scopeCond(ctx, schema.auditLogs.branchId, req.query.branchId ? String(req.query.branchId) : undefined)].filter(Boolean);
  const module = String(req.query.module || '');
  if (module) conditions.push(eq(schema.auditLogs.type, module));
  const q = String(req.query.search || '').trim();
  if (q) conditions.push(ilike(schema.auditLogs.action, `%${q}%`) as any);
  const rows = await db
    .select()
    .from(schema.auditLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.auditLogs.timestamp))
    .limit(limit);
  res.json({ success: true, data: rows });
});