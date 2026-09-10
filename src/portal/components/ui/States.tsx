import React from 'react';
import { Loader2, RotateCw } from 'lucide-react';
import { Button } from './Button';

export const Spinner: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <Loader2 className={`animate-spin text-emerald-600 ${className}`} />
);

export const LoadingState: React.FC<{ label?: string; className?: string }> = ({
  label = 'Loading…',
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center gap-3 py-16 text-slate-500 ${className}`}>
    <Spinner className="h-8 w-8" />
    <p className="text-sm">{label}</p>
  </div>
);

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-2 py-14 text-center ${className}`}>
    {icon && <div className="mb-1 rounded-full bg-slate-100 p-3 text-slate-400">{icon}</div>}
    <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
    {description && <p className="max-w-sm text-xs text-slate-500">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}> = ({ title = 'Something went wrong', message = 'Unable to load this data. Please try again.', onRetry, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-2 py-14 text-center ${className}`}>
    <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
    <p className="max-w-sm text-xs text-slate-500">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
        <RotateCw className="h-3.5 w-3.5" /> Retry
      </Button>
    )}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
);