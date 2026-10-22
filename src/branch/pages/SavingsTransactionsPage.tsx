import React, { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Lock, PiggyBank, Unlock, XCircle } from 'lucide-react';
import { ACCRUAL_METHOD_LABELS, SAVINGS_KIND_LABELS, displayPercent } from '../../../shared/lending';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { InfoRow } from '../../portal/components/common';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { peso } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { savingsService } from '../services';
import { CloseModal, CounterModal, SavingsStatusBadge, StatementView, StatusModal } from '../components/SavingsDialogs';

type Dialog = { kind: 'DEPOSIT' | 'WITHDRAWAL' } | { kind: 'STATUS'; action: 'FREEZE' | 'UNFREEZE' | 'REACTIVATE' } | { kind: 'CLOSE' } | null;

/** One savings account: summary, actions, and the statement with running balances. */
const SavingsTransactionsPage: React.FC = () => {
  const { id = '' } = useParams();
  const toast = useToast();
  const canDeposit = useBranchPermission(['process_savings_deposits']);
  const canWithdraw = useBranchPermission(['process_savings_withdrawals']);
  const canFreeze = useBranchPermission(['approve_sensitive_operations']);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);

  const fetcher = useCallback(() => savingsService.statement(id, { from: from || undefined, to: to || undefined }), [id, from, to]);
  const { data: st, loading, error, reload } = useBranchData(fetcher);
  const account = st?.account;

  const done = (message: string) => {
    setDialog(null);
    toast.success(message);
    reload();
  };

  if (loading && !st) return <LoadingState label="Loading savings account…" />;
  if (error || !st || !account) return <ErrorState message={error || 'Savings account not found.'} onRetry={reload} />;
  const closed = account.status === 'CLOSED';

  return (
    <div className="space-y-5">
      <Link to="/staff/app/savings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Savings
      </Link>
      <PageHeader
        title={account.passbookNumber}
        subtitle={`${account.memberName} · ${account.product.name}`}
        actions={
          !closed && (
            <div className="flex flex-wrap gap-2">
              {canDeposit && <Button variant="brand" onClick={() => setDialog({ kind: 'DEPOSIT' })}><ArrowDownCircle className="h-4 w-4" /> Deposit</Button>}
              {canWithdraw && (
                <Button variant="outline" onClick={() => setDialog({ kind: 'WITHDRAWAL' })} disabled={!!account.withdrawalBlockedBy} title={account.withdrawalBlockedBy ?? undefined}>
                  <ArrowUpCircle className="h-4 w-4" /> Withdraw
                </Button>
              )}
              {canFreeze && account.status !== 'FROZEN' && <Button variant="outline" onClick={() => setDialog({ kind: 'STATUS', action: 'FREEZE' })}><Lock className="h-4 w-4" /> Freeze</Button>}
              {canFreeze && account.status === 'FROZEN' && <Button variant="outline" onClick={() => setDialog({ kind: 'STATUS', action: 'UNFREEZE' })}><Unlock className="h-4 w-4" /> Release</Button>}
              {canWithdraw && account.status === 'DORMANT' && <Button variant="outline" onClick={() => setDialog({ kind: 'STATUS', action: 'REACTIVATE' })}><Unlock className="h-4 w-4" /> Reactivate</Button>}
              {canWithdraw && account.status !== 'FROZEN' && <Button variant="outline" onClick={() => setDialog({ kind: 'CLOSE' })}><XCircle className="h-4 w-4" /> Close</Button>}
            </div>
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Account</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-x-8 sm:grid-cols-2">
          <div>
            <InfoRow label="Status" value={<SavingsStatusBadge status={account.status} />} />
            {account.statusReason && <InfoRow label="Status reason" value={account.statusReason} />}
            <InfoRow label="Balance" value={<span className="text-base font-bold tabular-nums" data-testid="account-balance">{peso(account.balance)}</span>} />
            <InfoRow label="Withdrawable now" value={account.withdrawalBlockedBy ?? peso(account.available)} />
            <InfoRow label="Opened" value={account.openedAt ? String(account.openedAt).slice(0, 10) : '—'} />
            {account.closedAt && <InfoRow label="Closed" value={String(account.closedAt).slice(0, 10)} />}
          </div>
          <div>
            <InfoRow
              label="Product"
              value={account.product.name.toLowerCase() === SAVINGS_KIND_LABELS[account.product.kind].toLowerCase() ? account.product.name : `${account.product.name} (${SAVINGS_KIND_LABELS[account.product.kind]})`}
            />
            <InfoRow label="Interest" value={`${displayPercent(account.product.annualRate)} a year · ${ACCRUAL_METHOD_LABELS[account.product.accrualMethod]} · credited monthly`} />
            <InfoRow label="Minimum balance" value={peso(account.product.minimumBalance)} />
            <InfoRow
              label="Withdrawal limits"
              value={[account.product.maxWithdrawalAmount ? `${peso(account.product.maxWithdrawalAmount)} each` : null, account.product.maxWithdrawalsPerMonth ? `${account.product.maxWithdrawalsPerMonth} a month` : null].filter(Boolean).join(' · ') || 'None'}
            />
            {account.maturityDate && <InfoRow label="Matures" value={account.maturityDate} />}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statement</CardTitle>
        </CardHeader>
        <CardBody>
          <StatementView statement={st} from={from} to={to} onRange={(f, t) => { setFrom(f); setTo(t); }} />
        </CardBody>
      </Card>

      {dialog && (dialog.kind === 'DEPOSIT' || dialog.kind === 'WITHDRAWAL') && <CounterModal type={dialog.kind} account={account} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'STATUS' && <StatusModal action={dialog.action} account={account} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'CLOSE' && <CloseModal account={account} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  );
};

export default SavingsTransactionsPage;
