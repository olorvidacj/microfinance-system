import React from 'react';

export const Tabs: React.FC<{
  tabs: { id: string; label: string; badge?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}> = ({ tabs, active, onChange, className = '' }) => (
  <div className={`flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 ${className}`}>
    {tabs.map((t) => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
          active === t.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        {t.label}
        {typeof t.badge === 'number' && t.badge > 0 && (
          <span
            className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
              active === t.id ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {t.badge}
          </span>
        )}
      </button>
    ))}
  </div>
);