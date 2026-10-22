import { findDiscrepancies, findIdType, scopeApplication, sectionOpen, type KycApplicationPayload, type KycSection } from '../../../shared/kyc-core';
import {
  IDENTITY_DOCUMENT_KINDS,
  KYC_WIZARD_STEPS,
  buildKycApplication,
  kycFormFrom,
  kycRequestedSections,
  kycStepIndex,
  kycStepLocked,
  kycStepOfIssue,
  kycStepsValid,
  type KycFormState,
  type KycWizardStep,
  type KycWizardStepKey,
} from '../../../shared/client';
import type { KycStatusData } from '../types';

/**
 * The web wizard's view of the shared six-step flow (shared/client/kycSteps.ts),
 * plus what the portal works out from its own status data.
 */
export type WizardStepKey = KycWizardStepKey;
export type WizardStep = KycWizardStep;
export const WIZARD_STEPS = KYC_WIZARD_STEPS;
export const stepIndex = kycStepIndex;
export const IDENTITY_KINDS = IDENTITY_DOCUMENT_KINDS;
export const requestedSections = kycRequestedSections;
export const stepLocked = kycStepLocked;
export const stepOfIssue = kycStepOfIssue;

export const sectionEditable = (section: KycSection, requested: readonly string[] | null) => sectionOpen(section, requested);

const hasDocument = (status: KycStatusData, kind: string) => status.requiredDocuments.some((d) => d.type === kind && d.submitted);

/** Whether the ID needs a photo of its back. */
export const needsBack = (idType: string) => Boolean(findIdType(idType)?.hasBackSide);

/** Whether a step is complete, by the same rules the server applies at submission. */
export function stepComplete(step: WizardStep, form: KycFormState, status: KycStatusData, today: string): boolean {
  switch (step.key) {
    case 'personal':
    case 'idReview':
    case 'review':
      return kycStepsValid(form, step.checks, today);
    case 'id':
      return hasDocument(status, 'ID_FRONT') && (!needsBack(form.idType) || hasDocument(status, 'ID_BACK')) && Boolean(status.extractedIdData);
    case 'selfie':
      return form.biometricConsent && hasDocument(status, 'SELFIE') && Boolean(status.faceMatchResult);
    case 'more':
      return kycStepsValid(form, step.checks, today) && status.requiredDocuments.filter((d) => !IDENTITY_KINDS.includes(d.type)).every((d) => d.submitted);
  }
}

/** Where to resume: the first unfinished step (or, when changes were requested, the first requested one). */
export function resumeStep(form: KycFormState, status: KycStatusData, today: string): number {
  const requested = requestedSections(status);
  for (let i = 0; i < WIZARD_STEPS.length - 1; i++) {
    const step = WIZARD_STEPS[i];
    if (stepLocked(step, requested)) continue;
    if (requested || !stepComplete(step, form, status, today)) return i;
  }
  return WIZARD_STEPS.length - 1;
}

/** How far the saved application is: the steps before review that are complete, and those still to do. */
export function kycProgress(status: KycStatusData, today: string): { done: number; total: number; outstanding: string[] } {
  const form = kycFormFrom(status);
  const steps = WIZARD_STEPS.slice(0, -1);
  const outstanding = steps.filter((s) => !stepComplete(s, form, status, today)).map((s) => s.title);
  return { done: steps.length - outstanding.length, total: steps.length, outstanding };
}

/** What to send when saving or submitting: only the parts the member may change now. */
export function applicationToSend(form: KycFormState, status: KycStatusData): KycApplicationPayload {
  return scopeApplication(buildKycApplication(form), requestedSections(status));
}

/** Differences between what the member typed and what was read from the ID, recomputed as they edit. */
export function liveDiscrepancies(form: KycFormState, status: KycStatusData, today: string) {
  const read = status.extractedIdData;
  if (!read || read.status !== 'COMPLETED') return [];
  const fullName = [form.firstName, form.hasNoMiddleName ? '' : form.middleName, form.lastName, form.suffix].filter((p) => p.trim()).join(' ');
  return findDiscrepancies(
    { fullName, dateOfBirth: form.dateOfBirth || null, idNumber: form.idNumber || null },
    { fullName: read.fullName, dateOfBirth: read.dateOfBirth, idNumber: read.idNumber, expirationDate: read.expirationDate },
    today,
  );
}
