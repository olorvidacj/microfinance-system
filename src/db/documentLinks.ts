import { HttpError } from '../kyc/errors';
import { activeBackend, signedKycUrl } from '../kyc/storage';
import { DOCUMENT_BUCKET } from './documentStorage';
import { existsInUploads, signedUploadLink } from './localFiles';

/**
 * Short-lived links to rows of the documents table, for branch staff and for
 * the member who owns them. Callers check branch scope or ownership first.
 *
 * A stored file is always served through a link signed now, from its storage
 * path. The file_url column is not trusted as a link: older rows kept the
 * signed link made at upload time, which has long expired.
 */

export const DOCUMENT_LINK_TTL_SECONDS = 600;

export interface DocumentFileRef {
  storagePath: string | null;
  fileUrl: string | null;
}

/** The bucket and object path inside a Supabase Storage URL (signed, public or authenticated), or null. */
export function supabaseObjectOf(url: string): { bucket: string; path: string } | null {
  const m = /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/?#]+)\/([^?#]+)/.exec(url);
  if (!m) return null;
  return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
}

/** The storage path a row's file lives at, or null when it has none of ours. */
export function documentObjectPath(doc: DocumentFileRef): string | null {
  if (doc.storagePath) return doc.storagePath;
  const url = doc.fileUrl?.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) {
    const obj = supabaseObjectOf(url);
    if (!obj) return null;
    // Only the private bucket is served. Anything in another bucket (such as
    // the retired public 'documents' bucket) is refused rather than re-signed.
    if (obj.bucket !== DOCUMENT_BUCKET) throw new HttpError(404, 'This document is no longer available.', 'NOT_FOUND');
    return obj.path;
  }
  // An old local link (/api/storage/<path>) names the file's path in the local store.
  const legacy = /^\/api\/storage\/(.+)$/.exec(url);
  if (legacy) return decodeURIComponent(legacy[1]);
  return url;
}

export async function documentFileLink(doc: DocumentFileRef, ttlSeconds = DOCUMENT_LINK_TTL_SECONDS): Promise<{ url: string; expiresInSeconds: number | null }> {
  const objectPath = documentObjectPath(doc);
  if (objectPath) {
    // KYC and loan uploads (kyc/...) live in the private KYC store, either backend.
    if (objectPath.startsWith('kyc/')) {
      return { url: await signedKycUrl({ backend: activeBackend(), path: objectPath }, ttlSeconds), expiresInSeconds: ttlSeconds };
    }
    // A branch document that was saved to this server's disk (src/db/localFiles.ts).
    if (existsInUploads(objectPath)) return { url: signedUploadLink(objectPath, ttlSeconds), expiresInSeconds: ttlSeconds };
    if (activeBackend() === 'local') throw new HttpError(404, 'This document has no stored file.', 'NO_FILE');
    return { url: await signedKycUrl({ backend: 'supabase', path: objectPath }, ttlSeconds), expiresInSeconds: ttlSeconds };
  }
  // A link to a file hosted elsewhere, recorded by staff as is.
  const url = doc.fileUrl?.trim();
  if (url && /^https?:\/\//i.test(url) && !supabaseObjectOf(url)) return { url, expiresInSeconds: null };
  throw new HttpError(404, 'This document has no stored file.', 'NO_FILE');
}
