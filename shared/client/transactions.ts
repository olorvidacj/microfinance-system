/**
 * The member's transaction history, read from the transaction register that
 * every money movement writes (loan release, repayment, reversal, savings,
 * solidarity fund). One classification for the server, web portal and app.
 */
export const TRANSACTION_KINDS = [
  'LOAN_REPAYMENT',
  'LOAN_DISBURSEMENT',
  'PAYMENT_REVERSAL',
  'SAVINGS_DEPOSIT',
  'SAVINGS_WITHDRAWAL',
  'SAVINGS_INTEREST',
  'GROUP_FUND',
  'OTHER',
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const TRANSACTION_KIND_LABELS: Readonly<Record<TransactionKind, string>> = {
  LOAN_REPAYMENT: 'Loan repayment',
  LOAN_DISBURSEMENT: 'Loan released',
  PAYMENT_REVERSAL: 'Payment reversed',
  SAVINGS_DEPOSIT: 'Savings deposit',
  SAVINGS_WITHDRAWAL: 'Savings withdrawal',
  SAVINGS_INTEREST: 'Savings interest',
  GROUP_FUND: 'Solidarity fund',
  OTHER: 'Other',
};

/** The register's transaction_type text as a kind. */
export function transactionKindOf(registerType: string): TransactionKind {
  const t = registerType.trim().toLowerCase();
  if (t === 'loan repayment') return 'LOAN_REPAYMENT';
  if (t === 'loan disbursement') return 'LOAN_DISBURSEMENT';
  if (t === 'reversal') return 'PAYMENT_REVERSAL';
  if (t === 'savings deposit') return 'SAVINGS_DEPOSIT';
  if (t === 'savings withdrawal') return 'SAVINGS_WITHDRAWAL';
  if (t === 'savings interest') return 'SAVINGS_INTEREST';
  if (t.startsWith('solidarity fund')) return 'GROUP_FUND';
  return 'OTHER';
}

/**
 * From the member's side: 'IN' reached the member or their accounts (a loan
 * release, a deposit, interest, a reversed payment, a fund cover or refund);
 * 'OUT' is money the member paid or took out of savings.
 */
export function transactionDirection(registerType: string): 'IN' | 'OUT' {
  const kind = transactionKindOf(registerType);
  if (kind === 'LOAN_REPAYMENT' || kind === 'SAVINGS_WITHDRAWAL') return 'OUT';
  if (kind === 'GROUP_FUND') return /contribution|paid back/i.test(registerType) ? 'OUT' : 'IN';
  return 'IN';
}

export const TRANSACTION_PERIODS = [
  { id: 'ALL', label: 'All time', days: null },
  { id: '30D', label: 'Last 30 days', days: 30 },
  { id: '90D', label: 'Last 90 days', days: 90 },
  { id: '1Y', label: 'Last year', days: 365 },
] as const;
export type TransactionPeriod = (typeof TRANSACTION_PERIODS)[number]['id'];

/** The first date (YYYY-MM-DD) a period covers, counting back from `today`; null for all time. */
export function periodStart(period: TransactionPeriod, today: string): string | null {
  const days = TRANSACTION_PERIODS.find((p) => p.id === period)?.days ?? null;
  if (days === null) return null;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
