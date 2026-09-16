import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton, AppTextInput } from '../../components';
import { AuthLayout } from './AuthLayout';
import { colors } from '../../theme';
import { api } from '../../services/api';
import { validators } from '../../utils/validation';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email } = route.params;
  const { signIn } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setErrors({});
    setServerError(null);
    const pwErr = validators.password(password);
    const cfErr = validators.confirmPassword(confirm, password);
    setErrors({ password: pwErr, confirm: cfErr });
    if (pwErr || cfErr) return;
    setLoading(true);
    try {
      await api.resetPassword(email, '123456', password);
      // Auto sign in with the new password so the client lands in the app.
      try {
        const session = await api.login(email, password);
        await signIn(session);
        return;
      } catch {
        navigation.popToTop();
      }
    } catch (err: any) {
      setServerError(err?.message || 'Password reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create new password"
      subtitle="Choose a strong password of at least 8 characters. You will use it to sign in next time."
    >
      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
      <AppTextInput
        label="New Password"
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        secure
        error={errors.password}
      />
      <AppTextInput
        label="Confirm Password"
        placeholder="Re-enter your new password"
        value={confirm}
        onChangeText={setConfirm}
        secure
        error={errors.confirm}
      />
      <AppButton title="Reset Password" onPress={handleReset} loading={loading} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
});