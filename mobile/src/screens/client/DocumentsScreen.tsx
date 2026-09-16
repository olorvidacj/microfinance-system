import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, Badge, EmptyState, LoadingView, ScreenHeader, SectionHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { PortalDocument } from '../../types';
import { formatDate } from '../../utils/format';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  STATEMENT: 'receipt-outline',
  CERTIFICATE: 'ribbon-outline',
  RECEIPT: 'receipt-outline',
  AGREEMENT: 'document-text-outline',
  LOAN_AGREEMENT: 'document-text-outline',
  CERTIFICATE_OF_MEMBERSHIP: 'ribbon-outline',
  ACCOUNT_STATEMENT: 'receipt-outline',
};

const TYPE_COLORS: Record<string, string> = {
  STATEMENT: colors.teal,
  CERTIFICATE: colors.green,
  RECEIPT: colors.info,
  AGREEMENT: colors.primary,
  LOAN_AGREEMENT: colors.primary,
  CERTIFICATE_OF_MEMBERSHIP: colors.green,
  ACCOUNT_STATEMENT: colors.teal,
};

export const DocumentsScreen: React.FC = () => {
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoaded(false);
    setError(null);
    try {
      const res = await api.getDocuments();
      setDocuments(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load documents.');
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const download = async (doc: PortalDocument) => {
    setDownloadingId(doc.id);
    try {
      // Simulated download: a real implementation requests a signed URL and
      // saves the file to the device, then opens a share sheet.
      await new Promise((r) => setTimeout(r, 650));
    } catch {
      setError('Could not save the document. Please try again later.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="My Documents" /><LoadingView /></SafeAreaView>;

  const folders = documents.reduce<Record<string, PortalDocument[]>>((acc, d) => {
    const key = d.type.replace(/_/g, ' ');
    const list = acc[key] ?? [];
    list.push(d);
    acc[key] = list;
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="My Documents" subtitle="Certificates and downloadable records" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={Object.entries(folders)}
        keyExtractor={([key]) => key}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          documents.length ? (
            <SectionHeader title="Your Records" subtitle="Tap a document to save it to your device" />
          ) : null
        }
        renderItem={({ item: [folder, items] }) => (
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.folderLabel}>{folder}</Text>
            {items.map((doc) => {
              const icon = TYPE_ICONS[doc.type] ?? 'document-outline';
              const color = TYPE_COLORS[doc.type] ?? colors.primary;
              const isDownloading = downloadingId === doc.id;
              return (
                <AppCard key={doc.id} style={styles.docCard} padded={false}>
                  <View style={styles.docRow}>
                    <View style={[styles.docIcon, { backgroundColor: `${color}18` }]}>
                      <Ionicons name={icon} size={20} color={color} />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.docName}>{doc.name}</Text>
                      <Text style={styles.docMeta}>{formatDate(doc.date)}{doc.relatedLoanNumber ? ` · Loan ${doc.relatedLoanNumber}` : ''}</Text>
                      <View style={{ marginTop: 4 }}>
                        <Badge status={doc.type === 'STATEMENT' ? 'COMPLETED' : 'VERIFIED'} />
                      </View>
                    </View>
                    <TouchableOpacity style={styles.downloadBtn} onPress={() => download(doc)} disabled={!!downloadingId} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      {isDownloading ? (
                        <Ionicons name="hourglass-outline" size={19} color={colors.textFaint} />
                      ) : (
                        <Ionicons name="download-outline" size={20} color={colors.teal} />
                      )}
                    </TouchableOpacity>
                  </View>
                </AppCard>
              );
            })}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="No documents yet"
            message="Downloadable certificates, receipts, and statements will appear here once generated."
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  error: { fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 8 },
  content: { padding: 16, paddingBottom: 110, flexGrow: 1 },
  folderLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  docCard: { marginBottom: 8 },
  docRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  docIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  flex1: { flex: 1, marginRight: 8 },
  docName: { fontSize: 14, fontWeight: '800', color: colors.text },
  docMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  downloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});