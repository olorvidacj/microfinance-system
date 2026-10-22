import { bigint, boolean, date, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** The group service's view of its tables (0028): every amount is an exact decimal string. */

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

export const groups = pgTable('solidarity_groups', {
  id: text('id').primaryKey(),
  groupCode: text('group_code').notNull(),
  groupName: text('group_name').notNull(),
  centerName: text('center_name').notNull(),
  branchId: text('branch_id').notNull(),
  formedDate: text('formed_date').notNull(),
  meetingDay: text('meeting_day').notNull(),
  meetingTime: text('meeting_time').notNull(),
  meetingFrequency: text('meeting_frequency').notNull(),
  meetingLocation: text('meeting_location').notNull(),
  loanOfficerId: text('loan_officer_id').notNull(),
  loanOfficerName: text('loan_officer_name').notNull(),
  leaderBorrowerId: text('leader_borrower_id'),
  leaderName: text('leader_name'),
  leaderPhone: text('leader_phone'),
  members: jsonb('members'),
  fundBalance: money('solidarity_fund_balance').notNull(),
  jointLiabilityAgreed: boolean('joint_liability_agreed'),
  status: text('status').notNull(),
  statusReason: text('status_reason'),
  arrearsThresholdDays: integer('arrears_threshold_days').notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'string' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
  dissolvedAt: timestamp('dissolved_at', { withTimezone: true, mode: 'string' }),
});

export const members = pgTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  borrowerId: text('borrower_id').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull(),
  joinedAt: date('joined_at', { mode: 'string' }).notNull(),
  leftAt: date('left_at', { mode: 'string' }),
  leftReason: text('left_reason'),
  addedBy: text('added_by'),
  removedBy: text('removed_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
});

export const consents = pgTable('group_loan_consents', {
  id: text('id').primaryKey(),
  loanId: text('loan_id').notNull(),
  groupId: text('group_id').notNull(),
  borrowerId: text('borrower_id').notNull(),
  decision: text('decision').notNull(),
  channel: text('channel').notNull(),
  note: text('note'),
  recordedBy: text('recorded_by').notNull(),
  recordedByName: text('recorded_by_name'),
  recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' }).notNull(),
});

export const meetings = pgTable('group_meetings', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  meetingDate: date('meeting_date', { mode: 'string' }).notNull(),
  location: text('location'),
  notes: text('notes'),
  recordedBy: text('recorded_by').notNull(),
  recordedByName: text('recorded_by_name'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
});

export const attendance = pgTable(
  'group_attendance',
  {
    meetingId: text('meeting_id').notNull(),
    borrowerId: text('borrower_id').notNull(),
    status: text('status').notNull(),
    note: text('note'),
  },
  (t) => [primaryKey({ columns: [t.meetingId, t.borrowerId] })],
);

export const covers = pgTable('solidarity_covers', {
  id: text('id').primaryKey(),
  coverNumber: text('cover_number').notNull(),
  groupId: text('group_id').notNull(),
  loanId: text('loan_id').notNull(),
  borrowerId: text('borrower_id').notNull(),
  paymentId: text('payment_id').notNull(),
  amount: money('amount').notNull(),
  repaid: money('repaid').notNull(),
  status: text('status').notNull(),
  reason: text('reason').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  createdBy: text('created_by').notNull(),
  createdByName: text('created_by_name'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  repaidAt: timestamp('repaid_at', { withTimezone: true, mode: 'string' }),
});

export const collections = pgTable('group_collections', {
  id: text('id').primaryKey(),
  collectionNumber: text('collection_number').notNull(),
  groupId: text('group_id').notNull(),
  collectionDate: date('collection_date', { mode: 'string' }).notNull(),
  method: text('method').notNull(),
  reference: text('reference'),
  total: money('total').notNull(),
  lines: jsonb('lines').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  postedBy: text('posted_by').notNull(),
  postedByName: text('posted_by_name'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
});

export const fundTransactions = pgTable('group_fund_transactions', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  transactionNumber: text('transaction_number').notNull(),
  kind: text('kind').notNull(),
  signedAmount: money('signed_amount').notNull(),
  balanceBefore: money('balance_before').notNull(),
  balanceAfter: money('balance_after').notNull(),
  borrowerId: text('borrower_id'),
  coverId: text('cover_id'),
  collectionId: text('collection_id'),
  method: text('method'),
  reference: text('reference'),
  journalEntryId: uuid('journal_entry_id'),
  idempotencyKey: text('idempotency_key'),
  notes: text('notes'),
  entryDate: date('entry_date', { mode: 'string' }).notNull(),
  postedBy: text('posted_by').notNull(),
  postedByName: text('posted_by_name'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  sequence: bigint('sequence', { mode: 'number' }),
});

export const overdueAlerts = pgTable(
  'group_overdue_alerts',
  {
    loanId: text('loan_id').notNull(),
    installmentNumber: integer('installment_number').notNull(),
    groupId: text('group_id').notNull(),
    alertedAt: timestamp('alerted_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.loanId, t.installmentNumber] })],
);

export type GroupRow = typeof groups.$inferSelect;
export type MemberRow = typeof members.$inferSelect;
export type CoverRow = typeof covers.$inferSelect;
export type FundTxnRow = typeof fundTransactions.$inferSelect;
