import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, EmptyState, LoadingView, ScreenHeader, SearchBar, SegmentedTabs } from '../../components';
import { colors, radius } from '../../theme';
import { branchApi } from '../../services/api';
import { BranchKycQueueItem } from '../../types';
import { BranchStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BranchStackParamList, 'KycQueue'>;

type TabKey = 'all' | 'pending' | 'verified' | 'correction';

export const KycQueueScreen: React.FC<Props> = ({ navigation }) => {
  const [queue, setQueue] = useState<BranchKycQueueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoaded(false);
    try {
      const res = await branchApi.getKycQueue();
      setQueue(res);
    } catch {}
    setLoaded(true);
    setRefreshing(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const visible = queue.filter((q) => {
    const status = String(q.kycStatus).toUpperCase();
    if (search) {
      const hay = `${q.fullName} ${q.borrowerNumber} ${q.phone}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    if (tab === 'pending') return ['PENDING', 'UNDER_REVIEW'].includes(status) || status === 'NOT_STARTED';
    if (tab === 'verified') return ['VERIFIED'].includes(status) || status === 'REJECTED';
    if (tab === 'correction') return status === 'CORRECTION_REQUIRED';
    return true;
  });

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="KYC Review Queue" showBack={false} /><LoadingView /></SafeAreaView>;

  const pendingCount = queue.filter((q) => ['PENDING', 'UNDER_REVIEW'].includes(String(q.kycStatus).toUpperCase())).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="KYC Review Queue" subtitle={`${pendingCount} awaiting review`} showBack={false} />
      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, member no., or phone" />
      </View>
      <View style={styles.tabsWrap}>
        <SegmentedTabs<TabKey>
          tabs={[
            { key: 'all', label: 'All', count: queue.length },
            { key: 'pending', label: 'Pending', count: pendingCount },
            { key: 'verified', label: 'Verified' },
            { key: 'correction', label: 'Corrections' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const pending = ['PENDING', 'UNDER_REVIEW'].includes(String(item.kycStatus).toUpperCase());
          return (
            <View style={styles.itemCard}>
              <View style={styles.itemBody}>
                <Avatar name={item.fullName} size={44} fg={colors.white} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.fullName}</Text>
                  <Text style={styles.itemMeta}>{item.borrowerNumber} · {item.gender ?? '—'} · {item.dateOfBirth ?? '—'}</Text>
                  <View style={styles.badgeRow}>
                    <Badge status={item.kycStatus} dot size="md" />
                  </View>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemDocs}>{item.submittedDocuments} docs</Text>
                  <View style={styles.reviewBtn}>
                    <Ionicons name={pending ? 'document-text-outline' : 'eye-outline'} size={15} color={colors.primary} />
                    <Text style={styles.reviewBtnText}>{pending ? 'Review' : 'View'}</Text>
                  </View>
                </View>
              </View>
              {item.kycSubmission?.correctionReason ? (
                <View style={styles.correctionBox}>
                  <Ionicons name="alert-circle" size={13} color={colors.info} />
                  <Text style={styles.correctionText} numberOfLines={1}>{item.kycSubmission.correctionReason}</Text>
                </View>
              ) : item.kycSubmission?.reviewedByName ? (
                <View style={styles.auditBox}>
                  <Ionicons name="time-outline" size={13} color={colors.textFaint} />
                  <Text style={styles.auditText}>Reviewed by {item.kycSubmission.reviewedByName}</Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="shield-checkmark-outline"
            title="Queue is clear"
            message={search ? 'No clients match your search.' : 'New KYC submissions will appear here as clients start verification.'}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  searchWrap: { paddingHorizontal: 16, paddingTop: 8 },
  tabsWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  content: { padding: 16, paddingTop: 4, paddingBottom: 60, flexGrow: 1 },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  itemBody: { flexDirection: 'row', alignItems: 'center' },
  itemInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  itemName: { fontSize: 14, fontWeight: '800', color: colors.text },
  itemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', marginTop: 5 },
  itemRight: { alignItems: 'flex-end' },
  itemDocs: { fontSize: 11, color: colors.textFaint, marginBottom: 6 },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.round,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  reviewBtnText: { fontSize: 12, fontWeight: '800', color: colors.primary, marginLeft: 4 },
  correctionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 10,
  },
  correctionText: { flex: 1, fontSize: 11, color: colors.info, fontWeight: '600', marginLeft: 5 },
  auditBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  auditText: { fontSize: 11, color: colors.textFaint, marginLeft: 5, fontWeight: '600' },
});