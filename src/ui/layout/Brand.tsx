import React from 'react';
import { Building2 } from 'lucide-react';

export interface BrandProps {
  name?: string;
  subtitle?: string;
  tag?: string;
  meta?: string;
  showStatusDot?: boolean;
  collapsed?: boolean;
  className?: string;
  onLogoClick?: () => void;
}

export const Brand: React.FC<BrandProps> = ({
  name = 'HOSCOMO',
  subtitle = 'Microfinance Cooperative',
  tag,
  meta,
  showStatusDot = false,
  collapsed = false,
  className = '',
  onLogoClick,
}) => (
  <div className={`flex items-center gap-3 overflow-hidden ${collapsed ? 'justify-center' : ''} ${className}`}>
    <button
      type="button"
      onClick={onLogoClick}
      className="relative shrink-0"
      aria-label={name}
      tabIndex={onLogoClick ? 0 : -1}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-gold-500 via-gold-400 to-gold-600 text-navy-950 shadow-md shadow-gold-500/20">
        <Building2 className="h-5 w-5" />
      </div>
      {showStatusDot && (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-navy-950 bg-emerald-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        </span>
      )}
    </button>

    {!collapsed && (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold leading-tight tracking-tight text-white">{name}</span>
          {tag && (
            <span className="rounded border border-gold-400/30 bg-gold-400/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-300">
              {tag}
            </span>
          )}
        </div>
        <p className="truncate text-[10px] text-slate-400">{subtitle}</p>
        {meta && <p className="truncate text-[10px] font-medium text-gold-400/90">{meta}</p>}
      </div>
    )}
  </div>
);

export default Brand;
