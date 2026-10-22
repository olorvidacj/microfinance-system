import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import { HttpError, type AppDb } from '../kyc/errors';
import { manilaToday } from '../kyc/service';
import { seedBranch, seedMember } from '../kyc/testFixtures';
import { getRolePermissions } from '../auth/permissions';
import { centsFromDb, productToDto, type ProductDto } from '../../shared/lending';
import {
  cancelApplication,
  clientLoans,
  createApplication,
  decideApplication,
  disburseLoan,
  listProducts,
  loanDetail,
  saveProduct,
  startReview,
  submitApplication,
  trialBalance,
  type LendingClient,
  type LendingStaff,
} from './service';

let pg: PGlite;
let db: AppDb;

const staff = (userId: string, role: string, branchId: string | null = 'br-a', viewAll = false): LendingStaff => ({
  kind: 'staff',
  userId,
  staffId: `st-${userId}`,
  name: `${role} ${userId}`,
  role,
  branchId,
  viewAll,
  permissions: getRolePermissions(role),
});

const admin = staff('admin', 'ADMINISTRATOR', null, true);
const officer = staff('off1', 'LOAN_OFFICER');
const officer2 = staff('off2', 'LOAN_OFFICER');
const manager = staff('mgr', 'MANAGER');
const teller = staff('tel', 'CASHIER_TELLER');
const outsider = staff('offb', 'LOAN_OFFICER', 'br-b');
const client = (borrowerId: string): LendingClient => ({ kind: 'client', userId: `u-${borrowerId}`, name: 'Juan', borrowerId });

const productForm: ProductDto = {
  code: 'ML-WEEKLY',
  name: 'Micro-enterprise loan',
  category: 'Livelihood',
  description: 'Working capital for small stores',
  interestMethod: 'DIMINISHING',
  annualRate: '18',
  minAmount: '5000',
  maxAmount: '150000',
  minTermMonths: 3,
  maxTermMonths: 24,
  frequency: 'MONTHLY',
  fees: [
    { code: 'PROCESSING', label: 'Processing fee', kind: 'PERCENT', value: '2' },
    { code: 'NOTARIAL', label: 'Notarial fee', kind: 'FIXED', value: '150' },
  ],
  penaltyRate: '3',
  lendingType: 'INDIVIDUAL',
  requiresCollateral: false,
  requiresGuarantor: false,
  status: 'ACTIVE',
};

let productId: string;

async function expectHttp(p: Promise<unknown>, status: number, code?: string): Promise<HttpError> {
  try {
    await p;
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    expect(e.status).toBe(status);
    if (code) expect(e.code).toBe(code);
    return e;
  }
  throw new Error(`expected HTTP ${status}${code ? ` ${code}` : ''}`);
}

