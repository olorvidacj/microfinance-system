import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  FREQUENCY_LABELS,
  INTEREST_METHOD_LABELS,
  LENDING_TYPE_LABELS,
  centsFromDb,
  formatPercent,
  formatPeso,
  quoteToDto,
  type LoanProduct,
  type LoanQuote,
} from '../../../shared/lending';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';

/** Formats a decimal string or centavo count from the API as pesos. */
export function peso(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return formatPeso(typeof value === 'number' ? value : centsFromDb(value));
}

export interface ScheduleRowLike {
  number: number;
  dueDate: string;
  principal: string;
  interest: string;
  total: string;
  balanceAfter: string;
  paid?: string;
  /** Late penalties charged on the installment. */
  penalty?: string;
  status?: string;
}

export const ScheduleTable: React.FC<{ rows: ScheduleRowLike[]; showPaid?: boolean; maxHeight?: string }> = ({ rows, showPaid, maxHeight = 'max-h-96' }) => {
  if (rows.length === 0) return <p className="px-5 py-8 text-center text-sm text-slate-400">No schedule yet.</p>;
  const hasPenalty = rows.some((r) => r.penalty && r.penalty !== '0.00');
  const headers = ['#', 'Due date', 'Principal', 'Interest', 'Installment', ...(hasPenalty ? ['Penalty'] : []), ...(showPaid ? ['Paid'] : []), 'Balance after', ...(rows[0].status ? ['Status'] : [])];
  return (
    <div className={`overflow-auto ${maxHeight}`}>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 tabular-nums">
          {rows.map((r) => (
            <tr key={r.number}>
              <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.number}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.dueDate}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{peso(r.principal)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{peso(r.interest)}</td>
              <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">{peso(r.total)}</td>
              {hasPenalty && <td className="whitespace-nowrap px-3 py-2 text-rose-700">{r.penalty && r.penalty !== '0.00' ? peso(r.penalty) : '—'}</td>}
              {showPaid && <td className="whitespace-nowrap px-3 py-2 text-emerald-700">{peso(r.paid ?? '0')}</td>}
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">{peso(r.balanceAfter)}</td>
              {r.status && (
                <td className="whitespace-nowrap px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Figure: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className={`rounded-xl border p-3 ${strong ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`mt-0.5 text-base font-bold tabular-nums ${strong ? 'text-emerald-800' : 'text-slate-800'}`}>{value}</p>
  </div>
);

/** The live amortization preview: summary figures and the full schedule. */
export const LoanQuoteView: React.FC<{ quote: LoanQuote | null; error?: string | null; initiallyOpen?: boolean }> = ({ quote, error, initiallyOpen = false }) => {
  const [open, setOpen] = useState(initiallyOpen);
  if (error) return <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>;
  if (!quote) return null;
  const dto = quoteToDto(quote);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Figure label={`${FREQUENCY_LABELS[quote.frequency]} installment`} value={formatPeso(quote.installmentAmount)} strong />
        <Figure label="Installments" value={`${quote.installments}`} />
        <Figure label="Total interest" value={formatPeso(quote.totalInterest)} />
        <Figure label="Fees (deducted at release)" value={formatPeso(quote.totalFees)} />
        <Figure label="Net amount released" value={formatPeso(quote.netProceeds)} />
        <Figure label="Total to repay" value={formatPeso(quote.totalPayable)} />
      </div>
      {quote.fees.length > 0 && (
        <p className="text-xs text-slate-500">
          Fees: {quote.fees.map((f) => `${f.label} ${formatPeso(f.amount)}`).join(' · ')}
        </p>
      )}
      <p className="text-xs text-slate-500">
        First payment {quote.firstDueDate} · last payment {quote.maturityDate}. Dates are counted from the release date, so they move if the loan is released later.
      </p>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900">
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? 'Hide' : 'Show'} the full schedule
      </button>
      {open && (
        <div className="rounded-xl border border-slate-200">
          <ScheduleTable rows={dto.schedule} />
        </div>
      )}
    </div>
  );
};

/** One-paragraph summary of a product's terms. */
export const ProductTerms: React.FC<{ product: LoanProduct }> = ({ product }) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
    <div>
      <dt className="text-slate-400">Interest</dt>
      <dd className="font-semibold text-slate-800">
        {formatPercent(product.annualRate)} a year, {INTEREST_METHOD_LABELS[product.interestMethod].toLowerCase()}
      </dd>
    </div>
    <div>
      <dt className="text-slate-400">Payments</dt>
      <dd className="font-semibold text-slate-800">{FREQUENCY_LABELS[product.frequency]}</dd>
    </div>
    <div>
      <dt className="text-slate-400">Amount</dt>
      <dd className="font-semibold text-slate-800">
        {formatPeso(product.minAmount)} – {formatPeso(product.maxAmount)}
      </dd>
    </div>
    <div>
      <dt className="text-slate-400">Term</dt>
      <dd className="font-semibold text-slate-800">
        {product.minTermMonths}–{product.maxTermMonths} months
      </dd>
    </div>
    <div>
      <dt className="text-slate-400">Fees</dt>
      <dd className="font-semibold text-slate-800">
        {product.fees.length === 0
          ? 'None'
          : product.fees.map((f) => `${f.label} ${f.kind === 'PERCENT' ? formatPercent(f.value) : formatPeso(f.value)}`).join(', ')}
      </dd>
    </div>
    <div>
      <dt className="text-slate-400">Late penalty</dt>
      <dd className="font-semibold text-slate-800">{formatPercent(product.penaltyRate)} a month on overdue amounts</dd>
    </div>
    <div>
      <dt className="text-slate-400">Type</dt>
      <dd className="font-semibold text-slate-800">{LENDING_TYPE_LABELS[product.lendingType]}</dd>
    </div>
  </dl>
);
