import { describe, expect, it } from 'vitest';
import { assessEligibility, validateApplicationTerms } from './application';
import { disbursementJournal, isBalanced, validateDisbursement } from './disbursement';
import { productFromDto, productToDto, validateProduct, type LoanProduct, type ProductDto } from './products';
import {
  LOAN_STATUSES,
  LOAN_TRANSITIONS,
  LoanTransitionError,
  assertLoanTransition,
  canTransition,
  normaliseLoanStatus,
  reasonRequired,
  withinApprovalLimit,
} from './workflow';

const dto: ProductDto = {
  code: 'ml-micro',
  name: 'Micro-enterprise loan',
  category: 'Livelihood',
  description: 'Working capital',
  interestMethod: 'DIMINISHING',
  annualRate: '12.5',
  minAmount: '5000',
  maxAmount: '100000.00',
  minTermMonths: 3,
  maxTermMonths: '24',
  frequency: 'WEEKLY',
  fees: [{ code: 'processing', label: 'Processing fee', kind: 'PERCENT', value: '2' }],
  penaltyRate: '3',
  lendingType: 'INDIVIDUAL',
  requiresCollateral: false,
  requiresGuarantor: true,
  status: 'ACTIVE',
};

describe('product validation', () => {
  it('normalises a valid product to centavos and ppm', () => {
    const v = validateProduct(dto);
    expect(v.ok).toBe(true);
    expect(v.value).toMatchObject({
      code: 'ML-MICRO',
      annualRate: 125_000,
      minAmount: 500_000,
      maxAmount: 10_000_000,
      maxTermMonths: 24,
      fees: [{ code: 'PROCESSING', kind: 'PERCENT', value: 20_000 }],
      penaltyRate: 30_000,
    });
  });

  it('round-trips through the wire format', () => {
    const v = validateProduct(dto);
    const product: LoanProduct = { id: 'lp-1', ...v.value! };
    expect(productFromDto(productToDto(product))).toEqual(product);
  });

  it('names every invalid field', () => {
    const v = validateProduct({
      ...dto,
      code: 'x',
      interestMethod: 'SIMPLE',
      annualRate: '101',
      minAmount: '5000',
      maxAmount: '1000',
      minTermMonths: 12,
      maxTermMonths: 6,
      frequency: 'DAILY',
      fees: [{ code: 'P', label: '', kind: 'PERCENT', value: '0' }],
      penaltyRate: 'abc',
      lendingType: 'SOLO',
    });
    expect(v.ok).toBe(false);
    expect(Object.keys(v.errors).sort()).toEqual(
      ['annualRate', 'code', 'fees.0', 'frequency', 'interestMethod', 'lendingType', 'maxAmount', 'maxTermMonths', 'penaltyRate'].sort(),
    );
  });

  it('refuses duplicate fee codes', () => {
    const v = validateProduct({ ...dto, fees: [dto.fees[0], { ...dto.fees[0], label: 'again' }] });
    expect(v.errors['fees.1']).toMatch(/twice/);
  });
});

describe('loan workflow', () => {
  it('allows exactly the documented path', () => {
    expect(canTransition('Draft', 'Submitted', 'APPLICANT')).toBe(true);
    expect(canTransition('Submitted', 'Under Review', 'REVIEWER')).toBe(true);
    expect(canTransition('Under Review', 'Approved', 'APPROVER')).toBe(true);
    expect(canTransition('Under Review', 'Rejected', 'APPROVER')).toBe(true);
    expect(canTransition('Approved', 'Disbursed', 'DISBURSER')).toBe(true);
    expect(canTransition('Disbursed', 'Active', 'SYSTEM')).toBe(true);
    expect(canTransition('Active', 'Closed', 'SYSTEM')).toBe(true);
    expect(canTransition('Active', 'Written Off', 'WRITE_OFF')).toBe(true);
  });

  it('rejects skipping steps and the wrong actor', () => {
    expect(() => assertLoanTransition('Submitted', 'Approved', 'APPROVER')).toThrow(LoanTransitionError);
    expect(() => assertLoanTransition('Draft', 'Disbursed', 'DISBURSER')).toThrow(/cannot move/);
    expect(() => assertLoanTransition('Under Review', 'Approved', 'REVIEWER')).toThrow(/not allowed/);
    expect(() => assertLoanTransition('Approved', 'Disbursed', 'APPROVER')).toThrow(/not allowed/);
    expect(() => assertLoanTransition('Active', 'Disbursed', 'DISBURSER')).toThrow(LoanTransitionError);
    expect(LOAN_TRANSITIONS.Closed).toEqual({ Active: ['REVERSER'] });
    for (const terminal of ['Rejected', 'Written Off', 'Cancelled'] as const) {
      expect(Object.keys(LOAN_TRANSITIONS[terminal])).toHaveLength(0);
    }
  });

  it('requires a reason for decisions and returns', () => {
    expect(reasonRequired('Under Review', 'Approved')).toBe(true);
    expect(reasonRequired('Under Review', 'Rejected')).toBe(true);
    expect(reasonRequired('Submitted', 'Draft')).toBe(true);
    expect(reasonRequired('Draft', 'Submitted')).toBe(false);
  });

  it('maps every legacy spelling seen in the live data', () => {
    const live = ['Active', 'Approved', 'Completed', 'Defaulted', 'Disbursed', 'Draft', 'In Arrears', 'PENDING', 'Rejected', 'Submitted', 'Under Review', 'For Assessment', 'Cancelled'];
    for (const s of live) expect(LOAN_STATUSES).toContain(normaliseLoanStatus(s));
    expect(normaliseLoanStatus('Completed')).toBe('Closed');
    expect(normaliseLoanStatus('PENDING')).toBe('Submitted');
    expect(normaliseLoanStatus('nonsense')).toBeNull();
  });

  it('checks approval limits by role', () => {
    expect(withinApprovalLimit(5_000_000, 5_000_000)).toBe(true);
    expect(withinApprovalLimit(5_000_000, 5_000_001)).toBe(false);
    expect(withinApprovalLimit(null, 999_999_999_99)).toBe(true);
    expect(withinApprovalLimit(undefined, 1)).toBe(false);
  });
});

