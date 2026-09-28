/**
 * Canonical KYC status vocabulary and the rules that depend on it.
 *
 * This mirrors database/migrations/0019 (the enum), 0022 (the transition graph)
 * and 0021 (the legacy mapping). It exists because the same decisions were being
 * re-derived in route handlers, where a fourth spelling of "verified" quietly
 * became a fourth way to pass the loan gate.
 *
 * If you change a rule here, the database is the thing that actually enforces it
 * and this file is the thing that keeps the UI and the API honest. They must be
 * changed together, and `npm run db:verify-migrations` asserts the database half.
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

/** Statuses that are still being worked on and have not reached a decision. */
export const OPEN_KYC_STATUSES: readonly KycStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CORRECTION_REQUIRED',
  'REJECTED',
  'SUSPENDED',
];

/** A status that has ended in approval. Only these two ever unlock a loan. */
export const APPROVED_KYC_STATUSES: readonly KycStatus[] = ['APPROVED'];

/**
 * Legacy spellings produced by the pre-0019 flow, mapped to canonical values.
 * `VERIFIED` is kept live so members verified under the old flow are not locked
 * out of services they already had.
 */
export const LEGACY_KYC_STATUS_ALIASES: Readonly<Record<string, KycStatus>> = {
  PENDING: 'SUBMITTED',
  VERIFIED: 'APPROVED',
};

/** Statuses that mean "the borrower is verified" for gating purposes. */
const LOAN_ELIGIBLE: ReadonlySet<string> = new Set<string>([
  ...APPROVED_KYC_STATUSES,
  'VERIFIED', // pre-0019 spelling of APPROVED
]);

/** Normalise any status, known or not, to a canonical value. */
export function normaliseKycStatus(raw: string | null | undefined): KycStatus {
  if (!raw) return 'NOT_STARTED';
  const upper = String(raw).trim().toUpperCase();
  const aliased = LEGACY_KYC_STATUS_ALIASES[upper];
  if (aliased) return aliased;
  if ((KYC_STATUSES as readonly string[]).includes(upper)) return upper as KycStatus;
  // An unrecognised value is never treated as benign.
  return 'NOT_STARTED';
}

/**
 * Whether a borrower in this KYC state may apply for a loan.
 *
 * This is an allowlist on purpose. A denylist grants the loan to every status
 * nobody thought to block, which is how `PENDING` -- a submission no human has
 * looked at -- ended up eligible.
 */
export function isLoanEligible(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return LOAN_ELIGIBLE.has(String(raw).trim().toUpperCase());
}

/** Whether a staff reviewer may still act on this application. */
export function isAwaitingReview(raw: string | null | undefined): boolean {
  const s = normaliseKycStatus(raw);
  return s === 'SUBMITTED' || s === 'UNDER_REVIEW';
}

/** Whether the borrower can still edit and resubmit their application. */
export function canResubmit(raw: string | null | undefined): boolean {
  const s = normaliseKycStatus(raw);
  return s === 'NOT_STARTED' || s === 'IN_PROGRESS' || s === 'CORRECTION_REQUIRED' || s === 'REJECTED';
}

const GATE_MESSAGES: Readonly<Record<string, string>> = {
  NOT_STARTED:
    'Please complete your KYC verification before applying for a loan. Go to Profile → Complete KYC Verification.',
  IN_PROGRESS:
    'Your KYC is not finished yet. Please complete and submit it before applying for a loan.',
  SUBMITTED:
    'Your KYC is still being reviewed by the branch. You can apply for a loan once it is approved.',
  PENDING:
    'Your KYC is still being reviewed by the branch. You can apply for a loan once it is approved.',
  UNDER_REVIEW:
    'Your KYC is under review. You can apply for a loan once a reviewer has approved it.',
  REJECTED:
    'Your KYC was rejected. Please resubmit your documents with the corrections noted by the branch.',
  CORRECTION_REQUIRED:
    'Your KYC requires corrections. Please update your documents and resubmit.',
  SUSPENDED:
    'Your KYC has been suspended. Please contact your branch to resolve this before applying for a loan.',
};

/**
 * The message shown when the loan gate refuses.
 *
 * This only explains a refusal, it never decides one -- `isLoanEligible` is the
 * decision. An unrecognised status must still be refused by the caller.
 */
export function kycGateMessage(raw: string | null | undefined): string {
  const key = String(raw ?? '').trim().toUpperCase();
  return (
    GATE_MESSAGES[key] ??
    'Your KYC verification is not complete. Please contact your branch for assistance.'
  );
}
