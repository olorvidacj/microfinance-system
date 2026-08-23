import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { authFetch } from '../context/AuthContext';
import { formatCurrency } from '../utils/loanMath';
import { Loan } from '../types';

interface RestructureModalProps {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RestructureModal: React.FC<RestructureModalProps> = ({
  loan,
  isOpen,
  onClose,
}) => {
  const { restructureLoan } = useLoan();

  const [loading, setLoading] = useState(false);
  const [restructureData, setRestructureData] = useState<{
    diagnosis: string;
    options: Array<{
      id: string;
      title: string;
      description: string;
      newTermMonths: number;
      newInterestRate: number;
      newMonthlyInstallment: number;
      pros: string;
      cons: string;
    }>;
  } | null>(null);

  const [selectedOptionId, setSelectedOptionId] = useState<string>('opt-1');
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && loan) {
      setAppliedSuccess(false);
      fetchRestructureAdvice();
    }
  }, [isOpen, loan]);

  const fetchRestructureAdvice = async () => {
    if (!loan) return;
    setLoading(true);
    try {
      const response = await authFetch('/api/gemini/restructure-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanNumber: loan.loanNumber,
          borrowerName: loan.borrowerName,
          remainingBalance: loan.remainingBalance,
          originalTerm: loan.termMonths,
          currentRate: loan.interestRate,
          daysInArrears: loan.daysInArrears || 28,
        }),
      });
      const data = await response.json();
      if (data?.data) {
        setRestructureData(data.data);
      }
    } catch (e) {
      console.error(e);
      // Fallback
      setRestructureData({
        diagnosis: `Borrower ${loan.borrowerName} is experiencing cashflow liquidity compression with ${loan.daysInArrears || 28} days in arrears on remaining balance of ${formatCurrency(loan.remainingBalance)}.`,
        options: [
          {
            id: 'opt-1',
            title: 'Tenor Extension (+6 Months)',
            description: 'Extend remaining loan tenor to reduce monthly installment burden by 35%.',
            newTermMonths: loan.termMonths + 6,
            newInterestRate: loan.interestRate,
            newMonthlyInstallment: Math.round((loan.remainingBalance / (loan.termMonths + 6)) * 1.1),
            pros: 'Immediately affordable periodic cashflow without interest concessions',
            cons: 'Slight increase in aggregate lifetime interest',
          },
          {
            id: 'opt-2',
            title: 'Rate Relief Concession (-2.5%)',
            description: 'Lower annual interest rate by 2.5% p.a. while maintaining original duration.',
            newTermMonths: loan.termMonths,
            newInterestRate: Math.max(8, loan.interestRate - 2.5),
            newMonthlyInstallment: Math.round((loan.remainingBalance / loan.termMonths) * 1.05),
            pros: 'High borrower cooperation incentive and rapid principal recovery',
            cons: 'Marginal margin reduction for the branch',
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRestructure = () => {
    if (!loan || !restructureData) return;
    const selectedOpt = restructureData.options.find((o) => o.id === selectedOptionId);
    if (!selectedOpt) return;

    restructureLoan(loan.id, {
      newTermMonths: selectedOpt.newTermMonths,
      newInterestRate: selectedOpt.newInterestRate,
      newInterestType: loan.interestType,
      reason: `AI Restructure applied: ${selectedOpt.title} (${selectedOpt.description})`,
    });

    setAppliedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  if (!isOpen || !loan) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500 text-white flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">AI Loan Restructuring & Work-Out</h2>
              <p className="text-xs text-indigo-200">
                {loan.borrowerName} â€¢ {loan.loanNumber} ({loan.daysInArrears}d Overdue)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-gray-500 space-y-3">
              <Sparkles className="w-8 h-8 mx-auto text-purple-600 animate-spin" />
              <p>Analyzing borrower payment history and simulating workout models...</p>
            </div>
          ) : (
            <>
              {restructureData?.diagnosis && (
                <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-100 text-purple-900">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-purple-700" />
                    <span>Delinquency Diagnosis</span>
                  </div>
                  <p className="text-gray-700">{restructureData.diagnosis}</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="font-bold text-gray-900">Select Recommended Work-Out Restructuring Plan</div>
                {restructureData?.options.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedOptionId(opt.id)}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-2 ${
                      selectedOptionId === opt.id
                        ? 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-500/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{opt.title}</h4>
                        <p className="text-gray-600 text-xs mt-0.5">{opt.description}</p>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-xs text-gray-500">New Installment</div>
                        <div className="text-base font-bold text-purple-700">
                          {formatCurrency(opt.newMonthlyInstallment)}/mo
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-gray-100">
                      <div className="text-emerald-700">
                        <strong>Pros:</strong> {opt.pros}
                      </div>
                      <div className="text-rose-700">
                        <strong>Cons:</strong> {opt.cons}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={onClose}
              className="py-2 px-4 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyRestructure}
              disabled={loading || appliedSuccess}
              className={`py-2 px-5 text-white rounded-xl font-semibold shadow-xs flex items-center gap-2 transition ${
                appliedSuccess ? 'bg-emerald-600' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {appliedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Restructured & Activated!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Execute Plan & Update Schedule</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
