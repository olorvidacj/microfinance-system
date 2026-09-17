import React, { useState } from 'react';
import { Building2, Users, Wallet, MapPin, Phone, Pencil, PlusCircle, Eye, CheckCircle2, Plus, ShieldCheck, CreditCard } from 'lucide-react';
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

  const inputCls = "w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition text-slate-800";
  const labelCls = "block text-xs font-bold text-slate-700 mb-1.5";

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Branch Network & Operations' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Branch Network Operations</h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Multi-Branch Architecture
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Regional branch oversight, loan officer assignments, teller limits, and territorial portfolios in Leyte.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#091527] hover:bg-[#132c52] text-white text-xs font-bold rounded-xl transition shadow-sm border border-slate-800"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          Register New Branch
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Branch Offices" value={branches.length} icon={Building2} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Active Operational Units" value={branches.filter((b) => b.status === 'Active').length} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Total Staff Deployed" value={totalStaff} icon={Users} iconColor="text-indigo-600" iconBg="bg-indigo-50" />
        <StatCard title="Consolidated Client Network" value={totalClients} icon={Users} iconColor="text-amber-600" iconBg="bg-amber-50" accentBorder />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search branches by station name, code, or location..." className="w-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((b) => (
          <div key={b.id} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 hover:border-amber-400/50 hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#091527] flex items-center justify-center shadow-xs">
                    <Building2 className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{b.branchName}</h3>
                    <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded">
                      {b.branchCode}
                    </span>
                  </div>
                </div>
                <Badge dot>{b.status}</Badge>
              </div>

              <div className="space-y-2 text-xs mb-4 text-slate-600">
                <p className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>{b.address}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{b.phone}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Manager: <span className="font-bold text-slate-800">{b.branchManager}</span></span>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Staff</p>
                  <p className="font-bold text-slate-900 text-xs mt-0.5">{b.staffCount}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Members</p>
                  <p className="font-bold text-slate-900 text-xs mt-0.5">{b.totalClients}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Savings</p>
                  <p className="font-bold text-slate-900 text-[11px] mt-0.5">{formatPHP(b.totalSavings)}</p>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs py-2 px-3 rounded-lg bg-slate-50 border border-slate-200/60 mb-4">
                <span className="text-slate-500 font-medium">Loan Exposure:</span>
                <span className="font-black text-slate-900">{formatPHP(b.totalLoans)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelected(b)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" /> Dossier
              </button>
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl transition"
              >
                <Pencil className="w-3.5 h-3.5 text-amber-600" /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Branch details modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Branch Office Profile" subtitle={selected?.branchCode} maxWidth="2xl">
        {selected && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#091527] text-white border border-amber-500/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-black text-base text-white tracking-tight">{selected.branchName}</h4>
                  <p className="text-xs text-slate-300">{selected.address}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Branch Manager</p>
                <p className="font-bold text-slate-800 text-xs mt-1">{selected.branchManager}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Direct Line</p>
                <p className="font-mono text-slate-700 text-xs font-semibold mt-1">{selected.phone}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Staff Count</p>
                <p className="font-bold text-slate-900 text-xs mt-1">{selected.staffCount} Personnel</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Operating Status</p>
                <Badge dot className="mt-1">{selected.status}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Active Members</p>
                <p className="text-xl font-black text-slate-900 mt-1">{selected.totalClients}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Loan Portfolio</p>
                <p className="text-base font-black text-slate-900 mt-1">{formatPHP(selected.totalLoans)}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Total Savings</p>
                <p className="text-base font-black text-amber-600 mt-1">{formatPHP(selected.totalSavings)}</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Station Personnel & Staff Roster</h4>
                <button
                  onClick={() => showToast('Assign staff member modal triggered.')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#091527] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-amber-600" /> Assign Staff
                </button>
              </div>
              <DataTable
                data={sampleStaff}
                keyField="email"
                columns={[
                  {
                    key: 'name',
                    header: 'Staff Name',
                    render: (s) => (
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-700">
                          {s.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{s.name}</span>
                      </div>
                    ),
                  },
                  {
                    key: 'role',
                    header: 'Coop Staff Role',
                    render: (s) => <Badge variant="info">{s.role}</Badge>,
                  },
                  {
                    key: 'email',
                    header: 'Institutional Email',
                    render: (s) => <span className="font-mono text-[11px] text-slate-600">{s.email}</span>,
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Branch modal */}
      <Modal
        isOpen={addOpen || editOpen}
        onClose={() => { setAddOpen(false); setEditOpen(false); }}
        title={addOpen ? 'Register New Branch Office' : 'Modify Branch Information'}
        subtitle="Cooperative territorial jurisdiction parameters"
        maxWidth="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div>
            <label className={labelCls}>Branch Name</label>
            <input className={inputCls} defaultValue={editOpen ? 'Tacloban Main Branch' : ''} placeholder="e.g. Tanauan Satellite Branch" />
          </div>
          <div>
            <label className={labelCls}>Branch Code (Accounting Serial)</label>
            <input className={inputCls} defaultValue={editOpen ? 'HCM-TB' : ''} placeholder="e.g. HCM-TA" />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Physical Postal Address</label>
            <input className={inputCls} defaultValue={editOpen ? 'Magallanes St., Tacloban City, Leyte 6500' : ''} placeholder="Street, Barangay, City, Province" />
          </div>
          <div>
            <label className={labelCls}>Contact Telephone / Mobile</label>
            <input className={inputCls} defaultValue={editOpen ? '+63 (053) 321-8765' : ''} placeholder="+63 (053) XXX-XXXX" />
          </div>
          <div>
            <label className={labelCls}>Designated Branch Manager</label>
            <input className={inputCls} defaultValue={editOpen ? 'Roberto Villanueva' : ''} placeholder="Officer Full Name" />
          </div>
          <div>
            <label className={labelCls}>Operational Status</label>
            <select className={inputCls}>
              <option>Active</option>
              <option>Inactive</option>
              <option>Under Review</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => { setAddOpen(false); setEditOpen(false); }}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={() => { setAddOpen(false); setEditOpen(false); showToast(editOpen ? 'Branch record saved.' : 'New branch registered.'); }}
            className="px-4 py-2 text-xs font-bold text-white bg-[#091527] hover:bg-[#132c52] rounded-xl transition shadow-xs"
          >
            {editOpen ? 'Save Changes' : 'Register Branch'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => { setDeactivateTarget(null); showToast(`Branch "${deactivateTarget?.branchName}" deactivated.`); }}
        title="Deactivate Branch Office"
        message={`Deactivate "${deactivateTarget?.branchName}"? Active member accounts will require reassignment.`}
        confirmLabel="Deactivate"
        variant="warning"
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#091527] border border-amber-500/40 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {toast}
        </div>
      )}
    </div>
  );
};
