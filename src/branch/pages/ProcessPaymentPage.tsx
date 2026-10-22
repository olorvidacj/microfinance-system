import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, HandCoins } from 'lucide-react';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  allocatePayment,
  centsFromDb,
  formatPeso,
  parsePesos,
  validatePayment,
  type InstallmentBalance,
  type PaymentErrors,
  type ReceiptDocument,
} from '../../../shared/lending';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { useToast } from '../../portal/components/ui/Toast';
import { ReceiptModal } from '../../components/ReceiptModal';
import { manilaToday, peso } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { loansService, paymentsService, type PayoffQuote } from '../services';
import { BranchApiError } from '../services/api';

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const KIND_TEXT: Record<string, string> = {
  PARTIAL: 'Partial payment: less than what is due now.',
  FULL: 'Full payment of what is due.',
  ADVANCE: 'Advance payment: the extra goes to the next installments.',
  OVERPAYMENT: 'Overpayment: the loan is settled and the excess is held for the member (refund or savings).',
};

function balances(q: PayoffQuote): InstallmentBalance[] {
  return q.installments.map((i) => ({
    number: i.number,
    dueDate: i.dueDate,
    principalDue: centsFromDb(i.principalDue),
    interestDue: centsFromDb(i.interestDue),
    penaltyDue: centsFromDb(i.penaltyDue),
    principalPaid: centsFromDb(i.principalPaid),
    interestPaid: centsFromDb(i.interestPaid),
    penaltyPaid: centsFromDb(i.penaltyPaid),
  }));
}

