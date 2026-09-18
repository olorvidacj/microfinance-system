import React, { useEffect, useMemo, useState } from 'react';
import {
  Download, FileSpreadsheet, Printer, UserPlus, ShieldCheck, FileText, PiggyBank,
  ArrowLeftRight, Users2, Building2, TrendingUp, Filter as FilterIcon, CheckCircle2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { FilterSelect } from '../components/SearchFilter';
import { adminApi, ReportsData } from '../services/adminApi';

const REPORT_TYPES = [
  { id: 'client', label: 'Client Registration', icon: UserPlus, desc: 'New member acquisitions by month and branch.' },
  { id: 'kyc', label: 'KYC Compliance Pipeline', icon: ShieldCheck, desc: 'Dossier reviews, approval velocity, and pass rates.' },
  { id: 'loan', label: 'Loan Originations', icon: FileText, desc: 'Credit facilities, approvals, releases, and commitments.' },
  { id: 'repayment', label: 'Repayment & PAR Analytics', icon: TrendingUp, desc: 'Collection efficiency, PAR > 30, and delinquency.' },
  { id: 'savings', label: 'Savings & Capital Equity', icon: PiggyBank, desc: 'Member deposits, mandatory CBU, and dividend yield.' },
  { id: 'transactions', label: 'Cash & Digital Ledger', icon: ArrowLeftRight, desc: 'Volume breakdown by channel (Cash, GCash, Maya).' },
  { id: 'groups', label: 'Group Lending Cells', icon: Users2, desc: 'Solidarity cell health and peer repayment monitoring.' },
  { id: 'branches', label: 'Branch Territorial Benchmark', icon: Building2, desc: 'Comparative performance of Leyte branch stations.' },
];

export const ReportsAnalyticsPage: React.FC = () => {
  const [category, setCategory] = useState('client');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [toast, setToast] = useState('');
  const [reports, setReports] = useState<ReportsData | null>(null);

  useEffect(() => {
    adminApi.reports().then(setReports).catch(() => setReports(null));
  }, []);

  useEffect(() => {
    if (reports?.charts.client?.length) {
      const first = reports.charts.client[0]?.month;
      const last = reports.charts.client[reports.charts.client.length - 1]?.month;
      if (first) setFromDate((prev) => prev || first);
      if (last) setToDate((prev) => prev || last);
    }
  }, [reports]);

  const current = REPORT_TYPES.find((r) => r.id === category) || REPORT_TYPES[0];
  const Icon = current.icon;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const chartData: any = useMemo(() => reports?.charts[category] || [], [reports, category]);

  const summaryCards = useMemo(() => reports?.cards[category] || [], [reports, category]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Audit, Regulatory & Financial Analytics' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Reports & Regulatory Analytics</h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              CDA & BSP Compliant
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Generate microfinance performance statements, portfolio-at-risk audits, and branch financial benchmarks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => showToast('Excel ledger export generated.')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
          </button>
          <button
            onClick={() => showToast('Official audit PDF statement generated.')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-rose-600" /> Export PDF
          </button>
          <button
            onClick={() => showToast('Report forwarded to regional print spooler.')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#091527] hover:bg-[#132c52] text-white rounded-xl text-xs font-bold transition shadow-sm border border-slate-800"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" /> Print Report
          </button>
        </div>
      </div>

      {/* Filter and Date Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 text-slate-700">
            <FilterIcon className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Report Scope</span>
          </div>
          <FilterSelect
            value={category}
            onChange={setCategory}
            options={REPORT_TYPES.map((r) => ({ value: r.id, label: r.label }))}
            placeholder="Report Category"
            className="w-full md:w-64"
          />
          <div className="flex items-center gap-2 flex-1">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition text-slate-700 flex-1"
            />
            <span className="text-xs font-bold text-slate-400">TO</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition text-slate-700 flex-1"
            />
          </div>
        </div>
      </div>

      {/* Report category tabs grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.id}
            onClick={() => setCategory(r.id)}
            className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-left transition ${
              category === r.id
                ? 'bg-[#091527] border-[#091527] text-white shadow-md'
                : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:shadow-xs'
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

      {/* Selected report graphical visualization + summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#091527] flex items-center justify-center">
                <Icon className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{current.label} Visual Trajectory</h3>
                <p className="text-[11px] text-slate-400">{current.desc}</p>
              </div>
            </div>
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Quarterly Trend
            </span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {category === 'kyc' ? (
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={3}>
                    {chartData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 'bold' }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: '600' }} />
                </PieChart>
              ) : category === 'branches' ? (
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${Math.round(v)}M`} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#091527', fontWeight: 600 }} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 11 }} formatter={(v: any) => [`₱${(Math.round(v) * 1000).toLocaleString()}`, 'Branch Portfolio']} />
                  <Bar dataKey="value" name="Loan Portfolio" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
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
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={60} tickFormatter={(v) => `${Math.round(v / 1000000)}M`} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 11 }} formatter={(v: any) => [`₱${Number(v).toLocaleString()}`, 'Total Savings Book']} />
                  <Area type="monotone" dataKey="value" name="Savings Balance" stroke="#d97706" strokeWidth={2.5} fill="url(#savGrad)" />
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={category === 'transactions' || category === 'repayment' ? 65 : 35} tickFormatter={category === 'transactions' || category === 'repayment' ? (v) => `${Math.round(v / 1000000)}M` : (v) => v} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 11 }} formatter={category === 'transactions' || category === 'repayment' ? ((v: any) => [`₱${Number(v).toLocaleString()}`, 'Ledger Flux']) : undefined} />
                  <Bar dataKey="value" name={current.label} fill="#091527" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3 Executive Summary metric cards */}
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

      {/* Table Preview */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Structured Audit Breakdown</h3>
            <p className="text-[11px] text-slate-500">
              Consolidated breakdown for {current.label} ({fromDate} to {toDate}).
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Reconciled
          </span>
        </div>
        <DataTablePreview rows={reports?.tableRows[category] || []} />
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#091527] border border-amber-500/40 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {toast}
        </div>
      )}
    </div>
  );
};

// Simple table preview for the report
const DataTablePreview: React.FC<{ rows: { label: string; value: string }[] }> = ({ rows }) => {
  const tableRows = React.useMemo(() => (rows && rows.length ? rows : [{ label: '—', value: '—' }]), [rows]);

  return (
    <div className="rounded-xl border border-slate-200/80 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200/80">
            <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Metric / Accounting Classification</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Reconciled Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {tableRows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50/60 transition">
              <td className="px-4 py-2.5 font-medium text-slate-800">{r.label}</td>
              <td className="px-4 py-2.5 text-right font-bold text-slate-900">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
