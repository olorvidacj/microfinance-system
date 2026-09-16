import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, AppModal, AppTextInput, LoadingView, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { NotificationPreferences, LoginActivityItem, PrivacyPreferences } from '../../types';
import { formatDateTime, humanizeStatus } from '../../utils/format';
import { validators } from '../../utils/validation';

export const SettingsScreen: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPreferences | null>(null);
  const [sessions, setSessions] = useState<LoginActivityItem[]>([]);

  const [pwModal, setPwModal] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [n, p, s] = await Promise.all([
          api.getNotificationPreferences(),
          api.getPrivacyPreferences(),
          api.getLoginActivity(),
        ]);
        setNotifPrefs(n);
        setPrivacyPrefs(p);
        setSessions(s);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const toggleNotif = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!notifPrefs) return;
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    try {
      await api.updateNotificationPreferences({ [key]: value });
    } catch {}
  };

  const togglePrivacy = (key: keyof PrivacyPreferences, value: boolean) => {
    if (!privacyPrefs) return;
    setPrivacyPrefs((prev) => ({ ...prev!, [key]: value }));
  };

  const submitPassword = async () => {
    setPwError(null);
    const err1 = validators.password(newPw);
    const err2 = validators.confirmPassword(confirmPw, newPw);
    if (err1 || err2) {
      setPwError(err1 || err2);
      return;
    }
    setChanging(true);
    try {
      // For the demo the endpoint is mocked; a real backend persists this change.
      await new Promise((r) => setTimeout(r, 650));
      setPwDone(true);
    } catch (err: any) {
      setPwError(err?.message || 'Unable to change password.');
    } finally {
      setChanging(false);
    }
  };

  if (!loaded || !notifPrefs || !privacyPrefs) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Settings" />
        <LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppCard style={styles.card} padded={false}>
          <TouchableOpacity style={styles.row} onPress={() => { setPwModal(true); setPwDone(false); setOldPw(''); setNewPw(''); setConfirmPw(''); setPwError(null); }} activeOpacity={0.8}>
            <View style={styles.rowIconDanger}>
              <Ionicons name="key-outline" size={18} color={colors.danger} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Change Password</Text>
              <Text style={styles.rowSub}>Update the password used to sign in</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => {}} activeOpacity={0.8}>
            <View style={styles.rowIcon}>
              <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Two-Factor Authentication</Text>
              <Text style={styles.rowSub}>Require a one-time code at sign in</Text>
            </View>
            <Switch
              value={false}
              onValueChange={() => {}}
              trackColor={{ true: colors.teal, false: colors.border }}
              thumbColor={colors.surface}
            />
          </TouchableOpacity>
        </AppCard>

        <Text style={styles.groupTitle}>Notification Preferences</Text>
        <AppCard style={styles.card} padded={false}>
          {([
            ['paymentReminders', 'Payment Reminders', 'Notify me before upcoming due dates'],
            ['loanUpdates', 'Loan Updates', 'Approvals, rejections, and schedule changes'],
            ['savingsUpdates', 'Savings Updates', 'Deposits, withdrawals, and interest'],
            ['announcements', 'Announcements', 'Cooperative news and events'],
          ] as Array<[keyof NotificationPreferences, string, string]>).map(([key, title, sub], i) => (
            <View key={key} style={[styles.row, i < 3 && styles.rowBorder]}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={styles.rowSub}>{sub}</Text>
              </View>
              <Switch
                value={notifPrefs[key]}
                onValueChange={(v) => toggleNotif(key, v)}
                trackColor={{ true: colors.teal, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
          ))}
        </AppCard>

        <Text style={styles.groupTitle}>Privacy</Text>
        <AppCard style={styles.card} padded={false}>
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Share data for analytics</Text>
              <Text style={styles.rowSub}>Help HOSCOMO improve its services</Text>
            </View>
            <Switch
              value={privacyPrefs.shareDataAnalytics}
              onValueChange={(v) => togglePrivacy('shareDataAnalytics', v)}
              trackColor={{ true: colors.teal, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Marketing SMS</Text>
              <Text style={styles.rowSub}>Optional promotional messages</Text>
            </View>
            <Switch
              value={privacyPrefs.allowSmsMarketing}
              onValueChange={(v) => togglePrivacy('allowSmsMarketing', v)}
              trackColor={{ true: colors.teal, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Email alerts</Text>
              <Text style={styles.rowSub}>Transactional notifications by email</Text>
            </View>
            <Switch
              value={privacyPrefs.allowEmailAlerts}
              onValueChange={(v) => togglePrivacy('allowEmailAlerts', v)}
              trackColor={{ true: colors.teal, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </AppCard>

        <Text style={styles.groupTitle}>Login Activity</Text>
        <AppCard style={styles.card} padded={false}>
          {sessions.map((s, i) => (
            <View key={s.id} style={[styles.row, i < sessions.length - 1 && styles.rowBorder]}>
              <View style={[styles.rowIcon, s.status === 'ACTIVE' && { backgroundColor: colors.greenSoft }]}>
                <Ionicons name="phone-portrait-outline" size={18} color={s.status === 'ACTIVE' ? colors.greenDark : colors.textMuted} />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.deviceRow}>
                  <Text style={styles.rowTitle}>{s.device}</Text>
                  <Text style={[styles.statusText, s.status === 'ACTIVE' ? { color: colors.green } : { color: colors.textFaint }]}>
                    {humanizeStatus(s.status)}
                  </Text>
                </View>
                <Text style={styles.rowSub}>{s.location}</Text>
                <Text style={styles.rowSub}>{formatDateTime(s.time)}</Text>
              </View>
            </View>
          ))}
        </AppCard>

        <Text style={styles.footerNote}>
          Your activity across devices is protected. Sign out of devices you no longer recognize.
        </Text>
      </ScrollView>

      <AppModal
        visible={pwModal && !pwDone}
        onClose={() => setPwModal(false)}
        title="Change Password"
        subtitle="Choose a password of at least 8 characters"
        icon="key-outline"
        iconColor={colors.danger}
        iconBg={colors.dangerSoft}
        confirmText="Update Password"
        onConfirm={submitPassword}
        confirmLoading={changing}
      >
        {pwError ? <Text style={styles.pwError}>{pwError}</Text> : null}
        <AppTextInput label="Current Password" value={oldPw} onChangeText={setOldPw} secure />
        <AppTextInput label="New Password" value={newPw} onChangeText={setNewPw} secure />
        <AppTextInput label="Confirm New Password" value={confirmPw} onChangeText={setConfirmPw} secure />
      </AppModal>

      <AppModal
        visible={pwModal && pwDone}
        onClose={() => { setPwModal(false); setPwDone(false); }}
        title="Password Updated"
        subtitle="Use your new password next time you sign in."
        icon="checkmark-circle-outline"
        iconColor={colors.green}
        iconBg={colors.greenSoft}
        confirmText="Done"
        onConfirm={() => { setPwModal(false); setPwDone(false); }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  card: { marginBottom: 6, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowIconDanger: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 11, color: colors.textMuted, marginTop: 1, lineHeight: 15 },
  deviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  footerNote: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 16, lineHeight: 16 },
  pwError: { fontSize: 12, color: colors.danger, fontWeight: '600', marginBottom: 10 },
});