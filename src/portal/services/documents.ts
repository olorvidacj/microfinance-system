import { withMockFallback } from './clientApi';
import { PortalDocument } from '../types';
import { mockDocuments } from './mock';

export const documentService = {
  // Backend document endpoints are not yet available for clients, so this is
  // served entirely from local portal data. The mock is the only source.
  async list(): Promise<PortalDocument[]> {
    return withMockFallback(async () => mockDocuments, async () => mockDocuments);
  },
};