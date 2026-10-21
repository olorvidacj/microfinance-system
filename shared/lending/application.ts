/**
 * Loan application checks, run identically by the portal form, the branch
 * form and the server.
 */

import { FREQUENCY_LABELS } from './calculator';
import { formatPeso, parsePesos, type Cents } from './money';
import type { LoanProduct } from './products';
import { OPEN_LOAN_STATUSES, type LoanStatus } from './workflow';

export const LOAN_PURPOSES = ['BUSINESS', 'EDUCATION', 'AGRICULTURE', 'MEDICAL', 'HOUSEHOLD', 'OTHER'] as const;
export type LoanPurpose = (typeof LOAN_PURPOSES)[number];
export const LOAN_PURPOSE_LABELS: Readonly<Record<LoanPurpose, string>> = {
  BUSINESS: 'Business capital / inventory',
  EDUCATION: 'Education / tuition',
  AGRICULTURE: 'Agriculture / farming / livestock',
  MEDICAL: 'Medical / emergency',
  HOUSEHOLD: 'Household improvement',
  OTHER: 'Other',
};

export interface ApplicationTermsInput {
  amount: unknown;
  termMonths: unknown;
  purpose: unknown;
  purposeDetails?: unknown;
}

export interface ApplicationTerms {
  principal: Cents;
  termMonths: number;
  purpose: LoanPurpose;
  /** Free-text details the applicant gave; only non-empty strings are kept. */
  purposeDetails: Record<string, string>;
}

export type ApplicationErrors = Partial<Record<'product' | 'amount' | 'termMonths' | 'purpose' | 'purposeDetails', string>>;

type TermLimits = Pick<LoanProduct, 'minAmount' | 'maxAmount' | 'minTermMonths' | 'maxTermMonths' | 'frequency'>;

/** Amount and term against a product's limits (used again at approval, when the product may since have been retired). */
export function validateLoanTerms(
  product: TermLimits,
  amount: unknown,
  termMonths: unknown,
): { ok: boolean; value: { principal: Cents; termMonths: number } | null; errors: Pick<ApplicationErrors, 'amount' | 'termMonths'> } {
  const errors: Pick<ApplicationErrors, 'amount' | 'termMonths'> = {};
  const principal = parsePesos(amount);
  if (principal === null || principal <= 0) errors.amount = 'Enter the amount (pesos and centavos only).';
  else if (principal < product.minAmount || principal > product.maxAmount) {
    errors.amount = `Choose an amount from ${formatPeso(product.minAmount)} to ${formatPeso(product.maxAmount)}.`;
  }
  const term = typeof termMonths === 'number' ? termMonths : /^\d{1,3}$/.test(String(termMonths ?? '').trim()) ? Number(termMonths) : NaN;
  if (!Number.isInteger(term) || term <= 0) errors.termMonths = 'Enter the term in whole months.';
  else if (term < product.minTermMonths || term > product.maxTermMonths) {
    errors.termMonths = `Choose a term from ${product.minTermMonths} to ${product.maxTermMonths} months (${FREQUENCY_LABELS[product.frequency].toLowerCase()} payments).`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, value: null, errors };
  return { ok: true, errors, value: { principal: principal as Cents, termMonths: term } };
}

export function validateApplicationTerms(
  product: (TermLimits & Pick<LoanProduct, 'status'>) | null,
  input: ApplicationTermsInput,
): { ok: boolean; value: ApplicationTerms | null; errors: ApplicationErrors } {
  const errors: ApplicationErrors = {};
  if (!product) errors.product = 'Choose a loan product.';
  else if (product.status !== 'ACTIVE') errors.product = 'This loan product is not available for new applications.';

  const terms = product ? validateLoanTerms(product, input.amount, input.termMonths) : null;
  Object.assign(errors, terms?.errors);

  const purpose = String(input.purpose ?? '').trim().toUpperCase() as LoanPurpose;
  if (!(LOAN_PURPOSES as readonly string[]).includes(purpose)) errors.purpose = 'Choose the purpose of the loan.';

  const purposeDetails: Record<string, string> = {};
  if (input.purposeDetails && typeof input.purposeDetails === 'object' && !Array.isArray(input.purposeDetails)) {
    for (const [k, v] of Object.entries(input.purposeDetails as Record<string, unknown>).slice(0, 12)) {
      const key = k.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
      const val = typeof v === 'string' ? v.trim().slice(0, 300) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
      if (key && val) purposeDetails[key] = val;
    }
  }
  if (purpose === 'OTHER' && !purposeDetails.explanation) errors.purposeDetails = 'Explain what the loan is for.';

  if (Object.keys(errors).length > 0 || !terms?.value) return { ok: false, value: null, errors };
  return { ok: true, errors, value: { ...terms.value, purpose, purposeDetails } };
}

export interface EligibilityFacts {
  kycVerified: boolean;
  product: Pick<LoanProduct, 'id' | 'name' | 'lendingType'>;
  /** The member's other loans and applications (not the one being checked). */
  otherLoans: ReadonlyArray<{ loanNumber: string; productId: string; status: LoanStatus }>;
  /** Loan numbers of running loans with an installment past due and unpaid. */
  overdueLoanNumbers: readonly string[];
  /** Whether the member belongs to an active lending group in their branch. */
  inActiveGroup: boolean;
  /** Why the member's group may not take new loans (arrears beyond its threshold, unpaid covers). */
  groupBlockReasons?: readonly string[];
}

export interface EligibilityIssue {
  code: 'KYC_REQUIRED' | 'DUPLICATE_PRODUCT' | 'OVERDUE_LOAN' | 'GROUP_REQUIRED' | 'GROUP_IN_ARREARS';
  message: string;
}

/**
 * Lending policy:
 * - the member's KYC must be verified;
 * - one open application or loan per product at a time;
 * - no new application while any running loan has an overdue installment;
 * - group products only for members of an active lending group, and not while
 *   the group is blocked (a member in arrears beyond the group's threshold, or
 *   owing the solidarity fund).
 */
export function assessEligibility(facts: EligibilityFacts): EligibilityIssue[] {
  const issues: EligibilityIssue[] = [];
  if (!facts.kycVerified) {
    issues.push({ code: 'KYC_REQUIRED', message: 'Your KYC must be verified before you can apply for a loan.' });
  }
  const sameProduct = facts.otherLoans.find((l) => l.productId === facts.product.id && OPEN_LOAN_STATUSES.includes(l.status));
  if (sameProduct) {
    issues.push({
      code: 'DUPLICATE_PRODUCT',
      message: `There is already an open ${facts.product.name} (${sameProduct.loanNumber}, ${sameProduct.status.toLowerCase()}). Finish or cancel it first.`,
    });
  }
  if (facts.overdueLoanNumbers.length > 0) {
    issues.push({
      code: 'OVERDUE_LOAN',
      message: `Loan ${facts.overdueLoanNumbers.join(', ')} has an overdue installment. Settle it before applying again.`,
    });
  }
  if (facts.product.lendingType === 'GROUP' && !facts.inActiveGroup) {
    issues.push({ code: 'GROUP_REQUIRED', message: 'This is a group loan. Join an active lending group in your branch first.' });
  }
  if (facts.product.lendingType === 'GROUP' && facts.inActiveGroup && facts.groupBlockReasons?.length) {
    issues.push({ code: 'GROUP_IN_ARREARS', message: `Your group cannot take new loans until its arrears are cleared: ${facts.groupBlockReasons.join(' ')}` });
  }
  return issues;
}
