import { UPLOAD_LIMITS } from '../../shared/kyc-core';
import { HttpError } from '../kyc/errors';
import { sniffMime } from '../kyc/imageDecode';
import { putKycObject } from '../kyc/storage';
import type { StoredLoanDocument } from './service';

export const LOAN_DOCUMENT_TYPES: Readonly<Record<string, string>> = {
  PROOF_OF_INCOME: 'Proof of income',
  GUARANTOR_COLLATERAL: 'Guarantor ID / collateral proof',
  OTHER: 'Supporting document',
};
const MAX_DOCUMENTS = 4;

/**
 * Checks every attached file (type from its bytes, size), then stores them in
 * the private document bucket. Nothing is stored unless all of them pass.
 */
export async function storeLoanDocuments(borrowerId: string, input: unknown): Promise<StoredLoanDocument[]> {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new HttpError(400, 'documents must be a list.', 'BAD_FILE');
  if (input.length > MAX_DOCUMENTS) throw new HttpError(400, `Attach at most ${MAX_DOCUMENTS} documents.`, 'TOO_MANY_FILES');

  const checked = input.map((doc: any, i: number) => {
    const docType = String(doc?.docType ?? '').toUpperCase();
    if (!LOAN_DOCUMENT_TYPES[docType]) throw new HttpError(400, `Document ${i + 1} has an unknown type.`, 'BAD_FILE');
    const raw = typeof doc?.base64 === 'string' ? doc.base64 : '';
    const comma = raw.indexOf(',');
    const payload = raw.startsWith('data:') && comma >= 0 ? raw.slice(comma + 1) : raw;
    if (!payload || !/^[A-Za-z0-9+/=\s]+$/.test(payload)) throw new HttpError(400, `Document ${i + 1} is not a valid file.`, 'BAD_FILE');
    const buffer = Buffer.from(payload, 'base64');
    if (buffer.length === 0) throw new HttpError(400, `Document ${i + 1} is empty.`, 'BAD_FILE');
    if (buffer.length > UPLOAD_LIMITS.maxBytes) throw new HttpError(413, `Document ${i + 1} is larger than 10 MB.`, 'FILE_TOO_LARGE');
    const mime = sniffMime(buffer);
    if (!mime || !UPLOAD_LIMITS.mimeTypes.includes(mime)) throw new HttpError(415, `Document ${i + 1} must be a JPEG, PNG, WebP or PDF file.`, 'UNSUPPORTED_TYPE');
    const fileName = typeof doc?.fileName === 'string' && doc.fileName.trim() ? doc.fileName.trim().slice(0, 120) : `${docType.toLowerCase()}.${mime.split('/')[1]}`;
    return { docType, buffer, mime, fileName };
  });

  const stored: StoredLoanDocument[] = [];
  for (const c of checked) {
    const ref = await putKycObject({ borrowerId, kind: `loan-${c.docType}`, buffer: c.buffer, mime: c.mime });
    stored.push({ docType: c.docType, docName: LOAN_DOCUMENT_TYPES[c.docType], fileName: c.fileName, ref });
  }
  return stored;
}
