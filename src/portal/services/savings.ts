import { clientRequest, withMockFallback } from './clientApi';
import { SavingsAccount, SavingsTransaction, WithdrawalRequest } from '../types';
import { mockSavingsAccount, mockSavingsTransactions } from './mock';

export const savingsService = {
  async account(): Promise<SavingsAccount> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/savings');
        return { ...mockSavingsAccount, ...(payload?.account || payload || {}) };
      },
      async () => mockSavingsAccount
    );
  },

  async transactions(): Promise<SavingsTransaction[]> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/savings/transactions');
        return payload?.transactions || payload || mockSavingsTransactions;
      },
      async () => mockSavingsTransactions
    );
  },

  async requestWithdrawal(input: { amount: number; reason: string }): Promise<WithdrawalRequest> {
    return withMockFallback(
      async () => {
        const payload = await clientRequest('/api/client/savings/withdraw', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        return payload?.request;
      },
      async () => ({
        id: `WDRQ-${Date.now()}`,
        amount: input.amount,
        requestDate: new Date().toISOString().split('T')[0],
        reason: input.reason,
        status: 'PENDING',
      })
    );
  },
};