import React from 'react';
import { CIVIL_STATUSES, GENDERS } from '../../../../shared/kyc-core';
import { AddressPicker } from '../AddressPicker';
import { CheckField, Group, SelectField, TextField } from '../controls';
import { sectionEditable } from '../wizard';
import type { StepProps } from './types';

/** Step 1: name, birth details, contact details and address. */
export const PersonalStep: React.FC<StepProps> = ({ form, update, errors, requested }) => {
  const personalLocked = !sectionEditable('PERSONAL_INFO', requested);
  const addressLocked = !sectionEditable('ADDRESS', requested);

  return (
    <div className="space-y-4">
      <Group title="Your name" description="Exactly as it appears on your government ID.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="First name" required autoComplete="given-name" disabled={personalLocked} value={form.firstName} error={errors.firstName} onChange={(e) => update({ firstName: e.target.value })} />
          <TextField
            label="Middle name"
            required={!form.hasNoMiddleName}
            autoComplete="additional-name"
            disabled={personalLocked || form.hasNoMiddleName}
            value={form.hasNoMiddleName ? '' : form.middleName}
            error={errors.middleName}
            onChange={(e) => update({ middleName: e.target.value })}
          />
          <TextField label="Last name" required autoComplete="family-name" disabled={personalLocked} value={form.lastName} error={errors.lastName} onChange={(e) => update({ lastName: e.target.value })} />
          <TextField label="Suffix" placeholder="Jr., Sr., III" autoComplete="honorific-suffix" disabled={personalLocked} value={form.suffix} onChange={(e) => update({ suffix: e.target.value })} />
        </div>
        <CheckField checked={form.hasNoMiddleName} disabled={personalLocked} onChange={(v) => update({ hasNoMiddleName: v, ...(v ? { middleName: '' } : {}) })}>
          I have no middle name
        </CheckField>
      </Group>

      <Group title="About you">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Date of birth" required type="date" autoComplete="bday" disabled={personalLocked} value={form.dateOfBirth} error={errors.dateOfBirth} onChange={(e) => update({ dateOfBirth: e.target.value })} />
          <TextField label="Place of birth" required placeholder="City or municipality, province" disabled={personalLocked} value={form.placeOfBirth} error={errors.placeOfBirth} onChange={(e) => update({ placeOfBirth: e.target.value })} />
          <SelectField label="Sex" required options={GENDERS} disabled={personalLocked} value={form.gender} error={errors.gender} onChange={(e) => update({ gender: e.target.value })} />
          <SelectField label="Civil status" required options={CIVIL_STATUSES} disabled={personalLocked} value={form.civilStatus} error={errors.civilStatus} onChange={(e) => update({ civilStatus: e.target.value })} />
          <TextField label="Nationality" required disabled={personalLocked} value={form.nationality} error={errors.nationality} onChange={(e) => update({ nationality: e.target.value })} />
        </div>
      </Group>

      <Group title="Contact details">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Mobile number"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0917 123 4567"
            disabled={personalLocked}
            value={form.mobileNumber}
            error={errors.mobileNumber}
            onChange={(e) => update({ mobileNumber: e.target.value })}
          />
          <TextField label="Email" type="email" autoComplete="email" disabled={personalLocked} value={form.email} error={errors.email} onChange={(e) => update({ email: e.target.value })} />
          <TextField label="Other mobile number" type="tel" inputMode="tel" disabled={personalLocked} value={form.alternativeMobile} onChange={(e) => update({ alternativeMobile: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Emergency contact name" disabled={personalLocked} value={form.emergencyContactName} onChange={(e) => update({ emergencyContactName: e.target.value })} />
          <TextField
            label="Relationship to you"
            placeholder="Spouse, parent, sibling…"
            disabled={personalLocked}
            value={form.emergencyContactRelationship}
            onChange={(e) => update({ emergencyContactRelationship: e.target.value })}
          />
        </div>
      </Group>

      <Group title="Current address" description="Where you live now.">
        <AddressPicker prefix="current" form={form} onChange={update} errors={errors} disabled={addressLocked} />
      </Group>

      <Group title="Permanent address">
        <CheckField checked={form.isPermanentSameAsCurrent} disabled={addressLocked} onChange={(v) => update({ isPermanentSameAsCurrent: v })}>
          My permanent address is the same as my current address
        </CheckField>
        {!form.isPermanentSameAsCurrent && <AddressPicker prefix="perm" form={form} onChange={update} errors={errors} disabled={addressLocked} />}
      </Group>
    </div>
  );
};
