import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppTextInput, Avatar, Badge, ErrorView, InfoRow, LoadingView, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api, fieldErrorsOf, messageOf } from '../../services/api';
import type { ClientProfileView } from '../../shared/client';
import { CIVIL_STATUSES, PROFILE_LOCKED_MESSAGE, validateProfileUpdate } from '../../shared/kyc';
import { centsFromDb } from '../../shared/lending';
import { formatCurrency, formatDate } from '../../utils/format';

/** The fields a member may change themselves (shared/kyc-core/profile.ts); identity comes from KYC. */
type Draft = {
  phone: string;
  civilStatus: string;
  occupation: string;
  employer: string;
  monthlyIncome: string;
  address: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
};

const draftOf = (p: ClientProfileView): Draft => ({
  phone: p.phone,
  civilStatus: p.civilStatus,
  occupation: p.occupation,
  employer: p.employer,
  monthlyIncome: centsFromDb(p.monthlyIncome) > 0 ? p.monthlyIncome : '',
  address: p.address,
  barangay: p.barangay,
  cityMunicipality: p.cityMunicipality,
  province: p.province,
});

export const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<ClientProfileView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await api.getProfile();
      setProfile(p);
      setDraft(draftOf(p));
      setLoadError('');
    } catch (err) {
      setLoadError(messageOf(err, 'Your profile could not be loaded.'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const set = (key: keyof Draft) => (value: string) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async () => {
    if (!profile || !draft) return;
    // Only what the member changed, checked with the same rules as the server.
    const original = draftOf(profile);
    const changes = Object.fromEntries(Object.entries(draft).filter(([k, v]) => v !== original[k as keyof Draft]));
    if (!Object.keys(changes).length) {
      setEditing(false);
      return;
    }
    const v = validateProfileUpdate(changes);
    setErrors(v.errors);
    setSaveError('');
    if (!v.ok) return;
    setSaving(true);
    try {
      await api.updateProfile(changes);
      setSaved(true);
      setEditing(false);
      await load();
    } catch (err) {
      setErrors(fieldErrorsOf(err));
      setSaveError(messageOf(err, 'Your details could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  if (loadError && !profile) return <SafeAreaView style={styles.safe}><ScreenHeader title="My Profile" /><ErrorView message={loadError} onRetry={load} /></SafeAreaView>;
  if (!profile || !draft) return <SafeAreaView style={styles.safe}><ScreenHeader title="My Profile" /><LoadingView text="Loading your profile…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="My Profile"
        right={
          <TouchableOpacity
            onPress={() => {
              if (editing) setDraft(draftOf(profile));
              setEditing(!editing);
              setErrors({});
              setSaveError('');
              setSaved(false);
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={editing ? styles.cancelText : styles.editText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {saveError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        ) : null}
        {saved ? (
          <View style={styles.savedBanner}>
            <Ionicons name="checkmark-circle" size={15} color={colors.green} />
            <Text style={styles.savedText}>Your details were saved.</Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <Avatar name={profile.fullName} size={72} uri={profile.avatar} />
          <Text style={styles.heroName}>{profile.fullName}</Text>
          <Text style={styles.heroMeta}>Member No. {profile.memberNumber} · Joined {formatDate(profile.membershipDate)}</Text>
          <View style={styles.heroBadges}>
            <Badge status={profile.kycStatus} dot size="md" />
            <View style={styles.scoreBadge}>
              <Ionicons name="speedometer-outline" size={13} color={colors.primary} />
              <Text style={styles.scoreText}>Score {profile.creditScore} · Tier {profile.creditTier}</Text>
            </View>
          </View>
        </View>

        {editing ? (
          <>
            <Text style={styles.lockNote}>{PROFILE_LOCKED_MESSAGE}</Text>
            <AppCard style={styles.card}>
              <Text style={styles.cardTitle}>Contact</Text>
              <AppTextInput label="Mobile number" value={draft.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={errors.phone} />
              <Text style={styles.label}>Civil status</Text>
              <View style={styles.chips}>
                {CIVIL_STATUSES.map((c) => (
                  <TouchableOpacity key={c} onPress={() => set('civilStatus')(c)} style={[styles.chip, draft.civilStatus === c && styles.chipActive]} accessibilityLabel={c}>
                    <Text style={[styles.chipText, draft.civilStatus === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.civilStatus ? <Text style={styles.fieldError}>{errors.civilStatus}</Text> : null}
            </AppCard>
            <AppCard style={styles.card}>
              <Text style={styles.cardTitle}>Address</Text>
              <AppTextInput label="Street address" value={draft.address} onChangeText={set('address')} error={errors.address} />
              <AppTextInput label="Barangay" value={draft.barangay} onChangeText={set('barangay')} error={errors.barangay} />
              <AppTextInput label="City / municipality" value={draft.cityMunicipality} onChangeText={set('cityMunicipality')} error={errors.cityMunicipality} />
              <AppTextInput label="Province" value={draft.province} onChangeText={set('province')} error={errors.province} />
            </AppCard>
            <AppCard style={styles.card}>
              <Text style={styles.cardTitle}>Work and income</Text>
              <AppTextInput label="Occupation" value={draft.occupation} onChangeText={set('occupation')} error={errors.occupation} />
              <AppTextInput label="Employer / business" value={draft.employer} onChangeText={set('employer')} error={errors.employer} />
              <AppTextInput label="Monthly income (₱)" value={draft.monthlyIncome} onChangeText={set('monthlyIncome')} keyboardType="decimal-pad" error={errors.monthlyIncome} />
            </AppCard>
            <AppButton title="Save changes" loading={saving} size="lg" onPress={save} icon={<Ionicons name="checkmark" size={18} color={colors.white} />} />
          </>
        ) : (
          <>
            <AppCard style={styles.card}>
              <Text style={styles.cardTitle}>Personal information</Text>
              <InfoRow label="Date of birth" value={formatDate(profile.dateOfBirth)} />
              <InfoRow label="Gender" value={profile.gender || '—'} />
              <InfoRow label="Civil status" value={profile.civilStatus || '—'} />
              <InfoRow label="Employment" value={profile.employmentStatus || '—'} last />
            </AppCard>
            <AppCard style={styles.card}>
              <Text style={styles.cardTitle}>Contact</Text>
              <InfoRow label="Mobile" value={profile.phone || '—'} />
              <InfoRow label="Email" value={profile.email || '—'} last />
            </AppCard>
            <AppCard style={styles.card}>
              <Text style={styles.cardTitle}>Address</Text>
              <InfoRow label="Street" value={profile.address || '—'} />
              <InfoRow label="Barangay" value={profile.barangay || '—'} />
              <InfoRow label="City / province" value={[profile.cityMunicipality, profile.province].filter(Boolean).join(', ') || '—'} />
              <InfoRow label="Postal code" value={profile.postalCode || '—'} last />
            </AppCard>
            <AppCard style={styles.card}>
              <Text style={styles.cardTitle}>Work and income</Text>
              <InfoRow label="Occupation" value={profile.occupation || '—'} />
              <InfoRow label="Employer" value={profile.employer || '—'} />
              <InfoRow label="Monthly income" value={formatCurrency(profile.monthlyIncome)} strong last />
            </AppCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  editText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  cancelText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: radius.md, padding: 10, marginBottom: 12 },
  errorText: { flex: 1, marginLeft: 8, fontSize: 12, color: colors.danger, fontWeight: '600' },
  savedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: colors.greenBorder, borderRadius: radius.md, padding: 10, marginBottom: 12 },
  savedText: { flex: 1, marginLeft: 8, fontSize: 12, color: colors.greenDark, fontWeight: '700' },
  hero: { alignItems: 'center', marginBottom: 16 },
  heroName: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 10, textAlign: 'center' },
  heroMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  heroBadges: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.round, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6 },
  scoreText: { fontSize: 11, fontWeight: '700', color: colors.primary, marginLeft: 4 },
  lockNote: { fontSize: 12, color: colors.textMuted, marginBottom: 12, lineHeight: 17 },
  card: { marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 4, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.round, borderWidth: 1, borderColor: colors.border, marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  fieldError: { fontSize: 11, color: colors.danger, marginTop: 2 },
});
