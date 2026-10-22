import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppModal, AppTextInput, Badge, ErrorView, InfoRow, LoadingView, ScreenHeader, SectionHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api, fieldErrorsOf, messageOf } from '../../services/api';
import type { SavingsAccountView, SavingsStatementView, WithdrawalRequestView } from '../../shared/client';
import { manilaToday, statementCsv } from '../../shared/client';
import {
  ACCRUAL_METHOD_LABELS,
  SAVINGS_KIND_LABELS,
  WITHDRAWAL_DESTINATIONS,
  WITHDRAWAL_DESTINATION_LABELS,
  centsFromDb,
  checkWithdrawal,
  displayPercent,
  parsePesos,
  type WithdrawalDestination,
} from '../../shared/lending';
import { formatCurrency, formatDate } from '../../utils/format';

const REQUEST_LABEL: Record<string, string> = { PENDING: 'Waiting', APPROVED: 'Released', REJECTED: 'Declined', CANCELLED: 'Cancelled' };

/** Savings: the member's accounts, statement with running balances, and withdrawal requests (same API and rules as the web portal). */
export const SavingsScreen: React.FC = () => {
  const [accounts, setAccounts] = useState<SavingsAccountView[] | null>(null);
  const [requests, setRequests] = useState<WithdrawalRequestView[]>([]);
  const [selected, setSelected] = useState('');
  const [statement, setStatement] = useState<SavingsStatementView | null>(null);
  const [statementError, setStatementError] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const loadStatement = useCallback(async (accountId: string) => {
    setStatement(null);
    setStatementError('');
    try {
      setStatement(await api.getSavingsStatement(accountId));
    } catch (err) {
      setStatementError(messageOf(err, 'The statement could not be loaded.'));
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [acc, req] = await Promise.all([api.getSavingsAccounts(), api.getWithdrawalRequests()]);
      setAccounts(acc);
      setRequests(req);
      setError('');
      const keep = acc.find((a) => a.id === selected) ?? acc.find((a) => a.status !== 'CLOSED') ?? acc[0];
      if (keep) {
        setSelected(keep.id);
        loadStatement(keep.id);
      }
    } catch (err) {
      setError(messageOf(err, 'Your savings could not be loaded.'));
    } finally {
      setRefreshing(false);
    }
  }, [selected, loadStatement]);

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const account = accounts?.find((a) => a.id === selected) ?? null;

  const exportStatement = async () => {
    if (!statement) return;
    await Share.share({ title: `Statement ${statement.account.passbookNumber}`, message: statementCsv(statement) });
  };

  const cancel = async (r: WithdrawalRequestView) => {
    try {
      await api.cancelWithdrawalRequest(r.id);
      setNotice(`Request ${r.requestNumber} cancelled.`);
      load();
    } catch (err) {
      setNotice(messageOf(err, 'The request could not be cancelled.'));
    }
  };

  if (error) return <SafeAreaView style={styles.safe}><ScreenHeader title="Savings" /><ErrorView message={error} onRetry={load} /></SafeAreaView>;
  if (!accounts) return <SafeAreaView style={styles.safe}><ScreenHeader title="Savings" /><LoadingView text="Loading your savings…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Savings" subtitle="Accounts, statements and withdrawals" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {accounts.length === 0 ? (
          <AppCard>
            <Text style={styles.emptyTitle}>No savings account yet</Text>
            <Text style={styles.muted}>A regular savings account is opened for you when your KYC is approved. You can also open one at your branch.</Text>
          </AppCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {accounts.map((a) => (
              <TouchableOpacity key={a.id} onPress={() => { setSelected(a.id); loadStatement(a.id); }} accessibilityLabel={`${a.product.name} ${formatCurrency(a.balance)}`}>
                <View style={[styles.accountCard, a.id === selected && styles.accountCardActive]}>
                  <Text style={styles.accountName}>{a.product.name}</Text>
                  <Text style={styles.accountBalance}>{formatCurrency(a.balance)}</Text>
                  <Text style={styles.accountSub}>{a.passbookNumber}</Text>
                  <Badge status={a.status} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {account ? (
          <AppCard style={{ marginBottom: 12 }}>
            <InfoRow label="Type" value={SAVINGS_KIND_LABELS[account.product.kind]} />
            <InfoRow label="Interest" value={`${displayPercent(account.product.annualRate)} a year · ${ACCRUAL_METHOD_LABELS[account.product.accrualMethod].toLowerCase()} · monthly`} />
            <InfoRow label="Minimum balance" value={formatCurrency(account.product.minimumBalance)} />
            <InfoRow label="Withdrawable now" value={account.withdrawalBlockedBy ?? formatCurrency(account.available)} last={!account.maturityDate} />
            {account.maturityDate ? <InfoRow label="Matures" value={formatDate(account.maturityDate)} last /> : null}
            {account.status !== 'CLOSED' ? (
              <AppButton
                title="Request a withdrawal"
                variant="outline"
                style={{ marginTop: 12 }}
                disabled={!!account.withdrawalBlockedBy}
                onPress={() => { setNotice(''); setWithdrawOpen(true); }}
              />
            ) : null}
          </AppCard>
        ) : null}

        {requests.length ? (
          <>
            <SectionHeader title="Withdrawal requests" />
            {requests.map((r) => (
              <AppCard key={r.id} style={styles.rowCard}>
                <View style={styles.row}>
                  <View style={styles.flex1}>
                    <Text style={styles.rowTitle}>{formatCurrency(r.amount)} · {r.destination ? WITHDRAWAL_DESTINATION_LABELS[r.destination as WithdrawalDestination] ?? r.destination : ''}</Text>
                    <Text style={styles.muted}>{r.requestNumber} · {formatDate(r.requestedOn)} · {r.reason}</Text>
                    {r.rejectionReason ? <Text style={styles.danger}>Declined: {r.rejectionReason}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Badge status={REQUEST_LABEL[r.status] ?? r.status} />
                    {r.status === 'PENDING' ? (
                      <TouchableOpacity onPress={() => cancel(r)} style={{ marginTop: 6 }} accessibilityLabel={`Cancel ${r.requestNumber}`}>
                        <Text style={styles.link}>Cancel</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </AppCard>
            ))}
          </>
        ) : null}

        {account ? (
          <>
            <SectionHeader
              title="Statement"
              right={statement ? (
                <TouchableOpacity onPress={exportStatement} accessibilityLabel="Export statement">
                  <Text style={styles.link}>Export</Text>
                </TouchableOpacity>
              ) : null}
            />
            {statementError ? (
              <ErrorView message={statementError} onRetry={() => loadStatement(account.id)} />
            ) : !statement ? (
              <LoadingView text="Loading the statement…" style={{ flex: 0, paddingVertical: 24 }} />
            ) : statement.lines.length === 0 ? (
              <Text style={styles.muted}>No transactions yet.</Text>
            ) : (
              <>
                {statement.lines.map((l) => (
                  <AppCard key={l.id} style={styles.rowCard} padded={false}>
                    <View style={[styles.row, { padding: 12 }]}>
                      <View style={styles.flex1}>
                        <Text style={styles.rowTitle}>{l.label}</Text>
                        <Text style={styles.muted}>{formatDate(l.date)} · {l.number}{l.reference ? ` · ${l.reference}` : ''}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.amount, l.moneyOut ? styles.out : styles.in]}>{l.moneyOut ? `−${formatCurrency(l.moneyOut)}` : `+${formatCurrency(l.moneyIn)}`}</Text>
                        <Text style={styles.muted}>Balance {formatCurrency(l.balance)}</Text>
                      </View>
                    </View>
                  </AppCard>
                ))}
                <AppCard>
                  <InfoRow label="Money in" value={formatCurrency(statement.totalIn)} />
                  <InfoRow label="Money out" value={formatCurrency(statement.totalOut)} />
                  <InfoRow label="Closing balance" value={formatCurrency(statement.closingBalance)} strong last />
                </AppCard>
              </>
            )}
          </>
        ) : null}
      </ScrollView>

      {withdrawOpen && account ? (
        <WithdrawalModal
          account={account}
          onClose={() => setWithdrawOpen(false)}
          onDone={(r) => {
            setWithdrawOpen(false);
            setNotice(`Request ${r.requestNumber} sent. Your branch releases it after checking.`);
            load();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
};

const WithdrawalModal: React.FC<{ account: SavingsAccountView; onClose: () => void; onDone: (r: WithdrawalRequestView) => void }> = ({ account, onClose, onDone }) => {
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState<WithdrawalDestination>('CASH_PICKUP');
  const [destinationAccount, setDestinationAccount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const cents = parsePesos(amount);
  // The same rule the server applies when the request is filed and when it is released.
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

  const send = async () => {
    const e: Record<string, string> = {};
    if (cents === null || cents <= 0) e.amount = 'Enter the amount (pesos and centavos only).';
    else if (check && !check.ok) e.amount = check.message;
    if (destination !== 'CASH_PICKUP' && !destinationAccount.trim()) e.destinationAccount = 'Enter the account or e-wallet number.';
    if (reason.trim().length < 3) e.reason = 'Tell us what the withdrawal is for.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      onDone(await api.requestWithdrawal({ accountId: account.id, amount, destination, destinationAccount: destinationAccount.trim() || undefined, reason: reason.trim() }));
    } catch (err) {
      setErrors({ ...fieldErrorsOf(err), submit: messageOf(err, 'The request could not be sent.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal visible onClose={onClose} title="Request a withdrawal" subtitle={`${account.product.name} · up to ${formatCurrency(account.available)}`} confirmText="Send request" onConfirm={send} confirmLoading={saving}>
      {errors.submit ? <Text style={styles.danger}>{errors.submit}</Text> : null}
      <AppTextInput label="Amount (₱)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} error={errors.amount || (check && !check.ok ? check.message : undefined)} />
      <Text style={styles.label}>How do you want to receive it?</Text>
      {WITHDRAWAL_DESTINATIONS.map((d) => (
        <TouchableOpacity key={d} onPress={() => setDestination(d)} style={styles.option} accessibilityLabel={WITHDRAWAL_DESTINATION_LABELS[d]}>
          <Ionicons name={destination === d ? 'radio-button-on' : 'radio-button-off'} size={18} color={destination === d ? colors.primary : colors.textFaint} />
          <Text style={styles.optionText}>{WITHDRAWAL_DESTINATION_LABELS[d]}</Text>
        </TouchableOpacity>
      ))}
      {destination !== 'CASH_PICKUP' ? (
        <AppTextInput label={destination === 'E_WALLET' ? 'E-wallet number' : 'Bank account number'} value={destinationAccount} onChangeText={setDestinationAccount} error={errors.destinationAccount} />
      ) : null}
      <AppTextInput label="What is it for?" value={reason} onChangeText={setReason} error={errors.reason} />
    </AppModal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 60 },
  notice: { backgroundColor: colors.greenSoft, color: colors.greenDark, padding: 10, borderRadius: radius.md, marginBottom: 12, fontSize: 13 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
  muted: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  danger: { fontSize: 12, color: colors.danger, marginTop: 4 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  accountCard: { width: 210, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 10 },
  accountCardActive: { borderColor: colors.primary, borderWidth: 2 },
  accountName: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  accountBalance: { fontSize: 22, fontWeight: '900', color: colors.text, marginVertical: 4 },
  accountSub: { fontSize: 11, color: colors.textFaint, marginBottom: 6 },
  rowCard: { marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  amount: { fontSize: 14, fontWeight: '800' },
  in: { color: colors.greenDark },
  out: { color: colors.danger },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 6, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  optionText: { fontSize: 14, color: colors.text, marginLeft: 10 },
});
