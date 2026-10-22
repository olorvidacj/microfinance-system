import crypto from 'crypto';
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { centsFromDb, centsToDecimal, formatPeso, parsePesos, type Cents } from '../../shared/lending';
import {
  DEPOSIT_STATUS_LABELS,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  PAYOUT_ACCOUNT_STATUS_LABELS,
  PAYOUT_STATUS_LABELS,
  checkDepositAmount,
  checkPayoutAccountNumber,
  instantWithdrawalRoom,
  isOwnName,
  maskAccountNumber,
  nameWords,
  payoutChannel,
  type DepositStatus,
  type PayoutAccountStatus,
  type PayoutStatus,
} from '../../shared/payments';
import { isKycVerified, kycGateMessage, normaliseKycStatus } from '../../shared/kyc-core';
import { HttpError, type AppDb } from '../kyc/errors';
import { has, inTransaction, newId, nowIso, type LendingClient, type LendingStaff } from '../lending/service';
import { lockSavingsAccount, manilaToday, postOnlineMovement, withdrawalCheckFor } from '../savings/service';
import type { PaymentDeps } from './config';
import { safeEqual } from './mockProvider';
import { ProviderError, type CheckoutView, type Headers, type PayoutView } from './provider';
import { deposits, events, payoutAccounts, payouts, type DepositRow, type PayoutAccountRow, type PayoutRow } from './tables';

/**
 * Online savings deposits and instant withdrawals.
 *
 * Deposit: the member opens the provider's checkout; the account is credited
 * only when the provider confirms the payment to this server (a webhook, or
 * the server asking the provider), never because the browser came back. A
 * confirmation only says which payment changed: the payment is fetched from
 * the provider again before anything is posted.
 *
 * Withdrawal: up to the daily limit, to a verified account in the member's own
 * name, after a one-time code. The money leaves the savings account when the
 * code is accepted and comes back automatically if the payout fails.
 *
 * Exactly once: every credit and refund happens under a lock on the payment's
 * row, and its savings transaction carries a unique idempotency key
 * (online-deposit:<id>, online-payout:<id>, online-payout-refund:<id>).
 * Lock order is payment row, then savings account, then member.
 */

const DEPOSIT_TTL_SECONDS = 3600;
const MAX_OPEN_CHECKOUTS = 5;
const MAX_WITHDRAWAL_STARTS_PER_DAY = 10;
/** Payouts the provider has not confirmed after this long go to staff. */
const PAYOUT_REVIEW_AFTER_MS = 2 * 60 * 60 * 1000;
const TAKEN: PayoutStatus[] = ['SUBMITTING', 'PROCESSING', 'PAID', 'NEEDS_REVIEW'];

function onlineActor(provider: string): LendingStaff {
  return { kind: 'staff', userId: 'system:payments', staffId: null, name: `Online payments (${provider})`, role: 'SYSTEM', branchId: null, viewAll: true, permissions: [] };
}

const pesos = (c: Cents) => centsToDecimal(c);

/**
 * Times read back from Postgres look like "2026-10-22 01:23:45.678+00", not
 * ISO, so they are compared as instants, never as text.
 */
