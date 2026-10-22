import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Lock, Search, Unlock, XCircle } from 'lucide-react';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  SAVINGS_KIND_LABELS,
  centsFromDb,
  checkWithdrawal,
  parsePesos,
  type SavingsProductDto,
  displayPercent,
} from '../../../shared/lending';
import { isKycVerified } from '../../../shared/kyc-core';
import { Button } from '../../portal/components/ui/Button';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { Modal } from '../../portal/components/ui/Modal';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { useToast } from '../../portal/components/ui/Toast';
import { manilaToday, peso } from '../../components/lending';
import { clientsService, savingsService, type SavingsAccountView } from '../services';
export { StatementView } from '../../components/savings/SavingsStatement';
import { BranchApiError } from '../services/api';
import type { ClientSummary } from '../types';

export const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const fieldErrorsOf = (err: unknown): Record<string, string> => (err instanceof BranchApiError ? err.fieldErrors : {});
const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** The account's withdrawal rules in the form the shared check expects. */
export function limitsOf(a: SavingsAccountView) {
  return {
    kind: a.product.kind,
    minimumBalance: centsFromDb(a.product.minimumBalance),
    maxWithdrawalAmount: a.product.maxWithdrawalAmount === null ? null : centsFromDb(a.product.maxWithdrawalAmount),
    maxWithdrawalsPerMonth: a.product.maxWithdrawalsPerMonth,
  };
}

export const SavingsStatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <StatusBadge status={status} tone={status === 'ACTIVE' ? 'green' : status === 'FROZEN' ? 'red' : status === 'DORMANT' ? 'amber' : 'slate'} />
);

// ---------------------------------------------------------------------------
// Deposit / withdrawal
// ---------------------------------------------------------------------------

export const CounterModal: React.FC<{
  type: 'DEPOSIT' | 'WITHDRAWAL';
  account: SavingsAccountView;
  onClose: () => void;
  onDone: (message: string) => void;
}> = ({ type, account, onClose, onDone }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('CASH');
  const [reference, setReference] = useState('');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // One key per attempt: a retry after a timeout replays instead of posting twice.
  const [key] = useState(newKey);

  const cents = parsePesos(amount);
  // The same rule the server applies; the server stays the authority (it also
  // knows this month's withdrawal count).
  const check = useMemo(
    () =>
      type === 'WITHDRAWAL' && cents !== null && cents > 0
        ? checkWithdrawal({ status: account.status, balance: centsFromDb(account.balance), product: limitsOf(account), amount: cents, withdrawalsThisMonth: 0, maturityDate: account.maturityDate, today: manilaToday() })
        : null,
    [type, cents, account],
  );

  const submit = async () => {
    const local: Record<string, string> = {};
    if (cents === null || cents <= 0) local.amount = 'Enter the amount (pesos and centavos only).';
    if (method !== 'CASH' && !reference.trim()) local.referenceNumber = 'Enter the transfer reference.';
    if (type === 'WITHDRAWAL' && method !== 'CASH' && !destination.trim()) local.destinationAccount = 'Enter the account or e-wallet number.';
    setErrors(local);
    setError('');
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const input = { amount, method, referenceNumber: reference || undefined, destinationAccount: destination || undefined, notes: notes || undefined };
      const r = type === 'DEPOSIT' ? await savingsService.deposit(account.id, input, key) : await savingsService.withdraw(account.id, input, key);
      onDone(`${r.transaction.label} ${r.transaction.number} posted. New balance ${peso(r.transaction.balance)}.`);
    } catch (err) {
      setErrors(fieldErrorsOf(err));
      setError(messageOf(err, `The ${type.toLowerCase()} could not be posted.`));
    } finally {
      setSaving(false);
    }
  };

  const title = type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal';
  return (
    <Modal
      open
      onClose={onClose}
      title={`${title} · ${account.passbookNumber}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={saving} disabled={!!check && !check.ok}>
            {type === 'DEPOSIT' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
            Post {title.toLowerCase()}
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {account.memberName} · {account.product.name} · Balance <span className="font-semibold tabular-nums text-slate-800">{peso(account.balance)}</span>
        {type === 'WITHDRAWAL' && (
          <span className="block text-xs text-slate-500">
            Keeps {peso(account.product.minimumBalance)}
            {account.product.maxWithdrawalAmount ? ` · up to ${peso(account.product.maxWithdrawalAmount)} per withdrawal` : ''}
            {account.product.maxWithdrawalsPerMonth ? ` · ${account.product.maxWithdrawalsPerMonth} per month` : ''}
          </span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₱)" required error={errors.amount || (check && !check.ok ? check.message : undefined)}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-label="Amount" />
        </Field>
        <Field label={type === 'DEPOSIT' ? 'Received by' : 'Released by'}>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </Select>
        </Field>
        {method !== 'CASH' && (
          <Field label="Transfer reference" required error={errors.referenceNumber}>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} aria-label="Transfer reference" />
          </Field>
        )}
        {type === 'WITHDRAWAL' && method !== 'CASH' && (
          <Field label={method === 'E_WALLET' ? 'E-wallet number' : 'Bank account number'} required error={errors.destinationAccount}>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} aria-label="Destination account" />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Posted today ({manilaToday()}). Counter transactions cannot be back-dated.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Freeze / unfreeze / reactivate and close
// ---------------------------------------------------------------------------

const STATUS_ACTIONS = {
  FREEZE: { title: 'Freeze account', verb: 'Freeze', icon: Lock, hint: 'Deposits are still accepted; withdrawals are blocked until the account is released.' },
  UNFREEZE: { title: 'Release frozen account', verb: 'Release', icon: Unlock, hint: 'Withdrawals become possible again under the product rules.' },
  REACTIVATE: { title: 'Reactivate dormant account', verb: 'Reactivate', icon: Unlock, hint: 'Confirm the member appeared in person with a valid ID.' },
} as const;

export const StatusModal: React.FC<{
  action: keyof typeof STATUS_ACTIONS;
  account: SavingsAccountView;
  onClose: () => void;
  onDone: (message: string) => void;
}> = ({ action, account, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const a = STATUS_ACTIONS[action];
  const submit = async () => {
    if (reason.trim().length < 5) return setError('Give a reason (at least 5 characters).');
    setSaving(true);
    setError('');
    try {
      const r = await savingsService.changeStatus(account.id, action, reason.trim());
      onDone(`${account.passbookNumber} is now ${r.status.toLowerCase()}.`);
    } catch (err) {
      setError(messageOf(err, 'The status could not be changed.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`${a.title} · ${account.passbookNumber}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={saving}><a.icon className="h-4 w-4" /> {a.verb}</Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">{a.hint}</p>
      <Field label="Reason" required error={error}>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
      </Field>
    </Modal>
  );
};

