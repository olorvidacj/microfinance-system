import { GoogleGenAI } from '@google/genai';
import { classifyFaceMatch, type FaceCheck, type OcrResult } from '../../shared/kyc-core';

export interface ImageInput {
  buffer: Buffer;
  mime: string;
}

/**
 * The automated half of KYC: reading the ID and comparing the selfie with the
 * ID portrait. Results are advisory evidence for the reviewer; a human decides.
 */
export interface KycAutomation {
  readonly provider: string | null;
  scanId(front: ImageInput, back: ImageInput | null): Promise<OcrResult>;
  compareFaces(idFront: ImageInput, selfie: ImageInput): Promise<Pick<FaceCheck, 'status' | 'provider' | 'confidence' | 'details'>>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyOcr(status: OcrResult['status'], provider: string | null, error: string | null): OcrResult {
  return {
    status,
    provider,
    readable: null,
    confidence: null,
    detectedIdType: null,
    fields: {},
    warnings: [],
    error,
    processedAt: nowIso(),
  };
}

/** Used when no scanner is configured: says so plainly instead of returning plausible data. */
export const unavailableAutomation: KycAutomation = {
  provider: null,
  async scanId() {
    return emptyOcr('UNAVAILABLE', null, 'Automated ID reading is not configured on this server.');
  },
  async compareFaces() {
    return { status: 'UNAVAILABLE', provider: null, confidence: null, details: 'Automated face comparison is not configured on this server.' };
  },
};

const OCR_PROMPT = `You read Philippine government ID cards for a cooperative's KYC review.
Read only what is printed. Never guess: use null for anything not clearly legible.
Return JSON with exactly these keys:
{
  "readable": boolean,            // text and portrait legible
  "confidence": number,           // 0-100, your confidence in the extracted text
  "idType": "PHILSYS_ID" | "DRIVERS_LICENSE" | "PASSPORT" | "UMID" | "SSS_ID" | "PRC_ID" | "POSTAL_ID" | "VOTERS_ID" | "TIN_ID" | "OTHER" | null,
  "idNumber": string | null,
  "fullName": string | null,
  "firstName": string | null,
  "middleName": string | null,
  "lastName": string | null,
  "dateOfBirth": string | null,   // YYYY-MM-DD
  "sex": "Male" | "Female" | null,
  "address": string | null,
  "issueDate": string | null,     // YYYY-MM-DD
  "expirationDate": string | null,// YYYY-MM-DD
  "warnings": string[]
}`;

const FACE_PROMPT = `Image 1 is a Philippine government ID card. Image 2 is a selfie.
Decide whether the selfie shows the same person as the ID portrait.
Return JSON: {"confidence": number (0-100), "details": string (one sentence)}.
If either face is not visible, return confidence 0 and say why.`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

function date(v: unknown): string | null {
  const s = str(v);
  return s && DATE_RE.test(s) ? s : null;
}

function clamp(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

export function geminiAutomation(apiKey: string, model = 'gemini-2.5-flash'): KycAutomation {
  const ai = new GoogleGenAI({ apiKey });
  const provider = `gemini:${model}`;
  const part = (img: ImageInput) => ({ inlineData: { data: img.buffer.toString('base64'), mimeType: img.mime } });

  return {
    provider,
    async scanId(front, back) {
      try {
        const contents: any[] = [OCR_PROMPT, part(front)];
        if (back) contents.push(part(back));
        const res = await ai.models.generateContent({ model, contents, config: { responseMimeType: 'application/json' } });
        const p = JSON.parse(res.text || '{}');
        return {
          status: 'COMPLETED',
          provider,
          readable: typeof p.readable === 'boolean' ? p.readable : null,
          confidence: clamp(p.confidence),
          detectedIdType: str(p.idType),
          fields: {
            idNumber: str(p.idNumber),
            fullName: str(p.fullName),
            firstName: str(p.firstName),
            middleName: str(p.middleName),
            lastName: str(p.lastName),
            dateOfBirth: date(p.dateOfBirth),
            sex: str(p.sex),
            address: str(p.address),
            issueDate: date(p.issueDate),
            expirationDate: date(p.expirationDate),
          },
          warnings: Array.isArray(p.warnings) ? p.warnings.filter((w: unknown) => typeof w === 'string').slice(0, 10) : [],
          error: null,
          processedAt: nowIso(),
        };
      } catch (err: any) {
        return emptyOcr('FAILED', provider, `Automated ID reading failed: ${err?.message || err}`);
      }
    },
    async compareFaces(idFront, selfie) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [FACE_PROMPT, part(idFront), part(selfie)],
          config: { responseMimeType: 'application/json' },
        });
        const p = JSON.parse(res.text || '{}');
        const confidence = clamp(p.confidence);
        if (confidence === null) {
          return { status: 'FAILED', provider, confidence: null, details: 'The face comparison returned no confidence score.' };
        }
        return { status: classifyFaceMatch(confidence), provider, confidence, details: str(p.details) };
      } catch (err: any) {
        return { status: 'FAILED', provider, confidence: null, details: `Automated face comparison failed: ${err?.message || err}` };
      }
    },
  };
}

export function defaultAutomation(): KycAutomation {
  const key = process.env.GEMINI_API_KEY;
  return key ? geminiAutomation(key) : unavailableAutomation;
}
