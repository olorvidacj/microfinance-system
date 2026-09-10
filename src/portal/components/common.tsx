import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Landmark,
  RefreshCw,
  Repeat,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card } from './ui/Card';
import { TransactionType } from '../types';

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  tone?: 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'slate';
  onClick?: () => void;
}> = ({ label, value, sub, icon: Icon, tone = 'emerald', onClick }) => {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <Card
      className={`p-5 ${onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={`shrink-0 rounded-xl p-2.5 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
};

export const InfoRow: React.FC<{ label: string; value: React.ReactNode; muted?: boolean }> = ({
  label,
  value,
  muted,
}) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <span className={`shrink-0 text-sm ${muted ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
    <span className={`text-right text-sm font-medium tabular-nums ${muted ? 'text-slate-400' : 'text-slate-800'}`}>
      {value}
    </span>
  </div>
);

export const SectionDivider: React.FC = () => <div className="my-3 border-t border-slate-100" />;

const methodIcons: Record<string, React.ElementType> = {
  CASH: Banknote,
  BANK_TRANSFER: Landmark,
  GCASH: Smartphone,
  MAYA: Smartphone,
  EWALLET: Smartphone,
  OVER_THE_COUNTER: Building2,
  CARD: Wallet,
  DEFAULT: Wallet,
};

export const PaymentMethodBadge: React.FC<{ method: string; className?: string }> = ({ method, className = '' }) => {
  const Icon = methodIcons[method] || methodIcons.DEFAULT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {method.replace(/_/g, ' ')}
    </span>
  );
};

export const transactionIcon = (type: TransactionType, className = 'h-4 w-4') => {
  switch (type) {
    case 'REPAYMENT':
      return <Repeat className={`${className} text-emerald-600`} />;
    case 'LOAN_DISBURSEMENT':
      return <ArrowUpRight className={`${className} text-blue-600`} />;
    case 'LOAN_APPROVAL':
      return <CheckCircle2 className={`${className} text-blue-600`} />;
    case 'SAVINGS_DEPOSIT':
      return <TrendingUp className={`${className} text-emerald-600`} />;
    case 'SAVINGS_WITHDRAWAL':
      return <TrendingDown className={`${className} text-rose-500`} />;
    case 'FEE':
      return <Clock className={`${className} text-amber-500`} />;
    case 'ADJUSTMENT':
      return <RefreshCw className={`${className} text-slate-400`} />;
    default:
      return <Wallet className={`${className} text-slate-400`} />;
  }
};

export const transactionTone = (type: TransactionType): 'positive' | 'negative' | 'neutral' => {
  switch (type) {
    case 'REPAYMENT':
    case 'SAVINGS_DEPOSIT':
      return 'positive';
    case 'LOAN_DISBURSEMENT':
    case 'SAVINGS_WITHDRAWAL':
    case 'FEE':
      return 'negative';
    default:
      return 'neutral';
  }
};

export const transactionDirection = (tone: 'positive' | 'negative') =>
  tone === 'positive' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />;

export const typeLabel = (type: string): string =>
  type
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export const typeColor: Record<string, string> = {
  REPAYMENT: 'text-emerald-600',
  SAVINGS_DEPOSIT: 'text-emerald-600',
  LOAN_DISBURSEMENT: 'text-blue-600',
  SAVINGS_WITHDRAWAL: 'text-rose-500',
  FEE: 'text-amber-500',
  LOAN_APPROVAL: 'text-blue-600',
  ADJUSTMENT: 'text-slate-400',
};

export const savingsTypeLabel = (t: string) => {
  const map: Record<string, string> = { DEPOSIT: 'Deposit', WITHDRAWAL: 'Withdrawal', INTEREST: 'Interest' };
  return map[t] || t.toLowerCase();
};