/**
 * Savings rules shared by the savings screens and the server.
 *
 * Balances are centavos. An account's balance is the sum of its posted
 * transactions (the subsidiary ledger); the general ledger's savings
 * liability accounts must equal the sum of all account balances.
 *
 * INTEREST (posted once per calendar month, for complete months only):
 *  - AVERAGE_DAILY_BALANCE: sum of each day's closing balance x annual rate / 365.
 *  - MINIMUM_BALANCE: the lowest closing balance in the month x annual rate x days / 365.
 *  No interest is paid for a month whose average (or minimum) balance is below
 *  the product's minimum balance. Rounded half-up to the centavo.
 *
 * WITHDRAWALS are refused when the account is frozen, dormant or closed; when
 * the product does not allow them (compulsory savings; a time deposit before
 * maturity); when they exceed the per-transaction limit or the monthly count;
 * or when they would leave less than the minimum balance (except when closing).
 */

import { DISBURSEMENT_SOURCE_ACCOUNT, type DisbursementMethod, type JournalLine } from './disbursement';
import { applyRate, formatPeso, parsePercent, parsePesos, centsToDecimal, ppmToPercent, type Cents, type Ppm } from './money';

export const SAVINGS_KINDS = ['REGULAR', 'COMPULSORY', 'TIME_DEPOSIT'] as const;
export type SavingsKind = (typeof SAVINGS_KINDS)[number];
export const SAVINGS_KIND_LABELS: Readonly<Record<SavingsKind, string>> = {
  REGULAR: 'Regular savings',
  COMPULSORY: 'Compulsory / group savings',
  TIME_DEPOSIT: 'Time deposit',
};

export const ACCRUAL_METHODS = ['AVERAGE_DAILY_BALANCE', 'MINIMUM_BALANCE'] as const;
export type AccrualMethod = (typeof ACCRUAL_METHODS)[number];
export const ACCRUAL_METHOD_LABELS: Readonly<Record<AccrualMethod, string>> = {
  AVERAGE_DAILY_BALANCE: 'Average daily balance',
  MINIMUM_BALANCE: 'Lowest balance in the month',
};

export const SAVINGS_STATUSES = ['ACTIVE', 'DORMANT', 'FROZEN', 'CLOSED'] as const;
export type SavingsStatus = (typeof SAVINGS_STATUSES)[number];

/** Months without a member transaction before an account becomes dormant. */
export const DORMANCY_MONTHS = 24;

