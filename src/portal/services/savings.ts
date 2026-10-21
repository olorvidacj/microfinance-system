import { clientRequest } from './clientApi';
import type { SavingsStatement } from '../../components/savings/SavingsStatement';

export type MemberSavingsAccount = import('../../savings/service').SavingsAccountView;
export type MemberWithdrawalRequest = ReturnType<typeof import('../../savings/service').requestView>;

const enc = encodeURIComponent;

export const savingsService = {
  /** Every savings account the member holds (regular, compulsory, time deposit). */
  async accounts(): Promise<MemberSavingsAccount[]> {
    return (await clientRequest('/api/client/savings'))?.accounts || [];
  },

  async statement(accountId: string, range?: { from?: string; to?: string }): Promise<SavingsStatement> {
    const qs = new URLSearchParams();
    if (range?.from) qs.set('from', range.from);
    if (range?.to) qs.set('to', range.to);
    return (await clientRequest(`/api/client/savings/${enc(accountId)}/statement${qs.toString() ? `?${qs}` : ''}`))?.statement;
  },

  async requests(): Promise<MemberWithdrawalRequest[]> {
    return (await clientRequest('/api/client/savings/withdrawal-requests'))?.requests || [];
  },

  /** Files a request; branch staff release the money after checking it. */
  async requestWithdrawal(input: { accountId: string; amount: string; destination: string; destinationAccount?: string; reason: string }): Promise<MemberWithdrawalRequest> {
    return (await clientRequest('/api/client/savings/withdraw', { method: 'POST', body: JSON.stringify(input) }))?.request;
  },

  async cancelRequest(id: string): Promise<MemberWithdrawalRequest> {
    return (await clientRequest(`/api/client/savings/withdrawal-requests/${enc(id)}/cancel`, { method: 'POST', body: '{}' }))?.request;
  },
};
