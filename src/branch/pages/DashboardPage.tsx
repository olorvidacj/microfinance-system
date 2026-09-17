import React, { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  FileCheck2,
  FileText,
  HandCoins,
  Layers,
  PiggyBank,
  Plus,
  ReceiptText,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { Amount } from '../../portal/components/ui/Amount';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchContext } from '../context/BranchContext';
import {
  dashboardService,
  clientsService,
  kycService,
  loansService,
  transactionsService,
  groupsService,
  notificationsService,
} from '../services';
import { QuickActions } from '../components/QuickActions';
import { KycReviewPanel } from '../components/KycReviewPanel';
import { formatCurrency } from '../../utils/loanMath';
import { ClientDetail } from '../types';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

// Trend mock data for Recharts
const TREND_DATA = [
  { month: 'Jan', applications: 24, approved: 19, collections: 210000 },
  { month: 'Feb', applications: 28, approved: 22, collections: 245000 },
  { month: 'Mar', applications: 35, approved: 29, collections: 320000 },
  { month: 'Apr', applications: 31, approved: 26, collections: 290000 },
  { month: 'May', applications: 42, approved: 36, collections: 380000 },
  { month: 'Jun', applications: 48, approved: 41, collections: 450000 },
  { month: 'Jul', applications: 52, approved: 45, collections: 490000 },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { personnel, ctx } = useBranchContext();
  const [kycReviewTarget, setKycReviewTarget] = useState<ClientDetail | null>(null);

  // Core dashboard summary
  const fetcher = useCallback(() => dashboardService.get(), []);
  const { data, loading, error, reload } = useBranchData(fetcher);

  // Operational feeds for dashboard lists
  const activitiesFetcher = useCallback(() => dashboardService.activities(8), []);
  const activities = useBranchData(activitiesFetcher);

  const clientsFetcher = useCallback(() => clientsService.list(), []);
  const recentClients = useBranchData(clientsFetcher);

  const kycFetcher = useCallback(() => kycService.queue(), []);
  const kycQueue = useBranchData(kycFetcher);

  const loansFetcher = useCallback(() => loansService.applications(), []);
  const loanApps = useBranchData(loansFetcher);

  const txnsFetcher = useCallback(() => transactionsService.list(), []);
  const recentTxns = useBranchData(txnsFetcher);

  const groupsFetcher = useCallback(() => groupsService.list(), []);
  const groupsData = useBranchData(groupsFetcher);

  const notifsFetcher = useCallback(() => notificationsService.list(), []);
  const notifsData = useBranchData(notifsFetcher);

  if (loading) return <LoadingState label="Loading HOSCOMO operations dashboard…" />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  const s = data.summary;
  const totalGroupsCount = groupsData.data?.length ?? 6;
  const pendingKycCount = kycQueue.data?.length ?? s.pendingVerification;

  // Daily target calculation
  const dailyTarget = 150000;
  const collectedToday = s.todayCollections || 0;
  const collectionPercent = Math.min(100, Math.round((collectedToday / dailyTarget) * 100));

  return (
    <div className="space-y-6">
      {/* SECTION 1 & 2: Welcome Banner with Date, Time, Staff Role & Branch Info */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#091527] p-6 text-white shadow-xl">
        {/* Subtle background glow & texture */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
                HOSCOMO Microfinance
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Shift Active · Online
              </span>
            </div>

            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {greeting()},{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                {personnel?.name || 'Staff Officer'}
              </span>
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-slate-300">
              <span className="flex items-center gap-1 font-medium text-slate-200">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                {personnel?.title || personnel?.role || 'Senior Loan Officer'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Building2 className="h-4 w-4 text-slate-400" />
                {ctx?.branch?.name || 'Tacloban Main Branch (LB-MAIN)'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Calendar className="h-4 w-4 text-slate-400" />
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => reload()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Data
            </button>
            <Link
              to="/staff/app/clients?new=1"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md transition-all hover:brightness-105 active:scale-95"
            >
              <UserPlus className="h-4 w-4" />
              Register New Member
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION 3: Quick Action Buttons */}
      <QuickActions />

      {/* SUMMARY CARDS: 8 Required Microfinance Performance Metric Cards */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Microfinance Core Indicators (Tacloban Branch)
          </h2>
          <span className="text-xs text-slate-400">Real-time ledger updates</span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Total Registered Clients */}
          <SummaryCard
            title="Total Registered Clients"
            value={s.totalClients}
            subtitle={`${s.activeClients} active accounts`}
            icon={Users}
            tone="blue"
            trend="+12% this month"
            onClick={() => navigate('/staff/app/clients')}
          />

          {/* 2. Pending KYC Requests */}
          <SummaryCard
            title="Pending KYC Requests"
            value={pendingKycCount}
            subtitle="Requires document verification"
            icon={FileCheck2}
            tone="amber"
            badge="Action Required"
            onClick={() => navigate('/staff/app/kyc')}
          />

          {/* 3. Active Loans */}
          <SummaryCard
            title="Active Loans"
            value={s.activeLoans}
            subtitle={`₱${(s.outstandingBalance || 0).toLocaleString()} current book`}
            icon={HandCoins}
            tone="emerald"
            onClick={() => navigate('/staff/app/loans')}
          />

          {/* 4. Pending Loan Applications */}
          <SummaryCard
            title="Pending Loan Applications"
            value={s.pendingApplications}
            subtitle="In underwriting pipeline"
            icon={FileText}
            tone="violet"
            onClick={() => navigate('/staff/app/applications')}
          />

          {/* 5. Total Savings */}
          <SummaryCard
            title="Total Savings Deposit"
            value={<Amount value={s.totalSavings} />}
            subtitle={`Today: ₱${(s.todayDeposits || 0).toLocaleString()}`}
            icon={PiggyBank}
            tone="indigo"
            onClick={() => navigate('/staff/app/savings')}
          />

          {/* 6. Today's Transactions */}
          <SummaryCard
            title="Today's Transactions"
            value={s.todayTransactionCount}
            subtitle={`₱${(s.todayCollections || 0).toLocaleString()} collections`}
            icon={ReceiptText}
            tone="amber"
            onClick={() => navigate('/staff/app/transactions')}
          />

          {/* 7. Outstanding Loan Balance */}
          <SummaryCard
            title="Outstanding Loan Balance"
            value={<Amount value={s.outstandingBalance} />}
            subtitle={`${s.overdueLoans || 0} loans flagged overdue`}
            icon={Wallet}
            tone="rose"
            onClick={() => navigate('/staff/app/loans')}
          />

          {/* 8. Active Lending Groups */}
          <SummaryCard
            title="Active Lending Groups"
            value={totalGroupsCount}
            subtitle="Solidarity weekly centers"
            icon={UserCheck}
            tone="teal"
            onClick={() => navigate('/staff/app/groups')}
          />
        </div>
      </div>

      {/* CHARTS & FINANCIAL COLLECTIONS PROGRESS */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Loan Application & Approval Trend Chart (2 columns) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Loan Application & Approval Trend
              </h3>
              <p className="text-xs text-slate-500">Monthly loan pipeline volume vs. approved loans</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Applications
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Disbursed
              </span>
            </div>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="appGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="apprGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#091527',
                    borderColor: '#1e293b',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#fbbf24' }}
                />
                <Area type="monotone" dataKey="applications" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#appGradient)" />
                <Area type="monotone" dataKey="approved" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#apprGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Collections Progress Overview (1 column) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Today's Collections Desk</h3>
                <p className="text-xs text-slate-500">Branch quota progress</p>
              </div>
              <Link to="/staff/app/collections" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
                View desk →
              </Link>
            </div>

            <div className="mt-4 rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/70 to-amber-100/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-900">Total Collected Today</span>
                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  {s.todayTransactionCount} receipts
                </span>
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">
                {formatCurrency(collectedToday)}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>Daily Target: {formatCurrency(dailyTarget)}</span>
                <span className="font-bold text-amber-700">{collectionPercent}%</span>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-amber-200/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500"
                  style={{ width: `${collectionPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-emerald-600" /> Savings Deposits Today
                </span>
                <span className="font-bold text-slate-800 tabular-nums">{formatCurrency(s.todayDeposits || 0)}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-500" /> Overdue Amount
                </span>
                <span className="font-bold text-rose-600 tabular-nums">{formatCurrency(s.overdueOutstanding || 0)}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              to="/staff/app/payments"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#091527] py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 shadow-sm"
            >
              <Wallet className="h-4 w-4 text-amber-400" />
              Post Walk-in Payment
            </Link>
          </div>
        </div>
      </div>

      {/* OPERATIONS BENTO: KYC QUEUE & RECENT LOAN APPLICATIONS */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* SECTION 5: Pending KYC Verification Requests Queue */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Pending KYC Verifications</h3>
                <p className="text-xs text-slate-500">Client documents awaiting staff review</p>
              </div>
            </div>
            <Link
              to="/staff/app/kyc"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              View Queue ({kycQueue.data?.length ?? 0}) <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex-1 divide-y divide-slate-100 overflow-x-auto">
            {!kycQueue.data || kycQueue.data.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                No pending KYC reviews. All client records are up to date!
              </div>
            ) : (
              kycQueue.data.slice(0, 4).map((client) => (
                <div key={client.id} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                      {client.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{client.fullName}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {client.borrowerNumber} · {client.phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      {(client as any).submittedDocuments || 2} Docs
                    </span>
                    <button
                      onClick={() => setKycReviewTarget(client)}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-slate-800 transition-colors"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION 6: Recent Loan Applications */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent Loan Applications</h3>
                <p className="text-xs text-slate-500">Pipeline originated in Tacloban branch</p>
              </div>
            </div>
            <Link
              to="/staff/app/applications"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              All Applications <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex-1 divide-y divide-slate-100 overflow-x-auto">
            {!loanApps.data || loanApps.data.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">
                No recent loan applications in the pipeline.
              </div>
            ) : (
              loanApps.data.slice(0, 4).map((loan) => (
                <div key={loan.id} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">{loan.borrowerName}</span>
                      <StatusBadge status={loan.status} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {loan.loanNumber} · {loan.productName} · {loan.termMonths} mo
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-extrabold text-slate-900 tabular-nums">
                      {formatCurrency(loan.principalAmount)}
                    </div>
                    <Link
                      to={`/staff/app/loans/${loan.id}`}
                      className="inline-block mt-0.5 text-[11px] font-semibold text-amber-600 hover:text-amber-700"
                    >
                      Review →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* OPERATIONS TABLES: RECENT CLIENT REGISTRATIONS & FINANCIAL TRANSACTIONS */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* SECTION 4: Recent Client Registrations */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent Client Registrations</h3>
                <p className="text-xs text-slate-500">Newly onboarded cooperative members</p>
              </div>
            </div>
            <Link
              to="/staff/app/clients"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Directory <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            {!recentClients.data || recentClients.data.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No recent client records.</div>
            ) : (
              recentClients.data.slice(0, 5).map((client) => (
                <div key={client.id} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{client.fullName}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {client.borrowerNumber} · {client.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={client.memberStatus || 'Active'} />
                    <Link
                      to={`/staff/app/clients/${client.id}`}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition"
                    >
                      Profile
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION 7: Recent Financial Transactions */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                <ScrollText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent Financial Transactions</h3>
                <p className="text-xs text-slate-500">Live journal entries and payment receipts</p>
              </div>
            </div>
            <Link
              to="/staff/app/transactions"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Full Ledger <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            {!recentTxns.data || recentTxns.data.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No transactions recorded today yet.</div>
            ) : (
              recentTxns.data.slice(0, 5).map((txn) => (
                <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">{txn.clientName}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
                        {txn.transactionType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {txn.referenceNumber} · {txn.paymentMethod}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-extrabold tabular-nums ${
                        ['Loan Repayment', 'Savings Deposit'].includes(txn.transactionType)
                          ? 'text-emerald-700'
                          : 'text-slate-800'
                      }`}
                    >
                      {['Loan Repayment', 'Savings Deposit'].includes(txn.transactionType) ? '+' : ''}
                      {formatCurrency(txn.amount)}
                    </div>
                    <p className="text-[10px] text-slate-400">{txn.transactionDate}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECTION 10 & 11: NOTIFICATIONS PANEL & RECENT STAFF ACTIVITIES */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Notifications Panel */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Staff Notifications & Alerts</h3>
            </div>
            <Link to="/staff/app/notifications" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
              View all ({notifsData.data?.notifications?.length ?? 0})
            </Link>
          </div>

          <div className="mt-3 space-y-2.5">
            {!notifsData.data?.notifications || notifsData.data.notifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">All alerts and notices acknowledged.</p>
            ) : (
              notifsData.data.notifications.slice(0, 4).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-xl p-3 text-xs transition-colors ${
                    n.isRead ? 'bg-slate-50 text-slate-600' : 'bg-amber-50/60 border border-amber-200/60 text-slate-800'
                  }`}
                >
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-slate-300' : 'bg-amber-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{n.title}</p>
                    <p className="mt-0.5 text-slate-500 line-clamp-2">{n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Staff Activities Audit Feed */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent Branch Staff Activities</h3>
            </div>
            <Link to="/staff/app/activity" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
              Activity log →
            </Link>
          </div>

          <div className="mt-3 space-y-3">
            {!activities.data || activities.data.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No logged actions recorded today.</p>
            ) : (
              activities.data.slice(0, 4).map((act: any) => (
                <div key={act.id} className="flex items-start gap-3 text-xs">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                    {(act.userName || 'S').slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">
                      <span className="font-bold text-slate-900">{act.userName || 'Staff'}</span>{' '}
                      {act.action || 'performed operational update'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {act.target || act.module || 'Operations'} · {new Date(act.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* KYC Quick Review Modal */}
      {kycReviewTarget && (
        <KycReviewPanel
          client={kycReviewTarget}
          onClose={() => setKycReviewTarget(null)}
          onDone={() => {
            setKycReviewTarget(null);
            kycQueue.reload();
            reload();
          }}
        />
      )}
    </div>
  );
};

// Summary Card Component with Modern Banking Visuals
const SummaryCard: React.FC<{
  title: string;
  value: React.ReactNode;
  subtitle: string;
  icon: React.ElementType;
  tone: 'blue' | 'amber' | 'emerald' | 'violet' | 'indigo' | 'rose' | 'teal';
  badge?: string;
  trend?: string;
  onClick?: () => void;
}> = ({ title, value, subtitle, icon: Icon, tone, badge, trend, onClick }) => {
  const toneClasses: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'hover:border-blue-300' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'hover:border-amber-400' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'hover:border-emerald-300' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'hover:border-violet-300' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'hover:border-indigo-300' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'hover:border-rose-300' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'hover:border-teal-300' },
  };

  const currentTone = toneClasses[tone] || toneClasses.blue;

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${currentTone.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 line-clamp-1">
            {title}
          </p>
          <div className="mt-1 text-2xl font-black tracking-tight text-slate-900 tabular-nums">
            {value}
          </div>
        </div>

        <div className={`shrink-0 rounded-xl p-2.5 ${currentTone.bg} ${currentTone.text}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        <span className="truncate text-slate-500 text-[11px]">{subtitle}</span>
        {badge ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
            {badge}
          </span>
        ) : trend ? (
          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
            <TrendingUp className="h-3 w-3" /> {trend}
          </span>
        ) : (
          <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-600 transition-colors" />
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
