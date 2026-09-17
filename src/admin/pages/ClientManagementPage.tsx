import React, { useMemo, useState } from 'react';
import { Eye, Pencil, UserPlus, Mail, Phone, MapPin, Briefcase, Wallet, FileSpreadsheet, ArrowLeftRight, History, Building, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { MOCK_CLIENTS, AdminClient, formatPHP, formatDate } from '../data/mockData';

const STATUSES = ['Pending', 'Active', 'Inactive', 'Suspended', 'Rejected', 'Closed'];

type ProfileTab = 'overview' | 'loans' | 'savings' | 'transactions';

export const ClientManagementPage: React.FC = () => {
  const [clients, setClients] = useState<AdminClient[]>(MOCK_CLIENTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedClient, setSelectedClient] = useState<AdminClient | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');
  const [statusTarget, setStatusTarget] = useState<AdminClient | null>(null);
  const [newStatus, setNewStatus] = useState<AdminClient['status']>('Active');
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch = c.fullName.toLowerCase().includes(q) || c.clientId.toLowerCase().includes(q) || c.phone.includes(q);
      const matchesStatus = !statusFilter || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clients, search, statusFilter]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const applyStatusChange = () => {
    if (statusTarget) {
      setClients(clients.map((c) => c.id === statusTarget.id ? { ...c, status: newStatus } : c));
      setSelectedClient(clients.find((c) => c.id === statusTarget.id) ? { ...statusTarget, status: newStatus } : null);
      showToast(`Client "${statusTarget.fullName}" status updated to ${newStatus}.`);
    }
  };

  const loadProfile = (c: AdminClient) => { setSelectedClient(c); setProfileTab('overview'); };

  const loadProfileFromState = () => {
    if (selectedClient) {
      const fresh = clients.find((c) => c.id === selectedClient.id);
      if (fresh) setSelectedClient(fresh);
    }
  };

  const sampleLoans = [
    { id: 'LN-2025-0042', product: 'Regular Microloan', amount: 50000, balance: 32500, status: 'Active', nextDue: '2025-10-15' },
    { id: 'LN-2024-0031', product: 'Livelihood Loan', amount: 25000, balance: 0, status: 'Completed', nextDue: '—' },
  ];

  const sampleTxns = [
    { ref: 'OR-2025-1847', type: 'Loan Payment', amount: 4688, date: '2025-09-12 09:30', method: 'Cash' },
    { ref: 'OR-2025-1840', type: 'Savings Deposit', amount: 5000, date: '2025-09-10 09:00', method: 'Cash' },
    { ref: 'OR-2025-1788', type: 'Loan Payment', amount: 4688, date: '2025-08-15 10:20', method: 'GCash' },
    { ref: 'OR-2025-1721', type: 'Savings Deposit', amount: 2000, date: '2025-08-01 14:05', method: 'Cash' },
  ];

  const inputCls = "w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-sm";

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Client & Member Management' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Cooperative Member Registry</h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              CDA Registered
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">Official member roster, credit history, savings accounts, and KYC verification records.</p>
        </div>
        <button
          onClick={() => showToast('New client registration module opened.')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#091527] hover:bg-[#132c52] text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-md shadow-slate-900/10 shrink-0 border border-slate-800"
        >
          <UserPlus className="w-4 h-4 text-amber-400" />
          <span>Register New Member</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Registered Members" value={clients.length} icon={UserPlus} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Active Borrowers & Savers" value={clients.filter((c) => c.status === 'Active').length} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Pending KYC Review" value={clients.filter((c) => c.status === 'Pending').length} icon={ShieldCheck} iconColor="text-amber-600" iconBg="bg-amber-50" accentBorder />
        <StatCard title="Inactive / Closed" value={clients.filter((c) => ['Suspended', 'Inactive'].includes(c.status)).length} icon={History} iconColor="text-rose-500" iconBg="bg-rose-50" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, member ID, contact number..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Member Statuses" className="w-full md:w-52" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            {
              key: 'client',
              header: 'Cooperative Member',
              render: (c) => (
                <div className="flex items-center gap-3">
                  <img src={c.avatar} alt={c.fullName} className="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{c.fullName}</p>
                    <p className="text-[11px] font-mono text-slate-400">{c.clientId}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'phone',
              header: 'Contact Info',
              render: (c) => (
                <div>
                  <p className="text-xs text-slate-800 font-medium">{c.phone}</p>
                  <p className="text-[11px] text-slate-400 truncate max-w-[150px]">{c.email}</p>
                </div>
              ),
            },
            {
              key: 'occupation',
              header: 'Livelihood / Occupation',
              render: (c) => <span className="text-xs text-slate-600 font-medium">{c.occupation}</span>,
            },
            {
              key: 'monthlyIncome',
              header: 'Monthly Income',
              render: (c) => <span className="font-bold text-slate-900">{formatPHP(c.monthlyIncome)}</span>,
            },
            {
              key: 'branch',
              header: 'Branch Office',
              render: (c) => (
                <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  {c.branch}
                </span>
              ),
            },
            {
              key: 'kycStatus',
              header: 'KYC Status',
              render: (c) => <Badge variant={c.kycStatus === 'Verified' ? 'success' : 'warning'} dot>{c.kycStatus}</Badge>,
            },
            {
              key: 'status',
              header: 'Account Status',
              render: (c) => <Badge dot>{c.status}</Badge>,
            },
            {
              key: 'registrationDate',
              header: 'Member Since',
              render: (c) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(c.registrationDate)}</span>,
            },
            {
              key: 'actions',
              header: 'Action',
              render: (c) => (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => loadProfile(c)}
                    title="View Comprehensive Profile"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 hover:border-amber-300 text-slate-600 hover:text-amber-700 transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => showToast(`Edit form for member ${c.fullName} opened.`)}
                    title="Edit Member Information"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Client Profile Modal */}
      <Modal isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} title="Member Profile & Financial File" subtitle={selectedClient?.clientId} maxWidth="2xl">
        {selectedClient && (
          <div className="space-y-4">
            {/* Executive Member Header */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#091527] to-[#132c52] p-5 text-white shadow-lg border border-slate-800">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img src={selectedClient.avatar} alt={selectedClient.fullName} className="w-16 h-16 rounded-xl object-cover ring-2 ring-amber-400/50 shadow-md shrink-0" />
                  <div>
                    <h4 className="font-black text-lg text-white tracking-tight">{selectedClient.fullName}</h4>
                    <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-amber-400 font-semibold">{selectedClient.clientId}</span>
                      <span>·</span>
                      <span>{selectedClient.branch}</span>
                    </p>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <Badge dot>{selectedClient.status}</Badge>
                      <Badge variant={selectedClient.kycStatus === 'Verified' ? 'success' : 'warning'}>{selectedClient.kycStatus}</Badge>
                    </div>
                  </div>
                </div>
                <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-white/10">
                  <p className="text-[10px] text-amber-400 uppercase tracking-wider font-bold">Membership Date</p>
                  <p className="text-xs sm:text-sm font-bold text-white mt-0.5">{formatDate(selectedClient.registrationDate)}</p>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-slate-200">
              {(['overview', 'loans', 'savings', 'transactions'] as ProfileTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setProfileTab(tab)}
                  className={`px-4 py-2 text-xs sm:text-sm font-bold capitalize transition border-b-2 -mb-px ${
                    profileTab === tab ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {profileTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
                    <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Email Address</p>
                      <p className="text-xs sm:text-sm font-medium text-slate-800 mt-0.5">{selectedClient.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
                    <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Mobile Number</p>
                      <p className="text-xs sm:text-sm font-medium text-slate-800 mt-0.5">{selectedClient.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Residential Address</p>
                      <p className="text-xs sm:text-sm font-medium text-slate-800 mt-0.5">{selectedClient.address}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
                    <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Livelihood & Occupation</p>
                      <p className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">{selectedClient.occupation}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{selectedClient.employmentInfo}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
                    <Wallet className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Verified Monthly Income</p>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">{formatPHP(selectedClient.monthlyIncome)}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                    <p className="text-[10px] text-amber-800 uppercase font-bold tracking-wider">Change Membership Status</p>
                    <div className="flex gap-2 mt-2">
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as AdminClient['status'])}
                        className={`${inputCls} !py-1.5 !text-xs font-semibold`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button
                        onClick={() => { setStatusTarget(selectedClient); loadProfileFromState(); }}
                        className="px-3.5 py-1.5 text-xs font-bold bg-[#091527] hover:bg-[#132c52] text-white rounded-xl transition shrink-0"
                      >
                        Apply Status
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {profileTab === 'loans' && (
              <DataTable
                data={sampleLoans}
                keyField="id"
                columns={[
                  { key: 'id', header: 'Loan ID', render: (l) => <span className="font-mono text-xs font-bold text-[#091527]">{l.id}</span> },
                  { key: 'product', header: 'Product' },
                  { key: 'amount', header: 'Principal Amount', render: (l) => <span className="font-bold text-slate-900">{formatPHP(l.amount)}</span> },
                  { key: 'balance', header: 'Outstanding Balance', render: (l) => <span className="font-bold text-amber-700">{formatPHP(l.balance)}</span> },
                  { key: 'status', header: 'Status', render: (l) => <Badge dot>{l.status}</Badge> },
                  { key: 'nextDue', header: 'Next Due Date' },
                ]}
              />
            )}

            {profileTab === 'savings' && (
              <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-emerald-700" />
                  <h4 className="font-bold text-emerald-950 text-sm sm:text-base">Cooperative Regular Savings Ledger</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-emerald-200 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Current Balance</p>
                    <p className="text-base sm:text-lg font-black text-emerald-700 mt-1">{formatPHP(selectedClient.savingsBalance)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-emerald-200 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Dividend Yield</p>
                    <p className="text-base sm:text-lg font-bold text-slate-800 mt-1">1.25% p.a.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-emerald-200 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Accumulated</p>
                    <p className="text-base sm:text-lg font-bold text-slate-800 mt-1">{formatPHP(selectedClient.savingsBalance * 2.4)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-emerald-200 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Withdrawn</p>
                    <p className="text-base sm:text-lg font-bold text-slate-800 mt-1">{formatPHP(selectedClient.savingsBalance * 1.4)}</p>
                  </div>
                </div>
              </div>
            )}

            {profileTab === 'transactions' && (
              <DataTable
                data={sampleTxns}
                keyField="ref"
                columns={[
                  { key: 'ref', header: 'Reference', render: (t) => <span className="font-mono text-xs font-semibold text-[#091527]">{t.ref}</span> },
                  { key: 'type', header: 'Transaction Type', render: (t) => <Badge>{t.type}</Badge> },
                  { key: 'amount', header: 'Amount', render: (t) => <span className="font-bold text-slate-900">{formatPHP(t.amount)}</span> },
                  { key: 'method', header: 'Channel / Method', render: (t) => <Badge variant="default">{t.method}</Badge> },
                  { key: 'date', header: 'Timestamp', render: (t) => <span className="text-xs text-slate-500">{t.date}</span> },
                ]}
              />
            )}
          </div>
        )}
      </Modal>

      {/* Confirm status change */}
      <ConfirmDialog
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={applyStatusChange}
        title="Update Client Status"
        message={`Set the status of "${statusTarget?.fullName}" to "${newStatus}"? This change will be logged for audit purposes.`}
        confirmLabel="Update Status"
        variant="info"
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