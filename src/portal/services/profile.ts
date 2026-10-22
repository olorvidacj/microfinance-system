import { ApiError, clientRequest } from './clientApi';
import type { Discrepancy, KycApplicationPayload } from '../../../shared/kyc-core';
import type { FaceMatchView, IdScanView, KycUploadView } from '../../../shared/client';
import type { ClientProfile, KycStatusData } from '../types';

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
    const payload: KycStatusData | undefined = await clientRequest('/api/client/kyc-status', undefined, (p) => (p?.kycStatus ? p : undefined));
    if (!payload) throw new ApiError('Your verification status could not be loaded.');
    return payload;
  },

  /** Saves progress. Only parts the member may change now are accepted by the server. */
  async saveDraft(data: KycApplicationPayload & { currentStep?: number }): Promise<{ submissionId: string | null; status: string }> {
    const payload = await clientRequest('/api/client/kyc/save-draft', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!payload?.success) throw new ApiError(payload?.error || payload?.message || 'Your progress could not be saved.');
    return { submissionId: payload.submissionId ?? null, status: payload.status };
  },

  async submitKyc(data: KycApplicationPayload): Promise<{ status: string; statusLabel: string; referenceNumber: string | null }> {
    const payload = await clientRequest('/api/client/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!payload?.success) throw new ApiError(payload?.error || payload?.message || 'Your application could not be submitted.');
    return { status: payload.status, statusLabel: payload.statusLabel, referenceNumber: payload.referenceNumber ?? null };
  },

  /** Stores one supporting document (the server checks its type, size and photo quality). */
  async uploadKycDocument(doc: { documentType: string; documentName: string; fileName?: string; imageBase64: string; side?: 'FRONT' | 'BACK' }): Promise<KycUploadView['document']> {
    const payload = await clientRequest('/api/client/kyc/documents/upload', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
    if (!payload?.document) throw new ApiError(payload?.error || payload?.message || 'The document could not be uploaded.');
    return payload.document;
  },

  /** Stores the ID photo(s) and reads them automatically; the reading is for the member to check, not a verification. */
  async processId(data: { frontImageBase64?: string; backImageBase64?: string; fileName?: string } = {}): Promise<IdScanView & { discrepancies: Discrepancy[] }> {
    const payload = await clientRequest('/api/client/kyc/process-id', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!payload?.validation) throw new ApiError(payload?.error || payload?.message || 'Your ID could not be checked.');
    return payload;
  },

  /** Stores a new selfie (if given) and compares the stored selfie with the stored ID photo on the server. */
  async matchFace(data: { selfieImageBase64?: string } = {}): Promise<FaceMatchView> {
    const payload = await clientRequest('/api/client/kyc/match-face', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!payload?.selfie) throw new ApiError(payload?.error || payload?.message || 'Your selfie could not be checked.');
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
