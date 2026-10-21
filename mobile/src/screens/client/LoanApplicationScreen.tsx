import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppModal, AppTextInput, ErrorView, InfoRow, LoadingView, ScreenHeader, WizardHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api, fieldErrorsOf, messageOf, newIdempotencyKey } from '../../services/api';
import { manilaToday } from '../../shared/client';
import type { LoanDetailView } from '../../shared/client';
import { isKycVerified } from '../../shared/kyc';
import {
  FREQUENCY_LABELS,
  INTEREST_METHOD_LABELS,
  LOAN_PURPOSES,
  LOAN_PURPOSE_LABELS,
  centsToDecimal,
  formatPercent,
  parsePesos,
  productFromDto,
  quoteProduct,
  validateApplicationTerms,
  type LoanProduct,
  type LoanPurpose,
} from '../../shared/lending';
import { formatCurrency, formatDate } from '../../utils/format';
import type { ClientTabParamList, LoansStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<LoansStackParamList, 'LoanApplication'>;

const STEPS = [
  { title: 'Product', subtitle: 'Choose a loan product' },
  { title: 'Amount & term', subtitle: 'See what you would pay' },
  { title: 'Purpose', subtitle: 'What the loan is for' },
  { title: 'Review', subtitle: 'Check and submit' },
];

/**
 * Loan application, the same rules as the web portal: shared validation
 * (validateApplicationTerms) and the shared calculator (quoteProduct), so the
 * estimate here is what the server will quote. Submitting sends an
 * idempotency key, so a retry cannot file two applications.
 */
export const LoanApplicationScreen: React.FC<Props> = ({ navigation }) => {
  const [state, setState] = useState<'loading' | 'blocked' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [product, setProduct] = useState<LoanProduct | null>(null);
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState(0);
  const [purpose, setPurpose] = useState<LoanPurpose>('BUSINESS');
  const [explanation, setExplanation] = useState('');
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [requestKey, setRequestKey] = useState(newIdempotencyKey);
  const [filed, setFiled] = useState<LoanDetailView | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const kyc = await api.getKycStatus();
      if (!isKycVerified(kyc.kycStatus)) {
        setState('blocked');
        return;
      }
      const list = (await api.getLoanProducts()).map(productFromDto).filter((p) => p.status === 'ACTIVE');
      setProducts(list);
      setState('ready');
    } catch (err) {
      setLoadError(messageOf(err, 'Loan products could not be loaded.'));
      setState('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!filed) load();
    }, [load, filed]),
  );

  const purposeDetails: Record<string, string> = purpose === 'OTHER' ? { explanation } : {};
  const input = { amount, termMonths: String(term), purpose, purposeDetails };
  const check = useMemo(() => validateApplicationTerms(product, input), [product, amount, term, purpose, explanation]); // eslint-disable-line react-hooks/exhaustive-deps

  // The estimate the server will also produce (shared calculator).
  const quote = useMemo(() => {
    const principal = parsePesos(amount);
    if (!product || principal === null || term < product.minTermMonths || term > product.maxTermMonths || principal < product.minAmount || principal > product.maxAmount) return null;
    try {
      return quoteProduct(product, principal, term, manilaToday());
    } catch {
      return null;
    }
  }, [product, amount, term]);

  const choose = (p: LoanProduct) => {
    setProduct(p);
    setTerm(p.minTermMonths);
    setAmount('');
    setErrors({});
  };

  const stepErrors = (s: number): Record<string, string> => {
    const e = check.errors as Record<string, string>;
    if (s === 0) return e.product ? { product: e.product } : {};
    if (s === 1) return Object.fromEntries(Object.entries(e).filter(([k]) => k === 'amount' || k === 'termMonths'));
    if (s === 2) return Object.fromEntries(Object.entries(e).filter(([k]) => k === 'purpose' || k === 'purposeDetails'));
    return e;
  };

  const next = () => {
    const e = stepErrors(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else setConfirmVisible(true);
  };

  const submit = async () => {
    if (!product) return;
    setSubmitting(true);
    try {
      const { application } = await api.applyForLoan({ productId: product.id, amount, termMonths: String(term), purpose, purposeDetails: input.purposeDetails }, requestKey);
      setFiled(application);
    } catch (err) {
      setErrors({ ...fieldErrorsOf(err), submit: messageOf(err, 'Your application could not be filed. Please try again.') });
      // A refusal (not a lost connection) means the next attempt is a new application.
      if ((err as { status?: number }).status) setRequestKey(newIdempotencyKey());
    } finally {
      setSubmitting(false);
      setConfirmVisible(false);
    }
  };

  const header = <ScreenHeader title="Apply for a loan" />;
  if (state === 'loading') return <SafeAreaView style={styles.safe}>{header}<LoadingView text="Loading loan products…" /></SafeAreaView>;
  if (state === 'error') return <SafeAreaView style={styles.safe}>{header}<ErrorView message={loadError} onRetry={load} /></SafeAreaView>;
  if (state === 'blocked') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.centerWrap}>
          <Ionicons name="shield-checkmark-outline" size={36} color={colors.textFaint} />
          <Text style={styles.centerTitle}>KYC verification required</Text>
          <Text style={styles.centerMsg}>Complete your KYC verification before applying for a loan.</Text>
          <AppButton title="Go to KYC" onPress={() => navigation.getParent<NavigationProp<ClientTabParamList>>()?.navigate('HomeTab', { screen: 'KycStatus' })} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }
  if (filed) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.centerWrap}>
          <Ionicons name="checkmark-circle" size={48} color={colors.green} />
          <Text style={styles.centerTitle}>Application filed</Text>
          <Text style={styles.centerMsg}>
            {filed.loanNumber}: {formatCurrency(filed.principal)} over {filed.termMonths} months is {filed.status.toLowerCase()}. You will be notified of the decision.
          </Text>
          <AppButton title="View application" onPress={() => navigation.replace('LoanDetail', { loanId: filed.id })} style={{ marginTop: 16 }} />
          <AppButton title="Back to loans" variant="outline" onPress={() => navigation.navigate('LoansList')} style={{ marginTop: 10 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}
      <WizardHeader steps={STEPS} current={step} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {errors.submit ? <Text style={styles.submitError}>{errors.submit}</Text> : null}

          {step === 0 && (
            <>
              {products.length === 0 ? <Text style={styles.centerMsg}>No loan products are open for applications right now.</Text> : null}
              {products.map((p) => {
                const active = product?.id === p.id;
                return (
                  <TouchableOpacity key={p.id} onPress={() => choose(p)} activeOpacity={0.85} accessibilityLabel={p.name}>
                    <AppCard style={active ? { ...styles.productCard, ...styles.productCardActive } : styles.productCard}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.productName}>{p.name}</Text>
                        <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.textFaint} />
                      </View>
                      <Text style={styles.productSub}>
                        {formatCurrency(centsToDecimal(p.minAmount))}–{formatCurrency(centsToDecimal(p.maxAmount))} · {p.minTermMonths}–{p.maxTermMonths} months
                      </Text>
                      <Text style={styles.productSub}>
                        {formatPercent(p.annualRate)} a year ({INTEREST_METHOD_LABELS[p.interestMethod].toLowerCase()}) · {FREQUENCY_LABELS[p.frequency].toLowerCase()}
                      </Text>
                      {p.lendingType === 'GROUP' ? <Text style={styles.productNote}>Group loan: your group's members must consent.</Text> : null}
                    </AppCard>
                  </TouchableOpacity>
                );
              })}
              {errors.product ? <Text style={styles.fieldError}>{errors.product}</Text> : null}
            </>
          )}

          {step === 1 && product && (
            <>
              <AppTextInput
                label="Amount (₱)"
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(v) => { setAmount(v); setErrors((e) => ({ ...e, amount: '' })); }}
                error={errors.amount}
                hint={`${formatCurrency(centsToDecimal(product.minAmount))} to ${formatCurrency(centsToDecimal(product.maxAmount))}`}
              />
              <Text style={styles.label}>Term</Text>
              <View style={styles.chips}>
                {Array.from({ length: product.maxTermMonths - product.minTermMonths + 1 }, (_, i) => product.minTermMonths + i).map((t) => (
                  <TouchableOpacity key={t} onPress={() => setTerm(t)} style={[styles.chip, term === t && styles.chipActive]} accessibilityLabel={`${t} months`}>
                    <Text style={[styles.chipText, term === t && styles.chipTextActive]}>{t} mo</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.termMonths ? <Text style={styles.fieldError}>{errors.termMonths}</Text> : null}
              {quote ? (
                <AppCard style={styles.estimate}>
                  <Text style={styles.estimateTitle}>Estimate</Text>
                  <InfoRow label={`${FREQUENCY_LABELS[quote.frequency]} installment`} value={formatCurrency(centsToDecimal(quote.installmentAmount))} strong />
                  <InfoRow label="Installments" value={String(quote.installments)} />
                  <InfoRow label="Total interest" value={formatCurrency(centsToDecimal(quote.totalInterest))} />
                  <InfoRow label="Fees" value={formatCurrency(centsToDecimal(quote.totalFees))} />
                  <InfoRow label="You receive" value={formatCurrency(centsToDecimal(quote.netProceeds))} />
                  <InfoRow label="Total to repay" value={formatCurrency(centsToDecimal(quote.totalPayable))} last />
                </AppCard>
              ) : (
                <Text style={styles.hint}>Enter an amount within the limits to see your estimate.</Text>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {LOAN_PURPOSES.map((p) => (
                <TouchableOpacity key={p} onPress={() => setPurpose(p)} style={[styles.purpose, purpose === p && styles.purposeActive]} accessibilityLabel={LOAN_PURPOSE_LABELS[p]}>
                  <Ionicons name={purpose === p ? 'radio-button-on' : 'radio-button-off'} size={18} color={purpose === p ? colors.primary : colors.textFaint} />
                  <Text style={styles.purposeText}>{LOAN_PURPOSE_LABELS[p]}</Text>
                </TouchableOpacity>
              ))}
              {purpose === 'OTHER' ? (
                <AppTextInput label="What is it for?" value={explanation} onChangeText={setExplanation} multiline numberOfLines={3} error={errors.purposeDetails} />
              ) : null}
              {errors.purpose ? <Text style={styles.fieldError}>{errors.purpose}</Text> : null}
            </>
          )}

          {step === 3 && product && quote && (
            <AppCard>
              <InfoRow label="Product" value={product.name} />
              <InfoRow label="Amount" value={formatCurrency(amount)} strong />
              <InfoRow label="Term" value={`${term} months`} />
              <InfoRow label="Purpose" value={purpose === 'OTHER' ? explanation : LOAN_PURPOSE_LABELS[purpose]} />
              <InfoRow label={`${FREQUENCY_LABELS[quote.frequency]} installment`} value={formatCurrency(centsToDecimal(quote.installmentAmount))} />
              <InfoRow label="First due (if released today)" value={formatDate(quote.firstDueDate)} />
              <InfoRow label="You receive" value={formatCurrency(centsToDecimal(quote.netProceeds))} />
              <InfoRow label="Total to repay" value={formatCurrency(centsToDecimal(quote.totalPayable))} last />
            </AppCard>
          )}

          <View style={styles.actions}>
            {step > 0 ? <AppButton title="Back" variant="outline" onPress={() => { setErrors({}); setStep(step - 1); }} style={styles.half} /> : null}
            <AppButton title={step === STEPS.length - 1 ? 'Submit application' : 'Continue'} onPress={next} style={step > 0 ? styles.half : undefined} disabled={step === 0 && !product} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AppModal
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        title="Submit this application?"
        subtitle="The branch reviews it and you are notified of the decision."
        confirmText="Submit"
        onConfirm={submit}
        confirmLoading={submitting}
      >
        <Text style={styles.hint}>{product?.name} · {formatCurrency(amount)} over {term} months.</Text>
      </AppModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 12, textAlign: 'center' },
  centerMsg: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  submitError: { backgroundColor: colors.dangerSoft, color: colors.danger, padding: 10, borderRadius: radius.md, marginBottom: 12, fontSize: 13 },
  productCard: { marginBottom: 10 },
  productCardActive: { borderColor: colors.primary, borderWidth: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontSize: 15, fontWeight: '800', color: colors.text, flex: 1, marginRight: 8 },
  productSub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  productNote: { fontSize: 11, color: colors.warning, marginTop: 6, fontWeight: '600' },
  fieldError: { fontSize: 12, color: colors.danger, marginTop: 4, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 8, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.round, borderWidth: 1, borderColor: colors.border, marginRight: 8, marginBottom: 8, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  estimate: { marginTop: 12 },
  estimateTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 10, lineHeight: 18 },
  purpose: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 8 },
  purposeActive: { borderColor: colors.primary },
  purposeText: { fontSize: 14, color: colors.text, marginLeft: 10, flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  half: { flex: 1, marginHorizontal: 4 },
});
