import { GoogleGenAI } from '@google/genai';
import type { OcrResult } from '../../shared/kyc-core';

export interface ImageInput {
  buffer: Buffer;
  mime: string;
}

/**
 * Reading the ID: what is printed, for the member to check and the reviewer
 * to compare. A reading is not identity verification; a person decides.
 * Comparing faces is a separate service (faceVerification.ts): a text model
 * does not verify faces.
 */
export interface KycAutomation {
  readonly provider: string | null;
  scanId(front: ImageInput, back: ImageInput | null): Promise<OcrResult>;
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
  };
}

export function defaultAutomation(): KycAutomation {
  const key = process.env.GEMINI_API_KEY;
  return key ? geminiAutomation(key) : unavailableAutomation;
}
