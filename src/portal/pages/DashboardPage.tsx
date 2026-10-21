import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
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
  UsersRound,
  Wallet,
  XCircle,
} from 'lucide-react';
import { dashboardService, type ClientDashboardView } from '../services/dashboard';
import { profileService } from '../services/profile';
import { KYCStatus, KycStatusData } from '../types';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/loanMath';
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorState, LoadingState, StatusBadge, AreaChartCard } from '../components/ui';
import { StatCard } from '../components/common';
import { KycStatusBadge } from '../../components/KycStatusBadge';
import { isKycVerified } from '../../../shared/kyc-core';
import { GROUP_ROLE_LABELS, centsFromDb, type GroupRole } from '../../../shared/lending';
import { peso } from '../../components/lending';

const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' });

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ClientDashboardView | null>(null);
  const [kyc, setKyc] = useState<KycStatusData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [d, k] = await Promise.all([dashboardService.get(), profileService.kycStatus()]);
      setDashboard(d);
      setKyc(k);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState label="Loading your dashboard…" />;
  if (error || !dashboard) return <ErrorState message={error || 'No data available.'} onRetry={load} />;

  const firstName = (dashboard.member.fullName || user?.fullName || '').split(' ')[0];
  const kycStatus = (kyc?.kycStatus || dashboard.member.kycStatus || 'NOT_STARTED') as KYCStatus;
  const { loans, savings } = dashboard;
  const chart = dashboard.repayments.map((r) => ({ name: monthLabel(r.month), value: centsFromDb(r.amount) / 100 }));
  const repaidAny = dashboard.repayments.some((r) => centsFromDb(r.amount) > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hi, {firstName}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            Member <span className="font-mono text-xs font-medium text-slate-600">{dashboard.member.memberNumber}</span>
            <KycStatusBadge status={kycStatus} size="sm" />
          </p>
        </div>
        <KycApplyButton status={kycStatus} />
      </div>

      {!isKycVerified(kycStatus) && <KycAlertCard kyc={kyc} status={kycStatus} />}
      {loans.overdueCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {loans.overdueCount === 1 ? 'One of your loans is' : `${loans.overdueCount} of your loans are`} behind. Paying now stops further penalties.</span>
          <Link to="/portal/payments"><Button size="sm" variant="outline">Pay now</Button></Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Loan balance" value={peso(loans.outstanding)} sub={`${loans.running.length} running loan${loans.running.length === 1 ? '' : 's'}`} icon={HandCoins} tone="emerald" />
        <StatCard
          label="Next payment"
          value={loans.nextDue ? peso(loans.nextDue.amount) : '—'}
          sub={loans.nextDue ? `Due ${formatDate(loans.nextDue.dueDate)}${loans.nextDue.loanNumber ? ` · ${loans.nextDue.loanNumber}` : ''}` : 'Nothing due'}
          icon={Wallet}
          tone="blue"
        />
        <StatCard label="Savings" value={peso(savings.total)} sub={`${savings.accounts.length} account${savings.accounts.length === 1 ? '' : 's'}`} icon={PiggyBank} tone="violet" />
        <StatCard label="Applications" value={loans.pendingApplications.length} sub={loans.pendingApplications.length ? 'Waiting for a decision' : 'None pending'} icon={ReceiptText} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>My loans</CardTitle>
              <Link to="/portal/loans" className="text-xs font-medium text-emerald-700 hover:underline">View all <ChevronRight className="inline h-3.5 w-3.5" /></Link>
            </CardHeader>
            <CardBody className="space-y-3">
              {loans.running.length === 0 && loans.pendingApplications.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">You have no loans yet.</p>
              ) : (
                <>
                  {loans.running.map((l) => (
                    <Link key={l.id} to={`/portal/loans/${l.id}`} className="block rounded-xl border border-slate-100 p-3 hover:border-emerald-200" data-testid="dashboard-loan">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{l.productName} <span className="font-mono text-xs text-slate-400">{l.loanNumber}</span></p>
                        <StatusBadge status={l.daysBehind > 0 ? 'Overdue' : l.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                        <span>Balance <strong className="tabular-nums text-slate-800">{peso(l.remainingBalance)}</strong></span>
                        <span>Paid <strong className="tabular-nums text-slate-800">{peso(l.totalPaid)}</strong> of {peso(l.totalPayable)}</span>
                        {l.nextDue && <span>Next <strong className="tabular-nums text-slate-800">{peso(l.nextDue.amount)}</strong> on {formatDate(l.nextDue.dueDate)}</span>}
                      </div>
                    </Link>
                  ))}
                  {loans.pendingApplications.map((l) => (
                    <Link key={l.id} to={`/portal/loans/${l.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 p-3 text-sm hover:border-emerald-200">
                      <span>{l.productName} · {peso(l.principal)} <span className="text-xs text-slate-400">applied {formatDate(l.applicationDate)}</span></span>
                      <StatusBadge status={l.status} />
                    </Link>
                  ))}
                </>
              )}
            </CardBody>
          </Card>

          {repaidAny ? (
            <AreaChartCard title="Repayments · last 6 months" subtitle="What you paid on your loans each month" data={chart} height={200} />
          ) : (
            <Card>
              <CardBody className="text-sm text-slate-400">Your repayments will be charted here once you start paying.</CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <Link to="/portal/transactions" className="text-xs font-medium text-emerald-700 hover:underline">View all <ChevronRight className="inline h-3.5 w-3.5" /></Link>
            </CardHeader>
            <CardBody className="px-2 pb-2">
              {dashboard.recentActivity.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">No activity yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dashboard.recentActivity.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{t.label}</p>
                        <p className="text-xs text-slate-400">{formatDate(t.date)} · {t.reference}</p>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums ${t.direction === 'OUT' ? 'text-slate-800' : 'text-emerald-600'}`}>
                        {t.direction === 'OUT' ? '−' : '+'}{peso(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Savings</CardTitle>
              <Link to="/portal/savings" className="text-xs font-medium text-emerald-700 hover:underline">Open <ChevronRight className="inline h-3.5 w-3.5" /></Link>
            </CardHeader>
            <CardBody className="space-y-2">
              {savings.accounts.length === 0 ? (
                <p className="text-sm text-slate-400">No savings account yet. One is opened when your KYC is approved.</p>
              ) : (
                savings.accounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm" data-testid="dashboard-savings">
                    <span>{a.productName} <span className="block text-xs text-slate-400">{a.passbookNumber}</span></span>
                    <span className="font-semibold tabular-nums text-slate-800">{peso(a.balance)}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {dashboard.group && (
            <Card>
              <CardBody className="flex items-center gap-3">
                <UsersRound className="h-5 w-5 text-emerald-600" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-slate-800">{dashboard.group.name}</p>
                  <p className="text-xs text-slate-500">You are the {GROUP_ROLE_LABELS[dashboard.group.role as GroupRole]?.toLowerCase() ?? 'member'}</p>
                </div>
                <Link to="/portal/groups" className="text-xs font-medium text-emerald-700 hover:underline">Open</Link>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications{dashboard.notifications.unread ? ` (${dashboard.notifications.unread} new)` : ''}</CardTitle>
              <Link to="/portal/notifications" className="text-xs font-medium text-emerald-700 hover:underline">Open <ChevronRight className="inline h-3.5 w-3.5" /></Link>
            </CardHeader>
            <CardBody className="space-y-2">
              {dashboard.notifications.latest.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing yet.</p>
              ) : (
                dashboard.notifications.latest.map((n) => (
                  <div key={n.id} className={`rounded-xl border px-3 py-2 text-xs ${n.isRead ? 'border-slate-100 text-slate-600' : 'border-emerald-100 bg-emerald-50 text-emerald-900'}`}>
                    <p className="font-semibold">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2">{n.message}</p>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {isKycVerified(kycStatus) ? (
                <QuickLink to="/portal/apply" icon={FilePlus2} label="Apply for a loan" desc="Start a new application" />
              ) : (
                <QuickLink to="/portal/kyc" icon={ShieldCheck} label="Complete KYC first" desc="Verification required to apply" />
              )}
              <QuickLink to="/portal/payments" icon={ReceiptText} label="Send payment proof" desc="For a GCash or bank transfer" />
              <QuickLink to="/portal/savings" icon={PiggyBank} label="Savings" desc="Statements and withdrawals" />
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
  APPROVED: { to: '/portal/apply', label: 'Apply for a loan' },
  NOT_STARTED: { to: '/portal/kyc', label: 'Complete KYC First' },
  IN_PROGRESS: { to: '/portal/kyc', label: 'Continue KYC' },
  SUBMITTED: { to: '/portal/kyc', label: 'KYC Under Review', disabled: true },
  PENDING: { to: '/portal/kyc', label: 'KYC Under Review', disabled: true },
  UNDER_REVIEW: { to: '/portal/kyc', label: 'KYC Under Review', disabled: true },
  CORRECTION_REQUIRED: { to: '/portal/kyc', label: 'Update KYC' },
  REJECTED: { to: '/portal/kyc', label: 'Review KYC' },
  SUSPENDED: { to: '/portal/kyc', label: 'KYC Suspended', disabled: true },
  EXPIRED: { to: '/portal/kyc', label: 'Update KYC' },
};

const KycApplyButton: React.FC<{ status: KYCStatus }> = ({ status }) => {
  const action = KYC_ACTIONS[status] || KYC_ACTIONS.NOT_STARTED;
  if (status === 'VERIFIED' || status === 'APPROVED') {
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
      desc: 'Complete your Know-Your-Customer verification to access microfinance services and loans.',
    },
    IN_PROGRESS: {
      cls: 'border-amber-200 bg-amber-50',
      icon: ShieldCheck,
      title: 'KYC draft in progress',
      desc: 'You have a draft KYC submission. Please complete all steps and submit for verification.',
    },
    SUBMITTED: {
      cls: 'border-gold-400/30 bg-gold-500/10',
      icon: Clock,
      title: 'KYC submitted for review',
      desc: 'Your KYC submission has been received and is waiting for compliance review.',
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
      desc: 'Your information is being reviewed by our compliance staff.',
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
    SUSPENDED: {
      cls: 'border-rose-200 bg-rose-50',
      icon: XCircle,
      title: 'KYC suspended',
      desc: 'Your KYC status has been suspended. Please contact your branch officer.',
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
    APPROVED: {
      cls: 'border-emerald-200 bg-emerald-50',
      icon: BadgeCheck,
      title: 'KYC verified & approved',
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