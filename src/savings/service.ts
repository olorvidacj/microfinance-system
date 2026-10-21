import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  ACCRUAL_METHODS,
  DISBURSEMENT_METHOD_LABELS,
  DORMANCY_MONTHS,
  SAVINGS_KIND_LABELS,
  SAVINGS_TXN_LABELS,
  WITHDRAWAL_DESTINATIONS,
  centsFromDb,
  centsToDecimal,
  checkWithdrawal,
  completePeriods,
  destinationMethod,
  formatPercent,
  formatPeso,
  interestForPeriod,
  liabilityAccount,
  parsePesos,
  periodBounds,
  periodOf,
  ppmFromDb,
  ppmToPercent,
  savingsJournal,
  validatePayment,
  validateSavingsProduct,
  type AccrualMethod,
  type DisbursementMethod,
  type SavingsKind,
  type SavingsProduct,
  type SavingsProductDto,
  type SavingsStatus,
  type SavingsTxnKind,
  type WithdrawalDestination,
} from '../../shared/lending';
import { isKycVerified, kycGateMessage, normaliseKycStatus } from '../../shared/kyc-core';
import { HttpError, type AppDb } from '../kyc/errors';
import { postJournal } from '../lending/ledger';
import { has, inTransaction, newId, nextSequence, nowIso, type LendingClient, type LendingStaff } from '../lending/service';
import { register } from '../lending/tables';
import { accounts, products, requests, transactions, type AccountRow, type ProductRow, type RequestRow, type TxnRow } from './tables';

export type SavingsActor = LendingStaff | LendingClient;

/** Calendar date in the cooperative's time zone. */
export function manilaToday(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

const SYSTEM: LendingStaff = { kind: 'staff', userId: 'system', staffId: null, name: 'Interest posting', role: 'SYSTEM', branchId: null, viewAll: true, permissions: [] };

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export function productFromRow(r: ProductRow): SavingsProduct {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    kind: r.kind as SavingsKind,
    annualRate: ppmFromDb(r.annualRate),
    accrualMethod: (ACCRUAL_METHODS as readonly string[]).includes(r.accrualMethod) ? (r.accrualMethod as AccrualMethod) : 'AVERAGE_DAILY_BALANCE',
    minimumBalance: centsFromDb(r.minimumBalance),
    minimumOpeningDeposit: centsFromDb(r.minimumOpeningDeposit),
    maxWithdrawalAmount: r.maxWithdrawalAmount === null ? null : centsFromDb(r.maxWithdrawalAmount),
    maxWithdrawalsPerMonth: r.maxWithdrawalsPerMonth,
    termMonths: r.termMonths,
    status: r.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  };
}

export async function listSavingsProducts(db: AppDb, includeInactive = false): Promise<SavingsProduct[]> {
  const rows = await db.select().from(products).where(includeInactive ? undefined : eq(products.status, 'ACTIVE')).orderBy(asc(products.name));
  return rows.map(productFromRow);
}

export async function saveSavingsProduct(db: AppDb, actor: LendingStaff, id: string | null, dto: Partial<SavingsProductDto>): Promise<SavingsProduct> {
  if (!has(actor, 'manage_settings')) throw new HttpError(403, 'Only head office can change savings products.', 'FORBIDDEN');
  const v = validateSavingsProduct(dto);
  if (!v.ok || !v.value) throw new HttpError(400, 'Check the highlighted product fields.', 'INVALID_PRODUCT', { fields: v.errors });
  const p = v.value;
  const values = {
    code: p.code,
    name: p.name,
    kind: p.kind,
    annualRate: ppmToPercent(p.annualRate),
    accrualMethod: p.accrualMethod,
    minimumBalance: centsToDecimal(p.minimumBalance),
    minimumOpeningDeposit: centsToDecimal(p.minimumOpeningDeposit),
    maxWithdrawalAmount: p.maxWithdrawalAmount === null ? null : centsToDecimal(p.maxWithdrawalAmount),
    maxWithdrawalsPerMonth: p.maxWithdrawalsPerMonth,
    termMonths: p.termMonths,
    status: p.status,
    updatedAt: nowIso(),
  };
  const productId = id ?? newId('sp');
  await inTransaction(db, async (tx) => {
    const [clash] = await tx.select({ id: products.id }).from(products).where(and(sql`upper(${products.code}) = ${p.code}`, id ? ne(products.id, id) : undefined)).limit(1);
    if (clash) throw new HttpError(409, `Another product already uses the code ${p.code}.`, 'DUPLICATE_CODE', { fields: { code: 'This code is taken.' } });
    if (id) {
      const [current] = await tx.select({ kind: products.kind }).from(products).where(eq(products.id, id)).for('update').limit(1);
      if (!current) throw new HttpError(404, 'Savings product not found.', 'NOT_FOUND');
      // The kind decides the liability account (2010 or 2020) its balances sit
      // in; changing it would move money between ledgers without a journal.
      if (current.kind !== p.kind) throw new HttpError(409, 'A product’s kind cannot be changed. Create a new product instead.', 'KIND_LOCKED', { fields: { kind: 'The kind cannot be changed.' } });
      await tx.update(products).set(values).where(eq(products.id, id));
    } else {
      await tx.insert(products).values({ id: productId, ...values });
    }
    await tx.insert(schema.auditLogs).values({
      id: newId('aud'),
      timestamp: nowIso(),
      action: id ? 'SAVINGS_PRODUCT_UPDATED' : 'SAVINGS_PRODUCT_CREATED',
      details: `${p.code} ${p.name}: ${SAVINGS_KIND_LABELS[p.kind]}, ${formatPercent(p.annualRate)} a year, minimum ${formatPeso(p.minimumBalance)}.`,
      performedBy: actor.userId,
      branchId: actor.branchId ?? 'all',
      type: 'SYSTEM',
      userName: actor.name,
      userRole: actor.role,
      targetType: 'SavingsProduct',
      targetId: productId,
    });
  });
  const [row] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  return productFromRow(row);
}

// ---------------------------------------------------------------------------
// Loading, scope, audit
// ---------------------------------------------------------------------------

