import React, { useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
  XCircle,
  AlertCircle,
  FileEdit,
  BadgeCheck,
} from 'lucide-react';
import { Modal } from '../../portal/components/ui/Modal';
import { Button } from '../../portal/components/ui/Button';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { loansService } from '../services';
import { BranchLoan, LoanAssessment } from '../types';
import { formatCurrency } from '../../utils/loanMath';

interface LoanAssessmentPanelProps {
  loan: BranchLoan | null;
  onClose: () => void;
  onAction?: (action: string) => void;
  onDisbursePrompt?: (loan: BranchLoan) => void;
}

export const LoanAssessmentPanel: React.FC<LoanAssessmentPanelProps> = ({
  loan,
  onClose,
  onAction,
  onDisbursePrompt,
}) => {
  const toast = useToast();
  const canApprove = useBranchPermission(['approve_sensitive_operations', 'manage_loan_applications']);

  const [income, setIncome] = useState('20000');
  const [expenses, setExpenses] = useState('10000');
  const [obligations, setObligations] = useState('0');
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<LoanAssessment | null>(null);

  // Approval Customization state
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState(loan ? String(loan.principalAmount) : '');
  const [approvedTerm, setApprovedTerm] = useState(loan ? String(loan.termMonths) : '');
  const [approvalNotes, setApprovalNotes] = useState('');

  // Rejection / Correction state
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionNotes, setCorrectionNotes] = useState('');

  if (!loan) return null;

  const runAssessment = async () => {
    setLoading(true);
    try {
      const result = await loansService.assess(loan.id, {
        monthlyIncome: Number(income) || 0,
        monthlyExpenses: Number(expenses) || 0,
        existingObligations: Number(obligations) || 0,
      });
      setAssessment(result);
      if (result.recommendedAmount) {
        setApprovedAmount(String(result.recommendedAmount));
      }
      toast.success('Credit assessment calculated');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to run credit assessment.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecommend = async () => {
    setLoading(true);
    try {
      await loansService.action(loan.id, 'recommend', { notes: 'Recommended for Credit Committee review' });
      toast.success('Application forwarded to Credit Committee');
      onAction?.('recommend');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to recommend application.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await loansService.action(loan.id, 'approve', {
        notes: approvalNotes.trim() || undefined,
        approvedAmount: Number(approvedAmount) || loan.principalAmount,
        approvedTermMonths: Number(approvedTerm) || loan.termMonths,
      });
      toast.success(`Loan ${loan.loanNumber} approved! Ready for fund disbursement.`);
      onAction?.('approve');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to approve loan.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please specify a rejection reason.');
      return;
    }
    setLoading(true);
    try {
      await loansService.action(loan.id, 'reject', { reason: rejectReason.trim() });
      toast.success(`Loan ${loan.loanNumber} rejected.`);
      onAction?.('reject');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to reject loan.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCorrection = async () => {
    if (!correctionNotes.trim()) {
      toast.error('Please specify the required corrections.');
      return;
    }
    setLoading(true);
    try {
      await loansService.action(loan.id, 'request_correction', { notes: correctionNotes.trim() });
      toast.success('Correction request sent to applicant.');
      onAction?.('request_correction');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to request correction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!loan}
      onClose={onClose}
      title="Credit Investigation & Loan Evaluation"
      size="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between w-full gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {!showApprovalForm && !showRejectForm && !showCorrectionForm && (
              <>
                <Button variant="outline" onClick={() => setShowCorrectionForm(true)}>
                  <FileEdit className="h-4 w-4" /> Request Correction
                </Button>
                <Button variant="outline" className="text-rose-600 hover:bg-rose-50" onClick={() => setShowRejectForm(true)}>
                  <XCircle className="h-4 w-4" /> Decline
                </Button>
                <Button variant="outline" onClick={handleRecommend} loading={loading}>
                  Recommend
                </Button>
                {canApprove && (
                  <Button variant="brand" onClick={() => setShowApprovalForm(true)}>
                    <CheckCircle2 className="h-4 w-4" /> Approve Loan
                  </Button>
                )}
              </>
            )}

            {showApprovalForm && (
              <>
                <Button variant="outline" onClick={() => setShowApprovalForm(false)}>
                  Cancel
                </Button>
                <Button variant="brand" onClick={handleApprove} loading={loading}>
                  <CheckCircle2 className="h-4 w-4" /> Confirm Approval
                </Button>
              </>
            )}

            {showRejectForm && (
              <>
                <Button variant="outline" onClick={() => setShowRejectForm(false)}>
                  Cancel
                </Button>
                <Button variant="brand" className="bg-rose-600 hover:bg-rose-700" onClick={handleReject} loading={loading}>
                  <XCircle className="h-4 w-4" /> Confirm Rejection
                </Button>
              </>
            )}

            {showCorrectionForm && (
              <>
                <Button variant="outline" onClick={() => setShowCorrectionForm(false)}>
                  Cancel
                </Button>
                <Button variant="brand" onClick={handleRequestCorrection} loading={loading}>
                  <FileEdit className="h-4 w-4" /> Send Correction Request
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Applicant & Application Snapshot */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Application</p>
              <h3 className="text-base font-bold text-slate-900">{loan.borrowerName}</h3>
              <p className="text-xs text-slate-500">
                {loan.loanNumber} · {loan.productName} · Applied on {loan.applicationDate}
              </p>
            </div>
            <StatusBadge status={loan.status} />
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-slate-200/80 pt-3">
            <div>
              <p className="text-slate-400 font-medium">Requested Principal</p>
              <p className="font-bold text-slate-800">{formatCurrency(loan.principalAmount)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Interest & Term</p>
              <p className="font-bold text-slate-800">
                {loan.interestRate}% · {loan.termMonths} mo
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Frequency</p>
              <p className="font-bold text-slate-800">{loan.repaymentFrequency || 'Monthly'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Total Payable</p>
              <p className="font-bold text-emerald-700">{formatCurrency(loan.totalPayable)}</p>
            </div>
          </div>

          {loan.purpose && (
            <div className="mt-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Declared Purpose: </span>
              {loan.purpose}
            </div>
          )}
        </div>

        {/* Approval Form Panel */}
        {showApprovalForm && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 space-y-3">
            <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald-700" /> Authorized Loan Approval Terms
            </h4>
            <p className="text-xs text-emerald-800">
              You can approve the original requested terms or adjust the approved amount/term based on Credit Committee guidelines.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Approved Principal Amount (₱)" required>
                <Input
                  type="number"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                />
              </Field>
              <Field label="Approved Term (Months)" required>
                <Input
                  type="number"
                  value={approvedTerm}
                  onChange={(e) => setApprovedTerm(e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Credit Committee Resolution / Approval Notes">
                  <Textarea
                    rows={2}
                    placeholder="Approval comments, terms conditions, or committee resolutions..."
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Form Panel */}
        {showRejectForm && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-3">
            <h4 className="text-sm font-bold text-rose-950 flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-rose-700" /> Decline Loan Application
            </h4>
            <Field label="Specific Rejection Reason" required hint="This explanation will be shared with the member">
              <Textarea
                rows={3}
                placeholder="e.g. Credit capacity insufficient, existing obligations exceed allowable debt ratio..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </Field>
          </div>
        )}

        {/* Correction Form Panel */}
        {showCorrectionForm && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
            <h4 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
              <FileEdit className="h-4 w-4 text-amber-700" /> Request Applicant Correction
            </h4>
            <Field label="Required Correction Instructions" required>
              <Textarea
                rows={3}
                placeholder="Specify what details or supporting documents need correction..."
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
              />
            </Field>
          </div>
        )}

        {/* Credit Assessment Calculator Grid */}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Credit Capacity Input</h4>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Monthly Income (₱)" required>
                <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)} />
              </Field>
              <Field label="Monthly Living Expenses (₱)" required>
                <Input type="number" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
              </Field>
            </div>

            <Field label="Existing Monthly Debt Obligations (₱)" hint="Other cooperative loans, credit cards, or bank debt">
              <Input type="number" value={obligations} onChange={(e) => setObligations(e.target.value)} />
            </Field>

            <Button variant="brand" onClick={runAssessment} loading={loading} fullWidth>
              <Calculator className="h-4 w-4" /> Calculate Credit Capacity
            </Button>

            {assessment && assessment.riskIndicators.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold text-amber-900">Risk Assessment Indicators</p>
                  <ul className="mt-1 list-inside list-disc text-slate-700 space-y-0.5">
                    {assessment.riskIndicators.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="lg:border-l lg:border-slate-100 lg:pl-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Capacity Analysis</h4>
            {!assessment ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center p-4">
                <Calculator className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">
                  Run the credit calculation to evaluate disposable income, debt-service ratio, and recommended loan ceiling.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Disposable Income" value={formatCurrency(assessment.disposableIncome)} />
                  <StatBox label="Repayment Cap (50%)" value={formatCurrency(assessment.repaymentCapacityMonthly)} />
                  <StatBox label="Debt Ratio" value={`${Math.round(assessment.debtRatio * 100)}%`} />
                  <StatBox label="Estimated Installment" value={formatCurrency(assessment.estimatedInstallment)} />
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Recommended Loan Ceiling</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-900">
                    {formatCurrency(assessment.recommendedAmount)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {assessment.recommendedAmount < loan.principalAmount
                      ? '⚠️ Below requested amount — consider offering this adjusted limit.'
                      : '✅ Requested amount is within estimated credit capacity.'}
                  </p>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  <ArrowLeftRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <p>
                    Evaluated by <strong className="text-slate-700">{assessment.assessedBy}</strong> on{' '}
                    {new Date(assessment.assessedAt).toLocaleDateString()}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 p-3">
    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-800">{value}</p>
  </div>
);