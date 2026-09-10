import React from 'react';
import { Printer } from 'lucide-react';
import { Modal } from '../../portal/components/ui/Modal';
import { Button } from '../../portal/components/ui/Button';
import { PaymentReceipt } from '../types';
import { formatCurrency } from '../../utils/loanMath';

export const ReceiptViewer: React.FC<{
  receipt: PaymentReceipt | null;
  onClose: () => void;
}> = ({ receipt, onClose }) => {
  if (!receipt) return null;

  const print = () => window.print();

  return (
    <Modal
      open={!!receipt}
      onClose={onClose}
      title="Official Receipt"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="brand" onClick={print}>
            <Printer className="h-4 w-4" /> Print receipt
          </Button>
        </>
      }
    >
      <div id="payment-receipt" className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5 text-center">
          <p className="text-base font-bold text-slate-900">HOSCOMO Microfinance Cooperative</p>
          <p className="text-xs text-slate-500">Los Baños Main Branch · Official Receipt</p>
          <p className="mt-1 inline-flex rounded-full bg-blue-50 px-3 py-0.5 text-sm font-bold tabular-nums text-blue-800 ring-1 ring-inset ring-blue-200">
            {receipt.receiptNumber}
          </p>
        </div>
        <div className="space-y-3 p-5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400">Received from</p>
              <p className="font-medium text-slate-800">{receipt.clientName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Loan number</p>
              <p className="font-medium text-slate-800">{receipt.loanNumber}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Date</p>
              <p className="font-medium text-slate-800">{receipt.paymentDate}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Method</p>
              <p className="font-medium text-slate-800">{receipt.paymentMethod}</p>
            </div>
          </div>
          {receipt.transactionReference && (
            <p className="text-xs text-slate-400">
              Reference: <span className="font-medium text-slate-700">{receipt.transactionReference}</span>
            </p>
          )}
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Principal portion</span>
              <span className="font-medium tabular-nums text-slate-800">{formatCurrency(receipt.principalPortion)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Interest portion</span>
              <span className="font-medium tabular-nums text-slate-800">{formatCurrency(receipt.interestPortion)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-700">Total payment</span>
              <span className="text-lg font-bold tabular-nums text-blue-800">{formatCurrency(receipt.amount)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <span className="text-xs font-medium text-emerald-700">Outstanding balance after this payment</span>
            <span className="text-base font-bold tabular-nums text-emerald-700">{formatCurrency(receipt.remainingBalance)}</span>
          </div>
          <p className="text-center text-xs text-slate-400">Processed by {receipt.processedBy}. Thank you for your payment.</p>
        </div>
      </div>
    </Modal>
  );
};