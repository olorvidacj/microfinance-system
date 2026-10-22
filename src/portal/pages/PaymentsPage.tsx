import React, { useEffect, useMemo, useState } from 'react';
import { Landmark, Plus, ReceiptText, Upload } from 'lucide-react';
import { PAYMENT_METHOD_LABELS, validatePayment, type ReceiptDocument } from '../../../shared/lending';
import { loanService } from '../services/loans';
import { paymentService, type MemberProof, type PayoffQuote } from '../services/payments';
import { ApiError } from '../services/clientApi';
import { ClientLoan } from '../types';
import { Button, Card, CardHeader, CardTitle, EmptyState, ErrorState, Field, Input, LoadingState, Modal, Select, StatusBadge, Table, Td, Tr } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { ReceiptModal } from '../../components/ReceiptModal';
import { manilaToday, peso } from '../../components/lending';
import type { PaymentView } from '../../lending/repayment';
import { UPLOAD_LIMITS } from '../../../shared/kyc-core';

const UPLOAD_LIMITS_NOTE = 'Attach a JPEG, PNG, WebP or PDF file of 10 MB or less.';

const PROOF_LABEL: Record<string, string> = {
  PENDING_REVIEW: 'Waiting for verification',
  UNDER_REVIEW: 'Being checked',
  VERIFIED: 'Verified and posted',
  REJECTED: 'Not accepted',
};

