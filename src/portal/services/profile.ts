import { ApiError, clientRequest, withMockFallback } from './clientApi';
import { ClientProfile, KycStatusData, KycSubmissionFull, KycRequiredDocumentItem } from '../types';
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

  async submitKyc(data: { personalInfo: any; address: any; employment: any }): Promise<any> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/kyc/submit', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (!payload?.success) throw new ApiError(payload?.message || 'KYC submission failed');
        return payload;
      },
      async () => ({ success: true, message: 'KYC submitted for review.' })
    );
  },

  async kycDocuments(): Promise<any[]> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/kyc/documents');
        return payload?.documents || [];
      },
      async () => []
    );
  },

  async uploadKycDocument(doc: { documentType: string; documentName: string; fileName?: string }): Promise<any> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/kyc/documents/upload', {
          method: 'POST',
          body: JSON.stringify(doc),
        });
        if (!payload?.success) throw new ApiError(payload?.message || 'Document upload failed');
        return payload?.document;
      },
      async () => ({ id: `doc-${Date.now()}`, ...doc, status: 'PENDING' })
    );
  },
};