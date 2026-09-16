import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton, AppTextInput } from '../../components';
import { AuthLayout } from './AuthLayout';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { firstError } from '../../utils/validation';
import { AuthStackParamList } from '../../navigation/types';
import { loadRememberme, saveRememberme } from '../../services/session';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRememberme().then((v) => {
      if (v) {
        setIdentifier(v);
        setRemember(true);
      }
    });
  }, []);

  const handleSignIn = async () => {
    setShowError(null);
    if (!identifier.trim()) {
      setShowError('Enter your email or Philippine mobile number.');
      return;
    }
    if (!password) {
      setShowError('Enter your password.');
      return;
    }
    setLoading(true);
    try {
      const session = await api.login(identifier.trim(), password);
      await saveRememberme(identifier.trim(), remember);
      await signIn(session);
    } catch (err: any) {
      setShowError(err?.message || 'Sign in failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your member account to access loans, savings, and self-service services."
      footer={
        <View style={styles.signupWrap}>
          <Text style={styles.signupText}>New to HOSCOMO? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.signupLink}>Register as Client</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.card}>
        {showError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{showError}</Text>
          </View>
        ) : null}

        <AppTextInput
          label="Email or Mobile Number"
          placeholder="e.g. teresa@example.com or 0917 555 4321"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          keyboardType="email-address"
          rightElement={<Ionicons name="person-outline" size={18} color={colors.textMuted} />}
        />

        <AppTextInput
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secure
          onSubmitEditing={handleSignIn}
          returnKeyType="go"
        />

        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={styles.rememberWrap}
            onPress={() => setRemember((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={remember ? 'checkbox' : 'square-outline'}
              size={20}
              color={remember ? colors.primary : colors.textFaint}
            />
            <Text style={styles.rememberText}>Remember me</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <AppButton title="Sign In" onPress={handleSignIn} loading={loading} size="lg" icon={<Ionicons name="log-in-outline" size={18} color={colors.white} />} />

        <View style={styles.demoNote}>
          <Ionicons name="flask-outline" size={13} color={colors.textFaint} />
          <Text style={styles.demoText}>
            Demo: use <Text style={styles.demoCode}>demo</Text> / any password · Branch personnel: any password containing "branch"
          </Text>
        </View>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginTop: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 2,
  },
  rememberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
    fontWeight: '600',
  },
  forgotText: {
    fontSize: 13,
    color: colors.teal,
    fontWeight: '700',
  },
  demoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  demoText: {
    fontSize: 11,
    color: colors.textFaint,
    marginLeft: 4,
    textAlign: 'center',
  },
  demoCode: {
    fontWeight: '700',
    color: colors.textMuted,
  },
  signupWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  signupLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '800',
  },
});