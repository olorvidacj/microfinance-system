import React, { useMemo, useState } from 'react';
import { Users2, CheckCircle2, Clock, UserPlus, UserMinus, Eye, PlusCircle, RefreshCw } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { MOCK_LENDING_GROUPS, LendingGroup, formatPHP, formatDate } from '../data/mockData';

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

const SAMPLE_MEMBERS: GroupMember[] = [
  { id: 'M-001', name: 'Teresa Alcantara', phone: '+63 917 111 2222', role: 'Leader', loanAmount: 50000, balance: 32500, status: 'Good Standing' },
  { id: 'M-002', name: 'Carmen Lopez', phone: '+63 921 555 6666', role: 'Treasurer', loanAmount: 40000, balance: 28000, status: 'Good Standing' },
  { id: 'M-003', name: 'Isabelle Fernandez', phone: '+63 925 999 0000', role: 'Secretary', loanAmount: 100000, balance: 62500, status: 'Good Standing' },
  { id: 'M-004', name: 'Patricia Soriano', phone: '+63 923 777 8888', role: 'Member', loanAmount: 20000, balance: 0, status: 'Good Standing' },
  { id: 'M-005', name: 'Ramon Villanueva', phone: '+63 928 333 4444', role: 'Member', loanAmount: 80000, balance: 64500, status: 'Due' },
];

