import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Clock, PiggyBank, ShieldAlert, Zap } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ACCRUAL_METHOD_LABELS,
  SAVINGS_KIND_LABELS,
  WITHDRAWAL_DESTINATIONS,
  WITHDRAWAL_DESTINATION_LABELS,
  centsFromDb,
  checkWithdrawal,
  parsePesos,
  type WithdrawalDestination,
  displayPercent,
} from '../../../shared/lending';
import { isKycVerified } from '../../../shared/kyc-core';
import { savingsService, type MemberSavingsAccount, type MemberWithdrawalRequest } from '../services/savings';
import { profileService } from '../services/profile';
import { ApiError } from '../services/clientApi';
import type { KycStatusData } from '../types';
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, Field, Input, LoadingState, Modal, Select, StatusBadge } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { manilaToday, peso } from '../../components/lending';
import { StatementView, type SavingsStatement } from '../../components/savings/SavingsStatement';
import { onlinePaymentsService, type OnlineOverview } from '../services/onlinePayments';
import { AddPayoutAccountModal, DepositReturnBanner, InstantWithdrawModal, OnlineDepositModal, OnlinePaymentsCard } from '../components/online/OnlinePayments';

const statusTone = (s: string) => (s === 'ACTIVE' ? 'green' : s === 'FROZEN' ? 'red' : s === 'DORMANT' ? 'amber' : 'slate') as 'green' | 'red' | 'amber' | 'slate';

const SavingsPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<MemberSavingsAccount[]>([]);
  const [requests, setRequests] = useState<MemberWithdrawalRequest[]>([]);
  const [kyc, setKyc] = useState<KycStatusData | null>(null);
  const [selected, setSelected] = useState('');
  const [statement, setStatement] = useState<SavingsStatement | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [online, setOnline] = useState<OnlineOverview | null>(null);
  const [onlineError, setOnlineError] = useState('');
  const [depositOpen, setDepositOpen] = useState(false);
  const [instantOpen, setInstantOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const returningDeposit = params.get('deposit');

  const loadOnline = useCallback(async () => {
    try {
      setOnline(await onlinePaymentsService.overview());
      setOnlineError('');
    } catch (err) {
      setOnline(null);
      setOnlineError(err instanceof Error ? err.message : 'Online payments could not be loaded.');
    }
  }, []);

  // Only the first load replaces the page; later refreshes (after a payment settles) update it in place.
  const loadedOnce = useRef(false);
  const load = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    setError('');
    try {
      const [acc, req, k] = await Promise.all([savingsService.accounts(), savingsService.requests(), profileService.kycStatus().catch(() => null)]);
      setAccounts(acc);
      setRequests(req);
      setKyc(k);
      setSelected((cur) => (cur && acc.some((a) => a.id === cur) ? cur : acc.find((a) => a.status !== 'CLOSED')?.id ?? acc[0]?.id ?? ''));
      loadedOnce.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load savings.';
      if (loadedOnce.current) toast.error(message);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    loadOnline();
  }, [load, loadOnline]);

  // A payout on its way: refresh until the provider settles it.
  const inFlight = online?.payouts.some((p) => p.status === 'SUBMITTING' || p.status === 'PROCESSING') ?? false;
  useEffect(() => {
    if (!inFlight) return;
    const timer = setTimeout(() => {
      loadOnline();
      load();
    }, 3000);
    return () => clearTimeout(timer);
  }, [inFlight, online, loadOnline, load]);

  const depositSettled = useCallback(() => {
    load();
    loadOnline();
  }, [load, loadOnline]);

  useEffect(() => {
    if (!selected) return setStatement(null);
    savingsService.statement(selected, { from: from || undefined, to: to || undefined }).then(setStatement, (err) => toast.error(err instanceof Error ? err.message : 'The statement could not be loaded.'));
  }, [selected, from, to, toast, accounts]);

  const account = accounts.find((a) => a.id === selected) ?? null;
  const pending = requests.filter((r) => r.status === 'PENDING');

  const requireKyc = (what: string) => {
    if (isKycVerified(kyc?.kycStatus || 'NOT_STARTED')) return true;
    toast.error(`KYC verification must be approved before you can ${what}.`);
    navigate('/portal/kyc');
    return false;
  };
  const openWithdrawal = (amount = '') => {
    if (!requireKyc('request withdrawals')) return;
    setRequestAmount(amount);
    setWithdrawOpen(true);
  };

  const cancel = async (r: MemberWithdrawalRequest) => {
    try {
      await savingsService.cancelRequest(r.id);
      toast.success(`Request ${r.requestNumber} cancelled.`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The request could not be cancelled.');
    }
  };

  if (loading) return <LoadingState label="Loading your savings…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Savings</h1>
          <p className="text-sm text-slate-500">Your accounts, statements, online deposits and withdrawals.</p>
        </div>
        {account && account.status !== 'CLOSED' && (
          <div className="flex flex-wrap gap-2">
            {online && (
              <Button onClick={() => requireKyc('deposit online') && setDepositOpen(true)}>
                <ArrowDownToLine className="h-4 w-4" /> Deposit online
              </Button>
            )}
            {online && (
              <Button variant="outline" onClick={() => requireKyc('withdraw') && setInstantOpen(true)} disabled={!!account.withdrawalBlockedBy} title={account.withdrawalBlockedBy ?? undefined}>
                <Zap className="h-4 w-4" /> Withdraw instantly
              </Button>
            )}
            <Button variant="outline" onClick={() => openWithdrawal()} disabled={!!account.withdrawalBlockedBy} title={account.withdrawalBlockedBy ?? undefined}>
              <ArrowUpFromLine className="h-4 w-4" /> Request withdrawal
            </Button>
          </div>
        )}
      </div>

      {returningDeposit && (
        <DepositReturnBanner
          depositId={returningDeposit}
          onSettled={depositSettled}
          onDismiss={() => {
            params.delete('deposit');
            setParams(params, { replace: true });
          }}
        />
      )}

      {accounts.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-6 w-6" />}
          title="No savings account yet"
          description="A regular savings account is opened for you when your KYC is approved. You can also open one at your branch."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a.id)}
              className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${a.id === selected ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{a.product.name}</span>
                <StatusBadge status={a.status} tone={statusTone(a.status)} />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{peso(a.balance)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {a.passbookNumber} · {displayPercent(a.product.annualRate)} a year
              </p>
              <p className="mt-1 text-xs text-slate-500">{a.withdrawalBlockedBy ?? `Withdrawable: ${peso(a.available)}`}</p>
            </button>
          ))}
        </div>
      )}

      {account && (
        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <p>Type: <strong>{SAVINGS_KIND_LABELS[account.product.kind]}</strong></p>
            <p>Interest: <strong>{displayPercent(account.product.annualRate)} a year</strong>, {ACCRUAL_METHOD_LABELS[account.product.accrualMethod].toLowerCase()}, credited monthly</p>
            <p>Minimum balance: <strong>{peso(account.product.minimumBalance)}</strong></p>
            <p>
              Withdrawal limits:{' '}
              <strong>
                {[account.product.maxWithdrawalAmount ? `${peso(account.product.maxWithdrawalAmount)} each` : null, account.product.maxWithdrawalsPerMonth ? `${account.product.maxWithdrawalsPerMonth} a month` : null].filter(Boolean).join(' · ') || 'none'}
              </strong>
            </p>
            {account.maturityDate && <p>Matures on: <strong>{account.maturityDate}</strong></p>}
            {account.status === 'FROZEN' && (
              <p className="flex items-center gap-1 text-rose-700 sm:col-span-2"><ShieldAlert className="h-4 w-4" /> This account is frozen. Please contact your branch.</p>
            )}
          </CardBody>
        </Card>
      )}

      {online ? (
        <OnlinePaymentsCard online={online} onAddAccount={() => requireKyc('add a payout account') && setAddAccountOpen(true)} onChanged={loadOnline} onError={(m) => toast.error(m)} />
      ) : (
        onlineError && <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Online deposits and instant withdrawals are not available right now. {onlineError}</p>
      )}

      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Withdrawal requests{pending.length ? ` (${pending.length} waiting)` : ''}</CardTitle>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-800">{peso(r.amount)} · {r.destination ? WITHDRAWAL_DESTINATION_LABELS[r.destination as WithdrawalDestination] ?? r.destination : ''}</p>
                  <p className="text-xs text-slate-500">{r.requestNumber} · filed {r.requestedOn} · {r.reason}</p>
                  {r.rejectionReason && <p className="text-xs text-rose-600">Declined: {r.rejectionReason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.status === 'PENDING' && <Button size="sm" variant="outline" onClick={() => cancel(r)}>Cancel</Button>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {statement && (
        <Card>
          <CardHeader>
            <CardTitle>Statement</CardTitle>
          </CardHeader>
          <CardBody>
            <StatementView statement={statement} from={from} to={to} onRange={(f, t) => { setFrom(f); setTo(t); }} />
          </CardBody>
        </Card>
      )}

      {depositOpen && account && <OnlineDepositModal account={account} onClose={() => setDepositOpen(false)} />}

      {instantOpen && account && online && (
        <InstantWithdrawModal
          account={account}
          online={online}
          onClose={() => setInstantOpen(false)}
          onDone={() => {
            load();
            loadOnline();
          }}
          onUseRequest={(amount) => {
            setInstantOpen(false);
            openWithdrawal(amount);
          }}
          onAddAccount={() => {
            setInstantOpen(false);
            setAddAccountOpen(true);
          }}
        />
      )}

      {addAccountOpen && online && (
        <AddPayoutAccountModal
          online={online}
          onClose={() => setAddAccountOpen(false)}
          onSaved={(a) => {
            setAddAccountOpen(false);
            toast.success(`${a.channelLabel} ${a.accountNumber} added. Your branch will verify it before your first instant withdrawal.`);
            loadOnline();
          }}
        />
      )}

      {withdrawOpen && account && (
        <WithdrawalRequestModal
          account={account}
          initialAmount={requestAmount}
          onClose={() => setWithdrawOpen(false)}
          onDone={(r) => {
            setWithdrawOpen(false);
            toast.success(`Request ${r.requestNumber} sent. Your branch will release it after checking.`);
            load();
          }}
        />
      )}
    </div>
  );
};

