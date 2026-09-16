import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton, AppTextInput, WizardHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { validators } from '../../utils/validation';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const STEPS = [
  { title: 'Personal Information', subtitle: 'Legal name and basic details' },
  { title: 'Contact Information', subtitle: 'How we reach you' },
  { title: 'Address', subtitle: 'Where you live in the Philippines' },
  { title: 'Employment / Income', subtitle: 'Your source of livelihood' },
  { title: 'Account Credentials', subtitle: 'Secure your account' },
];

const GENDERS = ['Female', 'Male', 'Prefer not to say'];
const CIVIL_STATUS = ['Single', 'Married', 'Widowed', 'Separated'];
const INCOME_SOURCES = [
  'Business / Self-Employment',
  'Salary / Employment',
  'Agriculture / Farming',
  'Family Support',
  'Pension / Remittances',
  'Other',
];

interface StepData {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  civilStatus: string;
  phone: string;
  email: string;
  barangay: string;
  city: string;
  province: string;
  address: string;
  occupation: string;
  monthlyIncome: string;
  sourceOfIncome: string;
  password: string;
  confirmPassword: string;
  agreed: boolean;
}

const initialData: StepData = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  civilStatus: '',
  phone: '',
  email: '',
  barangay: '',
  city: '',
  province: '',
  address: '',
  occupation: '',
  monthlyIncome: '',
  sourceOfIncome: '',
  password: '',
  confirmPassword: '',
  agreed: false,
};

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<StepData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const set = (key: keyof StepData, value: any) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!validators.required(data.firstName)) e.firstName = validators.required(data.firstName) as string;
      if (!validators.required(data.lastName)) e.lastName = validators.required(data.lastName) as string;
      const dob = validators.dateOfBirth(data.dateOfBirth);
      if (dob) e.dateOfBirth = dob;
      if (!data.gender) e.gender = 'Select your gender.';
      if (!data.civilStatus) e.civilStatus = 'Select your civil status.';
    }
    if (s === 1) {
      const ph = validators.phonePolicy(data.phone);
      if (ph) e.phone = ph;
      if (data.email) {
        const em = validators.email(data.email);
        if (em) e.email = em;
      }
    }
    if (s === 2) {
      if (!validators.required(data.barangay)) e.barangay = validators.required(data.barangay, 'Barangay') as string;
      if (!validators.required(data.city)) e.city = validators.required(data.city, 'Municipality / City') as string;
      if (!validators.required(data.province)) e.province = validators.required(data.province, 'Province') as string;
      if (!validators.required(data.address)) e.address = validators.required(data.address, 'Complete address') as string;
    }
    if (s === 3) {
      if (!validators.required(data.occupation)) e.occupation = validators.required(data.occupation, 'Occupation') as string;
      const inc = validators.amount(data.monthlyIncome);
      if (inc) e.monthlyIncome = inc;
      if (!data.sourceOfIncome) e.sourceOfIncome = 'Select your source of income.';
    }
    if (s === 4) {
      const pw = validators.password(data.password);
      const cf = validators.confirmPassword(data.confirmPassword, data.password);
      if (pw) e.password = pw;
      if (cf) e.confirmPassword = cf;
      if (!data.agreed) e.agreed = 'You must accept the terms, data privacy notice, and consent.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep((s) => s + 1);
  };

  const backStep = () => {
    if (step === 0) navigation.goBack();
    else setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;
    setSubmitting(true);
    try {
      const res = await api.register({
        phone: data.phone,
        password: data.password,
        fullName: `${data.firstName} ${data.middleName ? data.middleName.trim() + ' ' : ''}${data.lastName}`.trim(),
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email: data.email || undefined,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        civilStatus: data.civilStatus,
        address: data.address,
        barangay: data.barangay,
        city: data.city,
        province: data.province,
        occupation: data.occupation,
        employerOrBusiness: data.sourceOfIncome,
        sourceOfIncome: data.sourceOfIncome,
        monthlyIncome: Number(data.monthlyIncome) || 0,
      });
      const session = {
        token: res.token,
        user: res.user,
      };
      await signIn(session);
      setSuccessMessage(
        'Your account has been created. Please complete your KYC verification before applying for a loan.'
      );
      setRegistered(true);
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Registration failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const ChipGroup = ({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) => (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.8}
          >
            <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={active ? colors.white : colors.textFaint} />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (registered) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={34} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>Account Created</Text>
          <Text style={styles.successMsg}>{successMessage}</Text>
          <View style={styles.successHint}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.teal} />
            <Text style={styles.successHintText}>
              KYC verification is done by authorized branch personnel. You will be notified when your documents are approved.
            </Text>
          </View>
          <View style={styles.successAction}>
            <AppButton title="Go to My Dashboard" onPress={() => {}} />
            <TouchableOpacity style={styles.successLink} onPress={() => navigation.popToTop()}>
              <Text style={styles.successLinkText}>Sign back out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={backStep} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Register as Client</Text>
            <View style={{ width: 28 }} />
          </View>

          <WizardHeader steps={STEPS} current={step} />

          {errors.submit ? (
            <View style={styles.submitError}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.submitErrorText}>{errors.submit}</Text>
            </View>
          ) : null}

          {step === 0 && (
            <View>
              <AppTextInput label="First Name *" placeholder="e.g. Teresa" value={data.firstName} onChangeText={(v) => set('firstName', v)} error={errors.firstName} />
              <AppTextInput label="Middle Name" placeholder="e.g. Reyes (optional)" value={data.middleName} onChangeText={(v) => set('middleName', v)} error={errors.middleName} />
              <AppTextInput label="Last Name *" placeholder="e.g. Alcantara" value={data.lastName} onChangeText={(v) => set('lastName', v)} error={errors.lastName} />
              <AppTextInput label="Date of Birth *" placeholder="YYYY-MM-DD" value={data.dateOfBirth} onChangeText={(v) => set('dateOfBirth', v)} error={errors.dateOfBirth} hint="Format: 1990-05-18" />
              <Text style={styles.fieldLabel}>Gender *</Text>
              <ChipGroup options={GENDERS} selected={data.gender} onSelect={(v) => set('gender', v)} />
              {errors.gender ? <Text style={styles.fieldError}>{errors.gender}</Text> : null}
              <Text style={styles.fieldLabel}>Civil Status *</Text>
              <ChipGroup options={CIVIL_STATUS} selected={data.civilStatus} onSelect={(v) => set('civilStatus', v)} />
              {errors.civilStatus ? <Text style={styles.fieldError}>{errors.civilStatus}</Text> : null}
            </View>
          )}

          {step === 1 && (
            <View>
              <AppTextInput
                label="Mobile Number *"
                placeholder="e.g. 0917 555 4321"
                value={data.phone}
                onChangeText={(v) => set('phone', v)}
                keyboardType="phone-pad"
                error={errors.phone}
                hint="Your registered mobile number for SMS alerts and OTP."
              />
              <AppTextInput
                label="Email (Optional)"
                placeholder="e.g. teresa@gmail.com"
                value={data.email}
                onChangeText={(v) => set('email', v)}
                autoCapitalize="none"
                keyboardType="email-address"
                error={errors.email}
                hint="Useful for account recovery and official notices."
              />
            </View>
          )}

          {step === 2 && (
            <View>
              <AppTextInput label="Barangay *" placeholder="e.g. Poblacion" value={data.barangay} onChangeText={(v) => set('barangay', v)} error={errors.barangay} />
              <AppTextInput label="Municipality / City *" placeholder="e.g. Tacloban City" value={data.city} onChangeText={(v) => set('city', v)} error={errors.city} />
              <AppTextInput label="Province *" placeholder="e.g. Leyte" value={data.province} onChangeText={(v) => set('province', v)} error={errors.province} />
              <AppTextInput
                label="Complete Address *"
                placeholder="House no., street, building"
                value={data.address}
                onChangeText={(v) => set('address', v)}
                error={errors.address}
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          {step === 3 && (
            <View>
              <AppTextInput label="Occupation *" placeholder="e.g. Store Owner, Farmer, Teacher" value={data.occupation} onChangeText={(v) => set('occupation', v)} error={errors.occupation} />
              <AppTextInput label="Monthly Income (₱) *" placeholder="e.g. 35000" value={data.monthlyIncome} onChangeText={(v) => set('monthlyIncome', v)} keyboardType="numeric" error={errors.monthlyIncome} />
              <Text style={styles.fieldLabel}>Source of Income *</Text>
              <ChipGroup options={INCOME_SOURCES} selected={data.sourceOfIncome} onSelect={(v) => set('sourceOfIncome', v)} />
              {errors.sourceOfIncome ? <Text style={styles.fieldError}>{errors.sourceOfIncome}</Text> : null}
            </View>
          )}

          {step === 4 && (
            <View>
              <AppTextInput label="Password *" placeholder="At least 8 characters" value={data.password} onChangeText={(v) => set('password', v)} secure error={errors.password} />
              <AppTextInput label="Confirm Password *" placeholder="Re-enter your password" value={data.confirmPassword} onChangeText={(v) => set('confirmPassword', v)} secure error={errors.confirmPassword} />
              <TouchableOpacity style={styles.termsRow} onPress={() => set('agreed', !data.agreed)} activeOpacity={0.8}>
                <Ionicons name={data.agreed ? 'checkbox' : 'square-outline'} size={22} color={data.agreed ? colors.primary : colors.textFaint} />
                <View style={styles.flex1}>
                  <Text style={styles.termsText}>
                    I agree to the Cooperative's{' '}
                    <Text style={styles.termsLink}>Terms & Conditions</Text>,{' '}
                    <Text style={styles.termsLink}>Membership Rules</Text>, and{' '}
                    <Text style={styles.termsLink}>Data Privacy Notice</Text>, and I consent to the processing of my personal data for membership and lending purposes.
                  </Text>
                </View>
              </TouchableOpacity>
              {errors.agreed ? <Text style={styles.fieldError}>{errors.agreed}</Text> : null}
            </View>
          )}

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backStepBtn} onPress={backStep}>
              <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
              <Text style={styles.backStepText}>Back</Text>
            </TouchableOpacity>
            {step < 4 ? (
              <View style={styles.flex1}>
                <AppButton title="Continue" onPress={nextStep} />
              </View>
            ) : (
              <View style={styles.flex1}>
                <AppButton title="Create My Account" onPress={handleSubmit} loading={submitting} icon={<Ionicons name="person-add-outline" size={18} color={colors.white} />} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 28,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  fieldError: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.round,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 6,
  },
  chipTextActive: {
    color: colors.white,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  flex1: {
    flex: 1,
  },
  termsText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginLeft: 8,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },
  backStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginRight: 8,
  },
  backStepText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
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
  submitErrorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  successWrap: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  successMsg: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  successHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: colors.tealBorder,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 14,
  },
  successHintText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: colors.tealDark,
    lineHeight: 17,
  },
  successAction: {
    width: '100%',
    marginTop: 24,
  },
  successLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  successLinkText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
});