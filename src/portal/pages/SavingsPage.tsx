import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, PiggyBank, Target, TrendingUp } from 'lucide-react';
import { savingsService } from '../services/savings';
import { SavingsAccount, SavingsTransaction, WithdrawalRequest } from '../types';
import { formatCurrency, formatDate } from '../../utils/loanMath';
import {
  Amount,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  ProgressBar,
  Select,
  StatusBadge,
  Table,
  Td,
  Tr,
} from '../components/ui';
import { StatCard } from '../components/common';
import { useToast } from '../components/ui/Toast';

const SavingsPage: React.FC = () => {
  const toast = useToast();
  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [acc, tx] = await Promise.all([savingsService.account(), savingsService.transactions()]);
      setAccount(acc);
      setTransactions(tx);
    } catch (err: any) {
      setError(err.message || 'Unable to load savings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const requestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }
    if ((account?.balance || 0) < amt) {
      toast.error('Amount exceeds your available savings balance.');
      return;
    }
    setSubmitting(true);
    try {
      await savingsService.requestWithdrawal({ amount: amt, reason });
      toast.success('Withdrawal request submitted for approval.');
      setWithdrawOpen(false);
      setAmount('');
      setReason('');
    } catch (err: any) {
      toast.error(err.message || 'Unable to submit withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading your savings…" />;
  if (error || !account) return <ErrorState message={error || 'No savings data.'} onRetry={load} />;

  const goalPct = account.goal ? Math.round((account.balance / account.goal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Savings</h1>
          <p className="text-sm text-slate-500">Build your emergency fund and track your deposits.</p>
        </div>
        <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
          <ArrowUpFromLine className="h-4 w-4" /> Request withdrawal
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available balance" value={<Amount value={account.balance} />} icon={PiggyBank} tone="emerald" />
        <StatCard label="Total deposits" value={<Amount value={account.totalDeposits} />} icon={ArrowDownToLine} tone="blue" />
        <StatCard label="Total withdrawals" value={<Amount value={account.totalWithdrawals} />} icon={ArrowUpFromLine} tone="rose" />
        <StatCard
          label={account.goalName || 'Savings goal'}
          value={<Amount value={account.goal} />}
          sub={`${goalPct}% reached`}
          icon={Target}
          tone="violet"
        />
      </div>

      {/* Goal progress */}
      {account.goal ? (
        <Card>
          <CardHeader>
            <CardTitle>Savings goal — {account.goalName}</CardTitle>
            <span className="text-xs text-slate-400">{goalPct}%</span>
          </CardHeader>
          <CardBody>
            <ProgressBar value={account.balance} max={account.goal} showLabel label="Progress toward goal" />
            <p className="mt-2 text-xs text-slate-500">
              You are <span className="font-semibold text-emerald-700">{formatCurrency(account.goal - account.balance)}</span> away
              from your goal. Keep saving!
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Set a savings goal to track your progress.</p>
            <Button size="sm" variant="secondary" onClick={() => toast.info('Goal setting coming soon.')}>
              Set goal
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
        </CardHeader>
        {transactions.length === 0 ? (
          <EmptyState
            icon={<PiggyBank className="h-6 w-6" />}
            title="No savings transactions yet"
            description="Your deposits and withdrawals will appear here."
          />
        ) : (
          <Table headers={['Date', 'Type', 'Description', 'Amount', 'Balance', 'Status']}>
            {transactions.map((t) => (
              <Tr key={t.id}>
                <Td>{formatDate(t.date)}</Td>
                <Td>
                  <span className="text-sm font-medium text-slate-700">{t.type}</span>
                </Td>
                <Td className="text-slate-500">{t.notes || t.referenceNumber}</Td>
                <Td>
                  <span
                    className={`font-semibold tabular-nums ${
                      t.type === 'DEPOSIT' || t.type === 'INTEREST' ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  >
                    {t.type === 'WITHDRAWAL' ? '−' : '+'}
                    {formatCurrency(t.amount)}
                  </span>
                </Td>
                <Td className="text-slate-500">{formatCurrency(t.balanceAfter)}</Td>
                <Td>
                  <StatusBadge status={t.status} tone={t.status === 'COMPLETED' ? 'green' : t.status === 'PENDING' ? 'amber' : 'red'} />
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Withdrawal modal */}
      <Modal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Request savings withdrawal" size="sm">
        <form onSubmit={requestWithdrawal} className="space-y-4">
          <Field label="Amount (₱)" required hint={`Available balance: ${formatCurrency(account.balance)}`}>
            <Input type="number" min={1} placeholder="5000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Reason" required>
            <Input placeholder="e.g. Medical emergency" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setWithdrawOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Submit request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SavingsPage;