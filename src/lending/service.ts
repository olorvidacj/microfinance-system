import crypto from 'crypto';
import { and, asc, desc, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  LOAN_PURPOSE_LABELS,
  OPEN_LOAN_STATUSES,
  RUNNING_LOAN_STATUSES,
  DISBURSEMENT_METHOD_LABELS,
  FREQUENCY_LABELS,
  INTEREST_METHOD_LABELS,
  LoanTransitionError,
  QuoteError,
  assertLoanTransition,
  assessEligibility,
  centsFromDb,
  centsToDecimal,
  cleanReason,
  disbursementJournal,
  formatPeso,
  isBalanced,
  isInterestMethod,
  isRepaymentFrequency,
  normaliseLoanStatus,
  ppmFromDb,
  ppmToPercent,
  quoteLoan,
  quoteProduct,
  validateApplicationTerms,
  validateLoanTerms,
  validateDisbursement,
  validateProduct,
  withinApprovalLimit,
  type Cents,
  type DisbursementInput,
  type DisbursementMethod,
  type FeeCharge,
  type FeeRule,
  type LoanActorKind,
  type LoanProduct,
  type LoanQuote,
  type LoanStatus,
  type ProductDto,
  type ReceiptDocument,
} from '../../shared/lending';
import { isKycVerified, kycGateMessage, normaliseKycStatus } from '../../shared/kyc-core';
import { HttpError, translateDbError, type AppDb } from '../kyc/errors';
import { manilaToday, type StaffActor } from '../kyc/service';
import { normalizeRole } from '../auth/permissions';
import { loans as loanTable, products as productTable, register, type LoanRow, type ProductRow } from './tables';
import type { ClientLoansView, InstallmentDisplayStatus, LoanDetailView, LoanSummaryView, ScheduleRowView } from '../../shared/client';

// The member-facing loan views are defined once in shared/client (web, mobile and server).
export type { ClientLoansView, InstallmentDisplayStatus, LoanDetailView, LoanSummaryView, ScheduleRowView };

import { assertGroupLoanAllowed, groupBlock, membershipOf } from '../groups/rules';

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

export interface LendingClient {
  kind: 'client';
  userId: string;
  name: string;
  borrowerId: string;
}

export interface LendingStaff extends StaffActor {
  permissions: readonly string[];
}

export type LendingActor = LendingClient | LendingStaff;

export const has = (actor: LendingStaff, p: string) => actor.permissions.includes(p);

function staffKinds(actor: LendingStaff): LoanActorKind[] {
  const kinds: LoanActorKind[] = [];
  if (has(actor, 'process_loan_applications')) kinds.push('APPLICANT');
  if (has(actor, 'manage_loan_applications')) kinds.push('REVIEWER', 'APPROVER');
  if (has(actor, 'disburse_loans')) kinds.push('DISBURSER');
  if (has(actor, 'approve_sensitive_operations')) kinds.push('WRITE_OFF', 'REVERSER');
  return kinds;
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const nowIso = () => new Date().toISOString();
/** A timestamp just after `at`, so two steps recorded together keep their order. */
export const justAfter = (at: string) => new Date(Date.parse(at) + 1).toISOString();

// ---------------------------------------------------------------------------
// Transactions and errors
// ---------------------------------------------------------------------------

export async function inTransaction<T>(db: AppDb, fn: (tx: AppDb) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(async (tx) => fn(tx as unknown as AppDb));
  } catch (err) {
    if (err instanceof LoanTransitionError) throw new HttpError(409, err.message, 'BAD_TRANSITION', { from: err.from, to: err.to });
    if (err instanceof QuoteError) throw new HttpError(400, err.message, 'INVALID_TERMS', { field: err.field });
    translateDbError(err);
  }
}

export function rowsOf<T>(result: unknown): T[] {
  const r = result as { rows?: T[] };
  return Array.isArray(r?.rows) ? r.rows : (result as T[]);
}

export async function nextSequence(tx: AppDb, name:
    | 'loan_number_seq'
    | 'loan_receipt_seq'
    | 'payment_receipt_seq'
    | 'payment_reversal_seq'
    | 'savings_txn_seq'
    | 'savings_account_seq'
    | 'group_code_seq'
    | 'group_fund_txn_seq'
    | 'group_cover_seq'
    | 'group_collection_seq',
): Promise<number> {
  const rows = rowsOf<{ n: string | number }>(await tx.execute(sql.raw(`select nextval('${name}') as n`)));
  return Number(rows[0].n);
}

export function transition(from: LoanStatus, to: LoanStatus, actor: LendingActor): void {
  if (actor.kind === 'client') {
    assertLoanTransition(from, to, 'APPLICANT');
    return;
  }
  const kinds = staffKinds(actor);
  const allowed = kinds.find((k) => {
    try {
      assertLoanTransition(from, to, k);
      return true;
    } catch {
      return false;
    }
  });
  if (!allowed) assertLoanTransition(from, to, kinds[0] ?? 'APPLICANT');
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function feeRulesFromDb(raw: unknown): FeeRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((f: any) => ({
    code: String(f.code),
    label: String(f.label),
    kind: f.kind === 'FIXED' ? 'FIXED' : 'PERCENT',
    value: f.kind === 'FIXED' ? centsFromDb(f.value) : ppmFromDb(f.value),
  }));
}

function feeRulesToDb(rules: readonly FeeRule[]) {
  return rules.map((f) => ({ code: f.code, label: f.label, kind: f.kind, value: f.kind === 'FIXED' ? centsToDecimal(f.value) : ppmToPercent(f.value) }));
}

export function productFromRow(row: ProductRow): LoanProduct {
  if (!isInterestMethod(row.interestType) || !isRepaymentFrequency(row.repaymentFrequency)) {
    throw new HttpError(500, `Loan product ${row.code} has invalid terms.`, 'BAD_PRODUCT');
  }
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description ?? '',
    interestMethod: row.interestType,
    annualRate: ppmFromDb(row.interestRate),
    minAmount: centsFromDb(row.minAmount),
    maxAmount: centsFromDb(row.maxAmount),
    minTermMonths: row.minTermMonths,
    maxTermMonths: row.maxTermMonths,
    frequency: row.repaymentFrequency,
    fees: feeRulesFromDb(row.fees),
    penaltyRate: ppmFromDb(row.latePenaltyRate),
    lendingType: row.lendingType === 'GROUP' ? 'GROUP' : 'INDIVIDUAL',
    requiresCollateral: row.requiresCollateral === true,
    requiresGuarantor: row.requiresGuarantor === true,
    status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  };
}

export async function listProducts(db: AppDb, options: { includeInactive?: boolean } = {}): Promise<LoanProduct[]> {
  const rows = await db
    .select()
    .from(productTable)
    .where(options.includeInactive ? undefined : eq(productTable.status, 'ACTIVE'))
    .orderBy(asc(productTable.name));
  return rows.map(productFromRow);
}

async function loadProduct(tx: AppDb, id: string): Promise<LoanProduct | null> {
  const rows = await tx.select().from(productTable).where(eq(productTable.id, id)).limit(1);
  return rows[0] ? productFromRow(rows[0]) : null;
}

export function productRowValues(p: Omit<LoanProduct, 'id'>) {
  return {
    code: p.code,
    name: p.name,
    category: p.category,
    description: p.description || null,
    interestType: p.interestMethod,
    interestRate: ppmToPercent(p.annualRate),
    minAmount: centsToDecimal(p.minAmount),
    maxAmount: centsToDecimal(p.maxAmount),
    minTermMonths: p.minTermMonths,
    maxTermMonths: p.maxTermMonths,
    repaymentFrequency: p.frequency,
    fees: feeRulesToDb(p.fees),
    latePenaltyRate: ppmToPercent(p.penaltyRate),
    lendingType: p.lendingType,
    requiresCollateral: p.requiresCollateral,
    requiresGuarantor: p.requiresGuarantor,
    status: p.status,
    updatedAt: nowIso(),
  };
}

