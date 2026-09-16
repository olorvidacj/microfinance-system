import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, Avatar, Badge, LoadingView, QuickAction, SectionHeader, StatCard } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ClientDashboardData, DashboardTransaction } from '../../types';
import { daysUntil, formatCurrency, formatDate, greeting, humanizeStatus, percentComplete } from '../../utils/format';
import { HomeStackParamList, ClientTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Home'>,
  BottomTabScreenProps<ClientTabParamList>
>;

const TXN_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  REPAYMENT: 'arrow-undo-outline',
  LOAN_PAYMENT: 'card-outline',
  LOAN_DISBURSEMENT: 'arrow-forward-circle-outline',
  SAVINGS_DEPOSIT: 'trending-up-outline',
  SAVINGS_WITHDRAWAL: 'trending-down-outline',
  LOAN_APPROVAL: 'checkmark-circle-outline',
  FEE: 'receipt-outline',
  ADJUSTMENT: 'swap-horizontal-outline',
};

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { session, signOut } = useAuth();
  const [dashboard, setDashboard] = useState<ClientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getDashboard();
      if (mounted.current) setDashboard(data);
    } catch (err: any) {
      // Silent; the empty state explains the failure.
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (dashboard && dashboard.kycStatus === 'PENDING') {
        // Refresh so KYC status stays current when returning to Home.
        load(true);
      }
    }, [dashboard?.kycStatus])
  );

  if (loading) return <SafeAreaView style={styles.safe}><LoadingView /></SafeAreaView>;

  const user = session?.user;
  const kycStatus = dashboard?.kycStatus ?? 'VERIFIED';
  const kycIsVerified = kycStatus === 'VERIFIED';
  const kycIsPending = ['PENDING', 'UNDER_REVIEW'].includes(kycStatus);
  const kycNeedsCorrection = kycStatus === 'CORRECTION_REQUIRED';

  const nextDueIn = dashboard?.nextPaymentDueDate ? daysUntil(dashboard.nextPaymentDueDate) : null;
  const paidProgress = dashboard ? percentComplete(dashboard.totalPaid ?? 0, dashboard.totalBalance ?? 0) : 0;

  const headerRight = (
    <View style={styles.headerRight}>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => navigation.navigate('NotificationsTab', { screen: 'Notifications' })}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="notifications-outline" size={21} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('MoreTab', { screen: 'Profile' })}>
        <Avatar name={user?.fullName} size={38} uri={user?.avatar} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={dashboard?.recentTransactions ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.topRow}>
              <View style={styles.greetingWrap}>
                <Text style={styles.greeting}>{greeting()}</Text>
                <Text style={styles.name} numberOfLines={1}>{user?.fullName?.split(' ')[0] ?? 'Member'}</Text>
                <Text style={styles.memberNo}>Member No. {dashboard?.memberNumber ?? '—'}</Text>
              </View>
              {headerRight}
            </View>

            {!kycIsVerified ? (
              <AppCard style={kycNeedsCorrection ? { ...styles.kycCard, borderColor: colors.warningBorder } : styles.kycCard} padded={false}>
                <View style={[styles.kycBanner, kycNeedsCorrection && styles.kycBannerCorrection]}>
                  <View style={[styles.kycIcon, kycIsPending ? { backgroundColor: colors.warningSoft } : kycNeedsCorrection ? { backgroundColor: colors.warningSoft } : { backgroundColor: colors.dangerSoft }]}>
                    <Ionicons
                      name={kycIsPending ? 'time-outline' : 'alert-circle-outline'}
                      size={22}
                      color={kycIsPending ? colors.warning : colors.danger}
                    />
                  </View>
                  <View style={styles.kycBody}>
                    <Text style={styles.kycTitle}>
                      {kycNeedsCorrection ? 'KYC needs corrections' : kycIsPending ? 'KYC under review' : 'Complete your KYC verification first.'}
                    </Text>
                    <Text style={styles.kycText}>
                      {kycNeedsCorrection
                        ? 'One or more of your documents need updating before you can apply for loans.'
                        : kycIsPending
                          ? 'Your documents are being verified by branch personnel. Loan applications open once approved.'
                          : 'Verify your identity to unlock loans, e-signatures, and higher savings limits.'}
                    </Text>
                    <View style={styles.kycActions}>
                      <AppButton
                        variant={kycNeedsCorrection ? 'secondary' : 'primary'}
                        size="sm"
                        style={{ alignSelf: 'flex-start', width: undefined, paddingHorizontal: 16 }}
                        title={kycNeedsCorrection ? 'Submit Correction' : kycIsPending ? 'View Status' : 'Start KYC'}
                        onPress={() => {
                          if (kycIsPending) navigation.navigate('KycStatus');
                          else navigation.navigate('KycForm');
                        }}
                      />
                    </View>
                  </View>
                </View>
              </AppCard>
            ) : (
              <View style={styles.verifiedRow}>
                <Ionicons name="shield-checkmark" size={16} color={colors.green} />
                <Text style={styles.verifiedText}>KYC Verified —{' '}</Text>
                <Ionicons name="lock-closed" size={12} color={colors.textFaint} />
                <Text style={styles.verifiedTextSub}>Loan services unlocked</Text>
              </View>
            )}

            <View style={styles.balanceCard}>
              <View>
                <Text style={styles.balanceLabel}>OUTSTANDING LOAN</Text>
                <Text style={styles.balanceValue}>{formatCurrency(dashboard?.remainingBalance)}</Text>
                <Text style={styles.balanceSub}>
                  {dashboard?.activeLoansCount ?? 0} active loan{dashboard?.activeLoansCount === 1 ? '' : 's'} · {formatCurrency(dashboard?.totalActiveLoan)} total
                </Text>
              </View>
              <Ionicons name="wallet-outline" size={34} color="rgba(255,255,255,0.35)" />
            </View>

            <View style={styles.statRow}>
              {nextDueIn !== null && nextDueIn !== undefined ? (
                <View style={styles.statFlex}>
                  <StatCard
                    compact
                    icon="calendar-outline"
                    label="Next payment"
                    value={formatCurrency(dashboard?.nextPayment)}
                    color={colors.danger}
                    bg={colors.dangerSoft}
                    sub={dashboard?.nextPaymentDueDate ? `${formatDate(dashboard.nextPaymentDueDate)} · due in ${nextDueIn}d` : undefined}
                  />
                </View>
              ) : null}
              <View style={styles.statFlex}>
                <StatCard
                  compact
                  icon="wallet-outline"
                  label="Savings balance"
                  value={formatCurrency(dashboard?.savingsBalance)}
                  color={colors.teal}
                  bg={colors.tealSoft}
                  sub={dashboard?.savingsGoalName ? `${dashboard.savingsGoalName}` : undefined}
                />
              </View>
            </View>

            <View style={{ marginTop: 10 }}>
              <SectionHeader title="Quick Actions" />
            </View>

            <View style={styles.quickRow}>
              <QuickAction
                label="Apply Loan"
                caption={kycIsVerified ? 'Start a loan application' : 'KYC required'}
                icon="add-circle-outline"
                onPress={!kycIsVerified ? undefined : () => navigation.navigate('LoansTab', { screen: 'LoanApplication' })}
                disabled={!kycIsVerified}
                disabledLabel={!kycIsVerified ? 'Locked' : undefined}
              />
              <QuickAction
                label="Pay Loan"
                caption="Submit payment proof"
                icon="card-outline"
                color={colors.teal}
                bg={colors.tealSoft}
                onPress={() => navigation.navigate('LoansTab', { screen: 'Payments' })}
              />
              <QuickAction
                label="Savings"
                caption="View deposits & goals"
                icon="wallet-outline"
                color={colors.green}
                bg={colors.greenSoft}
                onPress={() => navigation.navigate('SavingsTab', { screen: 'Savings' })}
              />
              <QuickAction
                label="Transactions"
                caption="Full history & receipts"
                icon="receipt-outline"
                color={colors.info}
                bg={colors.infoSoft}
                onPress={() => navigation.navigate('MoreTab', { screen: 'Transactions' })}
              />
            </View>

            {dashboard && (dashboard.totalBalance ?? 0) > 0 ? (
              <AppCard style={styles.repayCard}>
                <View style={styles.repayHeader}>
                  <View style={styles.flex1}>
                    <Text style={styles.repayTitle}>Loan Repayment</Text>
                    <Text style={styles.repaySub}>
                      {formatCurrency(dashboard.totalPaid ?? 0)} of {formatCurrency(dashboard.totalBalance)} paid
                    </Text>
                  </View>
                  <Text style={styles.repayPct}>{paidProgress}%</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <View style={styles.repayTrack}>
                    <View style={[styles.repayFill, { width: `${paidProgress}%` }]} />
                  </View>
                </View>
              </AppCard>
            ) : null}

            <SectionHeader
              title="Recent Activity"
              subtitle={dashboard?.recentTransactions?.length ? 'Your latest transactions' : undefined}
              right={
                dashboard?.recentTransactions?.length ? (
                  <TouchableOpacity onPress={() => navigation.navigate('MoreTab', { screen: 'Transactions' })}>
                    <Text style={styles.seeAll}>See all</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              if (item.type === 'SAVINGS_DEPOSIT' || item.type === 'SAVINGS_WITHDRAWAL') {
                navigation.navigate('SavingsTab', { screen: 'Savings' });
              }
            }}
            activeOpacity={0.8}
          >
            <AppCard style={styles.txnCard} padded={false}>
              <View style={styles.txnRow}>
                <View style={styles.txnIcon}>
                  <Ionicons name={TXN_ICONS[item.type] ?? 'swap-horizontal-outline'} size={16} color={colors.primary} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.txnDesc} numberOfLines={1}>{humanizeStatus(item.type)}</Text>
                  <Text style={styles.txnRef}>{item.referenceNumber}</Text>
                  <Badge status={item.status} />
                </View>
                <View style={styles.txnAmtWrap}>
                  <Text style={[styles.txnAmt, (item.type === 'REPAYMENT' || item.type === 'LOAN_PAYMENT') && styles.txnAmtOut]}>
                    {(item.type === 'REPAYMENT' || item.type === 'LOAN_PAYMENT') ? '−' : '+'}{formatCurrency(item.amount)}
                  </Text>
                  <Text style={styles.txnDate}>{formatDate(item.date)}</Text>
                </View>
              </View>
            </AppCard>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No recent transactions yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 110 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  greetingWrap: { flex: 1, marginRight: 12 },
  greeting: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  name: { fontSize: 21, fontWeight: '800', color: colors.text, marginTop: 1 },
  memberNo: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  kycCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    marginBottom: 16,
  },
  kycBanner: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
  },
  kycBannerCorrection: {
    backgroundColor: colors.warningSoft,
  },
  kycIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  kycBody: { flex: 1 },
  kycTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  kycText: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  kycActions: { marginTop: 10 },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  verifiedText: { fontSize: 12, fontWeight: '700', color: colors.greenDark, marginLeft: 6 },
  verifiedTextSub: { fontSize: 11, color: colors.textMuted, marginLeft: 4 },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 20,
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1,
  },
  balanceValue: { fontSize: 30, fontWeight: '900', color: colors.white, marginTop: 4 },
  balanceSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  statRow: { flexDirection: 'row', marginBottom: 6 },
  statFlex: { flex: 1, marginHorizontal: 4 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  repayCard: { marginTop: 2, marginBottom: 18 },
  repayHeader: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1 },
  repayTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  repaySub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  repayPct: { fontSize: 15, fontWeight: '800', color: colors.primary },
  repayTrack: {
    height: 8,
    borderRadius: radius.round,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  repayFill: {
    height: 8,
    borderRadius: radius.round,
    backgroundColor: colors.primaryBright,
  },
  seeAll: { fontSize: 12, fontWeight: '700', color: colors.teal },
  txnCard: { marginBottom: 8 },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  txnIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnDesc: { fontSize: 13, fontWeight: '700', color: colors.text },
  txnRef: { fontSize: 10, color: colors.textFaint, marginTop: 1, marginBottom: 3 },
  txnAmtWrap: { alignItems: 'flex-end', marginLeft: 8 },
  txnAmt: { fontSize: 14, fontWeight: '800', color: colors.greenDark },
  txnAmtOut: { color: colors.danger },
  txnDate: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  emptyWrap: { paddingVertical: 20 },
  emptyText: { fontSize: 13, color: colors.textFaint, textAlign: 'center' },
});