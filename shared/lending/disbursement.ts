/**
 * Disbursement rules shared by LoanDisbursementModal and the server, and the
 * journal entry a disbursement posts.
 */

import { isIsoDate } from './calculator';
import { sumCents, type Cents } from './money';

export const DISBURSEMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'E_WALLET'] as const;
export type DisbursementMethod = (typeof DISBURSEMENT_METHODS)[number];
export const DISBURSEMENT_METHOD_LABELS: Readonly<Record<DisbursementMethod, string>> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  E_WALLET: 'E-wallet',
};

/** Chart-of-accounts codes (0010 seed, ensured by 0025). */
export const LEDGER_ACCOUNTS = {
  CASH_ON_HAND: '1010',
  CASH_IN_BANK: '1020',
  LOANS_RECEIVABLE: '1110',
  SERVICE_FEE_INCOME: '4030',
} as const;

/** Where the money leaves from. E-wallet balances are held with the bank funds. */
export const DISBURSEMENT_SOURCE_ACCOUNT: Readonly<Record<DisbursementMethod, string>> = {
  CASH: LEDGER_ACCOUNTS.CASH_ON_HAND,
  BANK_TRANSFER: LEDGER_ACCOUNTS.CASH_IN_BANK,
  E_WALLET: LEDGER_ACCOUNTS.CASH_IN_BANK,
};

export interface DisbursementInput {
  method: unknown;
  referenceNumber?: unknown;
  /** Bank account or e-wallet number the money was sent to. */
  destinationAccount?: unknown;
  disbursementDate: unknown;
  notes?: unknown;
}

export interface DisbursementDetails {
  method: DisbursementMethod;
  referenceNumber: string | null;
  destinationAccount: string | null;
  disbursementDate: string;
  notes: string | null;
}

export type DisbursementErrors = Partial<Record<keyof DisbursementInput, string>>;

const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/ ]{3,59}$/;

/**
 * Bank and e-wallet releases must carry the transfer reference; cash releases
 * are identified by the receipt the system issues, so a reference is optional.
 * The release date may not be in the future or more than 7 days back.
 */
export function validateDisbursement(input: DisbursementInput, today: string): { ok: boolean; value: DisbursementDetails | null; errors: DisbursementErrors } {
  const errors: DisbursementErrors = {};
  const method = String(input.method ?? '') as DisbursementMethod;
  if (!(DISBURSEMENT_METHODS as readonly string[]).includes(method)) errors.method = 'Choose cash, bank transfer or e-wallet.';

  const ref = typeof input.referenceNumber === 'string' ? input.referenceNumber.trim() : '';
  if (ref && !REFERENCE_PATTERN.test(ref)) errors.referenceNumber = 'Use 4-60 letters, digits, dashes or slashes.';
  else if (!ref && method !== 'CASH' && !errors.method) errors.referenceNumber = 'Enter the bank or e-wallet transfer reference number.';

  const dest = typeof input.destinationAccount === 'string' ? input.destinationAccount.trim().slice(0, 80) : '';
  if (!dest && method !== 'CASH' && !errors.method) errors.destinationAccount = 'Enter the account or e-wallet number the money was sent to.';

  const date = input.disbursementDate;
  if (!isIsoDate(date)) errors.disbursementDate = 'Choose the release date.';
  else if (date > today) errors.disbursementDate = 'The release date cannot be in the future.';
  else if (daysBetween(date, today) > 7) errors.disbursementDate = 'The release date cannot be more than 7 days ago.';

  const notes = typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim().slice(0, 500) : null;

  if (Object.keys(errors).length > 0) return { ok: false, value: null, errors };
  return {
    ok: true,
    errors,
    value: { method, referenceNumber: ref || null, destinationAccount: dest || null, disbursementDate: date as string, notes },
  };
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export interface JournalLine {
  accountCode: string;
  debit: Cents;
  credit: Cents;
  memo: string;
}

/**
 * The disbursement entry (interest is recognised when collected):
 *   Dr Loans Receivable        principal
 *     Cr Cash / Cash in Bank   net proceeds
 *     Cr Service Fees Income   each fee
 */
export function disbursementJournal(input: {
  principal: Cents;
  fees: ReadonlyArray<{ code: string; label: string; amount: Cents }>;
  method: DisbursementMethod;
}): JournalLine[] {
  const totalFees = sumCents(input.fees.map((f) => f.amount));
  const net = input.principal - totalFees;
  if (net <= 0) throw new RangeError('Net proceeds must be positive.');
  const lines: JournalLine[] = [
    { accountCode: LEDGER_ACCOUNTS.LOANS_RECEIVABLE, debit: input.principal, credit: 0, memo: 'Loan principal released' },
    { accountCode: DISBURSEMENT_SOURCE_ACCOUNT[input.method], debit: 0, credit: net, memo: `Net proceeds (${DISBURSEMENT_METHOD_LABELS[input.method]})` },
  ];
  for (const fee of input.fees) {
    if (fee.amount > 0) lines.push({ accountCode: LEDGER_ACCOUNTS.SERVICE_FEE_INCOME, debit: 0, credit: fee.amount, memo: fee.label });
  }
  return lines;
}

export function isBalanced(lines: readonly JournalLine[]): boolean {
  return lines.length >= 2 && sumCents(lines.map((l) => l.debit)) === sumCents(lines.map((l) => l.credit));
}
