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
    return payload || { kycStatus: 'NOT_STARTED', isVerified: false, requiredDocuments: [], uploadedDocuments: [] };
  },

  async saveDraft(data: {
    personalInfo?: any;
    address?: any;
    contactInfo?: any;
    employment?: any;
    governmentId?: any;
    declarations?: any;
    currentStep?: number;
  }): Promise<any> {
    const payload = await clientRequest('/api/client/kyc/save-draft', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!payload?.success) throw new ApiError(payload?.error || payload?.message || 'Failed to save draft');
    return payload;
  },

  async submitKyc(data: {
    personalInfo: any;
    address: any;
    contactInfo: any;
    employment: any;
    governmentId: any;
    declarations: any;
  }): Promise<any> {
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