async function verifiedMember(overrides: Record<string, unknown> = {}) {
  const id = await seedMember(db, overrides as any);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('hoscomo.kyc_actor', 'reconcile', true)`);
    await tx.update(schema.borrowers).set({ kycStatus: 'APPROVED' }).where(eq(schema.borrowers.id, id));
  });
  return id;
}

const cash = (date = manilaToday()) => ({ method: 'CASH', disbursementDate: date });

beforeAll(async () => {
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await seedBranch(db, 'br-a');
  await seedBranch(db, 'br-b');
  const p = await saveProduct(db, admin, null, productForm);
  productId = p.id;
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

describe('products', () => {
  it('stores exact terms and lists only active products by default', async () => {
    const [p] = (await listProducts(db)).filter((x) => x.id === productId);
    expect(p).toMatchObject({ annualRate: 180_000, minAmount: 500_000, maxAmount: 15_000_000, frequency: 'MONTHLY', interestMethod: 'DIMINISHING' });
    expect(p.fees).toEqual([
      { code: 'PROCESSING', label: 'Processing fee', kind: 'PERCENT', value: 20_000 },
      { code: 'NOTARIAL', label: 'Notarial fee', kind: 'FIXED', value: 15_000 },
    ]);
    const retired = await saveProduct(db, admin, null, { ...productForm, code: 'OLD-1', status: 'INACTIVE' });
    expect((await listProducts(db)).some((x) => x.id === retired.id)).toBe(false);
    expect((await listProducts(db, { includeInactive: true })).some((x) => x.id === retired.id)).toBe(true);
    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, productId));
    expect(audits.map((a) => a.action)).toContain('LOAN_PRODUCT_CREATED');
  });

  it('rejects invalid products with field errors and duplicate codes', async () => {
    const e = await expectHttp(saveProduct(db, admin, null, { ...productForm, code: 'X2', minAmount: '9000', maxAmount: '100' }), 400, 'INVALID_PRODUCT');
    expect((e.details as any).fields.maxAmount).toBeTruthy();
    await expectHttp(saveProduct(db, admin, null, { ...productForm, code: 'ml-weekly' }), 409);
  });
});

describe('applications', () => {
  it('lets a verified member apply from the portal and records history, audit and a staff notification', async () => {
    const m = await verifiedMember();
    const { loan, replayed } = await createApplication(db, client(m), { productId, amount: '20000', termMonths: 6, purpose: 'BUSINESS', purposeDetails: { businessName: 'Sari-sari' }, requestKey: `rk-${m}` });
    expect(replayed).toBe(false);
    expect(loan.status).toBe('Submitted');
    expect(loan.channel).toBe('PORTAL');
    expect(loan.loanNumber).toMatch(/^LN-\d{4}-\d{6}$/);
    expect(loan.principal).toBe('20000.00');
    expect(loan.totalFees).toBe('550.00'); // 2% of 20,000 + 150
    expect(loan.scheduleKind).toBe('PROJECTED');
    expect(loan.schedule).toHaveLength(6);
    expect(loan.history.map((h) => h.to)).toEqual(['Draft', 'Submitted']);
    const notes = await db.select().from(schema.branchNotifications).where(eq(schema.branchNotifications.relatedId, loan.id));
    expect(notes.some((n) => n.audience === 'STAFF' && n.type === 'LOAN_APPLICATION')).toBe(true);

    const again = await createApplication(db, client(m), { productId, amount: '20000', termMonths: 6, purpose: 'BUSINESS', requestKey: `rk-${m}` });
    expect(again.replayed).toBe(true);
    expect(again.loan.id).toBe(loan.id);
  });

  it('refuses members whose KYC is not verified', async () => {
    const m = await seedMember(db);
    await expectHttp(createApplication(db, client(m), { productId, amount: '20000', termMonths: 6, purpose: 'BUSINESS' }), 403, 'KYC_REQUIRED');
  });

  it('checks product limits on the server', async () => {
    const m = await verifiedMember();
    const e = await expectHttp(createApplication(db, client(m), { productId, amount: '4999.99', termMonths: 30, purpose: 'BUSINESS' }), 400, 'INVALID_APPLICATION');
    expect(Object.keys((e.details as any).fields).sort()).toEqual(['amount', 'termMonths']);
  });

  it('allows one open loan per product', async () => {
    const m = await verifiedMember();
    await createApplication(db, client(m), { productId, amount: '20000', termMonths: 6, purpose: 'BUSINESS' });
    await expectHttp(createApplication(db, client(m), { productId, amount: '10000', termMonths: 3, purpose: 'BUSINESS' }), 409, 'DUPLICATE_PRODUCT');
  });

  it('lets an officer apply for a member of their branch only', async () => {
    const m = await verifiedMember();
    const { loan } = await createApplication(db, officer, { borrowerId: m, productId, amount: '15000', termMonths: 3, purpose: 'HOUSEHOLD' });
    expect(loan.channel).toBe('BRANCH');
    expect(loan.loanOfficerName).toBe(officer.name);
    const notes = await db.select().from(schema.branchNotifications).where(and(eq(schema.branchNotifications.relatedId, loan.id), eq(schema.branchNotifications.audience, 'CLIENT')));
    expect(notes).toHaveLength(1);
    const m2 = await verifiedMember();
    await expectHttp(createApplication(db, outsider, { borrowerId: m2, productId, amount: '15000', termMonths: 3, purpose: 'HOUSEHOLD' }), 404);
    await expectHttp(createApplication(db, teller, { borrowerId: m2, productId, amount: '15000', termMonths: 3, purpose: 'HOUSEHOLD' }), 403);
  });

  it('blocks a new application while another loan has an overdue installment', async () => {
    const m = await verifiedMember();
    const { loan } = await createApplication(db, client(m), { productId, amount: '10000', termMonths: 3, purpose: 'BUSINESS' });
    await decideApplication(db, officer, loan.id, { decision: 'APPROVE', reason: 'Within capacity' });
    await disburseLoan(db, teller, loan.id, cash(), `key-overdue-${m}`);
    await pg.query(`UPDATE loan_schedule SET due_date = current_date - 3 WHERE loan_id = $1 AND installment_number = 1`, [loan.id]);
    const other = await saveProduct(db, admin, null, { ...productForm, code: `EM-${m}`.slice(0, 20).toUpperCase().replace(/[^A-Z0-9-]/g, ''), name: 'Emergency loan' });
    await expectHttp(createApplication(db, client(m), { productId: other.id, amount: '6000', termMonths: 3, purpose: 'MEDICAL' }), 409, 'OVERDUE_LOAN');
  });

  it('requires lending-group membership for group products', async () => {
    const m = await verifiedMember();
    const group = await saveProduct(db, admin, null, { ...productForm, code: 'GRP-1', name: 'Group loan', lendingType: 'GROUP' });
    await expectHttp(createApplication(db, client(m), { productId: group.id, amount: '6000', termMonths: 3, purpose: 'BUSINESS' }), 409, 'GROUP_REQUIRED');
    // Membership lives in group_members (0028); the group must be ACTIVE.
    await pg.query(
      `INSERT INTO solidarity_groups (id, group_code, group_name, center_name, branch_id, formed_date, meeting_day, meeting_time, meeting_location,
         loan_officer_id, loan_officer_name, status)
       VALUES ('grp-1', 'G-1', 'Group one', 'Center', 'br-a', '2026-01-01', 'Monday', '09:00', 'Hall', 'st-off1', 'Officer', 'FORMING')`,
    );
    await pg.query(`INSERT INTO group_members (id, group_id, borrower_id, role) VALUES ('gm-1', 'grp-1', $1, 'LEADER')`, [m]);
    await expectHttp(createApplication(db, client(m), { productId: group.id, amount: '6000', termMonths: 3, purpose: 'BUSINESS' }), 409, 'GROUP_REQUIRED');
    await pg.query(`UPDATE solidarity_groups SET status = 'ACTIVE' WHERE id = 'grp-1'`);
    const { loan } = await createApplication(db, client(m), { productId: group.id, amount: '6000', termMonths: 3, purpose: 'BUSINESS' });
    expect(loan.lendingType).toBe('GROUP');
  });

  it('saves drafts, lets the member submit or cancel them', async () => {
    const m = await verifiedMember();
    const { loan } = await createApplication(db, client(m), { productId, amount: '12000', termMonths: 4, purpose: 'EDUCATION', submit: false });
    expect(loan.status).toBe('Draft');
    const submitted = await submitApplication(db, client(m), loan.id, { amount: '13000' });
    expect(submitted.status).toBe('Submitted');
    expect(submitted.principal).toBe('13000.00');
    const cancelled = await cancelApplication(db, client(m), loan.id, 'Found other funding');
    expect(cancelled.status).toBe('Cancelled');
    await expectHttp(submitApplication(db, client(m), loan.id), 409, 'BAD_TRANSITION');
  });

  it('hides other members’ loans from a client', async () => {
    const a = await verifiedMember();
    const b = await verifiedMember();
    const { loan } = await createApplication(db, client(a), { productId, amount: '9000', termMonths: 3, purpose: 'BUSINESS' });
    await expectHttp(loanDetail(db, client(b), loan.id), 404);
    await expectHttp(cancelApplication(db, client(b), loan.id, 'not mine'), 404);
  });
});

describe('review and approval', () => {
  it('requires a reason, enforces role limits and four-eyes', async () => {
    const m = await verifiedMember();
    const { loan } = await createApplication(db, officer, { borrowerId: m, productId, amount: '60000', termMonths: 12, purpose: 'BUSINESS' });
    await expectHttp(decideApplication(db, officer2, loan.id, { decision: 'APPROVE', reason: '' }), 400, 'REASON_REQUIRED');
    // The officer who filed it cannot approve it.
    await expectHttp(decideApplication(db, officer, loan.id, { decision: 'APPROVE', reason: 'Good standing' }), 403, 'SAME_APPROVER');
    // A loan officer's limit is 50,000.
    const over = await expectHttp(decideApplication(db, officer2, loan.id, { decision: 'APPROVE', reason: 'Good standing' }), 403, 'APPROVAL_LIMIT');
    expect(over.message).toMatch(/₱50,000.00/);
    // ...but they can approve a reduced amount within their limit.
    const reduced = await decideApplication(db, officer2, loan.id, { decision: 'APPROVE', reason: 'Approved at a lower amount', approvedAmount: '50000', approvedTermMonths: 10 });
    expect(reduced.loan.status).toBe('Approved');
    expect(reduced.loan.principal).toBe('50000.00');
    expect(reduced.loan.termMonths).toBe(10);
    expect(reduced.loan.totalFees).toBe('1150.00');
    expect(reduced.loan.history.map((h) => h.to)).toEqual(['Draft', 'Submitted', 'Under Review', 'Approved']);
    expect(reduced.loan.decisionReason).toBe('Approved at a lower amount');
    const replay = await decideApplication(db, officer2, loan.id, { decision: 'APPROVE', reason: 'Approved at a lower amount', approvedAmount: '50000', approvedTermMonths: 10 });
    expect(replay.replayed).toBe(true);
    const memberNotes = await db.select().from(schema.branchNotifications).where(and(eq(schema.branchNotifications.relatedId, loan.id), eq(schema.branchNotifications.type, 'LOAN_APPROVED')));
    expect(memberNotes.some((n) => n.audience === 'CLIENT' && n.borrowerId === m)).toBe(true);
    const audits = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.targetId, loan.id), eq(schema.auditLogs.action, 'LOAN_APPROVED')));
    expect(audits).toHaveLength(1);
  });

  it('lets a manager approve up to 250,000 and refuses more than was applied for', async () => {
    const m = await verifiedMember();
    const { loan } = await createApplication(db, client(m), { productId, amount: '120000', termMonths: 12, purpose: 'BUSINESS' });
    await expectHttp(decideApplication(db, manager, loan.id, { decision: 'APPROVE', reason: 'ok then', approvedAmount: '130000' }), 400, 'ABOVE_REQUEST');
    const r = await decideApplication(db, manager, loan.id, { decision: 'APPROVE', reason: 'Strong cash flow' });
    expect(r.loan.status).toBe('Approved');
  });

  it('rejects and returns with reasons and refuses illegal transitions', async () => {
    const m = await verifiedMember();
    const { loan } = await createApplication(db, client(m), { productId, amount: '8000', termMonths: 3, purpose: 'BUSINESS' });
    await expectHttp(disburseLoan(db, teller, loan.id, cash(), 'key-illegal-1'), 409, 'BAD_TRANSITION');
    const returned = await decideApplication(db, officer, loan.id, { decision: 'RETURN', reason: 'Attach proof of income' });
    expect(returned.loan.status).toBe('Draft');
    expect(returned.loan.returnedReason).toBe('Attach proof of income');
    await submitApplication(db, client(m), loan.id);
    await startReview(db, officer, loan.id);
    const rejected = await decideApplication(db, officer, loan.id, { decision: 'REJECT', reason: 'Debt ratio too high' });
    expect(rejected.loan.status).toBe('Rejected');
    await expectHttp(decideApplication(db, officer2, loan.id, { decision: 'APPROVE', reason: 'try again' }), 409, 'BAD_TRANSITION');
    // A teller has no review authority.
    const { loan: other } = await createApplication(db, client(await verifiedMember()), { productId, amount: '8000', termMonths: 3, purpose: 'BUSINESS' });
    await expectHttp(decideApplication(db, teller, other.id, { decision: 'APPROVE', reason: 'ok ok' }), 409, 'BAD_TRANSITION');
  });
});

describe('disbursement', () => {
  it('releases in one transaction: schedule, balanced ledger, receipt, history, audit, notification', async () => {
    const before = await trialBalance(db);
    const m = await verifiedMember();
    const { loan } = await createApplication(db, client(m), { productId, amount: '25000', termMonths: 6, purpose: 'BUSINESS' });
    await decideApplication(db, officer, loan.id, { decision: 'APPROVE', reason: 'Good repayment history' });
    const today = manilaToday();
    const r = await disburseLoan(db, teller, loan.id, { method: 'E_WALLET', referenceNumber: 'GC-778899', destinationAccount: '09171234567', disbursementDate: today, notes: 'Released at counter 2' }, 'key-release-1');
    expect(r.replayed).toBe(false);
    const v = r.loan;
    expect(v.status).toBe('Active');
    expect(v.history.map((h) => h.to)).toEqual(['Draft', 'Submitted', 'Under Review', 'Approved', 'Disbursed', 'Active']);
    expect(v.scheduleKind).toBe('STORED');
    expect(v.schedule).toHaveLength(6);
    const principalSum = v.schedule.reduce((s, l) => s + centsFromDb(l.principal), 0);
    const interestSum = v.schedule.reduce((s, l) => s + centsFromDb(l.interest), 0);
    expect(principalSum).toBe(2_500_000);
    expect(interestSum).toBe(centsFromDb(v.totalInterest));
    expect(centsFromDb(v.totalPayable)).toBe(2_500_000 + interestSum);
    expect(v.schedule[v.schedule.length - 1].balanceAfter).toBe('0.00');
    expect(v.nextDue).toEqual({ dueDate: v.schedule[0].dueDate, amount: v.schedule[0].total });
    expect(v.disbursement).toMatchObject({ method: 'E_WALLET', referenceNumber: 'GC-778899', grossAmount: '25000.00', totalFees: '650.00', netAmount: '24350.00' });
    expect(r.receipt.receiptNumber).toMatch(/^DV-\d{4}-\d{6}$/);
    expect(r.receipt.totalAmount).toBe('24350.00');
    expect(r.receipt.lines.map((l) => l.amount)).toEqual(['25000.00', '500.00', '150.00']);

    // Ledger: this release adds exactly principal / net / fees and balances.
    const after = await trialBalance(db);
    const delta = (code: string, side: 'debit' | 'credit') =>
      (after.find((a) => a.accountCode === code)?.[side] ?? 0) - (before.find((a) => a.accountCode === code)?.[side] ?? 0);
    expect(delta('1110', 'debit')).toBe(2_500_000);
    expect(delta('1020', 'credit')).toBe(2_435_000);
    expect(delta('4030', 'credit')).toBe(65_000);
    const totalDebit = after.reduce((s, a) => s + a.debit, 0);
    const totalCredit = after.reduce((s, a) => s + a.credit, 0);
    expect(totalDebit).toBe(totalCredit);

    const entries = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.sourceRef, loan.id));
    expect(entries).toHaveLength(1);
    expect(entries[0].referenceNumber).toBe(r.receipt.receiptNumber);

    const audits = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.targetId, loan.id), eq(schema.auditLogs.action, 'LOAN_DISBURSED')));
    expect(audits).toHaveLength(1);
    const notes = await db.select().from(schema.branchNotifications).where(and(eq(schema.branchNotifications.relatedId, loan.id), eq(schema.branchNotifications.type, 'LOAN_DISBURSEMENT')));
    expect(notes.map((n) => n.audience)).toEqual(['CLIENT']);

    // The member sees the running loan and its schedule.
    const mine = await clientLoans(db, m);
    expect(mine.running.map((l) => l.id)).toContain(loan.id);
    expect(mine.summary.outstanding).toBe(v.totalPayable);
    const detail = await loanDetail(db, client(m), loan.id);
    expect(detail.schedule).toHaveLength(6);
    expect(detail.receipt?.receiptNumber).toBe(r.receipt.receiptNumber);
  });

  it('is idempotent: the same key replays, a new key cannot release twice', async () => {
    const m = await verifiedMember();
    const { loan } = await createApplication(db, client(m), { productId, amount: '10000', termMonths: 3, purpose: 'BUSINESS' });
    await decideApplication(db, officer, loan.id, { decision: 'APPROVE', reason: 'ok fine' });
    const first = await disburseLoan(db, teller, loan.id, cash(), 'key-double-1');
    const second = await disburseLoan(db, teller, loan.id, cash(), 'key-double-1');
    expect(second.replayed).toBe(true);
    expect(second.receipt.receiptNumber).toBe(first.receipt.receiptNumber);
    await expectHttp(disburseLoan(db, teller, loan.id, cash(), 'key-double-2'), 409, 'ALREADY_DISBURSED');
    const entries = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.sourceRef, loan.id));
    expect(entries).toHaveLength(1);
    const rows = await db.select().from(schema.loanSchedule).where(eq(schema.loanSchedule.loanId, loan.id));
    expect(rows).toHaveLength(3);
  });

  it('validates the release details and who may release', async () => {
    const m = await verifiedMember();
    const { loan } = await createApplication(db, client(m), { productId, amount: '10000', termMonths: 3, purpose: 'BUSINESS' });
    await decideApplication(db, officer, loan.id, { decision: 'APPROVE', reason: 'ok fine' });
    await expectHttp(disburseLoan(db, teller, loan.id, cash(), 'short'), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    const e = await expectHttp(disburseLoan(db, teller, loan.id, { method: 'BANK_TRANSFER', disbursementDate: manilaToday() }, 'key-bank-1'), 400, 'INVALID_DISBURSEMENT');
    expect(Object.keys((e.details as any).fields).sort()).toEqual(['destinationAccount', 'referenceNumber']);
    await expectHttp(disburseLoan(db, officer, loan.id, cash(), 'key-officer-1'), 403, 'FORBIDDEN');
    await expectHttp(disburseLoan(db, staff('telb', 'CASHIER_TELLER', 'br-b'), loan.id, cash(), 'key-other-branch'), 404);
    // The same bank reference cannot be used for two releases.
    await disburseLoan(db, teller, loan.id, { method: 'BANK_TRANSFER', referenceNumber: 'BDO-0001', destinationAccount: '0012-3456', disbursementDate: manilaToday() }, 'key-bank-2');
    const m2 = await verifiedMember();
    const { loan: l2 } = await createApplication(db, client(m2), { productId, amount: '10000', termMonths: 3, purpose: 'BUSINESS' });
    await decideApplication(db, officer, l2.id, { decision: 'APPROVE', reason: 'ok fine' });
    await expectHttp(disburseLoan(db, teller, l2.id, { method: 'BANK_TRANSFER', referenceNumber: 'bdo-0001', destinationAccount: '0099', disbursementDate: manilaToday() }, 'key-bank-3'), 409);
    const still = await loanDetail(db, teller, l2.id);
    expect(still.status).toBe('Approved');
    expect(still.schedule.length).toBeGreaterThan(0);
    expect(still.scheduleKind).toBe('PROJECTED');
  });

  it('refuses to release when the member is no longer verified', async () => {
    const m = await verifiedMember();
    const { loan } = await createApplication(db, client(m), { productId, amount: '10000', termMonths: 3, purpose: 'BUSINESS' });
    await decideApplication(db, officer, loan.id, { decision: 'APPROVE', reason: 'ok fine' });
    await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('hoscomo.kyc_actor', 'reconcile', true)`);
      await tx.update(schema.borrowers).set({ kycStatus: 'SUSPENDED' }).where(eq(schema.borrowers.id, m));
    });
    await expectHttp(disburseLoan(db, teller, loan.id, cash(), 'key-suspended'), 403, 'KYC_REQUIRED');
    expect((await loanDetail(db, teller, loan.id)).status).toBe('Approved');
  });
});