function assertScope(actor: SavingsActor, account: Pick<AccountRow, 'memberId' | 'branchId'>) {
  if (actor.kind === 'client') {
    if (account.memberId !== actor.borrowerId) throw new HttpError(404, 'Savings account not found.', 'NOT_FOUND');
    return;
  }
  if (actor.viewAll) return;
  if (!actor.branchId || account.branchId !== actor.branchId) throw new HttpError(404, 'Savings account not found in your branch.', 'NOT_FOUND');
}

async function lockAccount(tx: AppDb, actor: SavingsActor, accountId: string): Promise<{ account: AccountRow; product: SavingsProduct }> {
  const rows = await tx.select().from(accounts).where(eq(accounts.id, accountId)).for('update').limit(1);
  if (!rows[0]) throw new HttpError(404, 'Savings account not found.', 'NOT_FOUND');
  assertScope(actor, rows[0]);
  const [p] = await tx.select().from(products).where(eq(products.id, rows[0].productId)).limit(1);
  return { account: rows[0], product: productFromRow(p) };
}

async function audit(tx: AppDb, account: Pick<AccountRow, 'id' | 'branchId'>, actor: SavingsActor, action: string, details: string, at: string) {
  await tx.insert(schema.auditLogs).values({
    id: newId('aud'),
    timestamp: at,
    action,
    details,
    performedBy: actor.userId,
    branchId: account.branchId ?? 'all',
    type: 'SAVINGS',
    userName: actor.name,
    userRole: actor.kind === 'client' ? 'CLIENT' : actor.role,
    targetType: 'SavingsAccount',
    targetId: account.id,
  });
}

async function notify(tx: AppDb, account: Pick<AccountRow, 'id' | 'branchId' | 'memberId'>, audience: 'CLIENT' | 'STAFF', type: string, title: string, message: string, at: string) {
  await tx.insert(schema.branchNotifications).values({
    id: newId('ntf'),
    branchId: account.branchId ?? 'br-main',
    audience,
    borrowerId: audience === 'CLIENT' ? account.memberId : null,
    type,
    title,
    message,
    relatedType: 'SavingsAccount',
    relatedId: account.id,
    isRead: false,
    createdAt: at,
  });
}

async function syncMemberTotal(tx: AppDb, memberId: string) {
  await tx.execute(sql`update borrowers set savings_balance = (select coalesce(sum(balance), 0) from savings_accounts where member_id = ${memberId}) where id = ${memberId}`);
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

const PREFIX: Record<'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST', string> = { DEPOSIT: 'SD', WITHDRAWAL: 'SW', INTEREST: 'SI' };

interface PostInput {
  kind: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST';
  amount: number;
  method: DisbursementMethod;
  reference: string | null;
  destinationAccount?: string | null;
  notes: string | null;
  idempotencyKey: string;
  interestPeriod?: string;
  withdrawalRequestId?: string;
}

/**
 * The one place a savings balance changes: one transaction row with the
 * balance before and after, the cached balance, the journal entry, the
 * transaction register, an audit row and a notification, all in the caller's
 * transaction (the account row is already locked).
 */
async function postTx(tx: AppDb, actor: SavingsActor, account: AccountRow, product: SavingsProduct, p: PostInput): Promise<TxnRow> {
  const at = nowIso();
  const today = manilaToday();
  const before = centsFromDb(account.balance);
  const signed = p.kind === 'WITHDRAWAL' ? -p.amount : p.amount;
  const after = before + signed;
  if (after < 0) throw new HttpError(409, 'The balance cannot go below zero.', 'INSUFFICIENT');
  const seq = await nextSequence(tx, 'savings_txn_seq');
  const number = `${PREFIX[p.kind]}-${today.slice(0, 4)}-${String(seq).padStart(6, '0')}`;
  const entryId = await postJournal(tx, {
    lines: savingsJournal(p.kind, product.kind, p.amount, p.method),
    entryDate: today,
    description: `${SAVINGS_TXN_LABELS[p.kind]} ${account.passbookNumber} (${account.memberName})`,
    reference: number,
    sourceModule: 'savings',
    sourceRef: account.id,
    branchId: account.branchId ?? 'all',
    postedBy: actor.userId,
    postedByName: actor.name,
    idempotencyKey: `savings:${p.idempotencyKey}`,
    at,
  });
  const id = newId('stx');
  const [row] = await tx
    .insert(transactions)
    .values({
      id,
      savingsAccountId: account.id,
      memberId: account.memberId,
      memberName: account.memberName,
      transactionNumber: number,
      date: today,
      type: SAVINGS_TXN_LABELS[p.kind],
      amount: centsToDecimal(p.amount),
      balanceBefore: centsToDecimal(before),
      balanceAfter: centsToDecimal(after),
      processedBy: actor.name,
      notes: p.notes,
      officialReceiptNumber: p.kind === 'INTEREST' ? null : number,
      createdAt: at,
      kind: p.kind,
      signedAmount: centsToDecimal(signed),
      method: p.kind === 'INTEREST' ? null : p.method,
      reference: p.reference,
      destinationAccount: p.destinationAccount ?? null,
      journalEntryId: entryId,
      idempotencyKey: p.idempotencyKey,
      interestPeriod: p.interestPeriod ?? null,
      branchId: account.branchId,
      postedBy: actor.userId,
      withdrawalRequestId: p.withdrawalRequestId ?? null,
      sequence: seq,
    })
    .returning();
  await tx
    .update(accounts)
    .set({
      balance: centsToDecimal(after),
      ...(p.kind === 'INTEREST' ? {} : { lastActivityDate: today }),
      ...(p.kind === 'DEPOSIT' && account.status === 'DORMANT' ? { status: 'ACTIVE', statusReason: null } : {}),
    })
    .where(eq(accounts.id, account.id));
  await syncMemberTotal(tx, account.memberId);
  await tx.insert(register).values({
    id: newId('txn'),
    referenceNumber: number,
    clientId: account.memberId,
    clientName: account.memberName,
    accountOrLoanId: account.id,
    accountOrLoanType: 'Savings',
    branchId: account.branchId,
    transactionType: p.kind === 'DEPOSIT' ? 'Savings Deposit' : p.kind === 'WITHDRAWAL' ? 'Savings Withdrawal' : 'Savings Interest',
    amount: centsToDecimal(p.amount),
    transactionDate: today,
    paymentMethod: p.kind === 'INTEREST' ? 'Interest' : DISBURSEMENT_METHOD_LABELS[p.method],
    processedBy: actor.name,
    processedByRole: actor.kind === 'client' ? 'CLIENT' : actor.role,
    status: 'Completed',
    notes: p.notes,
    metadata: { savingsTransactionId: id, journalEntryId: entryId, balanceAfter: centsToDecimal(after), interestPeriod: p.interestPeriod ?? null },
    createdAt: at,
    updatedAt: at,
  });
  const label = p.kind === 'DEPOSIT' ? 'Deposit' : p.kind === 'WITHDRAWAL' ? 'Withdrawal' : `Interest for ${p.interestPeriod}`;
  await audit(tx, account, actor, `SAVINGS_${p.kind}`, `${number}: ${label} of ${formatPeso(p.amount)} on ${account.passbookNumber}. Balance ${formatPeso(before)} -> ${formatPeso(after)}.`, at);
  await notify(tx, account, 'CLIENT', `SAVINGS_${p.kind}`, `Savings ${label.toLowerCase()}`, `${label} of ${formatPeso(p.amount)} on your savings ${account.passbookNumber}. New balance: ${formatPeso(after)}.`, at);
  return row;
}

function requireKey(key: unknown): string {
  const k = typeof key === 'string' ? key.trim().slice(0, 100) : '';
  if (k.length < 8) throw new HttpError(400, 'An Idempotency-Key header (8+ characters) is required.', 'IDEMPOTENCY_KEY_REQUIRED');
  return k;
}

async function replay(tx: AppDb, key: string): Promise<TxnRow | null> {
  const [row] = await tx.select().from(transactions).where(eq(transactions.idempotencyKey, key)).limit(1);
  return row ?? null;
}

export interface CounterInput {
  amount: unknown;
  method?: unknown;
  referenceNumber?: unknown;
  destinationAccount?: unknown;
  notes?: unknown;
}

function counterDetails(input: CounterInput) {
  const v = validatePayment({ amount: input.amount, method: input.method ?? 'CASH', referenceNumber: input.referenceNumber, paymentDate: manilaToday(), notes: input.notes }, manilaToday(), 0);
  if (!v.ok || !v.value) throw new HttpError(400, 'Check the highlighted fields.', 'INVALID_AMOUNT', { fields: v.errors });
  return v.value;
}

export async function deposit(db: AppDb, actor: LendingStaff, accountId: string, input: CounterInput, idempotencyKey: unknown) {
  if (!has(actor, 'process_savings_deposits')) throw new HttpError(403, 'Your role cannot take savings deposits.', 'FORBIDDEN');
  const key = requireKey(idempotencyKey);
  const d = counterDetails(input);
  const row = await inTransaction(db, async (tx) => {
    const { account, product } = await lockAccount(tx, actor, accountId);
    const prior = await replay(tx, key);
    if (prior) return prior;
    if (account.status === 'CLOSED') throw new HttpError(409, 'This account is closed.', 'ACCOUNT_CLOSED');
    return postTx(tx, actor, account, product, { kind: 'DEPOSIT', amount: d.amount, method: d.method, reference: d.referenceNumber, notes: d.notes, idempotencyKey: key });
  });
  return transactionResult(db, actor, row);
}

async function withdrawalsThisMonth(tx: AppDb, accountId: string, today: string): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(eq(transactions.savingsAccountId, accountId), eq(transactions.kind, 'WITHDRAWAL'), gte(transactions.date, `${periodOf(today)}-01`)));
  return Number(r?.n ?? 0);
}

