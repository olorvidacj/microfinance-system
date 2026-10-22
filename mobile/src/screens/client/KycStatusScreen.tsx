import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, Badge, DocRow, ErrorView, InfoRow, LoadingView, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api, messageOf } from '../../services/api';
import { kycCanEdit, type KycStatusView } from '../../shared/client';
import { KYC_SECTION_LABELS, isAwaitingReview, kycGateMessage, parseSections } from '../../shared/kyc';
import { formatDateTime } from '../../utils/format';
import type { HomeStackParamList } from '../../navigation/types';

/** The member's KYC status, decision reasons and required documents (same data as the web portal). */
export const KycStatusScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [data, setData] = useState<KycStatusView | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.getKycStatus());
      setError('');
    } catch (err) {
      setError(messageOf(err, 'Your KYC status could not be loaded.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error && !data) return <SafeAreaView style={styles.safe}><ScreenHeader title="My KYC Verification" /><ErrorView message={error} onRetry={load} /></SafeAreaView>;
  if (!data) return <SafeAreaView style={styles.safe}><ScreenHeader title="My KYC Verification" /><LoadingView text="Loading your KYC status…" /></SafeAreaView>;

  const status = data.kycStatus;
  const waiting = isAwaitingReview(status);
  const banner = data.isVerified
    ? { icon: 'shield-checkmark-outline' as const, bg: colors.greenSoft, fg: colors.greenDark, text: 'Your identity is verified. You can apply for loans and use all services.' }
    : waiting
      ? { icon: 'time-outline' as const, bg: colors.warningSoft, fg: colors.warning, text: kycGateMessage(status) }
      : status === 'REJECTED'
        ? {
            icon: 'close-circle-outline' as const,
            bg: colors.dangerSoft,
            fg: colors.danger,
            text: `${data.rejectionReason ? `Reason: ${data.rejectionReason} ` : ''}${data.resubmissionAllowed ? 'You may update your application and submit it again.' : 'Please contact your branch for help.'}`,
          }
        : status === 'CORRECTION_REQUIRED'
          ? { icon: 'create-outline' as const, bg: colors.warningSoft, fg: colors.warning, text: data.correctionReason ? `Branch note: ${data.correctionReason}` : kycGateMessage(status) }
          : { icon: 'shield-outline' as const, bg: colors.primarySoft, fg: colors.primary, text: kycGateMessage(status) };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="My KYC Verification" subtitle="Know-Your-Client status" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={[styles.banner, { backgroundColor: banner.bg }]}>
          <View style={styles.bannerIcon}>
            <Ionicons name={banner.icon} size={24} color={banner.fg} />
          </View>
          <View style={styles.flex1}>
            <Badge label={data.statusLabel} status={status} />
            <Text style={styles.bannerText}>{banner.text}</Text>
            {data.correctionDetails?.sections.length ? (
              <Text style={styles.bannerText}>Please update: {parseSections(data.correctionDetails.sections).map((s) => KYC_SECTION_LABELS[s]).join(', ')}</Text>
            ) : null}
          </View>
        </View>

        {data.submittedAt ? (
          <AppCard style={styles.card}>
            {data.referenceNumber ? <InfoRow label="Reference no." value={data.referenceNumber} /> : null}
            <InfoRow label="Submitted" value={formatDateTime(data.submittedAt)} last={!data.reviewedAt} />
            {data.reviewedAt ? <InfoRow label="Reviewed" value={`${formatDateTime(data.reviewedAt)}${data.reviewedByName ? ` by ${data.reviewedByName}` : ''}`} last={!data.verifiedAt} /> : null}
            {data.verifiedAt ? <InfoRow label="Verified" value={formatDateTime(data.verifiedAt)} last /> : null}
          </AppCard>
        ) : null}

        <Text style={styles.sectionTitle}>Required documents</Text>
        {data.requiredDocuments.length === 0 ? (
          <Text style={styles.note}>No documents are required.</Text>
        ) : (
          <AppCard padded={false} style={styles.card}>
            {data.requiredDocuments.map((doc) => (
              <DocRow key={doc.type} name={doc.name} type={doc.type} submitted={doc.submitted} status={doc.status} fileName={doc.fileName ?? undefined} />
            ))}
          </AppCard>
        )}

        {kycCanEdit(data) ? (
          <AppButton
            title={status === 'CORRECTION_REQUIRED' ? 'Update my application' : status === 'REJECTED' ? 'Update and resubmit' : status === 'IN_PROGRESS' ? 'Continue verification' : 'Start verification'}
            icon={<Ionicons name="arrow-forward" size={18} color={colors.white} />}
            onPress={() => navigation.navigate('KycForm')}
          />
        ) : null}
        {waiting ? <Text style={styles.note}>You will get a notification when the branch decides.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 80 },
  error: { fontSize: 12, color: colors.danger, marginBottom: 10, textAlign: 'center' },
  banner: { flexDirection: 'row', borderRadius: radius.lg, padding: 14, marginBottom: 14 },
  bannerIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: 'rgba(255,255,255,0.6)' },
  flex1: { flex: 1 },
  bannerText: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 17 },
  card: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  note: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
