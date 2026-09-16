import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

export const LoadingView: React.FC<{ text?: string; style?: ViewStyle; color?: string }> = ({
  text = 'Loading...',
  style,
  color = colors.primary,
}) => (
  <View style={[styles.center, style]}>
    <ActivityIndicator size="large" color={color} />
    <Text style={styles.text}>{text}</Text>
  </View>
);

export const EmptyState: React.FC<{
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}> = ({ icon = 'folder-open-outline', title = 'Nothing here yet', message, children, style }) => (
  <View style={[styles.empty, style]}>
    <View style={styles.emptyIcon}>
      <Ionicons name={icon} size={28} color={colors.textFaint} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {message ? <Text style={styles.emptyMsg}>{message}</Text> : null}
    {children}
  </View>
);

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  text: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title3,
    textAlign: 'center',
  },
  emptyMsg: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 19,
  },
});