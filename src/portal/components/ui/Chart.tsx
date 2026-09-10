import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from 'recharts';

// Re-usable chart cards for the portal. Charts gracefully stretch to fill the
// parent container height — set an explicit height (e.g. h-64) on the wrapper.

export const CHART_COLORS = ['#059669', '#10b981', '#4ade80', '#38bdf8', '#818cf8', '#f59e0b', '#f43f5e'];

export interface ChartDatum {
  name: string;
  value: number;
  color?: string;
}

export const DonutChartCard: React.FC<{
  title: string;
  data: ChartDatum[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
  className?: string;
}> = ({ title, data, centerLabel, centerValue, height = 220, className = '' }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    <div className="relative mt-2" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="85%"
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <ReTooltip formatter={(v: any) => Number(v).toLocaleString()} />
          <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-lg font-bold tabular-nums text-slate-800">{centerValue}</span>}
          {centerLabel && <span className="text-xs text-slate-400">{centerLabel}</span>}
        </div>
      )}
    </div>
  </div>
);

export const BarChartCard: React.FC<{
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  height?: number;
  className?: string;
}> = ({ title, subtitle, data, height = 220, className = '' }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
    <div style={{ height }} className="mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <ReTooltip formatter={(v: any) => Number(v).toLocaleString()} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color || '#10b981'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const AreaChartCard: React.FC<{
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  height?: number;
  className?: string;
}> = ({ title, subtitle, data, height = 220, className = '' }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
    <div style={{ height }} className="mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <ReTooltip formatter={(v: any) => Number(v).toLocaleString()} />
          <Area type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} fill="url(#areaFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);