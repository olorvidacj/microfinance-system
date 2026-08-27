import React, { useState } from 'react';
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

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);

  // Form Fields
  // In Login: loginIdentifier can be phone number or email
  const [loginIdentifier, setLoginIdentifier] = useState('09175554321');
  const [password, setPassword] = useState('Client@123');

  // In Registration: ONLY phone number is required (+ optional password)
  const [phone, setPhone] = useState('');
  const [regPassword, setRegPassword] = useState('Client@123');

  // Recovery
  const [recoveryEmailOrPhone, setRecoveryEmailOrPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

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
      Alert.alert('Login Failed', err.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      Alert.alert('Phone Number Required', 'Please enter your mobile phone number to register.');
      return;
    }
    const digits = cleanPhone.replace(/\D/g, '');
    if (digits.length < 7) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10 to 12 digit mobile phone number.');
      return;
    }
    if (regPassword && regPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const session = await api.register({
        phone: cleanPhone,
        password: regPassword || 'Client@123',
      });
      Alert.alert(
        'Account Created! 🎉',
        'Welcome to HOSCOMO Mobile. You can now complete your full legal name, ID details, and KYC in your Profile tab.',
        [
          {
            text: 'Continue to App',
            onPress: () => onSuccess(session),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Unable to register with this phone number.');
    } finally {
      setLoading(false);
    }
  };

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
        setOtp(res.demoOtp);
      }
      setMode('verify_otp');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      Alert.alert('Required', 'Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      await api.verifyOtp(recoveryEmailOrPhone.trim(), otp);
      setMode('reset_password');
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.resetPassword(recoveryEmailOrPhone.trim(), otp, newPassword);
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>HOSCOMO MOBILE APP</Text>
          </View>
          <Text style={styles.title}>
            {mode === 'login' && 'Member Sign In'}
            {mode === 'register' && 'Quick Registration'}
            {mode === 'forgot_password' && 'Account Recovery'}
            {mode === 'verify_otp' && 'OTP Verification'}
            {mode === 'reset_password' && 'Set New Password'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'login' && 'Sign in using your mobile phone number or registered email.'}
            {mode === 'register' && 'Only your phone number is needed to get started. You can fill up all personal details in your profile anytime.'}
            {mode === 'forgot_password' && 'Enter your phone number or email to receive a one-time verification code.'}
            {mode === 'verify_otp' && 'Enter the 6-digit OTP code sent to your mobile or email.'}
            {mode === 'reset_password' && 'Choose a new secure password or PIN for your account.'}
          </Text>
        </View>

        {infoMessage ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>{infoMessage}</Text>
          </View>
        ) : null}

        {/* 1. LOGIN MODE */}
        {mode === 'login' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Phone Number or Email</Text>
              <TextInput
                style={styles.input}
                value={loginIdentifier}
                onChangeText={setLoginIdentifier}
                autoCapitalize="none"
                placeholder="e.g. 09175554321 or client@gmail.com"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
              />
            </View>

            <TouchableOpacity
              style={styles.forgotLink}
              onPress={() => {
                setRecoveryEmailOrPhone(loginIdentifier);
                setMode('forgot_password');
              }}
            >
              <Text style={styles.forgotLinkText}>Forgot your password / PIN?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In to Mobile App</Text>
              )}
            </TouchableOpacity>

            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>New member?</Text>
              <TouchableOpacity onPress={() => setMode('register')}>
                <Text style={styles.switchLink}> Register with Phone Number</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 2. REGISTRATION MODE - ONLY PHONE NUMBER NEEDED */}
        {mode === 'register' && (
          <View style={styles.form}>
            {/* Quick Phone Notice Callout */}
            <View style={styles.fastRegNotice}>
              <Text style={styles.fastRegNoticeTitle}>📱 Fast 1-Step Registration</Text>
              <Text style={styles.fastRegNoticeBody}>
                Only your phone number is required now. Fill in your legal name, address, and KYC details inside your Profile whenever you are ready.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Phone Number *</Text>
              <TextInput
                style={[styles.input, styles.highlightInput]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="e.g. 0917 123 4567 or +63 917 123 4567"
                autoFocus
              />
              <Text style={styles.helperText}>We will use this phone number for your login and loan alerts.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Create Password / PIN</Text>
              <TextInput
                style={styles.input}
                value={regPassword}
                onChangeText={setRegPassword}
                secureTextEntry
                placeholder="Choose a password or 6-digit PIN"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: '#059669' }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>⚡ Create Account with Phone Number</Text>
              )}
            </TouchableOpacity>

            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => setMode('login')}>
                <Text style={styles.switchLink}> Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 3. FORGOT PASSWORD MODE */}
        {mode === 'forgot_password' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Registered Phone Number or Email</Text>
              <TextInput
                style={styles.input}
                value={recoveryEmailOrPhone}
                onChangeText={setRecoveryEmailOrPhone}
                autoCapitalize="none"
                placeholder="09175554321 or you@example.com"
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Send 6-Digit Verification Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setMode('login')}>
              <Text style={styles.cancelButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 4. OTP VERIFICATION MODE */}
        {mode === 'verify_otp' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>6-Digit OTP Code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setMode('forgot_password')}>
              <Text style={styles.cancelButtonText}>Resend Code</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 5. RESET PASSWORD MODE */}
        {mode === 'reset_password' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password / PIN</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Enter new password"
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Update Password & Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Demo Helper */}
        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>💡 Quick Demo Accounts</Text>
          <View style={styles.demoRow}>
            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => {
                setLoginIdentifier('09175554321');
                setPassword('Client@123');
                setMode('login');
              }}
            >
              <Text style={styles.demoButtonText}>📱 Phone: 09175554321</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => {
                setLoginIdentifier('client@gmail.com');
                setPassword('Client@123');
                setMode('login');
              }}
            >
              <Text style={styles.demoButtonText}>✉️ Email: client@gmail.com</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  brandContainer: {
    marginBottom: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
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
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  infoText: {
    color: '#1E40AF',
    fontSize: 12,
  },
  fastRegNotice: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  fastRegNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  fastRegNoticeBody: {
    fontSize: 12,
    color: '#15803D',
    lineHeight: 17,
  },
  form: {
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  highlightInput: {
    borderColor: '#059669',
    backgroundColor: '#FAFCFB',
    fontSize: 15,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    paddingVertical: 10,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotLinkText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
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
  demoCard: {
    marginTop: 24,
    paddingTop: 16,
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
