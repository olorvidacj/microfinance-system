import React, { useMemo, useState } from 'react';
import { ArrowRight, Calculator, Download, TrendingDown } from 'lucide-react';
import {
  FREQUENCY_LABELS,
  INTEREST_METHODS,
  INTEREST_METHOD_LABELS,
  QuoteError,
  REPAYMENT_FREQUENCIES,
  centsToDecimal,
  formatPeso,
  parsePercent,
  parsePesos,
  ppmToPercent,
  quoteLoan,
  type InterestMethod,
  type LoanProduct,
  type LoanQuote,
  type RepaymentFrequency,
} from '../../shared/lending';
import { InterestType, RepaymentFrequency as LegacyFrequency } from '../types';
import { LoanQuoteView, manilaToday } from './lending';

interface CalculatorViewProps {
  /** Products to start from; picking one fills in its terms and fees. */
  products?: LoanProduct[];
  /** Hands the simulated terms to the old origination form, where one exists. */
  onOriginateCalculatedLoan?: (params: {
    principalAmount: number;
    termMonths: number;
    interestRate: number;
    interestType: InterestType;
    repaymentFrequency: LegacyFrequency;
  }) => void;
}

const field = 'w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-sm';

export const CalculatorView: React.FC<CalculatorViewProps> = ({ products = [], onOriginateCalculatedLoan }) => {
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('15000');
  const [termMonths, setTermMonths] = useState('12');
  const [rate, setRate] = useState('18');
  const [method, setMethod] = useState<InterestMethod>('DIMINISHING');
  const [frequency, setFrequency] = useState<RepaymentFrequency>('MONTHLY');
  const [feePercent, setFeePercent] = useState('2');
  const [startDate, setStartDate] = useState(manilaToday());

  const product = products.find((p) => p.id === productId) ?? null;

  const pickProduct = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setRate(ppmToPercent(p.annualRate));
    setMethod(p.interestMethod);
    setFrequency(p.frequency);
    setAmount(centsToDecimal(p.minAmount));
    setTermMonths(String(p.minTermMonths));
  };

  const compute = (m: InterestMethod): { quote: LoanQuote | null; error: string | null } => {
    const principal = parsePesos(amount);
    const annualRate = parsePercent(rate);
    const term = /^\d{1,3}$/.test(termMonths.trim()) ? Number(termMonths) : NaN;
    if (principal === null || principal <= 0) return { quote: null, error: 'Enter a loan amount in pesos (up to two decimals).' };
    if (annualRate === null) return { quote: null, error: 'Enter the annual rate as a percentage (up to four decimals).' };
    const fee = product ? null : parsePercent(feePercent || '0');
    if (!product && fee === null) return { quote: null, error: 'Enter the processing fee as a percentage.' };
    try {
      const quote = quoteLoan({
        principal,
        termMonths: term,
        annualRate,
        method: m,
        frequency,
        fees: product ? product.fees : fee ? [{ code: 'PROCESSING', label: 'Processing fee', kind: 'PERCENT', value: fee }] : [],
        startDate,
      });
      return { quote, error: null };
    } catch (err) {
      return { quote: null, error: err instanceof QuoteError ? err.message : 'These terms cannot be calculated.' };
    }
  };

  const main = useMemo(() => compute(method), [amount, termMonths, rate, method, frequency, feePercent, startDate, product]);
  const other = useMemo(() => compute(method === 'FLAT' ? 'DIMINISHING' : 'FLAT'), [amount, termMonths, rate, method, frequency, feePercent, startDate, product]);
  const outsideProduct =
    product && main.quote
      ? main.quote.principal < product.minAmount || main.quote.principal > product.maxAmount || main.quote.termMonths < product.minTermMonths || main.quote.termMonths > product.maxTermMonths
      : false;

  const exportCsv = () => {
    if (!main.quote) return;
    const rows = [['Installment', 'Due date', 'Principal', 'Interest', 'Installment amount', 'Balance after']].concat(
      main.quote.schedule.map((l) => [String(l.number), l.dueDate, centsToDecimal(l.principal), centsToDecimal(l.interest), centsToDecimal(l.total), centsToDecimal(l.balanceAfter)]),
    );
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule_${amount}_${termMonths}mo.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Loan calculator</h1>
          <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">The same calculation used for applications, approvals and the stored schedule.</p>
        </div>
        {onOriginateCalculatedLoan && main.quote && (
          <button
            onClick={() =>
              onOriginateCalculatedLoan({
                principalAmount: Number(centsToDecimal(main.quote!.principal)),
                termMonths: main.quote!.termMonths,
                interestRate: Number(rate),
                interestType: method === 'FLAT' ? 'Flat Rate' : 'Reducing Balance',
                repaymentFrequency: frequency === 'WEEKLY' ? 'Weekly' : frequency === 'BI_WEEKLY' ? 'Bi-Weekly' : 'Monthly',
              })
            }
            className="flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
          >
            Originate this loan <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Calculator className="h-4 w-4 text-gold-600" />
            <h3 className="text-base font-bold text-gray-900">Terms</h3>
          </div>
          {products.length > 0 && (
            <label className="block text-xs font-semibold text-gray-700">
              Product
              <select className={`${field} mt-1`} value={productId} onChange={(e) => pickProduct(e.target.value)}>
                <option value="">Custom terms</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-gray-700">
              Amount (₱)
              <input className={`${field} mt-1 font-mono`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Term (months)
              <input className={`${field} mt-1 font-mono`} inputMode="numeric" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Annual rate (%)
              <input className={`${field} mt-1 font-mono`} inputMode="decimal" value={rate} disabled={!!product} onChange={(e) => setRate(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Processing fee (%)
              <input className={`${field} mt-1 font-mono`} inputMode="decimal" value={product ? 'Product fees' : feePercent} disabled={!!product} onChange={(e) => setFeePercent(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Interest method
              <select className={`${field} mt-1`} value={method} disabled={!!product} onChange={(e) => setMethod(e.target.value as InterestMethod)}>
                {INTEREST_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {INTEREST_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Frequency
              <select className={`${field} mt-1`} value={frequency} disabled={!!product} onChange={(e) => setFrequency(e.target.value as RepaymentFrequency)}>
                {REPAYMENT_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 block text-xs font-semibold text-gray-700">
              Release date
              <input type="date" className={`${field} mt-1`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
          </div>
          {outsideProduct && product && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Outside the product's limits ({formatPeso(product.minAmount)}–{formatPeso(product.maxAmount)}, {product.minTermMonths}–{product.maxTermMonths} months); an application with these terms would be refused.
            </p>
          )}
        </div>

        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <LoanQuoteView quote={main.quote} error={main.error} initiallyOpen />
          </div>
          {main.quote && other.quote && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 text-xs">
              <div className="mb-2 flex items-center gap-1.5 font-bold text-gray-900">
                <TrendingDown className="h-4 w-4 text-emerald-600" /> Compared with {INTEREST_METHOD_LABELS[other.quote.method].toLowerCase()}
              </div>
              <p className="text-gray-600">
                Interest {formatPeso(other.quote.totalInterest)} instead of {formatPeso(main.quote.totalInterest)} (
                {formatPeso(Math.abs(other.quote.totalInterest - main.quote.totalInterest))} {other.quote.totalInterest > main.quote.totalInterest ? 'more' : 'less'}); installment{' '}
                {formatPeso(other.quote.installmentAmount)}.
              </p>
            </div>
          )}
          {main.quote && (
            <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
              <Download className="h-3.5 w-3.5" /> Export schedule (CSV)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
