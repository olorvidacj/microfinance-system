/** A printable receipt, as the server issues it and ReceiptModal renders it. Amounts are decimal strings. */
export interface ReceiptDocument {
  kind: 'DISBURSEMENT' | 'PAYMENT';
  title: string;
  receiptNumber: string;
  issuedAt: string;
  branchName: string | null;
  branchAddress: string | null;
  partyLabel: string;
  partyName: string;
  partyNumber: string | null;
  accountLabel: string;
  accountNumber: string;
  accountDetail: string | null;
  lines: { label: string; detail?: string | null; amount: string; deduction?: boolean }[];
  totalLabel: string;
  totalAmount: string;
  method: string;
  reference: string | null;
  destination: string | null;
  processedBy: string;
  notes: string | null;
  footer: string | null;
}
