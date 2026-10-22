import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import type { AppDb } from './errors';
import { HttpError } from './errors';
import {
  assertKycVerified,
  claimApplication,
  clientKycView,
  decideApplication,
  kycDossier,
  kycQueue,
  runFaceCheck,
  runIdScan,
  saveDraft,
  submitApplication,
  uploadDocument,
  type ClientActor,
  type StaffActor,
} from './service';
import { verifyLocalToken } from './storage';
import { ID_FRONT_B64, SELFIE_B64, completeApplication, fakeAutomation, fakeFaceVerifier, seedBranch, seedMember, textJpeg } from './testFixtures';

let pg: PGlite;
let db: AppDb;
let storageDir: string;

const officer: StaffActor = { kind: 'staff', userId: 'u-staff-a', staffId: 'st-a', name: 'Officer A', role: 'CLIENT_SERVICES_STAFF', branchId: 'br-a', viewAll: false };
const otherOfficer: StaffActor = { ...officer, userId: 'u-staff-a2', staffId: 'st-a2', name: 'Officer A2' };
const outsider: StaffActor = { ...officer, userId: 'u-staff-b', staffId: 'st-b', name: 'Officer B', branchId: 'br-b' };

const client = (borrowerId: string): ClientActor => ({ kind: 'client', userId: `u-${borrowerId}`, name: 'Juan', borrowerId });

async function expectHttp(p: Promise<unknown>, status: number, code?: string) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(status);
    if (code) expect((e as HttpError).code).toBe(code);
    return e as HttpError;
  }
  throw new Error(`expected HTTP ${status}`);
}

/** Uploads ID + selfie, runs both checks and submits. */
async function prepareAndSubmit(borrowerId: string, opts: { idNumber?: string; mobile?: string; face?: ReturnType<typeof fakeFaceVerifier> } = {}) {
  const c = client(borrowerId);
  await saveDraft(db, c, completeApplication(opts.idNumber, opts.mobile));
  await uploadDocument(db, c, { kind: 'ID_FRONT', base64: ID_FRONT_B64() });
  await uploadDocument(db, c, { kind: 'ID_BACK', base64: ID_FRONT_B64() });
  await uploadDocument(db, c, { kind: 'SELFIE', base64: SELFIE_B64() });
  await runIdScan(db, fakeAutomation(), c);
  await runFaceCheck(db, opts.face ?? fakeFaceVerifier(), c);
  return submitApplication(db, c);
}

async function auditActions(borrowerId: string) {
  const rows = await db.select().from(schema.kycAuditLog).where(eq(schema.kycAuditLog.borrowerId, borrowerId));
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((r) => r.action);
}

beforeAll(async () => {
  storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kyc-test-'));
  process.env.KYC_LOCAL_STORAGE_DIR = storageDir;
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await seedBranch(db, 'br-a');
  await seedBranch(db, 'br-b');
  // Only the government ID is configured; ID front and selfie are always required.
  // (0011 seeds further requirements; they are switched off here.)
  await pg.query(`UPDATE kyc_required_documents SET is_active = false`);
  await db.insert(schema.kycRequiredDocuments).values({ id: 'REQ-VALID_ID', documentType: 'VALID_ID', documentName: 'Government ID', isActive: true, sortOrder: 1, createdAt: '2026-01-01' });
}, 120_000);

