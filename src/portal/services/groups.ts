import { clientRequest, withMockFallback } from './clientApi';
import { ClientGroup } from '../types';
import { mockGroup } from './mock';

export const groupService = {
  async myGroup(): Promise<ClientGroup | null> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/groups/my');
        const group = payload?.group || payload;
        return group || null;
      },
      async () => mockGroup
    );
  },
};