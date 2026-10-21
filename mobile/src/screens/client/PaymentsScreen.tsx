import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppModal, AppTextInput, Badge, ErrorView, LoadingView, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { pickImage, type PickedImage } from '../../utils/pickImage';
import { api, fieldErrorsOf, messageOf } from '../../services/api';
import type { LoanSummaryView, ProofView } from '../../shared/client';
import { manilaToday } from '../../shared/client';
import { PAYMENT_METHOD_LABELS, validatePayment } from '../../shared/lending';
import { formatCurrency, formatDate } from '../../utils/format';
import { LoansStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<LoansStackParamList, 'Payments'>;

// Cash is paid at the branch counter; a proof is only for a transfer.
const METHODS: { key: 'BANK_TRANSFER' | 'E_WALLET'; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { key: 'E_WALLET', icon: 'phone-portrait-outline', hint: 'GCash, Maya or another e-wallet transfer' },
  { key: 'BANK_TRANSFER', icon: 'business-outline', hint: 'Bank transfer (InstaPay or PESONet)' },
];
const PROOF_LABEL: Record<string, string> = { PENDING_REVIEW: 'Waiting for verification', UNDER_REVIEW: 'Being checked', VERIFIED: 'Verified and posted', REJECTED: 'Not accepted' };

export const PaymentsScreen: React.FC<Props> = ({ navigation, route }) => {
  const selectedLoanId = route.params?.loanId;
  const [loans, setLoans] = useState<LoanSummaryView[]>([]);
  const [proofs, setProofs] = useState<Omit<ProofView, 'storageRef'>[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loan, setLoan] = useState<LoanSummaryView | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'BANK_TRANSFER' | 'E_WALLET'>('E_WALLET');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [proof, setProof] = useState<PickedImage | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loanPickerVisible, setLoanPickerVisible] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [res, sent] = await Promise.all([api.getLoans(), api.getPaymentProofs()]);
      setLoans(res.running);
      setProofs(sent);
      const preset = res.running.find((l) => l.id === selectedLoanId) ?? (res.running.length === 1 ? res.running[0] : null);
      if (preset) {
        setLoan(preset);
        if (preset.nextDue) setAmount(preset.nextDue.amount);
      }
    } catch (err) {
      setLoadError(messageOf(err, 'Your loans could not be loaded.'));
    } finally {
      setLoaded(true);
    }
  }, [selectedLoanId]);

  useEffect(() => {
    load();
  }, [load]);

  const pickProof = async () => {
    try {
      const picked = await pickImage('library');
      if (!picked) return;
      setErrors((e) => ({ ...e, fileBase64: '' }));
      setProof(picked);
    } catch (err) {
      setErrors((e) => ({ ...e, fileBase64: messageOf(err, 'The photo could not be attached.') }));
    }
  };

  // The same rules the server applies (shared/lending validatePayment).
  const validate = (): boolean => {
    const v = validatePayment({ amount, method, referenceNumber, paymentDate: manilaToday(), notes }, manilaToday(), 30);
    const e: Record<string, string> = { ...v.errors };
    if (!loan) e.loan = 'Choose the loan you paid.';
    if (!proof) e.fileBase64 = 'Attach a photo of the transfer receipt.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!loan || !proof) return;
    setSubmitting(true);
    try {
      const sent = await api.submitPaymentProof({
        loanId: loan.id,
        amount,
        method,
        referenceNumber: referenceNumber.trim(),
        paymentDate: manilaToday(),
        notes: notes.trim() || undefined,
        fileBase64: proof.dataUrl,
        fileName: proof.fileName,
      });
      setConfirmVisible(false);
      setProofs((p) => [sent, ...p]);
      setAmount('');
      setReferenceNumber('');
      setNotes('');
      setProof(null);
      setErrors({ done: `Sent. ${formatCurrency(sent.amount)} for ${loan.loanNumber} is waiting for the branch to verify it; your balance changes once it is posted.` });
    } catch (err) {
      setConfirmVisible(false);
      setErrors({ ...fieldErrorsOf(err), submit: messageOf(err, 'Your proof could not be sent. Please try again.') });
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="Send payment proof" /><LoadingView text="Loading your loans…" /></SafeAreaView>;
  if (loadError) return <SafeAreaView style={styles.safe}><ScreenHeader title="Send payment proof" /><ErrorView message={loadError} onRetry={load} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Send payment proof" subtitle="For a bank or e-wallet transfer you already made" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {errors.submit ? (
            <View style={styles.submitError}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.submitErrorText}>{errors.submit}</Text>
            </View>
          ) : null}
          {errors.done ? (
            <View style={[styles.submitError, { backgroundColor: colors.greenSoft }]}>
              <Ionicons name="checkmark-circle" size={15} color={colors.green} />
              <Text style={[styles.submitErrorText, { color: colors.greenDark }]}>{errors.done}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>1. Loan</Text>
          <TouchableOpacity onPress={() => setLoanPickerVisible(true)} activeOpacity={0.85} accessibilityLabel="Choose loan">
            <AppCard style={styles.fieldCard}>
              <View style={styles.flex1}>
                <Text style={styles.fieldLabel}>Loan</Text>
                <Text style={[styles.fieldValue, !loan && styles.fieldPlaceholder]}>{loan ? `${loan.productName} · ${loan.loanNumber}` : 'Tap to choose a loan'}</Text>
                {loan?.nextDue ? <Text style={styles.fieldSub}>Due {formatDate(loan.nextDue.dueDate)}: {formatCurrency(loan.nextDue.amount)}</Text> : null}
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.textFaint} />
            </AppCard>
          </TouchableOpacity>
          {errors.loan ? <Text style={styles.fieldError}>{errors.loan}</Text> : null}

          <Text style={styles.sectionLabel}>2. How you paid</Text>
          <View style={styles.methodRow}>
            {METHODS.map((m) => {
              const active = method === m.key;
              return (
                <TouchableOpacity key={m.key} style={[styles.methodChip, active && styles.methodChipActive]} onPress={() => setMethod(m.key)} activeOpacity={0.85} accessibilityLabel={PAYMENT_METHOD_LABELS[m.key]}>
                  <Ionicons name={m.icon} size={22} color={active ? colors.white : colors.textMuted} />
                  <Text style={[styles.methodText, active && styles.methodTextActive]}>{PAYMENT_METHOD_LABELS[m.key]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.methodHint}>{METHODS.find((m) => m.key === method)?.hint}. Cash is paid at the branch counter.</Text>
          {errors.method ? <Text style={styles.fieldError}>{errors.method}</Text> : null}

          <Text style={styles.sectionLabel}>3. Amount and reference</Text>
          <AppTextInput
            label="Amount you sent (₱)"
            placeholder="0.00"
            value={amount}
            onChangeText={(v) => { setAmount(v); setErrors((e) => ({ ...e, amount: '' })); }}
            keyboardType="decimal-pad"
            error={errors.amount}
          />
          <AppTextInput
            label="Transfer reference"
            placeholder="e.g. 1234 5678 9012"
            value={referenceNumber}
            onChangeText={(v) => { setReferenceNumber(v); setErrors((e) => ({ ...e, referenceNumber: '' })); }}
            error={errors.referenceNumber}
            hint="The reference shown by your bank or e-wallet."
          />

          <Text style={styles.sectionLabel}>4. Receipt</Text>
          <TouchableOpacity onPress={pickProof} activeOpacity={0.85} accessibilityLabel="Attach receipt">
            <AppCard style={{ ...styles.fieldCard, ...styles.uploadCard }}>
              <View style={styles.flex1}>
                <View style={styles.proofCheckRow}>
                  <Ionicons name={proof ? 'checkmark-circle' : 'cloud-upload-outline'} size={20} color={proof ? colors.green : colors.primary} />
                  <Text style={styles.proofName} numberOfLines={1}>{proof ? proof.fileName : 'Attach a photo or screenshot of the transfer'}</Text>
                </View>
                <Text style={styles.fieldSub}>{proof ? 'Tap to replace.' : 'JPEG, PNG or WebP, up to 10 MB.'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </AppCard>
          </TouchableOpacity>
          {errors.fileBase64 ? <Text style={styles.fieldError}>{errors.fileBase64}</Text> : null}

          <AppTextInput label="Notes (optional)" placeholder="Anything the teller should know" value={notes} onChangeText={setNotes} multiline numberOfLines={2} />

          <View style={styles.actions}>
            <AppButton title="Continue" onPress={() => validate() && setConfirmVisible(true)} size="lg" icon={<Ionicons name="arrow-forward" size={18} color={colors.white} />} />
          </View>

          {proofs.length ? (
            <>
              <Text style={styles.sectionLabel}>Proofs you sent</Text>
              {proofs.slice(0, 10).map((p) => (
                <AppCard key={p.id} style={styles.fieldCard}>
                  <View style={styles.flex1}>
                    <Text style={styles.fieldValue}>{formatCurrency(p.amount)} · {p.loanNumber}</Text>
                    <Text style={styles.fieldSub}>{formatDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.method as 'BANK_TRANSFER'] ?? p.method} · {p.referenceNumber}</Text>
                    {p.rejectionReason ? <Text style={styles.fieldError}>{p.rejectionReason}</Text> : null}
                  </View>
                  <Badge status={PROOF_LABEL[p.status] ?? p.status} />
                </AppCard>
              ))}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <AppModal visible={loanPickerVisible} onClose={() => setLoanPickerVisible(false)} title="Choose loan" subtitle="Which loan did you pay?">
        {loans.length === 0 ? (
          <Text style={styles.noLoans}>You have no running loans.</Text>
        ) : (
          loans.map((l) => {
            const active = loan?.id === l.id;
            return (
              <TouchableOpacity
                key={l.id}
                style={[styles.loanOption, active && styles.loanOptionActive]}
                onPress={() => {
                  setLoan(l);
                  if (l.nextDue && !amount) setAmount(l.nextDue.amount);
                  setLoanPickerVisible(false);
                  setErrors((e) => ({ ...e, loan: '' }));
                }}
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
        title="Send this proof?"
        subtitle="The branch checks it against their records before the payment is posted."
        icon="cash-outline"
        iconColor={colors.green}
        iconBg={colors.greenSoft}
        confirmText="Send"
        onConfirm={submit}
        confirmLoading={submitting}
      >
        <View style={styles.confirmLine}>
          <Text style={styles.confirmKey}>Loan</Text>
          <Text style={styles.confirmVal}>{loan?.productName} · {loan?.loanNumber}</Text>
        </View>
        <View style={styles.confirmLine}>
          <Text style={styles.confirmKey}>Amount</Text>
          <Text style={styles.confirmValue}>{formatCurrency(amount)}</Text>
        </View>
        <View style={styles.confirmLine}>
          <Text style={styles.confirmKey}>Method</Text>
          <Text style={styles.confirmVal}>{PAYMENT_METHOD_LABELS[method]}</Text>
        </View>
        <View style={styles.confirmLine}>
          <Text style={styles.confirmKey}>Reference</Text>
          <Text style={styles.confirmVal}>{referenceNumber}</Text>
        </View>
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