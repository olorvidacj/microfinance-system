import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppModal, AppTextInput, Avatar, Badge, EmptyState, ErrorView, InfoRow, LoadingView, ScreenHeader, SectionHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api, messageOf } from '../../services/api';
import type { MyGroupView } from '../../shared/client';
import { GROUP_ROLE_LABELS, GROUP_STATUS_LABELS, MEETING_FREQUENCY_LABELS, centsFromDb, centsToDecimal, type MeetingFrequency } from '../../shared/lending';
import { formatCurrency, formatDate } from '../../utils/format';

/** The member's solidarity group: members' standing, consent requests, fund covers and meetings (same data as the web portal). */
export const GroupLendingScreen: React.FC = () => {
  const [group, setGroup] = useState<MyGroupView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [declining, setDeclining] = useState<{ id: string; loanNumber: string } | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setGroup(await api.getMyGroup());
      setError('');
    } catch (err) {
      setError(messageOf(err, 'Your group could not be loaded.'));
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const decide = async (loanId: string, decision: 'CONSENT' | 'DECLINE', note?: string) => {
    setBusy(loanId);
    setNotice(null);
    try {
      setGroup(await api.consentToGroupLoan(loanId, decision, note));
      setDeclining(null);
      setNotice({ ok: true, text: decision === 'CONSENT' ? 'Thank you. Your consent is recorded.' : 'Your answer is recorded. The loan officer will follow up.' });
    } catch (err) {
      setNotice({ ok: false, text: messageOf(err, 'Your answer could not be recorded.') });
    } finally {
      setBusy('');
    }
  };

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="Group Lending" /><LoadingView text="Loading your group…" /></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.safe}><ScreenHeader title="Group Lending" /><ErrorView message={error} onRetry={() => { setLoaded(false); load(); }} /></SafeAreaView>;

  if (!group) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Group Lending" />
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState icon="people-outline" title="You are not in a lending group" message="Ask your branch's loan officer about joining a solidarity group for group loans." />
          <AppCard style={styles.infoCard}>
            <Text style={styles.infoTitle}>What is group lending?</Text>
            <Text style={styles.infoText}>
              A solidarity group is a small circle of members who meet regularly and are jointly liable for each other's loans. If a member cannot pay, the group's solidarity fund covers the installment and the member pays it back.
            </Text>
          </AppCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const g = group.group;
  const waiting = group.pendingLoans.filter((l) => !l.mine);
  const owed = group.fund.myCovers.reduce((s, c) => s + centsFromDb(c.outstanding), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={g.groupName} subtitle={`${g.groupCode} · ${g.centerName}`} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
        {notice ? <Text style={[styles.notice, !notice.ok && styles.noticeError]}>{notice.text}</Text> : null}

        <View style={styles.groupHero}>
          <View style={styles.groupHeroTop}>
            <View style={styles.flex1}>
              <Text style={styles.groupName}>{g.groupName}</Text>
              <Text style={styles.groupMeta}>
                {group.members.length} members{group.me ? ` · you are the ${GROUP_ROLE_LABELS[group.me.role].toLowerCase()}` : ''}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Badge label={GROUP_STATUS_LABELS[g.status]} status={g.status} size="md" dot />
              </View>
            </View>
            <Ionicons name="people" size={38} color="rgba(255,255,255,0.4)" />
          </View>
        </View>

        {group.blocked ? (
          <View style={styles.alert}>
            <Ionicons name="shield-outline" size={18} color={colors.danger} />
            <Text style={styles.alertText}>Your group cannot take new loans until a member's overdue payments, or what the solidarity fund paid for them, are settled.</Text>
          </View>
        ) : null}

        {owed > 0 ? (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>You owe your group's solidarity fund {formatCurrency(centsToDecimal(owed))}</Text>
            <Text style={styles.muted}>The fund paid your overdue installment. Pay it back at the next meeting or at the branch.</Text>
            {group.fund.myCovers.map((c) => (
              <Text key={c.id} style={styles.muted}>
                {c.coverNumber}: {formatCurrency(c.amount)} for {c.loanNumber}, {formatCurrency(c.outstanding)} still owed
              </Text>
            ))}
          </AppCard>
        ) : null}

        {group.me && group.me.loans.length ? (
          <>
            <SectionHeader title="My group loans" />
            <AppCard style={styles.card}>
              {group.me.loans.map((l, i) => (
                <View key={l.id} style={[styles.loanRow, i < group.me!.loans.length - 1 && styles.rowBorder]}>
                  <View style={styles.flex1}>
                    <Text style={styles.rowTitle}>{l.loanNumber}</Text>
                    <Text style={styles.muted}>
                      {formatCurrency(l.remaining)} remaining
                      {centsFromDb(l.overdue) > 0 ? ` · ${formatCurrency(l.overdue)} overdue since ${formatDate(l.oldestOverdue)}` : ''}
                    </Text>
                  </View>
                  <Badge status={l.status} />
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {waiting.length ? (
          <>
            <SectionHeader title="Loans waiting for your consent" />
            <Text style={[styles.muted, { marginBottom: 8 }]}>Members are jointly liable: if a member cannot pay, the group helps cover it. Consent only if you support this loan.</Text>
            {waiting.map((l) => (
              <AppCard key={l.id} style={styles.card}>
                <Text style={styles.rowTitle}>{l.borrowerName}: {formatCurrency(l.principalAmount)} over {l.termMonths} months</Text>
                <Text style={styles.muted}>{l.loanNumber} · {l.consented} of {l.required} members have consented</Text>
                {l.myDecision === 'CONSENT' ? (
                  <View style={{ marginTop: 8 }}><Badge label="You consented" status="APPROVED" /></View>
                ) : (
                  <View style={styles.actions}>
                    {l.myDecision === 'DECLINE' ? <Badge label="You declined" status="REJECTED" /> : null}
                    <AppButton title="I consent" size="sm" loading={busy === l.id} onPress={() => decide(l.id, 'CONSENT')} style={styles.actionBtn} />
                    {l.myDecision !== 'DECLINE' ? (
                      <AppButton title="Decline" size="sm" variant="outline" onPress={() => setDeclining({ id: l.id, loanNumber: l.loanNumber })} style={styles.actionBtn} />
                    ) : null}
                  </View>
                )}
              </AppCard>
            ))}
          </>
        ) : null}

        <SectionHeader title={`Members (${group.members.length})`} />
        <AppCard padded={false} style={styles.card}>
          {group.members.map((m, i) => (
            <View key={m.borrowerId} style={[styles.memberRow, i < group.members.length - 1 && styles.rowBorder]}>
              <Avatar name={m.fullName} size={36} />
              <View style={[styles.flex1, { marginLeft: 10 }]}>
                <Text style={styles.rowTitle}>{m.fullName}</Text>
                <Text style={styles.muted}>{GROUP_ROLE_LABELS[m.role]}</Text>
              </View>
              <Badge label={m.standing === 'GOOD' ? 'Up to date' : 'Behind'} status={m.standing === 'GOOD' ? 'ACTIVE' : 'OVERDUE'} />
            </View>
          ))}
        </AppCard>

        <SectionHeader title="Meetings" />
        <AppCard style={styles.card}>
          <InfoRow label="Schedule" value={`${g.meetingDay}s at ${g.meetingTime}, ${MEETING_FREQUENCY_LABELS[g.meetingFrequency as MeetingFrequency]?.toLowerCase() ?? g.meetingFrequency}`} />
          <InfoRow label="Where" value={g.meetingLocation} />
          <InfoRow label="Loan officer" value={g.loanOfficerName} />
          <InfoRow label="Solidarity fund" value={formatCurrency(group.fund.balance)} last={!group.meetings.length} />
          {group.meetings.map((m, i) => (
            <View key={m.meetingDate} style={[styles.meetingRow, i < group.meetings.length - 1 && styles.rowBorder]}>
              <Text style={styles.muted}>{formatDate(m.meetingDate)} · {m.present} of {m.total} present</Text>
              <Text style={styles.muted}>{m.me ? `You: ${m.me.toLowerCase()}` : ''}</Text>
            </View>
          ))}
        </AppCard>
      </ScrollView>

      {declining ? (
        <DeclineModal loanNumber={declining.loanNumber} saving={busy === declining.id} onClose={() => setDeclining(null)} onSubmit={(note) => decide(declining.id, 'DECLINE', note)} />
      ) : null}
    </SafeAreaView>
  );
};

const DeclineModal: React.FC<{ loanNumber: string; saving: boolean; onClose: () => void; onSubmit: (note: string) => void }> = ({ loanNumber, saving, onClose, onSubmit }) => {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  return (
    <AppModal
      visible
      onClose={onClose}
      title={`Decline ${loanNumber}`}
      confirmText="Decline"
      confirmVariant="danger"
      confirmLoading={saving}
      onConfirm={() => {
        if (note.trim().length < 3) return setError('Tell the group why.');
        onSubmit(note.trim());
      }}
    >
      <AppTextInput label="Why do you not support this loan?" value={note} onChangeText={setNote} error={error} />
    </AppModal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 60, flexGrow: 1 },
  notice: { backgroundColor: colors.greenSoft, color: colors.greenDark, padding: 10, borderRadius: radius.md, marginBottom: 12, fontSize: 13 },
  noticeError: { backgroundColor: colors.dangerSoft, color: colors.danger },
  groupHero: { backgroundColor: colors.primaryDeep, borderRadius: radius.xl, padding: 18, marginBottom: 14 },
  groupHeroTop: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1, marginRight: 10 },
  groupName: { fontSize: 19, fontWeight: '900', color: colors.white },
  groupMeta: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  alert: { flexDirection: 'row', backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  alertText: { flex: 1, fontSize: 12, color: colors.danger, marginLeft: 8, lineHeight: 17 },
  card: { marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  rowTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  loanRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10 },
  actionBtn: { marginRight: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  meetingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoCard: { marginTop: 12 },
  infoTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  infoText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
