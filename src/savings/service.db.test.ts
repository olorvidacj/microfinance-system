import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import { HttpError, type AppDb } from '../kyc/errors';
import { seedBranch, seedMember } from '../kyc/testFixtures';
import { getRolePermissions } from '../auth/permissions';
import type { LendingClient, LendingStaff } from '../lending/service';
import {
  changeStatus,
  closeAccount,
  decideWithdrawalRequest,
  deposit,
  manilaToday,
  openAccount,
  reconcileSavings,
  requestWithdrawal,
  runInterestPosting,
  saveSavingsProduct,
  statement,
  withdraw,
} from './service';

let pg: PGlite;
let db: AppDb;
let seq = 0;
const key = () => `sav-key-${++seq}-${Date.now()}`;
const staff = (userId: string, role: string, branchId: string | null = 'br-a'): LendingStaff => ({
  kind: 'staff',
  userId,
  staffId: `st-${userId}`,
  name: `${role} ${userId}`,
  role,
  branchId,
  viewAll: branchId === null,
  permissions: getRolePermissions(role),
});
const admin = staff('admin', 'ADMINISTRATOR', null);
const teller = staff('tel', 'CASHIER_TELLER');
const manager = staff('mgr', 'MANAGER');
const officer = staff('off', 'LOAN_OFFICER');
const client = (borrowerId: string): LendingClient => ({ kind: 'client', userId: `u-${borrowerId}`, name: 'Juan', borrowerId });
let limitedId: string;
let compulsoryId: string;

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