describe('application checks', () => {
  const product = { id: 'lp-1', name: 'Micro loan', minAmount: 500_000, maxAmount: 10_000_000, minTermMonths: 3, maxTermMonths: 24, status: 'ACTIVE' as const, frequency: 'WEEKLY' as const, lendingType: 'INDIVIDUAL' as const };

  it('accepts terms inside the product limits', () => {
    const v = validateApplicationTerms(product, { amount: '25000', termMonths: '6', purpose: 'business', purposeDetails: { businessName: ' Santos Store ', empty: '  ' } });
    expect(v.ok).toBe(true);
    expect(v.value).toEqual({ principal: 2_500_000, termMonths: 6, purpose: 'BUSINESS', purposeDetails: { businessName: 'Santos Store' } });
  });

  it('rejects amounts and terms outside the limits and an inactive product', () => {
    expect(validateApplicationTerms(product, { amount: '4999.99', termMonths: 6, purpose: 'BUSINESS' }).errors.amount).toMatch(/₱5,000.00 to ₱100,000.00/);
    expect(validateApplicationTerms(product, { amount: '5000', termMonths: 25, purpose: 'BUSINESS' }).errors.termMonths).toMatch(/3 to 24/);
    expect(validateApplicationTerms({ ...product, status: 'INACTIVE' }, { amount: '5000', termMonths: 6, purpose: 'BUSINESS' }).errors.product).toBeTruthy();
    expect(validateApplicationTerms(product, { amount: '5000', termMonths: 6, purpose: 'OTHER' }).errors.purposeDetails).toBeTruthy();
  });

  it('applies the lending policy', () => {
    const facts = { kycVerified: true, product, otherLoans: [], overdueLoanNumbers: [], inActiveGroup: false };
    expect(assessEligibility(facts)).toEqual([]);
    expect(assessEligibility({ ...facts, kycVerified: false }).map((i) => i.code)).toEqual(['KYC_REQUIRED']);
    expect(
      assessEligibility({ ...facts, otherLoans: [{ loanNumber: 'LN-1', productId: 'lp-1', status: 'Active' }] }).map((i) => i.code),
    ).toEqual(['DUPLICATE_PRODUCT']);
    expect(assessEligibility({ ...facts, otherLoans: [{ loanNumber: 'LN-1', productId: 'lp-1', status: 'Closed' }] })).toEqual([]);
    expect(assessEligibility({ ...facts, overdueLoanNumbers: ['LN-2'] }).map((i) => i.code)).toEqual(['OVERDUE_LOAN']);
    expect(assessEligibility({ ...facts, product: { ...product, lendingType: 'GROUP' } }).map((i) => i.code)).toEqual(['GROUP_REQUIRED']);
    expect(assessEligibility({ ...facts, product: { ...product, lendingType: 'GROUP' }, inActiveGroup: true })).toEqual([]);
  });
});

describe('disbursement', () => {
  it('requires a transfer reference and destination for bank and e-wallet releases', () => {
    const today = '2026-10-21';
    expect(validateDisbursement({ method: 'CASH', disbursementDate: today }, today).ok).toBe(true);
    const bank = validateDisbursement({ method: 'BANK_TRANSFER', disbursementDate: today }, today);
    expect(Object.keys(bank.errors).sort()).toEqual(['destinationAccount', 'referenceNumber']);
    expect(validateDisbursement({ method: 'E_WALLET', referenceNumber: 'GC-12345', destinationAccount: '09171234567', disbursementDate: today }, today).ok).toBe(true);
    expect(validateDisbursement({ method: 'CASH', disbursementDate: '2026-10-22' }, today).errors.disbursementDate).toMatch(/future/);
    expect(validateDisbursement({ method: 'CASH', disbursementDate: '2026-10-01' }, today).errors.disbursementDate).toMatch(/7 days/);
    expect(validateDisbursement({ method: 'CHECK', disbursementDate: today }, today).errors.method).toBeTruthy();
  });

  it('posts a balanced entry that deducts the fees', () => {
    const lines = disbursementJournal({
      principal: 2_500_000,
      fees: [
        { code: 'PROCESSING', label: 'Processing fee', amount: 50_000 },
        { code: 'NOTARIAL', label: 'Notarial fee', amount: 15_000 },
      ],
      method: 'E_WALLET',
    });
    expect(isBalanced(lines)).toBe(true);
    expect(lines).toEqual([
      expect.objectContaining({ accountCode: '1110', debit: 2_500_000, credit: 0 }),
      expect.objectContaining({ accountCode: '1020', debit: 0, credit: 2_435_000 }),
      expect.objectContaining({ accountCode: '4030', debit: 0, credit: 50_000 }),
      expect.objectContaining({ accountCode: '4030', debit: 0, credit: 15_000 }),
    ]);
    const cash = disbursementJournal({ principal: 1_000_000, fees: [], method: 'CASH' });
    expect(cash.map((l) => l.accountCode)).toEqual(['1110', '1010']);
    expect(isBalanced(cash)).toBe(true);
  });
});
