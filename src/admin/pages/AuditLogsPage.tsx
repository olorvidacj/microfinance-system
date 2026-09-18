import React, { useMemo, useState } from 'react';
import { ScrollText, ShieldCheck, AlertTriangle, ShieldAlert, Download, Eye, FileJson, Calendar } from 'lucide-react';
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
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Security & Immutable Audit Trail' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Security & Audit Logs</h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Immutable Trail
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Forensic audit ledger recording all administrative interventions, teller transactions, and access events.
          </p>
        </div>
        <button
          onClick={() => setToast('Audit log CSV ledger export initialized.')}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#091527] hover:bg-[#132c52] text-white text-xs font-bold rounded-xl transition shadow-sm border border-slate-800"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          Export Audit Trail
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total System Events" value={logs.length} icon={ScrollText} iconColor="text-gold-600" iconBg="bg-gold-500/10" />
        <StatCard title="Failed Security Events" value={failed} icon={ShieldAlert} iconColor="text-rose-600" iconBg="bg-rose-50" />
        <StatCard title="Administrative Warnings" value={logs.filter((l) => l.status === 'Warning').length} icon={AlertTriangle} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <StatCard title="Access & Auth Events" value={logs.filter((l) => l.module === 'Security').length} icon={ShieldCheck} iconColor="text-emerald-600" iconBg="bg-emerald-50" accentBorder />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by operator, action keyword, IP, or log ID..." className="flex-1" />
          <FilterSelect value={moduleFilter} onChange={setModuleFilter} options={MODULES.map((m) => ({ value: m, label: m }))} placeholder="All Subsystems" className="w-full lg:w-48" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={['Success', 'Failed', 'Warning'].map((s) => ({ value: s, label: s }))} placeholder="All Severities" className="w-full lg:w-40" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-amber-600" /> Date Window:
          </div>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-700"
            />
            <span className="text-xs font-bold text-slate-400">TO</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-700"
            />
          </div>
          <span className="text-xs font-bold text-slate-600 sm:ml-auto">
            Showing {filtered.length} of {logs.length} audit records
          </span>
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            {
              key: 'id',
              header: 'Audit ID',
              render: (l) => <span className="font-mono text-xs font-bold text-[#091527]">{l.id}</span>,
            },
            {
              key: 'userName',
              header: 'Actor / Operator',
              render: (l) => (
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-700">
                    {l.userName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">{l.userName}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{l.userRole}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'action',
              header: 'Recorded Action',
              render: (l) => <span className="text-xs font-semibold text-slate-800">{l.action}</span>,
            },
            {
              key: 'module',
              header: 'Subsystem',
              render: (l) => <Badge variant="info">{l.module}</Badge>,
            },
            {
              key: 'dateTime',
              header: 'Timestamp',
              render: (l) => (
                <div>
                  <p className="text-xs font-medium text-slate-800">{formatDate(l.dateTime.slice(0, 10))}</p>
                  <p className="text-[10px] font-mono text-slate-400">{l.dateTime.slice(11)}</p>
                </div>
              ),
            },
            {
              key: 'ipAddress',
              header: 'Network IP',
              render: (l) => <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">{l.ipAddress}</span>,
            },
            {
              key: 'status',
              header: 'Execution',
              render: (l) => <Badge dot>{l.status}</Badge>,
            },
            {
              key: 'actions',
              header: '',
              render: (l) => (
                <button
                  onClick={() => setSelected(l)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[#091527] transition"
                  title="Inspect event details"
                >
                  <Eye className="w-4 h-4" />
                </button>
              ),
            },
          ]}
        />
      </div>

      {/* Log detail modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Audit Event Trace Dossier" subtitle={selected?.id} maxWidth="md">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#091527] text-white border border-amber-500/30">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
                <FileJson className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-white">{selected.action}</p>
                <p className="text-xs text-slate-300">{selected.module} · {selected.id}</p>
              </div>
              <div className="ml-auto">
                <Badge dot>{selected.status}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              {[
                ['Operator Name', `${selected.userName}`],
                ['Institutional Role', selected.userRole],
                ['Exact Timestamp', formatDate(selected.dateTime.slice(0, 10)) + ' at ' + selected.dateTime.slice(11)],
                ['Originating IP Address', selected.ipAddress],
                ['Audit Operation', selected.action],
                ['System Subsystem', selected.module],
                ['Unique Sequence ID', selected.id],
                ['Transaction Outcome', selected.status],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                  <span className="text-xs font-bold text-slate-800 text-right">{value}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#091527] hover:bg-[#132c52] rounded-xl transition shadow-xs"
              >
                Dismiss Trace
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#091527] border border-amber-500/40 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {toast}
        </div>
      )}
    </div>
  );
};
