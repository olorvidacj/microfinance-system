import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { HttpError, type AppDb } from '../kyc/errors';
import { signedKycUrl } from '../kyc/storage';
import { getServerSupabase } from '../db/supabaseServer';
import { DOCUMENT_BUCKET } from '../db/documentStorage';
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
  if (doc.fileUrl && /^https:\/\//i.test(doc.fileUrl)) return { url: doc.fileUrl, expiresInSeconds: null };
  const supabase = getServerSupabase();
  // Files uploaded through the KYC/loan storage (src/kyc/storage.ts) live under kyc/.
  if (doc.storagePath && doc.storagePath.startsWith('kyc/')) {
    return { url: await signedKycUrl({ backend: supabase ? 'supabase' : 'local', path: doc.storagePath }, 600), expiresInSeconds: 600 };
  }
  const path = doc.storagePath || doc.fileUrl;
  if (!path) throw new HttpError(404, 'This document has no stored file.', 'NO_FILE');
  if (!supabase) throw new HttpError(503, 'Document storage is not available right now.', 'STORAGE_UNAVAILABLE');
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new HttpError(502, 'Could not create a link to the document.', 'STORAGE_FAILED');
  return { url: data.signedUrl, expiresInSeconds: 600 };
}
