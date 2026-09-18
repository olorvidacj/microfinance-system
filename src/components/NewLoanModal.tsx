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
  DollarSign,
  Percent,
  Clock,
  Search,
  Receipt,
  FileSpreadsheet,
  Check,
  HelpCircle,
  Save,
  Send,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { calculateLoanSchedule, formatCurrency, formatDate } from '../utils/loanMath';
import { Borrower, Collateral, Guarantor, InterestType, LoanProduct, RepaymentFrequency, LoanStatus } from '../types';

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
  const [searchBorrower, setSearchBorrower] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [principalAmount, setPrincipalAmount] = useState<number>(50000);
  const [termMonths, setTermMonths] = useState<number>(12);
  const [interestRate, setInterestRate] = useState<number>(12.0);
  const [interestType, setInterestType] = useState<InterestType>('Reducing Balance');
  const [repaymentFrequency, setRepaymentFrequency] = useState<RepaymentFrequency>('Semi-monthly');
  const [purpose, setPurpose] = useState<string>('Inventory & Working Capital Expansion');
  const [disbursementMethod, setDisbursementMethod] = useState<string>('Bank Transfer');
  const [disbursementAccount, setDisbursementAccount] = useState<string>('');

  // Collaterals & Guarantors
  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);

  // Schedule Preview Tab in Step 2/3
  const [showFullSchedule, setShowFullSchedule] = useState<boolean>(false);

  // Success State
  const [createdSuccess, setCreatedSuccess] = useState<boolean>(false);
  const [createdLoanNumber, setCreatedLoanNumber] = useState<string>('');

  // Sync initial inputs
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCreatedSuccess(false);
      setShowFullSchedule(false);

      if (borrowers.length > 0) {
        setSelectedBorrowerId(preSelectedBorrower ? preSelectedBorrower.id : borrowers[0].id);
      }
      if (loanProducts.length > 0) {
        const defaultProd = loanProducts[0];
        setSelectedProductId(defaultProd.id);
        setInterestRate(defaultProd.interestRate);
        setInterestType(defaultProd.interestType);
        setRepaymentFrequency(defaultProd.defaultRepaymentFrequency);
        setPrincipalAmount(initialParams?.principalAmount || defaultProd.minAmount || 50000);
        setTermMonths(initialParams?.termMonths || 12);
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

  // When product changes, sync product default rates & frequencies
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const prod = loanProducts.find((p) => p.id === productId);
    if (prod) {
      setInterestRate(prod.interestRate);
      setInterestType(prod.interestType);
      setRepaymentFrequency(prod.defaultRepaymentFrequency);
      if (principalAmount > prod.maxAmount) setPrincipalAmount(prod.maxAmount);
      if (principalAmount < prod.minAmount) setPrincipalAmount(prod.minAmount);
      if (termMonths > prod.maxTermMonths) setTermMonths(prod.maxTermMonths);
      if (termMonths < prod.minTermMonths) setTermMonths(prod.minTermMonths);
    }
  };

  const selectedBorrower = borrowers.find((b) => b.id === selectedBorrowerId);
  const selectedProduct = loanProducts.find((p) => p.id === selectedProductId) || loanProducts[0];

  // Filtered borrowers for client picker
  const filteredBorrowers = borrowers.filter((b) => {
    const q = searchBorrower.toLowerCase();
    return (
      b.fullName.toLowerCase().includes(q) ||
      b.borrowerNumber.toLowerCase().includes(q) ||
      (b.clientId && b.clientId.toLowerCase().includes(q)) ||
      b.phone.toLowerCase().includes(q)
    );
  });

  // Real-time amortization schedule computation
  const scheduleCalc = calculateLoanSchedule({
    principal: principalAmount,
    annualInterestRate: interestRate,
    termMonths,
    interestType,
    repaymentFrequency,
    processingFeePercentage: selectedProduct?.processingFeePercentage || 2.0,
    startDate: new Date().toISOString().split('T')[0],
  });

  const estimatedDeductions = scheduleCalc.processingFee + 300 + Math.round(principalAmount * 0.02) + 500;
  const estimatedNetProceeds = Math.max(0, principalAmount - estimatedDeductions);

  const handleAddCollateral = () => {
    const newCol: Collateral = {
      id: `col-${Date.now()}`,
      type: 'Vehicle',
      description: 'Vehicle / Equipment / Inventory Chattel',
      estimatedValue: Math.round(principalAmount * 1.2),
      registrationNumber: `REG-${Math.floor(1000 + Math.random() * 9000)}`,
      verified: true,
    };
    setCollaterals([...collaterals, newCol]);
  };

  const handleAddGuarantor = () => {
    const newG: Guarantor = {
      id: `g-${Date.now()}`,
      fullName: 'Co-maker / Salaried Guarantor',
      relationship: 'Spouse / Relative / Business Co-owner',
      phone: '+63 917 000 0000',
      idNumber: 'SSS / PRC / UMID ID',
      monthlyIncome: 35000,
      verified: true,
    };
    setGuarantors([...guarantors, newG]);
  };

  const handleCreateApplication = (statusToSet: LoanStatus = 'Submitted') => {
    if (!selectedBorrower || !selectedProduct) return;

    const newLoan = createLoanApplication(
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
        disbursementMethod,
        disbursementAccount: disbursementAccount || `${selectedBorrower.fullName} - ${disbursementMethod}`,
        purpose,
      },
      statusToSet
    );

    setCreatedLoanNumber(newLoan.loanNumber);
    setCreatedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1600);
  };

  if (!isOpen) return null;

  return (
    <div id="new-loan-modal" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full my-8 shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-900/30 border border-gold-400/40 text-gold-400 flex items-center justify-center font-bold">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create Loan Application</h2>
              <p className="text-xs text-slate-400">Step {step} of 3 • Origination, Financing Terms & Amortization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-lg p-1.5 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 py-2.5 bg-slate-800/60 border-b border-slate-700/60 grid grid-cols-3 gap-2 text-xs font-semibold">
          {[
            { num: 1, label: '1. Select Client & Product' },
            { num: 2, label: '2. Loan Amount & Terms' },
            { num: 3, label: '3. Amortization & Review' },
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => step > s.num && setStep(s.num)}
              className={`pb-1 border-b-2 transition text-center truncate cursor-pointer ${
                step === s.num
                  ? 'border-gold-500 text-gold-400 font-bold'
                  : step > s.num
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-slate-700 text-slate-500'
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* Success Screen */}
        {createdSuccess ? (
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Loan Application Created!</h3>
            <p className="text-xs text-gray-600 max-w-md mx-auto">
              Generated unique Loan ID: <strong className="font-mono text-gold-700">{createdLoanNumber}</strong>. The application has been saved to the loan register.
            </p>
          </div>
        ) : (
          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-xs">
            {/* STEP 1: SELECT CLIENT & PRODUCT */}
            {step === 1 && (
              <div className="space-y-5">
                {/* Client Selection Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-900 font-bold text-xs flex items-center gap-1.5">
                      <User className="w-4 h-4 text-gold-600" />
                      Select Registered Client / Borrower *
                    </label>
                    <span className="text-gray-500 text-[11px]">
                      {borrowers.length} registered members available
                    </span>
                  </div>

                  {/* Search input */}
                  <div className="relative mb-2.5">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search member by full name, Client ID (CLI-XXXX), or phone..."
                      value={searchBorrower}
                      onChange={(e) => setSearchBorrower(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                    />
                  </div>

                  {/* Client Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {filteredBorrowers.map((b) => {
                      const isSelected = b.id === selectedBorrowerId;
                      const isKycVerified = b.kycStatus === 'VERIFIED' || (b.kycDocuments && b.kycDocuments.some((d) => d.status === 'VERIFIED'));

                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedBorrowerId(b.id)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'border-gold-500 bg-gold-500/10 shadow-xs'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={b.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                              alt={b.fullName}
                              className="w-10 h-10 rounded-xl object-cover border border-gray-200"
                            />
                            <div>
                              <p className="font-bold text-gray-900 flex items-center gap-1.5">
                                {b.fullName}
                                {isSelected && <Check className="w-3.5 h-3.5 text-gold-600" />}
                              </p>
                              <p className="text-[11px] text-gray-500 font-mono">{b.borrowerNumber || b.clientId}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  isKycVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {isKycVerified ? 'KYC Verified' : 'KYC Pending'}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  {b.activeLoansCount || 0} active loans
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 block">Monthly Income</span>
                            <span className="font-bold text-gray-800 font-mono text-[11px]">
                              {formatCurrency(b.monthlyIncome)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedBorrower && (
                    <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-gray-500">Selected Client:</span>
                        <strong className="text-gray-900 ml-1.5">{selectedBorrower.fullName}</strong> ({selectedBorrower.occupation || 'Member'})
                      </div>
                      <div className="text-gray-600">
                        Net Disposable Income: <strong className="text-emerald-700 font-mono">{formatCurrency(selectedBorrower.monthlyIncome - selectedBorrower.monthlyExpenses)}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Loan Product Selection Section */}
                <div>
                  <label className="text-gray-900 font-bold text-xs block mb-2">
                    Select Loan Product / Type *
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {loanProducts.map((p) => {
                      const isSelected = p.id === selectedProductId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleProductChange(p.id)}
                          className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-2 ${
                            isSelected
                              ? 'border-gold-500 bg-gold-500/10 shadow-sm'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                              {p.name}
                              {isSelected && <Check className="w-3.5 h-3.5 text-gold-600" />}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-500/20 text-gold-800">
                              {p.interestRate}% p.a.
                            </span>
                          </div>

                          <p className="text-[11px] text-gray-600 line-clamp-2">{p.description}</p>

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 border-t border-gray-200/60 pt-2">
                            <div>Amount: {formatCurrency(p.minAmount)} - {formatCurrency(p.maxAmount)}</div>
                            <div>Term: {p.minTermMonths} - {p.maxTermMonths} Mos</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Branch Selection */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Originating Branch</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STEP 2: FINANCING TERMS & REPAYMENT FREQUENCY */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="p-3.5 bg-gold-500/10 border border-gold-400/30 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Product Selected:</span>
                    <strong className="text-navy-950 font-bold text-xs">{selectedProduct.name}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 block text-[11px]">Allowed Limits:</span>
                    <span className="font-semibold text-navy-900 text-xs">
                      {formatCurrency(selectedProduct.minAmount)} — {formatCurrency(selectedProduct.maxAmount)}
                    </span>
                  </div>
                </div>

                {/* Loan Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-900 font-bold">Loan Amount (₱) *</label>
                    <span className="text-gold-700 font-mono font-bold text-sm">
                      {formatCurrency(principalAmount)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={selectedProduct.minAmount}
                    max={selectedProduct.maxAmount}
                    step={1000}
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                    className="w-full accent-gold-600"
                  />
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      min={selectedProduct.minAmount}
                      max={selectedProduct.maxAmount}
                      step={1000}
                      value={principalAmount}
                      onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold font-mono text-gray-900 text-xs"
                    />
                    {[20000, 50000, 100000, 200000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPrincipalAmount(preset)}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-semibold transition"
                      >
                        ₱{(preset / 1000)}k
                      </button>
                    ))}
                  </div>
                </div>

                {/* Term & Interest Rate Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Loan Term (Months) *</label>
                    <input
                      type="number"
                      min={selectedProduct.minTermMonths}
                      max={selectedProduct.maxTermMonths}
                      value={termMonths}
                      onChange={(e) => setTermMonths(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold text-gray-900 text-xs"
                    />
                    <span className="text-[10px] text-gray-500 mt-0.5 block">
                      Range: {selectedProduct.minTermMonths} - {selectedProduct.maxTermMonths} months
                    </span>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Interest Rate (% p.a.) *</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      step={0.5}
                      value={interestRate}
                      onChange={(e) => setInterestRate(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold text-gray-900 text-xs"
                    />
                    <span className="text-[10px] text-gray-500 mt-0.5 block">Standard: {selectedProduct.interestRate}%</span>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Interest Calculation Type</label>
                    <select
                      value={interestType}
                      onChange={(e) => setInterestType(e.target.value as InterestType)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold"
                    >
                      <option value="Reducing Balance">Reducing Balance (Diminishing)</option>
                      <option value="Flat Rate">Flat Rate</option>
                    </select>
                  </div>
                </div>

                {/* Repayment Frequency & Disbursement Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Payment Frequency *</label>
                    <select
                      value={repaymentFrequency}
                      onChange={(e) => setRepaymentFrequency(e.target.value as RepaymentFrequency)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900"
                    >
                      <option value="Daily">Daily (Micro-credit)</option>
                      <option value="Weekly">Weekly (Emergency / Agri)</option>
                      <option value="Semi-monthly">Semi-monthly / Bi-weekly (15th / 30th)</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly (Agricultural Harvest)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Intended Disbursement Method</label>
                    <select
                      value={disbursementMethod}
                      onChange={(e) => setDisbursementMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold"
                    >
                      <option value="Bank Transfer">Bank Transfer (InstaPay / PESONet)</option>
                      <option value="Check">Check Voucher</option>
                      <option value="Cash">Cash Vault Release</option>
                      <option value="GCash">GCash E-Wallet</option>
                    </select>
                  </div>
                </div>

                {/* Purpose of Loan */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Loan Purpose & Business Utilization *</label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Grocery stock inventory bulk purchase, agricultural farm inputs, solar equipment..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  />
                </div>

                {/* Live Installment Preview Banner */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Installment Due</span>
                    <span className="text-base font-extrabold text-emerald-800 font-mono mt-0.5 block">
                      {formatCurrency(scheduleCalc.installmentAmount)}
                    </span>
                    <span className="text-[10px] text-emerald-700">per {repaymentFrequency.toLowerCase()}</span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[11px]">Total Interest</span>
                    <span className="text-sm font-bold text-gray-800 font-mono mt-0.5 block">
                      {formatCurrency(scheduleCalc.totalInterest)}
                    </span>
                    <span className="text-[10px] text-gray-500">{scheduleCalc.totalInstallments} installments</span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[11px]">Total Repayable</span>
                    <span className="text-sm font-bold text-gold-800 font-mono mt-0.5 block">
                      {formatCurrency(scheduleCalc.totalPayable)}
                    </span>
                    <span className="text-[10px] text-gray-500">Principal + Interest</span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[11px]">Estimated Net Payout</span>
                    <span className="text-sm font-bold text-emerald-900 font-mono mt-0.5 block">
                      {formatCurrency(estimatedNetProceeds)}
                    </span>
                    <span className="text-[10px] text-gray-500">less fees & CBU</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: AMORTIZATION SCHEDULE & SECURITY */}
            {step === 3 && (
              <div className="space-y-5">
                {/* Summary Strip */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Borrower</span>
                    <span className="font-bold text-white text-xs mt-0.5 block">{selectedBorrower?.fullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Principal</span>
                    <span className="font-bold text-gold-400 text-xs mt-0.5 block">{formatCurrency(principalAmount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Installment Amount</span>
                    <span className="font-bold text-emerald-400 text-xs mt-0.5 block">
                      {formatCurrency(scheduleCalc.installmentAmount)} / {repaymentFrequency}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Total Payable</span>
                    <span className="font-bold text-purple-300 text-xs mt-0.5 block">{formatCurrency(scheduleCalc.totalPayable)}</span>
                  </div>
                </div>

                {/* Generated Amortization Schedule Table Preview */}
                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-gold-600" />
                      <h4 className="font-bold text-gray-800 text-xs">Amortization Schedule Breakdown ({scheduleCalc.schedule.length} Periods)</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFullSchedule(!showFullSchedule)}
                      className="text-gold-600 hover:text-gold-800 text-xs font-semibold"
                    >
                      {showFullSchedule ? 'Show First 5 Periods' : 'View All Periods'}
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Period</th>
                          <th className="py-2 px-3">Due Date</th>
                          <th className="py-2 px-3">Principal</th>
                          <th className="py-2 px-3">Interest</th>
                          <th className="py-2 px-3">Total Due</th>
                          <th className="py-2 px-3">Balance After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {(showFullSchedule ? scheduleCalc.schedule : scheduleCalc.schedule.slice(0, 5)).map((item) => (
                          <tr key={item.installmentNumber} className="hover:bg-gray-50/80">
                            <td className="py-1.5 px-3 font-bold text-gray-900">#{item.installmentNumber}</td>
                            <td className="py-1.5 px-3 font-medium">{formatDate(item.dueDate)}</td>
                            <td className="py-1.5 px-3 font-mono">{formatCurrency(item.principal)}</td>
                            <td className="py-1.5 px-3 font-mono text-gray-500">{formatCurrency(item.interest)}</td>
                            <td className="py-1.5 px-3 font-mono font-bold text-gray-900">{formatCurrency(item.totalDue)}</td>
                            <td className="py-1.5 px-3 font-mono text-gray-600">{formatCurrency(item.remainingBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Optional Security / Guarantors Accordion */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-800 text-xs">Co-Makers / Guarantors ({guarantors.length})</h4>
                      <button
                        type="button"
                        onClick={handleAddGuarantor}
                        className="text-gold-600 hover:text-gold-800 font-bold text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                    {guarantors.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic">No secondary guarantor attached yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {guarantors.map((g, idx) => (
                          <div key={g.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-200 text-[11px]">
                            <span>{g.fullName} ({g.relationship})</span>
                            <span className="font-mono text-emerald-700 font-bold">{formatCurrency(g.monthlyIncome)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-800 text-xs">Pledged Collateral ({collaterals.length})</h4>
                      <button
                        type="button"
                        onClick={handleAddCollateral}
                        className="text-gold-600 hover:text-gold-800 font-bold text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                    {collaterals.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic">Uncollateralized / chattel clean facility.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {collaterals.map((c, idx) => (
                          <div key={c.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-200 text-[11px]">
                            <span>{c.type}: {c.description}</span>
                            <span className="font-mono text-gold-700 font-bold">{formatCurrency(c.estimatedValue)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Navigation Buttons */}
        {!createdSuccess && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition flex items-center gap-1.5 text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous Step
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition text-xs"
              >
                Cancel
              </button>
            )}

            <div className="flex items-center gap-2">
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="px-5 py-2.5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-bold transition flex items-center gap-2 text-xs shadow-md shadow-gold-500/20"
                >
                  Proceed to Step {step + 1}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleCreateApplication('Draft')}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold transition flex items-center gap-1.5 text-xs border border-slate-300"
                  >
                    <Save className="w-4 h-4" />
                    Save as Draft
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateApplication('Submitted')}
                    className="px-5 py-2.5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 text-xs shadow-md shadow-gold-500/20"
                  >
                    <Send className="w-4 h-4" />
                    Submit for Approval
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
