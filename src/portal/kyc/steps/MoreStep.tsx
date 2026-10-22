import React, { useState } from 'react';
import { EMPLOYMENT_STATUSES, IMAGE_ONLY_KINDS, SOURCES_OF_INCOME, type DocumentKind } from '../../../../shared/kyc-core';
import { ApiError } from '../../services/clientApi';
import { profileService } from '../../services/profile';
import { Group, SelectField, TextField } from '../controls';
import { PhotoSlot } from '../PhotoSlot';
import { IDENTITY_KINDS, sectionEditable } from '../wizard';
import type { StepProps } from './types';

const EMPLOYED = ['Employed', 'Government Employee', 'Private Employee', 'OFW'];
const BUSINESS = ['Self-Employed', 'Business Owner'];

const DOCUMENT_HINTS: Readonly<Record<string, string>> = {
  PROOF_OF_ADDRESS: 'A recent utility bill, barangay certificate or lease in your name.',
  PROOF_OF_INCOME: 'A recent payslip, certificate of employment, ITR or business permit.',
  PHOTO_2X2: 'A recent 2x2 ID photo with a plain background.',
};

/** Step 5: work and income, then any supporting documents the branch requires. */
export const MoreStep: React.FC<StepProps> = ({ form, update, errors, status, requested, refresh }) => {
  const financialLocked = !sectionEditable('FINANCIAL', requested);
  const documentsLocked = !sectionEditable('DOCUMENTS', requested);
  const [busy, setBusy] = useState<string | null>(null);
  const [docError, setDocError] = useState<Record<string, string | null>>({});
  const documents = status.requiredDocuments.filter((d) => !IDENTITY_KINDS.includes(d.type));
  const employed = EMPLOYED.includes(form.employmentStatus);
  const business = BUSINESS.includes(form.employmentStatus);

  const upload = async (kind: string, name: string, dataUrl: string, fileName: string | null) => {
    setBusy(kind);
    setDocError((e) => ({ ...e, [kind]: null }));
    try {
      await profileService.uploadKycDocument({ documentType: kind, documentName: name, fileName: fileName ?? `${kind.toLowerCase()}.jpg`, imageBase64: dataUrl });
      await refresh();
    } catch (err) {
      setDocError((e) => ({ ...e, [kind]: err instanceof ApiError ? err.message : 'The file could not be sent. Check your connection and try again.' }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Group title="Work and income" description="This helps your branch offer loans you can comfortably repay.">
        <SelectField
          label="Employment status"
          required
          options={EMPLOYMENT_STATUSES}
          disabled={financialLocked}
          value={form.employmentStatus}
          error={errors.employmentStatus}
          onChange={(e) => update({ employmentStatus: e.target.value })}
        />
        {form.employmentStatus === 'Other' && (
          <TextField
            label="Tell us about your work"
            required
            disabled={financialLocked}
            value={form.otherStatusExplanation}
            error={errors.otherStatusExplanation}
            onChange={(e) => update({ otherStatusExplanation: e.target.value })}
          />
        )}
        {employed && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Employer" required disabled={financialLocked} value={form.employerName} error={errors.employerName} onChange={(e) => update({ employerName: e.target.value })} />
            <TextField label="Position" disabled={financialLocked} value={form.jobPosition} onChange={(e) => update({ jobPosition: e.target.value })} />
            <TextField
              label="Years with this employer"
              type="number"
              min={0}
              inputMode="numeric"
              disabled={financialLocked}
              value={String(form.yearsOfEmployment || '')}
              onChange={(e) => update({ yearsOfEmployment: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
            <TextField label="Employer address" disabled={financialLocked} value={form.employerAddress} onChange={(e) => update({ employerAddress: e.target.value })} />
          </div>
        )}
        {business && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Business name" required disabled={financialLocked} value={form.businessName} error={errors.businessName} onChange={(e) => update({ businessName: e.target.value })} />
            <TextField label="Kind of business" placeholder="Sari-sari store, tailoring…" disabled={financialLocked} value={form.natureOfBusiness} onChange={(e) => update({ natureOfBusiness: e.target.value })} />
            <TextField
              label="Years in business"
              type="number"
              min={0}
              inputMode="numeric"
              disabled={financialLocked}
              value={String(form.yearsInBusiness || '')}
              onChange={(e) => update({ yearsInBusiness: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
            <TextField label="Business address" disabled={financialLocked} value={form.businessAddress} onChange={(e) => update({ businessAddress: e.target.value })} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Monthly income (₱)"
            required
            inputMode="decimal"
            placeholder="15000"
            disabled={financialLocked}
            value={form.monthlyIncome}
            error={errors.monthlyIncome}
            onChange={(e) => update({ monthlyIncome: e.target.value })}
          />
          <TextField
            label="Monthly expenses (₱)"
            required
            inputMode="decimal"
            placeholder="8000"
            disabled={financialLocked}
            value={form.monthlyExpenses}
            error={errors.monthlyExpenses}
            onChange={(e) => update({ monthlyExpenses: e.target.value })}
          />
        </div>
        <SelectField
          label="Main source of income"
          required
          options={SOURCES_OF_INCOME}
          disabled={financialLocked}
          value={form.sourceOfIncome}
          error={errors.sourceOfIncome}
          onChange={(e) => update({ sourceOfIncome: e.target.value })}
        />
      </Group>

      {documents.length > 0 && (
        <Group title="Supporting documents" description="Photos or PDF files, up to 10 MB each.">
          <div className="space-y-3">
            {documents.map((d) => (
              <PhotoSlot
                key={d.type}
                label={d.name}
                hint={DOCUMENT_HINTS[d.type]}
                target="ID"
                cameraTitle={d.name}
                tips={[]}
                allowCamera={false}
                allowPdf={!IMAGE_ONLY_KINDS.includes(d.type as DocumentKind)}
                value={d.fileUrl}
                fileName={d.fileName}
                disabled={documentsLocked || (busy !== null && busy !== d.type)}
                busy={busy === d.type}
                error={docError[d.type] ?? (d.status === 'REJECTED' ? 'Your branch asked for a new copy of this document.' : null)}
                accepted={d.submitted && d.status !== 'REJECTED'}
                onChange={(dataUrl, fileName) => upload(d.type, d.name, dataUrl, fileName)}
              />
            ))}
          </div>
        </Group>
      )}
    </div>
  );
};
