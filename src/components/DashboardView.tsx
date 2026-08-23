import React from 'react';
import {
  TrendingUp,
  CreditCard,
  DollarSign,
  AlertTriangle,
  Building2,
  Users,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Zap,
  PiggyBank,
  UserPlus,
  Receipt,
  Scale,
  Percent,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { Loan } from '../types';

interface DashboardViewProps {
  onSelectLoan: (loan: Loan) => void;
  onOpenNewLoan: () => void;
  onOpenRecordPayment: () => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectLoan,
  onOpenNewLoan,
  onOpenRecordPayment,
  onNavigateTab,
}) => {
  const {
    stats,
    filteredLoans,
    filteredPayments,
    branches,
    activeBranch,
    loanProducts,
    borrowers,
    membershipApplications,
    savingsAccounts,
    creditMonthlySavingsInterest,
  } = useLoan();

  const totalSavingsInSystem = savingsAccounts.reduce((acc, s) => acc + s.balance, 0);
  const totalCBUInSystem = borrowers.reduce((acc, b) => acc + b.shareCapital, 0);
  const inactiveMembersCount = borrowers.filter((b) => b.memberStatus === 'Inactive').length;
  const pendingMembershipCount = membershipApplications.filter((m) => m.step !== 'BOD_APPROVED' && m.step !== 'REJECTED').length;
  const pendingLoansCount = filteredLoans.filter((l) => l.status === 'Underwriting' || l.status === 'Approved').length;

  // Monthly trends mock dataset computed dynamically
  const monthlyTrendsData = [
    { month: 'Sep', disbursed: 120000, collected: 98000, savings: 340000 },
    { month: 'Oct', disbursed: 145000, collected: 132000, savings: 375000 },
    { month: 'Nov', disbursed: 160000, collected: 148000, savings: 410000 },
    { month: 'Dec', disbursed: 210000, collected: 195000, savings: 460000 },
    { month: 'Jan', disbursed: 180000, collected: 172000, savings: 490000 },
    {
      month: 'Feb (Current)',
      disbursed: Math.round(stats.totalDisbursed * 0.4),
      collected: Math.round(stats.totalCollected * 0.5),
      savings: totalSavingsInSystem,
    },
  ];

  // Portfolio distribution by product
  const productDistribution = loanProducts.map((p) => {
    const sum = filteredLoans
      .filter((l) => l.productId === p.id)
      .reduce((acc, l) => acc + l.principalAmount, 0);
    return {
      name: p.name,
      value: sum || 25000,
      color:
        p.badgeColor === 'blue'
          ? '#3B82F6'
          : p.badgeColor === 'emerald'
          ? '#10B981'
          : p.badgeColor === 'amber'
          ? '#F59E0B'
          : p.badgeColor === 'purple'
          ? '#8B5CF6'
          : '#6366F1',
    };
  });

  // Watchlist loans (In Arrears or Irregular)
  const urgentLoans = filteredLoans
    .filter((l) => l.status === 'In Arrears' || l.isIrregularAccount || l.schedule.some((s) => s.status === 'Overdue'))
    .slice(0, 5);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Top Banner with Cooperative Brand Context */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Bagong Pag-Asa Multi-Purpose Cooperative • {activeBranch ? activeBranch.name : 'All Consolidated Branches'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Cooperative Operations & Financial Cockpit
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Consolidated oversight across Membership Services, Savings & Share Capital, 6-Step Loan Processing, and Repayment Collections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={onOpenRecordPayment}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition shadow-xs"
          >
            <Receipt className="w-4 h-4" />
            <span>Collect Payment (OR)</span>
          </button>
          <button
            onClick={onOpenNewLoan}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-xs"
          >
            <Zap className="w-4 h-4" />
            <span>Originate Loan</span>
          </button>
          <button
            onClick={() => onNavigateTab('savings')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition border border-slate-700"
          >
            <PiggyBank className="w-4 h-4 text-emerald-400" />
            <span>Savings Desk</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metric Cards (Cooperative Model) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Active Loan Portfolio */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Loan Portfolio (Active)</p>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(stats.totalOutstanding)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-700">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{stats.activeLoansCount} active member loan contracts</span>
          </div>
        </div>

        {/* Member Savings & Deposits */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Member Savings Deposits</p>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(totalSavingsInSystem)}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs font-medium text-slate-500">
            <span>1% p.a. monthly yield</span>
            <button
              onClick={creditMonthlySavingsInterest}
              className="text-blue-600 hover:text-blue-800 font-semibold underline text-[11px]"
            >
              Post Monthly Interest
            </button>
          </div>
        </div>

        {/* Total Member Share Capital / CBU */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Share Capital (CBU)</p>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(totalCBUInSystem)}
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-purple-700 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Coop equity & borrowing base</span>
          </div>
        </div>

        {/* Repayment Rate & Inactivity Alert */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Collection Efficiency</p>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {stats.collectionEfficiency}%
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-slate-500">{stats.par30}% PAR &gt; 30d</span>
            {inactiveMembersCount > 0 && (
              <span className="text-rose-600 font-bold">
                {inactiveMembersCount} Inactive Members
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cooperative Quick Pipeline Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Module 1: Membership Applications */}
        <div
          onClick={() => onNavigateTab('membership')}
          className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-3xl border border-blue-100 cursor-pointer hover:shadow-md transition space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 bg-blue-200/60 text-blue-900 rounded-full font-bold text-xs">
              1. Membership Services
            </span>
            <UserPlus className="w-4 h-4 text-blue-700" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">5-Step Membership Pipeline</h3>
          <p className="text-xs text-slate-600">
            {pendingMembershipCount} pending application(s) awaiting Staff check, BI/PMES, or Board of Directors (BOD) approval.
          </p>
          <div className="flex items-center gap-1 text-xs font-bold text-blue-700 pt-1">
            <span>Manage Applications & Inactive Members</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Module 2: Savings Services */}
        <div
          onClick={() => onNavigateTab('savings')}
          className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-3xl border border-emerald-100 cursor-pointer hover:shadow-md transition space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 bg-emerald-200/60 text-emerald-900 rounded-full font-bold text-xs">
              2. Savings Services
            </span>
            <PiggyBank className="w-4 h-4 text-emerald-700" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">1% p.a. Savings & Withdrawals</h3>
          <p className="text-xs text-slate-600">
            Strict ₱1,000 maintaining balance safeguard. Over-the-counter deposit & manager withdrawal slip approvals.
          </p>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 pt-1">
            <span>Open Savings & Withdrawal Desk</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Module 3: 6-Step Loan Processing */}
        <div
          onClick={() => onNavigateTab('loans')}
          className="p-5 bg-gradient-to-br from-purple-50 to-violet-50/50 rounded-3xl border border-purple-100 cursor-pointer hover:shadow-md transition space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 bg-purple-200/60 text-purple-900 rounded-full font-bold text-xs">
              3. Loan Services
            </span>
            <Zap className="w-4 h-4 text-purple-700" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">6-Step Loan Pipeline & Vouchers</h3>
          <p className="text-xs text-slate-600">
            {pendingLoansCount} loan(s) in review. Processor &rarr; Bookkeeper &rarr; Credit Committee &rarr; Voucher &rarr; Manager.
          </p>
          <div className="flex items-center gap-1 text-xs font-bold text-purple-700 pt-1">
            <span>View Loans & Approve Vouchers</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Visual Charts: Monthly Loan & Savings Trends + Product Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Disbursement vs Collection Trends */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Disbursement, Repayments & Savings Growth</h2>
              <p className="text-xs text-slate-400">Monthly financial velocity in Philippine Pesos (₱)</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              Healthy Liquidity
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendsData}>
                <defs>
                  <linearGradient id="colorDisbursed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  formatter={(val: any) => [`₱${Number(val).toLocaleString()}`, '']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="disbursed" name="Loans Disbursed" stroke="#3B82F6" fill="url(#colorDisbursed)" strokeWidth={2} />
                <Area type="monotone" dataKey="collected" name="Repayments Collected" stroke="#10B981" fill="url(#colorCollected)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Loan Product Allocation */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cooperative Loan Mix</h2>
            <p className="text-xs text-slate-400">Portfolio exposure by loan classification</p>
          </div>

          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {productDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`₱${Number(val).toLocaleString()}`, 'Volume']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            {productDistribution.map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-slate-600">{p.name}</span>
                </div>
                <span className="font-bold text-slate-900">{formatCurrency(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Urgent Accounts & Irregular Watchlist */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Collections Watchlist & Irregular Accounts</h2>
              <p className="text-xs text-slate-400">Accounts requiring immediate field visits, follow-up, or restructuring</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('loans')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            View All in Portfolio &rarr;
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {urgentLoans.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              All active loan repayments are currently up to date!
            </div>
          ) : (
            urgentLoans.map((loan) => (
              <div
                key={loan.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50 rounded-xl px-2 transition"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={loan.borrowerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={loan.borrowerName}
                    className="w-10 h-10 rounded-2xl object-cover border border-slate-200"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">{loan.borrowerName}</span>
                      <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {loan.loanNumber}
                      </span>
                      {loan.isIrregularAccount && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-md text-[10px]">
                          Irregular
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {loan.productName} • Phone: {loan.borrowerPhone} • Schedule: {loan.repaymentFrequency}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 text-xs">
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Outstanding Balance</span>
                    <span className="font-bold text-rose-600 font-mono text-sm">{formatCurrency(loan.remainingBalance)}</span>
                  </div>

                  <button
                    onClick={() => onSelectLoan(loan)}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition"
                  >
                    View Account
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
