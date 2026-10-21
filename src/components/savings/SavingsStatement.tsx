import React from 'react';
import { Download, Printer } from 'lucide-react';
import { PAYMENT_METHOD_LABELS } from '../../../shared/lending';
import { Button } from '../../portal/components/ui/Button';
import { Field, Input } from '../../portal/components/ui/Field';
import { peso } from '../lending';
import { statementCsv } from '../../../shared/client/statement';

/** A savings statement as the server builds it (src/savings/service.ts statement()). */
export type SavingsStatement = Awaited<ReturnType<typeof import('../../savings/service').statement>>;


// The CSV layout is shared with the mobile app (shared/client/statement.ts).
export { statementCsv };

export function downloadStatement(s: SavingsStatement) {
  const blob = new Blob(['﻿', statementCsv(s)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `statement-${s.account.passbookNumber}-${s.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const StatementView: React.FC<{
  statement: SavingsStatement;
  from: string;
  to: string;
  onRange: (from: string, to: string) => void;
}> = ({ statement: s, from, to, onRange }) => (
  <div id="printable-statement" className="space-y-3">
    <div className="print-hidden flex flex-wrap items-end gap-3">
      <Field label="From">
        <Input type="date" value={from} max={to || undefined} onChange={(e) => onRange(e.target.value, to)} aria-label="From" />
      </Field>
      <Field label="To">
        <Input type="date" value={to} min={from || undefined} onChange={(e) => onRange(from, e.target.value)} aria-label="To" />
      </Field>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" onClick={() => downloadStatement(s)}><Download className="h-4 w-4" /> Export CSV</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
      </div>
    </div>
    <div className="hidden print:block">
      <h2 className="text-lg font-bold">Savings statement · {s.account.passbookNumber}</h2>
      <p className="text-sm">{s.account.memberName} · {s.account.product.name} · {s.from ?? '—'} to {s.to}</p>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {['Date', 'Transaction', 'Type', 'Reference', 'Money in', 'Money out', 'Balance'].map((h) => (
              <th key={h} className={`whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 ${['Money in', 'Money out', 'Balance'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <tr className="bg-slate-50/50">
            <td className="px-4 py-2 text-slate-500" colSpan={6}>Opening balance</td>
            <td className="px-4 py-2 text-right font-semibold tabular-nums">{peso(s.openingBalance)}</td>
          </tr>
          {s.lines.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No transactions in this period.</td></tr>
          )}
          {s.lines.map((l) => (
            <tr key={l.id} data-testid="statement-line">
              <td className="whitespace-nowrap px-4 py-2">{l.date}</td>
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{l.number}</td>
              <td className="px-4 py-2">{l.label}{l.method && l.method !== 'CASH' ? ` · ${PAYMENT_METHOD_LABELS[l.method as keyof typeof PAYMENT_METHOD_LABELS] ?? l.method}` : ''}{l.destinationAccount ? ` to ${l.destinationAccount}` : ''}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{l.reference ?? ''}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-emerald-700">{l.moneyIn ? peso(l.moneyIn) : ''}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-rose-700">{l.moneyOut ? peso(l.moneyOut) : ''}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums" data-testid="running-balance">{peso(l.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
          <tr>
            <td className="px-4 py-2" colSpan={4}>Totals · closing balance</td>
            <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{peso(s.totalIn)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-rose-700">{peso(s.totalOut)}</td>
            <td className="px-4 py-2 text-right tabular-nums" data-testid="closing-balance">{peso(s.closingBalance)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
);

