import { clientRequest, withMockFallback } from './clientApi';
import { LoginActivityItem, NotificationPreferences, PrivacyPreferences } from '../types';
import { mockLoginActivity, mockNotificationPreferences, mockPrivacyPreferences } from './mock';

export const settingsService = {
  async notificationPreferences(): Promise<NotificationPreferences> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/settings/notifications');
        return { ...mockNotificationPreferences, ...(payload?.preferences || payload || {}) };
      },
      async () => mockNotificationPreferences
    );
  },

  async saveNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
    await clientRequest('/api/client/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },

  async loginActivity(): Promise<LoginActivityItem[]> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/settings/sessions');
        return payload?.sessions || payload || mockLoginActivity;
      },
      async () => mockLoginActivity
    );
  },

  async privacyPreferences(): Promise<PrivacyPreferences> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/settings/privacy');
        return { ...mockPrivacyPreferences, ...(payload?.preferences || payload || {}) };
      },
      async () => mockPrivacyPreferences
    );
  },

  async savePrivacyPreferences(prefs: PrivacyPreferences): Promise<void> {
    await clientRequest('/api/client/settings/privacy', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },
};