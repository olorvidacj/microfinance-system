import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  ATTENDANCE_STATUSES,
  GROUP_ACTIONS,
  GROUP_FUND_KIND_LABELS,
  GROUP_MAX_MEMBERS,
  GROUP_MIN_MEMBERS,
  GROUP_ROLES,
  GROUP_ROLE_LABELS,
  GROUP_STATUS_LABELS,
  OFFICER_ROLES,
  OPEN_LOAN_STATUSES,
  PAYMENT_METHODS,
  RUNNING_LOAN_STATUSES,
  activationIssues,
  centsFromDb,
  centsToDecimal,
  consentStatus,
  coverLimit,
  dissolutionIssues,
  formatPeso,
  fundJournal,
  groupTransition,
  membershipOpen,
  outstandingOf,
  parsePesos,
  paymentMethodLabel,
  validateCollection,
  validateGroup,
  type AttendanceStatus,
  type Cents,
  type ConsentDecision,
  type GroupAction,
  type GroupFundKind,
  type GroupInput,
  type GroupRole,
  type GroupStatus,
  type InstallmentBalance,
  type PaymentMethod,
} from '../../shared/lending';
import { isKycVerified } from '../../shared/kyc-core';
import { HttpError, type AppDb } from '../kyc/errors';
import { manilaToday } from '../kyc/service';
import { postJournal } from '../lending/ledger';
import { has, inTransaction, newId, nextSequence, nowIso, type LendingClient, type LendingStaff } from '../lending/service';
import { postPaymentTx } from '../lending/repayment';
import { paymentRows, register } from '../lending/tables';
import { activeMemberIds, groupBlock, loanConsentStatus } from './rules';
import { attendance, collections, consents, covers, fundTransactions, groups, meetings, members, type CoverRow, type GroupRow } from './tables';

export type GroupActor = LendingStaff | LendingClient;

const MANAGE = 'manage_loan_applications';
const SENSITIVE = 'approve_sensitive_operations';
const COLLECT = 'process_loan_repayments';
const READ = ['view_client_info', 'manage_loan_applications', 'process_loan_applications', 'process_loan_repayments', 'view_all_records'];

function need(actor: LendingStaff, permission: string, message: string) {
  if (!has(actor, permission)) throw new HttpError(403, message, 'FORBIDDEN');
}

function requireKey(key: unknown): string {
  const k = typeof key === 'string' ? key.trim().slice(0, 100) : '';
  if (k.length < 8) throw new HttpError(400, 'An Idempotency-Key header (8+ characters) is required.', 'IDEMPOTENCY_KEY_REQUIRED');
  return k;
}

function reasonOf(input: unknown, min = 5): string {
  const r = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ').slice(0, 500) : '';
  if (r.length < min) throw new HttpError(400, `Give a reason (at least ${min} characters).`, 'REASON_REQUIRED');
  return r;
}

function assertScope(actor: GroupActor, group: Pick<GroupRow, 'branchId'>) {
  if (actor.kind === 'client') return;
  if (actor.viewAll) return;
  if (!actor.branchId || group.branchId !== actor.branchId) throw new HttpError(404, 'Group not found in your branch.', 'NOT_FOUND');
}

async function lockGroup(tx: AppDb, actor: GroupActor, groupId: string): Promise<GroupRow> {
  const [g] = await tx.select().from(groups).where(eq(groups.id, groupId)).for('update').limit(1);
  if (!g) throw new HttpError(404, 'Group not found.', 'NOT_FOUND');
  assertScope(actor, g);
  return g;
}

async function audit(tx: AppDb, group: Pick<GroupRow, 'id' | 'branchId'>, actor: GroupActor | 'SYSTEM', action: string, details: string, at: string) {
  await tx.insert(schema.auditLogs).values({
    id: newId('aud'),
    timestamp: at,
    action,
    details,
    performedBy: actor === 'SYSTEM' ? 'system' : actor.userId,
    branchId: group.branchId,
    type: 'GROUP',
    userName: actor === 'SYSTEM' ? 'System' : actor.name,
    userRole: actor === 'SYSTEM' ? 'SYSTEM' : actor.kind === 'client' ? 'CLIENT' : actor.role,
    targetType: 'SolidarityGroup',
    targetId: group.id,
  });
}

async function notify(tx: AppDb, group: Pick<GroupRow, 'id' | 'branchId'>, borrowerId: string | null, type: string, title: string, message: string, at: string) {
  await tx.insert(schema.branchNotifications).values({
    id: newId('ntf'),
    branchId: group.branchId,
    audience: borrowerId ? 'CLIENT' : 'STAFF',
    borrowerId,
    type,
    title,
    message,
    relatedType: 'SolidarityGroup',
    relatedId: group.id,
    isRead: false,
    createdAt: at,
  });
}

/** Keeps the legacy leader columns equal to the LEADER membership. */
async function syncLeader(tx: AppDb, groupId: string, at: string) {
  const [leader] = await tx
    .select({ id: schema.borrowers.id, name: schema.borrowers.fullName, phone: schema.borrowers.phone })
    .from(members)
    .innerJoin(schema.borrowers, eq(schema.borrowers.id, members.borrowerId))
    .where(and(eq(members.groupId, groupId), eq(members.status, 'ACTIVE'), eq(members.role, 'LEADER')))
    .limit(1);
  await tx
    .update(groups)
    .set({ leaderBorrowerId: leader?.id ?? null, leaderName: leader?.name ?? null, leaderPhone: leader?.phone ?? null, updatedAt: at })
    .where(eq(groups.id, groupId));
}

