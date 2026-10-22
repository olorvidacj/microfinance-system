import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Plus, Trash2, Wallet, XCircle } from 'lucide-react';
import { centsFromDb, formatPeso, parsePesos } from '../../../../shared/lending';
import { INSTANT_WITHDRAWAL_MIN, ONLINE_DEPOSIT_MAX, ONLINE_DEPOSIT_MIN, OTP_LENGTH, checkDepositAmount, instantWithdrawalRoom } from '../../../../shared/payments';
import { onlinePaymentsService, type OnlineDeposit, type OnlineOverview, type OnlinePayout, type PayoutAccount } from '../../services/onlinePayments';
import type { MemberSavingsAccount } from '../../services/savings';
import { ApiError } from '../../services/clientApi';
import { Button, Card, CardHeader, CardTitle, Field, Input, Modal, Select, StatusBadge } from '../ui';
import { peso } from '../../../components/lending';

const fieldsOf = (err: unknown): Record<string, string> =>
  err instanceof ApiError && err.details && typeof err.details.fields === 'object' ? (err.details.fields as Record<string, string>) : {};
const messageOf = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

const depositTone = (s: string) => (s === 'CREDITED' ? 'green' : s === 'PENDING' ? 'amber' : s === 'NEEDS_REVIEW' ? 'blue' : 'slate') as 'green' | 'amber' | 'blue' | 'slate';
const payoutTone = (s: string) => (s === 'PAID' ? 'green' : s === 'REFUNDED' ? 'red' : s === 'CANCELLED' ? 'slate' : 'amber') as 'green' | 'red' | 'slate' | 'amber';

// ---------------------------------------------------------------------------
// Deposit
// ---------------------------------------------------------------------------

export const OnlineDepositModal: React.FC<{ account: MemberSavingsAccount; onClose: () => void }> = ({ account, onClose }) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const local = amount ? checkDepositAmount(amount) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const c = checkDepositAmount(amount);
    if (!c.ok) return setFieldError(c.errors.amount ?? 'Check the amount.');
    setSaving(true);
    try {
      const d = await onlinePaymentsService.startDeposit(account.id, amount);
      if (!d.checkoutUrl) throw new Error('The payment page could not be opened.');
      // Off to the provider's page. The account is credited when the provider confirms the payment.
      window.location.assign(d.checkoutUrl);
    } catch (err) {
      setFieldError(fieldsOf(err).amount ?? '');
      setError(messageOf(err, 'The payment page could not be opened.'));
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Deposit online" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Into {account.product.name} ({account.passbookNumber}). You pay on the payment provider’s secure page; your savings are credited as soon as the provider confirms the payment.
        </p>
        <Field label="Amount (₱)" required error={fieldError || (local && !local.ok ? local.errors.amount : undefined)} hint={`${formatPeso(ONLINE_DEPOSIT_MIN)} to ${formatPeso(ONLINE_DEPOSIT_MAX)}`}>
          <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => { setAmount(e.target.value); setFieldError(''); }} aria-label="Deposit amount" autoFocus />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!!local && !local.ok}>Continue to payment</Button>
        </div>
      </form>
    </Modal>
  );
};

/**
 * Shown when the member comes back from checkout. It asks the server, which
 * asks the provider; coming back alone never credits anything.
 */
export const DepositReturnBanner: React.FC<{ depositId: string; onSettled: () => void; onDismiss: () => void }> = ({ depositId, onSettled, onDismiss }) => {
  const [deposit, setDeposit] = useState<OnlineDeposit | null>(null);
  const [error, setError] = useState('');
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let stopped = false;
    let tries = 0;
    const tick = async () => {
      try {
        const d = await onlinePaymentsService.deposit(depositId);
        if (stopped) return;
        setDeposit(d);
        setError('');
        if (d.status !== 'PENDING') {
          onSettled();
          return;
        }
      } catch (err) {
        if (stopped) return;
        setError(messageOf(err, 'The payment could not be checked.'));
        if (err instanceof ApiError && err.status === 404) return;
      }
      tries += 1;
      if (tries >= 30) return setGaveUp(true);
      setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      stopped = true;
    };
  }, [depositId, onSettled]);

  const status = deposit?.status ?? 'PENDING';
  const tone = status === 'CREDITED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : status === 'PENDING' || status === 'NEEDS_REVIEW' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div role="status" className={`flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      <div className="flex items-start gap-2">
        {status === 'CREDITED' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : status === 'PENDING' ? <Clock className="mt-0.5 h-4 w-4 animate-pulse" /> : <XCircle className="mt-0.5 h-4 w-4" />}
        <div>
          {!deposit && !error && <p className="font-semibold">Checking your payment with the provider…</p>}
          {deposit && status === 'CREDITED' && <p className="font-semibold">{peso(deposit.amount)} was credited to your savings ({deposit.reference}).</p>}
          {deposit && status === 'PENDING' && (
            <p className="font-semibold">
              {gaveUp ? 'The provider has not confirmed this payment yet.' : 'Waiting for the provider to confirm your payment…'}
            </p>
          )}
          {deposit && status === 'PENDING' && <p className="text-xs">Your savings are credited only when the provider confirms it. {gaveUp ? 'This can take a few minutes; it will show here and in your notifications.' : ''}</p>}
          {deposit && status === 'NEEDS_REVIEW' && <p className="font-semibold">Your branch is checking this payment ({deposit.reference}). You will be notified.</p>}
          {deposit && (status === 'EXPIRED' || status === 'FAILED') && <p className="font-semibold">This payment was not completed. Nothing was charged to your savings.</p>}
          {error && <p className="text-xs text-rose-700">{error}</p>}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onDismiss}>Close</Button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Instant withdrawal
