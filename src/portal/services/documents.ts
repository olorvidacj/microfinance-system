import { clientRequest } from './clientApi';
import { PortalDocument } from '../types';

export const documentService = {
  /** The member's own documents (KYC and loan papers). */
  async list(): Promise<PortalDocument[]> {
    return (await clientRequest('/api/client/documents'))?.documents || [];
  },

  /** A short-lived link to the stored file. */
  async fileUrl(id: string): Promise<string> {
    return (await clientRequest(`/api/client/documents/${encodeURIComponent(id)}/file`))?.url;
  },
};