export interface SavingsProduct {
  id: string;
  code: string;
  name: string;
  kind: SavingsKind;
  annualRate: Ppm;
  accrualMethod: AccrualMethod;
  minimumBalance: Cents;
  minimumOpeningDeposit: Cents;
  /** Largest single withdrawal; null = no limit. */
  maxWithdrawalAmount: Cents | null;
  /** Withdrawals allowed per calendar month; null = no limit. */
  maxWithdrawalsPerMonth: number | null;
  /** Time deposits: months to maturity. */
  termMonths: number | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface SavingsProductDto {
  id?: string;
  code: string;
  name: string;
  kind: string;
  annualRate: string;
  accrualMethod: string;
  minimumBalance: string;
  minimumOpeningDeposit: string;
  maxWithdrawalAmount: string;
  maxWithdrawalsPerMonth: string | number;
  termMonths: string | number;
  status: string;
}

export function validateSavingsProduct(dto: Partial<SavingsProductDto>): { ok: boolean; value: Omit<SavingsProduct, 'id'> | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const code = String(dto.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(code)) errors.code = 'Use 2-20 capital letters, digits or dashes.';
  const name = String(dto.name ?? '').trim();
  if (name.length < 3) errors.name = 'Give the product a name.';
  const kind = dto.kind as SavingsKind;
  if (!(SAVINGS_KINDS as readonly string[]).includes(kind)) errors.kind = 'Choose regular, compulsory or time deposit.';
  const annualRate = parsePercent(dto.annualRate);
  if (annualRate === null || annualRate > 1_000_000) errors.annualRate = 'Enter an annual rate from 0 to 100%.';
  const accrualMethod = dto.accrualMethod as AccrualMethod;
  if (!(ACCRUAL_METHODS as readonly string[]).includes(accrualMethod)) errors.accrualMethod = 'Choose how interest accrues.';
  const minimumBalance = parsePesos(dto.minimumBalance ?? '0');
  if (minimumBalance === null) errors.minimumBalance = 'Enter the minimum balance.';
  const minimumOpeningDeposit = parsePesos(dto.minimumOpeningDeposit ?? '0');
  if (minimumOpeningDeposit === null) errors.minimumOpeningDeposit = 'Enter the minimum opening deposit.';
  const maxWithdrawalAmount = dto.maxWithdrawalAmount === undefined || dto.maxWithdrawalAmount === '' ? null : parsePesos(dto.maxWithdrawalAmount);
  if (dto.maxWithdrawalAmount && (maxWithdrawalAmount === null || maxWithdrawalAmount <= 0)) errors.maxWithdrawalAmount = 'Enter a positive amount or leave it empty for no limit.';
  const perMonthRaw = String(dto.maxWithdrawalsPerMonth ?? '').trim();
  const maxWithdrawalsPerMonth = perMonthRaw === '' ? null : /^\d{1,3}$/.test(perMonthRaw) ? Number(perMonthRaw) : NaN;
  if (Number.isNaN(maxWithdrawalsPerMonth)) errors.maxWithdrawalsPerMonth = 'Enter a whole number or leave it empty.';
  const termRaw = String(dto.termMonths ?? '').trim();
  const termMonths = termRaw === '' ? null : /^\d{1,3}$/.test(termRaw) ? Number(termRaw) : NaN;
  if (kind === 'TIME_DEPOSIT' && (termMonths === null || Number.isNaN(termMonths) || termMonths < 1 || termMonths > 120)) errors.termMonths = 'A time deposit needs a term of 1 to 120 months.';
  if (kind !== 'TIME_DEPOSIT' && termMonths !== null) errors.termMonths = 'Only time deposits have a term.';
  const status = (dto.status ?? 'ACTIVE') as SavingsProduct['status'];
  if (status !== 'ACTIVE' && status !== 'INACTIVE') errors.status = 'Status must be ACTIVE or INACTIVE.';
  if (Object.keys(errors).length) return { ok: false, value: null, errors };
  return {
    ok: true,
    errors,
    value: {
      code,
      name,
      kind,
      annualRate: annualRate as Ppm,
      accrualMethod,
      minimumBalance: minimumBalance as Cents,
      minimumOpeningDeposit: minimumOpeningDeposit as Cents,
      maxWithdrawalAmount,
      maxWithdrawalsPerMonth: maxWithdrawalsPerMonth as number | null,
      termMonths: termMonths as number | null,
      status,
    },
  };
}

export function savingsProductToDto(p: SavingsProduct): SavingsProductDto & { id: string } {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    kind: p.kind,
    annualRate: ppmToPercent(p.annualRate),
    accrualMethod: p.accrualMethod,
    minimumBalance: centsToDecimal(p.minimumBalance),
    minimumOpeningDeposit: centsToDecimal(p.minimumOpeningDeposit),
    maxWithdrawalAmount: p.maxWithdrawalAmount === null ? '' : centsToDecimal(p.maxWithdrawalAmount),
    maxWithdrawalsPerMonth: p.maxWithdrawalsPerMonth === null ? '' : p.maxWithdrawalsPerMonth,
    termMonths: p.termMonths === null ? '' : p.termMonths,
    status: p.status,
  };
}

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------

export interface WithdrawalCheck {
  ok: boolean;
  code: 'OK' | 'ACCOUNT_FROZEN' | 'ACCOUNT_DORMANT' | 'ACCOUNT_CLOSED' | 'NOT_WITHDRAWABLE' | 'NOT_MATURED' | 'OVER_LIMIT' | 'MONTHLY_LIMIT' | 'BELOW_MINIMUM' | 'INSUFFICIENT';
  message: string;
  /** Most that could be withdrawn now. */
  available: Cents;
}

