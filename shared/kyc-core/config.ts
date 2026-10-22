/** Reference data and thresholds for onboarding and KYC, shared by the web portal, branch app and API. */

export interface IdTypeDefinition {
  code: string;
  label: string;
  /** Tested against the normalised number (uppercase, no spaces or hyphens). */
  pattern: RegExp;
  example: string;
  hasBackSide: boolean;
}

export const ID_TYPES: readonly IdTypeDefinition[] = [
  { code: 'PHILSYS_ID', label: 'PhilSys National ID (PhilID)', pattern: /^(\d{12}|\d{16})$/, example: '1234-5678-9012-3456', hasBackSide: true },
  { code: 'DRIVERS_LICENSE', label: "Driver's License (LTO)", pattern: /^[A-Z]\d{10}$/, example: 'N01-23-456789', hasBackSide: true },
  { code: 'PASSPORT', label: 'Philippine Passport', pattern: /^(P\d{7}[A-Z]|[A-Z]{2}\d{7})$/, example: 'P1234567A', hasBackSide: false },
  { code: 'UMID', label: 'UMID', pattern: /^\d{12}$/, example: '0111-2345678-9', hasBackSide: true },
  { code: 'SSS_ID', label: 'SSS ID', pattern: /^\d{10}$/, example: '04-1234567-8', hasBackSide: true },
  { code: 'PRC_ID', label: 'PRC Professional ID', pattern: /^\d{7}$/, example: '0123456', hasBackSide: true },
  { code: 'POSTAL_ID', label: 'Postal ID', pattern: /^[A-Z0-9]{8,14}$/, example: 'ABC123456789', hasBackSide: true },
  { code: 'VOTERS_ID', label: "Voter's ID", pattern: /^[A-Z0-9]{15,25}$/, example: '1234-5678A-B123CDE12345', hasBackSide: true },
  { code: 'TIN_ID', label: 'TIN ID', pattern: /^(\d{9}|\d{12})$/, example: '123-456-789-000', hasBackSide: true },
];

export function findIdType(code: string | null | undefined): IdTypeDefinition | undefined {
  const c = String(code ?? '').trim().toUpperCase();
  return ID_TYPES.find((t) => t.code === c);
}

export const DOCUMENT_KINDS = [
  'ID_FRONT',
  'ID_BACK',
  'SELFIE',
  'PROOF_OF_ADDRESS',
  'PROOF_OF_INCOME',
  'PHOTO_2X2',
  'OTHER',
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Readonly<Record<DocumentKind, string>> = {
  ID_FRONT: 'Government ID (front)',
  ID_BACK: 'Government ID (back)',
  SELFIE: 'Selfie',
  PROOF_OF_ADDRESS: 'Proof of address',
  PROOF_OF_INCOME: 'Proof of income',
  PHOTO_2X2: '2x2 ID photo',
  OTHER: 'Other document',
};

/** Maps the codes stored in kyc_required_documents (and legacy upload types) to a document kind. */
const REQUIREMENT_CODE_TO_KIND: Readonly<Record<string, DocumentKind>> = {
  VALID_ID: 'ID_FRONT',
  GOVERNMENT_ID: 'ID_FRONT',
  ID_FRONT: 'ID_FRONT',
  ID_BACK: 'ID_BACK',
  SELFIE: 'SELFIE',
  SELFIE_WITH_ID: 'SELFIE',
  PROOF_OF_ADDRESS: 'PROOF_OF_ADDRESS',
  PROOF_OF_INCOME: 'PROOF_OF_INCOME',
  PHOTO_2X2: 'PHOTO_2X2',
};

export function documentKindFor(code: string | null | undefined): DocumentKind {
  return REQUIREMENT_CODE_TO_KIND[String(code ?? '').trim().toUpperCase()] ?? 'OTHER';
}

/** Required for every submission regardless of configuration: the face check needs both. */
export const ALWAYS_REQUIRED_KINDS: readonly DocumentKind[] = ['ID_FRONT', 'SELFIE'];

/**
 * The documents a submission needs: the ID front and the selfie, the back of
 * an ID that has information on its back, and the documents the branch
 * configured. In the usual order (ID, selfie, then supporting documents).
 */
export function requiredDocumentKinds(configured: readonly DocumentKind[], idType: string | null | undefined): DocumentKind[] {
  const wanted = new Set<DocumentKind>([...ALWAYS_REQUIRED_KINDS, ...configured.filter((k) => k !== 'OTHER')]);
  if (findIdType(idType)?.hasBackSide) wanted.add('ID_BACK');
  return DOCUMENT_KINDS.filter((k) => wanted.has(k));
}

/** Matches the kyc-documents bucket limits (10485760 bytes; jpeg/png/webp/pdf). */
export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as readonly string[],
  imageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as readonly string[],
};

/** Kinds that must be a photo (no PDF), because they are machine-checked. */
export const IMAGE_ONLY_KINDS: readonly DocumentKind[] = ['ID_FRONT', 'ID_BACK', 'SELFIE', 'PHOTO_2X2'];

export interface QualityThresholds {
  minLongSide: number;
  minShortSide: number;
  /** Mean luminance 0-255. */
  minBrightness: number;
  maxBrightness: number;
  /** Share of pixels at or above 250 luminance. */
  maxGlareRatio: number;
  /** Variance of the Laplacian on the downscaled grayscale image. */
  minSharpness: number;
}

const DEFAULT_QUALITY: QualityThresholds = {
  minLongSide: 400,
  minShortSide: 300,
  minBrightness: 45,
  maxBrightness: 230,
  maxGlareRatio: 0.25,
  minSharpness: 40,
};

/**
 * Sharpness limits were calibrated on synthetic printed-text images (sharp text
 * scores in the thousands; a 5x5 box blur applied 6 times at 1000 px scores ~30).
 * Faces have fewer edges than print, so selfies get a lower floor.
 */
export const QUALITY_THRESHOLDS: Readonly<Record<DocumentKind, QualityThresholds>> = {
  ID_FRONT: { ...DEFAULT_QUALITY, minLongSide: 600, minShortSide: 380 },
  ID_BACK: { ...DEFAULT_QUALITY, minLongSide: 600, minShortSide: 380 },
  SELFIE: { ...DEFAULT_QUALITY, minLongSide: 320, minShortSide: 320, maxGlareRatio: 0.35, minSharpness: 20 },
  PHOTO_2X2: { ...DEFAULT_QUALITY, minLongSide: 300, minShortSide: 300, maxGlareRatio: 0.6 },
  PROOF_OF_ADDRESS: DEFAULT_QUALITY,
  PROOF_OF_INCOME: DEFAULT_QUALITY,
  OTHER: DEFAULT_QUALITY,
};

export const AGE_LIMITS = { min: 18, max: 100 } as const;

export const GENDERS = ['Male', 'Female'] as const;
export const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled'] as const;
export const EMPLOYMENT_STATUSES = [
  'Employed',
  'Self-Employed',
  'Business Owner',
  'Government Employee',
  'Private Employee',
  'OFW',
  'Unemployed',
  'Retired',
  'Student',
  'Other',
] as const;
export const SOURCES_OF_INCOME = [
  'Salary',
  'Business',
  'Remittance',
  'Pension',
  'Farming / Fishing',
  'Allowance',
  'Other',
] as const;

/** Upper bound accepted for declared monthly amounts, to catch typos (PHP). */
export const MAX_DECLARED_MONTHLY_AMOUNT = 10_000_000;

export const EMAIL_CODE = { length: 6, ttlMinutes: 10, maxAttempts: 5, tokenTtlMinutes: 30 } as const;
