import { ApiError, clientRequest } from './clientApi';
import type { ClientTransactionView, TransactionKind } from '../../../shared/client';

export interface TransactionsQuery {
  kind?: TransactionKind | 'ALL';
  search?: string;
  /** YYYY-MM-DD */
  from?: string;
}

export const transactionService = {
  async list(query: TransactionsQuery = {}): Promise<ClientTransactionView[]> {
    const params = new URLSearchParams();
    if (query.kind && query.kind !== 'ALL') params.set('kind', query.kind);
    if (query.search) params.set('search', query.search);
    if (query.from) params.set('from', query.from);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const rows: ClientTransactionView[] | undefined = await clientRequest(`/api/client/transactions${qs}`, undefined, (p) => p?.transactions);
    if (!Array.isArray(rows)) throw new ApiError('Your transactions could not be loaded.');
    return rows;
  },
};
