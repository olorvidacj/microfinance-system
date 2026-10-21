import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import {
  DISBURSEMENT_METHODS,
  DISBURSEMENT_METHOD_LABELS,
  FREQUENCY_LABELS,
  validateDisbursement,
  type DisbursementErrors,
  type ReceiptDocument,
} from '../../../shared/lending';
import type { LoanDetailView } from '../../lending/service';
import { Modal } from '../../portal/components/ui/Modal';
import { Button } from '../../portal/components/ui/Button';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { ReceiptModal } from '../../components/ReceiptModal';
import { manilaToday, peso } from '../../components/lending';
import { loansService } from '../services';
import { BranchApiError } from '../services/api';

interface LoanDisbursementModalProps {
  /** The approved loan to release, or null when closed. */
  loanId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const LoanDisbursementModal: React.FC<LoanDisbursementModalProps> = ({ loanId, onClose, onSuccess }) => {
  const toast = useToast();
  const [loan, setLoan] = useState<LoanDetailView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [method, setMethod] = useState('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [destinationAccount, setDestinationAccount] = useState('');
  const [date, setDate] = useState(manilaToday());
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<DisbursementErrors>({});
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDocument | null>(null);
  // One key per opened form: retries and double clicks reuse it, so funds are released once.
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);

  useEffect(() => {
    if (!loanId) return;
    setLoan(null);
    setLoadError('');
    setMethod('CASH');
    setReferenceNumber('');
    setDestinationAccount('');
    setDate(manilaToday());
    setNotes('');
    setTouched(false);
    setServerErrors({});
    setIdempotencyKey(newKey());
    loansService
      .get(loanId)
      .then((d) => setLoan(d.view))
      .catch((err) => setLoadError(err?.message || 'The loan could not be loaded.'));
  }, [loanId]);

  const today = manilaToday();
  const validation = useMemo(
    () => validateDisbursement({ method, referenceNumber, destinationAccount, disbursementDate: date, notes }, today),
    [method, referenceNumber, destinationAccount, date, notes, today],
  );
  const errors: DisbursementErrors = { ...(touched ? validation.errors : {}), ...serverErrors };

  if (!loanId && !receipt) return null;

  const release = async () => {
    setTouched(true);
    setServerErrors({});
    if (!validation.ok || !loan) return;
    setSaving(true);
    try {
      const result = await loansService.disburse(
        loan.id,
        { method, referenceNumber: referenceNumber.trim() || undefined, destinationAccount: destinationAccount.trim() || undefined, disbursementDate: date, notes: notes.trim() || undefined },
        idempotencyKey,
      );
      toast.success(`${loan.loanNumber} released. Receipt ${result.receipt.receiptNumber}.`);
      setReceipt(result.receipt);
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof BranchApiError) setServerErrors(err.fieldErrors as DisbursementErrors);
      toast.error(err instanceof Error ? err.message : 'The loan could not be released.');
    } finally {
      setSaving(false);
    }
  };

  const nonCash = method !== 'CASH';

  return (
    <>
      <Modal
        open={!!loanId}
        onClose={onClose}
        title="Release loan funds"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="brand" onClick={release} loading={saving} disabled={!loan || loan.status !== 'Approved'}>
              <CheckCircle2 className="h-4 w-4" /> Release {loan?.netProceeds ? peso(loan.netProceeds) : ''}
            </Button>
          </>
        }
      >
        {loadError ? (
          <ErrorState message={loadError} />
        ) : !loan ? (
          <LoadingState label="Loading loan…" />
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Borrower</p>
              <h4 className="text-base font-bold text-slate-900">{loan.borrowerName}</h4>
              <p className="text-xs text-slate-500">
                {loan.loanNumber} · {loan.productName} · {loan.termMonths} months, {FREQUENCY_LABELS[loan.frequency as keyof typeof FREQUENCY_LABELS] ?? loan.frequency} payments
              </p>
              {loan.status !== 'Approved' && <p className="mt-2 text-sm font-semibold text-rose-700">This loan is {loan.status.toLowerCase()}; only approved loans can be released.</p>}
              <table className="mt-4 w-full border-t border-slate-200 text-sm">
                <tbody className="tabular-nums">
                  <tr>
                    <td className="py-1.5 text-slate-500">Approved principal</td>
                    <td className="py-1.5 text-right font-semibold text-slate-800">{peso(loan.principal)}</td>
                  </tr>
                  {loan.fees.map((f) => (
                    <tr key={f.code}>
                      <td className="py-1.5 text-slate-500">Less {f.label.toLowerCase()}</td>
                      <td className="py-1.5 text-right text-rose-700">- {peso(f.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200">
                    <td className="py-2 font-semibold text-slate-900">Net amount to release</td>
                    <td className="py-2 text-right text-lg font-extrabold text-emerald-700">{peso(loan.netProceeds)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Method" required error={errors.method}>
                <Select id="disb-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {DISBURSEMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {DISBURSEMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Release date" required error={errors.disbursementDate} hint="The schedule is counted from this date">
                <Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Transfer reference number" required={nonCash} error={errors.referenceNumber} hint={nonCash ? 'From the bank or e-wallet confirmation' : 'Optional for cash; the receipt number identifies the release'}>
                <Input id="disb-reference" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder={nonCash ? 'e.g. GC-1234567' : ''} />
              </Field>
              <Field label={method === 'E_WALLET' ? 'E-wallet number' : 'Bank account'} required={nonCash} error={errors.destinationAccount}>
                <Input id="disb-destination" value={destinationAccount} disabled={!nonCash} onChange={(e) => setDestinationAccount(e.target.value)} placeholder={nonCash ? (method === 'E_WALLET' ? '0917 123 4567' : 'Account number') : 'Not needed for cash'} />
              </Field>
            </div>

            <Field label="Notes" error={errors.notes}>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>
                Releasing stores the installment schedule from {date}, posts the ledger entry (loans receivable against {nonCash ? 'cash in bank' : 'cash on hand'} and fee income),
                issues the release receipt and notifies the member, all at once. Pressing the button twice cannot release twice.
              </span>
            </div>
          </div>
        )}
      </Modal>
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </>
  );
};
