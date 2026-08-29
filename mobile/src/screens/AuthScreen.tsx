import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { api } from '../services/api';
import { UserSession } from '../types';

interface AuthScreenProps {
  onSuccess: (session: UserSession) => void;
}

type AuthMode = 'login' | 'register' | 'forgot_password' | 'verify_otp' | 'reset_password';

// Multi-step Registration steps
type RegStep = 1 | 2 | 3 | 4;

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------------
  // Sign In State
  // -------------------------------------------------------------
  const [loginIdentifier, setLoginIdentifier] = useState('09175554321');
  const [password, setPassword] = useState('Client@123');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // -------------------------------------------------------------
  // Tala-Style Multi-Step Registration State
  // -------------------------------------------------------------
  const [regStep, setRegStep] = useState<RegStep>(1);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Step 1: Create Account
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [regOtp, setRegOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [canResendOtp, setCanResendOtp] = useState(false);
  const [formattedPhoneDisplay, setFormattedPhoneDisplay] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  // Step 2: Personal Identity
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1994-08-20');
  const [gender, setGender] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [civilStatus, setCivilStatus] = useState('Single');

  // Step 3: Residential Address & Livelihood
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [occupation, setOccupation] = useState('');
  const [employerOrBusiness, setEmployerOrBusiness] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('35000');

  // Step 4: Terms & Consent
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [agreedPrivacy, setAgreedPrivacy] = useState(true);

  // Step 1 Validation Errors State
  const [step1Errors, setStep1Errors] = useState<{
    phone?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    otp?: string;
  }>({});

  // -------------------------------------------------------------
  // Recovery & OTP State
  // -------------------------------------------------------------
  const [recoveryEmailOrPhone, setRecoveryEmailOrPhone] = useState('');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // OTP Timer effect for Registration
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isVerifyingOtp && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) {
            setCanResendOtp(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isVerifyingOtp, otpCountdown]);

  // -------------------------------------------------------------
  // Philippine Phone Validation Helper
  // -------------------------------------------------------------
  const cleanPhoneDigits = (raw: string) => raw.replace(/\D/g, '');

  const validatePhilippinePhone = (raw: string) => {
    const digits = cleanPhoneDigits(raw);
    if (!digits) return { isValid: false, error: 'Mobile number is required' };
    
    // Check 10 digits starting with 9 (e.g. 9171234567)
    // Check 11 digits starting with 09 (e.g. 09171234567)
    // Check 12 digits starting with 639 (e.g. 639171234567)
    if (digits.length === 10 && digits.startsWith('9')) {
      return { isValid: true, clean: `0${digits}`, formatted: `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` };
    }
    if (digits.length === 11 && digits.startsWith('09')) {
      return { isValid: true, clean: digits, formatted: `+63 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` };
    }
    if (digits.length === 12 && digits.startsWith('639')) {
      return { isValid: true, clean: `0${digits.slice(2)}`, formatted: `+63 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}` };
    }
    return {
      isValid: false,
      error: 'Enter a valid 11-digit Philippine mobile number starting with 09 (e.g. 0917 123 4567)',
    };
  };

  const getTelcoPrefix = (raw: string) => {
    const digits = cleanPhoneDigits(raw);
    let p = digits;
    if (digits.startsWith('639')) p = `09${digits.slice(3)}`;
    if (digits.startsWith('9')) p = `09${digits.slice(1)}`;
    if (p.length >= 4) {
      const prefix = p.slice(0, 4);
      if (['0917', '0927', '0915', '0916', '0926', '0905', '0906', '0977', '0978', '0995', '0997'].includes(prefix)) {
        return 'Globe / TM';
      }
      if (['0908', '0918', '0919', '0920', '0921', '0928', '0929', '0939', '0947', '0949', '0998', '0999', '0912', '0910', '0946', '0948', '0950', '0930', '0938'].includes(prefix)) {
        return 'Smart / TNT';
      }
      if (['0991', '0992', '0993', '0994'].includes(prefix)) {
        return 'DITO Telecommunity';
      }
    }
    return 'PH Mobile Network';
  };

  // -------------------------------------------------------------
  // Password Security Checklist Checks
  // -------------------------------------------------------------
  const passHasMinLen = regPassword.length >= 8;
  const passHasNumber = /\d/.test(regPassword);
  const passHasUpperOrSpecial = /[A-Z!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(regPassword);
  const passMatches = confirmPassword.length > 0 && regPassword === confirmPassword;

  const getPasswordStrength = () => {
    let score = 0;
    if (passHasMinLen) score++;
    if (passHasNumber) score++;
    if (passHasUpperOrSpecial) score++;
    if (regPassword.length >= 12 && /[A-Z]/.test(regPassword) && /[!@#$%^&*]/.test(regPassword)) score++;
    if (score <= 1) return { label: 'Weak', color: '#EF4444', width: '30%' };
    if (score === 2) return { label: 'Moderate', color: '#F59E0B', width: '65%' };
    return { label: 'Strong & Secure', color: '#10B981', width: '100%' };
  };

  // -------------------------------------------------------------
  // STEP 1 Validation & SMS OTP Dispatch
  // -------------------------------------------------------------
  const handleStep1Continue = async () => {
    const errors: typeof step1Errors = {};

    // 1. Phone validation
    const phoneRes = validatePhilippinePhone(phone);
    if (!phoneRes.isValid) {
      errors.phone = phoneRes.error;
    }

    // 2. Email validation
    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.email = 'Please enter a valid email address format (e.g. name@domain.com)';
    }

    // 3. Password requirements
    if (!regPassword) {
      errors.password = 'Password is required';
    } else if (!passHasMinLen || !passHasNumber || !passHasUpperOrSpecial) {
      errors.password = 'Password must meet all security requirements below';
    }

    // 4. Confirm Password
    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your password';
    } else if (regPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match. Please check again.';
    }

    setStep1Errors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    // If all Step 1 fields are valid, send OTP to mobile number
    setLoading(true);
    try {
      const res = await api.sendRegistrationOtp(phone.trim(), email.trim());
      setFormattedPhoneDisplay(res.formattedPhone || phone.trim());
      if (res.demoOtp) {
        setRegOtp(res.demoOtp);
      }
      setIsVerifyingOtp(true);
      setOtpCountdown(60);
      setCanResendOtp(false);
      Alert.alert(
        'SMS Verification Code Sent 📲',
        `A 6-digit verification code has been dispatched to ${res.formattedPhone || phone}.\n\n(Demo code: ${res.demoOtp || '123456'})`
      );
    } catch (err: any) {
      Alert.alert('Verification Dispatch Failed', err.message || 'Unable to send SMS OTP. Please check your number.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Verify Registration OTP
  // -------------------------------------------------------------
  const handleVerifyRegistrationOtp = async () => {
    if (!regOtp || regOtp.trim().length < 6) {
      setStep1Errors((prev) => ({ ...prev, otp: 'Please enter the complete 6-digit code' }));
      return;
    }

    setLoading(true);
    try {
      await api.verifyRegistrationOtp(phone.trim(), regOtp.trim());
      setIsPhoneVerified(true);
      setIsVerifyingOtp(false);
      // Advance to Step 2!
      setRegStep(2);
    } catch (err: any) {
      setStep1Errors((prev) => ({ ...prev, otp: err.message || 'Incorrect 6-digit code' }));
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResendOtp) return;
    setLoading(true);
    try {
      const res = await api.sendRegistrationOtp(phone.trim(), email.trim());
      if (res.demoOtp) setRegOtp(res.demoOtp);
      setOtpCountdown(60);
      setCanResendOtp(false);
      Alert.alert('New Code Dispatched', `A fresh 6-digit verification code has been sent.`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 2 & STEP 3 Handlers
  // -------------------------------------------------------------
  const handleStep2Continue = () => {
    if (!fullName.trim()) {
      Alert.alert('Full Name Required', 'Please enter your complete legal name as shown on your government ID.');
      return;
    }
    setRegStep(3);
  };

  const handleStep3Continue = () => {
    setRegStep(4);
  };

  // -------------------------------------------------------------
  // Final Account Submission (STEP 4)
  // -------------------------------------------------------------
  const handleCompleteRegistration = async () => {
    if (!agreedTerms || !agreedPrivacy) {
      Alert.alert('Consent Required', 'Please agree to the Terms of Service and Data Privacy consent to continue.');
      return;
    }

    setLoading(true);
    try {
      const session = await api.register({
        phone: phone.trim(),
        email: email.trim(),
        password: regPassword,
        fullName: fullName.trim() || `Member (${phone.slice(-4)})`,
        dateOfBirth: dateOfBirth.trim(),
        civilStatus,
        address: `${address} ${city} ${province}`.trim(),
        occupation: occupation.trim(),
        employerOrBusiness: employerOrBusiness.trim(),
        monthlyIncome: monthlyIncome ? Number(monthlyIncome) : 35000,
      });

      // Immediately log in and activate session
      onSuccess(session);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Unable to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Login Handler
  // -------------------------------------------------------------
  const handleLogin = async () => {
    if (!loginIdentifier.trim() || !password) {
      Alert.alert('Validation Error', 'Please enter your mobile phone number or email, and password.');
      return;
    }
    setLoading(true);
    try {
      const session = await api.login(loginIdentifier.trim(), password);
      onSuccess(session);
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Recovery Handlers
  // -------------------------------------------------------------
  const handleForgotPassword = async () => {
    if (!recoveryEmailOrPhone.trim()) {
      Alert.alert('Required', 'Please enter your registered email address or phone number.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgotPassword(recoveryEmailOrPhone.trim());
      setInfoMessage(res.message);
      if (res.demoOtp) {
        setRecoveryOtp(res.demoOtp);
      }
      setMode('verify_otp');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecoveryOtp = async () => {
    if (!recoveryOtp) {
      Alert.alert('Required', 'Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      await api.verifyOtp(recoveryEmailOrPhone.trim(), recoveryOtp);
      setMode('reset_password');
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Invalid Password', 'New password must be at least 8 characters with numbers.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.resetPassword(recoveryEmailOrPhone.trim(), recoveryOtp, newPassword);
      Alert.alert('Password Reset', res.message);
      setPassword(newPassword);
      setLoginIdentifier(recoveryEmailOrPhone.trim());
      setMode('login');
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        {/* ========================================================================= */}
        {/* 1. MULTI-STEP REGISTRATION ONBOARDING FLOW (Tala-Inspired Mobile Experience) */}
        {/* ========================================================================= */}
        {mode === 'register' ? (
          <View>
            {/* Top Navigation & Step Header */}
            <View style={styles.headerBar}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  if (isVerifyingOtp) {
                    setIsVerifyingOtp(false);
                  } else if (regStep > 1) {
                    setRegStep((prev) => (prev - 1) as RegStep);
                  } else {
                    setMode('login');
                  }
                }}
              >
                <Text style={styles.backButtonIcon}>←</Text>
                <Text style={styles.backButtonText}>
                  {isVerifyingOtp ? 'Edit Mobile' : regStep === 1 ? 'Sign In' : 'Back'}
                </Text>
              </TouchableOpacity>

              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  {isVerifyingOtp ? 'SMS Verification' : `Step ${regStep} of 4`}
                </Text>
              </View>
            </View>

            {/* Progress Indicator Bar */}
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: isVerifyingOtp
                      ? '25%'
                      : regStep === 1
                      ? '25%'
                      : regStep === 2
                      ? '50%'
                      : regStep === 3
                      ? '75%'
                      : '100%',
                  },
                ]}
              />
            </View>

            {/* Step Sub-header */}
            <View style={styles.stepTitleSection}>
              {!isVerifyingOtp ? (
                <>
                  <Text style={styles.stepCategory}>
                    {regStep === 1 && 'ACCOUNT ONBOARDING'}
                    {regStep === 2 && 'BORROWER IDENTITY'}
                    {regStep === 3 && 'RESIDENCE & INCOME'}
                    {regStep === 4 && 'FINAL CONFIRMATION'}
                  </Text>
                  <Text style={styles.stepMainTitle}>
                    {regStep === 1 && 'Create Your Account'}
                    {regStep === 2 && 'Personal Information'}
                    {regStep === 3 && 'Address & Livelihood'}
                    {regStep === 4 && 'Review & Activation'}
                  </Text>
                  <Text style={styles.stepDescription}>
                    {regStep === 1 && 'Enter your Philippine mobile number, email, and a secure password to get started.'}
                    {regStep === 2 && 'Provide your legal name and birth details as printed on your valid government ID.'}
                    {regStep === 3 && 'Tell us about your home address and income to calculate your instant credit line.'}
                    {regStep === 4 && 'Review your details and accept data privacy terms to activate your lending account.'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.stepCategory}>PHONE VERIFICATION</Text>
                  <Text style={styles.stepMainTitle}>Enter 6-Digit Code</Text>
                  <Text style={styles.stepDescription}>
                    We sent an SMS with a one-time verification code to{' '}
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>{formattedPhoneDisplay || phone}</Text>
                  </Text>
                </>
              )}
            </View>

            {/* ------------------------------------------------------------- */}
            {/* STEP 1: CREATE ACCOUNT (FIELDS & REQUIREMENTS) */}
            {/* ------------------------------------------------------------- */}
            {regStep === 1 && !isVerifyingOtp && (
              <View style={styles.formSection}>
                {/* 1. Mobile Number with +63 Badge & Telco detection */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Mobile Number *</Text>
                    {phone.length >= 4 && (
                      <View style={styles.telcoBadge}>
                        <Text style={styles.telcoBadgeText}>{getTelcoPrefix(phone)}</Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.phoneInputWrapper, step1Errors.phone ? styles.inputErrorBorder : null]}>
                    <View style={styles.countryPrefixBox}>
                      <Text style={styles.phFlag}>🇵🇭</Text>
                      <Text style={styles.prefixText}>+63</Text>
                    </View>
                    <TextInput
                      style={styles.phoneTextInput}
                      value={phone}
                      onChangeText={(val) => {
                        setPhone(val);
                        if (step1Errors.phone) setStep1Errors((prev) => ({ ...prev, phone: undefined }));
                      }}
                      keyboardType="phone-pad"
                      placeholder="917 123 4567"
                      placeholderTextColor="#94A3B8"
                      maxLength={13}
                    />
                  </View>
                  {step1Errors.phone ? (
                    <Text style={styles.errorText}>⚠️ {step1Errors.phone}</Text>
                  ) : (
                    <Text style={styles.fieldHelper}>Enter your 10-digit mobile starting with 9 or 11-digit starting with 09.</Text>
                  )}
                </View>

                {/* 2. Email Address */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address *</Text>
                  <TextInput
                    style={[styles.input, step1Errors.email ? styles.inputErrorBorder : null]}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (step1Errors.email) setStep1Errors((prev) => ({ ...prev, email: undefined }));
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="e.g. maria.santos@gmail.com"
                    placeholderTextColor="#94A3B8"
                  />
                  {step1Errors.email ? (
                    <Text style={styles.errorText}>⚠️ {step1Errors.email}</Text>
                  ) : (
                    <Text style={styles.fieldHelper}>We will send your loan contracts and official payment receipts here.</Text>
                  )}
                </View>

                {/* 3. Password with Live Security Requirements Checklist */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password *</Text>
                  <View style={[styles.passwordWrapper, step1Errors.password ? styles.inputErrorBorder : null]}>
                    <TextInput
                      style={styles.passwordTextInput}
                      value={regPassword}
                      onChangeText={(val) => {
                        setRegPassword(val);
                        if (step1Errors.password) setStep1Errors((prev) => ({ ...prev, password: undefined }));
                      }}
                      secureTextEntry={!showRegPassword}
                      placeholder="Create a strong password"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowRegPassword(!showRegPassword)}
                    >
                      <Text style={{ fontSize: 16 }}>{showRegPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Password Strength Meter */}
                  {regPassword.length > 0 && (
                    <View style={styles.strengthContainer}>
                      <View style={styles.strengthBarBg}>
                        <View
                          style={[
                            styles.strengthBarFill,
                            {
                              width: getPasswordStrength().width as any,
                              backgroundColor: getPasswordStrength().color,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.strengthLabel, { color: getPasswordStrength().color }]}>
                        Strength: {getPasswordStrength().label}
                      </Text>
                    </View>
                  )}

                  {/* Live Security Requirements Checklist */}
                  <View style={styles.checklistContainer}>
                    <Text style={styles.checklistHeader}>Security Requirements:</Text>
                    <View style={styles.checkItem}>
                      <Text style={passHasMinLen ? styles.checkIconGreen : styles.checkIconGray}>
                        {passHasMinLen ? '✓' : '○'}
                      </Text>
                      <Text style={passHasMinLen ? styles.checkTextGreen : styles.checkTextGray}>
                        At least 8 characters
                      </Text>
                    </View>
                    <View style={styles.checkItem}>
                      <Text style={passHasNumber ? styles.checkIconGreen : styles.checkIconGray}>
                        {passHasNumber ? '✓' : '○'}
                      </Text>
                      <Text style={passHasNumber ? styles.checkTextGreen : styles.checkTextGray}>
                        Contains at least one number (0-9)
                      </Text>
                    </View>
                    <View style={styles.checkItem}>
                      <Text style={passHasUpperOrSpecial ? styles.checkIconGreen : styles.checkIconGray}>
                        {passHasUpperOrSpecial ? '✓' : '○'}
                      </Text>
                      <Text style={passHasUpperOrSpecial ? styles.checkTextGreen : styles.checkTextGray}>
                        Contains uppercase letter or special character (!@#$)
                      </Text>
                    </View>
                  </View>

                  {step1Errors.password && <Text style={styles.errorText}>⚠️ {step1Errors.password}</Text>}
                </View>

                {/* 4. Confirm Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password *</Text>
                  <View style={[styles.passwordWrapper, step1Errors.confirmPassword ? styles.inputErrorBorder : null]}>
                    <TextInput
                      style={styles.passwordTextInput}
                      value={confirmPassword}
                      onChangeText={(val) => {
                        setConfirmPassword(val);
                        if (step1Errors.confirmPassword) {
                          setStep1Errors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      secureTextEntry={!showConfirmPassword}
                      placeholder="Repeat your password"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Text style={{ fontSize: 16 }}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>

                  {confirmPassword.length > 0 && (
                    <View style={styles.matchIndicatorRow}>
                      <Text style={{ fontSize: 12, marginRight: 4 }}>{passMatches ? '✅' : '❌'}</Text>
                      <Text style={passMatches ? styles.matchSuccessText : styles.matchErrorText}>
                        {passMatches ? 'Passwords match perfectly' : 'Passwords do not match yet'}
                      </Text>
                    </View>
                  )}
                  {step1Errors.confirmPassword && (
                    <Text style={styles.errorText}>⚠️ {step1Errors.confirmPassword}</Text>
                  )}
                </View>

                {/* Step 1 Continue Button */}
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleStep1Continue}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.continueButtonText}>Continue →</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.switchContainer}>
                  <Text style={styles.switchText}>Already registered?</Text>
                  <TouchableOpacity onPress={() => setMode('login')}>
                    <Text style={styles.switchLink}> Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 1.5: SMS OTP VERIFICATION DIALOG */}
            {/* ------------------------------------------------------------- */}
            {regStep === 1 && isVerifyingOtp && (
              <View style={styles.formSection}>
                <View style={styles.otpCard}>
                  <Text style={styles.otpInstructions}>
                    Enter the 6-digit PIN sent via SMS to verify your mobile number.
                  </Text>

                  <View style={styles.otpInputRow}>
                    <TextInput
                      style={styles.largeOtpInput}
                      value={regOtp}
                      onChangeText={(val) => {
                        setRegOtp(val);
                        if (step1Errors.otp) setStep1Errors((prev) => ({ ...prev, otp: undefined }));
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="123456"
                      placeholderTextColor="#CBD5E1"
                      autoFocus
                    />
                  </View>

                  {step1Errors.otp && <Text style={[styles.errorText, { textAlign: 'center' }]}>⚠️ {step1Errors.otp}</Text>}

                  <View style={styles.otpTimerRow}>
                    {!canResendOtp ? (
                      <Text style={styles.timerText}>⏱️ Resend code in {otpCountdown}s</Text>
                    ) : (
                      <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                        <Text style={styles.resendLink}>📩 Tap here to Resend SMS Code</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Demo Helper Button */}
                  <TouchableOpacity
                    style={styles.demoOtpChip}
                    onPress={() => setRegOtp('123456')}
                  >
                    <Text style={styles.demoOtpChipText}>💡 Auto-fill Demo Code (123456)</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleVerifyRegistrationOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.continueButtonText}>Verify & Proceed to Step 2 →</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editPhoneBtn}
                  onPress={() => setIsVerifyingOtp(false)}
                >
                  <Text style={styles.editPhoneBtnText}>Change Mobile Phone Number</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 2: BORROWER IDENTITY & PERSONAL DETAILS */}
            {/* ------------------------------------------------------------- */}
            {regStep === 2 && (
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Legal Name (Official Govt ID) *</Text>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="e.g. Maria Teresa Santos Alcantara"
                    placeholderTextColor="#94A3B8"
                    autoFocus
                  />
                  <Text style={styles.fieldHelper}>Enter your First Name, Middle Name, and Last Name.</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Date of Birth (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={styles.input}
                    value={dateOfBirth}
                    onChangeText={setDateOfBirth}
                    placeholder="e.g. 1994-08-20"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={styles.fieldHelper}>Must be at least 18 years old to qualify for loans.</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Gender</Text>
                  <View style={styles.genderRow}>
                    {(['Female', 'Male', 'Other'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.genderChip, gender === g ? styles.genderChipActive : null]}
                        onPress={() => setGender(g)}
                      >
                        <Text style={[styles.genderChipText, gender === g ? styles.genderChipTextActive : null]}>
                          {g === 'Female' ? '👩 Female' : g === 'Male' ? '👨 Male' : 'Other'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Civil Status</Text>
                  <View style={styles.statusRow}>
                    {['Single', 'Married', 'Widowed', 'Separated'].map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[styles.statusChip, civilStatus === st ? styles.statusChipActive : null]}
                        onPress={() => setCivilStatus(st)}
                      >
                        <Text style={[styles.statusChipText, civilStatus === st ? styles.statusChipTextActive : null]}>
                          {st}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity style={styles.continueButton} onPress={handleStep2Continue}>
                  <Text style={styles.continueButtonText}>Continue to Step 3 →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 3: RESIDENCE & LIVELIHOOD */}
            {/* ------------------------------------------------------------- */}
            {regStep === 3 && (
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>House No., Street & Barangay *</Text>
                  <TextInput
                    style={styles.input}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="e.g. 14 San Pedro St, Brgy. Poblacion"
                    placeholderTextColor="#94A3B8"
                    autoFocus
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>City / Municipality *</Text>
                    <TextInput
                      style={styles.input}
                      value={city}
                      onChangeText={setCity}
                      placeholder="e.g. San Jose"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Province *</Text>
                    <TextInput
                      style={styles.input}
                      value={province}
                      onChangeText={setProvince}
                      placeholder="e.g. Bulacan"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Primary Occupation / Source of Livelihood *</Text>
                  <TextInput
                    style={styles.input}
                    value={occupation}
                    onChangeText={setOccupation}
                    placeholder="e.g. Sari-Sari Store Owner, Employee, Vendor"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Business or Employer Name</Text>
                  <TextInput
                    style={styles.input}
                    value={employerOrBusiness}
                    onChangeText={setEmployerOrBusiness}
                    placeholder="e.g. Alcantara Variety Store"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Estimated Monthly Income (₱) *</Text>
                  <TextInput
                    style={[styles.input, styles.incomeInput]}
                    value={monthlyIncome}
                    onChangeText={setMonthlyIncome}
                    keyboardType="numeric"
                    placeholder="35000"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <TouchableOpacity style={styles.continueButton} onPress={handleStep3Continue}>
                  <Text style={styles.continueButtonText}>Review & Activate Account →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 4: REVIEW & ACTIVATION */}
            {/* ------------------------------------------------------------- */}
            {regStep === 4 && (
              <View style={styles.formSection}>
                {/* Summary Card */}
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>📋 Application Summary</Text>
                  
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Applicant Name:</Text>
                    <Text style={styles.summaryValue}>{fullName || 'New Member'}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Mobile Phone:</Text>
                    <Text style={styles.summaryValue}>{formattedPhoneDisplay || phone} (Verified)</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Email:</Text>
                    <Text style={styles.summaryValue}>{email}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Occupation:</Text>
                    <Text style={styles.summaryValue}>{occupation || 'Self-Employed'}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Estimated Income:</Text>
                    <Text style={[styles.summaryValue, { color: '#059669', fontWeight: '800' }]}>
                      ₱{Number(monthlyIncome || 35000).toLocaleString()}/mo
                    </Text>
                  </View>
                </View>

                {/* Terms of Service & Data Privacy Consent */}
                <View style={styles.consentGroup}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setAgreedTerms(!agreedTerms)}
                  >
                    <View style={[styles.checkbox, agreedTerms ? styles.checkboxChecked : null]}>
                      {agreedTerms && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.consentText}>
                      I accept the <Text style={styles.linkText}>Terms of Service</Text> and agree to microfinance lending guidelines.
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setAgreedPrivacy(!agreedPrivacy)}
                  >
                    <View style={[styles.checkbox, agreedPrivacy ? styles.checkboxChecked : null]}>
                      {agreedPrivacy && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.consentText}>
                      I consent to Republic Act 10173 (Data Privacy Act of 2012) and allow credit bureau evaluation.
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.continueButton, { backgroundColor: '#059669' }]}
                  onPress={handleCompleteRegistration}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.continueButtonText}>🚀 Activate Account & Open Portal</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {/* ========================================================================= */}
        {/* 2. MEMBER SIGN IN MODE */}
        {/* ========================================================================= */}
        {mode === 'login' && (
          <View>
            <View style={styles.brandContainer}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>HOSCOMO LENDING APP</Text>
              </View>
              <Text style={styles.title}>Member Sign In</Text>
              <Text style={styles.subtitle}>
                Sign in using your Philippine mobile number or registered email address.
              </Text>
            </View>

            {infoMessage ? (
              <View style={styles.infoBanner}>
                <Text style={styles.infoText}>{infoMessage}</Text>
              </View>
            ) : null}

            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mobile Phone Number or Email</Text>
                <TextInput
                  style={styles.input}
                  value={loginIdentifier}
                  onChangeText={setLoginIdentifier}
                  autoCapitalize="none"
                  placeholder="e.g. 09175554321 or teresa.alcantara@gmail.com"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordTextInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showLoginPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowLoginPassword(!showLoginPassword)}
                  >
                    <Text style={{ fontSize: 16 }}>{showLoginPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => {
                  setRecoveryEmailOrPhone(loginIdentifier);
                  setMode('forgot_password');
                }}
              >
                <Text style={styles.forgotLinkText}>Forgot password or PIN?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.continueButton}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.continueButtonText}>Sign In to Mobile App</Text>
                )}
              </TouchableOpacity>

              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>New borrower?</Text>
                <TouchableOpacity
                  onPress={() => {
                    setMode('register');
                    setRegStep(1);
                    setIsVerifyingOtp(false);
                  }}
                >
                  <Text style={styles.switchLink}> Register Now (Step-by-Step)</Text>
                </TouchableOpacity>
              </View>

              {/* Demo Credentials */}
              <View style={styles.demoCard}>
                <Text style={styles.demoTitle}>💡 Quick Demo Access</Text>
                <View style={styles.demoRow}>
                  <TouchableOpacity
                    style={styles.demoButton}
                    onPress={() => {
                      setLoginIdentifier('09175554321');
                      setPassword('Client@123');
                    }}
                  >
                    <Text style={styles.demoButtonText}>📱 Phone: 09175554321</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.demoButton}
                    onPress={() => {
                      setLoginIdentifier('teresa.alcantara@gmail.com');
                      setPassword('Client@123');
                    }}
                  >
                    <Text style={styles.demoButtonText}>✉️ Email: teresa@gmail.com</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 3. FORGOT PASSWORD & RECOVERY */}
        {/* ========================================================================= */}
        {mode === 'forgot_password' && (
          <View style={styles.formSection}>
            <View style={styles.brandContainer}>
              <Text style={styles.title}>Account Recovery</Text>
              <Text style={styles.subtitle}>
                Enter your registered mobile phone number or email to receive a recovery code.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Registered Phone Number or Email</Text>
              <TextInput
                style={styles.input}
                value={recoveryEmailOrPhone}
                onChangeText={setRecoveryEmailOrPhone}
                autoCapitalize="none"
                placeholder="09175554321 or you@example.com"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.continueButtonText}>Send 6-Digit Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setMode('login')}>
              <Text style={styles.cancelButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 4. RECOVERY OTP VERIFICATION */}
        {mode === 'verify_otp' && (
          <View style={styles.formSection}>
            <View style={styles.brandContainer}>
              <Text style={styles.title}>Enter Recovery Code</Text>
              <Text style={styles.subtitle}>Enter the 6-digit OTP code sent to your mobile or email.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>6-Digit Code</Text>
              <TextInput
                style={[styles.input, styles.largeOtpInput]}
                value={recoveryOtp}
                onChangeText={setRecoveryOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
                placeholderTextColor="#CBD5E1"
              />
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleVerifyRecoveryOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.continueButtonText}>Verify Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setMode('forgot_password')}>
              <Text style={styles.cancelButtonText}>Resend Code</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 5. RESET PASSWORD */}
        {mode === 'reset_password' && (
          <View style={styles.formSection}>
            <View style={styles.brandContainer}>
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.subtitle}>Choose a new secure password with at least 8 characters.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Enter new password"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.continueButtonText}>Save New Password & Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonIcon: {
    fontSize: 18,
    color: '#0F172A',
    marginRight: 4,
    fontWeight: '700',
  },
  backButtonText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  stepBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  stepBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 2,
  },
  stepTitleSection: {
    marginBottom: 18,
  },
  stepCategory: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  stepMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  formSection: {
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  telcoBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  telcoBadgeText: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  incomeInput: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    overflow: 'hidden',
  },
  countryPrefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  phFlag: {
    fontSize: 14,
    marginRight: 4,
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  phoneTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    overflow: 'hidden',
  },
  passwordTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldHelper: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 4,
  },
  strengthContainer: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  checklistContainer: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  checklistHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  checkIconGreen: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 6,
  },
  checkIconGray: {
    color: '#94A3B8',
    fontSize: 12,
    marginRight: 6,
  },
  checkTextGreen: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
  },
  checkTextGray: {
    color: '#64748B',
    fontSize: 11,
  },
  matchIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  matchSuccessText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  matchErrorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  otpCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  otpInstructions: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  otpInputRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  largeOtpInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
    color: '#0F172A',
    width: '80%',
  },
  otpTimerRow: {
    alignItems: 'center',
    marginTop: 8,
  },
  timerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  resendLink: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '700',
  },
  demoOtpChip: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'center',
    marginTop: 12,
  },
  demoOtpChipText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '700',
  },
  editPhoneBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  editPhoneBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  genderChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  genderChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  genderChipTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  statusChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  consentGroup: {
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  linkText: {
    color: '#059669',
    fontWeight: '700',
  },
  brandContainer: {
    marginBottom: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  badgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  infoBanner: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  infoText: {
    color: '#1E40AF',
    fontSize: 12,
    lineHeight: 16,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 14,
  },
  forgotLinkText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  switchText: {
    fontSize: 13,
    color: '#64748B',
  },
  switchLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  demoCard: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  demoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  demoButtonText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
});
