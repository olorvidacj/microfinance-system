import React from 'react';
import { formatCurrency } from '../../../utils/loanMath';

export const Amount: React.FC<{
  value: number | undefined | null;
  className?: string;
  positive?: boolean;
  negative?: boolean;
}> = ({ value, className = '', positive, negative }) => {
  const color = negative
    ? 'text-rose-600'
    : positive
      ? 'text-emerald-600'
      : '';
  return <span className={`tabular-nums ${color} ${className}`}>{formatCurrency(value)}</span>;
};