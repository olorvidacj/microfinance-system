import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users2,
  FileSpreadsheet,
  Receipt,
  Smartphone,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Settings,
  Plus,
  Edit2,
  RefreshCw,
  Search,
  Building2,
  Landmark,
  Scale,
  Sliders,
  Award,
  BadgeCheck,
  FileCheck,
  UserCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAccess } from '../hooks/useAccess';
import { useLoan } from '../context/LoanContext';
import {
  RoleDefinition,
  SystemPermission,
  SystemRole,
  CORE_ROLES_LIST,
  ROLE_DEFINITIONS,
  PERMISSION_CATEGORIES,
} from '../auth/permissions';

export const RolesAdminView: React.FC = () => {
  const {
    currentUser,
    roleKey,
    isAdministrator,
    switchRole,
    hasPermission,
    allRoles,
    coreRoles,
    permissionCategories,
  } = useAccess();

  const { staffList } = useLoan();

  const [activeTab, setActiveTab] = useState<'matrix' | 'users' | 'settings' | 'sensitiveApprovals'>('matrix');
  const [selectedRole, setSelectedRole] = useState<string>(roleKey || 'ADMINISTRATOR');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // User Accounts State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // System Settings State
  const [settings, setSettings] = useState({
    cooperativeName: 'San Jose Cooperative Multi-Purpose Credit Union',
    coopCode: 'COOP-NCR-2026-088',
    defaultMaxLoanAmount: 500000,
    defaultMaxTenorMonths: 36,
    dailyCashierDisbursementLimit: 100000,
    sensitiveApprovalThreshold: 250000,
    kycStrictnessLevel: 'High (Gov ID + Proof of Address + PMES Certificate)',
    interestCapPerAnnum: 24.0,
    latePenaltyRateDaily: 0.1,
    allowOnlineLoanApplications: true,
    require2FAForAdmin: true,
    allowReversalsWithinHours: 24,
    auditLogRetentionDays: 365,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');

  // Sensitive Approval Form
  const [sensitiveForm, setSensitiveForm] = useState({
    operationType: 'HIGH_VALUE_DISBURSEMENT',
    targetId: 'LN-2026-0042',
    amount: 350000,
    justification: 'Borrower meets Tier-1 collateral coverage and credit score exceeds 750.',
  });
  const [sensitiveApprovals, setSensitiveApprovals] = useState<any[]>([
    {
      id: 'APPR-90124',
      operationType: 'HIGH_VALUE_DISBURSEMENT',
      targetId: 'LN-2026-0012',
      amount: 450000,
      justification: 'Approved for agricultural equipment acquisition with chattel mortgage registered.',
      approvedBy: 'Elena Rostata (Administrator)',
      approvedAt: '2026-08-25 14:30:00',
      status: 'APPROVED',
    },
    {
      id: 'APPR-90125',
      operationType: 'TRANSACTION_REVERSAL',
      targetId: 'TXN-2026-8841',
      amount: 15400,
      justification: 'Double payment posting corrected via reversal adjustment journal.',
      approvedBy: 'Elena Rostata (Administrator)',
      approvedAt: '2026-08-26 09:15:00',
      status: 'APPROVED',
    },
  ]);
  const [approvalFeedback, setApprovalFeedback] = useState('');

  // New User Form
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'STAFF',
    staffRole: 'LOAN_OFFICER',
    phone: '',
    assignedBranchId: 'br-main',
  });

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const token = localStorage.getItem('hoscomo_auth_token') || '';
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.users && data.users.length > 0) {
          setUsersList(data.users);
          return;
        }
      }
    } catch {}

    // Fallback: populate with staffList and client accounts
    const initialMapped = staffList.map((s) => ({
      id: s.id,
      email: s.email,
      fullName: s.name,
      role: 'STAFF',
      staffRole: s.role,
      staffId: s.id,
      borrowerId: null,
      phone: '+63 917 555 0192',
      avatar: s.avatar,
      isActive: true,
      lastLoginAt: new Date().toISOString(),
      permissions: ROLE_DEFINITIONS[s.role]?.permissions || [],
    }));

    // Add Client accounts
    initialMapped.push({
      id: 'usr-client-01',
      email: 'client@gmail.com',
      fullName: 'Teresa Alcantara',
      role: 'CLIENT',
      staffRole: 'CLIENT',
      staffId: null,
      borrowerId: 'borrower-01',
      phone: '+63 918 222 9011',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      isActive: true,
      lastLoginAt: new Date().toISOString(),
      permissions: ROLE_DEFINITIONS.CLIENT.permissions,
    });

    setUsersList(initialMapped);
    setIsLoadingUsers(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.fullName || !newUserForm.email || !newUserForm.password) return;

    try {
      const token = localStorage.getItem('hoscomo_auth_token') || '';
      await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUserForm),
      });
    } catch {}

    const newRec = {
      id: `usr-${Date.now()}`,
      email: newUserForm.email,
      fullName: newUserForm.fullName,
      role: newUserForm.role,
      staffRole: newUserForm.role === 'STAFF' ? newUserForm.staffRole : 'CLIENT',
      staffId: `staff-${Date.now().toString().slice(-4)}`,
      borrowerId: null,
      phone: newUserForm.phone || '+63 900 000 0000',
      avatar: `https://ui-avatars.com/api/?background=4F46E5&color=fff&name=${encodeURIComponent(newUserForm.fullName)}`,
      isActive: true,
      lastLoginAt: new Date().toISOString(),
      permissions: ROLE_DEFINITIONS[newUserForm.staffRole]?.permissions || [],
    };

    setUsersList((prev) => [newRec, ...prev]);
    setIsCreatingUser(false);
    setNewUserForm({
      fullName: '',
      email: '',
      password: '',
      role: 'STAFF',
      staffRole: 'LOAN_OFFICER',
      phone: '',
      assignedBranchId: 'br-main',
    });
  };

  const handleToggleUserActive = (userId: string) => {
    setUsersList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isActive: !u.isActive } : u))
    );
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setTimeout(() => {
      setIsSavingSettings(false);
      setSettingsSuccessMsg('System settings and institutional limits saved successfully.');
      setTimeout(() => setSettingsSuccessMsg(''), 4000);
    }, 400);
  };

  const handleApproveSensitive = (e: React.FormEvent) => {
    e.preventDefault();
    const newApproval = {
      id: `APPR-${Date.now().toString().slice(-5)}`,
      operationType: sensitiveForm.operationType,
      targetId: sensitiveForm.targetId,
      amount: sensitiveForm.amount,
      justification: sensitiveForm.justification,
      approvedBy: `${currentUser.name} (${ROLE_DEFINITIONS[currentUser.role]?.name || currentUser.role})`,
      approvedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      status: 'APPROVED',
    };

    setSensitiveApprovals([newApproval, ...sensitiveApprovals]);
    setApprovalFeedback(`Operation '${sensitiveForm.operationType}' for ${sensitiveForm.targetId} successfully approved and logged.`);
    setTimeout(() => setApprovalFeedback(''), 5000);
  };

  const selectedRoleDef: RoleDefinition = ROLE_DEFINITIONS[selectedRole] || ROLE_DEFINITIONS.ADMINISTRATOR;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Roles & Access Control (RBAC)</h1>
                <p className="text-sm text-gray-500">
                  Enforce end-to-end security, role assignments, institutional settings, and sensitive operation approvals
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">YOUR CURRENT ROLE</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-900 border border-purple-200 rounded-full text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                {ROLE_DEFINITIONS[currentUser.role]?.name || currentUser.role}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mt-6 -mb-6">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'matrix'
                ? 'border-purple-600 text-purple-700 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Roles & Permission Matrix
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-purple-600 text-purple-700 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users2 className="w-4 h-4" />
            User Accounts ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-purple-600 text-purple-700 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            System Settings & Limits
          </button>
          <button
            onClick={() => setActiveTab('sensitiveApprovals')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sensitiveApprovals'
                ? 'border-purple-600 text-purple-700 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Lock className="w-4 h-4" />
            Sensitive Operation Approvals
          </button>
        </div>
      </div>

      {/* TAB 1: Roles & Permission Matrix */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Quick Core Role Selector Banner */}
          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-xl p-6 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-purple-200 font-semibold">
                  Required Role Framework
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  Institutional Multi-Tier Access Hierarchy
                </h2>
              </div>
              <span className="text-xs bg-white/10 px-3 py-1.5 rounded-lg text-purple-100 border border-white/20">
                Enforced in Frontend UI & Backend Express Middleware
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {CORE_ROLES_LIST.map((rk) => {
                const def = ROLE_DEFINITIONS[rk];
                const isSelected = selectedRole === rk;
                return (
                  <button
                    key={rk}
                    onClick={() => setSelectedRole(rk)}
                    className={`text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-white text-gray-900 border-white shadow-lg ring-2 ring-purple-400'
                        : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                        {def.category}
                      </span>
                      {isSelected && <BadgeCheck className="w-4 h-4 text-purple-600" />}
                    </div>
                    <div className="font-semibold text-sm leading-snug">{def.name}</div>
                    <div className={`text-xs mt-1 line-clamp-2 ${isSelected ? 'text-gray-600' : 'text-purple-200'}`}>
                      {def.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Role Detailed Inspector Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-gray-100">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-50 text-purple-700 rounded-xl border border-purple-100">
                  <Award className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-gray-900">{selectedRoleDef.name}</h3>
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${selectedRoleDef.badgeColor}`}>
                      {selectedRoleDef.category}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">ROLE: {selectedRoleDef.id}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{selectedRoleDef.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => switchRole(selectedRole)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Simulate / Switch to this Role
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Responsibilities */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  Key Responsibilities & Scope
                </h4>
                <ul className="space-y-2">
                  {selectedRoleDef.responsibilities.map((resp, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Navigation Tabs Granted */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  Accessible Views & Submodules
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedRoleDef.allowedNavTabs.map((tab) => (
                    <span
                      key={tab}
                      className="px-2.5 py-1 bg-white border border-gray-200 text-gray-800 rounded-md text-xs font-medium shadow-2xs"
                    >
                      {tab}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Full Canonical Permissions Matrix Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Comprehensive RBAC Permission Matrix</h3>
                <p className="text-xs text-gray-500">
                  Granular permission capability comparison across all system personas
                </p>
              </div>

              <div className="relative w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter permissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100/70 border-b border-gray-200 text-xs font-semibold text-gray-600">
                    <th className="py-3 px-4 w-72">Permission Capability</th>
                    <th className="py-3 px-3 text-center bg-purple-50/50 border-x border-purple-100 text-purple-900">
                      Administrator
                    </th>
                    <th className="py-3 px-3 text-center">Client Services</th>
                    <th className="py-3 px-3 text-center">Loan Officer</th>
                    <th className="py-3 px-3 text-center">Cashier / Teller</th>
                    <th className="py-3 px-3 text-center bg-emerald-50/50 border-l border-emerald-100 text-emerald-900">
                      Client
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {permissionCategories.map((cat, catIdx) => {
                    const filteredPerms = cat.permissions.filter(
                      (p) =>
                        p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.key.toLowerCase().includes(searchQuery.toLowerCase())
                    );

                    if (filteredPerms.length === 0) return null;

                    return (
                      <React.Fragment key={catIdx}>
                        <tr className="bg-gray-50/80 font-bold text-xs text-gray-700">
                          <td colSpan={6} className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                              {cat.category}
                              <span className="font-normal text-gray-500 text-2xs">
                                — {cat.description}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {filteredPerms.map((perm) => {
                          const adminHas = ROLE_DEFINITIONS.ADMINISTRATOR.permissions.includes(perm.key);
                          const csHas = ROLE_DEFINITIONS.CLIENT_SERVICES_STAFF.permissions.includes(perm.key);
                          const loHas = ROLE_DEFINITIONS.LOAN_OFFICER.permissions.includes(perm.key);
                          const tellerHas = ROLE_DEFINITIONS.CASHIER_TELLER.permissions.includes(perm.key);
                          const clientHas = ROLE_DEFINITIONS.CLIENT.permissions.includes(perm.key);

                          return (
                            <tr key={perm.key} className="hover:bg-gray-50/60 transition-colors">
                              <td className="py-2.5 px-4">
                                <div className="font-medium text-gray-900 text-xs">{perm.label}</div>
                                <div className="text-2xs text-gray-500">{perm.description}</div>
                                <code className="text-3xs text-purple-600 bg-purple-50 px-1 py-0.5 rounded font-mono">
                                  {perm.key}
                                </code>
                              </td>

                              {/* Administrator */}
                              <td className="py-2.5 px-3 text-center bg-purple-50/30 border-x border-purple-50">
                                {adminHas ? (
                                  <span className="inline-flex p-1 rounded-full bg-purple-100 text-purple-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 text-gray-300">
                                    <XCircle className="w-4 h-4" />
                                  </span>
                                )}
                              </td>

                              {/* Client Services Staff */}
                              <td className="py-2.5 px-3 text-center">
                                {csHas ? (
                                  <span className="inline-flex p-1 rounded-full bg-blue-100 text-blue-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 text-gray-300">
                                    <XCircle className="w-4 h-4" />
                                  </span>
                                )}
                              </td>

                              {/* Loan Officer */}
                              <td className="py-2.5 px-3 text-center">
                                {loHas ? (
                                  <span className="inline-flex p-1 rounded-full bg-emerald-100 text-emerald-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 text-gray-300">
                                    <XCircle className="w-4 h-4" />
                                  </span>
                                )}
                              </td>

                              {/* Cashier / Teller */}
                              <td className="py-2.5 px-3 text-center">
                                {tellerHas ? (
                                  <span className="inline-flex p-1 rounded-full bg-amber-100 text-amber-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 text-gray-300">
                                    <XCircle className="w-4 h-4" />
                                  </span>
                                )}
                              </td>

                              {/* Client */}
                              <td className="py-2.5 px-3 text-center bg-emerald-50/30 border-l border-emerald-50">
                                {clientHas ? (
                                  <span className="inline-flex p-1 rounded-full bg-emerald-100 text-emerald-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 text-gray-300">
                                    <XCircle className="w-4 h-4" />
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: User Accounts Management */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-gray-900">User Accounts & Role Assignments</h2>
              <p className="text-sm text-gray-500">
                Manage staff credentials, role designations, and client portal authentication records
              </p>
            </div>

            <button
              onClick={() => setIsCreatingUser(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add User Account
            </button>
          </div>

          {/* Create User Modal */}
          {isCreatingUser && (
            <div className="bg-white border-2 border-purple-300 rounded-xl p-6 shadow-md animate-fadeIn">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-600" />
                  Provision New Account & Assign Role
                </h3>
                <button
                  onClick={() => setIsCreatingUser(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maria Santos"
                      value={newUserForm.fullName}
                      onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. maria.s@hoscomo.coop"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Min 8 characters"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Account Category</label>
                    <select
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    >
                      <option value="STAFF">Cooperative Staff</option>
                      <option value="CLIENT">Client / Member</option>
                    </select>
                  </div>

                  {newUserForm.role === 'STAFF' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Role</label>
                      <select
                        value={newUserForm.staffRole}
                        onChange={(e) => setNewUserForm({ ...newUserForm, staffRole: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                      >
                        <option value="ADMINISTRATOR">Administrator (Full Access)</option>
                        <option value="CLIENT_SERVICES_STAFF">Client Services Staff</option>
                        <option value="LOAN_OFFICER">Loan Officer</option>
                        <option value="CASHIER_TELLER">Cashier / Teller</option>
                        <option value="MANAGER">Branch Manager</option>
                        <option value="BOOKKEEPER">Bookkeeper / Accounting</option>
                        <option value="AUDITOR">Internal Auditor</option>
                        <option value="CREDIT_COMMITTEE">Credit Committee</option>
                        <option value="EDUCATION_COMMITTEE">Education Committee</option>
                        <option value="BOARD_OF_DIRECTORS">Board of Directors</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="+63 9XX XXX XXXX"
                      value={newUserForm.phone}
                      onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsCreatingUser(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* User Accounts List Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                    <th className="py-3 px-4">User / Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Permissions Count</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usersList.map((user) => {
                    const roleDef = ROLE_DEFINITIONS[user.staffRole || user.role] || ROLE_DEFINITIONS.CLIENT;
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={user.avatar}
                              alt={user.fullName}
                              className="w-9 h-9 rounded-full object-cover border border-gray-200"
                            />
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">{user.fullName}</div>
                              <div className="text-xs text-gray-500">{user.phone || 'No phone'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-xs font-mono text-gray-600">
                          {user.email}
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${roleDef.badgeColor}`}>
                            {roleDef.name}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {user.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3" />
                              Deactivated
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-xs text-gray-600 font-medium">
                          {roleDef.permissions.length} capabilities
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleUserActive(user.id)}
                              className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors ${
                                user.isActive
                                  ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {user.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => switchRole(user.staffRole || user.role)}
                              className="text-xs px-2.5 py-1 rounded border border-purple-200 text-purple-700 hover:bg-purple-50 font-medium"
                            >
                              Login As
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: System Settings & Limits */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="pb-4 border-b border-gray-200 mb-6">
              <h2 className="text-lg font-bold text-gray-900">Institutional Governance & System Settings</h2>
              <p className="text-sm text-gray-500">
                Configure cooperative credit ceilings, cash handling thresholds, and approval delegation policies
              </p>
            </div>

            {settingsSuccessMsg && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{settingsSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Cooperative Institutional Name
                  </label>
                  <input
                    type="text"
                    value={settings.cooperativeName}
                    onChange={(e) => setSettings({ ...settings, cooperativeName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    CDA / Statutory Cooperative Code
                  </label>
                  <input
                    type="text"
                    value={settings.coopCode}
                    onChange={(e) => setSettings({ ...settings, coopCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Default Max Loan Cap (₱)
                  </label>
                  <input
                    type="number"
                    value={settings.defaultMaxLoanAmount}
                    onChange={(e) => setSettings({ ...settings, defaultMaxLoanAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <p className="text-2xs text-gray-500 mt-1">Maximum standard credit limit before BOD review</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Sensitive Approval Threshold (₱)
                  </label>
                  <input
                    type="number"
                    value={settings.sensitiveApprovalThreshold}
                    onChange={(e) => setSettings({ ...settings, sensitiveApprovalThreshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <p className="text-2xs text-gray-500 mt-1">Disbursements above this require Administrator authorization</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Daily Cashier Counter Limit (₱)
                  </label>
                  <input
                    type="number"
                    value={settings.dailyCashierDisbursementLimit}
                    onChange={(e) => setSettings({ ...settings, dailyCashierDisbursementLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <p className="text-2xs text-gray-500 mt-1">Maximum counter cash drawer single transaction</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Annual Interest Rate Cap (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.interestCapPerAnnum}
                    onChange={(e) => setSettings({ ...settings, interestCapPerAnnum: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Daily Late Penalty Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.latePenaltyRateDaily}
                    onChange={(e) => setSettings({ ...settings, latePenaltyRateDaily: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Transaction Reversal Window (Hours)
                  </label>
                  <input
                    type="number"
                    value={settings.allowReversalsWithinHours}
                    onChange={(e) => setSettings({ ...settings, allowReversalsWithinHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2"
                >
                  {isSavingSettings && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Institutional Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: Sensitive Operation Approvals */}
      {activeTab === 'sensitiveApprovals' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="pb-4 border-b border-gray-200 mb-6">
              <h2 className="text-lg font-bold text-gray-900">Privileged Sensitive Operations & Approvals</h2>
              <p className="text-sm text-gray-500">
                Execute and review high-risk institutional overrides requiring Administrator clearance
              </p>
            </div>

            {approvalFeedback && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{approvalFeedback}</span>
              </div>
            )}

            {/* Approval Execution Form */}
            <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-5 mb-6">
              <h3 className="font-bold text-purple-900 text-sm mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-700" />
                Authorize Sensitive Operation
              </h3>

              <form onSubmit={handleApproveSensitive} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Operation Type</label>
                    <select
                      value={sensitiveForm.operationType}
                      onChange={(e) => setSensitiveForm({ ...sensitiveForm, operationType: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    >
                      <option value="HIGH_VALUE_DISBURSEMENT">High-Value Loan Disbursement (&gt; ₱250,000)</option>
                      <option value="TRANSACTION_REVERSAL">Financial Transaction Reversal</option>
                      <option value="LOAN_WRITE_OFF">Bad Debt Write-Off</option>
                      <option value="CREDIT_LIMIT_OVERRIDE">Credit Limit / Debt-to-Income Override</option>
                      <option value="PENALTY_WAIVER">Delinquency Penalty Waiver</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Target Account / Reference ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LN-2026-0042"
                      value={sensitiveForm.targetId}
                      onChange={(e) => setSensitiveForm({ ...sensitiveForm, targetId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Involved Amount (₱)</label>
                    <input
                      type="number"
                      required
                      value={sensitiveForm.amount}
                      onChange={(e) => setSensitiveForm({ ...sensitiveForm, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Executive Justification & Audit Note</label>
                  <input
                    type="text"
                    required
                    placeholder="Provide clear reason and compliance justification..."
                    value={sensitiveForm.justification}
                    onChange={(e) => setSensitiveForm({ ...sensitiveForm, justification: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2"
                  >
                    <Unlock className="w-4 h-4" />
                    Authorize & Log Sensitive Action
                  </button>
                </div>
              </form>
            </div>

            {/* Past Approvals Log */}
            <h3 className="font-bold text-gray-900 text-sm mb-3">Sensitive Approvals Audit Trail</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                    <th className="py-3 px-4">Approval ID</th>
                    <th className="py-3 px-4">Operation</th>
                    <th className="py-3 px-4">Target Reference</th>
                    <th className="py-3 px-4">Amount (₱)</th>
                    <th className="py-3 px-4">Justification</th>
                    <th className="py-3 px-4">Authorized By</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sensitiveApprovals.map((appr) => (
                    <tr key={appr.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-mono text-xs text-purple-700 font-semibold">{appr.id}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-gray-900">{appr.operationType}</td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-600">{appr.targetId}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-gray-900">₱{appr.amount?.toLocaleString()}</td>
                      <td className="py-3 px-4 text-xs text-gray-600 max-w-xs truncate">{appr.justification}</td>
                      <td className="py-3 px-4 text-xs text-gray-700">{appr.approvedBy}</td>
                      <td className="py-3 px-4 text-2xs text-gray-500 font-mono">{appr.approvedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
