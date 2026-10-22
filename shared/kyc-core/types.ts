import type { Discrepancy, ExtractedIdentity } from './discrepancies';
import type { QualityReport } from './imageQuality';

/**
 * Result of the automated ID scan. When no scanner is configured or the call
 * fails, status says so and `fields` is empty: nothing is ever filled in with
 * guessed values, and the reviewer relies on the image itself.
 */
export interface OcrResult {
  status: 'COMPLETED' | 'UNAVAILABLE' | 'FAILED';
  provider: string | null;
  readable: boolean | null;
  confidence: number | null;
  detectedIdType: string | null;
  fields: ExtractedIdentity & {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    sex?: string | null;
    address?: string | null;
    issueDate?: string | null;
  };
  warnings: string[];
  error: string | null;
  processedAt: string;
}

export type FaceMatchStatus = 'MATCH' | 'LOW_CONFIDENCE' | 'NO_MATCH' | 'UNAVAILABLE' | 'FAILED';

export interface FaceCheck {
  status: FaceMatchStatus;
  provider: string | null;
  confidence: number | null;
  details: string | null;
  /** The kyc_documents rows that were compared. */
  idDocumentId: string | null;
  selfieDocumentId: string | null;
  processedAt: string;
}

/**
 * Face-verification services whose result is evidence of a match. Results
 * from anything else (including the AI estimates stored before 2026-10-22,
 * provider "gemini:...") are not face verification.
 */
export const TRUSTED_FACE_PROVIDERS: readonly string[] = ['aws-rekognition'];

/** Whether a face check is a real verification match. A reviewer still decides the application. */
export function faceCheckIsVerification(check: FaceCheck | null | undefined): boolean {
  return check?.status === 'MATCH' && TRUSTED_FACE_PROVIDERS.includes(String(check.provider ?? ''));
}

/** How a face check reads to members and staff; never claims more than the provider said. */
export function faceCheckSummary(check: FaceCheck | null | undefined): string {
  if (!check) return 'Not checked yet';
  if (!TRUSTED_FACE_PROVIDERS.includes(String(check.provider ?? ''))) {
    return check.provider ? 'Not verified: an AI estimate, not face verification. Compare the photos yourself.' : 'No face-verification service: compare the photos yourself.';
  }
  if (check.status === 'MATCH') return `Matches the ID portrait (${check.confidence}% similarity)`;
  if (check.status === 'LOW_CONFIDENCE') return `Uncertain (${check.confidence}% similarity): compare the photos yourself`;
  if (check.status === 'NO_MATCH') return `May not match (${check.confidence}% similarity): compare the photos yourself`;
  return check.details ?? 'The check could not be completed: compare the photos yourself.';
}

export interface AutomatedChecks {
  ocr: OcrResult | null;
  faceCheck: FaceCheck | null;
  discrepancies: Discrepancy[];
  idQuality: QualityReport | null;
}
