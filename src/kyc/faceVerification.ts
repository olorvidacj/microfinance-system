import { CompareFacesCommand, RekognitionClient } from '@aws-sdk/client-rekognition';
import type { FaceCheck } from '../../shared/kyc-core';
import type { ImageInput } from './automation';

/**
 * Comparing the selfie with the ID portrait.
 *
 * Only a face-verification service may produce a match result. When none is
 * configured, or the call fails, the result says so and a branch officer
 * compares the photos; nothing is estimated. The result is evidence for the
 * reviewer, never an approval.
 *
 * Settings (server only):
 *   FACE_VERIFICATION_PROVIDER   aws-rekognition (unset: none, manual review)
 *   AWS_REGION                   e.g. ap-southeast-1
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   an IAM user allowed rekognition:CompareFaces only
 *   FACE_MATCH_MIN_SIMILARITY    similarity (0-100) reported as a match; default 95
 *
 * Rekognition's CompareFaces keeps no face data from the call: no templates
 * or collections are created.
 */
export type FaceResult = Pick<FaceCheck, 'status' | 'provider' | 'confidence' | 'details'>;

export interface FaceVerifier {
  readonly provider: string | null;
  compare(idFront: ImageInput, selfie: ImageInput): Promise<FaceResult>;
}

export const unavailableFaceVerifier: FaceVerifier = {
  provider: null,
  async compare() {
    return { status: 'UNAVAILABLE', provider: null, confidence: null, details: 'No face-verification service is configured. A branch officer will compare your selfie with your ID photo.' };
  },
};

interface RekognitionLike {
  send(command: CompareFacesCommand): Promise<{ FaceMatches?: { Similarity?: number }[]; UnmatchedFaces?: unknown[] }>;
}

/** Band edges: at or above `match` is a match; within 15 points below it, low confidence. */
export function rekognitionStatus(similarity: number, match: number): FaceResult['status'] {
  if (similarity >= match) return 'MATCH';
  if (similarity >= Math.max(0, match - 15)) return 'LOW_CONFIDENCE';
  return 'NO_MATCH';
}

export function rekognitionFaceVerifier(opts: { client: RekognitionLike; minSimilarity?: number }): FaceVerifier {
  const match = opts.minSimilarity ?? 95;
  const provider = 'aws-rekognition';
  return {
    provider,
    async compare(idFront, selfie) {
      try {
        // Source: the selfie (one face). Target: the ID, which may also carry a small ghost portrait.
        const out = await opts.client.send(
          new CompareFacesCommand({ SourceImage: { Bytes: selfie.buffer }, TargetImage: { Bytes: idFront.buffer }, SimilarityThreshold: 0, QualityFilter: 'AUTO' }),
        );
        const scores = (out.FaceMatches ?? []).map((m) => m.Similarity).filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
        if (!scores.length) {
          return { status: 'FAILED', provider, confidence: null, details: 'No face could be found on the ID photo. A branch officer will compare the photos.' };
        }
        const best = Math.round(Math.max(...scores) * 10) / 10;
        const status = rekognitionStatus(best, match);
        return {
          status,
          provider,
          confidence: best,
          details:
            status === 'MATCH'
              ? `The face-verification service reports a ${best}% similarity with the ID portrait.`
              : status === 'LOW_CONFIDENCE'
                ? `The face-verification service reports only ${best}% similarity; a branch officer will check.`
                : `The face-verification service reports ${best}% similarity: the selfie may not match the ID photo.`,
        };
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        // No face in the selfie, or an unreadable image: the member can retake it.
        if (name === 'InvalidParameterException' || name === 'InvalidImageFormatException' || name === 'ImageTooLargeException') {
          return { status: 'FAILED', provider, confidence: null, details: 'No clear face was found in the selfie. Retake it facing the camera in good light.' };
        }
        return { status: 'FAILED', provider, confidence: null, details: 'The face-verification service could not be reached. A branch officer will compare the photos.' };
      }
    },
  };
}

let cached: FaceVerifier | null = null;

export function defaultFaceVerifier(): FaceVerifier {
  if (cached) return cached;
  const name = String(process.env.FACE_VERIFICATION_PROVIDER ?? '').trim().toLowerCase();
  if (name !== 'aws-rekognition') {
    if (name) console.warn(`[KYC] Unknown FACE_VERIFICATION_PROVIDER "${name}": face comparison is left to branch staff.`);
    cached = unavailableFaceVerifier;
    return cached;
  }
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn('[KYC] FACE_VERIFICATION_PROVIDER=aws-rekognition needs AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY: face comparison is left to branch staff.');
    cached = unavailableFaceVerifier;
    return cached;
  }
  const min = Number(process.env.FACE_MATCH_MIN_SIMILARITY);
  cached = rekognitionFaceVerifier({ client: new RekognitionClient({ region }), minSimilarity: Number.isFinite(min) && min > 0 && min <= 100 ? min : 95 });
  return cached;
}
