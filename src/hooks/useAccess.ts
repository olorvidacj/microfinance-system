import { useLoan } from '../context/LoanContext';
import {
  SystemPermission,
  RoleDefinition,
  hasPermission as checkPerm,
  hasAnyPermission as checkAnyPerm,
  hasAllPermissions as checkAllPerm,
  canAccessTab as checkTab,
  getRoleDefinition,
  normalizeRole,
  ROLE_DEFINITIONS,
  CORE_ROLES_LIST,
  ALL_ROLES_LIST,
  PERMISSION_CATEGORIES,
} from '../auth/permissions';

export function useAccess() {
  const { currentUser, setCurrentUser, staffList } = useLoan();

  const roleKey = normalizeRole(currentUser?.role);
  const roleDef: RoleDefinition = getRoleDefinition(roleKey);

  const hasPerm = (permission: SystemPermission): boolean => {
    return checkPerm(roleKey, permission);
  };

  const hasAnyPerm = (permissions: SystemPermission[]): boolean => {
    return checkAnyPerm(roleKey, permissions);
  };

  const hasAllPerm = (permissions: SystemPermission[]): boolean => {
    return checkAllPerm(roleKey, permissions);
  };

  const canAccess = (tabId: string): boolean => {
    return checkTab(roleKey, tabId);
  };

  const isAdministrator = roleKey === 'ADMINISTRATOR' || roleKey === 'SUPER_ADMIN';
  const isClientServices = roleKey === 'CLIENT_SERVICES_STAFF' || roleKey === 'CLIENT_SERVICES';
  const isLoanOfficer = roleKey === 'LOAN_OFFICER' || roleKey === 'LOAN_PROCESSOR';
  const isCashierTeller = roleKey === 'CASHIER_TELLER' || roleKey === 'TELLER';
  const isClient = roleKey === 'CLIENT';

  const switchRole = (newRole: string) => {
    const norm = normalizeRole(newRole);
    // Find staff member with this role or build a fallback representation
    const staffMatch = staffList.find((s) => normalizeRole(s.role) === norm);
    if (staffMatch) {
      setCurrentUser(staffMatch);
    } else {
      const def = getRoleDefinition(norm);
      setCurrentUser({
        id: `role-${norm.toLowerCase()}`,
        name: `${def.name} Demo User`,
        email: `${norm.toLowerCase().replace(/_/g, '')}@hoscomo.coop`,
        role: norm as any,
        assignedBranchId: 'all',
        title: def.name,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      });
    }
  };

  return {
    currentUser,
    roleKey,
    roleDef,
    permissions: roleDef.permissions,
    hasPermission: hasPerm,
    hasAnyPermission: hasAnyPerm,
    hasAllPermissions: hasAllPerm,
    canAccessTab: canAccess,
    isAdministrator,
    isClientServices,
    isLoanOfficer,
    isCashierTeller,
    isClient,
    switchRole,
    allRoles: Object.values(ROLE_DEFINITIONS),
    coreRoles: CORE_ROLES_LIST,
    allRolesList: ALL_ROLES_LIST,
    permissionCategories: PERMISSION_CATEGORIES,
  };
}
