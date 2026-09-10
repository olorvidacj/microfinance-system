import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/index';
import { hasAnyPermission, getRolePermissions, normalizeRole, SystemPermission } from '../auth/permissions';
import {
  allocatePaymentToSchedule,
  calculateLoanSchedule,
  getComputedInstallmentStatus,
} from '../utils/loanMath';
import type { InstallmentStatus } from '../types';

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
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function genId(prefix: string): string {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}-${suffix}`;
}

function genRef(prefix: string): string {
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

function requireBranch(permissions: SystemPermission[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).authUser as
      | { id: string; role: string; staffRole?: string | null; staffId?: string | null; branchId?: string | null; email: string }
      | undefined;

    if (!auth || auth.role !== 'STAFF') {
      return res.status(401).json({ error: 'Branch personnel authentication required. Please sign in.' });
    }

    const staffRole = normalizeRole(auth.staffRole || 'ADMINISTRATOR');
    const db = getDb();
    let staffName = auth.email.split('@')[0] || 'Staff';
    let title = staffRole;
    let avatar = '';

    if (db && auth.staffId) {
      try {
        const rows = await db.select().from(schema.staff).where(eq(schema.staff.id, auth.staffId as string)).limit(1);
        if (rows.length > 0) {
          staffName = (rows[0] as any).name || staffName;
          title = (rows[0] as any).title || title;
          avatar = (rows[0] as any).avatar || '';
        }
      } catch {
        /* ignore */
      }
    }

    const branchId = auth.branchId || null;
    const viewAll = hasAnyPermission(staffRole, ['view_all_records']) && !branchId;

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
    };

    if (!viewAll && !branchId) {
      return res.status(403).json({
        error: 'This account is not associated with a branch. Please contact your system administrator.',
      });
    }

    if (permissions.length > 0 && !hasAnyPermission(staffRole, permissions)) {
      return res.status(403).json({
        error: `Access denied: Role '${staffRole}' lacks required permissions: [${permissions.join(', ')}]`,
        requiredPermissions: permissions,
      });
    }

    (req as any).branchCtx = ctx;
    next();
  };
}

function ctxOf(req: Request): BranchCtx {
  return (req as any).branchCtx as BranchCtx;
}

function scopeCond(ctx: BranchCtx, branchColumn: any, branchIdParam?: string) {
  if (ctx.viewAll) {
    if (branchIdParam) return eq(branchColumn, branchIdParam);
    return undefined;
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
  const savingsScoped = ctx.viewAll && !bid ? savingsAccounts : savingsAccounts.filter((a: any) => memberIds.has(a.memberId));
  return { borrowers, loans, payments, savingsAccounts: savingsScoped, savingsTransactions, transactions, groups, applications };
}

branchRouter.get('/dashboard', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const data = await loadBranchData(ctx, req);
  const today = todayStr();

  const activeClients = (data.borrowers as any[]).filter((b) => b.memberStatus === 'Active');
  const pendingVerification = (data.borrowers as any[]).filter(
    (b) => b.kycStatus !== 'Verified' || b.memberStatus === 'Pending'
  );
  const activeLoans = (data.loans as any[]).filter((l) => ['Disbursed', 'Active', 'In Arrears'].includes(l.status));
  const outstandingBalance = activeLoans.reduce((s, l) => s + (l.remainingBalance || 0), 0);
  const todaysCollections = (data.payments as any[]).filter((p) => String(p.paymentDate).startsWith(today));
  const overdueLoans = (data.loans as any[]).filter(
    (l) => l.status === 'In Arrears' || (l.daysInArrears && l.daysInArrears > 0)
  );
  const overdueOutstanding = overdueLoans.reduce((s, l) => s + (l.remainingBalance || 0), 0);
  const pendingApplications = (data.loans as any[]).filter((l) =>
    ['Draft', 'Submitted', 'Under Review', 'For Assessment'].includes(l.status)
  );
  const totalDeposited = (data.savingsTransactions as any[])
    .filter((t) => t.type === 'Deposit' && String(t.date).startsWith(today))
    .reduce((s, t) => s + t.amount, 0);
  const todayWithdrawals = (data.savingsTransactions as any[])
    .filter((t) => t.type === 'Withdrawal' && String(t.date).startsWith(today))
    .reduce((s, t) => s + t.amount, 0);
  const totalSavings = (data.savingsAccounts as any[]).reduce((s, a) => s + (a.balance || 0), 0);

  res.json({
    success: true,
    data: {
      personnel: {
        name: ctx.staffName,
        role: ctx.staffRole,
        title: ctx.title,
        branchId: ctx.branchId,
      },
      asOf: nowIso(),
      summary: {
        totalClients: data.borrowers.length,
        activeClients: activeClients.length,
        pendingVerification: pendingVerification.length,
        activeLoans: activeLoans.length,
        outstandingBalance: Math.round(outstandingBalance * 100) / 100,
        todayCollections: Math.round(todaysCollections.reduce((s, p) => s + p.amount, 0) * 100) / 100,
        todayTransactionCount: todaysCollections.length,
        pendingApplications: pendingApplications.length,
        totalSavings: Math.round(totalSavings * 100) / 100,
        todayDeposits: Math.round(totalDeposited * 100) / 100,
        todayWithdrawals: Math.round(todayWithdrawals * 100) / 100,
        overdueLoans: overdueLoans.length,
        overdueOutstanding: Math.round(overdueOutstanding * 100) / 100,
      },
    },
  });
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
    active: loansArr.filter((l) => ['Disbursed', 'Active', 'In Arrears'].includes(l.status)).length,
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
    const withActive = new Set(loans.filter((l: any) => ['Disbursed', 'Active', 'In Arrears'].includes(l.status)).map((l: any) => l.borrowerId));
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

branchRouter.post('/clients', requireBranch(['register_clients', 'manage_kyc', 'assist_clients']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const id = body.id || genId('bor');
  const borrowerNumber = body.borrowerNumber || `CLI-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const nowDate = todayStr();
  const branchId = ctx.viewAll && body.branchId ? String(body.branchId) : ctx.branchId;
  await db.insert(schema.borrowers).values({
    id,
    borrowerNumber,
    fullName: String(body.fullName || 'New Client').trim(),
    idNumber: String(body.idNumber || ''),
    phone: String(body.phone || ''),
    email: String(body.email || ''),
    dateOfBirth: String(body.dateOfBirth || '1990-01-01'),
    gender: String(body.gender || 'Not specified'),
    civilStatus: String(body.civilStatus || 'Single'),
    address: String(body.address || ''),
    facebookAccount: body.facebookAccount ? String(body.facebookAccount) : null,
    branchId: branchId || 'br-main',
    employmentStatus: String(body.employmentStatus || 'Employed'),
    employerOrBusiness: String(body.employerOrBusiness || ''),
    occupation: String(body.occupation || ''),
    monthlyIncome: Number(body.monthlyIncome) || 0,
    monthlyExpenses: Number(body.monthlyExpenses) || 0,
    creditScore: Number(body.creditScore) || 600,
    creditTier: String(body.creditTier || 'Standard'),
    kycStatus: String(body.kycStatus || 'Pending Review'),
    memberStatus: String(body.memberStatus || 'Pending'),
    membershipDate: String(body.membershipDate || nowDate),
    savingsBalance: 0,
    shareCapital: 0,
    activeLoansCount: 0,
    totalBorrowed: 0,
    totalRepaid: 0,
    avatar: String(body.avatar || `https://ui-avatars.com/api/?background=1E40AF&color=fff&name=${encodeURIComponent(String(body.fullName || 'New Client'))}`),
    joinedDate: nowDate,
    lastActivityDate: nowDate,
    notes: body.notes ? String(body.notes) : null,
  });
  await audit(ctx, 'CLIENT_REGISTERED', `Registered new client ${borrowerNumber} (${body.fullName || 'New Client'})`, 'BORROWER', { targetType: 'Borrower', targetId: id });
  await notify(ctx, 'CLIENT_REGISTRATION', 'New client registered', `${body.fullName || 'New client'} was registered under this branch.`, { relatedType: 'Borrower', relatedId: id });
  res.status(201).json({ success: true, data: { id, borrowerNumber } });
});

