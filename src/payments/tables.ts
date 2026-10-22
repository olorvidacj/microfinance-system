import { boolean, integer, jsonb, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** The online payments tables (0030). Every amount is an exact decimal string. */

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const at = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const payoutAccounts = pgTable('payout_accounts', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull(),
  branchId: text('branch_id').notNull(),
  channelCode: text('channel_code').notNull(),
  channelKind: text('channel_kind').notNull(),
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name').notNull(),
  status: text('status').notNull(),
  statusReason: text('status_reason'),
  decidedBy: text('decided_by'),
  decidedByName: text('decided_by_name'),
  decidedAt: at('decided_at'),
  createdAt: at('created_at').notNull(),
});

export const deposits = pgTable('online_deposits', {
  id: text('id').primaryKey(),
  reference: text('reference').notNull(),
  provider: text('provider').notNull(),
  providerRef: text('provider_ref'),
  checkoutUrl: text('checkout_url'),
  memberId: text('member_id').notNull(),
  accountId: text('account_id').notNull(),
  branchId: text('branch_id').notNull(),
  amount: money('amount').notNull(),
  paidAmount: money('paid_amount'),
  fee: money('fee'),
  status: text('status').notNull(),
  reviewReason: text('review_reason'),
  savingsTransactionId: text('savings_transaction_id'),
  expiresAt: at('expires_at'),
  paidAt: at('paid_at'),
  creditedAt: at('credited_at'),
  resolvedBy: text('resolved_by'),
  resolvedByName: text('resolved_by_name'),
  resolvedAt: at('resolved_at'),
  resolutionNote: text('resolution_note'),
  createdAt: at('created_at').notNull(),
  updatedAt: at('updated_at').notNull(),
});

export const payouts = pgTable('online_payouts', {
  id: text('id').primaryKey(),
  reference: text('reference').notNull(),
  provider: text('provider').notNull(),
  providerRef: text('provider_ref'),
  memberId: text('member_id').notNull(),
  accountId: text('account_id').notNull(),
  branchId: text('branch_id').notNull(),
  payoutAccountId: text('payout_account_id').notNull(),
  channelCode: text('channel_code').notNull(),
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name').notNull(),
  amount: money('amount').notNull(),
  businessDate: text('business_date').notNull(),
  status: text('status').notNull(),
  otpHash: text('otp_hash'),
  otpExpiresAt: at('otp_expires_at'),
  otpAttempts: integer('otp_attempts').notNull(),
  debitTransactionId: text('debit_transaction_id'),
  refundTransactionId: text('refund_transaction_id'),
  failureReason: text('failure_reason'),
  reviewReason: text('review_reason'),
  submittedAt: at('submitted_at'),
  paidAt: at('paid_at'),
  refundedAt: at('refunded_at'),
  resolvedBy: text('resolved_by'),
  resolvedByName: text('resolved_by_name'),
  resolvedAt: at('resolved_at'),
  resolutionNote: text('resolution_note'),
  createdAt: at('created_at').notNull(),
  updatedAt: at('updated_at').notNull(),
});

export const events = pgTable('payment_events', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  kind: text('kind').notNull(),
  providerRef: text('provider_ref'),
  reference: text('reference'),
  verified: boolean('verified').notNull(),
  outcome: text('outcome').notNull(),
  payload: jsonb('payload').notNull(),
  receivedAt: at('received_at').notNull(),
});

export type PayoutAccountRow = typeof payoutAccounts.$inferSelect;
export type DepositRow = typeof deposits.$inferSelect;
export type PayoutRow = typeof payouts.$inferSelect;
