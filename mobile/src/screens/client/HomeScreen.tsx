import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, Avatar, Badge, ErrorView, LoadingView, QuickAction, SectionHeader, StatCard } from '../../components';
import { colors, radius } from '../../theme';
import { api, messageOf } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { ClientDashboardView } from '../../shared/client';
import { isKycVerified, normaliseKycStatus } from '../../shared/kyc';
import { centsFromDb, centsToDecimal } from '../../shared/lending';
import { daysUntil, formatCurrency, formatDate, greeting, humanizeStatus } from '../../utils/format';
import { HomeStackParamList, ClientTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<NativeStackScreenProps<HomeStackParamList, 'Home'>, BottomTabScreenProps<ClientTabParamList>>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<ClientDashboardView | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getDashboard();
      if (mounted.current) {
        setDashboard(data);
        setError('');
      }
    } catch (err) {
      if (mounted.current) setError(messageOf(err, 'Your home screen could not be loaded.'));
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

  // Coming back to Home refreshes it (a KYC decision or a payment may have landed).
  useFocusEffect(
    useCallback(() => {
      if (dashboard) load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (loading) return <SafeAreaView style={styles.safe}><LoadingView text="Loading your home screen…" /></SafeAreaView>;
  if (error || !dashboard) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorView message={error || 'No data.'} onRetry={() => load()} />
      </SafeAreaView>
    );
  }

  const user = session?.user;
  const kycStatus = normaliseKycStatus(dashboard.member.kycStatus);
  const kycIsVerified = isKycVerified(kycStatus);
  const kycIsPending = kycStatus === 'SUBMITTED' || kycStatus === 'UNDER_REVIEW';
  const kycNeedsCorrection = kycStatus === 'CORRECTION_REQUIRED';
  const { loans, savings } = dashboard;
  const nextDue = loans.nextDue;
  const nextDueIn = nextDue ? daysUntil(nextDue.dueDate) : null;
  const totalPayable = loans.running.reduce((s, l) => s + centsFromDb(l.totalPayable), 0);
  const totalPaid = loans.running.reduce((s, l) => s + centsFromDb(l.totalPaid), 0);
  const paidProgress = totalPayable > 0 ? Math.min(100, Math.round((totalPaid / totalPayable) * 100)) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={dashboard.recentActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <View style={styles.topRow}>
              <View style={styles.greetingWrap}>
                <Text style={styles.greeting}>{greeting()}</Text>
                <Text style={styles.name} numberOfLines={1}>{dashboard.member.fullName.split(' ')[0] || 'Member'}</Text>
                <Text style={styles.memberNo}>Member No. {dashboard.member.memberNumber}</Text>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation.navigate('NotificationsTab', { screen: 'Notifications' })}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityLabel={`Notifications, ${dashboard.notifications.unread} unread`}
                >
                  <Ionicons name="notifications-outline" size={21} color={colors.text} />
                  {dashboard.notifications.unread > 0 ? <View style={styles.dot} /> : null}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('MoreTab', { screen: 'Profile' })}>
                  <Avatar name={dashboard.member.fullName} size={38} uri={user?.avatar} />
                </TouchableOpacity>
              </View>
            </View>

            {!kycIsVerified ? (
              <AppCard style={styles.kycCard} padded={false}>
                <View style={styles.kycBanner}>
                  <View style={[styles.kycIcon, { backgroundColor: kycIsPending || kycNeedsCorrection ? colors.warningSoft : colors.dangerSoft }]}>
                    <Ionicons name={kycIsPending ? 'time-outline' : 'alert-circle-outline'} size={22} color={kycIsPending ? colors.warning : colors.danger} />
                  </View>
                  <View style={styles.kycBody}>
                    <Text style={styles.kycTitle}>
                      {kycNeedsCorrection ? 'KYC needs corrections' : kycIsPending ? 'KYC under review' : kycStatus === 'REJECTED' ? 'KYC not approved' : 'Complete your KYC verification first.'}
                    </Text>
                    <Text style={styles.kycText}>
                      {kycNeedsCorrection
                        ? 'Some of your details or documents need updating before you can apply for loans.'
                        : kycIsPending
                          ? 'Your documents are being checked by the branch. Loan applications open once approved.'
                          : 'Verify your identity to open loans and savings.'}
                    </Text>
                    <View style={styles.kycActions}>
                      <AppButton
                        variant={kycNeedsCorrection ? 'secondary' : 'primary'}
                        size="sm"
                        style={{ alignSelf: 'flex-start', width: undefined, paddingHorizontal: 16 }}
                        title={kycNeedsCorrection ? 'Update KYC' : kycIsPending ? 'View status' : 'Start KYC'}
                        onPress={() => (kycIsPending ? navigation.navigate('KycStatus') : navigation.navigate('KycForm'))}
                      />
                    </View>
                  </View>
                </View>
              </AppCard>
            ) : (
              <View style={styles.verifiedRow}>
                <Ionicons name="shield-checkmark" size={16} color={colors.green} />
                <Text style={styles.verifiedText}>KYC verified</Text>
              </View>
            )}

            {loans.overdueCount > 0 ? (
              <TouchableOpacity onPress={() => navigation.navigate('LoansTab', { screen: 'Payments' })}>
                <AppCard style={styles.overdueCard}>
                  <Text style={styles.overdueText}>
                    {loans.overdueCount === 1 ? 'One of your loans is' : `${loans.overdueCount} of your loans are`} behind. Paying now stops further penalties.
                  </Text>
                </AppCard>
              </TouchableOpacity>
            ) : null}

            <View style={styles.balanceCard}>
              <View>
                <Text style={styles.balanceLabel}>LOAN BALANCE</Text>
                <Text style={styles.balanceValue}>{formatCurrency(loans.outstanding)}</Text>
                <Text style={styles.balanceSub}>
                  {loans.running.length} running loan{loans.running.length === 1 ? '' : 's'}
                  {loans.pendingApplications.length ? ` · ${loans.pendingApplications.length} application${loans.pendingApplications.length === 1 ? '' : 's'} pending` : ''}
                </Text>
              </View>
              <Ionicons name="wallet-outline" size={34} color="rgba(255,255,255,0.35)" />
            </View>

            <View style={styles.statRow}>
              <View style={styles.statFlex}>
                <StatCard
                  compact
                  icon="calendar-outline"
                  label="Next payment"
                  value={nextDue ? formatCurrency(nextDue.amount) : '—'}
                  color={colors.danger}
                  bg={colors.dangerSoft}
                  sub={nextDue ? `${formatDate(nextDue.dueDate)}${nextDueIn !== null && nextDueIn >= 0 ? ` · in ${nextDueIn}d` : ' · overdue'}` : 'Nothing due'}
                />
              </View>
              <View style={styles.statFlex}>
                <StatCard
                  compact
                  icon="wallet-outline"
                  label="Savings"
                  value={formatCurrency(savings.total)}
                  color={colors.teal}
                  bg={colors.tealSoft}
                  sub={`${savings.accounts.length} account${savings.accounts.length === 1 ? '' : 's'}`}
                />
              </View>
            </View>

            {savings.accounts.map((a) => (
              <TouchableOpacity key={a.id} onPress={() => navigation.navigate('SavingsTab', { screen: 'Savings' })} accessibilityLabel={`${a.productName} ${formatCurrency(a.balance)}`}>
                <AppCard style={styles.txnCard} padded={false}>
                  <View style={styles.txnRow}>
                    <View style={styles.flex1}>
                      <Text style={styles.txnDesc}>{a.productName}</Text>
                      <Text style={styles.txnRef}>{a.passbookNumber}</Text>
                    </View>
                    <Text style={styles.txnAmt}>{formatCurrency(a.balance)}</Text>
                  </View>
                </AppCard>
              </TouchableOpacity>
            ))}

            {dashboard.group ? (
              <TouchableOpacity onPress={() => navigation.navigate('MoreTab', { screen: 'GroupLending' })}>
                <AppCard style={styles.txnCard} padded={false}>
                  <View style={styles.txnRow}>
                    <Ionicons name="people-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} />
                    <View style={styles.flex1}>
                      <Text style={styles.txnDesc}>{dashboard.group.name}</Text>
                      <Text style={styles.txnRef}>Your group · {humanizeStatus(dashboard.group.role)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                  </View>
                </AppCard>
              </TouchableOpacity>
            ) : null}

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
              <QuickAction label="Pay Loan" caption="Send payment proof" icon="card-outline" color={colors.teal} bg={colors.tealSoft} onPress={() => navigation.navigate('LoansTab', { screen: 'Payments' })} />
              <QuickAction label="Savings" caption="Statements & withdrawals" icon="wallet-outline" color={colors.green} bg={colors.greenSoft} onPress={() => navigation.navigate('SavingsTab', { screen: 'Savings' })} />
              <QuickAction label="Transactions" caption="Full history" icon="receipt-outline" color={colors.info} bg={colors.infoSoft} onPress={() => navigation.navigate('MoreTab', { screen: 'Transactions' })} />
            </View>

            {totalPayable > 0 ? (
              <AppCard style={styles.repayCard}>
                <View style={styles.repayHeader}>
                  <View style={styles.flex1}>
                    <Text style={styles.repayTitle}>Loan repayment</Text>
                    <Text style={styles.repaySub}>{formatCurrency(centsToDecimal(totalPaid))} of {formatCurrency(centsToDecimal(totalPayable))} paid</Text>
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
              right={
                dashboard.recentActivity.length ? (
                  <TouchableOpacity onPress={() => navigation.navigate('MoreTab', { screen: 'Transactions' })}>
                    <Text style={styles.seeAll}>See all</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </>
        }
        renderItem={({ item }) => (
          <AppCard style={styles.txnCard} padded={false}>
            <View style={styles.txnRow}>
              <View style={styles.txnIcon}>
                <Ionicons name={item.direction === 'OUT' ? 'arrow-up-outline' : 'arrow-down-outline'} size={16} color={colors.primary} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.txnDesc} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.txnRef}>{item.reference}</Text>
              </View>
              <View style={styles.txnAmtWrap}>
                <Text style={[styles.txnAmt, item.direction === 'OUT' && styles.txnAmtOut]}>
                  {item.direction === 'OUT' ? '−' : '+'}
                  {formatCurrency(item.amount)}
                </Text>
                <Text style={styles.txnDate}>{formatDate(item.date)}</Text>
              </View>
            </View>
          </AppCard>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No activity yet.</Text>
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
  dot: { position: 'absolute', top: 7, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  overdueCard: { marginBottom: 12, backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1 },
  overdueText: { fontSize: 13, fontWeight: '700', color: colors.danger },
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