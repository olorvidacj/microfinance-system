import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton, AppTextInput } from '../../components';
import { AuthLayout } from './AuthLayout';
import { colors } from '../../theme';
import { api } from '../../services/api';
import { validators } from '../../utils/validation';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setEmailError(null);
    setServerError(null);
    setInfo(null);
    const err = validators.email(email);
    if (err) {
      setEmailError(err);
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgotPassword(email.trim());
      setInfo(`A verification code was sent to ${email.trim()}.`);
      navigation.navigate('VerifyOtp', { email: email.trim(), mode: 'reset' });
    } catch (err: any) {
      setServerError(err?.message || 'Unable to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter the email address registered with your HOSCOMCO account and we will send you a verification code."
    >
      {serverError ? <Text style={styles.errorText}>{serverError}</Text> : null}
      <AppTextInput
        label="Registered Email"
        placeholder="e.g. teresa@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        error={emailError}
      />
      <AppButton title="Send Verification Code" onPress={handleSubmit} loading={loading} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
});