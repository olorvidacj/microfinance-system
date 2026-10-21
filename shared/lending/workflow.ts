/**
 * Loan lifecycle. The server enforces these transitions; the UI uses the same
 * table to decide which actions to offer.
 *
 *   Draft -> Submitted -> Under Review -> Approved -> Disbursed -> Active -> Closed
 *                                      \-> Rejected                     \-> Written Off
 *
 * An application can also be returned to Draft for corrections (with a
 * reason) while it is Submitted or Under Review, and cancelled before it is
 * disbursed. A closed loan reopens only when the payment that closed it is
 * reversed. Stored values are exactly the strings in LOAN_STATUSES.
 */

import type { Cents } from './money';

export const LOAN_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Disbursed',
  'Active',
  'Closed',
  'Written Off',
  'Cancelled',
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

/** Who may drive a transition. */
export type LoanActorKind = 'APPLICANT' | 'REVIEWER' | 'APPROVER' | 'DISBURSER' | 'SYSTEM' | 'WRITE_OFF' | 'REVERSER';

export const LOAN_TRANSITIONS: Readonly<Record<LoanStatus, Partial<Record<LoanStatus, readonly LoanActorKind[]>>>> = {
  Draft: { Submitted: ['APPLICANT'], Cancelled: ['APPLICANT', 'REVIEWER'] },
  Submitted: { 'Under Review': ['REVIEWER'], Draft: ['REVIEWER'], Cancelled: ['APPLICANT', 'REVIEWER'] },
  'Under Review': { Approved: ['APPROVER'], Rejected: ['APPROVER'], Draft: ['REVIEWER'], Cancelled: ['REVIEWER'] },
  Approved: { Disbursed: ['DISBURSER'], Cancelled: ['APPROVER'] },
  Rejected: {},
  Disbursed: { Active: ['SYSTEM'] },
  Active: { Closed: ['SYSTEM'], 'Written Off': ['WRITE_OFF'] },
  // Reversing the payment that settled a loan reopens it.
  Closed: { Active: ['REVERSER'] },
  'Written Off': {},
  Cancelled: {},
};

/** Statuses in which a loan or application still counts against the member. */
export const OPEN_LOAN_STATUSES: readonly LoanStatus[] = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Disbursed', 'Active'];
/** Statuses in which money is out with the member. */
export const RUNNING_LOAN_STATUSES: readonly LoanStatus[] = ['Disbursed', 'Active'];
/** Transitions that must carry a reason the member can read. */
export const REASON_REQUIRED: ReadonlyArray<[LoanStatus, LoanStatus]> = [
  ['Under Review', 'Approved'],
  ['Under Review', 'Rejected'],
  ['Submitted', 'Draft'],
  ['Under Review', 'Draft'],
  ['Approved', 'Cancelled'],
  ['Under Review', 'Cancelled'],
  ['Active', 'Written Off'],
];

export function isLoanStatus(v: unknown): v is LoanStatus {
  return typeof v === 'string' && (LOAN_STATUSES as readonly string[]).includes(v);
}

const LEGACY_SPELLINGS: Readonly<Record<string, LoanStatus>> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  FOR_ASSESSMENT: 'Under Review',
  RECOMMENDED: 'Under Review',
  APPROVED: 'Approved',
  FOR_DISBURSEMENT: 'Approved',
  REJECTED: 'Rejected',
  DECLINED: 'Rejected',
  DISBURSED: 'Disbursed',
  ACTIVE: 'Active',
  IN_ARREARS: 'Active',
  OVERDUE: 'Active',
  DEFAULTED: 'Active',
  COMPLETED: 'Closed',
  CLOSED: 'Closed',
  PAID_OFF: 'Closed',
  FULLY_PAID: 'Closed',
  SETTLED: 'Closed',
  WRITTEN_OFF: 'Written Off',
  CANCELLED: 'Cancelled',
  CANCELED: 'Cancelled',
};

/** Maps any spelling found in older rows or clients to the canonical status, or null. */
export function normaliseLoanStatus(v: unknown): LoanStatus | null {
  if (isLoanStatus(v)) return v;
  const key = String(v ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return LEGACY_SPELLINGS[key] ?? null;
}

export class LoanTransitionError extends Error {
  readonly status = 409;
  constructor(
    readonly from: LoanStatus,
    readonly to: LoanStatus,
    message: string,
  ) {
    super(message);
    this.name = 'LoanTransitionError';
  }
}

export function canTransition(from: LoanStatus, to: LoanStatus, actor: LoanActorKind): boolean {
  return (LOAN_TRANSITIONS[from][to] ?? []).includes(actor);
}

export function assertLoanTransition(from: LoanStatus, to: LoanStatus, actor: LoanActorKind): void {
  const allowed = LOAN_TRANSITIONS[from][to];
  if (!allowed) {
    throw new LoanTransitionError(from, to, `A loan that is ${from.toLowerCase()} cannot move to ${to.toLowerCase()}.`);
  }
  if (!allowed.includes(actor)) {
    throw new LoanTransitionError(from, to, `You are not allowed to move this loan from ${from.toLowerCase()} to ${to.toLowerCase()}.`);
  }
}

export function reasonRequired(from: LoanStatus, to: LoanStatus): boolean {
  return REASON_REQUIRED.some(([f, t]) => f === from && t === to);
}

/**
 * Approval authority. `limit` is the most the approver's role may approve,
 * in centavos; null means no limit. A role with no configured limit cannot
 * approve at all (the caller passes undefined).
 */
export function withinApprovalLimit(limit: Cents | null | undefined, amount: Cents): boolean {
  if (limit === undefined) return false;
  return limit === null || amount <= limit;
}

export const DECISION_REASON_MIN = 3;
export const DECISION_REASON_MAX = 1000;

export function cleanReason(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length >= DECISION_REASON_MIN && s.length <= DECISION_REASON_MAX ? s : null;
}
