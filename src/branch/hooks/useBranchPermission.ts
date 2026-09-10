import { useMemo } from 'react';
import { useBranchContext } from '../context/BranchContext';

export function useBranchPermission(permissions: string[]): boolean {
  const { permissions: userPermissions } = useBranchContext();
  return useMemo(
    () => (permissions.length === 0 ? true : permissions.some((p) => userPermissions.includes(p))),
    [permissions, userPermissions]
  );
}