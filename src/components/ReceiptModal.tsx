import React from 'react';
import { X, Printer, Building2, ShieldCheck, Download, CheckCircle2 } from 'lucide-react';
import { centsFromDb, centsToDecimal, formatPeso, type ReceiptDocument } from '../../shared/lending';
import { formatDate, numberToWords } from '../utils/loanMath';
import { PaymentRecord } from '../types';

interface ReceiptModalProps {
  receipt: ReceiptDocument | null;
  onClose: () => void;
}

const amount = (v: string) => formatPeso(centsFromDb(v));

function receiptText(r: ReceiptDocument): string {
  const lines = [
    'HOSCOMCO MICROFINANCE COOPERATIVE',
    r.branchName ? `${r.branchName}${r.branchAddress ? ` - ${r.branchAddress}` : ''}` : null,
    r.title.toUpperCase(),
    '',
    `Receipt no.:   ${r.receiptNumber}`,
    `Issued:        ${new Date(r.issuedAt).toLocaleString('en-PH')}`,
    `${r.partyLabel}: ${r.partyName}${r.partyNumber ? ` (${r.partyNumber})` : ''}`,
    `${r.accountLabel}: ${r.accountNumber}`,
    r.accountDetail,
    '',
    ...r.lines.map((l) => `${l.deduction ? 'Less: ' : ''}${l.label}`.padEnd(36) + `${l.deduction ? '-' : ''}${amount(l.amount)}`),
    `${r.totalLabel}`.padEnd(36) + amount(r.totalAmount),
    `In words: ${numberToWords(Number(r.totalAmount))}`,
    '',
    `Method:        ${r.method}`,
    r.reference ? `Reference:     ${r.reference}` : null,
    r.destination ? `Sent to:       ${r.destination}` : null,
    `Processed by:  ${r.processedBy}`,
    r.notes ? `Notes:         ${r.notes}` : null,
    r.footer,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  if (!receipt) return null;

  const handleDownload = () => {
    const blob = new Blob([receiptText(receipt)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${receipt.receiptNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="receipt-modal-backdrop" role="dialog" aria-modal="true" aria-label={receipt.title} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="my-6 w-full max-w-xl overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white print:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-gold-500/40 bg-navy-900/30 text-gold-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-wide">{receipt.title}</div>
              <div className="font-mono text-[10px] text-slate-400">{receipt.receiptNumber}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white">
              <Download className="h-3.5 w-3.5" /> Download
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-navy-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-gold-500">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button onClick={onClose} aria-label="Close receipt" className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div id="printable-receipt" className="space-y-5 bg-white p-6 text-xs text-slate-800 md:p-8">
          <div className="border-b border-slate-200 pb-5 text-center">
            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 md:text-lg">HOSCOMCO Microfinance Cooperative</h2>
            {receipt.branchName && (
              <p className="text-[11px] font-medium text-slate-600">
                {receipt.branchName}
                {receipt.branchAddress ? ` · ${receipt.branchAddress}` : ''}
              </p>
            )}
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-0.5 text-[11px] font-bold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>{receipt.title.toUpperCase()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Receipt no.</span>
              <span className="font-mono text-sm font-bold text-gold-700">{receipt.receiptNumber}</span>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-right">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Issued</span>
              <span className="font-mono text-sm font-bold text-slate-900">{formatDate(receipt.issuedAt)}</span>
            </div>
            <div>
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">{receipt.partyLabel}</span>
              <span className="block truncate text-sm font-bold text-slate-900">{receipt.partyName}</span>
              {receipt.partyNumber && <span className="font-mono text-[10px] text-slate-500">{receipt.partyNumber}</span>}
            </div>
            <div className="text-right">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">{receipt.accountLabel}</span>
              <span className="font-mono text-sm font-bold text-slate-900">{receipt.accountNumber}</span>
              {receipt.accountDetail && <span className="block text-[10px] text-slate-500">{receipt.accountDetail}</span>}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-100 font-mono">
                {receipt.lines.map((l, i) => (
                  <tr key={i} className={l.deduction ? 'bg-rose-50/50' : ''}>
                    <td className="px-3 py-2 font-sans text-slate-700">
                      <span className="font-medium text-slate-900">{l.deduction ? `Less: ${l.label}` : l.label}</span>
                      {l.detail && <span className="block text-[10px] text-slate-400">{l.detail}</span>}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${l.deduction ? 'text-rose-700' : 'text-slate-800'}`}>
                      {l.deduction ? '- ' : ''}
                      {amount(l.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-900 text-sm font-bold text-white">
                  <td className="px-3 py-3 font-sans">{receipt.totalLabel}</td>
                  <td className="px-3 py-3 text-right font-black text-emerald-400">{amount(receipt.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 text-[11px] text-amber-900">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-700">Amount in words</span>
            <span className="font-semibold italic">{numberToWords(Number(receipt.totalAmount))}</span>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <Row label="Method" value={receipt.method} />
            {receipt.reference && <Row label="Reference" value={receipt.reference} mono />}
            {receipt.destination && <Row label="Sent to" value={receipt.destination} mono />}
            <Row label="Processed by" value={receipt.processedBy} />
            {receipt.notes && <Row label="Notes" value={receipt.notes} />}
          </div>

          <div className="flex items-center justify-between border-t border-dashed border-slate-300 pt-3 text-[10px] text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 flex-shrink-0 text-emerald-600" />
              <div className="font-bold text-slate-800">System-issued receipt</div>
            </div>
            {receipt.footer && <div className="max-w-[60%] text-right font-medium text-slate-700">{receipt.footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between gap-4">
    <span className="text-slate-500">{label}</span>
    <span className={`text-right font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

/** A loan payment as a receipt (for screens that still hold PaymentRecord objects). */
export function receiptFromPayment(
  p: PaymentRecord,
  context: { branchName?: string | null; branchAddress?: string | null; productName?: string | null } = {},
): ReceiptDocument {
  const dec = (n: number) => centsToDecimal(Math.round((Number(n) || 0) * 100));
  return {
    kind: 'PAYMENT',
    title: 'Official receipt',
    receiptNumber: p.receiptNumber,
    issuedAt: p.paymentDate,
    branchName: context.branchName ?? null,
    branchAddress: context.branchAddress ?? null,
    partyLabel: 'Received from',
    partyName: p.borrowerName,
    partyNumber: p.borrowerId,
    accountLabel: 'Loan number',
    accountNumber: p.loanNumber,
    accountDetail: context.productName ?? null,
    lines: [
      { label: 'Principal', amount: dec(p.principalPortion) },
      { label: 'Interest', amount: dec(p.interestPortion) },
      ...(p.penaltyPortion > 0 ? [{ label: 'Late penalty', amount: dec(p.penaltyPortion) }] : []),
      ...(p.rebateDiscount > 0 ? [{ label: 'Early settlement rebate', amount: dec(p.rebateDiscount), deduction: true }] : []),
    ],
    totalLabel: 'Total received',
    totalAmount: dec(p.amount),
    method: p.paymentMethod,
    reference: p.transactionReference || null,
    destination: null,
    processedBy: p.collectedBy,
    notes: p.notes ?? null,
    footer: null,
  };
}
