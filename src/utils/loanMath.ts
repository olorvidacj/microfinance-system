import { InstallmentScheduleItem, InterestType, RepaymentFrequency } from '../types';

export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface AmortizationCalculationResult {
  totalInstallments: number;
  installmentAmount: number;
  totalInterest: number;
  totalPayable: number;
  processingFee: number;
  schedule: InstallmentScheduleItem[];
}

export function calculateLoanSchedule(params: {
  principal: number;
  annualInterestRate: number; // e.g. 12 for 12%
  termMonths: number;
  interestType: InterestType;
  repaymentFrequency: RepaymentFrequency;
  processingFeePercentage: number;
  startDate?: string;
}): AmortizationCalculationResult {
  const {
    principal,
    annualInterestRate,
    termMonths,
    interestType,
    repaymentFrequency,
    processingFeePercentage,
    startDate = new Date().toISOString().split('T')[0],
  } = params;

  // Determine periods per year & total periods
  let periodsPerYear = 12;
  let totalInstallments = termMonths;

  if (repaymentFrequency === 'Daily') {
    periodsPerYear = 300; // standard working days or 30 days/month
    totalInstallments = Math.max(1, termMonths * 24); // 24 working days/month
  } else if (repaymentFrequency === 'Weekly') {
    periodsPerYear = 52;
    totalInstallments = Math.max(1, Math.round((termMonths * 52) / 12));
  } else if (repaymentFrequency === 'Semi-monthly' || repaymentFrequency === 'Bi-Weekly') {
    periodsPerYear = 24;
    totalInstallments = Math.max(1, termMonths * 2);
  } else {
    periodsPerYear = 12;
    totalInstallments = termMonths;
  }

  const processingFee = Math.round(principal * (processingFeePercentage / 100) * 100) / 100;
  const schedule: InstallmentScheduleItem[] = [];
  const baseDate = new Date(startDate);

  let totalInterest = 0;
  let installmentAmount = 0;

  if (interestType === 'Flat Rate') {
    const years = termMonths / 12;
    totalInterest = Math.round(principal * (annualInterestRate / 100) * years * 100) / 100;
    const totalPrincipalAndInterest = principal + totalInterest;
    installmentAmount = Math.round((totalPrincipalAndInterest / totalInstallments) * 100) / 100;

    const periodicPrincipal = Math.round((principal / totalInstallments) * 100) / 100;
    const periodicInterest = Math.round((totalInterest / totalInstallments) * 100) / 100;

    let balance = principal;

    for (let i = 1; i <= totalInstallments; i++) {
      let dueDate: Date;
      if (repaymentFrequency === 'Daily') {
        dueDate = addDays(baseDate, i);
      } else if (repaymentFrequency === 'Weekly') {
        dueDate = addWeeks(baseDate, i);
      } else if (repaymentFrequency === 'Semi-monthly' || repaymentFrequency === 'Bi-Weekly') {
        dueDate = addDays(baseDate, i * 15);
      } else {
        dueDate = addMonths(baseDate, i);
      }

      const pPortion = i === totalInstallments ? balance : periodicPrincipal;
      balance = Math.max(0, Math.round((balance - pPortion) * 100) / 100);

      schedule.push({
        installmentNumber: i,
        dueDate: dueDate.toISOString().split('T')[0],
        principal: pPortion,
        interest: periodicInterest,
        fees: 0,
        totalDue: Math.round((pPortion + periodicInterest) * 100) / 100,
        amountPaid: 0,
        remainingBalance: balance,
        status: 'Pending',
      });
    }
  } else {
    // Reducing Balance (Standard Amortized Annuity / EMI)
    const periodicRate = (annualInterestRate / 100) / periodsPerYear;

    if (periodicRate > 0) {
      installmentAmount =
        Math.round(
          (principal * (periodicRate * Math.pow(1 + periodicRate, totalInstallments))) /
            (Math.pow(1 + periodicRate, totalInstallments) - 1) *
            100
        ) / 100;
    } else {
      installmentAmount = Math.round((principal / totalInstallments) * 100) / 100;
    }

    let currentBalance = principal;

    for (let i = 1; i <= totalInstallments; i++) {
      let dueDate: Date;
      if (repaymentFrequency === 'Daily') {
        dueDate = addDays(baseDate, i);
      } else if (repaymentFrequency === 'Weekly') {
        dueDate = addWeeks(baseDate, i);
      } else if (repaymentFrequency === 'Semi-monthly' || repaymentFrequency === 'Bi-Weekly') {
        dueDate = addDays(baseDate, i * 15);
      } else {
        dueDate = addMonths(baseDate, i);
      }

      const interestForPeriod = Math.round(currentBalance * periodicRate * 100) / 100;
      let principalForPeriod = Math.round((installmentAmount - interestForPeriod) * 100) / 100;

      if (i === totalInstallments || principalForPeriod > currentBalance) {
        principalForPeriod = currentBalance;
        installmentAmount = Math.round((principalForPeriod + interestForPeriod) * 100) / 100;
      }

      currentBalance = Math.max(0, Math.round((currentBalance - principalForPeriod) * 100) / 100);
      totalInterest += interestForPeriod;

      schedule.push({
        installmentNumber: i,
        dueDate: dueDate.toISOString().split('T')[0],
        principal: principalForPeriod,
        interest: interestForPeriod,
        fees: 0,
        totalDue: Math.round((principalForPeriod + interestForPeriod) * 100) / 100,
        amountPaid: 0,
        remainingBalance: currentBalance,
        status: 'Pending',
      });
    }
    totalInterest = Math.round(totalInterest * 100) / 100;
  }

  const totalPayable = Math.round((principal + totalInterest) * 100) / 100;

  return {
    totalInstallments,
    installmentAmount,
    totalInterest,
    totalPayable,
    processingFee,
    schedule,
  };
}

