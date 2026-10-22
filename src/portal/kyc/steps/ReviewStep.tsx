import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { composeFullName, findIdType } from '../../../../shared/kyc-core';
import { CheckField, Group } from '../controls';
import { WIZARD_STEPS, stepComplete, stepLocked, type WizardStepKey } from '../wizard';
import type { StepProps } from './types';

const masked = (value: string) => {
  const v = value.replace(/[\s-]/g, '');
  return v.length > 4 ? `${'•'.repeat(Math.min(8, v.length - 4))}${v.slice(-4)}` : v;
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-right font-medium text-navy-950">{value || '—'}</dd>
  </div>
);

/** Step 6: a summary with links back to each step, the declarations, then submission. */
export const ReviewStep: React.FC<StepProps> = ({ form, update, errors, status, requested, today, goTo }) => {
  const address = [form.currentHouseNumber, form.currentStreet, form.currentBarangayName && `Brgy. ${form.currentBarangayName}`, form.currentCityName, form.currentProvinceName, form.currentPostalCode]
    .filter((p) => p && String(p).trim())
    .join(', ');
  const docs = status.requiredDocuments;
  const face = status.faceMatchResult;

  const section = (step: WizardStepKey, children: React.ReactNode) => {
    const def = WIZARD_STEPS.find((s) => s.key === step);
    if (!def) return null;
    const done = stepComplete(def, form, status, today);
    const locked = stepLocked(def, requested);
    return (
      <Group title={def.title}>
        <div className="-mt-2 flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${done ? 'text-emerald-700' : 'text-amber-700'}`}>
            {done ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {done ? 'Complete' : 'Needs attention'}
          </span>
          {!locked && (
            <button type="button" onClick={() => goTo(step)} className="text-sm font-semibold text-navy-900 underline">
              Edit
            </button>
          )}
        </div>
        <dl className="divide-y divide-slate-100">{children}</dl>
      </Group>
    );
  };

  return (
    <div className="space-y-4">
      {section('personal', <>
        <Row label="Name" value={composeFullName({ firstName: form.firstName, middleName: form.hasNoMiddleName ? '' : form.middleName, lastName: form.lastName, suffix: form.suffix })} />
        <Row label="Date of birth" value={form.dateOfBirth} />
        <Row label="Mobile" value={form.mobileNumber} />
        <Row label="Address" value={address} />
      </>)}
      {section('id', <>
        <Row label="ID" value={findIdType(form.idType)?.label ?? form.idType} />
        <Row label="Photos" value={docs.filter((d) => d.type === 'ID_FRONT' || d.type === 'ID_BACK').map((d) => `${d.name}: ${d.submitted ? 'received' : 'missing'}`).join(' · ')} />
      </>)}
      {section('idReview', <>
        <Row label="ID number" value={form.idNumber ? masked(form.idNumber) : ''} />
        <Row label="Name on ID" value={form.nameOnId} />
        <Row label="Valid until" value={form.idExpiryDate || 'No expiry date'} />
      </>)}
      {section('selfie', <>
        <Row label="Selfie" value={docs.some((d) => d.type === 'SELFIE' && d.submitted) ? 'Received' : 'Missing'} />
        <Row label="Comparison" value={face ? (face.isMatch ? 'Matches your ID photo' : 'A branch officer will compare') : 'Not done'} />
      </>)}
      {section('more', <>
        <Row label="Work" value={form.employmentStatus} />
        <Row label="Monthly income" value={form.monthlyIncome ? `₱${form.monthlyIncome}` : ''} />
        {docs
          .filter((d) => !['ID_FRONT', 'ID_BACK', 'SELFIE'].includes(d.type))
          .map((d) => (
            <Row key={d.type} label={d.name} value={d.submitted ? 'Received' : 'Missing'} />
          ))}
      </>)}

      <Group title="Declarations">
        <div className="space-y-3">
          <CheckField checked={form.truthfulInformation} error={errors.truthfulInformation} onChange={(v) => update({ truthfulInformation: v })}>
            The information I gave is true, correct and complete.
          </CheckField>
          <CheckField checked={form.documentOwnership} error={errors.documentOwnership} onChange={(v) => update({ documentOwnership: v })}>
            The ID and documents I uploaded are mine and genuine.
          </CheckField>
          <CheckField checked={form.authorizedReview} onChange={(v) => update({ authorizedReview: v })}>
            I allow HOSCOMCO branch staff to review and verify my information and documents.
          </CheckField>
          <CheckField checked={form.privacyNotice} error={errors.privacyNotice} onChange={(v) => update({ privacyNotice: v })}>
            I have read the Data Privacy Notice and agree to the processing of my personal information under the Data Privacy Act of 2012 (RA 10173), including keeping
            my records for as long as the law requires.
          </CheckField>
          <CheckField checked={form.penaltyAcknowledgment} onChange={(v) => update({ penaltyAcknowledgment: v })}>
            I understand that false information or documents may lead to rejection of my application and other action under the law.
          </CheckField>
        </div>
      </Group>
    </div>
  );
};
