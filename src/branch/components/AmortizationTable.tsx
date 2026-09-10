import React from 'react';
import { formatCurrency } from '../../utils/loanMath';
import { InstallmentRow } from '../types';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';

export const AmortizationTable: React.FC<{ items: InstallmentRow[] }> = ({ items }) => {
  if (items.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-slate-400">No amortization schedule available.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {['No.', 'Due date', 'Principal', 'Interest', 'Fees', 'Total due', 'Paid', 'Balance', 'Status'].map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((row) => (
            <tr key={row.installmentNumber} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-500">{row.installmentNumber}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-700">{row.dueDate}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700">{formatCurrency(row.principal)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700">{formatCurrency(row.interest)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700">{formatCurrency(row.fees)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-sm font-semibold tabular-nums text-slate-800">{formatCurrency(row.totalDue)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-emerald-600">{formatCurrency(row.amountPaid)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700">{formatCurrency(row.remainingBalance)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};