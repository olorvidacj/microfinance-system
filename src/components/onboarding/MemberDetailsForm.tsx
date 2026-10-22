import React, { useEffect, useState } from 'react';
import {
  CIVIL_STATUSES,
  EMPLOYMENT_STATUSES,
  GENDERS,
  ID_TYPES,
  SOURCES_OF_INCOME,
  type RegistrationChannel,
  type RegistrationInput,
} from '../../../shared/kyc-core';

/**
 * Member details collected at registration, used by both the portal
 * (self-registration) and the branch (staff-assisted). Validation is
 * shared/kyc-core's validateRegistration on both sides; this component only
 * renders the fields and the errors it is given.
 */

interface Option {
  code: string;
  name: string;
}

async function geo(path: string): Promise<Option[]> {
  const res = await fetch(`/api/geography/${path}`);
  if (!res.ok) throw new Error('Could not load address options.');
  const json = await res.json();
  return (json?.data || []).map((x: any) => ({ code: String(x.code), name: String(x.name) }));
}

async function postal(cityCode: string, barangayCode?: string): Promise<string> {
  const params = new URLSearchParams({ cityCode });
  if (barangayCode) params.set('barangayCode', barangayCode);
  const res = await fetch(`/api/geography/postal-code?${params}`);
  if (!res.ok) return '';
  return (await res.json())?.postalCode || '';
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500';

const FieldBox: React.FC<{ label: string; required?: boolean; error?: string; hint?: string; htmlFor?: string; children: React.ReactNode; wide?: boolean }> = ({
  label,
  required,
  error,
  hint,
  htmlFor,
  children,
  wide,
}) => (
  <div className={wide ? 'sm:col-span-2' : undefined}>
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-600">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
    {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
  </div>
);

export interface MemberDetailsFormProps {
  value: RegistrationInput;
  onChange: (next: RegistrationInput) => void;
  errors: Record<string, string>;
  channel: RegistrationChannel;
  /** Hide the email field (self-registration shows the verified email separately). */
  hideEmail?: boolean;
  idPrefix?: string;
}

export const MemberDetailsForm: React.FC<MemberDetailsFormProps> = ({ value, onChange, errors, channel, hideEmail, idPrefix = 'member' }) => {
  const set = <K extends keyof RegistrationInput>(key: K, v: RegistrationInput[K]) => onChange({ ...value, [key]: v });
  const address = value.address ?? {};
  const setAddress = (patch: Partial<NonNullable<RegistrationInput['address']>>) => onChange({ ...value, address: { ...address, ...patch } });

  const [regions, setRegions] = useState<Option[]>([]);
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [barangays, setBarangays] = useState<Option[]>([]);
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    geo('regions').then(setRegions).catch((e) => setGeoError(e.message));
  }, []);

  useEffect(() => {
    setProvinces([]);
    setCities([]);
    if (!address.regionCode) return;
    geo(`provinces?regionCode=${address.regionCode}`).then(setProvinces).catch((e) => setGeoError(e.message));
    geo(`cities?regionCode=${address.regionCode}`).then(setCities).catch((e) => setGeoError(e.message));
  }, [address.regionCode]);

  useEffect(() => {
    if (!address.regionCode || !address.provinceCode) return;
    geo(`cities?regionCode=${address.regionCode}&provinceCode=${address.provinceCode}`).then(setCities).catch((e) => setGeoError(e.message));
  }, [address.regionCode, address.provinceCode]);

  useEffect(() => {
    setBarangays([]);
    if (!address.cityCode) return;
    geo(`barangays?cityCode=${address.cityCode}`).then(setBarangays).catch((e) => setGeoError(e.message));
  }, [address.cityCode]);

  const id = (name: string) => `${idPrefix}-${name}`;
  const err = (k: string) => errors[k];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="sm:col-span-2 text-sm font-semibold text-slate-800">Name and personal details</h3>
        <FieldBox label="First name" required error={err('firstName')} htmlFor={id('first')}>
          <input id={id('first')} className={inputCls} autoComplete="given-name" value={value.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} />
        </FieldBox>
        <FieldBox label="Middle name" required={!value.hasNoMiddleName} error={err('middleName')} htmlFor={id('middle')}>
          <input
            id={id('middle')}
            className={inputCls}
            autoComplete="additional-name"
            disabled={value.hasNoMiddleName}
            value={value.hasNoMiddleName ? '' : value.middleName ?? ''}
            onChange={(e) => set('middleName', e.target.value)}
          />
          <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={Boolean(value.hasNoMiddleName)} onChange={(e) => onChange({ ...value, hasNoMiddleName: e.target.checked, middleName: '' })} />
            No middle name
          </label>
        </FieldBox>
        <FieldBox label="Last name" required error={err('lastName')} htmlFor={id('last')}>
          <input id={id('last')} className={inputCls} autoComplete="family-name" value={value.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} />
        </FieldBox>
        <FieldBox label="Suffix" error={err('suffix')} htmlFor={id('suffix')}>
          <select id={id('suffix')} className={inputCls} value={value.suffix ?? ''} onChange={(e) => set('suffix', e.target.value)}>
            {['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'].map((s) => (
              <option key={s} value={s}>
                {s || 'None'}
              </option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="Date of birth" required error={err('dateOfBirth')} htmlFor={id('dob')}>
          <input id={id('dob')} type="date" className={inputCls} value={value.dateOfBirth ?? ''} onChange={(e) => set('dateOfBirth', e.target.value)} />
        </FieldBox>
        <FieldBox label="Sex" required error={err('gender')} htmlFor={id('sex')}>
          <select id={id('sex')} className={inputCls} value={value.gender ?? ''} onChange={(e) => set('gender', e.target.value)}>
            <option value="">Choose…</option>
            {GENDERS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="Civil status" required error={err('civilStatus')} htmlFor={id('civil')}>
          <select id={id('civil')} className={inputCls} value={value.civilStatus ?? ''} onChange={(e) => set('civilStatus', e.target.value)}>
            <option value="">Choose…</option>
            {CIVIL_STATUSES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="Mobile number" required error={err('phone')} hint="e.g. 0917 123 4567" htmlFor={id('phone')}>
          <input id={id('phone')} type="tel" inputMode="tel" autoComplete="tel" className={inputCls} value={value.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </FieldBox>
        {!hideEmail && (
          <FieldBox
            label="Email"
            required={channel === 'SELF'}
            error={err('email')}
            hint={channel === 'BRANCH' ? 'Optional. The member uses this email to activate portal access later.' : undefined}
            htmlFor={id('email')}
            wide
          >
            <input id={id('email')} type="email" autoComplete="email" className={inputCls} value={value.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </FieldBox>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="sm:col-span-2 text-sm font-semibold text-slate-800">Home address</h3>
        {geoError && <p className="sm:col-span-2 text-xs text-rose-600">{geoError}</p>}
        <FieldBox label="Region" required error={err('address.regionCode')} htmlFor={id('region')}>
          <select
            id={id('region')}
            className={inputCls}
            value={address.regionCode ?? ''}
            onChange={(e) => setAddress({ regionCode: e.target.value, provinceCode: null, cityCode: '', barangayCode: '', postalCode: '' })}
          >
            <option value="">Choose a region…</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="Province" error={err('address.provinceCode')} hint={provinces.length ? undefined : 'Not needed for cities outside a province (e.g. NCR).'} htmlFor={id('province')}>
          <select
            id={id('province')}
            className={inputCls}
            disabled={!provinces.length}
            value={address.provinceCode ?? ''}
            onChange={(e) => setAddress({ provinceCode: e.target.value || null, cityCode: '', barangayCode: '', postalCode: '' })}
          >
            <option value="">{provinces.length ? 'Choose a province…' : '—'}</option>
            {provinces.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="City / municipality" required error={err('address.cityCode')} htmlFor={id('city')}>
          <select
            id={id('city')}
            className={inputCls}
            disabled={!cities.length}
            value={address.cityCode ?? ''}
            onChange={async (e) => {
              const cityCode = e.target.value;
              setAddress({ cityCode, barangayCode: '', postalCode: cityCode ? await postal(cityCode) : '' });
            }}
          >
            <option value="">Choose…</option>
            {cities.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="Barangay" required error={err('address.barangayCode')} htmlFor={id('barangay')}>
          <select
            id={id('barangay')}
            className={inputCls}
            disabled={!barangays.length}
            value={address.barangayCode ?? ''}
            onChange={async (e) => {
              const barangayCode = e.target.value;
              const zip = barangayCode && address.cityCode ? await postal(address.cityCode, barangayCode) : '';
              setAddress({ barangayCode, ...(zip ? { postalCode: zip } : {}) });
            }}
          >
            <option value="">Choose…</option>
            {barangays.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="House no. and street" required error={err('address.street')} htmlFor={id('street')}>
          <input id={id('street')} className={inputCls} autoComplete="address-line1" value={address.street ?? ''} onChange={(e) => setAddress({ street: e.target.value })} />
        </FieldBox>
        <FieldBox label="ZIP code" required error={err('address.postalCode')} htmlFor={id('zip')}>
          <input id={id('zip')} inputMode="numeric" maxLength={4} className={inputCls} value={address.postalCode ?? ''} onChange={(e) => setAddress({ postalCode: e.target.value })} />
        </FieldBox>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="sm:col-span-2 text-sm font-semibold text-slate-800">Work and income</h3>
        <FieldBox label="Employment status" required error={err('employmentStatus')} htmlFor={id('employment')}>
          <select id={id('employment')} className={inputCls} value={value.employmentStatus ?? ''} onChange={(e) => set('employmentStatus', e.target.value)}>
            <option value="">Choose…</option>
            {EMPLOYMENT_STATUSES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="Source of income" required error={err('sourceOfIncome')} htmlFor={id('source')}>
          <select id={id('source')} className={inputCls} value={value.sourceOfIncome ?? ''} onChange={(e) => set('sourceOfIncome', e.target.value)}>
            <option value="">Choose…</option>
            {SOURCES_OF_INCOME.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="Occupation" error={err('occupation')} htmlFor={id('occupation')}>
          <input id={id('occupation')} className={inputCls} value={value.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} />
        </FieldBox>
        <FieldBox label="Employer or business name" error={err('employerOrBusiness')} htmlFor={id('employer')}>
          <input id={id('employer')} className={inputCls} value={value.employerOrBusiness ?? ''} onChange={(e) => set('employerOrBusiness', e.target.value)} />
        </FieldBox>
        <FieldBox label="Monthly income (PHP)" required error={err('monthlyIncome')} htmlFor={id('income')}>
          <input id={id('income')} inputMode="decimal" className={inputCls} value={String(value.monthlyIncome ?? '')} onChange={(e) => set('monthlyIncome', e.target.value)} />
        </FieldBox>
        <FieldBox label="Monthly expenses (PHP)" required error={err('monthlyExpenses')} htmlFor={id('expenses')}>
          <input id={id('expenses')} inputMode="decimal" className={inputCls} value={String(value.monthlyExpenses ?? '')} onChange={(e) => set('monthlyExpenses', e.target.value)} />
        </FieldBox>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="sm:col-span-2 text-sm font-semibold text-slate-800">
          Government ID {channel === 'SELF' && <span className="font-normal text-slate-400">(optional now; required for KYC)</span>}
        </h3>
        <FieldBox label="ID type" required={channel === 'BRANCH'} error={err('idType')} htmlFor={id('idtype')}>
          <select id={id('idtype')} className={inputCls} value={value.idType ?? ''} onChange={(e) => set('idType', e.target.value)}>
            <option value="">Choose…</option>
            {ID_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </FieldBox>
        <FieldBox
          label="ID number"
          required={channel === 'BRANCH'}
          error={err('idNumber')}
          hint={ID_TYPES.find((t) => t.code === value.idType)?.example ? `e.g. ${ID_TYPES.find((t) => t.code === value.idType)!.example}` : undefined}
          htmlFor={id('idnumber')}
        >
          <input id={id('idnumber')} className={inputCls} value={value.idNumber ?? ''} onChange={(e) => set('idNumber', e.target.value)} />
        </FieldBox>
      </section>
    </div>
  );
};

export default MemberDetailsForm;
