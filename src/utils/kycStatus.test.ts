import { describe, it, expect } from 'vitest';
import {
  KYC_STATUSES,
  OPEN_KYC_STATUSES,
  normaliseKycStatus,
  isLoanEligible,
  isAwaitingReview,
  canResubmit,
  kycGateMessage,
} from './kycStatus';

describe('normaliseKycStatus', () => {
  it('passes the eight canonical statuses through unchanged', () => {
    for (const s of KYC_STATUSES) {
      expect(normaliseKycStatus(s)).toBe(s);
    }
  });

  it('maps the legacy spellings', () => {
    expect(normaliseKycStatus('PENDING')).toBe('SUBMITTED');
    expect(normaliseKycStatus('VERIFIED')).toBe('APPROVED');
  });

  it('is case and whitespace insensitive', () => {
    expect(normaliseKycStatus('  verified ')).toBe('APPROVED');
    expect(normaliseKycStatus('pending')).toBe('SUBMITTED');
  });

  it('treats an unknown or absent value as NOT_STARTED, never as approved', () => {
    // The whole point: a vocabulary nobody has seen must not be read as benign.
    expect(normaliseKycStatus('TOTALLY_MADE_UP')).toBe('NOT_STARTED');
    expect(normaliseKycStatus('')).toBe('NOT_STARTED');
    expect(normaliseKycStatus(null)).toBe('NOT_STARTED');
    expect(normaliseKycStatus(undefined)).toBe('NOT_STARTED');
  });
});

describe('isLoanEligible', () => {
  it('allows APPROVED', () => {
    expect(isLoanEligible('APPROVED')).toBe(true);
  });

  it('allows the legacy VERIFIED spelling so existing members are not locked out', () => {
    expect(isLoanEligible('VERIFIED')).toBe(true);
  });

  it('refuses PENDING -- the bug that let an unreviewed submission reach a loan', () => {
    // This is the regression test for the actual defect: the old gate blocked
    // NOT_STARTED, REJECTED and CORRECTION_REQUIRED and allowed everything else,
    // so a KYC no human had looked at unlocked a real loan application.
    expect(isLoanEligible('PENDING')).toBe(false);
  });

  it('refuses every status that is not a completed approval', () => {
    for (const s of KYC_STATUSES) {
      if (s === 'APPROVED') continue;
      expect(isLoanEligible(s), `${s} must not be loan eligible`).toBe(false);
    }
  });

  it('refuses anything unrecognised', () => {
    expect(isLoanEligible('APPROVED_BY_ACCIDENT')).toBe(false);
    expect(isLoanEligible('')).toBe(false);
    expect(isLoanEligible(null)).toBe(false);
    expect(isLoanEligible(undefined)).toBe(false);
  });

  it('agrees with APPROVED_KYC_STATUSES plus the legacy alias', () => {
    const bySet = KYC_STATUSES.filter((s) => isLoanEligible(s));
    expect(bySet).toEqual(['APPROVED']);
  });
});

describe('isAwaitingReview', () => {
  it('is true only for submitted and under review', () => {
    expect(isAwaitingReview('SUBMITTED')).toBe(true);
    expect(isAwaitingReview('UNDER_REVIEW')).toBe(true);
    expect(isAwaitingReview('PENDING')).toBe(true); // legacy alias for SUBMITTED
    expect(isAwaitingReview('APPROVED')).toBe(false);
    expect(isAwaitingReview('REJECTED')).toBe(false);
  });
});

describe('canResubmit', () => {
  it('allows the client to correct a rejected or incomplete application', () => {
    expect(canResubmit('NOT_STARTED')).toBe(true);
    expect(canResubmit('IN_PROGRESS')).toBe(true);
    expect(canResubmit('CORRECTION_REQUIRED')).toBe(true);
    expect(canResubmit('REJECTED')).toBe(true);
  });

  it('refuses to let a client overwrite something already with a reviewer', () => {
    expect(canResubmit('SUBMITTED')).toBe(false);
    expect(canResubmit('PENDING')).toBe(false);
    expect(canResubmit('UNDER_REVIEW')).toBe(false);
    expect(canResubmit('APPROVED')).toBe(false);
    expect(canResubmit('SUSPENDED')).toBe(false);
  });
});

describe('OPEN_KYC_STATUSES', () => {
  it('covers every status except APPROVED', () => {
    expect([...OPEN_KYC_STATUSES].sort()).toEqual(
      KYC_STATUSES.filter((s) => s !== 'APPROVED').slice().sort(),
    );
  });
});

describe('kycGateMessage', () => {
  it('gives a distinct, actionable message for each blocking status', () => {
    const messages = new Set<string>();
    for (const s of OPEN_KYC_STATUSES) {
      const m = kycGateMessage(s);
      expect(m.length, `${s} needs a message`).toBeGreaterThan(20);
      messages.add(m);
    }
    // Not a hard requirement, but if these collapse to one string the client is
    // being told nothing about what to actually do next.
    expect(messages.size).toBeGreaterThan(1);
  });

  it('never promises that a loan is allowed', () => {
    for (const s of KYC_STATUSES) {
      expect(kycGateMessage(s).toLowerCase()).not.toContain('eligible');
    }
  });

  it('falls back to a safe message for an unknown status', () => {
    const m = kycGateMessage('SOMETHING_NEW');
    expect(m).toMatch(/not complete|contact your branch/i);
  });
});
