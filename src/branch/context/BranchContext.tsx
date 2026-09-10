import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BranchContextData, BranchPersonnel } from '../types';
import { branchService } from '../services';

interface BranchContextValue {
  ctx: BranchContextData | null;
  personnel: BranchPersonnel | null;
  permissions: string[];
  viewAll: boolean;
  branchId: string | null;
  refresh: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ctx, setCtx] = useState<BranchContextData | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await branchService.context();
      setCtx(data);
    } catch {
      /* keep previous context */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<BranchContextValue>(
    () => ({
      ctx,
      personnel: ctx?.personnel || null,
      permissions: ctx?.permissions || [],
      viewAll: !!ctx?.viewAll,
      branchId: ctx?.branch?.id || null,
      refresh,
    }),
    [ctx, refresh]
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
};

export function useBranchContext(): BranchContextValue {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranchContext must be used within BranchProvider');
  return ctx;
}