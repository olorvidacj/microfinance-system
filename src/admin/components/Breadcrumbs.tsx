import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-5 flex-wrap">
      <Link to="/admin" className="flex items-center gap-1 hover:text-blue-600 transition">
        <Home className="w-3.5 h-3.5" />
        <span>Admin</span>
      </Link>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          {item.path ? (
            <Link to={item.path} className="hover:text-blue-600 transition font-medium">{item.label}</Link>
          ) : (
            <span className="text-slate-800 font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};