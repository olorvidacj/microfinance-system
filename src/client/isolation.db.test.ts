import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import { HttpError, type AppDb } from '../kyc/errors';
import { manilaToday } from '../kyc/service';
import { seedBranch, seedMember, textJpeg } from '../kyc/testFixtures';
import { getRolePermissions } from '../auth/permissions';
import { cancelApplication, clientLoans, createApplication, decideApplication, disburseLoan, loanDetail, saveProduct, submitApplication, type LendingClient, type LendingStaff } from '../lending/service';
import { clientProofs, payoffQuote, postPayment, receiptFor, submitProof } from '../lending/repayment';
import { cancelWithdrawalRequest, listAccounts, openAccount, requestWithdrawal, saveSavingsProduct, statement, withdrawalRequests } from '../savings/service';
import { myGroup, recordConsent } from '../groups/service';
import { clientDashboard } from './dashboard';
import { clientDocumentLink, clientDocuments } from './documents';
import { clientNotifications, markAllNotificationsRead, markNotificationRead } from './notifications';
import { ownProfile, updateOwnProfile } from './profile';
import { sendSupportRequest, supportRequests } from './support';
import { clientTransaction, clientTransactions } from './transactions';
import { verifyLocalToken } from '../kyc/storage';

/**
 * B6 security: a member can never read or change another member's data
 * through the client API services, whatever ids they send.
 */
let pg: PGlite;
let db: AppDb;
let seq = 0;
const key = () => `iso-key-${++seq}-${Date.now()}`;
const today = manilaToday();
const staff = (userId: string, role: string): LendingStaff => ({
  kind: 'staff',
  userId,
  staffId: `st-${userId}`,
  name: `${role} ${userId}`,
  role,
  branchId: 'br-a',
  viewAll: false,
  permissions: getRolePermissions(role),
});
const admin = { ...staff('admin', 'ADMINISTRATOR'), branchId: null, viewAll: true };
const officer = staff('off1', 'LOAN_OFFICER');
const teller = staff('tel1', 'CASHIER_TELLER');
const client = (borrowerId: string): LendingClient => ({ kind: 'client', userId: `u-${borrowerId}`, name: `Member ${borrowerId}`, borrowerId });

async function expectHttp(p: Promise<unknown>, status: number): Promise<void> {
  try {
    await p;
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    expect(e.status).toBe(status);
    return;
  }
  throw new Error(`expected HTTP ${status}`);
}