branchRouter.put('/clients/:id', requireBranch(['register_clients', 'manage_kyc', 'assist_clients']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
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
// KYC
// ---------------------------------------------------------------------------

branchRouter.get('/kyc-queue', requireBranch(['manage_kyc', 'view_client_info', 'assist_clients']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });
  const rows = await db.select().from(schema.borrowers).where(scopeCond(ctx, schema.borrowers.branchId, req.query.branchId ? String(req.query.branchId) : undefined));
  const queue = rows.filter((b: any) => {
    const k = String(b.kycStatus).toLowerCase();
    return !['verified', 'rejected'].includes(k) || String(b.memberStatus).toLowerCase() === 'pending';
  });
  const docs = await db.select().from(schema.documents);
  const docCounts = new Map<string, number>();
  docs.forEach((d: any) => {
    if (d.clientId) docCounts.set(d.clientId, (docCounts.get(d.clientId) || 0) + 1);
  });
  res.json({
    success: true,
    data: queue.map((b: any) => ({ ...b, submittedDocuments: docCounts.get(b.id) || 0 })),
  });
});

branchRouter.post('/kyc/:id/review', requireBranch(['manage_kyc']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { decision, notes } = req.body || {};
  const decisionMap: Record<string, string> = {
    APPROVED: 'Verified',
    REJECTED: 'Rejected',
    CORRECTION_REQUESTED: 'Correction Requested',
    UNDER_REVIEW: 'Under Review',
  };
  const targetStatus = decisionMap[String(decision || '').toUpperCase()];
  if (!targetStatus) return res.status(400).json({ error: 'decision must be APPROVED, REJECTED, CORRECTION_REQUESTED, or UNDER_REVIEW' });
  if (['REJECTED', 'CORRECTION_REQUESTED'].includes(String(decision || '').toUpperCase()) && !notes) {
    return res.status(400).json({ error: 'A reason is required when rejecting or requesting correction.' });
  }
  await db
    .update(schema.borrowers)
    .set({
      kycStatus: targetStatus,
      notes: notes
        ? `${String(notes)} | Reviewed by ${ctx.staffName} (${ctx.staffRole}) on ${nowIso()}`
        : `KYC marked '${targetStatus}' by ${ctx.staffName} (${ctx.staffRole}) on ${nowIso()}`,
    })
    .where(and(eq(schema.borrowers.id, req.params.id), scopeCond(ctx, schema.borrowers.branchId) as any));
  await audit(ctx, 'KYC_REVIEWED', `KYC decision '${targetStatus}' for client ${req.params.id}. ${notes ? 'Reason: ' + notes : ''}`, 'BORROWER', { targetType: 'Borrower', targetId: req.params.id });
  await notify(ctx, 'KYC', `KYC ${targetStatus}`, `The KYC verification for client ${req.params.id} was marked '${targetStatus}'.`, { relatedType: 'Borrower', relatedId: req.params.id });
  res.json({ success: true, status: targetStatus });
});

// ---------------------------------------------------------------------------
// Loan applications & assessment
// ---------------------------------------------------------------------------

const APPLICATION_STATUSES = ['Draft', 'Submitted', 'Under Review', 'For Assessment', 'Approved', 'Rejected', 'Cancelled'];

branchRouter.get('/loan-applications', requireBranch(['process_loan_applications', 'review_client_loan_info', 'manage_loan_applications']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });
  const conditions: any[] = [
    scopeCond(ctx, schema.loans.branchId, req.query.branchId ? String(req.query.branchId) : undefined),
    sql`${schema.loans.status} IN ('Draft','Submitted','Under Review','For Assessment')`,
  ].filter(Boolean);
  const status = String(req.query.status || '');
  if (status) conditions.push(eq(schema.loans.status, status));
  const product = String(req.query.product || '');
  if (product) conditions.push(eq(schema.loans.productName, product));
  const officer = String(req.query.officer || '');
  if (officer) conditions.push(ilike(schema.loans.loanOfficerName, `%${officer}%`) as any);
  const from = String(req.query.from || '');
  if (from) conditions.push(gte(schema.loans.applicationDate, from));
  const to = String(req.query.to || '');
  if (to) conditions.push(lte(schema.loans.applicationDate, to));

  const rows = await db.select().from(schema.loans).where(and(...conditions)).orderBy(desc(schema.loans.applicationDate));
  res.json({ success: true, data: rows });
});

