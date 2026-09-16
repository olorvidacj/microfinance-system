import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppTextInput, Avatar, Badge, InfoRow, LoadingView, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { ClientProfile } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import { validators } from '../../utils/validation';

export const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const [draft, setDraft] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const p = await api.getProfile();
      setProfile(p);
      setDraft({
        firstName: p.firstName ?? p.fullName.split(' ')[0] ?? '',
        middleName: p.middleName ?? '',
        lastName: p.lastName ?? '',
        email: p.email,
        phone: p.phone,
        secondaryPhone: p.secondaryPhone ?? '',
        occupation: p.occupation,
        employer: p.employer,
        monthlyIncome: p.monthlyIncome ? String(p.monthlyIncome) : '',
        address: p.address,
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to load profile.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const startEdit = () => {
    setEditing(true);
    setError(null);
    setSavedMsg(false);
  };

  const setField = (key: string) => (value: string) =>
    setDraft((d: any) => ({ ...d, [key]: value }));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const emailErr = validators.email(draft.email);
    const phoneErr = validators.phonePolicy(draft.phone);
    if (emailErr || phoneErr) {
      setError(emailErr || phoneErr || 'Please fix the highlighted fields.');
      setSaving(false);
      return;
    }
    try {
      const res = await api.updateProfile({
        email: draft.email,
        phone: draft.phone,
        secondaryPhone: draft.secondaryPhone || undefined,
        occupation: draft.occupation,
        employer: draft.employer,
        monthlyIncome: Number(draft.monthlyIncome) || 0,
        address: draft.address,
      });
      setSavedMsg(true);
      setEditing(false);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded || !profile || !draft) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="My Profile" />
        <LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="My Profile"
        right={
          editing ? (
            <TouchableOpacity onPress={() => setEditing(false)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={startEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          )
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {savedMsg ? (
          <View style={styles.savedBanner}>
            <Ionicons name="checkmark-circle" size={15} color={colors.green} />
            <Text style={styles.savedText}>Profile updated successfully.</Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <Avatar name={profile.fullName} size={72} uri={profile.avatar} />
          <Text style={styles.heroName}>{profile.fullName}</Text>
          <Text style={styles.heroMeta}>Member No. {profile.memberNumber}</Text>
          <View style={styles.heroBadges}>
            <Badge status={profile.kycStatus} dot size="md" />
            <View style={styles.scoreBadge}>
              <Ionicons name="speedometer-outline" size={13} color={colors.primary} />
              <Text style={styles.scoreText}>{profile.creditScore} · {profile.creditTier}</Text>
            </View>
          </View>
        </View>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          {editing ? (
            <>
              <AppTextInput label="First Name" value={draft.firstName} onChangeText={setField('firstName')} />
              <AppTextInput label="Middle Name" value={draft.middleName} onChangeText={setField('middleName')} />
              <AppTextInput label="Last Name" value={draft.lastName} onChangeText={setField('lastName')} />
            </>
          ) : (
            <>
              <InfoRow label="Date of birth" value={formatDate(profile.dateOfBirth)} />
              <InfoRow label="Gender" value={profile.gender ?? '—'} />
              <InfoRow label="Civil status" value={profile.civilStatus || '—'} />
              <InfoRow label="Nationality" value={profile.nationality ?? 'Filipino'} />
              <InfoRow label="Member since" value={formatDate(profile.membershipDate)} />
              <InfoRow label="KYC status" value={profile.kycStatus.replace(/_/g, ' ')} strong last />
            </>
          )}
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Contact Information</Text>
          {editing ? (
            <>
              <AppTextInput label="Mobile Number" value={draft.phone} onChangeText={setField('phone')} keyboardType="phone-pad" />
              <AppTextInput label="Secondary Phone" value={draft.secondaryPhone} onChangeText={setField('secondaryPhone')} keyboardType="phone-pad" />
              <AppTextInput label="Email" value={draft.email} onChangeText={setField('email')} autoCapitalize="none" keyboardType="email-address" />
            </>
          ) : (
            <>
              <InfoRow label="Mobile" value={profile.phone || '—'} />
              <InfoRow label="Secondary phone" value={profile.secondaryPhone ?? '—'} />
              <InfoRow label="Email" value={profile.email || '—'} last />
            </>
          )}
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Address</Text>
          {editing ? (
            <AppTextInput
              label="Complete Address"
              value={draft.address}
              onChangeText={setField('address')}
              multiline
              numberOfLines={2}
            />
          ) : (
            <InfoRow label="Address" value={profile.address || '—'} last />
          )}
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Employment & Income</Text>
          {editing ? (
            <>
              <AppTextInput label="Occupation" value={draft.occupation} onChangeText={setField('occupation')} />
              <AppTextInput label="Employer / Business" value={draft.employer} onChangeText={setField('employer')} />
              <AppTextInput
                label="Monthly Income (₱)"
                value={draft.monthlyIncome}
                onChangeText={setField('monthlyIncome')}
                keyboardType="numeric"
              />
            </>
          ) : (
            <>
              <InfoRow label="Occupation" value={profile.occupation || '—'} />
              <InfoRow label="Employer" value={profile.employer || '—'} />
              <InfoRow label="Monthly income" value={formatCurrency(profile.monthlyIncome)} last strong />
            </>
          )}
        </AppCard>

        {editing ? (
          <AppButton
            title="Save Changes"
            loading={saving}
            size="lg"
            onPress={save}
            icon={<Ionicons name="checkmark" size={18} color={colors.white} />}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  editText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  cancelText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { flex: 1, marginLeft: 8, fontSize: 12, color: colors.danger, fontWeight: '600' },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
  },
  savedText: { flex: 1, marginLeft: 8, fontSize: 12, color: colors.greenDark, fontWeight: '700' },
  hero: { alignItems: 'center', marginBottom: 16 },
  heroName: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 10 },
  heroMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  heroBadges: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 6,
  },
  scoreText: { fontSize: 11, fontWeight: '700', color: colors.primary, marginLeft: 4 },
  card: { marginBottom: 12 },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
});