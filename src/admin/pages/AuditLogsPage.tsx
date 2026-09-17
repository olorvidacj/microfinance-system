import React, { useMemo, useState } from 'react';
import { ScrollText, ShieldCheck, AlertTriangle, ShieldAlert, Download, Loader2, Eye, FileJson } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { MOCK_AUDIT_LOGS, AuditLog, formatDate } from '../data/mockData';

const MODULES = [
  'User Management', 'Client Management', 'KYC Verification', 'Loan Management',
  'Financial Transactions', 'Reports & Analytics', 'Security', 'System Settings', 'All Modules',
];

export const AuditLogsPage: React.FC = () => {
  const [logs] = useState<AuditLog[]>(MOCK_AUDIT_LOGS);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const q = search.toLowerCase();
      const matchesSearch = log.userName.toLowerCase().includes(q) || log.action.toLowerCase().includes(q) || log.id.toLowerCase().includes(q) || log.ipAddress.toLowerCase().includes(q);
      const matchesModule = !moduleFilter || moduleFilter === 'All Modules' || log.module === moduleFilter;
      const matchesStatus = !statusFilter || log.status === statusFilter;
      const matchesDate = (!dateFrom || log.dateTime.slice(0, 10) >= dateFrom) && (!dateTo || log.dateTime.slice(0, 10) <= dateTo);
      return matchesSearch && matchesModule && matchesStatus && matchesDate;
    });
  }, [logs, search, moduleFilter, statusFilter, dateFrom, dateTo]);

  const failed = logs.filter((l) => l.status === 'Failed').length;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Audit Logs' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="mt-0.5 text-sm text-slate-500">Complete trail of system events for compliance and security monitoring.</p>
        </div>
        <button onClick={() => setToast('Audit log export started. You will receive the CSV once ready.')} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition shadow-md">
          <Download className="w-4 h-4" />
          Export Logs
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Logged Events" value={logs.length} icon={ScrollText} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Failed Attempts" value={failed} icon={ShieldAlert} iconColor="text-red-500" iconBg="bg-red-50" />
        <StatCard title="Warnings Raised" value={logs.filter((l) => l.status === 'Warning').length} icon={AlertTriangle} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <StatCard title="Security Events" value={logs.filter((l) => l.module === 'Security').length} icon={ShieldCheck} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by user, action, IP address, or log ID..." className="flex-1" />
          <FilterSelect value={moduleFilter} onChange={setModuleFilter} options={MODULES.map((m) => ({ value: m, label: m }))} placeholder="All Modules" className="w-full lg:w-44" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={['Success', 'Failed', 'Warning'].map((s) => ({ value: s, label: s }))} placeholder="All Statuses" className="w-full lg:w-40" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Date Range</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-slate-700 w-full md:w-auto" />
          <span className="text-slate-300">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-slate-700 w-full md:w-auto" />
          <span className="text-xs text-slate-400 md:ml-auto">{filtered.length} of {logs.length} events</span>
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            { key: 'id', header: 'Log ID', render: (l) => <span className="font-mono text-xs text-blue-600">{l.id}</span> },
            {
              key: 'userName', header: 'User',
              render: (l) => (
                <div>
                  <p className="font-medium text-slate-800">{l.userName}</p>
                  <p className="text-[11px] text-slate-400">{l.userRole}</p>
                </div>
              ),
            },
            { key: 'action', header: 'Action', render: (l) => <span className="text-sm text-slate-700">{l.action}</span> },
            { key: 'module', header: 'Module', render: (l) => <Badge variant="info">{l.module}</Badge> },
            {
              key: 'dateTime', header: 'Date & Time',
              render: (l) => (
                <div>
                  <p className="text-xs text-slate-700">{formatDate(l.dateTime.slice(0, 10))}</p>
                  <p className="text-[11px] text-slate-400">{l.dateTime.slice(11)}</p>
                </div>
              ),
            },
            { key: 'ipAddress', header: 'IP Address', render: (l) => <span className="font-mono text-xs text-slate-500">{l.ipAddress}</span> },
            { key: 'status', header: 'Status', render: (l) => <Badge dot>{l.status}</Badge> },
            {
              key: 'actions', header: '',
              render: (l) => (
                <button onClick={() => setSelected(l)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition" title="View log details">
                  <Eye className="w-4 h-4" />
                </button>
              ),
            },
          ]}
        />
      </div>

      {/* Log detail */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Audit Log Details" subtitle={selected?.id} maxWidth="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white">
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                <FileJson className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-bold">{selected.action}</p>
                <p className="text-xs text-slate-300">{selected.module} · {selected.id}</p>
              </div>
              <div className="ml-auto"><Badge dot>{selected.status}</Badge></div>
            </div>

            {[
              ['User', `${selected.userName}`],
              ['Role', selected.userRole],
              ['Date & Time', formatDate(selected.dateTime.slice(0, 10)) + ' ' + selected.dateTime.slice(11)],
              ['IP Address', selected.ipAddress],
              ['Action', selected.action],
              ['Module', selected.module],
              ['Log ID', selected.id],
              ['Status', selected.status],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-medium text-slate-400 w-28 shrink-0">{label}</span>
                <span className="text-sm font-medium text-slate-800 text-right">{value}</span>
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelected(null)} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition">Close</button>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};