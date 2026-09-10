import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, PiggyBank } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { Amount } from '../../portal/components/ui/Amount';
import { InfoRow } from '../../portal/components/common';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { savingsService } from '../services';

const SavingsTransactionsPage: React.FC = () => {
  const { id = '' } = useParams();
  const toast = useToast();
  const canDeposit = useBranchPermission(['process_savings', 'receive_cash']);
  const canWithdraw = useBranchPermission(['process_savings', 'authorize_sensitive_operations', 'approve_sensitive_operations']);

  const transactionsFetcher = useCallback(() => savingsService.transactions(id), [id]);
  const transactions = useBranchData(transactionsFetcher);
  const accountsFetcher = useCallback(() => savingsService.list(), []);
  const accounts = useBranchData(accountsFetcher);
  const account = (accounts.data || []).find((a) => a.id === id);
  const [txnOpen, setTxnOpen] = useState<'Deposit' | 'Withdrawal' | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title={id}
        subtitle={account ? `${account.memberName} · Passbook savings` : 'Passbook savings account'}
        actions={
          <div className="flex gap-2">
            {canDeposit && (
              <Button variant="brand" onClick={() => setTxnOpen('Deposit')}>
                <ArrowDownCircle className="h-4 w-4" /> Deposit
              </Button>
            )}
            {canWithdraw && (
              <Button variant="outline" onClick={() => setTxnOpen('Withdrawal')}>
                <ArrowUpCircle className="h-4 w-4" /> Withdraw
              </Button>
            )}
          </div>
        }
      />

      {account && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Account summary</CardTitle>
          </CardHeader>
          <CardBody>
            <InfoRow label="Current balance" value={<Amount value={account.balance} className="text-base font-bold" />} />
            <InfoRow label="Total deposits" value={<Amount value={account.totalDeposits} />} />
            <InfoRow label="Total withdrawals" value={<Amount value={account.totalWithdrawals} />} />
            <InfoRow label="Maintaining balance" value={<Amount value={account.maintainingBalance} />} />
          </CardBody>
        </Card>
      )}

      {transactions.loading ? (
        <LoadingState label="Loading savings transactions…" />
      ) : transactions.error ? (
        <ErrorState message={transactions.error} onRetry={transactions.reload} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Transaction history</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {transactions.data && transactions.data.length === 0 ? (
              <EmptyState icon={<PiggyBank className="h-6 w-6" />} title="No transactions" description="Deposits and withdrawals will appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {(transactions.data || []).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {t.type === 'Deposit' ? 'Deposit' : 'Withdrawal'} · {t.transactionNumber}
                      </p>
                      <p className="text-xs text-slate-400">
                        {t.date} · {t.processedBy || '—'}
                        {t.officialReceiptNumber ? ` · OR ${t.officialReceiptNumber}` : ''}
                      </p>
                      {t.notes && <p className="mt-0.5 text-xs text-slate-500">{t.notes}</p>}
                    </div>
                    <div className="text-right">
                      <Amount
                        value={t.amount}
                        className={`text-base font-bold ${t.type === 'Deposit' ? 'text-emerald-700' : 'text-rose-700'}`}
                      />
                      <p className="text-xs tabular-nums text-slate-400">
                        Balance {t.balanceAfter?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {txnOpen && (
        <SavingsTxnModal
          type={txnOpen}
          accountId={id}
          open={!!txnOpen}
          onClose={() => setTxnOpen(null)}
          onDone={() => {
            setTxnOpen(null);
            toast.success(`${txnOpen === 'Deposit' ? 'Deposit' : 'Withdrawal'} recorded`);
            transactions.reload();
            accounts.reload();
          }}
        />
      )}
    </div>
  );
};

const SavingsTxnModal: React.FC<{
  type: 'Deposit' | 'Withdrawal';
  accountId: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}> = ({ type, accountId, open, onClose, onDone }) => {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setLoading(true);
    try {
      if (type === 'Deposit') {
        await savingsService.deposit({ savingsAccountId: accountId, amount: amt, paymentMethod: method, date, notes: notes || undefined });
      } else {
        await savingsService.withdrawal({ savingsAccountId: accountId, amount: amt, date, notes: notes || undefined });
      }
      onDone();
    } catch (err: any) {
      toast.error(err?.message || `Unable to record ${type.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${type} · ${accountId}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={loading}>
            {type === 'Deposit' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
            Record {type.toLowerCase()}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₱)" required>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        {type === 'Deposit' && (
          <Field label="Payment method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>Cash</option>
              <option>GCash</option>
              <option>Bank Transfer</option>
            </Select>
          </Field>
        )}
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

export default SavingsTransactionsPage;