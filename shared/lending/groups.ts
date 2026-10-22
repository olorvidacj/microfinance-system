/**
 * Group lending and the solidarity mechanism: the rules shared by the server
 * and the screens.
 *
 * Approach (docs/GROUP_LENDING.md): one loan per member under the group. Each
 * member applies for a GROUP product; the loan carries the group's id. Before
 * approval, every other active member of the group must have consented (they
 * are jointly liable, so the consent doubles as the guarantor record), and no
 * member may have declined.
 *
 * Solidarity: when a member falls behind, the group and its leader are told
 * once per overdue installment. The group's solidarity fund can pay the
 * member's overdue amount; that is posted as a loan payment funded by the fund
 * (Dr 2040 Group Solidarity Fund Payable) and recorded as a cover the member
 * owes back to the fund. While any member is in arrears beyond the group's
 * threshold, or owes the fund for a cover, the group takes no new loans.
 */
import { formatPeso, parsePesos, type Cents } from './money';
import { DISBURSEMENT_SOURCE_ACCOUNT, type DisbursementMethod } from './disbursement';
import { daysBetween } from './repayment';
import type { JournalLine } from './disbursement';

export const GROUP_ROLES = ['LEADER', 'SECRETARY', 'TREASURER', 'MEMBER'] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];
export const GROUP_ROLE_LABELS: Readonly<Record<GroupRole, string>> = { LEADER: 'Leader', SECRETARY: 'Secretary', TREASURER: 'Treasurer', MEMBER: 'Member' };
/** Roles held by one member at a time. */
export const OFFICER_ROLES: readonly GroupRole[] = ['LEADER', 'SECRETARY', 'TREASURER'];

export const GROUP_STATUSES = ['FORMING', 'ACTIVE', 'SUSPENDED', 'DISSOLVED'] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];
export const GROUP_STATUS_LABELS: Readonly<Record<GroupStatus, string>> = { FORMING: 'Forming', ACTIVE: 'Active', SUSPENDED: 'Suspended', DISSOLVED: 'Dissolved' };

export const GROUP_ACTIONS = ['ACTIVATE', 'SUSPEND', 'REINSTATE', 'DISSOLVE'] as const;
export type GroupAction = (typeof GROUP_ACTIONS)[number];
/** The group state machine: which statuses each action starts from, and where it leads. */
export const GROUP_TRANSITIONS: Readonly<Record<GroupAction, { from: readonly GroupStatus[]; to: GroupStatus }>> = {
  ACTIVATE: { from: ['FORMING'], to: 'ACTIVE' },
  SUSPEND: { from: ['ACTIVE'], to: 'SUSPENDED' },
  REINSTATE: { from: ['SUSPENDED'], to: 'ACTIVE' },
  DISSOLVE: { from: ['FORMING', 'ACTIVE', 'SUSPENDED'], to: 'DISSOLVED' },
};

export function groupTransition(from: GroupStatus, action: GroupAction): { ok: boolean; to: GroupStatus | null; message: string } {
  const rule = GROUP_TRANSITIONS[action];
  if (!rule) return { ok: false, to: null, message: `Unknown action ${action}.` };
  if (!rule.from.includes(from)) return { ok: false, to: null, message: `A ${GROUP_STATUS_LABELS[from].toLowerCase()} group cannot be ${action === 'ACTIVATE' ? 'activated' : action.toLowerCase() + 'ed'}.` };
  return { ok: true, to: rule.to, message: 'OK' };
}

/** Members an active group needs: one each for leader, secretary and treasurer. */
export const GROUP_MIN_MEMBERS = 3;
export const GROUP_MAX_MEMBERS = 30;

/** Membership changes are only possible while a group is forming or active. */
export function membershipOpen(status: GroupStatus): boolean {
  return status === 'FORMING' || status === 'ACTIVE';
}

export const MEETING_FREQUENCIES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
export type MeetingFrequency = (typeof MEETING_FREQUENCIES)[number];
export const MEETING_FREQUENCY_LABELS: Readonly<Record<MeetingFrequency, string>> = { WEEKLY: 'Every week', BIWEEKLY: 'Every two weeks', MONTHLY: 'Every month' };
export const MEETING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'EXCUSED'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface GroupInput {
  groupName: string;
  centerName: string;
  meetingDay: string;
  meetingTime: string;
  meetingFrequency: string;
  meetingLocation: string;
  loanOfficerId: string;
  arrearsThresholdDays: string | number;
}

export interface GroupValues {
  groupName: string;
  centerName: string;
  meetingDay: (typeof MEETING_DAYS)[number];
  meetingTime: string;
  meetingFrequency: MeetingFrequency;
  meetingLocation: string;
  loanOfficerId: string;
  arrearsThresholdDays: number;
}