const WithdrawalRequestModal: React.FC<{ account: MemberSavingsAccount; initialAmount?: string; onClose: () => void; onDone: (r: MemberWithdrawalRequest) => void }> = ({ account, initialAmount = '', onClose, onDone }) => {
  const [amount, setAmount] = useState(initialAmount);
  const [destination, setDestination] = useState<WithdrawalDestination>('CASH_PICKUP');
  const [destinationAccount, setDestinationAccount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const cents = parsePesos(amount);
  // The same rule the server applies when the request is filed and again when it is released.
  const check = useMemo(
    () =>
      cents !== null && cents > 0
        ? checkWithdrawal({
            status: account.status,
            balance: centsFromDb(account.balance),
            product: {
              kind: account.product.kind,
              minimumBalance: centsFromDb(account.product.minimumBalance),
              maxWithdrawalAmount: account.product.maxWithdrawalAmount === null ? null : centsFromDb(account.product.maxWithdrawalAmount),
              maxWithdrawalsPerMonth: account.product.maxWithdrawalsPerMonth,
            },
            amount: cents,
            withdrawalsThisMonth: 0,
            maturityDate: account.maturityDate,
            today: manilaToday(),
          })
        : null,
    [cents, account],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (cents === null || cents <= 0) local.amount = 'Enter the amount (pesos and centavos only).';
    if (destination !== 'CASH_PICKUP' && !destinationAccount.trim()) local.destinationAccount = 'Enter the account or e-wallet number.';
    if (reason.trim().length < 3) local.reason = 'Tell us what the withdrawal is for.';
    setErrors(local);
    setError('');
    if (Object.keys(local).length || (check && !check.ok)) return;
    setSaving(true);
    try {
      onDone(await savingsService.requestWithdrawal({ accountId: account.id, amount, destination, destinationAccount: destinationAccount.trim() || undefined, reason: reason.trim() }));
    } catch (err) {
      const fields = err instanceof ApiError && err.details && typeof err.details.fields === 'object' ? (err.details.fields as Record<string, string>) : {};
      setErrors(fields);
      setError(err instanceof Error ? err.message : 'The request could not be sent.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Request a withdrawal" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {account.product.name} · balance {peso(account.balance)} · you can withdraw up to {peso(account.available)}
        </p>
        <Field label="Amount (₱)" required error={errors.amount || (check && !check.ok ? check.message : undefined)}>
          <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
        </Field>
        <Field label="How do you want to receive it?" required error={errors.destination}>
          <Select value={destination} onChange={(e) => setDestination(e.target.value as WithdrawalDestination)} aria-label="Destination">
            {WITHDRAWAL_DESTINATIONS.map((d) => (
              <option key={d} value={d}>{WITHDRAWAL_DESTINATION_LABELS[d]}</option>
            ))}
          </Select>
        </Field>
        {destination !== 'CASH_PICKUP' && (
          <Field label={destination === 'E_WALLET' ? 'E-wallet number' : 'Bank account number'} required error={errors.destinationAccount}>
            <Input value={destinationAccount} onChange={(e) => setDestinationAccount(e.target.value)} aria-label="Destination account" />
          </Field>
        )}
        <Field label="What is it for?" required error={errors.reason}>
          <Input placeholder="e.g. School fees" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!!check && !check.ok}>Send request</Button>
        </div>
      </form>
    </Modal>
  );
};

export default SavingsPage;
