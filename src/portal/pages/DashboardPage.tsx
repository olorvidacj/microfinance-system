import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  ChevronRight,
  Clock,
  Eye,
  FilePlus2,
  HandCoins,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { dashboardService } from '../services/dashboard';
import { profileService } from '../services/profile';
import { ClientDashboard, KYCStatus, KycStatusData } from '../types';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/loanMath';
import {
  Amount,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingState,
  ProgressBar,
  StatusBadge,
  AreaChartCard,
} from '../components/ui';
import { InfoRow, StatCard, transactionIcon, transactionTone } from '../components/common';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ClientDashboard | null>(null);
  const [kyc, setKyc] = useState<KycStatusData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [d, k] = await Promise.all([dashboardService.get(), profileService.kycStatus()]);
      setDashboard(d);
      setKyc(k);
    } catch (err: any) {
      setError(err.message || 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState label="Loading your dashboard…" />;
  if (error || !dashboard)
    return <ErrorState message={error || 'No data available.'} onRetry={load} />;

  const firstName = (user?.fullName || dashboard.borrowerName).split(' ')[0];
  const kycStatus = kyc?.kycStatus || 'NOT_STARTED';

  const repaymentData = [
    { name: 'Feb', value: 4850 },
    { name: 'Mar', value: 4850 },
    { name: 'Apr', value: 4850 },
    { name: 'May', value: 4850 },
    { name: 'Jun', value: 4850 },
    { name: 'Jul', value: 4850 },
  ];

  const totalDisbursed = dashboard.totalActiveLoan || 0;
  const totalPaid = dashboard.totalPaid || 0;
  const loanProgress = totalDisbursed > 0 ? Math.min(100, Math.round((totalPaid / (totalPaid + dashboard.remainingBalance)) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hi, {firstName} 👋</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            Member <span className="font-mono text-xs font-medium text-slate-600">{dashboard.memberNumber}</span>
            <StatusBadge status={kycStatus} />
          </p>
        </div>
        <KycApplyButton status={kycStatus} />
      </div>

      {/* KYC alert card */}
      {kycStatus !== 'VERIFIED' && <KycAlertCard kyc={kyc} status={kycStatus} />}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active loan balance"
          value={<Amount value={dashboard.remainingBalance} />}
          sub={`of ${formatCurrency(dashboard.totalActiveLoan)} total`}
          icon={HandCoins}
          tone="emerald"
        />
        <StatCard
          label="Next payment"
          value={<Amount value={dashboard.nextPayment} />}
          sub={dashboard.nextPaymentDueDate ? `Due ${formatDate(dashboard.nextPaymentDueDate)}` : undefined}
          icon={Wallet}
          tone="blue"
        />
        <StatCard
          label="Savings balance"
          value={<Amount value={dashboard.savingsBalance} />}
          sub={<Link to="/portal/savings" className="text-emerald-600 hover:underline">View savings</Link>}
          icon={PiggyBank}
          tone="violet"
        />
        <StatCard
          label="Loan status"
          value={<StatusBadge status={dashboard.loanStatus} />}
          sub={`${dashboard.activeLoansCount} active loan${dashboard.activeLoansCount === 1 ? '' : 's'}`}
          icon={ReceiptText}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Loan progress */}
          <Card>
            <CardHeader>
              <CardTitle>Loan repayment progress</CardTitle>
              <Link to="/portal/loans" className="text-xs font-medium text-emerald-700 hover:underline">
                View loans <ChevronRight className="inline h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-3 gap-4">
                <InfoRow label="Total loan" value={formatCurrency(totalDisbursed)} />
                <InfoRow label="Paid so far" value={formatCurrency(totalPaid)} />
                <InfoRow label="Remaining" value={formatCurrency(dashboard.remainingBalance)} />
              </div>
              <div className="mt-3">
                <ProgressBar value={loanProgress} max={100} showLabel label="Repaid" />
              </div>
              {dashboard.remainingBalance > 0 && dashboard.nextPaymentDueDate && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3">
                  <div className="text-sm">
                    <span className="text-slate-500">Next payment:</span>{' '}
                    <span className="font-semibold text-emerald-700">{formatCurrency(dashboard.nextPayment)}</span>
                    <span className="text-slate-400"> due {formatDate(dashboard.nextPaymentDueDate)}</span>
                  </div>
                  <Link to="/portal/payments">
                    <Button size="sm" variant="secondary">
                      Make a payment
                    </Button>
                  </Link>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Repayment chart */}
          <AreaChartCard
            title="Repayments · last 6 months"
            subtitle="Your monthly installment payments"
            data={repaymentData}
            height={200}
          />

          {/* Recent transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <Link to="/portal/transactions" className="text-xs font-medium text-emerald-700 hover:underline">
                View all <ChevronRight className="inline h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardBody className="px-2 pb-2">
              {dashboard.recentTransactions.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">No recent activity yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dashboard.recentTransactions.map((t) => {
                    const tone = transactionTone(t.type);
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-3 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50">
                          {transactionIcon(t.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{t.description || t.type}</p>
                          <p className="text-xs text-slate-400">{formatDate(t.date)} · {t.referenceNumber}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-semibold tabular-nums ${tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-slate-800' : 'text-slate-700'}`}>
                            {tone === 'negative' ? '−' : tone === 'positive' ? '' : ''}
                            {formatCurrency(t.amount)}
                          </span>
                          <p className="text-[11px] text-slate-400">{t.type.replace(/_/g, ' ')}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {kycStatus === 'VERIFIED' ? (
                <QuickLink to="/portal/apply" icon={FilePlus2} label="Apply for a loan" desc="Start a new application" />
              ) : (
                <QuickLink to="/portal/kyc" icon={ShieldCheck} label="Complete KYC first" desc="Verification required to apply" />
              )}
              <QuickLink to="/portal/payments" icon={ReceiptText} label="Make a payment" desc="Submit payment proof" />
              <QuickLink to="/portal/savings" icon={PiggyBank} label="Manage savings" desc="Deposits & withdrawals" />
              <QuickLink to="/portal/documents" icon={Bell} label="Documents" desc="Statements & receipts" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <Link to="/portal/notifications" className="text-xs font-medium text-emerald-700 hover:underline">
                Open <ChevronRight className="inline h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">Payment reminder</span> — your installment is due soon.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-xs text-emerald-800">
                  <span className="font-semibold">Savings deposit</span> — a recent deposit was posted to your account.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-700 to-teal-800 text-white">
            <CardBody>
              <p className="text-sm font-semibold">Need help with your account?</p>
              <p className="mt-1 text-xs text-emerald-100/80">
                Our support team is available Mon–Sat, 8 AM to 6 PM.
              </p>
              <Link to="/portal/support">
                <Button size="sm" className="mt-3 bg-white/15 text-white hover:bg-white/25">
                  Contact support
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};

const QuickLink: React.FC<{ to: string; icon: React.ElementType; label: string; desc: string }> = ({ to, icon: Icon, label, desc }) => (
  <Link
    to={to}
    className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50"
  >
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-slate-800">{label}</p>
      <p className="text-xs text-slate-400">{desc}</p>
    </div>
    <ChevronRight className="h-4 w-4 text-slate-300" />
  </Link>
);

const KYC_ACTIONS: Record<KYCStatus, { to: string; label: string; disabled?: boolean }> = {
  VERIFIED: { to: '/portal/apply', label: 'Apply for a loan' },
  NOT_STARTED: { to: '/portal/kyc', label: 'Complete KYC First' },
  PENDING: { to: '/portal/kyc', label: 'KYC Under Review', disabled: true },
  UNDER_REVIEW: { to: '/portal/kyc', label: 'KYC Under Review', disabled: true },
  CORRECTION_REQUIRED: { to: '/portal/kyc', label: 'Update KYC' },
  REJECTED: { to: '/portal/kyc', label: 'Review KYC' },
  EXPIRED: { to: '/portal/kyc', label: 'Update KYC' },
};

const KycApplyButton: React.FC<{ status: KYCStatus }> = ({ status }) => {
  const action = KYC_ACTIONS[status] || KYC_ACTIONS.NOT_STARTED;
  if (status === 'VERIFIED') {
    return (
      <Link to={action.to}>
        <Button>
          <FilePlus2 className="h-4 w-4" /> {action.label}
        </Button>
      </Link>
    );
  }
  return (
    <Link to={action.to}>
      <Button variant={status === 'REJECTED' ? 'outline' : 'primary'} disabled={action.disabled}>
        <ShieldCheck className="h-4 w-4" /> {action.label}
      </Button>
    </Link>
  );
};

const KycAlertCard: React.FC<{ kyc: KycStatusData | null; status: KYCStatus }> = ({ kyc, status }) => {
  const base = 'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3';
  const reason = kyc?.correctionReason || kyc?.rejectionReason;
  const config: Record<KYCStatus, { cls: string; icon: React.ElementType; title: string; desc: string }> = {
    NOT_STARTED: {
      cls: 'border-amber-200 bg-amber-50',
      icon: ShieldCheck,
      title: 'KYC verification required',
      desc: 'Complete your Know-Your-Customer verification to apply for a loan.',
    },
    PENDING: {
      cls: 'border-gold-400/30 bg-gold-500/10',
      icon: Clock,
      title: 'KYC under review',
      desc: 'Your KYC submission is being reviewed. You can apply for a loan once verified.',
    },
    UNDER_REVIEW: {
      cls: 'border-gold-400/30 bg-gold-500/10',
      icon: Eye,
      title: 'KYC under review',
      desc: 'Your information is being reviewed by our staff.',
    },
    CORRECTION_REQUIRED: {
      cls: 'border-amber-200 bg-amber-50',
      icon: AlertTriangle,
      title: 'KYC correction required',
      desc: reason ? `Correction needed: ${reason}` : 'Please update your KYC information.',
    },
    REJECTED: {
      cls: 'border-rose-200 bg-rose-50',
      icon: XCircle,
      title: 'KYC rejected',
      desc: reason ? `Reason: ${reason}` : 'Your KYC application was not approved.',
    },
    EXPIRED: {
      cls: 'border-rose-200 bg-rose-50',
      icon: Clock,
      title: 'KYC expired',
      desc: 'Your KYC verification has expired. Please update your information.',
    },
    VERIFIED: {
      cls: 'border-emerald-200 bg-emerald-50',
      icon: BadgeCheck,
      title: 'KYC verified',
      desc: 'Your identity has been verified. You are eligible to apply for a loan.',
    },
  };
  const cfg = config[status] || config.NOT_STARTED;
  const Icon = cfg.icon;
  return (
    <div className={`${base} ${cfg.cls}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">{cfg.title}</p>
          <p className="text-xs opacity-80">{cfg.desc}</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;