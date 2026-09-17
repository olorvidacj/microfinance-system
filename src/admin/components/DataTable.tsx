import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T | string;
  pageSize?: number;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, keyField, pageSize = 8, emptyMessage = 'No records found' }: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-150">
              {columns.map((col) => (
                <th key={col.key} className={`text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap first:pl-0 last:pr-0 ${col.headerClassName || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, ri) => (
              <tr key={String((row as any)[keyField])} className={`border-b border-slate-100 hover:bg-slate-50/60 transition ${ri % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                {columns.map((col) => (
                  <td key={col.key} className={`py-3 px-3 align-middle first:pl-0 last:pr-0 ${col.className || ''}`}>
                    {col.render ? col.render(row) : String((row as any)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, data.length)} of {data.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg">
              Page {currentPage} of {totalPages}
            </span>
            <button onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}