export function checkWithdrawal(input: {
  status: SavingsStatus;
  balance: Cents;
  product: Pick<SavingsProduct, 'kind' | 'minimumBalance' | 'maxWithdrawalAmount' | 'maxWithdrawalsPerMonth'>;
  amount: Cents;
  withdrawalsThisMonth: number;
  maturityDate: string | null;
  today: string;
  /** Closing the account pays out everything, ignoring the minimum balance. */
  closing?: boolean;
}): WithdrawalCheck {
  const { product, balance, amount } = input;
  const minimum = input.closing ? 0 : product.minimumBalance;
  const available = Math.max(0, balance - minimum);
  const no = (code: WithdrawalCheck['code'], message: string): WithdrawalCheck => ({ ok: false, code, message, available });
  if (input.status === 'CLOSED') return no('ACCOUNT_CLOSED', 'This account is closed.');
  if (input.status === 'FROZEN') return no('ACCOUNT_FROZEN', 'This account is frozen; withdrawals are blocked until it is released.');
  if (input.status === 'DORMANT') return no('ACCOUNT_DORMANT', 'This account is dormant. The member must visit the branch to reactivate it.');
  if (!input.closing && product.kind === 'COMPULSORY') return no('NOT_WITHDRAWABLE', 'Compulsory savings can only be withdrawn when the account is closed.');
  if (!input.closing && product.kind === 'TIME_DEPOSIT' && input.maturityDate && input.today < input.maturityDate) {
    return no('NOT_MATURED', `This time deposit matures on ${input.maturityDate}.`);
  }
  if (!input.closing && product.maxWithdrawalAmount !== null && amount > product.maxWithdrawalAmount) {
    return no('OVER_LIMIT', `A single withdrawal is limited to ${formatPeso(product.maxWithdrawalAmount)}.`);
  }
  if (!input.closing && product.maxWithdrawalsPerMonth !== null && input.withdrawalsThisMonth >= product.maxWithdrawalsPerMonth) {
    return no('MONTHLY_LIMIT', `Only ${product.maxWithdrawalsPerMonth} withdrawal(s) are allowed per month.`);
  }
  if (amount > balance) return no('INSUFFICIENT', `The balance is only ${formatPeso(balance)}.`);
  if (amount > available) return no('BELOW_MINIMUM', `The account must keep ${formatPeso(product.minimumBalance)}; at most ${formatPeso(available)} can be withdrawn.`);
  return { ok: true, code: 'OK', message: 'OK', available };
}

// ---------------------------------------------------------------------------
// Interest
// ---------------------------------------------------------------------------

export function periodOf(date: string): string {
  return date.slice(0, 7);
}

export function periodBounds(period: string): { start: string; end: string; days: number } {
  const [y, m] = period.split('-').map(Number);
  const end = new Date(Date.UTC(y, m, 0));
  return { start: `${period}-01`, end: end.toISOString().slice(0, 10), days: end.getUTCDate() };
}

