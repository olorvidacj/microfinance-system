import { ApiError, clientRequest } from './clientApi';
import { ClientProfile, KycStatusData, KycSubmissionFull, KycRequiredDocumentItem } from '../types';

export const profileService = {
  async get(): Promise<ClientProfile> {
    const payload = await clientRequest('/api/client/profile', undefined, (p) => p?.profile);
    return (payload || {}) as ClientProfile;
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
    const payload = await clientRequest('/api/client/kyc-status');
    return payload || { kycStatus: 'VERIFIED', isVerified: true, requiredDocuments: [], uploadedDocuments: [] };
  },

  async submitKyc(data: { personalInfo: any; address: any; employment: any }): Promise<any> {
    const payload = await clientRequest('/api/client/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!payload?.success) throw new ApiError(payload?.message || 'KYC submission failed');
    return payload;
  },

  async kycDocuments(): Promise<any[]> {
    const payload = await clientRequest('/api/client/kyc/documents');
    return payload?.documents || [];
  },

  async uploadKycDocument(doc: { documentType: string; documentName: string; fileName?: string }): Promise<any> {
    const payload = await clientRequest('/api/client/kyc/documents/upload', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
    if (!payload?.success) throw new ApiError(payload?.message || 'Document upload failed');
    return payload?.document;
  },
};
