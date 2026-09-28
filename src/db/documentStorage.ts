import fs from 'fs';
import path from 'path';
import { getServerSupabase } from './supabaseServer';

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
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const safeOwner = toStorageSlug(ownerId);
  const safeFolder = toStorageSlug(folder);
  const objectPath = `${scope}/${safeOwner}/${safeFolder}/${unique}`;

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { error: upErr } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(objectPath, buffer, { contentType, upsert: false });

      if (!upErr) {
        const { data: signed, error: signErr } = await supabase.storage
          .from(DOCUMENT_BUCKET)
          .createSignedUrl(objectPath, 60 * 30);
        if (!signErr && signed?.signedUrl) {
          return {
            path: objectPath,
            signedUrl: signed.signedUrl,
            contentType,
            sizeBytes: buffer.length,
            fileName: fileName?.trim() || unique,
          };
        }
      } else {
        console.warn(`[Document Storage] Supabase storage error (${upErr.message}), saving to local storage.`);
      }
    } catch (e: any) {
      console.warn(`[Document Storage] Supabase storage exception (${e.message}), saving to local storage.`);
    }
  }

  // Local persistent disk storage fallback
  const localDir = path.join(process.cwd(), 'uploads', scope, safeOwner, safeFolder);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  const filePath = path.join(localDir, unique);
  fs.writeFileSync(filePath, buffer);
  const localUrl = `/api/storage/${scope}/${safeOwner}/${safeFolder}/${unique}`;

  return {
    path: objectPath,
    signedUrl: localUrl,
    contentType,
    sizeBytes: buffer.length,
    fileName: fileName?.trim() || unique,
  };
}
