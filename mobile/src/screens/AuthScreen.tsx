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
  const [email, setEmail] = useState('client@gmail.com');
  const [password, setPassword] = useState('Client@123');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [borrowerNumber, setBorrowerNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const session = await api.login(email, password);
      onSuccess(session);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Validation Error', 'Please fill in full name, email, and password.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const session = await api.register({
        fullName,
        email,
        phone,
        password,
        borrowerNumber: borrowerNumber || undefined,
      });
      Alert.alert('Registration Successful', 'Welcome to HOSCOMO Mobile Banking!');
      onSuccess(session);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Unable to complete registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Required', 'Please enter your registered email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
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
      await api.verifyOtp(email, otp);
      setMode('reset_password');
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Invalid Password', 'New password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.resetPassword(email, otp, newPassword);
      Alert.alert('Password Reset', res.message);
      setPassword(newPassword);
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
            {mode === 'register' && 'Client Registration'}
            {mode === 'forgot_password' && 'Forgot Password'}
            {mode === 'verify_otp' && 'OTP Verification'}
            {mode === 'reset_password' && 'Set New Password'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'login' && 'Access your loan balances, savings passbook, and submit applications on the go.'}
            {mode === 'register' && 'Create your mobile client account. Existing members are auto-linked.'}
            {mode === 'forgot_password' && 'Enter your email to receive a 6-digit one-time verification code.'}
            {mode === 'verify_otp' && 'Enter the 6-digit OTP code sent to your registered email.'}
            {mode === 'reset_password' && 'Choose a strong password with at least 8 characters.'}
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
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="e.g. client@gmail.com"
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
              onPress={() => setMode('forgot_password')}
            >
              <Text style={styles.forgotLinkText}>Forgot your password?</Text>
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
              <Text style={styles.switchText}>New coop member?</Text>
              <TouchableOpacity onPress={() => setMode('register')}>
                <Text style={styles.switchLink}> Register Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 2. REGISTRATION MODE */}
        {mode === 'register' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Maria Santos"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="maria.santos@gmail.com"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+63 917 XXX XXXX"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Passbook / Member Number (Optional)</Text>
              <TextInput
                style={styles.input}
                value={borrowerNumber}
                onChangeText={setBorrowerNumber}
                placeholder="MBR-2024-001"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password (Min. 8 characters)</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Complete Mobile Registration</Text>
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

        {/* 3. FORGOT PASSWORD MODE */}
        {mode === 'forgot_password' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Registered Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
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
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="••••••••"
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
          <Text style={styles.demoTitle}>💡 One-Tap Demo Profiles</Text>
          <TouchableOpacity
            style={styles.demoButton}
            onPress={() => {
              setEmail('client@gmail.com');
              setPassword('Client@123');
              setMode('login');
            }}
          >
            <Text style={styles.demoButtonText}>Client: client@gmail.com (Client@123)</Text>
          </TouchableOpacity>
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
    lineHeight: 19,
  },
  infoBanner: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#1D4ED8',
    lineHeight: 17,
  },
  form: {
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: '700',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotLinkText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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
    marginTop: 18,
  },
  switchText: {
    fontSize: 13,
    color: '#64748B',
  },
  switchLink: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '700',
  },
  demoCard: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  demoButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  demoButtonText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
});
