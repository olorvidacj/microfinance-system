import { Router, type Request } from 'express';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index';
import { HttpError, type AppDb } from '../kyc/errors';
import { defaultAutomation } from '../kyc/automation';
import {
  clientKycView,
  runFaceCheck,
  runIdScan,
  saveDraft,
  submitApplication,
  uploadDocument,
  type ClientActor,
  type DocumentView,
} from '../kyc/service';
import { documentKindFor, kycStatusLabel, type FaceCheck, type OcrResult } from '../../shared/kyc-core';
import type { FaceMatchResultView, FaceMatchView, IdScanFieldsView, IdScanView, KycApplicationView, KycStatusView, KycUploadView } from '../../shared/client';
import { sendError } from './httpErrors';

/**
 * Member-facing KYC API (/api/client/kyc*). The response shapes keep the
 * fields the portal and mobile app already read, built from the KYC service.
 */
export const clientKycRouter = Router();

function database(): AppDb {
  const db = getDb();
  if (!db) throw new HttpError(503, 'The database is not available right now.', 'DB_UNAVAILABLE');
  return db as unknown as AppDb;
}

async function clientActor(req: Request): Promise<ClientActor> {
  const auth = (req as any).authUser as { id: string; role: string; fullName?: string | null; email: string } | undefined;
  if (!auth) throw new HttpError(401, 'Please sign in.', 'UNAUTHENTICATED');
  if (auth.role !== 'CLIENT') throw new HttpError(403, 'Only members can manage their own KYC.', 'FORBIDDEN');
  const db = database();
  const rows = await db.select({ borrowerId: schema.users.borrowerId }).from(schema.users).where(eq(schema.users.id, auth.id)).limit(1);
  const borrowerId = rows[0]?.borrowerId;
  if (!borrowerId) throw new HttpError(403, 'Your login is not linked to a member record yet. Please contact your branch.', 'NO_MEMBER');
  return { kind: 'client', userId: auth.id, name: auth.fullName || auth.email, borrowerId };
}

function legacyDocument(d: DocumentView) {
  return {
    id: d.id,
    type: d.documentType,
    documentType: d.documentType,
    kind: d.kind,
    name: d.documentName,
    documentName: d.documentName,
    fileName: d.fileName,
    fileUrl: d.url,
    status: d.status,
    rejectionReason: d.rejectionReason,
    submitted: true,
    uploadedAt: d.uploadedAt,
  };
}

/** The fields the portal's ID step reads from an automated scan. */
function legacyScan(ocr: OcrResult | null): IdScanFieldsView | null {
  if (!ocr) return null;
  const f = ocr.fields ?? {};
  return {
    status: ocr.status,
    provider: ocr.provider,
    isReadable: ocr.readable,
    confidenceScore: ocr.confidence,
    detectedType: ocr.detectedIdType,
    validationWarnings: [...ocr.warnings, ...(ocr.error ? [ocr.error] : [])],
    idType: ocr.detectedIdType,
    idNumber: f.idNumber ?? null,
    fullName: f.fullName ?? null,
    firstName: f.firstName ?? null,
    middleName: f.middleName ?? null,
    lastName: f.lastName ?? null,
    dateOfBirth: f.dateOfBirth ?? null,
    gender: f.sex ?? null,
    address: f.address ?? null,
    issueDate: f.issueDate ?? null,
    expirationDate: f.expirationDate ?? null,
  };
}

function legacyFace(check: FaceCheck | null): FaceMatchResultView | null {
  if (!check) return null;
  return {
    status: check.status,
    matchStatus: check.status,
    isMatch: check.status === 'MATCH',
    matchConfidence: check.confidence,
    details:
      check.details ??
      (check.status === 'UNAVAILABLE' ? 'Automated face comparison is not available; a branch officer will compare your photos.' : null),
    recommendation: check.status === 'NO_MATCH' ? 'RETRY_SELFIE' : check.status === 'MATCH' ? 'CONTINUE' : 'MANUAL_REVIEW',
    processedAt: check.processedAt,
  };
}

