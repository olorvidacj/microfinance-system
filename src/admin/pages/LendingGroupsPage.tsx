import React, { useEffect, useMemo, useState } from 'react';
import { Users2, CheckCircle2, ShieldAlert, Eye, Wallet, Calendar } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { LendingGroup, formatDate } from '../data/mockData';
import { adminApi, GroupDetail } from '../services/adminApi';
import { peso } from '../../components/lending';
import { useAdminBranch } from '../branchScope';

const STATUSES = ['Forming', 'Active', 'Suspended', 'Dissolved'];
// Money to the centavo (the API sends numbers with up to 2 decimals).
const php = (n: number | string | null | undefined) => peso(n === null || n === undefined ? null : String(n));

/**
 * Head-office oversight of solidarity groups. Groups are formed and run by
 * branch loan officers (Group lending in the staff app); this page is read-only.
 */
export const LendingGroupsPage: React.FC = () => {
  const { branchId } = useAdminBranch();
  const [groups, setGroups] = useState<LendingGroup[]>([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<LendingGroup | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [tab, setTab] = useState<'members' | 'loan' | 'payments' | 'fund' | 'meetings'>('members');

  useEffect(() => {
    adminApi.groups(branchId).then(setGroups, (err) => setLoadError(err instanceof Error ? err.message : 'Groups could not be loaded.'));
  }, [branchId]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    adminApi.groupDetail(selected.id).then(setDetail, (err) => setLoadError(err instanceof Error ? err.message : 'The group could not be loaded.'));
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groups.filter((g) => (g.groupName.toLowerCase().includes(q) || g.groupId.toLowerCase().includes(q) || g.leader.toLowerCase().includes(q)) && (!statusFilter || g.status === statusFilter));
  }, [groups, search, statusFilter]);

  const exposureCents = groups.reduce((s, g) => s + Math.round(g.totalGroupLoan * 100), 0);
  const fundCents = groups.reduce((s, g) => s + Math.round(g.fundBalance * 100), 0);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Group Lending & Solidarity' }]} />

      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Group Lending & Solidarity</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          One loan per member under the group; members consent to each other's loans and the solidarity fund covers a member who falls behind. Groups are run from the branch.
        </p>
      </div>

      {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{loadError}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Solidarity Groups" value={groups.length} icon={Users2} iconColor="text-gold-600" iconBg="bg-gold-500/10" />
        <StatCard title="Active Groups" value={groups.filter((g) => g.status === 'Active').length} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Blocked From New Loans" value={groups.filter((g) => g.blocked).length} icon={ShieldAlert} iconColor="text-rose-500" iconBg="bg-rose-50" />
        <StatCard title="Group Loans Outstanding" value={php(exposureCents / 100)} icon={Wallet} iconColor="text-gold-600" iconBg="bg-gold-500/10" subtitle={`Solidarity funds ${php(fundCents / 100)}`} accentBorder />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by group name, code, or leader..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Statuses" className="w-full md:w-44" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            { key: 'groupId', header: 'Code', render: (g) => <span className="font-mono text-xs font-bold text-[#091527]">{g.groupId}</span> },
            {
              key: 'groupName',
              header: 'Group',
              render: (g) => (
                <div>
                  <p className="font-bold text-slate-900">{g.groupName}</p>
                  <p className="text-[11px] text-slate-400">{g.branch} · {g.loanOfficer}</p>
                </div>
              ),
            },
            { key: 'leader', header: 'Leader', render: (g) => <span className="text-xs font-semibold text-slate-800">{g.leader || '—'}</span> },
            { key: 'memberCount', header: 'Members', render: (g) => <span className="text-xs">{g.memberCount}</span> },
            { key: 'totalGroupLoan', header: 'Outstanding', render: (g) => <span className="font-bold text-slate-900 text-xs">{php(g.totalGroupLoan)}</span> },
            { key: 'fundBalance', header: 'Fund', render: (g) => <span className="text-xs">{php(g.fundBalance)}</span> },
            {
              key: 'membersInArrears',
              header: 'Behind',
              render: (g) => (
                <span className={`text-xs font-semibold ${g.membersInArrears ? 'text-rose-600' : 'text-slate-500'}`} title={g.blockReasons.join(' ')}>
                  {g.membersInArrears}{g.blocked ? ' · blocked' : ''}
                </span>
              ),
            },
            { key: 'meetingDay', header: 'Meets', render: (g) => <span className="inline-flex items-center gap-1 text-xs text-slate-600"><Calendar className="w-3 h-3 text-slate-400" /> {g.meetingDay} {g.meetingTime}</span> },
            { key: 'formedDate', header: 'Formed', render: (g) => <span className="text-xs text-slate-500 whitespace-nowrap">{g.formedDate ? formatDate(g.formedDate) : '—'}</span> },
            { key: 'status', header: 'Status', render: (g) => <Badge dot>{g.status}</Badge> },
            {
              key: 'actions',
              header: '',
              render: (g) => (
                <button onClick={() => { setSelected(g); setTab('members'); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#091527] bg-slate-100 hover:bg-slate-200 rounded-lg transition">
                  <Eye className="w-3.5 h-3.5 text-slate-600" /> View
                </button>
              ),
            },
          ]}
        />
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.groupName ?? 'Group'} subtitle={selected?.groupId} maxWidth="2xl">
        {selected && (
          <div className="space-y-4">
            {detail?.block.blocked && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
                <p className="font-bold">No new loans until arrears are cleared:</p>
                <ul className="mt-1 list-disc pl-5">{detail.block.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
              <Info label="Members" value={String(selected.memberCount)} />
              <Info label="Outstanding" value={php(selected.totalGroupLoan)} />
              <Info label="Solidarity fund" value={php(selected.fundBalance)} />
              <Info label="Status" value={detail?.statusReason ? `${selected.status} — ${detail.statusReason}` : selected.status} />
            </div>

            <div className="flex gap-1 border-b border-slate-200">
              {(['members', 'loan', 'payments', 'fund', 'meetings'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-2 text-xs font-bold transition border-b-2 -mb-px ${tab === t ? 'border-[#091527] text-[#091527]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  {{ members: 'Members', loan: 'Group loans', payments: 'Collections', fund: 'Solidarity fund', meetings: 'Meetings' }[t]}
                </button>
              ))}
            </div>

            {tab === 'members' && (
              <DataTable
                data={detail?.members || []}
                keyField="id"
                columns={[
                  { key: 'name', header: 'Member', render: (m) => <div><p className="font-bold text-slate-900 text-xs">{m.name}</p><p className="text-[10px] text-slate-400 font-mono">{m.phone}</p></div> },
                  { key: 'role', header: 'Role', render: (m) => <Badge variant={m.role === 'Leader' ? 'warning' : 'default'}>{m.role}</Badge> },
                  { key: 'loanAmount', header: 'Loan balance', render: (m) => <span className="text-xs font-bold">{php(m.loanAmount)}</span> },
                  { key: 'balance', header: 'Overdue', render: (m) => <span className={`text-xs font-bold ${m.balance ? 'text-rose-600' : ''}`}>{php(m.balance)}</span> },
                  { key: 'coverOwed', header: 'Owes fund', render: (m) => <span className="text-xs">{php(m.coverOwed)}</span> },
                  { key: 'status', header: 'Standing', render: (m) => <Badge dot>{m.status}</Badge> },
                ]}
              />
            )}
            {tab === 'loan' && (
              <DataTable
                data={detail?.loans || []}
                keyField="id"
                columns={[
                  { key: 'id', header: 'Loan', render: (l) => <span className="font-mono text-xs font-bold text-[#091527]">{l.loanId}</span> },
                  { key: 'clientName', header: 'Borrower' },
                  { key: 'product', header: 'Product' },
                  { key: 'amount', header: 'Released', render: (l) => <span className="font-bold text-xs">{php(l.amount)}</span> },
                  { key: 'payment', header: 'Paid', render: (l) => <span className="font-bold text-emerald-700 text-xs">{php(l.paid)}</span> },
                  { key: 'balance', header: 'Outstanding', render: (l) => <span className="font-bold text-xs">{php(l.balance)}</span> },
                  { key: 'status', header: 'Status', render: (l) => <Badge dot>{l.status}</Badge> },
                ]}
              />
            )}
            {tab === 'payments' && (
              <DataTable
                data={detail?.collections || []}
                keyField="id"
                columns={[
                  { key: 'id', header: 'Receipt', render: (m) => <span className="font-mono text-xs font-bold text-slate-700">{m.id}</span> },
                  { key: 'date', header: 'Date', render: (m) => <span className="text-xs">{m.date}</span> },
                  { key: 'principal', header: 'Principal', render: (m) => <span className="text-xs">{php(m.principal)}</span> },
                  { key: 'interest', header: 'Interest', render: (m) => <span className="text-xs">{php(m.interest)}</span> },
                  { key: 'collected', header: 'Amount', render: (m) => <span className="font-bold text-xs text-emerald-700">{php(m.collected)}</span> },
                  { key: 'method', header: 'Method', render: (m) => <span className="text-xs text-slate-500">{m.method}</span> },
                  { key: 'by', header: 'Recorded by', render: (m) => <span className="text-xs text-slate-600">{m.by}</span> },
                ]}
              />
            )}
            {tab === 'fund' && (
              <div className="space-y-3">
                <DataTable
                  data={detail?.fund.covers || []}
                  keyField="id"
                  columns={[
                    { key: 'coverNumber', header: 'Cover', render: (c) => <span className="font-mono text-xs">{c.coverNumber}</span> },
                    { key: 'memberName', header: 'Member', render: (c) => <span className="text-xs">{c.memberName}</span> },
                    { key: 'amount', header: 'Covered', render: (c) => <span className="text-xs">{php(c.amount)}</span> },
                    { key: 'outstanding', header: 'Still owed', render: (c) => <span className="text-xs font-bold">{php(c.outstanding)}</span> },
                    { key: 'status', header: 'Status', render: (c) => <Badge dot>{c.status === 'REPAID' ? 'Repaid' : 'Owed'}</Badge> },
                  ]}
                />
                <DataTable
                  data={detail?.fund.transactions || []}
                  keyField="id"
                  columns={[
                    { key: 'date', header: 'Date', render: (t) => <span className="text-xs">{t.date}</span> },
                    { key: 'number', header: 'Number', render: (t) => <span className="font-mono text-xs">{t.number}</span> },
                    { key: 'label', header: 'What', render: (t) => <span className="text-xs">{t.label}</span> },
                    { key: 'memberName', header: 'Member', render: (t) => <span className="text-xs">{t.memberName ?? '—'}</span> },
                    { key: 'amount', header: 'Amount', render: (t) => <span className="text-xs">{php(t.amount)}</span> },
                    { key: 'balance', header: 'Balance', render: (t) => <span className="text-xs font-bold">{php(t.balance)}</span> },
                  ]}
                />
              </div>
            )}
            {tab === 'meetings' && (
              <DataTable
                data={(detail?.meetings || []).map((m) => ({ ...m, id: m.date }))}
                keyField="id"
                columns={[
                  { key: 'date', header: 'Date', render: (m) => <span className="text-xs">{m.date}</span> },
                  { key: 'present', header: 'Attendance', render: (m) => <span className="text-xs">{m.present} of {m.total}</span> },
                  { key: 'recordedBy', header: 'Recorded by', render: (m) => <span className="text-xs">{m.recordedBy}</span> },
                ]}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
    <p className="text-[10px] text-slate-400 uppercase font-bold">{label}</p>
    <p className="font-bold text-slate-800 mt-1">{value}</p>
  </div>
);
