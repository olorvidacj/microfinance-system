import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, FilePlus2, Percent, ReceiptText, Repeat, Wallet } from 'lucide-react';
import { loanService } from '../services/loans';
import { ClientLoan, ScheduleItem } from '../types';
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
  Table,
  Td,
  Tr,
} from '../components/ui';
import { InfoRow, SectionDivider } from '../components/common';

const LoanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loan, setLoan] = useState<ClientLoan | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [summary, sch] = await Promise.all([loanService.list(), loanService.schedule(id || '')]);
        if (!active) return;
        const found = summary.allLoans.find((l) => l.id === id);
        if (!found) {
          setError('Loan not found.');
          return;
        }
        setLoan(found);
        setSchedule(sch);
      } catch (err: any) {
        if (active) setError(err.message || 'Unable to load loan details.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <LoadingState label="Loading loan details…" />;
  if (error || !loan)
    return (
      <div>
        <Link to="/portal/loans" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to loans
        </Link>
        <ErrorState message={error || 'Loan not found.'} />
      </div>
    );

  const isActive = !['COMPLETED', 'PAID_OFF', 'CANCELLED', 'REJECTED'].includes(loan.status);
  const paidCount = schedule.filter((s) => s.status === 'PAID').length;
  const amountPaid = schedule.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amountDue, 0);
  const totalDue = schedule.reduce((sum, s) => sum + s.amountDue, 0);
  const progress = totalDue > 0 ? Math.round(((loan.paidAmount ?? amountPaid) / totalDue) * 100) : 0;

  return (
    <div className="space-y-6">
      <Link to="/portal/loans" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to loans
      </Link>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-emerald-600 to-teal-700" />
        <CardBody className="-mt-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold text-slate-400">{loan.loanNumber}</p>
              <h1 className="mt-0.5 text-xl font-bold text-slate-900">{loan.productName}</h1>
              <div className="mt-1">
                <StatusBadge status={loan.status} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">{isActive ? 'Remaining balance' : 'Total repaid'}</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{formatCurrency(loan.remainingBalance)}</p>
              {isActive && loan.nextPaymentDate && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Next due {formatDate(loan.nextPaymentDate)} · {formatCurrency(loan.monthlyInstallment)}
                </p>
              )}
            </div>
          </div>
          <div className="mt-5">
            <ProgressBar value={progress} max={100} showLabel label="Loan progress" />
          </div>
        </CardBody>
      </Card>

      {isActive && (
        <div className="flex flex-wrap gap-2">
          <Link to="/portal/payments">
            <Button>
              <ReceiptText className="h-4 w-4" /> Make a payment
            </Button>
          </Link>
          <Link to="/portal/apply">
            <Button variant="outline">
              <FilePlus2 className="h-4 w-4" /> Apply again
            </Button>
          </Link>
        </div>
      )}

      {/* Key figures */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Principal amount" value={formatCurrency(loan.principalAmount)} icon={Wallet} />
        <MiniStat label="Annual rate" value={`${loan.interestRate}%`} icon={Percent} />
        <MiniStat label="Term" value={`${loan.termMonths} months`} icon={Repeat} />
        <MiniStat label="Monthly installment" value={formatCurrency(loan.monthlyInstallment)} icon={CalendarDays} />
      </div>

      {/* Loan details */}
      <Card>
        <CardHeader>
          <CardTitle>Loan details</CardTitle>
        </CardHeader>
        <CardBody>
          <InfoRow label="Loan number" value={<span className="font-mono">{loan.loanNumber}</span>} />
          <InfoRow label="Disbursed" value={formatDate(loan.startDate || loan.applicationDate)} />
          <InfoRow label="Maturity date" value={formatDate(loan.maturityDate)} />
          <InfoRow label="Amount disbursed" value={formatCurrency(loan.principalAmount)} />
          <InfoRow label="Interest" value={`${loan.interestRate}% p.a. · ${loan.interestType?.replace(/_/g, ' ') || '—'}`} />
          <SectionDivider />
          <InfoRow label="Purpose" value={loan.purpose || '—'} muted={!loan.purpose} />
          <InfoRow label="Payments made" value={loan.repaymentsMade != null ? `${loan.repaymentsMade} of ${loan.repaymentsTotal}` : `${paidCount} of ${schedule.length}`} />
          <InfoRow label="Amount paid" value={formatCurrency(loan.paidAmount ?? amountPaid)} />
          <InfoRow label="Total repayable" value={formatCurrency(loan.totalPayable ?? totalDue)} />
        </CardBody>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Payment schedule</CardTitle>
          <span className="text-xs text-slate-400">
            {paidCount} of {schedule.length} paid
          </span>
        </CardHeader>
        {schedule.length === 0 ? (
          <CardBody>
            <p className="py-6 text-center text-sm text-slate-400">No schedule available for this loan.</p>
          </CardBody>
        ) : (
          <Table headers={['#', 'Due date', 'Amount due', 'Principal', 'Interest', 'Balance', 'Status', 'Receipt']}>
            {schedule.map((s) => (
              <Tr key={s.installmentNumber}>
                <Td className="text-slate-400">{String(s.installmentNumber).padStart(2, '0')}</Td>
                <Td>{formatDate(s.dueDate)}</Td>
                <Td>
                  <Amount value={s.amountDue} />
                </Td>
                <Td className="text-slate-500">{formatCurrency(s.principal)}</Td>
                <Td className="text-slate-500">{formatCurrency(s.interest)}</Td>
                <Td className="text-slate-500">{formatCurrency(s.remainingBalance)}</Td>
                <Td>
                  <StatusBadge status={s.status} tone={s.status === 'DUE' ? 'red' : s.status === 'UPCOMING' ? 'slate' : 'green'} />
                </Td>
                <Td className="text-xs text-slate-400">{s.receiptNumber || '—'}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: string; icon: React.ElementType }> = ({ label, value, icon: Icon }) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-slate-800">{value}</p>
      </div>
    </div>
  </Card>
);

export default LoanDetailPage;