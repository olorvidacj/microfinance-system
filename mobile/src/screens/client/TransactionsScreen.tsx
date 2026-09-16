import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, Badge, EmptyState, LoadingView, ScreenHeader, SearchBar, SegmentedTabs } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { FinancialTransaction, TransactionType } from '../../types';
import { formatCurrency, formatDateTime, humanizeStatus } from '../../utils/format';

type TypeKey = 'ALL' | TransactionType;

const TYPE_TABS: Array<{ key: TypeKey; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'REPAYMENT', label: 'Repayments' },
  { key: 'LOAN_DISBURSEMENT', label: 'Disbursed' },
  { key: 'SAVINGS_DEPOSIT', label: 'Savings' },
];

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

export const TransactionsScreen: React.FC = () => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeKey>('ALL');

  const load = useCallback(async (params: { search?: string; type?: string }, silent = false) => {
    if (!silent) setLoaded(false);
    setError(null);
    try {
      const res = await api.getTransactions({
        search: params.search || undefined,
        type: params.type && params.type !== 'ALL' ? params.type : undefined,
      });
      setTransactions(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load transactions.');
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load({ search, type });
    }, [search, type])
  );

  const changeType = (t: TypeKey) => {
    setType(t);
    load({ search, type: t }, true);
  };

  const changeSearch = (s: string) => {
    setSearch(s);
    load({ search: s, type }, true);
  };

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="Transactions" /><LoadingView /></SafeAreaView>;

  const totalOut = transactions
    .filter((t) => ['REPAYMENT', 'LOAN_PAYMENT', 'SAVINGS_WITHDRAWAL', 'FEE'].includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIn = transactions
    .filter((t) => ['LOAN_DISBURSEMENT', 'SAVINGS_DEPOSIT', 'LOAN_APPROVAL'].includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Transactions" subtitle="Loan, savings, and fee activity" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={changeSearch} placeholder="Search by reference or description" />
      </View>
      <View style={styles.tabsWrap}>
        <SegmentedTabs<TypeKey> tabs={TYPE_TABS} active={type} onChange={changeType} />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryIn}>
          <Text style={styles.summaryValue}>{formatCurrency(totalIn)}</Text>
          <Text style={styles.summaryLabel}>Money in</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryOut}>
          <Text style={styles.summaryValue}>{formatCurrency(totalOut)}</Text>
          <Text style={styles.summaryLabel}>Money out</Text>
        </View>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load({ search, type }, true); }} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const isOut = ['REPAYMENT', 'LOAN_PAYMENT', 'SAVINGS_WITHDRAWAL', 'FEE'].includes(item.type);
          return (
            <AppCard style={styles.txnCard} padded={false}>
              <View style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: isOut ? colors.dangerSoft : colors.greenSoft }]}>
                  <Ionicons name={TXN_ICONS[item.type] ?? 'swap-horizontal-outline'} size={17} color={isOut ? colors.danger : colors.greenDark} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.txnType}>{humanizeStatus(item.type)}</Text>
                  <Text style={styles.txnRef}>{item.referenceNumber}</Text>
                  {item.loanNumber ? <Text style={styles.txnRef}>Loan {item.loanNumber}</Text> : null}
                  <View style={{ marginTop: 3 }}>
                    <Badge status={item.status} />
                  </View>
                </View>
                <View style={styles.txnAmtWrap}>
                  <Text style={[styles.txnAmt, isOut ? styles.txnAmtOut : styles.txnAmtIn]}>
                    {isOut ? '−' : '+'}{formatCurrency(item.amount)}
                  </Text>
                  <Text style={styles.txnDate}>{formatDateTime(item.date)}</Text>
                </View>
              </View>
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No transactions found"
            message={search ? 'Try a different search term or filter.' : 'Your transaction history will appear here.'}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  error: { fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 8 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 8 },
  tabsWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  summaryIn: { flex: 1 },
  summaryOut: { flex: 1 },
  summaryDivider: { width: 1, height: 30, backgroundColor: colors.borderLight, marginHorizontal: 14 },
  summaryValue: { fontSize: 14, fontWeight: '900', color: colors.text },
  summaryLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  content: { padding: 16, paddingTop: 4, paddingBottom: 110, flexGrow: 1 },
  txnCard: { marginBottom: 8 },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  flex1: { flex: 1, marginRight: 8 },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnType: { fontSize: 13, fontWeight: '700', color: colors.text },
  txnRef: { fontSize: 10, color: colors.textFaint, marginTop: 1 },
  txnAmtWrap: { alignItems: 'flex-end', marginLeft: 6 },
  txnAmt: { fontSize: 14, fontWeight: '800' },
  txnAmtIn: { color: colors.greenDark },
  txnAmtOut: { color: colors.danger },
  txnDate: { fontSize: 10, color: colors.textFaint, marginTop: 3 },
});