describe('ledger guard', () => {
  it('the database refuses an unbalanced journal entry', async () => {
    const accounts = await db.select().from(schema.ledgerAccounts);
    const cashId = accounts.find((a) => a.accountCode === '1010')!.accountId;
    const loansId = accounts.find((a) => a.accountCode === '1110')!.accountId;
    await expect(
      db.transaction(async (tx) => {
        const [e] = await tx
          .insert(schema.journalEntries)
          .values({ entryDate: manilaToday(), description: 'bad', sourceModule: 'test', status: 'posted', createdAt: new Date().toISOString() })
          .returning({ id: schema.journalEntries.journalEntryId });
        await tx.insert(schema.journalEntryLines).values([
          { entryId: e.id, lineNumber: 1, accountId: loansId, debit: '100.00', credit: '0' },
          { entryId: e.id, lineNumber: 2, accountId: cashId, debit: '0', credit: '99.99' },
        ]);
      }),
    ).rejects.toThrow(/unbalanced/);
  });
});

describe('wire format', () => {
  it('round-trips a stored product to the form shape', async () => {
    const [p] = (await listProducts(db)).filter((x) => x.id === productId);
    expect(productToDto(p)).toMatchObject({ annualRate: '18.0000', minAmount: '5000.00', fees: [{ value: '2.0000' }, { value: '150.00' }] });
  });
});
