import { PortalDocument } from '../types';

export const documentService = {
  // Backend document endpoints are not yet available for clients, so this is
  // served entirely from local portal data.
  async list(): Promise<PortalDocument[]> {
    return [];
  },
};
