import React, { useState } from 'react';
import { X, Printer, Building2, ShieldCheck, Download, Sparkles, CheckCircle2, FileText, QrCode } from 'lucide-react';
import { formatCurrency, formatDate, numberToWords } from '../utils/loanMath';
import { PaymentRecord } from '../types';
import { useLoan } from '../context/LoanContext';

interface ReceiptModalProps {
  payment: PaymentRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  payment,
  isOpen,
  onClose,
}) => {
  const { branches, loans } = useLoan();
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !payment) return null;

  const branch = branches.find((b) => b.id === payment.branchId);
  const loan = loans.find((l) => l.id === payment.loanId || l.loanNumber === payment.loanNumber);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const textContent = `
============================================================
           HOSCOMO MICROFINANCE COOPERATIVE
           OFFICIAL PAYMENT COLLECTION RECEIPT
============================================================
OR Number:          ${payment.receiptNumber}
Transaction Ref:    ${payment.transactionReference}
Date:               ${formatDate(payment.paymentDate)}
Time:               ${new Date().toLocaleTimeString()}

MEMBER / PAYOR:     ${payment.borrowerName}
Loan Account No.:   ${payment.loanNumber}
Branch / Office:    ${branch?.name || 'Main Office'}

------------------------------------------------------------
PAYMENT APPORTIONMENT:
------------------------------------------------------------
Principal Repayment:     ${formatCurrency(payment.principalPortion)}
Cooperative Interest:    ${formatCurrency(payment.interestPortion)}
${payment.penaltyPortion > 0 ? `Late Penalty Charge:     ${formatCurrency(payment.penaltyPortion)}\n` : ''}${payment.rebateDiscount && payment.rebateDiscount > 0 ? `Early Rebate Discount:  -${formatCurrency(payment.rebateDiscount)}\n` : ''}
------------------------------------------------------------
TOTAL AMOUNT PAID:       ${formatCurrency(payment.amount)}
AMOUNT IN WORDS:         ${numberToWords(payment.amount)}
------------------------------------------------------------

LOAN BALANCE STATUS:
Loan Remaining Balance:  ${loan ? formatCurrency(loan.remainingBalance) : 'Updated'}
Next Due Date:           ${loan?.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A'}
Loan Status:             ${loan?.status || 'Active'}

PAYMENT DETAILS:
Payment Channel:         ${payment.paymentMethod}
Transaction Reference:   ${payment.transactionReference}
Collecting Officer:      ${payment.collectedBy}
${payment.notes ? `Remarks:                 ${payment.notes}\n` : ''}
------------------------------------------------------------
CDA Registration No. 9520-10023812 • SEC Registered
Receipt Security Hash: ${payment.id}
Thank you for your prompt loan payment!
============================================================
`;

    const blob = new Blob([textContent.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Official_Receipt_${payment.receiptNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="receipt-modal-backdrop" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div id="receipt-modal-card" className="bg-white rounded-3xl max-w-xl w-full my-6 shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header Action Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-navy-900/30 border border-gold-500/40 flex items-center justify-center text-gold-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">Official Collection Receipt</div>
              <div className="text-[10px] text-slate-400 font-mono">{payment.receiptNumber}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="download-receipt-btn"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-700 shadow-xs"
              title="Download text receipt"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              id="print-receipt-btn"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-navy-900 hover:bg-gold-500 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              title="Print official receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print OR</span>
            </button>
            <button
              id="close-receipt-modal-btn"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Body */}
        <div className="p-6 md:p-8 bg-white space-y-5 text-xs text-slate-800" id="printable-receipt">
          {/* Header & Logo */}
          <div className="text-center border-b border-slate-200 pb-5">
            <div className="inline-flex items-center justify-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold text-sm">
                H
              </div>
              <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight uppercase">
                HOSCOMO Microfinance Cooperative
              </h2>
            </div>
            <p className="text-[11px] font-medium text-slate-600">
              {branch?.name || 'San Jose Cooperative Main Branch'} • {branch?.address || 'San Jose, Bulacan'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              CDA Reg. No: 9520-10023812 • Tel: {branch?.phone || '+63 (044) 791-2384'}
            </p>

            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full font-bold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>OFFICIAL RECEIPT (OR)</span>
            </div>
          </div>

          {/* Receipt Info Meta */}
          <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Official Receipt No.</span>
              <span className="font-mono font-bold text-gold-700 text-sm">{payment.receiptNumber}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-right">
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Payment Date</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{formatDate(payment.paymentDate)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Member Payor</span>
              <span className="font-bold text-slate-900 text-sm block truncate">{payment.borrowerName}</span>
              <span className="text-[10px] text-slate-500 font-mono">ID: {payment.borrowerId}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Loan Account Number</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{payment.loanNumber}</span>
              <span className="text-[10px] text-slate-500 block">{loan?.productName || 'Microfinance Loan'}</span>
            </div>
          </div>

          {/* Itemized Apportionment Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Payment Breakdown</th>
                  <th className="py-2.5 px-3 text-right">Amount (₱)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="py-2 px-3 text-slate-700 font-sans">
                    <span className="font-medium text-slate-900">Principal Loan Repayment</span>
                    <span className="block text-[10px] text-slate-400">Direct credit amortization reduction</span>
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-800">
                    {formatCurrency(payment.principalPortion)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-700 font-sans">
                    <span className="font-medium text-slate-900">Cooperative Interest Service</span>
                    <span className="block text-[10px] text-slate-400">Diminishing / flat interest earned</span>
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-800">
                    {formatCurrency(payment.interestPortion)}
                  </td>
                </tr>
                {payment.penaltyPortion > 0 && (
                  <tr className="bg-rose-50/60 text-rose-800">
                    <td className="py-2 px-3 font-sans">
                      <span className="font-bold text-rose-700">Late Penalty Surcharge</span>
                      <span className="block text-[10px] text-rose-500">Arrears fee assessment</span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-rose-700">
                      {formatCurrency(payment.penaltyPortion)}
                    </td>
                  </tr>
                )}
                {payment.rebateDiscount && payment.rebateDiscount > 0 && (
                  <tr className="text-emerald-700 bg-emerald-50/60">
                    <td className="py-2 px-3 font-sans">
                      <span className="font-bold text-emerald-800 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Less: Early Settlement Rebate Discount
                      </span>
                      <span className="block text-[10px] text-emerald-600">Unaccrued interest rebate incentive</span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-700">
                      - {formatCurrency(payment.rebateDiscount)}
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-900 text-white font-bold text-sm">
                  <td className="py-3 px-3 font-sans">TOTAL AMOUNT RECEIVED</td>
                  <td className="py-3 px-3 text-right font-black text-emerald-400">
                    {formatCurrency(payment.amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount in words banner */}
          <div className="px-3.5 py-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900">
            <span className="font-bold uppercase text-[9px] tracking-wider text-amber-700 block">Amount in Words:</span>
            <span className="font-semibold italic">{numberToWords(payment.amount)}</span>
          </div>

          {/* Loan Balance & Installment Update */}
          {loan && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-gold-500/10 border border-gold-400/30 rounded-2xl text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-bold">Updated Loan Remaining Balance</span>
                <span className="font-mono font-bold text-navy-900 text-sm">{formatCurrency(loan.remainingBalance)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[9px] uppercase font-bold">Next Installment Due Date</span>
                <span className="font-mono font-bold text-slate-800 text-xs">
                  {loan.remainingBalance <= 0 ? 'Fully Paid / Settled' : loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A'}
                </span>
              </div>
            </div>
          )}

          {/* Payment Method & Transaction Reference */}
          <div className="p-3.5 bg-slate-50 rounded-2xl space-y-1.5 text-xs border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Method:</span>
              <span className="font-semibold text-slate-900">{payment.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction / Ref Number:</span>
              <span className="font-mono font-bold text-slate-900">{payment.transactionReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Collecting Officer:</span>
              <span className="text-slate-800 font-medium">{payment.collectedBy}</span>
            </div>
            {payment.notes && (
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Notes / Remarks:</span>
                <span className="text-slate-700 italic">{payment.notes}</span>
              </div>
            )}
          </div>

          {/* Security Signature & Verification stamp */}
          <div className="pt-3 border-t border-dashed border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <div className="text-slate-800 font-bold">Official System Electronic OR</div>
                <div className="text-[9px] font-mono text-slate-400">Security Hash: {payment.id}</div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-medium text-slate-700">Thank you for your prompt payment!</div>
              <div className="text-slate-400 italic text-[9px]">HOSCOMO Cooperative Management System</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

