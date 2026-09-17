import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, ShieldCheck, FileSpreadsheet, CheckCircle2, PiggyBank,
  ArrowLeftRight, Users2, Sparkles, PlusCircle, Download, Eye, ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import {
  LOAN_TREND_DATA, TRANSACTION_CHART_DATA, CLIENT_REGISTRATION_DATA,
  MOCK_LOANS, MOCK_TRANSACTIONS, MOCK_NOTIFICATIONS, formatPHP,
} from '../data/mockData';

export const DashboardPage: React.FC = () => {
  const [quickLoading, setQuickLoading] = useState(false);

  const quickActions = [
    { label: 'New User', icon: PlusCircle, path: '/admin/users', color: 'text-blue-600 bg-blue-50' },
    { label: 'Verify KYC', icon: ShieldCheck, path: '/admin/kyc', color: 'text-amber-600 bg-amber-50' },
    { label: 'Review Loans', icon: FileSpreadsheet, path: '/admin/loans', color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Generate Report', icon: Download, path: '/admin/reports', color: 'text-purple-600 bg-purple-50' },
  ];

  const recentLoans = MOCK_LOANS.slice(0, 5);
  const recentTxns = MOCK_TRANSACTIONS.slice(0, 5);
  const unreadNotifications = MOCK_NOTIFICATIONS.filter((n) => !n.isRead);

  const handleQuickAction = (path: string) => {
    setQuickLoading(true);
    setTimeout(() => {
      setQuickLoading(false);
      window.location.href = path;
    }, 300);
  };

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Welcome back, Elena. Here's what's happening at HOSCOMO today.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition shadow-md">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Quick Actions
          </button>
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {quickActions.map((qa) => (
          <button
            key={qa.label}
            onClick={() => handleQuickAction(qa.path)}
            className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition text-left"
          >
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${qa.color}`}>
              <qa.icon className="w-4 h-4" />
            </span>
            <span className="text-sm font-semibold text-slate-700">{qa.label}</span>
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Registered Users" value="48" icon={Users} iconColor="text-blue-600" iconBg="bg-blue-50" change={8} changeLabel="vs last month" />
        <StatCard title="Total Active Clients" value="995" icon={UserCheck} iconColor="text-emerald-600" iconBg="bg-emerald-50" change={5.2} changeLabel="vs last month" />
        <StatCard title="Pending KYC Requests" value="45" icon={ShieldCheck} iconColor="text-amber-600" iconBg="bg-amber-50" change={-12} changeLabel="vs last month" />
        <StatCard title="Total Loan Applications" value="112" icon={FileSpreadsheet} iconColor="text-indigo-600" iconBg="bg-indigo-50" change={18} changeLabel="vs last month" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Approved Loans" value="89" icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" subtitle="79.5% approval rate" />
        <StatCard title="Total Savings" value={formatPHP(6700000)} icon={PiggyBank} iconColor="text-amber-600" iconBg="bg-amber-50" change={4.8} changeLabel="vs last month" />
        <StatCard title="Financial Transactions" value="1,428" icon={ArrowLeftRight} iconColor="text-cyan-600" iconBg="bg-cyan-50" change={10.4} changeLabel="vs last month" />
        <StatCard title="Active Lending Groups" value="32" icon={Users2} iconColor="text-purple-600" iconBg="bg-purple-50" change={2} changeLabel="this quarter" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Loan trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Loan Application Trend</h3>
              <p className="text-xs text-slate-400">Last 6 months</p>
            </div>
            <Badge variant="success" dot>+12.5%</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={LOAN_TREND_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradApps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} width={32} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="applications" name="Applications" stroke="#3b82f6" strokeWidth={2} fill="url(#gradApps)" />
                <Area type="monotone" dataKey="approved" name="Approved" stroke="#10b981" strokeWidth={2} fill="url(#gradApproved)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction overview */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-900">Transaction Overview</h3>
            <p className="text-xs text-slate-400">Deposits vs Loan Payments</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TRANSACTION_CHART_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="deposits" name="Deposits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="loanPayments" name="Loan Payments" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Second row charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-900">Client Registrations</h3>
            <p className="text-xs text-slate-400">New clients per month</p>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={CLIENT_REGISTRATION_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} width={30} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="registrations" name="Registrations" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: '#8b5cf6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">KYC Verification Stats</h3>
              <p className="text-xs text-slate-400">Overall verification pipeline</p>
            </div>
            <Link to="/admin/kyc" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
              Manage <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full border-[6px] border-emerald-100 flex items-center justify-center">
                <span className="text-lg font-bold text-emerald-600">89%</span>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-600">Verified</p>
              <p className="text-[10px] text-slate-400">685 clients</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full border-[6px] border-amber-100 flex items-center justify-center">
                <span className="text-lg font-bold text-amber-600">6%</span>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-600">Pending</p>
              <p className="text-[10px] text-slate-400">45 clients</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full border-[6px] border-red-100 flex items-center justify-center">
                <span className="text-lg font-bold text-red-500">2%</span>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-600">Rejected</p>
              <p className="text-[10px] text-slate-400">12 clients</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Under Review</span>
              <span className="font-medium text-slate-700">22</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Requires Correction</span>
              <span className="font-medium text-slate-700">8</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent loans table */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Recent Loan Applications</h3>
              <p className="text-xs text-slate-400">Latest applications submitted</p>
            </div>
            <Link to="/admin/loans" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <DataTable
            data={recentLoans}
            keyField="id"
            columns={[
              { key: 'loanId', header: 'Loan ID', render: (l) => <span className="font-mono text-xs text-slate-600">{l.loanId}</span> },
              { key: 'clientName', header: 'Client', render: (l) => <span className="font-medium text-slate-800">{l.clientName}</span> },
              { key: 'loanProduct', header: 'Product', render: (l) => <span className="text-xs text-slate-500">{l.loanProduct}</span> },
              { key: 'loanAmount', header: 'Amount', render: (l) => <span className="font-medium text-slate-800">{formatPHP(l.loanAmount)}</span> },
              { key: 'status', header: 'Status', render: (l) => <Badge>{l.status}</Badge> },
              { key: 'view', header: '', render: () => (
                <Link to="/admin/loans" className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition">
                  <Eye className="w-4 h-4" />
                </Link>
              )},
            ]}
          />
        </div>

        {/* Notifications panel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Recent Notifications</h3>
            <Link to="/admin/notifications" className="text-xs text-blue-600 font-medium hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {unreadNotifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                  n.type === 'KYC' ? 'bg-amber-500' : n.type === 'Loan' ? 'bg-emerald-500' : n.type === 'Transaction' ? 'bg-cyan-500' : 'bg-blue-500'
                }`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{n.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{n.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Recent Financial Transactions</h3>
            <p className="text-xs text-slate-400">Latest recorded transactions</p>
          </div>
          <Link to="/admin/transactions" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
            View All <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <DataTable
          data={recentTxns}
          keyField="id"
          columns={[
            { key: 'transactionId', header: 'Transaction ID', render: (t) => <span className="font-mono text-xs text-slate-600">{t.transactionId}</span> },
            { key: 'clientName', header: 'Client', render: (t) => <span className="font-medium text-slate-800">{t.clientName}</span> },
            { key: 'type', header: 'Type', render: (t) => <Badge>{t.type}</Badge> },
            { key: 'amount', header: 'Amount', render: (t) => <span className="font-medium text-slate-800">{formatPHP(t.amount)}</span> },
            { key: 'paymentMethod', header: 'Method', render: (t) => <span className="text-xs text-slate-500">{t.paymentMethod}</span> },
            { key: 'datetime', header: 'Date & Time', render: (t) => <span className="text-xs text-slate-500">{t.dateTime}</span> },
            { key: 'status', header: 'Status', render: (t) => <Badge>{t.status}</Badge> },
          ]}
        />
      </div>
    </div>
  );
};