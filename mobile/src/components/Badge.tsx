import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { statusBgColor, statusColor, humanizeStatus } from '../utils/format';
import { radius } from '../theme';

export interface BadgeProps {
  label?: string;
  status?: string;
  color?: string;
  bg?: string;
  dot?: boolean;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ label, status, color, bg, dot, size = 'sm' }) => {
  const statusText = label ?? (status ? humanizeStatus(status) : '');
  const fg = color ?? (status ? statusColor(status) : undefined) ?? '#475569';
  const background = bg ?? (status ? statusBgColor(status) : undefined) ?? '#F1F5F9';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: background },
        size === 'sm' ? styles.sm : styles.md,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <Text style={[styles.text, { color: fg }, size === 'md' && styles.textMd]}>
        {statusText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.round,
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  md: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  textMd: {
    fontSize: 11,
  },
});