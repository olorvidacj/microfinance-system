import { bigint, date, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** The savings service's view of its tables: every amount and rate is an exact decimal string. */

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

export const products = pgTable('savings_products', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  annualRate: numeric('annual_rate', { precision: 7, scale: 4 }).notNull(),
  accrualMethod: text('accrual_method').notNull(),
  minimumBalance: money('minimum_balance').notNull(),
  minimumOpeningDeposit: money('minimum_opening_deposit').notNull(),
  maxWithdrawalAmount: money('max_withdrawal_amount'),
  maxWithdrawalsPerMonth: integer('max_withdrawals_per_month'),
  termMonths: integer('term_months'),
  status: text('status').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const accounts = pgTable('savings_accounts', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull(),
  memberName: text('member_name').notNull(),
  passbookNumber: text('passbook_number').notNull(),
  balance: money('balance').notNull(),
  maintainingBalance: money('maintaining_balance'),
  interestRate: numeric('interest_rate', { precision: 7, scale: 4 }),
  createdAt: timestamp('created_at', { mode: 'string' }),
  productId: text('product_id').notNull(),
  status: text('status').notNull(),
  branchId: text('branch_id'),
  openedAt: timestamp('opened_at', { withTimezone: true, mode: 'string' }),
  closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' }),
  statusReason: text('status_reason'),
  lastActivityDate: date('last_activity_date', { mode: 'string' }),
  maturityDate: date('maturity_date', { mode: 'string' }),
  groupId: text('group_id'),
});

export const transactions = pgTable('savings_transactions', {
  id: text('id').primaryKey(),
  savingsAccountId: text('savings_account_id').notNull(),
  memberId: text('member_id').notNull(),
  memberName: text('member_name').notNull(),
  transactionNumber: text('transaction_number').notNull(),
  date: text('date').notNull(),
  type: text('type').notNull(),
  amount: money('amount').notNull(),
  balanceBefore: money('balance_before').notNull(),
  balanceAfter: money('balance_after').notNull(),
  processedBy: text('processed_by').notNull(),
  notes: text('notes'),
  officialReceiptNumber: text('official_receipt_number'),
  createdAt: timestamp('created_at', { mode: 'string' }),
  kind: text('kind').notNull(),
  signedAmount: money('signed_amount').notNull(),
  method: text('method'),
  reference: text('reference'),
  destinationAccount: text('destination_account'),
  journalEntryId: text('journal_entry_id'),
  idempotencyKey: text('idempotency_key'),
  interestPeriod: text('interest_period'),
  branchId: text('branch_id'),
  postedBy: text('posted_by'),
  withdrawalRequestId: text('withdrawal_request_id'),
  sequence: bigint('sequence', { mode: 'number' }),
});

export const requests = pgTable('savings_withdrawal_requests', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull(),
  memberId: text('member_id').notNull(),
  memberName: text('member_name').notNull(),
  branchId: text('branch_id').notNull(),
  accountId: text('account_id'),
  currentBalance: money('current_balance').notNull(),
  accountBalanceBefore: money('account_balance_before'),
  requestedAmount: money('requested_amount').notNull(),
  maintainingBalance: money('maintaining_balance'),
  remainingBalanceAfter: money('remaining_balance_after').notNull(),
  requestDate: text('request_date').notNull(),
  reason: text('reason').notNull(),
  tellerName: text('teller_name').notNull(),
  tellerRecordedDate: text('teller_recorded_date').notNull(),
  status: text('status').notNull(),
  approvedByManager: text('approved_by_manager'),
  approvalDate: text('approval_date'),
  disbursedDate: text('disbursed_date'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { mode: 'string' }),
  destination: text('destination'),
  destinationAccount: text('destination_account'),
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true, mode: 'string' }),
  transactionId: text('transaction_id'),
});

export type AccountRow = typeof accounts.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type TxnRow = typeof transactions.$inferSelect;
export type RequestRow = typeof requests.$inferSelect;
