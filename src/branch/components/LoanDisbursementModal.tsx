import React, { useState } from 'react';
import { Banknote, CheckCircle2, AlertCircle, Calendar, Receipt, CreditCard, ShieldCheck } from 'lucide-react';
import { Modal } from '../../portal/components/ui/Modal';
import { Button } from '../../portal/components/ui/Button';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { loansService } from '../services';
import { BranchLoan } from '../types';
import { formatCurrency } from '../../utils/loanMath';

interface LoanDisbursementModalProps {
  loan: BranchLoan | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoanDisbursementModal: React.FC<LoanDisbursementModalProps> = ({
  loan,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('Cash');
  const [account, setAccount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucher, setVoucher] = useState(`DISB-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`);
  const [deductFee, setDeductFee] = useState(true);
  const [notes, setNotes] = useState('');

  if (!loan) return null;

  const principal = Number(loan.principalAmount) || 0;
  const processingFee = Number(loan.processingFee) || Math.round(principal * 0.02);
  const netProceeds = deductFee ? Math.max(0, principal - processingFee) : principal;

  const handleDisburse = async () => {
    if (!voucher.trim()) {
      toast.error('Voucher / Reference number is required.');
      return;
    }
    setLoading(true);
    try {
      await loansService.disburse(loan.id, {
        disbursementMethod: method,
        disbursementAccount: account.trim() || undefined,
        disbursementDate: date,
        voucherNumber: voucher.trim(),
        deductProcessingFee: deductFee,
        notes: notes.trim() || undefined,
      });
      toast.success(`Loan ${loan.loanNumber} successfully disbursed! Financial ledger updated.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disburse loan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!loan}
      onClose={onClose}
      title="Disburse Loan Funds"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleDisburse} loading={loading}>
            <CheckCircle2 className="h-4 w-4" /> Confirm & Post Disbursement
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Loan & Client Details */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Borrower</p>
              <h4 className="text-base font-bold text-slate-900">{loan.borrowerName}</h4>
              <p className="text-xs text-slate-500">
                Loan #{loan.loanNumber} · {loan.productName}
              </p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Approved
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-200/80 pt-3 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Approved Principal</p>
              <p className="text-sm font-bold text-slate-800">{formatCurrency(principal)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Processing Fee</p>
              <p className="text-sm font-bold text-slate-800">{formatCurrency(processingFee)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Net Release Amount</p>
              <p className="text-base font-extrabold text-emerald-700">{formatCurrency(netProceeds)}</p>
            </div>
          </div>
        </div>

        {/* Disbursement Parameters Form */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Disbursement Method" required>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="Cash">Cash (Teller Vault Release)</option>
              <option value="Bank Transfer">Bank Transfer (Direct Deposit)</option>
              <option value="GCash / E-Wallet">GCash / E-Wallet</option>
              <option value="Check">Check (Manager's / Crossed Check)</option>
            </Select>
          </Field>

          <Field label="Disbursement Date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <Field label="Voucher / Reference Number" required hint="Unique disbursement voucher code">
            <Input
              placeholder="e.g. DISB-2026-00101"
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
            />
          </Field>

          <Field
            label={method === 'Cash' ? 'Cash Release Note' : 'Account / Reference Details'}
            hint={method === 'Cash' ? 'Counter / Teller window' : 'Account number or mobile number'}
          >
            <Input
              placeholder={method === 'Cash' ? 'Main teller release' : 'Account / E-wallet number'}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            />
          </Field>
        </div>

        {/* Processing Fee Deduction Toggle */}
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={deductFee}
            onChange={(e) => setDeductFee(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <span className="font-semibold text-slate-900">Deduct processing fee from gross release</span>
            <p className="text-slate-500">
              {deductFee
                ? `Net cash out: ${formatCurrency(netProceeds)} (Principal ${formatCurrency(principal)} - Fee ${formatCurrency(processingFee)})`
                : `Gross cash out: ${formatCurrency(principal)} (Member pays fee separately)`}
            </p>
          </div>
        </label>

        <Field label="Disbursement Remarks / Officer Notes">
          <Textarea
            rows={2}
            placeholder="Optional remarks regarding the disbursement verification..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <span>
            Confirming this disbursement will immediately transition the loan to <strong>Active</strong>, record a real
            atomic financial transaction in the ledger, recalculate amortization dates from {date}, and notify the borrower.
          </span>
        </div>
      </div>
    </Modal>
  );
};