branchRouter.get('/loan-products', requireBranch(['process_loan_applications', 'review_client_loan_info', 'monitor_loan_repayment']), async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });
  const rows = await db.select().from(schema.loanProducts);
  res.json({ success: true, data: rows });
});

branchRouter.post('/loan-applications', requireBranch(['process_loan_applications']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const principal = Number(body.principalAmount) || 0;
  const termMonths = Number(body.termMonths) || 6;
  const rate = Number(body.interestRate) || 12;
  const frequency = String(body.repaymentFrequency || 'Monthly');
  const interestType = String(body.interestType || 'Flat Rate');
  const processingFeePct = Number(body.processingFeePercentage) || 2;
  const startDate = String(body.applicationDate || todayStr());

  const borrower = body.borrowerId
    ? (await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, String(body.borrowerId))).limit(1))[0]
    : undefined;

  const calc = calculateLoanSchedule({
    principal,
    annualInterestRate: rate,
    termMonths,
    interestType: interestType as any,
    repaymentFrequency: frequency as any,
    processingFeePercentage: processingFeePct,
    startDate,
  });

  const id = genId('loan');
  const loanNumber = `LA-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
  const branchId = ctx.viewAll && body.branchId ? String(body.branchId) : ctx.branchId;
  const loanData: any = {
    id,
    loanNumber,
    borrowerId: body.borrowerId || (borrower as any)?.id || 'bor-unknown',
    borrowerName: (borrower as any)?.fullName || String(body.borrowerName || 'Unknown Client'),
    borrowerPhone: (borrower as any)?.phone || String(body.borrowerPhone || ''),
    borrowerAvatar: (borrower as any)?.avatar || null,
    branchId: branchId || 'br-main',
    productId: String(body.productId || ''),
    productName: String(body.productName || 'General Loan'),
    principalAmount: principal,
    interestRate: rate,
    interestType,
    repaymentFrequency: frequency,
    termMonths,
    totalInstallments: calc.totalInstallments,
    processingFee: calc.processingFee,
    totalInterest: calc.totalInterest,
    totalPayable: calc.totalPayable,
    totalPaid: 0,
    remainingBalance: calc.totalPayable,
    status: String(body.status || 'Submitted'),
    coopStep: 'SUBMITTED',
    applicationDate: startDate,
    startDate: null,
    maturityDate: String(body.maturityDate || new Date(Date.now() + termMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    loanOfficerId: ctx.staffId || ctx.userId,
    loanOfficerName: ctx.staffName,
    purpose: String(body.purpose || 'General purpose'),
    collateral: body.collateral || null,
    guarantors: body.guarantors || null,
    schedule: calc.schedule as any,
  };
  await db.insert(schema.loans).values(loanData);
  await audit(ctx, 'LOAN_APPLICATION_SUBMITTED', `Submitted loan application ${loanNumber} for ${loanData.borrowerName} (₱${principal.toLocaleString()})`, 'LOAN', { targetType: 'Loan', targetId: id });
  await notify(ctx, 'LOAN_APPLICATION', 'New loan application', `Application ${loanNumber} for ${loanData.borrowerName} (₱${principal.toLocaleString()}) was submitted.`, { relatedType: 'Loan', relatedId: id });
  res.status(201).json({ success: true, data: { id, loanNumber, ...calc } });
});

branchRouter.get('/loans/:id', requireBranch(['review_client_loan_info', 'process_loan_applications', 'manage_loan_applications', 'monitor_loan_repayment']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(404).json({ error: 'Loan not found' });
  const rows = await db.select().from(schema.loans).where(and(eq(schema.loans.id, req.params.id), scopeCond(ctx, schema.loans.branchId) as any));
  if (rows.length === 0) return res.status(404).json({ error: 'Loan not found in this branch.' });
  const loan = rows[0] as any;
  const [payments, borrower] = await Promise.all([
    db.select().from(schema.payments).where(eq(schema.payments.loanId, loan.id)),
    loan.borrowerId ? db.select().from(schema.borrowers).where(eq(schema.borrowers.id, loan.borrowerId)).limit(1) : Promise.resolve([]),
  ]);
  const schedule: InstallmentRow[] = Array.isArray(loan.schedule) ? loan.schedule : [];
  const amortization = schedule.map((item) => ({
    ...item,
    status: getComputedInstallmentStatus(item.dueDate, item.totalDue, item.amountPaid || 0),
  }));
  res.json({ success: true, data: { loan, amortization, payments, borrower: borrower[0] || null } });
});

branchRouter.get('/loans', requireBranch(['review_client_loan_info', 'process_loan_applications', 'manage_loan_applications', 'monitor_loan_repayment']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });
  const conditions: any[] = [scopeCond(ctx, schema.loans.branchId, req.query.branchId ? String(req.query.branchId) : undefined)].filter(Boolean);
  const status = String(req.query.status || '');
  if (status) conditions.push(ilike(schema.loans.status, `%${status}%`) as any);
  const search = String(req.query.search || '').trim();
  if (search) {
    conditions.push(or(ilike(schema.loans.borrowerName, `%${search}%`), ilike(schema.loans.loanNumber, `%${search}%`)) as any);
  }
  const rows = await db.select().from(schema.loans).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(schema.loans.applicationDate));
  res.json({ success: true, data: rows });
});

branchRouter.post('/loans/:id/action', requireBranch(['manage_loan_applications', 'approve_sensitive_operations']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { action, notes, reason } = req.body || {};
  const allowed: Record<string, string> = {
    submit: 'Submitted',
    recommend: 'For Assessment',
    return: 'Draft',
    reject: 'Rejected',
    approve: 'Approved',
    disburse: 'Disbursed',
    cancel: 'Cancelled',
  };
  const targetStatus = allowed[String(action || '').toLowerCase()];
  if (!targetStatus) return res.status(400).json({ error: 'Unknown action' });
  if (['reject', 'cancel', 'disburse'].includes(String(action || '').toLowerCase()) && action === 'reject' && !reason) {
    return res.status(400).json({ error: 'A reason is required when rejecting a loan application.' });
  }
  const rows = await db.select().from(schema.loans).where(and(eq(schema.loans.id, req.params.id), scopeCond(ctx, schema.loans.branchId) as any)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Loan not found in this branch.' });
  const set: any = { status: targetStatus };
  if (action === 'approve') set.approvalDate = todayStr();
  if (action === 'disburse') {
    set.disbursedDate = todayStr();
    set.startDate = todayStr();
    set.maturityDate = rows[0].maturityDate || set.maturityDate;
    set.officerInCharge = ctx.staffName;
  }
  if (action === 'reject') set.rejectionReason = reason || notes || 'Rejected';
  await db.update(schema.loans).set(set).where(eq(schema.loans.id, req.params.id));
  await audit(ctx, `LOAN_${targetStatus.replace(/ /g, '_').toUpperCase()}`, `Loan ${rows[0].loanNumber} moved to '${targetStatus}'. ${reason ? 'Reason: ' + reason : ''}`, 'LOAN', { targetType: 'Loan', targetId: req.params.id });
  await notify(ctx, 'LOAN_APPLICATION', `Loan ${targetStatus}`, `Loan ${rows[0].loanNumber} was marked '${targetStatus}'.`, { relatedType: 'Loan', relatedId: req.params.id });
  res.json({ success: true, status: targetStatus });
});

branchRouter.post('/loans/:id/assessment', requireBranch(['process_loan_applications', 'review_client_loan_info']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const rows = await db.select().from(schema.loans).where(and(eq(schema.loans.id, req.params.id), scopeCond(ctx, schema.loans.branchId) as any)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Loan not found in this branch.' });
  const loan = rows[0] as any;
  const borrower = loan.borrowerId
    ? (await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, loan.borrowerId)).limit(1))[0]
    : undefined;

  const monthlyIncome = Number(body.monthlyIncome) || Number((borrower as any)?.monthlyIncome) || 0;
  const monthlyExpenses = Number(body.monthlyExpenses) || Number((borrower as any)?.monthlyExpenses) || 0;
  const existingObligations = Number(body.existingObligations) || 0;
  const disposalFactor = 0.5; // 50% of disposable income allocated to repayment (industry guideline)

  const disposableIncome = Math.max(0, monthlyIncome - monthlyExpenses - existingObligations);
  const estimatedInstallmentCap = Math.round(disposableIncome * disposalFactor * 100) / 100;

  const calc = calculateLoanSchedule({
    principal: loan.principalAmount,
    annualInterestRate: loan.interestRate,
    termMonths: loan.termMonths,
    interestType: loan.interestType,
    repaymentFrequency: loan.repaymentFrequency,
    processingFeePercentage: Number((loan as any).processingFeePercentage) || 0,
  });

  const installmentsPerYear = calc.schedule.length / Math.max(1, loan.termMonths);
  const debtRatio = monthlyIncome > 0 ? (existingObligations + estimatedInstallmentCap) / monthlyIncome : 0;
  const affordablePrincipal =
    disposableIncome > 0
      ? Math.max(0, Math.floor((estimatedInstallmentCap * loan.termMonths) / (1 + (loan.interestRate / 100) * (loan.termMonths / 12)) / 1000) * 1000)
      : 0;
  const recommendedAmount = Math.min(loan.principalAmount, affordablePrincipal || loan.principalAmount);

  const riskIndicators: string[] = [];
  if (!borrower) riskIndicators.push('No client record found for this application');
  else {
    if ((borrower as any).kycStatus !== 'Verified') riskIndicators.push('Client KYC is not yet verified');
    if (existingObligations / Math.max(1, monthlyIncome) > 0.4) riskIndicators.push('Existing obligations exceed 40% of declared income');
    if ((borrower as any).memberStatus !== 'Active') riskIndicators.push(`Client is not an active member (${(borrower as any).memberStatus})`);
    if (debtRatio > 0.6) riskIndicators.push('Repayment debt ratio exceeds 60%');
  }
  if (recommendedAmount < loan.principalAmount) riskIndicators.push('Requested amount exceeds the estimated affordable amount');

  const assessment = {
    monthlyIncome,
    monthlyExpenses,
    existingObligations,
    disposableIncome,
    repaymentCapacityMonthly: estimatedInstallmentCap,
    debtRatio,
    recommendedAmount,
    estimatedInstallment: Math.round(calc.installmentAmount * 100) / 100,
    riskIndicators,
    isEstimate: true,
    note: 'These figures are automated estimates for assessment guidance only. Approval requires authorized personnel decision and full loan documentation.',
    assessedBy: ctx.staffName,
    assessedAt: nowIso(),
  };

  await db
    .update(schema.loans)
    .set({ underwritingReport: assessment as any, status: ['Draft', 'Submitted'].includes(loan.status) ? 'For Assessment' : loan.status })
    .where(eq(schema.loans.id, loan.id));
  await audit(ctx, 'LOAN_ASSESSED', `Assessment recorded for loan ${loan.loanNumber}. Recommended ₱${recommendedAmount.toLocaleString()}.`, 'LOAN', { targetType: 'Loan', targetId: loan.id });
  res.json({ success: true, data: assessment });
});

// ---------------------------------------------------------------------------
// Payments / collections
// ---------------------------------------------------------------------------

branchRouter.get('/collections/today', requireBranch(['process_loan_repayments', 'view_transaction_records']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true, data: { payments: [], totals: {} } });
  const today = todayStr();
  const rows = await db.select().from(schema.payments).where(and(scopeCond(ctx, schema.payments.branchId, req.query.branchId ? String(req.query.branchId) : undefined) as any, eq(schema.payments.paymentDate, today)));
  const cash = rows.filter((p: any) => String(p.paymentMethod).toLowerCase().includes('cash')).reduce((s, p: any) => s + p.amount, 0);
  const other = rows.reduce((s, p: any) => s + p.amount, 0) - cash;
  res.json({
    success: true,
    data: {
      payments: rows,
      totals: {
        total: Math.round(rows.reduce((s, p: any) => s + p.amount, 0) * 100) / 100,
        count: rows.length,
        cash: Math.round(cash * 100) / 100,
        other: Math.round(other * 100) / 100,
      },
    },
  });
});

branchRouter.post('/payments', requireBranch(['process_loan_repayments']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const loanId = String(body.loanId || '');
  const amount = Number(body.amount) || 0;
  if (!loanId || amount <= 0) return res.status(400).json({ error: 'loanId and a positive amount are required.' });
  const rows = await db.select().from(schema.loans).where(and(eq(schema.loans.id, loanId), scopeCond(ctx, schema.loans.branchId) as any)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Loan not found in this branch.' });
  const loan = rows[0] as any;
  if (amount > (loan.remainingBalance || 0) + 0.01) {
    return res.status(400).json({ error: `Payment exceeds outstanding balance (₱${(loan.remainingBalance || 0).toLocaleString()}).` });
  }

  const paymentDate = String(body.date || todayStr());
  const schedule: InstallmentRow[] = Array.isArray(loan.schedule) ? loan.schedule : [];
  const allocation = allocatePaymentToSchedule(schedule, amount, paymentDate);
  const id = genId('pay');
  const receiptNumber = `OR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const newTotalPaid = Math.min(Math.round(((loan.totalPaid || 0) + amount) * 100) / 100, loan.totalPayable);
  const newRemaining = Math.max(0, Math.round((loan.totalPayable - newTotalPaid) * 100) / 100);
  const nextUnpaid = allocation.updatedSchedule.find((s: any) => (s.amountPaid || 0) < s.totalDue - 0.001);
  const newStatus = newRemaining <= 0.01 ? 'Completed' : ['Draft', 'Submitted', 'Under Review', 'For Assessment', 'Approved'].includes(loan.status) ? 'Active' : loan.status;

  await db.insert(schema.payments).values({
    id,
    receiptNumber,
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    borrowerId: loan.borrowerId,
    borrowerName: loan.borrowerName,
    branchId: loan.branchId,
    amount,
    paymentDate,
    paymentMethod: String(body.paymentMethod || 'Cash'),
    transactionReference: String(body.transactionReference || ''),
    collectedBy: ctx.staffName,
    principalPortion: allocation.principalPaid,
    interestPortion: allocation.interestPaid,
    penaltyPortion: 0,
    rebateDiscount: 0,
    paymentScheduleType: 'Installment',
    isAdvancePayment: false,
    notes: body.notes ? String(body.notes) : null,
  });

  await db
    .update(schema.loans)
    .set({
      schedule: allocation.updatedSchedule as any,
      totalPaid: newTotalPaid,
      remainingBalance: newRemaining,
      status: newStatus,
      lastPaymentDate: paymentDate,
      nextPaymentDate: nextUnpaid ? nextUnpaid.dueDate : loan.maturityDate,
      daysInArrears: 0,
    })
    .where(eq(schema.loans.id, loan.id));

  if (loan.borrowerId) {
    const borrowerRows = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, loan.borrowerId)).limit(1);
    if (borrowerRows.length > 0) {
      const prev = borrowerRows[0] as any;
      await db
        .update(schema.borrowers)
        .set({ totalRepaid: Math.round(((prev.totalRepaid || 0) + amount) * 100) / 100, lastActivityDate: paymentDate })
        .where(eq(schema.borrowers.id, loan.borrowerId));
    }
  }

  await db.insert(schema.financialTransactions).values({
    id: genId('txn'),
    referenceNumber: `TX-${receiptNumber}`,
    clientId: loan.borrowerId,
    clientName: loan.borrowerName,
    accountOrLoanId: loan.id,
    accountOrLoanType: 'Loan',
    branchId: loan.branchId,
    transactionType: 'Loan Repayment',
    amount,
    transactionDate: paymentDate,
    paymentMethod: String(body.paymentMethod || 'Cash'),
    processedBy: `${ctx.staffName} (${ctx.title})`,
    processedByRole: ctx.staffRole,
    status: 'Completed',
    notes: `Collection for ${loan.loanNumber} · ${receiptNumber}`,
    metadata: { principalPortion: allocation.principalPaid, interestPortion: allocation.interestPaid },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  await audit(ctx, 'PAYMENT_RECEIVED', `Received ₱${amount.toLocaleString()} from ${loan.borrowerName} for ${loan.loanNumber}. Receipt ${receiptNumber}.`, 'PAYMENT', { targetType: 'Loan', targetId: loan.id });
  await notify(ctx, 'PAYMENT', 'Payment received', `₱${amount.toLocaleString()} payment received for ${loan.loanNumber}.`, { relatedType: 'Loan', relatedId: loan.id });

  res.status(201).json({
    success: true,
    data: {
      receipt: {
        id,
        receiptNumber,
        loanId: loan.id,
        loanNumber: loan.loanNumber,
        clientId: loan.borrowerId,
        clientName: loan.borrowerName,
        amount,
        paymentDate,
        paymentMethod: String(body.paymentMethod || 'Cash'),
        transactionReference: String(body.transactionReference || ''),
        processedBy: ctx.staffName,
        principalPortion: allocation.principalPaid,
        interestPortion: allocation.interestPaid,
        remainingBalance: newRemaining,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// Savings
// ---------------------------------------------------------------------------

branchRouter.get('/savings', requireBranch(['process_savings_deposits', 'process_savings_withdrawals', 'view_transaction_records']), async (req, res) => {
  const ctx = ctxOf(req);
  const data = await loadBranchData(ctx, req);
  res.json({ success: true, data: data.savingsAccounts });
});

branchRouter.get('/savings/:accountId/transactions', requireBranch(['process_savings_deposits', 'process_savings_withdrawals', 'view_transaction_records']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });
  const data = await loadBranchData(ctx, req);
  const account = (data.savingsAccounts as any[]).find((a: any) => a.id === req.params.accountId);
  if (!account) return res.status(404).json({ error: 'Savings account not found in this branch.' });
  const rows = await db.select().from(schema.savingsTransactions).where(eq(schema.savingsTransactions.savingsAccountId, req.params.accountId)).orderBy(desc(schema.savingsTransactions.date));
  res.json({ success: true, data: rows });
});

branchRouter.post('/savings/deposit', requireBranch(['process_savings_deposits']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const accountId = String(body.accountId || '');
  const amount = Number(body.amount) || 0;
  if (!accountId || amount <= 0) return res.status(400).json({ error: 'accountId and a positive amount are required.' });

  const data = await loadBranchData(ctx, req);
  const account = (data.savingsAccounts as any[]).find((a: any) => a.id === accountId);
  if (!account) return res.status(404).json({ error: 'Savings account not found in this branch.' });

  const balanceBefore = account.balance || 0;
  const balanceAfter = Math.round((balanceBefore + amount) * 100) / 100;
  const nowDate = todayStr();
  const txId = genId('stx');
  const txNumber = `STX-${nowDate.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;

  await db.update(schema.savingsAccounts).set({ balance: balanceAfter }).where(eq(schema.savingsAccounts.id, accountId));
  await db.insert(schema.savingsTransactions).values({
    id: txId,
    savingsAccountId: accountId,
    memberId: account.memberId,
    memberName: account.memberName,
    transactionNumber: txNumber,
    date: nowDate,
    type: 'Deposit',
    amount,
    balanceBefore,
    balanceAfter,
    processedBy: ctx.staffName,
    notes: body.notes ? String(body.notes) : null,
    officialReceiptNumber: `OR-${nowDate.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`,
  });
  await db.insert(schema.financialTransactions).values({
    id: genId('txn'),
    referenceNumber: `TX-${txNumber}`,
    clientId: account.memberId,
    clientName: account.memberName,
    accountOrLoanId: accountId,
    accountOrLoanType: 'Savings',
    branchId: ctx.branchId || 'br-main',
    transactionType: 'Savings Deposit',
    amount,
    transactionDate: nowDate,
    paymentMethod: String(body.paymentMethod || 'Cash'),
    processedBy: `${ctx.staffName} (${ctx.title})`,
    processedByRole: ctx.staffRole,
    status: 'Completed',
    notes: body.notes ? String(body.notes) : null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await audit(ctx, 'SAVINGS_DEPOSIT', `Deposit of ₱${amount.toLocaleString()} to ${account.memberName}'s savings (${accountId}).`, 'SAVINGS', { targetType: 'SavingsAccount', targetId: accountId });
  await notify(ctx, 'SAVINGS', 'Savings deposit recorded', `₱${amount.toLocaleString()} deposited to ${account.memberName}'s savings account.`, { relatedType: 'SavingsAccount', relatedId: accountId });

  res.status(201).json({ success: true, data: { transactionId: txId, transactionNumber: txNumber, balanceAfter } });
});

branchRouter.post('/savings/withdrawal', requireBranch(['process_savings_withdrawals']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const accountId = String(body.accountId || '');
  const amount = Number(body.amount) || 0;
  const reason = String(body.reason || '');
  if (!accountId || amount <= 0 || !reason) {
    return res.status(400).json({ error: 'accountId, a positive amount, and a reason are required.' });
  }

  const data = await loadBranchData(ctx, req);
  const account = (data.savingsAccounts as any[]).find((a: any) => a.id === accountId);
  if (!account) return res.status(404).json({ error: 'Savings account not found in this branch.' });

  const maintaining = account.maintainingBalance || 1000;
  if (amount > account.balance - maintaining + 0.01) {
    return res.status(400).json({
      error: `Withdrawal exceeds available balance. Balance ₱${account.balance.toLocaleString()} must maintain ₱${maintaining.toLocaleString()}.`,
    });
  }

  const balanceBefore = account.balance;
  const balanceAfter = Math.round((balanceBefore - amount) * 100) / 100;
  const nowDate = todayStr();
  const txId = genId('stx');
  const txNumber = `STW-${nowDate.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;

  await db.update(schema.savingsAccounts).set({ balance: balanceAfter }).where(eq(schema.savingsAccounts.id, accountId));
  await db.insert(schema.savingsTransactions).values({
    id: txId,
    savingsAccountId: accountId,
    memberId: account.memberId,
    memberName: account.memberName,
    transactionNumber: txNumber,
    date: nowDate,
    type: 'Withdrawal',
    amount,
    balanceBefore,
    balanceAfter,
    processedBy: ctx.staffName,
    notes: reason,
    officialReceiptNumber: null,
  });
  await db.insert(schema.financialTransactions).values({
    id: genId('txn'),
    referenceNumber: `TX-${txNumber}`,
    clientId: account.memberId,
    clientName: account.memberName,
    accountOrLoanId: accountId,
    accountOrLoanType: 'Savings',
    branchId: ctx.branchId || 'br-main',
    transactionType: 'Savings Withdrawal',
    amount,
    transactionDate: nowDate,
    paymentMethod: 'Cash',
    processedBy: `${ctx.staffName} (${ctx.title})`,
    processedByRole: ctx.staffRole,
    status: 'Completed',
    notes: reason,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await audit(ctx, 'SAVINGS_WITHDRAWAL', `Withdrawal of ₱${amount.toLocaleString()} from ${account.memberName}'s savings (${accountId}). Reason: ${reason}`, 'SAVINGS', { targetType: 'SavingsAccount', targetId: accountId });

  res.status(201).json({ success: true, data: { transactionId: txId, transactionNumber: txNumber, balanceAfter } });
});

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

branchRouter.get('/groups', requireBranch(['view_client_info', 'manage_loan_applications', 'register_clients']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });
  const rows = await db.select().from(schema.solidarityGroups).where(scopeCond(ctx, schema.solidarityGroups.branchId, req.query.branchId ? String(req.query.branchId) : undefined)).orderBy(desc(schema.solidarityGroups.createdAt));
  res.json({ success: true, data: rows });
});

branchRouter.get('/groups/:id', requireBranch(['view_client_info', 'manage_loan_applications', 'register_clients']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(404).json({ error: 'Group not found' });
  const rows = await db.select().from(schema.solidarityGroups).where(and(eq(schema.solidarityGroups.id, req.params.id), scopeCond(ctx, schema.solidarityGroups.branchId) as any)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Group not found in this branch.' });
  const group = rows[0] as any;
  const members = Array.isArray(group.members) ? group.members : [];
  const memberIds = members.map((m: any) => m.borrowerId).filter(Boolean);
  const loans = memberIds.length
    ? await db.select().from(schema.loans).where(sql`${schema.loans.borrowerId} = ANY(${memberIds})`)
    : [];
  const detail = members.map((m: any) => {
    const memberLoans = loans.filter((l: any) => l.borrowerId === m.borrowerId);
    const outstanding = memberLoans.reduce((s: number, l: any) => s + (l.remainingBalance || 0), 0);
    const status = ['Good Standing', 'Due', 'Arrears'].includes(m.status) ? m.status : outstanding > 0 ? 'Good Standing' : m.status || 'Good Standing';
    return { ...m, activeLoans: memberLoans.length, outstandingBalance: Math.round(outstanding * 100) / 100, repaymentStatus: status };
  });
  res.json({ success: true, data: { group, members: detail } });
});

branchRouter.post('/groups', requireBranch(['register_clients', 'manage_loan_applications']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const id = genId('grp');
  const dateStr = todayStr();
  await db.insert(schema.solidarityGroups).values({
    id,
    groupCode: String(body.groupCode || `SG-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`),
    groupName: String(body.groupName || 'New Group'),
    centerName: String(body.centerName || 'Center 1'),
    branchId: ctx.branchId || 'br-main',
    formedDate: String(body.formedDate || dateStr),
    meetingDay: String(body.meetingDay || 'Saturday'),
    meetingTime: String(body.meetingTime || '9:00 AM'),
    meetingLocation: String(body.meetingLocation || 'Branch Hall'),
    loanOfficerId: ctx.staffId || ctx.userId,
    loanOfficerName: ctx.staffName,
    leaderBorrowerId: String(body.leaderBorrowerId || ''),
    leaderName: String(body.leaderName || ''),
    leaderPhone: String(body.leaderPhone || ''),
    members: (body.members || []) as any,
    totalActiveLoans: 0,
    totalGroupSavings: 0,
    repaymentRate: 100,
    solidarityFundBalance: 0,
    jointLiabilityAgreed: body.jointLiabilityAgreed !== false,
    status: 'Active',
  });
  await audit(ctx, 'GROUP_CREATED', `Created group ${body.groupName || id}`, 'MEMBERSHIP', { targetType: 'SolidarityGroup', targetId: id });
  res.status(201).json({ success: true, data: { id } });
});

branchRouter.post('/groups/:id/members', requireBranch(['register_clients', 'manage_loan_applications']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const rows = await db.select().from(schema.solidarityGroups).where(and(eq(schema.solidarityGroups.id, req.params.id), scopeCond(ctx, schema.solidarityGroups.branchId) as any)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Group not found in this branch.' });
  const group = rows[0] as any;
  const members = Array.isArray(group.members) ? group.members : [];
  const member = req.body || {};
  const { borrowerId } = member;
  if (!borrowerId || members.some((m: any) => m.borrowerId === borrowerId)) {
    return res.status(400).json({ error: 'Member already exists or borrowerId is missing.' });
  }
  const memberRow = borrowerId ? (await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, String(borrowerId))).limit(1))[0] : undefined;
  const newMember = {
    borrowerId: String(borrowerId),
    borrowerNumber: (memberRow as any)?.borrowerNumber || member.borrowerNumber || '',
    fullName: (memberRow as any)?.fullName || member.fullName || 'Member',
    phone: (memberRow as any)?.phone || member.phone || '',
    role: member.role || 'Member',
    activeLoanAmount: 0,
    remainingBalance: 0,
    savingsBalance: 0,
    status: 'Good Standing',
    weeklyDues: Number(member.weeklyDues) || 0,
  };
  await db.update(schema.solidarityGroups).set({ members: [...members, newMember] as any }).where(eq(schema.solidarityGroups.id, req.params.id));
  await audit(ctx, 'GROUP_MEMBER_ADDED', `Added ${newMember.fullName} to group ${group.groupName}`, 'MEMBERSHIP', { targetType: 'SolidarityGroup', targetId: req.params.id });
  res.status(201).json({ success: true, data: newMember });
});

branchRouter.delete('/groups/:id/members/:borrowerId', requireBranch(['register_clients', 'manage_loan_applications']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const rows = await db.select().from(schema.solidarityGroups).where(and(eq(schema.solidarityGroups.id, req.params.id), scopeCond(ctx, schema.solidarityGroups.branchId) as any)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Group not found in this branch.' });
  const group = rows[0] as any;
  const members = Array.isArray(group.members) ? group.members : [];
  const updated = members.filter((m: any) => m.borrowerId !== req.params.borrowerId);
  if (updated.length === members.length) return res.status(404).json({ error: 'Member not found in group.' });
  await db.update(schema.solidarityGroups).set({ members: updated as any }).where(eq(schema.solidarityGroups.id, req.params.id));
  await audit(ctx, 'GROUP_MEMBER_REMOVED', `Removed member ${req.params.borrowerId} from group ${group.groupName}`, 'MEMBERSHIP', { targetType: 'SolidarityGroup', targetId: req.params.id });
  res.json({ success: true });
});

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

branchRouter.post('/transactions', requireBranch(['process_loan_repayments', 'process_savings_deposits', 'process_savings_withdrawals', 'view_transaction_records']), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const body = req.body || {};
  const now = nowIso();
  const dateStr = todayStr();
  await db.insert(schema.financialTransactions).values({
    id: genId('txn'),
    referenceNumber: String(body.referenceNumber || genRef('REF')),
    clientId: String(body.clientId || ''),
    clientName: body.clientName ? String(body.clientName) : null,
    accountOrLoanId: String(body.accountOrLoanId || ''),
    accountOrLoanType: String(body.accountOrLoanType || 'General'),
    branchId: ctx.branchId || 'br-main',
    transactionType: String(body.transactionType || 'Adjustment'),
    amount: Number(body.amount) || 0,
    transactionDate: String(body.transactionDate || dateStr),
    paymentMethod: String(body.paymentMethod || 'Cash'),
    processedBy: `${ctx.staffName} (${ctx.title})`,
    processedByRole: ctx.staffRole,
    status: String(body.status || 'Completed'),
    notes: body.notes ? String(body.notes) : null,
    metadata: body.metadata || null,
    createdAt: now,
    updatedAt: now,
  });
  await audit(ctx, 'TRANSACTION_RECORDED', `Recorded ${body.transactionType} transaction ₱${Number(body.amount) || 0} (${body.referenceNumber || ''})`, 'PAYMENT');
  res.status(201).json({ success: true });
});

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
  await db.insert(schema.documents).values({
    id,
    docNumber,
    branchId: ctx.branchId || 'br-main',
    clientId,
    clientName,
    loanId: body.loanId ? String(body.loanId) : null,
    loanNumber: body.loanNumber ? String(body.loanNumber) : null,
    docName: String(body.docName || 'Untitled document'),
    docType: String(body.docType || 'Client Document'),
    fileUrl: body.fileUrl ? String(body.fileUrl) : null,
    uploadedBy: ctx.staffName,
    status: 'Active',
    notes: body.notes ? String(body.notes) : null,
    createdAt: now,
  });
  await audit(ctx, 'DOCUMENT_UPLOADED', `Uploaded document ${docNumber} (${body.docName || 'Untitled'})`, 'BORROWER', { targetType: 'Document', targetId: id });
  await notify(ctx, 'DOCUMENT', 'Document uploaded', `${body.docName || 'A document'} was uploaded to the branch records.`, { relatedType: 'Document', relatedId: id });
  res.status(201).json({ success: true, data: { id, docNumber } });
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
  await db.update(schema.branchNotifications).set({ isRead: true }).where(and(eq(schema.branchNotifications.id, req.params.id), scopeCond(ctx, schema.branchNotifications.branchId) as any));
  res.json({ success: true });
});

branchRouter.post('/notifications/read-all', requireBranch([]), async (req, res) => {
  const ctx = ctxOf(req);
  const db = getDb();
  if (!db) return res.json({ success: true });
  await db.update(schema.branchNotifications).set({ isRead: true }).where(scopeCond(ctx, schema.branchNotifications.branchId) as any);
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
  const groupsArr = data.groups as any[];

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
  } else if (type === 'portfolio') {
    const counts = new Map<string, number>();
    loansArr.forEach((l) => counts.set(String(l.status), (counts.get(String(l.status)) || 0) + 1));
    rows = loansArr.map((l) => ({
      loanNumber: l.loanNumber, borrowerName: l.borrowerName, productName: l.productName,
      principalAmount: l.principalAmount, remainingBalance: l.remainingBalance, status: l.status,
      nextPaymentDate: l.nextPaymentDate, applicationDate: l.applicationDate, loanOfficerName: l.loanOfficerName,
    }));
    summary.byStatus = Object.fromEntries(counts);
    summary.outstanding = money(loansArr.filter((l) => ['Disbursed', 'Active', 'In Arrears'].includes(l.status)).reduce((s, l) => s + l.remainingBalance, 0));
  } else if (type === 'overdue') {
    rows = loansArr
      .filter((l) => l.status === 'In Arrears' || (l.daysInArrears && l.daysInArrears > 0))
      .map((l) => ({ loanNumber: l.loanNumber, borrowerName: l.borrowerName, remainingBalance: l.remainingBalance, daysInArrears: l.daysInArrears, nextPaymentDate: l.nextPaymentDate, loanOfficerName: l.loanOfficerName }));
    summary.count = rows.length;
    summary.outstanding = money(rows.reduce((s, r) => s + r.remainingBalance, 0));
  } else if (type === 'applications') {
    rows = loansArr
      .filter((l) => APPLICATION_STATUSES.includes(l.status) && inRange(String(l.applicationDate)))
      .map((l) => ({ loanNumber: l.loanNumber, borrowerName: l.borrowerName, productName: l.productName, principalAmount: l.principalAmount, termMonths: l.termMonths, applicationDate: l.applicationDate, status: l.status, loanOfficerName: l.loanOfficerName }));
    summary.count = rows.length;
    summary.pending = rows.filter((r) => ['Draft', 'Submitted', 'Under Review', 'For Assessment'].includes(r.status)).length;
  } else if (type === 'repayments' || type === 'collections') {
    const scoped = paymentsArr.filter((p) => inRange(String(p.paymentDate)));
    rows = scoped.map((p) => ({ receiptNumber: p.receiptNumber, loanNumber: p.loanNumber, borrowerName: p.borrowerName, amount: p.amount, paymentDate: p.paymentDate, paymentMethod: p.paymentMethod, collectedBy: p.collectedBy }));
    summary.total = money(scoped.reduce((s, p) => s + p.amount, 0));
    summary.count = scoped.length;
    const daily: Record<string, number> = {};
    scoped.forEach((p) => { daily[String(p.paymentDate)] = money((daily[String(p.paymentDate)] || 0) + p.amount); });
    summary.daily = daily;
    if (type === 'collections') {
      const weeklyTotals: Record<string, number> = {};
      scoped.forEach((p) => {
        const d = new Date(String(p.paymentDate) + 'T00:00:00');
        const wk = new Date(d); wk.setDate(d.getDate() - d.getDay());
        const key = wk.toISOString().split('T')[0];
        weeklyTotals[key] = money((weeklyTotals[key] || 0) + p.amount);
      });
      summary.weekly = weeklyTotals;
      const monthlyTotals: Record<string, number> = {};
      scoped.forEach((p) => { const key = String(p.paymentDate).slice(0, 7); monthlyTotals[key] = money((monthlyTotals[key] || 0) + p.amount); });
      summary.monthly = monthlyTotals;
    }
  } else if (type === 'savings') {
    const scoped = savingsTxArr.filter((t) => inRange(String(t.date)));
    rows = scoped.map((t) => ({ transactionNumber: t.transactionNumber, memberName: t.memberName, type: t.type, amount: t.amount, balanceAfter: t.balanceAfter, date: t.date, processedBy: t.processedBy }));
    summary.deposits = money(scoped.filter((t) => t.type === 'Deposit').reduce((s, t) => s + t.amount, 0));
    summary.withdrawals = money(scoped.filter((t) => t.type === 'Withdrawal').reduce((s, t) => s + t.amount, 0));
    summary.totalBalances = money(data.savingsAccounts.reduce((s: number, a: any) => s + (a.balance || 0), 0));
  } else if (type === 'groups') {
    rows = groupsArr.map((g) => ({ groupCode: g.groupCode, groupName: g.groupName, centerName: g.centerName, leaderName: g.leaderName, members: Array.isArray(g.members) ? g.members.length : 0, repaymentRate: g.repaymentRate, totalGroupSavings: g.totalGroupSavings, status: g.status }));
    summary.count = rows.length;
    summary.repaymentRate = groupsArr.length ? money(groupsArr.reduce((s, g) => s + (g.repaymentRate || 0), 0) / groupsArr.length) : 0;
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