async function officerFor(tx: AppDb, officerId: string, branchId: string) {
  const [o] = await tx.select().from(schema.staff).where(eq(schema.staff.id, officerId)).limit(1);
  if (!o) throw new HttpError(400, 'Choose a loan officer from the list.', 'INVALID_GROUP', { fields: { loanOfficerId: 'Unknown staff member.' } });
  if (o.assignedBranchId !== branchId) throw new HttpError(400, `${o.name} is not assigned to this branch.`, 'INVALID_GROUP', { fields: { loanOfficerId: 'Not assigned to this branch.' } });
  return o;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

/** Staff of the branch who can be assigned to a group. */
export async function officers(db: AppDb, actor: LendingStaff, branchId?: string) {
  const b = actor.viewAll ? branchId ?? actor.branchId : actor.branchId;
  const rows = await db.select({ id: schema.staff.id, name: schema.staff.name, role: schema.staff.role, title: schema.staff.title }).from(schema.staff).where(b ? eq(schema.staff.assignedBranchId, b) : undefined).orderBy(asc(schema.staff.name));
  return rows;
}

export async function createGroup(db: AppDb, actor: LendingStaff, dto: Partial<GroupInput> & { branchId?: unknown }) {
  need(actor, MANAGE, 'Your role cannot form lending groups.');
  const v = validateGroup(dto);
  if (!v.ok || !v.value) throw new HttpError(400, 'Check the highlighted group fields.', 'INVALID_GROUP', { fields: v.errors });
  const branchId = actor.viewAll && typeof dto.branchId === 'string' && dto.branchId ? dto.branchId : actor.branchId;
  if (!branchId) throw new HttpError(400, 'Choose the branch the group belongs to.', 'INVALID_GROUP', { fields: { branchId: 'Choose the branch.' } });
  const at = nowIso();
  const id = newId('grp');
  await inTransaction(db, async (tx) => {
    const officer = await officerFor(tx, v.value!.loanOfficerId, branchId);
    const n = await nextSequence(tx, 'group_code_seq');
    const code = `GRP-${manilaToday().slice(0, 4)}-${String(n).padStart(4, '0')}`;
    await tx.insert(groups).values({
      id,
      groupCode: code,
      groupName: v.value!.groupName,
      centerName: v.value!.centerName,
      branchId,
      formedDate: manilaToday(),
      meetingDay: v.value!.meetingDay,
      meetingTime: v.value!.meetingTime,
      meetingFrequency: v.value!.meetingFrequency,
      meetingLocation: v.value!.meetingLocation,
      loanOfficerId: officer.id,
      loanOfficerName: officer.name,
      members: [],
      fundBalance: '0.00',
      jointLiabilityAgreed: true,
      status: 'FORMING',
      arrearsThresholdDays: v.value!.arrearsThresholdDays,
      createdBy: actor.userId,
      createdAt: at,
      updatedAt: at,
    });
    await audit(tx, { id, branchId }, actor, 'GROUP_CREATED', `${code} ${v.value!.groupName} formed (${v.value!.centerName}); meets ${v.value!.meetingDay} ${v.value!.meetingTime}; officer ${officer.name}.`, at);
  });
  return groupDetail(db, actor, id);
}

export async function updateGroup(db: AppDb, actor: LendingStaff, groupId: string, dto: Partial<GroupInput>) {
  need(actor, MANAGE, 'Your role cannot change lending groups.');
  const v = validateGroup(dto);
  if (!v.ok || !v.value) throw new HttpError(400, 'Check the highlighted group fields.', 'INVALID_GROUP', { fields: v.errors });
  await inTransaction(db, async (tx) => {
    const g = await lockGroup(tx, actor, groupId);
    if (g.status === 'DISSOLVED') throw new HttpError(409, 'A dissolved group cannot be changed.', 'GROUP_DISSOLVED');
    const officer = await officerFor(tx, v.value!.loanOfficerId, g.branchId);
    const at = nowIso();
    await tx
      .update(groups)
      .set({
        groupName: v.value!.groupName,
        centerName: v.value!.centerName,
        meetingDay: v.value!.meetingDay,
        meetingTime: v.value!.meetingTime,
        meetingFrequency: v.value!.meetingFrequency,
        meetingLocation: v.value!.meetingLocation,
        loanOfficerId: officer.id,
        loanOfficerName: officer.name,
        arrearsThresholdDays: v.value!.arrearsThresholdDays,
        updatedAt: at,
      })
      .where(eq(groups.id, g.id));
    await audit(tx, g, actor, 'GROUP_UPDATED', `${g.groupCode}: schedule ${v.value!.meetingDay} ${v.value!.meetingTime} (${v.value!.meetingFrequency.toLowerCase()}) at ${v.value!.meetingLocation}; officer ${officer.name}; arrears limit ${v.value!.arrearsThresholdDays} days.`, at);
  });
  return groupDetail(db, actor, groupId);
}

async function openGroupLoans(tx: AppDb, groupId: string, borrowerId?: string) {
  return tx
    .select({ id: schema.loans.id, loanNumber: schema.loans.loanNumber, status: schema.loans.status, borrowerId: schema.loans.borrowerId })
    .from(schema.loans)
    .where(and(eq(schema.loans.groupId, groupId), inArray(schema.loans.status, [...OPEN_LOAN_STATUSES]), borrowerId ? eq(schema.loans.borrowerId, borrowerId) : undefined));
}

async function outstandingCovers(tx: AppDb, groupId: string, borrowerId?: string): Promise<CoverRow[]> {
  return tx
    .select()
    .from(covers)
    .where(and(eq(covers.groupId, groupId), eq(covers.status, 'OUTSTANDING'), borrowerId ? eq(covers.borrowerId, borrowerId) : undefined))
    .orderBy(asc(covers.createdAt), asc(covers.id));
}

export async function addMember(db: AppDb, actor: LendingStaff, groupId: string, input: { borrowerId?: unknown; role?: unknown }) {
  need(actor, MANAGE, 'Your role cannot change group membership.');
  const borrowerId = String(input.borrowerId ?? '').trim();
  const role = String(input.role ?? 'MEMBER').toUpperCase() as GroupRole;
  if (!borrowerId) throw new HttpError(400, 'Choose the member to add.', 'INVALID_MEMBER');
  if (!(GROUP_ROLES as readonly string[]).includes(role)) throw new HttpError(400, 'Role must be leader, secretary, treasurer or member.', 'INVALID_ROLE');
  await inTransaction(db, async (tx) => {
    const g = await lockGroup(tx, actor, groupId);
    if (!membershipOpen(g.status as GroupStatus)) throw new HttpError(409, `Members cannot join a ${String(g.status).toLowerCase()} group.`, 'GROUP_CLOSED');
    const [b] = await tx.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
    if (!b) throw new HttpError(404, 'Member not found.', 'NOT_FOUND');
    if (b.branchId !== g.branchId) throw new HttpError(409, `${b.fullName} belongs to another branch.`, 'OTHER_BRANCH');
    if (!isKycVerified(b.kycStatus)) throw new HttpError(409, `${b.fullName}'s KYC is not verified; only verified members can join a group.`, 'KYC_REQUIRED');
    const [current] = await tx
      .select({ groupName: groups.groupName, groupId: groups.id })
      .from(members)
      .innerJoin(groups, eq(groups.id, members.groupId))
      .where(and(eq(members.borrowerId, b.id), eq(members.status, 'ACTIVE')))
      .limit(1);
    if (current) throw new HttpError(409, current.groupId === g.id ? `${b.fullName} is already in this group.` : `${b.fullName} is already a member of ${current.groupName}.`, 'ALREADY_IN_GROUP');
    const ids = await activeMemberIds(tx, g.id);
    if (ids.length >= GROUP_MAX_MEMBERS) throw new HttpError(409, `A group has at most ${GROUP_MAX_MEMBERS} members.`, 'GROUP_FULL');
    if (role !== 'MEMBER') {
      const taken = await tx.select({ id: members.id }).from(members).where(and(eq(members.groupId, g.id), eq(members.status, 'ACTIVE'), eq(members.role, role))).limit(1);
      if (taken[0]) throw new HttpError(409, `The group already has a ${GROUP_ROLE_LABELS[role].toLowerCase()}; change that member's role first.`, 'ROLE_TAKEN');
    }
    const at = nowIso();
    await tx.insert(members).values({ id: newId('gm'), groupId: g.id, borrowerId: b.id, role, status: 'ACTIVE', joinedAt: manilaToday(), addedBy: actor.userId, createdAt: at });
    if (role === 'LEADER') await syncLeader(tx, g.id, at);
    await audit(tx, g, actor, 'GROUP_MEMBER_ADDED', `${b.fullName} joined ${g.groupName} as ${GROUP_ROLE_LABELS[role].toLowerCase()}.`, at);
    await notify(tx, g, b.id, 'GROUP_JOINED', 'You joined a lending group', `You are now a ${GROUP_ROLE_LABELS[role].toLowerCase()} of ${g.groupName}. Members are jointly liable for each other's group loans.`, at);
  });
  return groupDetail(db, actor, groupId);
}

export async function removeMember(db: AppDb, actor: LendingStaff, groupId: string, borrowerId: string, reasonInput: unknown) {
  need(actor, MANAGE, 'Your role cannot change group membership.');
  const reason = reasonOf(reasonInput);
  await inTransaction(db, async (tx) => {
    const g = await lockGroup(tx, actor, groupId);
    if (!membershipOpen(g.status as GroupStatus)) throw new HttpError(409, `Members cannot leave a ${String(g.status).toLowerCase()} group here.`, 'GROUP_CLOSED');
    const [m] = await tx.select().from(members).where(and(eq(members.groupId, g.id), eq(members.borrowerId, borrowerId), eq(members.status, 'ACTIVE'))).for('update').limit(1);
    if (!m) throw new HttpError(404, 'This person is not an active member of the group.', 'NOT_FOUND');
    const loans = await openGroupLoans(tx, g.id, borrowerId);
    if (loans.length) throw new HttpError(409, `The member has an open group loan (${loans.map((l) => l.loanNumber).join(', ')}); they can leave once it is closed or cancelled.`, 'OPEN_GROUP_LOAN');
    if ((await outstandingCovers(tx, g.id, borrowerId)).length) throw new HttpError(409, 'The member still owes the solidarity fund.', 'COVER_OUTSTANDING');
    if (m.role === 'LEADER' && g.status === 'ACTIVE') throw new HttpError(409, 'Make another member the leader first.', 'LEADER_REQUIRED');
    const count = (await activeMemberIds(tx, g.id)).length;
    if (g.status === 'ACTIVE' && count - 1 < GROUP_MIN_MEMBERS) throw new HttpError(409, `An active group needs at least ${GROUP_MIN_MEMBERS} members; add someone first or suspend the group.`, 'TOO_FEW_MEMBERS');
    const at = nowIso();
    await tx.update(members).set({ status: 'LEFT', leftAt: manilaToday(), leftReason: reason, removedBy: actor.userId }).where(eq(members.id, m.id));
    if (m.role === 'LEADER') await syncLeader(tx, g.id, at);
    const [b] = await tx.select({ name: schema.borrowers.fullName }).from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
    await audit(tx, g, actor, 'GROUP_MEMBER_REMOVED', `${b?.name ?? borrowerId} left ${g.groupName}. Reason: ${reason}`, at);
    await notify(tx, g, borrowerId, 'GROUP_LEFT', 'You left your lending group', `You are no longer a member of ${g.groupName}. Reason: ${reason}`, at);
  });
  return groupDetail(db, actor, groupId);
}

/** Assigns a role; the previous holder of a leader / secretary / treasurer role becomes a member. */
export async function setRole(db: AppDb, actor: LendingStaff, groupId: string, borrowerId: string, roleInput: unknown) {
  need(actor, MANAGE, 'Your role cannot change group roles.');
  const role = String(roleInput ?? '').toUpperCase() as GroupRole;
  if (!(GROUP_ROLES as readonly string[]).includes(role)) throw new HttpError(400, 'Role must be leader, secretary, treasurer or member.', 'INVALID_ROLE');
  await inTransaction(db, async (tx) => {
    const g = await lockGroup(tx, actor, groupId);
    if (!membershipOpen(g.status as GroupStatus)) throw new HttpError(409, `Roles cannot change in a ${String(g.status).toLowerCase()} group.`, 'GROUP_CLOSED');
    const [m] = await tx.select().from(members).where(and(eq(members.groupId, g.id), eq(members.borrowerId, borrowerId), eq(members.status, 'ACTIVE'))).for('update').limit(1);
    if (!m) throw new HttpError(404, 'This person is not an active member of the group.', 'NOT_FOUND');
    if (m.role === role) return;
    if (g.status === 'ACTIVE' && (OFFICER_ROLES as readonly string[]).includes(m.role) && role === 'MEMBER') {
      throw new HttpError(409, `An active group must keep its ${GROUP_ROLE_LABELS[m.role as GroupRole].toLowerCase()}; give the role to another member instead.`, 'ROLE_REQUIRED');
    }
    const at = nowIso();
    let replaced: string | null = null;
    if (role !== 'MEMBER') {
      const [holder] = await tx.select().from(members).where(and(eq(members.groupId, g.id), eq(members.status, 'ACTIVE'), eq(members.role, role))).for('update').limit(1);
      if (holder) {
        // The holder takes this member's old role when it is an officer role, so an active group never loses one.
        const swapRole = (OFFICER_ROLES as readonly string[]).includes(m.role) ? m.role : 'MEMBER';
        await tx.update(members).set({ role: 'MEMBER' }).where(eq(members.id, m.id));
        await tx.update(members).set({ role: swapRole }).where(eq(members.id, holder.id));
        replaced = holder.borrowerId;
      }
    }
    await tx.update(members).set({ role }).where(eq(members.id, m.id));
    await syncLeader(tx, g.id, at);
    const names = await tx.select({ id: schema.borrowers.id, name: schema.borrowers.fullName }).from(schema.borrowers).where(inArray(schema.borrowers.id, [borrowerId, ...(replaced ? [replaced] : [])]));
    const nameOf = (id: string) => names.find((n) => n.id === id)?.name ?? id;
    await audit(tx, g, actor, 'GROUP_ROLE_CHANGED', `${nameOf(borrowerId)} is now ${GROUP_ROLE_LABELS[role].toLowerCase()} of ${g.groupName}${replaced ? ` (in place of ${nameOf(replaced)})` : ''}.`, at);
    await notify(tx, g, borrowerId, 'GROUP_ROLE', 'Your group role changed', `You are now the ${GROUP_ROLE_LABELS[role].toLowerCase()} of ${g.groupName}.`, at);
  });
  return groupDetail(db, actor, groupId);
}

/** The group state machine: activate, suspend, reinstate, dissolve. */
export async function changeGroupStatus(db: AppDb, actor: LendingStaff, groupId: string, actionInput: unknown, reasonInput: unknown) {
  const action = String(actionInput ?? '').toUpperCase() as GroupAction;
  if (!(GROUP_ACTIONS as readonly string[]).includes(action)) throw new HttpError(400, 'action must be ACTIVATE, SUSPEND, REINSTATE or DISSOLVE.', 'BAD_ACTION');
  if (action === 'ACTIVATE') need(actor, MANAGE, 'Your role cannot activate groups.');
  else need(actor, SENSITIVE, 'Only a manager can suspend, reinstate or dissolve a group.');
  const reason = action === 'ACTIVATE' ? (typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 500) : 'Formation complete') : reasonOf(reasonInput);
  await inTransaction(db, async (tx) => {
    const g = await lockGroup(tx, actor, groupId);
    const t = groupTransition(g.status as GroupStatus, action);
    if (!t.ok) throw new HttpError(409, t.message, 'BAD_TRANSITION', { from: g.status, action });
    if (action === 'ACTIVATE' || action === 'REINSTATE') {
      const rows = await tx
        .select({ borrowerId: members.borrowerId, role: members.role, kyc: schema.borrowers.kycStatus })
        .from(members)
        .innerJoin(schema.borrowers, eq(schema.borrowers.id, members.borrowerId))
        .where(and(eq(members.groupId, g.id), eq(members.status, 'ACTIVE')));
      const issues = activationIssues(rows.map((r) => ({ borrowerId: r.borrowerId, role: r.role as GroupRole, kycVerified: isKycVerified(r.kyc) })));
      if (issues.length) throw new HttpError(409, `${g.groupName} cannot become active yet: ${issues.join(' ')}`, 'NOT_READY', { issues });
    }
    if (action === 'DISSOLVE') {
      const issues = dissolutionIssues({
        runningLoans: (await openGroupLoans(tx, g.id)).length,
        outstandingCovers: (await outstandingCovers(tx, g.id)).length,
        fundBalance: centsFromDb(g.fundBalance),
      });
      if (issues.length) throw new HttpError(409, `${g.groupName} cannot be dissolved: ${issues.join(' ')}`, 'NOT_READY', { issues });
    }
    const at = nowIso();
    await tx
      .update(groups)
      .set({ status: t.to, statusReason: reason, updatedAt: at, ...(action === 'DISSOLVE' ? { dissolvedAt: at } : {}) })
      .where(eq(groups.id, g.id));
    const ids = await activeMemberIds(tx, g.id);
    if (action === 'DISSOLVE') {
      await tx.update(members).set({ status: 'LEFT', leftAt: manilaToday(), leftReason: `Group dissolved: ${reason}`, removedBy: actor.userId }).where(and(eq(members.groupId, g.id), eq(members.status, 'ACTIVE')));
    }
    await audit(tx, g, actor, `GROUP_${action}`, `${g.groupName}: ${GROUP_STATUS_LABELS[g.status as GroupStatus]} -> ${GROUP_STATUS_LABELS[t.to]}. Reason: ${reason}`, at);
    for (const id of ids) {
      await notify(tx, g, id, `GROUP_${action}`, `Your group is now ${GROUP_STATUS_LABELS[t.to].toLowerCase()}`, `${g.groupName} is now ${GROUP_STATUS_LABELS[t.to].toLowerCase()}. ${reason}`, at);
    }
  });
  return groupDetail(db, actor, groupId);
}

