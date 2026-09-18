import { clientRequest } from './clientApi';
import { SavingsAccount, SavingsTransaction, WithdrawalRequest } from '../types';

export const savingsService = {
  async account(): Promise<SavingsAccount> {
    const payload = await clientRequest('/api/client/savings');
    return (payload?.account || payload || {}) as SavingsAccount;
  },

  async transactions(): Promise<SavingsTransaction[]> {
    const payload = await clientRequest('/api/client/savings/transactions');
    return payload?.transactions || payload || [];
  },

  async requestWithdrawal(input: { amount: number; reason: string }): Promise<WithdrawalRequest> {
    const payload = await clientRequest('/api/client/savings/withdraw', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload?.request;
  },
};