export async function saveProduct(db: AppDb, actor: LendingStaff, id: string | null, dto: Partial<ProductDto>): Promise<LoanProduct> {
  const v = validateProduct(dto);
  if (!v.ok || !v.value) throw new HttpError(400, 'Check the highlighted product fields.', 'INVALID_PRODUCT', { fields: v.errors });
  const value = v.value;
  return inTransaction(db, async (tx) => {
    let productId = id;
    if (id) {
      const updated = await tx.update(productTable).set(productRowValues(value)).where(eq(productTable.id, id)).returning({ id: productTable.id });
      if (!updated[0]) throw new HttpError(404, 'Loan product not found.', 'NOT_FOUND');
    } else {
      productId = newId('lp');
      await tx.insert(productTable).values({ id: productId, ...productRowValues(value) });
    }
    await tx.insert(schema.auditLogs).values({
      id: newId('aud'),
      timestamp: nowIso(),
      action: id ? 'LOAN_PRODUCT_UPDATED' : 'LOAN_PRODUCT_CREATED',
      details: `${value.code} ${value.name}: ${INTEREST_METHOD_LABELS[value.interestMethod]} ${ppmToPercent(value.annualRate)}% a year, ${formatPeso(value.minAmount)}-${formatPeso(value.maxAmount)}, ${value.minTermMonths}-${value.maxTermMonths} months, ${FREQUENCY_LABELS[value.frequency]}, ${value.status}.`,
      performedBy: actor.userId,
      branchId: actor.branchId ?? 'all',
      type: 'SYSTEM',
      userName: actor.name,
      userRole: actor.role,
      targetType: 'LoanProduct',
      targetId: productId,
    });
    const saved = await loadProduct(tx, productId as string);
    return saved as LoanProduct;
  });
}

export const quoteFor = quoteProduct;

// ---------------------------------------------------------------------------
// Loading and scope
// ---------------------------------------------------------------------------

type Borrower = typeof schema.borrowers.$inferSelect;

export async function loadBorrowerForUpdate(tx: AppDb, borrowerId: string): Promise<Borrower> {
  const rows = await tx.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).for('update').limit(1);
  if (!rows[0]) throw new HttpError(404, 'Member not found.', 'NOT_FOUND');
  return rows[0];
}

function assertBorrowerInScope(actor: LendingActor, borrower: Borrower): void {
  if (actor.kind === 'client') {
    if (borrower.id !== actor.borrowerId) throw new HttpError(404, 'Member not found.', 'NOT_FOUND');
    return;
  }
  if (actor.viewAll) return;
  if (!actor.branchId || borrower.branchId !== actor.branchId) throw new HttpError(404, 'Member not found in your branch.', 'NOT_FOUND');
}

export function assertLoanInScope(actor: LendingActor, loan: LoanRow): void {
  if (actor.kind === 'client') {
    if (loan.borrowerId !== actor.borrowerId) throw new HttpError(404, 'Loan not found.', 'NOT_FOUND');
    return;
  }
  if (actor.viewAll) return;
  if (!actor.branchId || loan.branchId !== actor.branchId) throw new HttpError(404, 'Loan not found in your branch.', 'NOT_FOUND');
}

export async function lockLoan(tx: AppDb, actor: LendingActor, loanId: string): Promise<LoanRow> {
  const rows = await tx.select().from(loanTable).where(eq(loanTable.id, loanId)).for('update').limit(1);
  if (!rows[0]) throw new HttpError(404, 'Loan not found.', 'NOT_FOUND');
  assertLoanInScope(actor, rows[0]);
  return rows[0];
}

export function statusOf(loan: LoanRow): LoanStatus {
  const s = normaliseLoanStatus(loan.status);
  if (!s) throw new HttpError(500, `Loan ${loan.loanNumber} has an unknown status.`, 'BAD_STATUS');
  return s;
}

// ---------------------------------------------------------------------------
// Audit, history, notifications
// ---------------------------------------------------------------------------

function actorFields(actor: LendingActor | 'SYSTEM') {
  if (actor === 'SYSTEM') return { actorType: 'SYSTEM', actorId: null, actorName: 'System', actorRole: null };
  if (actor.kind === 'client') return { actorType: 'CLIENT', actorId: actor.userId, actorName: actor.name, actorRole: 'CLIENT' };
  return { actorType: 'STAFF', actorId: actor.userId, actorName: actor.name, actorRole: actor.role };
}

export async function recordTransition(tx: AppDb, loan: LoanRow, from: LoanStatus | null, to: LoanStatus, actor: LendingActor | 'SYSTEM', reason: string | null, at: string) {
  await tx.insert(schema.loanStatusHistory).values({ id: newId('lsh'), loanId: loan.id, fromStatus: from, toStatus: to, reason, createdAt: at, ...actorFields(actor) });
}

export async function audit(tx: AppDb, loan: Pick<LoanRow, 'id' | 'branchId'>, actor: LendingActor, action: string, details: string, at: string) {
  const f = actorFields(actor);
  await tx.insert(schema.auditLogs).values({
    id: newId('aud'),
    timestamp: at,
    action,
    details,
    performedBy: actor.userId,
    branchId: loan.branchId,
    type: 'LOAN',
    userName: f.actorName,
    userRole: f.actorRole,
    targetType: 'Loan',
    targetId: loan.id,
  });
}

export async function notify(
  tx: AppDb,
  loan: Pick<LoanRow, 'id' | 'branchId' | 'borrowerId'>,
  audience: 'CLIENT' | 'STAFF',
  type: string,
  title: string,
  message: string,
  at: string,
) {
  await tx.insert(schema.branchNotifications).values({
    id: newId('ntf'),
    branchId: loan.branchId,
    audience,
    borrowerId: audience === 'CLIENT' ? loan.borrowerId : null,
    type,
    title,
    message,
    relatedType: 'Loan',
    relatedId: loan.id,
    isRead: false,
    createdAt: at,
  });
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export interface ApplicationInput {
  borrowerId?: unknown;
  productId: unknown;
  amount: unknown;
  termMonths: unknown;
  purpose: unknown;
  purposeDetails?: unknown;
  collateral?: unknown;
  guarantors?: unknown;
  /** false saves a draft. */
  submit?: unknown;
  requestKey?: unknown;
}

function cleanCollateral(v: unknown): { description: string; estimatedValue: string | null } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const description = typeof o.description === 'string' ? o.description.trim().slice(0, 500) : '';
  if (!description) return null;
  const value = o.estimatedValue === undefined || o.estimatedValue === '' ? null : centsFromInput(o.estimatedValue);
  return { description, estimatedValue: value === null ? null : centsToDecimal(value) };
}

function centsFromInput(v: unknown): Cents | null {
  const s = typeof v === 'number' ? String(v) : String(v ?? '').trim().replace(/,/g, '');
  return /^\d{1,12}(\.\d{1,2})?$/.test(s) ? centsFromDb(s) : null;
}

function cleanGuarantors(v: unknown): { name: string; phone: string; relationship: string }[] | null {
  if (!Array.isArray(v)) return null;
  const list = v
    .slice(0, 3)
    .map((g: any) => ({
      name: typeof g?.name === 'string' ? g.name.trim().slice(0, 120) : '',
      phone: typeof g?.phone === 'string' ? g.phone.trim().slice(0, 30) : '',
      relationship: typeof g?.relationship === 'string' ? g.relationship.trim().slice(0, 60) : '',
    }))
    .filter((g) => g.name);
  return list.length ? list : null;
}

