import type { PayoutChannel } from '../../../shared/payments';
import { clientRequest } from './clientApi';

export type OnlineDeposit = ReturnType<typeof import('../../payments/service').depositView>;
export type OnlinePayout = ReturnType<typeof import('../../payments/service').payoutView>;
export type PayoutAccount = ReturnType<typeof import('../../payments/service').payoutAccountView>;

export interface OnlineOverview {
  provider: string;
  limits: { dailyLimit: string; usedToday: string; remaining: string };
  deposits: OnlineDeposit[];
  payouts: OnlinePayout[];
  payoutAccounts: PayoutAccount[];
  channels: PayoutChannel[];
}

const enc = encodeURIComponent;
const post = (url: string, body: unknown) => clientRequest(url, { method: 'POST', body: JSON.stringify(body) });

/**
 * Online savings deposits and instant withdrawals. A deposit is credited only
 * when the payment provider confirms it to the server; deposit(id) asks the
 * server, which asks the provider.
 */
export const onlinePaymentsService = {
  async overview(): Promise<OnlineOverview> {
    const r = await clientRequest('/api/client/savings/online');
    return { provider: r.provider, limits: r.limits, deposits: r.deposits || [], payouts: r.payouts || [], payoutAccounts: r.payoutAccounts || [], channels: r.channels || [] };
  },

  /** Opens the provider's checkout; the member is sent there to pay. */
  async startDeposit(accountId: string, amount: string): Promise<OnlineDeposit> {
    return (await post('/api/client/savings/online/deposits', { accountId, amount }))?.deposit;
  },

  async deposit(id: string): Promise<OnlineDeposit> {
    return (await clientRequest(`/api/client/savings/online/deposits/${enc(id)}`))?.deposit;
  },

  async addPayoutAccount(input: { channelCode: string; accountNumber: string; accountName: string }): Promise<PayoutAccount> {
    return (await post('/api/client/savings/online/payout-accounts', input))?.payoutAccount;
  },

  async removePayoutAccount(id: string): Promise<PayoutAccount> {
    return (await post(`/api/client/savings/online/payout-accounts/${enc(id)}/remove`, {}))?.payoutAccount;
  },

  /** Checks the withdrawal and emails a one-time code; nothing is taken yet. */
  async startPayout(input: { accountId: string; payoutAccountId: string; amount: string }): Promise<{ payout: OnlinePayout; codeSentTo: string; expiresInSeconds: number }> {
    const r = await post('/api/client/savings/online/payouts', input);
    return { payout: r.payout, codeSentTo: r.codeSentTo, expiresInSeconds: r.expiresInSeconds };
  },

  async confirmPayout(id: string, code: string): Promise<OnlinePayout> {
    return (await post(`/api/client/savings/online/payouts/${enc(id)}/confirm`, { code }))?.payout;
  },

  async cancelPayout(id: string): Promise<OnlinePayout> {
    return (await post(`/api/client/savings/online/payouts/${enc(id)}/cancel`, {}))?.payout;
  },
};
