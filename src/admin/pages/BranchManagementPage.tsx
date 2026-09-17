import React, { useState } from 'react';
import { Building2, Users, Wallet, MapPin, Phone, Pencil, PlusCircle, Eye, CheckCircle2 } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { SearchInput } from '../components/SearchFilter';
import { MOCK_BRANCHES, AdminBranch, formatPHP } from '../data/mockData';

export const BranchManagementPage: React.FC = () => {
  const [branches, setBranches] = useState<AdminBranch[]>(MOCK_BRANCHES);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminBranch | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminBranch | null>(null);
  const [toast, setToast] = useState('');

  const filtered = branches.filter((b) => {
    const q = search.toLowerCase();
    return b.branchName.toLowerCase().includes(q) || b.branchCode.toLowerCase().includes(q) || b.address.toLowerCase().includes(q);
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const totalStaff = branches.reduce((s, b) => s + b.staffCount, 0);
  const totalClients = branches.reduce((s, b) => s + b.totalClients, 0);

  const sampleStaff = [
    { name: 'Roberto Villanueva', role: 'Branch Manager', email: 'roberto.v@hoscomo.coop' },
    { name: 'Maria Santos', role: 'Loan Officer', email: 'maria.santos@hoscomo.coop' },
    { name: 'Anna Reyes', role: 'Client Services Staff', email: 'ana.reyes@hoscomo.coop' },
    { name: 'Juan Dela Cruz', role: 'Teller', email: 'juan.delacruz@hoscomo.coop' },
    { name: 'Pedro Mendoza', role: 'Bookkeeper', email: 'pedro.mendoza@hoscomo.coop' },
  ];

  const inputCls = "w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition";
  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Branch Management' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Branch Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage cooperative branches, staff, and performance.</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition shadow-md">
          <PlusCircle className="w-4 h-4" />
          Add Branch
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Branches" value={branches.length} icon={Building2} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Active Branches" value={branches.filter((b) => b.status === 'Active').length} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Total Staff" value={totalStaff} icon={Users} iconColor="text-indigo-600" iconBg="bg-indigo-50" />
        <StatCard title="Total Clients (Network)" value={totalClients} icon={Users} iconColor="text-amber-600" iconBg="bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        {filtered.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{b.branchName}</h3>
                  <p className="font-mono text-[11px] text-slate-400">{b.branchCode}</p>
                </div>
              </div>
              <Badge dot>{b.status}</Badge>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <p className="flex items-start gap-2 text-slate-500">
                <MapPin className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" /> {b.address}
              </p>
              <p className="flex items-center gap-2 text-slate-500">
                <Phone className="w-4 h-4 text-slate-300 shrink-0" /> {b.phone}
              </p>
              <p className="flex items-center gap-2 text-slate-500">
                <Users className="w-4 h-4 text-slate-300 shrink-0" /> Manager: <span className="font-medium text-slate-700">{b.branchManager}</span>
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 uppercase">Staff</p>
                <p className="font-bold text-slate-800 text-sm">{b.staffCount}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 uppercase">Clients</p>
                <p className="font-bold text-slate-800 text-sm">{b.totalClients}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 uppercase">Savings</p>
                <p className="font-bold text-slate-800 text-sm">{formatPHP(b.totalSavings)}</p>
              </div>
            </div>
            <div className="flex justify-between text-xs mb-4">
              <span className="text-slate-400">Loan Portfolio</span>
              <span className="font-semibold text-slate-700">{formatPHP(b.totalLoans)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelected(b)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition">
                <Eye className="w-3.5 h-3.5" /> View Details
              </button>
              <button onClick={() => setEditOpen(true)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Branch details */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Branch Details" subtitle={selected?.branchCode} maxWidth="2xl">
        {selected && (
          <div>
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-400/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-bold">{selected.branchName}</h4>
                  <p className="text-xs text-slate-300">{selected.address}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Branch Manager</p>
                <p className="font-medium text-slate-800 text-sm">{selected.branchManager}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Contact</p>
                <p className="font-medium text-slate-800 text-sm">{selected.phone}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Total Staff</p>
                <p className="font-bold text-slate-900">{selected.staffCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Status</p>
                <Badge dot>{selected.status}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                <p className="text-[11px] text-blue-600 uppercase font-semibold">Active Clients</p>
                <p className="text-2xl font-bold text-blue-800 mt-1">{selected.totalClients}</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <p className="text-[11px] text-emerald-600 uppercase font-semibold">Loan Portfolio</p>
                <p className="text-2xl font-bold text-emerald-800 mt-1">{formatPHP(selected.totalLoans)}</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <p className="text-[11px] text-amber-600 uppercase font-semibold">Total Savings</p>
                <p className="text-2xl font-bold text-amber-800 mt-1">{formatPHP(selected.totalSavings)}</p>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-800 mb-3">Assigned Staff</h4>
            <DataTable
              data={sampleStaff}
              keyField="email"
              columns={[
                {
                  key: 'name', header: 'Name',
                  render: (s) => (
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                        {s.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                      </span>
                      <span className="font-medium text-slate-800 text-sm">{s.name}</span>
                    </div>
                  ),
                },
                { key: 'role', header: 'Role', render: (s) => <Badge variant="info">{s.role}</Badge> },
                { key: 'email', header: 'Email' },
              ]}
            />
            <div className="mt-4">
              <button onClick={() => showToast('Assign staff modal opens here.')} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition">
                <PlusCircle className="w-3.5 h-3.5" /> Assign New Staff
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Branch */}
      <Modal
        isOpen={addOpen || editOpen}
        onClose={() => { setAddOpen(false); setEditOpen(false); }}
        title={addOpen ? 'Add New Branch' : 'Edit Branch'}
        subtitle="Branch registration information"
        maxWidth="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Branch Name</label>
            <input className={inputCls} defaultValue={editOpen ? 'Tacloban Main Branch' : ''} placeholder="e.g. Tanauan Branch" />
          </div>
          <div>
            <label className={labelCls}>Branch Code</label>
            <input className={inputCls} defaultValue={editOpen ? 'HCM-TB' : ''} placeholder="e.g. HCM-TA" />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Full Address</label>
            <input className={inputCls} defaultValue={editOpen ? 'Magallanes St., Tacloban City, Leyte 6500' : ''} placeholder="Street, Barangay, City, Province" />
          </div>
          <div>
            <label className={labelCls}>Contact Phone</label>
            <input className={inputCls} defaultValue={editOpen ? '+63 (053) 321-8765' : ''} placeholder="+63 (053) XXX-XXXX" />
          </div>
          <div>
            <label className={labelCls}>Branch Manager</label>
            <input className={inputCls} defaultValue={editOpen ? 'Roberto Villanueva' : ''} placeholder="Full name" />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls}>
              <option>Active</option>
              <option>Inactive</option>
              <option>Under Review</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => { setAddOpen(false); setEditOpen(false); }} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">Cancel</button>
          <button onClick={() => { setAddOpen(false); setEditOpen(false); showToast(editOpen ? 'Branch updated successfully.' : 'New branch created successfully.'); }} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition">
            {editOpen ? 'Save Changes' : 'Create Branch'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => { setDeactivateTarget(null); showToast(`Branch "${deactivateTarget?.branchName}" deactivated.`); }}
        title="Deactivate Branch"
        message={`Deactivate "${deactivateTarget?.branchName}"? Active accounts will be transferred to audit review.`}
        confirmLabel="Deactivate"
        variant="warning"
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};