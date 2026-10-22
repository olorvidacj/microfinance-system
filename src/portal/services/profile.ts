import { ApiError, clientRequest } from './clientApi';
import type { KycApplicationPayload } from '../../../shared/kyc-core';
import {
  ClientProfile,
  KycStatusData,
  KycSubmissionFull,
  KycRequiredDocumentItem,
  ExtractedIdData,
  FaceMatchResult,
} from '../types';

export const profileService = {
  async get(): Promise<ClientProfile> {
    const profile: ClientProfile | undefined = await clientRequest('/api/client/profile', undefined, (p) => p?.profile);
    if (!profile) throw new ApiError('Your profile could not be loaded.');
    return profile;
  },

  async update(updates: Record<string, string>): Promise<void> {
    const payload = await clientRequest('/api/client/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    if (!payload?.success) throw new ApiError(payload?.message || 'Profile update failed');
  },

  /** Change the signed-in member's password (current one required). */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await clientRequest('/api/client/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
  },

  async uploadAvatar(avatarUrl: string): Promise<void> {
    await clientRequest('/api/client/upload-avatar', {
      method: 'POST',
      body: JSON.stringify({ avatarUrl }),
    });
  },

  async kycStatus(): Promise<KycStatusData> {
    const payload = await clientRequest('/api/client/kyc-status');
    return payload || { kycStatus: 'NOT_STARTED', isVerified: false, requiredDocuments: [], uploadedDocuments: [] };
  },

  async saveDraft(data: KycApplicationPayload & { currentStep?: number }): Promise<any> {
    const payload = await clientRequest('/api/client/kyc/save-draft', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!payload?.success) throw new ApiError(payload?.error || payload?.message || 'Failed to save draft');
    return payload;
  },

  async submitKyc(data: KycApplicationPayload): Promise<any> {
    const payload = await clientRequest('/api/client/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!payload?.success) throw new ApiError(payload?.error || payload?.message || 'KYC submission failed');
    return payload;
  },

  async kycDocuments(): Promise<any[]> {
    const payload = await clientRequest('/api/client/kyc/documents');
    return payload?.documents || [];
  },

  async uploadKycDocument(doc: {
    documentType: string;
    documentName: string;
    fileName?: string;
    imageBase64?: string;
    side?: string;
    mime?: string;
  }): Promise<any> {
    const payload = await clientRequest('/api/client/kyc/documents/upload', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
    if (!payload?.success) throw new ApiError(payload?.error || payload?.message || 'Document upload failed');
    return payload?.document;
  },

  async uploadSelfie(imageBase64: string, mime?: string): Promise<any> {
    const payload = await clientRequest('/api/client/kyc/selfie', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mime }),
    });
    if (!payload?.success) throw new ApiError(payload?.error || payload?.message || 'Selfie upload failed');
    return payload;
  },

  async processId(data: {
    frontImageBase64: string;
    backImageBase64?: string;
    documentType?: string;
    fileName?: string;
  }): Promise<{
    validation: { isReadable: boolean; confidenceScore: number; detectedType: string; validationWarnings: string[] };
    extractedData: ExtractedIdData;
    document: { id: string; frontFileUrl?: string; backFileUrl?: string };
  }> {
    const payload = await clientRequest('/api/client/kyc/process-id', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!payload?.success) throw new ApiError(payload?.error || payload?.message || 'ID verification failed');
    return payload;
  },

  async matchFace(data: {
    selfieImageBase64: string;
    idImageBase64?: string;
    livenessAction?: string;
  }): Promise<{
    matchResult: FaceMatchResult;
    selfie: { id: string; fileUrl?: string };
  }> {
    const payload = await clientRequest('/api/client/kyc/match-face', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!payload?.success) throw new ApiError(payload?.error || payload?.message || 'Face matching failed');
    return payload;
  },

  // PSGC Geography
  async getRegions(): Promise<Array<{ code: string; name: string; longName?: string; sortOrder: number }>> {
    const res = await fetch('/api/geography/regions');
    const json = await res.json();
    return json?.data || [];
  },

  async getProvinces(regionCode?: string): Promise<Array<{ code: string; name: string; regionCode: string }>> {
    const url = regionCode ? `/api/geography/provinces?regionCode=${encodeURIComponent(regionCode)}` : '/api/geography/provinces';
    const res = await fetch(url);
    const json = await res.json();
    return json?.data || [];
  },

  async getCities(regionCode?: string, provinceCode?: string): Promise<Array<{ code: string; name: string; isRegionalDistrict?: boolean; provinceCode?: string | null; regionCode: string }>> {
    const params = new URLSearchParams();
    if (regionCode) params.set('regionCode', regionCode);
    if (provinceCode) params.set('provinceCode', provinceCode);
    const url = `/api/geography/cities${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url);
    const json = await res.json();
    return json?.data || [];
  },

  async getBarangays(cityCode: string): Promise<Array<{ code: string; name: string; cityCode: string }>> {
    if (!cityCode) return [];
    const res = await fetch(`/api/geography/barangays?cityCode=${encodeURIComponent(cityCode)}`);
    const json = await res.json();
    return json?.data || [];
  },

  async getPostalCode(cityCode?: string, barangayCode?: string): Promise<string> {
    const params = new URLSearchParams();
    if (cityCode) params.set('cityCode', cityCode);
    if (barangayCode) params.set('barangayCode', barangayCode);
    const res = await fetch(`/api/geography/postal-code?${params.toString()}`);
    const json = await res.json();
    return json?.postalCode || '';
  },
};
