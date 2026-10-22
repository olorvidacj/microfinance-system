import jpeg from 'jpeg-js';
import * as schema from '../db/schema';
import type { AppDb } from './errors';
import type { KycAutomation } from './automation';
import type { FaceVerifier } from './faceVerification';
import type { FaceMatchStatus, OcrResult } from '../../shared/kyc-core';

/** A JPEG with sharp, evenly lit "printed text"; `blur` smears it until it fails the focus check. */
export function textJpeg(width: number, height: number, opts: { blur?: number } = {}): Buffer {
  const gray = new Float32Array(width * height).fill(200);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.floor(y / 14) % 2 === 0 && y % 14 < 6 && Math.floor(x / 7) % 3 !== 2 && x % 7 < 4) gray[y * width + x] = 30;
    }
  }
  let g = gray;
  for (let pass = 0; pass < (opts.blur ?? 0); pass++) {
    const next = new Float32Array(g.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0;
        let n = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < height && xx >= 0 && xx < width) {
              s += g[yy * width + xx];
              n++;
            }
          }
        }
        next[y * width + x] = s / n;
      }
    }
    g = next;
  }
  const data = Buffer.alloc(width * height * 4);
  for (let k = 0; k < g.length; k++) {
    data[k * 4] = data[k * 4 + 1] = data[k * 4 + 2] = g[k];
    data[k * 4 + 3] = 255;
  }
  return jpeg.encode({ data, width, height }, 92).data;
}

export const ID_FRONT_B64 = () => `data:image/jpeg;base64,${textJpeg(1000, 630).toString('base64')}`;
export const SELFIE_B64 = () => `data:image/jpeg;base64,${textJpeg(640, 640).toString('base64')}`;

export function fakeAutomation(opts: { ocrFields?: OcrResult['fields'] } = {}): KycAutomation {
  return {
    provider: 'fake',
    async scanId() {
      return {
        status: 'COMPLETED',
        provider: 'fake',
        readable: true,
        confidence: 90,
        detectedIdType: 'UMID',
        fields: opts.ocrFields ?? { fullName: 'JUAN SANTOS DELA CRUZ', dateOfBirth: '1990-05-15', idNumber: '0111-2345678-9' },
        warnings: [],
        error: null,
        processedAt: new Date().toISOString(),
      };
    },
  };
}

/** A face verifier answering as told; provider "fake" is not a trusted face-verification service. */
export function fakeFaceVerifier(opts: { status?: FaceMatchStatus; confidence?: number | null; provider?: string | null } = {}): FaceVerifier {
  const provider = opts.provider === undefined ? 'fake' : opts.provider;
  return {
    provider,
    async compare() {
      return { status: opts.status ?? 'MATCH', provider, confidence: opts.confidence === undefined ? 97 : opts.confidence, details: 'fake' };
    },
  };
}

export async function seedBranch(db: AppDb, id = 'br-a') {
  await db.insert(schema.branches).values({
    id,
    code: id.toUpperCase(),
    name: `Branch ${id}`,
    city: 'Tacloban',
    address: 'Main St',
    phone: '053-000',
    managerName: 'Manager',
    managerEmail: `${id}@coop.test`,
  });
}

let seq = 0;
export async function seedMember(db: AppDb, overrides: Partial<typeof schema.borrowers.$inferInsert> = {}) {
  seq += 1;
  const id = overrides.id ?? `bor-${seq}`;
  await db.insert(schema.borrowers).values({
    id,
    borrowerNumber: `CLI-2026-${String(seq).padStart(4, '0')}`,
    fullName: 'Juan Santos Dela Cruz',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    idNumber: '',
    phone: `+63 917 000 ${String(1000 + seq)}`,
    email: `member${seq}@example.com`,
    dateOfBirth: '1990-05-15',
    gender: 'Male',
    civilStatus: 'Married',
    address: '',
    branchId: 'br-a',
    employmentStatus: 'Self-Employed',
    employerOrBusiness: '',
    occupation: '',
    monthlyIncome: 0,
    monthlyExpenses: 0,
    creditScore: 0,
    creditTier: 'PENDING',
    kycStatus: 'NOT_STARTED',
    memberStatus: 'Active',
    membershipDate: '2026-10-01',
    avatar: '',
    joinedDate: '2026-10-01',
    lastActivityDate: '2026-10-01',
    ...overrides,
  });
  await db.insert(schema.users).values({
    id: `u-${id}`,
    email: `login-${id}@example.com`,
    passwordHash: 'x',
    fullName: 'Juan Santos Dela Cruz',
    role: 'CLIENT',
    borrowerId: id,
  });
  return id;
}

export function completeApplication(idNumber = '0111-2345678-9', mobileNumber = '09171234567') {
  return {
    personalInfo: { firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz', dateOfBirth: '1990-05-15', placeOfBirth: 'Tacloban', gender: 'Male', civilStatus: 'Married', nationality: 'Filipino' },
    address: {
      current: { region: 'Eastern Visayas', regionCode: '08', province: 'Leyte', provinceCode: '0837', city: 'Tacloban City', cityCode: '083747', barangay: 'Barangay 100 (San Roque)', barangayCode: '083747018', street: 'Rizal St', houseNumber: '12', postalCode: '6500' },
      isPermanentSameAsCurrent: true,
    },
    contactInfo: { mobileNumber },
    employment: { employmentStatus: 'Self-Employed', businessName: 'JDC Store', natureOfBusiness: 'Retail', monthlyIncome: 25000, monthlyExpenses: 12000, sourceOfIncome: 'Business' },
    governmentId: { idType: 'UMID', idNumber, nameOnId: 'JUAN SANTOS DELA CRUZ', ocrData: { forged: true }, faceMatchResult: { isMatch: true } },
    declarations: { truthfulInformation: true, documentOwnership: true, privacyNotice: true, biometricConsent: true },
  };
}