function purposeText(purpose: keyof typeof LOAN_PURPOSE_LABELS, details: Record<string, string>): string {
  const extra = Object.entries(details).map(([k, v]) => `${k}: ${v}`).join('; ');
  return extra ? `${LOAN_PURPOSE_LABELS[purpose]} - ${extra}` : LOAN_PURPOSE_LABELS[purpose];
}

async function eligibilityIssues(tx: AppDb, borrower: Borrower, product: LoanProduct, excludeLoanId: string | null) {
  const others = await tx
    .select({ id: loanTable.id, loanNumber: loanTable.loanNumber, productId: loanTable.productId, status: loanTable.status })
    .from(loanTable)
    .where(eq(loanTable.borrowerId, borrower.id));
  const otherLoans = others
    .filter((l) => l.id !== excludeLoanId)
    .map((l) => ({ loanNumber: l.loanNumber, productId: l.productId, status: normaliseLoanStatus(l.status) ?? 'Active' }));

  const running = others.filter((l) => RUNNING_LOAN_STATUSES.includes(normaliseLoanStatus(l.status) as LoanStatus)).map((l) => l.id);
  let overdueLoanNumbers: string[] = [];
  if (running.length) {
    const overdue = await tx
      .selectDistinct({ loanId: schema.loanSchedule.loanId })
      .from(schema.loanSchedule)
      .where(and(inArray(schema.loanSchedule.loanId, running), lt(schema.loanSchedule.dueDate, manilaToday()), ne(schema.loanSchedule.status, 'PAID')));
    const ids = new Set(overdue.map((o) => o.loanId));
    overdueLoanNumbers = others.filter((l) => ids.has(l.id)).map((l) => l.loanNumber);
  }

  let inActiveGroup = false;
  let groupBlockReasons: string[] = [];
  if (product.lendingType === 'GROUP') {
    const membership = await membershipOf(tx, borrower.id);
    inActiveGroup = !!membership && membership.group.status === 'ACTIVE' && membership.group.branchId === borrower.branchId;
    if (inActiveGroup && membership) groupBlockReasons = (await groupBlock(tx, membership.group, manilaToday())).reasons;
  }

  return assessEligibility({ kycVerified: isKycVerified(borrower.kycStatus), product, otherLoans, overdueLoanNumbers, inActiveGroup, groupBlockReasons });
}

function refuseIfIneligible(issues: ReturnType<typeof assessEligibility>, borrower: Borrower) {
  if (!issues.length) return;
  const kyc = issues.find((i) => i.code === 'KYC_REQUIRED');
  if (kyc) throw new HttpError(403, kycGateMessage(borrower.kycStatus), 'KYC_REQUIRED', { kycStatus: normaliseKycStatus(borrower.kycStatus), issues });
  throw new HttpError(409, issues.map((i) => i.message).join(' '), issues[0].code, { issues });
}

function figuresFromQuote(q: LoanQuote, fees: readonly FeeCharge[]) {
  return {
    principalAmount: centsToDecimal(q.principal),
    termMonths: q.termMonths,
    totalInstallments: q.installments,
    totalInterest: centsToDecimal(q.totalInterest),
    totalPayable: centsToDecimal(q.totalPayable),
    remainingBalance: centsToDecimal(q.totalPayable),
    totalPaid: '0.00',
    installmentAmount: centsToDecimal(q.installmentAmount),
    processingFee: centsToDecimal(fees.reduce((s, f) => s + f.amount, 0)),
    fees: fees.map((f) => ({ code: f.code, label: f.label, amount: centsToDecimal(f.amount) })),
    netProceeds: centsToDecimal(q.principal - fees.reduce((s, f) => s + f.amount, 0)),
    maturityDate: q.maturityDate,
  };
}

export async function createApplication(db: AppDb, actor: LendingActor, input: ApplicationInput, documents: StoredLoanDocument[] = []) {
  const requestKey = typeof input.requestKey === 'string' && input.requestKey.trim() ? input.requestKey.trim().slice(0, 100) : null;
  const borrowerId = actor.kind === 'client' ? actor.borrowerId : String(input.borrowerId ?? '').trim();
  if (!borrowerId) throw new HttpError(400, 'Choose the member applying for the loan.', 'BORROWER_REQUIRED');
  if (actor.kind === 'staff' && !has(actor, 'process_loan_applications')) throw new HttpError(403, 'Your role cannot file loan applications.', 'FORBIDDEN');
  const submit = input.submit !== false;
  const at = nowIso();
  const today = manilaToday();

  const result = await inTransaction(db, async (tx) => {
    const borrower = await loadBorrowerForUpdate(tx, borrowerId);
    assertBorrowerInScope(actor, borrower);

    if (requestKey) {
      const existing = await tx.select().from(loanTable).where(eq(loanTable.requestKey, requestKey)).limit(1);
      if (existing[0]) {
        if (existing[0].borrowerId !== borrower.id) throw new HttpError(409, 'This request key was already used.', 'KEY_REUSED');
        return { loan: existing[0], replayed: true };
      }
    }

    const product = await loadProduct(tx, String(input.productId ?? ''));
    const terms = validateApplicationTerms(product, input);
    if (!terms.ok || !terms.value || !product) throw new HttpError(400, 'Check the highlighted application fields.', 'INVALID_APPLICATION', { fields: terms.errors });
    refuseIfIneligible(await eligibilityIssues(tx, borrower, product, null), borrower);

    const quote = quoteFor(product, terms.value.principal, terms.value.termMonths, today);
    // One loan per member under the group: the loan records the group it was taken under.
    const groupId = product.lendingType === 'GROUP' ? (await membershipOf(tx, borrower.id))?.group.id ?? null : null;
    const seq = await nextSequence(tx, 'loan_number_seq');
    const loanNumber = `LN-${today.slice(0, 4)}-${String(seq).padStart(6, '0')}`;
    const officer = actor.kind === 'staff' ? { id: actor.staffId ?? actor.userId, name: actor.name } : null;
    const status: LoanStatus = submit ? 'Submitted' : 'Draft';

    const [loan] = await tx
      .insert(loanTable)
      .values({
        id: newId('loan'),
        loanNumber,
        borrowerId: borrower.id,
        borrowerName: borrower.fullName,
        borrowerPhone: borrower.phone,
        borrowerAvatar: borrower.avatar ?? null,
        branchId: borrower.branchId,
        productId: product.id,
        productName: product.name,
        interestRate: ppmToPercent(product.annualRate),
        interestType: product.interestMethod,
        repaymentFrequency: product.frequency,
        penaltyRate: ppmToPercent(product.penaltyRate),
        lendingType: product.lendingType,
        groupId,
        ...figuresFromQuote(quote, quote.fees),
        status,
        coopStep: status.toUpperCase().replace(/ /g, '_'),
        applicationDate: today,
        loanOfficerId: officer?.id ?? null,
        loanOfficerName: officer?.name ?? null,
        purpose: purposeText(terms.value.purpose, terms.value.purposeDetails),
        collateral: cleanCollateral(input.collateral),
        guarantors: cleanGuarantors(input.guarantors),
        applicationChannel: actor.kind === 'client' ? 'PORTAL' : 'BRANCH',
        requestKey,
        createdBy: actor.userId,
        submittedAt: submit ? at : null,
        createdAt: at,
        updatedAt: at,
      })
      .returning();

    await recordTransition(tx, loan, null, 'Draft', actor, null, at);
    if (submit) await recordTransition(tx, loan, 'Draft', 'Submitted', actor, null, justAfter(at));

    for (const doc of documents) {
      await tx.insert(schema.documents).values({
        id: newId('doc'),
        docNumber: `DOC-${loanNumber}-${doc.docType}`,
        branchId: borrower.branchId,
        clientId: borrower.id,
        clientName: borrower.fullName,
        loanId: loan.id,
        loanNumber,
        docName: doc.docName,
        docType: doc.docType,
        fileUrl: null,
        storagePath: doc.ref.path,
        fileName: doc.fileName,
        uploadedBy: actor.name,
        status: 'Active',
        notes: `Submitted with loan application ${loanNumber}`,
        createdAt: at,
      });
    }

    const amount = formatPeso(quote.principal);
    await audit(tx, loan, actor, submit ? 'LOAN_APPLICATION_SUBMITTED' : 'LOAN_APPLICATION_DRAFTED', `${loanNumber} for ${borrower.fullName}: ${product.name}, ${amount}, ${quote.termMonths} months (${actor.kind === 'client' ? 'portal' : 'branch'}).`, at);
    if (submit) {
      await notify(tx, loan, 'STAFF', 'LOAN_APPLICATION', 'New loan application', `${borrower.fullName} applied for ${product.name} (${amount}), ${loanNumber}.`, at);
    }
    if (actor.kind === 'staff') {
      await notify(tx, loan, 'CLIENT', submit ? 'LOAN_APPLICATION' : 'LOAN_DRAFT', submit ? 'Loan application filed' : 'Loan application drafted', `${actor.name} ${submit ? 'filed' : 'started'} a ${product.name} application for ${amount} on your behalf (${loanNumber}).`, at);
    }
    return { loan, replayed: false };
  });
  return { replayed: result.replayed, loan: await loanDetail(db, actor, result.loan.id) };
}