async function withdrawTx(
  tx: AppDb,
  actor: SavingsActor,
  account: AccountRow,
  product: SavingsProduct,
  d: { amount: number; method: DisbursementMethod; referenceNumber: string | null; destinationAccount: string | null; notes: string | null },
  key: string,
  options: { closing?: boolean; requestId?: string } = {},
) {
  const today = manilaToday();
  const check = checkWithdrawal({
    status: account.status as SavingsStatus,
    balance: centsFromDb(account.balance),
    product,
    amount: d.amount,
    withdrawalsThisMonth: await withdrawalsThisMonth(tx, account.id, today),
    maturityDate: account.maturityDate,
    today,
    closing: options.closing,
  });
  if (!check.ok) throw new HttpError(409, check.message, check.code, { available: centsToDecimal(check.available) });
  if (d.method !== 'CASH' && (!d.referenceNumber || !d.destinationAccount)) {
    throw new HttpError(400, 'A bank or e-wallet withdrawal needs the destination account and the transfer reference.', 'INVALID_DESTINATION', {
      fields: { ...(!d.referenceNumber ? { referenceNumber: 'Enter the transfer reference.' } : {}), ...(!d.destinationAccount ? { destinationAccount: 'Enter the account or e-wallet number.' } : {}) },
    });
  }
  return postTx(tx, actor, account, product, {
    kind: 'WITHDRAWAL',
    amount: d.amount,
    method: d.method,
    reference: d.referenceNumber,
    destinationAccount: d.destinationAccount,
    notes: d.notes,
    idempotencyKey: key,
    withdrawalRequestId: options.requestId,
  });
}

export async function withdraw(db: AppDb, actor: LendingStaff, accountId: string, input: CounterInput, idempotencyKey: unknown) {
  if (!has(actor, 'process_savings_withdrawals')) throw new HttpError(403, 'Your role cannot release savings withdrawals.', 'FORBIDDEN');
  const key = requireKey(idempotencyKey);
  const d = counterDetails(input);
  const dest = typeof input.destinationAccount === 'string' && input.destinationAccount.trim() ? input.destinationAccount.trim().slice(0, 80) : null;
  const row = await inTransaction(db, async (tx) => {
    const { account, product } = await lockAccount(tx, actor, accountId);
    const prior = await replay(tx, key);
    if (prior) return prior;
    return withdrawTx(tx, actor, account, product, { ...d, destinationAccount: dest }, key);
  });
  return transactionResult(db, actor, row);
}

// ---------------------------------------------------------------------------
// Opening, closing, status
// ---------------------------------------------------------------------------

