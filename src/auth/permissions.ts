export type SystemRole =
  | 'ADMINISTRATOR'
  | 'CLIENT_SERVICES_STAFF'
  | 'LOAN_OFFICER'
  | 'CASHIER_TELLER'
  | 'CLIENT'
  | 'SUPER_ADMIN'
  | 'MANAGER'
  | 'LOAN_PROCESSOR'
  | 'TELLER'
  | 'BOOKKEEPER'
  | 'AUDITOR'
  | 'CREDIT_COMMITTEE'
  | 'EDUCATION_COMMITTEE'
  | 'BOARD_OF_DIRECTORS'
  | 'ADVISER'
  | 'LEGAL_OFFICER';

export type SystemPermission =
  // Administrator Permissions
  | 'manage_users'
  | 'manage_roles'
  | 'manage_settings'
  | 'view_all_records'
  | 'approve_sensitive_operations'
  | 'add_advisory_notes'
  | 'manage_legal_records'
  
  // Client Services Staff Permissions
  | 'register_clients'
  | 'manage_kyc'
  | 'view_client_info'
  | 'assist_clients'
  
  // Loan Officer Permissions
  | 'process_loan_applications'
  | 'review_client_loan_info'
  | 'manage_loan_applications'
  | 'monitor_loan_repayment'
  
  // Cashier / Teller Permissions
  | 'process_loan_repayments'
  | 'process_savings_deposits'
  | 'process_savings_withdrawals'
  | 'generate_receipts'
  | 'view_transaction_records'
  
  // Client Permissions (Strict self-only isolation)
  | 'access_own_account_only'
  | 'client_view_loans'
  | 'client_apply_services'
  | 'client_view_savings'
  |       'client_view_transactions_receipts'
    
    // Analytics & Compliance Permissions
    | 'add_advisory_notes'
    | 'manage_legal_records';

export interface RoleDefinition {
  id: SystemRole;
  name: string;
  category: 'Administration' | 'Staff' | 'Operations' | 'Governance' | 'Client';
  description: string;
  responsibilities: string[];
  permissions: SystemPermission[];
  badgeColor: string;
  iconName: string;
  allowedNavTabs: string[];
}

