import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, Badge, ErrorView, InfoRow, LoadingView, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api, messageOf } from '../../services/api';
import type { LoanDetailView, PaymentView } from '../../shared/client';
import { FREQUENCY_LABELS, INTEREST_METHOD_LABELS, centsFromDb, displayPercent, paymentMethodLabel } from '../../shared/lending';
import { formatCurrency, formatDate } from '../../utils/format';
import { LoansStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<LoansStackParamList, 'LoanDetail'>;

export const LoanDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { loanId } = route.params;
  const [loan, setLoan] = useState<LoanDetailView | null>(null);
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [{ loan: detail }, paid] = await Promise.all([api.getLoan(loanId), api.getLoanPayments(loanId)]);
      setLoan(detail);
      setPayments(paid);
      setError('');
    } catch (err) {
      setError(messageOf(err, 'This loan could not be loaded.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loanId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <SafeAreaView style={styles.safe}><ScreenHeader title="Loan Details" /><LoadingView text="Loading the loan…" /></SafeAreaView>;
  if (error || !loan) return <SafeAreaView style={styles.safe}><ScreenHeader title="Loan Details" /><ErrorView message={error || 'This loan is not available.'} onRetry={() => load()} /></SafeAreaView>;

  const schedule = loan.schedule;
  const paidCount = schedule.filter((s) => s.status === 'PAID').length;
  const overdue = schedule.filter((s) => s.status === 'OVERDUE').length;
  const payable = centsFromDb(loan.totalPayable);
  const progress = payable > 0 ? Math.min(100, Math.round((centsFromDb(loan.totalPaid) / payable) * 100)) : 0;
  const running = loan.status === 'Active' || loan.status === 'Disbursed';
  const reason = loan.status === 'Rejected' ? loan.decisionReason : loan.status === 'Draft' ? loan.returnedReason : loan.status === 'Cancelled' ? loan.cancellationReason : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={loan.productName} subtitle={loan.loanNumber} />
      <FlatList
        data={schedule}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={styles.flex1}>
                  <Text style={styles.heroLabel}>{running ? 'REMAINING BALANCE' : 'AMOUNT'}</Text>
                  <Text style={styles.heroValue}>{formatCurrency(running ? loan.remainingBalance : loan.principal)}</Text>
                  <Text style={styles.heroSub}>{formatCurrency(loan.principal)} principal · {loan.termMonths} months</Text>
                </View>
                <Badge status={loan.overdue ? 'OVERDUE' : loan.status} size="md" />
              </View>
              {overdue > 0 ? (
                <View style={styles.overdueNote}>
                  <Ionicons name="alert-circle" size={14} color={colors.danger} />
                  <Text style={styles.overdueNoteText}>{overdue} installment{overdue > 1 ? 's' : ''} overdue. Penalties apply each month until paid.</Text>
                </View>
              ) : null}
              {running ? (
                <AppButton
                  title="Send payment proof"
                  variant="secondary"
                  style={{ marginTop: 14, width: undefined, alignSelf: 'flex-start', paddingHorizontal: 20 }}
                  icon={<Ionicons name="card-outline" size={17} color={colors.white} />}
                  onPress={() => navigation.navigate('Payments', { loanId: loan.id })}
                />
              ) : null}
            </View>

            {reason ? (
              <AppCard style={styles.detailCard}>
                <Text style={styles.reasonTitle}>{loan.status === 'Draft' ? 'Changes requested' : 'Reason'}</Text>
                <Text style={styles.reasonText}>{reason}</Text>
              </AppCard>
            ) : null}

            <AppCard style={styles.detailCard}>
              <InfoRow label="Installment" value={loan.installmentAmount ? formatCurrency(loan.installmentAmount) : '—'} strong />
              <InfoRow label="Interest" value={`${displayPercent(loan.annualRate)} a year, ${INTEREST_METHOD_LABELS[loan.interestMethod as keyof typeof INTEREST_METHOD_LABELS]?.toLowerCase() ?? loan.interestMethod}`} />
              <InfoRow label="Repayment" value={FREQUENCY_LABELS[loan.frequency as keyof typeof FREQUENCY_LABELS] ?? loan.frequency} />
              <InfoRow label="Total payable" value={formatCurrency(loan.totalPayable)} />
              <InfoRow label="Paid so far" value={formatCurrency(loan.totalPaid)} />
              <InfoRow label="Released" value={formatDate(loan.disbursedDate)} />
              <InfoRow label="Maturity" value={formatDate(loan.maturityDate)} />
              <InfoRow label="Next due" value={loan.nextDue ? `${formatCurrency(loan.nextDue.amount)} on ${formatDate(loan.nextDue.dueDate)}` : '—'} last />
            </AppCard>

            {schedule.length ? (
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressTitle}>Repayment progress</Text>
                  <Text style={styles.progressPct}>{progress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={styles.progressSub}>{paidCount} of {schedule.length} installments paid</Text>
              </View>
            ) : null}

            {payments.length ? (
              <>
                <Text style={styles.sectionTitle}>Payments</Text>
                {payments.map((p) => (
                  <TouchableOpacity key={p.id} onPress={() => navigation.navigate('PaymentReceipt', { paymentId: p.id })} accessibilityLabel={`Receipt ${p.receiptNumber}`}>
                    <AppCard style={styles.schedCard} padded={false}>
                      <View style={styles.schedRow}>
                        <View style={styles.flex1}>
                          <Text style={styles.schedAmt}>{formatCurrency(p.amount)}{p.status === 'REVERSED' ? ' (reversed)' : ''}</Text>
                          <Text style={styles.schedDate}>{formatDate(p.paymentDate)} · {p.receiptNumber} · {paymentMethodLabel(p.method)}</Text>
                        </View>
                        <Ionicons name="receipt-outline" size={16} color={colors.textFaint} />
                      </View>
                    </AppCard>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}

            <Text style={styles.sectionTitle}>{loan.scheduleKind === 'PROJECTED' ? 'Schedule (estimate until release)' : 'Schedule'}</Text>
          </>
        }
        renderItem={({ item }) => {
          const isPaid = item.status === 'PAID';
          const isOverdue = item.status === 'OVERDUE';
          return (
            <AppCard style={styles.schedCard} padded={false}>
              <View style={styles.schedRow}>
                <View style={[styles.schedNum, isPaid && styles.schedNumPaid, isOverdue && styles.schedNumOverdue]}>
                  {isPaid ? <Ionicons name="checkmark" size={15} color={colors.white} /> : <Text style={[styles.schedNumText, isOverdue && styles.schedNumTextOverdue]}>{item.number}</Text>}
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.schedAmt}>{formatCurrency(item.total)}{centsFromDb(item.penalty) > 0 ? ` + ${formatCurrency(item.penalty)} penalty` : ''}</Text>
                  <Text style={styles.schedDate}>Due {formatDate(item.dueDate)}{centsFromDb(item.outstanding) > 0 && !isPaid ? ` · ${formatCurrency(item.outstanding)} left` : ''}</Text>
                  <Text style={styles.schedBalance}>Balance after: {formatCurrency(item.balanceAfter)}</Text>
                </View>
                <Badge status={item.status} />
              </View>
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={30} color={colors.textFaint} />
            <Text style={styles.emptyText}>No schedule yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
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
  reasonTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 4 },
  reasonText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  emptyText: { fontSize: 12, color: colors.textFaint, marginTop: 8 },
});