import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

export interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  secure?: boolean;
  rightElement?: React.ReactNode;
  containerStyle?: any;
}

export const AppTextInput: React.FC<AppTextInputProps> = ({
  label,
  error,
  hint,
  secure,
  rightElement,
  containerStyle,
  style,
  ...rest
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isSecure = secure && !showPassword;

  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        <TextInput
          placeholderTextColor={colors.textFaint}
          style={[styles.input, isSecure && styles.inputPadded, style]}
          secureTextEntry={isSecure}
          {...rest}
        />
        {secure ? (
          <TouchableOpacity
            style={styles.eye}
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        ) : (
          rightElement
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  inputPadded: {
    paddingRight: 46,
  },
  eye: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },
  error: {
    marginTop: 4,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  hint: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textFaint,
  },
});