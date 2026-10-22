import { clientRequest } from './clientApi';
import type { ReceiptDocument } from '../../../shared/lending';
import type { PaymentView, ProofView } from '../../lending/repayment';

export type PayoffQuote = Awaited<ReturnType<typeof import('../../lending/repayment').payoffQuote>>;
export type MemberProof = Omit<ProofView, 'storageRef'>;

export const paymentService = {
  /** Posted (and reversed) payments on all the member's loans, newest first. */
  async list(): Promise<PaymentView[]> {
    return (await clientRequest('/api/client/payments'))?.payments || [];
  },

  async proofs(): Promise<MemberProof[]> {
    return (await clientRequest('/api/client/payment-proofs'))?.proofs || [];
  },

  async payoff(loanId: string): Promise<PayoffQuote> {
    return (await clientRequest(`/api/client/loans/${encodeURIComponent(loanId)}/payoff`))?.payoff;
  },

  async receipt(paymentId: string): Promise<ReceiptDocument> {
    return (await clientRequest(`/api/client/payments/${encodeURIComponent(paymentId)}/receipt`))?.receipt;
  },

  /** Sends proof of a bank or e-wallet transfer; staff verify it before anything is posted. */
  async submitProof(input: {
    loanId: string;
    amount: string;
    method: string;
    referenceNumber: string;
    paymentDate: string;
    notes?: string;
    fileBase64: string;
    fileName: string;
  }): Promise<MemberProof> {
    const payload = await clientRequest('/api/client/submit-payment-proof', { method: 'POST', body: JSON.stringify(input) });
    return payload.proof;
  },
};
