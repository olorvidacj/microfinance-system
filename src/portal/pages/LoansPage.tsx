import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus2, CheckCircle2, ChevronRight, Clock, HandCoins, Search, ShieldCheck, XCircle } from 'lucide-react';
import { loanService, LoanSummary } from '../services/loans';
import { profileService } from '../services/profile';
import { ClientLoan, KYCStatus, LoanApplication } from '../types';
import { formatCurrency, formatDate } from '../../utils/loanMath';
import {
  Amount,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  ProgressBar,
  StatusBadge,
  Table,
  Td,
  Tr,
} from '../components/ui';

const LoansPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'active' | 'applications' | 'completed'>('active');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, apps, k] = await Promise.all([loanService.list(), loanService.applications(), profileService.kycStatus()]);
      setSummary(s);
      setApplications(apps);
      if (k) setKycStatus(k.kycStatus as KYCStatus);
    } catch (err: any) {
      setError(err.message || 'Unable to load loans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState label="Loading your loans…" />;
  if (error || !summary) return <ErrorState message={error || 'No loan data.'} onRetry={load} />;

  const active = summary.activeLoans;
  const completed = summary.completedLoans;

  const applyLabel = (): { to: string; label: string; disabled?: boolean } => {
    switch (kycStatus) {
      case 'VERIFIED':
        return { to: '/portal/apply', label: 'Apply for a loan' };
      case 'NOT_STARTED':
        return { to: '/portal/kyc', label: 'Complete KYC First' };
      case 'PENDING':
      case 'UNDER_REVIEW':
        return { to: '/portal/kyc', label: 'KYC Under Review', disabled: true };
      case 'CORRECTION_REQUIRED':
      case 'EXPIRED':
        return { to: '/portal/kyc', label: 'Update KYC' };
      case 'REJECTED':
        return { to: '/portal/kyc', label: 'Review KYC' };
      default:
        return { to: '/portal/kyc', label: 'Complete KYC First' };
    }
  };

  const apply = applyLabel();

  const ApplyButton: React.FC = () => (
    <Link to={apply.to}>
      <Button disabled={apply.disabled}>
        {apply.disabled ? <Clock className="h-4 w-4" /> : kycStatus === 'VERIFIED' ? <FilePlus2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{' '}
        {apply.label}
      </Button>
    </Link>
  );

  const tabs = [
    { id: 'active' as const, label: 'Active Loans', badge: active.length },
    { id: 'applications' as const, label: 'Applications', badge: applications.length },
    { id: 'completed' as const, label: 'Completed', badge: completed.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Loans</h1>
          <p className="text-sm text-slate-500">Track your loans, applications, and payment schedules.</p>
        </div>
        <ApplyButton />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                  tab === t.id ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'active' &&
        (active.length === 0 ? (
          <Card>
            <EmptyState
              icon={<HandCoins className="h-6 w-6" />}
              title="No active loans"
              description="When your loan is approved and disbursed, it will appear here."
              action={
                <Link to={apply.to}>
                  <Button size="sm" disabled={apply.disabled}>
                    {apply.label}
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {active.map((loan) => (
              <LoanCard key={loan.id} loan={loan} onClick={() => navigate(`/portal/loans/${loan.id}`)} />
            ))}
          </div>
        ))}

      {tab === 'applications' &&
        (applications.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="No applications yet"
              description="Start your first loan application to get started."
            />
          </Card>
        ) : (
          <Card>
            <Table
              headers={['Application', 'Amount', 'Term', 'Date', 'Status', 'Co-op step', '']}
            >
              {applications.map((app) => (
                <Tr key={app.id}>
                  <Td>
                    <span className="font-mono text-xs font-semibold">{app.id}</span>
                  </Td>
                  <Td>
                    <Amount value={app.principalAmount} /> <span className="text-xs text-slate-400">{app.productName}</span>
                  </Td>
                  <Td>{app.termMonths} mo</Td>
                  <Td>{formatDate(app.applicationDate)}</Td>
                  <Td>
                    <StatusBadge status={app.status} />
                  </Td>
                  <Td>
                    {app.status === 'REJECTED' ? (
                      <span className="flex items-center gap-1 text-xs text-rose-600">
                        <XCircle className="h-3.5 w-3.5" /> {app.rejectionReason || 'Rejected'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        {app.status === 'PENDING' ? <Clock className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {(app.coopStep || app.status).replace(/_/g, ' ')}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </Td>
                </Tr>
              ))}
            </Table>
          </Card>
        ))}

      {tab === 'completed' &&
        (completed.length === 0 ? (
          <Card>
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="No completed loans yet" />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {completed.map((loan) => (
              <LoanCard key={loan.id} loan={loan} completed onClick={() => navigate(`/portal/loans/${loan.id}`)} />
            ))}
          </div>
        ))}
    </div>
  );
};

const LoanCard: React.FC<{ loan: ClientLoan; onClick?: () => void; completed?: boolean }> = ({ loan, onClick, completed }) => {
  const total = (loan.paidAmount || 0) + (loan.remainingBalance || 0);
  const progress = total > 0 ? Math.round(((loan.paidAmount || 0) / total) * 100) : 0;

  return (
    <Card className={`p-5 ${onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold text-slate-400">{loan.loanNumber}</p>
          <h3 className="mt-0.5 text-base font-semibold text-slate-800">{loan.productName}</h3>
        </div>
        <StatusBadge status={completed ? 'COMPLETED' : loan.status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Principal</p>
          <p className="text-sm font-semibold tabular-nums text-slate-800">{formatCurrency(loan.principalAmount)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Installment</p>
          <p className="text-sm font-semibold tabular-nums text-slate-800">{formatCurrency(loan.monthlyInstallment)}/mo</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{completed ? 'Settled' : 'Balance'}</p>
          <p className="text-sm font-semibold tabular-nums text-slate-800">{formatCurrency(loan.remainingBalance)}</p>
        </div>
      </div>

      {!completed && (
        <div className="mt-4">
          <ProgressBar value={progress} max={100} barClassName={loan.status === 'OVERDUE' || loan.status === 'IN_ARREARS' ? 'bg-rose-500' : undefined} />
        </div>
      )}

      {!completed && loan.nextPaymentDate && (
        <p className="mt-3 text-xs text-slate-500">
          Next payment: <span className="font-medium text-slate-700">{formatCurrency(loan.monthlyInstallment)}</span> ·{' '}
          {formatDate(loan.nextPaymentDate)}
        </p>
      )}
      {completed && (
        <p className="mt-3 text-xs text-emerald-600">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Paid in full · {formatDate(loan.maturityDate || loan.startDate)}
        </p>
      )}
    </Card>
  );
};

export default LoansPage;