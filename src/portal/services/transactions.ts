import { clientRequest, withMockFallback } from './clientApi';
import { FinancialTransaction, TransactionType } from '../types';
import { mockTransactions } from './mock';

export interface TransactionsQuery {
  period?: string;
  type?: TransactionType | 'ALL';
  search?: string;
}

export const transactionService = {
  async list(query?: TransactionsQuery): Promise<FinancialTransaction[]> {
    return withMockFallback(
      async () => {
        const params = new URLSearchParams();
        if (query?.period) params.set('period', query.period);
        if (query?.type && query.type !== 'ALL') params.set('type', query.type);
        if (query?.search) params.set('search', query.search);
        const qs = params.toString() ? `?${params.toString()}` : '';
        const payload = await clientRequest(`/api/client/transactions${qs}`);
        return payload?.transactions || payload || mockTransactions;
      },
      async () => {
        let rows = [...mockTransactions];
        if (query?.type && query.type !== 'ALL') rows = rows.filter((t) => t.type === query.type);
        if (query?.search) {
          const needle = query.search.toLowerCase();
          rows = rows.filter(
            (t) =>
              t.description.toLowerCase().includes(needle) ||
              t.referenceNumber.toLowerCase().includes(needle)
          );
        }
        return rows;
      }
    );
  },

  async detail(id: string): Promise<FinancialTransaction | undefined> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest(`/api/client/transactions/${id}`);
        return payload?.transaction || payload;
      },
      async () => mockTransactions.find((t) => t.id === id)
    );
  },
};