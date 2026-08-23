import React from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  ShieldCheck,
  CreditCard,
  PlusCircle,
  FileCheck,
  Building2,
  Calendar,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { Borrower, Loan } from '../types';

interface BorrowerDetailModalProps {
  borrower: Borrower | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectLoan: (loan: Loan) => void;
  onOpenNewLoan: (borrower: Borrower) => void;
  onEditBorrower: (borrower: Borrower) => void;
}

export const BorrowerDetailModal: React.FC<BorrowerDetailModalProps> = ({
  borrower,
  isOpen,
  onClose,
  onSelectLoan,
  onOpenNewLoan,
  onEditBorrower,
}) => {
  const { loans, branches } = useLoan();

  if (!isOpen || !borrower) return null;

  const borrowerLoans = loans.filter((l) => l.borrowerId === borrower.id);
  const branch = branches.find((b) => b.id === borrower.branchId);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-start justify-between">
          <div className="flex items-center gap-4">
            <img
              src={borrower.avatar}
              alt={borrower.fullName}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{borrower.fullName}</h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-indigo-200">
                  {borrower.borrowerNumber}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {borrower.occupation} • {borrower.employmentStatus} • {branch?.name}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {borrower.phone}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {borrower.address}, {borrower.city}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEditBorrower(borrower);
              }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium transition"
            >
              Edit Profile
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KYC & Financial Stats Strip */}
        <div className="p-6 bg-gray-50 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-white rounded-xl border border-gray-200">
            <span className="text-gray-400 font-medium">Credit Score</span>
            <div className="text-lg font-bold text-gray-900 font-mono mt-0.5">
              {borrower.creditScore} ({borrower.creditTier})
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold">Tier Verified</div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-gray-200">
            <span className="text-gray-400 font-medium">Monthly Stated Income</span>
            <div className="text-lg font-bold text-gray-900 font-mono mt-0.5">
              {formatCurrency(borrower.monthlyIncome)}
            </div>
            <div className="text-[10px] text-gray-500">Verified Payslip/Ledger</div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-gray-200">
            <span className="text-gray-400 font-medium">Total Lifetime Borrowed</span>
            <div className="text-lg font-bold text-blue-600 font-mono mt-0.5">
              {formatCurrency(borrower.totalBorrowed)}
            </div>
            <div className="text-[10px] text-gray-500">{borrowerLoans.length} Facilities</div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-gray-200">
            <span className="text-gray-400 font-medium">Total Repaid</span>
            <div className="text-lg font-bold text-emerald-600 font-mono mt-0.5">
              {formatCurrency(borrower.totalRepaid)}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold">100% Good Standing</div>
          </div>
        </div>

        {/* Loans Portfolio History */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Associated Loan Contracts ({borrowerLoans.length})</h3>
            <button
              onClick={() => {
                onClose();
                onOpenNewLoan(borrower);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Originate Loan Facility</span>
            </button>
          </div>

          {borrowerLoans.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-xl text-gray-400 text-xs">
              No active or previous loans on record for this borrower.
            </div>
          ) : (
            <div className="space-y-2">
              {borrowerLoans.map((loan) => (
                <div
                  key={loan.id}
                  onClick={() => {
                    onClose();
                    onSelectLoan(loan);
                  }}
                  className="p-3.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition cursor-pointer flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-gray-900">{loan.productName}</div>
                    <div className="text-[11px] text-gray-500">
                      {loan.loanNumber} • Originated: {formatDate(loan.startDate || loan.applicationDate)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold font-mono text-gray-900">
                      {formatCurrency(loan.principalAmount)}
                    </div>
                    <span
                      className={`inline-block mt-0.5 text-[10px] px-2 py-0.2 rounded-full font-semibold ${
                        loan.status === 'Disbursed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : loan.status === 'In Arrears'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {loan.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
