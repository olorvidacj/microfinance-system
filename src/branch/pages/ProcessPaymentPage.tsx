import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Banknote, CheckCircle2, HandCoins } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { Amount } from '../../portal/components/ui/Amount';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { collectionsService, loansService } from '../services';
import { PaymentReceipt } from '../types';
import { ReceiptViewer } from '../components/ReceiptViewer';

const PAYMENT_METHODS = ['Cash', 'GCash', 'Maya', 'Bank Transfer', 'Postal Money Order', 'Check'];

const ProcessPaymentPage: React.FC = () => {
  const [params] = useSearchParams();
  const toast = useToast();

  const loansFetcher = useCallback(() => loansService.list({ status: 'Active' }), []);
  const loans = useBranchData(loansFetcher);
  const active = (loans.data || []).filter((l) => ['Disbursed', 'Active', 'In Arrears'].includes(l.status));

  const initialLoan = useMemo(() => {
    const preset = params.get('loan');
    return preset && (loans.data || []).some((l) => l.id === preset) ? preset : '';
  }, [params, loans.data]);

  const [loanId, setLoanId] = useState(initialLoan);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);

  useEffect(() => {
    if (initialLoan) setLoanId(initialLoan);
  }, [initialLoan]);

  const selected = active.find((l) => l.id === loanId);

  useEffect(() => {
    if (selected && !amount) {
      setAmount(String(selected.remainingBalance > 0 ? Math.min(selected.remainingBalance, 1000) : 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const submit = async () => {
    if (!selected) {
      toast.error('Select a loan account.');
      return;
    }
    const amt = Number(amount) || 0;
    if (amt <= 0 || amt > selected.remainingBalance) {
      toast.error('Amount must be between 0 and the outstanding balance.');
      return;
    }
    setLoading(true);
    try {
      const result = await collectionsService.recordPayment({
        loanId: selected.id,
        amount: amt,
        date,
        paymentMethod: method,
        transactionReference: reference || undefined,
        notes: notes || undefined,
      });
      setReceipt(result.receipt);
      setAmount('');
      setReference('');
      setNotes('');
      toast.success('Payment recorded');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to record payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Process payment"
        subtitle="Record a loan collection and issue an official receipt"
      />

      {loans.loading ? (
        <LoadingState label="Loading loan accounts…" />
      ) : loans.error ? (
        <ErrorState message={loans.error} onRetry={loans.reload} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><HandCoins className="h-4 w-4" /> Payment details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Loan account" required hint="Only disbursed / active loans are shown.">
              <Select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
                <option value="">— Select loan —</option>
                {active.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.loanNumber} · {l.borrowerName} ({l.productName})
                  </option>
                ))}
              </Select>
            </Field>

            {selected && (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">Borrower</p>
                  <p className="text-sm font-semibold text-slate-800">{selected.borrowerName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Outstanding balance</p>
                  <Amount value={selected.remainingBalance} className="text-base font-bold" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Next payment</p>
                  <p className="text-sm font-medium text-slate-700">
                    {selected.daysInArrears && selected.daysInArrears > 0
                      ? `${selected.daysInArrears} days overdue`
                      : selected.nextPaymentDate || '—'}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount (₱)" required>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  max={selected?.remainingBalance}
                />
              </Field>
              <Field label="Date" required>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Payment method">
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Transaction reference" hint="GCash ref no., check no., etc.">
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
              </Field>
            </div>

            <Field label="Notes">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </Field>

            <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Banknote className="h-4 w-4" />
                {selected
                  ? `Max collectable: ${selected.remainingBalance.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}`
                  : 'Select a loan to continue.'}
              </div>
              <Button variant="brand" onClick={submit} loading={loading} disabled={!selected}>
                <CheckCircle2 className="h-4 w-4" /> Record payment
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <ReceiptViewer receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
};

export default ProcessPaymentPage;