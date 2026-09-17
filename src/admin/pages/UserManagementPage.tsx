import React, { useMemo, useState } from 'react';
import { UserPlus, Pencil, Trash2, Power, KeyRound, Eye, Users, UserCheck, UserX, Clock, ShieldCheck, Mail, Phone, Building } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { MOCK_USERS, AdminUser, formatDate } from '../data/mockData';

const ROLES = ['Administrator', 'Manager', 'Loan Officer', 'Teller', 'Client Services Staff', 'Bookkeeper', 'Auditor'];
const STATUSES = ['Active', 'Inactive', 'Pending', 'Suspended'];

interface UserFormState {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  branch: string;
}

const EMPTY_FORM: UserFormState = { fullName: '', email: '', phone: '', role: 'Teller', branch: 'Tacloban Main' };

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>(MOCK_USERS);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [viewUser, setViewUser] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = !roleFilter || u.role === roleFilter;
      const matchesStatus = !statusFilter || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const openAdd = () => { setEditUser(null); setForm(EMPTY_FORM); setShowAddModal(true); };
  const openEdit = (u: AdminUser) => { setEditUser(u); setForm({ fullName: u.fullName, email: u.email, phone: u.phone, role: u.role, branch: u.branch }); setShowAddModal(true); };

  const saveUser = () => {
    if (editUser) {
      setUsers(users.map((u) => u.id === editUser.id ? { ...u, ...form, role: form.role as AdminUser['role'] } : u));
      showToast(`User "${form.fullName}" updated successfully.`);
    } else {
      const newUser: AdminUser = {
        id: `USR-${String(users.length + 1).padStart(3, '0')}`,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        role: form.role as AdminUser['role'],
        status: 'Pending',
        dateRegistered: new Date().toISOString().slice(0, 10),
        avatar: `https://i.pravatar.cc/150?u=usr${users.length + 1}`,
        branch: form.branch,
      };
      setUsers([newUser, ...users]);
      showToast(`User "${form.fullName}" created successfully.`);
    }
    setShowAddModal(false);
  };

  const toggleStatus = (u: AdminUser) => {
    setUsers(users.map((x) => x.id === u.id ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x));
    showToast(`Account for "${u.fullName}" ${u.status === 'Active' ? 'deactivated' : 'activated'}.`);
  };

  const deleteUser = () => {
    if (deleteTarget) {
      setUsers(users.filter((u) => u.id !== deleteTarget.id));
      showToast(`User "${deleteTarget.fullName}" deleted.`);
    }
  };

  const handleDeactivate = () => {
    if (deactivateTarget) {
      setUsers(users.map((u) => u.id === deactivateTarget.id ? { ...u, status: 'Suspended' } : u));
      showToast(`Account "${deactivateTarget.fullName}" suspended.`);
    }
  };

  const countBy = (predicate: (u: AdminUser) => boolean) => users.filter(predicate).length;

  const inputCls = "w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-sm";
  const labelCls = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'User Management' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Staff & RBAC Administration</h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Cooperative Staff
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">Configure role-based access permissions, branches, and security status for HOSCOMO personnel.</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#091527] hover:bg-[#132c52] text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-md shadow-slate-900/10 shrink-0 border border-slate-800"
        >
          <UserPlus className="w-4 h-4 text-amber-400" />
          <span>Add New User</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Staff Accounts" value={users.length} icon={Users} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Active Accounts" value={countBy((u) => u.status === 'Active')} icon={UserCheck} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Suspended / Inactive" value={countBy((u) => u.status === 'Inactive' || u.status === 'Suspended')} icon={UserX} iconColor="text-rose-500" iconBg="bg-rose-50" />
        <StatCard title="Pending Approval" value={countBy((u) => u.status === 'Pending')} icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50" accentBorder />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, or employee ID..." className="flex-1" />
          <FilterSelect value={roleFilter} onChange={setRoleFilter} options={ROLES.map((r) => ({ value: r, label: r }))} placeholder="All Staff Roles" className="w-full md:w-52" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Account Statuses" className="w-full md:w-48" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            {
              key: 'user',
              header: 'Staff Member',
              render: (u) => (
                <div className="flex items-center gap-3">
                  <img src={u.avatar} alt={u.fullName} className="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{u.fullName}</p>
                    <p className="text-[11px] font-mono text-slate-400">{u.id}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'email',
              header: 'Contact Information',
              render: (u) => (
                <div>
                  <p className="text-xs text-slate-700 font-medium">{u.email}</p>
                  <p className="text-[11px] text-slate-400">{u.phone}</p>
                </div>
              ),
            },
            {
              key: 'role',
              header: 'Assigned Role',
              render: (u) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                  {u.role}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (u) => <Badge dot>{u.status}</Badge>,
            },
            {
              key: 'branch',
              header: 'Branch Office',
              render: (u) => (
                <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  {u.branch}
                </span>
              ),
            },
            {
              key: 'dateRegistered',
              header: 'Registration',
              render: (u) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(u.dateRegistered)}</span>,
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (u) => (
                <div className="flex items-center gap-1">
                  <button onClick={() => setViewUser(u)} title="View User Dossier" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(u)} title="Edit Account" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-700 transition">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleStatus(u)} title={u.status === 'Active' ? 'Deactivate' : 'Activate'} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition">
                    <Power className="w-4 h-4" />
                  </button>
                  <button onClick={() => setResetTarget(u)} title="Reset Password" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition">
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeactivateTarget(u)} title="Suspend User" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition">
                    <UserX className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(u)} title="Delete User" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-700 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editUser ? 'Edit Staff Account' : 'Register New Personnel'}
        subtitle={editUser ? `Modifying settings for ${editUser.fullName}` : 'Provision access credentials and branch assignment'}
        maxWidth="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Full Legal Name</label>
            <input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Maria Clara Santos" />
          </div>
          <div>
            <label className={labelCls}>Work Email Address</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@hoscomo.coop" />
          </div>
          <div>
            <label className={labelCls}>Mobile Contact Number</label>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+63 917 123 4567" />
          </div>
          <div>
            <label className={labelCls}>System RBAC Role</label>
            <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Branch Assignment</label>
            <select className={inputCls} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              {['Tacloban Main', 'Palo Branch', 'Dulag Branch', 'Ormoc Extension', 'All Branches'].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {!editUser && (
            <div className="md:col-span-2">
              <label className={labelCls}>Temporary Password (Optional)</label>
              <input type="password" className={inputCls} defaultValue="" placeholder="Leave blank to auto-generate one-time code" />
            </div>
          )}
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={() => setShowAddModal(false)} className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
            Cancel
          </button>
          <button onClick={saveUser} className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#091527] hover:bg-[#132c52] rounded-xl transition shadow-md shadow-slate-900/10">
            {editUser ? 'Save Changes' : 'Create User Account'}
          </button>
        </div>
      </Modal>

      {/* View User Modal */}
      <Modal isOpen={!!viewUser} onClose={() => setViewUser(null)} title="Staff Account Dossier" subtitle="Role-based permissions & audit history" maxWidth="lg">
        {viewUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <img src={viewUser.avatar} alt={viewUser.fullName} className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm" />
              <div>
                <h4 className="font-bold text-slate-900 text-lg">{viewUser.fullName}</h4>
                <p className="text-xs text-slate-500">{viewUser.id} · {viewUser.email}</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200/80 text-slate-800">
                    {viewUser.role}
                  </span>
                  <Badge dot>{viewUser.status}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Contact Phone</p>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-800">{viewUser.phone}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Branch Location</p>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-800">{viewUser.branch}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Registration Date</p>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-800">{formatDate(viewUser.dateRegistered)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Last Recorded Login</p>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-800">2025-09-17 08:12 PST</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Security & Authorization Notice</span>
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                This account operates under HOSCOMO Cooperative Security Guidelines. Any privilege escalation or role alteration is logged in the permanent audit trail.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteUser}
        title="Delete User"
        message={`Are you sure you want to permanently delete "${deleteTarget?.fullName}"? This action cannot be undone.`}
        confirmLabel="Delete User"
      />
      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Suspend Account"
        message={`Suspend the account of "${deactivateTarget?.fullName}"? They will be unable to sign in until reactivated.`}
        confirmLabel="Suspend Account"
        variant="warning"
      />
      <ConfirmDialog
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={() => { setResetTarget(null); showToast(`Password reset email sent to "${resetTarget?.email}".`); }}
        title="Reset Password"
        message={`Send a password reset link to "${resetTarget?.email}" for "${resetTarget?.fullName}"?`}
        confirmLabel="Send Reset Link"
        variant="info"
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#091527] border border-amber-500/40 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {toast}
        </div>
      )}
    </div>
  );
};