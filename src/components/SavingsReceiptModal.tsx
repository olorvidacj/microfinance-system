import React, { useState } from 'react';
import {
  X,
  Printer,
  Building2,
  ShieldCheck,
  Download,
  PiggyBank,
  CheckCircle2,
  FileText,
  QrCode,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { formatCurrency, formatDate, numberToWords } from '../utils/loanMath';
import { SavingsTransaction, SavingsAccount } from '../types';
import { useLoan } from '../context/LoanContext';

interface SavingsReceiptModalProps {
  transaction: SavingsTransaction | null;
  account?: SavingsAccount | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SavingsReceiptModal: React.FC<SavingsReceiptModalProps> = ({
  transaction,
  account,
  isOpen,
  onClose,
}) => {
  const { branches, savingsAccounts, borrowers } = useLoan();
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !transaction) return null;

  const currentAccount =
    account ||
    savingsAccounts.find(
      (a) =>
        a.id === transaction.savingsAccountId ||
        a.accountNumber === transaction.accountNumber
    );

  const client = borrowers.find(
    (b) =>
      b.id === transaction.memberId ||
      b.id === transaction.clientId ||
      b.fullName === transaction.memberName
  );

  const branch = branches.find(
    (b) =>
      b.id === transaction.branchId ||
      b.id === currentAccount?.branchId ||
      b.id === client?.branchId
  );

  const refNumber =
    transaction.referenceNumber ||
    transaction.officialReceiptNumber ||
    transaction.transactionNumber;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const textContent = `
============================================================
           HOSCOMO MICROFINANCE COOPERATIVE
           OFFICIAL SAVINGS TRANSACTION SLIP
============================================================
Transaction No:      ${transaction.transactionNumber}
Reference / OR No:   ${refNumber}
Date & Time:         ${transaction.date}
Branch:              ${branch?.name || 'San Jose Main Branch'}

------------------------------------------------------------
ACCOUNT & CLIENT INFORMATION
------------------------------------------------------------
Client Name:         ${transaction.memberName}
Client ID:           ${client?.borrowerNumber || client?.clientId || 'N/A'}
Savings Account ID:  ${transaction.accountNumber || currentAccount?.accountNumber || transaction.savingsAccountId}
Account Type:        ${currentAccount?.accountType || 'Regular Savings'}
Passbook No:         ${currentAccount?.passbookNumber || 'N/A'}

------------------------------------------------------------
TRANSACTION DETAILS
------------------------------------------------------------
Transaction Type:    ${transaction.type.toUpperCase()}
Payment Method:      ${transaction.paymentMethod || 'Cash'}
Amount:              ${formatCurrency(transaction.amount)}
Amount in Words:     ${numberToWords(transaction.amount)}

Balance Before:      ${formatCurrency(transaction.balanceBefore)}
Net Change:          ${transaction.type === 'Withdrawal' ? '-' : '+'}${formatCurrency(transaction.amount)}
Resulting Balance:   ${formatCurrency(transaction.balanceAfter)}
Maintaining Balance: ₱1,000.00 (Locked)
Available Balance:   ${formatCurrency(Math.max(0, transaction.balanceAfter - 1000))}

------------------------------------------------------------
OFFICER & VALIDATION
------------------------------------------------------------
Processed By:        ${transaction.processedBy}
${transaction.notes ? `Remarks:             ${transaction.notes}\n` : ''}Security Hash:       ${transaction.id}
CDA Registration No. 9520-10023812 • Bangko Sentral Regulated
============================================================
   Thank you for banking with your community cooperative!
============================================================
`;

    const blob = new Blob([textContent.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Savings_Receipt_${refNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyRef = () => {
    navigator.clipboard?.writeText(refNumber);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const isDeposit =
    transaction.type === 'Deposit' ||
    transaction.type === 'Account Opening' ||
    transaction.type === 'Interest Credited';

  return (
    <div
      id="savings-receipt-backdrop"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
    >
      <div
        id="savings-receipt-card"
        className="bg-white rounded-3xl max-w-xl w-full my-6 shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header Action Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <PiggyBank className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">
                Savings Transaction Slip
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {refNumber}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="download-savings-receipt-btn"
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              id="print-savings-receipt-btn"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
            <button
              id="close-savings-receipt-btn"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-800 bg-white">
          {/* Header & Logo */}
          <div className="text-center pb-4 border-b border-slate-200/80">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500 text-amber-950 font-black text-xl mb-2 shadow-sm">
              <PiggyBank className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
              HOSCOMO Microfinance Cooperative
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Community Savings, Capital Build-up & Mutual Credit Union
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {branch?.name || 'San Jose Cooperative Main Branch'} •{' '}
              {branch?.address || 'Maharlika Highway, Poblacion'}
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono font-semibold">
              <span>REF: {refNumber}</span>
              <button
                onClick={handleCopyRef}
                className="text-[10px] text-amber-700 hover:underline print:hidden ml-1"
              >
                {isCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Transaction Hero Banner */}
          <div
            className={`p-4 rounded-2xl border text-center ${
              isDeposit
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-rose-50/70 border-rose-200'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1">
              {isDeposit ? (
                <>
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-800">
                    {transaction.type === 'Account Opening'
                      ? 'Account Opening Deposit'
                      : transaction.type === 'Interest Credited'
                      ? '1% p.a. Monthly Interest Credit'
                      : 'Savings Deposit Credit'}
                  </span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  <span className="text-rose-800">
                    Savings Withdrawal Payout
                  </span>
                </>
              )}
            </div>
            <div
              className={`text-3xl font-black tracking-tight ${
                isDeposit ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatCurrency(transaction.amount)}
            </div>
            <div className="text-xs text-slate-600 font-medium italic mt-1 max-w-md mx-auto">
              "{numberToWords(transaction.amount)}"
            </div>
          </div>

          {/* Client & Account Meta Card */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Member / Account Holder
              </span>
              <div className="font-bold text-slate-900 text-sm mt-0.5">
                {transaction.memberName}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {client?.borrowerNumber || client?.clientId || 'Registered Member'}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Savings Account ID
              </span>
              <div className="font-bold text-blue-700 font-mono text-sm mt-0.5">
                {transaction.accountNumber ||
                  currentAccount?.accountNumber ||
                  transaction.savingsAccountId}
              </div>
              <div className="text-[11px] text-slate-500">
                {currentAccount?.accountType || 'Regular Savings'}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Transaction Date
              </span>
              <div className="font-semibold text-slate-800 mt-0.5">
                {transaction.date}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Payment Channel
              </span>
              <div className="font-semibold text-slate-800 mt-0.5">
                {transaction.paymentMethod || 'Cash'}
              </div>
            </div>
          </div>

          {/* Account Balance Snapshot */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2 font-bold text-slate-700 flex items-center justify-between">
              <span>Account Balance Ledger Snapshot</span>
              <span className="font-mono text-[11px] text-slate-500">
                Tx: {transaction.transactionNumber}
              </span>
            </div>

            <div className="divide-y divide-slate-100 p-2">
              <div className="flex items-center justify-between py-2 px-3">
                <span className="text-slate-500">Previous Account Balance:</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {formatCurrency(transaction.balanceBefore)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 px-3 bg-amber-50/40">
                <span className="text-slate-700 font-medium">
                  Transaction Amount ({transaction.type}):
                </span>
                <span
                  className={`font-bold font-mono ${
                    isDeposit ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {isDeposit ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 font-bold">
                <span className="text-slate-900 text-sm">
                  Updated Savings Balance:
                </span>
                <span className="text-blue-700 text-base font-mono">
                  {formatCurrency(transaction.balanceAfter)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-3 text-[11px] text-slate-500">
                <span>Mandatory Maintaining Balance (Locked):</span>
                <span className="font-mono">₱1,000.00</span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-3 text-[11px] text-emerald-800 font-semibold bg-emerald-50/50">
                <span>Available Withdrawable Balance:</span>
                <span className="font-mono font-bold">
                  {formatCurrency(Math.max(0, transaction.balanceAfter - 1000))}
                </span>
              </div>
            </div>
          </div>

          {/* Notes & Processing Officer */}
          <div className="text-xs space-y-2 text-slate-600 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
            {transaction.notes && (
              <p>
                <strong className="text-slate-700">Remarks:</strong>{' '}
                {transaction.notes}
              </p>
            )}
            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
              <span>
                Processed by: <strong>{transaction.processedBy}</strong>
              </span>
              <span className="font-mono">
                {transaction.processedByRole || 'Cashier / Teller'}
              </span>
            </div>
          </div>

          {/* Security Hash & Watermark Footer */}
          <div className="pt-3 border-t border-dashed border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-slate-400 font-mono">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Certified Official System Record • Hash: {transaction.id.slice(-8)}</span>
            </div>
            <div>HOSCOMO Core Banking System v2.4</div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-500 font-medium">
            Official passbook transaction record validated.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
          >
            Close Receipt
          </button>
        </div>
      </div>
    </div>
  );
};
