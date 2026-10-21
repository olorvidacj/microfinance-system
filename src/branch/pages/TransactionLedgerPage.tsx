import React, { useCallback, useMemo, useState } from 'react';
import { BookOpenCheck, Download, Search } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { Amount } from '../../portal/components/ui/Amount';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { StatCard } from '../../portal/components/common';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Input, Select } from '../../portal/components/ui/Field';
import { useBranchData } from '../hooks/useBranchData';
import { transactionsService } from '../services';
import { FinancialTransactionRow } from '../types';
import { centsFromDb, centsToDecimal } from '../../../shared/lending';
import { manilaToday, transactionKindOf, type TransactionKind } from '../../../shared/client';
import { formatDate } from '../../utils/loanMath';

/** The register types the money modules write (src/lending, src/savings, src/groups). */
const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'Loan Repayment', label: 'Loan repayment' },
  { value: 'Loan Disbursement', label: 'Loan released' },
  { value: 'Reversal', label: 'Payment reversed' },
  { value: 'Savings Deposit', label: 'Savings deposit' },
  { value: 'Savings Withdrawal', label: 'Savings withdrawal' },
  { value: 'Savings Interest', label: 'Savings interest' },
  { value: 'Solidarity Fund Contribution', label: 'Fund contribution' },
  { value: 'Solidarity Fund Covered a member', label: 'Fund cover' },
  { value: 'Solidarity Fund Cover paid back', label: 'Fund cover paid back' },
];

/** Cash into the branch, cash out of it; interest and reversals move no cash. */
const CASH_IN: TransactionKind[] = ['LOAN_REPAYMENT', 'SAVINGS_DEPOSIT'];
const CASH_OUT: TransactionKind[] = ['LOAN_DISBURSEMENT', 'SAVINGS_WITHDRAWAL'];
const fundIn = (type: string) => /contribution|paid back/i.test(type);

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const exportCsv = (rows: FinancialTransactionRow[]) => {
  const header = ['Reference', 'Date', 'Member', 'Type', 'Account', 'Method', 'Amount', 'Processed by', 'Status', 'Notes'];
  const lines = rows.map((r) =>
    [r.referenceNumber, r.transactionDate, r.clientName, r.transactionType, `${r.accountOrLoanType ?? ''} ${r.accountOrLoanId ?? ''}`.trim(), r.paymentMethod, centsToDecimal(centsFromDb(r.amount)), r.processedBy, r.status, r.notes]
      .map(csvCell)
      .join(','),
  );
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions-${manilaToday()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * The branch's transaction register, read-only. Every row is written by the
 * service that moved the money (with its journal entry); nothing is entered here.
 */
const TransactionLedgerPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [date, setDate] = useState('');

  const fetcher = useCallback(
    async () => transactionsService.list({ type: type || undefined, from: date || undefined, to: date || undefined, search: search || undefined }),
    [type, date, search],
  );
  const { data, loading, error, reload } = useBranchData(fetcher);
  const rows = data || [];

  const summary = useMemo(() => {
    const sum = (pick: (r: FinancialTransactionRow) => boolean) => centsToDecimal(rows.filter(pick).reduce((s, r) => s + centsFromDb(r.amount), 0));
    const kind = (r: FinancialTransactionRow) => transactionKindOf(r.transactionType);
    return {
      totalIn: sum((r) => CASH_IN.includes(kind(r)) || (kind(r) === 'GROUP_FUND' && fundIn(r.transactionType))),
      totalOut: sum((r) => CASH_OUT.includes(kind(r))),
      count: rows.length,
    };
  }, [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transaction register"
        subtitle="Every loan, savings and solidarity fund movement in this branch"
        actions={
          <Button variant="outline" onClick={() => exportCsv(rows)} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Cash in (payments, deposits, contributions)" value={<Amount value={summary.totalIn} />} icon={Download} tone="emerald" />
        <StatCard label="Cash out (loan releases, withdrawals)" value={<Amount value={summary.totalOut} />} icon={Download} tone="rose" />
        <StatCard label="Entries" value={summary.count} icon={BookOpenCheck} tone="blue" />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search by member or reference…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="lg:w-56" aria-label="Type">
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="lg:w-40" aria-label="Date" />
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading transactions…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<BookOpenCheck className="h-6 w-6" />} title="No transactions" description="No entries match your filters." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Reference', 'Date', 'Member', 'Type', 'Account', 'Method', 'Amount', 'Processed by', 'Status'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">{r.referenceNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{formatDate(r.transactionDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{r.clientName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{r.transactionType}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{r.accountOrLoanType}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{r.paymentMethod || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums font-semibold text-slate-800"><Amount value={r.amount} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{r.processedBy}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TransactionLedgerPage;
