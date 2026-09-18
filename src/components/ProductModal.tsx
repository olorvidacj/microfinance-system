import React, { useState } from 'react';
import { X, Package, Save } from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { InterestType, LoanProduct, RepaymentFrequency } from '../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editProduct?: LoanProduct | null;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  editProduct,
}) => {
  const { addLoanProduct, updateLoanProduct } = useLoan();

  const [name, setName] = useState(editProduct?.name || '');
  const [code, setCode] = useState(editProduct?.code || '');
  const [category, setCategory] = useState(editProduct?.category || 'SME Business');
  const [description, setDescription] = useState(
    editProduct?.description || 'Tailored financing for small and medium businesses.'
  );
  const [interestRate, setInterestRate] = useState(editProduct?.interestRate || 14.0);
  const [interestType, setInterestType] = useState<InterestType>(
    editProduct?.interestType || 'Reducing Balance'
  );
  const [minAmount, setMinAmount] = useState(editProduct?.minAmount || 1000);
  const [maxAmount, setMaxAmount] = useState(editProduct?.maxAmount || 50000);
  const [minTermMonths, setMinTermMonths] = useState(editProduct?.minTermMonths || 3);
  const [maxTermMonths, setMaxTermMonths] = useState(editProduct?.maxTermMonths || 24);
  const [repaymentFrequency, setRepaymentFrequency] = useState<RepaymentFrequency>(
    editProduct?.repaymentFrequency || 'Monthly'
  );
  const [processingFeePercentage, setProcessingFeePercentage] = useState(
    editProduct?.processingFeePercentage || 2.0
  );
  const [latePenaltyRate, setLatePenaltyRate] = useState(
    editProduct?.latePenaltyRate || 5.0
  );
  const [requiresCollateral, setRequiresCollateral] = useState<boolean>(
    Boolean(editProduct?.requiresCollateral ?? false)
  );
  const [requiresGuarantor, setRequiresGuarantor] = useState<boolean>(
    Boolean(editProduct?.requiresGuarantor ?? true)
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    if (editProduct) {
      updateLoanProduct(editProduct.id, {
        name,
        code,
        category,
        description,
        interestRate: Number(interestRate),
        interestType,
        minAmount: Number(minAmount),
        maxAmount: Number(maxAmount),
        minTermMonths: Number(minTermMonths),
        maxTermMonths: Number(maxTermMonths),
        defaultRepaymentFrequency: repaymentFrequency,
        repaymentFrequency,
        processingFeePercentage: Number(processingFeePercentage),
        latePenaltyRate: Number(latePenaltyRate),
        requiresCollateral,
        requiresGuarantor,
      });
    } else {
      addLoanProduct({
        name,
        code,
        category,
        description,
        interestRate: Number(interestRate),
        interestType,
        minAmount: Number(minAmount),
        maxAmount: Number(maxAmount),
        minTermMonths: Number(minTermMonths),
        maxTermMonths: Number(maxTermMonths),
        defaultRepaymentFrequency: repaymentFrequency,
        repaymentFrequency,
        processingFeePercentage: Number(processingFeePercentage),
        latePenaltyRate: Number(latePenaltyRate),
        requiresCollateral,
        requiresGuarantor,
        badgeColor: 'blue',
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full my-8 shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {editProduct ? 'Edit Loan Product' : 'Create New Loan Product'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SME Growth Loan"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Product Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SME-01"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Annual Interest Rate (%)</label>
              <input
                type="number"
                step="0.5"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Calculation Method</label>
              <select
                value={interestType}
                onChange={(e: any) => setInterestType(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="Reducing Balance">Reducing Balance</option>
                <option value="Flat Rate">Flat Rate</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Min / Max Loan Limit ($)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(Number(e.target.value))}
                  placeholder="Min"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl font-mono"
                />
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(Number(e.target.value))}
                  placeholder="Max"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Min / Max Tenor (Months)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={minTermMonths}
                  onChange={(e) => setMinTermMonths(Number(e.target.value))}
                  placeholder="Min"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl font-mono"
                />
                <input
                  type="number"
                  value={maxTermMonths}
                  onChange={(e) => setMaxTermMonths(Number(e.target.value))}
                  placeholder="Max"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Processing Admin Fee (%)</label>
              <input
                type="number"
                step="0.1"
                value={processingFeePercentage}
                onChange={(e) => setProcessingFeePercentage(Number(e.target.value))}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Late Penalty Surcharge (%)</label>
              <input
                type="number"
                step="0.5"
                value={latePenaltyRate}
                onChange={(e) => setLatePenaltyRate(Number(e.target.value))}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresCollateral}
                onChange={(e) => setRequiresCollateral(e.target.checked)}
                className="w-4 h-4 rounded text-gold-600"
              />
              <span className="font-semibold text-gray-800">Requires Collateral Asset</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresGuarantor}
                onChange={(e) => setRequiresGuarantor(e.target.checked)}
                className="w-4 h-4 rounded text-gold-600"
              />
              <span className="font-semibold text-gray-800">Requires Credit Guarantor</span>
            </label>
          </div>

          <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2 px-5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{editProduct ? 'Update Product' : 'Create Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