// ---------------------------------------------------------------------------
// Consent (the other members guarantee a member's group loan)
// ---------------------------------------------------------------------------

export async function recordConsent(db: AppDb, actor: GroupActor, loanId: string, input: { borrowerId?: unknown; decision?: unknown; note?: unknown }) {
  const decision = String(input.decision ?? '').toUpperCase() as ConsentDecision;
  if (decision !== 'CONSENT' && decision !== 'DECLINE') throw new HttpError(400, 'decision must be CONSENT or DECLINE.', 'BAD_DECISION');
  const borrowerId = actor.kind === 'client' ? actor.borrowerId : String(input.borrowerId ?? '').trim();
  if (actor.kind === 'staff') need(actor, MANAGE, 'Your role cannot record group consent.');
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 300) : null;
  if (decision === 'DECLINE' && !note) throw new HttpError(400, 'Say why the loan is not supported.', 'REASON_REQUIRED');
  let groupIdOut = '';
  await inTransaction(db, async (tx) => {
    const [loan] = await tx.select().from(schema.loans).where(eq(schema.loans.id, loanId)).for('update').limit(1);
    const groupId = loan?.groupId ?? null;
    if (!loan || !groupId) throw new HttpError(404, 'Group loan not found.', 'NOT_FOUND');
    const g = await lockGroup(tx, actor, groupId);
    groupIdOut = g.id;
    if (!['Submitted', 'Under Review'].includes(loan.status)) throw new HttpError(409, `${loan.loanNumber} is ${loan.status.toLowerCase()}; consent can only be given before the decision.`, 'NOT_PENDING');
    if (borrowerId === loan.borrowerId) throw new HttpError(409, 'The borrower does not consent to their own loan.', 'OWN_LOAN');
    const m = await tx.select({ id: members.id }).from(members).where(and(eq(members.groupId, g.id), eq(members.borrowerId, borrowerId), eq(members.status, 'ACTIVE'))).limit(1);
    if (!m[0]) throw new HttpError(actor.kind === 'client' ? 404 : 409, 'Only active members of the group can consent.', 'NOT_A_MEMBER');
    const at = nowIso();
    await tx
      .insert(consents)
      .values({ id: newId('gc'), loanId: loan.id, groupId: g.id, borrowerId, decision, channel: actor.kind === 'client' ? 'PORTAL' : 'MEETING', note, recordedBy: actor.userId, recordedByName: actor.name, recordedAt: at })
      .onConflictDoUpdate({ target: [consents.loanId, consents.borrowerId], set: { decision, note, channel: actor.kind === 'client' ? 'PORTAL' : 'MEETING', recordedBy: actor.userId, recordedByName: actor.name, recordedAt: at } });
    const [who] = await tx.select({ name: schema.borrowers.fullName }).from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
    await tx.insert(schema.auditLogs).values({
      id: newId('aud'),
      timestamp: at,
      action: decision === 'CONSENT' ? 'GROUP_LOAN_CONSENTED' : 'GROUP_LOAN_DECLINED',
      details: `${who?.name ?? borrowerId} ${decision === 'CONSENT' ? 'consented to' : 'declined'} ${loan.borrowerName}'s ${loan.loanNumber} (${actor.kind === 'client' ? 'portal' : `recorded by ${actor.name} at a meeting`})${note ? `: ${note}` : ''}.`,
      performedBy: actor.userId,
      branchId: g.branchId,
      type: 'GROUP',
      userName: actor.name,
      userRole: actor.kind === 'client' ? 'CLIENT' : actor.role,
      targetType: 'Loan',
      targetId: loan.id,
    });
    if (decision === 'DECLINE') {
      await notify(tx, g, null, 'GROUP_LOAN_DECLINED', 'Group member declined a loan', `${who?.name ?? 'A member'} declined to guarantee ${loan.borrowerName}'s ${loan.loanNumber}: ${note}`, at);
    } else {
      const c = await loanConsentStatus(tx, { id: loan.id, borrowerId: loan.borrowerId, groupId: g.id });
      if (c?.complete) await notify(tx, g, null, 'GROUP_LOAN_CONSENTED', 'Group consent complete', `Every member of ${g.groupName} has consented to ${loan.loanNumber} (${loan.borrowerName}). It can now be decided.`, at);
    }
  });
  return pendingGroupLoans(db, actor, groupIdOut);
}

