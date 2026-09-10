import React, { useCallback, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { StatCard } from '../../portal/components/common';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { Amount } from '../../portal/components/ui/Amount';
import { BarChartCard, DonutChartCard, CHART_COLORS } from '../../portal/components/ui/Chart';
import { Tabs } from '../../portal/components/ui/Tabs';
import { useBranchData } from '../hooks/useBranchData';
import { dashboardService } from '../services';
import { PerformanceData } from '../types';

const RANGES = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

const asData = (pairs: [string, number][]): { name: string; value: number }[] =>
  pairs.map(([name, value]) => ({ name, value }));

const PerformancePage: React.FC = () => {
  const [range, setRange] = useState('month');
  const fetcher = useCallback(() => dashboardService.performance(range), [range]);
  const { data, loading, error, reload } = useBranchData(fetcher);

  if (loading) return <LoadingState label="Loading performance data…" />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch performance"
        subtitle="Collections, portfolio health, and savings movement"
        actions={
          <Tabs tabs={RANGES} active={range} onChange={(id) => setRange(id)} />
        }
      />
      <PerformanceBody data={data} />
    </div>
  );
};

const PerformanceBody: React.FC<{ data: PerformanceData }> = ({ data }) => {
  const { portfolio, collections } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active loans" value={portfolio.active} sub="Disbursed / active portfolio" icon={TrendingUp} tone="blue" />
        <StatCard label="Overdue" value={portfolio.overdue} sub="Loans in arrears" icon={TrendingUp} tone="rose" />
        <StatCard label="Completed" value={portfolio.completed} sub="Fully settled loans" icon={TrendingUp} tone="emerald" />
        <StatCard label="Pending" value={portfolio.pending} sub="In the pipeline" icon={TrendingUp} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BarChartCard
          title="Collections"
          subtitle={data.range === 'week' ? 'Daily collections (last 7 days)' : data.range === 'month' ? 'Monthly collections' : 'Monthly collections (last 12 months)'}
          data={asData((data.range === 'week' ? collections.daily : collections.monthly).slice(-14))}
          height={260}
        />
        <DonutChartCard
          title="Portfolio status"
          data={[
            { name: 'Active', value: portfolio.active, color: CHART_COLORS[0] },
            { name: 'Completed', value: portfolio.completed, color: CHART_COLORS[3] },
            { name: 'Overdue', value: portfolio.overdue, color: CHART_COLORS[6] },
            { name: 'Pending', value: portfolio.pending, color: CHART_COLORS[4] },
          ]}
          centerValue={`${portfolio.active}`}
          centerLabel="active loans"
          height={260}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Savings movement</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Row label="Deposits" value={data.savings.deposits} />
            <Row label="Withdrawals" value={data.savings.withdrawals} />
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm text-slate-500">Net</span>
              <Amount value={data.savings.net} positive={data.savings.net >= 0} className="text-base font-bold" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collections summary</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Row label="Period total" value={collections.total || 0} />
            <Row label="Collection days" value={collections.daily.length} />
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm text-slate-500">Average / day</span>
              <Amount value={collections.daily.length ? Math.round(collections.total / collections.daily.length * 100) / 100 : 0} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client growth</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Row label="New clients" value={data.clientGrowth.newClients} />
            <Row label="Active members" value={data.clientGrowth.active} />
            <Row label="Inactive" value={data.clientGrowth.inactive} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-slate-500">{label}</span>
    {typeof value === 'number' && value > 1000 ? (
      <Amount value={value} className="font-semibold" />
    ) : (
      <span className="font-semibold tabular-nums text-slate-800">{typeof value === 'number' ? value.toLocaleString() : value}</span>
    )}
  </div>
);

export default PerformancePage;