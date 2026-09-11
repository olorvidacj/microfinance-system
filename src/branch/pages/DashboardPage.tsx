import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, HandCoins, PiggyBank, ReceiptText, TrendingUp, Users, Wallet, FileText } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { StatCard } from '../../portal/components/common';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { Amount } from '../../portal/components/ui/Amount';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchContext } from '../context/BranchContext';
import { dashboardService } from '../services';
import { QuickActions } from '../components/QuickActions';
import { ActivityFeed } from '../components/ActivityFeed';
import { formatCurrency } from '../../utils/loanMath';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const DashboardPage: React.FC = () => {
  const { personnel, ctx } = useBranchContext();
  const fetcher = useCallback(() => dashboardService.get(), []);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const activitiesFetcher = useCallback(() => dashboardService.activities(10), []);
  const activities = useBranchData(activitiesFetcher);

  if (loading) return <LoadingState label="Loading branch dashboard…" />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  const s = data.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${personnel?.name?.split(' ')[0] || 'there'}`}
        subtitle={
          ctx?.branch
            ? `${ctx.branch.name} · ${personnel?.title || ''} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
            : 'Branch overview'
        }
        actions={
          <StatusBadge status={'Open'} tone="purple" />
        }
      />

      <QuickActions />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients" value={s.totalClients} sub={`${s.activeClients} active · ${s.pendingVerification} pending KYC`} icon={Users} tone="blue" />
        <StatCard label="Active loans" value={s.activeLoans} sub={`${s.pendingApplications} applications pending`} icon={HandCoins} tone="emerald" />
        <StatCard label="Outstanding balance" value={<Amount value={s.outstandingBalance} />} sub="Portfolio value" icon={Wallet} tone="violet" />
        <StatCard label="Today's collections" value={<Amount value={s.todayCollections} />} sub={`${s.todayTransactionCount} transactions`} icon={ReceiptText} tone="amber" />
        <StatCard label="Overdue loans" value={s.overdueLoans} sub={<Amount value={s.overdueOutstanding} />} icon={AlertTriangle} tone="rose" />
        <StatCard label="Total savings" value={<Amount value={s.totalSavings} />} sub={`Deposits today ₱${(s.todayDeposits || 0).toLocaleString()}`} icon={PiggyBank} tone="violet" />
        <StatCard label="Pending applications" value={s.pendingApplications} sub="Awaiting processing" icon={FileText} tone="amber" />
        <StatCard label="Branch" value={ctx?.branch?.code || '—'} sub={ctx?.branch?.address || ''} icon={Building2} tone="slate" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today&apos;s collections</CardTitle>
            <Link to="/staff/app/collections" className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
              View all
            </Link>
          </CardHeader>
          <CardBody>
            {s.todayTransactionCount === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No payments recorded today yet.</p>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4">
                <div>
                  <p className="text-xs font-medium text-emerald-700">Collected today</p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-900">{formatCurrency(s.todayCollections)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-600" />
              </div>
            )}
          </CardBody>
        </Card>

        <ActivityFeed items={activities.data || []} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniCard label="Total clients" value={s.totalClients} />
        <MiniCard label="Active loans" value={s.activeLoans} />
        <MiniCard label="Pending KYC" value={s.pendingVerification} />
        <MiniCard label="Pending applications" value={s.pendingApplications} />
      </div>
    </div>
  );
};

const MiniCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
  </div>
);

export default DashboardPage;