export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  ADMINISTRATOR: {
    id: 'ADMINISTRATOR',
    name: 'Administrator',
    category: 'Administration',
    description: 'Executive institutional control with full unrestricted access to all modules, users, security settings, and sensitive approvals.',
    responsibilities: [
      'Full system access across all branches and modules',
      'Manage users, staff accounts, credentials, and role assignments',
      'Manage cooperative institutional settings and credit policies',
      'View all records, transactions, audit trails, and system logs',
      'Approve sensitive operations (large disbursements, reversals, write-offs, credit limits)',
    ],
    permissions: [
      'manage_users',
      'manage_roles',
      'manage_settings',
      'view_all_records',
      'approve_sensitive_operations',
      'add_advisory_notes',
      'manage_legal_records',
      'register_clients',
      'manage_kyc',
      'view_client_info',
      'assist_clients',
      'process_loan_applications',
      'review_client_loan_info',
      'manage_loan_applications',
      'monitor_loan_repayment',
      'process_loan_repayments',
      'process_savings_deposits',
      'process_savings_withdrawals',
      'generate_receipts',
      'view_transaction_records',
      'add_advisory_notes',
      'manage_legal_records',
    ],
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    iconName: 'ShieldCheck',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'loans',
      'payments',
      'savings',
      'groupLending',
      'clientPortal',
      'rolesAdmin',
      'brochure',
      'reminders',
      'calculator',
      'branches',
      'products',
      'reports',
    ],
  },

  CLIENT_SERVICES_STAFF: {
    id: 'CLIENT_SERVICES_STAFF',
    name: 'Client Services Staff',
    category: 'Staff',
    description: 'Front-desk member onboarding specialist handling member inquiries, registration, identity documentation, and client assistance.',
    responsibilities: [
      'Register new clients and intake membership applications',
      'Manage KYC documents, ID verification specimens, and compliance status',
      'View client information, contact profiles, and passbooks',
      'Assist clients with member updates, inquiries, and counseling logs',
    ],
    permissions: [
      'register_clients',
      'manage_kyc',
      'view_client_info',
      'assist_clients',
      'view_transaction_records',
    ],
    badgeColor: 'bg-gold-500/20 text-gold-800 border-gold-400/30',
    iconName: 'Users2',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'groupLending',
      'brochure',
      'calculator',
    ],
  },

  LOAN_OFFICER: {
    id: 'LOAN_OFFICER',
    name: 'Loan Officer',
    category: 'Operations',
    description: 'Credit specialist responsible for evaluating borrowers, underwriting loans, managing applications, and tracking loan portfolio repayments.',
    responsibilities: [
      'Process loan applications, originate credit requests, and run AI underwriting evaluations',
      'Review client loan information, collateral items, guarantor profiles, and credit tiers',
      'Manage loan applications through evaluation and credit committee review pipelines',
      'Monitor loan repayment schedules, delinquency aging, arrears, and reminder notices',
    ],
    permissions: [
      'process_loan_applications',
      'review_client_loan_info',
      'manage_loan_applications',
      'monitor_loan_repayment',
      'view_client_info',
      'assist_clients',
      'view_transaction_records',
    ],
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconName: 'FileSpreadsheet',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'loans',
      'payments',
      'groupLending',
      'reminders',
      'calculator',
      'products',
    ],
  },

  CASHIER_TELLER: {
    id: 'CASHIER_TELLER',
    name: 'Cashier / Teller',
    category: 'Operations',
    description: 'Financial counter operator processing cash transactions, installment collections, savings deposits and withdrawals with instant receipt issuance.',
    responsibilities: [
      'Process loan repayments and installment collection receipts',
      'Process member savings deposits and capital build-up (CBU) credits',
      'Process savings withdrawals against available passbook balances',
      'Generate official receipts (OR) and printable transaction proofs',
      'View daily transaction records and cash counter ledger balances',
    ],
    permissions: [
      'process_loan_repayments',
      'process_savings_deposits',
      'process_savings_withdrawals',
      'generate_receipts',
      'view_transaction_records',
      'view_client_info',
    ],
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    iconName: 'Receipt',
    allowedNavTabs: [
      'dashboard',
      'payments',
      'savings',
      'calculator',
      'brochure',
    ],
  },

  CLIENT: {
    id: 'CLIENT',
    name: 'Client (Member)',
    category: 'Client',
    description: 'Self-service cooperative member with strict access limited strictly to their own personal account, loans, savings, and transactions.',
    responsibilities: [
      'Access only their own account (strict multi-tenant security isolation)',
      'View their personal active and historical loan accounts',
      'Make / apply for permitted services (online loan application, withdrawal request)',
      'View personal savings accounts, time deposits, and CBU share capital',
      'View personal payment history, collection transactions, and official receipts',
    ],
    permissions: [
      'access_own_account_only',
      'client_view_loans',
      'client_apply_services',
      'client_view_savings',
      'client_view_transactions_receipts',
    ],
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconName: 'Smartphone',
    allowedNavTabs: [
      'clientPortal',
    ],
  },

  // Aliases and Secondary Governance Roles
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    name: 'Super Administrator',
    category: 'Administration',
    description: 'Alias to Administrator with full system access and governance oversight.',
    responsibilities: [
      'Full system access across all branches and modules',
      'Manage users, roles, and security policies',
      'Manage system settings',
      'View all records',
      'Approve sensitive operations',
    ],
    permissions: [
      'manage_users',
      'manage_roles',
      'manage_settings',
      'view_all_records',
      'approve_sensitive_operations',
      'add_advisory_notes',
      'manage_legal_records',
      'register_clients',
      'manage_kyc',
      'view_client_info',
      'assist_clients',
      'process_loan_applications',
      'review_client_loan_info',
      'manage_loan_applications',
      'monitor_loan_repayment',
      'process_loan_repayments',
      'process_savings_deposits',
      'process_savings_withdrawals',
      'generate_receipts',
      'view_transaction_records',
      'add_advisory_notes',
      'manage_legal_records',
    ],
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    iconName: 'ShieldCheck',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'loans',
      'payments',
      'savings',
      'groupLending',
      'clientPortal',
      'rolesAdmin',
      'brochure',
      'reminders',
      'calculator',
      'branches',
      'products',
      'reports',
    ],
  },

  MANAGER: {
    id: 'MANAGER',
    name: 'Branch / General Manager',
    category: 'Administration',
    description: 'Branch managerial oversight with loan approval authority, portfolio reviews, and branch operations control.',
    responsibilities: [
      'Oversee branch operations and daily loan portfolio health',
      'Approve loans and review credit evaluations',
      'View all branch records and client accounts',
      'Authorize sensitive transactions within branch limits',
    ],
    permissions: [
      'view_all_records',
      'approve_sensitive_operations',
      'register_clients',
      'manage_kyc',
      'view_client_info',
      'assist_clients',
      'process_loan_applications',
      'review_client_loan_info',
      'manage_loan_applications',
      'monitor_loan_repayment',
      'process_loan_repayments',
      'process_savings_deposits',
      'process_savings_withdrawals',
      'generate_receipts',
      'view_transaction_records',
      'add_advisory_notes',
    ],
    badgeColor: 'bg-gold-500/20 text-gold-800 border-gold-400/30',
    iconName: 'Building2',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'loans',
      'payments',
      'savings',
      'groupLending',
      'brochure',
      'reminders',
      'calculator',
      'branches',
      'products',
      'reports',
    ],
  },

  LOAN_PROCESSOR: {
    id: 'LOAN_PROCESSOR',
    name: 'Senior Loan Processor',
    category: 'Operations',
    description: 'Alias to Loan Officer for loan application origination and repayment monitoring.',
    responsibilities: [
      'Process loan applications',
      'Review client loan information',
      'Manage loan applications',
      'Monitor loan repayment',
    ],
    permissions: [
      'process_loan_applications',
      'review_client_loan_info',
      'manage_loan_applications',
      'monitor_loan_repayment',
      'view_client_info',
      'assist_clients',
      'view_transaction_records',
    ],
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconName: 'FileSpreadsheet',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'loans',
      'payments',
      'groupLending',
      'reminders',
      'calculator',
      'products',
    ],
  },

  TELLER: {
    id: 'TELLER',
    name: 'Savings & Counter Teller',
    category: 'Operations',
    description: 'Alias to Cashier/Teller for counter transactions and receipt generation.',
    responsibilities: [
      'Process loan repayments',
      'Process savings deposits',
      'Process savings withdrawals',
      'Generate receipts',
      'View transaction records',
    ],
    permissions: [
      'process_loan_repayments',
      'process_savings_deposits',
      'process_savings_withdrawals',
      'generate_receipts',
      'view_transaction_records',
      'view_client_info',
    ],
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    iconName: 'Receipt',
    allowedNavTabs: [
      'dashboard',
      'payments',
      'savings',
      'calculator',
      'brochure',
    ],
  },

  BOOKKEEPER: {
    id: 'BOOKKEEPER',
    name: 'Head Bookkeeper / Accounting',
    category: 'Operations',
    description: 'Accounting specialist managing general ledger, journal entries, and financial reconciliations.',
    responsibilities: [
      'Maintain chart of accounts and general ledger',
      'Review daily collections and remittances',
      'View transaction records and financial reports',
      'Assist with financial reconciliation and audits',
    ],
    permissions: [
      'view_all_records',
      'view_transaction_records',
      'view_client_info',
      'generate_receipts',
      'process_loan_repayments',
      'process_savings_deposits',
    ],
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    iconName: 'Scale',
    allowedNavTabs: [
      'dashboard',
      'payments',
      'savings',
      'reports',
      'calculator',
    ],
  },

  AUDITOR: {
    id: 'AUDITOR',
    name: 'Internal Auditor & Compliance',
    category: 'Governance',
    description: 'Independent oversight officer auditing loan files, cash vaults, exception logs, and compliance.',
    responsibilities: [
      'Inspect compliance with cooperative bylaws and statutory regulations',
      'Audit loan approvals, collateral appraisals, and payment postings',
      'Review system access logs and audit trails',
      'Generate audit reports and risk matrix assessments',
    ],
    permissions: [
      'view_all_records',
      'view_transaction_records',
      'view_client_info',
      'review_client_loan_info',
      'monitor_loan_repayment',
    ],
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    iconName: 'Search',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'loans',
      'payments',
      'savings',
      'groupLending',
      'reports',
      'brochure',
    ],
  },

  CREDIT_COMMITTEE: {
    id: 'CREDIT_COMMITTEE',
    name: 'Credit Committee Member',
    category: 'Governance',
    description: 'Committee officer evaluating and voting on large credit facilities and exceptions.',
    responsibilities: [
      'Review and evaluate credit applications exceeding branch manager thresholds',
      'Inspect collateral coverage and borrower solvency profiles',
      'Provide committee voting and formal credit decisions',
    ],
    permissions: [
      'view_all_records',
      'review_client_loan_info',
      'manage_loan_applications',
      'view_client_info',
    ],
    badgeColor: 'bg-gold-500/20 text-gold-800 border-gold-400/30',
    iconName: 'Vote',
    allowedNavTabs: [
      'dashboard',
      'loans',
      'membership',
      'reports',
      'calculator',
    ],
  },

  EDUCATION_COMMITTEE: {
    id: 'EDUCATION_COMMITTEE',
    name: 'Education Committee (PMES)',
    category: 'Governance',
    description: 'Officer leading Pre-Membership Education Seminars (PMES) and member development.',
    responsibilities: [
      'Conduct and certify Pre-Membership Education Seminars (PMES)',
      'Review membership applications and applicant readiness',
      'Promote cooperative values and financial literacy',
    ],
    permissions: [
      'register_clients',
      'manage_kyc',
      'view_client_info',
      'assist_clients',
    ],
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    iconName: 'GraduationCap',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'brochure',
    ],
  },

  BOARD_OF_DIRECTORS: {
    id: 'BOARD_OF_DIRECTORS',
    name: 'Board of Directors (BOD)',
    category: 'Governance',
    description: 'Elected governing board reviewing institutional policies, high-tier membership approvals, and coop health.',
    responsibilities: [
      'Approve high-tier membership admissions and policy amendments',
      'Review executive dashboards, portfolio at risk (PAR), and financial performance',
      'Authorize annual budgets, interest rate products, and major investments',
    ],
    permissions: [
      'view_all_records',
      'approve_sensitive_operations',
      'view_client_info',
      'review_client_loan_info',
      'view_transaction_records',
    ],
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    iconName: 'Landmark',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'loans',
      'reports',
      'branches',
      'products',
    ],
  },

  ADVISER: {
    id: 'ADVISER',
    name: 'Cooperative Adviser',
    category: 'Governance',
    description: 'Advisory officer providing guidance on policy, operations, and member welfare without transactional authority.',
    responsibilities: [
      'Provide non-binding advisory guidance on cooperative operations',
      'Review institutional reports and recommend improvements',
      'Support governance and member development initiatives',
    ],
    permissions: [
      'view_all_records',
      'view_client_info',
      'review_client_loan_info',
      'view_transaction_records',
      'add_advisory_notes',
    ],
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    iconName: 'Lightbulb',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'loans',
      'reports',
      'brochure',
    ],
  },

  LEGAL_OFFICER: {
    id: 'LEGAL_OFFICER',
    name: 'Legal Officer',
    category: 'Governance',
    description: 'Legal counsel reviewing contracts, compliance, and legal records of the cooperative.',
    responsibilities: [
      'Review loan contracts, collateral documents, and legal instruments',
      'Ensure regulatory and bylaw compliance across operations',
      'Maintain the cooperative legal records registry',
    ],
    permissions: [
      'view_all_records',
      'view_client_info',
      'review_client_loan_info',
      'view_transaction_records',
      'manage_legal_records',
      'add_advisory_notes',
    ],
    badgeColor: 'bg-navy-100 text-navy-800 border-navy-200',
    iconName: 'Scale',
    allowedNavTabs: [
      'dashboard',
      'membership',
      'loans',
      'documents',
      'reports',
    ],
  },
};

