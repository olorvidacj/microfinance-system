import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldAlert,
  Calculator,
  User,
  Building2,
  Calendar,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { authFetch } from '../context/AuthContext';
import { calculateLoanSchedule, formatCurrency, formatDate } from '../utils/loanMath';
import { Borrower, Collateral, Guarantor, InterestType, LoanProduct, RepaymentFrequency } from '../types';

interface NewLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedBorrower?: Borrower | null;
  initialParams?: {
    principalAmount?: number;
    termMonths?: number;
    interestRate?: number;
    interestType?: InterestType;
    repaymentFrequency?: RepaymentFrequency;
  } | null;
}

export const NewLoanModal: React.FC<NewLoanModalProps> = ({
  isOpen,
  onClose,
  preSelectedBorrower,
  initialParams,
}) => {
  const { borrowers, loanProducts, branches, createLoanApplication, currentUser } = useLoan();

  const [step, setStep] = useState<number>(1);

  // Form State
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [principalAmount, setPrincipalAmount] = useState<number>(10000);
  const [termMonths, setTermMonths] = useState<number>(12);
  const [interestRate, setInterestRate] = useState<number>(14.0);
  const [interestType, setInterestType] = useState<InterestType>('Reducing Balance');
  const [repaymentFrequency, setRepaymentFrequency] = useState<RepaymentFrequency>('Monthly');
  const [purpose, setPurpose] = useState<string>('Working Capital & Inventory Purchase');
  const [disbursementAccount, setDisbursementAccount] = useState<string>('Bank Transfer: Chase Bank #9821');

  // Collaterals & Guarantors
  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);

  // AI Underwriting State
  const [isUnderwriting, setIsUnderwriting] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<{
    riskScore: number;
    recommendation: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'REJECT';
    maxRecommendedAmount: number;
    suggestedRate: number;
    summary: string;
    strengths: string[];
    riskFactors: string[];
    mitigations: string[];
  } | null>(null);

  // Success State
  const [createdSuccess, setCreatedSuccess] = useState<boolean>(false);

  // Sync initial inputs
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCreatedSuccess(false);
      setAiReport(null);

      if (borrowers.length > 0) {
        setSelectedBorrowerId(preSelectedBorrower ? preSelectedBorrower.id : borrowers[0].id);
      }
      if (loanProducts.length > 0) {
        setSelectedProductId(loanProducts[0].id);
        setInterestRate(loanProducts[0].interestRate);
        setInterestType(loanProducts[0].interestType);
        setPrincipalAmount(initialParams?.principalAmount || 10000);
        setTermMonths(initialParams?.termMonths || loanProducts[0].maxTermMonths);
      }
      if (branches.length > 0) {
        setBranchId(branches[0].id);
      }

      if (initialParams) {
        if (initialParams.principalAmount) setPrincipalAmount(initialParams.principalAmount);
        if (initialParams.termMonths) setTermMonths(initialParams.termMonths);
        if (initialParams.interestRate) setInterestRate(initialParams.interestRate);
        if (initialParams.interestType) setInterestType(initialParams.interestType);
        if (initialParams.repaymentFrequency) setRepaymentFrequency(initialParams.repaymentFrequency);
      }
    }
  }, [isOpen, preSelectedBorrower, initialParams, borrowers, loanProducts, branches]);

  // When product changes, sync rates
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const prod = loanProducts.find((p) => p.id === productId);
    if (prod) {
      setInterestRate(prod.interestRate);
      setInterestType(prod.interestType);
      if (principalAmount > prod.maxAmount) setPrincipalAmount(prod.maxAmount);
      if (principalAmount < prod.minAmount) setPrincipalAmount(prod.minAmount);
      if (termMonths > prod.maxTermMonths) setTermMonths(prod.maxTermMonths);
    }
  };

  const selectedBorrower = borrowers.find((b) => b.id === selectedBorrowerId);
  const selectedProduct = loanProducts.find((p) => p.id === selectedProductId);

  // Live schedule
  const scheduleCalc = calculateLoanSchedule({
    principal: principalAmount,
    annualInterestRate: interestRate,
    termMonths,
    interestType,
    repaymentFrequency,
    processingFeePercentage: selectedProduct?.processingFeePercentage || 2.0,
    startDate: new Date().toISOString().split('T')[0],
  });

  // Run AI Underwriting
  const runAiUnderwriting = async () => {
    if (!selectedBorrower) return;
    setIsUnderwriting(true);
    try {
      const response = await authFetch('/api/gemini/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrower: {
            name: selectedBorrower.fullName,
            income: selectedBorrower.monthlyIncome,
            creditScore: selectedBorrower.creditScore,
            employment: selectedBorrower.employmentStatus,
            occupation: selectedBorrower.occupation,
            repaidTotal: selectedBorrower.totalRepaid,
            borrowedTotal: selectedBorrower.totalBorrowed,
          },
          loanDetails: {
            product: selectedProduct?.name,
            requestedAmount: principalAmount,
            termMonths,
            interestRate,
            interestType,
            repaymentFrequency,
            monthlyRepayment: scheduleCalc.installmentAmount,
            purpose,
          },
          collateralCount: collaterals.length,
          collateralTotalValue: collaterals.reduce((sum, c) => sum + c.estimatedValue, 0),
          guarantorCount: guarantors.length,
        }),
      });

      const data = await response.json();
      if (data?.data) {
        setAiReport(data.data);
      }
    } catch (err) {
      console.error(err);
      // Fallback
      setAiReport({
        riskScore: Math.round(selectedBorrower.creditScore / 10),
        recommendation: selectedBorrower.creditScore > 650 ? 'APPROVE' : 'APPROVE_WITH_CONDITIONS',
        maxRecommendedAmount: selectedBorrower.monthlyIncome * 6,
        suggestedRate: interestRate,
        summary: `Borrower ${selectedBorrower.fullName} demonstrates acceptable debt-to-income ratio with stable employment as ${selectedBorrower.occupation}.`,
        strengths: ['Stable verifiable income stream', 'Good credit profile', 'Clear loan purpose'],
        riskFactors: ['Economic inflation sensitivity'],
        mitigations: ['Mandatory automated direct debit reminder', 'Collateral charge verification'],
      });
    } finally {
      setIsUnderwriting(false);
    }
  };

  const handleAddCollateral = () => {
    const newCol: Collateral = {
      id: `col-${Date.now()}`,
      type: 'Vehicle',
      description: '2020 Toyota Commercial Van',
      estimatedValue: 12500,
      registrationNumber: 'KCU-892X',
      verified: true,
    };
    setCollaterals([...collaterals, newCol]);
  };

  const handleAddGuarantor = () => {
    const newG: Guarantor = {
      id: `g-${Date.now()}`,
      fullName: 'Marcus Sterling',
      relationship: 'Business Partner / Director',
      phone: '+1 (555) 443-9821',
      idNumber: 'ID-9928172',
      monthlyIncome: 6500,
      verified: true,
    };
    setGuarantors([...guarantors, newG]);
  };

  const handleSubmitOrigination = (autoApproveAndDisburse = false) => {
    if (!selectedBorrower || !selectedProduct) return;

    createLoanApplication(
      {
        borrowerId: selectedBorrower.id,
        borrowerName: selectedBorrower.fullName,
        borrowerPhone: selectedBorrower.phone,
        borrowerAvatar: selectedBorrower.avatar,
        branchId: branchId || selectedBorrower.branchId,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        principalAmount,
        interestRate,
        interestType,
        termMonths,
        repaymentFrequency,
        startDate: new Date().toISOString().split('T')[0],
        processingFee: scheduleCalc.processingFee,
        latePenaltyRate: selectedProduct.latePenaltyRate,
        collaterals,
        guarantors,
        disbursementMethod: 'Bank Transfer',
        disbursementAccount,
        purpose,
      },
      autoApproveAndDisburse
    );

    setCreatedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Originate New Loan Facility</h2>
              <p className="text-xs text-gray-500">Step {step} of 4 â€¢ Credit Application Wizard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Tracker */}
        <div className="px-6 py-3 bg-white border-b border-gray-100 grid grid-cols-4 gap-2 text-xs font-semibold">
          {[
            { num: 1, label: '1. Borrower & Product' },
            { num: 2, label: '2. Terms & Math' },
            { num: 3, label: '3. Collateral & Security' },
            { num: 4, label: '4. AI Underwriting' },
          ].map((s) => (
            <div
              key={s.num}
              className={`pb-1 border-b-2 transition text-center truncate ${
                step === s.num
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : step > s.num
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-gray-200 text-gray-400'
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* Step Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5 text-xs">
          {/* STEP 1: Borrower & Product */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="font-semibold text-gray-700 block mb-1.5">Select Registered Borrower</label>
                <select
                  value={selectedBorrowerId}
                  onChange={(e) => setSelectedBorrowerId(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                >
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName} ({b.borrowerNumber}) â€¢ Score: {b.creditScore} â€¢ {b.occupation}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBorrower && (
                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedBorrower.avatar}
                      alt={selectedBorrower.fullName}
                      className="w-10 h-10 rounded-full object-cover border border-blue-200"
                    />
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{selectedBorrower.fullName}</div>
                      <div className="text-[11px] text-gray-500">
                        Income: {formatCurrency(selectedBorrower.monthlyIncome)}/mo â€¢ {selectedBorrower.phone}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Score: {selectedBorrower.creditScore} ({selectedBorrower.creditTier})
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1.5">Originating Branch</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1.5">Loan Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  >
                    {loanProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.interestRate}% p.a.)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1.5">Loan Purpose</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Agricultural inputs, commercial truck overhaul..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Terms & Financial Math */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1.5">Principal Amount ($)</label>
                  <input
                    type="number"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm font-bold"
                  />
                  <div className="text-[10px] text-gray-400 mt-1">
                    Allowed: {formatCurrency(selectedProduct?.minAmount || 500)} â€“{' '}
                    {formatCurrency(selectedProduct?.maxAmount || 50000)}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1.5">Term (Months)</label>
                  <input
                    type="number"
                    value={termMonths}
                    onChange={(e) => setTermMonths(Number(e.target.value))}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm font-bold"
                  />
                  <div className="text-[10px] text-gray-400 mt-1">
                    Max: {selectedProduct?.maxTermMonths || 36} Months
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1.5">Annual Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1.5">Interest Method</label>
                  <select
                    value={interestType}
                    onChange={(e: any) => setInterestType(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  >
                    <option value="Reducing Balance">Reducing Balance</option>
                    <option value="Flat Rate">Flat Rate</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1.5">Frequency</label>
                  <select
                    value={repaymentFrequency}
                    onChange={(e: any) => setRepaymentFrequency(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                  </select>
                </div>
              </div>

              {/* Calculated Summary Box */}
              <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 rounded-xl text-white space-y-2">
                <div className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                  Amortization Summary
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono">
                    {formatCurrency(scheduleCalc.installmentAmount)}
                  </span>
                  <span className="text-xs text-indigo-200">{scheduleCalc.totalInstallments} Installments</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300 font-mono">
                  <div>Principal: {formatCurrency(principalAmount)}</div>
                  <div>Interest: {formatCurrency(scheduleCalc.totalInterest)}</div>
                  <div>Payable: {formatCurrency(scheduleCalc.totalPayable)}</div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1.5">Disbursement Account Details</label>
                <input
                  type="text"
                  value={disbursementAccount}
                  onChange={(e) => setDisbursementAccount(e.target.value)}
                  placeholder="Bank name, account number, or M-Pesa phone number"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Collateral & Guarantors */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Collateral Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900">Pledged Collateral Assets</h3>
                  <button
                    onClick={handleAddCollateral}
                    className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Collateral Asset</span>
                  </button>
                </div>

                {collaterals.length === 0 ? (
                  <div className="p-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-gray-400">
                    No collateral attached. (Product requires collateral if secured).
                  </div>
                ) : (
                  <div className="space-y-2">
                    {collaterals.map((c, i) => (
                      <div key={c.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-gray-900">{c.type}: {c.description}</div>
                          <div className="text-[11px] text-gray-500 font-mono">
                            Reg: {c.registrationNumber} â€¢ Est. Value: {formatCurrency(c.estimatedValue)}
                          </div>
                        </div>
                        <button
                          onClick={() => setCollaterals(collaterals.filter((_, idx) => idx !== i))}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Guarantors Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900">Credit Guarantors</h3>
                  <button
                    onClick={handleAddGuarantor}
                    className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Guarantor</span>
                  </button>
                </div>

                {guarantors.length === 0 ? (
                  <div className="p-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-gray-400">
                    No guarantor attached.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {guarantors.map((g, i) => (
                      <div key={g.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-gray-900">{g.fullName} ({g.relationship})</div>
                          <div className="text-[11px] text-gray-500 font-mono">
                            {g.phone} â€¢ Income: {formatCurrency(g.monthlyIncome)}/mo
                          </div>
                        </div>
                        <button
                          onClick={() => setGuarantors(guarantors.filter((_, idx) => idx !== i))}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: AI Underwriting & Review */}
          {step === 4 && (
            <div className="space-y-4">
              {!aiReport ? (
                <div className="p-8 bg-blue-50/50 rounded-2xl border border-blue-100 text-center space-y-3">
                  <Sparkles className="w-10 h-10 text-blue-600 mx-auto animate-pulse" />
                  <h3 className="font-bold text-gray-900 text-base">Run AI Automated Underwriting</h3>
                  <p className="text-gray-600 max-w-md mx-auto text-xs">
                    Our credit intelligence model analyzes borrower income, historic repayments, collateral coverage,
                    and product risk factors to generate a formal decision memorandum.
                  </p>
                  <button
                    onClick={runAiUnderwriting}
                    disabled={isUnderwriting}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition"
                  >
                    {isUnderwriting ? 'Evaluating Credit Risk...' : 'Generate AI Underwriting Report'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* AI Recommendation Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      aiReport.recommendation === 'APPROVE'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : aiReport.recommendation === 'APPROVE_WITH_CONDITIONS'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-rose-50 text-rose-900 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center font-bold text-lg">
                        {aiReport.riskScore}/100
                      </div>
                      <div>
                        <div className="font-bold text-sm">
                          AI Recommendation: {aiReport.recommendation.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[11px] opacity-80">
                          Max Recommended: {formatCurrency(aiReport.maxRecommendedAmount)} â€¢ Suggested Rate: {aiReport.suggestedRate}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200 italic">
                    "{aiReport.summary}"
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                      <div className="font-bold text-emerald-800 mb-1">Key Strengths</div>
                      <ul className="list-disc list-inside space-y-0.5 text-emerald-700 text-[11px]">
                        {aiReport.strengths.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                      <div className="font-bold text-rose-800 mb-1">Risk Factors</div>
                      <ul className="list-disc list-inside space-y-0.5 text-rose-700 text-[11px]">
                        {aiReport.riskFactors.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
          ) : (
            <div></div>
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubmitOrigination(false)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-800 rounded-xl text-xs font-semibold transition"
              >
                Save as Pending Approval
              </button>
              <button
                onClick={() => handleSubmitOrigination(true)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve & Disburse Now</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
