import React, { useEffect, useMemo, useState } from 'react';
import { Users2, CheckCircle2, Clock, UserPlus, UserMinus, Eye, PlusCircle, RefreshCw, ShieldCheck, Plus, Building2, Calendar } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { LendingGroup, formatPHP, formatDate } from '../data/mockData';
import { adminApi, GroupDetail } from '../services/adminApi';

const STATUSES = ['Active', 'Pending', 'Inactive', 'Graduated'];

interface GroupMember {
  id: string;
  name: string;
  phone: string;
  role: 'Leader' | 'Treasurer' | 'Secretary' | 'Member';
  loanAmount: number;
  balance: number;
  status: 'Good Standing' | 'Due' | 'In Arrears';
}

export const LendingGroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<LendingGroup[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<LendingGroup | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [tab, setTab] = useState<'members' | 'loan' | 'payments'>('members');
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    adminApi.groups().then(setGroups).catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    adminApi.groupDetail(selected.id).then(setDetail).catch(() => setDetail(null));
  }, [selected?.id]);

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      const q = search.toLowerCase();
      const matchesSearch = g.groupName.toLowerCase().includes(q) || g.groupId.toLowerCase().includes(q) || g.leader.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || g.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [groups, search, statusFilter]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const totalLoans = groups.reduce((s, g) => s + g.totalGroupLoan, 0);
  const avgRepayment = groups.length ? Math.round(groups.reduce((s, g) => s + g.repaymentRate, 0) / groups.length) : 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Group Lending & Solidarity' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Group Lending & Solidarity Cells</h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Joint Liability
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Center meeting schedules, peer collateralization, and collective liability monitoring across barangays.
          </p>
        </div>
        <button
          onClick={() => showToast('Center lending cell creation form initiated.')}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#091527] hover:bg-[#132c52] text-white text-xs font-bold rounded-xl transition shadow-sm border border-slate-800"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          Create Solidarity Group
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Solidarity Lending Groups" value={groups.length} icon={Users2} iconColor="text-gold-600" iconBg="bg-gold-500/10" />
        <StatCard title="Active Centers in Good Standing" value={groups.filter((g) => g.status === 'Active').length} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Pending Originations" value={groups.filter((g) => g.status === 'Pending').length} icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <StatCard title="Cumulative Group Portfolio" value={formatPHP(totalLoans)} icon={RefreshCw} iconColor="text-gold-600" iconBg="bg-gold-500/10" subtitle={`Average repayment ${avgRepayment}%`} accentBorder />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by center group name, ID code, or leader..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Cell Statuses" className="w-full md:w-44" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            {
              key: 'groupId',
              header: 'Center ID',
              render: (g) => <span className="font-mono text-xs font-bold text-[#091527]">{g.groupId}</span>,
            },
            {
              key: 'groupName',
              header: 'Lending Center / Cell',
              render: (g) => (
                <div>
                  <p className="font-bold text-slate-900">{g.groupName}</p>
                  <p className="text-[11px] text-slate-400">{g.branch}</p>
                </div>
              ),
            },
            {
              key: 'leader',
              header: 'Center Chairperson',
              render: (g) => <span className="text-xs font-semibold text-slate-800">{g.leader}</span>,
            },
            {
              key: 'memberCount',
              header: 'Membership',
              render: (g) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-500/10 text-gold-700 border border-gold-400/30">
                  {g.memberCount} members
                </span>
              ),
            },
            {
              key: 'totalGroupLoan',
              header: 'Cumulative Loan',
              render: (g) => <span className="font-bold text-slate-900 text-xs">{formatPHP(g.totalGroupLoan)}</span>,
            },
            {
              key: 'repaymentRate',
              header: 'Repayment Performance',
              render: (g) => (
                <div className="w-28">
                  <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-1">
                    <span>Rate:</span>
                    <span className={g.repaymentRate >= 95 ? 'text-emerald-600' : 'text-amber-600'}>{g.repaymentRate}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
                    <div
                      className={`h-full rounded-full ${g.repaymentRate >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${g.repaymentRate}%` }}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'meetingDay',
              header: 'Meeting Day',
              render: (g) => (
                <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
                  <Calendar className="w-3 h-3 text-slate-400" /> {g.meetingDay}
                </span>
              ),
            },
            {
              key: 'formedDate',
              header: 'Formation Date',
              render: (g) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(g.formedDate)}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (g) => <Badge dot>{g.status}</Badge>,
            },
            {
              key: 'actions',
              header: 'Action',
              render: (g) => (
                <button
                  onClick={() => { setSelected(g); setTab('members'); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#091527] bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" /> Dossier
                </button>
              ),
            },
          ]}
        />
      </div>

      {/* Group details dossier modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Group Solidarity Dossier" subtitle={selected?.groupId} maxWidth="2xl">
        {selected && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#091527] text-white border border-amber-500/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-black text-base text-white tracking-tight">{selected.groupName}</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Chairperson: <span className="text-amber-300 font-semibold">{selected.leader}</span> · {selected.branch} · Weekly Meeting: {selected.meetingDay}s
                  </p>
                </div>
                <Badge dot>{selected.status}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Active Members</p>
                <p className="font-bold text-slate-900 text-sm mt-1">{selected.memberCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Total Group Exposure</p>
                <p className="font-bold text-slate-900 text-sm mt-1">{formatPHP(selected.totalGroupLoan)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Collection Efficiency</p>
                <p className="font-bold text-emerald-600 text-sm mt-1">{selected.repaymentRate}%</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Charter Date</p>
                <p className="font-bold text-slate-800 text-xs mt-1">{formatDate(selected.formedDate)}</p>
              </div>
            </div>

            <div className="flex gap-1 border-b border-slate-200">
              {(['members', 'loan', 'payments'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3.5 py-2 text-xs font-bold transition border-b-2 -mb-px ${
                    tab === t ? 'border-[#091527] text-[#091527]' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t === 'members' ? 'Group Roster (Solidarity)' : t === 'loan' ? 'Group Loan Commitments' : 'Member Collections'}
                </button>
              ))}
            </div>

            {tab === 'members' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{(detail?.members || []).length} Registered Borrowers</h4>
                  <button
                    onClick={() => setAddMemberOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-2.5 py-1.5 transition"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-amber-700" /> Add Borrower
                  </button>
                </div>
                <DataTable
                  data={detail?.members || []}
                  keyField="id"
                  columns={[
                    {
                      key: 'name',
                      header: 'Member / Client',
                      render: (m) => (
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-700">
                            {m.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                          </span>
                          <div>
                            <p className="font-bold text-slate-900 text-xs">{m.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{m.phone}</p>
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: 'role',
                      header: 'Role',
                      render: (m) => <Badge variant={m.role === 'Leader' ? 'warning' : 'default'}>{m.role}</Badge>,
                    },
                    {
                      key: 'loanAmount',
                      header: 'Principal Loan',
                      render: (m) => <span className="text-xs font-bold text-slate-800">{formatPHP(m.loanAmount)}</span>,
                    },
                    {
                      key: 'balance',
                      header: 'Remaining Balance',
                      render: (m) => <span className="text-xs font-bold text-slate-800">{formatPHP(m.balance)}</span>,
                    },
                    {
                      key: 'status',
                      header: 'Standing',
                      render: (m) => <Badge dot>{m.status}</Badge>,
                    },
                    {
                      key: 'actions',
                      header: '',
                      render: (m) => (
                        <button
                          onClick={() => setRemoveTarget(m as GroupMember)}
                          className="p-1 rounded-lg hover:bg-rose-50 text-rose-500 transition"
                          title="Remove member"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {tab === 'loan' && (
              <DataTable
                data={detail?.loans || []}
                keyField="id"
                columns={[
                  { key: 'id', header: 'Facility ID', render: (l) => <span className="font-mono text-xs font-bold text-[#091527]">{l.loanId}</span> },
                  { key: 'clientName', header: 'Borrower' },
                  { key: 'product', header: 'Credit Facility' },
                  { key: 'amount', header: 'Total Released', render: (l) => <span className="font-bold text-slate-800 text-xs">{formatPHP(l.amount)}</span> },
                  { key: 'issued', header: 'Disbursement Date', render: (l) => <span className="text-xs text-slate-500">{l.issued}</span> },
                  { key: 'payment', header: 'Total Paid', render: (l) => <span className="font-bold text-emerald-700 text-xs">{formatPHP(l.paid)}</span> },
                  { key: 'balance', header: 'Principal Outstanding', render: (l) => <span className="font-bold text-slate-900 text-xs">{formatPHP(l.balance)}</span> },
                  { key: 'status', header: 'Status', render: (l) => <Badge dot>{l.status}</Badge> },
                ]}
              />
            )}

            {tab === 'payments' && (
              <DataTable
                data={detail?.collections || []}
                keyField="id"
                columns={[
                  { key: 'id', header: 'Receipt Serial', render: (m) => <span className="font-mono text-xs font-bold text-slate-700">{m.id}</span> },
                  { key: 'date', header: 'Collection Date', render: (m) => <span className="text-xs text-slate-600 font-medium">{m.date}</span> },
                  { key: 'principal', header: 'Principal Portion', render: (m) => <span className="font-bold text-xs text-slate-800">{formatPHP(m.principal)}</span> },
                  { key: 'interest', header: 'Interest Portion', render: (m) => <span className="font-bold text-xs text-slate-800">{formatPHP(m.interest)}</span> },
                  { key: 'collected', header: 'Amount Collected', render: (m) => <span className="font-bold text-xs text-emerald-700">{formatPHP(m.collected)}</span> },
                  { key: 'method', header: 'Method', render: (m) => <span className="text-xs text-slate-500">{m.method}</span> },
                  { key: 'by', header: 'Recorded By', render: (m) => <span className="text-xs text-slate-600">{m.by}</span> },
                ]}
              />
            )}
          </div>
        )}
      </Modal>

      {/* Add member modal */}
      <Modal isOpen={addMemberOpen} onClose={() => setAddMemberOpen(false)} title="Enroll Group Member" subtitle={selected?.groupName} maxWidth="sm">
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Member Search</label>
            <input className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition" placeholder="Search by name or client ID..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Solidarity Group Role</label>
            <select className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition">
              <option>Member</option>
              <option>Treasurer</option>
              <option>Secretary</option>
              <option>Leader</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Weekly Dues / Amortization (PHP)</label>
            <input type="number" className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition" placeholder="0.00" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddMemberOpen(false)} className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
              Cancel
            </button>
            <button
              onClick={() => { setAddMemberOpen(false); showToast(`Member added to ${selected?.groupName}.`); }}
              className="px-4 py-2 text-xs font-bold text-white bg-[#091527] hover:bg-[#132c52] rounded-xl transition shadow-xs"
            >
              Enroll Member
            </button>
          </div>
        </div>
      </Modal>

      {/* Remove member confirm dialog */}
      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => { setRemoveTarget(null); showToast(`Member "${removeTarget?.name}" removed from group.`); }}
        title="Disassociate Group Member"
        message={`Remove "${removeTarget?.name}" from ${selected?.groupName}? Joint liability co-guarantee provisions will be updated accordingly.`}
        confirmLabel="Confirm Removal"
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
