import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, CheckCircle2, XCircle, RefreshCcw, Eye, FileText, CheckSquare, Square, ScanLine, Camera, AlertCircle, FileCheck, Building,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { KycRequest, formatDate } from '../data/mockData';
import { adminApi } from '../services/adminApi';

const STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Requires Correction'];

interface VerifyAction {
  type: 'approve' | 'reject' | 'correction';
  request: KycRequest;
}

const VERIFY_CHECKLIST = [
  'Applicant photo matches government ID specimen',
  'Government ID is valid, unexpired, and verifiable',
  'Mobile contact number confirmed via SMS verification',
  'Permanent and current residential address verified',
  'Proof of regular income / cooperative business provided',
  'Signature specimen verified against membership card',
  'Clearance from negative credit & AMLA watchlists',
];

export const KycVerificationPage: React.FC = () => {
  const [requests, setRequests] = useState<KycRequest[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<KycRequest | null>(null);
  const [actionConfirm, setActionConfirm] = useState<VerifyAction | null>(null);
  const [checked, setChecked] = useState<boolean[]>(VERIFY_CHECKLIST.map(() => false));
  const [remarks, setRemarks] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    adminApi.kycRequests().then(setRequests).catch(() => setRequests([]));
  }, []);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch = r.clientName.toLowerCase().includes(q) || r.clientId.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const readyToVerify = checked.every(Boolean) && selected;

  const performAction = () => {
    if (!actionConfirm || !selected) return;
    const { type } = actionConfirm;
    const newStatus = type === 'approve' ? 'Approved' : type === 'reject' ? 'Rejected' : 'Requires Correction';
    setRequests(requests.map((r) => r.id === selected.id ? { ...r, status: newStatus } : r));
    setSelected({ ...selected, status: newStatus });
    showToast(`KYC request (${selected.clientName}) ${newStatus.toLowerCase()}.`);
    setChecked(VERIFY_CHECKLIST.map(() => false));
    setRemarks('');
  };

  const allChecked = checked.every(Boolean);

  const statusCounts = {
    pending: requests.filter((r) => r.status === 'Pending').length,
    approved: requests.filter((r) => r.status === 'Approved').length,
    rejected: requests.filter((r) => r.status === 'Rejected').length,
    correction: requests.filter((r) => r.status === 'Requires Correction').length,
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'KYC & Document Verification' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">KYC Document Verification Desk</h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              AMLA & BSP Compliant
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Mandatory member identification protocol — verified KYC clearance is required before credit disbursement.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total KYC Queue" value={requests.length} icon={ShieldCheck} iconColor="text-gold-600" iconBg="bg-gold-500/10" />
        <StatCard title="Pending Review" value={statusCounts.pending} icon={ScanLine} iconColor="text-amber-600" iconBg="bg-amber-50" accentBorder />
        <StatCard title="Verified & Cleared" value={statusCounts.approved} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Rejected Submissions" value={statusCounts.rejected} icon={XCircle} iconColor="text-rose-500" iconBg="bg-rose-50" />
        <StatCard title="Correction Required" value={statusCounts.correction} icon={RefreshCcw} iconColor="text-purple-600" iconBg="bg-purple-50" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by KYC ID, applicant name, or member ID..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Verification Statuses" className="w-full md:w-56" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            {
              key: 'id',
              header: 'KYC Reference',
              render: (r) => <span className="font-mono text-xs font-bold text-[#091527]">{r.id}</span>,
            },
            {
              key: 'client',
              header: 'Applicant Name',
              render: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{r.clientName}</p>
                  <p className="text-[11px] font-mono text-slate-400">{r.clientId}</p>
                </div>
              ),
            },
            {
              key: 'submissionDate',
              header: 'Date Submitted',
              render: (r) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(r.submissionDate)}</span>,
            },
            {
              key: 'idType',
              header: 'Government Identification',
              render: (r) => (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  {r.idType}
                </span>
              ),
            },
            {
              key: 'documents',
              header: 'Verified Documents',
              render: (r) => (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>{r.documents}</span>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Verification Status',
              render: (r) => <Badge dot>{r.status}</Badge>,
            },
            {
              key: 'assignedStaff',
              header: 'Reviewing Officer',
              render: (r) => <span className="text-xs text-slate-600 font-medium">{r.assignedStaff}</span>,
            },
            {
              key: 'actions',
              header: 'Action',
              render: (r) => (
                <button
                  onClick={() => { setSelected(r); setChecked(VERIFY_CHECKLIST.map(() => false)); setRemarks(''); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#091527] hover:bg-[#132c52] text-white rounded-lg transition shadow-sm border border-slate-800"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" /> Review
                </button>
              ),
            },
          ]}
        />
      </div>

      {/* Verification Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="KYC Compliance Dossier Review" subtitle={`${selected?.id} · ${selected?.clientName}`} maxWidth="2xl">
        {selected && (
          <div className="space-y-4">
            {/* Compliance Banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/80 border border-amber-200">
              <ScanLine className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-amber-900">
                <strong className="font-bold">Cooperative Compliance Protocol:</strong> Complete each item in the verification checklist below before approving KYC clearance. Any rejection or requested correction will prompt immediate notification to the member.
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left column */}
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/50">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">Applicant Identity</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><p className="text-[10px] text-slate-400 uppercase font-bold">Full Name</p><p className="font-bold text-slate-900 mt-0.5">{selected.clientName}</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase font-bold">Member ID</p><p className="font-mono text-slate-800 mt-0.5">{selected.clientId}</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase font-bold">Birth Date</p><p className="font-medium text-slate-800 mt-0.5">Mar 14, 1985</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase font-bold">Civil Status</p><p className="font-medium text-slate-800 mt-0.5">Married</p></div>
                    <div className="col-span-2"><p className="text-[10px] text-slate-400 uppercase font-bold">Home Address</p><p className="font-medium text-slate-800 mt-0.5">Barangay San Jose, Tacloban City, Leyte</p></div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/50">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">Government ID Verification</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2"><p className="text-[10px] text-slate-400 uppercase font-bold">Primary Document</p><p className="font-bold text-slate-900 mt-0.5">{selected.idType}</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase font-bold">Document Serial</p><p className="font-mono text-slate-800 mt-0.5">PH-9022-XXXX-1234</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase font-bold">Validity / Expiry</p><p className="font-medium text-slate-800 mt-0.5">Jan 15, 2031</p></div>
                  </div>
                </div>

                {/* Verification checklist */}
                <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Verification Checklist</h4>
                    <span className="text-[10px] font-bold text-slate-500">
                      {checked.filter(Boolean).length} / {VERIFY_CHECKLIST.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {VERIFY_CHECKLIST.map((item, i) => (
                      <button
                        key={item}
                        onClick={() => setChecked(checked.map((c, ci) => ci === i ? !c : c))}
                        className={`w-full flex items-start gap-2 text-left p-2 rounded-lg text-xs transition border ${
                          checked[i] ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-white text-slate-700 border-slate-200/60 hover:bg-slate-100/50'
                        }`}
                      >
                        {checked[i] ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                        )}
                        <span className={checked[i] ? 'font-semibold' : ''}>{item}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/50">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">Submitted Attachments</h4>
                  <div className="space-y-2">
                    {[
                      'Government ID (Primary) — PhilSys National ID',
                      'Secondary Document — Barangay Certificate of Residency',
                      'Income Verification — Annual Income Tax / DSWD Slip',
                      '2x2 High-Resolution Photo Specimen',
                    ].map((doc) => (
                      <div key={doc} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCheck className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-xs text-slate-700 font-medium truncate">{doc}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">PDF · 1.8 MB</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Document preview container */}
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100 p-4 text-center">
                  <div className="border border-dashed border-slate-300 rounded-lg p-5 bg-white/60">
                    <FileText className="w-8 h-8 text-amber-600/70 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-800">PhilSys National ID — Certified True Copy</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Biometric scan verified by Tacloban Central Office</p>
                  </div>
                </div>

                {/* Remarks textarea */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Compliance Remarks / Audit Notes</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    placeholder="Enter compliance notes, verification findings, or reasons for action..."
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-sm placeholder:text-slate-400"
                  />
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button
                    onClick={() => setActionConfirm({ type: 'correction', request: selected })}
                    className="px-2.5 py-2.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition text-center"
                  >
                    Request Correction
                  </button>
                  <button
                    onClick={() => setActionConfirm({ type: 'reject', request: selected })}
                    className="px-2.5 py-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition text-center"
                  >
                    Reject KYC
                  </button>
                  <button
                    disabled={!readyToVerify || !remarks.trim()}
                    onClick={() => setActionConfirm({ type: 'approve', request: selected })}
                    className="px-2.5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm text-center"
                  >
                    Approve KYC
                  </button>
                </div>
                {!remarks.trim() && (
                  <p className="text-[11px] text-amber-700 font-medium text-center">Audit remarks required to finalize approval.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm action */}
      <ConfirmDialog
        isOpen={!!actionConfirm}
        onClose={() => setActionConfirm(null)}
        onConfirm={performAction}
        title={actionConfirm?.type === 'approve' ? 'Approve KYC?' : actionConfirm?.type === 'reject' ? 'Reject KYC?' : 'Request Correction?'}
        message={
          actionConfirm?.type === 'approve'
            ? `Approve KYC verification for "${actionConfirm.request.clientName}"? This will unlock full credit and savings services.`
            : actionConfirm?.type === 'reject'
              ? `Reject KYC verification for "${actionConfirm.request.clientName}"? The reason will be recorded in compliance audit.`
              : `Request correction for "${actionConfirm.request.clientName}"'s submitted documents? The member will be notified.`
        }
        confirmLabel={actionConfirm?.type === 'approve' ? 'Approve KYC' : actionConfirm?.type === 'reject' ? 'Reject KYC' : 'Request Correction'}
        variant={actionConfirm?.type === 'approve' ? 'info' : actionConfirm?.type === 'reject' ? 'danger' : 'warning'}
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