async function newPassbook(tx: AppDb): Promise<string> {
  const n = await nextSequence(tx, 'savings_account_seq');
  return `SA-${manilaToday().slice(0, 4)}-${String(n).padStart(6, '0')}`;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

/** Opens an account for a KYC-verified member, posting the opening deposit with it. */
export async function openAccount(
  db: AppDb,
  actor: LendingStaff,
  input: { memberId: unknown; productId: unknown; openingDeposit?: unknown; method?: unknown; referenceNumber?: unknown; groupId?: unknown },
  idempotencyKey: unknown,
) {
  if (!has(actor, 'process_savings_deposits')) throw new HttpError(403, 'Your role cannot open savings accounts.', 'FORBIDDEN');
  const key = requireKey(idempotencyKey);
  const opening = input.openingDeposit === undefined || input.openingDeposit === '' ? 0 : parsePesos(input.openingDeposit);
  if (opening === null) throw new HttpError(400, 'Enter the opening deposit in pesos.', 'INVALID_AMOUNT', { fields: { openingDeposit: 'Enter pesos and centavos only.' } });
  const accountId = await inTransaction(db, async (tx) => {
    const prior = await replay(tx, key);
    if (prior) return prior.savingsAccountId;
    const [member] = await tx.select().from(schema.borrowers).where(eq(schema.borrowers.id, String(input.memberId ?? ''))).for('update').limit(1);
    if (!member || (!actor.viewAll && member.branchId !== actor.branchId)) throw new HttpError(404, 'Member not found in your branch.', 'NOT_FOUND');
    if (!isKycVerified(member.kycStatus)) throw new HttpError(403, kycGateMessage(member.kycStatus), 'KYC_REQUIRED', { kycStatus: normaliseKycStatus(member.kycStatus) });
    const [pRow] = await tx.select().from(products).where(eq(products.id, String(input.productId ?? ''))).limit(1);
    if (!pRow || pRow.status !== 'ACTIVE') throw new HttpError(400, 'Choose an available savings product.', 'INVALID_PRODUCT', { fields: { productId: 'Choose a product.' } });
    const product = productFromRow(pRow);
    if (opening < product.minimumOpeningDeposit) {
      throw new HttpError(400, `${product.name} needs an opening deposit of at least ${formatPeso(product.minimumOpeningDeposit)}.`, 'BELOW_OPENING', { fields: { openingDeposit: `At least ${formatPeso(product.minimumOpeningDeposit)}.` } });
    }
    const existing = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.memberId, member.id), eq(accounts.productId, product.id), ne(accounts.status, 'CLOSED')))
      .limit(1);
    if (existing[0] && product.kind !== 'TIME_DEPOSIT') throw new HttpError(409, `This member already has an open ${product.name} account.`, 'DUPLICATE_ACCOUNT');
    const at = nowIso();
    const today = manilaToday();
    const id = newId('sav');
    const [account] = await tx
      .insert(accounts)
      .values({
        id,
        memberId: member.id,
        memberName: member.fullName,
        passbookNumber: await newPassbook(tx),
        balance: '0.00',
        maintainingBalance: centsToDecimal(product.minimumBalance),
        interestRate: ppmToPercent(product.annualRate),
        createdAt: at,
        productId: product.id,
        status: 'ACTIVE',
        branchId: member.branchId,
        openedAt: at,
        lastActivityDate: today,
        maturityDate: product.termMonths ? addMonths(today, product.termMonths) : null,
        groupId: typeof input.groupId === 'string' && input.groupId ? input.groupId : null,
      })
      .returning();
    await audit(tx, account, actor, 'SAVINGS_ACCOUNT_OPENED', `${account.passbookNumber} (${product.name}) opened for ${member.fullName}.`, at);
    if (opening > 0) {
      const v = counterDetails({ amount: centsToDecimal(opening), method: input.method ?? 'CASH', referenceNumber: input.referenceNumber });
      await postTx(tx, actor, account, product, { kind: 'DEPOSIT', amount: opening, method: v.method, reference: v.referenceNumber, notes: 'Opening deposit', idempotencyKey: key });
    } else {
      await notify(tx, account, 'CLIENT', 'SAVINGS_OPENED', 'Savings account opened', `Your ${product.name} account ${account.passbookNumber} is open.`, at);
    }
    return account.id;
  });
  return accountDetail(db, actor, accountId);
}

/** The regular savings account every verified member holds; opened when KYC is approved. */
export async function openRegularAccountTx(tx: AppDb, member: { id: string; fullName: string; branchId: string }): Promise<void> {
  const existing = await tx.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.memberId, member.id), ne(accounts.status, 'CLOSED'))).limit(1);
  if (existing[0]) return;
  const [pRow] = await tx.select().from(products).where(and(eq(products.kind, 'REGULAR'), eq(products.status, 'ACTIVE'))).orderBy(asc(products.id)).limit(1);
  if (!pRow) return;
  const product = productFromRow(pRow);
  const at = nowIso();
  await tx.insert(accounts).values({
    id: newId('sav'),
    memberId: member.id,
    memberName: member.fullName,
    passbookNumber: await newPassbook(tx),
    balance: '0.00',
    maintainingBalance: centsToDecimal(product.minimumBalance),
    interestRate: ppmToPercent(product.annualRate),
    createdAt: at,
    productId: product.id,
    status: 'ACTIVE',
    branchId: member.branchId,
    openedAt: at,
    lastActivityDate: manilaToday(),
  });
}