/** Group loans waiting for a decision, with each member's consent. */
export async function pendingGroupLoans(db: AppDb, actor: GroupActor, groupId: string) {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!g) throw new HttpError(404, 'Group not found.', 'NOT_FOUND');
  assertScope(actor, g);
  const loans = await db
    .select({ id: schema.loans.id, loanNumber: schema.loans.loanNumber, borrowerId: schema.loans.borrowerId, borrowerName: schema.loans.borrowerName, principalAmount: schema.loans.principalAmount, termMonths: schema.loans.termMonths, status: schema.loans.status })
    .from(schema.loans)
    .where(and(eq(schema.loans.groupId, g.id), inArray(schema.loans.status, ['Submitted', 'Under Review'])))
    .orderBy(asc(schema.loans.loanNumber));
  const out = [];
  for (const l of loans) {
    const rows = await db.select().from(consents).where(eq(consents.loanId, l.id));
    const ids = await activeMemberIds(db, g.id);
    const c = consentStatus({ applicantId: l.borrowerId, memberIds: ids, consents: rows.map((r) => ({ borrowerId: r.borrowerId, decision: r.decision as ConsentDecision })) });
    out.push({
      ...l,
      principalAmount: centsToDecimal(centsFromDb(String(l.principalAmount))),
      consent: { ...c, records: rows.map((r) => ({ borrowerId: r.borrowerId, decision: r.decision, channel: r.channel, note: r.note, recordedAt: r.recordedAt, recordedByName: r.recordedByName })) },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Meetings and attendance
// ---------------------------------------------------------------------------

export async function recordMeeting(
  db: AppDb,
  actor: LendingStaff,
  groupId: string,
  input: { meetingDate?: unknown; location?: unknown; notes?: unknown; attendance?: unknown },
) {
  need(actor, MANAGE, 'Your role cannot record group meetings.');
  const today = manilaToday();
  const meetingDate = String(input.meetingDate ?? today);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate) || meetingDate > today) throw new HttpError(400, 'Enter the meeting date (not in the future).', 'INVALID_MEETING', { fields: { meetingDate: 'Not in the future.' } });
  const list = Array.isArray(input.attendance) ? (input.attendance as { borrowerId?: unknown; status?: unknown; note?: unknown }[]) : [];
  const id = newId('gmt');
  await inTransaction(db, async (tx) => {
    const g = await lockGroup(tx, actor, groupId);
    if (g.status !== 'ACTIVE' && g.status !== 'FORMING' && g.status !== 'SUSPENDED') throw new HttpError(409, 'A dissolved group has no meetings.', 'GROUP_DISSOLVED');
    const ids = await activeMemberIds(tx, g.id);
    const byId = new Map(list.map((a) => [String(a.borrowerId ?? ''), a]));
    const missing = ids.filter((m) => !byId.has(m));
    if (missing.length) throw new HttpError(400, `Mark attendance for every member (${missing.length} missing).`, 'ATTENDANCE_INCOMPLETE', { missing });
    for (const k of byId.keys()) if (!ids.includes(k)) throw new HttpError(400, 'Attendance lists someone who is not an active member.', 'NOT_A_MEMBER');
    for (const a of list) if (!(ATTENDANCE_STATUSES as readonly string[]).includes(String(a.status))) throw new HttpError(400, 'Attendance must be PRESENT, ABSENT or EXCUSED.', 'INVALID_ATTENDANCE');
    const dup = await tx.select({ id: meetings.id }).from(meetings).where(and(eq(meetings.groupId, g.id), eq(meetings.meetingDate, meetingDate))).limit(1);
    if (dup[0]) throw new HttpError(409, `A meeting on ${meetingDate} is already recorded.`, 'DUPLICATE_MEETING');
    const at = nowIso();
    await tx.insert(meetings).values({
      id,
      groupId: g.id,
      meetingDate,
      location: typeof input.location === 'string' && input.location.trim() ? input.location.trim().slice(0, 120) : g.meetingLocation,
      notes: typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim().slice(0, 1000) : null,
      recordedBy: actor.userId,
      recordedByName: actor.name,
      createdAt: at,
    });
    for (const a of list) {
      await tx.insert(attendance).values({ meetingId: id, borrowerId: String(a.borrowerId), status: String(a.status) as AttendanceStatus, note: typeof a.note === 'string' && a.note.trim() ? a.note.trim().slice(0, 200) : null });
    }
    const present = list.filter((a) => a.status === 'PRESENT').length;
    await audit(tx, g, actor, 'GROUP_MEETING_RECORDED', `${g.groupName} met on ${meetingDate}: ${present} of ${ids.length} present.`, at);
  });
  return groupMeetings(db, actor, groupId);
}

export async function groupMeetings(db: AppDb, actor: GroupActor, groupId: string) {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!g) throw new HttpError(404, 'Group not found.', 'NOT_FOUND');
  assertScope(actor, g);
  const rows = await db.select().from(meetings).where(eq(meetings.groupId, g.id)).orderBy(desc(meetings.meetingDate)).limit(50);
  const att = rows.length
    ? await db
        .select({ meetingId: attendance.meetingId, borrowerId: attendance.borrowerId, status: attendance.status, note: attendance.note, name: schema.borrowers.fullName })
        .from(attendance)
        .innerJoin(schema.borrowers, eq(schema.borrowers.id, attendance.borrowerId))
        .where(inArray(attendance.meetingId, rows.map((r) => r.id)))
    : [];
  return rows.map((m) => {
    const list = att.filter((a) => a.meetingId === m.id).map((a) => ({ borrowerId: a.borrowerId, name: a.name, status: a.status, note: a.note }));
    return { id: m.id, meetingDate: m.meetingDate, location: m.location, notes: m.notes, recordedByName: m.recordedByName, present: list.filter((a) => a.status === 'PRESENT').length, total: list.length, attendance: list };
  });
}

// ---------------------------------------------------------------------------
// Solidarity fund
// ---------------------------------------------------------------------------