/**
 * Normalizes any legacy or custom role string to standard uppercase role key
 */
export function normalizeRole(roleStr?: string | null): string {
  if (!roleStr) return 'CLIENT';
  const clean = roleStr.trim().toUpperCase().replace(/\s+/g, '_');
  if (ROLE_DEFINITIONS[clean]) return clean;
  if (clean === 'ADMIN' || clean === 'ADMINISTRATOR') return 'ADMINISTRATOR';
  if (clean === 'CLIENT_SERVICES' || clean === 'CLIENTSERVICES' || clean === 'MEMBER_SERVICES') return 'CLIENT_SERVICES_STAFF';
  if (clean === 'LOAN_OFFICER' || clean === 'LOANOFFICER' || clean === 'CREDIT_OFFICER') return 'LOAN_OFFICER';
  if (clean === 'CASHIER' || clean === 'CASHIER_TELLER' || clean === 'TELLER') return 'CASHIER_TELLER';
  if (clean === 'MEMBER' || clean === 'BORROWER') return 'CLIENT';
  return clean;
}

/**
 * Returns the full list of permissions assigned to a given role
 */
export function getRolePermissions(roleStr?: string | null): SystemPermission[] {
  const norm = normalizeRole(roleStr);
  const def = ROLE_DEFINITIONS[norm];
  if (def) return def.permissions;
  return [];
}

