import React from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2, FilePlus2, FolderOpen, PieChart, PiggyBank, UserPlus, Wallet } from 'lucide-react';
import { Card } from '../../portal/components/ui/Card';
import { useBranchContext } from '../context/BranchContext';

interface Action {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
  permissions: string[];
}

const ACTIONS: Action[] = [
  { to: '/staff/app/clients?new=1', label: 'Register Client', description: 'Intake a new member', icon: UserPlus, permissions: ['register_clients', 'manage_kyc', 'assist_clients'] },
  { to: '/staff/app/applications?new=1', label: 'New Loan Application', description: 'Originate a loan', icon: FilePlus2, permissions: ['process_loan_applications'] },
  { to: '/staff/app/kyc', label: 'Review KYC Queue', description: 'Verify client documents', icon: FileCheck2, permissions: ['manage_kyc'] },
  { to: '/staff/app/payments', label: 'Record Payment', description: 'Post a collection', icon: Wallet, permissions: ['process_loan_repayments'] },
  { to: '/staff/app/savings', label: 'Savings Transaction', description: 'Deposit or withdrawal', icon: PiggyBank, permissions: ['process_savings_deposits', 'process_savings_withdrawals'] },
  { to: '/staff/app/reports', label: 'View Reports', description: 'Branch reports & charts', icon: PieChart, permissions: ['view_transaction_records', 'view_all_records', 'monitor_loan_repayment'] },
  { to: '/staff/app/documents', label: 'Documents', description: 'Branch document records', icon: FolderOpen, permissions: ['view_client_info', 'register_clients', 'manage_kyc'] },
];

const can = (set: string[], perms: string[]) => perms.length === 0 || perms.some((p) => set.includes(p));

export const QuickActions: React.FC = () => {
  const { permissions } = useBranchContext();
  const visible = ACTIONS.filter((a) => can(permissions, a.permissions));
  if (visible.length === 0) return null;
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-800">Quick actions</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
              <a.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">{a.label}</div>
              <div className="truncate text-xs text-slate-500">{a.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
};