/** Moves the fund and writes its row; the caller has posted (or will post) the journal entry. */
async function fundEntry(
  tx: AppDb,
  g: GroupRow,
  actor: LendingStaff,
  p: { kind: GroupFundKind; amount: Cents; borrowerId?: string | null; coverId?: string | null; collectionId?: string | null; method?: string | null; reference?: string | null; journalEntryId: string; idempotencyKey: string; notes?: string | null; at: string },
) {
  const [cur] = await tx.select({ balance: groups.fundBalance }).from(groups).where(eq(groups.id, g.id)).limit(1);
  const before = centsFromDb(cur.balance);
  const signed = p.kind === 'COVER' || p.kind === 'REFUND' ? -p.amount : p.amount;
  const after = before + signed;
  if (after < 0) throw new HttpError(409, `The solidarity fund holds only ${formatPeso(before)}.`, 'FUND_TOO_LOW');
  const n = await nextSequence(tx, 'group_fund_txn_seq');
  const number = `GF-${manilaToday().slice(0, 4)}-${String(n).padStart(6, '0')}`;
  await tx.insert(fundTransactions).values({
    id: newId('gft'),
    groupId: g.id,
    transactionNumber: number,
    kind: p.kind,
    signedAmount: centsToDecimal(signed),
    balanceBefore: centsToDecimal(before),
    balanceAfter: centsToDecimal(after),
    borrowerId: p.borrowerId ?? null,
    coverId: p.coverId ?? null,
    collectionId: p.collectionId ?? null,
    method: p.method ?? null,
    reference: p.reference ?? null,
    journalEntryId: p.journalEntryId,
    idempotencyKey: p.idempotencyKey,
    notes: p.notes ?? null,
    entryDate: manilaToday(),
    postedBy: actor.userId,
    postedByName: actor.name,
    createdAt: p.at,
  });
  await tx.update(groups).set({ fundBalance: centsToDecimal(after), updatedAt: p.at }).where(eq(groups.id, g.id));
  return { number, balance: after };
}

/** Cash into the fund (contribution or cover repayment) or out (refund): journal + fund row. */
async function cashFundMovement(
  tx: AppDb,
  g: GroupRow,
  actor: LendingStaff,
  p: { kind: 'CONTRIBUTION' | 'COVER_REPAYMENT' | 'REFUND'; amount: Cents; method: PaymentMethod; reference: string | null; borrowerId: string | null; coverId?: string | null; collectionId?: string | null; key: string; notes?: string | null; at: string },
) {
  const entryId = await postJournal(tx, {
    lines: fundJournal(p.kind, p.amount, p.method),
    entryDate: manilaToday(),
    description: `${g.groupName} solidarity fund: ${GROUP_FUND_KIND_LABELS[p.kind].toLowerCase()} ${formatPeso(p.amount)}`,
    reference: p.reference ?? g.groupCode,
    sourceModule: 'group_fund',
    sourceRef: g.id,
    branchId: g.branchId,
    postedBy: actor.userId,
    postedByName: actor.name,
    idempotencyKey: `group-fund:${p.key}`,
    at: p.at,
  });
  const r = await fundEntry(tx, g, actor, { ...p, journalEntryId: entryId, idempotencyKey: p.key });
  await tx.insert(register).values({
    id: newId('txn'),
    referenceNumber: r.number,
    clientId: p.borrowerId ?? g.id,
    clientName: g.groupName,
    accountOrLoanId: g.id,
    accountOrLoanType: 'Solidarity Fund',
    branchId: g.branchId,
    transactionType: `Solidarity Fund ${GROUP_FUND_KIND_LABELS[p.kind]}`,
    amount: centsToDecimal(p.amount),
    transactionDate: manilaToday(),
    paymentMethod: paymentMethodLabel(p.method),
    processedBy: actor.name,
    processedByRole: actor.role,
    status: 'Completed',
    notes: p.notes ?? null,
    createdAt: p.at,
    updatedAt: p.at,
  });
  return r;
}

/** Repays a member's outstanding covers, oldest first. */
async function repayCoversTx(tx: AppDb, g: GroupRow, actor: LendingStaff, borrowerId: string, amount: Cents, method: PaymentMethod, reference: string | null, key: string, collectionId: string | null, at: string) {
  const open = await outstandingCovers(tx, g.id, borrowerId);
  const owed = open.reduce((s, c) => s + centsFromDb(c.amount) - centsFromDb(c.repaid), 0);
  if (amount > owed) throw new HttpError(409, `The member owes the fund ${formatPeso(owed)}; ${formatPeso(amount)} is more than that.`, 'ABOVE_OWED', { owed: centsToDecimal(owed) });
  let left = amount;
  const numbers: string[] = [];
  for (const c of open) {
    if (left <= 0) break;
    const due = centsFromDb(c.amount) - centsFromDb(c.repaid);
    const pay = Math.min(due, left);
    left -= pay;
    const r = await cashFundMovement(tx, g, actor, { kind: 'COVER_REPAYMENT', amount: pay, method, reference, borrowerId, coverId: c.id, collectionId, key: `${key}:${c.id}`, notes: `Pays back ${c.coverNumber}`, at });
    numbers.push(r.number);
    const repaid = centsFromDb(c.repaid) + pay;
    const done = repaid === centsFromDb(c.amount);
    await tx.update(covers).set({ repaid: centsToDecimal(repaid), status: done ? 'REPAID' : 'OUTSTANDING', repaidAt: done ? at : null }).where(eq(covers.id, c.id));
  }
  return { numbers, owedAfter: owed - amount };
}

function scheduleBalance(r: typeof schema.loanSchedule.$inferSelect): InstallmentBalance {
  return {
    number: r.installmentNumber,
    dueDate: r.dueDate,
    principalDue: centsFromDb(r.principalDue),
    interestDue: centsFromDb(r.interestDue),
    penaltyDue: centsFromDb(r.penaltyDue),
    principalPaid: centsFromDb(r.principalPaid),
    interestPaid: centsFromDb(r.interestPaid),
    penaltyPaid: centsFromDb(r.penaltyPaid),
  };
}

/** What is past due (due before today) on a loan. */
async function overdueOn(tx: AppDb, loanId: string, today: string): Promise<Cents> {
  const rows = await tx.select().from(schema.loanSchedule).where(eq(schema.loanSchedule.loanId, loanId));
  return rows
    .map(scheduleBalance)
    .filter((b) => b.dueDate < today)
    .reduce((s, b) => s + outstandingOf(b).total, 0);
}

/**
 * The solidarity mechanism: the fund pays a member's overdue amount. Posted in
 * one transaction as a loan payment funded by the fund (Dr 2040), a COVER row
 * the member owes back, and a fund transaction; the leader, the member and the
 * branch are told. The group stays blocked from new loans until it is repaid.
 */
export async function coverFromFund(db: AppDb, actor: LendingStaff, groupId: string, input: { loanId?: unknown; amount?: unknown; reason?: unknown }, idempotencyKey: unknown) {
  need(actor, SENSITIVE, 'Only a manager can use the solidarity fund.');
  const key = requireKey(idempotencyKey);
  const reason = reasonOf(input.reason);
  const loanId = String(input.loanId ?? '');
  const requested = input.amount === undefined || input.amount === '' ? null : parsePesos(input.amount);
  if (input.amount !== undefined && input.amount !== '' && (requested === null || requested <= 0)) throw new HttpError(400, 'Enter the amount (pesos and centavos only).', 'INVALID_AMOUNT', { fields: { amount: 'Pesos and centavos only.' } });
  const today = manilaToday();
  const coverId = await inTransaction(db, async (tx) => {
    const prior = await tx.select().from(covers).where(eq(covers.idempotencyKey, key)).limit(1);
    if (prior[0]) return prior[0].id;
    const g = await lockGroup(tx, actor, groupId);
    if (g.status !== 'ACTIVE' && g.status !== 'SUSPENDED') throw new HttpError(409, `The fund of a ${String(g.status).toLowerCase()} group cannot be used.`, 'GROUP_CLOSED');
    const [loan] = await tx.select().from(schema.loans).where(eq(schema.loans.id, loanId)).limit(1);
    if (!loan || loan.groupId !== g.id) throw new HttpError(404, 'This is not a loan of the group.', 'NOT_FOUND');
    if (loan.status !== 'Active') throw new HttpError(409, `${loan.loanNumber} is ${loan.status.toLowerCase()}.`, 'LOAN_NOT_ACTIVE');
    const overdue = await overdueOn(tx, loan.id, today);
    if (overdue <= 0) throw new HttpError(409, `${loan.borrowerName} is not behind on ${loan.loanNumber}; the fund only covers overdue amounts.`, 'NOT_OVERDUE');
    const limit = coverLimit(centsFromDb(g.fundBalance), overdue);
    if (limit <= 0) throw new HttpError(409, 'The solidarity fund is empty.', 'FUND_TOO_LOW');
    const amount = requested ?? limit;
    if (amount > limit) throw new HttpError(409, `The fund can cover at most ${formatPeso(limit)} (overdue ${formatPeso(overdue)}, fund ${formatPeso(centsFromDb(g.fundBalance))}).`, 'ABOVE_LIMIT', { limit: centsToDecimal(limit) });
    const at = nowIso();
    const paid = await postPaymentTx(tx, actor, loan.id, { amount: centsToDecimal(amount), method: 'CASH', paymentDate: today, notes: `Solidarity cover: ${reason}` }, `cover:${key}`, { fromSolidarityFund: { groupName: g.groupName } });
    const [payment] = await tx.select().from(paymentRows).where(eq(paymentRows.id, paid.paymentId)).limit(1);
    const n = await nextSequence(tx, 'group_cover_seq');
    const id = newId('scv');
    const number = `SC-${today.slice(0, 4)}-${String(n).padStart(6, '0')}`;
    await tx.insert(covers).values({
      id,
      coverNumber: number,
      groupId: g.id,
      loanId: loan.id,
      borrowerId: loan.borrowerId,
      paymentId: payment.id,
      amount: centsToDecimal(amount),
      repaid: '0.00',
      status: 'OUTSTANDING',
      reason,
      idempotencyKey: key,
      createdBy: actor.userId,
      createdByName: actor.name,
      createdAt: at,
    });
    await fundEntry(tx, g, actor, { kind: 'COVER', amount, borrowerId: loan.borrowerId, coverId: id, reference: payment.receiptNumber, journalEntryId: String(payment.journalEntryId), idempotencyKey: `cover-fund:${key}`, notes: `${number} for ${loan.loanNumber}: ${reason}`, at });
    await audit(tx, g, actor, 'SOLIDARITY_COVER', `${number}: the fund of ${g.groupName} paid ${formatPeso(amount)} on ${loan.borrowerName}'s ${loan.loanNumber} (receipt ${payment.receiptNumber}); ${loan.borrowerName} owes it back. Reason: ${reason}`, at);
    if (g.leaderBorrowerId && g.leaderBorrowerId !== loan.borrowerId) {
      await notify(tx, g, g.leaderBorrowerId, 'SOLIDARITY_COVER', 'The group fund covered a member', `The solidarity fund paid ${formatPeso(amount)} for ${loan.borrowerName} (${loan.loanNumber}). The group cannot take new loans until it is paid back.`, at);
    }
    await notify(tx, g, null, 'SOLIDARITY_COVER', `Solidarity cover: ${g.groupName}`, `${number}: ${formatPeso(amount)} from the fund for ${loan.borrowerName} (${loan.loanNumber}).`, at);
    return id;
  });
  const [c] = await db.select().from(covers).where(eq(covers.id, coverId)).limit(1);
  return coverView(c);
}

