import type { ClientTransactionView, SavingsStatementView } from './contracts';

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A savings statement as CSV, the same file from the web portal and the mobile app. */
export function statementCsv(s: SavingsStatementView): string {
  const rows: unknown[][] = [
    ['Savings statement', s.account.passbookNumber, s.account.memberName, s.account.product.name],
    ['Period', s.from ?? '', s.to],
    ['Opening balance', s.openingBalance],
    [],
    ['Date', 'Transaction', 'Type', 'Reference', 'Money in', 'Money out', 'Balance'],
    ...s.lines.map((l) => [l.date, l.number, l.label, l.reference ?? '', l.moneyIn ?? '', l.moneyOut ?? '', l.balance]),
    [],
    ['Total in', s.totalIn],
    ['Total out', s.totalOut],
    ['Closing balance', s.closingBalance],
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}


/** The member's transaction history as CSV (amounts signed from the member's side). */
export function transactionsCsv(rows: readonly ClientTransactionView[]): string {
  const out: unknown[][] = [
    ['Date', 'Transaction', 'Account', 'Reference', 'Amount', 'Method', 'Status', 'Notes'],
    ...rows.map((t) => [t.date, t.label, t.account, t.reference, t.direction === 'OUT' ? `-${t.amount}` : t.amount, t.method, t.status, t.notes ?? '']),
  ];
  return out.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
