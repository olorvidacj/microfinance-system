/**
 * KYC status vocabulary and transition graph.
 *
 * The database enforces the same rules: kyc_normalize_status() and
 * kyc_transition_allowed() in migrations 0023/0024. Change both together;
 * status.test.ts checks this file and kycService.db.test.ts checks the SQL.
 */

export const KYC_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CORRECTION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const;

export type KycStatus = (typeof KYC_STATUSES)[number];

/** Who is changing the status. Mirrors the hoscomo.kyc_actor values the SQL guard accepts. */
export type KycActor = 'client' | 'staff' | 'staff_sensitive';

const ALIASES: Readonly<Record<string, KycStatus>> = {
  PENDING: 'SUBMITTED',
  PENDING_REVIEW: 'SUBMITTED',
  PENDING_VERIFICATION: 'SUBMITTED',
  RESUBMITTED: 'SUBMITTED',
  VERIFIED: 'APPROVED',
  CORRECTION_REQUESTED: 'CORRECTION_REQUIRED',
  REQUIRES_CORRECTION: 'CORRECTION_REQUIRED',
  NEEDS_CORRECTION: 'CORRECTION_REQUIRED',
  ADDITIONAL_INFORMATION_REQUIRED: 'CORRECTION_REQUIRED',
  RESUBMISSION_REQUIRED: 'CORRECTION_REQUIRED',
  IN_REVIEW: 'UNDER_REVIEW',
  DRAFT: 'IN_PROGRESS',
};

/**
 * Normalises any stored or submitted spelling to a canonical status.
 * Unknown values become NOT_STARTED, the most restrictive state, never APPROVED.
 */
export function normaliseKycStatus(raw: string | null | undefined): KycStatus {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (v === '') return 'NOT_STARTED';
  if ((KYC_STATUSES as readonly string[]).includes(v)) return v as KycStatus;
  return ALIASES[v] ?? 'NOT_STARTED';
}

type Edge = readonly [KycStatus, KycStatus];

export const KYC_TRANSITIONS: Readonly<Record<KycActor, readonly Edge[]>> = {
  client: [
    ['NOT_STARTED', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'SUBMITTED'],
    ['CORRECTION_REQUIRED', 'SUBMITTED'],
    ['REJECTED', 'IN_PROGRESS'],
  ],
  staff: [
    ['SUBMITTED', 'UNDER_REVIEW'],
    ['UNDER_REVIEW', 'SUBMITTED'],
    ['UNDER_REVIEW', 'APPROVED'],
    ['UNDER_REVIEW', 'REJECTED'],
    ['UNDER_REVIEW', 'CORRECTION_REQUIRED'],
  ],
  staff_sensitive: [
    ['SUBMITTED', 'UNDER_REVIEW'],
    ['UNDER_REVIEW', 'SUBMITTED'],
    ['UNDER_REVIEW', 'APPROVED'],
    ['UNDER_REVIEW', 'REJECTED'],
    ['UNDER_REVIEW', 'CORRECTION_REQUIRED'],
    ['APPROVED', 'SUSPENDED'],
    ['SUSPENDED', 'APPROVED'],
    ['SUSPENDED', 'CORRECTION_REQUIRED'],
  ],
};

export function canTransition(from: KycStatus, to: KycStatus, actor: KycActor): boolean {
  return KYC_TRANSITIONS[actor].some(([a, b]) => a === from && b === to);
}

export class KycTransitionError extends Error {
  readonly status = 409;
  constructor(
    readonly from: KycStatus,
    readonly to: KycStatus,
    readonly actor: KycActor,
  ) {
    super(`A KYC application cannot move from ${KYC_STATUS_LABELS[from]} to ${KYC_STATUS_LABELS[to]}.`);
    this.name = 'KycTransitionError';
  }
}

export function assertTransition(from: KycStatus, to: KycStatus, actor: KycActor): void {
  if (!canTransition(from, to, actor)) throw new KycTransitionError(from, to, actor);
}

/** Labels shown to members and staff. */
export const KYC_STATUS_LABELS: Readonly<Record<KycStatus, string>> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Pending review',
  UNDER_REVIEW: 'Under review',
  CORRECTION_REQUIRED: 'Additional information required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

export function kycStatusLabel(raw: string | null | undefined): string {
  return KYC_STATUS_LABELS[normaliseKycStatus(raw)];
}

/** Staff decisions on an application that is UNDER_REVIEW. */
export const KYC_DECISIONS = {
  APPROVE: 'APPROVED',
  REJECT: 'REJECTED',
  REQUEST_RESUBMISSION: 'CORRECTION_REQUIRED',
} as const satisfies Record<string, KycStatus>;

export type KycDecision = keyof typeof KYC_DECISIONS;

const DECISION_ALIASES: Readonly<Record<string, KycDecision>> = {
  APPROVE: 'APPROVE',
  APPROVED: 'APPROVE',
  VERIFY: 'APPROVE',
  VERIFIED: 'APPROVE',
  REJECT: 'REJECT',
  REJECTED: 'REJECT',
  REQUEST_RESUBMISSION: 'REQUEST_RESUBMISSION',
  RESUBMISSION_REQUIRED: 'REQUEST_RESUBMISSION',
  REQUEST_CORRECTION: 'REQUEST_RESUBMISSION',
  CORRECTION_REQUIRED: 'REQUEST_RESUBMISSION',
  CORRECTION_REQUESTED: 'REQUEST_RESUBMISSION',
};

export function parseKycDecision(raw: unknown): KycDecision | null {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return DECISION_ALIASES[v] ?? null;
}

/** Only an approved member may borrow or open savings. */
export function isKycVerified(raw: string | null | undefined): boolean {
  return normaliseKycStatus(raw) === 'APPROVED';
}

/** Statuses in which the member may edit their application. */
export function isEditableByClient(raw: string | null | undefined): boolean {
  const s = normaliseKycStatus(raw);
  return s === 'NOT_STARTED' || s === 'IN_PROGRESS' || s === 'CORRECTION_REQUIRED' || s === 'REJECTED';
}

export function isAwaitingReview(raw: string | null | undefined): boolean {
  const s = normaliseKycStatus(raw);
  return s === 'SUBMITTED' || s === 'UNDER_REVIEW';
}

const GATE_MESSAGES: Readonly<Record<KycStatus, string>> = {
  NOT_STARTED: 'Please complete your KYC verification first. Go to KYC Verification in the portal.',
  IN_PROGRESS: 'Your KYC application is not submitted yet. Please finish and submit it first.',
  SUBMITTED: 'Your KYC application is waiting for branch review. You can continue once it is verified.',
  UNDER_REVIEW: 'Your KYC application is being reviewed. You can continue once it is verified.',
  CORRECTION_REQUIRED: 'Your KYC application needs changes. Please update it and resubmit.',
  APPROVED: '',
  REJECTED: 'Your KYC application was rejected. Please review the reason, update your application and resubmit.',
  SUSPENDED: 'Your KYC verification is suspended. Please contact your branch.',
};

/** Explains a refusal by the KYC gate. isKycVerified() makes the decision. */
export function kycGateMessage(raw: string | null | undefined): string {
  return GATE_MESSAGES[normaliseKycStatus(raw)] || GATE_MESSAGES.NOT_STARTED;
}
