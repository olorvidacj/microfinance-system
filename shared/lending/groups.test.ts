import { describe, expect, it } from 'vitest';
import {
  activationIssues,
  consentStatus,
  coverLimit,
  dissolutionIssues,
  fundJournal,
  groupLoanBlock,
  groupTransition,
  membershipOpen,
  paymentJournal,
  validateCollection,
  validateGroup,
} from './index';

const group = {
  groupName: 'Bambang Farmers',
  centerName: 'Center 1',
  meetingDay: 'Saturday',
  meetingTime: '09:00',
  meetingFrequency: 'WEEKLY',
  meetingLocation: 'Barangay hall',
  loanOfficerId: 'staff-02',
  arrearsThresholdDays: '7',
};

describe('group details', () => {
  it('accepts a complete group and rejects bad fields', () => {
    expect(validateGroup(group)).toMatchObject({ ok: true, value: { meetingDay: 'Saturday', arrearsThresholdDays: 7 } });
    const bad = validateGroup({ ...group, meetingTime: '9am', meetingDay: 'Funday', loanOfficerId: '', arrearsThresholdDays: '400' });
    expect(Object.keys(bad.errors).sort()).toEqual(['arrearsThresholdDays', 'loanOfficerId', 'meetingDay', 'meetingTime']);
  });
});

describe('group state machine', () => {
  it('allows only the defined transitions', () => {
    expect(groupTransition('FORMING', 'ACTIVATE')).toMatchObject({ ok: true, to: 'ACTIVE' });
    expect(groupTransition('ACTIVE', 'SUSPEND')).toMatchObject({ ok: true, to: 'SUSPENDED' });
    expect(groupTransition('SUSPENDED', 'REINSTATE')).toMatchObject({ ok: true, to: 'ACTIVE' });
    expect(groupTransition('ACTIVE', 'DISSOLVE')).toMatchObject({ ok: true, to: 'DISSOLVED' });
    expect(groupTransition('FORMING', 'SUSPEND').ok).toBe(false);
    expect(groupTransition('DISSOLVED', 'REINSTATE').ok).toBe(false);
    expect(groupTransition('ACTIVE', 'ACTIVATE').ok).toBe(false);
    expect(membershipOpen('SUSPENDED')).toBe(false);
    expect(membershipOpen('FORMING')).toBe(true);
  });

  it('activation needs 3 verified members with a leader, secretary and treasurer', () => {
    const m = (id: string, role: 'LEADER' | 'SECRETARY' | 'TREASURER' | 'MEMBER', kycVerified = true) => ({ borrowerId: id, role, kycVerified });
    expect(activationIssues([m('a', 'LEADER'), m('b', 'MEMBER')])).toEqual([
      'A group needs at least 3 members; it has 2.',
      'Assign a secretary.',
      'Assign a treasurer.',
    ]);
    expect(activationIssues([m('a', 'LEADER'), m('b', 'SECRETARY'), m('c', 'TREASURER', false)])).toEqual(['1 member(s) no longer have verified KYC.']);
    expect(activationIssues([m('a', 'LEADER'), m('b', 'SECRETARY'), m('c', 'TREASURER')])).toEqual([]);
  });

  it('dissolution needs no running loans, no owed covers and an empty fund', () => {
    expect(dissolutionIssues({ runningLoans: 0, outstandingCovers: 0, fundBalance: 0 })).toEqual([]);
    expect(dissolutionIssues({ runningLoans: 1, outstandingCovers: 1, fundBalance: 150000 })).toHaveLength(3);
  });
});

