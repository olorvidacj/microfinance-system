/**
 * The member's guided KYC flow, shared by the web portal and the mobile app:
 * the six steps, the server checks each one must pass (validateKycApplication),
 * the parts of the application each covers (for "additional information
 * required", where only the requested parts may change), and what a
 * face-comparison result means for the member.
 */
import { sectionOpen, type KycIssue, type KycSection, type KycStep } from '../kyc-core';
import type { FaceMatchResultView, KycStatusView } from './contracts';

export type KycWizardStepKey = 'personal' | 'id' | 'idReview' | 'selfie' | 'more' | 'review';

export interface KycWizardStep {
  key: KycWizardStepKey;
  title: string;
  subtitle: string;
  sections: readonly KycSection[];
  checks: readonly KycStep[];
}

export const KYC_WIZARD_STEPS: readonly KycWizardStep[] = [
  { key: 'personal', title: 'Personal information', subtitle: 'Your name, birth date, contact details and address', sections: ['PERSONAL_INFO', 'ADDRESS'], checks: ['PERSONAL_INFO', 'CONTACT', 'ADDRESS'] },
  { key: 'id', title: 'Government ID', subtitle: 'Clear photos of one valid ID', sections: ['ID_UPLOAD'], checks: [] },
  { key: 'idReview', title: 'Check your ID details', subtitle: 'Confirm the details printed on your ID', sections: ['ID_UPLOAD'], checks: ['ID_UPLOAD'] },
  { key: 'selfie', title: 'Selfie', subtitle: 'A photo of your face, compared with your ID photo', sections: ['FACE_MATCH'], checks: ['FACE_MATCH'] },
  { key: 'more', title: 'Work and documents', subtitle: 'Your work, income and any supporting documents', sections: ['FINANCIAL', 'DOCUMENTS'], checks: ['FINANCIAL'] },
  { key: 'review', title: 'Review and submit', subtitle: 'Check everything, agree to the declarations, then submit', sections: [], checks: ['CONSENT'] },
];

export const kycStepIndex = (key: KycWizardStepKey) => KYC_WIZARD_STEPS.findIndex((s) => s.key === key);

/** The ID and selfie have their own steps; every other required document is a supporting document. */
export const IDENTITY_DOCUMENT_KINDS: readonly string[] = ['ID_FRONT', 'ID_BACK', 'SELFIE'];

/** The sections staff asked to change, while additional information is required (null: everything may change). */
export function kycRequestedSections(status: Pick<KycStatusView, 'kycStatus' | 'correctionDetails'> | null): string[] | null {
  if (!status || status.kycStatus !== 'CORRECTION_REQUIRED') return null;
  const s = status.correctionDetails?.sections ?? [];
  return s.length ? s : null;
}

/** A step with nothing the member may change now: shown for reference only. */
export function kycStepLocked(step: KycWizardStep, requested: readonly string[] | null): boolean {
  return step.sections.length > 0 && step.sections.every((s) => !sectionOpen(s, requested));
}

/** Whether the member may (re)submit now: a final rejection is closed. */
export function kycCanEdit(status: Pick<KycStatusView, 'editable' | 'kycStatus' | 'resubmissionAllowed'>): boolean {
  return status.editable && !(status.kycStatus === 'REJECTED' && !status.resubmissionAllowed);
}

/** The step where a server issue (from a refused submission) is fixed. */
export function kycStepOfIssue(issue: Pick<KycIssue, 'step' | 'field'>): number {
  switch (issue.step) {
    case 'PERSONAL_INFO':
    case 'CONTACT':
    case 'ADDRESS':
      return kycStepIndex('personal');
    case 'ID_UPLOAD':
      return issue.field.startsWith('documents.') || issue.field === 'ocrResult' ? kycStepIndex('id') : kycStepIndex('idReview');
    case 'FACE_MATCH':
      return kycStepIndex('selfie');
    case 'FINANCIAL':
    case 'DOCUMENTS':
      return kycStepIndex('more');
    case 'CONSENT':
      return kycStepIndex('review');
  }
}

/** The issues in a refused submission's details ({ issues: [...] }), checked field by field. */
export function kycIssuesFrom(details: Record<string, unknown> | undefined): KycIssue[] {
  const raw = details?.issues;
  if (!Array.isArray(raw)) return [];
  const steps: readonly string[] = ['PERSONAL_INFO', 'CONTACT', 'ADDRESS', 'ID_UPLOAD', 'FACE_MATCH', 'FINANCIAL', 'DOCUMENTS', 'CONSENT'];
  return raw.filter(
    (i): i is KycIssue => typeof i === 'object' && i !== null && typeof i.field === 'string' && typeof i.message === 'string' && steps.includes(i.step),
  );
}

export interface FaceResultCopy {
  tone: 'ok' | 'warn' | 'info';
  title: string;
  body: string;
  /** Suggest taking the selfie again. */
  retake: boolean;
}

/** What a face-comparison result means for the member: never more than the service reported. */
export function faceResultForMember(r: FaceMatchResultView): FaceResultCopy {
  if (r.isMatch) {
    return {
      tone: 'ok',
      title: 'Your selfie matches your ID photo',
      body: `The face-check service found ${r.matchConfidence ?? 0}% similarity. A branch officer still reviews your application before it is approved.`,
      retake: false,
    };
  }
  switch (r.status) {
    case 'NO_MATCH':
      return {
        tone: 'warn',
        title: 'Your selfie does not seem to match your ID photo',
        body: 'Retake it facing the camera in good light, without glasses or a mask. If it still does not match, you can continue and a branch officer will compare the photos.',
        retake: true,
      };
    case 'LOW_CONFIDENCE':
      return {
        tone: 'warn',
        title: 'The match could not be confirmed automatically',
        body: 'You can retake the selfie for a clearer comparison, or continue. A branch officer will compare your selfie with your ID photo.',
        retake: true,
      };
    case 'FAILED':
      return {
        tone: 'warn',
        title: 'Your selfie could not be compared',
        body: r.details ?? 'Try again in a moment, or continue and a branch officer will compare your photos.',
        retake: r.recommendation === 'RETRY_SELFIE',
      };
    default:
      return {
        tone: 'info',
        title: 'Your selfie was received',
        body: 'Automatic face comparison is not available, so a branch officer will compare your selfie with your ID photo during review.',
        retake: false,
      };
  }
}
