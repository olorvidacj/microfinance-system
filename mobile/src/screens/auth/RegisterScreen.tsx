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
import { AppButton, AppTextInput, PasswordStrengthIndicator } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { isPasswordStrong, STRONG_PASSWORD_ERROR_MESSAGE } from '../../utils/passwordValidator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const SUFFIX_OPTIONS = ['None', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];

interface FormData {
  firstName: string;
  middleName: string;
  hasNoMiddleName: boolean;
  lastName: string;
  suffix: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

const initialForm: FormData = {
  firstName: '',
  middleName: '',
  hasNoMiddleName: false,
  lastName: '',
  suffix: 'None',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreeTerms: false,
};

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn } = useAuth();
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registeredSession, setRegisteredSession] = useState<{
    fullName: string;
    email?: string;
    session: any;
  } | null>(null);

  const update = (key: keyof FormData, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setGeneralError(null);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const fName = form.firstName.trim();
    if (!fName || fName.length < 2) {
      errs.firstName = 'Enter your legal First Name (min 2 characters).';
    }

    const lName = form.lastName.trim();
    if (!lName || lName.length < 2) {
      errs.lastName = 'Enter your legal Last Name (min 2 characters).';
    }

    if (!form.hasNoMiddleName && form.middleName.trim()) {
      const invalidMiddle = ['n/a', 'na', 'none', '-', '.'];
      if (invalidMiddle.includes(form.middleName.trim().toLowerCase())) {
        errs.middleName = 'Check "No middle name" instead of typing N/A.';
      }
    }

    // Philippine phone validation
    const cleanPhone = form.phone.replace(/\D/g, '');
    const isPhMobile = /^(09\d{9}|639\d{9}|9\d{9})$/.test(cleanPhone);
    if (!isPhMobile) {
      errs.phone = 'Enter a valid Philippine mobile number (e.g. 0917 123 4567).';
    }

    // Email validation (optional)
    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        errs.email = 'Enter a valid email address or leave it blank.';
      }
    }

    // Password validation
    if (!form.password || !isPasswordStrong(form.password)) {
      errs.password = STRONG_PASSWORD_ERROR_MESSAGE;
    }

    if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    if (!form.agreeTerms) {
      errs.agreeTerms = 'You must agree to the Terms of Service & Privacy Policy.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    setGeneralError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      let cleanPhone = form.phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('63')) cleanPhone = '0' + cleanPhone.slice(2);
      if (cleanPhone.startsWith('9') && cleanPhone.length === 10) cleanPhone = '0' + cleanPhone;

      const suffixVal = form.suffix !== 'None' ? form.suffix.trim() : undefined;
      const composedFullName = [
        form.firstName.trim(),
        (!form.hasNoMiddleName && form.middleName.trim()) ? form.middleName.trim() : null,
        form.lastName.trim(),
        suffixVal || null,
      ].filter(Boolean).join(' ');

      const session = await api.register({
        fullName: composedFullName,
        firstName: form.firstName.trim(),
        middleName: (!form.hasNoMiddleName && form.middleName.trim()) ? form.middleName.trim() : undefined,
        lastName: form.lastName.trim(),
        suffix: suffixVal,
        hasNoMiddleName: form.hasNoMiddleName,
        phone: cleanPhone,
        email: form.email.trim().toLowerCase() || undefined,
        password: form.password,
        confirmPassword: form.confirmPassword,
        agreeTerms: form.agreeTerms,
      });

      setRegisteredSession({
        fullName: session.user?.fullName || composedFullName,
        email: session.user?.email || form.email.trim(),
        session,
      });
    } catch (err: any) {
      setGeneralError(err?.message || 'Registration failed. Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteKyc = async () => {
    if (registeredSession?.session) {
      await signIn(registeredSession.session);
    } else {
      navigation.navigate('Login');
    }
  };

  // SUCCESS SCREEN
  if (registeredSession) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color={colors.greenDark} />
            </View>

            <Text style={styles.successTitle}>Account created successfully.</Text>
            <Text style={styles.successSubtitle}>
              Your member account for{' '}
              <Text style={styles.boldText}>{registeredSession.fullName}</Text> has been created.
            </Text>

            <View style={styles.kycNoticeCard}>
              <View style={styles.kycNoticeHeader}>
                <Ionicons name="shield-checkmark" size={20} color={colors.teal} />
                <Text style={styles.kycNoticeTitle}>Next Step: Complete Your KYC</Text>
              </View>
              <Text style={styles.kycNoticeText}>
                Your basic account is active. To unlock loan applications, savings withdrawals, and credit services, please complete your step-by-step KYC identity verification.
              </Text>
            </View>

            <View style={styles.successActions}>
              <AppButton
                title="Complete KYC Verification"
                onPress={handleCompleteKyc}
                style={styles.primaryBtn}
              />
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleCompleteKyc}
              >
                <Text style={styles.secondaryBtnText}>Go to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerBrand}>
              <View style={styles.brandIcon}>
                <Ionicons name="business" size={18} color={colors.goldDeep} />
              </View>
              <Text style={styles.brandText}>HOSCOMCO Microfinance</Text>
            </View>
          </View>

          <View style={styles.titleSection}>
            <Text style={styles.title}>Register</Text>
            <Text style={styles.subtitle}>
              Register as a member client to access loans, savings, and cooperative self-service services.
            </Text>
          </View>

          {/* General Error Banner */}
          {generalError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorBannerText}>{generalError}</Text>
            </View>
          ) : null}

          {/* Card: Legal Name */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-outline" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Legal Name</Text>
            </View>
            <Text style={styles.cardHint}>
              Enter your legal name exactly as shown on your government-issued ID.
            </Text>

            <AppTextInput
              label="First Name"
              placeholder="e.g. Maria"
              value={form.firstName}
              onChangeText={(v) => update('firstName', v)}
              error={errors.firstName}
              autoCapitalize="words"
            />

            <AppTextInput
              label="Middle Name (Optional)"
              placeholder={form.hasNoMiddleName ? 'No middle name' : 'e.g. Santos'}
              value={form.hasNoMiddleName ? '' : form.middleName}
              onChangeText={(v) => update('middleName', v)}
              editable={!form.hasNoMiddleName}
              error={errors.middleName}
              autoCapitalize="words"
            />

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                const nextNoMiddle = !form.hasNoMiddleName;
                update('hasNoMiddleName', nextNoMiddle);
                if (nextNoMiddle) update('middleName', '');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, form.hasNoMiddleName && styles.checkboxChecked]}>
                {form.hasNoMiddleName && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.checkboxLabel}>I do not have a middle name</Text>
            </TouchableOpacity>

            <AppTextInput
              label="Last Name"
              placeholder="e.g. Dela Cruz"
              value={form.lastName}
              onChangeText={(v) => update('lastName', v)}
              error={errors.lastName}
              autoCapitalize="words"
            />

            {/* Suffix chips */}
            <View style={styles.suffixContainer}>
              <Text style={styles.inputLabel}>Suffix</Text>
              <View style={styles.suffixChipsRow}>
                {SUFFIX_OPTIONS.map((sfx) => {
                  const isSelected = form.suffix === sfx;
                  return (
                    <TouchableOpacity
                      key={sfx}
                      style={[styles.suffixChip, isSelected && styles.suffixChipActive]}
                      onPress={() => update('suffix', sfx)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.suffixChipText, isSelected && styles.suffixChipTextActive]}>
                        {sfx}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Card: Contact Information */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="call-outline" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Contact Information</Text>
            </View>

            <AppTextInput
              label="Philippine Mobile Number"
              placeholder="e.g. 0917 123 4567"
              value={form.phone}
              onChangeText={(v) => update('phone', v)}
              keyboardType="phone-pad"
              error={errors.phone}
              hint="Your mobile number will be used for SMS updates and verification."
              leftElement={
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>🇵🇭 +63</Text>
                </View>
              }
            />

            <AppTextInput
              label="Email Address (Optional)"
              placeholder="e.g. name@example.com"
              value={form.email}
              onChangeText={(v) => update('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              hint="Recommended for receipts and statement notifications."
              rightElement={<Ionicons name="mail-outline" size={18} color={colors.textMuted} />}
            />
          </View>

          {/* Card: Account Password */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Security & Password</Text>
            </View>

            <AppTextInput
              label="Password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChangeText={(v) => update('password', v)}
              secure={!showPassword}
              error={errors.password}
              rightElement={
                <TouchableOpacity
                  onPress={() => setShowPassword((p) => !p)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              }
            />

            <AppTextInput
              label="Confirm Password"
              placeholder="Re-type your password"
              value={form.confirmPassword}
              onChangeText={(v) => update('confirmPassword', v)}
              secure={!showConfirmPassword}
              error={errors.confirmPassword}
              rightElement={
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((p) => !p)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              }
            />

            <PasswordStrengthIndicator
              password={form.password}
              confirmPassword={form.confirmPassword}
            />
          </View>

          {/* Terms & Privacy Consent */}
          <View style={styles.consentCard}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => update('agreeTerms', !form.agreeTerms)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, form.agreeTerms && styles.checkboxChecked]}>
                {form.agreeTerms && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <View style={styles.flex1}>
                <Text style={styles.consentText}>
                  I agree to the{' '}
                  <Text style={styles.consentLink}>Terms of Service</Text> and{' '}
                  <Text style={styles.consentLink}>Data Privacy Policy</Text> pursuant to Republic Act No. 10173 (Data Privacy Act of 2012).
                </Text>
              </View>
            </TouchableOpacity>
            {errors.agreeTerms ? (
              <Text style={styles.consentErrorText}>{errors.agreeTerms}</Text>
            ) : null}
          </View>

          {/* Submit Button */}
          <View style={styles.submitWrap}>
            <AppButton
              title={submitting ? 'Registering...' : 'Register'}
              onPress={handleRegister}
              loading={submitting}
              disabled={submitting}
              style={styles.submitBtn}
            />

            <View style={styles.signinRow}>
              <Text style={styles.signinText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.signinLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  brandIcon: {
    marginRight: 6,
  },
  brandText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 10,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  suffixContainer: {
    marginTop: 6,
  },
  suffixChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suffixChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suffixChipActive: {
    backgroundColor: '#091527',
    borderColor: '#091527',
  },
  suffixChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  suffixChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  phonePrefix: {
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    marginRight: 8,
    justifyContent: 'center',
  },
  phonePrefixText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  consentCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 20,
  },
  consentText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  consentLink: {
    color: '#059669',
    fontWeight: '700',
  },
  consentErrorText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 4,
  },
  submitWrap: {
    marginTop: 8,
  },
  submitBtn: {
    backgroundColor: '#091527',
  },
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  signinText: {
    fontSize: 13,
    color: '#64748B',
  },
  signinLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  // Success Screen Styles
  successContainer: {
    padding: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#A7F3D0',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  kycNoticeCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    width: '100%',
    marginBottom: 24,
  },
  kycNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  kycNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  kycNoticeText: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 18,
  },
  successActions: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#059669',
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
});