/**
 * Checks if a specific role possesses a required permission
 */
export function hasPermission(roleStr: string | null | undefined, permission: SystemPermission): boolean {
  if (!roleStr) return false;
  const permissions = getRolePermissions(roleStr);
  return permissions.includes(permission);
}

/**
 * Checks if a role possesses ANY of the specified permissions
 */
export function hasAnyPermission(roleStr: string | null | undefined, permissions: SystemPermission[]): boolean {
  if (!roleStr) return false;
  const userPerms = getRolePermissions(roleStr);
  return permissions.some((p) => userPerms.includes(p));
}

/**
 * Checks if a role possesses ALL of the specified permissions
 */
export function hasAllPermissions(roleStr: string | null | undefined, permissions: SystemPermission[]): boolean {
  if (!roleStr) return false;
  const userPerms = getRolePermissions(roleStr);
  return permissions.every((p) => userPerms.includes(p));
}

/**
 * Checks whether a role is permitted to access a specific navigation tab
 */
export function canAccessTab(roleStr: string | null | undefined, tabId: string): boolean {
  if (!roleStr) return false;
  const norm = normalizeRole(roleStr);
  const def = ROLE_DEFINITIONS[norm];
  if (!def) return false;
  return def.allowedNavTabs.includes(tabId);
}

