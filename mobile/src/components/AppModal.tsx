import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from './AppButton';
import { colors, radius, spacing, typography } from '../theme';

export interface ConfirmOption {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'outline';
  loading?: boolean;
}

export interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  children?: React.ReactNode;
  confirmText?: string;
  onConfirm?: () => void;
  confirmLoading?: boolean;
  confirmVariant?: 'primary' | 'danger' | 'secondary';
  cancelText?: string;
  showCancel?: boolean;
  dismissable?: boolean;
}

export const AppModal: React.FC<AppModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  iconColor = colors.primary,
  iconBg = colors.primarySoft,
  children,
  confirmText,
  onConfirm,
  confirmLoading,
  confirmVariant = 'primary',
  cancelText = 'Cancel',
  showCancel = true,
  dismissable = true,
}) => {
  const close = () => {
    if (dismissable && !confirmLoading) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            {showCancel ? (
              <TouchableOpacity onPress={close} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
              <Ionicons name={icon} size={26} color={iconColor} />
            </View>
          ) : null}

          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>

          {confirmText && onConfirm ? (
            <View style={styles.actions}>
              {showCancel ? (
                <TouchableOpacity
                  style={[styles.cancelBtn, { marginRight: spacing.sm }]}
                  onPress={close}
                  disabled={confirmLoading}
                >
                  <Text style={styles.cancelText}>{cancelText}</Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.flex1}>
                <AppButton
                  title={confirmText}
                  onPress={onConfirm}
                  loading={confirmLoading}
                  variant={confirmVariant === 'danger' ? 'danger' : confirmVariant === 'secondary' ? 'secondary' : 'primary'}
                />
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  overlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.xl,
    maxHeight: '85%',
  },
  handleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    padding: 4,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  content: {
    marginTop: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  flex1: {
    flex: 1,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
});