import React from 'react';
import { X, Printer, CheckCircle2, Building2, ShieldCheck, Download, Sparkles } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/loanMath';
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
  const { branches } = useLoan();

  if (!isOpen || !payment) return null;

  const branch = branches.find((b) => b.id === payment.branchId);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full my-8 shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header Action Bar */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Official Cooperative Receipt
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official Receipt</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Body */}
        <div className="p-8 bg-white space-y-6 text-xs text-slate-800" id="printable-receipt">
          {/* Header & Logo */}
          <div className="text-center border-b border-slate-200 pb-5">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl mx-auto mb-2 shadow-xs">
              <Building2 className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
              Bagong Pag-Asa Multi-Purpose Cooperative
            </h2>
            <p className="text-[11px] text-slate-500">
              {branch?.name || 'Main Cooperative Office'} • {branch?.address}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              CDA Reg. No: 9520-10023812 • Tel: {branch?.phone || '02-8821-4900'}
            </p>

            <div className="inline-block mt-3 px-3.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold text-xs">
              ✓ OFFICIAL RECEIPT (OR)
            </div>
          </div>

          {/* Receipt Info Meta */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">OR Number</span>
              <span className="font-mono font-bold text-blue-600 text-sm">{payment.receiptNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase">Payment Date</span>
              <span className="font-mono font-medium text-slate-900">{formatDate(payment.paymentDate)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Member Payor</span>
              <span className="font-bold text-slate-900 text-sm">{payment.borrowerName}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase">Loan Account #</span>
              <span className="font-mono font-bold text-slate-900">{payment.loanNumber}</span>
            </div>
          </div>

          {/* Itemized Apportionment Table */}
          <div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-2">Payment Apportionment</th>
                  <th className="py-2 text-right">Amount (₱)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="py-2 text-slate-700 font-sans">Principal Credit Repayment</td>
                  <td className="py-2 text-right">{formatCurrency(payment.principalPortion)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-700 font-sans">Cooperative Interest Service</td>
                  <td className="py-2 text-right">{formatCurrency(payment.interestPortion)}</td>
                </tr>
                {payment.penaltyPortion > 0 && (
                  <tr>
                    <td className="py-2 text-rose-600 font-sans">Late Penalty Charge</td>
                    <td className="py-2 text-right text-rose-600">{formatCurrency(payment.penaltyPortion)}</td>
                  </tr>
                )}
                {payment.rebateDiscount && payment.rebateDiscount > 0 && (
                  <tr className="text-emerald-700 bg-emerald-50/50">
                    <td className="py-2 text-emerald-800 font-sans flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Less: Early Settlement Rebate Discount
                    </td>
                    <td className="py-2 text-right font-bold text-emerald-700">
                      - {formatCurrency(payment.rebateDiscount)}
                    </td>
                  </tr>
                )}
                <tr className="font-bold text-sm bg-slate-50">
                  <td className="py-3 px-2 text-slate-900 font-sans">TOTAL AMOUNT RECEIVED</td>
                  <td className="py-3 px-2 text-right text-emerald-700 font-extrabold">
                    {formatCurrency(payment.amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Method & Transaction Reference */}
          <div className="p-3.5 bg-slate-50 rounded-2xl space-y-1 text-xs border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Channel:</span>
              <span className="font-semibold text-slate-900">{payment.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction Reference:</span>
              <span className="font-mono font-semibold text-slate-900">{payment.transactionReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Collecting Officer:</span>
              <span className="text-slate-800 font-medium">{payment.collectedBy}</span>
            </div>
            {payment.notes && (
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Remarks:</span>
                <span className="text-slate-700 italic">{payment.notes}</span>
              </div>
            )}
          </div>

          {/* Security Signature & Verification stamp */}
          <div className="pt-4 border-t border-dashed border-slate-300 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="text-slate-700 font-semibold">Official OR Validated</div>
                <div className="text-[9px] font-mono">Receipt Hash: {payment.id.slice(0, 16)}</div>
              </div>
            </div>

            <div className="text-right text-[10px]">
              <div>Thank you for being a valued cooperative member!</div>
              <div className="italic text-slate-400">Cooperative Lending Management System</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
