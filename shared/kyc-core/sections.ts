import type { DocumentKind } from './config';
import type { KycApplicationPayload } from './validation';

/**
 * The parts of a KYC application a reviewer can send back for changes. When
 * staff ask for additional information, the member may change only the parts
 * named; the server refuses changes elsewhere. The consent declarations are
 * always confirmed again on resubmission.
 */
export const KYC_SECTIONS = ['PERSONAL_INFO', 'ADDRESS', 'FINANCIAL', 'ID_UPLOAD', 'FACE_MATCH', 'DOCUMENTS'] as const;
export type KycSection = (typeof KYC_SECTIONS)[number];

export const KYC_SECTION_LABELS: Readonly<Record<KycSection, string>> = {
  PERSONAL_INFO: 'Personal information',
  ADDRESS: 'Address',
  FINANCIAL: 'Work and income',
  ID_UPLOAD: 'Government ID photo',
  FACE_MATCH: 'Selfie',
  DOCUMENTS: 'Supporting documents',
};

/** The application fields each section covers. */
export const SECTION_FIELDS: Readonly<Record<KycSection, readonly (keyof KycApplicationPayload)[]>> = {
  PERSONAL_INFO: ['personalInfo', 'contactInfo'],
  ADDRESS: ['address'],
  FINANCIAL: ['employment'],
  ID_UPLOAD: ['governmentId'],
  FACE_MATCH: [],
  DOCUMENTS: [],
};

export function sectionOfField(field: keyof KycApplicationPayload): KycSection | null {
  return KYC_SECTIONS.find((s) => SECTION_FIELDS[s].includes(field)) ?? null;
}

export function sectionOfDocument(kind: DocumentKind): KycSection {
  if (kind === 'ID_FRONT' || kind === 'ID_BACK') return 'ID_UPLOAD';
  if (kind === 'SELFIE') return 'FACE_MATCH';
  return 'DOCUMENTS';
}

/** The known sections in a list from a request, in their usual order, without repeats. */
export function parseSections(raw: unknown): KycSection[] {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set(raw.map((s) => String(s).trim().toUpperCase()));
  return KYC_SECTIONS.filter((s) => wanted.has(s));
}

/**
 * Whether a section may be changed. With no sections named (a request made
 * before sections existed, or any status other than additional information
 * required), everything editable stays editable.
 */
export function sectionOpen(section: KycSection, requested: readonly string[] | null | undefined): boolean {
  if (!requested || requested.length === 0) return true;
  if (requested.includes(section)) return true;
  // A new ID photo invalidates the face check against it.
  return section === 'FACE_MATCH' && requested.includes('ID_UPLOAD');
}

/**
 * The parts of an application the member may send now: everything, or while
 * additional information is required only the requested parts and the
 * declarations. Parts left out are kept as stored.
 */
export function scopeApplication(payload: KycApplicationPayload, requested: readonly string[] | null | undefined): KycApplicationPayload {
  if (!requested || requested.length === 0) return payload;
  const out: KycApplicationPayload = { declarations: payload.declarations };
  for (const section of KYC_SECTIONS) {
    if (!sectionOpen(section, requested)) continue;
    for (const field of SECTION_FIELDS[section]) Object.assign(out, { [field]: payload[field] });
  }
  return out;
}
