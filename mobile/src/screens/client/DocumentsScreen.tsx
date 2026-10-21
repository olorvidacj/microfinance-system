import React, { useCallback, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, EmptyState, ErrorView, LoadingView, ScreenHeader } from '../../components';
import { colors } from '../../theme';
import { api, messageOf } from '../../services/api';
import type { ClientDocumentView } from '../../shared/client';
import { formatDate, humanizeStatus } from '../../utils/format';

/** The member's stored documents; opening one fetches a short-lived link (same endpoint as the web portal). */
export const DocumentsScreen: React.FC = () => {
  const [documents, setDocuments] = useState<ClientDocumentView[] | null>(null);
  const [error, setError] = useState('');
  const [openError, setOpenError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDocuments(await api.getDocuments());
      setError('');
    } catch (err) {
      setError(messageOf(err, 'Your documents could not be loaded.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = async (doc: ClientDocumentView) => {
    setOpeningId(doc.id);
    setOpenError('');
    try {
      await Linking.openURL(await api.getDocumentUrl(doc.id));
    } catch (err) {
      setOpenError(messageOf(err, 'The document could not be opened.'));
    } finally {
      setOpeningId(null);
    }
  };

  if (error && !documents) return <SafeAreaView style={styles.safe}><ScreenHeader title="My Documents" /><ErrorView message={error} onRetry={load} /></SafeAreaView>;
  if (!documents) return <SafeAreaView style={styles.safe}><ScreenHeader title="My Documents" /><LoadingView text="Loading documents…" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="My Documents" subtitle="Your KYC and loan papers" />
      {openError ? <Text style={styles.error}>{openError}</Text> : null}
      <FlatList
        data={documents}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <AppCard style={styles.docCard} padded={false}>
            <View style={styles.docRow}>
              <View style={styles.docIcon}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.docName}>{item.name}</Text>
                <Text style={styles.docMeta}>
                  {humanizeStatus(item.type)} · {formatDate(item.date)}
                  {item.relatedLoanNumber ? ` · ${item.relatedLoanNumber}` : ''}
                </Text>
              </View>
              {item.hasFile ? (
                <TouchableOpacity style={styles.openBtn} onPress={() => open(item)} disabled={openingId !== null} accessibilityLabel={`Open ${item.name}`}>
                  <Ionicons name={openingId === item.id ? 'hourglass-outline' : 'open-outline'} size={19} color={colors.teal} />
                </TouchableOpacity>
              ) : (
                <Text style={styles.noFile}>No file stored</Text>
              )}
            </View>
          </AppCard>
        )}
        ListEmptyComponent={<EmptyState icon="folder-open-outline" title="No documents yet" message="Documents you upload for KYC and loans, and papers your branch adds, will appear here." />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  error: { fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },
  content: { padding: 16, paddingBottom: 110, flexGrow: 1 },
  docCard: { marginBottom: 8 },
  docRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  docIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: colors.primarySoft },
  flex1: { flex: 1, marginRight: 8 },
  docName: { fontSize: 14, fontWeight: '800', color: colors.text },
  docMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  openBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  noFile: { fontSize: 11, color: colors.textFaint },
});
