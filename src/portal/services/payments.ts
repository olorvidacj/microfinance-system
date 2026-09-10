import { ApiError, clientRequest, withMockFallback } from './clientApi';
import { PaymentProofResult, PaymentRecordItem } from '../types';
import { mockPayments } from './mock';

export const paymentService = {
  async list(loanId?: string): Promise<PaymentRecordItem[]> {
    return withMockFallback(
      async () => {
        const url = loanId ? `/api/client/loans/${loanId}/payments` : '/api/client/payments';
        const payload = await clientRequest(url);
        const rows = payload?.payments || payload || [];
        return rows.map((p: any, i: number) => ({
          id: String(p.id ?? i),
          loanId: p.loanId || p.loanNumber,
          loanNumber: p.loanNumber || '',
          amount: Number(p.amount) || 0,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod || 'CASH',
          referenceNumber: p.referenceNumber || '',
          officialReceiptNumber: p.officialReceiptNumber,
          status: p.status || 'COMPLETED',
          notes: p.notes,
        }));
      },
      async () => (loanId ? mockPayments.filter((p) => p.loanId === loanId) : mockPayments)
    );
  },

  async submitPaymentProof(input: {
    loanId: string;
    loanNumber: string;
    amount: number;
    paymentMethod: string;
    referenceNumber: string;
    paymentDate: string;
    notes?: string;
  }): Promise<PaymentProofResult> {
    const payload = await clientRequest('/api/client/submit-payment-proof', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (payload?.error) throw new ApiError(payload.error);
    return payload?.payment || payload?.proof || payload;
  },
};