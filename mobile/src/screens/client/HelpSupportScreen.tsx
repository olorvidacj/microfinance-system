import React, { useCallback, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, AppModal, AppTextInput, Badge, ErrorView, LoadingView, ScreenHeader, SectionHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api, fieldErrorsOf, messageOf } from '../../services/api';
import { SUPPORT_CATEGORIES, validateSupportRequest, type FaqView, type SupportCategory, type SupportContactView, type SupportRequestView } from '../../shared/client';
import { formatDate } from '../../utils/format';

/** FAQs, the member's own branch, and messages to it (same endpoints and rules as the web portal). */
export const HelpSupportScreen: React.FC = () => {
  const [faqs, setFaqs] = useState<Record<string, FaqView[]> | null>(null);
  const [contact, setContact] = useState<SupportContactView | null>(null);
  const [tickets, setTickets] = useState<SupportRequestView[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportCategory>('Loans');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, c, t] = await Promise.all([api.getFaqs(), api.getSupportContact(), api.getSupportRequests()]);
      const grouped: Record<string, FaqView[]> = {};
      for (const item of f) (grouped[item.category] ||= []).push(item);
      setFaqs(grouped);
      setContact(c);
      setTickets(t);
      setError('');
    } catch (err) {
      setError(messageOf(err, 'Help and support could not be loaded.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openCompose = () => {
    setComposeOpen(true);
    setSent(false);
    setSubject('');
    setMessage('');
    setCategory('Loans');
    setErrors({});
  };

  const send = async () => {
    // Same checks as the server (shared/client/support.ts).
    const v = validateSupportRequest({ subject, category, message });
    setErrors(v.errors);
    if (!v.ok) return;
    setSubmitting(true);
    try {
      const ticket = await api.sendSupportRequest(v.value);
      setTickets((prev) => [ticket, ...prev]);
      setSent(true);
    } catch (err) {
      setErrors({ ...fieldErrorsOf(err), submit: messageOf(err, 'Your message could not be sent.') });
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !faqs) return <SafeAreaView style={styles.safe}><ScreenHeader title="Help & Support" /><ErrorView message={error} onRetry={load} /></SafeAreaView>;
  if (!faqs || !contact) return <SafeAreaView style={styles.safe}><ScreenHeader title="Help & Support" /><LoadingView text="Loading help center…" /></SafeAreaView>;

  const phone = contact.phone.replace(/[^\d+]/g, '');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Help & Support" subtitle="Answers and your branch" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
        <AppCard style={styles.branchCard}>
          <Text style={styles.branchLabel}>Your branch</Text>
          <Text style={styles.branchName}>{contact.branchName}</Text>
          <Text style={styles.muted}>{contact.address}{contact.city ? `, ${contact.city}` : ''}</Text>
          {phone ? (
            <TouchableOpacity style={styles.callRow} onPress={() => Linking.openURL(`tel:${phone}`)} accessibilityLabel={`Call ${contact.phone}`}>
              <Ionicons name="call-outline" size={16} color={colors.primary} />
              <Text style={styles.link}>{contact.phone}</Text>
            </TouchableOpacity>
          ) : null}
        </AppCard>

        <AppCard style={styles.ctaCard} padded={false}>
          <TouchableOpacity style={styles.ctaBody} onPress={openCompose}>
            <View style={styles.ctaIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.ctaTitle}>Message your branch</Text>
              <Text style={styles.muted}>Your branch replies by phone, SMS or at the counter</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        </AppCard>

        <SectionHeader title="My messages" />
        {tickets.length === 0 ? (
          <Text style={[styles.muted, { marginBottom: 14 }]}>Messages you send are listed here, with whether the branch has seen them.</Text>
        ) : (
          <AppCard padded={false} style={{ marginBottom: 14 }}>
            {tickets.map((t, i) => (
              <View key={t.id} style={[styles.ticketRow, i < tickets.length - 1 && styles.rowBorder]}>
                <View style={styles.flex1}>
                  <Text style={styles.ticketSubject}>{t.subject}</Text>
                  <Text style={styles.muted}>{t.category} · Sent {formatDate(t.sentAt)}</Text>
                </View>
                <Badge label={t.read ? 'Seen by branch' : 'Sent'} status={t.read ? 'ACTIVE' : 'PENDING'} />
              </View>
            ))}
          </AppCard>
        )}

        <SectionHeader title="Frequently asked questions" subtitle="Tap a topic to expand" />
        {Object.entries(faqs).map(([name, items]) => {
          const isOpen = openCategory === name;
          return (
            <AppCard key={name} style={styles.faqCard} padded={false}>
              <TouchableOpacity style={styles.faqHeader} onPress={() => setOpenCategory(isOpen ? null : name)} activeOpacity={0.8}>
                <Text style={styles.faqCategory}>{name}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
              </TouchableOpacity>
              {isOpen ? (
                <View style={styles.faqBody}>
                  {items.map((f) => (
                    <View key={f.id} style={styles.faqItem}>
                      <Text style={styles.faqQuestion}>{f.question}</Text>
                      <Text style={styles.faqAnswer}>{f.answer}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </AppCard>
          );
        })}

        <Text style={styles.footerNote}>Never share your password or verification code with anyone, including branch staff.</Text>
      </ScrollView>

      <AppModal
        visible={composeOpen && !sent}
        onClose={() => setComposeOpen(false)}
        title="Message your branch"
        subtitle={contact.branchName}
        icon="chatbubble-ellipses-outline"
        iconColor={colors.primary}
        iconBg={colors.primarySoft}
        confirmText="Send"
        onConfirm={send}
        confirmLoading={submitting}
      >
        {errors.submit ? <Text style={styles.error}>{errors.submit}</Text> : null}
        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.catRow}>
          {SUPPORT_CATEGORIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.catChip, category === c && styles.catChipActive]} onPress={() => setCategory(c)} accessibilityLabel={c}>
              <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <AppTextInput label="Subject" placeholder="e.g. Question about my loan balance" value={subject} onChangeText={setSubject} error={errors.subject} />
        <AppTextInput label="Message" placeholder="Describe your concern" value={message} onChangeText={setMessage} multiline numberOfLines={4} error={errors.message} />
      </AppModal>

      <AppModal
        visible={composeOpen && sent}
        onClose={() => setComposeOpen(false)}
        title="Message sent"
        subtitle="Your branch will contact you."
        icon="checkmark-circle-outline"
        iconColor={colors.green}
        iconBg={colors.greenSoft}
        confirmText="Done"
        onConfirm={() => setComposeOpen(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 60 },
  flex1: { flex: 1, marginRight: 8 },
  muted: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary, marginLeft: 6 },
  error: { fontSize: 12, color: colors.danger, fontWeight: '600', marginBottom: 10 },
  branchCard: { marginBottom: 12 },
  branchLabel: { fontSize: 10, color: colors.textFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  branchName: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 },
  callRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  ctaCard: { marginBottom: 18 },
  ctaBody: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  ctaIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  ctaTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  ticketRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  ticketSubject: { fontSize: 14, fontWeight: '700', color: colors.text },
  faqCard: { marginBottom: 8 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  faqCategory: { fontSize: 14, fontWeight: '800', color: colors.text },
  faqBody: { paddingHorizontal: 14, paddingBottom: 6 },
  faqItem: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: 10 },
  faqQuestion: { fontSize: 13, fontWeight: '700', color: colors.text },
  faqAnswer: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  footerNote: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 14, lineHeight: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 4 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  catChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.round, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6, marginBottom: 6, backgroundColor: colors.surface },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  catTextActive: { color: colors.white },
});
