import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, EmptyState, ErrorView, LoadingView, ScreenHeader, SearchBar } from '../../components';
import { colors, radius } from '../../theme';
import { api, messageOf } from '../../services/api';
import {
  TRANSACTION_KINDS,
  TRANSACTION_KIND_LABELS,
  TRANSACTION_PERIODS,
  manilaToday,
  periodStart,
  transactionsCsv,
  type ClientTransactionView,
  type TransactionKind,
  type TransactionPeriod,
} from '../../shared/client';
import { formatCurrency, formatDate } from '../../utils/format';

const KIND_OPTIONS: Array<TransactionKind | 'ALL'> = ['ALL', ...TRANSACTION_KINDS.filter((k) => k !== 'OTHER')];

/** The member's full history from the transaction register (same endpoint and filters as the web portal). */
export const TransactionsScreen: React.FC = () => {
  const [rows, setRows] = useState<ClientTransactionView[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<TransactionKind | 'ALL'>('ALL');
  const [period, setPeriod] = useState<TransactionPeriod>('ALL');

  const load = useCallback(async () => {
    try {
      setRows(await api.getTransactions({ kind, search: search.trim(), from: periodStart(period, manilaToday()) }));
      setError('');
    } catch (err) {
      setError(messageOf(err, 'Your transactions could not be loaded.'));
    } finally {
      setRefreshing(false);
    }
  }, [kind, search, period]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const exportCsv = async () => {
    if (!rows?.length) return;
    await Share.share({ title: `Transactions ${manilaToday()}`, message: transactionsCsv(rows) });
  };

  if (error && !rows) return <SafeAreaView style={styles.safe}><ScreenHeader title="Transactions" /><ErrorView message={error} onRetry={load} /></SafeAreaView>;
  if (!rows) return <SafeAreaView style={styles.safe}><ScreenHeader title="Transactions" /><LoadingView text="Loading transactions…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Transactions"
        subtitle="Loans, savings and solidarity fund"
        right={
          <TouchableOpacity onPress={exportCsv} disabled={!rows.length} accessibilityLabel="Export transactions">
            <Ionicons name="share-outline" size={22} color={rows.length ? colors.primary : colors.textFaint} />
          </TouchableOpacity>
        }
      />
      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by reference or note" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
        {TRANSACTION_PERIODS.map((p) => (
          <Chip key={p.id} label={p.label} active={period === p.id} onPress={() => setPeriod(p.id)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
        {KIND_OPTIONS.map((k) => (
          <Chip key={k} label={k === 'ALL' ? 'All types' : TRANSACTION_KIND_LABELS[k]} active={kind === k} onPress={() => setKind(k)} />
        ))}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const out = item.direction === 'OUT';
          return (
            <AppCard style={styles.txnCard} padded={false}>
              <View style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: out ? colors.dangerSoft : colors.greenSoft }]}>
                  <Ionicons name={out ? 'arrow-up-outline' : 'arrow-down-outline'} size={17} color={out ? colors.danger : colors.greenDark} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.txnType}>{item.label}</Text>
                  <Text style={styles.txnRef}>{item.reference}{item.account ? ` · ${item.account}` : ''}</Text>
                  {item.notes ? <Text style={styles.txnRef} numberOfLines={2}>{item.notes}</Text> : null}
                </View>
                <View style={styles.txnAmtWrap}>
                  <Text style={[styles.txnAmt, out ? styles.txnAmtOut : styles.txnAmtIn]}>
                    {out ? '−' : '+'}{formatCurrency(item.amount)}
                  </Text>
                  <Text style={styles.txnDate}>{formatDate(item.date)}</Text>
                </View>
              </View>
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No transactions found"
            message={search || kind !== 'ALL' || period !== 'ALL' ? 'Try other filters.' : 'Payments, loan releases and savings activity will appear here.'}
          />
        }
      />
    </SafeAreaView>
  );
};

const Chip: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityLabel={label}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  error: { fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 4, paddingHorizontal: 16 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 8 },
  chipsRow: { flexGrow: 0, marginTop: 8 },
  chipsContent: { paddingHorizontal: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.round, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginRight: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  content: { padding: 16, paddingTop: 10, paddingBottom: 110, flexGrow: 1 },
  txnCard: { marginBottom: 8 },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  flex1: { flex: 1, marginRight: 8 },
  txnIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txnType: { fontSize: 13, fontWeight: '700', color: colors.text },
  txnRef: { fontSize: 11, color: colors.textFaint, marginTop: 1 },
  txnAmtWrap: { alignItems: 'flex-end', marginLeft: 6 },
  txnAmt: { fontSize: 14, fontWeight: '800' },
  txnAmtIn: { color: colors.greenDark },
  txnAmtOut: { color: colors.danger },
  txnDate: { fontSize: 10, color: colors.textFaint, marginTop: 3 },
});