export const CloseModal: React.FC<{ account: SavingsAccountView; onClose: () => void; onDone: (message: string) => void }> = ({ account, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<string>('CASH');
  const [reference, setReference] = useState('');
  const [destination, setDestination] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [key] = useState(newKey);
  const hasBalance = centsFromDb(account.balance) > 0;
  const submit = async () => {
    const local: Record<string, string> = {};
    if (reason.trim().length < 5) local.reason = 'Give the reason for closing (at least 5 characters).';
    if (hasBalance && method !== 'CASH' && !reference.trim()) local.referenceNumber = 'Enter the transfer reference.';
    if (hasBalance && method !== 'CASH' && !destination.trim()) local.destinationAccount = 'Enter the account or e-wallet number.';
    setErrors(local);
    setError('');
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      await savingsService.close(account.id, { reason: reason.trim(), method, referenceNumber: reference || undefined, destinationAccount: destination || undefined }, key);
      onDone(`${account.passbookNumber} closed${hasBalance ? `; ${peso(account.balance)} paid out` : ''}.`);
    } catch (err) {
      setErrors(fieldErrorsOf(err));
      setError(messageOf(err, 'The account could not be closed.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Close account · ${account.passbookNumber}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={saving}><XCircle className="h-4 w-4" /> Close account</Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-600">
        {hasBalance ? <>The whole balance of <strong className="tabular-nums">{peso(account.balance)}</strong> is paid out to the member, then the account is closed. This cannot be undone.</> : 'The account has no balance. Closing it cannot be undone.'}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {hasBalance && (
          <Field label="Paid out by">
            <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </Select>
          </Field>
        )}
        {hasBalance && method !== 'CASH' && (
          <>
            <Field label="Transfer reference" required error={errors.referenceNumber}>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field label="Destination account" required error={errors.destinationAccount}>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <Field label="Reason" required error={errors.reason}>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
          </Field>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Open an account
// ---------------------------------------------------------------------------

export const OpenAccountModal: React.FC<{ onClose: () => void; onDone: (account: SavingsAccountView) => void }> = ({ onClose, onDone }) => {
  const toast = useToast();
  const [products, setProducts] = useState<(SavingsProductDto & { id: string })[]>([]);
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<ClientSummary[]>([]);
  const [member, setMember] = useState<ClientSummary | null>(null);
  const [opening, setOpening] = useState('');
  const [method, setMethod] = useState<string>('CASH');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [key] = useState(newKey);

  useEffect(() => {
    savingsService.products().then((p) => {
      setProducts(p);
      setProductId((cur) => cur || p[0]?.id || '');
    }, (err) => toast.error(messageOf(err, 'Savings products could not be loaded.')));
  }, [toast]);

  const find = async () => {
    try {
      setMembers((await clientsService.list({ search: search.trim() })).slice(0, 20));
    } catch (err) {
      toast.error(messageOf(err, 'Members could not be searched.'));
    }
  };

  const product = products.find((p) => p.id === productId);
  const submit = async () => {
    const local: Record<string, string> = {};
    if (!member) local.member = 'Choose the member.';
    if (!product) local.productId = 'Choose the product.';
    const cents = opening.trim() ? parsePesos(opening) : 0;
    if (cents === null) local.openingDeposit = 'Enter the amount (pesos and centavos only).';
    else if (product && cents < (parsePesos(product.minimumOpeningDeposit) ?? 0)) local.openingDeposit = `The opening deposit must be at least ${peso(product.minimumOpeningDeposit)}.`;
    if (cents && method !== 'CASH' && !reference.trim()) local.referenceNumber = 'Enter the transfer reference.';
    setErrors(local);
    setError('');
    if (Object.keys(local).length || !member) return;
    setSaving(true);
    try {
      onDone(await savingsService.open({ memberId: member.id, productId, openingDeposit: opening.trim() || '0', method, referenceNumber: reference || undefined }, key));
    } catch (err) {
      setErrors(fieldErrorsOf(err));
      setError(messageOf(err, 'The account could not be opened.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Open a savings account"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={saving}>Open account</Button>
        </>
      }
    >
      <div className="space-y-4">
        {member ? (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <span><strong>{member.fullName}</strong> · {member.borrowerNumber || member.id}</span>
            <button type="button" className="text-xs font-medium text-emerald-700" onClick={() => setMember(null)}>Change</button>
          </div>
        ) : (
          <Field label="Member (KYC-verified only)" required error={errors.member}>
            <div className="flex gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} placeholder="Name or member number" aria-label="Find member" />
              <Button variant="outline" onClick={find}><Search className="h-4 w-4" /> Find</Button>
            </div>
            {members.length > 0 && (
              <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {members.map((m) => {
                  const ok = isKycVerified(m.kycStatus);
                  return (
                    <li key={m.id}>
                      <button type="button" disabled={!ok} onClick={() => setMember(m)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                        <span>{m.fullName} <span className="text-xs text-slate-400">{m.borrowerNumber}</span></span>
                        <span className="text-xs">{ok ? 'Verified' : 'KYC not verified'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Field>
        )}
        <Field label="Product" required error={errors.productId}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Product">
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({SAVINGS_KIND_LABELS[p.kind]}, {displayPercent(p.annualRate)} a year)</option>
            ))}
          </Select>
        </Field>
        {product && (
          <p className="text-xs text-slate-500">
            Keeps {peso(product.minimumBalance)} · opening deposit at least {peso(product.minimumOpeningDeposit)}
            {product.maxWithdrawalAmount ? ` · up to ${peso(product.maxWithdrawalAmount)} per withdrawal` : ''}
            {product.termMonths ? ` · matures after ${product.termMonths} months` : ''}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opening deposit (₱)" error={errors.openingDeposit}>
            <Input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0.00" aria-label="Opening deposit" />
          </Field>
          <Field label="Received by">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </Select>
          </Field>
          {method !== 'CASH' && (
            <Field label="Transfer reference" required error={errors.referenceNumber}>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          )}
        </div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Modal>
  );
};
