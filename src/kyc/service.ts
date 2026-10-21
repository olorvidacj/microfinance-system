import crypto from 'crypto';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  ALWAYS_REQUIRED_KINDS,
  DOCUMENT_KIND_LABELS,
  IMAGE_ONLY_KINDS,
  KYC_DECISIONS,
  UPLOAD_LIMITS,
  assertTransition,
  assessImageQuality,
  composeFullName,
  documentKindFor,
  faceCheckBlocksSubmission,
  findDiscrepancies,
  firstIssueStep,
  isEditableByClient,
  isKycVerified,
  kycGateMessage,
  kycStatusLabel,
  normaliseKycStatus,
  normalizeIdNumber,
  normalizePhilippineMobile,
  parseKycDecision,
  validateKycApplication,
  type DocumentKind,
  type FaceCheck,
  type KycApplicationPayload,
  type KycIssue,
  type KycStatus,
  type OcrResult,
  type QualityReport,
} from '../../shared/kyc-core';
import { HttpError, translateDbError, type AppDb } from './errors';
import { decodeImage, sniffMime } from './imageDecode';
import { putKycObject, readKycObject, signedKycUrl, type StoredObjectRef } from './storage';
import type { KycAutomation } from './automation';
import { openRegularAccountTx } from '../savings/service';

// ---------------------------------------------------------------------------
// Actors and scope
// ---------------------------------------------------------------------------

export interface ClientActor {
  kind: 'client';
  userId: string;
  name: string;
  borrowerId: string;
}

export interface StaffActor {
  kind: 'staff';
  userId: string;
  staffId: string | null;
  name: string;
  role: string;
  /** null with viewAll = head office. */
  branchId: string | null;
  viewAll: boolean;
}

export type Actor = ClientActor | StaffActor;

type Submission = typeof schema.kycSubmissions.$inferSelect;
type KycDocumentRow = typeof schema.kycDocuments.$inferSelect;
type Borrower = typeof schema.borrowers.$inferSelect;

