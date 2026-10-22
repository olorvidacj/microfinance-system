import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, PiggyBank, Printer, ShieldCheck, TrendingUp, UserPlus, Users2, Building2, ArrowLeftRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { adminApi, ReportsData } from '../services/adminApi';
import { formatDisplayDate, formatMoney } from '../../../shared/client/format';
import { useAdminBranch } from '../branchScope';

export type ReportCategory = 'client' | 'kyc' | 'loan' | 'repayment' | 'savings' | 'transactions' | 'groups' | 'branches';

const REPORT_TYPES: { id: ReportCategory; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: 'client', label: 'Members', icon: UserPlus, desc: 'Members who joined, by month.' },
  { id: 'kyc', label: 'KYC', icon: ShieldCheck, desc: 'Verified, awaiting review, and not yet verified.' },
  { id: 'loan', label: 'Loans', icon: FileText, desc: 'Applications, running loans and what is outstanding.' },
  { id: 'repayment', label: 'Repayments', icon: TrendingUp, desc: 'Posted payments by month and loans behind schedule.' },
  { id: 'savings', label: 'Savings', icon: PiggyBank, desc: 'Balances, deposits, withdrawals and interest.' },
  { id: 'transactions', label: 'Money movement', icon: ArrowLeftRight, desc: 'Loan payments and savings deposits and withdrawals by month.' },
  { id: 'groups', label: 'Groups', icon: Users2, desc: 'Solidarity groups and their funds.' },
  { id: 'branches', label: 'Branches', icon: Building2, desc: 'Outstanding loans by branch.' },
];

const MONEY_CHARTS: ReportCategory[] = ['repayment', 'savings', 'transactions', 'branches'];
const pesos = (v: number) => formatMoney(v);
const compact = (v: number) => (Math.abs(v) >= 1_000_000 ? `₱${(v / 1_000_000).toFixed(1)}M` : Math.abs(v) >= 1_000 ? `₱${(v / 1_000).toFixed(0)}k` : `₱${v}`);

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** All figures come from GET /api/admin/reports, computed by src/reports/portfolio.ts (the same as the branch app and the member portal). */
export const ReportsAnalyticsPage: React.FC = () => {
  const { branchId, branchName } = useAdminBranch();
  const [category, setCategory] = useState<ReportCategory>('client');
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setReports(await adminApi.reports(branchId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The reports could not be loaded.');
    }
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const current = REPORT_TYPES.find((r) => r.id === category) ?? REPORT_TYPES[0];
  const Icon = current.icon;
  const chartData = useMemo(() => (reports?.charts[category] ?? []) as Array<{ month?: string; name?: string; value: number; color?: string }>, [reports, category]);
  const summaryCards = useMemo(() => reports?.cards[category] ?? [], [reports, category]);
  const rows = useMemo(() => reports?.tableRows[category] ?? [], [reports, category]);
  const money = MONEY_CHARTS.includes(category);

  const exportCsv = () => {
    if (!reports) return;
    const lines = [
      ['Report', current.label],
      ['Branch', branchName],
      ['As of', reports.portfolio.asOf],
      [],
      ...summaryCards.map((c) => [c.title, c.value]),
      [],
      ...rows.map((r) => [r.label, r.value]),
    ];
    const blob = new Blob(['﻿' + lines.map((l) => l.map((v) => csvCell(String(v))).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HOSCOMCO-${category}-report-${reports.portfolio.asOf}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Reports' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Reports</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {branchName}{reports ? ` · as of ${formatDisplayDate(reports.portfolio.asOf)}` : ''}. The same figures the branch app and the member portal show.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={!reports}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#091527] hover:bg-[#132c52] text-white rounded-xl text-xs font-bold transition shadow-sm border border-slate-800"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" /> Print
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button onClick={load} className="font-bold underline">Try again</button>
        </div>
      )}
      {!reports && !error && <p className="text-sm text-slate-500">Loading reports…</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.id}
            onClick={() => setCategory(r.id)}
            className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-left transition ${
              category === r.id ? 'bg-[#091527] border-[#091527] text-white shadow-md' : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:shadow-xs'
            }`}
          >
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${category === r.id ? 'bg-white/10' : 'bg-slate-100'}`}>
              <r.icon className={`w-4 h-4 ${category === r.id ? 'text-amber-400' : 'text-slate-600'}`} />
            </span>
            <span className="min-w-0">
              <span className={`block text-xs font-bold truncate ${category === r.id ? 'text-white' : 'text-slate-900'}`}>{r.label}</span>
              <span className={`block text-[10px] mt-0.5 line-clamp-1 ${category === r.id ? 'text-slate-300' : 'text-slate-400'}`}>{r.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-[#091527] flex items-center justify-center">
              <Icon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{current.label}</h3>
              <p className="text-[11px] text-slate-400">{current.desc}</p>
            </div>
          </div>

          <div className="h-72">
            {chartData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-400">Nothing to chart yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {category === 'kyc' ? (
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={3}>
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 'bold' }} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: '600' }} />
                  </PieChart>
                ) : category === 'branches' ? (
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={compact} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#091527', fontWeight: 600 }} width={110} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 11 }} formatter={(v: number) => [pesos(v), 'Outstanding']} />
                    <Bar dataKey="value" name="Outstanding" radius={[0, 6, 6, 0]}>
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                ) : category === 'savings' ? (
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d97706" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={60} tickFormatter={compact} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 11 }} formatter={(v: number) => [pesos(v), 'Deposits']} />
                    <Area type="monotone" dataKey="value" name="Deposits" stroke="#d97706" strokeWidth={2.5} fill="url(#savGrad)" />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={money ? 65 : 35} tickFormatter={money ? compact : undefined} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 11 }} formatter={money ? (v: number) => [pesos(v), current.label] : undefined} />
                    <Bar dataKey="value" name={current.label} fill="#091527" radius={[6, 6, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 justify-between">
          {summaryCards.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-200/80">
                  <Icon className="w-5 h-5 text-amber-600" />
                </span>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.title}</p>
                  <p className={`text-xl font-black mt-0.5 tracking-tight ${s.highlight}`}>{s.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Breakdown</h3>
            <p className="text-[11px] text-slate-500">{current.label}, {branchId ? branchName : 'all branches'}.</p>
          </div>
          {reports &&
            (reports.ledger.balanced ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={`Debits ${formatMoney(reports.ledger.debits)} = credits ${formatMoney(reports.ledger.credits)}`}>
                <CheckCircle2 className="w-3 h-3" /> Ledger balanced{branchId ? ' (whole cooperative)' : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-3 h-3" /> Ledger out of balance by {formatMoney(reports.ledger.difference)}{branchId ? ' (whole cooperative)' : ''}
              </span>
            ))}
        </div>
        <div className="rounded-xl border border-slate-200/80 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Measure</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-slate-400">Nothing recorded yet.</td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.label}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">{r.value}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
