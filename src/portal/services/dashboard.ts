import { clientRequest, withMockFallback } from './clientApi';
import { ClientDashboard } from '../types';
import { mockDashboard } from './mock';

export const dashboardService = {
  async get(): Promise<ClientDashboard> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/dashboard', undefined, (p) => p?.data);
        return { ...mockDashboard, ...(payload || {}) };
      },
      async () => mockDashboard
    );
  },
};