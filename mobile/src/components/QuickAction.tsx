import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../theme';

export interface QuickActionProps {
  label: string;
  caption?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  bg?: string;
  onPress?: () => void;
  disabled?: boolean;
  disabledLabel?: string;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  label,
  caption,
  icon,
  color = colors.primary,
  bg = colors.primarySoft,
  onPress,
  disabled,
  disabledLabel,
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={[styles.iconWrap, { backgroundColor: disabled ? colors.background : bg }]}>
        <Ionicons name={icon} size={20} color={disabled ? colors.textFaint : color} />
      </View>
      <Text style={styles.label}>{label}</Text>
      {caption ? <Text style={styles.caption} numberOfLines={2}>{caption}</Text> : null}
      {disabled && disabledLabel ? <Text style={styles.disabledLabel}>{disabledLabel}</Text> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardDisabled: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  caption: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  disabledLabel: {
    fontSize: 10,
    color: colors.danger,
    fontWeight: '700',
    marginTop: 4,
  },
});