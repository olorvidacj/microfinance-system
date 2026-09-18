import { clientRequest } from './clientApi';
import { LoginActivityItem, NotificationPreferences, PrivacyPreferences } from '../types';

export const settingsService = {
  async notificationPreferences(): Promise<NotificationPreferences> {
    const payload = await clientRequest('/api/client/settings/notifications');
    return (payload?.preferences || payload || {}) as NotificationPreferences;
  },

  async saveNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
    await clientRequest('/api/client/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },

  async loginActivity(): Promise<LoginActivityItem[]> {
    const payload = await clientRequest('/api/client/settings/sessions');
    return payload?.sessions || payload || [];
  },

  async privacyPreferences(): Promise<PrivacyPreferences> {
    const payload = await clientRequest('/api/client/settings/privacy');
    return (payload?.preferences || payload || {}) as PrivacyPreferences;
  },

  async savePrivacyPreferences(prefs: PrivacyPreferences): Promise<void> {
    await clientRequest('/api/client/settings/privacy', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },
};