async function verifiedMember() {
  const id = await seedMember(db);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('hoscomo.kyc_actor', 'reconcile', true)`);
    await tx.update(schema.borrowers).set({ kycStatus: 'APPROVED', activeLoansCount: 0 }).where(eq(schema.borrowers.id, id));
  });
  return id;
}

// A is the signed-in member; B is someone else whose records A tries to reach.
let A: LendingClient;
let B: LendingClient;
const b = { loanId: '', pendingLoanId: '', paymentId: '', proofId: '', accountId: '', requestId: '', documentId: '', notificationId: '', transactionId: '' };

beforeAll(async () => {
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await seedBranch(db, 'br-a');
  const loanProduct = {
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
    lendingType: 'INDIVIDUAL',
    requiresCollateral: false,
    requiresGuarantor: false,
    status: 'ACTIVE',
  };
  const product = await saveProduct(db, admin, null, { ...loanProduct, code: 'ISO-3', name: 'Isolation test loan' });
  // One open loan per product, so B's second (still pending) application uses another one.
  const second = await saveProduct(db, admin, null, { ...loanProduct, code: 'ISO-2', name: 'Second test loan' });
  const savings = await saveSavingsProduct(db, admin, null, {
    code: 'ISO-SAV',
    name: 'Regular savings',
    kind: 'REGULAR',
    annualRate: '1',
    accrualMethod: 'AVERAGE_DAILY_BALANCE',
    minimumBalance: '100',
    minimumOpeningDeposit: '100',
    maxWithdrawalAmount: '',
    maxWithdrawalsPerMonth: '',
    termMonths: '',
    status: 'ACTIVE',
  });

  A = client(await verifiedMember());
  B = client(await verifiedMember());

  // B: a released loan with a posted payment and a pending proof...
  const { loan } = await createApplication(db, B, { productId: product.id, amount: '30000', termMonths: 3, purpose: 'BUSINESS' });
  await decideApplication(db, officer, loan.id, { decision: 'APPROVE', reason: 'Good standing' });
  await disburseLoan(db, teller, loan.id, { method: 'CASH', disbursementDate: today }, key());
  b.loanId = loan.id;
  b.paymentId = (await postPayment(db, teller, loan.id, { amount: '5000', method: 'CASH', paymentDate: today }, key())).payment.id;
  const jpeg = `data:image/jpeg;base64,${textJpeg(400, 300).toString('base64')}`;
  b.proofId = (await submitProof(db, B, { loanId: loan.id, amount: '1000', method: 'E_WALLET', referenceNumber: 'GC-ISO-1', paymentDate: today, fileBase64: jpeg, fileName: 'gcash.jpg' })).id;
  // ...a second application still pending...
  b.pendingLoanId = (await createApplication(db, B, { productId: second.id, amount: '2000', termMonths: 2, purpose: 'BUSINESS' })).loan.id;
  // ...savings with a withdrawal request...
  b.accountId = (await openAccount(db, teller, { memberId: B.borrowerId, productId: savings.id, openingDeposit: '5000' }, key())).id;
  b.requestId = (await requestWithdrawal(db, B, { accountId: b.accountId, amount: '500', destination: 'CASH_PICKUP', reason: 'Groceries' })).id;
  // ...a stored document, notifications and register rows.
  b.documentId = 'doc-iso-b';
  await db.insert(schema.documents).values({
    id: b.documentId,
    docNumber: 'DOC-ISO-B',
    branchId: 'br-a',
    clientId: B.borrowerId,
    docName: 'Loan agreement',
    docType: 'LOAN_AGREEMENT',
    fileUrl: 'https://files.example.test/b-agreement.pdf',
    uploadedBy: 'tel1',
    createdAt: new Date().toISOString(),
  });
  const [n] = await db.select().from(schema.branchNotifications).where(and(eq(schema.branchNotifications.audience, 'CLIENT'), eq(schema.branchNotifications.borrowerId, B.borrowerId))).limit(1);
  b.notificationId = n.id;
  b.transactionId = (await clientTransactions(db, B))[0].id;
  await sendSupportRequest(db, B, { subject: 'My balance', category: 'Loans', message: 'Please check my balance for me.' });
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

describe("a member cannot reach another member's records by id", () => {
  it('loans: detail, schedule, payments and payoff are "not found"', async () => {
    await expectHttp(loanDetail(db, A, b.loanId), 404);
    await expectHttp(payoffQuote(db, A, b.loanId), 404);
    expect((await loanDetail(db, B, b.loanId)).id).toBe(b.loanId);
  });

  it("loan applications: cannot submit or cancel someone else's", async () => {
    await expectHttp(cancelApplication(db, A, b.pendingLoanId, 'not mine'), 404);
    await expectHttp(submitApplication(db, A, b.pendingLoanId, {}), 404);
    const still = await loanDetail(db, B, b.pendingLoanId);
    expect(still.status).not.toBe('CANCELLED');
  });

  it('receipts: another member\'s payment is "not found"', async () => {
    await expectHttp(receiptFor(db, A, b.paymentId), 404);
    expect((await receiptFor(db, B, b.paymentId)).receiptNumber).toBeTruthy();
  });

  it('savings: statement and withdrawal requests', async () => {
    await expectHttp(statement(db, A, b.accountId), 404);
    await expectHttp(requestWithdrawal(db, A, { accountId: b.accountId, amount: '100', destination: 'CASH_PICKUP', reason: 'Not mine' }), 404);
    await expectHttp(cancelWithdrawalRequest(db, A, b.requestId), 404);
    expect((await withdrawalRequests(db, B, 'ALL')).find((r) => r.id === b.requestId)?.status).toBe('PENDING');
  });

  it('documents: the file link is "not found"', async () => {
    await expectHttp(clientDocumentLink(db, A, b.documentId), 404);
    expect((await clientDocumentLink(db, B, b.documentId)).url).toContain('b-agreement.pdf');
  });

  it('documents: a stored file is served through a fresh signed link, to its owner only', async () => {
    process.env.AUTH_SECRET ??= 'isolation-test-secret';
    const storagePath = `kyc/${B.borrowerId}/loan-proof-of-income/stored.png`;
    await db.insert(schema.documents).values({
      id: 'doc-iso-b-stored',
      docNumber: 'DOC-ISO-B2',
      branchId: 'br-a',
      clientId: B.borrowerId,
      docName: 'Proof of income',
      docType: 'PROOF_OF_INCOME',
      // The link saved at upload, long expired: never handed out again.
      fileUrl: 'https://proj.supabase.co/storage/v1/object/sign/kyc-documents/old?token=expired',
      storagePath,
      uploadedBy: 'tel1',
      createdAt: new Date().toISOString(),
    });
    await expectHttp(clientDocumentLink(db, A, 'doc-iso-b-stored'), 404);
    const link = await clientDocumentLink(db, B, 'doc-iso-b-stored');
    expect(link.expiresInSeconds).toBe(600);
    expect(link.url).toMatch(/^\/api\/kyc\/files\//);
    expect(verifyLocalToken(link.url.split('/').pop() ?? '')).toBe(storagePath);
  });

  it('notifications: cannot mark another member\'s as read', async () => {
    await expectHttp(markNotificationRead(db, A, b.notificationId), 404);
    await markAllNotificationsRead(db, A);
    const [n] = await db.select().from(schema.branchNotifications).where(eq(schema.branchNotifications.id, b.notificationId));
    expect(n.isRead).toBe(false);
  });

  it('transactions: a single transaction is "not found"', async () => {
    await expectHttp(clientTransaction(db, A, b.transactionId), 404);
    expect((await clientTransaction(db, B, b.transactionId)).id).toBe(b.transactionId);
  });

  it('group loans: cannot consent to a loan outside your group', async () => {
    await expectHttp(recordConsent(db, A, b.loanId, { decision: 'CONSENT' }), 404);
  });
});

describe("a member's lists contain only their own records", () => {
  it('every list and the dashboard are empty for a member with no activity', async () => {
    const loans = await clientLoans(db, A.borrowerId);
    expect(loans.all).toHaveLength(0);
    expect(await clientProofs(db, A.borrowerId)).toHaveLength(0);
    expect(await listAccounts(db, A)).toHaveLength(0);
    expect(await withdrawalRequests(db, A, 'ALL')).toHaveLength(0);
    expect(await clientDocuments(db, A)).toHaveLength(0);
    expect((await clientNotifications(db, A)).notifications).toHaveLength(0);
    expect(await clientTransactions(db, A)).toHaveLength(0);
    expect(await supportRequests(db, A)).toHaveLength(0);
    expect(await myGroup(db, A)).toBeNull();

    const home = await clientDashboard(db, A);
    expect(home.member.id).toBe(A.borrowerId);
    expect(home.loans.running).toHaveLength(0);
    expect(home.savings.accounts).toHaveLength(0);
    expect(home.recentActivity).toHaveLength(0);
    expect(home.notifications.unread).toBe(0);
  });

  it("the other member sees theirs, so the lists above are scoped, not broken", async () => {
    expect((await clientLoans(db, B.borrowerId)).running.map((l) => l.id)).toContain(b.loanId);
    expect((await clientProofs(db, B.borrowerId)).map((p) => p.id)).toContain(b.proofId);
    expect((await listAccounts(db, B)).map((a) => a.id)).toContain(b.accountId);
    expect((await clientDocuments(db, B)).map((d) => d.id)).toContain(b.documentId);
    expect((await clientNotifications(db, B)).unreadCount).toBeGreaterThan(0);
    expect((await clientTransactions(db, B)).length).toBeGreaterThanOrEqual(3);
    expect(await supportRequests(db, B)).toHaveLength(1);
  });

  it('profile reads and edits only touch the signed-in member', async () => {
    expect((await ownProfile(db, A)).id).toBe(A.borrowerId);
    await updateOwnProfile(db, A, { occupation: 'Farmer' });
    expect((await ownProfile(db, A)).occupation).toBe('Farmer');
    expect((await ownProfile(db, B)).occupation).not.toBe('Farmer');
  });
});

describe('transaction history', () => {
  it("signs B's activity from the member side and filters by kind and date", async () => {
    const rows = await clientTransactions(db, B);
    const release = rows.find((t) => t.kind === 'LOAN_DISBURSEMENT');
    const repayment = rows.find((t) => t.kind === 'LOAN_REPAYMENT');
    const deposit = rows.find((t) => t.kind === 'SAVINGS_DEPOSIT');
    expect(release).toMatchObject({ direction: 'IN', amount: '30000.00', account: 'Loan' });
    expect(repayment).toMatchObject({ direction: 'OUT', amount: '5000.00' });
    expect(deposit).toMatchObject({ direction: 'IN', amount: '5000.00', account: 'Savings' });
    expect((await clientTransactions(db, B, { kind: 'LOAN_REPAYMENT' })).every((t) => t.kind === 'LOAN_REPAYMENT')).toBe(true);
    expect(await clientTransactions(db, B, { from: '2999-01-01' })).toHaveLength(0);
    expect((await clientTransactions(db, B, { search: repayment!.reference })).map((t) => t.id)).toEqual([repayment!.id]);
  });

  it('counts unread notifications beyond the latest page', async () => {
    const extra = Array.from({ length: 55 }, (_, i) => ({
      id: `ntf-bulk-${i}`,
      branchId: 'br-a',
      audience: 'CLIENT',
      borrowerId: A.borrowerId,
      type: 'announcement',
      title: `Notice ${i}`,
      message: 'Hello',
      isRead: false,
      createdAt: new Date(Date.now() + i).toISOString(),
    }));
    await db.insert(schema.branchNotifications).values(extra);
    const feed = await clientNotifications(db, A);
    expect(feed.notifications).toHaveLength(50);
    expect(feed.unreadCount).toBe(55);
  });
});
