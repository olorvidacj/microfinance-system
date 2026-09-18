import { clientRequest } from './clientApi';
import { ClientGroup } from '../types';

export const groupService = {
  async myGroup(): Promise<ClientGroup | null> {
    const payload = await clientRequest('/api/client/groups/my');
    const group = payload?.group || payload;
    return group || null;
  },
};