/** Calendar date in the cooperative's time zone, for age and expiry checks. */
export function manilaToday(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

/**
 * Runs `fn` in one transaction with hoscomo.kyc_actor set, which the 0023
 * guard requires for any status change. Database refusals become HTTP errors.
 */
async function inKycTransaction<T>(db: AppDb, actor: 'client' | 'staff' | 'staff_sensitive', fn: (tx: AppDb) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('hoscomo.kyc_actor', ${actor}, true)`);
      return fn(tx as unknown as AppDb);
    });
  } catch (err) {
    translateDbError(err);
  }
}

async function loadBorrower(tx: AppDb, borrowerId: string): Promise<Borrower> {
  const rows = await tx.select().from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
  if (!rows[0]) throw new HttpError(404, 'Member not found.', 'NOT_FOUND');
  return rows[0];
}

function assertInScope(actor: StaffActor, borrower: Borrower): void {
  if (actor.viewAll) return;
  if (!actor.branchId || borrower.branchId !== actor.branchId) {
    throw new HttpError(404, 'Member not found in your branch.', 'NOT_FOUND');
  }
}

async function lockApplication(tx: AppDb, borrowerId: string, now: string): Promise<Submission> {
  const existing = await tx
    .select()
    .from(schema.kycSubmissions)
    .where(eq(schema.kycSubmissions.borrowerId, borrowerId))
    .for('update')
    .limit(1);
  if (existing[0]) return existing[0];
  await tx
    .insert(schema.kycSubmissions)
    .values({ id: newId('kyc'), borrowerId, status: 'NOT_STARTED', currentStep: 0, createdAt: now, updatedAt: now })
    .onConflictDoNothing();
  const created = await tx
    .select()
    .from(schema.kycSubmissions)
    .where(eq(schema.kycSubmissions.borrowerId, borrowerId))
    .for('update')
    .limit(1);
  return created[0];
}

// ---------------------------------------------------------------------------
// Audit and notifications
// ---------------------------------------------------------------------------

interface AuditInput {
  borrower: Borrower;
  submissionId: string | null;
  actor: Actor;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  now: string;
}

async function audit(tx: AppDb, a: AuditInput): Promise<void> {
  const staff = a.actor.kind === 'staff' ? a.actor : null;
  await tx.insert(schema.kycAuditLog).values({
    id: newId('kal'),
    borrowerId: a.borrower.id,
    kycSubmissionId: a.submissionId,
    staffUserId: staff?.userId ?? null,
    staffName: staff?.name ?? null,
    action: a.action,
    previousStatus: a.previousStatus ?? null,
    newStatus: a.newStatus ?? null,
    reason: a.reason ?? null,
    actorType: a.actor.kind === 'staff' ? 'STAFF' : 'CLIENT',
    actorUserId: a.actor.userId,
    metadata: a.metadata ?? null,
    createdAt: a.now,
  });
  await tx.insert(schema.auditLogs).values({
    id: newId('aud'),
    timestamp: a.now,
    action: `KYC_${a.action}`,
    details: [
      `${a.borrower.fullName} (${a.borrower.borrowerNumber})`,
      a.previousStatus && a.newStatus && a.previousStatus !== a.newStatus ? `${a.previousStatus} -> ${a.newStatus}` : null,
      a.reason ? `Reason: ${a.reason}` : null,
    ]
      .filter(Boolean)
      .join('. '),
    performedBy: a.actor.userId,
    branchId: a.borrower.branchId,
    type: 'KYC',
    userName: a.actor.name,
    userRole: a.actor.kind === 'staff' ? a.actor.role : 'CLIENT',
    targetType: 'Borrower',
    targetId: a.borrower.id,
  });
}

async function notifyMember(tx: AppDb, borrower: Borrower, type: string, title: string, message: string, now: string) {
  await tx.insert(schema.branchNotifications).values({
    id: newId('ntf'),
    branchId: borrower.branchId,
    audience: 'CLIENT',
    borrowerId: borrower.id,
    type,
    title,
    message,
    relatedType: 'KYC',
    relatedId: borrower.id,
    isRead: false,
    createdAt: now,
  });
}

async function notifyBranch(tx: AppDb, borrower: Borrower, type: string, title: string, message: string, now: string) {
  await tx.insert(schema.branchNotifications).values({
    id: newId('ntf'),
    branchId: borrower.branchId,
    audience: 'STAFF',
    type,
    title,
    message,
    relatedType: 'Borrower',
    relatedId: borrower.id,
    isRead: false,
    createdAt: now,
  });
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

async function moveTo(
  tx: AppDb,
  app: Submission,
  to: KycStatus,
  actorKind: 'client' | 'staff' | 'staff_sensitive',
  set: Partial<typeof schema.kycSubmissions.$inferInsert>,
  now: string,
): Promise<Submission> {
  assertTransition(normaliseKycStatus(app.status), to, actorKind);
  const [updated] = await tx
    .update(schema.kycSubmissions)
    .set({ ...set, status: to, updatedAt: now })
    .where(eq(schema.kycSubmissions.id, app.id))
    .returning();
  await tx.update(schema.borrowers).set({ kycStatus: to }).where(eq(schema.borrowers.id, app.borrowerId));
  return updated;
}

/** Makes the application editable by the member, restarting it after a rejection. */
async function beginEditing(tx: AppDb, app: Submission, borrower: Borrower, actor: ClientActor, now: string): Promise<Submission> {
  const status = normaliseKycStatus(app.status);
  if (status === 'IN_PROGRESS' || status === 'CORRECTION_REQUIRED') return app;
  if (status === 'NOT_STARTED' || status === 'REJECTED') {
    const updated = await moveTo(tx, app, 'IN_PROGRESS', 'client', {}, now);
    await audit(tx, {
      borrower,
      submissionId: app.id,
      actor,
      action: status === 'REJECTED' ? 'RESTARTED' : 'STARTED',
      previousStatus: status,
      newStatus: 'IN_PROGRESS',
      now,
    });
    return updated;
  }
  throw new HttpError(409, `Your KYC application is ${kycStatusLabel(status).toLowerCase()} and cannot be changed right now.`, 'NOT_EDITABLE', {
    kycStatus: status,
  });
}

// ---------------------------------------------------------------------------
// Member: draft, documents, automated checks, submission
// ---------------------------------------------------------------------------

/** Only member-declared ID fields are stored; scan and face results are server-owned. */
function sanitizeGovernmentId(g: Record<string, any> | null | undefined) {
  if (!g) return undefined;
  return {
    idType: g.idType ? String(g.idType).toUpperCase() : null,
    idNumber: g.idNumber ? String(g.idNumber).trim() : null,
    nameOnId: g.nameOnId ? String(g.nameOnId).trim() : null,
    issueDate: g.issueDate ? String(g.issueDate) : null,
    expirationDate: g.expirationDate ? String(g.expirationDate) : null,
  };
}

export interface DraftPayload extends KycApplicationPayload {
  currentStep?: number;
}

function draftSet(payload: DraftPayload) {
  const governmentId = sanitizeGovernmentId(payload.governmentId);
  return {
    ...(payload.personalInfo !== undefined ? { personalInfo: payload.personalInfo } : {}),
    ...(payload.address !== undefined ? { address: payload.address } : {}),
    ...(payload.contactInfo !== undefined ? { contactInfo: payload.contactInfo } : {}),
    ...(payload.employment !== undefined ? { employment: payload.employment } : {}),
    ...(governmentId !== undefined ? { governmentId, idType: governmentId.idType } : {}),
    ...(payload.declarations !== undefined ? { declarations: payload.declarations } : {}),
    ...(typeof payload.currentStep === 'number' ? { currentStep: Math.max(0, Math.min(10, Math.floor(payload.currentStep))) } : {}),
  };
}

export async function saveDraft(db: AppDb, actor: ClientActor, payload: DraftPayload): Promise<{ submissionId: string; status: KycStatus }> {
  const now = new Date().toISOString();
  return inKycTransaction(db, 'client', async (tx) => {
    const borrower = await loadBorrower(tx, actor.borrowerId);
    let app = await lockApplication(tx, borrower.id, now);
    app = await beginEditing(tx, app, borrower, actor, now);
    const set = draftSet(payload);
    if (Object.keys(set).length > 0) {
      [app] = await tx.update(schema.kycSubmissions).set({ ...set, updatedAt: now }).where(eq(schema.kycSubmissions.id, app.id)).returning();
    }
    return { submissionId: app.id, status: normaliseKycStatus(app.status) };
  });
}

export interface UploadInput {
  kind: DocumentKind;
  side?: 'FRONT' | 'BACK' | null;
  /** Base64, with or without a data: URL prefix. */
  base64: string;
  fileName?: string | null;
  documentName?: string | null;
}

export interface DocumentView {
  id: string;
  kind: DocumentKind;
  label: string;
  documentType: string;
  documentName: string;
  side: string | null;
  fileName: string | null;
  mimeType: string | null;
  status: string;
  rejectionReason: string | null;
  quality: QualityReport | null;
  uploadedAt: string;
  supersededAt: string | null;
  /** Short-lived link; null for legacy rows whose stored object cannot be located. */
  url: string | null;
}

function decodeBase64(input: string): Buffer {
  const comma = input.indexOf(',');
  const payload = input.startsWith('data:') && comma >= 0 ? input.slice(comma + 1) : input;
  if (!/^[A-Za-z0-9+/=\s_-]+$/.test(payload)) throw new HttpError(400, 'The file data is not valid base64.', 'BAD_FILE');
  return Buffer.from(payload, 'base64');
}

/**
 * Checks an upload before anything is stored: size, real file type (from its
 * bytes), and for machine-checked photos, resolution, exposure, glare and focus.
 */
export function inspectUpload(kind: DocumentKind, buffer: Buffer): { mime: string; quality: QualityReport | null } {
  if (buffer.length < 100) throw new HttpError(400, 'The file is empty or damaged. Please choose it again.', 'BAD_FILE');
  if (buffer.length > UPLOAD_LIMITS.maxBytes) throw new HttpError(413, 'The file is larger than 10 MB. Please use a smaller photo or PDF.', 'TOO_LARGE');
  const mime = sniffMime(buffer);
  if (!mime || !UPLOAD_LIMITS.mimeTypes.includes(mime)) {
    throw new HttpError(415, 'Please upload a JPG, PNG, WEBP or PDF file.', 'UNSUPPORTED_TYPE');
  }
  const imageOnly = IMAGE_ONLY_KINDS.includes(kind);
  if (imageOnly && mime !== 'image/jpeg' && mime !== 'image/png') {
    throw new HttpError(415, `${DOCUMENT_KIND_LABELS[kind]} must be a JPG or PNG photo so it can be checked automatically.`, 'UNSUPPORTED_TYPE');
  }
  let quality: QualityReport | null = null;
  if (mime === 'image/jpeg' || mime === 'image/png') {
    let img;
    try {
      img = decodeImage(buffer, mime);
    } catch {
      throw new HttpError(422, 'The photo could not be read. Please take it again.', 'BAD_IMAGE');
    }
    if (img) quality = assessImageQuality(img, kind);
    if (quality && !quality.ok && imageOnly) {
      throw new HttpError(422, quality.messages.join(' '), 'POOR_QUALITY', { quality });
    }
  }
  return { mime, quality };
}

function refOf(doc: KycDocumentRow): StoredObjectRef | null {
  if (doc.storagePath && (doc.storageBackend === 'supabase' || doc.storageBackend === 'local')) {
    return { backend: doc.storageBackend, path: doc.storagePath };
  }
  // Rows written before 0023 kept a (since expired) Supabase URL; the object path is in it.
  const m = /\/object\/(?:sign|public)\/kyc-documents\/([^?]+)/.exec(doc.fileUrl ?? '');
  if (m) return { backend: 'supabase', path: decodeURIComponent(m[1]) };
  if (doc.storagePath) return { backend: 'supabase', path: doc.storagePath };
  return null;
}

function kindOf(doc: KycDocumentRow): DocumentKind {
  return (doc.documentKind as DocumentKind) || documentKindFor(doc.documentType);
}

async function toView(doc: KycDocumentRow): Promise<DocumentView> {
  const ref = refOf(doc);
  let url: string | null = null;
  if (ref) {
    try {
      url = await signedKycUrl(ref);
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
    }
  }
  const kind = kindOf(doc);
  return {
    id: doc.id,
    kind,
    label: DOCUMENT_KIND_LABELS[kind],
    documentType: doc.documentType,
    documentName: doc.documentName,
    side: doc.side,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    status: doc.status,
    rejectionReason: doc.rejectionReason,
    quality: (doc.quality as QualityReport) ?? null,
    uploadedAt: doc.createdAt,
    supersededAt: doc.supersededAt,
    url,
  };
}

async function currentDocuments(tx: AppDb, borrowerId: string): Promise<KycDocumentRow[]> {
  const rows = await tx
    .select()
    .from(schema.kycDocuments)
    .where(and(eq(schema.kycDocuments.borrowerId, borrowerId), isNull(schema.kycDocuments.supersededAt)))
    .orderBy(desc(schema.kycDocuments.createdAt));
  const seen = new Set<string>();
  return rows.filter((d) => {
    const key = `${kindOf(d)}|${d.side ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function currentOf(docs: KycDocumentRow[], kind: DocumentKind): KycDocumentRow | undefined {
  return docs.find((d) => kindOf(d) === kind);
}

export async function uploadDocument(db: AppDb, actor: ClientActor, input: UploadInput): Promise<DocumentView> {
  const buffer = decodeBase64(input.base64);
  const { mime, quality } = inspectUpload(input.kind, buffer);

  // Refuse before storing anything if the application is locked.
  const pre = await db.select().from(schema.kycSubmissions).where(eq(schema.kycSubmissions.borrowerId, actor.borrowerId)).limit(1);
  if (pre[0] && !isEditableByClient(pre[0].status)) {
    throw new HttpError(409, `Your KYC application is ${kycStatusLabel(pre[0].status).toLowerCase()} and documents cannot be changed right now.`, 'NOT_EDITABLE');
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const ref = await putKycObject({ borrowerId: actor.borrowerId, kind: input.kind, buffer, mime });
  const now = new Date().toISOString();
  const side = input.side ?? (input.kind === 'ID_BACK' ? 'BACK' : input.kind === 'ID_FRONT' ? 'FRONT' : null);

  const row = await inKycTransaction(db, 'client', async (tx) => {
    const borrower = await loadBorrower(tx, actor.borrowerId);
    let app = await lockApplication(tx, borrower.id, now);
    app = await beginEditing(tx, app, borrower, actor, now);

    await tx
      .update(schema.kycDocuments)
      .set({ supersededAt: now })
      .where(
        and(
          eq(schema.kycDocuments.borrowerId, borrower.id),
          eq(schema.kycDocuments.documentKind, input.kind),
          isNull(schema.kycDocuments.supersededAt),
        ),
      );
    const [doc] = await tx
      .insert(schema.kycDocuments)
      .values({
        id: newId('kdoc'),
        kycSubmissionId: app.id,
        borrowerId: borrower.id,
        documentType: input.kind,
        documentName: input.documentName?.trim() || DOCUMENT_KIND_LABELS[input.kind],
        fileName: input.fileName?.slice(0, 200) || null,
        fileUrl: null,
        storagePath: ref.path,
        storageBackend: ref.backend,
        fileSize: String(buffer.length),
        mimeType: mime,
        status: 'PENDING',
        documentKind: input.kind,
        side,
        sha256,
        quality: quality as any,
        width: quality?.metrics.width ?? null,
        height: quality?.metrics.height ?? null,
        uploadedBy: actor.userId,
        createdAt: now,
      })
      .returning();

    // A new ID or selfie invalidates checks made against the old one.
    if (input.kind === 'ID_FRONT' || input.kind === 'ID_BACK') {
      await tx.update(schema.kycSubmissions).set({ ocrResult: null, discrepancies: null, faceCheck: null, updatedAt: now }).where(eq(schema.kycSubmissions.id, app.id));
    } else if (input.kind === 'SELFIE') {
      await tx.update(schema.kycSubmissions).set({ faceCheck: null, updatedAt: now }).where(eq(schema.kycSubmissions.id, app.id));
    }

    await audit(tx, {
      borrower,
      submissionId: app.id,
      actor,
      action: 'DOCUMENT_UPLOADED',
      metadata: { documentId: doc.id, kind: input.kind, side, sha256, mime, bytes: buffer.length, quality: quality?.metrics ?? null },
      now,
    });
    return doc;
  });
  return toView(row);
}

function declaredIdentity(app: Submission, borrower: Borrower) {
  const pi = (app.personalInfo as Record<string, any>) || {};
  const gid = (app.governmentId as Record<string, any>) || {};
  return {
    fullName: composeFullName(pi) || borrower.fullName,
    dateOfBirth: pi.dateOfBirth || borrower.dateOfBirth || null,
    idNumber: gid.idNumber || borrower.idNumber || null,
  };
}

export async function runIdScan(db: AppDb, automation: KycAutomation, actor: ClientActor) {
  const docs = await currentDocuments(db, actor.borrowerId);
  const front = currentOf(docs, 'ID_FRONT');
  if (!front) throw new HttpError(409, 'Upload a photo of the front of your ID first.', 'MISSING_DOCUMENT');
  const back = currentOf(docs, 'ID_BACK') ?? null;
  const frontRef = refOf(front);
  if (!frontRef) throw new HttpError(409, 'Please upload the front of your ID again.', 'MISSING_DOCUMENT');
  const frontImg = { buffer: await readKycObject(frontRef), mime: front.mimeType || 'image/jpeg' };
  const backRef = back ? refOf(back) : null;
  const backImg = back && backRef ? { buffer: await readKycObject(backRef), mime: back.mimeType || 'image/jpeg' } : null;

  const scan = await automation.scanId(frontImg, backImg);
  const ocr: OcrResult & { documentIds: string[] } = { ...scan, documentIds: [front.id, ...(back ? [back.id] : [])] };
  const now = new Date().toISOString();

  return inKycTransaction(db, 'client', async (tx) => {
    const borrower = await loadBorrower(tx, actor.borrowerId);
    let app = await lockApplication(tx, borrower.id, now);
    app = await beginEditing(tx, app, borrower, actor, now);
    const stillCurrent = currentOf(await currentDocuments(tx, borrower.id), 'ID_FRONT');
    if (stillCurrent?.id !== front.id) throw new HttpError(409, 'Your ID photo changed while it was being read. Please try again.', 'STALE');
    const discrepancies = findDiscrepancies(declaredIdentity(app, borrower), ocr.fields, manilaToday());
    await tx
      .update(schema.kycSubmissions)
      .set({ ocrResult: ocr as any, discrepancies: discrepancies as any, updatedAt: now })
      .where(eq(schema.kycSubmissions.id, app.id));
    await audit(tx, {
      borrower,
      submissionId: app.id,
      actor,
      action: 'ID_SCANNED',
      metadata: { status: ocr.status, provider: ocr.provider, confidence: ocr.confidence, discrepancies: discrepancies.map((d) => d.field) },
      now,
    });
    return { ocr, discrepancies, documentId: front.id };
  });
}

export async function runFaceCheck(db: AppDb, automation: KycAutomation, actor: ClientActor): Promise<FaceCheck> {
  const docs = await currentDocuments(db, actor.borrowerId);
  const front = currentOf(docs, 'ID_FRONT');
  const selfie = currentOf(docs, 'SELFIE');
  if (!front) throw new HttpError(409, 'Upload a photo of the front of your ID first.', 'MISSING_DOCUMENT');
  if (!selfie) throw new HttpError(409, 'Take a selfie first.', 'MISSING_DOCUMENT');
  const frontRef = refOf(front);
  const selfieRef = refOf(selfie);
  if (!frontRef || !selfieRef) throw new HttpError(409, 'Please upload your ID and selfie again.', 'MISSING_DOCUMENT');

  const result = await automation.compareFaces(
    { buffer: await readKycObject(frontRef), mime: front.mimeType || 'image/jpeg' },
    { buffer: await readKycObject(selfieRef), mime: selfie.mimeType || 'image/jpeg' },
  );
  const now = new Date().toISOString();
  const check: FaceCheck = { ...result, idDocumentId: front.id, selfieDocumentId: selfie.id, processedAt: now };

  await inKycTransaction(db, 'client', async (tx) => {
    const borrower = await loadBorrower(tx, actor.borrowerId);
    let app = await lockApplication(tx, borrower.id, now);
    app = await beginEditing(tx, app, borrower, actor, now);
    const current = await currentDocuments(tx, borrower.id);
    if (currentOf(current, 'ID_FRONT')?.id !== front.id || currentOf(current, 'SELFIE')?.id !== selfie.id) {
      throw new HttpError(409, 'Your photos changed while they were being compared. Please try again.', 'STALE');
    }
    await tx.update(schema.kycSubmissions).set({ faceCheck: check as any, updatedAt: now }).where(eq(schema.kycSubmissions.id, app.id));
    await audit(tx, {
      borrower,
      submissionId: app.id,
      actor,
      action: 'FACE_CHECKED',
      metadata: { status: check.status, provider: check.provider, confidence: check.confidence },
      now,
    });
  });
  return check;
}

async function requiredKinds(tx: AppDb): Promise<DocumentKind[]> {
  const configured = await tx.select().from(schema.kycRequiredDocuments).where(eq(schema.kycRequiredDocuments.isActive, true));
  const kinds = new Set<DocumentKind>(ALWAYS_REQUIRED_KINDS);
  for (const r of configured) {
    const k = documentKindFor(r.documentType);
    if (k !== 'OTHER') kinds.add(k);
  }
  return [...kinds];
}

export class KycSubmissionIncomplete extends HttpError {
  constructor(readonly issues: KycIssue[]) {
    super(422, `Please complete your application: ${issues.slice(0, 3).map((i) => i.message).join(' ')}${issues.length > 3 ? ` (+${issues.length - 3} more)` : ''}`, 'INCOMPLETE', {
      issues,
      requiredStep: firstIssueStep(issues),
    });
  }
}

export async function submitApplication(
  db: AppDb,
  actor: ClientActor,
  payload?: DraftPayload,
): Promise<{ status: KycStatus; referenceNumber: string; version: number }> {
  const now = new Date().toISOString();
  const today = manilaToday();
  return inKycTransaction(db, 'client', async (tx) => {
    const borrower = await loadBorrower(tx, actor.borrowerId);
    let app = await lockApplication(tx, borrower.id, now);
    const from = normaliseKycStatus(app.status);
    app = await beginEditing(tx, app, borrower, actor, now);
    if (payload) {
      const set = draftSet(payload);
      if (Object.keys(set).length > 0) {
        [app] = await tx.update(schema.kycSubmissions).set({ ...set, updatedAt: now }).where(eq(schema.kycSubmissions.id, app.id)).returning();
      }
    }

    const fields: KycApplicationPayload = {
      personalInfo: app.personalInfo as any,
      address: app.address as any,
      contactInfo: app.contactInfo as any,
      employment: app.employment as any,
      governmentId: app.governmentId as any,
      declarations: app.declarations as any,
    };
    const issues = validateKycApplication(fields, today);

    const docs = await currentDocuments(tx, borrower.id);
    for (const kind of await requiredKinds(tx)) {
      if (!currentOf(docs, kind)) {
        const step = kind === 'ID_FRONT' || kind === 'ID_BACK' ? 'ID_UPLOAD' : kind === 'SELFIE' ? 'FACE_MATCH' : 'DOCUMENTS';
        issues.push({ step, field: `documents.${kind}`, message: `Upload your ${DOCUMENT_KIND_LABELS[kind].toLowerCase()}.` });
      }
    }
    const face = app.faceCheck as FaceCheck | null;
    const front = currentOf(docs, 'ID_FRONT');
    const selfie = currentOf(docs, 'SELFIE');
    if (front && selfie) {
      if (!face || face.idDocumentId !== front.id || face.selfieDocumentId !== selfie.id) {
        issues.push({ step: 'FACE_MATCH', field: 'faceCheck', message: 'Complete the face verification step with your current ID and selfie.' });
      } else if (faceCheckBlocksSubmission(face)) {
        issues.push({ step: 'FACE_MATCH', field: 'faceCheck', message: 'Your selfie does not appear to match your ID photo. Please retake the selfie in good light.' });
      }
    }
    if (front && !app.ocrResult) {
      issues.push({ step: 'ID_UPLOAD', field: 'ocrResult', message: 'Run the ID check on your uploaded ID.' });
    }
    if (issues.length > 0) throw new KycSubmissionIncomplete(issues);

    const pi = fields.personalInfo as Record<string, any>;
    const cur = (fields.address as any).current as Record<string, any>;
    const em = fields.employment as Record<string, any>;
    const gid = fields.governmentId as Record<string, any>;
    const idNormalized = normalizeIdNumber(gid.idNumber);
    const dup = await tx
      .select({ id: schema.borrowers.id })
      .from(schema.borrowers)
      .where(and(ne(schema.borrowers.id, borrower.id), sql`upper(regexp_replace(${schema.borrowers.idNumber}, '[^A-Za-z0-9]', '', 'g')) = ${idNormalized}`))
      .limit(1);
    if (dup[0]) throw new HttpError(409, 'This government ID number is already registered to another member. Please contact your branch.', 'DUPLICATE', { field: 'governmentId.idNumber' });

    const streetLine = [cur.houseNumber, cur.street, cur.subdivision].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
    const mobile = normalizePhilippineMobile((fields.contactInfo as any)?.mobileNumber);
    await tx
      .update(schema.borrowers)
      .set({
        firstName: String(pi.firstName).trim(),
        middleName: pi.hasNoMiddleName ? null : String(pi.middleName ?? '').trim() || null,
        lastName: String(pi.lastName).trim(),
        suffix: String(pi.suffix ?? '').trim() || null,
        hasNoMiddleName: Boolean(pi.hasNoMiddleName),
        fullName: composeFullName(pi),
        dateOfBirth: pi.dateOfBirth,
        gender: pi.gender,
        civilStatus: pi.civilStatus,
        ...(mobile ? { phone: mobile } : {}),
        address: [streetLine, cur.barangay ? `Brgy. ${cur.barangay}` : null, cur.city, cur.province, cur.postalCode].filter(Boolean).join(', '),
        region: cur.region || null,
        regionCode: cur.regionCode,
        provinceCode: cur.provinceCode || null,
        province: cur.province || null,
        cityCode: cur.cityCode,
        cityMunicipality: cur.city || null,
        barangayCode: cur.barangayCode,
        barangay: cur.barangay || null,
        postalCode: String(cur.postalCode).trim(),
        employmentStatus: em.employmentStatus,
        employerOrBusiness: String(em.employerName || em.businessName || '').trim(),
        occupation: String(em.jobPosition || em.natureOfBusiness || '').trim(),
        monthlyIncome: Number(String(em.monthlyIncome).replace(/,/g, '')),
        monthlyExpenses: Number(String(em.monthlyExpenses).replace(/,/g, '')),
        sourceOfIncome: em.sourceOfIncome,
        idType: gid.idType,
        idNumber: String(gid.idNumber).trim(),
        profileCompleted: true,
        profileCompletedAt: now,
      })
      .where(eq(schema.borrowers.id, borrower.id));

    const version = (app.submissionCount ?? 0) + 1;
    const referenceNumber = app.referenceNumber || `KYC-${today.slice(0, 4)}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const consents = { ...(fields.declarations as object), acceptedAt: now, acceptedBy: actor.userId };
    const updated = await moveTo(
      tx,
      app,
      'SUBMITTED',
      'client',
      {
        submittedAt: now,
        submissionCount: version,
        referenceNumber,
        consents,
        idType: gid.idType,
        idDetails: gid,
        currentStep: 6,
        claimedBy: null,
        claimedByName: null,
        claimedAt: null,
        // The previous decision belongs to the previous version; the audit log keeps it.
        reviewedBy: null,
        reviewedByName: null,
        reviewedAt: null,
        decisionReason: null,
        rejectionReason: null,
        correctionReason: null,
        correctionSections: null,
        correctionDetails: null,
      },
      now,
    );

    const snapshot = {
      version,
      referenceNumber,
      application: fields,
      documents: docs.map((d) => ({ id: d.id, kind: kindOf(d), side: d.side, sha256: d.sha256, storagePath: d.storagePath })),
      ocr: updated.ocrResult,
      faceCheck: updated.faceCheck,
      discrepancies: updated.discrepancies,
    };
    const body = stableStringify(snapshot);
    await tx.insert(schema.kycSubmissionSnapshots).values({
      id: newId('ksnap'),
      submissionId: app.id,
      borrowerId: borrower.id,
      version,
      referenceNumber,
      snapshot,
      sha256: crypto.createHash('sha256').update(body).digest('hex'),
      submittedAt: now,
      createdAt: now,
    });

    const resubmission = from === 'CORRECTION_REQUIRED' || version > 1;
    await audit(tx, {
      borrower,
      submissionId: app.id,
      actor,
      action: resubmission ? 'RESUBMITTED' : 'SUBMITTED',
      previousStatus: from,
      newStatus: 'SUBMITTED',
      metadata: { referenceNumber, version, documents: snapshot.documents.length },
      now,
    });
    await notifyBranch(
      tx,
      borrower,
      'KYC_SUBMITTED',
      resubmission ? 'KYC application resubmitted' : 'New KYC application',
      `${composeFullName(pi)} ${resubmission ? 'resubmitted' : 'submitted'} KYC application ${referenceNumber} for review.`,
      now,
    );
    await notifyMember(
      tx,
      borrower,
      'KYC_SUBMITTED',
      'KYC application received',
      `We received your KYC application ${referenceNumber}. A branch officer will review it; we will notify you of the decision.`,
      now,
    );
    return { status: 'SUBMITTED' as KycStatus, referenceNumber, version };
  });
}

// ---------------------------------------------------------------------------
// Staff: claim, release, decide
// ---------------------------------------------------------------------------

async function assertNotOwnApplication(tx: AppDb, actor: StaffActor, borrowerId: string) {
  const own = await tx
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.borrowerId, borrowerId), eq(schema.users.id, actor.userId)))
    .limit(1);
  if (own[0]) throw new HttpError(403, 'You cannot review your own KYC application.', 'SELF_REVIEW');
}

export async function claimApplication(db: AppDb, actor: StaffActor, borrowerId: string): Promise<{ status: KycStatus }> {
  const now = new Date().toISOString();
  return inKycTransaction(db, 'staff', async (tx) => {
    const borrower = await loadBorrower(tx, borrowerId);
    assertInScope(actor, borrower);
    await assertNotOwnApplication(tx, actor, borrowerId);
    const app = await lockApplication(tx, borrowerId, now);
    const status = normaliseKycStatus(app.status);
    if (status === 'UNDER_REVIEW' && app.claimedBy === actor.userId) return { status };
    if (status === 'UNDER_REVIEW') {
      throw new HttpError(409, `${app.claimedByName || 'Another reviewer'} is already reviewing this application.`, 'CLAIMED');
    }
    await claim(tx, app, borrower, actor, now);
    return { status: 'UNDER_REVIEW' as KycStatus };
  });
}

async function claim(tx: AppDb, app: Submission, borrower: Borrower, actor: StaffActor, now: string): Promise<Submission> {
  const from = normaliseKycStatus(app.status);
  if (from !== 'SUBMITTED') {
    throw new HttpError(409, `Only a submitted application can be reviewed (this one is ${kycStatusLabel(from).toLowerCase()}).`, 'BAD_STATE', { kycStatus: from });
  }
  const updated = await moveTo(tx, app, 'UNDER_REVIEW', 'staff', { claimedBy: actor.userId, claimedByName: actor.name, claimedAt: now }, now);
  await audit(tx, { borrower, submissionId: app.id, actor, action: 'CLAIMED', previousStatus: from, newStatus: 'UNDER_REVIEW', now });
  await notifyMember(tx, borrower, 'KYC_UNDER_REVIEW', 'KYC application under review', `A branch officer is now reviewing your KYC application ${app.referenceNumber ?? ''}.`.trim(), now);
  return updated;
}

export async function releaseApplication(db: AppDb, actor: StaffActor, borrowerId: string, reason: string | null): Promise<{ status: KycStatus }> {
  const now = new Date().toISOString();
  return inKycTransaction(db, 'staff', async (tx) => {
    const borrower = await loadBorrower(tx, borrowerId);
    assertInScope(actor, borrower);
    const app = await lockApplication(tx, borrowerId, now);
    if (normaliseKycStatus(app.status) !== 'UNDER_REVIEW') throw new HttpError(409, 'This application is not under review.', 'BAD_STATE');
    if (app.claimedBy !== actor.userId) throw new HttpError(409, 'Only the reviewer who claimed this application can release it.', 'CLAIMED');
    await moveTo(tx, app, 'SUBMITTED', 'staff', { claimedBy: null, claimedByName: null, claimedAt: null }, now);
    await audit(tx, { borrower, submissionId: app.id, actor, action: 'RELEASED', previousStatus: 'UNDER_REVIEW', newStatus: 'SUBMITTED', reason, now });
    return { status: 'SUBMITTED' as KycStatus };
  });
}

export interface DecisionInput {
  decision: unknown;
  reason: unknown;
  /** Sections the member must fix, for a resubmission request. */
  sections?: unknown;
  idempotencyKey?: string | null;
}

export async function decideApplication(
  db: AppDb,
  actor: StaffActor,
  borrowerId: string,
  input: DecisionInput,
): Promise<{ status: KycStatus; replayed: boolean }> {
  const decision = parseKycDecision(input.decision);
  if (!decision) throw new HttpError(400, 'decision must be APPROVE, REJECT or REQUEST_RESUBMISSION.', 'BAD_DECISION');
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 3) throw new HttpError(400, 'Give a reason for this decision; the member will see it.', 'REASON_REQUIRED');
  if (reason.length > 1000) throw new HttpError(400, 'The reason is too long (1000 characters at most).', 'REASON_TOO_LONG');
  const sections = Array.isArray(input.sections) ? input.sections.map((s) => String(s)).slice(0, 10) : [];
  const key = input.idempotencyKey ? String(input.idempotencyKey).slice(0, 100) : null;
  const target = KYC_DECISIONS[decision];
  const claimedAt = new Date();
  // The decision is recorded just after an automatic claim so the trail reads in order.
  const now = new Date(claimedAt.getTime() + 1).toISOString();

  return inKycTransaction(db, 'staff', async (tx) => {
    const borrower = await loadBorrower(tx, borrowerId);
    assertInScope(actor, borrower);
    await assertNotOwnApplication(tx, actor, borrowerId);
    let app = await lockApplication(tx, borrowerId, now);
    if (key && app.lastIdempotencyKey === key) {
      return { status: normaliseKycStatus(app.status), replayed: true };
    }

    let from = normaliseKycStatus(app.status);
    if (from === 'SUBMITTED') {
      app = await claim(tx, app, borrower, actor, claimedAt.toISOString());
      from = 'UNDER_REVIEW';
    }
    if (from !== 'UNDER_REVIEW') {
      throw new HttpError(409, `This application is ${kycStatusLabel(from).toLowerCase()}; only an application waiting for review can be decided.`, 'BAD_STATE', { kycStatus: from });
    }
    if (app.claimedBy && app.claimedBy !== actor.userId) {
      throw new HttpError(409, `${app.claimedByName || 'Another reviewer'} is reviewing this application.`, 'CLAIMED');
    }

    const common = { reviewedBy: actor.userId, reviewedByName: actor.name, reviewedAt: now, lastIdempotencyKey: key };
    const set =
      decision === 'APPROVE'
        ? { ...common, decisionReason: reason, verifiedAt: now }
        : decision === 'REJECT'
          ? { ...common, rejectionReason: reason, resubmissionAllowed: true }
          : { ...common, correctionReason: reason, correctionSections: sections, correctionDetails: { sections, reason } };
    await moveTo(tx, app, target, 'staff', set, now);

    if (decision === 'APPROVE') {
      await tx.update(schema.borrowers).set({ memberStatus: 'Active' }).where(eq(schema.borrowers.id, borrowerId));
      await openRegularAccountTx(tx, borrower);
    }

    await audit(tx, {
      borrower,
      submissionId: app.id,
      actor,
      action: decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'RESUBMISSION_REQUESTED',
      previousStatus: 'UNDER_REVIEW',
      newStatus: target,
      reason,
      metadata: { referenceNumber: app.referenceNumber, sections, idempotencyKey: key },
      now,
    });

    const ref = app.referenceNumber ? ` ${app.referenceNumber}` : '';
    if (decision === 'APPROVE') {
      await notifyMember(tx, borrower, 'KYC_APPROVED', 'KYC verified', `Your KYC application${ref} has been verified. You can now apply for loans and use your savings account.`, now);
    } else if (decision === 'REJECT') {
      await notifyMember(tx, borrower, 'KYC_REJECTED', 'KYC application rejected', `Your KYC application${ref} was rejected. Reason: ${reason} You can update your application and submit it again.`, now);
    } else {
      await notifyMember(tx, borrower, 'KYC_RESUBMISSION_REQUIRED', 'KYC needs changes', `Your KYC application${ref} needs changes before it can be verified: ${reason}`, now);
    }
    return { status: target as KycStatus, replayed: false };
  });
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/** Server-side gate for loans and savings. Reads the member record, never the request. */
export async function assertKycVerified(db: AppDb, borrowerId: string | null | undefined): Promise<void> {
  if (!borrowerId) throw new HttpError(403, kycGateMessage('NOT_STARTED'), 'KYC_REQUIRED', { kycStatus: 'NOT_STARTED' });
  const rows = await db.select({ kycStatus: schema.borrowers.kycStatus }).from(schema.borrowers).where(eq(schema.borrowers.id, borrowerId)).limit(1);
  const status = rows[0]?.kycStatus;
  if (!isKycVerified(status)) {
    throw new HttpError(403, kycGateMessage(status), 'KYC_REQUIRED', { kycStatus: normaliseKycStatus(status) });
  }
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface DocumentRequirement {
  kind: DocumentKind;
  label: string;
  satisfied: boolean;
  document: DocumentView | null;
}

async function requirementsView(tx: AppDb, docs: KycDocumentRow[]): Promise<DocumentRequirement[]> {
  const kinds = await requiredKinds(tx);
  const out: DocumentRequirement[] = [];
  for (const kind of kinds) {
    const doc = currentOf(docs, kind);
    out.push({ kind, label: DOCUMENT_KIND_LABELS[kind], satisfied: Boolean(doc), document: doc ? await toView(doc) : null });
  }
  return out;
}

function decisionView(app: Submission | undefined) {
  return {
    referenceNumber: app?.referenceNumber ?? null,
    submissionCount: app?.submissionCount ?? 0,
    submittedAt: app?.submittedAt ?? null,
    reviewedAt: app?.reviewedAt ?? null,
    reviewedByName: app?.reviewedByName ?? null,
    claimedByName: app?.claimedByName ?? null,
    claimedAt: app?.claimedAt ?? null,
    decisionReason: app?.decisionReason ?? null,
    rejectionReason: app?.rejectionReason ?? null,
    correctionReason: app?.correctionReason ?? null,
    correctionSections: (app?.correctionSections as string[]) ?? [],
    verifiedAt: app?.verifiedAt ?? null,
  };
}

/** What the member sees in the portal. The member record's status is authoritative. */
export async function clientKycView(db: AppDb, borrowerId: string) {
  const borrower = await loadBorrower(db, borrowerId);
  const appRows = await db.select().from(schema.kycSubmissions).where(eq(schema.kycSubmissions.borrowerId, borrowerId)).limit(1);
  const app = appRows[0];
  const docs = await currentDocuments(db, borrowerId);
  const status = normaliseKycStatus(borrower.kycStatus);
  return {
    kycStatus: status,
    statusLabel: kycStatusLabel(status),
    isVerified: isKycVerified(status),
    editable: isEditableByClient(app?.status ?? status),
    applicationStatus: normaliseKycStatus(app?.status),
    currentStep: app?.currentStep ?? 0,
    ...decisionView(app),
    application: {
      personalInfo: app?.personalInfo ?? null,
      address: app?.address ?? null,
      contactInfo: app?.contactInfo ?? null,
      employment: app?.employment ?? null,
      governmentId: app?.governmentId ?? null,
      declarations: app?.declarations ?? null,
    },
    member: {
      firstName: borrower.firstName,
      middleName: borrower.middleName,
      lastName: borrower.lastName,
      suffix: borrower.suffix,
      hasNoMiddleName: borrower.hasNoMiddleName,
      dateOfBirth: borrower.dateOfBirth,
      gender: borrower.gender,
      civilStatus: borrower.civilStatus,
      phone: borrower.phone,
      email: borrower.email,
      emailVerified: Boolean(borrower.emailVerified),
      street: borrower.address,
      region: borrower.region,
      regionCode: borrower.regionCode,
      province: borrower.province,
      provinceCode: borrower.provinceCode,
      city: borrower.cityMunicipality,
      cityCode: borrower.cityCode,
      barangay: borrower.barangay,
      barangayCode: borrower.barangayCode,
      postalCode: borrower.postalCode,
      employmentStatus: borrower.employmentStatus,
      employerOrBusiness: borrower.employerOrBusiness,
      occupation: borrower.occupation,
      sourceOfIncome: borrower.sourceOfIncome,
      monthlyIncome: borrower.monthlyIncome,
      monthlyExpenses: borrower.monthlyExpenses,
      idType: borrower.idType,
      idNumber: borrower.idNumber,
    },
    checks: {
      ocr: (app?.ocrResult as OcrResult) ?? null,
      faceCheck: (app?.faceCheck as FaceCheck) ?? null,
      discrepancies: (app?.discrepancies as unknown[]) ?? [],
    },
    requirements: await requirementsView(db, docs),
  };
}

export interface StaffScope {
  branchId: string | null;
  viewAll: boolean;
}

const QUEUE_FILTERS: Readonly<Record<string, KycStatus[]>> = {
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['SUBMITTED'],
  UNDER_REVIEW: ['UNDER_REVIEW'],
  AWAITING: ['SUBMITTED', 'UNDER_REVIEW'],
  CORRECTION_REQUIRED: ['CORRECTION_REQUIRED'],
  RESUBMISSION_REQUIRED: ['CORRECTION_REQUIRED'],
  APPROVED: ['APPROVED'],
  VERIFIED: ['APPROVED'],
  REJECTED: ['REJECTED'],
  IN_PROGRESS: ['IN_PROGRESS'],
  NOT_STARTED: ['NOT_STARTED'],
};

export async function kycQueue(db: AppDb, scope: StaffScope, filters: { status?: string; search?: string; branchId?: string }) {
  const branch = scope.viewAll ? filters.branchId || null : scope.branchId;
  if (!scope.viewAll && !branch) throw new HttpError(403, 'This account is not associated with a branch.', 'NO_BRANCH');
  const rows = await db
    .select({ b: schema.borrowers, s: schema.kycSubmissions })
    .from(schema.borrowers)
    .leftJoin(schema.kycSubmissions, eq(schema.kycSubmissions.borrowerId, schema.borrowers.id))
    .where(branch ? eq(schema.borrowers.branchId, branch) : undefined);

  const items = rows.map(({ b, s }) => {
    const status = normaliseKycStatus(b.kycStatus);
    const face = (s?.faceCheck as FaceCheck | null) ?? null;
    const ocr = (s?.ocrResult as OcrResult | null) ?? null;
    return {
      borrowerId: b.id,
      borrowerNumber: b.borrowerNumber,
      fullName: b.fullName,
      phone: b.phone,
      email: b.email,
      branchId: b.branchId,
      avatar: b.avatar,
      kycStatus: status,
      statusLabel: kycStatusLabel(status),
      referenceNumber: s?.referenceNumber ?? null,
      submissionCount: s?.submissionCount ?? 0,
      submittedAt: s?.submittedAt ?? null,
      claimedByName: s?.claimedByName ?? null,
      reviewedAt: s?.reviewedAt ?? null,
      faceCheckStatus: face?.status ?? null,
      faceConfidence: face?.confidence ?? null,
      ocrStatus: ocr?.status ?? null,
      discrepancyCount: Array.isArray(s?.discrepancies) ? (s?.discrepancies as unknown[]).length : 0,
      lastUpdated: s?.updatedAt ?? b.lastActivityDate ?? b.joinedDate,
    };
  });

  const count = (statuses: KycStatus[]) => items.filter((i) => statuses.includes(i.kycStatus)).length;
  const counts = {
    all: items.length,
    pending: count(['SUBMITTED']),
    underReview: count(['UNDER_REVIEW']),
    correctionRequired: count(['CORRECTION_REQUIRED']),
    approved: count(['APPROVED']),
    rejected: count(['REJECTED']),
    inProgress: count(['IN_PROGRESS']),
    notStarted: count(['NOT_STARTED']),
  };

  const wanted = filters.status ? QUEUE_FILTERS[String(filters.status).toUpperCase()] : undefined;
  const q = String(filters.search ?? '').trim().toLowerCase();
  const filtered = items
    .filter((i) => !wanted || wanted.includes(i.kycStatus))
    .filter(
      (i) =>
        !q ||
        [i.fullName, i.borrowerNumber, i.referenceNumber, i.phone, i.email].some((v) => String(v ?? '').toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      // Oldest waiting application first; everything else newest first.
      const aw = a.kycStatus === 'SUBMITTED' || a.kycStatus === 'UNDER_REVIEW';
      const bw = b.kycStatus === 'SUBMITTED' || b.kycStatus === 'UNDER_REVIEW';
      if (aw !== bw) return aw ? -1 : 1;
      if (aw) return String(a.submittedAt ?? '').localeCompare(String(b.submittedAt ?? ''));
      return String(b.lastUpdated ?? '').localeCompare(String(a.lastUpdated ?? ''));
    });
  return { items: filtered, counts };
}

export async function kycDossier(db: AppDb, scope: StaffScope, borrowerId: string) {
  const borrower = await loadBorrower(db, borrowerId);
  if (!scope.viewAll && borrower.branchId !== scope.branchId) throw new HttpError(404, 'Member not found in your branch.', 'NOT_FOUND');
  const appRows = await db.select().from(schema.kycSubmissions).where(eq(schema.kycSubmissions.borrowerId, borrowerId)).limit(1);
  const app = appRows[0];
  const allDocs = await db.select().from(schema.kycDocuments).where(eq(schema.kycDocuments.borrowerId, borrowerId)).orderBy(desc(schema.kycDocuments.createdAt));
  const current = await currentDocuments(db, borrowerId);
  const currentIds = new Set(current.map((d) => d.id));
  const [snapshots, auditTrail] = await Promise.all([
    db
      .select({
        version: schema.kycSubmissionSnapshots.version,
        referenceNumber: schema.kycSubmissionSnapshots.referenceNumber,
        submittedAt: schema.kycSubmissionSnapshots.submittedAt,
        sha256: schema.kycSubmissionSnapshots.sha256,
      })
      .from(schema.kycSubmissionSnapshots)
      .where(eq(schema.kycSubmissionSnapshots.borrowerId, borrowerId))
      .orderBy(desc(schema.kycSubmissionSnapshots.version)),
    db.select().from(schema.kycAuditLog).where(eq(schema.kycAuditLog.borrowerId, borrowerId)).orderBy(desc(schema.kycAuditLog.createdAt)),
  ]);
  const status = normaliseKycStatus(borrower.kycStatus);
  return {
    member: {
      id: borrower.id,
      borrowerNumber: borrower.borrowerNumber,
      fullName: borrower.fullName,
      firstName: borrower.firstName,
      middleName: borrower.middleName,
      lastName: borrower.lastName,
      suffix: borrower.suffix,
      dateOfBirth: borrower.dateOfBirth,
      gender: borrower.gender,
      civilStatus: borrower.civilStatus,
      phone: borrower.phone,
      email: borrower.email,
      emailVerified: Boolean(borrower.emailVerified),
      address: borrower.address,
      barangay: borrower.barangay,
      cityMunicipality: borrower.cityMunicipality,
      province: borrower.province,
      region: borrower.region,
      postalCode: borrower.postalCode,
      employmentStatus: borrower.employmentStatus,
      employerOrBusiness: borrower.employerOrBusiness,
      occupation: borrower.occupation,
      sourceOfIncome: borrower.sourceOfIncome,
      monthlyIncome: borrower.monthlyIncome,
      monthlyExpenses: borrower.monthlyExpenses,
      idType: borrower.idType,
      idNumber: borrower.idNumber,
      branchId: borrower.branchId,
      memberStatus: borrower.memberStatus,
      registrationChannel: borrower.registrationChannel,
      avatar: borrower.avatar,
    },
    kycStatus: status,
    statusLabel: kycStatusLabel(status),
    applicationStatus: normaliseKycStatus(app?.status),
    ...decisionView(app),
    application: {
      personalInfo: app?.personalInfo ?? null,
      address: app?.address ?? null,
      contactInfo: app?.contactInfo ?? null,
      employment: app?.employment ?? null,
      governmentId: app?.governmentId ?? null,
      declarations: app?.declarations ?? null,
      consents: app?.consents ?? null,
    },
    checks: {
      ocr: (app?.ocrResult as OcrResult) ?? null,
      faceCheck: (app?.faceCheck as FaceCheck) ?? null,
      discrepancies: (app?.discrepancies as unknown[]) ?? [],
    },
    requirements: await requirementsView(db, current),
    documents: await Promise.all(allDocs.map(async (d) => ({ ...(await toView(d)), current: currentIds.has(d.id) }))),
    snapshots,
    auditTrail: auditTrail.map((a) => ({
      id: a.id,
      action: a.action,
      previousStatus: a.previousStatus,
      newStatus: a.newStatus,
      reason: a.reason,
      actorType: a.actorType,
      actorName: a.staffName ?? (a.actorType === 'CLIENT' ? borrower.fullName : null),
      metadata: a.metadata,
      createdAt: a.createdAt,
    })),
  };
}
