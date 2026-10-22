/**
 * Loan product definition and its validation, shared by ProductModal and the
 * product endpoints. On the wire every amount and rate is a decimal string
 * ("5000.00", "12.5"); in code they are centavos and ppm.
 */

import {
  FEE_KINDS,
  MAX_TERM_MONTHS,
  isInterestMethod,
  isRepaymentFrequency,
  quoteLoan,
  type LoanQuote,
  type FeeKind,
  type FeeRule,
  type InterestMethod,
  type RepaymentFrequency,
} from './calculator';
import { centsToDecimal, parsePercent, parsePesos, ppmToPercent, type Cents, type Ppm } from './money';

export const LENDING_TYPES = ['INDIVIDUAL', 'GROUP'] as const;
export type LendingType = (typeof LENDING_TYPES)[number];
export const LENDING_TYPE_LABELS: Readonly<Record<LendingType, string>> = { INDIVIDUAL: 'Individual', GROUP: 'Group' };

export const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface LoanProduct {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  interestMethod: InterestMethod;
  /** Annual rate. */
  annualRate: Ppm;
  minAmount: Cents;
  maxAmount: Cents;
  minTermMonths: number;
  maxTermMonths: number;
  frequency: RepaymentFrequency;
  fees: FeeRule[];
  /** Penalty per month on an overdue installment. */
  penaltyRate: Ppm;
  lendingType: LendingType;
  requiresCollateral: boolean;
  requiresGuarantor: boolean;
  status: ProductStatus;
}

/** A product as sent over HTTP and edited in forms. */
export interface ProductDto {
  id?: string;
  code: string;
  name: string;
  category: string;
  description: string;
  interestMethod: string;
  annualRate: string;
  minAmount: string;
  maxAmount: string;
  minTermMonths: number | string;
  maxTermMonths: number | string;
  frequency: string;
  fees: { code: string; label: string; kind: string; value: string }[];
  penaltyRate: string;
  lendingType: string;
  requiresCollateral: boolean;
  requiresGuarantor: boolean;
  status: string;
}

export type ProductErrors = Partial<Record<keyof ProductDto | `fees.${number}`, string>>;

export interface ProductValidation {
  ok: boolean;
  value: Omit<LoanProduct, 'id'> | null;
  errors: ProductErrors;
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,19}$/;
const FEE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,29}$/;

