import React from 'react';

export const Table: React.FC<{
  headers: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
  dense?: boolean;
}> = ({ headers, children, className = '', dense = false }) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="min-w-full divide-y divide-slate-200">
      <thead className="bg-slate-50">
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              className={`whitespace-nowrap px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                dense ? 'py-2' : 'py-3'
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  </div>
);

export const Tr: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className = '', ...rest }) => (
  <tr className={`hover:bg-slate-50 ${className}`} {...rest} />
);

export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...rest }) => (
  <td className={`whitespace-nowrap px-4 py-3 text-sm text-slate-700 ${className}`} {...rest} />
);