/** Closes an account, paying out whatever is left. Compulsory savings stay while the member has a running loan. */
export async function closeAccount(db: AppDb, actor: LendingStaff, accountId: string, input: CounterInput & { reason?: unknown }, idempotencyKey: unknown) {
  if (!has(actor, 'process_savings_withdrawals')) throw new HttpError(403, 'Your role cannot close savings accounts.', 'FORBIDDEN');
  const key = requireKey(idempotencyKey);
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 5) throw new HttpError(400, 'Give the reason for closing (at least 5 characters).', 'REASON_REQUIRED');
  await inTransaction(db, async (tx) => {
    const { account, product } = await lockAccount(tx, actor, accountId);
    if (account.status === 'CLOSED') {
      if (await replay(tx, key)) return;
      throw new HttpError(409, 'This account is already closed.', 'ACCOUNT_CLOSED');
    }
    if (account.status === 'FROZEN') throw new HttpError(409, 'A frozen account cannot be closed; release it first.', 'ACCOUNT_FROZEN');
    if (product.kind === 'COMPULSORY') {
      const [running] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.loans).where(and(eq(schema.loans.borrowerId, account.memberId), inArray(schema.loans.status, ['Disbursed', 'Active'])));
      if (Number(running?.n ?? 0) > 0) throw new HttpError(409, 'Compulsory savings cannot be closed while the member has a running loan.', 'HAS_RUNNING_LOAN');
    }
    const balance = centsFromDb(account.balance);
    let current = account;
    if (balance > 0) {
      const method = (String(input.method ?? 'CASH') as DisbursementMethod) ?? 'CASH';
      const ref = typeof input.referenceNumber === 'string' && input.referenceNumber.trim() ? input.referenceNumber.trim() : null;
      const dest = typeof input.destinationAccount === 'string' && input.destinationAccount.trim() ? input.destinationAccount.trim() : null;
      await withdrawTx(tx, actor, account, product, { amount: balance, method, referenceNumber: ref, destinationAccount: dest, notes: `Closing: ${reason}` }, key, { closing: true });
      [current] = await tx.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    }
    const at = nowIso();
    await tx.update(accounts).set({ status: 'CLOSED', closedAt: at, statusReason: reason }).where(eq(accounts.id, current.id));
    await audit(tx, account, actor, 'SAVINGS_ACCOUNT_CLOSED', `${account.passbookNumber} closed${balance ? ` after paying out ${formatPeso(balance)}` : ''}. Reason: ${reason}`, at);
    await notify(tx, account, 'CLIENT', 'SAVINGS_CLOSED', 'Savings account closed', `Your savings account ${account.passbookNumber} was closed. ${reason}`, at);
  });
  return accountDetail(db, actor, accountId);
}

/** Freeze / release (managers) and reactivate a dormant account (tellers, with the member present). */
export async function changeStatus(db: AppDb, actor: LendingStaff, accountId: string, action: unknown, reasonInput: unknown) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
  if (reason.length < 5) throw new HttpError(400, 'Give a reason (at least 5 characters).', 'REASON_REQUIRED');
  const act = String(action ?? '').toUpperCase();
  const rules: Record<string, { from: SavingsStatus[]; to: SavingsStatus; perm: string }> = {
    FREEZE: { from: ['ACTIVE', 'DORMANT'], to: 'FROZEN', perm: 'approve_sensitive_operations' },
    UNFREEZE: { from: ['FROZEN'], to: 'ACTIVE', perm: 'approve_sensitive_operations' },
    REACTIVATE: { from: ['DORMANT'], to: 'ACTIVE', perm: 'process_savings_withdrawals' },
  };
  const rule = rules[act];
  if (!rule) throw new HttpError(400, 'action must be FREEZE, UNFREEZE or REACTIVATE.', 'BAD_ACTION');
  if (!has(actor, rule.perm)) throw new HttpError(403, 'Your role cannot do this.', 'FORBIDDEN');
  await inTransaction(db, async (tx) => {
    const { account } = await lockAccount(tx, actor, accountId);
    if (!rule.from.includes(account.status as SavingsStatus)) throw new HttpError(409, `A ${account.status.toLowerCase()} account cannot be ${act.toLowerCase()}d.`, 'BAD_STATUS');
    const at = nowIso();
    await tx.update(accounts).set({ status: rule.to, statusReason: reason, ...(act === 'REACTIVATE' ? { lastActivityDate: manilaToday() } : {}) }).where(eq(accounts.id, account.id));
    await audit(tx, account, actor, `SAVINGS_${act}`, `${account.passbookNumber}: ${account.status} -> ${rule.to}. Reason: ${reason}`, at);
    await notify(tx, account, 'CLIENT', `SAVINGS_${act}`, act === 'FREEZE' ? 'Savings account frozen' : 'Savings account active', `Your savings account ${account.passbookNumber} is now ${rule.to.toLowerCase()}. ${reason}`, at);
  });
  return accountDetail(db, actor, accountId);
}

// ---------------------------------------------------------------------------
// Member withdrawal requests
// ---------------------------------------------------------------------------

