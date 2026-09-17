import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, ShieldCheck, FileSpreadsheet, CheckCircle2, PiggyBank,
  ArrowLeftRight, Users2, Sparkles, PlusCircle, Download, Eye, ArrowUpRight,
  Landmark, ShieldAlert, BadgePercent, Calendar, TrendingUp
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
    { label: 'Register User', icon: PlusCircle, path: '/admin/users', color: 'text-blue-600 bg-blue-50/80 border-blue-100' },
    { label: 'Verify KYC Queue', icon: ShieldCheck, path: '/admin/kyc', color: 'text-amber-600 bg-amber-50/80 border-amber-100' },
    { label: 'Review Loans', icon: FileSpreadsheet, path: '/admin/loans', color: 'text-emerald-600 bg-emerald-50/80 border-emerald-100' },
    { label: 'Financial Reports', icon: Download, path: '/admin/reports', color: 'text-indigo-600 bg-indigo-50/80 border-indigo-100' },
  ];

  const recentLoans = MOCK_LOANS.slice(0, 5);
  const recentTxns = MOCK_TRANSACTIONS.slice(0, 5);
  const unreadNotifications = MOCK_NOTIFICATIONS.filter((n) => !n.isRead);

  const handleQuickAction = (path: string) => {
    setQuickLoading(true);
    setTimeout(() => {
      setQuickLoading(false);
      window.location.href = path;
    }, 200);
  };

  return (
    <div className="space-y-6">
      {/* Executive Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#091527] via-[#0d1f3b] to-[#132c52] p-6 sm:p-7 text-white shadow-xl border border-[#1b345b]">
        {/* Subtle decorative gold line & glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />
        <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                HOSCOMO Microfinance Cooperative
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-amber-400" /> Tacloban, Leyte
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Executive Management Console
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Monitoring credit operations, KYC verifications, group lending liability, and savings liquidity for HOSCOMO Cooperative.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/admin/reports"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold border border-white/15 transition backdrop-blur shadow-sm"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Export Audit</span>
            </Link>
            <Link
              to="/admin/loans"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 transition"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Credit Desk</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Launch Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {quickActions.map((qa) => (
          <button
            key={qa.label}
            onClick={() => handleQuickAction(qa.path)}
            className="group flex items-center gap-3.5 px-4 py-3.5 bg-white rounded-xl border border-slate-200/80 hover:border-amber-400/50 hover:shadow-md transition-all duration-200 text-left"
          >
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105 shrink-0 ${qa.color}`}>
              <qa.icon className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-amber-800 transition block truncate">
                {qa.label}
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                Manage <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-amber-600 transition" />
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Core Banking KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Registered Users"
          value="48"
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          change={8}
          changeLabel="vs last month"
        />
        <StatCard
          title="Total Active Clients"
          value="995"
          icon={UserCheck}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          change={5.2}
          changeLabel="vs last month"
        />
        <StatCard
          title="Pending KYC Requests"
          value="45"
          icon={ShieldCheck}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          change={-12}
          changeLabel="vs last month"
          accentBorder
        />
        <StatCard
          title="Total Loan Applications"
          value="112"
          icon={FileSpreadsheet}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          change={18}
          changeLabel="vs last month"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Approved Loans"
          value="89"
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          subtitle="79.5% approval rate"
        />
        <StatCard
          title="Total Savings Liquidity"
          value={formatPHP(6700000)}
          icon={PiggyBank}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          change={4.8}
          changeLabel="vs last month"
          accentBorder
        />
        <StatCard
          title="Transactions Recorded"
          value="1,428"
          icon={ArrowLeftRight}
          iconColor="text-cyan-600"
          iconBg="bg-cyan-50"
          change={10.4}
          changeLabel="vs last month"
        />
        <StatCard
          title="Active Lending Groups"
          value="32"
          icon={Users2}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          change={2}
          changeLabel="this quarter"
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Loan trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Loan Origination & Approval Trajectory
              </h3>
              <p className="text-xs text-slate-400">Monthly loan volume across all Tacloban branches</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="gold" dot>79.5% Avg Approval</Badge>
              <Badge variant="success" dot>+12.5% Growth</Badge>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={LOAN_TREND_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradApps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0B192C" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#0B192C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d97706" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={35} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#091527',
                    border: '1px solid #1e3a8a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: '8px' }} />
                <Area type="monotone" dataKey="applications" name="Applications" stroke="#0B192C" strokeWidth={2.5} fill="url(#gradApps)" />
                <Area type="monotone" dataKey="approved" name="Approved" stroke="#d97706" strokeWidth={2.5} fill="url(#gradApproved)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction overview */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Cash Flow Velocity
            </h3>
            <p className="text-xs text-slate-400">Savings deposits vs. loan amortizations (PHP)</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TRANSACTION_CHART_DATA} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  width={42}
                  tickFormatter={(v) => `₱${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(v: any) => [`₱${Number(v).toLocaleString()}`, '']}
                  contentStyle={{
                    backgroundColor: '#091527',
                    border: '1px solid #1e3a8a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: '8px' }} />
                <Bar dataKey="deposits" name="Savings Deposits" fill="#0B192C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="loanPayments" name="Loan Payments" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Metrics & Compliance Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Client registrations */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                New Client Membership Onboarding
              </h3>
              <p className="text-xs text-slate-400">Tacloban Main, Palo, and Ormoc Branches</p>
            </div>
            <Link to="/admin/clients" className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
              Client Registry <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={CLIENT_REGISTRATION_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={30} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#091527',
                    border: '1px solid #1e3a8a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="registrations"
                  name="New Clients"
                  stroke="#d97706"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KYC Verification Stats */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  KYC Compliance Pipeline
                </h3>
                <p className="text-xs text-slate-400">Official Bangko Sentral / CDA KYC audit</p>
              </div>
              <Link to="/admin/kyc" className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
                Queue <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 my-4">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center">
                <span className="text-xl font-bold text-emerald-700">89%</span>
                <p className="text-xs font-semibold text-emerald-800 mt-0.5">Verified</p>
                <p className="text-[10px] text-emerald-600">685 clients</p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100 text-center">
                <span className="text-xl font-bold text-amber-700">6%</span>
                <p className="text-xs font-semibold text-amber-800 mt-0.5">Pending</p>
                <p className="text-[10px] text-amber-600">45 clients</p>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100 text-center">
                <span className="text-xl font-bold text-rose-700">2%</span>
                <p className="text-xs font-semibold text-rose-800 mt-0.5">Rejected</p>
                <p className="text-[10px] text-rose-600">12 clients</p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Under Investigation / Review</span>
              <span className="font-bold text-slate-800">22 files</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Document Correction Required</span>
              <span className="font-bold text-amber-600">8 files</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Queues: Recent Loans & Notifications */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Recent Loan Applications
              </h3>
              <p className="text-xs text-slate-400">Microfinance, SME, and Agricultural loan requests</p>
            </div>
            <Link to="/admin/loans" className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
              View All Loans <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <DataTable
            data={recentLoans}
            keyField="id"
            columns={[
              {
                key: 'loanId',
                header: 'Loan ID',
                render: (l) => <span className="font-mono text-xs font-semibold text-[#0B192C]">{l.loanId}</span>,
              },
              {
                key: 'clientName',
                header: 'Client / Borrower',
                render: (l) => <span className="font-medium text-slate-800">{l.clientName}</span>,
              },
              {
                key: 'loanProduct',
                header: 'Product',
                render: (l) => <span className="text-xs text-slate-600">{l.loanProduct}</span>,
              },
              {
                key: 'loanAmount',
                header: 'Amount',
                render: (l) => <span className="font-bold text-slate-900">{formatPHP(l.loanAmount)}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (l) => <Badge dot>{l.status}</Badge>,
              },
              {
                key: 'view',
                header: 'Action',
                render: () => (
                  <Link
                    to="/admin/loans"
                    className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 hover:border-amber-300 text-slate-600 hover:text-amber-700 transition"
                    title="Open Loan File"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                ),
              },
            ]}
          />
        </div>

        {/* Notifications preview card */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Action Required Alerts
            </h3>
            <Link to="/admin/notifications" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
              Center ({unreadNotifications.length})
            </Link>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {unreadNotifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 hover:bg-amber-50/30 hover:border-amber-200/80 transition"
              >
                <span
                  className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                    n.type === 'KYC'
                      ? 'bg-amber-500'
                      : n.type === 'Loan'
                      ? 'bg-emerald-500'
                      : n.type === 'Transaction'
                      ? 'bg-blue-500'
                      : 'bg-slate-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{n.title}</p>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{n.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions section */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Latest Financial Transactions
            </h3>
            <p className="text-xs text-slate-400">Real-time deposit, withdrawal, and amortization ledger entries</p>
          </div>
          <Link to="/admin/transactions" className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
            All Transactions <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        <DataTable
          data={recentTxns}
          keyField="id"
          columns={[
            {
              key: 'transactionId',
              header: 'Txn ID',
              render: (t) => <span className="font-mono text-xs font-medium text-[#0B192C]">{t.transactionId}</span>,
            },
            {
              key: 'clientName',
              header: 'Member / Client',
              render: (t) => <span className="font-medium text-slate-800">{t.clientName}</span>,
            },
            {
              key: 'type',
              header: 'Transaction Type',
              render: (t) => <Badge>{t.type}</Badge>,
            },
            {
              key: 'amount',
              header: 'Amount',
              render: (t) => <span className="font-bold text-slate-900">{formatPHP(t.amount)}</span>,
            },
            {
              key: 'paymentMethod',
              header: 'Channel',
              render: (t) => <Badge variant="default">{t.paymentMethod}</Badge>,
            },
            {
              key: 'dateTime',
              header: 'Date & Time',
              render: (t) => <span className="text-xs text-slate-500">{t.dateTime}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (t) => <Badge dot>{t.status}</Badge>,
            },
          ]}
        />
      </div>
    </div>
  );
};