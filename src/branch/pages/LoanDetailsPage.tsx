import React, { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Banknote, Calculator, HandCoins, History, Receipt, ReceiptText, UserCircle2, XCircle } from 'lucide-react';
import { DISBURSEMENT_METHOD_LABELS, FREQUENCY_LABELS, INTEREST_METHOD_LABELS, PAYMENT_METHOD_LABELS, formatPercent, ppmFromDb, type ReceiptDocument } from '../../../shared/lending';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { InfoRow, SectionDivider } from '../../portal/components/common';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Textarea } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { ReceiptModal } from '../../components/ReceiptModal';
import { ScheduleTable, peso } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { loansService, paymentsService } from '../services';
import { LoanAssessmentPanel } from '../components/LoanAssessmentPanel';
import { LoanDisbursementModal } from '../components/LoanDisbursementModal';

const label = <T extends string>(labels: Readonly<Record<T, string>>, v: string) => labels[v as T] ?? v;

const LoanDetailsPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const canManage = useBranchPermission(['manage_loan_applications']);
  const canOriginate = useBranchPermission(['process_loan_applications']);
  const canDisburse = useBranchPermission(['disburse_loans']);

  const fetcher = useCallback(() => loansService.get(id), [id]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [reviewing, setReviewing] = useState(false);
  const [disbursing, setDisbursing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canReverse = useBranchPermission(['approve_sensitive_operations']);
  const [reversing, setReversing] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [paymentReceipt, setPaymentReceipt] = useState<ReceiptDocument | null>(null);

  if (loading) return <LoadingState label="Loading loan…" />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  const { view: loan, payments, borrower } = data;
  const reviewable = loan.status === 'Submitted' || loan.status === 'Under Review';
  const cancellable = ['Draft', 'Submitted', 'Under Review', 'Approved'].includes(loan.status) && (canManage || (canOriginate && loan.status !== 'Approved'));

  const openReceipt = async (paymentId: string) => {
    try {
      setPaymentReceipt(await paymentsService.receipt(paymentId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The receipt could not be loaded.');
    }
  };

  const reverse = async () => {
    if (!reversing) return;
    setBusy(true);
    try {
      const r = await paymentsService.reverse(reversing, reverseReason.trim());
      toast.success(`${r.payment.receiptNumber} reversed (${r.payment.reversal?.reference}).`);
      setReversing(null);
      setReverseReason('');
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The payment could not be reversed.');
    } finally {
      setBusy(false);
    }
  };

  const submitDraft = async () => {
    setBusy(true);
    try {
      await loansService.submit(loan.id);
      toast.success(`${loan.loanNumber} submitted for review.`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The application could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await loansService.cancel(loan.id, cancelReason.trim());
      toast.success(`${loan.loanNumber} cancelled.`);
      setCancelling(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The application could not be cancelled.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={loan.loanNumber}
        subtitle={`${loan.productName} · ${loan.borrowerName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {loan.status === 'Draft' && canOriginate && (
              <Button variant="brand" onClick={submitDraft} loading={busy}>
                Submit for review
              </Button>
            )}
            {reviewable && canManage && (
              <Button variant="brand" onClick={() => setReviewing(true)}>
                <Calculator className="h-4 w-4" /> Review and decide
              </Button>
            )}
            {loan.status === 'Approved' && canDisburse && (
              <Button variant="brand" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => setDisbursing(true)}>
                <Banknote className="h-4 w-4" /> Release funds
              </Button>
            )}
            {loan.receipt && (
              <Button variant="outline" onClick={() => setShowReceipt(true)}>
                <Receipt className="h-4 w-4" /> Release receipt
              </Button>
            )}
            {loan.status === 'Active' && (
              <Button variant="outline" onClick={() => navigate(`/staff/app/payments?loan=${loan.id}`)}>
                <HandCoins className="h-4 w-4" /> Record repayment
              </Button>
            )}
            {cancellable && (
              <Button variant="outline" className="text-rose-600 hover:bg-rose-50" onClick={() => setCancelling(true)}>
                <XCircle className="h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={loan.status} />
        {loan.overdue && <StatusBadge status="Overdue installment" tone="red" />}
        {loan.returnedReason && loan.status === 'Draft' && <span className="text-xs font-semibold text-amber-700">Returned: {loan.returnedReason}</span>}
        {loan.decisionReason && <span className="text-xs text-slate-600">Decision note: {loan.decisionReason}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Terms</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Principal" value={peso(loan.principal)} />
              <InfoRow label="Interest" value={`${formatPercent(ppmFromDb(loan.annualRate))} a year · ${label(INTEREST_METHOD_LABELS, loan.interestMethod)}`} />
              <InfoRow label="Term" value={`${loan.termMonths} months · ${loan.installments} ${label(FREQUENCY_LABELS, loan.frequency).toLowerCase()} installments`} />
              <InfoRow label="Installment" value={peso(loan.installmentAmount)} />
              {loan.fees.map((f) => (
                <InfoRow key={f.code} label={f.label} value={peso(f.amount)} />
              ))}
              <InfoRow label="Net amount released" value={peso(loan.netProceeds)} />
              <InfoRow label="Total interest" value={peso(loan.totalInterest)} />
              <InfoRow label="Total to repay" value={peso(loan.totalPayable)} />
              <InfoRow label="Paid so far" value={peso(loan.totalPaid)} />
              <SectionDivider />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium text-slate-500">Outstanding</span>
                <span className="text-lg font-bold text-emerald-800">{peso(loan.remainingBalance)}</span>
              </div>
            </CardBody>
          </Card>

          {loan.disbursement && (
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-950">
                  <Receipt className="h-4 w-4 text-emerald-700" /> Release
                </CardTitle>
                <span className="font-mono text-xs font-bold text-emerald-800">{loan.disbursement.receiptNumber}</span>
              </CardHeader>
              <CardBody className="space-y-2 text-xs">
                <InfoRow label="Date" value={loan.disbursement.disbursementDate} />
                <InfoRow label="Method" value={label(DISBURSEMENT_METHOD_LABELS, loan.disbursement.method)} />
                {loan.disbursement.referenceNumber && <InfoRow label="Reference" value={loan.disbursement.referenceNumber} />}
                {loan.disbursement.destinationAccount && <InfoRow label="Sent to" value={loan.disbursement.destinationAccount} />}
                <InfoRow label="Gross" value={peso(loan.disbursement.grossAmount)} />
                <InfoRow label="Fees deducted" value={peso(loan.disbursement.totalFees)} />
                <InfoRow label="Net released" value={peso(loan.disbursement.netAmount)} />
                <p className="pt-1 text-[11px] text-slate-500">Released by {loan.disbursement.disbursedByName}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Dates</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Applied" value={loan.applicationDate} />
              <InfoRow label="Approved" value={loan.approvalDate || '—'} />
              <InfoRow label="Released" value={loan.disbursedDate || '—'} />
              <InfoRow label="Next due" value={loan.nextDue ? `${loan.nextDue.dueDate} · ${peso(loan.nextDue.amount)}` : '—'} />
              <InfoRow label="Maturity" value={loan.maturityDate} />
              <InfoRow label="Officer" value={loan.loanOfficerName || 'Unassigned'} />
              <InfoRow label="Decided by" value={loan.decidedByName || '—'} />
            </CardBody>
          </Card>

          {borrower && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4" /> Member
                </CardTitle>
              </CardHeader>
              <CardBody>
                <Link to={`/staff/app/clients/${borrower.id}`} className="text-sm font-bold text-emerald-700 hover:underline">
                  {borrower.fullName}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  {borrower.borrowerNumber} · {borrower.phone}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={borrower.memberStatus} />
                  <StatusBadge status={borrower.kycStatus} />
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{loan.scheduleKind === 'STORED' ? 'Installment schedule' : 'Projected schedule'}</CardTitle>
              {loan.scheduleKind === 'PROJECTED' && <span className="text-xs text-slate-400">Counted from today; stored with the release date when funds are released</span>}
            </CardHeader>
            <CardBody className="p-0">
              <ScheduleTable rows={loan.schedule} showPaid={loan.scheduleKind === 'STORED'} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" /> History
              </CardTitle>
            </CardHeader>
            <CardBody>
              <ol className="space-y-3">
                {loan.history.map((h, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <div>
                      <p className="font-semibold text-slate-800">
                        {h.from ? `${h.from} → ${h.to}` : h.to}
                        <span className="ml-2 text-xs font-normal text-slate-400">{new Date(h.at).toLocaleString('en-PH')}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {h.actorName}
                        {h.actorRole ? ` (${h.actorRole})` : ''}
                        {h.reason ? ` · ${h.reason}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4" /> Repayments
              </CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {payments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No repayments yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {payments.map((p, idx) => {
                    const latestPosted = payments.find((x) => x.status === 'POSTED')?.id === p.id;
                    return (
                      <div key={p.id} className={`flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 ${p.status === 'REVERSED' ? 'bg-rose-50/40' : ''}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">
                            {p.receiptNumber} {p.status === 'REVERSED' && <StatusBadge status="Reversed" tone="red" />}
                            {p.kind && <span className="ml-2 text-xs font-medium text-slate-500">{p.kind.toLowerCase()}</span>}
                          </p>
                          <p className="text-xs text-slate-400">
                            {p.paymentDate} · {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}
                            {p.reference ? ` ref ${p.reference}` : ''} · {p.collectedBy}
                          </p>
                          <p className="text-xs text-slate-500">
                            Penalty {peso(p.penalty)} · Interest {peso(p.interest)} · Principal {peso(p.principal)}
                            {p.excess !== '0.00' ? ` · Overpayment ${peso(p.excess)}` : ''}
                          </p>
                          {p.reversal && (
                            <p className="text-xs text-rose-700">
                              Reversed {p.reversal.reference} by {p.reversal.by}: {p.reversal.reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-base font-bold tabular-nums ${p.status === 'REVERSED' ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>{peso(p.amount)}</span>
                          <Button size="sm" variant="outline" onClick={() => openReceipt(p.id)}>
                            Receipt
                          </Button>
                          {canReverse && p.status === 'POSTED' && latestPosted && idx === payments.findIndex((x) => x.status === 'POSTED') && (
                            <Button size="sm" variant="outline" className="text-rose-600 hover:bg-rose-50" onClick={() => setReversing(p.id)}>
                              Reverse
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <LoanAssessmentPanel loanId={reviewing ? loan.id : null} onClose={() => setReviewing(false)} onAction={() => reload()} />
      <LoanDisbursementModal loanId={disbursing ? loan.id : null} onClose={() => setDisbursing(false)} onSuccess={() => reload()} />
      <ReceiptModal receipt={showReceipt ? loan.receipt : paymentReceipt} onClose={() => {
        setShowReceipt(false);
        setPaymentReceipt(null);
      }} />
      <Modal
        open={!!reversing}
        onClose={() => setReversing(null)}
        title="Reverse payment"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setReversing(null)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" onClick={reverse} loading={busy} disabled={reverseReason.trim().length < 5}>
              Reverse payment
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">The payment stays on record, marked reversed. A mirror ledger entry is posted, the installments get back what it paid, and the member is told why.</p>
        <Field label="Reason" required>
          <Textarea id="reverse-reason" rows={3} value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} />
        </Field>
      </Modal>
      <Modal
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={`Cancel ${loan.loanNumber}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelling(false)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" onClick={cancel} loading={busy} disabled={cancelReason.trim().length < 3}>
              Cancel application
            </Button>
          </>
        }
      >
        <Field label="Reason" required hint="The member sees this message">
          <Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
};

export default LoanDetailsPage;
