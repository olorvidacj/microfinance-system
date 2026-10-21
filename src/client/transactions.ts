import { and, desc, eq, gte } from 'drizzle-orm';
import { HttpError, type AppDb } from '../kyc/errors';
import { centsFromDb, centsToDecimal } from '../../shared/lending';
import { TRANSACTION_KINDS, transactionDirection, transactionKindOf, type ClientTransactionView, type TransactionKind } from '../../shared/client';
import type { LendingClient } from '../lending/service';
import { register } from '../lending/tables';

type RegisterRow = typeof register.$inferSelect;

export function transactionView(r: RegisterRow): ClientTransactionView {
  return {
    id: r.id,
    date: r.transactionDate,
    kind: transactionKindOf(r.transactionType),
    label: r.transactionType,
    reference: r.referenceNumber,
    amount: centsToDecimal(centsFromDb(String(r.amount))),
    direction: transactionDirection(r.transactionType),
    account: r.accountOrLoanType ?? '',
    method: r.paymentMethod,
    status: r.status,
    notes: r.notes,
  };
}

export interface TransactionFilter {
  kind?: unknown;
  search?: unknown;
  /** YYYY-MM-DD: only transactions on or after this date. */
  from?: unknown;
}

const MAX_ROWS = 500;

/** The member's own register rows, newest first. */
export async function clientTransactions(db: AppDb, client: LendingClient, filter: TransactionFilter = {}): Promise<ClientTransactionView[]> {
  const kind = (TRANSACTION_KINDS as readonly string[]).includes(String(filter.kind)) ? (String(filter.kind) as TransactionKind) : null;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(filter.from ?? '')) ? String(filter.from) : null;
  const search = typeof filter.search === 'string' ? filter.search.trim().toLowerCase() : '';
  const rows = await db
    .select()
    .from(register)
    .where(and(eq(register.clientId, client.borrowerId), from ? gte(register.transactionDate, from) : undefined))
    .orderBy(desc(register.transactionDate), desc(register.createdAt))
    .limit(MAX_ROWS);
  return rows
    .map(transactionView)
    .filter((t) => (kind ? t.kind === kind : true))
    .filter((t) => (search ? [t.reference, t.label, t.notes ?? '', t.account].some((v) => v.toLowerCase().includes(search)) : true));
}

/** One of the member's transactions; another member's id is "not found". */
export async function clientTransaction(db: AppDb, client: LendingClient, id: string): Promise<ClientTransactionView> {
  const [row] = await db
    .select()
    .from(register)
    .where(and(eq(register.id, id), eq(register.clientId, client.borrowerId)))
    .limit(1);
  if (!row) throw new HttpError(404, 'Transaction not found.', 'NOT_FOUND');
  return transactionView(row);
}