afterAll(async () => {
  await pg?.close();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

describe('member application', () => {
  let borrowerId: string;
  beforeEach(async () => {
    borrowerId = await seedMember(db);
  });

  it('runs draft -> upload -> scan -> face check -> submit and records every step', async () => {
    const result = await prepareAndSubmit(borrowerId, { idNumber: '0111-2345678-1', mobile: '09170000001' });
    expect(result.status).toBe('SUBMITTED');
    expect(result.referenceNumber).toMatch(/^KYC-\d{4}-[0-9A-F]{8}$/);

    const [member] = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId));
    expect(member.kycStatus).toBe('SUBMITTED');
    expect(member.idType).toBe('UMID');
    expect(member.cityCode).toBe('083747');
    expect(member.phone).toBe('+63 917 000 0001');

    expect(await auditActions(borrowerId)).toEqual(['STARTED', 'CONSENT_GIVEN', 'DOCUMENT_UPLOADED', 'DOCUMENT_UPLOADED', 'DOCUMENT_UPLOADED', 'ID_SCANNED', 'FACE_CHECKED', 'SUBMITTED']);

    const snaps = await db.select().from(schema.kycSubmissionSnapshots).where(eq(schema.kycSubmissionSnapshots.borrowerId, borrowerId));
    expect(snaps).toHaveLength(1);
    expect(snaps[0].sha256).toMatch(/^[0-9a-f]{64}$/);

    const notes = await db.select().from(schema.branchNotifications).where(eq(schema.branchNotifications.relatedId, borrowerId));
    expect(notes.map((n) => `${n.audience}:${n.type}`).sort()).toEqual(['CLIENT:KYC_SUBMITTED', 'STAFF:KYC_SUBMITTED']);
  });

  it('never stores scan or face results sent by the client', async () => {
    const c = client(borrowerId);
    await saveDraft(db, c, completeApplication());
    const [app] = await db.select().from(schema.kycSubmissions).where(eq(schema.kycSubmissions.borrowerId, borrowerId));
    expect(app.governmentId).not.toHaveProperty('ocrData');
    expect(app.governmentId).not.toHaveProperty('faceMatchResult');
    expect(app.faceCheck).toBeNull();
  });

  it('refuses to submit until documents and the face check exist', async () => {
    const c = client(borrowerId);
    await saveDraft(db, c, completeApplication('0111-2345678-2', '09170000002'));
    const err = await expectHttp(submitApplication(db, c), 422, 'INCOMPLETE');
    const fields = ((err.details as any).issues as Array<{ field: string }>).map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(['documents.ID_FRONT', 'documents.SELFIE']));
    expect((err.details as any).requiredStep).toBe('ID_UPLOAD');
  });

  it('needs the back of an ID that has one, and not of a passport', async () => {
    const c = client(borrowerId);
    const app = completeApplication('0111-2345681-1', '09170000031');
    await saveDraft(db, c, app);
    await uploadDocument(db, c, { kind: 'ID_FRONT', base64: ID_FRONT_B64() });
    await uploadDocument(db, c, { kind: 'SELFIE', base64: SELFIE_B64() });
    await runIdScan(db, fakeAutomation(), c);
    await runFaceCheck(db, fakeFaceVerifier(), c);
    expect((await clientKycView(db, borrowerId)).requirements.map((r) => r.kind)).toEqual(['ID_FRONT', 'ID_BACK', 'SELFIE']);
    const err = await expectHttp(submitApplication(db, c), 422, 'INCOMPLETE');
    expect(((err.details as any).issues as Array<{ field: string }>).map((i) => i.field)).toEqual(['documents.ID_BACK']);

    await saveDraft(db, c, { governmentId: { ...app.governmentId, idType: 'PASSPORT', idNumber: 'P1234567A' } });
    expect((await clientKycView(db, borrowerId)).requirements.map((r) => r.kind)).toEqual(['ID_FRONT', 'SELFIE']);
  });

  it('a face mismatch goes to the reviewer (never decided automatically), and a new selfie needs a new check', async () => {
    const c = client(borrowerId);
    await saveDraft(db, c, completeApplication('0111-2345678-3', '09170000003'));
    await uploadDocument(db, c, { kind: 'ID_FRONT', base64: ID_FRONT_B64() });
    await uploadDocument(db, c, { kind: 'ID_BACK', base64: ID_FRONT_B64() });
    await uploadDocument(db, c, { kind: 'SELFIE', base64: SELFIE_B64() });
    await runIdScan(db, fakeAutomation(), c);
    await runFaceCheck(db, fakeFaceVerifier({ status: 'NO_MATCH', confidence: 20, provider: 'aws-rekognition' }), c);

    await uploadDocument(db, c, { kind: 'SELFIE', base64: SELFIE_B64() });
    const err = await expectHttp(submitApplication(db, c), 422);
    expect(JSON.stringify(err.details)).toMatch(/selfie step/);
    await runFaceCheck(db, fakeFaceVerifier({ status: 'UNAVAILABLE', confidence: null, provider: null }), c);
    expect((await submitApplication(db, c)).status).toBe('SUBMITTED');
    expect((await clientKycView(db, borrowerId)).checks.faceCheck?.status).toBe('UNAVAILABLE');
  });

  it('compares faces only with the member’s biometric consent, and records the consent', async () => {
    const c = client(borrowerId);
    const app = completeApplication('0111-2345680-1', '09170000021');
    await saveDraft(db, c, { ...app, declarations: { ...app.declarations, biometricConsent: false } });
    await uploadDocument(db, c, { kind: 'ID_FRONT', base64: ID_FRONT_B64() });
    await uploadDocument(db, c, { kind: 'SELFIE', base64: SELFIE_B64() });
    await expectHttp(runFaceCheck(db, fakeFaceVerifier(), c), 400, 'CONSENT_REQUIRED');
    const err = await expectHttp(submitApplication(db, c), 422, 'INCOMPLETE');
    expect(JSON.stringify(err.details)).toMatch(/biometricConsent/);
    await saveDraft(db, c, { declarations: { ...app.declarations, biometricConsent: true } });
    await runFaceCheck(db, fakeFaceVerifier(), c);
    expect(await auditActions(borrowerId)).toContain('CONSENT_GIVEN');
  });

  it('rejects a blurred ID photo and a disguised file before storing anything', async () => {
    const c = client(borrowerId);
    const blurred = `data:image/jpeg;base64,${textJpeg(1000, 630, { blur: 6 }).toString('base64')}`;
    const err = await expectHttp(uploadDocument(db, c, { kind: 'ID_FRONT', base64: blurred }), 422, 'POOR_QUALITY');
    expect(err.message).toMatch(/blurry/);
    const fakePng = `data:image/png;base64,${Buffer.from('<html>not an image</html>'.repeat(10)).toString('base64')}`;
    await expectHttp(uploadDocument(db, c, { kind: 'ID_FRONT', base64: fakePng }), 415);
    const docs = await db.select().from(schema.kycDocuments).where(eq(schema.kycDocuments.borrowerId, borrowerId));
    expect(docs).toHaveLength(0);
  });

  it('keeps every upload: a replacement supersedes the old file instead of deleting it', async () => {
    const c = client(borrowerId);
    await uploadDocument(db, c, { kind: 'ID_FRONT', base64: ID_FRONT_B64() });
    await uploadDocument(db, c, { kind: 'ID_FRONT', base64: ID_FRONT_B64() });
    const docs = await db.select().from(schema.kycDocuments).where(and(eq(schema.kycDocuments.borrowerId, borrowerId), eq(schema.kycDocuments.documentKind, 'ID_FRONT')));
    expect(docs).toHaveLength(2);
    expect(docs.filter((d) => d.supersededAt === null)).toHaveLength(1);
    expect(fs.readdirSync(path.join(storageDir, 'kyc', borrowerId, 'id-front'))).toHaveLength(2);
  });

  it('serves documents only through signed, expiring links', async () => {
    const c = client(borrowerId);
    const view = await uploadDocument(db, c, { kind: 'ID_FRONT', base64: ID_FRONT_B64() });
    expect(view.url).toMatch(/^\/api\/kyc\/files\//);
    const token = view.url!.split('/').pop()!;
    expect(verifyLocalToken(token)).toMatch(new RegExp(`^kyc/${borrowerId}/id-front/`));
    expect(verifyLocalToken(token.slice(0, -2) + 'xx')).toBeNull();
    expect(verifyLocalToken(token, Date.now() + 10 * 60 * 1000)).toBeNull();
  });
});

