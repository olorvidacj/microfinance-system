import React from 'react';
import { findIdType, type Discrepancy } from '../../../../shared/kyc-core';
import type { KycFormState } from '../../../../shared/client';
import { Group, Notice, TextField } from '../controls';
import { liveDiscrepancies, sectionEditable } from '../wizard';
import type { StepProps } from './types';

const SEVERITY_TONE = { HIGH: 'warn', MEDIUM: 'warn' } as const;

const MEMBER_COPY: Readonly<Record<Discrepancy['field'], string>> = {
  fullName: 'The name on your ID looks different from the name in your application.',
  dateOfBirth: 'The birth date on your ID looks different from the one you entered.',
  idNumber: 'The ID number we read is different from the one you entered.',
  expirationDate: 'Your ID seems to have expired.',
};

/** The value read from the ID next to a field, with a button to use it. */
const ReadValue: React.FC<{ read: string | null | undefined; current: string; disabled: boolean; onUse: () => void }> = ({ read, current, disabled, onUse }) => {
  if (!read) return null;
  const same = read.trim().toUpperCase() === current.trim().toUpperCase();
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500">Read from your ID:</span>
      <span className="font-mono font-semibold text-navy-950">{read}</span>
      {!same && !disabled && (
        <button type="button" onClick={onUse} className="rounded-lg bg-gold-200/60 px-2.5 py-1 text-xs font-bold text-navy-950 hover:bg-gold-300">
          Use this
        </button>
      )}
    </div>
  );
};

/**
 * Step 3: the details printed on the ID. What was read automatically is shown
 * next to each field for the member to check; they decide what is entered,
 * and any difference with their application is shown to them and to staff.
 */
export const IdReviewStep: React.FC<StepProps> = ({ form, update, errors, status, requested, locked, today, goTo }) => {
  const scan = status.extractedIdData;
  const readOk = scan?.status === 'COMPLETED' && scan.isReadable !== false;
  const idType = findIdType(form.idType);
  const personalOpen = sectionEditable('PERSONAL_INFO', requested);
  const differences = liveDiscrepancies(form, status, today);
  const front = status.requiredDocuments.find((d) => d.type === 'ID_FRONT' && d.submitted)?.fileUrl ?? null;
  const use = (patch: Partial<KycFormState>) => update(patch);

  return (
    <div className="space-y-4">
      {readOk ? (
        <Notice tone="info" title="Check what we read">
          <p>These details were read automatically and may contain mistakes. Compare each one with your card and correct anything that is wrong.</p>
        </Notice>
      ) : (
        <Notice tone="info" title="Type your ID details">
          <p>Enter the details exactly as they are printed on your ID.</p>
        </Notice>
      )}

      {front && (
        <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <img src={front} alt="The front of your ID" className="mx-auto max-h-56 object-contain" />
          <figcaption className="px-3 py-2 text-xs text-slate-500">Your ID, for comparison</figcaption>
        </figure>
      )}

      <Group title={idType?.label ?? 'Your ID'}>
        <div>
          <TextField
            label="ID number"
            required
            autoComplete="off"
            hint={idType ? `For example ${idType.example}` : undefined}
            disabled={locked}
            value={form.idNumber}
            error={errors.idNumber}
            onChange={(e) => update({ idNumber: e.target.value })}
          />
          <ReadValue read={scan?.idNumber} current={form.idNumber} disabled={locked} onUse={() => use({ idNumber: scan?.idNumber ?? '' })} />
        </div>
        <div>
          <TextField
            label="Name as printed on the ID"
            required
            disabled={locked}
            value={form.nameOnId}
            error={errors.nameOnId}
            onChange={(e) => update({ nameOnId: e.target.value })}
          />
          <ReadValue read={scan?.fullName} current={form.nameOnId} disabled={locked} onUse={() => use({ nameOnId: scan?.fullName ?? '' })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <TextField label="Date issued" type="date" disabled={locked} value={form.idIssueDate} onChange={(e) => update({ idIssueDate: e.target.value })} />
            <ReadValue read={scan?.issueDate} current={form.idIssueDate} disabled={locked} onUse={() => use({ idIssueDate: scan?.issueDate ?? '' })} />
          </div>
          <div>
            <TextField
              label="Valid until"
              type="date"
              hint="Leave empty if the ID has no expiry date."
              disabled={locked}
              value={form.idExpiryDate}
              error={errors.idExpiryDate}
              onChange={(e) => update({ idExpiryDate: e.target.value })}
            />
            <ReadValue read={scan?.expirationDate} current={form.idExpiryDate} disabled={locked} onUse={() => use({ idExpiryDate: scan?.expirationDate ?? '' })} />
          </div>
        </div>
      </Group>

      {differences.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          {differences.map((d) => (
            <Notice key={d.field} tone={SEVERITY_TONE[d.severity]} title={MEMBER_COPY[d.field]}>
              {d.field === 'expirationDate' ? (
                <p>
                  Valid until <strong>{d.extracted}</strong>, as read from the ID. If that is right, use another ID that has not expired.
                </p>
              ) : (
                <p>
                  You entered <strong>{d.declared ?? 'nothing'}</strong>. Read from the ID: <strong>{d.extracted ?? 'not found'}</strong>.
                </p>
              )}
              {d.field === 'dateOfBirth' && d.extracted && (
                personalOpen ? (
                  <button type="button" onClick={() => use({ dateOfBirth: d.extracted ?? '' })} className="font-semibold underline">
                    Change my date of birth to {d.extracted}
                  </button>
                ) : null
              )}
              {d.field === 'fullName' && personalOpen && (
                <button type="button" onClick={() => goTo('personal')} className="font-semibold underline">
                  Edit my name
                </button>
              )}
              {d.field !== 'expirationDate' && <p className="text-xs">If your entry is correct, you can continue. A branch officer will look at the difference.</p>}
            </Notice>
          ))}
        </div>
      )}
    </div>
  );
};
