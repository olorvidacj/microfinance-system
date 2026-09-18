import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'brand' | 'brandOutline' | 'navy' | 'gold';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-gold-400 text-navy-950 font-semibold hover:bg-gold-300 focus-visible:ring-gold-500 disabled:bg-gold-200',
  secondary: 'bg-navy-950/5 text-navy-900 hover:bg-navy-950/10 focus-visible:ring-navy-400',
  outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  brand: 'bg-navy-950 text-white hover:bg-navy-900 focus-visible:ring-navy-700 disabled:bg-slate-400',
  brandOutline: 'border border-slate-300 bg-white text-navy-900 hover:bg-slate-50 focus-visible:ring-slate-400',
  navy: 'bg-navy-950 text-white hover:bg-navy-900 focus-visible:ring-navy-800 disabled:bg-slate-500',
  gold: 'bg-gold-400 text-navy-950 hover:bg-gold-300 font-bold focus-visible:ring-gold-400 disabled:bg-gold-200',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...rest
}) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-70 ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    disabled={disabled || loading}
    {...rest}
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {children}
  </button>
);