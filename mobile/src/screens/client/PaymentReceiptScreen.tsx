import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, ErrorView, LoadingView, ScreenHeader } from '../../components';
import { colors } from '../../theme';
import { api, messageOf } from '../../services/api';
import type { ReceiptDocument } from '../../shared/lending';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { LoansStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<LoansStackParamList, 'PaymentReceipt'>;

/** The official receipt the branch issued for a posted payment (same document as the web portal). */
export const PaymentReceiptScreen: React.FC<Props> = ({ navigation, route }) => {
  const { paymentId } = route.params;
  const [receipt, setReceipt] = useState<ReceiptDocument | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setReceipt(null);
    try {
      setReceipt(await api.getReceipt(paymentId));
    } catch (err) {
      setError(messageOf(err, 'The receipt could not be loaded.'));
    }
  }, [paymentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <SafeAreaView style={styles.safe}><ScreenHeader title="Receipt" /><ErrorView message={error} onRetry={load} /></SafeAreaView>;
  if (!receipt) return <SafeAreaView style={styles.safe}><ScreenHeader title="Receipt" /><LoadingView text="Loading the receipt…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Receipt" subtitle={receipt.receiptNumber} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptTitle}>{receipt.title}</Text>
            {receipt.branchName ? <Text style={styles.receiptSub}>{receipt.branchName}</Text> : null}
            <Text style={styles.receiptSub}>{receipt.receiptNumber} · {formatDateTime(receipt.issuedAt)}</Text>
          </View>
          <View style={styles.divider} />
          <Row label={receipt.partyLabel} value={`${receipt.partyName}${receipt.partyNumber ? ` (${receipt.partyNumber})` : ''}`} />
          <Row label={receipt.accountLabel} value={receipt.accountNumber} />
          {receipt.accountDetail ? <Row label="" value={receipt.accountDetail} /> : null}
          <View style={styles.divider} />
          {receipt.lines.map((l, i) => (
            <Row key={`${l.label}-${i}`} label={l.detail ? `${l.label} (${l.detail})` : l.label} value={`${l.deduction ? '−' : ''}${formatCurrency(l.amount)}`} />
          ))}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>{receipt.totalLabel}</Text>
            <Text style={styles.amount}>{formatCurrency(receipt.totalAmount)}</Text>
          </View>
          <Row label="Method" value={receipt.method} />
          {receipt.reference ? <Row label="Reference" value={receipt.reference} /> : null}
          <Row label="Received by" value={receipt.processedBy} />
          {receipt.notes ? <Text style={styles.notes}>{receipt.notes}</Text> : null}
          {receipt.footer ? <Text style={styles.notes}>{receipt.footer}</Text> : null}
        </AppCard>
        <AppButton title="Back to loans" variant="outline" onPress={() => navigation.navigate('LoansList')} />
      </ScrollView>
    </SafeAreaView>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  receiptCard: { marginBottom: 16 },
  receiptHeader: { alignItems: 'center', paddingVertical: 4 },
  receiptTitle: { fontSize: 15, fontWeight: '900', color: colors.primary, textAlign: 'center' },
  receiptSub: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  label: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  value: { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'right', marginLeft: 16 },
  totalLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  amount: { fontSize: 18, fontWeight: '900', color: colors.primary },
  notes: { fontSize: 11, color: colors.textFaint, marginTop: 10, lineHeight: 16 },
});
