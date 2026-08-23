import React, { useState } from 'react';
import {
  Package,
  PlusCircle,
  Percent,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Edit2,
  Tag,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency } from '../utils/loanMath';
import { LoanProduct } from '../types';

interface ProductsViewProps {
  onOpenAddProduct: () => void;
  onEditProduct: (product: LoanProduct) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  onOpenAddProduct,
  onEditProduct,
}) => {
  const { loanProducts, loans } = useLoan();

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Loan Products & Credit Policies
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Configure lending categories, interest formulas, underwriting thresholds, and fee structures.
          </p>
        </div>
        <button
          onClick={onOpenAddProduct}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-xs"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Loan Product</span>
        </button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loanProducts.map((product) => {
          const associatedLoans = loans.filter((l) => l.productId === product.id);
          const totalVolume = associatedLoans.reduce((acc, l) => acc + l.principalAmount, 0);

          return (
            <div
              key={product.id}
              className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs hover:border-gray-300 transition flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">
                      {product.category}
                    </span>
                    <h3 className="font-bold text-gray-900 text-base mt-2">{product.name}</h3>
                    <span className="text-xs font-mono text-gray-400 font-semibold">{product.code}</span>
                  </div>

                  <button
                    onClick={() => onEditProduct(product)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    title="Edit Product Settings"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-gray-500 mt-3 line-clamp-2 leading-relaxed">
                  {product.description}
                </p>

                {/* Key specs */}
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Interest Rate:</span>
                    <span className="font-bold text-gray-900 font-mono">
                      {product.interestRate}% p.a. ({product.interestType})
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Loan Limit:</span>
                    <span className="font-bold text-gray-900 font-mono">
                      {formatCurrency(product.minAmount)} – {formatCurrency(product.maxAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Tenor Range:</span>
                    <span className="font-medium text-gray-800">
                      {product.minTermMonths} to {product.maxTermMonths} Months
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Processing / Late Fee:</span>
                    <span className="font-medium text-gray-800">
                      {product.processingFeePercentage}% admin • {product.latePenaltyRate}% penalty
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-gray-500">Requirements:</span>
                    <div className="flex items-center gap-2">
                      {product.requiresCollateral ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                          Collateral
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-semibold">
                          Unsecured
                        </span>
                      )}
                      {product.requiresGuarantor && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                          Guarantor
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Volume summary */}
              <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-400">{associatedLoans.length} Originated Contracts</span>
                <span className="font-bold font-mono text-blue-600">{formatCurrency(totalVolume)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
