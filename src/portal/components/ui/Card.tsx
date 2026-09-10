import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`} {...rest}>
    {children}
  </div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={`flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 ${className}`} {...rest}>
    {children}
  </div>
);

export const CardTitle: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <h3 className={`text-sm font-semibold text-slate-800 ${className}`}>{children}</h3>
);

export const CardSubtitle: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <p className={`text-xs text-slate-500 ${className}`}>{children}</p>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={`px-5 py-4 ${className}`} {...rest}>
    {children}
  </div>
);