/**
 * 2. SAVINGS: 1% Annual Interest calculated monthly based on savings balance
 */
export function calculateMonthlySavingsInterest(savingsBalance: number, annualRate: number = 0.01): number {
  if (savingsBalance <= 0) return 0;
  // 1% per annum credited monthly = balance * (0.01 / 12)
  const monthlyRate = annualRate / 12;
  return Math.round(savingsBalance * monthlyRate * 100) / 100;
}

/**
 * CANONICAL LOAN BALANCE INVARIANT.
 *
 * The single source of truth for outstanding loan balance across every page,
 * endpoint and report:
 *
 *     remainingBalance = totalPayable - totalPaid
 *
 * `totalPayable` already includes principal + interest (and any processing fee
 * folded in by the caller). `totalPaid` is clamped to `totalPayable` so a
 * loan can never settle below zero, and `remainingBalance` is clamped at zero
 * so it can never go negative.
 *
 * Every write path that touches loans.totalPaid or loans.totalPayable MUST use
 * this function. Setting remainingBalance to `principal` is incorrect: it
 * understates the obligation by the full interest amount and lets a client
 * overpay by that difference.
 */
export function computeLoanRemainingBalance(
  totalPayable: number | null | undefined,
  totalPaid: number | null | undefined
): number {
  const payable = Number(totalPayable) || 0;
  const paid = Math.min(Math.max(Number(totalPaid) || 0, 0), Math.max(payable, 0));
  return Math.max(0, Math.round((payable - paid) * 100) / 100);
}

/**
 * Applies a payment to a loan and returns the full, consistent set of money
 * fields. Use this instead of hand-editing totalPaid/remainingBalance so the
 * invariant cannot drift between endpoints.
 */
export function applyPaymentToLoanTotals(
  loan: { totalPayable?: number | null; totalPaid?: number | null },
  paymentAmount: number
): { totalPaid: number; remainingBalance: number } {
  const payable = Number(loan.totalPayable) || 0;
  const currentPaid = Number(loan.totalPaid) || 0;
  const applied = Math.max(0, Math.min(Number(paymentAmount) || 0, Math.max(payable - currentPaid, 0)));
  const totalPaid = Math.round((currentPaid + applied) * 100) / 100;
  return { totalPaid, remainingBalance: computeLoanRemainingBalance(payable, totalPaid) };
}

