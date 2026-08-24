import React, { useState } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  PlusCircle,
  FileCheck,
  Building2,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Upload,
  Download,
  Trash2,
  Edit3,
  ExternalLink,
  History,
  Lock,
  ArrowRight,
  Sparkles,
  Info,
  CheckSquare,
  Square,
  Send,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { Borrower, ClientStatus, KycDocumentType, KycStatus, Loan } from '../types';

interface ClientProfileModalProps {
  client: Borrower | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectLoan?: (loan: Loan) => void;
  onOpenNewLoan?: (client: Borrower) => void;
  onEditClient?: (client: Borrower) => void;
}

export const ClientProfileModal: React.FC<ClientProfileModalProps> = ({
  client,
  isOpen,
  onClose,
  onSelectLoan,
  onOpenNewLoan,
  onEditClient,
}) => {
  const {
    loans,
    branches,
    currentUser,
    updateClientStatus,
    uploadKycDocument,
    reviewKyc,
    deleteKycDocument,
  } = useLoan();

  const [activeTab, setActiveTab] = useState<'overview' | 'kyc' | 'status' | 'loans' | 'documents'>('overview');

  // Status Change Dialog
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<ClientStatus>('Active');
  const [statusChangeReason, setStatusChangeReason] = useState('');

  // KYC Review Decision Dialog
  const [showKycDecisionModal, setShowKycDecisionModal] = useState(false);
  const [kycDecision, setKycDecision] = useState<'APPROVED' | 'CORRECTION_REQUESTED' | 'REJECTED'>('APPROVED');
  const [kycNotes, setKycNotes] = useState('');
  const [checkedChecklist, setCheckedChecklist] = useState<string[]>([
    'Valid Government ID matches identity',
    'Proof of Income verified with employer / business records',
  ]);

  // Upload Document Dialog
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [docTypeToUpload, setDocTypeToUpload] = useState<KycDocumentType>('Government ID (Primary)');
  const [docFileNameToUpload, setDocFileNameToUpload] = useState('');
  const [docNotesToUpload, setDocNotesToUpload] = useState('');

  if (!isOpen || !client) return null;

  const clientLoans = loans.filter((l) => l.borrowerId === client.id);
  const branch = branches.find((b) => b.id === client.branchId);

  // RBAC Privileges
  const canReviewKyc = ['SUPER_ADMIN', 'MANAGER', 'CREDIT_COMMITTEE', 'LOAN_PROCESSOR'].includes(currentUser.role);
  const canUpdateStatus = ['SUPER_ADMIN', 'MANAGER'].includes(currentUser.role);
  const canUploadDocs = ['SUPER_ADMIN', 'MANAGER', 'LOAN_PROCESSOR', 'BOOKKEEPER'].includes(currentUser.role);

  const getStatusBadge = (status?: ClientStatus) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Pending':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Inactive':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'Suspended':
        return 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse';
      case 'Rejected':
        return 'bg-gray-200 text-gray-800 border-gray-400';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getKycBadge = (status?: KycStatus) => {
    switch (status) {
      case 'Verified':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Pending Review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Correction Requested':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Rejected':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Incomplete':
        return 'bg-slate-50 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusChangeReason) {
      alert('Please provide a mandatory reason for changing client status.');
      return;
    }
    updateClientStatus(client.id, newStatus, statusChangeReason);
    setShowStatusModal(false);
    setStatusChangeReason('');
  };

  const handleKycReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycNotes && kycDecision !== 'APPROVED') {
      alert('Please provide detailed notes explaining the decision.');
      return;
    }
    reviewKyc(
      client.id,
      kycDecision,
      kycNotes || 'Approved by authorized officer following compliance check.',
      checkedChecklist
    );
    setShowKycDecisionModal(false);
    setKycNotes('');
  };

  const handleUploadDocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFileNameToUpload) {
      alert('Please specify the file name.');
      return;
    }
    uploadKycDocument(client.id, {
      docType: docTypeToUpload,
      fileName: docFileNameToUpload,
      notes: docNotesToUpload,
      fileSize: `${(Math.random() * 2 + 1).toFixed(1)} MB`,
    });
    setShowUploadDocModal(false);
    setDocFileNameToUpload('');
    setDocNotesToUpload('');
  };

  const toggleChecklist = (item: string) => {
    if (checkedChecklist.includes(item)) {
      setCheckedChecklist(checkedChecklist.filter((i) => i !== item));
    } else {
      setCheckedChecklist([...checkedChecklist, item]);
    }
  };

  const netDisposable = Math.max(0, (client.monthlyIncome || 0) - (client.monthlyExpenses || 0));

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full my-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header Strip */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <img
              src={client.avatar}
              alt={client.fullName}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-md shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">{client.fullName}</h2>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-white/10 text-indigo-200 border border-white/10 font-bold">
                  {client.borrowerNumber || client.clientId}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(client.clientStatus || client.memberStatus)}`}>
                  {client.clientStatus || client.memberStatus}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {client.occupation} • {client.employerOrBusiness} • {branch?.name || 'Main Branch'}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-indigo-300" />
                  {client.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-indigo-300" />
                  {client.email}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-300" />
                  {client.barangay ? `${client.barangay}, ` : ''}{client.city || client.address}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
            {onEditClient && (
              <button
                onClick={() => {
                  onClose();
                  onEditClient(client);
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Controls & Navigation Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { id: 'overview', label: 'Client Overview', icon: User },
              { id: 'kyc', label: 'KYC Verification Desk', icon: ShieldCheck, badge: (client.kycDocuments || []).length },
              { id: 'status', label: 'Status & Audit Trail', icon: History, badge: (client.statusLogs || []).length },
              { id: 'loans', label: 'Loans & Accounts', icon: CreditCard, badge: clientLoans.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === t.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {canReviewKyc && (
              <button
                onClick={() => setShowKycDecisionModal(true)}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Review KYC
              </button>
            )}
            {canUpdateStatus && (
              <button
                onClick={() => {
                  setNewStatus(client.clientStatus || client.memberStatus || 'Active');
                  setShowStatusModal(true);
                }}
                className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5" />
                Change Status
              </button>
            )}
            {onOpenNewLoan && (
              <button
                onClick={() => {
                  onClose();
                  onOpenNewLoan(client);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Originate Loan
              </button>
            )}
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Top KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400">KYC Status</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${getKycBadge(client.kycStatus)}`}>
                      {client.kycStatus}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Credit Rating</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">
                    {client.creditScore} Score <span className="text-xs text-blue-600">({client.creditTier})</span>
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Savings & CBU Balance</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">
                    {formatCurrency((client.savingsBalance || 0) + (client.shareCapital || 0))}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Active Loans</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">
                    {clientLoans.filter((l) => l.status === 'Disbursed' || l.status === 'In Arrears').length} Active
                  </p>
                </div>
              </div>

              {/* Personal & Demographic Info */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    Personal & Demographic Identification
                  </h3>
                  <span className="text-[11px] text-slate-400">Client ID: {client.borrowerNumber || client.clientId}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Primary ID Type & No.</span>
                    <p className="font-semibold text-slate-800">{client.idType || 'Government ID'}: {client.idNumber}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Date of Birth</span>
                    <p className="font-semibold text-slate-800">{formatDate(client.dateOfBirth)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Place of Birth</span>
                    <p className="font-semibold text-slate-800">{client.placeOfBirth || 'Bulacan, Philippines'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Gender & Civil Status</span>
                    <p className="font-semibold text-slate-800">{client.gender} • {client.civilStatus}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Nationality</span>
                    <p className="font-semibold text-slate-800">{client.nationality || 'Filipino'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Membership Registration Date</span>
                    <p className="font-semibold text-slate-800">{formatDate(client.membershipDate || client.joinedDate)}</p>
                  </div>
                </div>
              </div>

              {/* Contact & Residential Address */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    Contact Information & Residential Address
                  </h3>
                  <span className="text-[11px] text-slate-400">{client.homeOwnership || 'Owned'} Home</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[11px]">Complete Residential Address</span>
                    <p className="font-semibold text-slate-800">
                      {client.address}, {client.barangay ? `Brgy. ${client.barangay}, ` : ''}{client.city}, {client.province || 'Bulacan'} {client.postalCode}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Years at Current Address</span>
                    <p className="font-semibold text-slate-800">{client.yearsAtAddress || 4} Years</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Primary Phone</span>
                    <p className="font-semibold text-slate-800">{client.phone}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Secondary / Landline</span>
                    <p className="font-semibold text-slate-800">{client.secondaryPhone || 'None Provided'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Facebook / Messenger</span>
                    <p className="font-semibold text-slate-800">{client.facebookAccount || 'None'}</p>
                  </div>
                </div>

                {/* Emergency Contact */}
                {client.emergencyContactName && (
                  <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Emergency Contact</span>
                      <p className="font-semibold text-slate-800">{client.emergencyContactName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Relationship</span>
                      <p className="font-semibold text-slate-800">{client.emergencyContactRelation || 'Relative'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Phone</span>
                      <p className="font-semibold text-slate-800">{client.emergencyContactPhone || client.phone}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Employment, Business & Financial Information */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    Employment & Financial Profile
                  </h3>
                  <span className="text-[11px] font-semibold text-emerald-600">
                    Net Disposable: {formatCurrency(netDisposable)}/mo
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Employment / Livelihood Type</span>
                    <p className="font-semibold text-slate-800">{client.employmentStatus}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Employer / Business Trade Name</span>
                    <p className="font-semibold text-slate-800">{client.employerOrBusiness || client.employer}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Industry / Business Nature</span>
                    <p className="font-semibold text-slate-800">{client.businessNature || 'Retail & Services'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Occupation / Designation</span>
                    <p className="font-semibold text-slate-800">{client.occupation}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Gross Monthly Income</span>
                    <p className="font-semibold text-slate-900">{formatCurrency(client.monthlyIncome)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Estimated Monthly Expenses</span>
                    <p className="font-semibold text-slate-900">{formatCurrency(client.monthlyExpenses)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KYC VERIFICATION DESK */}
          {activeTab === 'kyc' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    KYC Compliance Verification Desk
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Review primary ID, proofs of income, billing residency, and manage review decisions.
                  </p>
                </div>
                {canUploadDocs && (
                  <button
                    onClick={() => setShowUploadDocModal(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition text-xs shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Document
                  </button>
                )}
              </div>

              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                client.kycStatus === 'Verified'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : client.kycStatus === 'Correction Requested'
                  ? 'bg-orange-50 border-orange-200 text-orange-900'
                  : client.kycStatus === 'Rejected'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                {client.kycStatus === 'Verified' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : client.kycStatus === 'Correction Requested' ? (
                  <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                ) : client.kycStatus === 'Rejected' ? (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs">KYC Verification Status: {client.kycStatus}</h4>
                    {client.kycReviewedBy && (
                      <span className="text-[10px] opacity-80">
                        Reviewed by {client.kycReviewedBy} on {client.kycReviewedAt}
                      </span>
                    )}
                  </div>
                  {client.kycCorrectionNotes && (
                    <p className="mt-1 text-[11px] bg-white/70 p-2 rounded-lg border border-orange-200/60 font-medium">
                      <strong>Correction Instructions:</strong> {client.kycCorrectionNotes}
                    </p>
                  )}
                  {client.kycRejectionReason && (
                    <p className="mt-1 text-[11px] bg-white/70 p-2 rounded-lg border border-rose-200/60 font-medium">
                      <strong>Rejection Ground:</strong> {client.kycRejectionReason}
                    </p>
                  )}
                </div>
              </div>

              {/* Uploaded Documents Grid */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-slate-800 text-xs">Attached KYC Documents ({(client.kycDocuments || []).length})</h4>
                {(client.kycDocuments || []).length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold">No KYC documents attached</p>
                    <p className="text-[11px] mt-1">Upload primary government ID and proof of residence to complete KYC.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(client.kycDocuments || []).map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-xs transition flex flex-col justify-between space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{doc.docType}</p>
                              <p className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">{doc.fileName}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {doc.fileSize} • Uploaded {doc.uploadedAt}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                            doc.status === 'Verified'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : doc.status === 'Correction Requested'
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : doc.status === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {doc.status}
                          </span>
                        </div>

                        {doc.correctionNotes && (
                          <p className="text-[10px] text-orange-800 bg-orange-50 p-1.5 rounded-md border border-orange-200">
                            <strong>Note:</strong> {doc.correctionNotes}
                          </p>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            {doc.verifiedBy ? `Verified by ${doc.verifiedBy}` : 'Pending review'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => alert(`Simulated document preview for: ${doc.fileName}`)}
                              className="px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 rounded-md font-semibold transition"
                            >
                              View File
                            </button>
                            {canUploadDocs && (
                              <button
                                type="button"
                                onClick={() => deleteKycDocument(client.id, doc.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historic KYC Reviews */}
              {(client.kycReviewLogs || []).length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs">KYC Decision Log History</h4>
                  <div className="space-y-2">
                    {client.kycReviewLogs?.map((log) => (
                      <div key={log.id} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{log.decision}</span>
                          <span className="text-[10px] text-slate-400">{log.date}</span>
                        </div>
                        <p className="text-slate-600 mt-1">{log.notes}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">Officer: {log.reviewerName} ({log.reviewerRole})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STATUS & AUDIT TRAIL */}
          {activeTab === 'status' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    Client Status Lifecycle & Audit Trail
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Track all status changes (Pending, Active, Inactive, Suspended, Rejected).
                  </p>
                </div>
                {canUpdateStatus && (
                  <button
                    onClick={() => {
                      setNewStatus(client.clientStatus || client.memberStatus || 'Active');
                      setShowStatusModal(true);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition text-xs shadow-xs"
                  >
                    <History className="w-3.5 h-3.5" />
                    Record Status Change
                  </button>
                )}
              </div>

              {/* Status Timeline */}
              <div className="space-y-3">
                {(client.statusLogs || []).length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border text-center text-slate-400">
                    No status transitions logged yet. Current status: <strong>{client.clientStatus || client.memberStatus}</strong>.
                  </div>
                ) : (
                  (client.statusLogs || []).map((log, idx) => (
                    <div
                      key={log.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{log.fromStatus} → {log.toStatus}</span>
                            <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${getStatusBadge(log.toStatus)}`}>
                              {log.toStatus}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">{log.date}</span>
                        </div>
                        <p className="text-slate-600 mt-1 text-xs">{log.reason}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Authorized Actor: {log.changedBy}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LOANS & ACCOUNTS */}
          {activeTab === 'loans' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    Loan Portfolio & Savings Accounts
                  </h3>
                  <p className="text-[11px] text-slate-400">Credit exposure and repayment performance records.</p>
                </div>
                {onOpenNewLoan && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenNewLoan(client);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition text-xs shadow-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Originate Loan
                  </button>
                )}
              </div>

              {clientLoans.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed text-slate-400">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold">No loans originated for this client yet</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {clientLoans.map((loan) => (
                    <div
                      key={loan.id}
                      onClick={() => onSelectLoan && onSelectLoan(loan)}
                      className="p-3.5 bg-white border border-slate-200 hover:border-blue-400 rounded-xl flex items-center justify-between transition cursor-pointer shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-900">{loan.loanNumber}</span>
                          <span className="text-slate-600 font-semibold">• {loan.productName}</span>
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {loan.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Principal: {formatCurrency(loan.principalAmount)} • Outstanding: {formatCurrency(loan.remainingBalance)} • Term: {loan.termMonths} mos
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-900 block">{formatCurrency(loan.remainingBalance)}</span>
                        <span className="text-[10px] text-slate-400">Remaining Bal</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <Lock className="w-3.5 h-3.5 text-blue-600" />
            <span>Sensitive records protected under Role-Based Access Control</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-semibold transition text-xs"
          >
            Close Profile
          </button>
        </div>
      </div>

      {/* MODAL: CHANGE STATUS */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Update Client Account Status
              </h3>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Target Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900"
                >
                  <option value="Pending">Pending (Under review or incomplete)</option>
                  <option value="Active">Active (In good standing)</option>
                  <option value="Inactive">Inactive (Dormant / No transactions &gt;90d)</option>
                  <option value="Suspended">Suspended (Flagged for investigation)</option>
                  <option value="Rejected">Rejected (KYC compliance failure)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason / Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State the official business reason for this status change..."
                  value={statusChangeReason}
                  onChange={(e) => setStatusChangeReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Confirm Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KYC REVIEW DECISION */}
      {showKycDecisionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                KYC Verification Decision Desk
              </h3>
              <button onClick={() => setShowKycDecisionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleKycReviewSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Verification Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'APPROVED', label: 'Approve KYC', color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                    { id: 'CORRECTION_REQUESTED', label: 'Request Correction', color: 'border-orange-500 bg-orange-50 text-orange-800' },
                    { id: 'REJECTED', label: 'Reject KYC', color: 'border-rose-500 bg-rose-50 text-rose-800' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setKycDecision(d.id as any)}
                      className={`p-2 rounded-xl border text-center font-bold transition ${
                        kycDecision === d.id ? `${d.color} ring-2 ring-blue-500/20` : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compliance Checklist */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 text-[11px] block">Officer Verification Checklist</span>
                {[
                  'Valid Government ID matches identity',
                  'Proof of Income verified with employer / business records',
                  'Barangay residence & billing address verified',
                  'No adverse Credit Bureau / Anti-Money Laundering findings',
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleChecklist(item)}
                    className="flex items-center gap-2 text-left w-full text-slate-700 hover:text-slate-900"
                  >
                    {checkedChecklist.includes(item) ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span>{item}</span>
                  </button>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {kycDecision === 'CORRECTION_REQUESTED' ? 'Required Correction Notes *' : 'Officer Remarks / Justification'}
                </label>
                <textarea
                  rows={3}
                  required={kycDecision !== 'APPROVED'}
                  placeholder={
                    kycDecision === 'CORRECTION_REQUESTED'
                      ? 'Specify which documents need to be re-uploaded or corrected...'
                      : 'Add verification notes or compliance memo...'
                  }
                  value={kycNotes}
                  onChange={(e) => setKycNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowKycDecisionModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-white rounded-xl font-bold shadow-xs ${
                    kycDecision === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : kycDecision === 'CORRECTION_REQUESTED'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Save Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD DOCUMENT */}
      {showUploadDocModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                Upload New KYC Document
              </h3>
              <button onClick={() => setShowUploadDocModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadDocSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Category</label>
                <select
                  value={docTypeToUpload}
                  onChange={(e) => setDocTypeToUpload(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900"
                >
                  <option value="Government ID (Primary)">Government ID (Primary)</option>
                  <option value="Government ID (Secondary)">Government ID (Secondary)</option>
                  <option value="Proof of Income / Payslip / ITR">Proof of Income / Payslip / ITR</option>
                  <option value="Business Permit / DTI">Business Permit / DTI Certificate</option>
                  <option value="Proof of Billing / Residence">Proof of Billing / Residence</option>
                  <option value="2x2 ID Photo">2x2 ID Photo</option>
                  <option value="Barangay Clearance">Barangay Clearance</option>
                  <option value="Signature Specimen">Signature Specimen</option>
                  <option value="Other Document">Other Supporting Document</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  File Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Barangay_Residency_Clearance_2026.pdf"
                  value={docFileNameToUpload}
                  onChange={(e) => setDocFileNameToUpload(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Optional Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Valid until Dec 2026, certified by Brgy Captain"
                  value={docNotesToUpload}
                  onChange={(e) => setDocNotesToUpload(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadDocModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Attach & Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
