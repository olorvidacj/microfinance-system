import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppModal, AppTextInput, Avatar, Badge, InfoRow, LoadingView, ScreenHeader } from '../../components';
import { colors, radius } from '../../theme';
import { branchApi } from '../../services/api';
import { BranchKycQueueItem, KycReviewDecision, AuditLogEntry } from '../../types';
import { formatDateTime, humanizeStatus } from '../../utils/format';
import { BranchStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BranchStackParamList, 'KycReviewDetail'>;

export const KycReviewDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { clientId } = route.params;
  const [item, setItem] = useState<BranchKycQueueItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [decisionModal, setDecisionModal] = useState<KycReviewDecision | null>(null);
  const [remarks, setRemarks] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoaded(false);
    setError(null);
    try {
      const queue = await branchApi.getKycQueue();
      const found = queue.find((q) => q.id === clientId);
      if (!found) {
        setError('This client is no longer in the review queue.');
        setLoaded(true);
        setRefreshing(false);
        return;
      }
      setItem(found);
      const sub: any = found.kycSubmission;
      if (sub?.auditLog) {
        setAudit(sub.auditLog);
      } else if (sub?.reviewedAt || sub?.reviewedByName) {
        setAudit([
          {
            id: 'log-1',
            createdAt: sub.reviewedAt ?? '',
            staffName: sub.reviewedByName,
            action: 'KYC_REVIEWED',
            previousStatus: 'PENDING',
            newStatus: sub.status,
          },
        ]);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load the KYC submission.');
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const openReview = (decision: KycReviewDecision) => {
    setDecisionModal(decision);
    setRemarks('');
    setReviewError(null);
  };

  const confirmReview = async () => {
    if (!decisionModal) return;
    if ((decisionModal === 'REJECTED' || decisionModal === 'CORRECTION_REQUESTED') && remarks.trim().length < 5) {
      setReviewError('Please provide a reason for rejection or correction request.');
      return;
    }
    setReviewing(true);
    try {
      const res = await branchApi.reviewKyc({
        clientId,
        decision: decisionModal,
        notes: remarks.trim() || undefined,
      });
      setAudit((prev) => [
        {
          id: `log-${Date.now()}`,
          createdAt: res.reviewedAt ?? new Date().toISOString(),
          staffName: res.reviewerName,
          action: `KYC_${decisionModal}`,
          previousStatus: item?.kycStatus as string,
          newStatus: res.status,
          reason: remarks.trim() || undefined,
        },
        ...prev,
      ]);
      setItem((prev) => (prev ? { ...prev, kycStatus: res.status } : prev));
      setDecisionModal(null);
    } catch (err: any) {
      setReviewError(err?.message || 'Unable to submit decision.');
    } finally {
      setReviewing(false);
    }
  };

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="Client KYC Review" /><LoadingView /></SafeAreaView>;

  if (!item) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Client KYC Review" />
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={34} color={colors.textFaint} />
          <Text style={styles.notFoundTitle}>Client not found</Text>
          <Text style={styles.notFoundMsg}>{error || 'The submission may have been removed from the queue.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sub = item.kycSubmission;
  const personal = sub?.personalInfo;
  const address = sub?.address;
  const employment = sub?.employment;
  const isPending = ['PENDING', 'UNDER_REVIEW'].includes(String(item.kycStatus).toUpperCase());

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Client KYC Review" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.clientHeader}>
          <Avatar name={item.fullName} size={54} fg={colors.white} />
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{item.fullName}</Text>
            <Text style={styles.clientMeta}>{item.borrowerNumber}</Text>
            <View style={{ marginTop: 4 }}>
              <Badge status={item.kycStatus} size="md" dot />
            </View>
          </View>
        </View>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Contact</Text>
          <InfoRow label="Mobile" value={item.phone || '—'} />
          <InfoRow label="Email" value={item.email || '—'} />
          <InfoRow label="Member status" value={humanizeStatus(item.memberStatus ?? 'ACTIVE')} last />
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <InfoRow label="Full name" value={`${personal?.firstName ?? ''} ${personal?.middleName ? personal.middleName + ' ' : ''}${personal?.lastName ?? ''}`.trim() || '—'} />
          <InfoRow label="Date of birth" value={personal?.dateOfBirth ?? '—'} />
          <InfoRow label="Gender" value={personal?.gender ?? item.gender ?? '—'} />
          <InfoRow label="Civil status" value={personal?.civilStatus ?? item.civilStatus ?? '—'} last />
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Address</Text>
          <InfoRow label="Barangay" value={address?.barangay ?? item.barangay ?? '—'} />
          <InfoRow label="City / Municipality" value={address?.city ?? item.city ?? '—'} />
          <InfoRow label="Province" value={address?.province ?? item.province ?? '—'} />
          <InfoRow label="Street / Unit" value={address?.street ?? address?.houseUnit ?? '—'} last />
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Employment & Income</Text>
          <InfoRow label="Occupation" value={employment?.occupation ?? item.occupation ?? '—'} />
          <InfoRow label="Employer / Business" value={employment?.employer ?? item.employerOrBusiness ?? '—'} />
          <InfoRow label="Source of income" value={employment?.sourceOfIncome ?? '—'} />
          <InfoRow label="Monthly income" value={employment?.monthlyIncome ? `₱${Number(employment.monthlyIncome).toLocaleString()}` : item.monthlyIncome ? `₱${Number(item.monthlyIncome).toLocaleString()}` : '—'} strong last />
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Submission</Text>
          <InfoRow label="Reference" value={sub?.id ?? '—'} />
          <InfoRow label="Submitted" value={sub?.submittedAt ? formatDateTime(sub.submittedAt) : '—'} />
          <InfoRow label="Status" value={humanizeStatus(String(item.kycStatus))} strong />
          {sub?.reviewedByName ? <InfoRow label="Last reviewed by" value={sub.reviewedByName} /> : null}
          <InfoRow
            label="Documents on file"
            value={`${item.submittedDocuments} submitted`}
            strong={!sub?.correctionReason && !sub?.rejectionReason}
          />
          {sub?.correctionReason ? <InfoRow label="Correction reason" value={sub.correctionReason} strong /> : null}
          {sub?.rejectionReason ? <InfoRow label="Rejection reason" value={sub.rejectionReason} strong /> : null}
          {sub?.reviewedAt ? <InfoRow label="Reviewed at" value={formatDateTime(sub.reviewedAt)} last /> : <InfoRow label="Reviewed at" value="Not yet reviewed" last />}
        </AppCard>

        <View style={styles.docsRow}>
          <Text style={styles.cardTitle}>Documents</Text>
          <View style={styles.docChips}>
            {[
              { name: 'Valid ID', icon: 'card-outline' as const },
              { name: 'Proof of Address', icon: 'location-outline' as const },
              { name: 'Proof of Income', icon: 'cash-outline' as const },
              { name: 'Photo 2×2', icon: 'person-circle-outline' as const },
            ].map((d) => (
              <TouchableOpacity key={d.name} style={styles.docChip}>
                <View style={styles.docChipIcon}>
                  <Ionicons name={d.icon} size={17} color={colors.primary} />
                </View>
                <Text style={styles.docChipText}>{d.name}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {audit.length ? (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Audit Trail</Text>
            {audit.map((log, i) => (
              <View key={log.id ?? i} style={[styles.auditRow, i < audit.length - 1 && styles.auditRowBorder]}>
                <View style={styles.auditIcon}>
                  <Ionicons name="shield-outline" size={15} color={colors.textMuted} />
                </View>
                <View style={styles.auditBody}>
                  <Text style={styles.auditAction}>
                    {log.action.replace(/_/g, ' ')}{log.previousStatus && log.newStatus ? ` — ${humanizeStatus(log.previousStatus)} → ${humanizeStatus(log.newStatus)}` : ''}
                  </Text>
                  <Text style={styles.auditMeta}>
                    {log.staffName ?? 'Branch Officer'} · {log.createdAt ? formatDateTime(log.createdAt) : ''}
                  </Text>
                  {log.reason ? <Text style={styles.auditReason}>{log.reason}</Text> : null}
                </View>
              </View>
            ))}
          </AppCard>
        ) : null}

        {isPending ? (
          <>
            <Text style={styles.sectionLabel}>Decision</Text>
            <View style={styles.decisionRow}>
              <View style={styles.flexBtn}>
                <AppButton
                  title="Approve"
                  variant="secondary"
                  icon={<Ionicons name="checkmark" size={17} color={colors.white} />}
                  onPress={() => openReview('APPROVED')}
                />
              </View>
              <View style={styles.flexBtn}>
                <AppButton
                  title="Request Correction"
                  variant="outline"
                  icon={<Ionicons name="create-outline" size={16} color={colors.primary} />}
                  onPress={() => openReview('CORRECTION_REQUESTED')}
                />
              </View>
            </View>
            <AppButton
              title="Reject Submission"
              variant="dark"
              style={{ marginBottom: 30 }}
              icon={<Ionicons name="close-circle-outline" size={17} color={colors.white} />}
              onPress={() => openReview('REJECTED')}
            />
          </>
        ) : (
          <Text style={styles.finalizedNote}>
            This file has already been decided. Review the audit trail above.
          </Text>
        )}
      </ScrollView>

      <AppModal
        visible={!!decisionModal}
        onClose={() => setDecisionModal(null)}
        title={
          decisionModal === 'APPROVED'
            ? 'Verify Client KYC?'
            : decisionModal === 'REJECTED'
              ? 'Reject KYC Submission?'
              : 'Request Corrections?'
        }
        subtitle={
          decisionModal === 'APPROVED'
            ? 'This will set the member to VERIFIED and unlock loan services.'
            : decisionModal === 'REJECTED'
              ? 'The member will need to restart the KYC process.'
              : 'The member will be asked to update and resubmit their documents.'
        }
        icon={decisionModal === 'APPROVED' ? 'shield-checkmark-outline' : decisionModal === 'REJECTED' ? 'close-circle-outline' : 'create-outline'}
        iconColor={decisionModal === 'APPROVED' ? colors.green : decisionModal === 'REJECTED' ? colors.danger : colors.info}
        iconBg={decisionModal === 'APPROVED' ? colors.greenSoft : decisionModal === 'REJECTED' ? colors.dangerSoft : colors.infoSoft}
        confirmText={decisionModal === 'APPROVED' ? 'Confirm Verification' : decisionModal === 'REJECTED' ? 'Confirm Rejection' : 'Send Correction Request'}
        confirmVariant={decisionModal === 'REJECTED' ? 'danger' : decisionModal === 'CORRECTION_REQUESTED' ? 'secondary' : 'primary'}
        onConfirm={confirmReview}
        confirmLoading={reviewing}
      >
        {reviewError ? <Text style={styles.reviewError}>{reviewError}</Text> : null}
        {(decisionModal === 'REJECTED' || decisionModal === 'CORRECTION_REQUESTED') ? (
          <AppTextInput
            label="Reason / Remarks *"
            placeholder="Explain the correction or rejection clearly"
            value={remarks}
            onChangeText={(v) => { setRemarks(v); setReviewError(null); }}
            multiline
            numberOfLines={3}
          />
        ) : (
          <AppTextInput
            label="Remarks (Optional)"
            placeholder="Internal notes for the audit trail"
            value={remarks}
            onChangeText={(v) => { setRemarks(v); setReviewError(null); }}
            multiline
            numberOfLines={3}
          />
        )}
        {decisionModal === 'APPROVED' ? (
          <Text style={styles.confirmNote}>Confirming approval records your staff name in the audit log.</Text>
        ) : null}
      </AppModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 60 },
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
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  notFoundTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 10 },
  notFoundMsg: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  clientHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  clientInfo: { flex: 1, marginLeft: 14 },
  clientName: { fontSize: 18, fontWeight: '900', color: colors.text },
  clientMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  card: { marginBottom: 12 },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  docsRow: { marginBottom: 12 },
  docChips: { flexDirection: 'row', flexWrap: 'wrap' },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginRight: '2%',
    marginBottom: 8,
  },
  docChipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  docChipText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.text },
  auditRow: { flexDirection: 'row', paddingVertical: 10 },
  auditRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  auditIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  auditBody: { flex: 1 },
  auditAction: { fontSize: 12, fontWeight: '700', color: colors.text },
  auditMeta: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  auditReason: { fontSize: 11, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  decisionRow: { flexDirection: 'row', marginBottom: 10 },
  flexBtn: { flex: 1, marginHorizontal: 4 },
  finalizedNote: { fontSize: 12, color: colors.textFaint, textAlign: 'center', paddingVertical: 14, lineHeight: 17 },
  reviewError: { fontSize: 12, color: colors.danger, fontWeight: '600', marginBottom: 10 },
  confirmNote: { fontSize: 11, color: colors.textFaint, marginTop: 10, lineHeight: 16 },
});