clientKycRouter.get('/kyc-status', async (req, res) => {
  try {
    const actor = await clientActor(req);
    const view = await clientKycView(database(), actor.borrowerId);
    const docs = view.requirements.filter((r) => r.document).map((r) => legacyDocument(r.document as DocumentView));
    // The typed part (shared/client KycStatusView) is what the web portal and the app rely on.
    const status: KycStatusView = {
      kycStatus: view.kycStatus,
      statusLabel: view.statusLabel,
      isVerified: view.isVerified,
      editable: view.editable,
      applicationStatus: view.applicationStatus,
      currentStep: view.currentStep,
      referenceNumber: view.referenceNumber,
      submissionCount: view.submissionCount,
      submittedAt: view.submittedAt,
      reviewedAt: view.reviewedAt,
      reviewedByName: view.reviewedByName,
      verifiedAt: view.verifiedAt,
      decisionReason: view.decisionReason,
      rejectionReason: view.rejectionReason,
      correctionReason: view.correctionReason,
      correctionDetails: view.correctionSections.length ? { sections: view.correctionSections, reason: view.correctionReason } : null,
      requiredDocuments: view.requirements.map((r) => ({
        type: r.kind,
        name: r.label,
        submitted: r.satisfied,
        status: r.document?.status ?? 'NOT_UPLOADED',
        fileUrl: r.document?.url ?? null,
        fileName: r.document?.fileName ?? null,
      })),
      member: view.member,
      submission: view.application as KycApplicationView,
    };
    res.json({
      success: true,
      ...status,
      submissionId: view.referenceNumber,
      uploadedDocuments: docs,
      extractedIdData: legacyScan(view.checks.ocr),
      faceMatchResult: legacyFace(view.checks.faceCheck),
      discrepancies: view.checks.discrepancies,
    });
  } catch (err) {
    sendError(res, err, 'kyc-status');
  }
});

clientKycRouter.post('/kyc/save-draft', async (req, res) => {
  try {
    const actor = await clientActor(req);
    const result = await saveDraft(database(), actor, req.body || {});
    res.json({ success: true, message: 'Your KYC progress was saved.', submissionId: result.submissionId, status: result.status });
  } catch (err) {
    sendError(res, err, 'kyc-save-draft');
  }
});

clientKycRouter.post('/kyc/submit', async (req, res) => {
  try {
    const actor = await clientActor(req);
    const result = await submitApplication(database(), actor, req.body || undefined);
    res.json({
      success: true,
      message: 'Your KYC application was submitted for branch review.',
      status: result.status,
      statusLabel: kycStatusLabel(result.status),
      referenceNumber: result.referenceNumber,
      version: result.version,
    });
  } catch (err) {
    sendError(res, err, 'kyc-submit');
  }
});

clientKycRouter.get('/kyc/required-documents', async (req, res) => {
  try {
    const actor = await clientActor(req);
    const view = await clientKycView(database(), actor.borrowerId);
    res.json({
      success: true,
      documents: view.requirements.map((r, i) => ({ documentType: r.kind, documentName: r.label, isActive: true, sortOrder: i + 1, submitted: r.satisfied })),
    });
  } catch (err) {
    sendError(res, err, 'kyc-required-documents');
  }
});

clientKycRouter.get('/kyc/documents', async (req, res) => {
  try {
    const actor = await clientActor(req);
    const view = await clientKycView(database(), actor.borrowerId);
    res.json({ success: true, documents: view.requirements.filter((r) => r.document).map((r) => legacyDocument(r.document as DocumentView)) });
  } catch (err) {
    sendError(res, err, 'kyc-documents');
  }
});

