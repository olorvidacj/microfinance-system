import React, { useState } from 'react';
import {
  CreditCard,
  Search,
  Download,
  Filter,
  PlusCircle,
  Receipt,
  Printer,
  CheckCircle2,
  DollarSign,
  Calendar,
  Building2,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { PaymentRecord } from '../types';
import { FinancialTransactionsCore } from './FinancialTransactionsCore';

interface PaymentsViewProps {
  onOpenRecordPayment: () => void;
  onViewReceipt: (payment: PaymentRecord) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  onOpenRecordPayment,
  onViewReceipt,
}) => {
  const { filteredPayments, filteredFinancialTransactions, branches, stats } = useLoan();

  const [activeSubTab, setActiveSubTab] = useState<'repayments' | 'financialCore'>('repayments');
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  const displayPayments = filteredPayments.filter((pay) => {
    const matchesSearch =
      pay.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pay.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pay.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pay.transactionReference.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMethod = methodFilter === 'ALL' || pay.paymentMethod === methodFilter;

    return matchesSearch && matchesMethod;
  });

  const exportToCSV = () => {
    const headers = [
      'Receipt #',
      'Loan #',
      'Borrower',
      'Amount ($)',
      'Payment Method',
      'Reference',
      'Payment Date',
      'Collected By',
      'Principal Portion',
      'Interest Portion',
      'Penalty Portion',
    ];

    const rows = displayPayments.map((p) => [
      p.receiptNumber,
      p.loanNumber,
      `"${p.borrowerName}"`,
      p.amount,
      p.paymentMethod,
      p.transactionReference,
      p.paymentDate,
      `"${p.collectedBy}"`,
      p.principalPortion,
      p.interestPortion,
      p.penaltyPortion,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `collections_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* View Switcher Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSubTab('repayments')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeSubTab === 'repayments'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Loan Installment Receipts</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  activeSubTab === 'repayments' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {filteredPayments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('financialCore')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeSubTab === 'financialCore'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>7. Financial Transaction Core</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  activeSubTab === 'financialCore' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-700'
                }`}
              >
                {filteredFinancialTransactions.length}
              </span>
            </button>
          </div>
        </div>

        {activeSubTab === 'repayments' && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-medium transition shadow-2xs"
            >
              <Download className="w-4 h-4 text-gray-500" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onOpenRecordPayment}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-xs"
            >
              <CreditCard className="w-4 h-4" />
              <span>Record Payment</span>
            </button>
          </div>
        )}
      </div>

      {activeSubTab === 'financialCore' ? (
        <FinancialTransactionsCore />
      ) : (
        <>
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Collections
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono mt-1">
                {formatCurrency(stats.totalCollected)}
              </div>
              <div className="text-xs text-emerald-600 font-medium mt-1">
                {displayPayments.length} Processed Transactions
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Average Payment Ticket
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono mt-1">
                {formatCurrency(
                  displayPayments.length > 0
                    ? displayPayments.reduce((acc, p) => acc + p.amount, 0) / displayPayments.length
                    : 0
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">Across all branches</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Branch Cash Vault Total
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono mt-1">
                {formatCurrency(stats.totalVaultCash)}
              </div>
              <div className="text-xs text-blue-600 font-medium mt-1">Ready for re-disbursement</div>
            </div>
          </div>

          {/* Filter toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by receipt #, loan #, borrower, or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="sm:w-56">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden"
              >
                <option value="ALL">All Payment Channels</option>
                <option value="Cash">Cash Counter</option>
                <option value="Bank Transfer">Bank Transfer / Wire</option>
                <option value="Mobile Money">Mobile Money (M-Pesa / MTN)</option>
                <option value="Debit Card">Debit Card / POS</option>
                <option value="Cheque">Bank Cheque</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 sm:px-6">Receipt #</th>
                    <th className="py-3.5 px-4">Borrower & Loan</th>
                    <th className="py-3.5 px-4">Amount Paid</th>
                    <th className="py-3.5 px-4">Channel & Ref</th>
                    <th className="py-3.5 px-4">Payment Date</th>
                    <th className="py-3.5 px-4">Teller / Officer</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Receipt Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                        No payment records found.
                      </td>
                    </tr>
                  ) : (
                    displayPayments.map((pay) => {
                      const branch = branches.find((b) => b.id === pay.branchId);

                      return (
                        <tr key={pay.id} className="hover:bg-gray-50/80 transition">
                          <td className="py-3.5 px-4 sm:px-6">
                            <span className="font-mono font-bold text-blue-600 text-xs">
                              {pay.receiptNumber}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900 text-xs">{pay.borrowerName}</div>
                            <div className="text-[11px] text-gray-500">{pay.loanNumber}</div>
                            <div className="text-[10px] text-gray-400">{branch?.name}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-emerald-600 font-mono text-sm">
                              +{formatCurrency(pay.amount)}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              P: {formatCurrency(pay.principalPortion)} | I: {formatCurrency(pay.interestPortion)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                              {pay.paymentMethod}
                            </span>
                            <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                              {pay.transactionReference}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-xs font-medium text-gray-800">
                              {formatDate(pay.paymentDate)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-xs text-gray-700">{pay.collectedBy}</div>
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            <button
                              onClick={() => onViewReceipt(pay)}
                              className="flex items-center gap-1.5 ml-auto px-3 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-medium transition"
                            >
                              <Receipt className="w-3.5 h-3.5 text-gray-500" />
                              <span>View & Print</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
