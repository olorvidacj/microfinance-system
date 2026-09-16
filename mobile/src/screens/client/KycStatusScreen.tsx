import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, Badge, DocRow, LoadingView, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { KycStatusData } from '../../types';
import { formatDateTime, humanizeStatus } from '../../utils/format';

export const KycStatusScreen: React.FC = () => {
  const navigation = useNavigation();
  const [data, setData] = useState<KycStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.getKycStatus();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load KYC status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const status = data?.kycStatus ?? 'NOT_STARTED';
  const isVerified = status === 'VERIFIED';
  const isPending = ['PENDING', 'UNDER_REVIEW'].includes(status);
  const needsCorrection = status === 'CORRECTION_REQUIRED';
  const isRejected = status === 'REJECTED';

  let bannerIcon: any = 'shield-checkmark-outline';
  let bannerBg: string = colors.greenSoft;
  let bannerColor: string = colors.greenDark;
  let bannerText = 'Your identity has been verified. You can apply for loans and access all services.';
  let bannerTitle = 'KYC Verified';

  if (isPending) {
    bannerIcon = 'time-outline';
    bannerBg = colors.warningSoft;
    bannerColor = colors.warning;
    bannerTitle = 'Under Review';
    bannerText = 'Branch personnel are reviewing your submitted documents. This usually takes 1–3 business days.';
  } else if (needsCorrection) {
    bannerIcon = 'create-outline';
    bannerBg = colors.warningSoft;
    bannerColor = colors.warning;
    bannerTitle = 'Correction Required';
    bannerText = data?.correctionReason
      ? `Branch note: ${data.correctionReason}`
      : 'One or more documents need to be updated before your KYC can be approved.';
  } else if (isRejected) {
    bannerIcon = 'close-circle-outline';
    bannerBg = colors.dangerSoft;
    bannerColor = colors.danger;
    bannerTitle = 'KYC Not Approved';
    bannerText = data?.rejectionReason
      ? `Reason: ${data.rejectionReason}`
      : 'Your submission did not meet the requirements. Please resubmit with valid documents.';
  } else {
    bannerTitle = 'Verification Required';
    bannerText = 'Complete your KYC verification to unlock loans and self-service services.';
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="My KYC Verification" subtitle="Know-Your-Client status" />
      {loading ? (
        <LoadingView />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={[styles.banner, { backgroundColor: bannerBg }]}>
            <View style={[styles.bannerIcon, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
              <Ionicons name={bannerIcon} size={24} color={bannerColor} />
            </View>
            <View style={styles.bannerTextWrap}>
              <Badge status={status} />
              <Text style={[styles.bannerTitle, { color: bannerColor }]}>{bannerTitle}</Text>
              <Text style={styles.bannerText}>{bannerText}</Text>
            </View>
          </View>

          {data?.submittedAt ? (
            <AppCard style={styles.metaCard}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Submitted</Text>
                <Text style={styles.metaValue}>{formatDateTime(data.submittedAt)}</Text>
              </View>
              {data.reviewedAt ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Reviewed</Text>
                  <Text style={styles.metaValue}>{formatDateTime(data.reviewedAt)}</Text>
                </View>
              ) : null}
              {data.reviewedByName ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Reviewed by</Text>
                  <Text style={styles.metaValue}>{data.reviewedByName}</Text>
                </View>
              ) : null}
              {data.submissionId ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Reference No.</Text>
                  <Text style={styles.metaValue}>{data.submissionId}</Text>
                </View>
              ) : null}
            </AppCard>
          ) : null}

          <Text style={styles.sectionTitle}>Required Documents</Text>
          <AppCard padded={false} style={{ marginBottom: 16 }}>
            {(data?.requiredDocuments ?? []).map((doc, i) => (
              <DocRow
                key={`${doc.type}-${i}`}
                name={doc.name}
                type={doc.type}
                submitted={doc.submitted}
                status={doc.status}
                fileName={doc.fileName}
              />
            ))}
          </AppCard>

          {(needsCorrection || isRejected || (!isVerified && !isPending)) ? (
            <AppButton
              variant={needsCorrection ? 'secondary' : 'primary'}
              title={needsCorrection ? 'Resubmit With Corrections' : isPending ? 'View Progress' : isRejected ? 'Start Over — Submit Again' : 'Start KYC Now'}
              icon={<Ionicons name={needsCorrection ? 'create-outline' : 'arrow-forward'} size={18} color={colors.white} />}
              onPress={() => (navigation as any).navigate('KycForm')}
            />
          ) : null}

          {isVerified ? (
            <View style={styles.unlockRow}>
              <Ionicons name="lock-open-outline" size={16} color={colors.green} />
              <Text style={styles.unlockText}>You can now apply for loans.</Text>
            </View>
          ) : (
            <Text style={styles.note}>
              {isPending
                ? 'You will be notified once a decision is made. You may check this page anytime.'
                : humanizeStatus('KYC verification is completed by authorized branch personnel. Documents must be clear and legible.')}
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 80 },
  error: { fontSize: 13, color: colors.danger, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 14,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '800', marginTop: 6 },
  bannerText: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  metaCard: { marginBottom: 16 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  metaLabel: { fontSize: 12, color: colors.textMuted },
  metaValue: { fontSize: 12, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  unlockText: { fontSize: 13, color: colors.greenDark, fontWeight: '700', marginLeft: 6 },
  note: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});