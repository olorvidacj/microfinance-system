import React, { useState } from 'react';
import {
  Search,
  UserPlus,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  CreditCard,
  ChevronRight,
  Sparkles,
  Award,
  AlertCircle,
  FileCheck,
  PiggyBank,
  Scale,
  Edit3,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { Borrower } from '../types';

interface BorrowersViewProps {
  onSelectBorrower: (borrower: Borrower) => void;
  onOpenAddBorrower: () => void;
  onOpenNewLoanForBorrower: (borrower: Borrower) => void;
}

export const BorrowersView: React.FC<BorrowersViewProps> = ({
  onSelectBorrower,
  onOpenAddBorrower,
  onOpenNewLoanForBorrower,
}) => {
  const { filteredBorrowers, branches, savingsAccounts } = useLoan();

  const [searchTerm, setSearchTerm] = useState('');
  const [kycFilter, setKycFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const displayBorrowers = filteredBorrowers.filter((b) => {
    const matchesSearch =
      b.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.borrowerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.phone.includes(searchTerm) ||
      b.idNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesKyc = kycFilter === 'ALL' || b.kycStatus === kycFilter;
    const matchesStatus = statusFilter === 'ALL' || b.memberStatus === statusFilter;

    return matchesSearch && matchesKyc && matchesStatus;
  });

  const getTierColor = (tier: Borrower['creditTier']) => {
    switch (tier) {
      case 'Excellent':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Good':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Fair':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'High Risk':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cooperative Members Directory</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Registered member-owners, share capital (CBU), savings ledgers, and KYC/PMES verification records.
          </p>
        </div>
        <button
          onClick={onOpenAddBorrower}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>New Member Application</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by member name, Passbook #, phone, or Tax ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Member Statuses</option>
              <option value="Active">Active (In Good Standing)</option>
              <option value="Inactive">Inactive (Monitored)</option>
              <option value="Probationary">Probationary / Associate</option>
            </select>

            <select
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-700 focus:outline-none"
            >
              <option value="ALL">All KYC & PMES</option>
              <option value="Verified">Verified & PMES Completed</option>
              <option value="Pending Review">Pending BI Investigation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {displayBorrowers.map((member) => {
          const branch = branches.find((b) => b.id === member.branchId);
          const savings = savingsAccounts.find((s) => s.clientId === member.id || s.memberId === member.id);

          return (
            <div
              key={member.id}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs hover:border-blue-200 transition space-y-4 flex flex-col justify-between"
            >
              <div>
                {/* Member Top Bar */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={member.avatar}
                      alt={member.fullName}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
                    />
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                        {member.fullName}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{member.borrowerNumber}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${
                      member.memberStatus === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : member.memberStatus === 'Inactive'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {member.memberStatus || 'Active'}
                  </span>
                </div>

                {/* Cooperative Financial Metrics: CBU & Savings */}
                <div className="grid grid-cols-2 gap-2 mt-4 bg-slate-50 p-3 rounded-2xl text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Share Capital (CBU)</span>
                    <span className="font-bold text-purple-900 text-sm">{formatCurrency(member.shareCapital || 15000)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Savings Deposit</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {formatCurrency(savings?.balance || member.savingsBalance || 2500)}
                    </span>
                  </div>
                </div>

                {/* Contact & Meta */}
                <div className="space-y-1.5 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{member.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{member.occupation} • {member.employer}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{member.address}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectBorrower(member)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
                >
                  View Dossier
                </button>

                <button
                  onClick={() => onOpenNewLoanForBorrower(member)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1"
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Originate Loan</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
