import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import { HttpError, type AppDb } from '../kyc/errors';
import { manilaToday } from '../kyc/service';
import { seedBranch, seedMember } from '../kyc/testFixtures';
import { getRolePermissions } from '../auth/permissions';
import { createApplication, decideApplication, disburseLoan, saveProduct, trialBalance, type LendingClient, type LendingStaff } from '../lending/service';
import { reversePayment, runOverdueCheck } from '../lending/repayment';
import {
  addMember,
  changeGroupStatus,
  coverFromFund,
  createGroup,
  fundView,
  groupDetail,
  myGroup,
  pendingGroupLoans,
  postCollection,
  recordConsent,
  recordMeeting,
  reconcileGroupFunds,
  removeMember,
  setRole,
} from './service';

let pg: PGlite;
let db: AppDb;
let groupProduct: string;
let soloProduct: string;
let seq = 0;
const key = () => `grp-key-${++seq}-${Date.now()}`;
const today = manilaToday();
const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
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
const officer = staff('off1', 'LOAN_OFFICER');
const teller = staff('tel1', 'CASHIER_TELLER');
const manager = staff('mgr', 'MANAGER');
const otherBranch = staff('off9', 'LOAN_OFFICER', 'br-b');
const client = (borrowerId: string): LendingClient => ({ kind: 'client', userId: `u-${borrowerId}`, name: 'Member', borrowerId });

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
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('hoscomo.kyc_actor', 'reconcile', true)`);
    await tx.update(schema.borrowers).set({ kycStatus: verified ? 'APPROVED' : 'UNDER_REVIEW', activeLoansCount: 0 }).where(eq(schema.borrowers.id, id));
  });
  return id;
}

const GROUP = {
  groupName: 'Bambang Farmers',
  centerName: 'Center 1',
  meetingDay: 'Saturday',
  meetingTime: '09:00',
  meetingFrequency: 'WEEKLY',
  meetingLocation: 'Barangay hall',
  loanOfficerId: 'st-off1',
  arrearsThresholdDays: '7',
};
const apply = (borrowerId: string, productId = groupProduct) => createApplication(db, client(borrowerId), { productId, amount: '30000', termMonths: 3, purpose: 'BUSINESS' });

// The shared story: leader A, secretary B, treasurer C (the borrower who falls behind), member D.
let groupId: string;
let A: string, B: string, C: string, D: string;
let loanC: string;

beforeAll(async () => {
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await seedBranch(db, 'br-a');
  await seedBranch(db, 'br-b');
  await db.insert(schema.staff).values([
    { id: 'st-off1', name: 'Grace Mendoza', email: 'grace@example.test', role: 'LOAN_OFFICER', assignedBranchId: 'br-a', title: 'Loan Officer', avatar: '' },
    { id: 'st-off9', name: 'Other Officer', email: 'other@example.test', role: 'LOAN_OFFICER', assignedBranchId: 'br-b', title: 'Loan Officer', avatar: '' },
  ]);
  const base = {
    category: 'Test',
    description: '',
    interestMethod: 'FLAT',
    annualRate: '12',
    minAmount: '1000',
    maxAmount: '100000',
    minTermMonths: 1,
    maxTermMonths: 12,
    frequency: 'MONTHLY',
    fees: [],
    penaltyRate: '3',
    requiresCollateral: false,
    requiresGuarantor: false,
    status: 'ACTIVE',
  };
  groupProduct = (await saveProduct(db, admin, null, { ...base, code: 'GRP-3', name: 'Group loan', lendingType: 'GROUP' } as any)).id;
  soloProduct = (await saveProduct(db, admin, null, { ...base, code: 'IND-3', name: 'Individual loan', lendingType: 'INDIVIDUAL' } as any)).id;
  [A, B, C, D] = [await member(), await member(), await member(), await member()];
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

describe('forming a group', () => {
  it('only verified members of the branch, one group each, one holder per role; activation needs the officers', async () => {
    await expectHttp(createGroup(db, teller, GROUP), 403, 'FORBIDDEN');
    await expectHttp(createGroup(db, officer, { ...GROUP, meetingTime: '9am' }), 400, 'INVALID_GROUP');
    const g = await createGroup(db, officer, GROUP);
    groupId = g.group.id;
    expect(g.group).toMatchObject({ status: 'FORMING', loanOfficerName: 'Grace Mendoza' });
    expect(g.group.groupCode).toMatch(/^GRP-\d{4}-\d{4}$/);

    const unverified = await member(false);
    await expectHttp(addMember(db, officer, groupId, { borrowerId: unverified, role: 'MEMBER' }), 409, 'KYC_REQUIRED');
    await addMember(db, officer, groupId, { borrowerId: A, role: 'LEADER' });
    await addMember(db, officer, groupId, { borrowerId: B, role: 'SECRETARY' });
    await expectHttp(addMember(db, officer, groupId, { borrowerId: C, role: 'LEADER' }), 409, 'ROLE_TAKEN');
    const notReady = await expectHttp(changeGroupStatus(db, officer, groupId, 'ACTIVATE', ''), 409, 'NOT_READY');
    expect((notReady.details as any).issues).toEqual(['A group needs at least 3 members; it has 2.', 'Assign a treasurer.']);
    await addMember(db, officer, groupId, { borrowerId: C, role: 'TREASURER' });
    await addMember(db, officer, groupId, { borrowerId: D, role: 'MEMBER' });

    const other = await createGroup(db, officer, { ...GROUP, groupName: 'Second group' });
    await expectHttp(addMember(db, officer, other.group.id, { borrowerId: A }), 409, 'ALREADY_IN_GROUP');
    await expectHttp(addMember(db, otherBranch, groupId, { borrowerId: await member() }), 404);

    const active = await changeGroupStatus(db, officer, groupId, 'ACTIVATE', 'Formation training done');
    expect(active.group).toMatchObject({ status: 'ACTIVE', leaderBorrowerId: A });
    expect(active.members.map((m) => m.role)).toEqual(['LEADER', 'SECRETARY', 'TREASURER', 'MEMBER']);
    await expectHttp(changeGroupStatus(db, officer, groupId, 'ACTIVATE', ''), 409, 'BAD_TRANSITION');
  });

  it('roles move between members; an active group keeps its officers and minimum size', async () => {
    const swapped = await setRole(db, officer, groupId, D, 'LEADER');
    expect(swapped.members.find((m) => m.borrowerId === D)?.role).toBe('LEADER');
    expect(swapped.members.find((m) => m.borrowerId === A)?.role).toBe('MEMBER');
    expect(swapped.group.leaderBorrowerId).toBe(D);
    await setRole(db, officer, groupId, A, 'LEADER');
    await expectHttp(setRole(db, officer, groupId, B, 'MEMBER'), 409, 'ROLE_REQUIRED');
    await expectHttp(removeMember(db, officer, groupId, A, 'Moved away'), 409, 'LEADER_REQUIRED');
  });

  it('meetings record every member’s attendance once per date', async () => {
    await expectHttp(recordMeeting(db, officer, groupId, { meetingDate: today, attendance: [{ borrowerId: A, status: 'PRESENT' }] }), 400, 'ATTENDANCE_INCOMPLETE');
    const list = await recordMeeting(db, officer, groupId, {
      meetingDate: today,
      attendance: [A, B, C, D].map((id, i) => ({ borrowerId: id, status: i === 3 ? 'EXCUSED' : 'PRESENT' })),
    });
    expect(list[0]).toMatchObject({ meetingDate: today, present: 3, total: 4 });
    await expectHttp(recordMeeting(db, officer, groupId, { meetingDate: today, attendance: [A, B, C, D].map((id) => ({ borrowerId: id, status: 'PRESENT' })) }), 409, 'DUPLICATE_MEETING');
    await expectHttp(recordMeeting(db, officer, groupId, { meetingDate: shift(today, 1), attendance: [] }), 400, 'INVALID_MEETING');
  });
});

describe('borrowing under the group', () => {
  it('only members can apply; approval needs every other member’s consent', async () => {
    const outsider = await member();
    await expectHttp(apply(outsider), 409, 'GROUP_REQUIRED');

    const { loan } = await apply(C);
    loanC = loan.id;
    const [row] = await db.select().from(schema.loans).where(eq(schema.loans.id, loanC));
    expect(row.groupId).toBe(groupId);

    const none = await expectHttp(decideApplication(db, officer, loanC, { decision: 'APPROVE', reason: 'Good standing' }), 409, 'CONSENT_REQUIRED');
    expect((none.details as any).consent.missing.sort()).toEqual([A, B, D].sort());
    await recordConsent(db, officer, loanC, { borrowerId: A, decision: 'CONSENT' });
    await recordConsent(db, officer, loanC, { borrowerId: B, decision: 'CONSENT' });
    await expectHttp(recordConsent(db, officer, loanC, { borrowerId: C, decision: 'CONSENT' }), 409, 'OWN_LOAN');
    await expectHttp(recordConsent(db, client(D), loanC, { decision: 'DECLINE' }), 400, 'REASON_REQUIRED');
    await recordConsent(db, client(D), loanC, { decision: 'DECLINE', note: 'She still owes me for the carabao' });
    await expectHttp(decideApplication(db, officer, loanC, { decision: 'APPROVE', reason: 'Good standing' }), 409, 'CONSENT_REQUIRED');
    // D changes their mind at the next meeting.
    const pending = await recordConsent(db, client(D), loanC, { decision: 'CONSENT' });
    expect(pending[0].consent).toMatchObject({ complete: true });
    expect(pending[0].consent.records.find((r) => r.borrowerId === D)).toMatchObject({ decision: 'CONSENT', channel: 'PORTAL' });

    await decideApplication(db, officer, loanC, { decision: 'APPROVE', reason: 'Group guaranteed' });
    await disburseLoan(db, teller, loanC, { method: 'CASH', disbursementDate: today }, key());
    const [released] = await db.select().from(schema.loans).where(eq(schema.loans.id, loanC));
    expect(released.status).toBe('Active');
    expect(await pendingGroupLoans(db, officer, groupId)).toEqual([]);
  });
});

describe('the solidarity mechanism', () => {
  it('members pay into the fund in one batch; a double post replays it', async () => {
    const k = key();
    const lines = [A, B, C, D].map((id) => ({ borrowerId: id, fundAmount: '3000' }));
    await expectHttp(postCollection(db, officer, groupId, { method: 'CASH', lines }, k), 403, 'FORBIDDEN');
    const c1 = await postCollection(db, teller, groupId, { method: 'CASH', lines }, k);
    const c2 = await postCollection(db, teller, groupId, { method: 'CASH', lines }, k);
    expect(c2.id).toBe(c1.id);
    expect(c1).toMatchObject({ total: '12000.00' });
    expect((await fundView(db, teller, groupId)).balance).toBe('12000.00');
    expect((await reconcileGroupFunds(db)).ok).toBe(true);
  });

  it('a batch is all or nothing', async () => {
    const before = (await fundView(db, teller, groupId)).balance;
    const outsider = await member();
    await expectHttp(
      postCollection(db, teller, groupId, { method: 'CASH', lines: [{ borrowerId: A, fundAmount: '100' }, { borrowerId: outsider, fundAmount: '100' }] }, key()),
      409,
      'NOT_A_MEMBER',
    );
    expect((await fundView(db, teller, groupId)).balance).toBe(before);
  });

  it('when a member falls behind, the group and its leader are told once', async () => {
    const rows = await db.select().from(schema.loanSchedule).where(eq(schema.loanSchedule.loanId, loanC));
    for (const r of rows) await db.update(schema.loanSchedule).set({ dueDate: shift(today, -10 + (r.installmentNumber - 1) * 30) }).where(eq(schema.loanSchedule.id, r.id));
    const run1 = await runOverdueCheck(db, today);
    expect(run1.groupAlerts).toBe(1);
    expect((await runOverdueCheck(db, today)).groupAlerts).toBe(0);
    const notes = await db.select().from(schema.branchNotifications).where(eq(schema.branchNotifications.type, 'GROUP_MEMBER_OVERDUE'));
    expect(notes.filter((n) => n.audience === 'CLIENT').map((n) => n.borrowerId).sort()).toEqual([A, B, D].sort());
    expect(notes.find((n) => n.borrowerId === A)?.title).toBe('A member of your group is overdue');
    expect(notes.filter((n) => n.audience === 'STAFF')).toHaveLength(1);
  });

  it('beyond the threshold the group takes no new loans', async () => {
    const e = await expectHttp(apply(B), 409, 'GROUP_IN_ARREARS');
    expect(e.message).toMatch(/10 days behind/);
    // An individual product is not affected by the group's arrears.
    await apply(B, soloProduct);
  });

  it('the fund covers the defaulter; ledgered and tracked as owed', async () => {
    const tbBefore = await trialBalance(db);
    const glFund = (tb: typeof tbBefore) => tb.find((a) => a.accountCode === '2040');
    await expectHttp(coverFromFund(db, teller, groupId, { loanId: loanC, reason: 'Member hospitalised' }, key()), 403, 'FORBIDDEN');
    await expectHttp(coverFromFund(db, manager, groupId, { loanId: loanC, amount: '20000', reason: 'Member hospitalised' }, key()), 409, 'ABOVE_LIMIT');
    const k = key();
    const cover = await coverFromFund(db, manager, groupId, { loanId: loanC, reason: 'Member hospitalised' }, k);
    // Installment 1: 10,000 principal + 300 interest + 3% penalty on 10,300 = 309.
    expect(cover).toMatchObject({ amount: '10609.00', repaid: '0.00', outstanding: '10609.00', status: 'OUTSTANDING' });
    expect((await coverFromFund(db, manager, groupId, { loanId: loanC, reason: 'Member hospitalised' }, k)).id).toBe(cover.id);

    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.id, cover.paymentId));
    expect(payment).toMatchObject({ paymentMethod: 'SOLIDARITY_FUND' });
    const lines = await pg.query<{ account_code: string; debit: string; credit: string }>(
      `select a.account_code, l.debit::text, l.credit::text from journal_entry_lines l join accounts a using (account_id) where l.entry_id = $1 order by line_number`,
      [payment.journalEntryId],
    );
    expect(lines.rows.map((l) => `${l.account_code}:${l.debit}/${l.credit}`)).toEqual(['2040:10609.00/0.00', '1116:0.00/309.00', '4010:0.00/300.00', '1110:0.00/10000.00']);
    const [inst1] = await db.select().from(schema.loanSchedule).where(and(eq(schema.loanSchedule.loanId, loanC), eq(schema.loanSchedule.installmentNumber, 1)));
    expect(inst1.status).toBe('PAID');

    const fund = await fundView(db, manager, groupId);
    expect(fund.balance).toBe('1391.00');
    expect(fund.transactions[0]).toMatchObject({ kind: 'COVER', amount: '-10609.00', balance: '1391.00' });
    expect(glFund(await trialBalance(db))?.credit).toBeDefined();
    expect((await reconcileGroupFunds(db)).ok).toBe(true);
    const audits = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.targetId, groupId), eq(schema.auditLogs.action, 'SOLIDARITY_COVER')));
    expect(audits).toHaveLength(1);
    const memberNote = await db.select().from(schema.branchNotifications).where(and(eq(schema.branchNotifications.borrowerId, C), eq(schema.branchNotifications.type, 'SOLIDARITY_COVER')));
    expect(memberNote[0]?.message).toMatch(/You owe this amount back to the fund/);

    await expectHttp(reversePayment(db, admin, cover.paymentId, 'Wrong member covered'), 409, 'COVER_PAYMENT');
    const detail = await groupDetail(db, officer, groupId);
    expect(detail.members.find((m) => m.borrowerId === C)).toMatchObject({ coverOwed: '10609.00', standing: 'OWES_FUND' });
  });

  it('the group stays blocked until the member pays the fund back', async () => {
    const e = await expectHttp(apply(B), 409, 'GROUP_IN_ARREARS');
    expect(e.message).toMatch(/still owes the solidarity fund ₱10,609.00/);
    await expectHttp(postCollection(db, teller, groupId, { method: 'CASH', lines: [{ borrowerId: C, coverRepayment: '20000' }] }, key()), 409, 'ABOVE_OWED');
    await postCollection(db, teller, groupId, { method: 'CASH', lines: [{ borrowerId: C, coverRepayment: '609' }] }, key());
    await expectHttp(apply(B), 409, 'GROUP_IN_ARREARS');
    const done = await postCollection(db, teller, groupId, { method: 'CASH', lines: [{ borrowerId: C, coverRepayment: '10000', fundAmount: '100' }, { borrowerId: D, fundAmount: '100' }] }, key());
    expect(done.total).toBe('10200.00');
    const fund = await fundView(db, manager, groupId);
    expect(fund.covers[0]).toMatchObject({ status: 'REPAID', outstanding: '0.00' });
    expect(fund.balance).toBe('12200.00');
    const { loan } = await apply(B);
    expect(loan.status).toBe('Submitted');
    expect((await reconcileGroupFunds(db)).ok).toBe(true);
    const tb = await trialBalance(db);
    expect(tb.reduce((s, a) => s + a.debit, 0)).toBe(tb.reduce((s, a) => s + a.credit, 0));
  });

  it('the member sees their group, roles, own covers and pending consents in the portal', async () => {
    const mine = await myGroup(db, client(A));
    expect(mine?.group).toMatchObject({ groupName: 'Bambang Farmers', status: 'ACTIVE' });
    expect(mine?.members).toHaveLength(4);
    expect(mine?.pendingLoans.find((l) => l.borrowerName && !l.mine)).toMatchObject({ myDecision: null });
    expect((await myGroup(db, client(C)))?.fund.myCovers).toHaveLength(1);
    expect((await myGroup(db, client(A)))?.fund.myCovers).toHaveLength(0);
    expect(await myGroup(db, client(await member()))).toBeNull();
  });
});

describe('group lifecycle', () => {
  it('suspend and reinstate are manager actions; a group with running loans cannot dissolve', async () => {
    await expectHttp(changeGroupStatus(db, officer, groupId, 'SUSPEND', 'Missed meetings'), 403, 'FORBIDDEN');
    await expectHttp(changeGroupStatus(db, manager, groupId, 'SUSPEND', ''), 400, 'REASON_REQUIRED');
    const s = await changeGroupStatus(db, manager, groupId, 'SUSPEND', 'Missed three meetings');
    expect(s.group).toMatchObject({ status: 'SUSPENDED', statusReason: 'Missed three meetings' });
    await expectHttp(addMember(db, officer, groupId, { borrowerId: await member() }), 409, 'GROUP_CLOSED');
    await expectHttp(removeMember(db, officer, groupId, C, 'Left the area'), 409, 'GROUP_CLOSED');
    const d = await expectHttp(changeGroupStatus(db, manager, groupId, 'DISSOLVE', 'Members moved away'), 409, 'NOT_READY');
    expect((d.details as any).issues.join(' ')).toMatch(/group loan\(s\) are still running.*solidarity fund still holds/);
    const r = await changeGroupStatus(db, manager, groupId, 'REINSTATE', 'Attendance back to normal');
    expect(r.group.status).toBe('ACTIVE');
  });

  it('a forming group with no loans and no fund dissolves; its members are released', async () => {
    const g = await createGroup(db, officer, { ...GROUP, groupName: 'Short-lived group' });
    const x = await member();
    await addMember(db, officer, g.group.id, { borrowerId: x, role: 'LEADER' });
    const done = await changeGroupStatus(db, manager, g.group.id, 'DISSOLVE', 'Members chose another center');
    expect(done.group.status).toBe('DISSOLVED');
    expect(done.members).toEqual([]);
    await expectHttp(changeGroupStatus(db, manager, g.group.id, 'REINSTATE', 'Mistake'), 409, 'BAD_TRANSITION');
  });
});