describe('solidarity', () => {
  it('blocks new loans beyond the arrears threshold, and while a cover is owed', () => {
    const arrears = [{ borrowerName: 'Pedro', loanNumber: 'LN-1', oldestDueDate: '2026-10-10' }];
    expect(groupLoanBlock({ today: '2026-10-17', thresholdDays: 7, arrears, covers: [] }).blocked).toBe(false);
    const late = groupLoanBlock({ today: '2026-10-18', thresholdDays: 7, arrears, covers: [] });
    expect(late).toEqual({ blocked: true, reasons: ['Pedro is 8 days behind on LN-1 (limit 7).'] });
    const owed = groupLoanBlock({ today: '2026-10-18', thresholdDays: 7, arrears: [], covers: [{ borrowerName: 'Pedro', coverNumber: 'SC-1', outstanding: 125050 }] });
    expect(owed.reasons).toEqual(['Pedro still owes the solidarity fund ₱1,250.50 (SC-1).']);
    expect(groupLoanBlock({ today: '2026-10-18', thresholdDays: 7, arrears: [], covers: [{ borrowerName: 'Pedro', coverNumber: 'SC-1', outstanding: 0 }] }).blocked).toBe(false);
  });

  it('a loan needs every other member to consent and none to decline', () => {
    const base = { applicantId: 'a', memberIds: ['a', 'b', 'c'] };
    expect(consentStatus({ ...base, consents: [{ borrowerId: 'b', decision: 'CONSENT' }] })).toMatchObject({ complete: false, missing: ['c'] });
    expect(consentStatus({ ...base, consents: [{ borrowerId: 'b', decision: 'CONSENT' }, { borrowerId: 'c', decision: 'CONSENT' }] }).complete).toBe(true);
    expect(consentStatus({ ...base, consents: [{ borrowerId: 'b', decision: 'CONSENT' }, { borrowerId: 'c', decision: 'DECLINE' }] })).toMatchObject({ complete: false, declined: ['c'] });
    // The applicant's own record does not count.
    expect(consentStatus({ applicantId: 'a', memberIds: ['a'], consents: [{ borrowerId: 'a', decision: 'CONSENT' }] }).complete).toBe(false);
  });

  it('the fund covers at most what is overdue and what it holds', () => {
    expect(coverLimit(500000, 120000)).toBe(120000);
    expect(coverLimit(80000, 120000)).toBe(80000);
    expect(coverLimit(0, 120000)).toBe(0);
  });

  it('fund movements and covers are balanced journal entries on 2040', () => {
    expect(fundJournal('CONTRIBUTION', 5000, 'CASH')).toEqual([
      { accountCode: '1010', debit: 5000, credit: 0, memo: 'Contribution' },
      { accountCode: '2040', debit: 0, credit: 5000, memo: 'Contribution' },
    ]);
    expect(fundJournal('REFUND', 5000, 'BANK_TRANSFER').map((l) => `${l.accountCode}:${l.debit}/${l.credit}`)).toEqual(['2040:5000/0', '1020:0/5000']);
    const cover = paymentJournal({ method: 'CASH', penalty: 1000, interest: 20000, principal: 99000, excess: 0, source: { accountCode: '2040', label: 'the solidarity fund' } });
    expect(cover[0]).toMatchObject({ accountCode: '2040', debit: 120000 });
    expect(cover.reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0);
  });
});

describe('group collection', () => {
  it('validates the batch as a whole', () => {
    const ok = validateCollection([
      { borrowerId: 'a', loanId: 'l1', loanAmount: '1250.50', fundAmount: '50' },
      { borrowerId: 'b', fundAmount: '50', coverRepayment: '' },
      { borrowerId: 'c' },
    ]);
    expect(ok).toMatchObject({ ok: true, total: 135050 });
    expect(ok.lines).toHaveLength(2);
    expect(validateCollection([{ borrowerId: 'a', loanAmount: '100' }]).errors).toEqual({ 'lines.0.loanAmount': 'This member has no loan to pay.' });
    expect(validateCollection([{ borrowerId: 'a', fundAmount: '1.005' }]).ok).toBe(false);
    expect(validateCollection([{ borrowerId: 'a', fundAmount: '5' }, { borrowerId: 'a', fundAmount: '5' }]).errors['lines.1']).toBe('This member appears twice.');
    expect(validateCollection([{ borrowerId: 'a' }]).errors).toEqual({ lines: 'Enter at least one amount.' });
  });
});
