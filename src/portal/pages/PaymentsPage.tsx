import React, { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Landmark, Plus, ReceiptText, Smartphone } from 'lucide-react';
import { loanService } from '../services/loans';
import { paymentService } from '../services/payments';
import { ClientLoan, PaymentRecordItem } from '../types';
import { formatCurrency, formatDate } from '../../utils/loanMath';
import {
  Amount,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  Select,
  StatusBadge,
  Table,
  Td,
  Tr,
} from '../components/ui';
import { useToast } from '../components/ui/Toast';

const METHODS = [
  { id: 'CASH', label: 'Pay at any branch' },
  { id: 'GCASH', label: 'GCash' },
  { id: 'MAYA', label: 'Maya' },
  { id: 'BANK_TRANSFER', label: 'Bank transfer' },
];

const PaymentsPage: React.FC = () => {
  const toast = useToast();
  const [loans, setLoans] = useState<ClientLoan[]>([]);
  const [payments, setPayments] = useState<PaymentRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [payLoan, setPayLoan] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('GCASH');
  const [reference, setReference] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summary, pays] = await Promise.all([loanService.list(), paymentService.list()]);
      setLoans(summary.activeLoans);
      setPayments(pays);
      if (summary.activeLoans.length > 0) setPayLoan(summary.activeLoans[0].id);
    } catch (err: any) {
      setError(err.message || 'Unable to load payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const currentLoan = loans.find((l) => l.id === payLoan);

  const submitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLoan) {
      toast.error('Please select a loan.');
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }
    if (!reference.trim()) {
      toast.error('Please enter the reference number.');
      return;
    }
    setSubmitting(true);
    try {
      await paymentService.submitPaymentProof({
        loanId: currentLoan.id,
        loanNumber: currentLoan.loanNumber,
        amount: amt,
        paymentMethod: method,
        referenceNumber: reference.trim(),
        paymentDate: payDate,
        notes,
      });
      toast.success('Payment proof submitted for verification.');
      setModalOpen(false);
      setAmount('');
      setReference('');
      setNotes('');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Unable to submit payment proof.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading payments…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500">Make loan payments and track your receipts.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Submit payment
        </Button>
      </div>

      {/* Payment methods */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {METHODS.map((m) => {
          const Icon = m.id === 'CASH' ? Banknote : m.id === 'BANK_TRANSFER' ? Landmark : Smartphone;
          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                  <p className="text-[11px] text-slate-400">{m.id.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        {payments.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-6 w-6" />}
            title="No payments yet"
            description="Your verified payments will appear here."
          />
        ) : (
          <Table headers={['Loan', 'Date', 'Amount', 'Method', 'Reference', 'Receipt', 'Status']}>
            {payments.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <span className="font-mono text-xs font-semibold">{p.loanNumber}</span>
                </Td>
                <Td>{formatDate(p.paymentDate)}</Td>
                <Td>
                  <Amount value={p.amount} />
                </Td>
                <Td>{p.paymentMethod.replace(/_/g, ' ')}</Td>
                <Td className="font-mono text-xs">{p.referenceNumber}</Td>
                <Td className="text-xs text-slate-400">{p.officialReceiptNumber || '—'}</Td>
                <Td>
                  <StatusBadge status={p.status} tone={p.status === 'COMPLETED' ? 'green' : p.status === 'PENDING_TELLER_VERIFICATION' ? 'amber' : p.status === 'REJECTED' || p.status === 'FAILED' ? 'red' : 'blue'} />
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Submit proof modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Submit loan payment" size="lg">
        <form onSubmit={submitProof} className="space-y-4">
          <Field label="Loan" required>
            <Select value={payLoan} onChange={(e) => setPayLoan(e.target.value)}>
              {loans.length === 0 && <option value="">No active loans</option>}
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.loanNumber} · {l.productName}
                </option>
              ))}
            </Select>
          </Field>

          {currentLoan && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
              Next installment: <span className="font-semibold text-slate-700">{formatCurrency(currentLoan.monthlyInstallment)}</span>
              {currentLoan.nextPaymentDate && <> · due {formatDate(currentLoan.nextPaymentDate)}</>}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Amount (₱)" required>
              <Input type="number" min={1} placeholder="4850" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Payment date" required>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </Field>
            <Field label="Payment method" required>
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference number" required hint="GCash/Maya ref or bank transfer ref.">
              <Input placeholder="e.g. GCASH-1234567890" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </div>

          <Field label="Notes" hint="Optional">
            <Input placeholder="Any remarks" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Your payment will be pending verification by the branch teller. Once verified, it will be applied to
            your loan and reflected in your schedule.</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Submit payment proof
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PaymentsPage;