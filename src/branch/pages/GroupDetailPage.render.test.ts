import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { GroupOverview } from './GroupDetailPage';
import type { GroupDetailView } from '../services';

/**
 * Regression for the GroupDetailPage crash: the page must render every shape
 * the server can send, including a forming group with no members, a group
 * migrated from the old jsonb (no leader, members without loans) and a
 * blocked group.
 */
const base: GroupDetailView = {
  group: {
    id: 'grp-1',
    groupCode: 'GRP-2026-0001',
    groupName: 'Bambang Farmers',
    centerName: 'Center 1',
    branchId: 'br-a',
    status: 'FORMING',
    statusReason: null,
    formedDate: '2026-10-21',
    meetingDay: 'Saturday',
    meetingTime: '09:00',
    meetingFrequency: 'WEEKLY',
    meetingLocation: 'Barangay hall',
    loanOfficerId: 'st-1',
    loanOfficerName: 'Grace Mendoza',
    leaderBorrowerId: null,
    leaderName: null,
    arrearsThresholdDays: 7,
    fundBalance: '0.00',
  },
  members: [],
  block: { blocked: false, reasons: [] },
  activationIssues: ['A group needs at least 3 members; it has 0.', 'Assign a leader.', 'Assign a secretary.', 'Assign a treasurer.'],
};
const can = { manage: true, sensitive: true, collect: true };
const render = (detail: GroupDetailView) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(GroupOverview, { detail, can })));

describe('GroupDetailPage rendering', () => {
  it('a forming group with no members and no leader', () => {
    const html = render(base);
    expect(html).toContain('No members yet');
    expect(html).toContain('Assign a leader.');
    expect(html).toContain('Not assigned');
  });

  it('a migrated group whose members have no loans and whose leader column is empty', () => {
    const html = render({
      ...base,
      group: { ...base.group, status: 'ACTIVE', statusReason: 'Status "Active" carried over', fundBalance: '14500.00' },
      members: [
        { borrowerId: 'b1', memberNumber: '', fullName: 'Ana Cruz', phone: '', role: 'TREASURER', joinedAt: '2026-01-01', kycVerified: false, loans: [], coverOwed: '0.00', standing: 'GOOD' },
      ],
      activationIssues: [],
    });
    expect(html).toContain('Ana Cruz');
    expect(html).toContain('KYC not verified');
    expect(html).toContain('₱14,500.00');
  });

  it('a blocked group shows why, with arrears and covers', () => {
    const html = render({
      ...base,
      group: { ...base.group, status: 'ACTIVE', leaderBorrowerId: 'b1', leaderName: 'Ana Cruz' },
      members: [
        {
          borrowerId: 'b1',
          memberNumber: 'CLI-1',
          fullName: 'Ana Cruz',
          phone: '0917',
          role: 'LEADER',
          joinedAt: '2026-01-01',
          kycVerified: true,
          loans: [{ id: 'l1', loanNumber: 'LN-2026-000001', status: 'Active', remaining: '20600.00', overdue: '10609.00', dueToday: '10609.00', oldestOverdue: '2026-10-11' }],
          coverOwed: '500.00',
          standing: 'IN_ARREARS',
        },
      ],
      block: { blocked: true, reasons: ['Ana Cruz is 10 days behind on LN-2026-000001 (limit 7).'] },
      activationIssues: [],
    });
    expect(html).toContain('cannot take new loans');
    expect(html).toContain('10 days behind');
    expect(html).toContain('₱10,609.00');
    expect(html).toContain('Behind');
  });
});