/** Complete calendar months from the month of `from` up to the month before `today`. */
export function completePeriods(from: string, today: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const current = periodOf(today);
  for (let i = 0; i < 1200; i++) {
    const p = `${y}-${String(m).padStart(2, '0')}`;
    if (p >= current) break;
    out.push(p);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export interface DatedMovement {
  date: string;
  /** Positive for money in, negative for money out. */
  amount: Cents;
}

/** Closing balance of each day in the period. */
export function dailyBalances(opening: Cents, movements: readonly DatedMovement[], period: string): Cents[] {
  const { start, days } = periodBounds(period);
  const byDay = new Map<string, Cents>();
  for (const mv of movements) {
    if (periodOf(mv.date) !== period) continue;
    byDay.set(mv.date, (byDay.get(mv.date) ?? 0) + mv.amount);
  }
  const out: Cents[] = [];
  let balance = opening;
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    balance += byDay.get(d.toISOString().slice(0, 10)) ?? 0;
    out.push(balance);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function interestForPeriod(input: {
  opening: Cents;
  movements: readonly DatedMovement[];
  period: string;
  annualRate: Ppm;
  method: AccrualMethod;
  minimumBalance: Cents;
}): { base: Cents; interest: Cents } {
  const balances = dailyBalances(input.opening, input.movements, input.period);
  const days = balances.length;
  if (input.annualRate <= 0 || days === 0) return { base: 0, interest: 0 };
  if (input.method === 'MINIMUM_BALANCE') {
    const min = Math.max(0, Math.min(...balances));
    if (min < input.minimumBalance || min === 0) return { base: min, interest: 0 };
    return { base: min, interest: applyRate(min, input.annualRate, days, 365) };
  }
  const sum = balances.reduce((s, b) => s + Math.max(0, b), 0);
  const average = Math.floor(sum / days);
  if (average < input.minimumBalance || sum === 0) return { base: average, interest: 0 };
  return { base: average, interest: applyRate(sum, input.annualRate, 1, 365) };
}

// ---------------------------------------------------------------------------
// Transactions and ledger
// ---------------------------------------------------------------------------

export const SAVINGS_TXN_KINDS = ['DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'OPENING_BALANCE', 'TRANSFER_IN', 'TRANSFER_OUT', 'PAYOUT_REFUND'] as const;
export type SavingsTxnKind = (typeof SAVINGS_TXN_KINDS)[number];
export const SAVINGS_TXN_LABELS: Readonly<Record<SavingsTxnKind, string>> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  INTEREST: 'Interest',
  OPENING_BALANCE: 'Opening balance (migrated)',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
  PAYOUT_REFUND: 'Payout returned',
};

export const SAVINGS_LEDGER = {
  SAVINGS_PAYABLE: '2010',
  SPECIAL_DEPOSITS_PAYABLE: '2020',
  SAVINGS_INTEREST_EXPENSE: '4040',
  /** Money the payment provider holds for the cooperative (online deposits in, payouts out). */
  DUE_FROM_PROVIDER: '1030',
} as const;

/** Time deposits sit in Special Deposits Payable; other savings in Savings Deposits Payable. */
export function liabilityAccount(kind: SavingsKind): string {
  return kind === 'TIME_DEPOSIT' ? SAVINGS_LEDGER.SPECIAL_DEPOSITS_PAYABLE : SAVINGS_LEDGER.SAVINGS_PAYABLE;
}

/**
 * The journal for a savings movement. The cash side is the method's account
 * (cash on hand or bank), or `source` when given: online payments post against
 * 1030 Due from Payment Provider. A PAYOUT_REFUND returns a failed payout.
 */
export function savingsJournal(
  kind: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST' | 'PAYOUT_REFUND',
  productKind: SavingsKind,
  amount: Cents,
  method: DisbursementMethod = 'CASH',
  source: string = DISBURSEMENT_SOURCE_ACCOUNT[method],
): JournalLine[] {
  if (amount <= 0) throw new RangeError('Nothing to post.');
  const liability = liabilityAccount(productKind);
  if (kind === 'PAYOUT_REFUND') {
    return [
      { accountCode: source, debit: amount, credit: 0, memo: 'Failed payout returned to savings' },
      { accountCode: liability, debit: 0, credit: amount, memo: 'Failed payout returned to savings' },
    ];
  }
  if (kind === 'DEPOSIT') {
    return [
      { accountCode: source, debit: amount, credit: 0, memo: 'Savings deposit' },
      { accountCode: liability, debit: 0, credit: amount, memo: 'Savings deposit' },
    ];
  }
  if (kind === 'WITHDRAWAL') {
    return [
      { accountCode: liability, debit: amount, credit: 0, memo: 'Savings withdrawal' },
      { accountCode: source, debit: 0, credit: amount, memo: 'Savings withdrawal' },
    ];
  }
  return [
    { accountCode: SAVINGS_LEDGER.SAVINGS_INTEREST_EXPENSE, debit: amount, credit: 0, memo: 'Interest credited to savings' },
    { accountCode: liability, debit: 0, credit: amount, memo: 'Interest credited to savings' },
  ];
}

export const WITHDRAWAL_DESTINATIONS = ['CASH_PICKUP', 'BANK_TRANSFER', 'E_WALLET'] as const;
export type WithdrawalDestination = (typeof WITHDRAWAL_DESTINATIONS)[number];
export const WITHDRAWAL_DESTINATION_LABELS: Readonly<Record<WithdrawalDestination, string>> = {
  CASH_PICKUP: 'Cash pick-up at the branch',
  BANK_TRANSFER: 'Bank transfer',
  E_WALLET: 'E-wallet',
};

export function destinationMethod(d: WithdrawalDestination): DisbursementMethod {
  return d === 'CASH_PICKUP' ? 'CASH' : d;
}
