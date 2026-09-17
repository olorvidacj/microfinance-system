import React, { useMemo, useState } from 'react';
import { UserPlus, Pencil, Trash2, Power, KeyRound, Eye, Users, UserCheck, UserX, Clock } from 'lucide-react';
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

  const inputCls = "w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition";
  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <div>
      <Breadcrumbs items={[{ label: 'User Management' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage system users, roles, and account access.</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition shadow-md">
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Users" value={users.length} icon={Users} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Active Accounts" value={countBy((u) => u.status === 'Active')} icon={UserCheck} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Inactive / Suspended" value={countBy((u) => u.status === 'Inactive' || u.status === 'Suspended')} icon={UserX} iconColor="text-red-500" iconBg="bg-red-50" />
        <StatCard title="Pending Approval" value={countBy((u) => u.status === 'Pending')} icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email..." className="flex-1" />
          <FilterSelect value={roleFilter} onChange={setRoleFilter} options={ROLES.map((r) => ({ value: r, label: r }))} placeholder="All Roles" className="w-full md:w-48" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Status" className="w-full md:w-44" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            {
              key: 'user', header: 'User',
              render: (u) => (
                <div className="flex items-center gap-3">
                  <img src={u.avatar} alt={u.fullName} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                  <div>
                    <p className="font-medium text-slate-800">{u.fullName}</p>
                    <p className="text-[11px] text-slate-400">{u.id}</p>
                  </div>
                </div>
              ),
            },
            { key: 'email', header: 'Email', render: (u) => <span className="text-xs text-slate-500">{u.email}</span> },
            { key: 'phone', header: 'Phone', render: (u) => <span className="text-xs text-slate-500 whitespace-nowrap">{u.phone}</span> },
            { key: 'role', header: 'Role', render: (u) => <Badge variant="info">{u.role}</Badge> },
            { key: 'status', header: 'Account Status', render: (u) => <Badge dot>{u.status}</Badge> },
            { key: 'branch', header: 'Branch', render: (u) => <span className="text-xs text-slate-500">{u.branch}</span> },
            { key: 'dateRegistered', header: 'Date Registered', render: (u) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(u.dateRegistered)}</span> },
            {
              key: 'actions', header: 'Actions',
              render: (u) => (
                <div className="flex items-center gap-1">
                  <button onClick={() => setViewUser(u)} title="View" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => openEdit(u)} title="Edit" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => toggleStatus(u)} title={u.status === 'Active' ? 'Deactivate' : 'Activate'} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition"><Power className="w-4 h-4" /></button>
                  <button onClick={() => setResetTarget(u)} title="Reset Password" className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition"><KeyRound className="w-4 h-4" /></button>
                  <button onClick={() => setDeactivateTarget(u)} title="Suspend" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><UserX className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteTarget(u)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
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
        title={editUser ? 'Edit User' : 'Add New User'}
        subtitle={editUser ? `Editing ${editUser.fullName}` : 'Create a new system user account'}
        maxWidth="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Full Name</label>
            <input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Juan Dela Cruz" />
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@hoscomo.coop" />
          </div>
          <div>
            <label className={labelCls}>Phone Number</label>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+63 900 000 0000" />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Branch Assignment</label>
            <select className={inputCls} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              {['Tacloban Main', 'Palo Branch', 'Dulag Branch', 'All Branches'].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {!editUser && (
            <div className="md:col-span-2">
              <label className={labelCls}>Temporary Password</label>
              <input type="password" className={inputCls} defaultValue="" placeholder="Leave blank to auto-generate" />
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
            Cancel
          </button>
          <button onClick={saveUser} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition">
            {editUser ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </Modal>

      {/* View User Modal */}
      <Modal isOpen={!!viewUser} onClose={() => setViewUser(null)} title="User Details" subtitle="Full account information" maxWidth="lg">
        {viewUser && (
          <div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-5">
              <img src={viewUser.avatar} alt={viewUser.fullName} className="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
              <div>
                <h4 className="font-bold text-slate-900 text-lg">{viewUser.fullName}</h4>
                <p className="text-sm text-slate-500">{viewUser.id} · {viewUser.email}</p>
                <div className="mt-1.5 flex gap-2">
                  <Badge variant="info">{viewUser.role}</Badge>
                  <Badge dot>{viewUser.status}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-white border border-slate-100">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Phone Number</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{viewUser.phone}</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-100">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Branch</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{viewUser.branch}</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-100">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Date Registered</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{formatDate(viewUser.dateRegistered)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-100">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Last Login</p>
                <p className="mt-1 text-sm font-medium text-slate-800">2025-09-15 08:12</p>
              </div>
            </div>
            <div className="mt-5 p-4 rounded-xl bg-amber-50/70 border border-amber-100">
              <p className="text-sm font-medium text-amber-800">Security Notice</p>
              <p className="text-xs text-amber-700 mt-1">This user has {viewUser.status === 'Active' ? 'active' : viewUser.status === 'Suspended' ? 'a suspended' : 'a ' + viewUser.status.toLowerCase()} account.{' '}
                {viewUser.status === 'Active' ? 'No access flags detected.' : 'Review the account history before taking action.'}</p>
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
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};