/** Group details and schedule, the same on the form and on the server. */
export function validateGroup(dto: Partial<GroupInput>): { ok: boolean; value: GroupValues | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const text = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  const groupName = text(dto.groupName, 80);
  if (groupName.length < 3) errors.groupName = 'Give the group a name (at least 3 characters).';
  const centerName = text(dto.centerName, 80);
  if (centerName.length < 2) errors.centerName = 'Enter the center the group belongs to.';
  const meetingDay = text(dto.meetingDay, 12) as GroupValues['meetingDay'];
  if (!(MEETING_DAYS as readonly string[]).includes(meetingDay)) errors.meetingDay = 'Choose the meeting day.';
  const meetingTime = text(dto.meetingTime, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(meetingTime)) errors.meetingTime = 'Enter the time as HH:MM (24-hour).';
  const meetingFrequency = text(dto.meetingFrequency || 'WEEKLY', 10) as MeetingFrequency;
  if (!(MEETING_FREQUENCIES as readonly string[]).includes(meetingFrequency)) errors.meetingFrequency = 'Choose how often the group meets.';
  const meetingLocation = text(dto.meetingLocation, 120);
  if (meetingLocation.length < 3) errors.meetingLocation = 'Enter where the group meets.';
  const loanOfficerId = text(dto.loanOfficerId, 80);
  if (!loanOfficerId) errors.loanOfficerId = 'Assign the loan officer.';
  const rawDays = String(dto.arrearsThresholdDays ?? '7').trim();
  const arrearsThresholdDays = /^\d{1,3}$/.test(rawDays) ? Number(rawDays) : NaN;
  if (!(arrearsThresholdDays >= 0 && arrearsThresholdDays <= 90)) errors.arrearsThresholdDays = 'Enter 0 to 90 days.';
  if (Object.keys(errors).length) return { ok: false, value: null, errors };
  return { ok: true, errors, value: { groupName, centerName, meetingDay, meetingTime, meetingFrequency, meetingLocation, loanOfficerId, arrearsThresholdDays } };
}

export interface GroupMemberFact {
  borrowerId: string;
  role: GroupRole;
  kycVerified: boolean;
}

/** What still stops a forming group from becoming active. */
export function activationIssues(members: readonly GroupMemberFact[]): string[] {
  const issues: string[] = [];
  if (members.length < GROUP_MIN_MEMBERS) issues.push(`A group needs at least ${GROUP_MIN_MEMBERS} members; it has ${members.length}.`);
  for (const role of OFFICER_ROLES) {
    if (!members.some((m) => m.role === role)) issues.push(`Assign a ${GROUP_ROLE_LABELS[role].toLowerCase()}.`);
  }
  const unverified = members.filter((m) => !m.kycVerified).length;
  if (unverified) issues.push(`${unverified} member(s) no longer have verified KYC.`);
  return issues;
}

/** What stops a group from being dissolved. */
export function dissolutionIssues(f: { runningLoans: number; outstandingCovers: number; fundBalance: Cents }): string[] {
  const issues: string[] = [];
  if (f.runningLoans) issues.push(`${f.runningLoans} group loan(s) are still running.`);
  if (f.outstandingCovers) issues.push(`${f.outstandingCovers} solidarity cover(s) are not yet paid back.`);
  if (f.fundBalance > 0) issues.push(`The solidarity fund still holds ${formatPeso(f.fundBalance)}; refund it first.`);
  return issues;
}

export interface ArrearsFact {
  borrowerName: string;
  loanNumber: string;
  /** Oldest unpaid installment due date (YYYY-MM-DD). */
  oldestDueDate: string;
}

export interface CoverFact {
  borrowerName: string;
  coverNumber: string;
  outstanding: Cents;
}

/**
 * Whether the group may take a new loan: blocked while a member's loan is past
 * due by more than the group's threshold, or a member still owes the fund for a
 * cover (the fund paid their arrears; until they repay it, the arrears are the
 * group's).
 */
export function groupLoanBlock(f: { today: string; thresholdDays: number; arrears: readonly ArrearsFact[]; covers: readonly CoverFact[] }): { blocked: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const a of f.arrears) {
    const days = daysBetween(a.oldestDueDate, f.today);
    if (days > f.thresholdDays) reasons.push(`${a.borrowerName} is ${days} days behind on ${a.loanNumber} (limit ${f.thresholdDays}).`);
  }
  for (const c of f.covers) {
    if (c.outstanding > 0) reasons.push(`${c.borrowerName} still owes the solidarity fund ${formatPeso(c.outstanding)} (${c.coverNumber}).`);
  }
  return { blocked: reasons.length > 0, reasons };
}

export const CONSENT_DECISIONS = ['CONSENT', 'DECLINE'] as const;
export type ConsentDecision = (typeof CONSENT_DECISIONS)[number];