export interface StoredLoanDocument {
  docType: string;
  docName: string;
  fileName: string;
  ref: { backend: string; path: string };
}

/** Draft -> Submitted, re-checking the terms against the product as it is now. */
export async function submitApplication(db: AppDb, actor: LendingActor, loanId: string, changes: Partial<ApplicationInput> = {}) {
  const at = nowIso();
  const today = manilaToday();
  await inTransaction(db, async (tx) => {
    const loan = await lockLoan(tx, actor, loanId);
    const from = statusOf(loan);
    transition(from, 'Submitted', actor);
    const borrower = await loadBorrowerForUpdate(tx, loan.borrowerId);
    const product = await loadProduct(tx, loan.productId);
    if (!product || product.status !== 'ACTIVE') throw new HttpError(409, 'This loan product is no longer offered. Cancel this application and apply for another product.', 'PRODUCT_INACTIVE');
    let purpose = loan.purpose;
    let principal: Cents;
    let termMonths: number;
    if (changes.purpose !== undefined) {
      const full = validateApplicationTerms(product, {
        amount: changes.amount ?? loan.principalAmount,
        termMonths: changes.termMonths ?? loan.termMonths,
        purpose: changes.purpose,
        purposeDetails: changes.purposeDetails,
      });
      if (!full.ok || !full.value) throw new HttpError(400, 'Check the highlighted application fields.', 'INVALID_APPLICATION', { fields: full.errors });
      ({ principal, termMonths } = full.value);
      purpose = purposeText(full.value.purpose, full.value.purposeDetails);
    } else {
      const terms = validateLoanTerms(product, changes.amount ?? loan.principalAmount, changes.termMonths ?? loan.termMonths);
      if (!terms.ok || !terms.value) throw new HttpError(400, 'Check the highlighted application fields.', 'INVALID_APPLICATION', { fields: terms.errors });
      ({ principal, termMonths } = terms.value);
    }
    refuseIfIneligible(await eligibilityIssues(tx, borrower, product, loan.id), borrower);
    const quote = quoteFor(product, principal, termMonths, today);
    await tx
      .update(loanTable)
      .set({
        ...figuresFromQuote(quote, quote.fees),
        interestRate: ppmToPercent(product.annualRate),
        interestType: product.interestMethod,
        repaymentFrequency: product.frequency,
        penaltyRate: ppmToPercent(product.penaltyRate),
        purpose,
        groupId: product.lendingType === 'GROUP' ? (await membershipOf(tx, borrower.id))?.group.id ?? null : null,
        status: 'Submitted',
        coopStep: 'SUBMITTED',
        submittedAt: at,
        returnedReason: null,
        updatedAt: at,
      })
      .where(eq(loanTable.id, loan.id));
    await recordTransition(tx, loan, from, 'Submitted', actor, null, at);
    await audit(tx, loan, actor, 'LOAN_APPLICATION_SUBMITTED', `${loan.loanNumber} submitted for review (${formatPeso(quote.principal)}, ${quote.termMonths} months).`, at);
    await notify(tx, loan, 'STAFF', 'LOAN_APPLICATION', 'Loan application submitted', `${loan.borrowerName} submitted ${loan.loanNumber} for review.`, at);
  });
  return loanDetail(db, actor, loanId);
}

/** Submitted -> Under Review: the reviewer takes the application. */
export async function startReview(db: AppDb, actor: LendingStaff, loanId: string) {
  const at = nowIso();
  await inTransaction(db, async (tx) => {
    const loan = await lockLoan(tx, actor, loanId);
    await beginReview(tx, actor, loan, at);
  });
  return loanDetail(db, actor, loanId);
}

async function beginReview(tx: AppDb, actor: LendingStaff, loan: LoanRow, at: string): Promise<LoanRow> {
  const from = statusOf(loan);
  transition(from, 'Under Review', actor);
  const [updated] = await tx
    .update(loanTable)
    .set({
      status: 'Under Review',
      coopStep: 'UNDER_REVIEW',
      reviewedBy: actor.userId,
      reviewedByName: actor.name,
      reviewStartedAt: at,
      loanOfficerId: loan.loanOfficerId ?? actor.staffId ?? actor.userId,
      loanOfficerName: loan.loanOfficerName ?? actor.name,
      updatedAt: at,
    })
    .where(eq(loanTable.id, loan.id))
    .returning();
  await recordTransition(tx, loan, from, 'Under Review', actor, null, at);
  await audit(tx, loan, actor, 'LOAN_REVIEW_STARTED', `${actor.name} started reviewing ${loan.loanNumber}.`, at);
  await notify(tx, loan, 'CLIENT', 'LOAN_UNDER_REVIEW', 'Loan application under review', `Your application ${loan.loanNumber} is now being reviewed by ${actor.name}.`, at);
  return updated;
}

export interface DecisionInput {
  decision: unknown;
  reason: unknown;
  approvedAmount?: unknown;
  approvedTermMonths?: unknown;
}

async function approvalLimitFor(tx: AppDb, role: string): Promise<Cents | null | undefined> {
  const rows = await tx.select().from(schema.loanApprovalLimits).where(eq(schema.loanApprovalLimits.role, normalizeRole(role))).limit(1);
  if (!rows[0]) return undefined;
  return rows[0].maxAmount === null ? null : centsFromDb(rows[0].maxAmount);
}

/**
 * Approve, reject, or return an application for corrections. A submitted
 * application is taken into review first. Approval needs a role limit that
 * covers the approved amount, and the approver may not be the person who
 * filed the application.
 */
