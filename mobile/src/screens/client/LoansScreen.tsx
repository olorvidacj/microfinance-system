import React, { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, Badge, LoadingView, ScreenHeader, SectionHeader, SegmentedTabs } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { LoanItem, LoanApplication, PaymentItem } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';

type TabKey = 'active' | 'applications' | 'history';

export const LoansScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<TabKey>('active');
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<LoanItem[]>([]);
  const [completed, setCompleted] = useState<LoanItem[]>([]);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoaded(false);
    setError(null);
    try {
      const [loansRes, appsRes, payRes] = await Promise.all([
        api.getLoans(),
        api.getLoanApplications(),
        api.getPayments(),
      ]);
      setActive(loansRes.activeLoans);
      setCompleted(loansRes.completedLoans);
      setApplications([...appsRes].sort((a, b) => (a.applicationDate < b.applicationDate ? 1 : -1)));
      setPayments([...payRes].sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1)));
    } catch (err: any) {
      setError(err?.message || 'Unable to load loans.');
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

  const activeCount = active.length;
  const pendingApps = applications.filter((a) => ['PENDING', 'UNDER_REVIEW'].includes(String(a.status).toUpperCase())).length;

  const openDetail = (loan: LoanItem) => navigation.navigate('LoanDetail', { loan });

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="My Loans" /><LoadingView /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="My Loans"
        right={
          <TouchableOpacity onPress={() => navigation.navigate('LoanApplication')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="add-circle" size={26} color={colors.primary} />
          </TouchableOpacity>
        }
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.tabsWrap}>
        <SegmentedTabs<TabKey>
          tabs={[
            { key: 'active', label: 'Active', count: activeCount },
            { key: 'applications', label: 'Applications', count: applications.length },
            { key: 'history', label: 'History' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </View>

      {pendingApps > 0 && tab === 'applications' ? (
        <View style={styles.pendingNote}>
          <Ionicons name="hourglass-outline" size={15} color={colors.warning} />
          <Text style={styles.pendingNoteText}>{pendingApps} application{pendingApps > 1 ? 's' : ''} being reviewed by the Credit Committee.</Text>
        </View>
      ) : null}

      {tab === 'active' && (
        <FlatList
          data={active}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
          ListHeaderComponent={
            active.length ? (
              <SectionHeader title="Active Loans" subtitle="Tap a loan to view the schedule and payments" />
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openDetail(item)} activeOpacity={0.85}>
              <AppCard style={styles.loanCard} padded={false}>
                <View style={styles.loanBody}>
                  <View style={styles.loanTop}>
                    <View style={styles.flex1}>
                      <Text style={styles.loanName}>{item.productName}</Text>
                      <Text style={styles.loanNo}>{item.loanNumber} · {item.termMonths} months</Text>
                    </View>
                    <Badge status={item.status} />
                  </View>
                  <View style={styles.loanBottom}>
                    <View>
                      <Text style={styles.balanceLabel}>REMAINING BALANCE</Text>
                      <Text style={styles.balanceValue}>{formatCurrency(item.remainingBalance)}</Text>
                      <Text style={styles.balanceSub}>
                        {item.nextPaymentDate ? `Next: ${formatDate(item.nextPaymentDate)} · ${formatCurrency(item.monthlyInstallment)}` : `Installment: ${formatCurrency(item.monthlyInstallment)}`}
                      </Text>
                    </View>
                    <View style={styles.chevron}>
                      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                    </View>
                  </View>
                  {['OVERDUE', 'IN_ARREARS'].includes(String(item.status).toUpperCase()) ? (
                    <View style={styles.overdueRow}>
                      <Ionicons name="alert-circle" size={13} color={colors.danger} />
                      <Text style={styles.overdueRowText}>Payment is overdue. Pay now to avoid penalties.</Text>
                    </View>
                  ) : null}
                </View>
              </AppCard>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="leaf-outline" size={34} color={colors.primarySoft ? '#BFDBFE' : colors.textFaint} />
              <Text style={styles.emptyTitle}>No active loans</Text>
              <Text style={styles.emptyMsg}>You have no active loan at the moment. Apply for a new loan when you need credit.</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
          ListHeaderComponent={
            applications.length ? (
              <SectionHeader title="Loan Applications" subtitle="Track the status through the Credit Committee" />
            ) : null
          }
          renderItem={({ item }) => (
            <AppCard style={styles.appCard}>
              <View style={styles.appTop}>
                <View style={styles.flex1}>
                  <Text style={styles.appName}>{item.productName}</Text>
                  {/* @ts-ignore older payloads carry loanNumber */}
                  <Text style={styles.appNo}>{item.loanNumber ?? item.id} {item.coopStep ? `· Step: ${item.coopStep}` : ''}</Text>
                </View>
                <Badge status={item.status} />
              </View>
              <View style={styles.appBottom}>
                <View>
                  <Text style={styles.appAmt}>{formatCurrency(item.principalAmount)}</Text>
                  <Text style={styles.appSub}>{item.termMonths} months · applied {formatDate(item.applicationDate)}</Text>
                </View>
                {item.status === 'REJECTED' && item.rejectionReason ? (
                  <View style={styles.rejectBox}>
                    <Text style={styles.rejectText} numberOfLines={2}>{item.rejectionReason}</Text>
                  </View>
                ) : null}
              </View>
            </AppCard>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
          ListHeaderComponent={
            payments.length ? (
              <SectionHeader title="Payment History" subtitle="Recent payments you have made" />
            ) : null
          }
          renderItem={({ item }) => (
            <AppCard style={styles.payCard} padded={false}>
              <View style={styles.payRow}>
                <View style={styles.payIcon}>
                  <Ionicons name={item.status === 'COMPLETED' ? 'checkmark' : 'time-outline'} size={16} color={item.status === 'COMPLETED' ? colors.green : colors.warning} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.payLoanNo}>{item.loanNumber}</Text>
                  <Text style={styles.payRef}>Ref {item.referenceNumber} · {item.paymentMethod}</Text>
                  <View style={{ marginTop: 4 }}>
                    <Badge status={item.status} />
                  </View>
                </View>
                <View style={styles.payAmtWrap}>
                  <Text style={styles.payAmt}>{formatCurrency(item.amount)}</Text>
                  <Text style={styles.payDate}>{formatDate(item.paymentDate)}</Text>
                </View>
              </View>
            </AppCard>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="card-outline" size={34} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>No payments yet</Text>
              <Text style={styles.emptyMsg}>Your repayment history will show here once you make your first payment.</Text>
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