export async function requestWithdrawal(db: AppDb, actor: LendingClient, input: { accountId: unknown; amount: unknown; destination: unknown; destinationAccount?: unknown; reason: unknown }) {
  const amount = parsePesos(input.amount);
  const destination = String(input.destination ?? '') as WithdrawalDestination;
  const dest = typeof input.destinationAccount === 'string' ? input.destinationAccount.trim().slice(0, 80) : '';
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 300) : '';
  const errors: Record<string, string> = {};
  if (amount === null || amount <= 0) errors.amount = 'Enter the amount (pesos and centavos only).';
  if (!(WITHDRAWAL_DESTINATIONS as readonly string[]).includes(destination)) errors.destination = 'Choose how you want to receive the money.';
  else if (destination !== 'CASH_PICKUP' && !dest) errors.destinationAccount = 'Enter the account or e-wallet number.';
  if (reason.length < 3) errors.reason = 'Tell us what the withdrawal is for.';
  if (Object.keys(errors).length || amount === null) throw new HttpError(400, 'Check the highlighted fields.', 'INVALID_REQUEST', { fields: errors });
  const today = manilaToday();
  const id = await inTransaction(db, async (tx) => {
    const { account, product } = await lockAccount(tx, actor, String(input.accountId ?? ''));
    const [kyc] = await tx.select({ status: schema.borrowers.kycStatus }).from(schema.borrowers).where(eq(schema.borrowers.id, account.memberId)).limit(1);
    if (!isKycVerified(kyc?.status)) throw new HttpError(403, kycGateMessage(kyc?.status), 'KYC_REQUIRED', { kycStatus: normaliseKycStatus(kyc?.status) });
    const pending = await tx.select({ id: requests.id }).from(requests).where(and(eq(requests.accountId, account.id), eq(requests.status, 'PENDING'))).limit(1);
    if (pending[0]) throw new HttpError(409, 'You already have a withdrawal request waiting on this account.', 'PENDING_REQUEST');
    const balance = centsFromDb(account.balance);
    const check = checkWithdrawal({ status: account.status as SavingsStatus, balance, product, amount, withdrawalsThisMonth: await withdrawalsThisMonth(tx, account.id, today), maturityDate: account.maturityDate, today });
    if (!check.ok) throw new HttpError(409, check.message, check.code, { available: centsToDecimal(check.available) });
    const at = nowIso();
    const requestId = newId('swr');
    const [member] = await tx.select({ total: schema.borrowers.savingsBalance }).from(schema.borrowers).where(eq(schema.borrowers.id, account.memberId)).limit(1);
    await tx.insert(requests).values({
      id: requestId,
      requestId: `WDR-${today.slice(0, 4)}-${requestId.slice(-6).toUpperCase()}`,
      memberId: account.memberId,
      memberName: account.memberName,
      branchId: account.branchId ?? 'br-main',
      accountId: account.id,
      currentBalance: centsToDecimal(Math.round(Number(member?.total ?? 0) * 100)),
      accountBalanceBefore: centsToDecimal(balance),
      requestedAmount: centsToDecimal(amount),
      maintainingBalance: centsToDecimal(product.minimumBalance),
      remainingBalanceAfter: centsToDecimal(balance - amount),
      requestDate: today,
      reason,
      tellerName: '',
      tellerRecordedDate: today,
      status: 'PENDING',
      createdAt: at,
      destination,
      destinationAccount: dest || null,
    });
    await audit(tx, account, actor, 'SAVINGS_WITHDRAWAL_REQUESTED', `${account.memberName} asked to withdraw ${formatPeso(amount)} from ${account.passbookNumber} by ${destination.toLowerCase().replace('_', ' ')}.`, at);
    await notify(tx, account, 'STAFF', 'SAVINGS_WITHDRAWAL_REQUEST', 'Savings withdrawal request', `${account.memberName} requests ${formatPeso(amount)} from ${account.passbookNumber}.`, at);
    return requestId;
  });
  const [row] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  return requestView(row);
}

export async function decideWithdrawalRequest(
  db: AppDb,
  actor: LendingStaff,
  requestId: string,
  input: { decision: unknown; reason?: unknown; referenceNumber?: unknown },
) {
  if (!has(actor, 'process_savings_withdrawals')) throw new HttpError(403, 'Your role cannot release savings withdrawals.', 'FORBIDDEN');
  const decision = String(input.decision ?? '').toUpperCase();
  if (decision !== 'APPROVE' && decision !== 'REJECT') throw new HttpError(400, 'decision must be APPROVE or REJECT.', 'BAD_DECISION');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (decision === 'REJECT' && reason.length < 5) throw new HttpError(400, 'Tell the member why (at least 5 characters).', 'REASON_REQUIRED');
  await inTransaction(db, async (tx) => {
    const [req] = await tx.select().from(requests).where(eq(requests.id, requestId)).for('update').limit(1);
    if (!req || (!actor.viewAll && req.branchId !== actor.branchId)) throw new HttpError(404, 'Request not found in your branch.', 'NOT_FOUND');
    if (req.status !== 'PENDING') throw new HttpError(409, `This request is already ${req.status.toLowerCase()}.`, 'ALREADY_DECIDED');
    if (!req.accountId) throw new HttpError(409, 'This request has no account; ask the member to request again.', 'NO_ACCOUNT');
    const at = nowIso();
    const { account, product } = await lockAccount(tx, actor, req.accountId);
    if (decision === 'REJECT') {
      await tx.update(requests).set({ status: 'REJECTED', rejectionReason: reason, decidedBy: actor.userId, decidedAt: at }).where(eq(requests.id, req.id));
      await audit(tx, account, actor, 'SAVINGS_WITHDRAWAL_REJECTED', `Request ${req.requestId} for ${formatPeso(centsFromDb(req.requestedAmount))} rejected: ${reason}`, at);
      await notify(tx, account, 'CLIENT', 'SAVINGS_WITHDRAWAL_REJECTED', 'Withdrawal request declined', `Your request to withdraw ${formatPeso(centsFromDb(req.requestedAmount))} was declined: ${reason}`, at);
      return;
    }
    const destination = (req.destination ?? 'CASH_PICKUP') as WithdrawalDestination;
    const ref = typeof input.referenceNumber === 'string' && input.referenceNumber.trim() ? input.referenceNumber.trim() : null;
    const txn = await withdrawTx(
      tx,
      actor,
      account,
      product,
      { amount: centsFromDb(req.requestedAmount), method: destinationMethod(destination), referenceNumber: ref, destinationAccount: req.destinationAccount, notes: `Request ${req.requestId}: ${req.reason}` },
      `swr:${req.id}`,
      { requestId: req.id },
    );
    await tx
      .update(requests)
      .set({ status: 'APPROVED', approvedByManager: actor.name, approvalDate: manilaToday(), disbursedDate: manilaToday(), decidedBy: actor.userId, decidedAt: at, transactionId: txn.id, tellerName: actor.name })
      .where(eq(requests.id, req.id));
  });
  const [row] = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  return requestView(row);
}

export async function cancelWithdrawalRequest(db: AppDb, actor: LendingClient, requestId: string) {
  await inTransaction(db, async (tx) => {
    const [req] = await tx.select().from(requests).where(eq(requests.id, requestId)).for('update').limit(1);
    if (!req || req.memberId !== actor.borrowerId) throw new HttpError(404, 'Request not found.', 'NOT_FOUND');
    if (req.status !== 'PENDING') throw new HttpError(409, `This request is already ${req.status.toLowerCase()}.`, 'ALREADY_DECIDED');
    await tx.update(requests).set({ status: 'CANCELLED', decidedBy: actor.userId, decidedAt: nowIso() }).where(eq(requests.id, req.id));
  });
  const [row] = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  return requestView(row);
}

export function requestView(r: RequestRow) {
  return {
    id: r.id,
    requestNumber: r.requestId,
    accountId: r.accountId,
    memberId: r.memberId,
    memberName: r.memberName,
    branchId: r.branchId,
    amount: centsToDecimal(centsFromDb(r.requestedAmount)),
    destination: r.destination,
    destinationAccount: r.destinationAccount,
    reason: r.reason,
    status: r.status,
    requestedOn: r.requestDate,
    rejectionReason: r.rejectionReason,
    decidedAt: r.decidedAt,
    transactionId: r.transactionId,
  };
}

