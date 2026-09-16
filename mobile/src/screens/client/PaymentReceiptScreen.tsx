import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, Badge, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { formatCurrency, formatDateTime, humanizeStatus } from '../../utils/format';
import { LoansStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<LoansStackParamList, 'PaymentReceipt'>;

export const PaymentReceiptScreen: React.FC<Props> = ({ navigation, route }) => {
  const receipt = route.params.receipt;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Payment Receipt" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBox}>
          <View style={styles.statusIcon}>
            <Ionicons name="cloud-upload-outline" size={30} color={colors.warning} />
          </View>
          <Text style={styles.statusTitle}>{humanizeStatus(receipt.status || 'PENDING_TELLER_VERIFICATION')}</Text>
          <Text style={styles.statusMsg}>
            Your payment proof has been received. A teller will verify it and post the payment to your loan within 24 hours.
          </Text>
          <View style={{ marginTop: 10 }}>
            <Badge status={receipt.status || 'PENDING_TELLER_VERIFICATION'} size="md" dot />
          </View>
        </View>

        <AppCard style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptTitle}>HOSCOMO Microfinance Coop</Text>
            <Text style={styles.receiptSub}>Official Payment Receipt</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.amount}>{formatCurrency(receipt.amount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Reference No.</Text>
            <Text style={styles.value}>{receipt.referenceNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatDateTime(receipt.paymentDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Method</Text>
            <Text style={styles.value}>{receipt.paymentMethod.replace(/_/g, ' ')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Loan</Text>
            <Text style={styles.value}>{receipt.loanNumber}</Text>
          </View>
          {receipt.loanProduct ? (
            <View style={styles.row}>
              <Text style={styles.label}>Product</Text>
              <Text style={styles.value}>{receipt.loanProduct}</Text>
            </View>
          ) : null}
          {receipt.remainingBalance !== undefined ? (
            <View style={styles.row}>
              <Text style={styles.label}>Est. remaining balance</Text>
              <Text style={styles.value}>{formatCurrency(receipt.remainingBalance)}</Text>
            </View>
          ) : null}

          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={[styles.value, { color: colors.warning, fontWeight: '700' }]}>{humanizeStatus(receipt.status || 'PENDING_TELLER_VERIFICATION')}</Text>
          </View>
          {receipt.notes ? <Text style={styles.notes}>{receipt.notes}</Text> : null}
        </AppCard>

        <View style={styles.actions}>
          <AppButton
            title="Done"
            variant="secondary"
            onPress={() => navigation.navigate('LoansList')}
            icon={<Ionicons name="checkmark" size={18} color={colors.white} />}
          />
          <AppButton
            title="View Loan Details"
            variant="outline"
            style={{ marginTop: 10 }}
            onPress={() => navigation.replace('LoanDetail', { loanId: receipt.loanId })}
          />
        </View>

        <Text style={styles.footerNote}>
          This receipt is generated in-app and will be replaced by the official receipt number issued by the branch teller upon verification.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  topBox: {
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: 20,
    marginBottom: 14,
  },
  statusIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusTitle: { fontSize: 17, fontWeight: '800', color: colors.warning, textTransform: 'capitalize' },
  statusMsg: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  receiptCard: { marginBottom: 16 },
  receiptHeader: { alignItems: 'center', paddingVertical: 4 },
  receiptTitle: { fontSize: 14, fontWeight: '900', color: colors.primary },
  receiptSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  label: { fontSize: 12, color: colors.textMuted },
  value: { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'right', marginLeft: 16 },
  amount: { fontSize: 18, fontWeight: '900', color: colors.primary },
  notes: { fontSize: 11, color: colors.textFaint, marginTop: 10, lineHeight: 16 },
  actions: { marginTop: 4 },
  footerNote: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});