import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, typography } from '../theme';

export interface StatCardProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  bg?: string;
  sub?: string;
  compact?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color = colors.primary, bg, sub, compact }) => {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: bg ?? colors.primarySoft }]}>
          <Ionicons name={icon} size={compact ? 16 : 18} color={color} />
        </View>
      ) : null}
      <View style={styles.content}>
        <Text style={[styles.value, compact && styles.valueCompact]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardCompact: {
    padding: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  content: {},
  value: {
    ...typography.title3,
    fontSize: 17,
  },
  valueCompact: {
    fontSize: 15,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  sub: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 4,
  },
});