/**
 * Returns role metadata definition
 */
export function getRoleDefinition(roleStr?: string | null): RoleDefinition {
  const norm = normalizeRole(roleStr);
  return (
    ROLE_DEFINITIONS[norm] || {
      id: 'CLIENT',
      name: roleStr || 'Client',
      category: 'Client',
      description: 'Standard client / member access',
      responsibilities: ['Access own account information'],
      permissions: ['access_own_account_only', 'client_view_loans', 'client_apply_services', 'client_view_savings', 'client_view_transactions_receipts'],
      badgeColor: 'bg-gray-100 text-gray-800 border-gray-200',
      iconName: 'User',
      allowedNavTabs: ['clientPortal'],
    }
  );
}

export const CORE_ROLES_LIST: SystemRole[] = [
  'ADMINISTRATOR',
  'CLIENT_SERVICES_STAFF',
  'LOAN_OFFICER',
  'CASHIER_TELLER',
  'CLIENT',
];

export const ALL_ROLES_LIST: SystemRole[] = [
  'ADMINISTRATOR',
  'CLIENT_SERVICES_STAFF',
  'LOAN_OFFICER',
  'CASHIER_TELLER',
  'CLIENT',
  'SUPER_ADMIN',
  'MANAGER',
  'LOAN_PROCESSOR',
  'TELLER',
  'BOOKKEEPER',
  'AUDITOR',
  'CREDIT_COMMITTEE',
  'EDUCATION_COMMITTEE',
  'BOARD_OF_DIRECTORS',
];

