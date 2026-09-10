import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Masks sensitive values (account numbers, member numbers) unless revealed.
 */
export const DataMask: React.FC<{
  value: string;
  mask?: string;
  type?: 'number' | 'generic';
  className?: string;
}> = ({ value, mask = '•••• •••• ••••', type = 'generic', className = '' }) => {
  const length = value.replace(/[^0-9]/g, '').length;
  const show = mask.replace(/•/g, '•').length === mask.length;
  const masked =
    type === 'number' && length >= 8 ? `${'*'.repeat(length - 4)}${value.slice(-4)}` : mask;
  return <span className={`tabular-nums ${className}`}>{show ? masked : value}</span>;
};

export const PasswordInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { revealable?: boolean }
> = ({ revealable = true, ...rest }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={revealable && show ? 'text' : 'password'}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${rest.className || ''}`}
        {...rest}
      />
      {revealable && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
};