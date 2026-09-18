import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, Avatar, Badge, EmptyState, LoadingView, ProgressBar, ScreenHeader, SectionHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { ClientGroup } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';

const STATUS_COLORS: Record<string, string> = {
  PAID: colors.green,
  PENDING: colors.warning,
  LATE: colors.danger,
};

export const GroupLendingScreen: React.FC = () => {
  const [group, setGroup] = useState<ClientGroup | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoaded(false);
    setError(null);
    try {
      const res = await api.getMyGroup();
      setGroup(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load your group.');
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

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Group Lending" />
        <LoadingView />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Group Lending" />
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState
            icon="people-outline"
            title="You are not in a group yet"
            message="HOSCOMCO uses solidarity group lending — members mutually guarantee each other's loans. Ask your branch how to join a group near you."
          />
          <AppCard style={styles.infoCard}>
            <Text style={styles.infoTitle}>What is Group Lending?</Text>
            <Text style={styles.infoText}>
              A solidarity group is a small circle of members who meet regularly, save together, and support each other's repayment. Groups open access to group loans and help build a strong repayment record.
            </Text>
          </AppCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const progress = group.groupLoan ? Math.round((group.groupLoan.paidAmount / group.groupLoan.totalAmount) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={group.name} subtitle={group.branch ? `Branch: ${group.branch}` : undefined} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.groupHero}>
          <View style={styles.groupHeroTop}>
            <View style={styles.flex1}>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.groupMeta}>
                {group.memberCount} members · {group.centerName ? `Center: ${group.centerName}` : `Led by ${group.leaderName}`}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Badge status={group.status} size="md" dot />
              </View>
            </View>
            <Ionicons name="people" size={38} color="rgba(255,255,255,0.4)" />
          </View>
        </View>

        {group.groupLoan ? (
          <>
            <AppCard style={styles.loanCard}>
              <View style={styles.loanHeader}>
                <Text style={styles.loanTitle}>Group Loan</Text>
                <Text style={styles.loanBalance}>{formatCurrency(group.groupLoan.outstandingBalance)}</Text>
                <Text style={styles.loanSub}>outstanding of {formatCurrency(group.groupLoan.totalAmount)}</Text>
              </View>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>{progress}% repaid</Text>
                <Text style={styles.progressAmount}>{formatCurrency(group.groupLoan.paidAmount)} paid</Text>
              </View>
              <ProgressBar progress={progress} color={colors.green} height={9} animated />
              <View style={styles.nextPay}>
                <Ionicons name="calendar-outline" size={15} color={colors.danger} />
                <Text style={styles.nextPayText}>
                  Next payment: {formatCurrency(group.groupLoan.nextPayment)} due {formatDate(group.groupLoan.nextPaymentDate)}
                </Text>
              </View>
            </AppCard>

            {group.groupLoan.schedule.length ? (
              <>
                <SectionHeader title="Contribution Schedule" subtitle="Group repayments by installment" />
                  <AppCard padded={false} style={{ marginBottom: 16 }}>
                    {group.groupLoan.schedule.slice(0, 6).map((item, i) => (
                      <View key={String(item.installmentNumber)} style={[styles.schedRow, i < 5 && styles.schedRowBorder]}>
                        <View style={styles.schedNum}>
                          <Text style={styles.schedNumText}>{item.installmentNumber}</Text>
                        </View>
                        <View style={styles.flex1}>
                          <Text style={styles.schedAmt}>{formatCurrency(item.amountDue)}</Text>
                          <Text style={styles.schedDate}>{formatDate(item.dueDate)}</Text>
                        </View>
                        <Badge status={item.status} />
                      </View>
                    ))}
                  </AppCard>
              </>
            ) : null}
          </>
        ) : null}

        <SectionHeader title="Group Members" subtitle="Mutually guaranteeing each other's loans" />
        <AppCard padded={false} style={{ marginBottom: 8 }}>
          {group.members.map((m, i) => {
            const color = STATUS_COLORS[m.contributionStatus] ?? colors.textMuted;
            return (
              <View key={m.borrowerId} style={[styles.memberRow, i < group.members.length - 1 && styles.memberRowBorder]}>
                <Avatar name={m.name} size={38} />
                <View style={styles.flex1}>
                  <Text style={styles.memberName}>
                    {m.name}
                    {m.role ? <Text style={styles.memberRole}> · {m.role}</Text> : null}
                  </Text>
                  <Text style={styles.memberStatus}>Contribution: {m.contributionStatus}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: color }]} />
              </View>
            );
          })}
        </AppCard>

        <Text style={styles.note}>
          Solidarity groups support each member's repayment. If a member falls behind, the group works together to keep contributions current.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 60, flexGrow: 1 },
  error: { fontSize: 12, color: colors.danger, textAlign: 'center', marginBottom: 10 },
  groupHero: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 14,
  },
  groupHeroTop: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1, marginRight: 10 },
  groupName: { fontSize: 19, fontWeight: '900', color: colors.white },
  groupMeta: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  loanCard: { marginBottom: 16 },
  loanHeader: { marginBottom: 8 },
  loanTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  loanBalance: { fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 4 },
  loanSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: colors.greenDark },
  progressAmount: { fontSize: 12, color: colors.textMuted },
  nextPay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
  },
  nextPayText: { fontSize: 11, color: colors.danger, fontWeight: '700', marginLeft: 6 },
  schedRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  schedRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  schedNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  schedNumText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  schedAmt: { fontSize: 13, fontWeight: '800', color: colors.text },
  schedDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  memberName: { fontSize: 13, fontWeight: '800', color: colors.text },
  memberRole: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  memberStatus: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  infoCard: { marginTop: 12 },
  infoTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  infoText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  note: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 12, lineHeight: 16 },
});