/** Consent of the other active members to one member's group loan. */
export function consentStatus(f: { applicantId: string; memberIds: readonly string[]; consents: readonly { borrowerId: string; decision: ConsentDecision }[] }) {
  const required = f.memberIds.filter((id) => id !== f.applicantId);
  const byMember = new Map(f.consents.map((c) => [c.borrowerId, c.decision]));
  const consented = required.filter((id) => byMember.get(id) === 'CONSENT');
  const declined = required.filter((id) => byMember.get(id) === 'DECLINE');
  const missing = required.filter((id) => !byMember.has(id));
  return { required, consented, declined, missing, complete: required.length > 0 && missing.length === 0 && declined.length === 0 };
}

/** The solidarity fund's liability account. */
export const GROUP_FUND_ACCOUNT = '2040';
export const GROUP_FUND_KINDS = ['OPENING_BALANCE', 'CONTRIBUTION', 'COVER', 'COVER_REPAYMENT', 'REFUND'] as const;
export type GroupFundKind = (typeof GROUP_FUND_KINDS)[number];
export const GROUP_FUND_KIND_LABELS: Readonly<Record<GroupFundKind, string>> = {
  OPENING_BALANCE: 'Opening balance (migrated)',
  CONTRIBUTION: 'Contribution',
  COVER: 'Covered a member',
  COVER_REPAYMENT: 'Cover paid back',
  REFUND: 'Refund to members',
};

/** Money into the fund (a contribution or a cover being paid back) or out of it (a refund). */
export function fundJournal(kind: 'CONTRIBUTION' | 'COVER_REPAYMENT' | 'REFUND', amount: Cents, method: DisbursementMethod): JournalLine[] {
  if (amount <= 0) throw new RangeError('Nothing to post.');
  const cash = DISBURSEMENT_SOURCE_ACCOUNT[method];
  const memo = GROUP_FUND_KIND_LABELS[kind];
  return kind === 'REFUND'
    ? [
        { accountCode: GROUP_FUND_ACCOUNT, debit: amount, credit: 0, memo },
        { accountCode: cash, debit: 0, credit: amount, memo },
      ]
    : [
        { accountCode: cash, debit: amount, credit: 0, memo },
        { accountCode: GROUP_FUND_ACCOUNT, debit: 0, credit: amount, memo },
      ];
}

/** The most the fund can pay for a member now: what is due on the loan, up to the fund balance. */
export function coverLimit(fundBalance: Cents, amountDue: Cents): Cents {
  return Math.max(0, Math.min(fundBalance, amountDue));
}

export interface CollectionLineInput {
  borrowerId: string;
  loanId?: string | null;
  loanAmount?: unknown;
  fundAmount?: unknown;
  coverRepayment?: unknown;
}

export interface CollectionLine {
  borrowerId: string;
  loanId: string | null;
  loanAmount: Cents;
  fundAmount: Cents;
  coverRepayment: Cents;
}

/** A batch of payments taken at a group meeting; validated as a whole, posted as a whole. */
export function validateCollection(lines: readonly CollectionLineInput[]): { ok: boolean; lines: CollectionLine[]; total: Cents; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const out: CollectionLine[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, lines: [], total: 0, errors: { lines: 'Enter at least one payment.' } };
  lines.forEach((l, i) => {
    const borrowerId = String(l?.borrowerId ?? '').trim();
    if (!borrowerId) errors[`lines.${i}`] = 'Member missing.';
    else if (seen.has(borrowerId)) errors[`lines.${i}`] = 'This member appears twice.';
    seen.add(borrowerId);
    const amt = (v: unknown, field: string): Cents => {
      if (v === undefined || v === null || v === '') return 0;
      const c = parsePesos(v);
      if (c === null || c < 0) {
        errors[`lines.${i}.${field}`] = 'Enter pesos and centavos only.';
        return 0;
      }
      return c;
    };
    const line: CollectionLine = {
      borrowerId,
      loanId: l?.loanId ? String(l.loanId) : null,
      loanAmount: amt(l?.loanAmount, 'loanAmount'),
      fundAmount: amt(l?.fundAmount, 'fundAmount'),
      coverRepayment: amt(l?.coverRepayment, 'coverRepayment'),
    };
    if (line.loanAmount > 0 && !line.loanId) errors[`lines.${i}.loanAmount`] = 'This member has no loan to pay.';
    if (line.loanAmount + line.fundAmount + line.coverRepayment > 0) out.push(line);
  });
  const total = out.reduce((s, l) => s + l.loanAmount + l.fundAmount + l.coverRepayment, 0);
  if (!Object.keys(errors).length && total <= 0) errors.lines = 'Enter at least one amount.';
  return { ok: Object.keys(errors).length === 0, lines: out, total, errors };
}
