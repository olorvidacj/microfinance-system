import React from 'react';
import {
  ShieldCheck,
  Users2,
  FileSpreadsheet,
  Receipt,
  PiggyBank,
  Scale,
  TrendingUp,
  Building2,
  BookOpen,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Briefcase,
  Vote,
  Users,
  Search,
  Wallet,
  BadgeCheck,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { useAccess } from '../hooks/useAccess';
import { normalizeRole } from '../auth/permissions';

interface RoleDashboardProps {
  onOpenNewLoan?: () => void;
  onOpenRecordPayment?: () => void;
  onOpenAddBorrower?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const RoleDashboard: React.FC<RoleDashboardProps> = ({
  onOpenNewLoan,
  onOpenRecordPayment,
  onOpenAddBorrower,
  onNavigateTab,
}) => {
  const {
    stats,
    filteredLoans,
    filteredBorrowers,
    filteredPayments,
    filteredMembershipApps,
    savingsAccounts,
    currentUser,
  } = useLoan();

  const { roleKey, roleDef } = useAccess();
  const normalizedRole = normalizeRole(roleKey);

  const pendingMembership = filteredMembershipApps.filter(
    (a) => a.currentStep !== 'BOD_APPROVED' && a.currentStep !== 'REJECTED'
  ).length;
  const overdueLoans = filteredLoans.filter(
    (l) => l.status === 'In Arrears' || (l.daysInArrears && l.daysInArrears > 0)
  ).length;
  const activeLoans = filteredLoans.filter((l) => l.status === 'Active' || l.status === 'Disbursed').length;

  const cardBase = 'bg-white rounded-2xl border border-slate-200 shadow-sm p-5';
  const statLabel = 'text-[10px] uppercase tracking-wider font-bold text-slate-400';
  const statValue = 'text-2xl font-bold text-slate-900 mt-1';

  // ==================== DASHBOARD CONTENT PER ROLE ====================

  const AdminDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Landmark className="w-3.5 h-3.5 text-gold-600" /> Total Portfolio
        </div>
        <div className={statValue}>₱{stats.totalPortfolio.toLocaleString()}</div>
        <div className="text-xs text-emerald-600 mt-1">{stats.activeLoansCount} active loans</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Wallet className="w-3.5 h-3.5 text-gold-600" /> Outstanding
        </div>
        <div className={statValue}>₱{stats.totalOutstanding.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">PAR {'>'} 30: {stats.par30Ratio}%</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Users2 className="w-3.5 h-3.5 text-emerald-600" /> Members &amp; Loans
        </div>
        <div className={statValue}>{stats.activeBorrowersCount}</div>
        <div className="text-xs text-slate-500 mt-1">{pendingMembership} pending applications</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <PiggyBank className="w-3.5 h-3.5 text-amber-600" /> Savings Pool
        </div>
        <div className={statValue}>₱{stats.totalSavingsPool.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">{savingsAccounts.length} savings accounts</div>
      </div>
    </div>
  );

  const ClientServicesDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Users2 className="w-3.5 h-3.5 text-gold-600" /> Total Members
        </div>
        <div className={statValue}>{filteredBorrowers.length}</div>
        <div className="text-xs text-slate-500 mt-1">Active: {stats.activeBorrowersCount}</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <BookOpen className="w-3.5 h-3.5 text-gold-600" /> Pending Membership
        </div>
        <div className={statValue}>{pendingMembership}</div>
        <div className="text-xs text-slate-500 mt-1">awaiting KYC / committee</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> KYC Verified
        </div>
        <div className={statValue}>
          {filteredBorrowers.filter((b) => (b as any).kycStatus === 'VERIFIED').length}
        </div>
        <div className="text-xs text-slate-500 mt-1">verified members</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Users className="w-3.5 h-3.5 text-amber-600" /> Inactive Members
        </div>
        <div className={statValue}>{stats.inactiveMembersCount}</div>
        <div className="text-xs text-slate-500 mt-1">need follow-up outreach</div>
      </div>
    </div>
  );

  const LoanOfficerDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <FileSpreadsheet className="w-3.5 h-3.5 text-gold-600" /> Applications
        </div>
        <div className={statValue}>{filteredLoans.length}</div>
        <div className="text-xs text-slate-500 mt-1">total loan applications</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Overdue Loans
        </div>
        <div className={statValue}>{overdueLoans}</div>
        <div className="text-xs text-slate-500 mt-1">needs collection follow-up</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active Portfolio
        </div>
        <div className={statValue}>₱{stats.totalOutstanding.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">{activeLoans} active loans</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Clock className="w-3.5 h-3.5 text-amber-600" /> Collection Rate
        </div>
        <div className={statValue}>{stats.collectionRate}%</div>
        <div className="text-xs text-slate-500 mt-1">collected this month</div>
      </div>
    </div>
  );

  const TellerDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Receipt className="w-3.5 h-3.5 text-gold-600" /> Payments Collected
        </div>
        <div className={statValue}>₱{stats.totalCollected.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">{filteredPayments.length} transactions</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <PiggyBank className="w-3.5 h-3.5 text-emerald-600" /> Savings Deposits
        </div>
        <div className={statValue}>₱{stats.totalSavingsPool.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">{savingsAccounts.length} passbooks</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Wallet className="w-3.5 h-3.5 text-amber-600" /> Vault Cash
        </div>
        <div className={statValue}>₱{stats.totalVaultCash.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">across all branches</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-gold-600" /> Collection Efficiency
        </div>
        <div className={statValue}>{stats.collectionEfficiency}%</div>
        <div className="text-xs text-slate-500 mt-1">current month</div>
      </div>
    </div>
  );

  const BranchManagerDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Building2 className="w-3.5 h-3.5 text-gold-600" /> Branch Portfolio
        </div>
        <div className={statValue}>₱{stats.totalPortfolio.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">total outstanding portfolio</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Overdue Loans
        </div>
        <div className={statValue}>{overdueLoans}</div>
        <div className="text-xs text-slate-500 mt-1">PAR {'>'} 30: {stats.par30Ratio}%</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Collection Rate
        </div>
        <div className={statValue}>{stats.collectionRate}%</div>
        <div className="text-xs text-slate-500 mt-1">portfolio quality</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <ShieldCheck className="w-3.5 h-3.5 text-violet-600" /> Approval Queue
        </div>
        <div className={statValue}>
          {filteredLoans.filter((l) => l.status === 'Submitted' || l.status === 'Under Review').length}
        </div>
        <div className="text-xs text-slate-500 mt-1">loans awaiting manager sign-off</div>
      </div>
    </div>
  );

  const BookkeeperDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <FileSpreadsheet className="w-3.5 h-3.5 text-gold-600" /> Total Disbursed
        </div>
        <div className={statValue}>₱{stats.totalDisbursed.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">cumulative loan disbursements</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Total Collected
        </div>
        <div className={statValue}>₱{stats.totalCollected.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">cash inflow from collections</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <PiggyBank className="w-3.5 h-3.5 text-amber-600" /> Savings Pool
        </div>
        <div className={statValue}>₱{stats.totalSavingsPool.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">member deposits &amp; CBU</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Wallet className="w-3.5 h-3.5 text-gold-600" /> Net Position
        </div>
        <div className={statValue}>
          ₱{(stats.totalDisbursed - stats.totalCollected).toLocaleString()}
        </div>
        <div className="text-xs text-slate-500 mt-1">disbursed minus collected</div>
      </div>
    </div>
  );

  const LegalOfficerDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <FileSpreadsheet className="w-3.5 h-3.5 text-rose-600" /> Legal Review Queue
        </div>
        <div className={statValue}>{filteredLoans.length}</div>
        <div className="text-xs text-slate-500 mt-1">loan records to review</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Overdue / Default
        </div>
        <div className={statValue}>{overdueLoans}</div>
        <div className="text-xs text-slate-500 mt-1">candidates for legal action</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> Compliance Flags
        </div>
        <div className={statValue}>{pendingMembership}</div>
        <div className="text-xs text-slate-500 mt-1">membership compliance items</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Scale className="w-3.5 h-3.5 text-rose-600" /> Legal Documents
        </div>
        <div className={statValue}>{filteredLoans.filter((l) => (l.collaterals || []).length > 0).length}</div>
        <div className="text-xs text-slate-500 mt-1">contracts with collateral</div>
      </div>
    </div>
  );

  const AdviserDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <TrendingUp className="w-3.5 h-3.5 text-teal-600" /> Portfolio Health
        </div>
        <div className={statValue}>₱{stats.totalPortfolio.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">outstanding balance</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Risk Indicator (PAR30)
        </div>
        <div className={statValue}>{stats.par30Ratio}%</div>
        <div className="text-xs text-slate-500 mt-1">{stats.par30.toLocaleString()} in arrears</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Collection Rate
        </div>
        <div className={statValue}>{stats.collectionRate}%</div>
        <div className="text-xs text-slate-500 mt-1">repayment performance</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Users2 className="w-3.5 h-3.5 text-teal-600" /> Member Base
        </div>
        <div className={statValue}>{stats.activeBorrowersCount}</div>
        <div className="text-xs text-slate-500 mt-1">active borrowing members</div>
      </div>
    </div>
  );

  const BodDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Landmark className="w-3.5 h-3.5 text-gold-600" /> Cooperative Portfolio
        </div>
        <div className={statValue}>₱{stats.totalPortfolio.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">all branches combined</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> PAR {'>'} 30 Ratio
        </div>
        <div className={statValue}>{stats.par30Ratio}%</div>
        <div className="text-xs text-slate-500 mt-1">portfolio at risk</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Vote className="w-3.5 h-3.5 text-gold-600" /> BOD Membership
        </div>
        <div className={statValue}>{pendingMembership}</div>
        <div className="text-xs text-slate-500 mt-1">applications for BOD approval</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Savings Pool
        </div>
        <div className={statValue}>₱{stats.totalSavingsPool.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">member savings &amp; shares</div>
      </div>
    </div>
  );

  const CommitteesDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Vote className="w-3.5 h-3.5 text-gold-600" /> Committee Reviews
        </div>
        <div className={statValue}>{filteredLoans.filter((l) => l.status === 'Submitted' || l.status === 'Under Review').length}</div>
        <div className="text-xs text-slate-500 mt-1">awaiting committee evaluation</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <FileSpreadsheet className="w-3.5 h-3.5 text-gold-600" /> Loan Portfolio
        </div>
        <div className={statValue}>₱{stats.totalOutstanding.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">outstanding exposure</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> At Risk Loans
        </div>
        <div className={statValue}>{overdueLoans}</div>
        <div className="text-xs text-slate-500 mt-1">watchlist monitoring</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> Pending Memberships
        </div>
        <div className={statValue}>{pendingMembership}</div>
        <div className="text-xs text-slate-500 mt-1">for committee review</div>
      </div>
    </div>
  );

  const AuditorDashboard = () => (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Search className="w-3.5 h-3.5 text-gold-600" /> Transactions Reviewed
        </div>
        <div className={statValue}>{filteredPayments.length}</div>
        <div className="text-xs text-slate-500 mt-1">collection transactions</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Reconcile Items
        </div>
        <div className={statValue}>{stats.overdueLoansCount}</div>
        <div className="text-xs text-slate-500 mt-1">overdue accounts to verify</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <Wallet className="w-3.5 h-3.5 text-amber-600" /> Vault Position
        </div>
        <div className={statValue}>₱{stats.totalVaultCash.toLocaleString()}</div>
        <div className="text-xs text-slate-500 mt-1">cash on hand vs reconciled</div>
      </div>
      <div className={cardBase}>
        <div className={`${statLabel} flex items-center gap-1.5`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Collection Efficiency
        </div>
        <div className={statValue}>{stats.collectionEfficiency}%</div>
        <div className="text-xs text-slate-500 mt-1">monthly efficiency index</div>
      </div>
    </div>
  );

  const DefaultDashboard = () => <AdminDashboard />;

  const renderKpis = () => {
    switch (normalizedRole) {
      case 'CLIENT_SERVICES_STAFF':
      case 'STAFF':
        return <ClientServicesDashboard />;
      case 'LOAN_OFFICER':
      case 'LOAN_PROCESSOR':
        return <LoanOfficerDashboard />;
      case 'CASHIER_TELLER':
      case 'TELLER':
        return <TellerDashboard />;
      case 'MANAGER':
      case 'BRANCH_MANAGER':
        return <BranchManagerDashboard />;
      case 'BOOKKEEPER':
        return <BookkeeperDashboard />;
      case 'LEGAL_OFFICER':
        return <LegalOfficerDashboard />;
      case 'ADVISER':
        return <AdviserDashboard />;
      case 'BOARD_OF_DIRECTORS':
        return <BodDashboard />;
      case 'CREDIT_COMMITTEE':
      case 'EDUCATION_COMMITTEE':
        return <CommitteesDashboard />;
      case 'AUDITOR':
      case 'SUPER_ADMIN':
      case 'ADMINISTRATOR':
      default:
        return <DefaultDashboard />;
    }
  };

  const quickActions = [
    ...(onOpenNewLoan ? [{ label: 'New Loan Application', icon: FileSpreadsheet, onClick: onOpenNewLoan }] : []),
    ...(onOpenRecordPayment ? [{ label: 'Record Payment', icon: Receipt, onClick: onOpenRecordPayment }] : []),
    ...(onOpenAddBorrower ? [{ label: 'Register Member', icon: Users2, onClick: onOpenAddBorrower }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Greeting + Persona */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Welcome back, {currentUser.name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-semibold text-gold-700">{roleDef.name}</span> · {roleDef.description}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold-500/10 border border-gold-400/30 text-xs font-semibold text-gold-700">
          <ShieldCheck className="w-4 h-4" />
          {normalizedRole} Dashboard
        </span>
      </div>

      {/* Role-Specific KPIs */}
      {renderKpis()}

      {/* All Roles: Alerts + Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className={`${cardBase} lg:col-span-2`}>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Priority Attention
          </h3>
          <div className="space-y-2">
            {overdueLoans > 0 && (
              <div className="flex items-center justify-between bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                <div className="text-sm text-rose-700 font-medium">
                  <span className="font-bold">{overdueLoans}</span> loans in arrears require collection follow-up.
                </div>
                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('payments')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline"
                  >
                    View <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {pendingMembership > 0 && (
              <div className="flex items-center justify-between bg-gold-500/10 border border-gold-400/30 rounded-xl px-4 py-3">
                <div className="text-sm text-gold-700 font-medium">
                  <span className="font-bold">{pendingMembership}</span> membership applications awaiting processing.
                </div>
                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('membership')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:underline"
                  >
                    Review <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {overdueLoans === 0 && pendingMembership === 0 && (
              <p className="text-sm text-slate-400">No outstanding attention items. All systems look healthy.</p>
            )}
          </div>
        </div>

        {quickActions.length > 0 && (
          <div className={cardBase}>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Briefcase className="w-4 h-4 text-gold-600" /> Quick Actions
            </h3>
            <div className="space-y-2">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 font-medium hover:bg-gold-500/10 hover:border-gold-400/30 transition"
                  >
                    <Icon className="w-4 h-4 text-gold-600" />
                    {a.label}
                    <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-300" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
        <Vote className="w-4 h-4" />
        <span>
          Dashboard content adapts to your assigned role ({roleDef.name}). Permissions are enforced server-side on every API call.
        </span>
      </div>
    </div>
  );
};