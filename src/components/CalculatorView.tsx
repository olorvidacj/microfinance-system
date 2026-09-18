import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Download,
  Printer,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Percent,
  Calendar,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { calculateLoanSchedule, formatCurrency, formatDate } from '../utils/loanMath';
import { InterestType, RepaymentFrequency } from '../types';

interface CalculatorViewProps {
  onOriginateCalculatedLoan: (params: {
    principalAmount: number;
    termMonths: number;
    interestRate: number;
    interestType: InterestType;
    repaymentFrequency: RepaymentFrequency;
  }) => void;
}

export const CalculatorView: React.FC<CalculatorViewProps> = ({ onOriginateCalculatedLoan }) => {
  const [principal, setPrincipal] = useState<number>(15000);
  const [termMonths, setTermMonths] = useState<number>(12);
  const [interestRate, setInterestRate] = useState<number>(13.5);
  const [interestType, setInterestType] = useState<InterestType>('Reducing Balance');
  const [frequency, setFrequency] = useState<RepaymentFrequency>('Monthly');
  const [processingFeeRate, setProcessingFeeRate] = useState<number>(2.0);

  // Compute live schedule
  const calc = useMemo(() => {
    return calculateLoanSchedule({
      principal,
      annualInterestRate: interestRate,
      termMonths,
      interestType,
      repaymentFrequency: frequency,
      processingFeePercentage: processingFeeRate,
      startDate: new Date().toISOString().split('T')[0],
    });
  }, [principal, termMonths, interestRate, interestType, frequency, processingFeeRate]);

  // Compute alternative flat or reducing comparison
  const altCalc = useMemo(() => {
    return calculateLoanSchedule({
      principal,
      annualInterestRate: interestRate,
      termMonths,
      interestType: interestType === 'Reducing Balance' ? 'Flat Rate' : 'Reducing Balance',
      repaymentFrequency: frequency,
      processingFeePercentage: processingFeeRate,
    });
  }, [principal, termMonths, interestRate, interestType, frequency, processingFeeRate]);

  const exportScheduleCSV = () => {
    const headers = ['Installment #', 'Due Date', 'Principal ($)', 'Interest ($)', 'Total Installment ($)', 'Remaining Balance ($)'];
    const rows = calc.schedule.map((s) => [
      s.installmentNumber,
      s.dueDate,
      s.principal,
      s.interest,
      s.totalDue,
      s.remainingBalance,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `amortization_schedule_${principal}_${termMonths}mo.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Loan Simulator & Amortization Engine
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Test loan amounts, repayment frequencies, and compare Reducing Balance vs. Flat Rate methods in real time.
          </p>
        </div>

        <button
          onClick={() =>
            onOriginateCalculatedLoan({
              principalAmount: principal,
              termMonths,
              interestRate,
              interestType,
              repaymentFrequency: frequency,
            })
          }
          className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-sm font-semibold transition shadow-xs"
        >
          <span>Originate This Loan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Two Column Simulator Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Card (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-gold-500/10 text-gold-600 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-gray-900 text-base">Loan Parameters</h3>
          </div>

          {/* Principal Amount */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1.5">
              <span>Principal Amount</span>
              <span className="font-mono text-gold-600 text-sm font-bold">{formatCurrency(principal)}</span>
            </div>
            <input
              type="range"
              min="500"
              max="80000"
              step="500"
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gold-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
              <span>$500</span>
              <span>$40,000</span>
              <span>$80,000</span>
            </div>
          </div>

          {/* Tenor / Duration */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1.5">
              <span>Loan Tenor (Duration)</span>
              <span className="font-mono text-gold-600 text-sm font-bold">{termMonths} Months</span>
            </div>
            <input
              type="range"
              min="1"
              max="48"
              step="1"
              value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gold-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
              <span>1 Mo</span>
              <span>12 Mo</span>
              <span>24 Mo</span>
              <span>48 Mo</span>
            </div>
          </div>

          {/* Interest Rate */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1.5">
              <span>Annual Interest Rate</span>
              <span className="font-mono text-gold-600 text-sm font-bold">{interestRate}% p.a.</span>
            </div>
            <input
              type="range"
              min="3"
              max="36"
              step="0.5"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gold-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
              <span>3%</span>
              <span>15%</span>
              <span>36%</span>
            </div>
          </div>

          {/* Method & Frequency */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Calculation Method</label>
              <select
                value={interestType}
                onChange={(e: any) => setInterestType(e.target.value)}
                className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium"
              >
                <option value="Reducing Balance">Reducing Balance (Declining)</option>
                <option value="Flat Rate">Flat Rate</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Installment Frequency</label>
              <select
                value={frequency}
                onChange={(e: any) => setFrequency(e.target.value)}
                className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium"
              >
                <option value="Monthly">Monthly</option>
                <option value="Bi-Weekly">Bi-Weekly (Fortnightly)</option>
                <option value="Weekly">Weekly</option>
              </select>
            </div>
          </div>
        </div>

        {/* Calculation Result Summary (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Big Highlight Card */}
          <div className="bg-gradient-to-br from-slate-900 to-navy-950 p-6 rounded-2xl text-white shadow-md">
            <span className="text-xs font-semibold text-gold-300 uppercase tracking-wider">
              Calculated Periodic Repayment ({frequency})
            </span>
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono">
                {formatCurrency(calc.installmentAmount)}
              </span>
              <span className="text-xs text-slate-300">/ per installment</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-800 text-xs">
              <div>
                <div className="text-slate-400">Total Interest</div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                  {formatCurrency(calc.totalInterest)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Processing Fee ({processingFeeRate}%)</div>
                <div className="text-base font-bold font-mono text-slate-300 mt-0.5">
                  {formatCurrency(calc.processingFee)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Total Repayment</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {formatCurrency(calc.totalPayable)}
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Card (Method Analysis) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-600" />
                <span>Method Comparison vs {interestType === 'Reducing Balance' ? 'Flat Rate' : 'Reducing Balance'}</span>
              </div>
              <span className="text-[11px] text-gray-500">
                Difference: {formatCurrency(Math.abs(calc.totalInterest - altCalc.totalInterest))}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-gold-500/10 rounded-xl border border-gold-400/30">
                <div className="text-[11px] text-gold-700 font-semibold">{interestType} (Selected)</div>
                <div className="font-bold text-gray-900 font-mono mt-1">
                  Interest: {formatCurrency(calc.totalInterest)}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Installment: {formatCurrency(calc.installmentAmount)}
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-[11px] text-gray-600 font-semibold">
                  {interestType === 'Reducing Balance' ? 'Flat Rate' : 'Reducing Balance'}
                </div>
                <div className="font-bold text-gray-700 font-mono mt-1">
                  Interest: {formatCurrency(altCalc.totalInterest)}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Installment: {formatCurrency(altCalc.installmentAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Amortization Schedule Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Full Amortization Schedule Preview</h3>
            <p className="text-xs text-gray-500">
              {calc.totalInstallments} scheduled installments breakdown for {formatCurrency(principal)} @ {interestRate}%
            </p>
          </div>
          <button
            onClick={exportScheduleCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 sm:px-6">Installment #</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Principal ($)</th>
                <th className="py-3 px-4">Interest ($)</th>
                <th className="py-3 px-4">Total Due ($)</th>
                <th className="py-3 px-4 sm:px-6 text-right">Ending Principal Balance ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {calc.schedule.map((item) => (
                <tr key={item.installmentNumber} className="hover:bg-gray-50/80 transition">
                  <td className="py-2.5 px-4 sm:px-6 font-sans font-medium text-gray-900">
                    #{item.installmentNumber}
                  </td>
                  <td className="py-2.5 px-4 font-sans text-gray-600">{formatDate(item.dueDate)}</td>
                  <td className="py-2.5 px-4 text-gray-800">{formatCurrency(item.principal)}</td>
                  <td className="py-2.5 px-4 text-emerald-600">{formatCurrency(item.interest)}</td>
                  <td className="py-2.5 px-4 font-bold text-gray-900">{formatCurrency(item.totalDue)}</td>
                  <td className="py-2.5 px-4 sm:px-6 text-right font-medium text-gray-600">
                    {formatCurrency(item.remainingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
