import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, AppModal, AppTextInput, ErrorView, LoadingView, PasswordStrengthIndicator, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api, fieldErrorsOf, messageOf } from '../../services/api';
import type { SignInView } from '../../shared/client';
import { formatDateTime } from '../../utils/format';
import { validators } from '../../utils/validation';

/** Account security: change password and recent sign-ins (same as the web portal's Settings). */
export const SettingsScreen: React.FC = () => {
  const [signIns, setSignIns] = useState<SignInView[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [changing, setChanging] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  const load = useCallback(async () => {
    try {
      setSignIns(await api.getSignIns());
      setError('');
    } catch (err) {
      setError(messageOf(err, 'Your recent sign-ins could not be loaded.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openPassword = () => {
    setPwOpen(true);
    setPwDone(false);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwErrors({});
  };

  const submitPassword = async () => {
    const e: Record<string, string> = {};
    if (!currentPw) e.currentPassword = 'Enter your current password.';
    const strength = validators.password(newPw);
    if (strength) e.newPassword = strength;
    else if (newPw === currentPw) e.newPassword = 'Choose a password different from your current one.';
    const match = validators.confirmPassword(confirmPw, newPw);
    if (match) e.confirmPassword = match;
    setPwErrors(e);
    if (Object.keys(e).length) return;
    setChanging(true);
    try {
      await api.changePassword(currentPw, newPw);
      setPwDone(true);
    } catch (err) {
      setPwErrors({ ...fieldErrorsOf(err), submit: messageOf(err, 'Your password could not be changed.') });
    } finally {
      setChanging(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Settings" subtitle="Password and recent sign-ins" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
        <AppCard style={styles.card} padded={false}>
          <TouchableOpacity style={styles.row} onPress={openPassword} activeOpacity={0.8} accessibilityLabel="Change password">
            <View style={styles.rowIcon}>
              <Ionicons name="key-outline" size={18} color={colors.danger} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Change password</Text>
              <Text style={styles.rowSub}>Update the password used to sign in</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        </AppCard>

        <Text style={styles.groupTitle}>Recent sign-ins</Text>
        {error ? (
          <ErrorView message={error} onRetry={load} style={{ flex: 0, paddingVertical: 24 }} />
        ) : signIns === null ? (
          <LoadingView style={{ flex: 0, paddingVertical: 24 }} />
        ) : signIns.length === 0 ? (
          <Text style={styles.rowSub}>No sign-ins recorded yet.</Text>
        ) : (
          <AppCard style={styles.card} padded={false}>
            {signIns.map((s, i) => (
              <View key={s.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Ionicons name="log-in-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.rowTitle, { marginLeft: 10, fontWeight: '600' }]}>{formatDateTime(s.time)}</Text>
              </View>
            ))}
          </AppCard>
        )}
        <Text style={styles.footerNote}>If you see a sign-in you don't recognise, change your password and tell your branch.</Text>
      </ScrollView>

      <AppModal
        visible={pwOpen && !pwDone}
        onClose={() => setPwOpen(false)}
        title="Change password"
        icon="key-outline"
        iconColor={colors.danger}
        iconBg={colors.dangerSoft}
        confirmText="Update password"
        onConfirm={submitPassword}
        confirmLoading={changing}
      >
        {pwErrors.submit ? <Text style={styles.pwError}>{pwErrors.submit}</Text> : null}
        <AppTextInput label="Current password" value={currentPw} onChangeText={setCurrentPw} secure error={pwErrors.currentPassword} />
        <AppTextInput label="New password" value={newPw} onChangeText={setNewPw} secure error={pwErrors.newPassword} />
        <AppTextInput label="Confirm new password" value={confirmPw} onChangeText={setConfirmPw} secure error={pwErrors.confirmPassword} />
        <PasswordStrengthIndicator password={newPw} confirmPassword={confirmPw} />
      </AppModal>

      <AppModal
        visible={pwOpen && pwDone}
        onClose={() => setPwOpen(false)}
        title="Password updated"
        subtitle="Use your new password next time you sign in."
        icon="checkmark-circle-outline"
        iconColor={colors.green}
        iconBg={colors.greenSoft}
        confirmText="Done"
        onConfirm={() => setPwOpen(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  groupTitle: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  card: { marginBottom: 6, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  rowIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowBody: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 1, lineHeight: 16 },
  footerNote: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 16, lineHeight: 16 },
  pwError: { fontSize: 12, color: colors.danger, fontWeight: '600', marginBottom: 10 },
});
