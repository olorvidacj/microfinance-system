import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppModal, AppTextInput, LoadingView, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { LoanItem, PaymentMethod, PaymentReceipt } from '../../types';
import { formatCurrency } from '../../utils/format';
import { validators } from '../../utils/validation';
import { LoansStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<LoansStackParamList, 'Payments'>;

const METHODS: { key: PaymentMethod; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { key: 'GCASH', icon: 'phone-portrait-outline', hint: 'GCash transfer or cash-in' },
  { key: 'MAYA', icon: 'wallet-outline', hint: 'Maya transfer' },
  { key: 'BANK_TRANSFER', icon: 'business-outline', hint: 'Bank transfer (InstaPay/PESONet)' },
  { key: 'OVER_THE_COUNTER', icon: 'storefront-outline', hint: 'Pay at any HOSCOMCO branch' },
];

export const PaymentsScreen: React.FC<Props> = ({ navigation, route }) => {
  const selectedLoanId = route.params?.loanId;

  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loan, setLoan] = useState<LoanItem | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('GCASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [proof, setProof] = useState<{ uri: string; name: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loanPickerVisible, setLoanPickerVisible] = useState(false);

  useCallback(async () => {}, []);
  const loadLoans = useCallback(async () => {
    try {
      const res = await api.getLoans();
      const active = res.activeLoans;
      setLoans(active);
      if (selectedLoanId) {
        const found = active.find((l) => l.id === selectedLoanId);
        if (found) setLoan(found);
      }
      if (active.length === 1) setLoan(active[0]);
    } finally {
      setLoaded(true);
    }
  }, [selectedLoanId]);

  React.useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const pickProof = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });
    if (res.canceled) return;
    setProof({ uri: res.assets[0].uri, name: res.assets[0].fileName || `proof-${Date.now()}.jpg` });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!loan) e.loan = 'Select the loan you are paying for.';
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid payment amount.';
    if (!referenceNumber.trim()) e.referenceNumber = 'Enter the reference number of your payment.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!loan) return;
    setSubmitting(true);
    try {
      const res = await api.submitPaymentProof({
        loanId: loan.id,
        amount: Number(amount),
        paymentMethod: method,
        referenceNumber: referenceNumber.trim(),
        receiptProofUrl: proof?.uri,
        paymentDate: new Date().toISOString(),
        notes: notes || undefined,
      });
      const receipt: PaymentReceipt = {
        id: `rcpt-${Date.now()}`,
        referenceNumber: referenceNumber.trim(),
        amount: Number(amount),
        paymentDate: new Date().toISOString(),
        loanId: loan.id,
        loanNumber: loan.loanNumber,
        loanProduct: loan.productName,
        paymentMethod: method,
        status: 'PENDING_TELLER_VERIFICATION',
        remainingBalance: Math.max(0, loan.remainingBalance - Number(amount)),
        notes: res.message,
      };
      setConfirmVisible(false);
      navigation.replace('PaymentReceipt', { receipt });
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Unable to submit payment proof. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="Make a Payment" /><LoadingView /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Make a Payment" subtitle="Submit your payment for verification" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {errors.submit ? (
            <View style={styles.submitError}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.submitErrorText}>{errors.submit}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>1. Select Loan</Text>
          <TouchableOpacity onPress={() => setLoanPickerVisible(true)} activeOpacity={0.85}>
            <AppCard style={styles.fieldCard}>
              <View style={styles.flex1}>
                <Text style={styles.fieldLabel}>Loan</Text>
                <Text style={[styles.fieldValue, !loan && styles.fieldPlaceholder]}>
                  {loan ? `${loan.productName} · ${loan.loanNumber}` : 'Tap to choose a loan'}
                </Text>
                {loan ? <Text style={styles.fieldSub}>{loan.termMonths} mo · Rate {loan.interestRate}%/mo</Text> : null}
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.textFaint} />
            </AppCard>
          </TouchableOpacity>
          {errors.loan ? <Text style={styles.fieldError}>{errors.loan}</Text> : null}

          <Text style={styles.sectionLabel}>2. Payment Method</Text>
          <View style={styles.methodRow}>
            {METHODS.map((m) => {
              const active = method === m.key;
              return (
                <TouchableOpacity key={m.key} style={[styles.methodChip, active && styles.methodChipActive]} onPress={() => setMethod(m.key)} activeOpacity={0.85}>
                  <Ionicons name={m.icon} size={22} color={active ? colors.white : colors.textMuted} />
                  <Text style={[styles.methodText, active && styles.methodTextActive]}>{m.key.replace('_', ' ')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.methodHint}>
            {METHODS.find((m) => m.key === method)?.hint}
          </Text>

          <Text style={styles.sectionLabel}>3. Amount & Reference</Text>
          <AppTextInput
            label="Payment Amount (₱)"
            placeholder="e.g. 1500"
            value={amount}
            onChangeText={(v) => { setAmount(v); setErrors((e) => ({ ...e, amount: '' })); }}
            keyboardType="numeric"
            error={errors.amount}
            hint={loan ? `Suggested: ${formatCurrency(loan.monthlyInstallment)} monthly installment` : undefined}
          />
          <AppTextInput
            label="Reference Number *"
            placeholder="e.g. GCash Ref 1234 5678 9012"
            value={referenceNumber}
            onChangeText={(v) => { setReferenceNumber(v); setErrors((e) => ({ ...e, referenceNumber: '' })); }}
            error={errors.referenceNumber}
            hint="Use the transaction reference shown by your payment channel."
          />

          <Text style={styles.sectionLabel}>4. Payment Proof (Optional)</Text>
          <TouchableOpacity onPress={pickProof} activeOpacity={0.85}>
            <AppCard style={{ ...styles.fieldCard, ...styles.uploadCard }}>
              {proof ? (
                <View style={styles.flex1}>
                  <View style={styles.proofCheckRow}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                    <Text style={styles.proofName} numberOfLines={1}>{proof.name}</Text>
                  </View>
                  <Text style={styles.fieldSub}>Receipt photo attached. Tap to replace.</Text>
                </View>
              ) : (
                <View style={styles.flex1}>
                  <View style={styles.proofCheckRow}>
                    <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                    <Text style={styles.proofName}>Attach a photo of the payment proof</Text>
                  </View>
                  <Text style={styles.fieldSub}>Speeds up verification by our tellers.</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </AppCard>
          </TouchableOpacity>

          <AppTextInput
            label="Notes (Optional)"
            placeholder="Any remarks for the teller"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          <View style={styles.actions}>
            <AppButton
              title="Continue"
              onPress={() => {
                if (!validate()) return;
                setConfirmVisible(true);
              }}
              size="lg"
              icon={<Ionicons name="arrow-forward" size={18} color={colors.white} />}
            />
          </View>

          <Text style={styles.secureNote}>
            <Ionicons name="lock-closed" size={12} color={colors.green} /> Your payment details are encrypted. Verified payments update your loan balance within 24 hours.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <AppModal
        visible={loanPickerVisible}
        onClose={() => setLoanPickerVisible(false)}
        title="Select Loan"
        subtitle="Which loan are you paying?"
      >
        {loans.length === 0 ? (
          <Text style={styles.noLoans}>You have no active loans to pay right now.</Text>
        ) : (
          loans.map((l) => {
            const active = loan?.id === l.id;
            return (
              <TouchableOpacity
                key={l.id}
                style={[styles.loanOption, active && styles.loanOptionActive]}
                onPress={() => { setLoan(l); setLoanPickerVisible(false); setErrors((e) => ({ ...e, loan: '' })); }}
              >
                <View style={styles.flex1}>
                  <Text style={styles.loanOptionName}>{l.productName}</Text>
                  <Text style={styles.loanOptionSub}>{l.loanNumber} · Balance {formatCurrency(l.remainingBalance)}</Text>
                </View>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.textFaint} />
              </TouchableOpacity>
            );
          })
        )}
      </AppModal>

      <AppModal
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        title="Confirm Payment Submission"
        subtitle="Your payment will be verified by a teller before it is posted."
        icon="cash-outline"
        iconColor={colors.green}
        iconBg={colors.greenSoft}
        confirmText="Submit for Verification"
        onConfirm={submit}
        confirmLoading={submitting}
      >
        <View style={styles.confirmLine}>
          <Text style={styles.confirmKey}>Loan</Text>
          <Text style={styles.confirmVal}>{loan?.productName} · {loan?.loanNumber}</Text>
        </View>
        <View style={styles.confirmLine}>
          <Text style={styles.confirmKey}>Amount</Text>
          <Text style={styles.confirmValue}>{formatCurrency(Number(amount))}</Text>
        </View>
        <View style={styles.confirmLine}>
          <Text style={styles.confirmKey}>Method</Text>
          <Text style={styles.confirmVal}>{method.replace('_', ' ')}</Text>
        </View>
        <View style={styles.confirmLine}>
          <Text style={styles.confirmKey}>Reference</Text>
          <Text style={styles.confirmVal}>{referenceNumber}</Text>
        </View>
        {!proof ? (
          <Text style={styles.confirmWarn}>
            <Ionicons name="alert-circle" size={12} color={colors.warning} /> No proof attached — verification may take longer.
          </Text>
        ) : null}
      </AppModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  flex1: { flex: 1, marginRight: 10 },
  fieldLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldValue: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 2 },
  fieldPlaceholder: { color: colors.textMuted },
  fieldSub: { fontSize: 11, color: colors.textFaint, marginTop: 3 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  methodChip: {
    width: '48%',
    marginRight: '2%',
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: 12,
  },
  methodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodText: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 5, textTransform: 'uppercase' },
  methodTextActive: { color: colors.white },
  methodHint: { fontSize: 11, color: colors.textFaint, marginBottom: 8 },
  uploadCard: { borderStyle: 'dashed' },
  proofCheckRow: { flexDirection: 'row', alignItems: 'center' },
  proofName: { fontSize: 13, fontWeight: '700', color: colors.text, marginLeft: 8, flex: 1 },
  fieldError: { fontSize: 12, color: colors.danger, fontWeight: '600', marginTop: 6 },
  actions: { marginTop: 20 },
  secureNote: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 14, lineHeight: 16 },
  submitError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
  },
  submitErrorText: { flex: 1, marginLeft: 8, fontSize: 12, color: colors.danger, fontWeight: '600' },
  noLoans: { fontSize: 13, color: colors.textMuted, paddingVertical: 10 },
  loanOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  loanOptionActive: {},
  loanOptionName: { fontSize: 14, fontWeight: '800', color: colors.text },
  loanOptionSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  confirmLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  confirmKey: { fontSize: 13, color: colors.textMuted },
  confirmVal: { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'right', marginLeft: 12 },
  confirmValue: { fontSize: 14, fontWeight: '900', color: colors.primary },
  confirmWarn: { fontSize: 11, color: colors.warning, marginTop: 10, lineHeight: 16 },
});