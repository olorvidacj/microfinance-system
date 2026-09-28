import React, { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Calculator,
  CalendarClock,
  HandCoins,
  ReceiptText,
  UserCircle2,
  Banknote,
  CheckCircle2,
  Receipt,
  FileCheck,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { Amount } from '../../portal/components/ui/Amount';
import { InfoRow, SectionDivider } from '../../portal/components/common';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { loansService } from '../services';
import { AmortizationTable } from '../components/AmortizationTable';
import { LoanAssessmentPanel } from '../components/LoanAssessmentPanel';
import { LoanDisbursementModal } from '../components/LoanDisbursementModal';
import { formatCurrency } from '../../utils/loanMath';

const LoanDetailsPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const canManage = useBranchPermission(['manage_loan_applications', 'approve_sensitive_operations', 'process_loan_applications']);

  const fetcher = useCallback(() => loansService.get(id), [id]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [assessing, setAssessing] = useState(false);
  const [disbursing, setDisbursing] = useState(false);

  if (loading) return <LoadingState label="Loading loan dossier…" />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  const { loan, amortization, payments, borrower } = data;
  const s = String(loan.status || '').toUpperCase();
  const inPipeline = ['DRAFT', 'SUBMITTED', 'PENDING', 'UNDER REVIEW', 'UNDER_REVIEW', 'FOR ASSESSMENT', 'FOR_ASSESSMENT', 'RECOMMENDED'].includes(s);
  const isApproved = ['APPROVED', 'FOR_DISBURSEMENT'].includes(s);
  const isActive = ['DISBURSED', 'ACTIVE', 'IN ARREARS', 'IN_ARREARS'].includes(s);
  const isCompleted = ['COMPLETED', 'PAID', 'SETTLED'].includes(s);
  const isOverdue = !!loan.daysInArrears && loan.daysInArrears > 0;
  const voucher = loan.disbursementVoucher;

  return (
    <div className="space-y-6">
      <PageHeader
        title={loan.loanNumber}
        subtitle={`${loan.productName} · ${loan.borrowerName}`}
        actions={
          <div className="flex items-center gap-2">
            {inPipeline && canManage && (
              <Button variant="brand" onClick={() => setAssessing(true)}>
                <Calculator className="h-4 w-4" /> Credit Assessment & Approval
              </Button>
            )}

            {isApproved && canManage && (
              <Button
                variant="brand"
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
                onClick={() => setDisbursing(true)}
              >
                <Banknote className="h-4 w-4" /> Disburse Loan Funds
              </Button>
            )}

            {isActive && (
              <Button variant="brand" onClick={() => navigate(`/staff/app/payments?loan=${loan.id}`)}>
                <HandCoins className="h-4 w-4" /> Record Repayment
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={loan.status} />
        {loan.coopStep && <StatusBadge status={loan.coopStep} tone="teal" />}
        {isOverdue && <StatusBadge status={`${loan.daysInArrears} days overdue`} tone="red" />}
        {isCompleted && (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> Fully Settled & Completed
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          {/* Loan Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Loan Summary</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Principal amount" value={<Amount value={loan.principalAmount} />} />
              <InfoRow label="Interest rate" value={`${loan.interestRate}% · ${loan.interestType || 'Flat Rate'}`} />
              <InfoRow label="Term" value={`${loan.termMonths} months`} />
              <InfoRow label="Repayment frequency" value={loan.repaymentFrequency || 'Monthly'} />
              {loan.processingFee ? <InfoRow label="Processing fee" value={<Amount value={loan.processingFee} />} /> : null}
              <InfoRow label="Total payable" value={<Amount value={loan.totalPayable} />} />
              <InfoRow label="Total paid" value={<Amount value={loan.totalPaid} />} />
              <SectionDivider />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium text-slate-500">Remaining balance</span>
                <Amount value={loan.remainingBalance} className="text-lg font-bold text-emerald-800" />
              </div>
            </CardBody>
          </Card>

          {/* Disbursement Voucher Snapshot */}
          {voucher && (
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-950">
                  <Receipt className="h-4 w-4 text-emerald-700" /> Disbursement Voucher
                </CardTitle>
                <span className="text-xs font-mono font-bold text-emerald-800">{voucher.voucherNumber}</span>
              </CardHeader>
              <CardBody className="space-y-2 text-xs">
                <InfoRow label="Release Date" value={voucher.disbursementDate || loan.disbursedDate} />
                <InfoRow label="Method" value={voucher.disbursementMethod || loan.disbursementMethod || 'Cash'} />
                {voucher.disbursementAccount && <InfoRow label="Account / Reference" value={voucher.disbursementAccount} />}
                <InfoRow label="Gross Principal" value={formatCurrency(voucher.grossPrincipal || loan.principalAmount)} />
                <InfoRow label="Fee Deducted" value={formatCurrency(voucher.processingFee || loan.processingFee || 0)} />
                <div className="border-t border-emerald-200/80 pt-2 flex items-center justify-between">
                  <span className="font-semibold text-emerald-900">Net Released</span>
                  <span className="text-sm font-extrabold text-emerald-800">
                    {formatCurrency(voucher.netProceeds || loan.principalAmount)}
                  </span>
                </div>
                {voucher.disbursedBy && (
                  <p className="text-[11px] text-slate-500 pt-1">Disbursed by: {voucher.disbursedBy}</p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Schedule Dates */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline & Routing</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Applied" value={loan.applicationDate || '—'} />
              <InfoRow label="Approved" value={loan.approvalDate || '—'} />
              <InfoRow label="Disbursed" value={loan.startDate || loan.disbursedDate || '—'} />
              <InfoRow label="Maturity" value={loan.maturityDate || '—'} />
              <InfoRow label="Next payment" value={loan.nextPaymentDate || '—'} />
              <InfoRow label="Last payment" value={loan.lastPaymentDate || '—'} />
              <InfoRow label="Loan officer" value={loan.loanOfficerName || '—'} />
            </CardBody>
          </Card>

          {/* Borrower Snapshot */}
          {borrower && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4" /> Borrower Profile
                </CardTitle>
              </CardHeader>
              <CardBody>
                <Link
                  to={`/staff/app/clients/${borrower.id}`}
                  className="text-sm font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                >
                  {borrower.fullName}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  {borrower.borrowerNumber} · {borrower.phone}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{borrower.occupation || '—'}</p>
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
                <CardTitle>Purpose & Description</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-sm leading-relaxed text-slate-700">{loan.purpose}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* Active Balance Highlights */}
          {isActive && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-emerald-100 bg-emerald-50/50">
                <CardBody className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Next installment ({loan.nextPaymentDate || 'Due'})</p>
                    <Amount
                      value={
                        amortization.find((a) => a.status === 'Due')?.totalDue ||
                        loan.totalPayable / Math.max(1, loan.termMonths)
                      }
                      className="text-base font-bold text-slate-900"
                    />
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
                    <Amount value={loan.remainingBalance} className="text-base font-bold text-rose-800" />
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Amortization Table */}
          <Card>
            <CardHeader>
              <CardTitle>Repayment Schedule & Amortization</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <AmortizationTable items={amortization} />
            </CardBody>
          </Card>

          {/* Payments Received */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4" /> Official Repayment Receipts
              </CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {payments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">
                  No repayments recorded for this loan yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{p.receiptNumber}</p>
                        <p className="text-xs text-slate-400">
                          {p.paymentDate} · {p.paymentMethod} · Recorded by {p.collectedBy}
                        </p>
                      </div>
                      <div className="text-right">
                        <Amount value={p.amount} className="text-base font-bold text-emerald-700" />
                        <p className="text-xs text-slate-400">
                          P {p.principalPortion} · I {p.interestPortion}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Credit Assessment Panel */}
      <LoanAssessmentPanel
        loan={assessing ? loan : null}
        onClose={() => setAssessing(false)}
        onAction={(action) => {
          reload();
        }}
      />

      {/* Atomic Disbursement Modal */}
      <LoanDisbursementModal
        loan={disbursing ? loan : null}
        onClose={() => setDisbursing(false)}
        onSuccess={() => reload()}
      />
    </div>
  );
};

export default LoanDetailsPage;