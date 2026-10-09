import { clientRequest } from './clientApi';
import { ClientGroup } from '../types';

export const groupService = {
  async myGroup(): Promise<ClientGroup | null> {
    const payload = await clientRequest('/api/client/groups/my');
    if (!payload || typeof payload !== 'object') return null;

    if ('group' in payload) {
      if (!payload.group || typeof payload.group !== 'object') return null;
      return payload.group as ClientGroup;
    }

    if (payload.id && (payload.name || payload.groupName)) {
      return payload as ClientGroup;
    }

    return null;
  },
};