export const PERMISSION_CATEGORIES: {
  category: string;
  description: string;
  permissions: { key: SystemPermission; label: string; description: string }[];
}[] = [
  {
    category: 'System & Institutional Governance',
    description: 'Highest tier management of system accounts, global policies, and sensitive overrides',
    permissions: [
      { key: 'manage_users', label: 'Manage Users & Roles', description: 'Create, update, deactivate staff accounts and assign roles' },
      { key: 'manage_settings', label: 'Manage System Settings', description: 'Configure interest caps, penalty rules, and branch limits' },
      { key: 'view_all_records', label: 'View All Records', description: 'Unrestricted access to all branch accounts, ledgers, and logs' },
      { key: 'approve_sensitive_operations', label: 'Approve Sensitive Operations', description: 'Authorize high-value loans, transaction reversals, write-offs' },
      { key: 'add_advisory_notes', label: 'Add Advisory Notes', description: 'Provide strategic portfolio and risk advisory notes' },
      { key: 'manage_legal_records', label: 'Manage Legal Records', description: 'Manage legal compliance, mortgage registrations and records' },
    ],
  },
  {
    category: 'Client Services & KYC Onboarding',
    description: 'Frontline member registration, identity validation, and account assistance',
    permissions: [
      { key: 'register_clients', label: 'Register Clients', description: 'Intake new membership applications and register borrowers' },
      { key: 'manage_kyc', label: 'Manage KYC Verification', description: 'Upload, inspect, verify, and request corrections on ID documents' },
      { key: 'view_client_info', label: 'View Client Information', description: 'View client contact info, profiles, and basic membership history' },
      { key: 'assist_clients', label: 'Assist Clients', description: 'Log client inquiries, counseling sessions, and profile change requests' },
    ],
  },
  {
    category: 'Loan Processing & Credit Underwriting',
    description: 'Credit assessment, application pipelines, and portfolio repayment monitoring',
    permissions: [
      { key: 'process_loan_applications', label: 'Process Loan Applications', description: 'Originate loans, run credit calculations, and AI underwriting' },
      { key: 'review_client_loan_info', label: 'Review Client Loan Profile', description: 'Evaluate borrower income, debt-to-income, and collateral values' },
      { key: 'manage_loan_applications', label: 'Manage Loan Applications', description: 'Recommend approval/rejection and forward to credit committee' },
      { key: 'monitor_loan_repayment', label: 'Monitor Loan Repayment', description: 'Track portfolio aging, overdue accounts, and draft reminder notices' },
    ],
  },
  {
    category: 'Cashier & Counter Collections',
    description: 'Financial transactions, installment receipts, savings deposits and cash withdrawals',
    permissions: [
      { key: 'process_loan_repayments', label: 'Process Loan Repayments', description: 'Receive counter cash/transfer payments and post to loan schedule' },
      { key: 'process_savings_deposits', label: 'Process Savings Deposits', description: 'Accept member deposits to passbook and capital build-up accounts' },
      { key: 'process_savings_withdrawals', label: 'Process Savings Withdrawals', description: 'Execute approved cash withdrawals from member savings' },
      { key: 'generate_receipts', label: 'Generate Official Receipts', description: 'Issue, print, and download official receipts and transaction proofs' },
      { key: 'view_transaction_records', label: 'View Transaction Records', description: 'Inspect daily collection journals and cash drawer balances' },
    ],
  },
  {
    category: 'Client Portal Self-Service',
    description: 'Permissions for authenticated cooperative members restricted strictly to their own data',
    permissions: [
      { key: 'access_own_account_only', label: 'Access Own Account Only', description: 'Strict backend data isolation preventing viewing other members' },
      { key: 'client_view_loans', label: 'View Own Loans', description: 'Check personal loan balances, installments, and due dates' },
      { key: 'client_apply_services', label: 'Apply For Permitted Services', description: 'Submit online loan applications and savings withdrawal requests' },
      { key: 'client_view_savings', label: 'View Own Savings', description: 'View passbook savings, time deposits, and share capital dividends' },
      { key: 'client_view_transactions_receipts', label: 'View Own Receipts', description: 'Download payment receipts and review payment history' },
    ],
  },
  {
    category: 'Analytics, Advisory & Compliance',
    description: 'Portfolio analytics, advisory note management, and legal compliance tracking',
    permissions: [
      { key: 'add_advisory_notes', label: 'Add Advisory Notes', description: 'Create and manage portfolio advisory notes, risk assessments, and guidance records' },
      { key: 'manage_legal_records', label: 'Manage Legal Records', description: 'Manage legal compliance records, collateral documentation, and legal action logs' },
    ],
  },
];
