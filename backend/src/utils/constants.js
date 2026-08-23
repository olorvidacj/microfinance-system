export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  LOAN_OFFICER: 'loan_officer',
  TELLER: 'teller',
  CLIENT: 'client',
};

/** Staff roles per spec §16 RBAC. */
export const STAFF_ROLES = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.LOAN_OFFICER,
  ROLES.TELLER,
];

export const CLIENT_STATUSES = {
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  CLOSED: 'closed',
};

export const KYC_STATUSES = {
  PENDING: 'pending',
  IN_REVIEW: 'in_review',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};