function wholeMonths(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,3}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= MAX_TERM_MONTHS ? n : null;
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function validateProduct(input: Partial<ProductDto> | null | undefined): ProductValidation {
  const dto = (input || {}) as Partial<ProductDto>;
  const errors: ProductErrors = {};

  const code = text(dto.code, 40).toUpperCase();
  if (!CODE_PATTERN.test(code)) errors.code = 'Use 2-20 capital letters, digits or dashes (for example ML-MICRO).';
  const name = text(dto.name, 120);
  if (name.length < 3) errors.name = 'Give the product a name.';
  const category = text(dto.category, 80);
  if (!category) errors.category = 'Choose a category.';
  const description = text(dto.description, 500);

  const interestMethod = dto.interestMethod;
  if (!isInterestMethod(interestMethod)) errors.interestMethod = 'Choose flat or diminishing balance.';
  const annualRate = parsePercent(dto.annualRate);
  if (annualRate === null || annualRate > 1_000_000) errors.annualRate = 'Enter an annual rate from 0 to 100% (up to 4 decimals).';

  const minAmount = parsePesos(dto.minAmount);
  const maxAmount = parsePesos(dto.maxAmount);
  if (minAmount === null || minAmount < 100) errors.minAmount = 'Enter a minimum amount of at least ₱1.00.';
  if (maxAmount === null) errors.maxAmount = 'Enter a maximum amount.';
  else if (minAmount !== null && maxAmount < minAmount) errors.maxAmount = 'The maximum must not be below the minimum.';

  const minTermMonths = wholeMonths(dto.minTermMonths);
  const maxTermMonths = wholeMonths(dto.maxTermMonths);
  if (minTermMonths === null) errors.minTermMonths = `Enter whole months from 1 to ${MAX_TERM_MONTHS}.`;
  if (maxTermMonths === null) errors.maxTermMonths = `Enter whole months from 1 to ${MAX_TERM_MONTHS}.`;
  else if (minTermMonths !== null && maxTermMonths < minTermMonths) errors.maxTermMonths = 'The maximum term must not be below the minimum.';

  const frequency = dto.frequency;
  if (!isRepaymentFrequency(frequency)) errors.frequency = 'Choose weekly, bi-weekly or monthly.';

  const fees: FeeRule[] = [];
  const seen = new Set<string>();
  (Array.isArray(dto.fees) ? dto.fees : []).forEach((f, i) => {
    const feeCode = text(f?.code, 30).toUpperCase();
    const label = text(f?.label, 80);
    const kind = f?.kind as FeeKind;
    const value = kind === 'PERCENT' ? parsePercent(f?.value) : kind === 'FIXED' ? parsePesos(f?.value) : null;
    if (!FEE_CODE_PATTERN.test(feeCode) || !label || !(FEE_KINDS as readonly string[]).includes(kind) || value === null || value <= 0) {
      errors[`fees.${i}`] = 'Each fee needs a code (like PROCESSING), a label, a type and an amount above zero.';
    } else if (seen.has(feeCode)) {
      errors[`fees.${i}`] = `The fee code ${feeCode} is used twice.`;
    } else if (kind === 'PERCENT' && value >= 1_000_000) {
      errors[`fees.${i}`] = 'A percentage fee must be below 100%.';
    } else {
      seen.add(feeCode);
      fees.push({ code: feeCode, label, kind, value });
    }
  });
  if (fees.length > 10) errors.fees = 'A product can have at most 10 fees.';

  const penaltyRate = parsePercent(dto.penaltyRate);
  if (penaltyRate === null || penaltyRate > 1_000_000) errors.penaltyRate = 'Enter a monthly penalty rate from 0 to 100%.';

  const lendingType = dto.lendingType as LendingType;
  if (!(LENDING_TYPES as readonly string[]).includes(lendingType)) errors.lendingType = 'Choose individual or group.';
  const status = (dto.status ?? 'ACTIVE') as ProductStatus;
  if (!(PRODUCT_STATUSES as readonly string[]).includes(status)) errors.status = 'Status must be ACTIVE or INACTIVE.';

  if (Object.keys(errors).length > 0) return { ok: false, value: null, errors };
  return {
    ok: true,
    errors,
    value: {
      code,
      name,
      category,
      description,
      interestMethod: interestMethod as InterestMethod,
      annualRate: annualRate as Ppm,
      minAmount: minAmount as Cents,
      maxAmount: maxAmount as Cents,
      minTermMonths: minTermMonths as number,
      maxTermMonths: maxTermMonths as number,
      frequency: frequency as RepaymentFrequency,
      fees,
      penaltyRate: penaltyRate as Ppm,
      lendingType,
      requiresCollateral: dto.requiresCollateral === true,
      requiresGuarantor: dto.requiresGuarantor === true,
      status,
    },
  };
}

export function feeRuleToDto(f: FeeRule): ProductDto['fees'][number] {
  return { code: f.code, label: f.label, kind: f.kind, value: f.kind === 'PERCENT' ? ppmToPercent(f.value) : centsToDecimal(f.value) };
}

export function productToDto(p: LoanProduct): ProductDto & { id: string } {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    description: p.description,
    interestMethod: p.interestMethod,
    annualRate: ppmToPercent(p.annualRate),
    minAmount: centsToDecimal(p.minAmount),
    maxAmount: centsToDecimal(p.maxAmount),
    minTermMonths: p.minTermMonths,
    maxTermMonths: p.maxTermMonths,
    frequency: p.frequency,
    fees: p.fees.map(feeRuleToDto),
    penaltyRate: ppmToPercent(p.penaltyRate),
    lendingType: p.lendingType,
    requiresCollateral: p.requiresCollateral,
    requiresGuarantor: p.requiresGuarantor,
    status: p.status,
  };
}

/** Reads a product received over HTTP. Throws if the server sent something invalid. */
export function productFromDto(dto: ProductDto): LoanProduct {
  const v = validateProduct(dto);
  if (!v.ok || !v.value || !dto.id) throw new Error(`Invalid loan product from server: ${JSON.stringify(v.errors)}`);
  return { id: dto.id, ...v.value };
}

/** The schedule a product gives for these terms, starting on `startDate`. */
export function quoteProduct(product: LoanProduct, principal: Cents, termMonths: number, startDate: string): LoanQuote {
  return quoteLoan({
    principal,
    termMonths,
    annualRate: product.annualRate,
    method: product.interestMethod,
    frequency: product.frequency,
    fees: product.fees,
    startDate,
  });
}

/** An empty form for a new product. */
export function blankProductDto(): ProductDto {
  return {
    code: '',
    name: '',
    category: '',
    description: '',
    interestMethod: 'DIMINISHING',
    annualRate: '',
    minAmount: '',
    maxAmount: '',
    minTermMonths: '',
    maxTermMonths: '',
    frequency: 'MONTHLY',
    fees: [],
    penaltyRate: '',
    lendingType: 'INDIVIDUAL',
    requiresCollateral: false,
    requiresGuarantor: false,
    status: 'ACTIVE',
  };
}
