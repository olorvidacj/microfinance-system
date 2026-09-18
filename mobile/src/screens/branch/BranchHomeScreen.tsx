import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, Avatar, Badge, LoadingView, StatCard } from '../../components';
import { colors, radius } from '../../theme';
import { api, branchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { BranchContextData, BranchKycQueueItem } from '../../types';
import { BranchStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BranchStackParamList, 'BranchHome'>;

export const BranchHomeScreen: React.FC<Props> = ({ navigation }) => {
  const { session, signOut } = useAuth();
  const [context, setContext] = useState<BranchContextData | null>(null);
  const [queue, setQueue] = useState<BranchKycQueueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoaded(false);
    try {
      const [ctx, kycQueue] = await Promise.all([branchApi.getContext(), branchApi.getKycQueue()]);
      setContext(ctx);
      setQueue(kycQueue);
    } catch {}
    setLoaded(true);
    setRefreshing(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const pending = queue.filter((q) => ['PENDING', 'UNDER_REVIEW'].includes(String(q.kycStatus).toUpperCase())).length;
  const verified = queue.filter((q) => String(q.kycStatus).toUpperCase() === 'VERIFIED').length;
  const flaggedForCorrection = queue.filter((q) => String(q.kycStatus).toUpperCase() === 'CORRECTION_REQUIRED').length;

  if (!loaded) return <SafeAreaView style={styles.safe}><LoadingView text="Loading branch dashboard..." /></SafeAreaView>;

  const user = session?.user;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.white} />}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Avatar name={context?.staffName ?? user?.fullName} size={48} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerGreeting}>Branch Console</Text>
              <Text style={styles.headerName}>{context?.staffName ?? user?.fullName}</Text>
              <Badge label={context?.staffRole ?? user?.staffRole ?? 'STAFF'} bg="rgba(255,255,255,0.2)" color={colors.white} />
            </View>
            <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="log-out-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.branchRow}>
            <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.branchName}>{context?.branchName ?? 'HOSCOMCO Branch'}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statFlex}>
            <StatCard compact icon="hourglass-outline" label="Pending review" value={String(pending)} color={colors.warning} bg={colors.warningSoft} />
          </View>
          <View style={styles.statFlex}>
            <StatCard compact icon="checkmark-circle-outline" label="Verified" value={String(verified)} color={colors.green} bg={colors.greenSoft} />
          </View>
          <View style={styles.statFlex}>
            <StatCard compact icon="create-outline" label="Corrections" value={String(flaggedForCorrection)} color={colors.info} bg={colors.infoSoft} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>KYC Verification Queue</Text>
        <View
          style={[
            styles.queueBtn,
            { backgroundColor: colors.primaryDeep },
          ]}
        >
          <View style={styles.queueBtnIcon}>
            <Ionicons name="shield-checkmark" size={22} color={colors.white} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.queueBtnTitle}>Review Client KYC</Text>
            <Text style={styles.queueBtnSub}>
              {pending} client{pending === 1 ? '' : 's'} waiting for approval or correction
            </Text>
          </View>
          <TouchableOpacity style={styles.openBtn} onPress={() => navigation.navigate('KycQueue')} activeOpacity={0.85}>
            <Text style={styles.openBtnText}>Open Queue</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.primaryDeep} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Recent Submissions</Text>
        {queue.length ? (
          <View style={styles.recentCard}>
            {queue.slice(0, 4).map((q, i) => (
              <TouchableOpacity
                key={q.id}
                style={[styles.recentRow, i < 3 && styles.recentRowBorder]}
                onPress={() => navigation.navigate('KycReviewDetail', { clientId: q.id })}
                activeOpacity={0.85}
              >
                <Avatar name={q.fullName} size={38} />
                <View style={styles.flex1}>
                  <Text style={styles.recentName}>{q.fullName}</Text>
                  <Text style={styles.recentMeta}>{q.borrowerNumber} · {q.submittedDocuments} docs</Text>
                </View>
                <Badge status={q.kycStatus} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-outline" size={28} color={colors.textFaint} />
            <Text style={styles.emptyText}>No KYC submissions in this branch queue.</Text>
          </View>
        )}

        <AppButton
          variant="outline"
          title="Sign Out"
          style={{ marginTop: 22 }}
          onPress={() => signOut()}
          icon={<Ionicons name="log-out-outline" size={17} color={colors.primary} />}
        />

        <Text style={styles.footer}>{context?.branchName ?? 'HOSCOMCO'} · Authorized personnel only</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 60, flexGrow: 1 },
  header: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    margin: 16,
    padding: 18,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  headerGreeting: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  headerName: { fontSize: 18, fontWeight: '900', color: colors.white, marginVertical: 4 },
  signOutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  branchName: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginLeft: 5, fontWeight: '600' },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 18 },
  statFlex: { flex: 1, marginHorizontal: 3 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  queueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 18,
  },
  queueBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  flex1: { flex: 1, marginRight: 4 },
  queueBtnTitle: { fontSize: 15, fontWeight: '800', color: colors.white },
  queueBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3, lineHeight: 15 },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.round,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  openBtnText: { fontSize: 12, fontWeight: '800', color: colors.primaryDeep, marginRight: 4 },
  recentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  recentName: { fontSize: 13, fontWeight: '800', color: colors.text },
  recentMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    padding: 26,
  },
  emptyText: { fontSize: 12, color: colors.textFaint, marginTop: 10, textAlign: 'center' },
  footer: { fontSize: 10, color: colors.textFaint, textAlign: 'center', marginTop: 16 },
});