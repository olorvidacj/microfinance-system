import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  change?: number;
  changeLabel?: string;
  subtitle?: string;
  accentBorder?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-gold-600',
  iconBg = 'bg-gold-500/10',
  change,
  changeLabel,
  subtitle,
  accentBorder = false,
}) => {
  return (
    <div className={`bg-white rounded-xl border p-4 sm:p-5 transition-all duration-200 shadow-sm hover:shadow-md ${
      accentBorder ? 'border-amber-400/40 bg-gradient-to-b from-amber-50/20 to-white' : 'border-slate-200/80'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-[13px] font-medium text-slate-500 truncate tracking-tight">{title}</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">{value}</p>
          
          {subtitle && (
            <p className="mt-1 text-xs text-slate-400 truncate">{subtitle}</p>
          )}

          {change !== undefined && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                change >= 0 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                  : 'bg-rose-50 text-rose-700 border border-rose-200/60'
              }`}>
                {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{change >= 0 ? '+' : ''}{change}%</span>
              </span>
              {changeLabel && <span className="text-slate-400 text-[11px] font-normal">{changeLabel}</span>}
            </div>
          )}
        </div>

        <div className={`flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${iconBg} border border-black/5 flex items-center justify-center transition-transform hover:scale-105`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
};