const ms = (v: string) => Date.parse(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
const iso = (v: string | null) => (v === null ? null : new Date(ms(v)).toISOString());

// ---------------------------------------------------------------------------
// Members, audit, notifications
// ---------------------------------------------------------------------------

async function memberOf(db: AppDb, borrowerId: string) {
  const [m] = await db
    .select({
      id: schema.borrowers.id,
      fullName: schema.borrowers.fullName,
      firstName: schema.borrowers.firstName,
      middleName: schema.borrowers.middleName,
      lastName: schema.borrowers.lastName,
      email: schema.borrowers.email,
      phone: schema.borrowers.phone,
      branchId: schema.borrowers.branchId,
      kycStatus: schema.borrowers.kycStatus,
    })
    .from(schema.borrowers)
    .where(eq(schema.borrowers.id, borrowerId))
    .limit(1);
  if (!m) throw new HttpError(404, 'Member not found.', 'NOT_FOUND');
  return m;
}

function requireVerified(m: { kycStatus: string }) {
  if (!isKycVerified(m.kycStatus)) throw new HttpError(403, kycGateMessage(m.kycStatus), 'KYC_REQUIRED', { kycStatus: normaliseKycStatus(m.kycStatus) });
}

/**
 * The member's name parts. Older records only have the full name, and some
 * have no middle-name field although the full name carries one.
 */
function nameParts(m: { fullName: string; firstName: string | null; middleName: string | null; lastName: string | null }) {
  const words = m.fullName.trim().split(/\s+/);
  if (m.firstName && m.lastName) {
    const named = new Set([...nameWords(m.firstName), ...nameWords(m.lastName)]);
    const rest = nameWords(m.fullName).filter((w) => !named.has(w)).join(' ');
    return { firstName: m.firstName, middleName: m.middleName || rest || null, lastName: m.lastName };
  }
  return { firstName: words[0] ?? '', middleName: words.slice(1, -1).join(' ') || null, lastName: words.length > 1 ? words[words.length - 1] : '' };
}

async function audit(tx: AppDb, actor: { userId: string; name: string; role: string }, row: { id: string; branchId: string }, action: string, details: string, targetType: string, at: string) {
  await tx.insert(schema.auditLogs).values({
    id: newId('aud'),
    timestamp: at,
    action,
    details,
    performedBy: actor.userId,
    branchId: row.branchId,
    type: 'SAVINGS',
    userName: actor.name,
    userRole: actor.role,
    targetType,
    targetId: row.id,
  });
}

const clientAuditor = (a: LendingClient) => ({ userId: a.userId, name: a.name, role: 'CLIENT' });
const staffAuditor = (a: LendingStaff) => ({ userId: a.userId, name: a.name, role: a.role });

async function notify(tx: AppDb, row: { id: string; branchId: string; memberId: string }, audience: 'CLIENT' | 'STAFF', type: string, title: string, message: string, at: string, relatedType: string) {
  await tx.insert(schema.branchNotifications).values({
    id: newId('ntf'),
    branchId: row.branchId,
    audience,
    borrowerId: audience === 'CLIENT' ? row.memberId : null,
    type,
    title,
    message,
    relatedType,
    relatedId: row.id,
    isRead: false,
    createdAt: at,
  });
}

function referenceFor(prefix: 'OD' | 'OP', id: string, today: string) {
  return `${prefix}-${today.replace(/-/g, '')}-${id.slice(-8).toUpperCase()}`;
}

function inScope(staff: LendingStaff, branchId: string) {
  return staff.viewAll || (staff.branchId !== null && staff.branchId === branchId);
}

function requireNote(raw: unknown): string {
  const note = typeof raw === 'string' ? raw.trim().slice(0, 500) : '';
  if (note.length < 5) throw new HttpError(400, 'Write what you checked (at least 5 characters).', 'NOTE_REQUIRED', { fields: { note: 'Required' } });
  return note;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export function depositView(d: DepositRow) {
  const status = d.status as DepositStatus;
  return {
    id: d.id,
    reference: d.reference,
    accountId: d.accountId,
    amount: pesos(centsFromDb(d.amount)),
    status,
    statusLabel: DEPOSIT_STATUS_LABELS[status] ?? d.status,
    /** Only while it can still be paid. */
    checkoutUrl: status === 'PENDING' ? d.checkoutUrl : null,
    expiresAt: iso(d.expiresAt),
    createdAt: iso(d.createdAt),
    creditedAt: iso(d.creditedAt),
  };
}

export function staffDepositView(d: DepositRow, memberName: string) {
  return {
    ...depositView(d),
    memberId: d.memberId,
    memberName,
    branchId: d.branchId,
    provider: d.provider,
    providerRef: d.providerRef,
    paidAmount: d.paidAmount === null ? null : pesos(centsFromDb(d.paidAmount)),
    reviewReason: d.reviewReason,
    resolutionNote: d.resolutionNote,
    resolvedByName: d.resolvedByName,
  };
}

export function payoutView(p: PayoutRow) {
  const status = p.status as PayoutStatus;
  const channel = payoutChannel(p.channelCode);
  return {
    id: p.id,
    reference: p.reference,
    accountId: p.accountId,
    amount: pesos(centsFromDb(p.amount)),
    status,
    statusLabel: PAYOUT_STATUS_LABELS[status] ?? p.status,
    destination: `${channel?.label ?? p.channelCode} ${maskAccountNumber(p.accountNumber)}`,
    failureReason: status === 'REFUNDED' ? p.failureReason : null,
    createdAt: iso(p.createdAt),
    paidAt: iso(p.paidAt),
    refundedAt: iso(p.refundedAt),
  };
}

export function staffPayoutView(p: PayoutRow, memberName: string) {
  return {
    ...payoutView(p),
    memberId: p.memberId,
    memberName,
    branchId: p.branchId,
    provider: p.provider,
    providerRef: p.providerRef,
    accountName: p.accountName,
    accountNumber: p.accountNumber,
    submittedAt: iso(p.submittedAt),
    failureReason: p.failureReason,
    reviewReason: p.reviewReason,
    resolutionNote: p.resolutionNote,
  };
}

export function payoutAccountView(a: PayoutAccountRow, opts: { full?: boolean } = {}) {
  const channel = payoutChannel(a.channelCode);
  const status = a.status as PayoutAccountStatus;
  return {
    id: a.id,
    channelCode: a.channelCode,
    channelLabel: channel?.label ?? a.channelCode,
    kind: a.channelKind,
    accountNumber: opts.full ? a.accountNumber : maskAccountNumber(a.accountNumber),
    accountName: a.accountName,
    status,
    statusLabel: PAYOUT_ACCOUNT_STATUS_LABELS[status] ?? a.status,
    statusReason: a.statusReason,
    createdAt: iso(a.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------

export async function startDeposit(db: AppDb, deps: PaymentDeps, actor: LendingClient, input: { accountId: unknown; amount: unknown }) {
  const amount = checkDepositAmount(input.amount);
  if (!amount.ok || amount.value === null) throw new HttpError(400, 'Check the amount.', 'INVALID_AMOUNT', { fields: amount.errors });
  const member = await memberOf(db, actor.borrowerId);
  requireVerified(member);
  const today = manilaToday();
  const id = newId('od');
  const at = nowIso();
  const row = await inTransaction(db, async (tx) => {
    const { account } = await lockSavingsAccount(tx, actor, String(input.accountId ?? ''));
    if (account.status === 'CLOSED') throw new HttpError(409, 'This account is closed.', 'ACCOUNT_CLOSED');
    const [open] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(deposits)
      .where(and(eq(deposits.memberId, member.id), eq(deposits.status, 'PENDING'), gte(deposits.createdAt, new Date(Date.now() - DEPOSIT_TTL_SECONDS * 1000).toISOString())));
    if (Number(open?.n ?? 0) >= MAX_OPEN_CHECKOUTS) throw new HttpError(429, 'You have several unpaid deposits open. Pay or wait for one of them first.', 'TOO_MANY_OPEN');
    const [created] = await tx
      .insert(deposits)
      .values({
        id,
        reference: referenceFor('OD', id, today),
        provider: deps.provider.name,
        memberId: member.id,
        accountId: account.id,
        branchId: account.branchId ?? member.branchId,
        amount: pesos(amount.value),
        status: 'PENDING',
        createdAt: at,
        updatedAt: at,
      })
      .returning();
    await audit(tx, clientAuditor(actor), created, 'ONLINE_DEPOSIT_STARTED', `${member.fullName} opened an online deposit ${created.reference} of ${formatPeso(amount.value)} to ${account.passbookNumber}.`, 'OnlineDeposit', at);
    return created;
  });

  let checkout: { providerRef: string; checkoutUrl: string; expiresAt: string | null };
  try {
    const back = `${deps.publicBaseUrl}/portal/savings?deposit=${encodeURIComponent(row.id)}`;
    checkout = await deps.provider.createCheckout({
      reference: row.reference,
      amount: amount.value,
      description: `HOSCOMCO savings deposit ${row.reference}`,
      payer: { name: member.fullName, email: member.email || null, phone: member.phone || null },
      successUrl: back,
      failureUrl: back,
      expiresInSeconds: DEPOSIT_TTL_SECONDS,
    });
  } catch (err) {
    await db.update(deposits).set({ status: 'FAILED', updatedAt: nowIso() }).where(and(eq(deposits.id, row.id), eq(deposits.status, 'PENDING')));
    console.error('[payments] checkout not created:', err);
    throw new HttpError(502, 'The payment page could not be opened. Nothing was charged; please try again.', 'PROVIDER_UNAVAILABLE');
  }
  const [saved] = await db
    .update(deposits)
    .set({ providerRef: checkout.providerRef, checkoutUrl: checkout.checkoutUrl, expiresAt: checkout.expiresAt, updatedAt: nowIso() })
    .where(eq(deposits.id, row.id))
    .returning();
  return depositView(saved);
}

export async function myDeposit(db: AppDb, actor: LendingClient, id: string) {
  const [d] = await db.select().from(deposits).where(eq(deposits.id, id)).limit(1);
  if (!d || d.memberId !== actor.borrowerId) throw new HttpError(404, 'Deposit not found.', 'NOT_FOUND');
  return d;
}

export async function myDeposits(db: AppDb, actor: LendingClient) {
  const rows = await db.select().from(deposits).where(eq(deposits.memberId, actor.borrowerId)).orderBy(desc(deposits.createdAt)).limit(30);
  return rows.map(depositView);
}

/** The member came back from checkout: ask the provider (never the browser) what happened. */
export async function refreshMyDeposit(db: AppDb, deps: PaymentDeps, actor: LendingClient, id: string) {
  const d = await myDeposit(db, actor, id);
  if (d.status === 'PENDING' && d.providerRef) {
    try {
      return depositView((await syncDeposit(db, deps, d)).row);
    } catch (err) {
      // The provider could not be asked just now; the webhook or the next check will settle it.
      if (!(err instanceof ProviderError)) throw err;
    }
  }
  return depositView(d);
}

type Outcome = { row: DepositRow; outcome: string };

async function markDepositReview(tx: AppDb, d: DepositRow, reason: string, extra: Partial<DepositRow>, at: string): Promise<Outcome> {
  const [row] = await tx.update(deposits).set({ ...extra, status: 'NEEDS_REVIEW', reviewReason: reason, updatedAt: at }).where(eq(deposits.id, d.id)).returning();
  await audit(tx, onlineActor(d.provider), d, 'ONLINE_DEPOSIT_REVIEW', `${d.reference}: ${reason}`, 'OnlineDeposit', at);
  await notify(tx, d, 'STAFF', 'ONLINE_PAYMENT_REVIEW', 'Online deposit needs review', `${d.reference}: ${reason}`, at, 'OnlineDeposit');
  return { row, outcome: 'NEEDS_REVIEW' };
}

/** Applies what the provider says about a checkout. Credits at most once. */
async function applyCheckout(db: AppDb, depositId: string, view: CheckoutView): Promise<Outcome> {
  return inTransaction(db, async (tx) => {
    const [d] = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for('update').limit(1);
    if (!d) throw new HttpError(404, 'Deposit not found.', 'NOT_FOUND');
    if (d.status === 'CREDITED') return { row: d, outcome: 'ALREADY_CREDITED' };
    if (d.status === 'DISMISSED' || d.status === 'NEEDS_REVIEW') return { row: d, outcome: d.status };
    const at = nowIso();
    if (view.reference !== d.reference || (d.providerRef !== null && view.providerRef !== d.providerRef)) {
      return markDepositReview(tx, d, 'The provider’s record does not match this deposit.', {}, at);
    }
    if (view.state === 'PENDING') return { row: d, outcome: 'PENDING' };
    if (view.state === 'EXPIRED' || view.state === 'FAILED') {
      if (d.status !== 'PENDING') return { row: d, outcome: d.status };
      const [row] = await tx.update(deposits).set({ status: view.state, updatedAt: at }).where(eq(deposits.id, d.id)).returning();
      return { row, outcome: view.state };
    }
    // Paid. A late payment on an expired or failed checkout is still the member's money.
    const want = centsFromDb(d.amount);
    const paid = view.paidAmount ?? view.amount;
    const paidFields = { paidAmount: pesos(paid), fee: view.fee === null ? null : pesos(view.fee), paidAt: view.paidAt ?? at, providerRef: d.providerRef ?? view.providerRef };
    if (paid !== want) return markDepositReview(tx, d, `The provider received ${formatPeso(paid)} for a ${formatPeso(want)} deposit.`, paidFields, at);
    const actor = onlineActor(d.provider);
    const { account, product } = await lockSavingsAccount(tx, actor, d.accountId);
    if (account.status === 'CLOSED') return markDepositReview(tx, d, 'The savings account was closed before the payment arrived.', paidFields, at);
    const txn = await postOnlineMovement(tx, actor, account, product, {
      kind: 'DEPOSIT',
      amount: want,
      provider: d.provider,
      reference: d.reference,
      notes: `Online deposit ${d.reference}`,
      idempotencyKey: `online-deposit:${d.id}`,
    });
    const [row] = await tx
      .update(deposits)
      .set({ ...paidFields, status: 'CREDITED', savingsTransactionId: txn.id, creditedAt: at, updatedAt: at })
      .where(eq(deposits.id, d.id))
      .returning();
    return { row, outcome: 'CREDITED' };
  });
}

/** Asks the provider about a deposit and applies the answer. */
export async function syncDeposit(db: AppDb, deps: PaymentDeps, d: DepositRow): Promise<Outcome> {
  if (d.status === 'CREDITED') return { row: d, outcome: 'ALREADY_CREDITED' };
  if (!d.providerRef || d.status === 'DISMISSED' || d.status === 'NEEDS_REVIEW') return { row: d, outcome: d.status };
  return applyCheckout(db, d.id, await deps.provider.getCheckout(d.providerRef));
}

// ---------------------------------------------------------------------------
// Provider confirmations
// ---------------------------------------------------------------------------

function storablePayload(body: unknown): object {
  if (!body || typeof body !== 'object') return { raw: String(body).slice(0, 2000) };
  const text = JSON.stringify(body);
  return text.length > 20_000 ? { truncated: true, size: text.length } : (body as object);
}

/**
 * A provider confirmation. Unverified ones are refused (401). For verified
 * ones the payment is fetched again from the provider and applied; a repeat
 * changes nothing. 500 asks the provider to send it again later.
 */
export async function receiveWebhook(db: AppDb, deps: PaymentDeps, providerName: string, headers: Headers, body: unknown): Promise<{ status: number; outcome: string }> {
  const verified = providerName === deps.provider.name && deps.provider.verifyWebhook(headers, body);
  const notice = verified ? deps.provider.parseWebhook(body) : null;
  let outcome: string;
  let status = 200;
  if (!verified) {
    outcome = 'REJECTED_UNVERIFIED';
    status = 401;
  } else if (!notice) {
    outcome = 'IGNORED';
  } else {
    try {
      outcome = notice.kind === 'checkout' ? await webhookForDeposit(db, deps, notice.providerRef, notice.reference) : await webhookForPayout(db, deps, notice.providerRef, notice.reference);
    } catch (err) {
      outcome = `ERROR: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300);
      status = 500;
    }
  }
  await db.insert(events).values({
    id: newId('pev'),
    provider: providerName.slice(0, 20),
    kind: notice?.kind ?? 'unknown',
    providerRef: notice?.providerRef ?? null,
    reference: notice?.reference ?? null,
    verified,
    outcome,
    payload: storablePayload(body),
    receivedAt: nowIso(),
  });
  return { status, outcome };
}

async function webhookForDeposit(db: AppDb, deps: PaymentDeps, providerRef: string | null, reference: string | null): Promise<string> {
  const match = [providerRef ? eq(deposits.providerRef, providerRef) : undefined, reference ? eq(deposits.reference, reference) : undefined].filter((c) => c !== undefined);
  if (!match.length) return 'UNKNOWN_PAYMENT';
  const [d] = await db.select().from(deposits).where(and(eq(deposits.provider, deps.provider.name), or(...match))).limit(1);
  if (!d) return 'UNKNOWN_PAYMENT';
  if (!d.providerRef && providerRef) {
    // The confirmation came before the checkout was saved: fetch by the provider's id.
    return (await applyCheckout(db, d.id, await deps.provider.getCheckout(providerRef))).outcome;
  }
  return (await syncDeposit(db, deps, d)).outcome;
}

async function webhookForPayout(db: AppDb, deps: PaymentDeps, providerRef: string | null, reference: string | null): Promise<string> {
  const match = [providerRef ? eq(payouts.providerRef, providerRef) : undefined, reference ? eq(payouts.reference, reference) : undefined].filter((c) => c !== undefined);
  if (!match.length) return 'UNKNOWN_PAYOUT';
  const [p] = await db.select().from(payouts).where(and(eq(payouts.provider, deps.provider.name), or(...match))).limit(1);
  if (!p) return 'UNKNOWN_PAYOUT';
  return (await syncPayout(db, deps, p)).outcome;
}

// ---------------------------------------------------------------------------
// Payout accounts (the member's own bank and e-wallet accounts)
// ---------------------------------------------------------------------------

export async function addPayoutAccount(db: AppDb, actor: LendingClient, input: { channelCode: unknown; accountNumber: unknown; accountName: unknown }) {
  const channel = payoutChannel(input.channelCode);
  if (!channel) throw new HttpError(400, 'Choose the bank or e-wallet.', 'INVALID_CHANNEL', { fields: { channelCode: 'Required' } });
  const number = checkPayoutAccountNumber(channel, input.accountNumber);
  if (!number.ok || number.value === null) throw new HttpError(400, 'Check the account number.', 'INVALID_ACCOUNT', { fields: number.errors });
  const name = typeof input.accountName === 'string' ? input.accountName.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
  const member = await memberOf(db, actor.borrowerId);
  requireVerified(member);
  if (!isOwnName(name, nameParts(member))) {
    throw new HttpError(400, `The account must be in your own name (${member.fullName}). Money is only paid to accounts in the member's name.`, 'NOT_OWN_NAME', {
      fields: { accountName: 'Enter the account name exactly as your bank or e-wallet shows it; it must be your own name.' },
    });
  }
  const at = nowIso();
  const row = await inTransaction(db, async (tx) => {
    const clash = await tx
      .select({ memberId: payoutAccounts.memberId })
      .from(payoutAccounts)
      .where(and(eq(payoutAccounts.channelCode, channel.code), eq(payoutAccounts.accountNumber, number.value), inArray(payoutAccounts.status, ['PENDING_VERIFICATION', 'VERIFIED'])));
    if (clash.some((c) => c.memberId === member.id)) throw new HttpError(409, 'You have already added this account.', 'DUPLICATE_ACCOUNT');
    if (clash.length) throw new HttpError(409, 'This account cannot be added. If it is yours, ask at your branch.', 'ACCOUNT_IN_USE');
    const [created] = await tx
      .insert(payoutAccounts)
      .values({ id: newId('pa'), memberId: member.id, branchId: member.branchId, channelCode: channel.code, channelKind: channel.kind, accountNumber: number.value, accountName: name, status: 'PENDING_VERIFICATION', createdAt: at })
      .returning();
    await audit(tx, clientAuditor(actor), created, 'PAYOUT_ACCOUNT_ADDED', `${member.fullName} added ${channel.label} ${maskAccountNumber(number.value)} in the name ${name}.`, 'PayoutAccount', at);
    await notify(tx, { id: created.id, branchId: created.branchId, memberId: member.id }, 'STAFF', 'PAYOUT_ACCOUNT_TO_VERIFY', 'Payout account to verify', `${member.fullName} added ${channel.label} ${maskAccountNumber(number.value)}.`, at, 'PayoutAccount');
    return created;
  });
  return payoutAccountView(row);
}

export async function myPayoutAccounts(db: AppDb, actor: LendingClient) {
  const rows = await db
    .select()
    .from(payoutAccounts)
    .where(and(eq(payoutAccounts.memberId, actor.borrowerId), inArray(payoutAccounts.status, ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'])))
    .orderBy(desc(payoutAccounts.createdAt));
  return rows.map((r) => payoutAccountView(r));
}

export async function removePayoutAccount(db: AppDb, actor: LendingClient, id: string) {
  return inTransaction(db, async (tx) => {
    const [a] = await tx.select().from(payoutAccounts).where(eq(payoutAccounts.id, id)).for('update').limit(1);
    if (!a || a.memberId !== actor.borrowerId || a.status === 'REMOVED') throw new HttpError(404, 'Account not found.', 'NOT_FOUND');
    const [row] = await tx.update(payoutAccounts).set({ status: 'REMOVED' }).where(eq(payoutAccounts.id, id)).returning();
    await audit(tx, clientAuditor(actor), a, 'PAYOUT_ACCOUNT_REMOVED', `${a.channelCode} ${maskAccountNumber(a.accountNumber)} removed by the member.`, 'PayoutAccount', nowIso());
    return payoutAccountView(row);
  });
}

export async function decidePayoutAccount(db: AppDb, staff: LendingStaff, id: string, input: { decision: unknown; reason?: unknown }) {
  if (!has(staff, 'process_savings_withdrawals')) throw new HttpError(403, 'Your role cannot verify payout accounts.', 'FORBIDDEN');
  const decision = String(input.decision ?? '').toUpperCase();
  if (decision !== 'VERIFY' && decision !== 'REJECT') throw new HttpError(400, 'decision must be VERIFY or REJECT.', 'BAD_DECISION');
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 300) : '';
  if (reason.length < 5) throw new HttpError(400, decision === 'VERIFY' ? 'Write how you confirmed the account is the member’s (at least 5 characters).' : 'Tell the member why (at least 5 characters).', 'REASON_REQUIRED');
  return inTransaction(db, async (tx) => {
    const [a] = await tx.select().from(payoutAccounts).where(eq(payoutAccounts.id, id)).for('update').limit(1);
    if (!a || !inScope(staff, a.branchId)) throw new HttpError(404, 'Account not found in your branch.', 'NOT_FOUND');
    if (a.status !== 'PENDING_VERIFICATION') throw new HttpError(409, 'This account was already decided.', 'ALREADY_DECIDED');
    if (decision === 'VERIFY') {
      const [taken] = await tx
        .select({ id: payoutAccounts.id })
        .from(payoutAccounts)
        .where(and(eq(payoutAccounts.channelCode, a.channelCode), eq(payoutAccounts.accountNumber, a.accountNumber), eq(payoutAccounts.status, 'VERIFIED')))
        .limit(1);
      if (taken) throw new HttpError(409, 'This account number is already verified for another member.', 'ACCOUNT_IN_USE');
    }
    const at = nowIso();
    const status = decision === 'VERIFY' ? 'VERIFIED' : 'REJECTED';
    const [row] = await tx.update(payoutAccounts).set({ status, statusReason: reason, decidedBy: staff.userId, decidedByName: staff.name, decidedAt: at }).where(eq(payoutAccounts.id, id)).returning();
    const label = `${payoutChannel(a.channelCode)?.label ?? a.channelCode} ${maskAccountNumber(a.accountNumber)}`;
    await audit(tx, staffAuditor(staff), a, decision === 'VERIFY' ? 'PAYOUT_ACCOUNT_VERIFIED' : 'PAYOUT_ACCOUNT_REJECTED', `${label} (${a.accountName}): ${reason}`, 'PayoutAccount', at);
    await notify(
      tx,
      { id: a.id, branchId: a.branchId, memberId: a.memberId },
      'CLIENT',
      'PAYOUT_ACCOUNT_DECIDED',
      decision === 'VERIFY' ? 'Payout account verified' : 'Payout account not accepted',
      decision === 'VERIFY' ? `${label} can now receive instant withdrawals.` : `${label} was not accepted: ${reason}`,
      at,
      'PayoutAccount',
    );
    return payoutAccountView(row, { full: true });
  });
}

// ---------------------------------------------------------------------------
// Instant withdrawals
// ---------------------------------------------------------------------------

function hashOtp(secret: string, payoutId: string, code: string): string {
  return crypto.createHmac('sha256', secret).update(`${payoutId}:${code}`).digest('hex');
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '';
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/** What the member has already taken out instantly today (anything past the code, unless it came back). */
async function usedToday(tx: AppDb, memberId: string, day: string): Promise<Cents> {
  const [r] = await tx
    .select({ total: sql<string>`coalesce(sum(${payouts.amount}), 0)::text` })
    .from(payouts)
    .where(and(eq(payouts.memberId, memberId), eq(payouts.businessDate, day), inArray(payouts.status, TAKEN)));
  return centsFromDb(r?.total ?? '0');
}

export async function instantLimits(db: AppDb, deps: PaymentDeps, actor: LendingClient) {
  const used = await usedToday(db, actor.borrowerId, manilaToday());
  return { dailyLimit: pesos(deps.dailyLimit), usedToday: pesos(used), remaining: pesos(Math.max(0, deps.dailyLimit - used)) };
}

export async function myPayouts(db: AppDb, actor: LendingClient) {
  const rows = await db.select().from(payouts).where(eq(payouts.memberId, actor.borrowerId)).orderBy(desc(payouts.createdAt)).limit(30);
  return rows.map(payoutView);
}

/**
 * Checks an instant withdrawal and sends the one-time code. Nothing leaves the
 * account yet. Over the day's limit it is refused with OVER_DAILY_LIMIT: the
 * member sends a withdrawal request to the branch instead.
 */
export async function startPayout(db: AppDb, deps: PaymentDeps, actor: LendingClient, input: { accountId: unknown; payoutAccountId: unknown; amount: unknown }) {
  const amount = parsePesos(input.amount);
  if (amount === null || amount <= 0) throw new HttpError(400, 'Check the amount.', 'INVALID_AMOUNT', { fields: { amount: 'Enter the amount (pesos and centavos only).' } });
  const member = await memberOf(db, actor.borrowerId);
  requireVerified(member);
  if (!member.email) throw new HttpError(409, 'Add an email address to your profile to receive withdrawal codes.', 'NO_EMAIL');
  const today = manilaToday();
  const code = String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
  const row = await inTransaction(db, async (tx) => {
    const { account, product } = await lockSavingsAccount(tx, actor, String(input.accountId ?? ''));
    const [target] = await tx.select().from(payoutAccounts).where(eq(payoutAccounts.id, String(input.payoutAccountId ?? ''))).limit(1);
    if (!target || target.memberId !== member.id || target.status === 'REMOVED') throw new HttpError(404, 'Payout account not found.', 'NOT_FOUND');
    if (target.status !== 'VERIFIED') throw new HttpError(409, 'This account is not verified yet. Your branch verifies it once before money is sent to it.', 'ACCOUNT_NOT_VERIFIED');
    const room = instantWithdrawalRoom({ amount, usedToday: await usedToday(tx, member.id, today), dailyLimit: deps.dailyLimit });
    if (!room.ok) throw new HttpError(409, room.message, room.code, { remaining: pesos(room.remaining) });
    const check = await withdrawalCheckFor(tx, account, product, amount);
    if (!check.ok) throw new HttpError(409, check.message, check.code, { available: pesos(check.available) });
    const [starts] = await tx.select({ n: sql<number>`count(*)::int` }).from(payouts).where(and(eq(payouts.memberId, member.id), eq(payouts.businessDate, today)));
    if (Number(starts?.n ?? 0) >= MAX_WITHDRAWAL_STARTS_PER_DAY) throw new HttpError(429, 'Too many withdrawal attempts today. Try again tomorrow or visit your branch.', 'TOO_MANY_ATTEMPTS');
    const at = nowIso();
    // One code at a time: an earlier unconfirmed withdrawal is cancelled.
    await tx.update(payouts).set({ status: 'CANCELLED', otpHash: null, otpExpiresAt: null, updatedAt: at }).where(and(eq(payouts.memberId, member.id), eq(payouts.status, 'AWAITING_OTP')));
    const id = newId('op');
    const [created] = await tx
      .insert(payouts)
      .values({
        id,
        reference: referenceFor('OP', id, today),
        provider: deps.provider.name,
        memberId: member.id,
        accountId: account.id,
        branchId: account.branchId ?? member.branchId,
        payoutAccountId: target.id,
        channelCode: target.channelCode,
        accountNumber: target.accountNumber,
        accountName: target.accountName,
        amount: pesos(amount),
        businessDate: today,
        status: 'AWAITING_OTP',
        otpHash: hashOtp(deps.otpSecret, id, code),
        otpExpiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString(),
        otpAttempts: 0,
        createdAt: at,
        updatedAt: at,
      })
      .returning();
    await audit(tx, clientAuditor(actor), created, 'ONLINE_WITHDRAWAL_STARTED', `${member.fullName} asked for an instant withdrawal ${created.reference} of ${formatPeso(amount)} to ${payoutChannel(target.channelCode)?.label ?? target.channelCode} ${maskAccountNumber(target.accountNumber)}.`, 'OnlinePayout', at);
    return created;
  });
  try {
    await deps.sendOtp({ email: member.email, name: member.fullName }, code);
  } catch (err) {
    await db.update(payouts).set({ status: 'CANCELLED', otpHash: null, otpExpiresAt: null, updatedAt: nowIso() }).where(and(eq(payouts.id, row.id), eq(payouts.status, 'AWAITING_OTP')));
    console.error('[payments] withdrawal code not sent:', err);
    throw new HttpError(502, 'The code could not be sent. Nothing was taken; please try again.', 'OTP_NOT_SENT');
  }
  return { payout: payoutView(row), codeSentTo: maskEmail(member.email), expiresInSeconds: OTP_TTL_SECONDS };
}

type ConfirmStep = { kind: 'done' | 'taken'; row: PayoutRow } | { kind: 'refused'; error: HttpError };

/**
 * Checks the code and, if it is right, takes the money and sends the payout.
 * The balance and the day's limit are checked again here, under the account
 * and member locks, so two withdrawals at once cannot overdraw or exceed it.
 */
export async function confirmPayout(db: AppDb, deps: PaymentDeps, actor: LendingClient, payoutId: string, input: { code: unknown }) {
  const code = String(input.code ?? '').replace(/\D/g, '');
  const step: ConfirmStep = await inTransaction(db, async (tx): Promise<ConfirmStep> => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for('update').limit(1);
    if (!p || p.memberId !== actor.borrowerId) throw new HttpError(404, 'Withdrawal not found.', 'NOT_FOUND');
    if (p.status !== 'AWAITING_OTP') return { kind: 'done', row: p };
    const at = nowIso();
    const cancel = async (error: HttpError, attempts = p.otpAttempts): Promise<ConfirmStep> => {
      await tx.update(payouts).set({ status: 'CANCELLED', otpHash: null, otpExpiresAt: null, otpAttempts: attempts, updatedAt: at }).where(eq(payouts.id, p.id));
      return { kind: 'refused', error };
    };
    if (!p.otpHash || !p.otpExpiresAt || ms(p.otpExpiresAt) < Date.now()) return cancel(new HttpError(410, 'The code has expired. Nothing was taken; start the withdrawal again.', 'OTP_EXPIRED'));
    if (code.length !== OTP_LENGTH || !safeEqual(hashOtp(deps.otpSecret, p.id, code), p.otpHash)) {
      const attempts = p.otpAttempts + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) return cancel(new HttpError(429, 'Too many wrong codes. This withdrawal was cancelled and nothing was taken.', 'OTP_LOCKED'), attempts);
      await tx.update(payouts).set({ otpAttempts: attempts, updatedAt: at }).where(eq(payouts.id, p.id));
      return { kind: 'refused', error: new HttpError(400, `That code is not right. ${OTP_MAX_ATTEMPTS - attempts} ${OTP_MAX_ATTEMPTS - attempts === 1 ? 'try' : 'tries'} left.`, 'WRONG_OTP') };
    }

    const { account, product } = await lockSavingsAccount(tx, actor, p.accountId);
    await tx.execute(sql`select id from borrowers where id = ${p.memberId} for update`);
    const today = manilaToday();
    const amount = centsFromDb(p.amount);
    const [target] = await tx.select().from(payoutAccounts).where(eq(payoutAccounts.id, p.payoutAccountId)).limit(1);
    if (!target || target.status !== 'VERIFIED') return cancel(new HttpError(409, 'The payout account is no longer verified. Nothing was taken.', 'ACCOUNT_NOT_VERIFIED'));
    const room = instantWithdrawalRoom({ amount, usedToday: await usedToday(tx, p.memberId, today), dailyLimit: deps.dailyLimit });
    if (!room.ok) return cancel(new HttpError(409, room.message, room.code, { remaining: pesos(room.remaining) }));
    const check = await withdrawalCheckFor(tx, account, product, amount);
    if (!check.ok) return cancel(new HttpError(409, `${check.message} Nothing was taken.`, check.code, { available: pesos(check.available) }));
    const txn = await postOnlineMovement(tx, actor, account, product, {
      kind: 'WITHDRAWAL',
      amount,
      provider: p.provider,
      reference: p.reference,
      destinationAccount: `${payoutChannel(p.channelCode)?.label ?? p.channelCode} ${maskAccountNumber(p.accountNumber)}`,
      notes: `Instant withdrawal ${p.reference}`,
      idempotencyKey: `online-payout:${p.id}`,
    });
    const [row] = await tx
      .update(payouts)
      .set({ status: 'SUBMITTING', debitTransactionId: txn.id, otpHash: null, otpExpiresAt: null, businessDate: today, submittedAt: at, updatedAt: at })
      .where(eq(payouts.id, p.id))
      .returning();
    await audit(tx, clientAuditor(actor), row, 'ONLINE_WITHDRAWAL_CONFIRMED', `${row.reference}: code accepted, ${formatPeso(amount)} taken from ${account.passbookNumber} for payout.`, 'OnlinePayout', at);
    return { kind: 'taken', row };
  });
  if (step.kind === 'refused') throw step.error;
  if (step.kind === 'done') return payoutView(step.row);
  return payoutView(await submitPayout(db, deps, step.row.id));
}

export async function cancelMyPayout(db: AppDb, actor: LendingClient, payoutId: string) {
  return inTransaction(db, async (tx) => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for('update').limit(1);
    if (!p || p.memberId !== actor.borrowerId) throw new HttpError(404, 'Withdrawal not found.', 'NOT_FOUND');
    if (p.status !== 'AWAITING_OTP') throw new HttpError(409, 'This withdrawal can no longer be cancelled.', 'NOT_CANCELLABLE');
    const [row] = await tx.update(payouts).set({ status: 'CANCELLED', otpHash: null, otpExpiresAt: null, updatedAt: nowIso() }).where(eq(payouts.id, p.id)).returning();
    return payoutView(row);
  });
}

/** Sends a payout whose money has been taken. A definite refusal is refunded at once; an unknown outcome is checked later. */
export async function submitPayout(db: AppDb, deps: PaymentDeps, payoutId: string): Promise<PayoutRow> {
  const [p] = await db.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
  if (!p || p.status !== 'SUBMITTING') return p;
  let view: PayoutView;
  try {
    view = await deps.provider.createPayout({
      reference: p.reference,
      amount: centsFromDb(p.amount),
      channelCode: p.channelCode,
      accountNumber: p.accountNumber,
      accountName: p.accountName,
      description: `HOSCOMCO savings withdrawal ${p.reference}`,
    });
  } catch (err) {
    if (err instanceof ProviderError && err.definite) return (await refundPayout(db, payoutId, `The provider refused the payout: ${err.message}`)).row;
    const message = err instanceof Error ? err.message : String(err);
    const [row] = await db.update(payouts).set({ failureReason: `Not confirmed by the provider yet: ${message}`.slice(0, 300), updatedAt: nowIso() }).where(eq(payouts.id, payoutId)).returning();
    return row;
  }
  return (await applyPayout(db, payoutId, view)).row;
}

type PayoutOutcome = { row: PayoutRow; outcome: string };

async function refundTx(tx: AppDb, p: PayoutRow, reason: string, at: string): Promise<PayoutOutcome> {
  const actor = onlineActor(p.provider);
  const amount = centsFromDb(p.amount);
  const { account, product } = await lockSavingsAccount(tx, actor, p.accountId);
  const txn = await postOnlineMovement(tx, actor, account, product, {
    kind: 'PAYOUT_REFUND',
    amount,
    provider: p.provider,
    reference: p.reference,
    notes: `Payout ${p.reference} returned: ${reason}`.slice(0, 300),
    idempotencyKey: `online-payout-refund:${p.id}`,
  });
  const [row] = await tx
    .update(payouts)
    .set({ status: 'REFUNDED', refundTransactionId: txn.id, refundedAt: at, failureReason: reason.slice(0, 300), updatedAt: at })
    .where(eq(payouts.id, p.id))
    .returning();
  await audit(tx, actor, p, 'ONLINE_WITHDRAWAL_REFUNDED', `${p.reference}: ${formatPeso(amount)} returned to ${account.passbookNumber}. ${reason}`, 'OnlinePayout', at);
  await notify(tx, p, 'CLIENT', 'ONLINE_WITHDRAWAL_REFUNDED', 'Withdrawal could not be sent', `Your withdrawal ${p.reference} of ${formatPeso(amount)} could not be sent. The money is back in your savings.`, at, 'OnlinePayout');
  return { row, outcome: 'REFUNDED' };
}

/** Returns a payout's money to the savings account, once. */
async function refundPayout(db: AppDb, payoutId: string, reason: string): Promise<PayoutOutcome> {
  return inTransaction(db, async (tx) => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for('update').limit(1);
    if (!p) throw new HttpError(404, 'Withdrawal not found.', 'NOT_FOUND');
    if (p.status === 'REFUNDED') return { row: p, outcome: 'ALREADY_REFUNDED' };
    if (p.status === 'AWAITING_OTP' || p.status === 'CANCELLED') return { row: p, outcome: 'NOT_TAKEN' };
    return refundTx(tx, p, reason, nowIso());
  });
}

async function markPayoutReview(tx: AppDb, p: PayoutRow, reason: string, at: string): Promise<PayoutOutcome> {
  const [row] = await tx.update(payouts).set({ status: 'NEEDS_REVIEW', reviewReason: reason, updatedAt: at }).where(eq(payouts.id, p.id)).returning();
  await audit(tx, onlineActor(p.provider), p, 'ONLINE_WITHDRAWAL_REVIEW', `${p.reference}: ${reason}`, 'OnlinePayout', at);
  await notify(tx, p, 'STAFF', 'ONLINE_PAYMENT_REVIEW', 'Instant withdrawal needs review', `${p.reference}: ${reason}`, at, 'OnlinePayout');
  return { row, outcome: 'NEEDS_REVIEW' };
}

/** Applies what the provider says about a payout. Refunds at most once. */
async function applyPayout(db: AppDb, payoutId: string, view: PayoutView | null): Promise<PayoutOutcome> {
  return inTransaction(db, async (tx) => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for('update').limit(1);
    if (!p) throw new HttpError(404, 'Withdrawal not found.', 'NOT_FOUND');
    if (p.status === 'AWAITING_OTP' || p.status === 'CANCELLED') return { row: p, outcome: 'NOT_TAKEN' };
    if (!view) return { row: p, outcome: 'NOT_AT_PROVIDER' };
    const at = nowIso();
    if (view.reference !== p.reference || (p.providerRef !== null && view.providerRef !== p.providerRef) || view.amount !== centsFromDb(p.amount)) {
      if (p.status === 'REFUNDED' || p.status === 'PAID' || p.status === 'NEEDS_REVIEW') return { row: p, outcome: 'MISMATCH' };
      return markPayoutReview(tx, p, 'The provider’s record does not match this withdrawal.', at);
    }
    const ref = p.providerRef ?? view.providerRef;
    if (view.state === 'PENDING') {
      if (p.status !== 'SUBMITTING') return { row: p, outcome: p.status === 'PROCESSING' ? 'PROCESSING' : p.status };
      const [row] = await tx.update(payouts).set({ status: 'PROCESSING', providerRef: ref, failureReason: null, updatedAt: at }).where(eq(payouts.id, p.id)).returning();
      return { row, outcome: 'PROCESSING' };
    }
    if (view.state === 'SUCCEEDED') {
      if (p.status === 'PAID') return { row: p, outcome: 'ALREADY_PAID' };
      // Refunded, yet the provider says it arrived: the report shows it; staff settle it with the member.
      if (p.status === 'REFUNDED') return { row: p, outcome: 'CONFLICT_REFUNDED_BUT_PAID' };
      const [row] = await tx.update(payouts).set({ status: 'PAID', providerRef: ref, paidAt: at, failureReason: null, updatedAt: at }).where(eq(payouts.id, p.id)).returning();
      await audit(tx, onlineActor(p.provider), p, 'ONLINE_WITHDRAWAL_PAID', `${p.reference}: the provider paid ${formatPeso(centsFromDb(p.amount))}.`, 'OnlinePayout', at);
      await notify(tx, p, 'CLIENT', 'ONLINE_WITHDRAWAL_PAID', 'Withdrawal sent', `${formatPeso(centsFromDb(p.amount))} was sent to ${payoutChannel(p.channelCode)?.label ?? p.channelCode} ${maskAccountNumber(p.accountNumber)} (${p.reference}).`, at, 'OnlinePayout');
      return { row, outcome: 'PAID' };
    }
    // Failed, cancelled or reversed: the money did not reach the member.
    if (p.status === 'REFUNDED') return { row: p, outcome: 'ALREADY_REFUNDED' };
    if (!p.providerRef) await tx.update(payouts).set({ providerRef: ref }).where(eq(payouts.id, p.id));
    return refundTx(tx, { ...p, providerRef: ref }, view.failureReason ?? 'The provider could not complete the payout.', at);
  });
}

/** Asks the provider about a payout and applies the answer. */
export async function syncPayout(db: AppDb, deps: PaymentDeps, p: PayoutRow): Promise<PayoutOutcome> {
  if (p.status === 'AWAITING_OTP' || p.status === 'CANCELLED' || p.status === 'REFUNDED') return { row: p, outcome: p.status };
  const view = p.providerRef ? await deps.provider.getPayout(p.providerRef) : await deps.provider.findPayout(p.reference);
  return applyPayout(db, p.id, view);
}

/**
 * Settles what confirmations missed: unpaid deposits are checked with the
 * provider (late payments are credited, old ones expire), unconfirmed payouts
 * are checked or sent again under the same reference, and payouts still
 * unconfirmed after two hours go to staff. Runs every few minutes.
 */
export async function sweepOnlinePayments(db: AppDb, deps: PaymentDeps, now = Date.now()) {
  const result = { depositsChecked: 0, payoutsChecked: 0, sentAgain: 0, toReview: 0, errors: [] as string[] };
  const stalePending = await db
    .select()
    .from(deposits)
    .where(and(eq(deposits.provider, deps.provider.name), eq(deposits.status, 'PENDING'), isNotNull(deposits.providerRef), lt(deposits.createdAt, new Date(now - 5 * 60_000).toISOString())))
    .orderBy(asc(deposits.createdAt))
    .limit(200);
  for (const d of stalePending) {
    try {
      await syncDeposit(db, deps, d);
      result.depositsChecked += 1;
    } catch (err) {
      result.errors.push(`${d.reference}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const open = await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.provider, deps.provider.name), inArray(payouts.status, ['SUBMITTING', 'PROCESSING']), lt(payouts.updatedAt, new Date(now - 2 * 60_000).toISOString())))
    .orderBy(asc(payouts.submittedAt))
    .limit(200);
  for (const p of open) {
    try {
      let row: PayoutRow;
      if (p.status === 'SUBMITTING' && !p.providerRef) {
        const view = await deps.provider.findPayout(p.reference);
        if (view) row = (await applyPayout(db, p.id, view)).row;
        else {
          // The provider never received it: send it again under the same reference.
          row = await submitPayout(db, deps, p.id);
          result.sentAgain += 1;
        }
      } else {
        row = (await syncPayout(db, deps, p)).row;
      }
      result.payoutsChecked += 1;
      if ((row.status === 'SUBMITTING' || row.status === 'PROCESSING') && row.submittedAt && ms(row.submittedAt) < now - PAYOUT_REVIEW_AFTER_MS) {
        await inTransaction(db, async (tx) => {
          const [locked] = await tx.select().from(payouts).where(eq(payouts.id, row.id)).for('update').limit(1);
          if (locked && (locked.status === 'SUBMITTING' || locked.status === 'PROCESSING')) await markPayoutReview(tx, locked, 'The provider has not confirmed this payout for two hours.', nowIso());
        });
        result.toReview += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${p.reference}: ${message}`);
      // A provider that cannot be asked about a payout for two hours: staff take over.
      if (p.submittedAt && ms(p.submittedAt) < now - PAYOUT_REVIEW_AFTER_MS) {
        await inTransaction(db, async (tx) => {
          const [locked] = await tx.select().from(payouts).where(eq(payouts.id, p.id)).for('update').limit(1);
          if (locked && (locked.status === 'SUBMITTING' || locked.status === 'PROCESSING')) await markPayoutReview(tx, locked, `The provider could not be asked about this payout for two hours: ${message}`.slice(0, 300), nowIso());
        });
        result.toReview += 1;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Staff: needs review
// ---------------------------------------------------------------------------

const REVIEW_READ = ['process_savings_deposits', 'process_savings_withdrawals', 'view_transaction_records', 'view_all_records'];

function requireReviewRead(staff: LendingStaff) {
  if (!REVIEW_READ.some((p) => has(staff, p))) throw new HttpError(403, 'Your role cannot see online payments.', 'FORBIDDEN');
}

async function memberNames(db: AppDb, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: schema.borrowers.id, fullName: schema.borrowers.fullName }).from(schema.borrowers).where(inArray(schema.borrowers.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r.fullName]));
}

/** Problem payments and payout accounts waiting for verification, in the staff member's branch. */
export async function needsReview(db: AppDb, staff: LendingStaff) {
  requireReviewRead(staff);
  const branch = staff.viewAll ? undefined : staff.branchId ?? '__none__';
  const stuckBefore = new Date(Date.now() - 30 * 60_000).toISOString();
  const [d, p, a] = await Promise.all([
    db.select().from(deposits).where(and(eq(deposits.status, 'NEEDS_REVIEW'), branch ? eq(deposits.branchId, branch) : undefined)).orderBy(asc(deposits.updatedAt)),
    db
      .select()
      .from(payouts)
      .where(
        and(
          or(eq(payouts.status, 'NEEDS_REVIEW'), and(inArray(payouts.status, ['SUBMITTING', 'PROCESSING']), lt(payouts.submittedAt, stuckBefore))),
          branch ? eq(payouts.branchId, branch) : undefined,
        ),
      )
      .orderBy(asc(payouts.updatedAt)),
    db.select().from(payoutAccounts).where(and(eq(payoutAccounts.status, 'PENDING_VERIFICATION'), branch ? eq(payoutAccounts.branchId, branch) : undefined)).orderBy(asc(payoutAccounts.createdAt)),
  ]);
  const names = await memberNames(db, [...d.map((x) => x.memberId), ...p.map((x) => x.memberId), ...a.map((x) => x.memberId)]);
  return {
    deposits: d.map((x) => staffDepositView(x, names.get(x.memberId) ?? '')),
    payouts: p.map((x) => staffPayoutView(x, names.get(x.memberId) ?? '')),
    payoutAccounts: a.map((x) => ({ ...payoutAccountView(x, { full: true }), memberId: x.memberId, memberName: names.get(x.memberId) ?? '', branchId: x.branchId })),
  };
}

/**
 * A deposit in review. CREDIT_PAID credits what the provider confirms was paid
 * (fetched again now); DISMISS closes it with a note when the money was dealt
 * with elsewhere (for example refunded from the provider's dashboard).
 */
export async function resolveDeposit(db: AppDb, deps: PaymentDeps, staff: LendingStaff, id: string, input: { action: unknown; note: unknown }) {
  if (!has(staff, 'process_savings_deposits')) throw new HttpError(403, 'Your role cannot take savings deposits.', 'FORBIDDEN');
  const action = String(input.action ?? '').toUpperCase();
  if (action !== 'CREDIT_PAID' && action !== 'DISMISS') throw new HttpError(400, 'action must be CREDIT_PAID or DISMISS.', 'BAD_ACTION');
  const note = requireNote(input.note);
  const [first] = await db.select().from(deposits).where(eq(deposits.id, id)).limit(1);
  if (!first || !inScope(staff, first.branchId)) throw new HttpError(404, 'Deposit not found in your branch.', 'NOT_FOUND');
  if (first.status !== 'NEEDS_REVIEW') throw new HttpError(409, 'This deposit is not waiting for review.', 'NOT_IN_REVIEW');
  const view = action === 'CREDIT_PAID' ? (first.providerRef ? await deps.provider.getCheckout(first.providerRef) : null) : null;
  if (action === 'CREDIT_PAID' && (!view || view.state !== 'PAID' || view.reference !== first.reference)) {
    throw new HttpError(409, 'The provider does not show this deposit as paid, so nothing can be credited.', 'NOT_PAID');
  }
  const row = await inTransaction(db, async (tx) => {
    const [d] = await tx.select().from(deposits).where(eq(deposits.id, id)).for('update').limit(1);
    if (!d || d.status !== 'NEEDS_REVIEW') throw new HttpError(409, 'This deposit is not waiting for review.', 'NOT_IN_REVIEW');
    const at = nowIso();
    const resolved = { resolvedBy: staff.userId, resolvedByName: staff.name, resolvedAt: at, resolutionNote: note, updatedAt: at };
    if (action === 'DISMISS') {
      const [r] = await tx.update(deposits).set({ ...resolved, status: 'DISMISSED' }).where(eq(deposits.id, id)).returning();
      await audit(tx, staffAuditor(staff), d, 'ONLINE_DEPOSIT_DISMISSED', `${d.reference} closed without credit: ${note}`, 'OnlineDeposit', at);
      return r;
    }
    const paid = view!.paidAmount ?? view!.amount;
    const { account, product } = await lockSavingsAccount(tx, staff, d.accountId);
    if (account.status === 'CLOSED') throw new HttpError(409, 'The account is closed. Reopen it or dismiss this deposit after refunding the member.', 'ACCOUNT_CLOSED');
    const txn = await postOnlineMovement(tx, staff, account, product, {
      kind: 'DEPOSIT',
      amount: paid,
      provider: d.provider,
      reference: d.reference,
      notes: `Online deposit ${d.reference}, credited after review: ${note}`.slice(0, 300),
      idempotencyKey: `online-deposit:${d.id}`,
    });
    const [r] = await tx
      .update(deposits)
      .set({ ...resolved, status: 'CREDITED', savingsTransactionId: txn.id, paidAmount: pesos(paid), creditedAt: at })
      .where(eq(deposits.id, id))
      .returning();
    await audit(tx, staffAuditor(staff), d, 'ONLINE_DEPOSIT_CREDITED_AFTER_REVIEW', `${d.reference}: ${formatPeso(paid)} credited (the provider confirms it was paid). ${note}`, 'OnlineDeposit', at);
    return r;
  });
  const names = await memberNames(db, [row.memberId]);
  return staffDepositView(row, names.get(row.memberId) ?? '');
}

/**
 * A payout in review or stuck. RECHECK applies what the provider says now;
 * RETRY sends it again under the same reference when the provider never
 * received it; REFUND returns the money when the provider has no payout or
 * reports it failed. Nothing is refunded while the provider may still pay.
 */
export async function resolvePayout(db: AppDb, deps: PaymentDeps, staff: LendingStaff, id: string, input: { action: unknown; note: unknown }) {
  if (!has(staff, 'process_savings_withdrawals')) throw new HttpError(403, 'Your role cannot release savings withdrawals.', 'FORBIDDEN');
  const action = String(input.action ?? '').toUpperCase();
  if (!['RECHECK', 'RETRY', 'REFUND'].includes(action)) throw new HttpError(400, 'action must be RECHECK, RETRY or REFUND.', 'BAD_ACTION');
  const note = requireNote(input.note);
  const [p] = await db.select().from(payouts).where(eq(payouts.id, id)).limit(1);
  if (!p || !inScope(staff, p.branchId)) throw new HttpError(404, 'Withdrawal not found in your branch.', 'NOT_FOUND');
  if (!['NEEDS_REVIEW', 'SUBMITTING', 'PROCESSING'].includes(p.status)) throw new HttpError(409, 'This withdrawal is already settled.', 'ALREADY_SETTLED');
  const view = p.providerRef ? await deps.provider.getPayout(p.providerRef) : await deps.provider.findPayout(p.reference);
  let row: PayoutRow;
  if (action === 'RECHECK') {
    if (view && view.state === 'PENDING' && p.status === 'NEEDS_REVIEW') {
      [row] = await db.update(payouts).set({ status: 'PROCESSING', providerRef: p.providerRef ?? view.providerRef, updatedAt: nowIso() }).where(and(eq(payouts.id, id), eq(payouts.status, 'NEEDS_REVIEW'))).returning();
    } else {
      row = (await applyPayout(db, id, view)).row;
    }
  } else if (action === 'RETRY') {
    if (view) throw new HttpError(409, 'The provider already has this payout; recheck it instead of sending it again.', 'AT_PROVIDER');
    await db.update(payouts).set({ status: 'SUBMITTING', updatedAt: nowIso() }).where(and(eq(payouts.id, id), inArray(payouts.status, ['NEEDS_REVIEW', 'SUBMITTING'])));
    row = await submitPayout(db, deps, id);
  } else {
    if (view && view.state !== 'FAILED') throw new HttpError(409, 'The provider has this payout and may still pay it, so it cannot be refunded here.', 'AT_PROVIDER');
    row = view ? (await applyPayout(db, id, view)).row : (await refundPayout(db, id, `Refunded by staff: the provider never received the payout. ${note}`)).row;
  }
  await inTransaction(db, async (tx) => {
    await tx.update(payouts).set({ resolvedBy: staff.userId, resolvedByName: staff.name, resolvedAt: nowIso(), resolutionNote: note }).where(eq(payouts.id, id));
    await audit(tx, staffAuditor(staff), p, `ONLINE_WITHDRAWAL_${action}`, `${p.reference}: ${note} Now ${row.status}.`, 'OnlinePayout', nowIso());
  });
  const [latest] = await db.select().from(payouts).where(eq(payouts.id, id)).limit(1);
  const names = await memberNames(db, [latest.memberId]);
  return staffPayoutView(latest, names.get(latest.memberId) ?? '');
}

// ---------------------------------------------------------------------------
// Staff: daily report
// ---------------------------------------------------------------------------

export interface Mismatch {
  kind: 'deposit' | 'payout' | 'ledger';
  reference: string | null;
  code: string;
  message: string;
}

function dayWindow(date: string) {
  const from = new Date(`${date}T00:00:00+08:00`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

const sumAmount = (rows: { amount: string }[]) => rows.reduce((s, r) => s + centsFromDb(r.amount), 0);

/**
 * One day's online payments: what we credited and paid out, what the ledger
 * (1030 Due from Payment Provider) shows, and what the provider reports for
 * the same payments, with every difference listed.
 */
export async function dailyReport(db: AppDb, deps: PaymentDeps, staff: LendingStaff, dateInput: unknown) {
  requireReviewRead(staff);
  const date = typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput) ? dateInput : manilaToday();
  const { from, to } = dayWindow(date);
  const branch = staff.viewAll ? null : staff.branchId ?? '__none__';
  const mismatches: Mismatch[] = [];

  const [dayDeposits, dayPayouts] = await Promise.all([
    db
      .select()
      .from(deposits)
      .where(and(branch ? eq(deposits.branchId, branch) : undefined, or(and(gte(deposits.createdAt, from), lt(deposits.createdAt, to)), and(gte(deposits.creditedAt, from), lt(deposits.creditedAt, to)), and(gte(deposits.paidAt, from), lt(deposits.paidAt, to))))),
    db
      .select()
      .from(payouts)
      .where(and(branch ? eq(payouts.branchId, branch) : undefined, isNotNull(payouts.debitTransactionId), or(and(gte(payouts.submittedAt, from), lt(payouts.submittedAt, to)), and(gte(payouts.refundedAt, from), lt(payouts.refundedAt, to))))),
  ]);

  const inDay = (v: string | null) => v !== null && ms(v) >= ms(from) && ms(v) < ms(to);
  const credited = dayDeposits.filter((d) => d.status === 'CREDITED' && inDay(d.creditedAt));
  const taken = dayPayouts.filter((p) => inDay(p.submittedAt));
  const refunded = dayPayouts.filter((p) => p.status === 'REFUNDED' && inDay(p.refundedAt));
  const creditedCents = credited.reduce((s, d) => s + centsFromDb(d.paidAmount ?? d.amount), 0);
  const takenCents = sumAmount(taken);
  const refundedCents = sumAmount(refunded);

  // Ledger: 1030 lines dated that day (in the branch when scoped).
  const gl = await db.execute(sql`
    select coalesce(sum(l.debit), 0)::text as debits, coalesce(sum(l.credit), 0)::text as credits
      from journal_entry_lines l
      join journal_entries e on e.journal_entry_id = l.entry_id
      join accounts a on a.account_id = l.account_id
     where a.account_code = '1030' and e.entry_date = ${date}::date ${branch ? sql`and e.branch_id = ${branch}` : sql``}`);
  const glRow = ((gl as { rows?: { debits: string; credits: string }[] }).rows ?? (gl as unknown as { debits: string; credits: string }[]))[0] ?? { debits: '0', credits: '0' };
  const ledgerDebits = centsFromDb(glRow.debits);
  const ledgerCredits = centsFromDb(glRow.credits);
  if (ledgerDebits !== creditedCents + refundedCents) {
    mismatches.push({ kind: 'ledger', reference: null, code: 'LEDGER_IN', message: `The ledger shows ${formatPeso(ledgerDebits)} in on 1030; credited deposits and returned payouts total ${formatPeso(creditedCents + refundedCents)}.` });
  }
  if (ledgerCredits !== takenCents) {
    mismatches.push({ kind: 'ledger', reference: null, code: 'LEDGER_OUT', message: `The ledger shows ${formatPeso(ledgerCredits)} out on 1030; instant withdrawals total ${formatPeso(takenCents)}.` });
  }

  // Provider: each payment of the day, fetched again.
  let providerPaidCents = 0;
  let providerPayoutCents = 0;
  for (const d of dayDeposits) {
    if (!d.providerRef) continue;
    let view: CheckoutView;
    try {
      view = await deps.provider.getCheckout(d.providerRef);
    } catch (err) {
      mismatches.push({ kind: 'deposit', reference: d.reference, code: 'PROVIDER_UNREACHABLE', message: `Could not ask the provider: ${err instanceof Error ? err.message : String(err)}` });
      continue;
    }
    const paid = view.paidAmount ?? view.amount;
    if (view.state === 'PAID' && inDay(view.paidAt ?? d.paidAt)) providerPaidCents += paid;
    if (view.state === 'PAID' && d.status !== 'CREDITED' && d.status !== 'DISMISSED') {
      mismatches.push({ kind: 'deposit', reference: d.reference, code: d.status === 'NEEDS_REVIEW' ? 'PAID_IN_REVIEW' : 'PAID_NOT_CREDITED', message: `The provider received ${formatPeso(paid)}; the deposit is ${DEPOSIT_STATUS_LABELS[d.status as DepositStatus] ?? d.status}.` });
    } else if (d.status === 'CREDITED' && view.state !== 'PAID') {
      mismatches.push({ kind: 'deposit', reference: d.reference, code: 'CREDITED_NOT_PAID', message: `Credited, but the provider shows it as ${view.state.toLowerCase()}.` });
    } else if (d.status === 'CREDITED' && paid !== centsFromDb(d.paidAmount ?? d.amount)) {
      mismatches.push({ kind: 'deposit', reference: d.reference, code: 'AMOUNT_DIFFERS', message: `Credited ${formatPeso(centsFromDb(d.paidAmount ?? d.amount))}; the provider shows ${formatPeso(paid)}.` });
    }
  }
  if (!branch) {
    try {
      const known = new Set((await db.select({ ref: deposits.providerRef }).from(deposits).where(eq(deposits.provider, deps.provider.name))).map((r) => r.ref));
      for (const v of await deps.provider.listPaidCheckouts(from, to)) {
        if (!known.has(v.providerRef)) mismatches.push({ kind: 'deposit', reference: v.reference || v.providerRef, code: 'UNKNOWN_PAYMENT', message: `The provider received ${formatPeso(v.paidAmount ?? v.amount)} that matches no deposit here.` });
      }
    } catch (err) {
      mismatches.push({ kind: 'deposit', reference: null, code: 'PROVIDER_UNREACHABLE', message: `Could not list the provider's payments: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
  for (const p of dayPayouts) {
    let view: PayoutView | null;
    try {
      view = p.providerRef ? await deps.provider.getPayout(p.providerRef) : await deps.provider.findPayout(p.reference);
    } catch (err) {
      mismatches.push({ kind: 'payout', reference: p.reference, code: 'PROVIDER_UNREACHABLE', message: `Could not ask the provider: ${err instanceof Error ? err.message : String(err)}` });
      continue;
    }
    if (view?.state === 'SUCCEEDED') providerPayoutCents += view.amount;
    if (!view && p.status !== 'REFUNDED') mismatches.push({ kind: 'payout', reference: p.reference, code: 'MISSING_AT_PROVIDER', message: `Taken from savings (${PAYOUT_STATUS_LABELS[p.status as PayoutStatus] ?? p.status}), but the provider has no such payout.` });
    else if (view?.state === 'SUCCEEDED' && p.status === 'REFUNDED') mismatches.push({ kind: 'payout', reference: p.reference, code: 'REFUNDED_BUT_PAID', message: 'Returned to savings, but the provider says it was paid.' });
    else if (view?.state === 'FAILED' && p.status !== 'REFUNDED') mismatches.push({ kind: 'payout', reference: p.reference, code: 'FAILED_NOT_REFUNDED', message: 'The provider says it failed; the money has not been returned yet.' });
    else if (view && view.amount !== centsFromDb(p.amount)) mismatches.push({ kind: 'payout', reference: p.reference, code: 'AMOUNT_DIFFERS', message: `Taken ${formatPeso(centsFromDb(p.amount))}; the provider shows ${formatPeso(view.amount)}.` });
  }
  const paidOut = taken.filter((p) => p.status === 'PAID');
  const paidOutCents = sumAmount(paidOut);
  if (providerPaidCents !== creditedCents && !mismatches.some((m) => m.kind === 'deposit')) {
    mismatches.push({ kind: 'deposit', reference: null, code: 'TOTAL_DIFFERS', message: `The provider received ${formatPeso(providerPaidCents)} for these deposits; ${formatPeso(creditedCents)} was credited.` });
  }

  return {
    date,
    branchId: branch,
    provider: deps.provider.name,
    ours: {
      depositsCredited: { count: credited.length, amount: pesos(creditedCents) },
      withdrawalsTaken: { count: taken.length, amount: pesos(takenCents) },
      withdrawalsPaid: { count: paidOut.length, amount: pesos(paidOutCents) },
      withdrawalsReturned: { count: refunded.length, amount: pesos(refundedCents) },
    },
    ledger: { account: '1030', moneyIn: pesos(ledgerDebits), moneyOut: pesos(ledgerCredits) },
    providerTotals: { depositsReceived: pesos(providerPaidCents), payoutsPaid: pesos(providerPayoutCents) },
    mismatches,
    ok: mismatches.length === 0,
  };
}