export async function decideApplication(db: AppDb, actor: LendingStaff, loanId: string, input: DecisionInput) {
  const decision = String(input.decision ?? '').toUpperCase();
  if (!['APPROVE', 'REJECT', 'RETURN'].includes(decision)) throw new HttpError(400, 'decision must be APPROVE, REJECT or RETURN.', 'BAD_DECISION');
  const reason = cleanReason(input.reason);
  if (!reason) throw new HttpError(400, 'Give a reason (3 to 1000 characters); the member will see it.', 'REASON_REQUIRED');
  const target: LoanStatus = decision === 'APPROVE' ? 'Approved' : decision === 'REJECT' ? 'Rejected' : 'Draft';
  const reviewAt = new Date();
  const at = new Date(reviewAt.getTime() + 1).toISOString();
  const today = manilaToday();

  const replayed = await inTransaction(db, async (tx) => {
    let loan = await lockLoan(tx, actor, loanId);
    let from = statusOf(loan);
    // A repeated click finds its own decision already recorded.
    if (from === target && (target === 'Draft' ? loan.returnedReason === reason : loan.decidedBy === actor.userId)) return true;
    if (from === 'Submitted' && target !== 'Draft') {
      loan = await beginReview(tx, actor, loan, reviewAt.toISOString());
      from = 'Under Review';
    }
    transition(from, target, actor);

    if (target === 'Draft') {
      await tx.update(loanTable).set({ status: 'Draft', coopStep: 'RETURNED', returnedReason: reason, updatedAt: at }).where(eq(loanTable.id, loan.id));
      await recordTransition(tx, loan, from, 'Draft', actor, reason, at);
      await audit(tx, loan, actor, 'LOAN_APPLICATION_RETURNED', `${loan.loanNumber} returned for corrections. Reason: ${reason}`, at);
      await notify(tx, loan, 'CLIENT', 'LOAN_CORRECTION', 'Loan application needs changes', `Your application ${loan.loanNumber} was returned for changes: ${reason}`, at);
      return false;
    }

    if (target === 'Rejected') {
      await tx
        .update(loanTable)
        .set({ status: 'Rejected', coopStep: 'REJECTED', decisionReason: reason, decidedBy: actor.userId, decidedByName: actor.name, decidedAt: at, updatedAt: at })
        .where(eq(loanTable.id, loan.id));
      await recordTransition(tx, loan, from, 'Rejected', actor, reason, at);
      await audit(tx, loan, actor, 'LOAN_REJECTED', `${loan.loanNumber} for ${loan.borrowerName} rejected. Reason: ${reason}`, at);
      await notify(tx, loan, 'CLIENT', 'LOAN_REJECTED', 'Loan application declined', `Your application ${loan.loanNumber} was declined. Reason: ${reason}`, at);
      return false;
    }

    if (loan.createdBy === actor.userId) {
      throw new HttpError(403, 'You filed this application, so another authorised officer must approve it.', 'SAME_APPROVER');
    }
    if (loan.lendingType === 'GROUP') await assertGroupLoanAllowed(tx, loan, today, 'approve');
    const product = await loadProduct(tx, loan.productId);
    if (!product) throw new HttpError(409, 'The loan product no longer exists.', 'PRODUCT_MISSING');
    if (!isInterestMethod(loan.interestType) || !isRepaymentFrequency(loan.repaymentFrequency)) throw new HttpError(500, `${loan.loanNumber} has invalid terms.`, 'BAD_TERMS');
    const terms = validateLoanTerms(
      product,
      input.approvedAmount === undefined || input.approvedAmount === '' || input.approvedAmount === null ? loan.principalAmount : input.approvedAmount,
      input.approvedTermMonths === undefined || input.approvedTermMonths === '' || input.approvedTermMonths === null ? loan.termMonths : input.approvedTermMonths,
    );
    if (!terms.ok || !terms.value) throw new HttpError(400, 'The approved terms are outside the product limits.', 'INVALID_TERMS', { fields: terms.errors });
    const requested = centsFromDb(loan.principalAmount);
    if (terms.value.principal > requested) throw new HttpError(400, 'You cannot approve more than the member applied for.', 'ABOVE_REQUEST');

    const limit = await approvalLimitFor(tx, actor.role);
    if (!withinApprovalLimit(limit, terms.value.principal)) {
      throw new HttpError(
        403,
        limit === undefined
          ? `Your role (${actor.role}) has no loan approval authority.`
          : `This approval (${formatPeso(terms.value.principal)}) is above your limit of ${formatPeso(limit as number)}. Refer it to an officer with a higher limit.`,
        'APPROVAL_LIMIT',
        { limit: limit === undefined || limit === null ? limit ?? null : centsToDecimal(limit) },
      );
    }

    // The rate and method are the ones applied for; fees are fixed now from the
    // product's fee rules; the schedule is redone from the release date.
    const quote = quoteLoan({
      principal: terms.value.principal,
      termMonths: terms.value.termMonths,
      annualRate: ppmFromDb(loan.interestRate),
      method: loan.interestType,
      frequency: loan.repaymentFrequency,
      fees: product.fees,
      startDate: today,
    });
    await tx
      .update(loanTable)
      .set({
        ...figuresFromQuote(quote, quote.fees),
        status: 'Approved',
        coopStep: 'APPROVED',
        approvalDate: today,
        decidedBy: actor.userId,
        decidedByName: actor.name,
        decidedAt: at,
        decisionReason: reason,
        updatedAt: at,
      })
      .where(eq(loanTable.id, loan.id));
    await recordTransition(tx, loan, from, 'Approved', actor, reason, at);
    const changed = terms.value.principal !== requested || terms.value.termMonths !== loan.termMonths;
    await audit(
      tx,
      loan,
      actor,
      'LOAN_APPROVED',
      `${loan.loanNumber} for ${loan.borrowerName} approved at ${formatPeso(quote.principal)} over ${quote.termMonths} months${changed ? ` (applied for ${formatPeso(requested)} over ${loan.termMonths})` : ''}. Limit ${limit === null ? 'unlimited' : formatPeso(limit as number)}. Reason: ${reason}`,
      at,
    );
    await notify(tx, loan, 'CLIENT', 'LOAN_APPROVED', 'Loan application approved', `Your application ${loan.loanNumber} was approved for ${formatPeso(quote.principal)} over ${quote.termMonths} months. It will be released at the branch. Note: ${reason}`, at);
    await notify(tx, loan, 'STAFF', 'LOAN_APPROVED', 'Loan ready for release', `${loan.loanNumber} (${loan.borrowerName}) was approved for ${formatPeso(quote.principal)} and can be disbursed.`, at);
    return false;
  });
  return { replayed, loan: await loanDetail(db, actor, loanId) };
}

export async function cancelApplication(db: AppDb, actor: LendingActor, loanId: string, reasonInput: unknown) {
  const at = nowIso();
  await inTransaction(db, async (tx) => {
    const loan = await lockLoan(tx, actor, loanId);
    const from = statusOf(loan);
    transition(from, 'Cancelled', actor);
    const reason = cleanReason(reasonInput);
    if (!reason && (actor.kind === 'staff' || from !== 'Draft')) throw new HttpError(400, 'Give a reason for cancelling.', 'REASON_REQUIRED');
    await tx.update(loanTable).set({ status: 'Cancelled', coopStep: 'CANCELLED', cancellationReason: reason, updatedAt: at }).where(eq(loanTable.id, loan.id));
    await recordTransition(tx, loan, from, 'Cancelled', actor, reason, at);
    await audit(tx, loan, actor, 'LOAN_APPLICATION_CANCELLED', `${loan.loanNumber} cancelled.${reason ? ` Reason: ${reason}` : ''}`, at);
    if (actor.kind === 'staff') await notify(tx, loan, 'CLIENT', 'LOAN_CANCELLED', 'Loan application cancelled', `Your application ${loan.loanNumber} was cancelled. Reason: ${reason}`, at);
    else if (from !== 'Draft') await notify(tx, loan, 'STAFF', 'LOAN_CANCELLED', 'Loan application withdrawn', `${loan.borrowerName} withdrew ${loan.loanNumber}.`, at);
  });
  return loanDetail(db, actor, loanId);
}

