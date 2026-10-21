import { FACE_MATCH_THRESHOLDS } from './config';
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

export function classifyFaceMatch(confidence: number): Extract<FaceMatchStatus, 'MATCH' | 'LOW_CONFIDENCE' | 'NO_MATCH'> {
  if (confidence >= FACE_MATCH_THRESHOLDS.match) return 'MATCH';
  if (confidence >= FACE_MATCH_THRESHOLDS.lowConfidence) return 'LOW_CONFIDENCE';
  return 'NO_MATCH';
}

/**
 * A clear mismatch blocks submission; the member must retake the selfie.
 * Low confidence and an unavailable check go through, flagged for the reviewer.
 */
export function faceCheckBlocksSubmission(check: FaceCheck | null | undefined): boolean {
  return check?.status === 'NO_MATCH';
}

export interface AutomatedChecks {
  ocr: OcrResult | null;
  faceCheck: FaceCheck | null;
  discrepancies: Discrepancy[];
  idQuality: QualityReport | null;
}
