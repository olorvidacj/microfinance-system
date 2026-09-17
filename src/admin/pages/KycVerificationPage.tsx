import React, { useMemo, useState } from 'react';
import {
  ShieldCheck, CheckCircle2, XCircle, RefreshCcw, Eye, FileText, CheckSquare, Square, ScanLine, Camera,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { SearchInput, FilterSelect } from '../components/SearchFilter';
import { MOCK_KYC_REQUESTS, KycRequest, formatDate } from '../data/mockData';

const STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Requires Correction'];

interface VerifyAction {
  type: 'approve' | 'reject' | 'correction';
  request: KycRequest;
}

const VERIFY_CHECKLIST = [
  'Applicant photo matches government ID',
  'Government ID is valid and not expired',
  'Contact number is confirmed',
  'Address is verified',
  'Proof of income / employment provided',
  'Signature specimen matches',
  'No records in negative credit watchlist',
];

export const KycVerificationPage: React.FC = () => {
  const [requests, setRequests] = useState<KycRequest[]>(MOCK_KYC_REQUESTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<KycRequest | null>(null);
  const [actionConfirm, setActionConfirm] = useState<VerifyAction | null>(null);
  const [checked, setChecked] = useState<boolean[]>(VERIFY_CHECKLIST.map(() => false));
  const [remarks, setRemarks] = useState('');
  const [toast, setToast] = useState('');

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
    <div>
      <Breadcrumbs items={[{ label: 'KYC Verification' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">KYC Verification</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Know Your Customer — clients must have verified KYC before accessing full loan functionality.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total KYC Requests" value={requests.length} icon={ShieldCheck} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Pending Verification" value={statusCounts.pending} icon={ShieldCheck} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <StatCard title="Approved KYC" value={statusCounts.approved} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Rejected KYC" value={statusCounts.rejected} icon={XCircle} iconColor="text-red-500" iconBg="bg-red-50" />
        <StatCard title="Requires Correction" value={statusCounts.correction} icon={RefreshCcw} iconColor="text-purple-600" iconBg="bg-purple-50" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by KYC ID, client name, or client ID..." className="flex-1" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All Statuses" className="w-full md:w-48" />
        </div>

        <DataTable
          data={filtered}
          keyField="id"
          columns={[
            { key: 'id', header: 'KYC ID', render: (r) => <span className="font-mono text-xs text-blue-600">{r.id}</span> },
            {
              key: 'client', header: 'Client',
              render: (r) => (
                <div>
                  <p className="font-medium text-slate-800">{r.clientName}</p>
                  <p className="text-[11px] text-slate-400">{r.clientId}</p>
                </div>
              ),
            },
            { key: 'submissionDate', header: 'Submission Date', render: (r) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(r.submissionDate)}</span> },
            { key: 'idType', header: 'Government ID', render: (r) => <span className="text-xs text-slate-500">{r.idType}</span> },
            { key: 'documents', header: 'Documents', render: (r) => (
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-xs text-slate-500">{r.documents}</span>
              </div>
            )},
            { key: 'status', header: 'Verification Status', render: (r) => <Badge dot>{r.status}</Badge> },
            { key: 'assignedStaff', header: 'Assigned Staff', render: (r) => <span className="text-xs text-slate-500">{r.assignedStaff}</span> },
            {
              key: 'actions', header: 'Actions',
              render: (r) => (
                <button
                  onClick={() => { setSelected(r); setChecked(VERIFY_CHECKLIST.map(() => false)); setRemarks(''); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-700 text-white rounded-lg transition"
                >
                  <Eye className="w-3.5 h-3.5" /> Verify
                </button>
              ),
            },
          ]}
        />
      </div>

      {/* Verification Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="KYC Verification Review" subtitle={`${selected?.id} · ${selected?.clientName}`} maxWidth="2xl">
        {selected && (
          <div>
            {/* Warning banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 mb-5">
              <ScanLine className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                <strong>Important:</strong> The client must complete KYC verification before being able to access full loan application functionality in their mobile portal.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left column */}
              <div>
                {/* Client info */}
                <div className="rounded-xl border border-slate-100 p-4 mb-4">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-[11px] text-slate-400 uppercase">Full Name</p><p className="font-medium text-slate-800">{selected.clientName}</p></div>
                    <div><p className="text-[11px] text-slate-400 uppercase">Client ID</p><p className="font-medium text-slate-800">{selected.clientId}</p></div>
                    <div><p className="text-[11px] text-slate-400 uppercase">Date of Birth</p><p className="font-medium text-slate-800">Mar 14, 1985</p></div>
                    <div><p className="text-[11px] text-slate-400 uppercase">Civil Status</p><p className="font-medium text-slate-800">Married</p></div>
                    <div className="col-span-2"><p className="text-[11px] text-slate-400 uppercase">Address</p><p className="font-medium text-slate-800">Barangay San Jose, Tacloban City, Leyte</p></div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 p-4 mb-4">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-[11px] text-slate-400 uppercase">Phone</p><p className="font-medium text-slate-800">+63 917 444 5566</p></div>
                    <div><p className="text-[11px] text-slate-400 uppercase">Email</p><p className="font-medium text-slate-800">client@email.com</p></div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 p-4 mb-4">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">Government ID Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2"><p className="text-[11px] text-slate-400 uppercase">ID Type</p><p className="font-medium text-slate-800">{selected.idType}</p></div>
                    <div><p className="text-[11px] text-slate-400 uppercase">ID Number</p><p className="font-medium text-slate-800">XXXX-XXXX-XXXX-1234</p></div>
                    <div><p className="text-[11px] text-slate-400 uppercase">Expiry Date</p><p className="font-medium text-slate-800">Jan 15, 2031</p></div>
                  </div>
                </div>

                {/* Verification checklist */}
                <div className="rounded-xl border border-slate-100 p-4">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">Verification Checklist</h4>
                  <div className="space-y-2">
                    {VERIFY_CHECKLIST.map((item, i) => (
                      <button
                        key={item}
                        onClick={() => setChecked(checked.map((c, ci) => ci === i ? !c : c))}
                        className={`w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm transition ${
                          checked[i] ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {checked[i] ? <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                        <span className={checked[i] ? 'font-medium' : ''}>{item}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <CheckSquare className="w-3.5 h-3.5" />
                    {allChecked ? 'All items verified' : `${checked.filter(Boolean).length} of ${VERIFY_CHECKLIST.length} items checked`}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Uploaded Documents</h4>
                <div className="space-y-2 mb-4">
                  {['Government ID (Primary) — PhilSys National ID',
                    'Government ID (Secondary) — Passport',
                    'Proof of Income — Payslip, DSWD',
                    'Proof of Billing / Residence',
                    '2x2 ID Photo',
                    'Barangay Clearance',
                  ].map((doc, i) => (
                    <div key={doc} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/60 transition cursor-pointer group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="text-xs text-slate-600 truncate">{doc}</span>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                        <Camera className="w-3 h-3" /> 2.4 MB
                      </span>
                    </div>
                  ))}
                </div>

                {/* Document preview */}
                <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-semibold text-slate-600">Document Preview</span>
                    <span className="text-[10px] text-slate-400">Sample preview</span>
                  </div>
                  <div className="bg-slate-100 p-4">
                    <div className="rounded-lg bg-gradient-to-br from-blue-50 to-slate-50 border border-slate-200 border-dashed p-6 text-center flex flex-col items-center">
                      <FileText className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400">Government ID document preview</p>
                      <p className="text-[10px] text-slate-300 mt-1">Front · Back · Valid until 2031</p>
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Remarks / Reason</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    placeholder="Enter remarks or reason for decision..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition placeholder:text-slate-400"
                  />
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => setActionConfirm({ type: 'correction', request: selected })}
                    className="px-3 py-2.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition"
                  >
                    Request Correction
                  </button>
                  <button
                    onClick={() => setActionConfirm({ type: 'reject', request: selected })}
                    className="px-3 py-2.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition"
                  >
                    Reject KYC
                  </button>
                  <button
                    disabled={!readyToVerify || !remarks.trim()}
                    onClick={() => setActionConfirm({ type: 'approve', request: selected })}
                    className="px-3 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Approve KYC
                  </button>
                </div>
                {!remarks.trim() && selected && (
                  <p className="text-[11px] text-amber-600 mt-2">Add remarks before approving.</p>
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
            ? `Approve KYC verification for "${actionConfirm.request.clientName}"? This will unlock full loan application access.`
            : actionConfirm?.type === 'reject'
              ? `Reject KYC verification for "${actionConfirm.request.clientName}"? Include the reason in remarks for the client.`
              : `Request correction for "${actionConfirm.request.clientName}"'s KYC documents? The client will be notified to resubmit.`
        }
        confirmLabel={actionConfirm?.type === 'approve' ? 'Approve' : actionConfirm?.type === 'reject' ? 'Reject' : 'Request Correction'}
        variant={actionConfirm?.type === 'approve' ? 'info' : actionConfirm?.type === 'reject' ? 'danger' : 'warning'}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};