import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck2,
  FilePlus2,
  PieChart,
  PiggyBank,
  PlusCircle,
  Receipt,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useBranchContext } from '../context/BranchContext';

interface Action {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
  permissions: string[];
  accentColor: string;
}

const ACTIONS: Action[] = [
  {
    to: '/staff/app/clients?new=1',
    label: 'Register Client',
    description: 'Intake new cooperative member',
    icon: UserPlus,
    permissions: ['register_clients', 'manage_kyc', 'assist_clients'],
    accentColor: 'from-amber-500/10 to-amber-500/5 text-amber-700 border-amber-200/80 group-hover:border-amber-400',
  },
  {
    to: '/staff/app/kyc',
    label: 'Verify KYC',
    description: 'Review client identification & proofs',
    icon: FileCheck2,
    permissions: ['manage_kyc'],
    accentColor: 'from-gold-500/10 to-gold-500/5 text-gold-700 border-gold-400/30 group-hover:border-gold-400',
  },
  {
    to: '/staff/app/applications?new=1',
    label: 'Review Loan Application',
    description: 'Process & assess loan requests',
    icon: FilePlus2,
    permissions: ['process_loan_applications', 'review_client_loan_info'],
    accentColor: 'from-emerald-500/10 to-emerald-500/5 text-emerald-700 border-emerald-200/80 group-hover:border-emerald-400',
  },
  {
    to: '/staff/app/payments',
    label: 'Record Transaction',
    description: 'Post loan collection or receipt',
    icon: Wallet,
    permissions: ['process_loan_repayments'],
    accentColor: 'from-gold-500/10 to-gold-500/5 text-gold-700 border-gold-400/30 group-hover:border-gold-400',
  },
  {
    to: '/staff/app/savings',
    label: 'Savings Deposit / Withdrawal',
    description: 'Passbook transaction ledger',
    icon: PiggyBank,
    permissions: ['process_savings_deposits', 'process_savings_withdrawals'],
    accentColor: 'from-purple-500/10 to-purple-500/5 text-purple-700 border-purple-200/80 group-hover:border-purple-400',
  },
  {
    to: '/staff/app/reports',
    label: 'View Reports',
    description: 'Audit trails, collections & PAR',
    icon: PieChart,
    permissions: ['view_transaction_records', 'view_all_records', 'monitor_loan_repayment'],
    accentColor: 'from-slate-500/10 to-slate-500/5 text-slate-700 border-slate-200 group-hover:border-slate-400',
  },
];

const can = (set: string[], perms: string[]) => perms.length === 0 || perms.some((p) => set.includes(p));

export const QuickActions: React.FC = () => {
  const { permissions } = useBranchContext();
  const visible = ACTIONS.filter((a) => can(permissions, a.permissions));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Quick Operations Desk</h3>
          <p className="text-xs text-slate-500">Authorized actions for your daily staff shift</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
          Tacloban Branch
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {visible.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:border-amber-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-sm group-hover:bg-[#091527] group-hover:text-amber-400 group-hover:border-[#091527] transition-colors">
                <a.icon className="h-5 w-5" />
              </div>
              <PlusCircle className="h-4 w-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
            </div>
            <div className="mt-3">
              <div className="text-xs font-bold text-slate-800 group-hover:text-slate-950 truncate">
                {a.label}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400 line-clamp-1 leading-snug">
                {a.description}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