describe('staff review', () => {
  it('approves with a reason: member verified, savings opened, member notified, all audited', async () => {
    const borrowerId = await seedMember(db);
    await prepareAndSubmit(borrowerId, { idNumber: '0111-2345678-4', mobile: '09170000004' });
    await expectHttp(assertKycVerified(db, borrowerId), 403, 'KYC_REQUIRED');

    const r = await decideApplication(db, officer, borrowerId, { decision: 'approve', reason: 'ID and selfie verified in person.', faceReviewed: true });
    expect(r.status).toBe('APPROVED');

    const [member] = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId));
    expect(member.kycStatus).toBe('APPROVED');
    const savings = await db.select().from(schema.savingsAccounts).where(eq(schema.savingsAccounts.memberId, borrowerId));
    expect(savings).toHaveLength(1);
    await assertKycVerified(db, borrowerId);

    const view = await clientKycView(db, borrowerId);
    expect(view.statusLabel).toBe('Approved');
    expect(view.decisionReason).toBe('ID and selfie verified in person.');

    expect((await auditActions(borrowerId)).slice(-2)).toEqual(['CLAIMED', 'APPROVED']);
    const general = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.targetId, borrowerId), eq(schema.auditLogs.action, 'KYC_APPROVED')));
    expect(general[0].performedBy).toBe(officer.userId);
    const memberNotes = await db.select().from(schema.branchNotifications).where(and(eq(schema.branchNotifications.borrowerId, borrowerId), eq(schema.branchNotifications.type, 'KYC_APPROVED')));
    expect(memberNotes[0].audience).toBe('CLIENT');
  });

  it('rejection with a reason lets the member restart and resubmit as version 2', async () => {
    const borrowerId = await seedMember(db);
    const c = client(borrowerId);
    await prepareAndSubmit(borrowerId, { idNumber: '0111-2345678-5', mobile: '09170000005' });
    await expectHttp(decideApplication(db, officer, borrowerId, { decision: 'reject', reason: '' }), 400, 'REASON_REQUIRED');
    await decideApplication(db, officer, borrowerId, { decision: 'reject', reason: 'The ID photo is of a different person.' });
    expect((await clientKycView(db, borrowerId)).rejectionReason).toBe('The ID photo is of a different person.');

    await saveDraft(db, c, { currentStep: 1 });
    expect((await clientKycView(db, borrowerId)).kycStatus).toBe('IN_PROGRESS');
    await uploadDocument(db, c, { kind: 'SELFIE', base64: SELFIE_B64() });
    await runFaceCheck(db, fakeFaceVerifier(), c);
    const again = await submitApplication(db, c);
    expect(again.version).toBe(2);
    expect((await auditActions(borrowerId)).slice(-5)).toEqual(['REJECTED', 'RESTARTED', 'DOCUMENT_UPLOADED', 'FACE_CHECKED', 'RESUBMITTED']);
  });

  it('a resubmission request returns the application for changes', async () => {
    const borrowerId = await seedMember(db);
    const c = client(borrowerId);
    await prepareAndSubmit(borrowerId, { idNumber: '0111-2345678-6', mobile: '09170000006' });
    await decideApplication(db, officer, borrowerId, { decision: 'resubmission_required', reason: 'Upload a clearer proof of address.', sections: ['DOCUMENTS'] });
    const view = await clientKycView(db, borrowerId);
    expect(view.kycStatus).toBe('CORRECTION_REQUIRED');
    expect(view.statusLabel).toBe('Additional information required');
    expect(view.correctionSections).toEqual(['DOCUMENTS']);
    expect((await submitApplication(db, c)).status).toBe('SUBMITTED');
  });

  it('enforces branch scope, single reviewer, legal states and idempotent decisions', async () => {
    const borrowerId = await seedMember(db);
    await expectHttp(decideApplication(db, officer, borrowerId, { decision: 'approve', reason: 'ok ok' }), 409, 'BAD_STATE');
    await prepareAndSubmit(borrowerId, { idNumber: '0111-2345678-7', mobile: '09170000007' });

    await expectHttp(claimApplication(db, outsider, borrowerId), 404);
    await claimApplication(db, officer, borrowerId);
    await expectHttp(decideApplication(db, otherOfficer, borrowerId, { decision: 'approve', reason: 'looks fine' }), 409, 'CLAIMED');

    const first = await decideApplication(db, officer, borrowerId, { decision: 'approve', reason: 'Verified.', idempotencyKey: 'k-1', faceReviewed: true });
    const replay = await decideApplication(db, officer, borrowerId, { decision: 'approve', reason: 'Verified.', idempotencyKey: 'k-1', faceReviewed: true });
    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ status: 'APPROVED', replayed: true });
    await expectHttp(decideApplication(db, officer, borrowerId, { decision: 'reject', reason: 'changed my mind' }), 409, 'BAD_STATE');
    expect((await auditActions(borrowerId)).filter((a) => a === 'APPROVED')).toHaveLength(1);
  });

  it('refuses a reviewer acting on their own application', async () => {
    const borrowerId = await seedMember(db);
    await prepareAndSubmit(borrowerId, { idNumber: '0111-2345678-8', mobile: '09170000008' });
    const self: StaffActor = { ...officer, userId: `u-${borrowerId}` };
    await expectHttp(decideApplication(db, self, borrowerId, { decision: 'approve', reason: 'Approving my own application.' }), 403, 'SELF_REVIEW');
  });

  it('rejects a government ID number already registered to another member', async () => {
    const first = await seedMember(db);
    await prepareAndSubmit(first, { idNumber: '0111-2345678-9', mobile: '09170000009' });
    const second = await seedMember(db);
    const err = await expectHttp(prepareAndSubmit(second, { idNumber: '0111 2345678 9', mobile: '09170000010' }), 409, 'DUPLICATE');
    expect(err.message).toMatch(/already registered/);
  });

  it('lists the queue for the officer branch only, waiting applications first', async () => {
    const borrowerId = await seedMember(db);
    await prepareAndSubmit(borrowerId, { idNumber: '0111-2345679-0', mobile: '09170000011' });
    const { items, counts } = await kycQueue(db, { branchId: 'br-a', viewAll: false }, { status: 'pending' });
    expect(items.every((i) => i.kycStatus === 'SUBMITTED' && i.branchId === 'br-a')).toBe(true);
    expect(counts.pending).toBeGreaterThanOrEqual(1);
    const outside = await kycQueue(db, { branchId: 'br-b', viewAll: false }, {});
    expect(outside.items).toHaveLength(0);

    const dossier = await kycDossier(db, { branchId: 'br-a', viewAll: false }, borrowerId);
    expect(dossier.documents.every((d) => d.url?.startsWith('/api/kyc/files/'))).toBe(true);
    expect(dossier.snapshots).toHaveLength(1);
    await expectHttp(kycDossier(db, { branchId: 'br-b', viewAll: false }, borrowerId), 404);
  });
});

