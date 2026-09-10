import { clientRequest, withMockFallback } from './clientApi';
import { NotificationCategory, NotificationsData } from '../types';
import { mockNotifications } from './mock';

export const notificationService = {
  async list(): Promise<NotificationsData> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/notifications');
        const notifications = payload?.notifications || payload || mockNotifications;
        const unreadCount =
          payload?.unreadCount !== undefined
            ? Number(payload.unreadCount)
            : notifications.filter((n: any) => !n.isRead).length;
        return {
          notifications: notifications.map((n: any) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            category: n.category as NotificationCategory,
            isRead: Boolean(n.isRead),
            createdAt: n.createdAt,
            meta: n.meta,
          })),
          unreadCount,
        };
      },
      async () => ({
        notifications: mockNotifications,
        unreadCount: mockNotifications.filter((n) => !n.isRead).length,
      })
    );
  },

  async markRead(id: string): Promise<void> {
    await clientRequest(`/api/client/notifications/${id}/read`, { method: 'PATCH' });
  },

  async markAllRead(): Promise<void> {
    await clientRequest('/api/client/notifications/mark-all-read', { method: 'POST' });
  },
};