export async function withdrawalRequests(db: AppDb, actor: SavingsActor, status?: string) {
  const rows = await db
    .select()
    .from(requests)
    .where(
      and(
        actor.kind === 'client' ? eq(requests.memberId, actor.borrowerId) : actor.viewAll ? undefined : eq(requests.branchId, actor.branchId ?? '__none__'),
        status && status !== 'ALL' ? eq(requests.status, status) : undefined,
      ),
    )
    .orderBy(desc(requests.createdAt));
  return rows.map(requestView);
}

// ---------------------------------------------------------------------------
// Interest posting and dormancy
// ---------------------------------------------------------------------------

/**
 * Posts interest for every complete month not yet posted, on every open
 * account. A month is posted at most once per account (unique interest
 * period). Also marks accounts dormant after DORMANCY_MONTHS without activity.
 */
export async function runInterestPosting(db: AppDb, today = manilaToday()) {
  const open = await db.select({ id: accounts.id }).from(accounts).where(inArray(accounts.status, ['ACTIVE', 'DORMANT', 'FROZEN']));
  let posted = 0;
  let total = 0;
  let dormant = 0;
  for (const { id } of open) {
    const r = await inTransaction(db, async (tx) => {
      const { account, product } = await lockAccount(tx, SYSTEM, id);
      let count = 0;
      let sum = 0;
      const done = new Set(
        (await tx.select({ p: transactions.interestPeriod }).from(transactions).where(and(eq(transactions.savingsAccountId, id), eq(transactions.kind, 'INTEREST')))).map((x) => x.p),
      );
      const history = await tx.select().from(transactions).where(eq(transactions.savingsAccountId, id)).orderBy(asc(transactions.sequence));
      const opened = (account.openedAt ?? account.createdAt ?? today).slice(0, 10);
      let current = account;
      for (const period of completePeriods(opened, today)) {
        if (done.has(period)) continue;
        const { start, end } = periodBounds(period);
        const before = history.filter((h) => h.date < start);
        const opening = before.length ? centsFromDb(before[before.length - 1].balanceAfter) : 0;
        const movements = history.filter((h) => h.date >= start && h.date <= end).map((h) => ({ date: h.date, amount: centsFromDb(h.signedAmount) }));
        const { interest } = interestForPeriod({ opening, movements, period, annualRate: product.annualRate, method: product.accrualMethod, minimumBalance: product.minimumBalance });
        if (interest <= 0) continue;
        const row = await postTx(tx, SYSTEM, current, product, { kind: 'INTEREST', amount: interest, method: 'CASH', reference: null, notes: `Interest for ${period}`, idempotencyKey: `interest:${id}:${period}`, interestPeriod: period });
        history.push(row);
        [current] = await tx.select().from(accounts).where(eq(accounts.id, id)).limit(1);
        count += 1;
        sum += interest;
      }
      let madeDormant = false;
      if (current.status === 'ACTIVE' && current.lastActivityDate) {
        const cutoff = new Date(`${today}T00:00:00Z`);
        cutoff.setUTCMonth(cutoff.getUTCMonth() - DORMANCY_MONTHS);
        if (current.lastActivityDate < cutoff.toISOString().slice(0, 10)) {
          const at = nowIso();
          await tx.update(accounts).set({ status: 'DORMANT', statusReason: `No member activity since ${current.lastActivityDate}` }).where(eq(accounts.id, id));
          await audit(tx, current, SYSTEM, 'SAVINGS_DORMANT', `${current.passbookNumber} marked dormant (no activity since ${current.lastActivityDate}).`, at);
          madeDormant = true;
        }
      }
      return { count, sum, madeDormant };
    });
    posted += r.count;
    total += r.sum;
    if (r.madeDormant) dormant += 1;
  }
  return { date: today, accountsChecked: open.length, interestPostings: posted, interestTotal: centsToDecimal(total), madeDormant: dormant };
}

// ---------------------------------------------------------------------------
// Views, statements, reconciliation
// ---------------------------------------------------------------------------

export async function accountView(db: AppDb, a: AccountRow, product?: SavingsProduct) {
  const p = product ?? productFromRow((await db.select().from(products).where(eq(products.id, a.productId)).limit(1))[0]);
  const today = manilaToday();
  const balance = centsFromDb(a.balance);
  const check = checkWithdrawal({ status: a.status as SavingsStatus, balance, product: p, amount: 1, withdrawalsThisMonth: 0, maturityDate: a.maturityDate, today });
  return {
    id: a.id,
    passbookNumber: a.passbookNumber,
    memberId: a.memberId,
    memberName: a.memberName,
    branchId: a.branchId,
    product: { id: p.id, code: p.code, name: p.name, kind: p.kind, annualRate: ppmToPercent(p.annualRate), accrualMethod: p.accrualMethod, minimumBalance: centsToDecimal(p.minimumBalance), maxWithdrawalAmount: p.maxWithdrawalAmount === null ? null : centsToDecimal(p.maxWithdrawalAmount), maxWithdrawalsPerMonth: p.maxWithdrawalsPerMonth },
    status: a.status as SavingsStatus,
    statusReason: a.statusReason,
    balance: centsToDecimal(balance),
    /** What could be withdrawn now under the product rules (0 when blocked). */
    available: centsToDecimal(check.ok || check.code === 'BELOW_MINIMUM' || check.code === 'INSUFFICIENT' || check.code === 'OVER_LIMIT' ? check.available : 0),
    withdrawalBlockedBy: check.ok || ['BELOW_MINIMUM', 'INSUFFICIENT', 'OVER_LIMIT'].includes(check.code) ? null : check.message,
    openedAt: a.openedAt,
    closedAt: a.closedAt,
    maturityDate: a.maturityDate,
    lastActivityDate: a.lastActivityDate,
    groupId: a.groupId,
  };
}

export type SavingsAccountView = Awaited<ReturnType<typeof accountView>>;

