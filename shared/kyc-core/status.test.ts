import { describe, expect, it } from 'vitest';
import {
  KYC_STATUSES,
  KYC_TRANSITIONS,
  KycTransitionError,
  assertTransition,
  canTransition,
  isEditableByClient,
  isKycVerified,
  kycGateMessage,
  kycStatusLabel,
  normaliseKycStatus,
  parseKycDecision,
  type KycActor,
  type KycStatus,
} from './status';

describe('normaliseKycStatus', () => {
  it.each([
    ['APPROVED', 'APPROVED'],
    ['Verified', 'APPROVED'],
    ['VERIFIED', 'APPROVED'],
    ['pending', 'SUBMITTED'],
    ['Pending Review', 'SUBMITTED'],
    ['RESUBMITTED', 'SUBMITTED'],
    ['Correction Requested', 'CORRECTION_REQUIRED'],
    ['resubmission_required', 'CORRECTION_REQUIRED'],
    ['resubmission-required', 'CORRECTION_REQUIRED'],
    ['in review', 'UNDER_REVIEW'],
    ['draft', 'IN_PROGRESS'],
    ['  rejected  ', 'REJECTED'],
  ])('maps %j to %s', (raw, expected) => {
    expect(normaliseKycStatus(raw)).toBe(expected);
  });

  it('never turns an unknown or empty value into a verified state', () => {
    for (const raw of [null, undefined, '', 'ok', 'APPROVED!', 'yes', 'VERIFIED_MAYBE']) {
      expect(normaliseKycStatus(raw)).toBe('NOT_STARTED');
    }
  });

  it('is idempotent on every canonical status', () => {
    for (const s of KYC_STATUSES) expect(normaliseKycStatus(s)).toBe(s);
  });
});

describe('transition graph', () => {
  const allowed: Array<[KycActor, KycStatus, KycStatus]> = [
    ['client', 'NOT_STARTED', 'IN_PROGRESS'],
    ['client', 'IN_PROGRESS', 'SUBMITTED'],
    ['client', 'CORRECTION_REQUIRED', 'SUBMITTED'],
    ['client', 'REJECTED', 'IN_PROGRESS'],
    ['staff', 'SUBMITTED', 'UNDER_REVIEW'],
    ['staff', 'UNDER_REVIEW', 'APPROVED'],
    ['staff', 'UNDER_REVIEW', 'REJECTED'],
    ['staff', 'UNDER_REVIEW', 'CORRECTION_REQUIRED'],
    ['staff', 'UNDER_REVIEW', 'SUBMITTED'],
    ['staff_sensitive', 'APPROVED', 'SUSPENDED'],
  ];
  it.each(allowed)('%s may move %s -> %s', (actor, from, to) => {
    expect(canTransition(from, to, actor)).toBe(true);
  });

  const refused: Array<[KycActor, KycStatus, KycStatus]> = [
    ['staff', 'SUBMITTED', 'APPROVED'], // must be claimed first
    ['staff', 'NOT_STARTED', 'APPROVED'], // never submitted
    ['staff', 'REJECTED', 'APPROVED'],
    ['staff', 'APPROVED', 'SUSPENDED'], // needs staff_sensitive
    ['client', 'IN_PROGRESS', 'APPROVED'],
    ['client', 'SUBMITTED', 'IN_PROGRESS'], // frozen while waiting for review
    ['client', 'UNDER_REVIEW', 'SUBMITTED'],
    ['client', 'APPROVED', 'IN_PROGRESS'],
  ];
  it.each(refused)('%s may not move %s -> %s', (actor, from, to) => {
    expect(canTransition(from, to, actor)).toBe(false);
    expect(() => assertTransition(from, to, actor)).toThrow(KycTransitionError);
  });

  it('only staff_sensitive can suspend and only from APPROVED', () => {
    const suspendEdges = Object.entries(KYC_TRANSITIONS).flatMap(([actor, edges]) =>
      edges.filter(([, to]) => to === 'SUSPENDED').map(([from]) => `${actor}:${from}`),
    );
    expect(suspendEdges).toEqual(['staff_sensitive:APPROVED']);
  });

  it('a transition error carries a 409 status for the API', () => {
    try {
      assertTransition('NOT_STARTED', 'APPROVED', 'staff');
    } catch (e) {
      expect((e as KycTransitionError).status).toBe(409);
    }
  });
});

describe('member-facing helpers', () => {
  it('labels APPROVED as Verified and CORRECTION_REQUIRED as Resubmission required', () => {
    expect(kycStatusLabel('APPROVED')).toBe('Verified');
    expect(kycStatusLabel('VERIFIED')).toBe('Verified');
    expect(kycStatusLabel('CORRECTION_REQUIRED')).toBe('Resubmission required');
    expect(kycStatusLabel('SUBMITTED')).toBe('Pending review');
  });

  it('only APPROVED passes the gate', () => {
    expect(isKycVerified('APPROVED')).toBe(true);
    expect(isKycVerified('Verified')).toBe(true);
    for (const s of KYC_STATUSES.filter((x) => x !== 'APPROVED')) expect(isKycVerified(s)).toBe(false);
    expect(kycGateMessage('UNDER_REVIEW')).toMatch(/being reviewed/);
    expect(kycGateMessage('nonsense')).toMatch(/complete your KYC/);
  });

  it('lets the member edit only before submission or after a returned decision', () => {
    expect(isEditableByClient('IN_PROGRESS')).toBe(true);
    expect(isEditableByClient('REJECTED')).toBe(true);
    expect(isEditableByClient('CORRECTION_REQUIRED')).toBe(true);
    expect(isEditableByClient('SUBMITTED')).toBe(false);
    expect(isEditableByClient('UNDER_REVIEW')).toBe(false);
    expect(isEditableByClient('APPROVED')).toBe(false);
  });

  it('parses decisions in either vocabulary', () => {
    expect(parseKycDecision('approve')).toBe('APPROVE');
    expect(parseKycDecision('verified')).toBe('APPROVE');
    expect(parseKycDecision('resubmission_required')).toBe('REQUEST_RESUBMISSION');
    expect(parseKycDecision('REQUEST_CORRECTION')).toBe('REQUEST_RESUBMISSION');
    expect(parseKycDecision('reject')).toBe('REJECT');
    expect(parseKycDecision('suspend')).toBeNull();
    expect(parseKycDecision(undefined)).toBeNull();
  });
});
