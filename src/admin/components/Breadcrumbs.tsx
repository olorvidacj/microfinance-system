import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-5 flex-wrap" aria-label="Breadcrumbs">
      <Link to="/admin" className="flex items-center gap-1 text-slate-400 hover:text-amber-600 transition">
        <Home className="w-3.5 h-3.5" />
        <span className="font-medium">Admin</span>
      </Link>
      {items.map((item, i) => {
        const dest = item.path || item.href;
        return (
          <React.Fragment key={i}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            {dest ? (
              <Link to={dest} className="hover:text-amber-600 transition font-medium text-slate-600">
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-800 font-semibold">{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};