clientKycRouter.post('/kyc/documents/upload', async (req, res) => {
  try {
    const actor = await clientActor(req);
    const { documentType, documentName, fileName, imageBase64, side } = req.body || {};
    if (!imageBase64) throw new HttpError(400, 'Choose a file to upload.', 'NO_FILE');
    let kind = documentKindFor(documentType);
    if (kind === 'ID_FRONT' && String(side || '').toUpperCase() === 'BACK') kind = 'ID_BACK';
    const doc = await uploadDocument(database(), actor, { kind, base64: String(imageBase64), fileName, documentName });
    const body: KycUploadView = { document: { id: doc.id, documentType: doc.documentType, fileName: doc.fileName, fileUrl: doc.url, status: doc.status } };
    res.json({ success: true, document: { ...legacyDocument(doc), ...body.document }, quality: doc.quality });
  } catch (err) {
    sendError(res, err, 'kyc-upload');
  }
});

clientKycRouter.post('/kyc/selfie', async (req, res) => {
  try {
    const actor = await clientActor(req);
    if (!req.body?.imageBase64) throw new HttpError(400, 'Take or choose a selfie first.', 'NO_FILE');
    const doc = await uploadDocument(database(), actor, { kind: 'SELFIE', base64: String(req.body.imageBase64) });
    res.json({ success: true, selfie: { id: doc.id, fileUrl: doc.url, status: doc.status } });
  } catch (err) {
    sendError(res, err, 'kyc-selfie');
  }
});

/** Stores the ID photo(s), then reads them with the automated scanner. */
clientKycRouter.post('/kyc/process-id', async (req, res) => {
  try {
    const actor = await clientActor(req);
    const { frontImageBase64, backImageBase64, fileName } = req.body || {};
    if (!frontImageBase64) throw new HttpError(400, 'Upload a photo of the front of your ID.', 'NO_FILE');
    const db = database();
    const front = await uploadDocument(db, actor, { kind: 'ID_FRONT', base64: String(frontImageBase64), fileName });
    const back = backImageBase64 ? await uploadDocument(db, actor, { kind: 'ID_BACK', base64: String(backImageBase64) }) : null;
    const { ocr, discrepancies } = await runIdScan(db, defaultAutomation(), actor);
    const scan = legacyScan(ocr);
    const body: IdScanView = {
      validation: {
        status: ocr.status,
        isReadable: ocr.readable,
        confidenceScore: ocr.confidence,
        detectedType: ocr.detectedIdType,
        validationWarnings: scan?.validationWarnings ?? [],
        qualityChecks: front.quality?.metrics ?? null,
        qualityMessage:
          ocr.status === 'UNAVAILABLE'
            ? 'Your ID photo passed the quality check. Automatic reading is not available, so please type your details exactly as printed.'
            : ocr.status === 'FAILED'
              ? 'Your ID photo passed the quality check, but it could not be read automatically. Please type your details exactly as printed.'
              : ocr.readable === false
                ? "We couldn't read your ID clearly. Please retake the photo in good light with the whole card visible."
                : 'Your ID was read. Please check every field against the card.',
      },
      extractedData: scan,
      document: { id: front.id, frontFileUrl: front.url, backFileUrl: back?.url ?? null },
    };
    res.json({ success: true, ...body, discrepancies });
  } catch (err) {
    sendError(res, err, 'kyc-process-id');
  }
});

/** Stores the selfie, then compares it with the stored ID photo (never one sent by the browser). */
clientKycRouter.post('/kyc/match-face', async (req, res) => {
  try {
    const actor = await clientActor(req);
    const { selfieImageBase64 } = req.body || {};
    if (!selfieImageBase64) throw new HttpError(400, 'Take a selfie first.', 'NO_FILE');
    const db = database();
    const selfie = await uploadDocument(db, actor, { kind: 'SELFIE', base64: String(selfieImageBase64) });
    const check = await runFaceCheck(db, defaultAutomation(), actor);
    const body: FaceMatchView = { matchResult: legacyFace(check), selfie: { id: selfie.id, fileUrl: selfie.url } };
    res.json({ success: true, ...body });
  } catch (err) {
    sendError(res, err, 'kyc-match-face');
  }
});
