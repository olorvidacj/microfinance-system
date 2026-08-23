import React from 'react';
import {
  LayoutDashboard,
  Users2,
  PiggyBank,
  FileSpreadsheet,
  Receipt,
  BookOpen,
  Calculator,
  Building2,
  FileText,
  Package,
  Users,
  Smartphone,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';

export type NavTab =
  | 'dashboard'
  | 'membership'
  | 'loans'
  | 'payments'
  | 'savings'
  | 'groupLending'
  | 'clientPortal'
  | 'brochure'
  | 'calculator'
  | 'branches'
  | 'products'
  | 'reports';

interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { stats, filteredLoans, filteredMembershipApps, withdrawalRequests } = useLoan();

  const pendingWithdrawalsCount = withdrawalRequests.filter((w) => w.status === 'Pending Approval').length;
  const pendingAppsCount = filteredMembershipApps.filter(
    (a) => a.currentStep !== 'BOD_APPROVED' && a.currentStep !== 'REJECTED'
  ).length;
  const overdueCount = filteredLoans.filter(
    (l) => l.status === 'In Arrears' || (l.daysInArrears && l.daysInArrears > 0)
  ).length;

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'membership' as NavTab,
      label: 'Client Registration & KYC',
      icon: Users2,
      badge: pendingAppsCount > 0 ? pendingAppsCount : undefined,
      badgeColor: 'bg-blue-100 text-blue-700 font-semibold',
    },
    {
      id: 'loans' as NavTab,
      label: 'Loan Application & Disbursement',
      icon: FileSpreadsheet,
      badge: filteredLoans.length,
      badgeColor: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'payments' as NavTab,
      label: 'Repayments & Installments',
      icon: Receipt,
      badge: overdueCount > 0 ? `${overdueCount} Overdue` : undefined,
      badgeColor: 'bg-rose-100 text-rose-700 font-bold',
    },
    {
      id: 'savings' as NavTab,
      label: 'Savings Accounts',
      icon: PiggyBank,
      badge: pendingWithdrawalsCount > 0 ? pendingWithdrawalsCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 font-semibold',
    },
    {
      id: 'groupLending' as NavTab,
      label: 'Group Lending & Solidarity',
      icon: Users,
      badge: 'Grameen',
      badgeColor: 'bg-indigo-100 text-indigo-700 font-semibold',
    },
    {
      id: 'clientPortal' as NavTab,
      label: 'Client Self-Service Portal (Mobile)',
      icon: Smartphone,
      badge: 'Portal',
      badgeColor: 'bg-emerald-100 text-emerald-800 font-semibold',
    },
    {
      id: 'brochure' as NavTab,
      label: 'HOSCOMO Policies',
      icon: BookOpen,
    },
    { id: 'calculator' as NavTab, label: 'Calculator', icon: Calculator },
    { id: 'branches' as NavTab, label: 'Branches', icon: Building2 },
    { id: 'products' as NavTab, label: 'Products', icon: Package },
    { id: 'reports' as NavTab, label: 'Audit & Reports', icon: FileText },
  ];

  return (
    <div className="bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}-btn`}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-600 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono ${item.badgeColor || 'bg-slate-100 text-slate-600'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