// ---------------------------------------------------------------------------
// Disbursement
// ---------------------------------------------------------------------------

/**
 * Releases an approved loan in one transaction: stores the installment
 * schedule, posts the balanced journal entry, records the disbursement and
 * receipt, moves the loan Approved -> Disbursed -> Active, writes the audit
 * row and notifies the member. The idempotency key makes a repeated request
 * return the first result instead of releasing twice.
 */
export async function disburseLoan(db: AppDb, actor: LendingStaff, loanId: string, input: DisbursementInput, idempotencyKey: unknown) {
  const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim().slice(0, 100) : '';
  if (key.length < 8) throw new HttpError(400, 'An Idempotency-Key header (8+ characters) is required to release funds.', 'IDEMPOTENCY_KEY_REQUIRED');
  if (!has(actor, 'disburse_loans')) throw new HttpError(403, 'Your role cannot release loan funds.', 'FORBIDDEN');
  const today = manilaToday();
  const details = validateDisbursement(input, today);
  if (!details.ok || !details.value) throw new HttpError(400, 'Check the highlighted release details.', 'INVALID_DISBURSEMENT', { fields: details.errors });
  const d = details.value;
  const at = nowIso();

  const outcome = await inTransaction(db, async (tx) => {
    // Lock first, so a concurrent duplicate waits here and then sees the first release.
    const loan = await lockLoan(tx, actor, loanId);
    const prior = await tx.select().from(schema.loanDisbursements).where(eq(schema.loanDisbursements.idempotencyKey, key)).limit(1);
    if (prior[0]) {
      if (prior[0].loanId !== loanId) throw new HttpError(409, 'This idempotency key belongs to another release.', 'KEY_REUSED');
      return { replayed: true };
    }
    const already = await tx.select({ id: schema.loanDisbursements.id }).from(schema.loanDisbursements).where(eq(schema.loanDisbursements.loanId, loan.id)).limit(1);
    if (already[0]) throw new HttpError(409, `${loan.loanNumber} has already been released.`, 'ALREADY_DISBURSED');
    const from = statusOf(loan);
    transition(from, 'Disbursed', actor);
    if (loan.lendingType === 'GROUP') await assertGroupLoanAllowed(tx, loan, today, 'release');

    const borrower = await loadBorrowerForUpdate(tx, loan.borrowerId);
    if (!isKycVerified(borrower.kycStatus)) {
      throw new HttpError(403, `The member's KYC is ${normaliseKycStatus(borrower.kycStatus).toLowerCase().replace(/_/g, ' ')}; funds cannot be released.`, 'KYC_REQUIRED');
    }
    if (!isInterestMethod(loan.interestType) || !isRepaymentFrequency(loan.repaymentFrequency)) throw new HttpError(500, `${loan.loanNumber} has invalid terms.`, 'BAD_TERMS');

    const principal = centsFromDb(loan.principalAmount);
    const fees: FeeCharge[] = (Array.isArray(loan.fees) ? loan.fees : []).map((f: any) => ({ code: String(f.code), label: String(f.label), amount: centsFromDb(f.amount) }));
    const quote = quoteLoan({
      principal,
      termMonths: loan.termMonths,
      annualRate: ppmFromDb(loan.interestRate),
      method: loan.interestType,
      frequency: loan.repaymentFrequency,
      startDate: d.disbursementDate,
    });
    const totalFees = fees.reduce((s, f) => s + f.amount, 0);
    const lines = disbursementJournal({ principal, fees, method: d.method });
    if (!isBalanced(lines)) throw new HttpError(500, 'The disbursement entry does not balance.', 'UNBALANCED');

    const codes = Array.from(new Set(lines.map((l) => l.accountCode)));
    const accounts = await tx.select().from(schema.ledgerAccounts).where(inArray(schema.ledgerAccounts.accountCode, codes));
    const accountId = new Map(accounts.map((a) => [a.accountCode, a.accountId]));
    const missing = codes.filter((c) => !accountId.has(c));
    if (missing.length) throw new HttpError(500, `The chart of accounts is missing ${missing.join(', ')}.`, 'LEDGER_ACCOUNT_MISSING');

    const receiptSeq = await nextSequence(tx, 'loan_receipt_seq');
    const receiptNumber = `DV-${today.slice(0, 4)}-${String(receiptSeq).padStart(6, '0')}`;
    const [entry] = await tx
      .insert(schema.journalEntries)
      .values({
        entryDate: d.disbursementDate,
        description: `Loan release ${loan.loanNumber} to ${loan.borrowerName} (${DISBURSEMENT_METHOD_LABELS[d.method]})`,
        referenceNumber: receiptNumber,
        sourceModule: 'loans',
        sourceRef: loan.id,
        branchId: loan.branchId,
        postedBy: actor.userId,
        postedByName: actor.name,
        idempotencyKey: `loan-disbursement:${key}`,
        status: 'posted',
        createdAt: at,
      })
      .returning({ id: schema.journalEntries.journalEntryId });
    await tx.insert(schema.journalEntryLines).values(
      lines.map((l, i) => ({
        entryId: entry.id,
        lineNumber: i + 1,
        accountId: accountId.get(l.accountCode) as string,
        debit: centsToDecimal(l.debit),
        credit: centsToDecimal(l.credit),
        memo: l.memo,
      })),
    );

    await tx.insert(schema.loanDisbursements).values({
      id: newId('dsb'),
      loanId: loan.id,
      branchId: loan.branchId,
      idempotencyKey: key,
      receiptNumber,
      method: d.method,
      referenceNumber: d.referenceNumber,
      destinationAccount: d.destinationAccount,
      disbursementDate: d.disbursementDate,
      grossAmount: centsToDecimal(principal),
      totalFees: centsToDecimal(totalFees),
      netAmount: centsToDecimal(principal - totalFees),
      fees: fees.map((f) => ({ code: f.code, label: f.label, amount: centsToDecimal(f.amount) })),
      journalEntryId: entry.id,
      disbursedBy: actor.userId,
      disbursedByName: actor.name,
      disbursedByRole: actor.role,
      notes: d.notes,
      createdAt: at,
    });

    await tx.insert(schema.loanSchedule).values(
      quote.schedule.map((l) => ({
        id: newId('ls'),
        loanId: loan.id,
        installmentNumber: l.number,
        dueDate: l.dueDate,
        principalDue: centsToDecimal(l.principal),
        interestDue: centsToDecimal(l.interest),
        totalDue: centsToDecimal(l.total),
        principalPaid: '0.00',
        interestPaid: '0.00',
        penaltyPaid: '0.00',
        penaltyDue: '0.00',
        amountPaid: '0.00',
        balanceAfter: centsToDecimal(l.balanceAfter),
        status: 'PENDING',
        createdAt: at,
      })),
    );

    await tx
      .update(loanTable)
      .set({
        status: 'Active',
        coopStep: 'ACTIVE',
        totalInstallments: quote.installments,
        totalInterest: centsToDecimal(quote.totalInterest),
        totalPayable: centsToDecimal(quote.totalPayable),
        totalPaid: '0.00',
        remainingBalance: centsToDecimal(quote.totalPayable),
        installmentAmount: centsToDecimal(quote.installmentAmount),
        processingFee: centsToDecimal(totalFees),
        netProceeds: centsToDecimal(principal - totalFees),
        startDate: d.disbursementDate,
        disbursedDate: d.disbursementDate,
        nextPaymentDate: quote.firstDueDate,
        maturityDate: quote.maturityDate,
        disbursementMethod: d.method,
        disbursementAccount: d.destinationAccount,
        officerInCharge: actor.name,
        disbursementVoucher: { receiptNumber, method: d.method, referenceNumber: d.referenceNumber, netAmount: centsToDecimal(principal - totalFees) },
        updatedAt: at,
      })
      .where(eq(loanTable.id, loan.id));
    await recordTransition(tx, loan, from, 'Disbursed', actor, null, at);
    await recordTransition(tx, loan, 'Disbursed', 'Active', 'SYSTEM', `First installment due ${quote.firstDueDate}`, justAfter(at));

    await tx
      .update(schema.borrowers)
      .set({
        activeLoansCount: sql`coalesce(${schema.borrowers.activeLoansCount}, 0) + 1`,
        totalBorrowed: sql`coalesce(${schema.borrowers.totalBorrowed}, 0) + ${centsToDecimal(principal)}::numeric`,
        lastActivityDate: d.disbursementDate,
      })
      .where(eq(schema.borrowers.id, loan.borrowerId));

    await tx.insert(register).values({
      id: newId('txn'),
      referenceNumber: receiptNumber,
      clientId: loan.borrowerId,
      clientName: loan.borrowerName,
      accountOrLoanId: loan.id,
      accountOrLoanType: 'Loan',
      branchId: loan.branchId,
      transactionType: 'Loan Disbursement',
      amount: centsToDecimal(principal),
      transactionDate: d.disbursementDate,
      paymentMethod: DISBURSEMENT_METHOD_LABELS[d.method],
      processedBy: actor.name,
      processedByRole: actor.role,
      status: 'Completed',
      notes: `${loan.loanNumber}: released ${formatPeso(principal - totalFees)} net of ${formatPeso(totalFees)} fees.`,
      metadata: { receiptNumber, journalEntryId: entry.id, netAmount: centsToDecimal(principal - totalFees), totalFees: centsToDecimal(totalFees), referenceNumber: d.referenceNumber },
      createdAt: at,
      updatedAt: at,
    });

    await audit(
      tx,
      loan,
      actor,
      'LOAN_DISBURSED',
      `${loan.loanNumber} released to ${loan.borrowerName}: ${formatPeso(principal)} less fees ${formatPeso(totalFees)} = ${formatPeso(principal - totalFees)} by ${DISBURSEMENT_METHOD_LABELS[d.method]}${d.referenceNumber ? ` (ref ${d.referenceNumber})` : ''}. Receipt ${receiptNumber}.`,
      at,
    );
    await notify(
      tx,
      loan,
      'CLIENT',
      'LOAN_DISBURSEMENT',
      'Loan released',
      `${loan.loanNumber}: ${formatPeso(principal - totalFees)} was released to you by ${DISBURSEMENT_METHOD_LABELS[d.method].toLowerCase()} (receipt ${receiptNumber}). Your first payment of ${formatPeso(quote.installmentAmount)} is due ${quote.firstDueDate}.`,
      at,
    );
    return { replayed: false };
  });

  const view = await loanDetail(db, actor, loanId);
  return { replayed: outcome.replayed, loan: view, receipt: view.receipt as ReceiptDocument };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

type ScheduleRow = typeof schema.loanSchedule.$inferSelect;

function displayStatus(row: Pick<ScheduleRow, 'status' | 'dueDate'>, today: string): InstallmentDisplayStatus {
  if (row.status === 'PAID') return 'PAID';
  if (row.dueDate < today) return 'OVERDUE';
  if (row.dueDate === today) return 'DUE';
  return row.status === 'PARTIAL' ? 'PARTIAL' : 'UPCOMING';
}

function summaryOf(loan: LoanRow, schedule: ScheduleRow[], today: string): LoanSummaryView {
  const status = statusOf(loan);
  const fees = (Array.isArray(loan.fees) ? loan.fees : []).map((f: any) => ({ code: String(f.code), label: String(f.label), amount: centsToDecimal(centsFromDb(f.amount)) }));
  const unpaid = schedule.filter((s) => s.status !== 'PAID').sort((a, b) => a.installmentNumber - b.installmentNumber);
  const next = unpaid[0];
  return {
    id: loan.id,
    loanNumber: loan.loanNumber,
    status,
    borrowerId: loan.borrowerId,
    borrowerName: loan.borrowerName,
    branchId: loan.branchId,
    productId: loan.productId,
    productName: loan.productName,
    lendingType: loan.lendingType,
    channel: loan.applicationChannel,
    principal: centsToDecimal(centsFromDb(loan.principalAmount)),
    annualRate: ppmToPercent(ppmFromDb(loan.interestRate)),
    interestMethod: loan.interestType,
    frequency: loan.repaymentFrequency,
    termMonths: loan.termMonths,
    installments: loan.totalInstallments,
    installmentAmount: loan.installmentAmount === null ? null : centsToDecimal(centsFromDb(loan.installmentAmount)),
    totalInterest: centsToDecimal(centsFromDb(loan.totalInterest)),
    fees,
    totalFees: centsToDecimal(centsFromDb(loan.processingFee)),
    netProceeds: loan.netProceeds === null ? null : centsToDecimal(centsFromDb(loan.netProceeds)),
    totalPayable: centsToDecimal(centsFromDb(loan.totalPayable)),
    totalPaid: centsToDecimal(centsFromDb(loan.totalPaid)),
    remainingBalance: centsToDecimal(centsFromDb(loan.remainingBalance)),
    applicationDate: loan.applicationDate,
    submittedAt: loan.submittedAt,
    approvalDate: loan.approvalDate,
    disbursedDate: loan.disbursedDate,
    maturityDate: loan.maturityDate,
    nextDue: next ? { dueDate: next.dueDate, amount: centsToDecimal(centsFromDb(next.totalDue) + centsFromDb(next.penaltyDue) - centsFromDb(next.amountPaid)) } : null,
    overdue: unpaid.some((s) => s.dueDate < today),
    purpose: loan.purpose,
    loanOfficerName: loan.loanOfficerName,
    decidedByName: loan.decidedByName,
    createdBy: loan.createdBy,
    decisionReason: loan.decisionReason,
    returnedReason: loan.returnedReason,
    cancellationReason: loan.cancellationReason,
  };
}

async function schedulesFor(db: AppDb, loanIds: string[]): Promise<Map<string, ScheduleRow[]>> {
  const map = new Map<string, ScheduleRow[]>();
  if (!loanIds.length) return map;
  const rows = await db.select().from(schema.loanSchedule).where(inArray(schema.loanSchedule.loanId, loanIds)).orderBy(asc(schema.loanSchedule.installmentNumber));
  for (const r of rows) {
    const list = map.get(r.loanId) ?? [];
    list.push(r);
    map.set(r.loanId, list);
  }
  return map;
}

export async function loanSummaries(db: AppDb, loans: LoanRow[]): Promise<LoanSummaryView[]> {
  const today = manilaToday();
  const schedules = await schedulesFor(db, loans.map((l) => l.id));
  return loans.map((l) => summaryOf(l, schedules.get(l.id) ?? [], today));
}

function receiptOf(loan: LoanRow, d: typeof schema.loanDisbursements.$inferSelect, branch: { name: string; address: string | null } | null, memberNumber: string | null): ReceiptDocument {
  const fees = Array.isArray(d.fees) ? (d.fees as any[]) : [];
  return {
    kind: 'DISBURSEMENT',
    title: 'Loan release voucher',
    receiptNumber: d.receiptNumber,
    issuedAt: d.createdAt,
    branchName: branch?.name ?? null,
    branchAddress: branch?.address ?? null,
    partyLabel: 'Released to',
    partyName: loan.borrowerName,
    partyNumber: memberNumber,
    accountLabel: 'Loan number',
    accountNumber: loan.loanNumber,
    accountDetail: `${loan.productName} · ${loan.termMonths} months · ${FREQUENCY_LABELS[loan.repaymentFrequency as keyof typeof FREQUENCY_LABELS] ?? loan.repaymentFrequency} payments`,
    lines: [
      { label: 'Approved principal', amount: centsToDecimal(centsFromDb(d.grossAmount)) },
      ...fees.map((f) => ({ label: String(f.label), detail: 'Deducted from proceeds', amount: centsToDecimal(centsFromDb(f.amount)), deduction: true })),
    ],
    totalLabel: 'Net amount released',
    totalAmount: centsToDecimal(centsFromDb(d.netAmount)),
    method: DISBURSEMENT_METHOD_LABELS[d.method as DisbursementMethod] ?? d.method,
    reference: d.referenceNumber,
    destination: d.destinationAccount,
    processedBy: `${d.disbursedByName} (${d.disbursedByRole})`,
    notes: d.notes,
    footer: loan.nextPaymentDate ? `First installment of ${formatPeso(centsFromDb(loan.installmentAmount ?? '0'))} due ${loan.nextPaymentDate}.` : null,
  };
}

export async function loanDetail(db: AppDb, actor: LendingActor, loanId: string): Promise<LoanDetailView> {
  const rows = await db.select().from(loanTable).where(eq(loanTable.id, loanId)).limit(1);
  if (!rows[0]) throw new HttpError(404, 'Loan not found.', 'NOT_FOUND');
  const loan = rows[0];
  assertLoanInScope(actor, loan);
  const today = manilaToday();
  const stored = (await schedulesFor(db, [loan.id])).get(loan.id) ?? [];
  const summary = summaryOf(loan, stored, today);

  let scheduleKind: LoanDetailView['scheduleKind'] = 'STORED';
  let schedule: ScheduleRowView[] = stored.map((s) => ({
    number: s.installmentNumber,
    dueDate: s.dueDate,
    principal: centsToDecimal(centsFromDb(s.principalDue)),
    interest: centsToDecimal(centsFromDb(s.interestDue)),
    total: centsToDecimal(centsFromDb(s.totalDue)),
    penalty: centsToDecimal(centsFromDb(s.penaltyDue)),
    paid: centsToDecimal(centsFromDb(s.amountPaid)),
    outstanding: centsToDecimal(centsFromDb(s.totalDue) + centsFromDb(s.penaltyDue) - centsFromDb(s.amountPaid)),
    balanceAfter: centsToDecimal(centsFromDb(s.balanceAfter)),
    status: displayStatus(s, today),
  }));
  const status = summary.status;
  if (!stored.length && ['Draft', 'Submitted', 'Under Review', 'Approved'].includes(status) && isInterestMethod(loan.interestType) && isRepaymentFrequency(loan.repaymentFrequency)) {
    scheduleKind = 'PROJECTED';
    const q = quoteLoan({
      principal: centsFromDb(loan.principalAmount),
      termMonths: loan.termMonths,
      annualRate: ppmFromDb(loan.interestRate),
      method: loan.interestType,
      frequency: loan.repaymentFrequency,
      startDate: today,
    });
    schedule = q.schedule.map((l) => ({
      number: l.number,
      dueDate: l.dueDate,
      principal: centsToDecimal(l.principal),
      interest: centsToDecimal(l.interest),
      total: centsToDecimal(l.total),
      penalty: '0.00',
      paid: '0.00',
      outstanding: centsToDecimal(l.total),
      balanceAfter: centsToDecimal(l.balanceAfter),
      status: 'UPCOMING',
    }));
  }

  const history = await db.select().from(schema.loanStatusHistory).where(eq(schema.loanStatusHistory.loanId, loan.id)).orderBy(asc(schema.loanStatusHistory.createdAt));
  const disb = (await db.select().from(schema.loanDisbursements).where(eq(schema.loanDisbursements.loanId, loan.id)).limit(1))[0];
  let receipt: ReceiptDocument | null = null;
  if (disb) {
    const branch = (await db.select({ name: schema.branches.name, address: schema.branches.address }).from(schema.branches).where(eq(schema.branches.id, loan.branchId)).limit(1))[0] ?? null;
    const member = (await db.select({ number: schema.borrowers.borrowerNumber }).from(schema.borrowers).where(eq(schema.borrowers.id, loan.borrowerId)).limit(1))[0];
    receipt = receiptOf(loan, disb, branch, member?.number ?? null);
  }

  return {
    ...summary,
    scheduleKind,
    schedule,
    history: history.map((h) => ({ from: h.fromStatus, to: h.toStatus, reason: h.reason, actorName: h.actorName, actorRole: h.actorRole, at: h.createdAt })),
    disbursement: disb
      ? {
          receiptNumber: disb.receiptNumber,
          method: disb.method as DisbursementMethod,
          referenceNumber: disb.referenceNumber,
          destinationAccount: disb.destinationAccount,
          disbursementDate: disb.disbursementDate,
          grossAmount: centsToDecimal(centsFromDb(disb.grossAmount)),
          totalFees: centsToDecimal(centsFromDb(disb.totalFees)),
          netAmount: centsToDecimal(centsFromDb(disb.netAmount)),
          disbursedByName: disb.disbursedByName,
          journalEntryId: disb.journalEntryId,
        }
      : null,
    receipt,
  };
}

/** A member's loans, newest first, split the way the portal shows them. */
export async function clientLoans(db: AppDb, borrowerId: string): Promise<ClientLoansView> {
  const rows = await db.select().from(loanTable).where(eq(loanTable.borrowerId, borrowerId)).orderBy(desc(loanTable.createdAt));
  const views = await loanSummaries(db, rows);
  const running = views.filter((v) => RUNNING_LOAN_STATUSES.includes(v.status));
  const pending = views.filter((v) => OPEN_LOAN_STATUSES.includes(v.status) && !RUNNING_LOAN_STATUSES.includes(v.status));
  const finished = views.filter((v) => !OPEN_LOAN_STATUSES.includes(v.status));
  const outstanding = running.reduce((s, v) => s + centsFromDb(v.remainingBalance), 0);
  const nextDue = running
    .map((v) => v.nextDue)
    .filter((n): n is NonNullable<typeof n> => !!n)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
  return {
    running,
    pending,
    finished,
    all: views,
    summary: {
      runningCount: running.length,
      pendingCount: pending.length,
      finishedCount: finished.length,
      outstanding: centsToDecimal(outstanding),
      nextDue,
    },
  };
}

// ---------------------------------------------------------------------------
// Ledger checks
// ---------------------------------------------------------------------------

/** Debit and credit totals per account across posted entries (for checks and reports). */
export async function trialBalance(db: AppDb) {
  const rows = rowsOf<{ account_code: string; debit: string; credit: string }>(
    await db.execute(sql`select a.account_code, coalesce(sum(l.debit), 0)::text as debit, coalesce(sum(l.credit), 0)::text as credit
                           from journal_entry_lines l
                           join journal_entries e on e.journal_entry_id = l.entry_id and e.status = 'posted'
                           join accounts a on a.account_id = l.account_id
                          group by a.account_code order by a.account_code`),
  );
  return rows.map((r) => ({ accountCode: r.account_code, debit: centsFromDb(r.debit), credit: centsFromDb(r.credit) }));
}
