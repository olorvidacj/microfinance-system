import fs from 'fs';
import path from 'path';
import { getServerSupabase } from './supabaseServer';
import { LOCAL_FILE_LINK_TTL_SECONDS, newStoredFileName, resolveUploadPath, signedUploadLink } from './localFiles';

export const DOCUMENT_BUCKET = 'kyc-documents';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * KYC evidence is image-only by policy. Branch records additionally accept PDF
 * because promissory notes and collateral documents are routinely PDFs.
 */
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_MIME = [...IMAGE_MIME, 'application/pdf'];

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

function stripDataUrlPrefix(base64: string): string {
  const idx = (base64 || '').indexOf(',');
  return idx >= 0 ? base64.slice(idx + 1) : base64;
}

function mimeFromBase64(base64: string, fallbackName?: string): string | null {
  const fromDataUrl = /^data:([a-zA-Z0-9./+-]+);base64,/.exec(base64 || '');
  if (fromDataUrl) return fromDataUrl[1];
  if (fallbackName) {
    const ext = fallbackName.split('.').pop()?.toLowerCase() || '';
    if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  }
  return null;
}

/** Filesystem-safe slug for a document type or client name. */
export function toStorageSlug(value: string): string {
  return (value || 'doc')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'doc';
}

export interface StoredDocument {
  path: string;
  signedUrl: string;
  contentType: string;
  sizeBytes: number;
  /** Original filename supplied by the client, or the generated name. */
  fileName: string;
}

/**
 * Stores base64 file content under `<scope>/<slug>/<timestamp>-<rand>.<ext>` and
 * returns a signed URL plus the canonical storage path.
 */
export async function storeDocument(params: {
  scope: string;
  ownerId: string;
  folder: string;
  base64: string;
  fileName?: string;
  mime?: string;
  acceptedMime?: string[];
  maxBytes?: number;
}): Promise<StoredDocument> {
  const { scope, ownerId, folder, base64, fileName, mime } = params;
  const accepted = params.acceptedMime || DOCUMENT_MIME;
  const maxBytes = params.maxBytes || MAX_FILE_BYTES;

  if (!base64) {
    throw new Error('No file content was received. Please choose a file and try again.');
  }

  const payload = stripDataUrlPrefix(base64);
  const buffer = Buffer.from(payload, 'base64');

  if (buffer.length < 128) {
    throw new Error('The selected file appears to be empty or corrupted.');
  }
  if (buffer.length > maxBytes) {
    throw new Error(`The selected file exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`);
  }

  const contentType = mime && accepted.includes(mime) ? mime : mimeFromBase64(base64, fileName);
  if (!contentType || !accepted.includes(contentType)) {
    throw new Error('That file type is not accepted. Upload a JPG, PNG, WEBP, or PDF.');
  }

  const ext = EXT_BY_MIME[contentType] || 'bin';
  const unique = newStoredFileName(ext);
  const objectPath = `${toStorageSlug(scope)}/${toStorageSlug(ownerId)}/${toStorageSlug(folder)}/${unique}`;
  const stored = (signedUrl: string): StoredDocument => ({ path: objectPath, signedUrl, contentType, sizeBytes: buffer.length, fileName: fileName?.trim() || unique });

  const supabase = getServerSupabase();
  let supabaseFailure: string | null = null;
  if (supabase) {
    // A network failure throws instead of returning an error; both are a storage failure, handled below.
    const upErr = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(objectPath, buffer, { contentType, upsert: false })
      .then(
        (r) => r.error,
        (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
      );
    if (!upErr) {
      const { data: signed, error: signErr } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(objectPath, LOCAL_FILE_LINK_TTL_SECONDS);
      if (signErr || !signed?.signedUrl) throw new Error('The file was stored, but a link to it could not be created. Open it again from the document list.');
      return stored(signed.signedUrl);
    }
    supabaseFailure = upErr.message;
  }

  // The local store is for development. In production it is used only when
  // ALLOW_LOCAL_FILE_STORAGE=true says this server's disk is where files belong.
  if (!localFileStorageAllowed()) {
    console.error(`[Document Storage] upload refused: ${supabaseFailure ? `Supabase storage failed (${supabaseFailure})` : 'Supabase storage is not configured'} and the local fallback is off in production.`);
    throw new Error('The file could not be stored right now. Please try again later.');
  }
  if (supabaseFailure) console.warn(`[Document Storage] Supabase storage failed (${supabaseFailure}); saving to the local store.`);
  const full = resolveUploadPath(objectPath);
  if (!full) throw new Error('The file could not be stored.');
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer, { flag: 'wx' });
  return stored(signedUploadLink(objectPath));
}

/** Whether files may be written to this server's disk: always in development, in production only when allowed explicitly. */
export function localFileStorageAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_FILE_STORAGE === 'true';
}
