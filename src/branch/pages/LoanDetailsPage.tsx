import React, { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calculator, CalendarClock, HandCoins, ReceiptText, UserCircle2 } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { Amount } from '../../portal/components/ui/Amount';
import { InfoRow, SectionDivider } from '../../portal/components/common';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { loansService } from '../services';
import { AmortizationTable } from '../components/AmortizationTable';
import { LoanAssessmentPanel } from '../components/LoanAssessmentPanel';

const LoanDetailsPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const fetcher = useCallback(() => loansService.get(id), [id]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [assessing, setAssessing] = useState(false);

  if (loading) return <LoadingState label="Loading loan details…" />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  const { loan, amortization, payments, borrower } = data;
  const inPipeline = ['Draft', 'Submitted', 'Under Review', 'For Assessment'].includes(loan.status);
  const isActive = ['Disbursed', 'Active', 'In Arrears'].includes(loan.status);
  const isOverdue = !!loan.daysInArrears && loan.daysInArrears > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={loan.loanNumber}
        subtitle={`${loan.productName} · ${loan.borrowerName}`}
        actions={
          inPipeline ? (
            <Button variant="brand" onClick={() => setAssessing(true)}>
              <Calculator className="h-4 w-4" /> Run assessment
            </Button>
          ) : isActive ? (
            <Button variant="brand" onClick={() => navigate(`/staff/app/payments?loan=${loan.id}`)}>
              <HandCoins className="h-4 w-4" /> Record payment
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={loan.status} />
        {loan.coopStep && <StatusBadge status={loan.coopStep} tone="teal" />}
        {isOverdue && <StatusBadge status={`${loan.daysInArrears} days overdue`} tone="red" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Loan summary</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Principal amount" value={<Amount value={loan.principalAmount} />} />
              <InfoRow label="Interest rate" value={`${loan.interestRate}% · ${loan.interestType || 'Flat Rate'}`} />
              <InfoRow label="Term" value={`${loan.termMonths} months`} />
              {loan.processingFee ? <InfoRow label="Processing fee" value={<Amount value={loan.processingFee} />} /> : null}
              <InfoRow label="Total payable" value={<Amount value={loan.totalPayable} />} />
              <InfoRow label="Total paid" value={<Amount value={loan.totalPaid} />} />
              <SectionDivider />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-slate-500">Remaining balance</span>
                <Amount value={loan.remainingBalance} className="text-lg font-bold text-blue-800" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Applied" value={loan.applicationDate || '—'} />
              <InfoRow label="Disbursed" value={loan.startDate || '—'} />
              <InfoRow label="Maturity" value={loan.maturityDate || '—'} />
              <InfoRow label="Next payment" value={loan.nextPaymentDate || '—'} />
              <InfoRow label="Last payment" value={loan.lastPaymentDate || '—'} />
              <InfoRow label="Loan officer" value={loan.loanOfficerName || '—'} />
            </CardBody>
          </Card>

          {borrower && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserCircle2 className="h-4 w-4" /> Borrower</CardTitle>
              </CardHeader>
              <CardBody>
                <Link to={`/staff/app/clients/${borrower.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                  {borrower.fullName}
                </Link>
                <p className="mt-0.5 text-xs text-slate-400">{borrower.borrowerNumber} · {borrower.phone}</p>
                <p className="mt-0.5 text-xs text-slate-400">{borrower.occupation || '—'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={borrower.memberStatus} />
                  <StatusBadge status={borrower.kycStatus} />
                </div>
              </CardBody>
            </Card>
          )}

          {loan.purpose && (
            <Card>
              <CardHeader>
                <CardTitle>Purpose</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-slate-600">{loan.purpose}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {isActive && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-blue-100 bg-blue-50/50">
                <CardBody className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Next payment ({loan.nextPaymentDate})</p>
                    <Amount value={amortization.find((a) => a.status === 'Due')?.totalDue || loan.totalPayable / Math.max(1, loan.termMonths)} className="text-base font-bold" />
                  </div>
                </CardBody>
              </Card>
              <Card className="border-rose-100 bg-rose-50/50">
                <CardBody className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                    <HandCoins className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Outstanding balance</p>
                    <Amount value={loan.remainingBalance} className="text-base font-bold" />
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Amortization schedule</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <AmortizationTable items={amortization} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ReceiptText className="h-4 w-4" /> Payments received</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {payments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No payments recorded for this loan yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{p.receiptNumber}</p>
                        <p className="text-xs text-slate-400">{p.paymentDate} · {p.paymentMethod} · {p.collectedBy}</p>
                      </div>
                      <div className="text-right">
                        <Amount value={p.amount} className="text-base font-bold text-emerald-700" />
                        <p className="text-xs text-slate-400">P {p.principalPortion} · I {p.interestPortion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <LoanAssessmentPanel
        loan={assessing ? loan : null}
        onClose={() => setAssessing(false)}
        onAction={(action) => {
          toast.success(`Loan ${action === 'recommend' ? 'recommended for approval' : 'updated'} (${action})`);
          reload();
        }}
      />
    </div>
  );
};

export default LoanDetailsPage;