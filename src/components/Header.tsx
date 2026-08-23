import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  CreditCard,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  User,
  Users,
  Wallet,
  Sparkles,
  Database,
  RefreshCw,
  Zap,
  LogOut,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/loanMath';
import { SupabaseModal } from './SupabaseModal';

interface HeaderProps {
  onOpenNewLoan: () => void;
  onOpenRecordPayment: () => void;
  onOpenAddBorrower: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewLoan,
  onOpenRecordPayment,
  onOpenAddBorrower,
}) => {
  const {
    branches,
    activeBranchId,
    setActiveBranchId,
    activeBranch,
    staffList,
    currentUser,
    setCurrentUser,
    stats,
    resetToDefaults,
    dbStatus,
    isSyncingDb,
    syncWithDatabase,
  } = useLoan();
  const { logout, user: authUser } = useAuth();

  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'BRANCH_MANAGER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'LOAN_OFFICER':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'TELLER':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'AUDITOR':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md font-bold text-xl">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">HOSCOMO</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold uppercase tracking-wider border border-blue-200">
                  Microfinance
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Client Services & Financial Transactions</p>
            </div>
          </div>

          {/* Center: Branch Selector Switcher */}
          <div className="relative">
            <button
              id="branch-selector-btn"
              onClick={() => {
                setShowBranchDropdown(!showBranchDropdown);
                setShowRoleDropdown(false);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 rounded-xl text-sm font-medium text-slate-700 transition"
            >
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="max-w-[140px] sm:max-w-[200px] truncate">
                {activeBranch ? activeBranch.name : 'All Branches (Consolidated)'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showBranchDropdown && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                  <span>Switch Branch View</span>
                  <span className="text-blue-600 font-normal">{branches.length} Active</span>
                </div>
                <button
                  onClick={() => {
                    setActiveBranchId('all');
                    setShowBranchDropdown(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between transition hover:bg-slate-50 ${
                    activeBranchId === 'all' ? 'bg-blue-50/70 font-semibold text-blue-700' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <span>All Branches (Consolidated)</span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">{formatCurrency(stats.totalPortfolio)}</span>
                </button>

                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => {
                      setActiveBranchId(branch.id);
                      setShowBranchDropdown(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between transition hover:bg-slate-50 ${
                      activeBranchId === branch.id ? 'bg-blue-50/70 font-semibold text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: branch.color }}></span>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-900">{branch.name}</div>
                        <div className="text-[11px] text-slate-400">{branch.city} • {branch.code}</div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-500">{formatCurrency(branch.activeDisbursedPool)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Quick Action Buttons, User Persona Switcher & Demo Tools */}
          <div className="flex items-center gap-2.5">
            {/* Quick Record Payment */}
            <button
              id="header-record-pay-btn"
              onClick={onOpenRecordPayment}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/80 rounded-xl text-sm font-medium transition"
            >
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Record Payment</span>
            </button>

            {/* Quick New Loan */}
            <button
              id="header-new-loan-btn"
              onClick={onOpenNewLoan}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">New Loan</span>
              <span className="sm:hidden">Loan</span>
            </button>

            {/* Staff / Role Persona Selector */}
            <div className="relative">
              <button
                id="user-persona-btn"
                onClick={() => {
                  setShowRoleDropdown(!showRoleDropdown);
                  setShowBranchDropdown(false);
                }}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 rounded-xl transition"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover border border-slate-200"
                />
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[100px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono leading-tight">
                    {currentUser.role.replace('_', ' ')}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showRoleDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Switch Staff Persona</div>
                    <div className="text-[11px] text-slate-400">Test role-based access & permissions</div>
                  </div>
                  {staffList.map((staff) => (
                    <button
                      key={staff.id}
                      onClick={() => {
                        setCurrentUser(staff);
                        setShowRoleDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-3 transition hover:bg-slate-50 ${
                        currentUser.id === staff.id ? 'bg-blue-50/80 font-semibold text-blue-900' : 'text-slate-700'
                      }`}
                    >
                      <img src={staff.avatar} alt={staff.name} className="w-8 h-8 rounded-full object-cover" />
                      <div className="flex-1 truncate">
                        <div className="text-xs font-semibold text-slate-900">{staff.name}</div>
                        <div className="text-[11px] text-slate-400">{staff.title}</div>
                        <span
                          className={`inline-block mt-0.5 text-[9px] px-2 py-0.5 rounded-full border font-medium ${getRoleBadgeColor(
                            staff.role
                          )}`}
                        >
                          {staff.role}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sign Out */}
            <button
              onClick={logout}
              title={`Sign out ${authUser?.email || ''}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/70 rounded-xl text-sm font-medium transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Sign Out</span>
            </button>

            {/* Database / Supabase Connection Button */}
            <button
              onClick={() => setShowSupabaseModal(true)}
              title="Supabase Database Connection & Migration Portal. Click to configure or view schema."
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-xs ${
                dbStatus.connected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
              }`}
            >
              <Database className={`w-3.5 h-3.5 ${dbStatus.connected ? 'text-emerald-600' : 'text-blue-600'}`} />
              <span className="hidden sm:inline">
                {dbStatus.connected ? 'Supabase Connected' : 'Supabase Setup'}
              </span>
              <span className="sm:hidden">DB</span>
              <span className={`w-2 h-2 rounded-full ${dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`}></span>
            </button>

            {/* Reset Demo Data Button */}
            <button
              title="Reset Demo Data"
              onClick={() => setShowResetConfirm(true)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Supabase Connection & Migration Modal */}
      <SupabaseModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
      />

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Reset Demo Data?</h3>
            <p className="text-xs text-gray-500 mt-2">
              This will restore all branches, borrowers, loan contracts, and collections ledger back to initial clean state.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetToDefaults();
                  setShowResetConfirm(false);
                }}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
