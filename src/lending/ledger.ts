import { eq, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { centsFromDb, centsToDecimal, isBalanced, type JournalLine } from '../../shared/lending';
import { HttpError, type AppDb } from '../kyc/errors';

/**
 * Posts one balanced journal entry. The database re-checks the balance when
 * the transaction commits (trg_entry_balanced), so an unbalanced entry can
 * never be saved even if this check were bypassed.
 */
export async function postJournal(
  tx: AppDb,
  e: {
    lines: readonly JournalLine[];
    entryDate: string;
    description: string;
    reference: string;
    sourceModule: string;
    sourceRef: string;
    branchId: string;
    postedBy: string;
    postedByName: string;
    idempotencyKey: string | null;
    at: string;
  },
): Promise<string> {
  if (!isBalanced(e.lines)) throw new HttpError(500, 'The journal entry does not balance.', 'UNBALANCED');
  const codes = Array.from(new Set(e.lines.map((l) => l.accountCode)));
  const accounts = await tx.select().from(schema.ledgerAccounts).where(inArray(schema.ledgerAccounts.accountCode, codes));
  const ids = new Map(accounts.map((a) => [a.accountCode, a.accountId]));
  const missing = codes.filter((c) => !ids.has(c));
  if (missing.length) throw new HttpError(500, `The chart of accounts is missing ${missing.join(', ')}.`, 'LEDGER_ACCOUNT_MISSING');
  const [entry] = await tx
    .insert(schema.journalEntries)
    .values({
      entryDate: e.entryDate,
      description: e.description,
      referenceNumber: e.reference,
      sourceModule: e.sourceModule,
      sourceRef: e.sourceRef,
      branchId: e.branchId,
      postedBy: e.postedBy,
      postedByName: e.postedByName,
      idempotencyKey: e.idempotencyKey,
      status: 'posted',
      createdAt: e.at,
    })
    .returning({ id: schema.journalEntries.journalEntryId });
  await tx.insert(schema.journalEntryLines).values(
    e.lines.map((l, i) => ({
      entryId: entry.id,
      lineNumber: i + 1,
      accountId: ids.get(l.accountCode) as string,
      debit: centsToDecimal(l.debit),
      credit: centsToDecimal(l.credit),
      memo: l.memo,
    })),
  );
  return entry.id;
}

/** The lines of a posted entry, for building its reversal. */
export async function journalLines(tx: AppDb, entryId: string): Promise<JournalLine[]> {
  const rows = await tx
    .select({ code: schema.ledgerAccounts.accountCode, debit: schema.journalEntryLines.debit, credit: schema.journalEntryLines.credit, memo: schema.journalEntryLines.memo, n: schema.journalEntryLines.lineNumber })
    .from(schema.journalEntryLines)
    .innerJoin(schema.ledgerAccounts, eq(schema.ledgerAccounts.accountId, schema.journalEntryLines.accountId))
    .where(eq(schema.journalEntryLines.entryId, entryId));
  return rows
    .sort((a, b) => a.n - b.n)
    .map((r) => ({ accountCode: r.code, debit: centsFromDb(r.debit), credit: centsFromDb(r.credit), memo: r.memo ?? '' }));
}
