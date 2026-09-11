import React, { useState } from 'react';
import { Calculator, CheckCircle2, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { Modal } from '../../portal/components/ui/Modal';
import { Button } from '../../portal/components/ui/Button';
import { Field, Input } from '../../portal/components/ui/Field';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { useToast } from '../../portal/components/ui/Toast';
import { loansService } from '../services';
import { BranchLoan, LoanAssessment } from '../types';
import { formatCurrency } from '../../utils/loanMath';

export const LoanAssessmentPanel: React.FC<{
  loan: BranchLoan | null;
  onClose: () => void;
  onAction?: (action: string) => void;
}> = ({ loan, onClose, onAction }) => {
  const toast = useToast();
  const [income, setIncome] = useState('18000');
  const [expenses, setExpenses] = useState('9500');
  const [obligations, setObligations] = useState('0');
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<LoanAssessment | null>(null);

  if (!loan) return null;

  const run = async () => {
    setLoading(true);
    try {
      const result = await loansService.assess(loan.id, {
        monthlyIncome: Number(income) || 0,
        monthlyExpenses: Number(expenses) || 0,
        existingObligations: Number(obligations) || 0,
      });
      setAssessment(result);
      toast.success('Assessment completed');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to run assessment.');
    } finally {
      setLoading(false);
    }
  };

  const recommend = async () => {
    try {
      await loansService.action(loan.id, 'recommend');
      toast.success('Application forwarded for assessment review');
      onAction?.('recommend');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to update application.');
    }
  };

  return (
    <Modal
      open={!!loan}
      onClose={onClose}
      title="Loan Assessment"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {assessment && (
            <Button variant="brand" onClick={recommend}>
              <CheckCircle2 className="h-4 w-4" /> Recommend approval
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{loan.borrowerName}</p>
                <p className="text-xs text-slate-500">{loan.loanNumber} · {loan.productName}</p>
              </div>
              <StatusBadge status={loan.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Requested amount</p>
                <p className="font-semibold tabular-nums text-slate-800">{formatCurrency(loan.principalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Term</p>
                <p className="font-semibold text-slate-800">{loan.termMonths} months</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly income" required>
              <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)} />
            </Field>
            <Field label="Monthly expenses" required>
              <Input type="number" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
            </Field>
          </div>
          <Field label="Existing obligations (monthly)" hint="Existing loan and credit card payments.">
            <Input type="number" value={obligations} onChange={(e) => setObligations(e.target.value)} />
          </Field>

          <Button variant="brand" onClick={run} loading={loading} fullWidth>
            <Calculator className="h-4 w-4" /> Run assessment
          </Button>

          {assessment && assessment.riskIndicators.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Risk indicators</p>
                <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                  {assessment.riskIndicators.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="lg:border-l lg:border-slate-100 lg:pl-5">
          {!assessment ? (
            <p className="flex h-full items-center justify-center text-sm text-slate-400">
              Run the assessment to see the capacity analysis.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Disposable income" value={formatCurrency(assessment.disposableIncome)} />
                <StatBox label="Repayment capacity (50%)" value={formatCurrency(assessment.repaymentCapacityMonthly)} />
                <StatBox label="Debt ratio" value={`${Math.round(assessment.debtRatio * 100)}%`} />
                <StatBox label="Estimated installment" value={formatCurrency(assessment.estimatedInstallment)} />
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-800">Recommended loan amount</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">{formatCurrency(assessment.recommendedAmount)}</p>
                <p className="mt-1 text-xs text-emerald-600">
                  {assessment.recommendedAmount < loan.principalAmount
                    ? 'Below the requested amount — consider offering this lower limit.'
                    : 'Within the approved credit capacity.'}
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="text-xs text-slate-500">
                  <p>
                    Assessed by <span className="font-medium text-slate-700">{assessment.assessedBy}</span> on{' '}
                    {new Date(assessment.assessedAt).toLocaleString()}.
                  </p>
                  <p className="mt-1">{assessment.note}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 p-3">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-800">{value}</p>
  </div>
);