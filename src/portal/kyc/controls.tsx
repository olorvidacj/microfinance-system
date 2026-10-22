import React, { useId } from 'react';
import { AlertCircle, Info, Lock, CheckCircle2 } from 'lucide-react';

/**
 * Form controls for the KYC steps: large touch targets, a visible label tied
 * to each input, and the error read out next to the field it belongs to.
 */

const control =
  'w-full rounded-xl border bg-white px-3.5 py-3 text-base text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-400/60 disabled:bg-slate-100 disabled:text-slate-500';

export interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
}

function useFieldIds(error?: string | null, hint?: string) {
  const id = useId();
  const described = [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return { id, described };
}

const FieldFrame: React.FC<FieldProps & { id: string; children: React.ReactNode }> = ({ id, label, required, hint, error, className, children }) => (
  <div className={className}>
    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-navy-900">
      {label}
      {required && <span className="text-rose-600"> *</span>}
    </label>
    {children}
    {hint && !error && (
      <p id={`${id}-hint`} className="mt-1 text-sm text-slate-500">
        {hint}
      </p>
    )}
    {error && (
      <p id={`${id}-error`} className="mt-1 text-sm font-medium text-rose-700">
        {error}
      </p>
    )}
  </div>
);

export const TextField: React.FC<FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'>> = ({
  label,
  required,
  hint,
  error,
  className,
  ...input
}) => {
  const { id, described } = useFieldIds(error, hint);
  return (
    <FieldFrame id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={described}
        className={`${control} ${error ? 'border-rose-400' : 'border-slate-300'}`}
        {...input}
      />
    </FieldFrame>
  );
};

export const SelectField: React.FC<
  FieldProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> & { placeholder?: string; options: readonly (string | { value: string; label: string })[] }
> = ({ label, required, hint, error, className, options, placeholder, ...select }) => {
  const { id, described } = useFieldIds(error, hint);
  return (
    <FieldFrame id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <select id={id} aria-invalid={Boolean(error)} aria-describedby={described} className={`${control} ${error ? 'border-rose-400' : 'border-slate-300'}`} {...select}>
        <option value="">{placeholder ?? 'Choose…'}</option>
        {options.map((o) => {
          const v = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          );
        })}
      </select>
    </FieldFrame>
  );
};

export const CheckField: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string | null;
  children: React.ReactNode;
}> = ({ checked, onChange, disabled, error, children }) => {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm text-slate-700 ${error ? 'border-rose-300 bg-rose-50/40' : checked ? 'border-gold-400 bg-gold-200/20' : 'border-slate-200 bg-white'}`}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-navy-950"
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
};

const NOTICE_TONES = {
  info: { box: 'border-sky-200 bg-sky-50 text-sky-900', Icon: Info },
  warn: { box: 'border-amber-200 bg-amber-50 text-amber-900', Icon: AlertCircle },
  error: { box: 'border-rose-200 bg-rose-50 text-rose-800', Icon: AlertCircle },
  ok: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CheckCircle2 },
  locked: { box: 'border-slate-200 bg-slate-50 text-slate-700', Icon: Lock },
} as const;

export const Notice: React.FC<{ tone: keyof typeof NOTICE_TONES; title?: string; children?: React.ReactNode; role?: 'alert' | 'status' }> = ({
  tone,
  title,
  children,
  role,
}) => {
  const { box, Icon } = NOTICE_TONES[tone];
  return (
    <div role={role} className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${box}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
};

/** A titled group of fields inside a step. */
export const Group: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div>
      <h3 className="text-base font-bold text-navy-950">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
    </div>
    {children}
  </section>
);
