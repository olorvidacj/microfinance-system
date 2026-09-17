import React, { useMemo, useState } from 'react';
import { Eye, Pencil, UserPlus, Mail, Phone, MapPin, Briefcase, Wallet, FileSpreadsheet, ArrowLeftRight, History } from 'lucide-react';
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

  const inputCls = "w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition";

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Client Management' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Client Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage registered cooperative members and their accounts.</p>
        </div>
        <button onClick={() => showToast('New client registration form will open here.')} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition shadow-md">
          <UserPlus className="w-4 h-4" />
          Register Client
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Clients" value={clients.length} icon={UserPlus} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Active Clients" value={clients.filter((c) => c.status === 'Active').length} icon={UserPlus} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Pending Verification" value={clients.filter((c) => c.status === 'Pending').length} icon={UserPlus} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <StatCard title="Suspended / Inactive" value={clients.filter((c) => ['Suspended', 'Inactive'].includes(c.status)).length} icon={UserPlus} iconColor="text-red-500" iconBg="bg-red-50" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, client ID, or phone..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Status" className="w-full md:w-48" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            {
              key: 'client', header: 'Client',
              render: (c) => (
                <div className="flex items-center gap-3">
                  <img src={c.avatar} alt={c.fullName} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                  <div>
                    <p className="font-medium text-slate-800">{c.fullName}</p>
                    <p className="text-[11px] text-slate-400">{c.clientId}</p>
                  </div>
                </div>
              ),
            },
            { key: 'phone', header: 'Contact', render: (c) => <span className="text-xs text-slate-500 whitespace-nowrap">{c.phone}</span> },
            { key: 'occupation', header: 'Occupation', render: (c) => <span className="text-xs text-slate-500">{c.occupation}</span> },
            { key: 'monthlyIncome', header: 'Monthly Income', render: (c) => <span className="font-medium text-slate-800">{formatPHP(c.monthlyIncome)}</span> },
            { key: 'branch', header: 'Branch', render: (c) => <span className="text-xs text-slate-500">{c.branch}</span> },
            { key: 'kycStatus', header: 'KYC', render: (c) => <Badge>{c.kycStatus}</Badge> },
            { key: 'status', header: 'Status', render: (c) => <Badge dot>{c.status}</Badge> },
            { key: 'registrationDate', header: 'Registered', render: (c) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(c.registrationDate)}</span> },
            {
              key: 'actions', header: 'Actions',
              render: (c) => (
                <div className="flex items-center gap-1">
                  <button onClick={() => loadProfile(c)} title="View Profile" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => showToast(`Edit form for ${c.fullName} will open here.`)} title="Edit" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition"><Pencil className="w-4 h-4" /></button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Client Profile Modal */}
      <Modal isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} title="Client Profile" subtitle={selectedClient?.clientId} maxWidth="2xl">
        {selectedClient && (
          <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white mb-5">
              <img src={selectedClient.avatar} alt={selectedClient.fullName} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20" />
              <div className="flex-1">
                <h4 className="font-bold text-lg">{selectedClient.fullName}</h4>
                <p className="text-xs text-slate-300">{selectedClient.clientId} · {selectedClient.branch}</p>
                <div className="mt-1.5 flex gap-2 flex-wrap">
                  <Badge dot>{selectedClient.status}</Badge>
                  <Badge variant={selectedClient.kycStatus === 'Verified' ? 'success' : 'warning'}>{selectedClient.kycStatus}</Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-400 uppercase tracking-wide">Member Since</p>
                <p className="text-sm font-semibold">{formatDate(selectedClient.registrationDate)}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-100 mb-5">
              {(['overview', 'loans', 'savings', 'transactions'] as ProfileTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setProfileTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium capitalize transition border-b-2 -mb-px ${
                    profileTab === tab ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {profileTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-medium">Email</p>
                      <p className="text-sm font-medium text-slate-800">{selectedClient.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-medium">Contact Number</p>
                      <p className="text-sm font-medium text-slate-800">{selectedClient.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-medium">Address</p>
                      <p className="text-sm font-medium text-slate-800">{selectedClient.address}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <Briefcase className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-medium">Occupation</p>
                      <p className="text-sm font-medium text-slate-800">{selectedClient.occupation}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{selectedClient.employmentInfo}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <Wallet className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-medium">Monthly Income</p>
                      <p className="text-sm font-medium text-slate-800">{formatPHP(selectedClient.monthlyIncome)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <History className="w-4 h-4 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-amber-600 uppercase font-medium">Change Status</p>
                      <div className="flex gap-2 mt-1.5">
                        <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as AdminClient['status'])} className={`${inputCls} !py-1.5 !text-xs`}>
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          onClick={() => { setStatusTarget(selectedClient); loadProfileFromState(); }}
                          className="px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition"
                        >
                          Apply
                        </button>
                      </div>
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
                  { key: 'id', header: 'Loan ID', render: (l) => <span className="font-mono text-xs">{l.id}</span> },
                  { key: 'product', header: 'Product' },
                  { key: 'amount', header: 'Amount', render: (l) => <span className="font-medium">{formatPHP(l.amount)}</span> },
                  { key: 'balance', header: 'Outstanding', render: (l) => <span className="font-medium">{formatPHP(l.balance)}</span> },
                  { key: 'status', header: 'Status', render: (l) => <Badge>{l.status}</Badge> },
                  { key: 'nextDue', header: 'Next Due' },
                ]}
              />
            )}

            {profileTab === 'savings' && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-semibold text-emerald-900">Savings Account</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-emerald-100">
                    <p className="text-[11px] text-slate-400 uppercase">Current Balance</p>
                    <p className="text-lg font-bold text-emerald-700 mt-0.5">{formatPHP(selectedClient.savingsBalance)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-emerald-100">
                    <p className="text-[11px] text-slate-400 uppercase">Interest Rate</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">1.0% p.a.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-emerald-100">
                    <p className="text-[11px] text-slate-400 uppercase">Total Deposited</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">{formatPHP(selectedClient.savingsBalance * 2.4)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-emerald-100">
                    <p className="text-[11px] text-slate-400 uppercase">Total Withdrawn</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">{formatPHP(selectedClient.savingsBalance * 1.4)}</p>
                  </div>
                </div>
              </div>
            )}

            {profileTab === 'transactions' && (
              <DataTable
                data={sampleTxns}
                keyField="ref"
                columns={[
                  { key: 'ref', header: 'Reference', render: (t) => <span className="font-mono text-xs">{t.ref}</span> },
                  { key: 'type', header: 'Type', render: (t) => <Badge>{t.type}</Badge> },
                  { key: 'amount', header: 'Amount', render: (t) => <span className="font-medium">{formatPHP(t.amount)}</span> },
                  { key: 'method', header: 'Method' },
                  { key: 'date', header: 'Date & Time' },
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
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};