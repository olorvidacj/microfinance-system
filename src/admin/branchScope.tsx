import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminApi } from './services/adminApi';

/**
 * The branch the admin console is showing: null for every branch. Every list,
 * dashboard and report passes it to the API, which filters on the server.
 * Kept per tab, so two tabs can look at two branches.
 */
const KEY = 'HOSCOMCO_admin_branch';

export interface BranchOption {
  id: string;
  name: string;
}

interface AdminBranchState {
  branchId: string | null;
  /** "All branches" or the selected branch's name. */
  branchName: string;
  branches: BranchOption[];
  /** Why the branch list could not be loaded, if it could not. */
  branchesError: string;
  setBranchId: (id: string | null) => void;
}

const AdminBranchContext = createContext<AdminBranchState | undefined>(undefined);

function readStored(): string | null {
  try {
    return sessionStorage.getItem(KEY) || null;
  } catch {
    return null; // Storage blocked: the console starts on every branch.
  }
}

function writeStored(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(KEY, id);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded.
  }
}

export const AdminBranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branchId, setBranch] = useState<string | null>(readStored);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesError, setBranchesError] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminApi.branches().then(
      (rows) => {
        if (cancelled) return;
        const list = rows.map((b) => ({ id: b.id, name: b.branchName }));
        setBranches(list);
        // A branch remembered from before that no longer exists: back to every branch.
        setBranch((cur) => {
          if (cur && !list.some((b) => b.id === cur)) {
            writeStored(null);
            return null;
          }
          return cur;
        });
      },
      (err: unknown) => {
        if (!cancelled) setBranchesError(err instanceof Error ? err.message : 'The branches could not be loaded.');
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const setBranchId = useCallback((id: string | null) => {
    writeStored(id);
    setBranch(id);
  }, []);

  const value = useMemo<AdminBranchState>(() => {
    const selected = branchId ? branches.find((b) => b.id === branchId) : undefined;
    return { branchId, branchName: branchId ? (selected?.name ?? 'Selected branch') : 'All branches', branches, branchesError, setBranchId };
  }, [branchId, branches, branchesError, setBranchId]);

  return <AdminBranchContext.Provider value={value}>{children}</AdminBranchContext.Provider>;
};

export function useAdminBranch(): AdminBranchState {
  const ctx = useContext(AdminBranchContext);
  if (!ctx) throw new Error('useAdminBranch must be used within AdminBranchProvider');
  return ctx;
}

/** The branch picker shown in the admin console's top bar. */
export const BranchSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { branchId, branches, branchesError, setBranchId } = useAdminBranch();
  return (
    <label className={`inline-flex items-center gap-1.5 ${className}`} title={branchesError || 'Show one branch or every branch'}>
      <span className="sr-only">Branch</span>
      <select
        aria-label="Branch"
        value={branchId ?? ''}
        onChange={(e) => setBranchId(e.target.value || null)}
        className="max-w-[11rem] sm:max-w-[16rem] truncate rounded-full border border-slate-200/80 bg-slate-100/90 py-1 pl-2.5 pr-7 text-xs font-medium text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
      >
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {branchesError && <span className="text-[10px] font-medium text-rose-600">Branches unavailable</span>}
    </label>
  );
};
