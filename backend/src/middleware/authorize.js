import { asyncHandler } from '../utils/asyncHandler.js';
import { forbidden } from '../utils/ApiError.js';
import { ROLES, STAFF_ROLES } from '../utils/constants.js';

/**
 * Role gate. Must run AFTER authenticate (requires req.user).
 * Usage: requireRole(ROLES.ADMIN), requireRole(ROLES.MANAGER, ROLES.TELLER)
 */
export const requireRole = (...allowedRoles) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) {
      throw forbidden('Authentication required before role check', 'ROLE_CHECK_NO_USER');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw forbidden(`Requires role: ${allowedRoles.join(' or ')}`, 'ROLE_NOT_PERMITTED');
    }
    next();
  });

/** Any authenticated staff member (admin, manager, loan_officer, teller). */
export const requireStaff = () => requireRole(...STAFF_ROLES);

/** Authenticated clients only. */
export const requireClient = () => requireRole(ROLES.CLIENT);