// ---------------------------------------------------------------------------

type Step = { kind: 'form' } | { kind: 'code'; payout: OnlinePayout; sentTo: string; expiresAt: number } | { kind: 'done'; payout: OnlinePayout };

export const InstantWithdrawModal: React.FC<{
  account: MemberSavingsAccount;
  online: OnlineOverview;
  onClose: () => void;
  onDone: () => void;
  onUseRequest: (amount: string) => void;
  onAddAccount: () => void;
}> = ({ account, online, onClose, onDone, onUseRequest, onAddAccount }) => {
  const verified = online.payoutAccounts.filter((a) => a.status === 'VERIFIED');
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState(verified[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (step.kind !== 'code') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step.kind]);

  const cents = parsePesos(amount);
  const room = useMemo(
    () => (cents !== null && cents > 0 ? instantWithdrawalRoom({ amount: cents, usedToday: centsFromDb(online.limits.usedToday), dailyLimit: centsFromDb(online.limits.dailyLimit) }) : null),
    [cents, online.limits],
  );
  const overLimit = room?.code === 'OVER_DAILY_LIMIT';

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!target || cents === null || !room?.ok) return;
    setSaving(true);
    try {
      const r = await onlinePaymentsService.startPayout({ accountId: account.id, payoutAccountId: target, amount });
      setStep({ kind: 'code', payout: r.payout, sentTo: r.codeSentTo, expiresAt: Date.now() + r.expiresInSeconds * 1000 });
      setCode('');
    } catch (err) {
      setError(messageOf(err, 'The withdrawal could not be started.'));
    } finally {
      setSaving(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'code') return;
    setError('');
    setSaving(true);
    try {
      const payout = await onlinePaymentsService.confirmPayout(step.payout.id, code);
      setStep({ kind: 'done', payout });
      onDone();
    } catch (err) {
      setError(messageOf(err, 'The code could not be checked.'));
      if (err instanceof ApiError && (err.code === 'OTP_EXPIRED' || err.code === 'OTP_LOCKED' || err.status === 409)) setStep({ kind: 'form' });
    } finally {
      setSaving(false);
    }
  };

  const close = async () => {
    if (step.kind === 'code') await onlinePaymentsService.cancelPayout(step.payout.id).catch(() => undefined);
    onClose();
  };

  return (
    <Modal open onClose={close} title="Withdraw instantly" size="sm">
      {step.kind === 'form' && (
        <form onSubmit={start} className="space-y-4">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Sent at once to your own bank or e-wallet account, up to {peso(online.limits.dailyLimit)} a day ({peso(online.limits.remaining)} left today). You can withdraw up to {peso(account.available)} from this account.
          </p>
          {verified.length === 0 ? (
            <div className="space-y-3 text-sm text-slate-600">
              <p>Add your own bank or e-wallet account first. Your branch verifies it once; after that, withdrawals to it are instant.</p>
              <Button type="button" onClick={onAddAccount}><Plus className="h-4 w-4" /> Add an account</Button>
            </div>
          ) : (
            <>
              <Field label="Send to" required>
                <Select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Payout account">
                  {verified.map((a) => (
                    <option key={a.id} value={a.id}>{a.channelLabel} {a.accountNumber} · {a.accountName}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount (₱)" required error={room && !room.ok && !overLimit ? room.message : undefined} hint={`At least ${formatPeso(INSTANT_WITHDRAWAL_MIN)}`}>
                <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Withdrawal amount" autoFocus />
              </Field>
              {overLimit && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p>{room?.message}</p>
                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => onUseRequest(amount)}>Send a withdrawal request instead</Button>
                </div>
              )}
            </>
          )}
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            {verified.length > 0 && <Button type="submit" loading={saving} disabled={!room?.ok}>Send me a code</Button>}
          </div>
        </form>
      )}

      {step.kind === 'code' && (
        <form onSubmit={confirm} className="space-y-4">
          <p className="text-sm text-slate-600">
            We emailed a {OTP_LENGTH}-digit code to <strong>{step.sentTo}</strong>. Enter it to send {peso(step.payout.amount)} to {step.payout.destination}. Nothing leaves your savings until you do.
          </p>
          <Field label="Code" required hint={step.expiresAt > now ? `Expires in ${Math.max(0, Math.ceil((step.expiresAt - now) / 1000))} s` : 'Expired: start again'}>
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={OTP_LENGTH} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Withdrawal code" autoFocus />
          </Field>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={code.length !== OTP_LENGTH || step.expiresAt <= now}>Confirm withdrawal</Button>
          </div>
        </form>
      )}

      {step.kind === 'done' && (
        <div className="space-y-4 text-sm text-slate-700">
          <p className="flex items-center gap-2 font-semibold">
            {step.payout.status === 'REFUNDED' ? <XCircle className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            {step.payout.status === 'REFUNDED'
              ? 'The withdrawal could not be sent. The money is back in your savings.'
              : step.payout.status === 'PAID'
                ? `${peso(step.payout.amount)} was sent to ${step.payout.destination}.`
                : `${peso(step.payout.amount)} is on its way to ${step.payout.destination}.`}
          </p>
          <p className="text-xs text-slate-500">Reference {step.payout.reference}. If the transfer fails, the money comes back to your savings automatically.</p>
          <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
        </div>
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Payout accounts and activity
// ---------------------------------------------------------------------------

export const AddPayoutAccountModal: React.FC<{ online: OnlineOverview; onClose: () => void; onSaved: (a: PayoutAccount) => void }> = ({ online, onClose, onSaved }) => {
  const [channelCode, setChannelCode] = useState(online.channels[0]?.code ?? '');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const channel = online.channels.find((c) => c.code === channelCode);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setError('');
    setSaving(true);
    try {
      onSaved(await onlinePaymentsService.addPayoutAccount({ channelCode, accountNumber, accountName }));
    } catch (err) {
      setErrors(fieldsOf(err));
      setError(messageOf(err, 'The account could not be added.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add a payout account" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Money is only sent to accounts in your own name. Your branch verifies the account once before the first withdrawal.</p>
        <Field label="Bank or e-wallet" required error={errors.channelCode}>
          <Select value={channelCode} onChange={(e) => setChannelCode(e.target.value)} aria-label="Bank or e-wallet">
            {online.channels.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </Select>
        </Field>
        <Field label={channel?.kind === 'E_WALLET' ? `${channel.label} mobile number` : 'Account number'} required error={errors.accountNumber}>
          <Input inputMode="numeric" placeholder={channel?.kind === 'E_WALLET' ? '0917 123 4567' : '0012 3456 7890'} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} aria-label="Account number" />
        </Field>
        <Field label="Account name" required error={errors.accountName} hint="Exactly as your bank or e-wallet shows it. It must be your own name.">
          <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} aria-label="Account name" />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Add account</Button>
        </div>
      </form>
    </Modal>
  );
};

export const OnlinePaymentsCard: React.FC<{ online: OnlineOverview; onAddAccount: () => void; onChanged: () => void; onError: (message: string) => void }> = ({ online, onAddAccount, onChanged, onError }) => {
  const remove = async (a: PayoutAccount) => {
    try {
      await onlinePaymentsService.removePayoutAccount(a.id);
      onChanged();
    } catch (err) {
      onError(messageOf(err, 'The account could not be removed.'));
    }
  };
  const activity = [
    ...online.deposits.map((d) => ({ id: d.id, at: d.createdAt ?? '', label: `Online deposit ${d.reference}`, amount: d.amount, status: d.status, statusLabel: d.statusLabel, tone: depositTone(d.status), sign: '+', note: null as string | null })),
    ...online.payouts.map((p) => ({ id: p.id, at: p.createdAt ?? '', label: `Instant withdrawal to ${p.destination}`, amount: p.amount, status: p.status, statusLabel: p.statusLabel, tone: payoutTone(p.status), sign: '−', note: p.failureReason })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Online payments</CardTitle>
      </CardHeader>
      <div className="grid gap-6 px-5 pb-5 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Your payout accounts</h3>
            <Button size="sm" variant="outline" onClick={onAddAccount}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <p className="mb-2 text-xs text-slate-500">Instant withdrawals today: {peso(online.limits.remaining)} left of {peso(online.limits.dailyLimit)}.</p>
          {online.payoutAccounts.length === 0 ? (
            <p className="text-sm text-slate-500">No accounts yet. Add your own GCash, Maya or bank account to withdraw instantly.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {online.payoutAccounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{a.channelLabel} {a.accountNumber}</p>
                    <p className="text-xs text-slate-500">{a.accountName}{a.status === 'REJECTED' && a.statusReason ? ` · ${a.statusReason}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={a.statusLabel} tone={a.status === 'VERIFIED' ? 'green' : a.status === 'REJECTED' ? 'red' : 'amber'} />
                    <Button size="sm" variant="ghost" onClick={() => remove(a)} aria-label={`Remove ${a.channelLabel} ${a.accountNumber}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Recent online activity</h3>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">No online deposits or withdrawals yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {activity.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{x.label}</p>
                    <p className="text-xs text-slate-500">{x.at ? new Date(x.at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : ''}{x.note ? ` · ${x.note}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-slate-700">{x.sign}{peso(x.amount)}</span>
                    <StatusBadge status={x.statusLabel} tone={x.tone} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
};

