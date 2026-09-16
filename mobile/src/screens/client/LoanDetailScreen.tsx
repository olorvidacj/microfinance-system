import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, Badge, InfoRow, LoadingView, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { LoanItem, InstallmentScheduleItem } from '../../types';
import { formatCurrency, formatDate, statusColor } from '../../utils/format';
import { LoansStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<LoansStackParamList, 'LoanDetail'>;

export const LoanDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const loan: LoanItem =
    'loan' in route.params
      ? route.params.loan
      : {
          id: route.params.loanId,
          loanNumber: '',
          productName: 'Loan',
          principalAmount: 0,
          interestRate: 0,
          termMonths: 0,
          monthlyInstallment: 0,
          remainingBalance: 0,
          status: 'PENDING',
        };

  const [schedule, setSchedule] = useState<InstallmentScheduleItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paidCount = schedule.filter((s) => s.status === 'PAID').length;
  const progress = schedule.length ? Math.round((paidCount / schedule.length) * 100) : 0;
  const overdue = schedule.filter((s) => s.status === 'OVERDUE').length;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoaded(false);
    setError(null);
    try {
      const sched = await api.getLoanSchedule(loan.id);
      setSchedule(sched);
    } catch (err: any) {
      setError(err?.message || 'Unable to load the loan schedule.');
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [loan.id]);

  useEffect(() => {
    load();
  }, [load]);

  const isActive = ['ACTIVE', 'APPROVED', 'DISBURSED', 'OVERDUE', 'IN_ARREARS'].includes(String(loan.status).toUpperCase());

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="Loan Details" /><LoadingView /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={loan.productName} subtitle={loan.loanNumber || undefined} />
      <FlatList
        data={schedule}
        keyExtractor={(item) => String(item.installmentNumber)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={styles.flex1}>
                  <Text style={styles.heroLabel}>REMAINING BALANCE</Text>
                  <Text style={styles.heroValue}>{formatCurrency(loan.remainingBalance)}</Text>
                  <Text style={styles.heroSub}>
                    {formatCurrency(loan.principalAmount)} principal · {loan.termMonths} months
                  </Text>
                </View>
                <Badge status={loan.status} size="md" />
              </View>
              {overdue > 0 ? (
                <View style={styles.overdueNote}>
                  <Ionicons name="alert-circle" size={14} color={colors.danger} />
                  <Text style={styles.overdueNoteText}>{overdue} installment{overdue > 1 ? 's' : ''} overdue. Please settle soon to avoid penalties.</Text>
                </View>
              ) : null}
              {isActive ? (
                <AppButton
                  title="Make a Payment"
                  variant="secondary"
                  style={{ marginTop: 14, width: undefined, alignSelf: 'flex-start', paddingHorizontal: 20 }}
                  icon={<Ionicons name="card-outline" size={17} color={colors.white} />}
                  onPress={() => navigation.navigate('Payments', { loanId: loan.id })}
                />
              ) : null}
            </View>

            <AppCard style={styles.detailCard}>
              <InfoRow label="Monthly installment" value={formatCurrency(loan.monthlyInstallment)} strong />
              <InfoRow label="Interest rate" value={`${loan.interestRate}%/month`} />
              <InfoRow label="Term" value={`${loan.termMonths} months`} />
              <InfoRow label="Started" value={loan.startDate ? formatDate(loan.startDate) : '—'} />
              <InfoRow label="Maturity" value={loan.maturityDate ? formatDate(loan.maturityDate) : '—'} />
              <InfoRow label="Next due date" value={loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : '—'} last={!loan.purpose} />
              {loan.purpose ? <InfoRow label="Purpose" value={loan.purpose} last /> : null}
            </AppCard>

            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Repayment Progress</Text>
                <Text style={styles.progressPct}>{progress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: statusColor(loan.status) }]} />
              </View>
              <Text style={styles.progressSub}>{paidCount} of {schedule.length} installments paid</Text>
            </View>

            <Text style={styles.sectionTitle}>Payment Schedule</Text>
          </>
        }
        renderItem={({ item }) => {
          const isPaid = item.status === 'PAID';
          const isOverdue = item.status === 'OVERDUE';
          return (
            <AppCard style={styles.schedCard} padded={false}>
              <View style={styles.schedRow}>
                <View style={[styles.schedNum, isPaid && styles.schedNumPaid, isOverdue && styles.schedNumOverdue]}>
                  {isPaid ? (
                    <Ionicons name="checkmark" size={15} color={colors.white} />
                  ) : (
                    <Text style={[styles.schedNumText, isOverdue && styles.schedNumTextOverdue]}>{item.installmentNumber}</Text>
                  )}
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.schedAmt}>{formatCurrency(item.amountDue)}</Text>
                  <Text style={styles.schedDate}>
                    {formatDate(item.dueDate)}
                    {isPaid && item.paidDate ? ` · paid ${formatDate(item.paidDate)}` : ''}
                  </Text>
                  <Text style={styles.schedBalance}>Balance after: {formatCurrency(item.remainingBalance)}</Text>
                </View>
                <Badge status={item.status} />
              </View>
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={30} color={colors.textFaint} />
            <Text style={styles.emptyText}>No schedule available yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  error: { fontSize: 12, color: colors.danger, textAlign: 'center', marginBottom: 10 },
  content: { padding: 16, paddingBottom: 60 },
  heroCard: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 12,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  flex1: { flex: 1, marginRight: 10 },
  heroLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  heroValue: { fontSize: 28, fontWeight: '900', color: colors.white, marginTop: 3 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 5 },
  overdueNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220,38,38,0.18)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
  },
  overdueNoteText: { flex: 1, fontSize: 11, color: '#FECACA', fontWeight: '700', marginLeft: 6 },
  detailCard: { marginBottom: 12 },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 18,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  progressPct: { fontSize: 15, fontWeight: '800', color: colors.primary },
  progressTrack: {
    height: 8,
    borderRadius: radius.round,
    backgroundColor: colors.background,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: { height: 8, borderRadius: radius.round },
  progressSub: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  schedCard: { marginBottom: 6 },
  schedRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  schedNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  schedNumPaid: { backgroundColor: colors.green },
  schedNumOverdue: { backgroundColor: colors.dangerSoft },
  schedNumText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  schedNumTextOverdue: { color: colors.danger },
  schedAmt: { fontSize: 14, fontWeight: '800', color: colors.text },
  schedDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  schedBalance: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontSize: 12, color: colors.textFaint, marginTop: 8 },
});