const ProcessPaymentPage: React.FC = () => {
  const [params] = useSearchParams();
  const toast = useToast();
  const loansFetcher = useCallback(() => loansService.list({ status: 'Active' }), []);
  const loans = useBranchData(loansFetcher);
  const active = loans.data || [];

  const [loanId, setLoanId] = useState(params.get('loan') || '');
  const [quote, setQuote] = useState<PayoffQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(manilaToday());
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<PaymentErrors>({});
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDocument | null>(null);
  const [key, setKey] = useState(newKey);

  const loadQuote = useCallback(async (id: string) => {
    setQuote(null);
    setQuoteError('');
    if (!id) return;
    try {
      setQuote(await paymentsService.payoff(id));
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'The loan balance could not be loaded.');
    }
  }, []);

  useEffect(() => {
    if (!loanId && active.length) setLoanId(active[0].id);
  }, [active, loanId]);
  useEffect(() => {
    loadQuote(loanId);
    setAmount('');
    setTouched(false);
    setServerErrors({});
    setKey(newKey());
  }, [loanId, loadQuote]);

  const today = manilaToday();
  const validation = useMemo(() => validatePayment({ amount, method, referenceNumber: reference, paymentDate: date, notes }, today), [amount, method, reference, date, notes, today]);
  const errors: PaymentErrors = { ...(touched ? validation.errors : {}), ...serverErrors };
  const preview = useMemo(() => {
    const cents = parsePesos(amount);
    if (!quote || !cents) return null;
    try {
      return allocatePayment(balances(quote), cents, date);
    } catch {
      return null;
    }
  }, [quote, amount, date]);

  const submit = async () => {
    setTouched(true);
    setServerErrors({});
    if (!validation.ok || !quote) return;
    setSaving(true);
    try {
      const r = await paymentsService.post(quote.loanId, { amount, method, referenceNumber: reference.trim() || undefined, paymentDate: date, notes: notes.trim() || undefined }, key);
      toast.success(`${r.payment.receiptNumber}: ${peso(r.payment.amount)} posted${r.loan.status === 'Closed' ? ' and the loan is now closed' : ''}.`);
      setReceipt(r.receipt);
      setReference('');
      setNotes('');
      setKey(newKey());
      await loadQuote(quote.loanId);
      setAmount('');
      setTouched(false);
      loans.reload();
    } catch (err) {
      if (err instanceof BranchApiError) setServerErrors(err.fieldErrors as PaymentErrors);
      toast.error(err instanceof Error ? err.message : 'The payment could not be posted.');
    } finally {
      setSaving(false);
    }
  };

  if (loans.loading) return <LoadingState label="Loading active loans…" />;
  if (loans.error) return <ErrorState message={loans.error} onRetry={loans.reload} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Record payment" subtitle="Counter collections are allocated to penalty, then interest, then principal, oldest installment first." />
      {active.length === 0 ? (
        <EmptyState icon={<HandCoins className="h-6 w-6" />} title="No active loans" description="Payments can only be recorded against released, active loans." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field label="Loan" required>
                <Select id="pay-loan" value={loanId} onChange={(e) => setLoanId(e.target.value)}>
                  {active.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.loanNumber} · {l.borrowerName}
                    </option>
                  ))}
                </Select>
              </Field>
              {quoteError && <p className="text-sm text-rose-700">{quoteError}</p>}
              {quote && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <button type="button" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left hover:border-amber-400" onClick={() => setAmount(quote.due)}>
                    <p className="text-xs font-semibold uppercase text-amber-700">Due now</p>
                    <p className="text-lg font-bold tabular-nums text-amber-900">{peso(quote.due)}</p>
                    {quote.daysPastDue > 0 && <p className="text-xs text-rose-700">{quote.daysPastDue} days past due</p>}
                  </button>
                  <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left hover:border-emerald-400" onClick={() => setAmount(quote.payoff)}>
                    <p className="text-xs font-semibold uppercase text-emerald-700">Pay off</p>
                    <p className="text-lg font-bold tabular-nums text-emerald-900">{peso(quote.payoff)}</p>
                    <p className="text-xs text-emerald-700">Closes the loan</p>
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount received (₱)" required error={errors.amount}>
                  <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
                <Field label="Payment date" required error={errors.paymentDate}>
                  <Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Method" required error={errors.method}>
                  <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Reference number" required={method !== 'CASH'} error={errors.referenceNumber}>
                  <Input id="pay-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'CASH' ? 'Optional' : 'Bank / e-wallet reference'} />
                </Field>
              </div>
              <Field label="Notes" error={errors.notes}>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <Button variant="brand" fullWidth onClick={submit} loading={saving} disabled={!quote}>
                <CheckCircle2 className="h-4 w-4" /> Post payment {preview ? formatPeso(preview.amount) : ''}
              </Button>
              {quote && (
                <Link to={`/staff/app/loans/${quote.loanId}`} className="block text-center text-xs font-semibold text-emerald-700 hover:underline">
                  Open {quote.loanNumber}
                </Link>
              )}
            </CardBody>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>How this payment will be applied</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {!quote ? (
                <LoadingState label="Loading balance…" />
              ) : (
                <>
                  {preview ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="font-semibold text-slate-800">{KIND_TEXT[preview.kind]}</p>
                      <p className="mt-1 text-slate-600">
                        Penalty {formatPeso(preview.penalty)} · Interest {formatPeso(preview.interest)} · Principal {formatPeso(preview.principal)}
                        {preview.excess > 0 ? ` · Overpayment ${formatPeso(preview.excess)}` : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Enter an amount to see how it is split.</p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {['#', 'Due', 'Status', 'Owed', 'This payment', 'Left after'].map((h) => (
                            <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 tabular-nums">
                        {quote.installments.map((i) => {
                          const owed = centsFromDb(i.principalDue) + centsFromDb(i.interestDue) + centsFromDb(i.penaltyDue) - centsFromDb(i.principalPaid) - centsFromDb(i.interestPaid) - centsFromDb(i.penaltyPaid);
                          const line = preview?.lines.find((l) => l.number === i.number);
                          const applied = line ? line.penalty + line.interest + line.principal : 0;
                          return (
                            <tr key={i.number} className={applied ? 'bg-emerald-50/50' : ''}>
                              <td className="px-3 py-2 text-slate-400">{i.number}</td>
                              <td className="px-3 py-2">{i.dueDate}</td>
                              <td className="px-3 py-2">
                                <StatusBadge status={i.status} />
                              </td>
                              <td className="px-3 py-2">
                                {formatPeso(owed)}
                                {centsFromDb(i.penaltyDue) > 0 && <span className="block text-[11px] text-rose-600">incl. penalty {peso(i.penaltyDue)}</span>}
                              </td>
                              <td className="px-3 py-2 font-semibold text-emerald-700">{applied ? formatPeso(applied) : '—'}</td>
                              <td className="px-3 py-2">{formatPeso(owed - applied)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      )}
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
};

export default ProcessPaymentPage;
