import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  Building2,
  User,
  CreditCard,
  PlusCircle,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { FinancialTransaction, FinancialTransactionStatus, FinancialTransactionType } from '../types';

export const FinancialTransactionsCore: React.FC = () => {
  const {
    filteredFinancialTransactions,
    branches,
    reverseFinancialTransaction,
    updateFinancialTransactionStatus,
    currentUser,
  } = useLoan();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Reversal Modal State
  const [selectedTxForReversal, setSelectedTxForReversal] = useState<FinancialTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalError, setReversalError] = useState('');
  const [reversalSuccess, setReversalSuccess] = useState('');

  // Details Modal State
  const [selectedTxForDetails, setSelectedTxForDetails] = useState<FinancialTransaction | null>(null);

  // Status Update State
  const [statusUpdateTx, setStatusUpdateTx] = useState<FinancialTransaction | null>(null);
  const [newStatus, setNewStatus] = useState<FinancialTransactionStatus>('Completed');
  const [statusNotes, setStatusNotes] = useState('');

  // Filtered transactions
  const displayTransactions = filteredFinancialTransactions.filter((tx) => {
    const matchesSearch =
      tx.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.accountOrLoanId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.processedBy.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'ALL' || tx.transactionType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || tx.status === statusFilter;
    const matchesDate = !dateFilter || tx.transactionDate.startsWith(dateFilter);

    return matchesSearch && matchesType && matchesStatus && matchesDate;
  });

  // Calculate Core Metrics
  const totalVolume = displayTransactions
    .filter((t) => t.status === 'Completed')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const disbursementsTotal = displayTransactions
    .filter((t) => t.transactionType === 'Loan Disbursement' && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const repaymentsTotal = displayTransactions
    .filter((t) => t.transactionType === 'Loan Repayment' && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const savingsDepositsTotal = displayTransactions
    .filter((t) => t.transactionType === 'Savings Deposit' && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const savingsWithdrawalsTotal = displayTransactions
    .filter((t) => t.transactionType === 'Savings Withdrawal' && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const feesAndPenaltiesTotal = displayTransactions
    .filter((t) => (t.transactionType === 'Fee' || t.transactionType === 'Penalty') && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const adjustmentsTotal = displayTransactions
    .filter((t) => t.transactionType === 'Adjustment' && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const reversedCount = displayTransactions.filter((t) => t.status === 'Reversed').length;

  const handleExecuteReversal = () => {
    if (!selectedTxForReversal) return;
    if (!reversalReason.trim()) {
      setReversalError('Please provide a valid mandatory audit reason for this transaction reversal.');
      return;
    }

    setReversalError('');
    const result = reverseFinancialTransaction(selectedTxForReversal.id, reversalReason.trim(), currentUser.name);

    if (result.success) {
      setReversalSuccess(result.message || 'Transaction successfully reversed with offsetting adjustment.');
      setTimeout(() => {
        setSelectedTxForReversal(null);
        setReversalReason('');
        setReversalSuccess('');
      }, 1500);
    } else {
      setReversalError(result.error || 'Failed to reverse transaction.');
    }
  };

  const handleUpdateStatus = () => {
    if (!statusUpdateTx) return;
    const res = updateFinancialTransactionStatus(statusUpdateTx.id, newStatus, statusNotes);
    if (res.success) {
      setStatusUpdateTx(null);
      setStatusNotes('');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Transaction ID',
      'Reference #',
      'Client ID',
      'Client Name',
      'Account / Loan ID',
      'Account Type',
      'Transaction Type',
      'Amount',
      'Date',
      'Payment Method',
      'Processed By',
      'Status',
      'Reversal Of',
      'Notes',
      'Created At',
    ];

    const rows = displayTransactions.map((tx) => [
      tx.id,
      tx.referenceNumber,
      tx.clientId || '',
      `"${tx.clientName || ''}"`,
      tx.accountOrLoanId || '',
      tx.accountOrLoanType || '',
      tx.transactionType,
      tx.amount,
      tx.transactionDate,
      tx.paymentMethod,
      `"${tx.processedBy}"`,
      tx.status,
      tx.reversalOfTxnId || '',
      `"${(tx.notes || '').replace(/"/g, '""')}"`,
      tx.createdAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_transactions_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeBadge = (type: FinancialTransactionType) => {
    switch (type) {
      case 'Loan Disbursement':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Loan Repayment':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Savings Deposit':
        return 'bg-gold-500/20 text-gold-800 border-gold-400/30';
      case 'Savings Withdrawal':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Fee':
        return 'bg-gold-500/20 text-gold-800 border-gold-400/30';
      case 'Penalty':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Adjustment':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadge = (status: FinancialTransactionStatus) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pending
          </span>
        );
      case 'Reversed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCcw className="w-3 h-3 text-purple-600" /> Reversed
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
            <XCircle className="w-3 h-3 text-gray-500" /> Cancelled
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> Failed
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner / Compliance Notice */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-gold-500/20 text-gold-300 border border-gold-500/30">
                Core Module 7
              </span>
              <h2 className="text-lg font-bold text-white">Centralized Financial Transaction Core</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Strict audit-grade, immutable double-entry ledger. Every financial movement generates an indelible record.
              Completed transactions cannot be permanently deleted; corrections require linked reversal and adjustment records.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl text-xs font-semibold transition"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Export Audit Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Disbursements</div>
          <div className="text-lg font-bold text-purple-700 font-mono mt-0.5">
            {formatCurrency(disbursementsTotal)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Total Loans Disbursed</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Repayments</div>
          <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
            {formatCurrency(repaymentsTotal)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Collected Installments</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Savings Inflow</div>
          <div className="text-lg font-bold text-gold-700 font-mono mt-0.5">
            {formatCurrency(savingsDepositsTotal)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Deposits Received</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Savings Outflow</div>
          <div className="text-lg font-bold text-amber-700 font-mono mt-0.5">
            {formatCurrency(savingsWithdrawalsTotal)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Withdrawals Released</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fees & Penalties</div>
          <div className="text-lg font-bold text-gold-700 font-mono mt-0.5">
            {formatCurrency(feesAndPenaltiesTotal)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Revenue Realized</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Reversals/Adjust.</div>
          <div className="text-lg font-bold text-slate-700 font-mono mt-0.5">
            {reversedCount} Records
          </div>
          <div className="text-[10px] text-purple-600 mt-0.5">{formatCurrency(adjustmentsTotal)} Adjusted</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, client, ID, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-gold-500/20"
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Transaction Types (7/7)</option>
              <option value="Loan Disbursement">Loan Disbursements</option>
              <option value="Loan Repayment">Loan Repayments</option>
              <option value="Savings Deposit">Savings Deposits</option>
              <option value="Savings Withdrawal">Savings Withdrawals</option>
              <option value="Fee">Fees</option>
              <option value="Penalty">Penalties</option>
              <option value="Adjustment">Adjustments</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Statuses (Pending, Completed, Reversed...)</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Reversed">Reversed</option>
              <option value="Failed">Failed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Ref / Trans ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Client / Account</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method & Date</th>
                <th className="py-3 px-4">Processed By</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Audit Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No financial transaction records match the specified filters.
                  </td>
                </tr>
              ) : (
                displayTransactions.map((tx) => {
                  const branch = branches.find((b) => b.id === tx.branchId);
                  const isPositive =
                    tx.transactionType === 'Loan Repayment' ||
                    tx.transactionType === 'Savings Deposit' ||
                    tx.transactionType === 'Fee' ||
                    tx.transactionType === 'Penalty';

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-gray-50/80 transition ${
                        tx.status === 'Reversed' ? 'bg-purple-50/20' : tx.transactionType === 'Adjustment' ? 'bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-gold-600 text-xs">{tx.referenceNumber}</div>
                        <div className="text-[10px] font-mono text-gray-400">{tx.id}</div>
                        {tx.reversalOfTxnId && (
                          <div className="text-[10px] font-semibold text-purple-600">
                            Offset for: {tx.reversalOfTxnId}
                          </div>
                        )}
                        {tx.reversedByTxnId && (
                          <div className="text-[10px] font-semibold text-purple-600">
                            Reversed by: {tx.reversedByTxnId}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold border ${getTypeBadge(
                            tx.transactionType
                          )}`}
                        >
                          {tx.transactionType}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 text-xs">
                          {tx.clientName || 'General / System'}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {tx.accountOrLoanId} {tx.accountOrLoanType ? `(${tx.accountOrLoanType})` : ''}
                        </div>
                        <div className="text-[10px] text-gray-400">{branch?.name}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div
                          className={`font-bold font-mono text-sm ${
                            tx.status === 'Reversed'
                              ? 'text-purple-600 line-through'
                              : tx.amount < 0 || !isPositive
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {tx.amount < 0 ? '-' : isPositive ? '+' : '-'}
                          {formatCurrency(Math.abs(tx.amount))}
                        </div>
                        {tx.notes && (
                          <div className="text-[10px] text-gray-500 max-w-xs truncate" title={tx.notes}>
                            {tx.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-gray-800 text-xs">{formatDate(tx.transactionDate)}</div>
                        <div className="text-[11px] text-gray-500">{tx.paymentMethod}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-xs text-gray-800">{tx.processedBy}</div>
                        <div className="text-[10px] text-gray-400">{tx.processedByRole}</div>
                      </td>

                      <td className="py-3.5 px-4">{getStatusBadge(tx.status)}</td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedTxForDetails(tx)}
                            className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-medium transition"
                            title="View Full Audit Details"
                          >
                            <Info className="w-4 h-4 text-gray-500" />
                          </button>

                          {tx.status === 'Pending' && (
                            <button
                              onClick={() => {
                                setStatusUpdateTx(tx);
                                setNewStatus('Completed');
                              }}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md text-[11px] font-semibold transition"
                            >
                              Update Status
                            </button>
                          )}

                          {tx.status === 'Completed' && tx.transactionType !== 'Adjustment' && (
                            <button
                              onClick={() => {
                                setSelectedTxForReversal(tx);
                                setReversalReason('');
                                setReversalError('');
                                setReversalSuccess('');
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md text-[11px] font-semibold transition"
                              title="Audit Reversal with adjustment record"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reverse</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVERSAL MODAL */}
      {selectedTxForReversal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Reverse Financial Transaction</h3>
                <p className="text-xs text-gray-500">
                  Immutable Ledger Compliance Rule: Creates an offsetting Adjustment record.
                </p>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Reference:</span>
                <span className="font-mono font-bold text-gray-900">{selectedTxForReversal.referenceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-bold text-gray-900">{selectedTxForReversal.transactionType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Client / Account:</span>
                <span className="font-medium text-gray-900">
                  {selectedTxForReversal.clientName} ({selectedTxForReversal.accountOrLoanId})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Original Amount:</span>
                <span className="font-mono font-bold text-purple-700">
                  {formatCurrency(selectedTxForReversal.amount)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Mandatory Reversal & Audit Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="State the reason for transaction reversal (e.g. Bounced check, duplicate cashier entry, erroneous payment allocation)..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            {reversalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{reversalError}</span>
              </div>
            )}

            {reversalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{reversalSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTxForReversal(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReversal}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm & Post Reversal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION DETAILS MODAL */}
      {selectedTxForDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-gold-600" />
                <h3 className="text-base font-bold text-gray-900">Financial Audit Certificate</h3>
              </div>
              <button
                onClick={() => setSelectedTxForDetails(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
                <div>
                  <span className="text-gray-500 block">Transaction ID:</span>
                  <span className="font-mono font-bold text-gray-900">{selectedTxForDetails.id}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Reference #:</span>
                  <span className="font-mono font-bold text-gold-600">{selectedTxForDetails.referenceNumber}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Transaction Type:</span>
                  <span className="font-bold text-gray-900">{selectedTxForDetails.transactionType}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Amount:</span>
                  <span className="font-bold font-mono text-emerald-600 text-sm">
                    {formatCurrency(selectedTxForDetails.amount)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Client / Member:</span>
                  <span className="font-medium text-gray-900">{selectedTxForDetails.clientName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account / Loan ID:</span>
                  <span className="font-mono text-gray-900">{selectedTxForDetails.accountOrLoanId || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Channel:</span>
                  <span className="font-medium text-gray-900">{selectedTxForDetails.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction Date:</span>
                  <span className="font-medium text-gray-900">{formatDate(selectedTxForDetails.transactionDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Processed By:</span>
                  <span className="font-medium text-gray-900">{selectedTxForDetails.processedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">System Created At:</span>
                  <span className="font-mono text-gray-700">{selectedTxForDetails.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Ledger Update:</span>
                  <span className="font-mono text-gray-700">{selectedTxForDetails.updatedAt}</span>
                </div>
              </div>

              {selectedTxForDetails.notes && (
                <div className="border-t pt-2.5">
                  <span className="text-gray-500 block font-semibold">Ledger Notes:</span>
                  <p className="text-gray-700 mt-1 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    {selectedTxForDetails.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTxForDetails(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {statusUpdateTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Update Transaction Status</h3>
            <p className="text-xs text-gray-500">
              Ref: <span className="font-mono font-bold text-gold-600">{statusUpdateTx.referenceNumber}</span>
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">Select New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as FinancialTransactionStatus)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl"
              >
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">Audit Notes (Optional)</label>
              <input
                type="text"
                placeholder="Reason for status modification..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusUpdateTx(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateStatus}
                className="px-4 py-2 text-xs font-bold text-white bg-navy-900 hover:bg-navy-800 rounded-xl"
              >
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
