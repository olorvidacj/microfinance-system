import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  UserCheck,
  UserX,
  Download,
  Building2,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  Users2,
  Filter,
  Mail,
  KeyRound,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { useAccess } from '../hooks/useAccess';
import {
  SystemRole,
  ALL_ROLES_LIST,
  ROLE_DEFINITIONS,
  getRolePermissions,
  normalizeRole,
} from '../auth/permissions';
import { StaffProfilePage, StaffRecord } from './StaffProfilePage';

const STATUS_LABELS: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Deactivated: 'bg-rose-100 text-rose-700',
};

export const StaffManagementView: React.FC = () => {
  const { staffList, branches, logAudit } = useLoan();
  const { canAccessTab } = useAccess();

  const [records, setRecords] = useState<StaffRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStaff, setSelectedStaff] = useState<StaffRecord | null>(null);

  // Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffRecord | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    title: '',
    role: 'LOAN_OFFICER' as SystemRole,
    assignedBranchId: 'br-main',
    committee: '',
    isActive: true,
  });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('hoscomo_auth_token') || '';
      const res = await fetch('/api/admin/staff', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.staff && data.staff.length > 0) {
          setRecords(data.staff.map(mapApiToRecord));
          setIsLoading(false);
          return;
        }
      }
    } catch {}

    // Fallback: seed locally from context staffList
    setRecords(
      staffList.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
        title: s.title,
        assignedBranchId: s.assignedBranchId,
        avatar: s.avatar,
        committee: s.committee || null,
        isActive: true,
        hasAccount: true,
        permissions: getRolePermissions(normalizeRole(s.role)),
      }))
    );
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapApiToRecord = (r: any): StaffRecord => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role || 'STAFF',
    title: r.title || r.displayRole || '',
    assignedBranchId: r.assignedBranchId,
    avatar: r.avatar || '',
    committee: r.committee || null,
    isActive: r.isActive ?? true,
    hasAccount: r.hasAccount ?? true,
    permissions: r.permissions || getRolePermissions(normalizeRole(r.role)),
  });

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (roleFilter !== 'all' && normalizeRole(r.role) !== roleFilter) return false;
      if (branchFilter !== 'all' && r.assignedBranchId !== branchFilter) return false;
      if (statusFilter === 'active' && !r.isActive) return false;
      if (statusFilter === 'deactivated' && r.isActive) return false;
      if (q) {
        const haystack = `${r.name} ${r.email} ${r.title} ${r.role}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [records, searchQuery, roleFilter, branchFilter, statusFilter]);

  const activeCount = records.filter((r) => r.isActive).length;
  const branchCounts = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      map[r.assignedBranchId] = (map[r.assignedBranchId] || 0) + 1;
    });
    return map;
  }, [records]);

  const openAddModal = () => {
    setEditingStaff(null);
    setForm({
      name: '',
      email: '',
      title: '',
      role: 'LOAN_OFFICER',
      assignedBranchId: 'br-main',
      committee: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (staff: StaffRecord) => {
    setEditingStaff(staff);
    setForm({
      name: staff.name,
      email: staff.email,
      title: staff.title,
      role: normalizeRole(staff.role) as SystemRole,
      assignedBranchId: staff.assignedBranchId,
      committee: staff.committee || '',
      isActive: staff.isActive,
    });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (staff: StaffRecord) => {
    const nextActive = !staff.isActive;
    try {
      const token = localStorage.getItem('hoscomo_auth_token') || '';
      await fetch(`/api/admin/staff/${staff.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: nextActive }),
      });
    } catch {}

    setRecords((prev) => prev.map((r) => (r.id === staff.id ? { ...r, isActive: nextActive } : r)));
    logAudit(
      nextActive ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
      `${nextActive ? 'Activated' : 'Deactivated'} staff account for ${staff.name} (${staff.id})`,
      'SYSTEM',
      { targetType: 'staff', targetId: staff.id }
    );
    setFeedback({
      type: 'success',
      message: `${staff.name} ${nextActive ? 'activated' : 'deactivated'} successfully.`,
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setFeedback({ type: 'error', message: 'Name and email are required.' });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    const normRole = normalizeRole(form.role);
    const finalRecord: StaffRecord = {
      id: editingStaff ? editingStaff.id : `staff-${Date.now().toString().slice(-6)}`,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: normRole,
      title: form.title.trim() || ROLE_DEFINITIONS[normRole]?.name || normRole,
      assignedBranchId: form.assignedBranchId,
      avatar: editingStaff?.avatar || `https://ui-avatars.com/api/?background=4F46E5&color=fff&name=${encodeURIComponent(form.name.trim())}`,
      committee: form.committee || null,
      isActive: form.isActive,
      hasAccount: true,
      permissions: getRolePermissions(normRole),
    };

    try {
      const token = localStorage.getItem('hoscomo_auth_token') || '';
      if (editingStaff) {
        await fetch(`/api/admin/staff/${editingStaff.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: normRole, isActive: form.isActive }),
        });
      } else {
        await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            password: `Welcome@2026`,
            role: 'STAFF',
            staffRole: normRole,
            staffId: finalRecord.id,
            phone: '',
          }),
        });
      }
    } catch {}

    if (editingStaff) {
      setRecords((prev) => prev.map((r) => (r.id === editingStaff.id ? finalRecord : r)));
      setFeedback({ type: 'success', message: `Staff record for ${finalRecord.name} updated.` });
      logAudit(
        'STAFF_UPDATED',
        `Updated staff ${finalRecord.name} (role → ${normRole})`,
        'SYSTEM',
        { targetType: 'staff', targetId: finalRecord.id }
      );
    } else {
      setRecords((prev) => [finalRecord, ...prev]);
      setFeedback({ type: 'success', message: `${finalRecord.name} added to staff roster.` });
      logAudit(
        'STAFF_CREATED',
        `Added new staff member ${finalRecord.name} (role: ${normRole})`,
        'SYSTEM',
        { targetType: 'staff', targetId: finalRecord.id }
      );
    }
    setTimeout(() => setFeedback(null), 4000);
    setIsModalOpen(false);
  };

  const handleExportCSV = () => {
    const header = ['ID', 'Name', 'Email', 'Role', 'Title', 'Branch', 'Status'];
    const rows = filtered.map((r) => [
      r.id,
      r.name,
      r.email,
      normalizeRole(r.role),
      r.title,
      r.assignedBranchId,
      r.isActive ? 'Active' : 'Deactivated',
    ]);
    const csv = [header, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-roster-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formFields: { key: keyof typeof form; label: string }[] = [
    ...(editingStaff
      ? []
      : [
          { key: 'name' as const, label: 'Full Name' },
          { key: 'email' as const, label: 'Email Address' },
        ]),
    { key: 'title' as const, label: 'Job Title' },
  ];

  if (selectedStaff) {
    return (
      <StaffProfilePage
        staff={selectedStaff}
        onBack={() => {
          setSelectedStaff(null);
          fetchStaff();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            HR roster, role assignments, and access control for branch personnel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStaff}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-navy-900 text-white hover:bg-navy-800 transition"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
            <Users2 className="w-3.5 h-3.5 text-gold-600" /> Total Staff
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{records.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Active Accounts
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{activeCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
            <Building2 className="w-3.5 h-3.5 text-gold-600" /> Branches Covered
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{Object.keys(branchCounts).length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-violet-600" /> Roles Available
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{ALL_ROLES_LIST.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, title..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
            >
              <option value="all">All Roles</option>
              {ALL_ROLES_LIST.map((r) => (
                <option key={r} value={r}>
                  {ROLE_DEFINITIONS[r]?.name || r}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 text-left font-semibold">Staff Member</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Branch</th>
                <th className="px-4 py-3 text-left font-semibold">Account</th>
                <th className="px-4 py-3 text-center font-semibold">Permissions</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    {isLoading ? 'Loading staff roster...' : 'No staff records match your filters.'}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const roleDef = ROLE_DEFINITIONS[normalizeRole(r.role)];
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedStaff(r)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                          {r.avatar ? (
                            <img
                              src={r.avatar}
                              alt={r.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                              {r.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {r.name}
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                          </div>
                          <div className="text-xs text-slate-400">{r.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gold-500/10 text-gold-700 border border-gold-400/30">
                        {roleDef?.name || normalizeRole(r.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.assignedBranchId === 'all'
                        ? 'All Branches'
                        : branches.find((b) => b.id === r.assignedBranchId)?.name || r.assignedBranchId || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.hasAccount ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <KeyRound className="w-3.5 h-3.5" /> Login active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                          <Mail className="w-3.5 h-3.5" /> No login
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-semibold text-slate-600">
                        {(r.permissions || []).length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          STATUS_LABELS[r.isActive ? 'Active' : 'Deactivated']
                        }`}
                      >
                        {r.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(r);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-gold-600 hover:bg-gold-500/10 transition"
                          title="Edit staff member"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(r);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                          title={r.isActive ? 'Deactivate account' : 'Activate account'}
                        >
                          {r.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
          <span>
            Showing {filtered.length} of {records.length} staff
          </span>
          {canAccessTab('roles') && (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              Role definitions managed in Roles &amp; Permissions
            </span>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formFields.map((f) => (
                <div key={String(f.key)}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {f.label}
                  </label>
                  <input
                    type="text"
                    value={String(form[f.key])}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    disabled={!!editingStaff && (f.key === 'name' || f.key === 'email')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30 disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder={`Enter ${f.label.toLowerCase()}`}
                  />
                </div>
              ))}

              {!editingStaff && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Role
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as SystemRole }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                    >
                      {ALL_ROLES_LIST.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_DEFINITIONS[r]?.name || r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Branch
                    </label>
                    <select
                      value={form.assignedBranchId}
                      onChange={(e) => setForm((prev) => ({ ...prev, assignedBranchId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                      <option value="all">All Branches (HQ)</option>
                    </select>
                  </div>
                </div>
              )}

              {editingStaff && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Role
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as SystemRole }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                    >
                      {ALL_ROLES_LIST.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_DEFINITIONS[r]?.name || r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Branch
                    </label>
                    <select
                      value={form.assignedBranchId}
                      onChange={(e) => setForm((prev) => ({ ...prev, assignedBranchId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                      <option value="all">All Branches (HQ)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-600 font-medium">Account Status</label>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                    form.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block w-5 h-5 transform bg-white rounded-full shadow transition ${
                      form.isActive ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-navy-900 text-white hover:bg-navy-800 transition"
                >
                  {editingStaff ? 'Save Changes' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};