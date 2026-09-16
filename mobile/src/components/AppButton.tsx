import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';

export interface AppButtonProps extends TouchableOpacityProps {
  title?: string;
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = true,
  disabled,
  style,
  ...rest
}) => {
  const bgMap: Record<string, string> = {
    primary: colors.primary,
    secondary: colors.teal,
    outline: 'transparent',
    ghost: 'transparent',
    danger: colors.danger,
    dark: colors.navy,
  };

  const textColorMap: Record<string, string> = {
    primary: colors.white,
    secondary: colors.white,
    outline: colors.primary,
    ghost: colors.primaryBright,
    danger: colors.white,
    dark: colors.white,
  };

  const borderMap: Record<string, string> = {
    outline: colors.primaryBorder,
    ghost: 'transparent',
  };

  const sizeMap = {
    sm: { py: 9, fs: 13, iconGap: 6 },
    md: { py: 13, fs: 14, iconGap: 8 },
    lg: { py: 16, fs: 16, iconGap: 10 },
  };

  const s = sizeMap[size];
  const isDark = variant === 'primary' || variant === 'secondary' || variant === 'danger' || variant === 'dark';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: bgMap[variant],
          borderWidth: borderMap[variant] ? 1 : 0,
          borderColor: borderMap[variant],
          paddingVertical: s.py,
        },
        fullWidth && styles.fullWidth,
        (disabled || loading) && { opacity: 0.55 },
        variant === 'primary' && shadows.hero,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColorMap[variant]} />
      ) : (
        <>
          {icon}
          {(title || children) && (
            <Text
              style={[
                styles.text,
                { color: textColorMap[variant], fontSize: s.fs },
                isDark && styles.textBold,
              ]}
            >
              {title || children}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontWeight: '600',
  },
  textBold: {
    fontWeight: '700',
  },
});