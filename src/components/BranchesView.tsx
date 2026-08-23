import React, { useState } from 'react';
import {
  Building2,
  PlusCircle,
  MapPin,
  Phone,
  Mail,
  User,
  DollarSign,
  TrendingUp,
  CreditCard,
  ArrowRightLeft,
  CheckCircle2,
  Edit2,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency } from '../utils/loanMath';
import { Branch } from '../types';

interface BranchesViewProps {
  onOpenAddBranch: () => void;
  onEditBranch: (branch: Branch) => void;
}

export const BranchesView: React.FC<BranchesViewProps> = ({
  onOpenAddBranch,
  onEditBranch,
}) => {
  const { branches, loans, borrowers, setActiveBranchId, activeBranchId, updateBranch } = useLoan();

  const [transferModal, setTransferModal] = useState<{ fromId: string; toId: string; amount: number } | null>(null);
  const [transferSuccess, setTransferSuccess] = useState(false);

  const handleExecuteTransfer = () => {
    if (!transferModal || transferModal.amount <= 0) return;
    const fromBranch = branches.find((b) => b.id === transferModal.fromId);
    const toBranch = branches.find((b) => b.id === transferModal.toId);
    if (!fromBranch || !toBranch || fromBranch.cashVaultBalance < transferModal.amount) return;

    updateBranch(fromBranch.id, {
      cashVaultBalance: fromBranch.cashVaultBalance - transferModal.amount,
    });
    updateBranch(toBranch.id, {
      cashVaultBalance: toBranch.cashVaultBalance + transferModal.amount,
    });

    setTransferSuccess(true);
    setTimeout(() => {
      setTransferModal(null);
      setTransferSuccess(false);
    }, 1200);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Multi-Branch Network & Liquidity Vaults
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Decentralized shop locations, branch managers, cash vaults, and regional portfolio allocations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTransferModal({ fromId: branches[0]?.id || '', toId: branches[1]?.id || '', amount: 10000 })}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-medium transition shadow-2xs"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
            <span>Transfer Vault Liquidity</span>
          </button>
          <button
            onClick={onOpenAddBranch}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Open New Branch</span>
          </button>
        </div>
      </div>

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {branches.map((branch) => {
          const branchLoans = loans.filter((l) => l.branchId === branch.id);
          const branchBorrowers = borrowers.filter((b) => b.branchId === branch.id);
          const activePortfolio = branchLoans
            .filter((l) => l.status === 'Disbursed' || l.status === 'In Arrears')
            .reduce((acc, l) => acc + l.remainingBalance, 0);

          const isSelected = activeBranchId === branch.id;

          return (
            <div
              key={branch.id}
              className={`bg-white p-6 rounded-2xl border transition shadow-2xs flex flex-col justify-between ${
                isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div>
                {/* Branch Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-xs"
                      style={{ backgroundColor: branch.color }}
                    >
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-lg">{branch.name}</h3>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {branch.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>{branch.address}, {branch.city}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onEditBranch(branch)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    title="Edit Branch Settings"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Manager Card */}
                <div className="mt-5 p-3.5 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      {branch.managerName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{branch.managerName}</div>
                      <div className="text-[11px] text-gray-500">Branch Operations Manager</div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-gray-500 font-mono">
                    {branch.phone}
                  </div>
                </div>

                {/* Financial Metrics */}
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-gray-100 bg-blue-50/40">
                    <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                      Active Portfolio
                    </span>
                    <span className="text-lg font-bold text-gray-900 font-mono mt-1 block">
                      {formatCurrency(activePortfolio)}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5 block">
                      {branchLoans.length} Loans Originated
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-100 bg-emerald-50/40">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                      Cash Vault Balance
                    </span>
                    <span className="text-lg font-bold text-emerald-700 font-mono mt-1 block">
                      {formatCurrency(branch.cashVaultBalance)}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5 block">
                      Liquid reserves in branch
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Switch Action */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {branchBorrowers.length} Registered Borrowers
                </span>
                <button
                  onClick={() => setActiveBranchId(branch.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {isSelected ? 'Currently Active View' : 'Switch View to Branch'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transfer Vault Liquidity Modal */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Inter-Branch Vault Transfer</h3>
              </div>
              <button
                onClick={() => setTransferModal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Source Branch (Debit)</label>
                <select
                  value={transferModal.fromId}
                  onChange={(e) => setTransferModal({ ...transferModal, fromId: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (Vault: {formatCurrency(b.cashVaultBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Destination Branch (Credit)</label>
                <select
                  value={transferModal.toId}
                  onChange={(e) => setTransferModal({ ...transferModal, toId: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  {branches
                    .filter((b) => b.id !== transferModal.fromId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (Vault: {formatCurrency(b.cashVaultBalance)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Transfer Amount ($)</label>
                <input
                  type="number"
                  value={transferModal.amount}
                  onChange={(e) => setTransferModal({ ...transferModal, amount: Number(e.target.value) })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setTransferModal(null)}
                className="py-2 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteTransfer}
                disabled={transferSuccess}
                className={`py-2 px-5 rounded-xl text-sm font-semibold text-white transition ${
                  transferSuccess ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {transferSuccess ? 'Transferred Successfully!' : 'Execute Cash Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