/** A member pays back what the fund covered (outside a group collection). */
export async function repayCover(db: AppDb, actor: LendingStaff, groupId: string, input: { borrowerId?: unknown; amount?: unknown; method?: unknown; referenceNumber?: unknown }, idempotencyKey: unknown) {
  need(actor, COLLECT, 'Your role cannot take payments.');
  const key = requireKey(idempotencyKey);
  const amount = parsePesos(input.amount);
  if (amount === null || amount <= 0) throw new HttpError(400, 'Enter the amount (pesos and centavos only).', 'INVALID_AMOUNT', { fields: { amount: 'Pesos and centavos only.' } });
  const method = String(input.method ?? 'CASH') as PaymentMethod;
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw new HttpError(400, 'Choose cash, bank transfer or e-wallet.', 'INVALID_METHOD');
  const reference = typeof input.referenceNumber === 'string' && input.referenceNumber.trim() ? input.referenceNumber.trim().slice(0, 60) : null;
  if (method !== 'CASH' && !reference) throw new HttpError(400, 'Enter the transfer reference.', 'INVALID_METHOD', { fields: { referenceNumber: 'Required for transfers.' } });
  const borrowerId = String(input.borrowerId ?? '');
  await inTransaction(db, async (tx) => {
    const done = await tx.select({ id: fundTransactions.id }).from(fundTransactions).where(sql`${fundTransactions.idempotencyKey} like ${`${key}:%`}`).limit(1);
    if (done[0]) return;
    const g = await lockGroup(tx, actor, groupId);
    const at = nowIso();
    const r = await repayCoversTx(tx, g, actor, borrowerId, amount, method, reference, key, null, at);
    await audit(tx, g, actor, 'SOLIDARITY_COVER_REPAID', `${formatPeso(amount)} paid back to the fund of ${g.groupName} (${r.numbers.join(', ')}); still owed ${formatPeso(r.owedAfter)}.`, at);
    await notify(tx, g, borrowerId, 'SOLIDARITY_COVER_REPAID', 'Payment to your group fund received', `We received ${formatPeso(amount)} back for your group's solidarity fund. You still owe ${formatPeso(r.owedAfter)}.`, at);
  });
  return fundView(db, actor, groupId);
}

/** Pays the fund out (e.g. back to the members before the group is dissolved). */
export async function refundFund(db: AppDb, actor: LendingStaff, groupId: string, input: { amount?: unknown; method?: unknown; referenceNumber?: unknown; reason?: unknown }, idempotencyKey: unknown) {
  need(actor, SENSITIVE, 'Only a manager can pay out the solidarity fund.');
  const key = requireKey(idempotencyKey);
  const reason = reasonOf(input.reason);
  const amount = parsePesos(input.amount);
  if (amount === null || amount <= 0) throw new HttpError(400, 'Enter the amount (pesos and centavos only).', 'INVALID_AMOUNT');
  const method = String(input.method ?? 'CASH') as PaymentMethod;
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw new HttpError(400, 'Choose cash, bank transfer or e-wallet.', 'INVALID_METHOD');
  const reference = typeof input.referenceNumber === 'string' && input.referenceNumber.trim() ? input.referenceNumber.trim().slice(0, 60) : null;
  await inTransaction(db, async (tx) => {
    const done = await tx.select({ id: fundTransactions.id }).from(fundTransactions).where(eq(fundTransactions.idempotencyKey, key)).limit(1);
    if (done[0]) return;
    const g = await lockGroup(tx, actor, groupId);
    if ((await outstandingCovers(tx, g.id)).length) throw new HttpError(409, 'Covers are still owed to the fund; it cannot be paid out yet.', 'COVER_OUTSTANDING');
    const at = nowIso();
    await cashFundMovement(tx, g, actor, { kind: 'REFUND', amount, method, reference, borrowerId: null, key, notes: reason, at });
    await audit(tx, g, actor, 'SOLIDARITY_FUND_REFUND', `${formatPeso(amount)} paid out of the fund of ${g.groupName}. Reason: ${reason}`, at);
  });
  return fundView(db, actor, groupId);
}

export function coverView(c: CoverRow) {
  const amount = centsFromDb(c.amount);
  const repaid = centsFromDb(c.repaid);
  return {
    id: c.id,
    coverNumber: c.coverNumber,
    loanId: c.loanId,
    borrowerId: c.borrowerId,
    paymentId: c.paymentId,
    amount: centsToDecimal(amount),
    repaid: centsToDecimal(repaid),
    outstanding: centsToDecimal(amount - repaid),
    status: c.status,
    reason: c.reason,
    createdAt: c.createdAt,
    createdByName: c.createdByName,
    repaidAt: c.repaidAt,
  };
}

export async function fundView(db: AppDb, actor: GroupActor, groupId: string) {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!g) throw new HttpError(404, 'Group not found.', 'NOT_FOUND');
  assertScope(actor, g);
  const txns = await db
    .select({ t: fundTransactions, name: schema.borrowers.fullName })
    .from(fundTransactions)
    .leftJoin(schema.borrowers, eq(schema.borrowers.id, fundTransactions.borrowerId))
    .where(eq(fundTransactions.groupId, g.id))
    .orderBy(desc(fundTransactions.sequence))
    .limit(100);
  const coverRows = await db
    .select({ c: covers, name: schema.borrowers.fullName, loanNumber: schema.loans.loanNumber })
    .from(covers)
    .innerJoin(schema.borrowers, eq(schema.borrowers.id, covers.borrowerId))
    .innerJoin(schema.loans, eq(schema.loans.id, covers.loanId))
    .where(and(eq(covers.groupId, g.id), actor.kind === 'client' ? eq(covers.borrowerId, actor.borrowerId) : undefined))
    .orderBy(desc(covers.createdAt));
  return {
    balance: centsToDecimal(centsFromDb(g.fundBalance)),
    transactions:
      actor.kind === 'client'
        ? []
        : txns.map(({ t, name }) => ({
            id: t.id,
            number: t.transactionNumber,
            date: t.entryDate,
            kind: t.kind,
            label: GROUP_FUND_KIND_LABELS[t.kind as GroupFundKind] ?? t.kind,
            memberName: name,
            amount: centsToDecimal(centsFromDb(t.signedAmount)),
            balance: centsToDecimal(centsFromDb(t.balanceAfter)),
            reference: t.reference,
            notes: t.notes,
            postedByName: t.postedByName,
          })),
    covers: coverRows.map(({ c, name, loanNumber }) => ({ ...coverView(c), memberName: name, loanNumber })),
  };
}