const PaymentsPage: React.FC = () => {
  const toast = useToast();
  const [loans, setLoans] = useState<ClientLoan[]>([]);
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [proofs, setProofs] = useState<MemberProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDocument | null>(null);

  const [loanId, setLoanId] = useState('');
  const [quote, setQuote] = useState<PayoffQuote | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('E_WALLET');
  const [reference, setReference] = useState('');
  const [payDate, setPayDate] = useState(manilaToday());
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summary, pays, prfs] = await Promise.all([loanService.list(), paymentService.list(), paymentService.proofs()]);
      setLoans(summary.activeLoans);
      setPayments(pays);
      setProofs(prfs);
      if (summary.activeLoans.length > 0 && !loanId) setLoanId(summary.activeLoans[0].id);
    } catch (err: any) {
      setError(err.message || 'Payments could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setQuote(null);
    if (loanId) paymentService.payoff(loanId).then(setQuote).catch(() => setQuote(null));
  }, [loanId]);

  const today = manilaToday();
  const validation = useMemo(() => validatePayment({ amount, method, referenceNumber: reference, paymentDate: payDate, notes }, today), [amount, method, reference, payDate, notes, today]);
  const errors: Record<string, string> = { ...(touched ? (validation.errors as Record<string, string>) : {}), ...(touched && !file ? { fileBase64: 'Attach the receipt or a screenshot of the transfer.' } : {}), ...serverErrors };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > UPLOAD_LIMITS.maxBytes || !UPLOAD_LIMITS.mimeTypes.includes(f.type)) {
      toast.error(UPLOAD_LIMITS_NOTE);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFile({ name: f.name, base64: reader.result as string });
    reader.readAsDataURL(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerErrors({});
    if (!validation.ok || !file || !loanId) return;
    setSubmitting(true);
    try {
      await paymentService.submitProof({ loanId, amount, method, referenceNumber: reference.trim(), paymentDate: payDate, notes: notes.trim() || undefined, fileBase64: file.base64, fileName: file.name });
      toast.success('Proof sent. The branch will verify it and post your payment.');
      setModalOpen(false);
      setAmount('');
      setReference('');
      setNotes('');
      setFile(null);
      setTouched(false);
      load();
    } catch (err) {
      if (err instanceof ApiError) setServerErrors((err.details?.fields as Record<string, string>) ?? {});
      toast.error(err instanceof Error ? err.message : 'The proof could not be sent.');
    } finally {
      setSubmitting(false);
    }
  };

  const openReceipt = async (id: string) => {
    try {
      setReceipt(await paymentService.receipt(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The receipt could not be loaded.');
    }
  };

  if (loading) return <LoadingState label="Loading payments…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500">Pay in cash at any branch, or send a bank or e-wallet transfer and upload the proof here.</p>
        </div>
        <Button variant="brand" onClick={() => setModalOpen(true)} disabled={loans.length === 0}>
          <Plus className="h-4 w-4" /> Send payment proof
        </Button>
      </div>

      {proofs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment proofs</CardTitle>
          </CardHeader>
          <Table headers={['Sent', 'Loan', 'Amount', 'Method / reference', 'Status']}>
            {proofs.map((p) => (
              <Tr key={p.id}>
                <Td>{new Date(p.submittedAt).toLocaleDateString('en-PH')}</Td>
                <Td className="font-mono text-xs">{p.loanNumber}</Td>
                <Td className="font-semibold">{peso(p.amount)}</Td>
                <Td className="text-xs text-slate-600">
                  {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method} · {p.referenceNumber}
                </Td>
                <Td>
                  <StatusBadge status={PROOF_LABEL[p.status] ?? p.status} tone={p.status === 'VERIFIED' ? 'green' : p.status === 'REJECTED' ? 'red' : 'amber'} />
                  {p.rejectionReason && <p className="mt-1 text-xs text-rose-700">{p.rejectionReason}</p>}
                </Td>
              </Tr>
            ))}
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Posted payments</CardTitle>
        </CardHeader>
        {payments.length === 0 ? (
          <EmptyState icon={<ReceiptText className="h-6 w-6" />} title="No payments yet" description="Payments appear here once the branch posts them." />
        ) : (
          <Table headers={['Date', 'Receipt', 'Loan', 'Amount', 'Applied to', '']}>
            {payments.map((p) => (
              <Tr key={p.id}>
                <Td>{p.paymentDate}</Td>
                <Td className="font-mono text-xs">
                  {p.receiptNumber}
                  {p.status === 'REVERSED' && <span className="ml-1 font-sans text-rose-600">(reversed)</span>}
                </Td>
                <Td className="font-mono text-xs">{p.loanNumber}</Td>
                <Td className={`font-semibold ${p.status === 'REVERSED' ? 'text-slate-400 line-through' : ''}`}>{peso(p.amount)}</Td>
                <Td className="text-xs text-slate-500">
                  Interest {peso(p.interest)} · Principal {peso(p.principal)}
                  {p.penalty !== '0.00' ? ` · Penalty ${peso(p.penalty)}` : ''}
                  {p.excess !== '0.00' ? ` · Overpayment ${peso(p.excess)}` : ''}
                </Td>
                <Td>
                  <Button size="sm" variant="outline" onClick={() => openReceipt(p.id)}>
                    Receipt
                  </Button>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Send payment proof" size="md">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Loan" required>
            <Select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.loanNumber} · {l.productName}
                </option>
              ))}
            </Select>
          </Field>
          {quote && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <button type="button" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left" onClick={() => setAmount(quote.due)}>
                <span className="block text-xs font-semibold uppercase text-amber-700">Due now</span>
                <span className="text-lg font-bold">{peso(quote.due)}</span>
              </button>
              <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left" onClick={() => setAmount(quote.payoff)}>
                <span className="block text-xs font-semibold uppercase text-emerald-700">Full payoff</span>
                <span className="text-lg font-bold">{peso(quote.payoff)}</span>
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount you sent (₱)" required error={errors.amount}>
              <Input id="proof-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Date sent" required error={errors.paymentDate}>
              <Input type="date" max={today} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </Field>
            <Field label="How you paid" required error={errors.method}>
              <Select id="proof-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="E_WALLET">E-wallet (GCash, Maya)</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
              </Select>
            </Field>
            <Field label="Reference number" required error={errors.referenceNumber}>
              <Input id="proof-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </div>
          <Field label="Receipt or screenshot" required error={errors.fileBase64}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              <Upload className="h-4 w-4" /> {file ? file.name : 'Choose a JPEG, PNG, WebP or PDF (10 MB max)'}
              <input id="proof-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={pickFile} />
            </label>
          </Field>
          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <Landmark className="mt-0.5 h-4 w-4 shrink-0" /> Your payment is credited only after the branch confirms the transfer. You will be notified either way.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" loading={submitting}>
              Send proof
            </Button>
          </div>
        </form>
      </Modal>
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
};

export default PaymentsPage;
