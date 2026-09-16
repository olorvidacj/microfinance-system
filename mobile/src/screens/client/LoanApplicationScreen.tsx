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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppModal, AppTextInput, LoadingView, ScreenHeader, WizardHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { LoanProduct, LoanCalculation } from '../../types';
import { formatCurrency } from '../../utils/format';
import { validators } from '../../utils/validation';
import { LoansStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<LoansStackParamList, 'LoanApplication'>;

const STEPS = [
  { title: 'Choose Product', subtitle: 'Select a loan product and amount' },
  { title: 'Term & Estimate', subtitle: 'Pick a term and see your estimate' },
  { title: 'Purpose & Guarantor', subtitle: 'Tell us why you need the loan' },
  { title: 'Repayment Plan', subtitle: 'Choose how you will repay' },
  { title: 'Review & Submit', subtitle: 'Confirm all details' },
];

const FREQUENCIES = ['MONTHLY', 'BI_MONTHLY', 'WEEKLY'];
const REPAYMENT_NOTES: Record<string, string> = {
  MONTHLY: 'Pay every month on your due date.',
  BI_MONTHLY: 'Pay twice a month — every 15 days.',
  WEEKLY: 'Pay every week on your assigned schedule.',
};

export const LoanApplicationScreen: React.FC<Props> = ({ navigation }) => {
  const [gateChecked, setGateChecked] = useState(false);
  const [kycBlocked, setKycBlocked] = useState(false);

  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [product, setProduct] = useState<LoanProduct | null>(null);
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState<number>(12);
  const [calc, setCalc] = useState<LoanCalculation | null>(null);
  const [purpose, setPurpose] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [collateral, setCollateral] = useState('');
  const [documentsSelected, setDocumentsSelected] = useState<string[]>([]);

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [done, setDone] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const LOAN_DOCS = [
    'Valid ID (Front)',
    'Proof of Billing / Address',
    'Proof of Income',
    'Photo 2×2',
  ];

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const kyc = await api.getKycStatus();
          if (!kyc.isVerified) {
            setKycBlocked(true);
            setGateChecked(true);
            return;
          }
        } catch {}
        try {
          const prods = await api.getLoanProducts();
          setProducts(prods);
          if (prods.length) setProduct(prods[0]);
        } catch {}
        setGateChecked(true);
      })();
    }, [])
  );

  const selectedTermOptions = product
    ? Array.from({ length: product.maxTermMonths - product.minTermMonths + 1 }, (_, i) => product.minTermMonths + i)
    : [];

  const recalc = async (amt: number, t: number, prod: LoanProduct) => {
    try {
      const res = await api.calculateLoan({
        amount: amt,
        termMonths: t,
        interestRatePerMonth: prod.interestRatePerMonth,
        interestType: prod.interestType,
      });
      setCalc(res);
    } catch {}
  };

  const selectProduct = (p: LoanProduct) => {
    setProduct(p);
    setAmount('');
    setCalc(null);
    setTerm(p.minTermMonths);
    setErrors({});
  };

  const handleAmountChange = (v: string) => {
    setAmount(v);
    setCalc(null);
    setErrors((e) => ({ ...e, amount: '' }));
    const amt = Number(v);
    if (product && amt >= product.minAmount && amt <= product.maxAmount) {
      recalc(amt, term, product);
    }
  };

  const handleTermChange = (t: number) => {
    setTerm(t);
    setCalc(null);
    const amt = Number(amount);
    if (product && amt >= product.minAmount && amt <= product.maxAmount) {
      recalc(amt, t, product);
    }
  };

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!product) e.product = 'Select a loan product.';
      const amt = Number(amount);
      if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid loan amount.';
      else if (product && amt < product.minAmount) e.amount = `Minimum amount is ${formatCurrency(product.minAmount)}.`;
      else if (product && amt > product.maxAmount) e.amount = `Maximum amount is ${formatCurrency(product.maxAmount)}.`;
    }
    if (s === 2) {
      if (!validators.required(purpose)) e.purpose = validators.required(purpose, 'Loan purpose') as string;
      if (!validators.required(guarantorName)) e.guarantorName = validators.required(guarantorName, 'Guarantor name') as string;
      if (guarantorPhone && validators.phonePolicy(guarantorPhone)) e.guarantorPhone = validators.phonePolicy(guarantorPhone) as string;
    }
    if (s === 3) {
      if (documentsSelected.length === 0) e.documents = 'Select at least one supporting document you can provide.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    if (step === 1) {
      // Recompute if stale
      const amt = Number(amount);
      if (product && !calc) recalc(amt, term, product);
    }
    setStep((s) => s + 1);
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  const toggleDoc = (doc: string) => {
    setDocumentsSelected((prev) =>
      prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc]
    );
    setErrors((e) => ({ ...e, documents: '' }));
  };

  const submit = async () => {
    if (!validate(3)) {
      setStep(3);
      return;
    }
    setSubmitting(true);
    try {
      if (product && !calc) await recalc(Number(amount), term, product);
      const res = await api.submitLoanApplication({
        productId: product!.id,
        productName: product!.name,
        amount: Number(amount),
        termMonths: term,
        repaymentFrequency: frequency,
        purpose,
        guarantorName,
        guarantorPhone: guarantorPhone || undefined,
        collateralDescription: collateral || undefined,
        documents: documentsSelected,
      });
      setSuccessMsg(res.message || 'Your loan application has been submitted.');
      setDone(true);
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
      setConfirmVisible(false);
    }
  };

  if (!gateChecked) {
    return <SafeAreaView style={styles.safe}><ScreenHeader title="Apply for a Loan" /><LoadingView /></SafeAreaView>;
  }

  if (kycBlocked) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Apply for a Loan" />
        <View style={styles.blockedWrap}>
          <View style={styles.blockedIcon}>
            <Ionicons name="shield-checkmark-outline" size={34} color={colors.textFaint} />
          </View>
          <Text style={styles.blockedTitle}>KYC Verification Required</Text>
          <Text style={styles.blockedMsg}>
            Complete your KYC verification before applying for a loan. This helps HOSCOMO serve you faster and keeps your account secure.
          </Text>
          <View style={styles.blockedActions}>
            <AppButton
              title="Complete KYC Verification"
              onPress={() => (navigation.getParent() as any)?.navigate('HomeTab', { screen: 'KycStatus' })}
            />
            <TouchableOpacity style={styles.blockedCancel} onPress={() => navigation.goBack()}>
              <Text style={styles.blockedCancelText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.blockedWrap}>
          <View style={[styles.blockedIcon, { backgroundColor: colors.greenSoft }]}>
            <Ionicons name="checkmark" size={34} color={colors.green} />
          </View>
          <Text style={styles.blockedTitle}>Application Submitted</Text>
          <Text style={styles.blockedMsg}>{successMsg}</Text>
          <AppCard style={styles.recapCard}>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Product</Text>
              <Text style={styles.recapValue}>{product?.name}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Amount</Text>
              <Text style={styles.recapValue}>{formatCurrency(Number(amount))}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Term</Text>
              <Text style={styles.recapValue}>{term} months</Text>
            </View>
          </AppCard>
          <View style={styles.blockedActions}>
            <AppButton title="Track Application" variant="secondary" onPress={() => navigation.popToTop()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Apply for a Loan" subtitle="Application wizard" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <WizardHeader steps={STEPS} current={step} />

          {errors.submit ? (
            <View style={styles.submitError}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.submitErrorText}>{errors.submit}</Text>
            </View>
          ) : null}

          {step === 0 && (
            <View>
              <Text style={styles.sectionLabel}>Loan Product</Text>
              {products.map((p) => {
                const active = product?.id === p.id;
                return (
                  <TouchableOpacity key={p.id} onPress={() => selectProduct(p)} activeOpacity={0.85}>
                    <AppCard style={active ? { ...styles.productCard, ...styles.productCardActive } : styles.productCard} padded={false}>
                      <View style={styles.productBody}>
                        <View style={styles.flex1}>
                          <Text style={styles.productName}>{p.name}</Text>
                          <Text style={styles.productDesc} numberOfLines={2}>{p.description}</Text>
                          <Text style={styles.productRange}>
                            {formatCurrency(p.minAmount)} – {formatCurrency(p.maxAmount)} · {p.interestRatePerMonth}%/mo
                          </Text>
                        </View>
                        <Ionicons
                          name={active ? 'radio-button-on' : 'radio-button-off'}
                          size={22}
                          color={active ? colors.primary : colors.textFaint}
                        />
                      </View>
                    </AppCard>
                  </TouchableOpacity>
                );
              })}
              {errors.product ? <Text style={styles.fieldError}>{errors.product}</Text> : null}

              {product ? (
                <>
                  <Text style={styles.sectionLabel}>Loan Amount (₱)</Text>
                  <AppTextInput
                    label={`Amount (${formatCurrency(product.minAmount)} – ${formatCurrency(product.maxAmount)})`}
                    placeholder="e.g. 30000"
                    value={amount}
                    onChangeText={handleAmountChange}
                    keyboardType="numeric"
                    error={errors.amount}
                  />
                  {calc ? (
                    <View style={styles.calcCard}>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Estimated monthly</Text>
                        <Text style={styles.calcValue}>{formatCurrency(calc.estimatedMonthlyPayment)}</Text>
                      </View>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Total interest</Text>
                        <Text style={styles.calcValue}>{formatCurrency(calc.estimatedTotalInterest)}</Text>
                      </View>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Processing fee</Text>
                        <Text style={styles.calcValue}>{formatCurrency(calc.processingFee)}</Text>
                      </View>
                      <View style={styles.calcDivider} />
                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabelStrong}>Total repayable</Text>
                        <Text style={styles.calcValueStrong}>{formatCurrency(calc.totalRepayable)}</Text>
                      </View>
                      <Text style={styles.calcNote}>Estimated net proceeds: {formatCurrency(calc.estimatedNetProceeds)} after fees.</Text>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.sectionLabel}>Loan Term (months)</Text>
              <View style={styles.termGrid}>
                {selectedTermOptions.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.termChip, term === t && styles.termChipActive]}
                    onPress={() => handleTermChange(t)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.termValue, term === t && styles.termValueActive]}>{t}</Text>
                    <Text style={[styles.termLabel, term === t && styles.termLabelActive]}>{t === 1 ? 'month' : 'months'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {calc ? (
                <AppCard>
                  <Text style={styles.calcTitle}>Loan Estimate</Text>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Principal</Text>
                    <Text style={styles.calcValue}>{formatCurrency(calc.principal)}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Monthly payment</Text>
                    <Text style={styles.calcValue}>{formatCurrency(calc.estimatedMonthlyPayment)}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Total interest</Text>
                    <Text style={styles.calcValue}>{formatCurrency(calc.estimatedTotalInterest)}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Processing fee (2%)</Text>
                    <Text style={styles.calcValue}>{formatCurrency(calc.processingFee)}</Text>
                  </View>
                  <View style={styles.calcDivider} />
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabelStrong}>Total repayable</Text>
                    <Text style={styles.calcValueStrong}>{formatCurrency(calc.totalRepayable)}</Text>
                  </View>
                </AppCard>
              ) : (
                <AppCard>
                  <Text style={styles.calcNote}>
                    {amount && Number(amount) >= (product?.minAmount ?? 0)
                      ? 'Estimate will appear here. Tap Continue to refresh the computation.'
                      : 'Enter a valid amount on the previous step to see your loan estimate.'}
                  </Text>
                </AppCard>
              )}
            </View>
          )}

          {step === 2 && (
            <View>
              <AppTextInput
                label="Loan Purpose *"
                placeholder="e.g. Working capital for my store, home repair, school fees"
                value={purpose}
                onChangeText={(v) => { setPurpose(v); setErrors((e) => ({ ...e, purpose: '' })); }}
                multiline
                numberOfLines={3}
                error={errors.purpose}
              />
              <Text style={styles.sectionLabel}>Guarantor</Text>
              <AppTextInput
                label="Guarantor Name *"
                placeholder="Full name of your co-borrower / guarantor"
                value={guarantorName}
                onChangeText={(v) => { setGuarantorName(v); setErrors((e) => ({ ...e, guarantorName: '' })); }}
                error={errors.guarantorName}
              />
              <AppTextInput
                label="Guarantor Mobile"
                placeholder="e.g. 0917 555 1234"
                value={guarantorPhone}
                onChangeText={(v) => { setGuarantorPhone(v); setErrors((e) => ({ ...e, guarantorPhone: '' })); }}
                keyboardType="phone-pad"
                error={errors.guarantorPhone}
              />
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.sectionLabel}>Repayment Frequency</Text>
              <View style={styles.freqRow}>
                {FREQUENCIES.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.freqChip, frequency === f && styles.freqChipActive]}
                    onPress={() => setFrequency(f)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.freqText, frequency === f && styles.freqTextActive]}>
                      {f.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.freqNote}>{REPAYMENT_NOTES[frequency]}</Text>

              <Text style={styles.sectionLabel}>Collateral (Optional)</Text>
              <AppTextInput
                label="Collateral / Property Description"
                placeholder="e.g. Family-owned residential lot in Palo, Leyte"
                value={collateral}
                onChangeText={setCollateral}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.sectionLabel}>Supporting Documents</Text>
              <AppCard padded={false}>
                {LOAN_DOCS.map((doc, i) => {
                  const active = documentsSelected.includes(doc);
                  return (
                    <TouchableOpacity
                      key={doc}
                      style={[styles.docRow, i < LOAN_DOCS.length - 1 && styles.docRowBorder]}
                      onPress={() => toggleDoc(doc)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={active ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={active ? colors.primary : colors.textFaint}
                      />
                      <Text style={[styles.docText, active && styles.docTextActive]}>{doc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </AppCard>
              {errors.documents ? <Text style={styles.fieldError}>{errors.documents}</Text> : null}
            </View>
          )}

          {step === 4 && (
            <View>
              <AppCard style={{ marginBottom: 12 }}>
                <Text style={styles.reviewTitle}>{product?.name}</Text>
                <View style={styles.reviewAmtRow}>
                  <View>
                    <Text style={styles.reviewAmtLabel}>REQUESTED AMOUNT</Text>
                    <Text style={styles.reviewAmt}>{formatCurrency(Number(amount))}</Text>
                  </View>
                  <View style={styles.reviewRight}>
                    <Text style={styles.reviewAmtLabel}>TERM</Text>
                    <Text style={styles.reviewAmt}>{term} mo</Text>
                  </View>
                </View>
                {calc ? (
                  <View style={styles.reviewCalcRow}>
                    <Text style={styles.reviewCalcItem}>Est. {formatCurrency(calc.estimatedMonthlyPayment)}/mo</Text>
                    <Text style={styles.reviewCalcItem}>Total {formatCurrency(calc.totalRepayable)}</Text>
                    <Text style={styles.reviewCalcItem}>Fee {formatCurrency(calc.processingFee)}</Text>
                  </View>
                ) : null}
              </AppCard>
              <AppCard style={{ marginBottom: 12 }}>
                <View style={styles.reviewLine}>
                  <Text style={styles.reviewKey}>Purpose</Text>
                  <Text style={styles.reviewVal}>{purpose}</Text>
                </View>
                <View style={styles.reviewLine}>
                  <Text style={styles.reviewKey}>Frequency</Text>
                  <Text style={styles.reviewVal}>{frequency.replace('_', ' ')}</Text>
                </View>
                <View style={styles.reviewLine}>
                  <Text style={styles.reviewKey}>Guarantor</Text>
                  <Text style={styles.reviewVal}>{guarantorName}{guarantorPhone ? ` · ${guarantorPhone}` : ''}</Text>
                </View>
                {collateral ? (
                  <View style={styles.reviewLine}>
                    <Text style={styles.reviewKey}>Collateral</Text>
                    <Text style={styles.reviewVal}>{collateral}</Text>
                  </View>
                ) : null}
              </AppCard>
              <AppCard style={{ marginBottom: 8 }}>
                <Text style={styles.reviewKey}>Documents you will provide</Text>
                <View style={styles.docPills}>
                  {documentsSelected.map((d) => (
                    <View key={d} style={styles.docPill}>
                      <Text style={styles.docPillText}>{d}</Text>
                    </View>
                  ))}
                </View>
              </AppCard>
              <View style={styles.consentRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.teal} />
                <Text style={styles.consentText}>
                  I declare that the information provided is true and correct, and I agree to the loan terms and conditions of HOSCOMO Microfinance Cooperative.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backStepBtn} onPress={step === 0 ? () => navigation.goBack() : back}>
              <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
              <Text style={styles.backStepText}>{step === 0 ? 'Cancel' : 'Back'}</Text>
            </TouchableOpacity>
            {step < 4 ? (
              <View style={styles.flex1}>
                <AppButton title="Continue" onPress={next} />
              </View>
            ) : (
              <View style={styles.flex1}>
                <AppButton
                  title="Submit Application"
                  loading={submitting}
                  onPress={() => setConfirmVisible(true)}
                  icon={<Ionicons name="paper-plane-outline" size={18} color={colors.white} />}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AppModal
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        title={`Apply for ${product?.name ?? 'Loan'}?`}
        subtitle="Our Credit Committee will review your application once submitted."
        icon="document-text-outline"
        iconColor={colors.teal}
        iconBg={colors.tealSoft}
        confirmText="Submit Application"
        onConfirm={submit}
        confirmLoading={submitting}
      >
        <View style={styles.confirmLine}>
          <Text style={styles.confirmKey}>Amount</Text>
          <Text style={styles.confirmVal}>{formatCurrency(Number(amount))}</Text>
        </View>
        <View style={styles.confirmLine}>
          <Text style={styles.confirmKey}>Term</Text>
          <Text style={styles.confirmVal}>{term} months</Text>
        </View>
        {calc ? (
          <View style={styles.confirmLine}>
            <Text style={styles.confirmKey}>Est. monthly</Text>
            <Text style={styles.confirmVal}>{formatCurrency(calc.estimatedMonthlyPayment)}</Text>
          </View>
        ) : null}
        <Text style={styles.confirmMsg}>You can track this application on the Loans page.</Text>
      </AppModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 8,
  },
  productCard: { marginBottom: 10 },
  productCardActive: { borderColor: colors.primary, borderWidth: 1.5 },
  productBody: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  flex1: { flex: 1, marginRight: 10 },
  productName: { fontSize: 15, fontWeight: '800', color: colors.text },
  productDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  productRange: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 6 },
  fieldError: { fontSize: 12, color: colors.danger, fontWeight: '600', marginTop: 6 },
  calcCard: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 6,
  },
  calcTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 8 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  calcLabel: { fontSize: 12, color: colors.textMuted },
  calcValue: { fontSize: 12, fontWeight: '700', color: colors.text },
  calcLabelStrong: { fontSize: 13, fontWeight: '800', color: colors.text },
  calcValueStrong: { fontSize: 14, fontWeight: '900', color: colors.primary },
  calcDivider: { height: 1, backgroundColor: colors.primaryBorder, marginVertical: 8 },
  calcNote: { fontSize: 11, color: colors.textFaint, marginTop: 8, lineHeight: 16 },
  termGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  termChip: {
    width: 72,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  termChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  termValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  termValueActive: { color: colors.white },
  termLabel: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  termLabelActive: { color: 'rgba(255,255,255,0.8)' },
  freqRow: { flexDirection: 'row', marginBottom: 6 },
  freqChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    marginRight: 8,
  },
  freqChipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  freqText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  freqTextActive: { color: colors.white },
  freqNote: { fontSize: 11, color: colors.textFaint, marginBottom: 10 },
  docRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  docRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  docText: { fontSize: 13, color: colors.textSecondary, marginLeft: 10 },
  docTextActive: { color: colors.text, fontWeight: '700' },
  reviewTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  reviewAmtRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  reviewAmtLabel: { fontSize: 10, fontWeight: '700', color: colors.textFaint, letterSpacing: 0.5 },
  reviewAmt: { fontSize: 20, fontWeight: '900', color: colors.primary, marginTop: 2 },
  reviewRight: { alignItems: 'flex-end' },
  reviewCalcRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  reviewCalcItem: {
    backgroundColor: colors.background,
    borderRadius: radius.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginRight: 6,
    marginTop: 4,
  },
  reviewLine: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reviewKey: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  reviewVal: { fontSize: 13, color: colors.text, marginTop: 3, lineHeight: 18 },
  docPills: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  docPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  docPillText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4, paddingVertical: 8 },
  consentText: { flex: 1, fontSize: 11, color: colors.textMuted, marginLeft: 8, lineHeight: 16 },
  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  backStepBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 12, marginRight: 8 },
  backStepText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
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
  confirmLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  confirmKey: { fontSize: 13, color: colors.textMuted },
  confirmVal: { fontSize: 13, fontWeight: '800', color: colors.text },
  confirmMsg: { fontSize: 12, color: colors.textFaint, marginTop: 10, lineHeight: 18 },
  blockedWrap: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  blockedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  blockedTitle: { fontSize: 19, fontWeight: '800', color: colors.text, textAlign: 'center' },
  blockedMsg: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  blockedActions: { alignSelf: 'stretch', marginTop: 22 },
  blockedCancel: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  blockedCancelText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  recapCard: { alignSelf: 'stretch', marginTop: 18 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  recapLabel: { fontSize: 12, color: colors.textMuted },
  recapValue: { fontSize: 12, fontWeight: '800', color: colors.text },
});