describe('KYC safeguards', () => {
  it('approves only after a face-verification match or the reviewer’s own comparison', async () => {
    const estimate = await seedMember(db);
    await prepareAndSubmit(estimate, { idNumber: '0111-2345680-2', mobile: '09170000022', face: fakeFaceVerifier({ status: 'MATCH', provider: 'gemini:gemini-2.5-flash' }) });
    const err = await expectHttp(decideApplication(db, officer, estimate, { decision: 'approve', reason: 'Looks right.' }), 409, 'FACE_REVIEW_REQUIRED');
    expect((err.details as any).provider).toBe('gemini:gemini-2.5-flash');
    // A refused decision changes nothing, not even the automatic claim.
    expect((await clientKycView(db, estimate)).kycStatus).toBe('SUBMITTED');
    await decideApplication(db, officer, estimate, { decision: 'approve', reason: 'Compared the selfie with the ID myself.', faceReviewed: true });
    const [entry] = (await db.select().from(schema.kycAuditLog).where(and(eq(schema.kycAuditLog.borrowerId, estimate), eq(schema.kycAuditLog.action, 'APPROVED'))));
    expect(entry.metadata).toMatchObject({ faceVerifiedByService: false, faceComparedByReviewer: true });

    const mismatch = await seedMember(db);
    await prepareAndSubmit(mismatch, { idNumber: '0111-2345680-3', mobile: '09170000023', face: fakeFaceVerifier({ status: 'NO_MATCH', confidence: 31, provider: 'aws-rekognition' }) });
    await expectHttp(decideApplication(db, officer, mismatch, { decision: 'approve', reason: 'Fine.' }), 409, 'FACE_REVIEW_REQUIRED');

    const verified = await seedMember(db);
    await prepareAndSubmit(verified, { idNumber: '0111-2345680-4', mobile: '09170000024', face: fakeFaceVerifier({ status: 'MATCH', confidence: 99, provider: 'aws-rekognition' }) });
    expect((await decideApplication(db, officer, verified, { decision: 'approve', reason: 'Face verified; ID checked.' })).status).toBe('APPROVED');
  });

  it('when additional information is required, lets the member change only the requested parts', async () => {
    const borrowerId = await seedMember(db);
    const c = client(borrowerId);
    const app = completeApplication('0111-2345680-5', '09170000025');
    await prepareAndSubmit(borrowerId, { idNumber: '0111-2345680-5', mobile: '09170000025' });
    await expectHttp(decideApplication(db, officer, borrowerId, { decision: 'resubmission_required', reason: 'Upload a recent bill.', sections: [] }), 400, 'SECTIONS_REQUIRED');
    await decideApplication(db, officer, borrowerId, { decision: 'resubmission_required', reason: 'Upload a recent bill as proof of address.', sections: ['DOCUMENTS', 'NOT_A_SECTION'] });
    expect((await clientKycView(db, borrowerId)).correctionSections).toEqual(['DOCUMENTS']);

    const moved = await expectHttp(saveDraft(db, c, { personalInfo: { ...app.personalInfo, lastName: 'Reyes' } }), 409, 'NOT_REQUESTED');
    expect(moved.message).toMatch(/supporting documents/);
    await expectHttp(uploadDocument(db, c, { kind: 'ID_FRONT', base64: ID_FRONT_B64() }), 409, 'NOT_REQUESTED');
    await expectHttp(uploadDocument(db, c, { kind: 'SELFIE', base64: SELFIE_B64() }), 409, 'NOT_REQUESTED');
    await expectHttp(runIdScan(db, fakeAutomation(), c), 409, 'NOT_REQUESTED');

    // Re-sending unchanged parts (the whole form) is fine; the requested part can change.
    await saveDraft(db, c, { ...app, currentStep: 5 });
    await uploadDocument(db, c, { kind: 'PROOF_OF_ADDRESS', base64: ID_FRONT_B64() });
    expect((await submitApplication(db, c)).status).toBe('SUBMITTED');
  });

  it('a rejection can close the application: the member must contact the branch', async () => {
    const borrowerId = await seedMember(db);
    const c = client(borrowerId);
    await prepareAndSubmit(borrowerId, { idNumber: '0111-2345680-6', mobile: '09170000026' });
    await decideApplication(db, officer, borrowerId, { decision: 'reject', reason: 'The ID belongs to another person.', allowResubmission: false });
    const view = await clientKycView(db, borrowerId);
    expect(view.kycStatus).toBe('REJECTED');
    expect(view.resubmissionAllowed).toBe(false);
    await expectHttp(saveDraft(db, c, { currentStep: 1 }), 409, 'RESUBMISSION_NOT_ALLOWED');
    await expectHttp(uploadDocument(db, c, { kind: 'SELFIE', base64: SELFIE_B64() }), 409);
    const notes = await db.select().from(schema.branchNotifications).where(and(eq(schema.branchNotifications.borrowerId, borrowerId), eq(schema.branchNotifications.type, 'KYC_REJECTED')));
    expect(notes[0].message).toMatch(/contact your branch/);
  });

  it('limits the paid ID reading per member per hour', async () => {
    const borrowerId = await seedMember(db);
    const c = client(borrowerId);
    await saveDraft(db, c, completeApplication('0111-2345680-7', '09170000027'));
    await uploadDocument(db, c, { kind: 'ID_FRONT', base64: ID_FRONT_B64() });
    for (let i = 0; i < 10; i++) await runIdScan(db, fakeAutomation(), c);
    await expectHttp(runIdScan(db, fakeAutomation(), c), 429, 'RATE_LIMITED');
  });

  it('filters the queue by submission date', async () => {
    const borrowerId = await seedMember(db);
    await prepareAndSubmit(borrowerId, { idNumber: '0111-2345680-8', mobile: '09170000028' });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    const hit = await kycQueue(db, { branchId: 'br-a', viewAll: false }, { submittedFrom: today, submittedTo: today });
    expect(hit.items.some((i) => i.borrowerId === borrowerId)).toBe(true);
    const miss = await kycQueue(db, { branchId: 'br-a', viewAll: false }, { submittedTo: '2020-01-01' });
    expect(miss.items.some((i) => i.borrowerId === borrowerId)).toBe(false);
  });
});

describe('database guards from 0023', () => {
  it('refuses a status change made outside the KYC service', async () => {
    const borrowerId = await seedMember(db);
    await saveDraft(db, client(borrowerId), completeApplication('0111-2345679-1', '09170000012'));
    await expect(pg.query(`UPDATE kyc_submissions SET status = 'APPROVED' WHERE borrower_id = $1`, [borrowerId])).rejects.toThrow(/KYC service/);
  });

  it('keeps the KYC audit log append-only', async () => {
    await expect(pg.query(`UPDATE kyc_audit_log SET reason = 'edited'`)).rejects.toThrow(/append-only/);
    await expect(pg.query(`DELETE FROM kyc_audit_log`)).rejects.toThrow(/append-only/);
  });
});
