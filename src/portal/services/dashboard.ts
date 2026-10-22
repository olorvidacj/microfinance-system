import { ApiError, clientRequest } from './clientApi';
import type { ClientDashboardView } from '../../../shared/client';

export type { ClientDashboardView };

export const dashboardService = {
  async get(): Promise<ClientDashboardView> {
    const data: ClientDashboardView | undefined = await clientRequest('/api/client/dashboard', undefined, (p) => p?.data);
    if (!data) throw new ApiError('Your dashboard could not be loaded.');
    return data;
  },
};
