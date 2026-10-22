import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { HttpError, type AppDb } from '../kyc/errors';
import { documentFileLink } from '../db/documentLinks';
import type { LendingClient } from '../lending/service';
import type { ClientDocumentView } from '../../shared/client';

/** The member's own document records, newest first. */
export async function clientDocuments(db: AppDb, client: LendingClient): Promise<ClientDocumentView[]> {
  const rows = await db.select().from(schema.documents).where(eq(schema.documents.clientId, client.borrowerId)).orderBy(desc(schema.documents.createdAt));
  return rows.map((d) => ({
    id: d.id,
    name: d.docName,
    type: d.docType,
    date: d.createdAt,
    relatedLoanNumber: d.loanNumber ?? undefined,
    hasFile: Boolean(d.storagePath || d.fileUrl),
  }));
}

/**
 * A short-lived link to one of the member's own stored documents. Another
 * member's document id answers 404, the same as a missing one.
 */
export async function clientDocumentLink(db: AppDb, client: LendingClient, documentId: string): Promise<{ url: string; expiresInSeconds: number | null }> {
  const [doc] = await db
    .select({ fileUrl: schema.documents.fileUrl, storagePath: schema.documents.storagePath })
    .from(schema.documents)
    .where(and(eq(schema.documents.id, documentId), eq(schema.documents.clientId, client.borrowerId)))
    .limit(1);
  if (!doc) throw new HttpError(404, 'Document not found.', 'NOT_FOUND');
  return documentFileLink(doc);
}