// ---------------------------------------------------------------------------
// Group collection: several members' payments posted in one transaction
// ---------------------------------------------------------------------------

export async function postCollection(
  db: AppDb,
  actor: LendingStaff,
  groupId: string,
  input: { method?: unknown; referenceNumber?: unknown; lines?: unknown },
  idempotencyKey: unknown,
) {
  need(actor, COLLECT, 'Your role cannot take payments.');
  const key = requireKey(idempotencyKey);
  const method = String(input.method ?? 'CASH') as PaymentMethod;
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw new HttpError(400, 'Choose cash, bank transfer or e-wallet.', 'INVALID_METHOD');
  const reference = typeof input.referenceNumber === 'string' && input.referenceNumber.trim() ? input.referenceNumber.trim().slice(0, 50) : null;
  if (method !== 'CASH' && !reference) throw new HttpError(400, 'Enter the transfer reference.', 'INVALID_METHOD', { fields: { referenceNumber: 'Required for transfers.' } });
  const v = validateCollection(Array.isArray(input.lines) ? input.lines : []);
  if (!v.ok) throw new HttpError(400, 'Check the highlighted amounts.', 'INVALID_COLLECTION', { fields: v.errors });
  const today = manilaToday();
  const collectionId = await inTransaction(db, async (tx) => {
    const prior = await tx.select().from(collections).where(eq(collections.idempotencyKey, key)).limit(1);
    if (prior[0]) {
      if (prior[0].groupId !== groupId) throw new HttpError(409, 'This idempotency key belongs to another collection.', 'KEY_REUSED');
      return prior[0].id;
    }
    const g = await lockGroup(tx, actor, groupId);
    if (g.status !== 'ACTIVE' && g.status !== 'SUSPENDED') throw new HttpError(409, `A ${String(g.status).toLowerCase()} group has no collections.`, 'GROUP_CLOSED');
    const ids = await activeMemberIds(tx, g.id);
    const at = nowIso();
    const id = newId('gcl');
    const n = await nextSequence(tx, 'group_collection_seq');
    const number = `GC-${today.slice(0, 4)}-${String(n).padStart(6, '0')}`;
    // The collection row first, so fund rows can point at it.
    await tx.insert(collections).values({ id, collectionNumber: number, groupId: g.id, collectionDate: today, method, reference, total: centsToDecimal(v.total), lines: [], idempotencyKey: key, postedBy: actor.userId, postedByName: actor.name, createdAt: at });
    const results = [];
    for (const [i, line] of v.lines.entries()) {
      if (!ids.includes(line.borrowerId)) throw new HttpError(409, 'A line is for someone who is not an active member of the group.', 'NOT_A_MEMBER', { line: i });
      const result: Record<string, unknown> = { borrowerId: line.borrowerId };
      if (line.loanAmount > 0) {
        const [loan] = await tx.select({ id: schema.loans.id, borrowerId: schema.loans.borrowerId, groupId: schema.loans.groupId }).from(schema.loans).where(eq(schema.loans.id, String(line.loanId))).limit(1);
        if (!loan || loan.borrowerId !== line.borrowerId || loan.groupId !== g.id) throw new HttpError(409, "A loan payment is not for that member's group loan.", 'WRONG_LOAN', { line: i });
        // Transfers share one reference; each payment gets its own suffix so receipts stay unique.
        const ref = reference && v.lines.filter((l) => l.loanAmount > 0).length > 1 ? `${reference}/${i + 1}` : reference ?? undefined;
        const paid = await postPaymentTx(tx, actor, loan.id, { amount: centsToDecimal(line.loanAmount), method, referenceNumber: ref, paymentDate: today, notes: `Group collection ${number}` }, `${key}:L${i}`, {});
        const [p] = await tx.select({ receiptNumber: paymentRows.receiptNumber }).from(paymentRows).where(eq(paymentRows.id, paid.paymentId)).limit(1);
        result.loanId = loan.id;
        result.paymentId = paid.paymentId;
        result.receiptNumber = p.receiptNumber;
        result.loanAmount = centsToDecimal(line.loanAmount);
      }
      if (line.fundAmount > 0) {
        const r = await cashFundMovement(tx, g, actor, { kind: 'CONTRIBUTION', amount: line.fundAmount, method, reference, borrowerId: line.borrowerId, collectionId: id, key: `${key}:F${i}`, notes: `Group collection ${number}`, at });
        result.fundAmount = centsToDecimal(line.fundAmount);
        result.fundTransaction = r.number;
      }
      if (line.coverRepayment > 0) {
        const r = await repayCoversTx(tx, g, actor, line.borrowerId, line.coverRepayment, method, reference, `${key}:C${i}`, id, at);
        result.coverRepayment = centsToDecimal(line.coverRepayment);
        result.coverTransactions = r.numbers;
      }
      results.push(result);
    }
    await tx.update(collections).set({ lines: results }).where(eq(collections.id, id));
    await audit(tx, g, actor, 'GROUP_COLLECTION_POSTED', `${number}: ${formatPeso(v.total)} from ${v.lines.length} member(s) of ${g.groupName} by ${paymentMethodLabel(method)}${reference ? ` ref ${reference}` : ''}.`, at);
    return id;
  });
  return collectionView(db, actor, collectionId);
}

