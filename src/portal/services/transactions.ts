import { clientRequest } from './clientApi';
import { FinancialTransaction, TransactionType } from '../types';

export interface TransactionsQuery {
  period?: string;
  type?: TransactionType | 'ALL';
  search?: string;
}

export const transactionService = {
  async list(query?: TransactionsQuery): Promise<FinancialTransaction[]> {
    const params = new URLSearchParams();
    if (query?.period) params.set('period', query.period);
    if (query?.type && query.type !== 'ALL') params.set('type', query.type);
    if (query?.search) params.set('search', query.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const payload = await clientRequest(`/api/client/transactions${qs}`);
    return payload?.transactions || payload || [];
  },

  async detail(id: string): Promise<FinancialTransaction | undefined> {
    const payload = await clientRequest(`/api/client/transactions/${id}`);
    return payload?.transaction || payload;
  },
};
