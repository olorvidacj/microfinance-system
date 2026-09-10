import React from 'react';

export const ProgressBar: React.FC<{
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
  label?: string;
}> = ({ value, max = 100, className = '', barClassName = '', showLabel = false, label }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={className}>
      {showLabel && (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>{label ?? 'Progress'}</span>
          <span className="font-medium tabular-nums text-slate-700">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-emerald-500 transition-all ${barClassName}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};