export async function collectionView(db: AppDb, actor: GroupActor, collectionId: string) {
  const [c] = await db.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
  if (!c) throw new HttpError(404, 'Collection not found.', 'NOT_FOUND');
  const [g] = await db.select().from(groups).where(eq(groups.id, c.groupId)).limit(1);
  assertScope(actor, g);
  return { id: c.id, collectionNumber: c.collectionNumber, groupId: c.groupId, date: c.collectionDate, method: c.method, reference: c.reference, total: centsToDecimal(centsFromDb(c.total)), lines: c.lines, postedByName: c.postedByName };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

async function memberRows(db: AppDb, groupId: string, today: string) {
  const rows = await db
    .select({ m: members, b: schema.borrowers })
    .from(members)
    .innerJoin(schema.borrowers, eq(schema.borrowers.id, members.borrowerId))
    .where(and(eq(members.groupId, groupId), eq(members.status, 'ACTIVE')))
    .orderBy(asc(members.joinedAt), asc(members.createdAt), asc(members.id));
  const ids = rows.map((r) => r.b.id);
  const loans = ids.length
    ? await db
        .select({ id: schema.loans.id, loanNumber: schema.loans.loanNumber, borrowerId: schema.loans.borrowerId, status: schema.loans.status, remaining: schema.loans.remainingBalance, groupId: schema.loans.groupId })
        .from(schema.loans)
        .where(and(inArray(schema.loans.borrowerId, ids), inArray(schema.loans.status, [...RUNNING_LOAN_STATUSES]), eq(schema.loans.groupId, groupId)))
    : [];
  const sched = loans.length ? await db.select().from(schema.loanSchedule).where(inArray(schema.loanSchedule.loanId, loans.map((l) => l.id))) : [];
  const owed = await db.select().from(covers).where(and(eq(covers.groupId, groupId), eq(covers.status, 'OUTSTANDING')));
  return rows.map(({ m, b }) => {
    const mine = loans.filter((l) => l.borrowerId === b.id).map((l) => {
      const bal = sched.filter((s) => s.loanId === l.id).map(scheduleBalance);
      const overdue = bal.filter((x) => x.dueDate < today && outstandingOf(x).total > 0);
      const oldest = overdue.map((x) => x.dueDate).sort()[0] ?? null;
      return {
        id: l.id,
        loanNumber: l.loanNumber,
        status: l.status,
        remaining: centsToDecimal(centsFromDb(String(l.remaining ?? 0))),
        overdue: centsToDecimal(overdue.reduce((s, x) => s + outstandingOf(x).total, 0)),
        dueToday: centsToDecimal(bal.filter((x) => x.dueDate <= today).reduce((s, x) => s + outstandingOf(x).total, 0)),
        oldestOverdue: oldest,
      };
    });
    const coverOwed = owed.filter((c) => c.borrowerId === b.id).reduce((s, c) => s + centsFromDb(c.amount) - centsFromDb(c.repaid), 0);
    const behind = mine.some((l) => l.oldestOverdue);
    return {
      borrowerId: b.id,
      memberNumber: b.borrowerNumber,
      fullName: b.fullName,
      phone: b.phone,
      role: m.role as GroupRole,
      joinedAt: m.joinedAt,
      kycVerified: isKycVerified(b.kycStatus),
      loans: mine,
      coverOwed: centsToDecimal(coverOwed),
      standing: behind ? 'IN_ARREARS' : coverOwed > 0 ? 'OWES_FUND' : 'GOOD',
    };
  });
}

export async function listGroups(db: AppDb, actor: LendingStaff, filters: { status?: string; search?: string } = {}) {
  if (!READ.some((p) => has(actor, p))) throw new HttpError(403, 'Your role cannot view groups.', 'FORBIDDEN');
  const rows = await db
    .select()
    .from(groups)
    .where(
      and(
        actor.viewAll ? undefined : eq(groups.branchId, actor.branchId ?? '__none__'),
        filters.status ? eq(groups.status, filters.status) : undefined,
        filters.search ? sql`(${groups.groupName} ilike ${'%' + filters.search + '%'} or ${groups.groupCode} ilike ${'%' + filters.search + '%'} or ${groups.centerName} ilike ${'%' + filters.search + '%'})` : undefined,
      ),
    )
    .orderBy(asc(groups.groupName));
  const today = manilaToday();
  const counts = rows.length
    ? await db.select({ groupId: members.groupId, n: sql<number>`count(*)::int` }).from(members).where(and(inArray(members.groupId, rows.map((r) => r.id)), eq(members.status, 'ACTIVE'))).groupBy(members.groupId)
    : [];
  const ids = rows.map((r) => r.id);
  // Money out with members (running group loans) and members behind, per group.
  const exposure = ids.length
    ? await db
        .select({ groupId: schema.loans.groupId, total: sql<string>`coalesce(sum(${schema.loans.remainingBalance}), 0)::text`, n: sql<number>`count(*)::int` })
        .from(schema.loans)
        .where(and(inArray(schema.loans.groupId, ids), inArray(schema.loans.status, [...RUNNING_LOAN_STATUSES])))
        .groupBy(schema.loans.groupId)
    : [];
  const behind = ids.length
    ? await db
        .select({ groupId: schema.loans.groupId, n: sql<number>`count(distinct ${schema.loans.borrowerId})::int` })
        .from(schema.loanSchedule)
        .innerJoin(schema.loans, eq(schema.loans.id, schema.loanSchedule.loanId))
        .where(and(inArray(schema.loans.groupId, ids), inArray(schema.loans.status, [...RUNNING_LOAN_STATUSES]), sql`${schema.loanSchedule.dueDate} < ${today}`, sql`${schema.loanSchedule.status} <> 'PAID'`))
        .groupBy(schema.loans.groupId)
    : [];
  const out = [];
  for (const g of rows) {
    const block = g.status === 'ACTIVE' || g.status === 'SUSPENDED' ? await groupBlock(db, g, today) : { blocked: false, reasons: [] };
    const ex = exposure.find((e) => e.groupId === g.id);
    out.push({
      id: g.id,
      groupCode: g.groupCode,
      groupName: g.groupName,
      centerName: g.centerName,
      branchId: g.branchId,
      status: g.status as GroupStatus,
      memberCount: Number(counts.find((c) => c.groupId === g.id)?.n ?? 0),
      leaderName: g.leaderName,
      loanOfficerName: g.loanOfficerName,
      meetingDay: g.meetingDay,
      meetingTime: g.meetingTime,
      meetingFrequency: g.meetingFrequency,
      meetingLocation: g.meetingLocation,
      fundBalance: centsToDecimal(centsFromDb(g.fundBalance)),
      blocked: block.blocked,
      blockReasons: block.reasons,
      formedDate: g.formedDate,
      runningLoans: Number(ex?.n ?? 0),
      exposure: centsToDecimal(centsFromDb(ex?.total ?? '0')),
      membersInArrears: Number(behind.find((b) => b.groupId === g.id)?.n ?? 0),
    });
  }
  return out;
}

export async function groupDetail(db: AppDb, actor: GroupActor, groupId: string) {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!g) throw new HttpError(404, 'Group not found.', 'NOT_FOUND');
  assertScope(actor, g);
  if (actor.kind === 'staff' && !READ.some((p) => has(actor, p))) throw new HttpError(403, 'Your role cannot view groups.', 'FORBIDDEN');
  const today = manilaToday();
  const list = await memberRows(db, g.id, today);
  const block = g.status === 'ACTIVE' || g.status === 'SUSPENDED' ? await groupBlock(db, g, today) : { blocked: false, reasons: [] as string[] };
  return {
    group: {
      id: g.id,
      groupCode: g.groupCode,
      groupName: g.groupName,
      centerName: g.centerName,
      branchId: g.branchId,
      status: g.status as GroupStatus,
      statusReason: g.statusReason,
      formedDate: g.formedDate,
      meetingDay: g.meetingDay,
      meetingTime: g.meetingTime,
      meetingFrequency: g.meetingFrequency,
      meetingLocation: g.meetingLocation,
      loanOfficerId: g.loanOfficerId,
      loanOfficerName: g.loanOfficerName,
      leaderBorrowerId: g.leaderBorrowerId,
      leaderName: g.leaderName,
      arrearsThresholdDays: g.arrearsThresholdDays,
      fundBalance: centsToDecimal(centsFromDb(g.fundBalance)),
    },
    members: list,
    block,
    activationIssues:
      g.status === 'FORMING' || g.status === 'SUSPENDED' ? activationIssues(list.map((m) => ({ borrowerId: m.borrowerId, role: m.role, kycVerified: m.kycVerified }))) : [],
  };
}

export type GroupDetailView = Awaited<ReturnType<typeof groupDetail>>;

/** The member's own group, as the portal shows it: names and roles, not other members' balances. */
export async function myGroup(db: AppDb, actor: LendingClient) {
  const [m] = await db.select().from(members).where(and(eq(members.borrowerId, actor.borrowerId), eq(members.status, 'ACTIVE'))).limit(1);
  if (!m) return null;
  const d = await groupDetail(db, actor, m.groupId);
  const fund = await fundView(db, actor, m.groupId);
  const pending = (await pendingGroupLoans(db, actor, m.groupId)).map((l) => ({
    id: l.id,
    loanNumber: l.loanNumber,
    borrowerName: l.borrowerName,
    principalAmount: l.principalAmount,
    termMonths: l.termMonths,
    mine: l.borrowerId === actor.borrowerId,
    myDecision: l.consent.records.find((r) => r.borrowerId === actor.borrowerId)?.decision ?? null,
    consented: l.consent.consented.length,
    required: l.consent.required.length,
  }));
  const me = d.members.find((x) => x.borrowerId === actor.borrowerId);
  return {
    group: { ...d.group, loanOfficerId: undefined },
    members: d.members.map((x) => ({ borrowerId: x.borrowerId, fullName: x.fullName, role: x.role, standing: x.standing === 'GOOD' ? 'GOOD' : 'BEHIND' })),
    me: me ? { role: me.role, coverOwed: me.coverOwed, loans: me.loans } : null,
    blocked: d.block.blocked,
    fund: { balance: fund.balance, myCovers: fund.covers },
    pendingLoans: pending,
    meetings: (await groupMeetings(db, actor, m.groupId)).slice(0, 10).map((x) => ({ meetingDate: x.meetingDate, present: x.present, total: x.total, me: x.attendance.find((a) => a.borrowerId === actor.borrowerId)?.status ?? null })),
  };
}

/** Cached fund balances agree with the fund history and with GL 2040. */
export async function reconcileGroupFunds(db: AppDb) {
  const rows = await db.select().from(groups);
  const sums = await db.select({ groupId: fundTransactions.groupId, total: sql<string>`sum(${fundTransactions.signedAmount})::text` }).from(fundTransactions).groupBy(fundTransactions.groupId);
  const mismatches = rows
    .map((g) => ({ groupId: g.id, groupName: g.groupName, cached: centsFromDb(g.fundBalance), history: centsFromDb(sums.find((s) => s.groupId === g.id)?.total ?? '0') }))
    .filter((x) => x.cached !== x.history)
    .map((x) => ({ ...x, cached: centsToDecimal(x.cached), history: centsToDecimal(x.history) }));
  const gl = await db.execute(sql`select coalesce(sum(l.credit - l.debit), 0)::text as balance from journal_entry_lines l join accounts a on a.account_id = l.account_id where a.account_code = '2040'`);
  const glRow = ((gl as { rows?: { balance: string }[] }).rows ?? (gl as unknown as { balance: string }[]))[0];
  const total = rows.reduce((s, g) => s + centsFromDb(g.fundBalance), 0);
  const glCents = centsFromDb(glRow?.balance ?? '0');
  return { ok: mismatches.length === 0 && glCents === total, groupsChecked: rows.length, mismatches, generalLedger: centsToDecimal(glCents), funds: centsToDecimal(total) };
}