async function member(verified = true) {
  const id = await seedMember(db);
  if (verified) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('hoscomo.kyc_actor', 'reconcile', true)`);
      await tx.update(schema.borrowers).set({ kycStatus: 'APPROVED' }).where(eq(schema.borrowers.id, id));
    });
  }
  return id;
}

async function account(productId = limitedId, opening = '5000') {
  const m = await member();
  const a = await openAccount(db, teller, { memberId: m, productId, openingDeposit: opening }, key());
  return { memberId: m, accountId: a.id };
}

beforeAll(async () => {
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await seedBranch(db, 'br-a');
  const p = await saveSavingsProduct(db, admin, null, {
    code: 'SAV-LIMITED',
    name: 'Limited regular savings',
    kind: 'REGULAR',
    annualRate: '1',
    accrualMethod: 'AVERAGE_DAILY_BALANCE',
    minimumBalance: '1000',
    minimumOpeningDeposit: '500',
    maxWithdrawalAmount: '20000',
    maxWithdrawalsPerMonth: '3',
    termMonths: '',
    status: 'ACTIVE',
  });
  limitedId = p.id;
  const c = await saveSavingsProduct(db, admin, null, {
    code: 'SAV-GROUP',
    name: 'Group compulsory savings',
    kind: 'COMPULSORY',
    annualRate: '2',
    accrualMethod: 'MINIMUM_BALANCE',
    minimumBalance: '0',
    minimumOpeningDeposit: '0',
    maxWithdrawalAmount: '',
    maxWithdrawalsPerMonth: '',
    termMonths: '',
    status: 'ACTIVE',
  });
  compulsoryId = c.id;
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

describe('products', () => {
  const dto = {
    code: 'SAV-TD12',
    name: '12-month time deposit',
    kind: 'TIME_DEPOSIT',
    annualRate: '3.5',
    accrualMethod: 'MINIMUM_BALANCE',
    minimumBalance: '0',
    minimumOpeningDeposit: '10000',
    maxWithdrawalAmount: '',
    maxWithdrawalsPerMonth: '',
    termMonths: '12',
    status: 'ACTIVE',
  };

  it('only head office edits; codes are unique; the kind is locked after creation', async () => {
    await expectHttp(saveSavingsProduct(db, manager, null, dto), 403, 'FORBIDDEN');
    const td = await saveSavingsProduct(db, admin, null, dto);
    expect(td).toMatchObject({ kind: 'TIME_DEPOSIT', termMonths: 12, minimumOpeningDeposit: 1_000_000 });
    await expectHttp(saveSavingsProduct(db, admin, null, { ...dto, code: 'sav-td12' }), 409, 'DUPLICATE_CODE');
    await expectHttp(saveSavingsProduct(db, admin, td.id, { ...dto, kind: 'REGULAR', termMonths: '' }), 409, 'KIND_LOCKED');
    const edited = await saveSavingsProduct(db, admin, td.id, { ...dto, annualRate: '4' });
    expect(edited.annualRate).toBe(40_000);
    await expectHttp(saveSavingsProduct(db, admin, null, { ...dto, code: 'X' }), 400, 'INVALID_PRODUCT');
  });

  it('a time deposit gets its maturity date and cannot be withdrawn before it', async () => {
    const [td] = await db.select().from(schema.savingsProducts).where(eq(schema.savingsProducts.code, 'SAV-TD12'));
    const { accountId } = await account(td.id, '10000');
    const [row] = await db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.id, accountId));
    expect(row.maturityDate! > manilaToday()).toBe(true);
    await expectHttp(withdraw(db, teller, accountId, { amount: '100', method: 'CASH' }, key()), 409, 'NOT_MATURED');
  });
});

describe('accounts', () => {
  it('opens only for KYC-verified members, with the opening deposit ledgered', async () => {
    const unverified = await member(false);
    await expectHttp(openAccount(db, teller, { memberId: unverified, productId: limitedId, openingDeposit: '5000' }, key()), 403, 'KYC_REQUIRED');
    const m = await member();
    await expectHttp(openAccount(db, teller, { memberId: m, productId: limitedId, openingDeposit: '100' }, key()), 400, 'BELOW_OPENING');
    const a = await openAccount(db, teller, { memberId: m, productId: limitedId, openingDeposit: '5000' }, key());
    expect(a).toMatchObject({ status: 'ACTIVE', balance: '5000.00' });
    expect(a.passbookNumber).toMatch(/^SA-\d{4}-\d{6}$/);
    await expectHttp(openAccount(db, teller, { memberId: m, productId: limitedId, openingDeposit: '5000' }, key()), 409, 'DUPLICATE_ACCOUNT');
    expect((await reconcileSavings(db)).ok).toBe(true);
  });

  it('deposits and withdrawals move the balance, ledger and member total together', async () => {
    const { memberId, accountId } = await account();
    const d = await deposit(db, teller, accountId, { amount: '2500.50', method: 'CASH' }, key());
    expect(d.transaction).toMatchObject({ kind: 'DEPOSIT', moneyIn: '2500.50', balance: '7500.50' });
    const w = await withdraw(db, teller, accountId, { amount: '1500.25', method: 'CASH' }, key());
    expect(w.transaction).toMatchObject({ kind: 'WITHDRAWAL', moneyOut: '1500.25', balance: '6000.25' });
    const [m] = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, memberId));
    expect(m.savingsBalance).toBe(6000.25);
    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, accountId));
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(['SAVINGS_ACCOUNT_OPENED', 'SAVINGS_DEPOSIT', 'SAVINGS_WITHDRAWAL']));
    const r = await reconcileSavings(db);
    expect(r.mismatches).toEqual([]);
    expect(r.generalLedger.find((g) => g.accountCode === '2010')?.ok).toBe(true);
  });

  it('is idempotent', async () => {
    const { accountId } = await account();
    const k = key();
    const a = await deposit(db, teller, accountId, { amount: '100', method: 'CASH' }, k);
    const b = await deposit(db, teller, accountId, { amount: '100', method: 'CASH' }, k);
    expect(b.transaction.id).toBe(a.transaction.id);
    expect(b.account.balance).toBe('5100.00');
  });
});

describe('withdrawal rules on the server', () => {
  it('rejects a withdrawal over the per-transaction limit', async () => {
    const { accountId } = await account(limitedId, '50000');
    const e = await expectHttp(withdraw(db, teller, accountId, { amount: '20000.01', method: 'CASH' }, key()), 409, 'OVER_LIMIT');
    expect(e.message).toMatch(/₱20,000.00/);
  });

  it('rejects one that would break the minimum balance', async () => {
    const { accountId } = await account(limitedId, '5000');
    const e = await expectHttp(withdraw(db, teller, accountId, { amount: '4500', method: 'CASH' }, key()), 409, 'BELOW_MINIMUM');
    expect((e.details as any).available).toBe('4000.00');
  });

  it('enforces the monthly count, frozen accounts and compulsory savings', async () => {
    const { accountId } = await account(limitedId, '20000');
    for (let i = 0; i < 3; i++) await withdraw(db, teller, accountId, { amount: '100', method: 'CASH' }, key());
    await expectHttp(withdraw(db, teller, accountId, { amount: '100', method: 'CASH' }, key()), 409, 'MONTHLY_LIMIT');

    const other = await account(limitedId, '20000');
    await expectHttp(changeStatus(db, teller, other.accountId, 'FREEZE', 'Court order'), 403, 'FORBIDDEN');
    await changeStatus(db, manager, other.accountId, 'FREEZE', 'Court order received');
    await expectHttp(withdraw(db, teller, other.accountId, { amount: '100', method: 'CASH' }, key()), 409, 'ACCOUNT_FROZEN');
    await deposit(db, teller, other.accountId, { amount: '100', method: 'CASH' }, key());
    await changeStatus(db, manager, other.accountId, 'UNFREEZE', 'Order lifted');
    await withdraw(db, teller, other.accountId, { amount: '100', method: 'CASH' }, key());

    const group = await account(compulsoryId, '1000');
    await expectHttp(withdraw(db, teller, group.accountId, { amount: '100', method: 'CASH' }, key()), 409, 'NOT_WITHDRAWABLE');
  });

  it('needs the destination for bank and e-wallet withdrawals, and permission', async () => {
    const { accountId } = await account(limitedId, '20000');
    await expectHttp(withdraw(db, teller, accountId, { amount: '100', method: 'BANK_TRANSFER', referenceNumber: 'BDO-1' }, key()), 400, 'INVALID_DESTINATION');
    const r = await withdraw(db, teller, accountId, { amount: '100', method: 'BANK_TRANSFER', referenceNumber: 'BDO-1', destinationAccount: '0012-3456' }, key());
    expect(r.transaction.destinationAccount).toBe('0012-3456');
    await expectHttp(withdraw(db, officer, accountId, { amount: '100', method: 'CASH' }, key()), 403, 'FORBIDDEN');
    await expectHttp(withdraw(db, staff('telb', 'CASHIER_TELLER', 'br-b'), accountId, { amount: '100', method: 'CASH' }, key()), 404);
  });
});

describe('interest posting', () => {
  it('posts each complete month once, reconciles, and shows in the statement', async () => {
    const { accountId } = await account(limitedId, '10000');
    // The account was opened three months ago with 10,000.00.
    const today = manilaToday();
    const opened = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    opened.setUTCMonth(opened.getUTCMonth() - 3);
    const openedOn = opened.toISOString().slice(0, 10);
    await pg.query(`update savings_accounts set opened_at = $2::date where id = $1`, [accountId, openedOn]);
    await pg.query(`update savings_transactions set date = $2 where savings_account_id = $1`, [accountId, openedOn]);

    const run1 = await runInterestPosting(db, today);
    expect(run1.interestPostings).toBeGreaterThanOrEqual(3);
    const rows = async () => db.select().from(schema.savingsTransactions).where(eq(schema.savingsTransactions.savingsAccountId, accountId));
    const interest = (await rows()).filter((t) => t.kind === 'INTEREST');
    expect(interest).toHaveLength(3);
    expect(new Set(interest.map((t) => t.interestPeriod)).size).toBe(3);
    // 1% a year on 10,000.00 for a 30- or 31-day month is about 8.22 to 8.49.
    for (const t of interest) expect(t.amount).toBeGreaterThan(7.5);

    const run2 = await runInterestPosting(db, today);
    const run3 = await runInterestPosting(db, today);
    expect((await rows()).filter((t) => t.kind === 'INTEREST')).toHaveLength(3);
    expect(run2.interestPostings).toBe(0);
    expect(run3.interestPostings).toBe(0);

    const r = await reconcileSavings(db);
    expect(r.ok).toBe(true);

    const st = await statement(db, teller, accountId);
    expect(st.lines.map((l) => l.kind)).toEqual(['DEPOSIT', 'INTEREST', 'INTEREST', 'INTEREST']);
    let running = 0;
    for (const l of st.lines) {
      running += Math.round(Number(l.moneyIn ?? 0) * 100) - Math.round(Number(l.moneyOut ?? 0) * 100);
      expect(Math.round(Number(l.balance) * 100)).toBe(running);
    }
    expect(st.closingBalance).toBe(st.account.balance);
  });
});

describe('member withdrawal requests and closing', () => {
  it('a member requests; staff approve (posting it) or reject with a reason', async () => {
    const { memberId, accountId } = await account(limitedId, '20000');
    await expectHttp(requestWithdrawal(db, client(memberId), { accountId, amount: '25000', destination: 'E_WALLET', destinationAccount: '0917', reason: 'School fees' }), 409, 'OVER_LIMIT');
    const req = await requestWithdrawal(db, client(memberId), { accountId, amount: '3000', destination: 'E_WALLET', destinationAccount: '0917 111 2222', reason: 'School fees' });
    expect(req.status).toBe('PENDING');
    await expectHttp(requestWithdrawal(db, client(memberId), { accountId, amount: '100', destination: 'CASH_PICKUP', reason: 'Food' }), 409, 'PENDING_REQUEST');
    const done = await decideWithdrawalRequest(db, teller, req.id, { decision: 'APPROVE', referenceNumber: 'GC-REL-1' });
    expect(done.status).toBe('APPROVED');
    const [txn] = await db.select().from(schema.savingsTransactions).where(eq(schema.savingsTransactions.id, done.transactionId!));
    expect(txn).toMatchObject({ kind: 'WITHDRAWAL', method: 'E_WALLET', destinationAccount: '0917 111 2222', withdrawalRequestId: req.id });
    const req2 = await requestWithdrawal(db, client(memberId), { accountId, amount: '100', destination: 'CASH_PICKUP', reason: 'Food' });
    await expectHttp(decideWithdrawalRequest(db, teller, req2.id, { decision: 'REJECT', reason: '' }), 400, 'REASON_REQUIRED');
    const rej = await decideWithdrawalRequest(db, teller, req2.id, { decision: 'REJECT', reason: 'Please come to the branch with your ID.' });
    expect(rej).toMatchObject({ status: 'REJECTED', rejectionReason: 'Please come to the branch with your ID.' });
  });

  it('a member only reaches their own account, and needs current KYC to request', async () => {
    const mine = await account(limitedId, '20000');
    const other = await account(limitedId, '20000');
    await expectHttp(requestWithdrawal(db, client(mine.memberId), { accountId: other.accountId, amount: '100', destination: 'CASH_PICKUP', reason: 'Food' }), 404);
    await expectHttp(statement(db, client(mine.memberId), other.accountId), 404);
    await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('hoscomo.kyc_actor', 'reconcile', true)`);
      await tx.update(schema.borrowers).set({ kycStatus: 'REJECTED' }).where(eq(schema.borrowers.id, mine.memberId));
    });
    await expectHttp(requestWithdrawal(db, client(mine.memberId), { accountId: mine.accountId, amount: '100', destination: 'CASH_PICKUP', reason: 'Food' }), 403, 'KYC_REQUIRED');
  });

  it('closing pays out the balance, even below the minimum, then refuses further activity', async () => {
    const { accountId } = await account(limitedId, '5000');
    const closed = await closeAccount(db, teller, accountId, { amount: '0', reason: 'Member moved away', method: 'CASH' }, key());
    expect(closed).toMatchObject({ status: 'CLOSED', balance: '0.00' });
    await expectHttp(deposit(db, teller, accountId, { amount: '100', method: 'CASH' }, key()), 409, 'ACCOUNT_CLOSED');
    expect((await reconcileSavings(db)).ok).toBe(true);
  });

  it('transactions cannot be deleted', async () => {
    const { accountId } = await account();
    const err = await db.delete(schema.savingsTransactions).where(eq(schema.savingsTransactions.savingsAccountId, accountId)).then(() => null, (e) => e);
    expect(String(err?.cause?.message ?? err?.message)).toMatch(/never deleted/);
  });
});
