import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, AppModal, AppTextInput, LoadingView, ScreenHeader, SectionHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { FaqItem, SupportTicket } from '../../types';
import { formatDate, humanizeStatus } from '../../utils/format';

const CONTACTS = [
  { icon: 'call-outline' as const, label: 'Hotline', value: '(053) 100 2000', color: colors.primary },
  { icon: 'phone-portrait-outline' as const, label: 'Smart / Globe', value: '0917 555 0000', color: colors.teal },
  { icon: 'mail-outline' as const, label: 'Email', value: 'support@HOSCOMCO.ph', color: colors.green },
  { icon: 'location-outline' as const, label: 'Head Office', value: 'Tacloban City, Leyte', color: colors.info },
];

const TICKET_CATEGORIES = ['Loans', 'Savings', 'KYC', 'Payments', 'Account & Login', 'Other'];

export const HelpSupportScreen: React.FC = () => {
  const [faqs, setFaqs] = useState<Record<string, FaqItem[]>>({});
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const [ticketVisible, setTicketVisible] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Loans');
  const [message, setMessage] = useState('');
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticketDone, setTicketDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [f, t] = await Promise.all([api.getFaqs(), api.getSupportTickets()]);
          setFaqs(f);
          setTickets(t);
        } catch {}
        setLoaded(true);
      })();
    }, [])
  );

  const submitTicket = async () => {
    setTicketError(null);
    if (!subject.trim()) {
      setTicketError('Enter a short subject for your ticket.');
      return;
    }
    if (message.trim().length < 10) {
      setTicketError('Describe your concern in at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.submitSupportTicket({
        subject: subject.trim(),
        category,
        message: message.trim(),
      });
      setDoneMessage(res.message || 'Your ticket has been submitted.');
      setTickets((prev) => (res.ticket ? [res.ticket, ...prev] : prev));
      setTicketDone(true);
    } catch (err: any) {
      setTicketError(err?.message || 'Unable to submit your ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="Help & Support" /><LoadingView /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Help & Support" subtitle="We're here to help" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.contactsRow}>
          {CONTACTS.map((c) => (
            <AppCard key={c.label} style={styles.contactCard}>
              <View style={[styles.contactIcon, { backgroundColor: `${c.color}18` }]}>
                <Ionicons name={c.icon} size={19} color={c.color} />
              </View>
              <Text style={styles.contactLabel}>{c.label}</Text>
              <Text style={styles.contactValue} numberOfLines={1}>{c.value}</Text>
            </AppCard>
          ))}
        </View>

        <AppCard style={styles.ticketCta} padded={false}>
          <TouchableOpacity
            style={styles.ticketCtaBody}
            onPress={() => {
              setTicketVisible(true);
              setTicketDone(false);
              setSubject('');
              setMessage('');
              setCategory('Loans');
              setTicketError(null);
            }}
          >
            <View style={styles.ticketCtaIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.ticketCtaTitle}>Submit a Support Ticket</Text>
              <Text style={styles.ticketCtaSub}>We usually reply within 24 hours</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        </AppCard>

        {tickets.length ? (
          <>
            <SectionHeader title="My Tickets" subtitle="Track your open requests" />
            <AppCard padded={false} style={{ marginBottom: 14 }}>
              {tickets.map((t, i) => (
                <View key={t.id} style={[styles.ticketRow, i < tickets.length - 1 && styles.ticketRowBorder]}>
                  <View style={styles.flex1}>
                    <View style={styles.ticketTop}>
                      <Text style={styles.ticketId}>{t.id}</Text>
                      <Text style={styles.ticketStatus}>{humanizeStatus(t.status)}</Text>
                    </View>
                    <Text style={styles.ticketSubject}>{t.subject}</Text>
                    <Text style={styles.ticketMeta}>{t.category} · Updated {formatDate(t.lastUpdate)}</Text>
                  </View>
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        <SectionHeader title="Frequently Asked Questions" subtitle="Tap a category to expand" />

        {Object.entries(faqs).map(([categoryName, items]) => {
          const isOpen = openCategory === categoryName;
          return (
            <AppCard key={categoryName} style={styles.faqCard} padded={false}>
              <TouchableOpacity
                style={styles.faqHeader}
                onPress={() => setOpenCategory(isOpen ? null : categoryName)}
                activeOpacity={0.8}
              >
                <Text style={styles.faqCategory}>{categoryName}</Text>
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

        <Text style={styles.footerNote}>
          For emergencies or suspected fraud, call the hotline immediately. Never share your password or OTP with anyone.
        </Text>
      </ScrollView>

      <AppModal
        visible={ticketVisible && !ticketDone}
        onClose={() => setTicketVisible(false)}
        title="Submit a Support Ticket"
        subtitle="Tell us how we can help"
        icon="chatbubble-ellipses-outline"
        iconColor={colors.primary}
        iconBg={colors.primarySoft}
        confirmText="Submit Ticket"
        onConfirm={submitTicket}
        confirmLoading={submitting}
      >
        {ticketError ? <Text style={styles.ticketError}>{ticketError}</Text> : null}
        <AppTextInput
          label="Subject"
          placeholder="e.g. Question about my loan balance"
          value={subject}
          onChangeText={(v) => { setSubject(v); setTicketError(null); }}
        />
        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.catRow}>
          {TICKET_CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.catChip, active && styles.catChipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.catText, active && styles.catTextActive]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <AppTextInput
          label="Message"
          placeholder="Describe your concern in detail"
          value={message}
          onChangeText={(v) => { setMessage(v); setTicketError(null); }}
          multiline
          numberOfLines={4}
        />
      </AppModal>

      <AppModal
        visible={ticketVisible && ticketDone}
        onClose={() => { setTicketVisible(false); setTicketDone(false); }}
        title="Ticket Submitted"
        subtitle="We've received your request"
        icon="checkmark-circle-outline"
        iconColor={colors.green}
        iconBg={colors.greenSoft}
        confirmText="Done"
        onConfirm={() => { setTicketVisible(false); setTicketDone(false); }}
      >
        <Text style={styles.ticketDoneText}>{doneMessage}</Text>
        <Text style={styles.ticketDoneSub}>Track the status of your ticket under "My Tickets" on this page.</Text>
      </AppModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 60 },
  contactsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 6 },
  contactCard: { width: '48%', marginBottom: 10 },
  contactIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  contactLabel: { fontSize: 10, color: colors.textFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  contactValue: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 2 },
  flex1: { flex: 1 },
  ticketCta: { marginBottom: 18 },
  ticketCtaBody: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  ticketCtaIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ticketCtaTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  ticketCtaSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  ticketRow: { padding: 14 },
  ticketRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketId: { fontSize: 12, fontWeight: '800', color: colors.primary },
  ticketStatus: { fontSize: 10, fontWeight: '800', color: colors.warning, textTransform: 'uppercase' },
  ticketSubject: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 5 },
  ticketMeta: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  faqCard: { marginBottom: 8 },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  faqCategory: { fontSize: 14, fontWeight: '800', color: colors.text },
  faqBody: { paddingHorizontal: 14, paddingBottom: 6 },
  faqItem: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingVertical: 10,
  },
  faqQuestion: { fontSize: 13, fontWeight: '700', color: colors.text },
  faqAnswer: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  footerNote: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 14, lineHeight: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 4 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  catChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.round,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: colors.surface,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  catTextActive: { color: colors.white },
  ticketError: { fontSize: 12, color: colors.danger, fontWeight: '600', marginBottom: 10 },
  ticketDoneText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  ticketDoneSub: { fontSize: 12, color: colors.textFaint, marginTop: 10, lineHeight: 17 },
});