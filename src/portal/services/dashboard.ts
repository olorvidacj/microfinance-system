import { clientRequest } from './clientApi';
import { ClientDashboard } from '../types';

export const dashboardService = {
  async get(): Promise<ClientDashboard> {
    const payload = await clientRequest('/api/client/dashboard', undefined, (p) => p?.data);
    return (payload || {}) as ClientDashboard;
  },
};
