import React from 'react';
import { Building2 } from 'lucide-react';

export const AuthHeader: React.FC = () => {
  return (
    <div className="lg:hidden flex items-center gap-2 mb-5">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md">
        <Building2 className="w-4 h-4" />
      </div>
      <span className="font-bold text-slate-900 text-base">HOSCOMO</span>
    </div>
  );
};
