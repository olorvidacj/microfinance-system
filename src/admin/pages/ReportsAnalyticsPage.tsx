import React, { useMemo, useState } from 'react';
import {
  BarChart3, Download, FileSpreadsheet, Printer, UserPlus, ShieldCheck, FileText, PiggyBank,
  ArrowLeftRight, Users2, Building2, TrendingUp, Filter as FilterIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { FilterSelect } from '../components/SearchFilter';
import { formatPHP, BRANCH_PERFORMANCE_DATA, KYC_STATUS_DATA } from '../data/mockData';

const REPORT_TYPES = [
  { id: 'client', label: 'Client Registration', icon: UserPlus, desc: 'New client registrations by month and branch.' },
  { id: 'kyc', label: 'KYC Verification', icon: ShieldCheck, desc: 'KYC requests, approval rates, and verification pipeline.' },
  { id: 'loan', label: 'Loan Applications', icon: FileText, desc: 'Loan applications, approvals, disbursements, and portfolio.' },
  { id: 'repayment', label: 'Loan Repayments', icon: TrendingUp, desc: 'Repayment performance, PAR, and collection rates.' },
  { id: 'savings', label: 'Savings', icon: PiggyBank, desc: 'Savings balances, deposits, and interest earned.' },
  { id: 'transactions', label: 'Financial Transactions', icon: ArrowLeftRight, desc: 'Transaction volume by type and channel.' },
  { id: 'groups', label: 'Lending Groups', icon: Users2, desc: 'Group lending performance and repayment rates.' },
  { id: 'branches', label: 'Branch Performance', icon: Building2, desc: 'Comparative performance of all cooperative branches.' },
];

export const ReportsAnalyticsPage: React.FC = () => {
  const [category, setCategory] = useState('client');
  const [fromDate, setFromDate] = useState('2025-04-01');
  const [toDate, setToDate] = useState('2025-09-30');
  const [toast, setToast] = useState('');

  const current = REPORT_TYPES.find((r) => r.id === category) || REPORT_TYPES[0];
  const Icon = current.icon;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData: any = useMemo(() => {
    switch (category) {
      case 'client': return [
        { month: 'Apr', value: 28 }, { month: 'May', value: 35 }, { month: 'Jun', value: 42 },
        { month: 'Jul', value: 38 }, { month: 'Aug', value: 45 }, { month: 'Sep', value: 32 },
      ];
      case 'kyc': return KYC_STATUS_DATA.map((k) => ({ name: k.name, value: k.value, color: k.color }));
      case 'loan': return [
        { month: 'Apr', value: 12 }, { month: 'May', value: 15 }, { month: 'Jun', value: 18 },
        { month: 'Jul', value: 22 }, { month: 'Aug', value: 20 }, { month: 'Sep', value: 25 },
      ];
      case 'repayment': return [
        { month: 'Apr', value: 92 }, { month: 'May', value: 94 }, { month: 'Jun', value: 91 },
        { month: 'Jul', value: 95 }, { month: 'Aug', value: 93 }, { month: 'Sep', value: 96 },
      ];
      case 'savings': return [
        { month: 'Apr', value: 4200000 }, { month: 'May', value: 4600000 }, { month: 'Jun', value: 5100000 },
        { month: 'Jul', value: 5400000 }, { month: 'Aug', value: 6100000 }, { month: 'Sep', value: 6700000 },
      ];
      case 'transactions': return [
        { month: 'Apr', value: 865000 }, { month: 'May', value: 945000 }, { month: 'Jun', value: 1020000 },
        { month: 'Jul', value: 1100000 }, { month: 'Aug', value: 1190000 }, { month: 'Sep', value: 1280000 },
      ];
      case 'groups': return [
        { month: 'Apr', value: 78 }, { month: 'May', value: 81 }, { month: 'Jun', value: 80 },
        { month: 'Jul', value: 85 }, { month: 'Aug', value: 88 }, { month: 'Sep', value: 86 },
      ];
      case 'branches': return BRANCH_PERFORMANCE_DATA.map((b) => ({ name: b.name, value: b.loans / 1000, color: b.name === 'Tacloban Main' ? '#3b82f6' : b.name === 'Palo' ? '#10b981' : '#f59e0b' }));
      default: return [];
    }
  }, [category]);

  const summaryCards = useMemo(() => {
    switch (category) {
      case 'client': return [
        { title: 'New Clients (Period)', value: '220', icon: UserPlus },
        { title: 'Avg. Per Month', value: '37', icon: TrendingUp },
        { title: 'Top Branch', value: 'Tacloban Main', icon: Building2 },
      ];
      case 'kyc': return [
        { title: 'Total Requests', value: '767', icon: ShieldCheck },
        { title: 'Approval Rate', value: '88.6%', icon: TrendingUp },
        { title: 'Avg. Turnaround', value: '2.4 days', icon: BarChart3 },
      ];
      case 'loan': return [
        { title: 'Applications', value: '112', icon: FileText },
        { title: 'Approval Rate', value: '79.5%', icon: TrendingUp },
        { title: 'Portfolio', value: formatPHP(26100000), icon: BarChart3 },
      ];
      case 'repayment': return [
        { title: 'Collection Rate', value: '93.5%', icon: TrendingUp },
        { title: 'PAR > 30 days', value: '4.2%', icon: BarChart3 },
        { title: 'On-time Payments', value: '1,208', icon: FileText },
      ];
      case 'savings': return [
        { title: 'Total Savings', value: formatPHP(6700000), icon: PiggyBank },
        { title: 'Interest Paid', value: '1.0% p.a.', icon: TrendingUp },
        { title: 'Active Accounts', value: '642', icon: PiggyBank },
      ];
      case 'transactions': return [
        { title: 'Total Volume', value: formatPHP(1280000), icon: ArrowLeftRight },
        { title: 'Cash Transactions', value: '68%', icon: BarChart3 },
        { title: 'Digital (GCash)', value: '22%', icon: TrendingUp },
      ];
      case 'groups': return [
        { title: 'Active Groups', value: '32', icon: Users2 },
        { title: 'Avg. Repayment', value: '86%', icon: TrendingUp },
        { title: 'Group Loans', value: formatPHP(1785000), icon: Users2 },
      ];
      case 'branches': return [
        { title: 'Branches', value: '3', icon: Building2 },
        { title: 'Best Portfolio', value: 'Tacloban', icon: TrendingUp },
        { title: 'Network Clients', value: '995', icon: Users2 },
      ];
      default: return [];
    }
  }, [category]);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Reports & Analytics' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="mt-0.5 text-sm text-slate-500">Generate reports and analyze HOSCOMO cooperative performance.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => showToast('PDF export initiated.')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
          </button>
          <button onClick={() => showToast('Excel export initiated.')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm">
            <Download className="w-4 h-4 text-red-500" /> Export PDF
          </button>
          <button onClick={() => showToast('Report sent to printer.')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition shadow-md">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 text-slate-500">
            <FilterIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <FilterSelect
            value={category}
            onChange={setCategory}
            options={REPORT_TYPES.map((r) => ({ value: r.id, label: r.label }))}
            placeholder="Report Category"
            className="w-full md:w-56"
          />
          <div className="flex items-center gap-2 flex-1">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-slate-700 flex-1" />
            <span className="text-slate-400">to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-slate-700 flex-1" />
          </div>
        </div>
      </div>

      {/* Report categories */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.id}
            onClick={() => setCategory(r.id)}
            className={`flex items-start gap-3 p-4 rounded-xl border text-left transition ${
              category === r.id
                ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${category === r.id ? 'bg-white/10' : 'bg-slate-50'}`}>
              <r.icon className={`w-4 h-4 ${category === r.id ? 'text-amber-400' : 'text-slate-400'}`} />
            </span>
            <span>
              <span className={`block text-sm font-semibold ${category === r.id ? 'text-white' : 'text-slate-800'}`}>{r.label}</span>
              <span className={`block text-[11px] mt-0.5 leading-snug ${category === r.id ? 'text-slate-300' : 'text-slate-400'}`}>{r.desc}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Selected report panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
              <Icon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{current.label} Report</h3>
              <p className="text-xs text-slate-400">{current.desc}</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {category === 'kyc' ? (
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {chartData.map((entry, i) => <Cell key={i} fill={(entry as any).color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              ) : category === 'repayment' || category === 'groups' ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} width={44} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => [`${v}%`, 'Rate']} />
                  <Line type="monotone" dataKey="value" name="Rate" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: '#8b5cf6' }} />
                </LineChart>
              ) : category === 'branches' ? (
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `${Math.round(v)}M`} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => [formatPHP(Math.round(v) * 1000), 'Portfolio (in thousands)']} />
                  <Bar dataKey="value" name="Loan Portfolio" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={(entry as any).color} />)}
                  </Bar>
                </BarChart>
              ) : category === 'savings' ? (
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} width={70} tickFormatter={(v) => `${Math.round(v / 1000000)}M`} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any) => [formatPHP(v), 'Total Savings']} />
                  <Area type="monotone" dataKey="value" name="Total Savings" stroke="#f59e0b" strokeWidth={2.5} fill="url(#savGrad)" />
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} width={category === 'transactions' ? 70 : 30} tickFormatter={category === 'transactions' ? (v) => `${Math.round(v / 1000000)}M` : (v) => v} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={category === 'transactions' ? ((v: any) => [formatPHP(v), 'Volume']) : undefined} />
                  <Bar dataKey="value" name={current.label} fill={category === 'loan' ? '#3b82f6' : category === 'repayment' ? '#10b981' : category === 'transactions' ? '#0ea5e9' : '#8b5cf6'} radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          {summaryCards.map((s, i) => {
            const SIcon = s.icon;
            const shades = [
              { bg: 'bg-blue-50', fg: 'text-blue-600' },
              { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
              { bg: 'bg-amber-50', fg: 'text-amber-600' },
            ];
            return (
              <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${shades[i].bg}`}>
                    <SIcon className={`w-5 h-5 ${shades[i].fg}`} />
                  </span>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">{s.title}</p>
                    <p className="text-lg font-bold text-slate-900 leading-tight">{s.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export disclaimer */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <h3 className="font-semibold text-slate-900 mb-1">Report Preview</h3>
        <p className="text-sm text-slate-500 mb-4">
          {current.label} report summary generated for the period {fromDate} to {toDate}.
        </p>
        <DataTablePreview category={category} />
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};

// Simple table preview for the report
const DataTablePreview: React.FC<{ category: string }> = ({ category }) => {
  const rows = React.useMemo(() => {
    const common = [
      { label: 'Jan 2026', value: 'Under preparation' },
      { label: 'Dec 2025', value: 'Under preparation' },
    ];
    switch (category) {
      case 'client':
        return [
          { label: 'Sep 2025', value: '32 registrations' },
          { label: 'Aug 2025', value: '45 registrations' },
          { label: 'Jul 2025', value: '38 registrations' },
          ...common,
        ];
      case 'kyc':
        return [
          { label: 'Approved', value: '680 requests' },
          { label: 'Pending', value: '45 requests' },
          { label: 'Rejected', value: '12 requests' },
          { label: 'Correction', value: '8 requests' },
        ];
      case 'loan':
        return [
          { label: 'Applications', value: '112' },
          { label: 'Approved', value: '89' },
          { label: 'Disbursed', value: '86' },
          { label: 'Rejected', value: '10' },
        ];
      case 'repayment':
        return [
          { label: 'Collection Rate', value: '93.5%' },
          { label: 'PAR 1-30 days', value: '2.1%' },
          { label: 'PAR 31+ days', value: '2.1%' },
        ];
      case 'savings':
        return [
          { label: 'Total Balance', value: formatPHP(6700000) },
          { label: 'Deposits (period)', value: formatPHP(2480000) },
          { label: 'Withdrawals (period)', value: formatPHP(420000) },
        ];
      case 'transactions':
        return [
          { label: 'Total Volume', value: formatPHP(1280000) },
          { label: 'Loan Payments', value: formatPHP(290000) },
          { label: 'Deposits', value: formatPHP(268000) },
        ];
      case 'groups':
        return [
          { label: 'Active Groups', value: '32' },
          { label: 'Total Members', value: '412' },
          { label: 'Avg. Repayment', value: '86%' },
        ];
      case 'branches':
        return [
          { label: 'Tacloban Main', value: formatPHP(12400000) },
          { label: 'Palo', value: formatPHP(8500000) },
          { label: 'Dulag', value: formatPHP(5200000) },
        ];
      default: return [{ label: '—', value: '—' }];
    }
  }, [category]);

  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Metric / Period</th>
            <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-2.5 text-slate-700">{r.label}</td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-800">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};