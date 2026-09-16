import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, LoadingView, ScreenHeader, SegmentedTabs } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { MobileNotification } from '../../types';
import { timeAgo } from '../../utils/format';

type TabKey = 'all' | 'unread';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  loan_update: 'wallet-outline',
  approval_rejection: 'checkmark-circle-outline',
  upcoming_payment: 'calendar-outline',
  overdue_payment: 'alert-circle-outline',
  payment_confirmation: 'receipt-outline',
  savings_update: 'wallet-outline',
  kyc_update: 'shield-checkmark-outline',
  announcement: 'megaphone-outline',
};

const CATEGORY_COLORS: Record<string, string> = {
  loan_update: colors.primary,
  approval_rejection: colors.green,
  upcoming_payment: colors.warning,
  overdue_payment: colors.danger,
  payment_confirmation: colors.info,
  savings_update: colors.teal,
  kyc_update: colors.primaryBright,
  announcement: colors.warning,
};

export const NotificationsScreen: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('all');
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoaded(false);
    setError(null);
    try {
      const res = await api.getNotifications();
      setNotifications([...res.notifications].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
      setUnreadCount(res.unreadCount);
    } catch (err: any) {
      setError(err?.message || 'Unable to load notifications.');
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

  const openNotification = async (n: MobileNotification) => {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await api.markNotificationAsRead(n.id);
      } catch {}
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnreadCount(0);
    try {
      await api.markAllNotificationsAsRead();
    } catch {}
  };

  const visible = tab === 'all' ? notifications : notifications.filter((n) => !n.isRead);

  if (!loaded) return <SafeAreaView style={styles.safe}><ScreenHeader title="Notifications" /><LoadingView /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Notifications"
        right={
          <TouchableOpacity onPress={markAllRead} disabled={unreadCount === 0} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="checkmark-done-outline" size={22} color={unreadCount === 0 ? colors.textFaint : colors.teal} />
          </TouchableOpacity>
        }
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.tabsWrap}>
        <SegmentedTabs<TabKey>
          tabs={[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread', count: unreadCount },
          ]}
          active={tab}
          onChange={setTab}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const icon = CATEGORY_ICONS[item.category] ?? 'notifications-outline';
          const color = CATEGORY_COLORS[item.category] ?? colors.textMuted;
          return (
            <TouchableOpacity style={[styles.item, item.isRead && styles.itemRead]} onPress={() => openNotification(item)} activeOpacity={0.85}>
              <View style={[styles.iconWrap, { backgroundColor: `${color}18` }]}>
                <Ionicons name={icon} size={19} color={color} />
              </View>
              <View style={styles.body}>
                <View style={styles.itemTop}>
                  <Text style={[styles.title, item.isRead && styles.titleRead]} numberOfLines={1}>{item.title}</Text>
                  {!item.isRead ? <View style={styles.dot} /> : null}
                </View>
                <Text style={[styles.message, item.isRead && styles.messageRead]} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={tab === 'unread' ? 'notifications-off-outline' : 'notifications-outline'}
            title={tab === 'unread' ? 'All caught up' : 'No notifications yet'}
            message={
              tab === 'unread'
                ? 'You have no unread notifications.'
                : 'Loan updates, payment confirmations, and announcements will appear here.'
            }
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  error: { fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 8 },
  tabsWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  content: { padding: 16, paddingTop: 6, paddingBottom: 110, flexGrow: 1 },
  item: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemRead: { opacity: 0.7 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  body: { flex: 1 },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.text, marginRight: 6 },
  titleRead: { color: colors.textSecondary },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryBright,
  },
  message: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  messageRead: { color: colors.textMuted },
  time: { fontSize: 10, color: colors.textFaint, marginTop: 5 },
});