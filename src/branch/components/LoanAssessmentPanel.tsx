import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Calculator, CheckCircle2, FileEdit, Eye, XCircle } from 'lucide-react';
import {
  DECISION_REASON_MIN,
  centsToDecimal,
  isInterestMethod,
  isRepaymentFrequency,
  ppmFromDb,
  QuoteError,
  quoteLoan,
  validateLoanTerms,
  type LoanProduct,
  type LoanQuote,
} from '../../../shared/lending';
import type { LoanDetailView } from '../../lending/service';
import { Modal } from '../../portal/components/ui/Modal';
import { Button } from '../../portal/components/ui/Button';
import { Field, Input, Textarea } from '../../portal/components/ui/Field';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { ErrorState, LoadingState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { LoanQuoteView, manilaToday, peso } from '../../components/lending';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { useAuth } from '../../context/AuthContext';
import { loansService } from '../services';
import { LoanAssessment } from '../types';

interface LoanAssessmentPanelProps {
  /** The application to review, or null when closed. */
  loanId: string | null;
  onClose: () => void;
  onAction?: (action: string) => void;
}

type Mode = 'none' | 'APPROVE' | 'RETURN' | 'REJECT';

export const LoanAssessmentPanel: React.FC<LoanAssessmentPanelProps> = ({ loanId, onClose, onAction }) => {
  const toast = useToast();
  const canDecide = useBranchPermission(['manage_loan_applications']);
  const { user } = useAuth();
  const [loan, setLoan] = useState<LoanDetailView | null>(null);
  const [product, setProduct] = useState<LoanProduct | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [obligations, setObligations] = useState('0');
  const [assessment, setAssessment] = useState<LoanAssessment | null>(null);

  const [mode, setMode] = useState<Mode>('none');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState('');

  const load = async (id: string) => {
    setLoadError('');
    try {
      const [detail, products] = await Promise.all([loansService.get(id), loansService.products().catch(() => [] as LoanProduct[])]);
      setLoan(detail.view);
      setProduct(products.find((p) => p.id === detail.view.productId) ?? null);
      setAmount(detail.view.principal);
      setTerm(String(detail.view.termMonths));
      setIncome(detail.borrower?.monthlyIncome ? String(detail.borrower.monthlyIncome) : '');
      setExpenses(detail.borrower?.monthlyExpenses ? String(detail.borrower.monthlyExpenses) : '');
    } catch (err: any) {
      setLoadError(err?.message || 'The application could not be loaded.');
    }
  };

  useEffect(() => {
    if (!loanId) return;
    setLoan(null);
    setAssessment(null);
    setMode('none');
    setReason('');
    setError('');
    load(loanId);
  }, [loanId]);

  // The schedule the approved terms would give: the loan's rate and method, the product's fees.
  const approval = useMemo((): { quote: LoanQuote | null; error: string | null; fields: Record<string, string> } => {
    if (!loan || !product || mode !== 'APPROVE') return { quote: null, error: null, fields: {} };
    const terms = validateLoanTerms(product, amount, term);
    if (!terms.ok || !terms.value) return { quote: null, error: null, fields: terms.errors as Record<string, string> };
    if (!isInterestMethod(loan.interestMethod) || !isRepaymentFrequency(loan.frequency)) return { quote: null, error: 'This loan has invalid terms.', fields: {} };
    try {
      const quote = quoteLoan({
        principal: terms.value.principal,
        termMonths: terms.value.termMonths,
        annualRate: ppmFromDb(loan.annualRate),
        method: loan.interestMethod,
        frequency: loan.frequency,
        fees: product.fees,
        startDate: manilaToday(),
      });
      return { quote, error: null, fields: {} };
    } catch (err) {
      return { quote: null, error: err instanceof QuoteError ? err.message : 'These terms cannot be calculated.', fields: {} };
    }
  }, [loan, product, mode, amount, term]);

  if (!loanId) return null;

  const run = async (label: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      toast.success(done);
      onAction?.(label);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request failed.');
    } finally {
      setBusy(false);
    }
  };

  const assess = async () => {
    if (!loan) return;
    setBusy(true);
    try {
      setAssessment(await loansService.assess(loan.id, { monthlyIncome: Number(income) || 0, monthlyExpenses: Number(expenses) || 0, existingObligations: Number(obligations) || 0 }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The assessment could not be run.');
    } finally {
      setBusy(false);
    }
  };

  const reasonOk = reason.trim().length >= DECISION_REASON_MIN;
  const decide = () => {
    if (!loan || mode === 'none') return;
    if (!reasonOk) {
      setError('Give a reason; the member will see it.');
      return;
    }
    if (mode === 'APPROVE' && !approval.quote) {
      setError('Fix the approved amount and term first.');
      return;
    }
    const label = mode === 'APPROVE' ? 'approved' : mode === 'REJECT' ? 'rejected' : 'returned for changes';
    run(
      mode.toLowerCase(),
      () =>
        loansService.decide(loan.id, {
          decision: mode,
          reason: reason.trim(),
          ...(mode === 'APPROVE' ? { approvedAmount: centsToDecimal(approval.quote!.principal), approvedTermMonths: String(approval.quote!.termMonths) } : {}),
        }),
      `${loan.loanNumber} ${label}.`,
    );
  };

  const reviewable = loan && (loan.status === 'Submitted' || loan.status === 'Under Review');
  const ownApplication = loan?.createdBy && loan.createdBy === user?.id;

  return (
    <Modal
      open={!!loanId}
      onClose={onClose}
      title="Review loan application"
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {loan && reviewable && canDecide && (
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'none' ? (
                <>
                  {loan.status === 'Submitted' && (
                    <Button variant="outline" loading={busy} onClick={() => run('review', () => loansService.startReview(loan.id), `You are now reviewing ${loan.loanNumber}.`)}>
                      <Eye className="h-4 w-4" /> Start review
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setMode('RETURN')}>
                    <FileEdit className="h-4 w-4" /> Return for changes
                  </Button>
                  <Button variant="outline" className="text-rose-600 hover:bg-rose-50" onClick={() => setMode('REJECT')}>
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                  <Button variant="brand" onClick={() => setMode('APPROVE')} disabled={!!ownApplication} title={ownApplication ? 'You filed this application; another officer must approve it.' : undefined}>
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setMode('none')} disabled={busy}>
                    Back
                  </Button>
                  <Button variant={mode === 'REJECT' ? 'danger' : 'brand'} onClick={decide} loading={busy}>
                    Confirm {mode === 'APPROVE' ? 'approval' : mode === 'REJECT' ? 'rejection' : 'return'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      }
    >
      {loadError ? (
        <ErrorState message={loadError} />
      ) : !loan ? (
        <LoadingState label="Loading application…" />
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{loan.borrowerName}</h3>
                <p className="text-xs text-slate-500">
                  {loan.loanNumber} · {loan.productName} · applied {loan.applicationDate} via {loan.channel === 'PORTAL' ? 'the member portal' : 'the branch'}
                </p>
              </div>
              <StatusBadge status={loan.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200/80 pt-3 text-xs sm:grid-cols-4">
              <Stat label="Requested" value={peso(loan.principal)} />
              <Stat label="Term" value={`${loan.termMonths} months`} />
              <Stat label="Installment" value={peso(loan.installmentAmount)} />
              <Stat label="Total to repay" value={peso(loan.totalPayable)} />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Purpose: </span>
              {loan.purpose}
            </p>
            {ownApplication && <p className="mt-2 text-xs font-semibold text-amber-700">You filed this application, so another authorised officer must approve it.</p>}
          </div>

          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

          {mode !== 'none' && (
            <div className={`space-y-3 rounded-xl border p-4 ${mode === 'APPROVE' ? 'border-emerald-300 bg-emerald-50/50' : mode === 'REJECT' ? 'border-rose-200 bg-rose-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
              <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                {mode === 'APPROVE' ? <BadgeCheck className="h-4 w-4 text-emerald-700" /> : mode === 'REJECT' ? <XCircle className="h-4 w-4 text-rose-700" /> : <FileEdit className="h-4 w-4 text-amber-700" />}
                {mode === 'APPROVE' ? 'Approve' : mode === 'REJECT' ? 'Reject' : 'Return for changes'}
              </h4>
              {mode === 'APPROVE' && (
                <>
                  <p className="text-xs text-slate-600">You can approve the requested terms or a lower amount or different term within the product's limits. Your role's approval limit is checked when you confirm.</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Approved amount (₱)" required error={approval.fields.amount}>
                      <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </Field>
                    <Field label="Approved term (months)" required error={approval.fields.termMonths}>
                      <Input inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} />
                    </Field>
                  </div>
                  {!product && <p className="text-xs text-amber-700">The product could not be loaded, so the preview is unavailable; the server still checks the terms.</p>}
                  <LoanQuoteView quote={approval.quote} error={approval.error} />
                </>
              )}
              <Field label={mode === 'APPROVE' ? 'Approval note' : mode === 'REJECT' ? 'Reason for rejecting' : 'What the member must change'} required hint="The member sees this message">
                <Textarea id="loan-decision-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Repayment capacity (estimate)</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monthly income (₱)">
                  <Input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} />
                </Field>
                <Field label="Monthly expenses (₱)">
                  <Input inputMode="decimal" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
                </Field>
              </div>
              <Field label="Other monthly debt payments (₱)">
                <Input inputMode="decimal" value={obligations} onChange={(e) => setObligations(e.target.value)} />
              </Field>
              <Button variant="outline" onClick={assess} loading={busy} fullWidth>
                <Calculator className="h-4 w-4" /> Estimate capacity
              </Button>
            </div>
            <div className="lg:border-l lg:border-slate-100 lg:pl-5">
              {!assessment ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">Estimate disposable income and a recommended ceiling. This guides the decision; it does not change the application.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Disposable income" value={`₱${assessment.disposableIncome.toLocaleString()}`} />
                    <Stat label="Capacity (50%)" value={`₱${assessment.repaymentCapacityMonthly.toLocaleString()}`} />
                    <Stat label="Debt ratio" value={`${Math.round(assessment.debtRatio * 100)}%`} />
                    <Stat label="Suggested ceiling" value={`₱${assessment.recommendedAmount.toLocaleString()}`} />
                  </div>
                  {assessment.riskIndicators.length > 0 && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <ul className="list-inside list-disc space-y-0.5 text-slate-700">
                        {assessment.riskIndicators.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="font-medium text-slate-400">{label}</p>
    <p className="font-bold tabular-nums text-slate-800">{value}</p>
  </div>
);
