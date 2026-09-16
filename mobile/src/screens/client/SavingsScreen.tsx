import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppModal, AppTextInput, Badge, LoadingView, ScreenHeader, SectionHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { SavingsAccount, SavingsTransaction } from '../../types';
import { formatCurrency, formatDate, percentComplete } from '../../utils/format';
import { validators } from '../../utils/validation';

export const SavingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [depositVisible, setDepositVisible] = useState(false);
  const [withdrawVisible, setWithdrawVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{ requestId?: string; message?: string }>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoaded(false);
    setError(null);
    try {
      const [acc, txns] = await Promise.all([api.getSavings(), api.getSavingsTransactions()]);
      setAccount(acc);
      setTransactions([...txns].sort((a, b) => (a.date < b.date ? 1 : -1)));
    } catch (err: any) {
      setError(err?.message || 'Unable to load savings.');
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goalProgress = account?.goal ? percentComplete(account.balance, account.goal) : 0;

  const submitWithdrawal = async () => {
    setWithdrawError(null);
    const amt = Number(withdrawAmount);
    const amtErr = validators.amount(withdrawAmount);
    if (amtErr) {
      setWithdrawError(amtErr);
      return;
    }
    if (!withdrawReason.trim()) {
      setWithdrawError('Tell us the reason for your withdrawal.');
      return;
    }
    if (account && amt > account.balance) {
      setWithdrawError(`Amount must not exceed your available balance (${formatCurrency(account.balance)}).`);
      return;
    }
    setWithdrawing(true);
    try {
      const res = await api.requestSavingsWithdrawal({ amount: amt, reason: withdrawReason.trim() });
      setWithdrawResult({ requestId: res.requestId, message: res.message });
      setWithdrawDone(true);
    } catch (err: any) {
      setWithdrawError(err?.message || 'Request failed. Please try again.');
    } finally {
      setWithdrawing(false);
    }
  };

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="My Savings" /><LoadingView /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="My Savings" subtitle="Save with HOSCOMO, build a better future" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>TOTAL SAVINGS</Text>
              <Text style={styles.balanceValue}>{formatCurrency(account?.balance)}</Text>
              {account?.accountNumber ? <Text style={styles.balanceSub}>Account {account.accountNumber}</Text> : null}
              <View style={styles.balanceStatsRow}>
                <View style={styles.balanceStat}>
                  <Text style={styles.balanceStatValue}>{formatCurrency(account?.totalDeposits)}</Text>
                  <Text style={styles.balanceStatLabel}>Total deposits</Text>
                </View>
                <View style={styles.balanceStatDivider} />
                <View style={styles.balanceStat}>
                  <Text style={styles.balanceStatValue}>{formatCurrency(account?.totalWithdrawals)}</Text>
                  <Text style={styles.balanceStatLabel}>Total withdrawals</Text>
                </View>
              </View>
            </View>

            {account?.goal ? (
              <AppCard style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={styles.flex1}>
                    <Text style={styles.goalTitle}>{account.goalName ?? 'Savings Goal'}</Text>
                    <Text style={styles.goalSub}>
                      {formatCurrency(account.balance)} of {formatCurrency(account.goal)} saved
                    </Text>
                  </View>
                  <Text style={styles.goalPct}>{goalProgress}%</Text>
                </View>
                <View style={styles.goalTrack}>
                  <View style={[styles.goalFill, { width: `${goalProgress}%` }]} />
                </View>
              </AppCard>
            ) : null}

            <View style={styles.infoNote}>
              <Ionicons name="information-circle-outline" size={16} color={colors.info} />
              <Text style={styles.infoNoteText}>
                Savings earn 1% interest per annum, credited quarterly. Deposits are accepted over the counter at any HOSCOMO branch.
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <AppButton
                title="Deposit at Branch"
                variant="secondary"
                icon={<Ionicons name="arrow-down-circle-outline" size={17} color={colors.white} />}
                onPress={() => setDepositVisible(true)}
              />
              <AppButton
                title="Request Withdrawal"
                variant="outline"
                style={{ marginTop: 10 }}
                icon={<Ionicons name="arrow-up-circle-outline" size={17} color={colors.primary} />}
                onPress={() => {
                  setWithdrawAmount('');
                  setWithdrawReason('');
                  setWithdrawError(null);
                  setWithdrawDone(false);
                  setWithdrawVisible(true);
                }}
              />
            </View>

            <SectionHeader title="Transaction History" subtitle={transactions.length ? 'Your savings activity' : undefined} />
          </>
        }
        renderItem={({ item }) => {
          const isDeposit = item.type === 'DEPOSIT' || item.type === 'INTEREST';
          return (
            <AppCard style={styles.txnCard} padded={false}>
              <View style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: isDeposit ? colors.greenSoft : colors.dangerSoft }]}>
                  <Ionicons name={isDeposit ? 'arrow-down' : 'arrow-up'} size={16} color={isDeposit ? colors.greenDark : colors.danger} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.txnType}>{item.type.charAt(0) + item.type.slice(1).toLowerCase()}</Text>
                  <Text style={styles.txnRef}>{item.referenceNumber}</Text>
                  <View style={{ marginTop: 3 }}>
                    <Badge status={item.status} />
                  </View>
                </View>
                <View style={styles.txnAmtWrap}>
                  <Text style={[styles.txnAmt, isDeposit ? styles.txnAmtIn : styles.txnAmtOut]}>
                    {isDeposit ? '+' : '-'}{formatCurrency(item.amount)}
                  </Text>
                  <Text style={styles.txnBalance}>Bal: {formatCurrency(item.balanceAfter)}</Text>
                  <Text style={styles.txnDate}>{formatDate(item.date)}</Text>
                </View>
              </View>
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="wallet-outline" size={34} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No savings activity yet</Text>
            <Text style={styles.emptyMsg}>Your deposits and withdrawals will appear here.</Text>
          </View>
        }
      />

      <AppModal
        visible={depositVisible}
        onClose={() => setDepositVisible(false)}
        title="How to Make a Deposit"
        subtitle="Deposit at any HOSCOMO branch"
        icon="storefront-outline"
        iconColor={colors.teal}
        iconBg={colors.tealSoft}
        confirmText="Got it"
        onConfirm={() => setDepositVisible(false)}
      >
        <View style={styles.depositStep}>
          <Text style={styles.depositStepNum}>1</Text>
          <Text style={styles.depositStepText}>Visit any HOSCOMO branch and bring your member number or valid ID.</Text>
        </View>
        <View style={styles.depositStep}>
          <Text style={styles.depositStepNum}>2</Text>
          <Text style={styles.depositStepText}>
            Tell the teller you are making a savings deposit. Cash deposits start at ₱50.
          </Text>
        </View>
        <View style={styles.depositStep}>
          <Text style={styles.depositStepNum}>3</Text>
          <Text style={styles.depositStepText}>
            Keep your official receipt. Your balance updates automatically once posted.
          </Text>
        </View>
        <Text style={styles.doneMsg}>Savings earn 1% interest per annum, credited quarterly.</Text>
      </AppModal>

      <AppModal
        visible={withdrawVisible && !withdrawDone}
        onClose={() => setWithdrawVisible(false)}
        title="Savings Transaction"
        subtitle="Share a few details and our teller will follow up."
        icon="wallet-outline"
        iconColor={colors.teal}
        iconBg={colors.tealSoft}
        confirmText={withdrawAmount ? 'Submit Request' : undefined}
        onConfirm={withdrawAmount ? submitWithdrawal : undefined}
        confirmLoading={withdrawing}
      >
        <AppTextInput
          label="Amount (₱)"
          placeholder="e.g. 500"
          value={withdrawAmount}
          onChangeText={(v) => { setWithdrawAmount(v); setWithdrawError(null); }}
          keyboardType="numeric"
          error={withdrawError}
        />
        <AppTextInput
          label="Reason / Note"
          placeholder="e.g. School fees — deposit via GCash"
          value={withdrawReason}
          onChangeText={(v) => { setWithdrawReason(v); setWithdrawError(null); }}
          multiline
          numberOfLines={2}
        />
        {!withdrawAmount && !withdrawError ? (
          <Text style={styles.modalHint}>
            Tip: You can deposit over the counter at any branch, or request a withdrawal to your GCash/Maya account.
          </Text>
        ) : null}
      </AppModal>

      <AppModal
        visible={withdrawVisible && withdrawDone}
        onClose={() => setWithdrawVisible(false)}
        title="Request Submitted"
        subtitle="Processing takes 1–3 banking days"
        icon="checkmark-circle-outline"
        iconColor={colors.green}
        iconBg={colors.greenSoft}
        confirmText="Done"
        onConfirm={() => setWithdrawVisible(false)}
      >
        <View style={styles.doneRow}>
          <Text style={styles.doneLabel}>Request ID</Text>
          <Text style={styles.doneValue}>{withdrawResult.requestId ?? '—'}</Text>
        </View>
        <View style={styles.doneRow}>
          <Text style={styles.doneLabel}>Status</Text>
          <Text style={styles.doneValue}>Pending Teller Verification</Text>
        </View>
        <Text style={styles.doneMsg}>
          {withdrawResult.message ?? 'You will be notified once your request is processed.'}
        </Text>
      </AppModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  error: { fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 8 },
  content: { padding: 16, paddingTop: 4, paddingBottom: 110, flexGrow: 1 },
  balanceCard: {
    backgroundColor: colors.tealDark,
    borderRadius: radius.xl,
    padding: 20,
    marginBottom: 12,
  },
  balanceLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  balanceValue: { fontSize: 30, fontWeight: '900', color: colors.white, marginTop: 4 },
  balanceSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  balanceStatsRow: { flexDirection: 'row', marginTop: 16 },
  balanceStat: { flex: 1 },
  balanceStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 16,
  },
  balanceStatValue: { fontSize: 15, fontWeight: '800', color: colors.white },
  balanceStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  goalCard: { marginBottom: 12 },
  goalHeader: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1, marginRight: 10 },
  goalTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  goalSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  goalPct: { fontSize: 14, fontWeight: '800', color: colors.teal },
  goalTrack: {
    height: 8,
    borderRadius: radius.round,
    backgroundColor: colors.background,
    overflow: 'hidden',
    marginTop: 12,
  },
  goalFill: { height: 8, borderRadius: radius.round, backgroundColor: colors.teal },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 14,
  },
  infoNoteText: { flex: 1, marginLeft: 8, fontSize: 11, color: colors.info, lineHeight: 16 },
  actionsRow: { marginBottom: 20 },
  txnCard: { marginBottom: 8 },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  txnIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnType: { fontSize: 13, fontWeight: '700', color: colors.text },
  txnRef: { fontSize: 10, color: colors.textFaint, marginTop: 1 },
  txnAmtWrap: { alignItems: 'flex-end', marginLeft: 8 },
  txnAmt: { fontSize: 14, fontWeight: '800' },
  txnAmtIn: { color: colors.greenDark },
  txnAmtOut: { color: colors.danger },
  txnBalance: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  txnDate: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 10 },
  emptyMsg: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  modalHint: { fontSize: 11, color: colors.textFaint, marginTop: 4, lineHeight: 16 },
  doneRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  doneLabel: { fontSize: 13, color: colors.textMuted },
  doneValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  doneMsg: { fontSize: 12, color: colors.textFaint, marginTop: 12, lineHeight: 17 },
  depositStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  depositStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 10,
    overflow: 'hidden',
  },
  depositStepText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
});