export async function listAccounts(db: AppDb, actor: SavingsActor, filters: { status?: string; search?: string } = {}) {
  const rows = await db
    .select()
    .from(accounts)
    .where(
      and(
        actor.kind === 'client' ? eq(accounts.memberId, actor.borrowerId) : actor.viewAll ? undefined : eq(accounts.branchId, actor.branchId ?? '__none__'),
        filters.status ? eq(accounts.status, filters.status) : undefined,
        filters.search ? sql`(${accounts.memberName} ilike ${'%' + filters.search + '%'} or ${accounts.passbookNumber} ilike ${'%' + filters.search + '%'})` : undefined,
      ),
    )
    .orderBy(asc(accounts.memberName));
  const prods = new Map((await db.select().from(products)).map((p) => [p.id, productFromRow(p)]));
  return Promise.all(rows.map((r) => accountView(db, r, prods.get(r.productId))));
}

export async function accountDetail(db: AppDb, actor: SavingsActor, accountId: string) {
  const [a] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!a) throw new HttpError(404, 'Savings account not found.', 'NOT_FOUND');
  assertScope(actor, a);
  return accountView(db, a);
}

function txnView(t: TxnRow) {
  const signed = centsFromDb(t.signedAmount);
  return {
    id: t.id,
    number: t.transactionNumber,
    date: t.date,
    kind: t.kind as SavingsTxnKind,
    label: SAVINGS_TXN_LABELS[t.kind as SavingsTxnKind] ?? t.type,
    moneyIn: signed > 0 ? centsToDecimal(signed) : null,
    moneyOut: signed < 0 ? centsToDecimal(-signed) : null,
    balance: centsToDecimal(centsFromDb(t.balanceAfter)),
    method: t.method,
    reference: t.reference,
    destinationAccount: t.destinationAccount,
    processedBy: t.processedBy,
    notes: t.notes,
    interestPeriod: t.interestPeriod,
  };
}

/** A statement with the running balance after each transaction, in posting order. */
export async function statement(db: AppDb, actor: SavingsActor, accountId: string, range: { from?: string; to?: string } = {}) {
  const account = await accountDetail(db, actor, accountId);
  const all = await db.select().from(transactions).where(eq(transactions.savingsAccountId, accountId)).orderBy(asc(transactions.sequence));
  const from = range.from && /^\d{4}-\d{2}-\d{2}$/.test(range.from) ? range.from : null;
  const to = range.to && /^\d{4}-\d{2}-\d{2}$/.test(range.to) ? range.to : null;
  const before = from ? all.filter((t) => t.date < from) : [];
  const inRange = all.filter((t) => (!from || t.date >= from) && (!to || t.date <= to));
  const opening = before.length ? centsFromDb(before[before.length - 1].balanceAfter) : 0;
  const lines = inRange.map(txnView);
  const totalIn = inRange.reduce((s, t) => s + Math.max(0, centsFromDb(t.signedAmount)), 0);
  const totalOut = inRange.reduce((s, t) => s + Math.max(0, -centsFromDb(t.signedAmount)), 0);
  return {
    account,
    from: from ?? (all[0]?.date ?? null),
    to: to ?? manilaToday(),
    openingBalance: centsToDecimal(opening),
    totalIn: centsToDecimal(totalIn),
    totalOut: centsToDecimal(totalOut),
    closingBalance: centsToDecimal(opening + totalIn - totalOut),
    lines,
  };
}

/**
 * Checks the cached balances against the ledger: each account's balance must
 * equal the sum of its transactions, every transaction must chain from the
 * previous balance, and the general ledger's savings liabilities must equal
 * the sum of the balances they cover.
 */
export async function reconcileSavings(db: AppDb) {
  const rows = await db.select().from(accounts);
  const prods = new Map((await db.select().from(products)).map((p) => [p.id, productFromRow(p)]));
  const txns = await db.select().from(transactions).orderBy(asc(transactions.sequence));
  const byAccount = new Map<string, TxnRow[]>();
  for (const t of txns) byAccount.set(t.savingsAccountId, [...(byAccount.get(t.savingsAccountId) ?? []), t]);
  const mismatches: { accountId: string; passbookNumber: string; cached: string; ledger: string; brokenChainAt: string | null }[] = [];
  const subsidiary: Record<string, number> = {};
  for (const a of rows) {
    const list = byAccount.get(a.id) ?? [];
    const ledger = list.reduce((s, t) => s + centsFromDb(t.signedAmount), 0);
    let running = 0;
    let broken: string | null = null;
    for (const t of list) {
      if (centsFromDb(t.balanceBefore) !== running && !broken && t.kind !== 'OPENING_BALANCE') broken = t.transactionNumber;
      running = centsFromDb(t.balanceAfter);
    }
    const cached = centsFromDb(a.balance);
    if (cached !== ledger || broken) mismatches.push({ accountId: a.id, passbookNumber: a.passbookNumber, cached: centsToDecimal(cached), ledger: centsToDecimal(ledger), brokenChainAt: broken });
    const code = liabilityAccount(prods.get(a.productId)?.kind ?? 'REGULAR');
    subsidiary[code] = (subsidiary[code] ?? 0) + cached;
  }
  const gl = await db.execute(sql`select a.account_code, coalesce(sum(l.credit - l.debit), 0)::text as balance
                                    from accounts a left join journal_entry_lines l on l.account_id = a.account_id
                                   where a.account_code in ('2010', '2020') group by a.account_code`);
  const glRows = ((gl as { rows?: { account_code: string; balance: string }[] }).rows ?? (gl as unknown as { account_code: string; balance: string }[]));
  const general = glRows.map((g) => ({ accountCode: g.account_code, generalLedger: centsToDecimal(centsFromDb(g.balance)), accounts: centsToDecimal(subsidiary[g.account_code] ?? 0), ok: centsFromDb(g.balance) === (subsidiary[g.account_code] ?? 0) }));
  return { ok: mismatches.length === 0 && general.every((g) => g.ok), accountsChecked: rows.length, mismatches, generalLedger: general };
}

export async function transactionResult(db: AppDb, actor: SavingsActor, row: TxnRow) {
  return { transaction: txnView(row), account: await accountDetail(db, actor, row.savingsAccountId) };
}