/**
 * CANONICAL MEMBER SAVINGS TOTAL.
 *
 * `borrowers.savings_balance` is a denormalised cache of the member's TOTAL
 * savings across every savings account they hold. It is NOT a single account's
 * balance.
 *
 * Deriving it as a SUM is what makes multi-account members safe. If a write path
 * instead copies one account's balance into this column, a member with accounts
 * A=5,000 and B=5,000 ends up with savings_balance=5,000, and a withdrawal of
 * 5,000 against account A is validated against the member total but applied to
 * the account - creating money that was never deposited.
 *
 * Always derive the total with this helper (or an equivalent SQL SUM) and never
 * author the column from a single account row.
 */
export function sumSavingsAccountBalances(
  accounts: Array<{ balance?: number | null }> | null | undefined
): number {
  if (!Array.isArray(accounts)) return 0;
  const total = accounts.reduce((sum, a) => sum + (Number(a?.balance) || 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Guards a savings withdrawal against the account's minimum maintaining balance.
 * Shared so the client self-service path cannot drive an account below the
 * threshold that the branch counter path enforces.
 */
export function canWithdrawFromSavings(
  accountBalance: number,
  amount: number,
  maintainingBalance: number
): { allowed: boolean; available: number; balanceAfter: number } {
  const balance = Number(accountBalance) || 0;
  const req = Number(amount) || 0;
  const maintaining = Number(maintainingBalance) || 0;
  const available = Math.max(0, Math.round((balance - maintaining) * 100) / 100);
  return {
    allowed: req > 0 && req <= available + 0.01,
    available,
    balanceAfter: Math.max(0, Math.round((balance - req) * 100) / 100),
  };
}

/**
 * 3. ADVANCE PAYMENT REBATE:
 * Members may pay loans in advance and receive a rebate on unaccrued future interest
 */
export function calculateAdvancePaymentRebate(
  remainingBalance: number,
  unpaidInterest: number,
  rebateRatePercentage: number = 20
): number {
  if (remainingBalance <= 0 || unpaidInterest <= 0) return 0;
  return Math.round(unpaidInterest * (rebateRatePercentage / 100) * 100) / 100;
}

/**
 * 4. LATE PAYMENT PENALTY:
 * Calculated based on overdue amount and days in arrears
 */
export function calculateLatePenalty(
  overdueAmount: number,
  daysOverdue: number,
  monthlyPenaltyRate: number = 2 // 2% per month
): number {
  if (overdueAmount <= 0 || daysOverdue <= 0) return 0;
  const dailyRate = (monthlyPenaltyRate / 100) / 30;
  return Math.round(overdueAmount * dailyRate * daysOverdue * 100) / 100;
}

/**
 * 5. INSTALLMENT STATUS EVALUATOR
 * Dynamically computes installment status based on payment progress and due date.
 * Accepts either an InstallmentScheduleItem object or (dueDate, totalDue, amountPaid, referenceDateStr).
 */
export function getComputedInstallmentStatus(
  itemOrDueDate: { dueDate: string; totalDue: number; amountPaid?: number } | string,
  totalDue?: number,
  amountPaid?: number,
  referenceDateStr?: string
): 'Upcoming' | 'Due' | 'Partially Paid' | 'Paid' | 'Overdue' {
  let due = '';
  let dueAmt = 0;
  let paidAmt = 0;
  let refDate = referenceDateStr;

  if (typeof itemOrDueDate === 'object' && itemOrDueDate !== null) {
    due = itemOrDueDate.dueDate;
    dueAmt = itemOrDueDate.totalDue;
    paidAmt = itemOrDueDate.amountPaid || 0;
  } else if (typeof itemOrDueDate === 'string') {
    due = itemOrDueDate;
    dueAmt = totalDue || 0;
    paidAmt = amountPaid || 0;
  }

  if (paidAmt >= dueAmt - 0.001 && dueAmt > 0) {
    return 'Paid';
  }

  const today = refDate || new Date().toISOString().split('T')[0];
  const dueDay = due ? due.split('T')[0] : today;

  if (paidAmt > 0) {
    return 'Partially Paid';
  }

  if (dueDay < today) {
    return 'Overdue';
  }
  if (dueDay === today) {
    return 'Due';
  }
  return 'Upcoming';
}

/**
 * 6. ALLOCATE PAYMENT ACROSS INSTALLMENT SCHEDULE
 * Applies a payment sequentially to outstanding installments and calculates principal, interest, and remaining balance.
 */
export function allocatePaymentToSchedule(
  schedule: InstallmentScheduleItem[],
  paymentAmount: number,
  paymentDateStr?: string
): {
  updatedSchedule: InstallmentScheduleItem[];
  principalPaid: number;
  interestPaid: number;
  remainingUnallocated: number;
} {
  let unallocated = paymentAmount;
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;
  const dateStr = paymentDateStr || new Date().toISOString().split('T')[0];

  const updatedSchedule = schedule.map((item) => {
    const currentPaid = item.amountPaid || 0;
    const unpaidAmount = Math.max(0, item.totalDue - currentPaid);

    if (unpaidAmount <= 0.001) {
      return {
        ...item,
        status: 'Paid' as const,
        amountPaid: item.totalDue,
      };
    }

    if (unallocated > 0) {
      const payToThis = Math.min(unallocated, unpaidAmount);
      const newPaid = Math.round((currentPaid + payToThis) * 100) / 100;
      unallocated = Math.max(0, Math.round((unallocated - payToThis) * 100) / 100);

      // Apportion principal vs interest for this installment
      const principalRatio = item.totalDue > 0 ? item.principal / item.totalDue : 1;
      const interestRatio = item.totalDue > 0 ? item.interest / item.totalDue : 0;

      const pPaid = Math.round(payToThis * principalRatio * 100) / 100;
      const iPaid = Math.round((payToThis - pPaid) * 100) / 100;

      totalPrincipalPaid += pPaid;
      totalInterestPaid += iPaid;

      const isFullyPaid = newPaid >= item.totalDue - 0.001;

      return {
        ...item,
        amountPaid: isFullyPaid ? item.totalDue : newPaid,
        status: isFullyPaid ? ('Paid' as const) : ('Partially Paid' as const),
        paidDate: isFullyPaid ? dateStr : item.paidDate || dateStr,
      };
    }

    // Unpaid installment with no payment applied in this run
    return {
      ...item,
      status: getComputedInstallmentStatus(item.dueDate, item.totalDue, item.amountPaid, dateStr),
    };
  });

  return {
    updatedSchedule,
    principalPaid: Math.round(totalPrincipalPaid * 100) / 100,
    interestPaid: Math.round(totalInterestPaid * 100) / 100,
    remainingUnallocated: unallocated,
  };
}

/**
 * 7. NUMBER TO WORDS CONVERTER (PHILIPPINE PESO RECEIPT CONVENTION)
 */
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero Pesos Only';
  if (isNaN(num) || num < 0) return '';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion'];

  function convertGroup(n: number): string {
    let groupStr = '';
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;

    if (hundred > 0) {
      groupStr += units[hundred] + ' Hundred ';
    }

    if (remainder >= 10 && remainder < 20) {
      groupStr += teens[remainder - 10] + ' ';
    } else {
      const ten = Math.floor(remainder / 10);
      const unit = remainder % 10;
      if (ten > 0) groupStr += tens[ten] + ' ';
      if (unit > 0) groupStr += units[unit] + ' ';
    }

    return groupStr.trim();
  }

  const integerPart = Math.floor(num);
  const centsPart = Math.round((num - integerPart) * 100);

  let currentNum = integerPart;
  let scaleIndex = 0;
  let words = '';

  while (currentNum > 0) {
    const group = currentNum % 1000;
    if (group > 0) {
      const groupText = convertGroup(group);
      words = groupText + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : '') + ' ' + words;
    }
    currentNum = Math.floor(currentNum / 1000);
    scaleIndex++;
  }

  words = words.trim();
  if (!words) words = 'Zero';

  let result = words + ' Pesos';
  if (centsPart > 0) {
    result += ` and ${centsPart}/100`;
  }
  return result + ' Only';
}


