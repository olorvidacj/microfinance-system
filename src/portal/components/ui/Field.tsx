import React from 'react';

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className = '', children, ...rest }) => (
  <label className={`mb-1 block text-xs font-medium text-slate-600 ${className}`} {...rest}>
    {children}
  </label>
);

const inputBase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500';

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...rest }) => (
  <input className={`${inputBase} ${className}`} {...rest} />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...rest }) => (
  <textarea className={`${inputBase} ${className}`} {...rest} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...rest }) => (
  <select className={`${inputBase} ${className}`} {...rest}>
    {children}
  </select>
);

export const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, error, children }) => (
  <div>
    <Label>
      {label} {required && <span className="text-rose-500">*</span>}
    </Label>
    {children}
    {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
  </div>
);

export const FormSection: React.FC<{ title?: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <div className="space-y-4 p-5">
    {(title || description) && (
      <div>
        {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
    )}
    {children}
  </div>
);