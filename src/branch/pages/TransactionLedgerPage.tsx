import React, { useCallback, useMemo, useState } from 'react';
import { BookOpenCheck, Download, Plus, Search } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { Amount } from '../../portal/components/ui/Amount';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { StatCard } from '../../portal/components/common';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { transactionsService } from '../services';
import { FinancialTransactionRow } from '../types';

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'Loan Repayment', label: 'Loan Repayment' },
  { value: 'Savings Deposit', label: 'Savings Deposit' },
  { value: 'Savings Withdrawal', label: 'Savings Withdrawal' },
  { value: 'Loan Disbursement', label: 'Loan Disbursement' },
  { value: 'Other Income', label: 'Other Income' },
  { value: 'Other Expense', label: 'Other Expense' },
];

const exportCsv = (rows: FinancialTransactionRow[]) => {
  const header = ['Reference', 'Date', 'Client', 'Type', 'Account', 'Method', 'Amount', 'Processed by', 'Status', 'Notes'];
  const lines = rows.map((r) =>
    [r.referenceNumber, r.transactionDate, r.clientName, r.transactionType, `${r.accountOrLoanType} ${r.accountOrLoanId || ''}`, r.paymentMethod, r.amount, r.processedBy, r.status, r.notes]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const TransactionLedgerPage: React.FC = () => {
  const toast = useToast();
  const canRecord = useBranchPermission(['view_transaction_records', 'manage_osh', 'approve_sensitive_operations']);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [date, setDate] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const fetcher = useCallback(
    async () =>
      transactionsService.list({
        type: type || undefined,
        date: date || undefined,
        search: search || undefined,
      }),
    [type, date, search]
  );
  const { data, loading, error, reload } = useBranchData(fetcher);
  const rows = data || [];

  const summary = useMemo(() => {
    const inflows = rows.filter((r) => ['Loan Repayment', 'Savings Deposit', 'Loan Disbursement', 'Other Income'].includes(r.transactionType));
    const outflows = rows.filter((r) => ['Savings Withdrawal', 'Other Expense'].includes(r.transactionType));
    return {
      totalIn: inflows.reduce((s, r) => s + r.amount, 0),
      totalOut: outflows.reduce((s, r) => s + r.amount, 0),
      completed: rows.filter((r) => r.status === 'Completed').length,
    };
  }, [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transaction ledger"
        subtitle="Recorded financial transactions in this branch"
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv(rows)}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {canRecord && (
              <Button variant="brand" onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4" /> Record transaction
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Inflows" value={<Amount value={summary.totalIn} />} icon={Download} tone="emerald" />
        <StatCard label="Outflows" value={<Amount value={summary.totalOut} />} icon={Download} tone="rose" />
        <StatCard label="Completed entries" value={summary.completed} icon={BookOpenCheck} tone="blue" />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by client, reference, or account…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="lg:w-48">
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="lg:w-40" />
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
                  {['Reference', 'Date', 'Client', 'Type', 'Account', 'Method', 'Amount', 'Processed by', 'Status'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">{r.referenceNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{r.transactionDate}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{r.clientName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{r.transactionType}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                      {r.accountOrLoanType} {r.accountOrLoanId || ''}
                    </td>
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

      <RecordTxnModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onDone={() => {
          setNewOpen(false);
          toast.success('Transaction recorded');
          reload();
        }}
      />
    </div>
  );
};

const RecordTxnModal: React.FC<{ open: boolean; onClose: () => void; onDone: () => void }> = ({ open, onClose, onDone }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    clientName: '',
    accountOrLoanId: '',
    accountOrLoanType: 'Loan',
    transactionType: 'Loan Repayment',
    amount: '',
    paymentMethod: 'Cash',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.clientName.trim() || Number(form.amount) <= 0) {
      toast.error('Client name and a positive amount are required.');
      return;
    }
    setLoading(true);
    try {
      await transactionsService.record({
        ...form,
        amount: Number(form.amount),
      });
      onDone();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to record transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record transaction"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={loading}>
            <Plus className="h-4 w-4" /> Record
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" required>
          <Input value={form.clientName} onChange={set('clientName')} />
        </Field>
        <Field label="Transaction type">
          <Select value={form.transactionType} onChange={set('transactionType')}>
            {TYPE_OPTIONS.filter((o) => o.value).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Account type">
          <Select value={form.accountOrLoanType} onChange={set('accountOrLoanType')}>
            <option>Loan</option>
            <option>Savings</option>
            <option>None</option>
          </Select>
        </Field>
        <Field label="Account / loan ID">
          <Input value={form.accountOrLoanId} onChange={set('accountOrLoanId')} placeholder="Optional" />
        </Field>
        <Field label="Amount (₱)" required>
          <Input type="number" value={form.amount} onChange={set('amount')} />
        </Field>
        <Field label="Payment method">
          <Select value={form.paymentMethod} onChange={set('paymentMethod')}>
            <option>Cash</option>
            <option>GCash</option>
            <option>Maya</option>
            <option>Bank Transfer</option>
            <option>Check</option>
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={set('date')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Optional" />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

export default TransactionLedgerPage;