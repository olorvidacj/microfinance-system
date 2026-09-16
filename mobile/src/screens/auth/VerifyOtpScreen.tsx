import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../components';
import { AuthLayout } from './AuthLayout';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyOtp'>;

export const VerifyOtpScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email, mode } = route.params;
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setError(null);
    if (otp.trim().length < 6) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyOtp(email, otp.trim());
      if (!res.verified && res.verified === false) {
        setError('Invalid verification code. Please check and try again.');
        setLoading(false);
        return;
      }
      navigation.replace('ResetPassword', { email });
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Enter verification code"
      subtitle={`We sent a 6-digit code to ${email}.`}
    >
      <View style={styles.otpWrap}>
        <TextInput
          style={styles.otpInput}
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="••••••"
          placeholderTextColor={colors.textFaint}
          textAlign="center"
          autoFocus
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppButton title="Verify Code" onPress={handleVerify} loading={loading} />
      <Text style={styles.hint}>
        Demo code: 123456
      </Text>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  otpWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  otpInput: {
    fontSize: 28,
    letterSpacing: 12,
    fontWeight: '800',
    color: colors.text,
    height: 60,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 14,
  },
});