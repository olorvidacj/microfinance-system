import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { evaluatePassword, PasswordStrengthResult } from '../utils/passwordValidator';
import { colors, radius } from '../theme';

interface PasswordStrengthIndicatorProps {
  password: string;
  confirmPassword?: string;
  showChecklist?: boolean;
  showConfirmMatch?: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  confirmPassword,
  showChecklist = true,
  showConfirmMatch = true,
}) => {
  const result: PasswordStrengthResult = evaluatePassword(password);
  const { criteria, score, level, label, color } = result;

  const hasPassword = password.length > 0;
  const hasConfirm = confirmPassword !== undefined && confirmPassword.length > 0;
  const isMatch = hasPassword && hasConfirm && password === confirmPassword;
  const isMismatch = hasConfirm && password !== confirmPassword;

  const checklistItems = [
    { label: 'At least 8 characters', met: criteria.minLength },
    { label: 'Uppercase letter (A–Z)', met: criteria.hasUpper },
    { label: 'Lowercase letter (a–z)', met: criteria.hasLower },
    { label: 'Number (0–9)', met: criteria.hasNumber },
    { label: 'Special character (!@#$%^&*)', met: criteria.hasSpecial },
  ];

  return (
    <View style={styles.container}>
      {/* Strength Bar & Label */}
      {hasPassword ? (
        <View style={styles.meterContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.meterTitle}>Password strength:</Text>
            <Text style={[styles.meterValue, { color }]}>{label}</Text>
          </View>
          <View style={styles.barBackground}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.max(result.percentage, 5)}%`,
                  backgroundColor: color,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      {/* Checklist */}
      {showChecklist ? (
        <View style={styles.checklistCard}>
          <Text style={styles.checklistHeader}>Password Requirements:</Text>
          <View style={styles.checklistGrid}>
            {checklistItems.map((item, idx) => (
              <View key={idx} style={styles.checkItem}>
                <View
                  style={[
                    styles.checkbox,
                    item.met ? styles.checkboxChecked : styles.checkboxUnchecked,
                  ]}
                >
                  {item.met ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.checkLabel,
                    item.met
                      ? styles.checkLabelChecked
                      : hasPassword
                      ? styles.checkLabelActive
                      : styles.checkLabelUnchecked,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Confirm Password Match Indicator */}
      {showConfirmMatch && hasConfirm ? (
        <View
          style={[
            styles.matchBanner,
            isMatch ? styles.matchBannerSuccess : styles.matchBannerError,
          ]}
        >
          <Ionicons
            name={isMatch ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={isMatch ? colors.greenDark : colors.danger}
          />
          <Text
            style={[
              styles.matchText,
              isMatch ? styles.matchTextSuccess : styles.matchTextError,
            ]}
          >
            {isMatch ? 'Passwords match' : 'Passwords do not match'}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 6,
    gap: 8,
  },
  meterContainer: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  meterValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  barBackground: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  checklistCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    padding: 10,
    gap: 6,
  },
  checklistHeader: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#475569',
    marginBottom: 2,
  },
  checklistGrid: {
    gap: 5,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
  },
  checkboxUnchecked: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  checkLabel: {
    fontSize: 11,
  },
  checkLabelChecked: {
    color: '#065F46',
    fontWeight: '600',
  },
  checkLabelActive: {
    color: '#475569',
    fontWeight: '400',
  },
  checkLabelUnchecked: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    gap: 6,
    borderWidth: 1,
  },
  matchBannerSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  matchBannerError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  matchText: {
    fontSize: 11,
    fontWeight: '600',
  },
  matchTextSuccess: {
    color: '#065F46',
  },
  matchTextError: {
    color: '#DC2626',
  },
});

export default PasswordStrengthIndicator;