export const LendingGroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<LendingGroup[]>(MOCK_LENDING_GROUPS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<LendingGroup | null>(null);
  const [tab, setTab] = useState<'members' | 'loan' | 'payments'>('members');
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [toast, setToast] = useState('');

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
    <div>
      <Breadcrumbs items={[{ label: 'Lending Groups' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lending Groups</h1>
          <p className="mt-0.5 text-sm text-slate-500">Group lending with joint liability support for HOSCOMO members.</p>
        </div>
        <button onClick={() => showToast('New lending group form opens here.')} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition shadow-md">
          <PlusCircle className="w-4 h-4" />
          Create Group
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Lending Groups" value={groups.length} icon={Users2} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Active Groups" value={groups.filter((g) => g.status === 'Active').length} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Pending Groups" value={groups.filter((g) => g.status === 'Pending').length} icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <StatCard title="Total Group Loans" value={formatPHP(totalLoans)} icon={RefreshCw} iconColor="text-indigo-600" iconBg="bg-indigo-50" subtitle={`Avg. repayment ${avgRepayment}%`} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by group name, ID, or leader..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Statuses" className="w-full md:w-44" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            { key: 'groupId', header: 'Group ID', render: (g) => <span className="font-mono text-xs text-blue-600">{g.groupId}</span> },
            {
              key: 'groupName', header: 'Group',
              render: (g) => (
                <div>
                  <p className="font-medium text-slate-800">{g.groupName}</p>
                  <p className="text-[11px] text-slate-400">{g.branch}</p>
                </div>
              ),
            },
            { key: 'leader', header: 'Group Leader', render: (g) => <span className="text-sm text-slate-700">{g.leader}</span> },
            { key: 'memberCount', header: 'Members', render: (g) => <Badge variant="indigo">{g.memberCount} members</Badge> },
            { key: 'totalGroupLoan', header: 'Total Group Loan', render: (g) => <span className="font-medium text-slate-800">{formatPHP(g.totalGroupLoan)}</span> },
            { key: 'repaymentRate', header: 'Repayment', render: (g) => (
              <div className="w-24">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${g.repaymentRate}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{g.repaymentRate}%</p>
              </div>
            )},
            { key: 'meetingDay', header: 'Meeting Day', render: (g) => <span className="text-xs text-slate-500">{g.meetingDay}</span> },
            { key: 'formedDate', header: 'Formed', render: (g) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(g.formedDate)}</span> },
            { key: 'status', header: 'Status', render: (g) => <Badge dot>{g.status}</Badge> },
            {
              key: 'actions', header: 'Actions',
              render: (g) => (
                <button onClick={() => { setSelected(g); setTab('members'); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition">
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
              ),
            },
          ]}
        />
      </div>

      {/* Group details */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Group Details" subtitle={selected?.groupId} maxWidth="2xl">
        {selected && (
          <div>
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-lg">{selected.groupName}</h4>
                  <p className="text-xs text-slate-300">Leader: {selected.leader} · {selected.branch} · Meets {selected.meetingDay}s</p>
                </div>
                <Badge dot>{selected.status}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Members</p>
                <p className="font-bold text-slate-900">{selected.memberCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Total Loans</p>
                <p className="font-bold text-slate-900">{formatPHP(selected.totalGroupLoan)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Repayment Rate</p>
                <p className="font-bold text-emerald-600">{selected.repaymentRate}%</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400 uppercase">Joined</p>
                <p className="font-bold text-slate-900">{formatDate(selected.formedDate)}</p>
              </div>
            </div>

            <div className="flex gap-1 border-b border-slate-100 mb-4">
              {(['members', 'loan', 'payments'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium capitalize transition border-b-2 -mb-px ${
                    tab === t ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t === 'members' ? 'Members' : t === 'loan' ? 'Group Loan Records' : 'Payment History'}
                </button>
              ))}
            </div>

            {tab === 'members' && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">{SAMPLE_MEMBERS.length} Members</h4>
                  <button onClick={() => setAddMemberOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg px-2.5 py-1.5 transition">
                    <UserPlus className="w-3.5 h-3.5" /> Add Member
                  </button>
                </div>
                <DataTable
                  data={SAMPLE_MEMBERS}
                  keyField="id"
                  columns={[
                    {
                      key: 'name', header: 'Member',
                      render: (m) => (
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                            {m.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                          </span>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{m.name}</p>
                            <p className="text-[11px] text-slate-400">{m.phone}</p>
                          </div>
                        </div>
                      ),
                    },
                    { key: 'role', header: 'Role', render: (m) => <Badge variant={m.role === 'Leader' ? 'warning' : 'default'}>{m.role}</Badge> },
                    { key: 'loanAmount', header: 'Loan Amount', render: (m) => <span className="text-xs font-medium">{formatPHP(m.loanAmount)}</span> },
                    { key: 'balance', header: 'Balance', render: (m) => <span className="text-xs font-medium">{formatPHP(m.balance)}</span> },
                    { key: 'status', header: 'Status', render: (m) => <Badge dot>{m.status}</Badge> },
                    {
                      key: 'actions', header: '',
                      render: (m) => (
                        <button onClick={() => setRemoveTarget(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition" title="Remove member">
                          <UserMinus className="w-4 h-4" />
                        </button>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {tab === 'loan' && (
              <DataTable
                data={[
                  { id: 'GLOAN-2024-0012', product: 'Group Solidarity Loan', amount: 525000, issued: '2024-02-15', paid: 412000, balance: 113000, status: 'Active' },
                  { id: 'GLOAN-2023-0008', product: 'Group Solidarity Loan', amount: 400000, issued: '2023-05-01', paid: 400000, balance: 0, status: 'Completed' },
                ]}
                keyField="id"
                columns={[
                  { key: 'id', header: 'Loan ID', render: (l) => <span className="font-mono text-xs text-blue-600">{l.id}</span> },
                  { key: 'product', header: 'Product' },
                  { key: 'amount', header: 'Amount', render: (l) => <span className="font-medium">{formatPHP(l.amount)}</span> },
                  { key: 'issued', header: 'Issued', render: (l) => <span className="text-xs">{l.issued}</span> },
                  { key: 'payment', header: 'Paid', render: (l) => <span className="font-medium text-emerald-600">{formatPHP(l.paid)}</span> },
                  { key: 'balance', header: 'Balance', render: (l) => <span className="font-medium">{formatPHP(l.balance)}</span> },
                  { key: 'status', header: 'Status', render: (l) => <Badge>{l.status}</Badge> },
                ]}
              />
            )}

            {tab === 'payments' && (
              <DataTable
                data={[
                  { id: 'MTG-2025-042', date: '2025-09-16', expected: 46880, collected: 44560, missed: 2, by: 'Teresa Alcantara' },
                  { id: 'MTG-2025-041', date: '2025-09-09', expected: 46880, collected: 46880, missed: 0, by: 'Teresa Alcantara' },
                  { id: 'MTG-2025-040', date: '2025-09-02', expected: 46880, collected: 44240, missed: 1, by: 'Teresa Alcantara' },
                ]}
                keyField="id"
                columns={[
                  { key: 'id', header: 'Meeting Ref', render: (m) => <span className="font-mono text-xs text-slate-600">{m.id}</span> },
                  { key: 'date', header: 'Meeting Date' },
                  { key: 'expected', header: 'Expected Collections', render: (m) => <span className="font-medium">{formatPHP(m.expected)}</span> },
                  { key: 'collected', header: 'Actual Collections', render: (m) => <span className="font-medium text-emerald-600">{formatPHP(m.collected)}</span> },
                  { key: 'missed', header: 'Missed', render: (m) => <Badge variant={m.missed > 0 ? 'warning' : 'success'}>{m.missed === 0 ? 'None' : `${m.missed} member(s)`}</Badge> },
                  { key: 'by', header: 'Recorded By' },
                ]}
              />
            )}
          </div>
        )}
      </Modal>

      {/* Add member */}
      <Modal isOpen={addMemberOpen} onClose={() => setAddMemberOpen(false)} title="Add Group Member" subtitle={`${selected?.groupName || ''}`} maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Search Client</label>
            <input className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition" placeholder="Search by name or client ID" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role in Group</label>
            <select className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition">
              <option>Member</option>
              <option>Treasurer</option>
              <option>Secretary</option>
              <option>Leader</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Weekly Dues (P)</label>
            <input type="number" className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition" placeholder="0.00" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAddMemberOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">Cancel</button>
            <button onClick={() => { setAddMemberOpen(false); showToast(`Member added to ${selected?.groupName}.`); }} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition">Add Member</button>
          </div>
        </div>
      </Modal>

      {/* Remove member */}
      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => { setRemoveTarget(null); showToast(`Member "${removeTarget?.name}" removed from group.`); }}
        title="Remove Member"
        message={`Remove "${removeTarget?.name}" from ${selected?.groupName}? Their outstanding group loan obligations will be reallocated.`}
        confirmLabel="Remove Member"
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};