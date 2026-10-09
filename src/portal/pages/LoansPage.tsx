import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FilePlus2,
  CheckCircle2,
  ChevronRight,
  Clock,
  HandCoins,
  Search,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  ReceiptText,
  Calendar,
  Wallet,
  ArrowRight,
  Info,
  Building2,
  Eye,
  RefreshCw,
  CreditCard,
  History,
  TrendingDown,
  Layers,
  FileCheck2,
} from 'lucide-react';
import { loanService, LoanSummary, ClientPaymentRow } from '../services/loans';
import { profileService } from '../services/profile';
import { ClientLoan, KYCStatus, LoanApplication, ScheduleItem } from '../types';
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
  Modal,
} from '../components/ui';
import { InfoRow, SectionDivider } from '../components/common';

const LoansPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [payments, setPayments] = useState<ClientPaymentRow[]>([]);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'active' | 'applications' | 'history' | 'completed'>('active');

  // Modal inspection state for quick loan/application review
  const [inspectLoan, setInspectLoan] = useState<ClientLoan | null>(null);
  const [inspectSchedule, setInspectSchedule] = useState<ScheduleItem[]>([]);
  const [inspectPayments, setInspectPayments] = useState<ClientPaymentRow[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectApp, setInspectApp] = useState<LoanApplication | null>(null);

  const initialTab = params.get('tab');
  useEffect(() => {
    if (initialTab && ['active', 'applications', 'history', 'completed'].includes(initialTab)) {
      setTab(initialTab as any);
    }
  }, [initialTab]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, apps, pList, k] = await Promise.all([
        loanService.list(),
        loanService.applications(),
        loanService.payments().catch(() => []),
        profileService.kycStatus().catch(() => null),
      ]);
      setSummary(s);
      setApplications(apps);
      setPayments(pList);
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

  const openLoanDetailsModal = async (loan: ClientLoan) => {
    setInspectLoan(loan);
    setInspectApp(null);
    setInspectLoading(true);
    try {
      const res = await loanService.get(loan.id);
      setInspectSchedule(res.schedule || []);
      setInspectPayments(res.payments || []);
    } catch {
      setInspectSchedule([]);
      setInspectPayments([]);
    } finally {
      setInspectLoading(false);
    }
  };

  const openAppDetailsModal = (app: LoanApplication) => {
    setInspectApp(app);
    setInspectLoan(null);
  };

  if (loading) return <LoadingState label="Loading your loan portfolio and applications…" />;
  if (error || !summary) return <ErrorState message={error || 'No loan data found.'} onRetry={load} />;

  const stats = summary.summary;
  const active = summary.activeLoans;
  const completed = summary.completedLoans;
  const pendingApps = applications.length > 0 ? applications : summary.pendingApplications;

  const isKycApproved = kycStatus === 'VERIFIED' || kycStatus === 'APPROVED';

  const applyLabel = (): { to: string; label: string; disabled?: boolean; notice?: string } => {
    switch (kycStatus) {
      case 'VERIFIED':
      case 'APPROVED':
        return { to: '/portal/apply', label: 'Apply for a Loan' };
      case 'NOT_STARTED':
        return {
          to: '/portal/kyc',
          label: 'Complete KYC to Apply',
          notice: 'Account verification required before applying for a loan.',
        };
      case 'SUBMITTED':
      case 'PENDING':
      case 'UNDER_REVIEW':
        return {
          to: '/portal/kyc',
          label: 'KYC Under Review',
          disabled: true,
          notice: 'Your KYC application is currently being reviewed by our compliance team.',
        };
      case 'CORRECTION_REQUIRED':
        return {
          to: '/portal/kyc',
          label: 'Update KYC Verification',
          notice: 'Staff requested corrections on your KYC before you can apply for a loan.',
        };
      case 'REJECTED':
        return {
          to: '/portal/kyc',
          label: 'Review KYC Submission',
          notice: 'Your KYC was not approved. Please update your details to proceed.',
        };
      default:
        return {
          to: '/portal/kyc',
          label: 'Complete KYC First',
          notice: 'Complete your cooperative membership KYC to unlock microloans.',
        };
    }
  };

  const applyCfg = applyLabel();

  const tabs = [
    { id: 'active' as const, label: 'Active Loans', badge: active.length, icon: HandCoins },
    { id: 'applications' as const, label: 'My Applications', badge: pendingApps.length, icon: FileCheck2 },
    { id: 'history' as const, label: 'Payment History', badge: payments.length, icon: History },
    { id: 'completed' as const, label: 'Completed Loans', badge: completed.length, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Main Call to Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Loans & Applications</h1>
          <p className="text-sm text-slate-500">
            Real-time tracking of your microfinance loans, application status, and repayment history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} title="Refresh data">
            <RefreshCw className="h-4 w-4 text-slate-500" /> Refresh
          </Button>
          <Link to={applyCfg.to}>
            <Button disabled={applyCfg.disabled} variant="brand">
              {applyCfg.disabled ? (
                <Clock className="h-4 w-4" />
              ) : isKycApproved ? (
                <FilePlus2 className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {applyCfg.label}
            </Button>
          </Link>
        </div>
      </div>

      {/* KYC & Eligibility Status Banner */}
      {!isKycApproved && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">KYC Verification Required for Loan Origination</p>
              <p className="text-xs text-amber-700">
                {applyCfg.notice ||
                  'Your HOSCOMCO membership profile must have an Approved KYC status before submitting a loan application.'}
              </p>
            </div>
          </div>
          <Link to={applyCfg.to}>
            <Button size="sm" variant="outline" className="shrink-0 border-amber-300 bg-white text-amber-800 hover:bg-amber-100">
              Complete KYC <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* 1. Summary Cards (Calculated from Real Database Data) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard
          title="Total Loans"
          value={stats.totalLoans.toString()}
          subtitle="All recorded items"
          icon={Layers}
          tone="slate"
        />
        <SummaryCard
          title="Active Loans"
          value={stats.activeLoansCount.toString()}
          subtitle="In repayment"
          icon={HandCoins}
          tone="emerald"
        />
        <SummaryCard
          title="Applications"
          value={stats.pendingApplicationsCount.toString()}
          subtitle="Pending / In review"
          icon={Clock}
          tone="blue"
        />
        <SummaryCard
          title="Outstanding Balance"
          value={formatCurrency(stats.totalOutstandingBalance)}
          subtitle="Principal & remaining"
          icon={TrendingDown}
          tone={stats.totalOutstandingBalance > 0 ? 'amber' : 'emerald'}
        />
        <SummaryCard
          title="Next Due Amount"
          value={stats.nextPaymentAmount > 0 ? formatCurrency(stats.nextPaymentAmount) : '₱0.00'}
          subtitle={stats.nextPaymentDueDate ? `Due: ${formatDate(stats.nextPaymentDueDate)}` : 'No payment due'}
          icon={CreditCard}
          tone="emerald"
        />
        <SummaryCard
          title="Total Repaid"
          value={formatCurrency(stats.totalAmountPaid)}
          subtitle="Cumulative paid"
          icon={CheckCircle2}
          tone="teal"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
              {t.badge > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ACTIVE LOANS */}
      {tab === 'active' && (
        <div className="space-y-4">
          {active.length === 0 ? (
            <Card>
              <EmptyState
                icon={<HandCoins className="h-8 w-8 text-slate-400" />}
                title="No active loans"
                description="When your loan application is approved and disbursed by the branch, your active loan and payment schedule will appear here."
                action={
                  <Link to={applyCfg.to}>
                    <Button disabled={applyCfg.disabled} variant="brand" size="sm">
                      {applyCfg.label}
                    </Button>
                  </Link>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {active.map((loan) => (
                <ActiveLoanCard
                  key={loan.id}
                  loan={loan}
                  onViewDetails={() => openLoanDetailsModal(loan)}
                  onFullPage={() => navigate(`/portal/loans/${loan.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY LOAN APPLICATIONS */}
      {tab === 'applications' && (
        <div className="space-y-4">
          {pendingApps.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Search className="h-8 w-8 text-slate-400" />}
                title="No loan applications found"
                description="You have not submitted any loan applications yet. Complete KYC verification and start an application."
                action={
                  <Link to={applyCfg.to}>
                    <Button disabled={applyCfg.disabled} variant="brand" size="sm">
                      {applyCfg.label}
                    </Button>
                  </Link>
                }
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  onViewDetails={() => openAppDetailsModal(app)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENT HISTORY */}
      {tab === 'history' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Repayment Transaction History</CardTitle>
              <p className="text-xs text-slate-500">Official receipts and credited payment records from database</p>
            </div>
            <Link to="/portal/payments">
              <Button size="sm" variant="outline">
                <ReceiptText className="h-3.5 w-3.5" /> Make a Payment
              </Button>
            </Link>
          </CardHeader>
          {payments.length === 0 ? (
            <CardBody>
              <div className="py-8 text-center text-slate-400">
                <ReceiptText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">No repayment receipts recorded yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  When you settle loan installments via cash desk or online channels, receipts will appear here.
                </p>
              </div>
            </CardBody>
          ) : (
            <Table headers={['Date', 'Receipt #', 'Loan #', 'Amount Paid', 'Method / Channel', 'Principal / Interest', 'Status / Collector']}>
              {payments.map((p) => (
                <Tr key={p.id}>
                  <Td className="whitespace-nowrap font-medium text-slate-800">{formatDate(p.paymentDate)}</Td>
                  <Td className="font-mono text-xs font-semibold text-emerald-700">{p.receiptNumber}</Td>
                  <Td className="font-mono text-xs text-slate-600">{p.loanNumber}</Td>
                  <Td className="font-bold text-slate-900">{formatCurrency(p.amount)}</Td>
                  <Td>
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {p.paymentMethod.replace(/_/g, ' ')}
                    </span>
                  </Td>
                  <Td className="text-xs text-slate-500">
                    P: {formatCurrency(p.principalPortion)} · I: {formatCurrency(p.interestPortion)}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Credited ({p.collectedBy})
                    </span>
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* TAB 4: COMPLETED LOANS */}
      {tab === 'completed' && (
        <div className="space-y-4">
          {completed.length === 0 ? (
            <Card>
              <EmptyState
                icon={<CheckCircle2 className="h-8 w-8 text-slate-400" />}
                title="No completed loans yet"
                description="Loans that have been fully paid off and closed will be archived here."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {completed.map((loan) => (
                <ActiveLoanCard
                  key={loan.id}
                  loan={loan}
                  completed
                  onViewDetails={() => openLoanDetailsModal(loan)}
                  onFullPage={() => navigate(`/portal/loans/${loan.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* LOAN INSPECTION MODAL */}
      {inspectLoan && (
        <Modal
          open={!!inspectLoan}
          onClose={() => setInspectLoan(null)}
          title={`Loan Overview · ${inspectLoan.loanNumber}`}
          size="lg"
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{inspectLoan.productName}</h3>
                <p className="font-mono text-xs text-slate-400">Account #{inspectLoan.loanNumber}</p>
              </div>
              <StatusBadge status={inspectLoan.status} />
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Principal</p>
                <p className="text-base font-bold text-slate-900">{formatCurrency(inspectLoan.principalAmount)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Remaining Balance</p>
                <p className="text-base font-bold text-amber-700">{formatCurrency(inspectLoan.remainingBalance)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Amount Paid</p>
                <p className="text-base font-bold text-emerald-700">{formatCurrency(inspectLoan.paidAmount || 0)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Monthly Installment</p>
                <p className="text-base font-bold text-slate-900">{formatCurrency(inspectLoan.monthlyInstallment)}</p>
              </div>
            </div>

            {/* Detailed Parameters */}
            <div className="space-y-1 rounded-xl border border-slate-100 bg-white p-3 text-xs">
              <InfoRow label="Interest Rate" value={`${inspectLoan.interestRate}% per annum (${inspectLoan.interestType || 'Reducing Balance'})`} />
              <InfoRow label="Loan Tenor / Term" value={`${inspectLoan.termMonths} Months`} />
              <InfoRow label="Application Date" value={formatDate(inspectLoan.applicationDate)} />
              <InfoRow label="Disbursement Date" value={formatDate(inspectLoan.startDate || inspectLoan.disbursedDate)} />
              <InfoRow label="Maturity Date" value={formatDate(inspectLoan.maturityDate)} />
              <InfoRow label="Loan Purpose" value={inspectLoan.purpose || 'General Financing'} />
            </div>

            {/* Repayments Schedule Preview */}
            <div>
              <div className="flex items-center justify-between pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Amortization Schedule</h4>
                <span className="text-xs text-slate-400">
                  {inspectSchedule.filter((s) => s.status === 'PAID').length} of {inspectSchedule.length} installments settled
                </span>
              </div>
              {inspectLoading ? (
                <LoadingState label="Loading schedule details…" />
              ) : inspectSchedule.length === 0 ? (
                <p className="text-xs text-slate-400">No schedule records available.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                  <Table headers={['#', 'Due Date', 'Amount Due', 'Principal', 'Interest', 'Balance', 'Status']}>
                    {inspectSchedule.map((s) => (
                      <Tr key={s.installmentNumber}>
                        <Td className="text-slate-400">#{s.installmentNumber}</Td>
                        <Td className="font-medium text-slate-800">{formatDate(s.dueDate)}</Td>
                        <Td className="font-bold text-slate-900">{formatCurrency(s.amountDue)}</Td>
                        <Td className="text-slate-500">{formatCurrency(s.principal)}</Td>
                        <Td className="text-slate-500">{formatCurrency(s.interest)}</Td>
                        <Td className="text-slate-500">{formatCurrency(s.remainingBalance)}</Td>
                        <Td>
                          <StatusBadge status={s.status} tone={s.status === 'PAID' ? 'green' : s.status === 'DUE' ? 'red' : 'slate'} />
                        </Td>
                      </Tr>
                    ))}
                  </Table>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={() => setInspectLoan(null)}>
                Close
              </Button>
              <div className="flex gap-2">
                <Link to="/portal/payments">
                  <Button variant="brand">
                    <ReceiptText className="h-4 w-4" /> Pay Installment
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => navigate(`/portal/loans/${inspectLoan.id}`)}>
                  Full Details Page <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* APPLICATION INSPECTION MODAL */}
      {inspectApp && (
        <Modal
          open={!!inspectApp}
          onClose={() => setInspectApp(null)}
          title={`Application Details · ${inspectApp.loanNumber || inspectApp.id}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{inspectApp.productName}</h3>
                <p className="font-mono text-xs text-slate-400">{inspectApp.id}</p>
              </div>
              <StatusBadge status={inspectApp.status} />
            </div>

            {/* Status Pipeline */}
            <StatusPipelineVisualizer status={inspectApp.status} coopStep={inspectApp.coopStep} />

            {/* Rejection / Correction Feedback */}
            {inspectApp.rejectionReason && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <p className="font-bold flex items-center gap-1.5 text-rose-900">
                  <XCircle className="h-4 w-4 text-rose-600" /> Credit Decision Note
                </p>
                <p className="mt-1">{inspectApp.rejectionReason}</p>
              </div>
            )}

            {inspectApp.notes && !inspectApp.rejectionReason && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Staff Action Note
                </p>
                <p className="mt-1">{inspectApp.notes}</p>
              </div>
            )}

            <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
              <InfoRow label="Requested Amount" value={formatCurrency(inspectApp.principalAmount)} />
              <InfoRow label="Repayment Tenor" value={`${inspectApp.termMonths} Months`} />
              <InfoRow label="Repayment Frequency" value={inspectApp.repaymentFrequency || 'Monthly'} />
              <InfoRow label="Submission Date" value={formatDate(inspectApp.applicationDate)} />
              <InfoRow label="Purpose" value={inspectApp.purpose || 'Business / Personal expansion'} />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="outline" onClick={() => setInspectApp(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helper Sub-components
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  tone?: 'emerald' | 'amber' | 'blue' | 'teal' | 'slate';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, subtitle, icon: Icon, tone = 'slate' }) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const iconTones = {
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    teal: 'bg-teal-100 text-teal-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition-all hover:shadow ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">{title}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconTones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 truncate">{value}</p>
      <p className="mt-0.5 text-[11px] opacity-70 truncate">{subtitle}</p>
    </div>
  );
};

interface ActiveLoanCardProps {
  loan: ClientLoan;
  completed?: boolean;
  onViewDetails: () => void;
  onFullPage: () => void;
}

const ActiveLoanCard: React.FC<ActiveLoanCardProps> = ({ loan, completed, onViewDetails, onFullPage }) => {
  const total = (loan.paidAmount || 0) + (loan.remainingBalance || 0);
  const progress = total > 0 ? Math.min(100, Math.round(((loan.paidAmount || 0) / total) * 100)) : 0;

  return (
    <Card className="flex flex-col justify-between overflow-hidden border-slate-200/90 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs font-bold text-slate-400">{loan.loanNumber}</span>
            <h3 className="text-base font-bold text-slate-900">{loan.productName}</h3>
          </div>
          <StatusBadge status={completed ? 'COMPLETED' : loan.status} />
        </div>

        {/* Figures */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/80 p-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Principal</p>
            <p className="text-sm font-bold text-slate-900">{formatCurrency(loan.principalAmount)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly</p>
            <p className="text-sm font-bold text-slate-900">{formatCurrency(loan.monthlyInstallment)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {completed ? 'Repaid' : 'Balance'}
            </p>
            <p className={`text-sm font-bold ${completed ? 'text-emerald-700' : 'text-amber-700'}`}>
              {formatCurrency(completed ? loan.paidAmount || loan.principalAmount : loan.remainingBalance)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {!completed && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pb-1">
              <span>Repayment Progress</span>
              <span>{progress}%</span>
            </div>
            <ProgressBar value={progress} max={100} barClassName={loan.status === 'OVERDUE' || loan.status === 'IN_ARREARS' ? 'bg-rose-500' : undefined} />
          </div>
        )}

        {/* Next payment or settlement note */}
        <div className="mt-4 flex items-center justify-between text-xs">
          {!completed && loan.nextPaymentDate ? (
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              Next due: <span className="font-bold">{formatDate(loan.nextPaymentDate)}</span>
            </span>
          ) : completed ? (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Fully Settled & Closed
            </span>
          ) : (
            <span className="text-slate-400 font-medium">Standard monthly cycle</span>
          )}

          <span className="text-slate-400">Tenor: {loan.termMonths} mo</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
        <button
          onClick={onViewDetails}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-900 transition flex items-center gap-1"
        >
          <Eye className="h-3.5 w-3.5" /> View Schedule
        </button>
        <div className="flex items-center gap-2">
          {!completed && (
            <Link to="/portal/payments">
              <Button size="sm" variant="brand" className="h-7 text-xs px-2.5">
                Pay Now
              </Button>
            </Link>
          )}
          <Button size="sm" variant="outline" onClick={onFullPage} className="h-7 text-xs px-2.5">
            Details →
          </Button>
        </div>
      </div>
    </Card>
  );
};

interface ApplicationCardProps {
  app: LoanApplication;
  onViewDetails: () => void;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({ app, onViewDetails }) => {
  const normStatus = String(app.status || '').toUpperCase();
  const isRejected = normStatus === 'REJECTED' || normStatus === 'DECLINED';
  const isCorrection = normStatus === 'CORRECTION_REQUIRED' || normStatus === 'CORRECTION_REQUESTED' || normStatus === 'DRAFT';

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm transition-all hover:border-slate-300">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-400">{app.loanNumber || app.id}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                Applied {formatDate(app.applicationDate)}
              </span>
            </div>
            <h3 className="mt-1 text-base font-bold text-slate-900">{app.productName}</h3>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {/* Status Pipeline Visualizer */}
        <div className="mt-4">
          <StatusPipelineVisualizer status={app.status} coopStep={app.coopStep} />
        </div>

        {/* Staff Feedback / Rejection Note */}
        {isRejected && app.rejectionReason && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <XCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-bold text-rose-900">Application Declined</p>
              <p className="mt-0.5">{app.rejectionReason}</p>
            </div>
          </div>
        )}

        {isCorrection && (
          <div className="mt-3 flex items-start justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">Action Required: Correction Requested</p>
                <p className="mt-0.5">{app.notes || 'Please update and clarify your application details.'}</p>
              </div>
            </div>
            <Link to="/portal/apply">
              <Button size="sm" variant="brand" className="h-7 text-xs shrink-0">
                Update & Resubmit
              </Button>
            </Link>
          </div>
        )}

        {/* Summary row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex gap-4">
            <span>
              Requested: <strong className="text-slate-800">{formatCurrency(app.principalAmount)}</strong>
            </span>
            <span>
              Term: <strong className="text-slate-800">{app.termMonths} Months</strong>
            </span>
            <span>
              Frequency: <strong className="text-slate-800">{app.repaymentFrequency || 'Monthly'}</strong>
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={onViewDetails} className="h-7 text-xs">
            <Eye className="mr-1 h-3.5 w-3.5" /> View Application Details
          </Button>
        </div>
      </div>
    </Card>
  );
};

/**
 * 4-Step Application Status Pipeline Visualizer
 */
const StatusPipelineVisualizer: React.FC<{ status: string; coopStep?: string }> = ({ status, coopStep }) => {
  const norm = String(status || '').toUpperCase();
  const step = String(coopStep || '').toUpperCase();

  const isRejected = norm === 'REJECTED' || norm === 'DECLINED' || step === 'REJECTED';
  const isCorrection = norm === 'CORRECTION_REQUIRED' || norm === 'DRAFT' || step === 'CORRECTION_REQUIRED';

  let currentStep = 1; // 1: Submitted, 2: Under Review, 3: Approved, 4: Disbursed
  if (norm === 'APPROVED' || step === 'FOR_DISBURSEMENT' || step === 'CREDIT_COMMITTEE_APPROVED') {
    currentStep = 3;
  } else if (norm === 'ACTIVE' || norm === 'DISBURSED' || norm === 'COMPLETED') {
    currentStep = 4;
  } else if (norm === 'UNDER_REVIEW' || norm === 'FOR_ASSESSMENT' || step === 'CREDIT_INVESTIGATION' || step === 'CREDIT_COMMITTEE_REVIEW') {
    currentStep = 2;
  } else {
    currentStep = 1;
  }

  const pipelineSteps = [
    { num: 1, label: 'Submitted' },
    { num: 2, label: 'Under Review' },
    {
      num: 3,
      label: isRejected ? 'Declined' : isCorrection ? 'Correction Needed' : 'Approved',
      tone: isRejected ? 'rose' : isCorrection ? 'amber' : 'emerald',
    },
    { num: 4, label: 'Disbursed' },
  ];

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between">
        {pipelineSteps.map((st, i) => {
          const isPassed = currentStep > st.num && !isRejected && !isCorrection;
          const isCurrent = currentStep === st.num;
          const isFailed = (isRejected || isCorrection) && isCurrent;

          return (
            <React.Fragment key={st.num}>
              <div className="flex flex-col items-center text-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isFailed
                      ? isRejected
                        ? 'bg-rose-600 text-white ring-2 ring-rose-200'
                        : 'bg-amber-500 text-white ring-2 ring-amber-200'
                      : isPassed
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                          : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isFailed ? (
                    isRejected ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )
                  ) : isPassed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    st.num
                  )}
                </div>
                <span
                  className={`mt-1 text-[11px] font-semibold ${
                    isFailed
                      ? isRejected
                        ? 'text-rose-700 font-bold'
                        : 'text-amber-700 font-bold'
                      : isCurrent || isPassed
                        ? 'text-slate-900 font-bold'
                        : 'text-slate-400'
                  }`}
                >
                  {st.label}
                </span>
              </div>
              {i < pipelineSteps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 transition-all ${
                    currentStep > st.num && !isRejected && !isCorrection ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default LoansPage;