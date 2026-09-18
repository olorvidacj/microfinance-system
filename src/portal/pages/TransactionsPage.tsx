import React, { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { transactionService } from '../services/transactions';
import { FinancialTransaction, TransactionType } from '../types';
import { formatCurrency, formatDate } from '../../utils/loanMath';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Select,
  StatusBadge,
  Table,
  Td,
  Tr,
} from '../components/ui';
import { InfoRow, SectionDivider, transactionIcon, transactionTone, typeLabel } from '../components/common';

const PERIODS = [
  { id: 'ALL', label: 'All time' },
  { id: '30D', label: 'Last 30 days' },
  { id: '90D', label: 'Last 90 days' },
  { id: '1Y', label: 'Last year' },
];

const TYPES: (TransactionType | 'ALL')[] = ['ALL', 'REPAYMENT', 'LOAN_DISBURSEMENT', 'SAVINGS_DEPOSIT', 'SAVINGS_WITHDRAWAL', 'FEE', 'ADJUSTMENT'];

const TransactionsPage: React.FC = () => {
  const [rows, setRows] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('ALL');
  const [type, setType] = useState<TransactionType | 'ALL'>('ALL');
  const [detail, setDetail] = useState<FinancialTransaction | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await transactionService.list({ period, type, search });
      setRows(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, type, search]);

  const filtered = useMemo(() => {
    let r = rows;
    if (period === '30D') {
      const cutoff = Date.now() - 30 * 86400000;
      r = r.filter((x) => new Date(x.date).getTime() >= cutoff);
    } else if (period === '90D') {
      const cutoff = Date.now() - 90 * 86400000;
      r = r.filter((x) => new Date(x.date).getTime() >= cutoff);
    } else if (period === '1Y') {
      const cutoff = Date.now() - 365 * 86400000;
      r = r.filter((x) => new Date(x.date).getTime() >= cutoff);
    }
    return r;
  }, [rows, period]);

  const exportCsv = () => {
    const header = ['Date', 'Type', 'Description', 'Reference', 'Amount', 'Status'];
    const lines = filtered.map((t) =>
      [t.date, typeLabel(t.type), t.description.replace(/,/g, ' '), t.referenceNumber, t.amount, t.status].join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HOSCOMCO-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingState label="Loading transactions…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500">Complete history of your loan and savings activity.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by description or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-auto">
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value as TransactionType | 'ALL')} className="w-auto">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'ALL' ? 'All types' : typeLabel(t)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statement</CardTitle>
          <span className="text-xs text-slate-400">{filtered.length} transaction(s)</span>
        </CardHeader>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No transactions found"
            description="Try adjusting your filters or search."
          />
        ) : (
          <Table headers={['Date', 'Type', 'Description', 'Reference', 'Amount', 'Status', '']}>
            {filtered.map((t) => {
              const tone = transactionTone(t.type);
              return (
                <Tr key={t.id} onClick={() => setDetail(t)} className="cursor-pointer">
                  <Td>{formatDate(t.date)}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      {transactionIcon(t.type)} {typeLabel(t.type)}
                    </span>
                  </Td>
                  <Td className="text-slate-500">{t.description}</Td>
                  <Td className="font-mono text-xs">{t.referenceNumber}</Td>
                  <Td>
                    <span
                      className={`font-semibold tabular-nums ${
                        tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-slate-800' : 'text-slate-600'
                      }`}
                    >
                      {tone === 'negative' ? '−' : ''}
                      {formatCurrency(t.amount)}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge status={t.status} />
                  </Td>
                  <Td className="text-slate-300">›</Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Transaction details" size="sm">
        {detail && (
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50">
                {transactionIcon(detail.type, 'h-5 w-5')}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{typeLabel(detail.type)}</p>
                <p className="text-xs text-slate-400">{formatDate(detail.date)}</p>
              </div>
            </div>
            <InfoRow label="Description" value={detail.description} />
            <InfoRow label="Amount" value={formatCurrency(detail.amount)} />
            <InfoRow label="Reference" value={<span className="font-mono text-xs">{detail.referenceNumber}</span>} />
            <InfoRow label="Payment method" value={detail.paymentMethod ? detail.paymentMethod.replace(/_/g, ' ') : '—'} />
            <InfoRow label="Status" value={<StatusBadge status={detail.status} />} />
            {detail.loanNumber && (
              <>
                <SectionDivider />
                <InfoRow label="Related loan" value={<span className="font-mono text-xs">{detail.loanNumber}</span>} />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionsPage;