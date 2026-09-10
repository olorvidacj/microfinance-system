import { ApiError, clientRequest, withMockFallback } from './clientApi';
import { ClientProfile, KycStatusData } from '../types';
import { mockProfile } from './mock';

export const profileService = {
  async get(): Promise<ClientProfile> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/profile', undefined, (p) => p?.profile);
        return { ...mockProfile, ...(payload || {}) };
      },
      async () => mockProfile
    );
  },

  async update(updates: Partial<ClientProfile>): Promise<void> {
    const payload = await clientRequest('/api/client/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    if (!payload?.success) throw new ApiError(payload?.message || 'Profile update failed');
  },

  async uploadAvatar(avatarUrl: string): Promise<void> {
    await clientRequest('/api/client/upload-avatar', {
      method: 'POST',
      body: JSON.stringify({ avatarUrl }),
    });
  },

  async kycStatus(): Promise<KycStatusData> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/kyc-status');
        return payload || { kycStatus: 'VERIFIED', isVerified: true, requiredDocuments: [], uploadedDocuments: [] };
      },
      async () => ({
        kycStatus: 'VERIFIED',
        isVerified: true,
        requiredDocuments: [],
        uploadedDocuments: [],
      })
    );
  },
};