import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, Badge, ErrorView, LoadingView, ScreenHeader, SectionHeader, SegmentedTabs } from '../../components';
import { colors, radius } from '../../theme';
import { api, messageOf } from '../../services/api';
import type { ClientLoansView, LoanSummaryView, PaymentView } from '../../shared/client';
import { paymentMethodLabel } from '../../shared/lending';
import { formatCurrency, formatDate } from '../../utils/format';

type TabKey = 'active' | 'applications' | 'history';

export const LoansScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<TabKey>('active');
  const [loans, setLoans] = useState<ClientLoansView | null>(null);
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [l, p] = await Promise.all([api.getLoans(), api.getPayments()]);
      setLoans(l);
      setPayments(p);
      setError('');
    } catch (err) {
      setError(messageOf(err, 'Your loans could not be loaded.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(!!loans);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  if (loading) return <SafeAreaView style={styles.safe}><ScreenHeader title="My Loans" /><LoadingView text="Loading your loans…" /></SafeAreaView>;
  if (error || !loans) return <SafeAreaView style={styles.safe}><ScreenHeader title="My Loans" /><ErrorView message={error || 'No data.'} onRetry={() => load()} /></SafeAreaView>;

  const active = loans.running;
  const applications = [...loans.pending, ...loans.finished.filter((l) => l.status === 'Rejected' || l.status === 'Cancelled')];
  const pendingApps = loans.pending.filter((a) => a.status === 'Submitted' || a.status === 'Under Review').length;
  const openDetail = (loan: LoanSummaryView) => navigation.navigate('LoanDetail', { loanId: loan.id });
  const refresh = <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="My Loans"
        right={
          <TouchableOpacity onPress={() => navigation.navigate('LoanApplication')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityLabel="Apply for a loan">
            <Ionicons name="add-circle" size={26} color={colors.primary} />
          </TouchableOpacity>
        }
      />
      <View style={styles.tabsWrap}>
        <SegmentedTabs<TabKey>
          tabs={[
            { key: 'active', label: 'Active', count: active.length },
            { key: 'applications', label: 'Applications', count: applications.length },
            { key: 'history', label: 'Payments' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </View>

      {pendingApps > 0 && tab === 'applications' ? (
        <View style={styles.pendingNote}>
          <Ionicons name="hourglass-outline" size={15} color={colors.warning} />
          <Text style={styles.pendingNoteText}>{pendingApps} application{pendingApps > 1 ? 's are' : ' is'} being reviewed.</Text>
        </View>
      ) : null}

      {tab === 'active' && (
        <FlatList
          data={active}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={refresh}
          ListHeaderComponent={active.length ? <SectionHeader title="Active Loans" subtitle="Tap a loan to see its schedule and payments" /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openDetail(item)} activeOpacity={0.85}>
              <AppCard style={styles.loanCard} padded={false}>
                <View style={styles.loanBody}>
                  <View style={styles.loanTop}>
                    <View style={styles.flex1}>
                      <Text style={styles.loanName}>{item.productName}</Text>
                      <Text style={styles.loanNo}>{item.loanNumber} · {item.termMonths} months</Text>
                    </View>
                    <Badge status={item.overdue ? 'OVERDUE' : item.status} />
                  </View>
                  <View style={styles.loanBottom}>
                    <View>
                      <Text style={styles.balanceLabel}>REMAINING BALANCE</Text>
                      <Text style={styles.balanceValue}>{formatCurrency(item.remainingBalance)}</Text>
                      <Text style={styles.balanceSub}>
                        {item.nextDue ? `Next: ${formatDate(item.nextDue.dueDate)} · ${formatCurrency(item.nextDue.amount)}` : 'Nothing due'}
                      </Text>
                    </View>
                    <View style={styles.chevron}>
                      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                    </View>
                  </View>
                  {item.overdue ? (
                    <View style={styles.overdueRow}>
                      <Ionicons name="alert-circle" size={13} color={colors.danger} />
                      <Text style={styles.overdueRowText}>A payment is overdue. Paying now stops further penalties.</Text>
                    </View>
                  ) : null}
                </View>
              </AppCard>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="leaf-outline" size={34} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>No active loans</Text>
              <Text style={styles.emptyMsg}>Apply for a loan when you need credit.</Text>
              <AppButton title="Apply for a Loan" onPress={() => navigation.navigate('LoanApplication')} variant="secondary" style={{ marginTop: 14 }} />
            </View>
          }
        />
      )}

      {tab === 'applications' && (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={refresh}
          ListHeaderComponent={applications.length ? <SectionHeader title="Loan Applications" subtitle="Tap one to see where it is" /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openDetail(item)} activeOpacity={0.85}>
              <AppCard style={styles.appCard}>
                <View style={styles.appTop}>
                  <View style={styles.flex1}>
                    <Text style={styles.appName}>{item.productName}</Text>
                    <Text style={styles.appNo}>{item.loanNumber}</Text>
                  </View>
                  <Badge status={item.status} />
                </View>
                <View style={styles.appBottom}>
                  <View>
                    <Text style={styles.appAmt}>{formatCurrency(item.principal)}</Text>
                    <Text style={styles.appSub}>{item.termMonths} months · applied {formatDate(item.applicationDate)}</Text>
                  </View>
                  {(item.decisionReason && item.status === 'Rejected') || item.returnedReason || item.cancellationReason ? (
                    <View style={styles.rejectBox}>
                      <Text style={styles.rejectText} numberOfLines={3}>
                        {item.status === 'Rejected' ? item.decisionReason : item.returnedReason || item.cancellationReason}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </AppCard>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={34} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>No applications yet</Text>
              <Text style={styles.emptyMsg}>Your loan applications will appear here.</Text>
            </View>
          }
        />
      )}

      {tab === 'history' && (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={refresh}
          ListHeaderComponent={payments.length ? <SectionHeader title="Payments" subtitle="Tap a payment for its receipt" /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('PaymentReceipt', { paymentId: item.id })} activeOpacity={0.85}>
              <AppCard style={styles.payCard} padded={false}>
                <View style={styles.payRow}>
                  <View style={styles.payIcon}>
                    <Ionicons name={item.status === 'POSTED' ? 'checkmark' : 'arrow-undo-outline'} size={16} color={item.status === 'POSTED' ? colors.green : colors.danger} />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.payLoanNo}>{item.loanNumber}</Text>
                    <Text style={styles.payRef}>{item.receiptNumber} · {paymentMethodLabel(item.method)}</Text>
                    <View style={{ marginTop: 4 }}>
                      <Badge status={item.status === 'POSTED' ? 'COMPLETED' : 'REVERSED'} />
                    </View>
                  </View>
                  <View style={styles.payAmtWrap}>
                    <Text style={styles.payAmt}>{formatCurrency(item.amount)}</Text>
                    <Text style={styles.payDate}>{formatDate(item.paymentDate)}</Text>
                  </View>
                </View>
              </AppCard>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="card-outline" size={34} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>No payments yet</Text>
              <Text style={styles.emptyMsg}>Your payments will show here once the branch posts them.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  error: { fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },
  tabsWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.md,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  pendingNoteText: { flex: 1, marginLeft: 8, fontSize: 12, color: colors.warning, fontWeight: '600' },
  content: { padding: 16, paddingTop: 6, paddingBottom: 110, flexGrow: 1 },
  loanCard: { marginBottom: 12 },
  loanBody: { padding: 14 },
  loanTop: { flexDirection: 'row', alignItems: 'flex-start' },
  flex1: { flex: 1 },
  loanName: { fontSize: 15, fontWeight: '800', color: colors.text },
  loanNo: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  loanBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  balanceLabel: { fontSize: 10, fontWeight: '700', color: colors.textFaint, letterSpacing: 0.5 },
  balanceValue: { fontSize: 20, fontWeight: '900', color: colors.primary, marginTop: 2 },
  balanceSub: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  chevron: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 10,
  },
  overdueRowText: { fontSize: 11, color: colors.danger, fontWeight: '700', marginLeft: 5 },
  appCard: { marginBottom: 10 },
  appTop: { flexDirection: 'row', alignItems: 'flex-start' },
  appName: { fontSize: 14, fontWeight: '800', color: colors.text },
  appNo: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  appBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 },
  appAmt: { fontSize: 17, fontWeight: '800', color: colors.text },
  appSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  rejectBox: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  rejectText: { fontSize: 10, color: colors.danger, fontWeight: '600' },
  payCard: { marginBottom: 8 },
  payRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  payIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  payLoanNo: { fontSize: 13, fontWeight: '700', color: colors.text },
  payRef: { fontSize: 10, color: colors.textFaint, marginTop: 1 },
  payAmtWrap: { alignItems: 'flex-end', marginLeft: 8 },
  payAmt: { fontSize: 14, fontWeight: '800', color: colors.text },
  payDate: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 10 },
  emptyMsg: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 17 },
});