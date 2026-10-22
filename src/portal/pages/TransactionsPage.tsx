import React, { useCallback, useEffect, useState } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { transactionService } from '../services/transactions';
import {
  TRANSACTION_KINDS,
  TRANSACTION_KIND_LABELS,
  TRANSACTION_PERIODS,
  manilaToday,
  periodStart,
  transactionsCsv,
  type ClientTransactionView,
  type TransactionKind,
  type TransactionPeriod,
} from '../../../shared/client';
import { formatDate } from '../../utils/loanMath';
import { peso } from '../../components/lending';
import { Button, Card, CardHeader, CardTitle, EmptyState, ErrorState, Input, LoadingState, Modal, Select, StatusBadge, Table, Td, Tr } from '../components/ui';
import { InfoRow } from '../components/common';

const KIND_OPTIONS = TRANSACTION_KINDS.filter((k) => k !== 'OTHER');

/** The member's full transaction history from the register (same endpoint as the mobile app). */
const TransactionsPage: React.FC = () => {
  const [rows, setRows] = useState<ClientTransactionView[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<TransactionPeriod>('ALL');
  const [kind, setKind] = useState<TransactionKind | 'ALL'>('ALL');
  const [detail, setDetail] = useState<ClientTransactionView | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await transactionService.list({ kind, search: search.trim(), from: periodStart(period, manilaToday()) ?? undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load transactions.');
    }
  }, [kind, search, period]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const exportCsv = () => {
    if (!rows) return;
    const blob = new Blob(['﻿' + transactionsCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HOSCOMCO-transactions-${manilaToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error && !rows) return <ErrorState message={error} onRetry={load} />;
  if (!rows) return <LoadingState label="Loading transactions…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500">Every loan, savings and solidarity fund movement on your account.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by reference or note…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search transactions" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <Select value={period} onChange={(e) => setPeriod(e.target.value as TransactionPeriod)} className="w-auto" aria-label="Period">
            {TRANSACTION_PERIODS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </Select>
          <Select value={kind} onChange={(e) => setKind(e.target.value as TransactionKind | 'ALL')} className="w-auto" aria-label="Type">
            <option value="ALL">All types</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>{TRANSACTION_KIND_LABELS[k]}</option>
            ))}
          </Select>
        </div>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <span className="text-xs text-slate-400">{rows.length} transaction(s)</span>
        </CardHeader>
        {rows.length === 0 ? (
          <EmptyState icon={<Search className="h-6 w-6" />} title="No transactions found" description={search || kind !== 'ALL' || period !== 'ALL' ? 'Try other filters.' : 'Payments, loan releases and savings activity will appear here.'} />
        ) : (
          <Table headers={['Date', 'Transaction', 'Account', 'Reference', 'Amount', 'Status']}>
            {rows.map((t) => (
              <Tr key={t.id} onClick={() => setDetail(t)} className="cursor-pointer">
                <Td>{formatDate(t.date)}</Td>
                <Td className="font-medium text-slate-700">{t.label}</Td>
                <Td className="text-slate-500">{t.account}</Td>
                <Td className="font-mono text-xs">{t.reference}</Td>
                <Td>
                  <span className={`font-semibold tabular-nums ${t.direction === 'OUT' ? 'text-slate-800' : 'text-emerald-600'}`}>
                    {t.direction === 'OUT' ? '−' : '+'}{peso(t.amount)}
                  </span>
                </Td>
                <Td><StatusBadge status={t.status} /></Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Transaction details" size="sm">
        {detail && (
          <div>
            <InfoRow label="Transaction" value={detail.label} />
            <InfoRow label="Date" value={formatDate(detail.date)} />
            <InfoRow label="Amount" value={`${detail.direction === 'OUT' ? '−' : '+'}${peso(detail.amount)}`} />
            <InfoRow label="Account" value={detail.account || '—'} />
            <InfoRow label="Reference" value={<span className="font-mono text-xs">{detail.reference}</span>} />
            <InfoRow label="Method" value={detail.method || '—'} />
            <InfoRow label="Status" value={<StatusBadge status={detail.status} />} />
            {detail.notes && <InfoRow label="Notes" value={detail.notes} />}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionsPage;
