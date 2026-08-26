import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  FileText,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  CreditCard,
  ChevronRight,
  Sparkles,
  Award,
  AlertCircle,
  FileCheck,
  PiggyBank,
  Scale,
  Edit3,
  CheckCircle2,
  Clock,
  XCircle,
  History,
  ShieldAlert,
  Building2,
  Lock,
  PlusCircle,
  ArrowRight,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { useAccess } from '../hooks/useAccess';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { Borrower, ClientStatus, KycStatus, Loan } from '../types';
import { ClientRegistrationModal } from './ClientRegistrationModal';
import { ClientProfileModal } from './ClientProfileModal';
import { BorrowerModal } from './BorrowerModal';

interface ClientManagementViewProps {
  onSelectClient?: (client: Borrower) => void;
  onOpenNewLoanForClient?: (client: Borrower) => void;
}

export const ClientManagementView: React.FC<ClientManagementViewProps> = ({
  onSelectClient,
  onOpenNewLoanForClient,
}) => {
  const {
    filteredBorrowers,
    branches,
    currentUser,
    updateClientStatus,
    reviewKyc,
    membershipApplications,
    submitMembershipApplication,
    staffVerifyMembershipApp,
    educationCommRecordBI,
    bodApproveMembershipApp,
    rejectMembershipApp,
  } = useLoan();

  const { hasPermission } = useAccess();
  const canRegisterClient = hasPermission('register_clients');
  const canManageKyc = hasPermission('manage_kyc');
  const canAssistClient = hasPermission('assist_clients');

  // Sub-tabs
  const [activeTab, setActiveTab] = useState<'directory' | 'kycQueue' | 'pipeline' | 'audit'>('directory');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<string>('ALL');
  const [kycStatusFilter, setKycStatusFilter] = useState<string>('ALL');
  const [employmentFilter, setEmploymentFilter] = useState<string>('ALL');

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedClientForProfile, setSelectedClientForProfile] = useState<Borrower | null>(null);
  const [editBorrower, setEditBorrower] = useState<Borrower | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Quick Review Modal State
  const [quickReviewClient, setQuickReviewClient] = useState<Borrower | null>(null);
  const [quickDecision, setQuickDecision] = useState<'APPROVED' | 'CORRECTION_REQUESTED' | 'REJECTED'>('APPROVED');
  const [quickNotes, setQuickNotes] = useState('');

  // RBAC Privileges
  const canRegister = ['SUPER_ADMIN', 'MANAGER', 'LOAN_PROCESSOR', 'BOOKKEEPER', 'CREDIT_COMMITTEE'].includes(
    currentUser.role
  );
  const canReviewKyc = ['SUPER_ADMIN', 'MANAGER', 'CREDIT_COMMITTEE', 'LOAN_PROCESSOR'].includes(currentUser.role);
  const canChangeStatus = ['SUPER_ADMIN', 'MANAGER'].includes(currentUser.role);

  // Filtered Client List
  const displayedClients = filteredBorrowers.filter((client) => {
    const matchesSearch =
      client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.borrowerNumber && client.borrowerNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.clientId && client.clientId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      client.phone.includes(searchTerm) ||
      (client.idNumber && client.idNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.city && client.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.barangay && client.barangay.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesClientStatus =
      clientStatusFilter === 'ALL' ||
      (client.clientStatus || client.memberStatus) === clientStatusFilter;

    const matchesKycStatus = kycStatusFilter === 'ALL' || client.kycStatus === kycStatusFilter;

    const matchesEmployment =
      employmentFilter === 'ALL' || client.employmentStatus === employmentFilter;

    return matchesSearch && matchesClientStatus && matchesKycStatus && matchesEmployment;
  });

  // Verification Queue (Pending Review or Correction Requested)
  const kycQueueClients = filteredBorrowers.filter(
    (c) => c.kycStatus === 'Pending Review' || c.kycStatus === 'Correction Requested' || c.kycStatus === 'Incomplete'
  );

  // Metrics Count
  const totalCount = filteredBorrowers.length;
  const activeCount = filteredBorrowers.filter((c) => (c.clientStatus || c.memberStatus) === 'Active').length;
  const pendingKycCount = filteredBorrowers.filter(
    (c) => c.kycStatus === 'Pending Review' || c.kycStatus === 'Correction Requested'
  ).length;
  const suspendedCount = filteredBorrowers.filter((c) => (c.clientStatus || c.memberStatus) === 'Suspended').length;
  const inactiveCount = filteredBorrowers.filter((c) => (c.clientStatus || c.memberStatus) === 'Inactive').length;
  const rejectedCount = filteredBorrowers.filter(
    (c) => (c.clientStatus || c.memberStatus) === 'Rejected' || c.kycStatus === 'Rejected'
  ).length;

  const getStatusBadge = (status?: ClientStatus) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Pending':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Inactive':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Suspended':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      case 'Rejected':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
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

  const handleQuickDecisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReviewClient) return;

    reviewKyc(
      quickReviewClient.id,
      quickDecision,
      quickNotes || 'Reviewed and updated by authorized officer.',
      ['Identity Verified', 'Document Authenticity Confirmed']
    );
    setQuickReviewClient(null);
    setQuickNotes('');
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Client Registration & KYC Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
              Module 1: Client KYC & Onboarding
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Maintain client records, verify identity documents, execute KYC reviews, and track status lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {canRegister && (
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs shadow-md shadow-blue-600/20"
            >
              <UserPlus className="w-4 h-4" />
              Register New Client
            </button>
          )}
        </div>
      </div>

      {/* Role-Based Access Control Banner */}
      <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-300 font-bold">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs">Security & RBAC Enforcement:</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-200 text-[10px] font-mono font-bold border border-blue-400/30">
                {currentUser.name} ({currentUser.role})
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {canChangeStatus
                ? 'Full Authorization: You can register clients, execute KYC reviews, and modify client statuses.'
                : canReviewKyc
                ? 'Reviewer Authorization: You can register clients and evaluate KYC document verifications.'
                : 'Auditor View: Read-only access to client data with audit trail monitoring.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-300 self-end sm:self-center">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            256-bit Encrypted
          </span>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Clients</span>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">{totalCount}</p>
          <span className="text-[10px] text-slate-500">Across active branches</span>
        </div>

        <div className="p-3.5 bg-white border border-emerald-100 rounded-xl shadow-xs">
          <span className="text-[10px] uppercase font-bold text-emerald-600">Active Clients</span>
          <p className="text-xl font-extrabold text-emerald-700 mt-0.5">{activeCount}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Good standing</span>
        </div>

        <div className="p-3.5 bg-white border border-amber-100 rounded-xl shadow-xs">
          <span className="text-[10px] uppercase font-bold text-amber-600">Pending KYC</span>
          <p className="text-xl font-extrabold text-amber-700 mt-0.5">{pendingKycCount}</p>
          <span className="text-[10px] text-amber-600 font-medium">Requires verification</span>
        </div>

        <div className="p-3.5 bg-white border border-rose-100 rounded-xl shadow-xs">
          <span className="text-[10px] uppercase font-bold text-rose-600">Suspended</span>
          <p className="text-xl font-extrabold text-rose-700 mt-0.5">{suspendedCount}</p>
          <span className="text-[10px] text-rose-600 font-medium">Blocked/investigation</span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Inactive</span>
          <p className="text-xl font-extrabold text-slate-600 mt-0.5">{inactiveCount}</p>
          <span className="text-[10px] text-slate-400">Dormant accounts</span>
        </div>

        <div className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-xs">
          <span className="text-[10px] uppercase font-bold text-gray-500">Rejected</span>
          <p className="text-xl font-extrabold text-gray-700 mt-0.5">{rejectedCount}</p>
          <span className="text-[10px] text-gray-500">Compliance failed</span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('directory')}
          className={`pb-3 px-3 font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'directory'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Client Directory & Profiles
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
            {displayedClients.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('kycQueue')}
          className={`pb-3 px-3 font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'kycQueue'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          KYC Verification Queue
          {pendingKycCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
              {pendingKycCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pipeline')}
          className={`pb-3 px-3 font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'pipeline'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          5-Step Onboarding Pipeline
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700">
            {membershipApplications.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-3 font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          Status Logs & Compliance Trail
        </button>
      </div>

      {/* TAB 1: CLIENT DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by client name, Client ID (CLI-...), phone, ID number, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[11px] font-medium">Status:</span>
                <select
                  value={clientStatusFilter}
                  onChange={(e) => setClientStatusFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[11px] font-medium">KYC:</span>
                <select
                  value={kycStatusFilter}
                  onChange={(e) => setKycStatusFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All KYC</option>
                  <option value="Verified">Verified</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Correction Requested">Correction Requested</option>
                  <option value="Incomplete">Incomplete</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[11px] font-medium">Livelihood:</span>
                <select
                  value={employmentFilter}
                  onChange={(e) => setEmploymentFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Livelihoods</option>
                  <option value="Business Owner">Business Owner</option>
                  <option value="Self-Employed">Self-Employed</option>
                  <option value="Employed">Employed</option>
                  <option value="Farmer">Farmer</option>
                </select>
              </div>
            </div>
          </div>

          {/* Client Cards Grid / Table */}
          {displayedClients.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <Users className="w-12 h-12 mx-auto text-slate-300" />
              <h3 className="font-bold text-slate-800 text-sm">No clients matching criteria</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Try adjusting your search terms, client status, or KYC filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedClients.map((client) => {
                const branch = branches.find((b) => b.id === client.branchId);
                const status = client.clientStatus || client.memberStatus || 'Active';
                const docCount = (client.kycDocuments || []).length;

                return (
                  <div
                    key={client.id}
                    className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3 group"
                  >
                    {/* Header Strip */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={client.avatar}
                          alt={client.fullName}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition">
                            {client.fullName}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              {client.borrowerNumber || client.clientId}
                            </span>
                            <span className="text-[11px] text-slate-400">• {branch?.name || 'Main'}</span>
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(status)}`}>
                        {status}
                      </span>
                    </div>

                    {/* Information Grid */}
                    <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 text-[11px]">KYC Verification</span>
                        <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${getKycBadge(client.kycStatus)}`}>
                          {client.kycStatus || 'Verified'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 text-[11px]">Livelihood / Job</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[170px]">
                          {client.occupation}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 text-[11px]">Monthly Income</span>
                        <span className="font-bold text-slate-900">{formatCurrency(client.monthlyIncome)}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 text-[11px]">Address / Location</span>
                        <span className="text-slate-700 truncate max-w-[170px]">
                          {client.barangay ? `${client.barangay}, ` : ''}{client.city || client.address}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        {docCount} {docCount === 1 ? 'doc' : 'docs'} attached
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedClientForProfile(client)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold text-xs transition flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Profile
                        </button>

                        {canReviewKyc && client.kycStatus !== 'Verified' && (
                          <button
                            onClick={() => {
                              setQuickReviewClient(client);
                              setQuickDecision('APPROVED');
                            }}
                            className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-semibold text-xs transition flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            KYC
                          </button>
                        )}

                        {onOpenNewLoanForClient && (
                          <button
                            onClick={() => onOpenNewLoanForClient(client)}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="Originate Loan"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: KYC VERIFICATION QUEUE */}
      {activeTab === 'kycQueue' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm">KYC Verification & Compliance Desk</h3>
              <p className="mt-0.5 text-amber-800">
                Staff must verify that the applicant's Primary Government ID, Proof of Income, and Residence matches their registration details before approving loans or full membership.
              </p>
            </div>
          </div>

          {kycQueueClients.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
              <h3 className="font-bold text-slate-800 text-sm">KYC Queue is Clear!</h3>
              <p className="text-xs text-slate-400">All registered clients have been verified and processed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {kycQueueClients.map((client) => (
                <div
                  key={client.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={client.avatar}
                      alt={client.fullName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{client.fullName}</h3>
                        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-bold">
                          {client.borrowerNumber || client.clientId}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getKycBadge(client.kycStatus)}`}>
                          {client.kycStatus}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {client.idType}: <span className="font-mono font-semibold text-slate-700">{client.idNumber}</span> • {client.occupation} ({client.employerOrBusiness})
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Income: {formatCurrency(client.monthlyIncome)} • Address: {client.address}, {client.city}
                      </p>
                      {client.kycCorrectionNotes && (
                        <p className="text-[11px] text-orange-800 bg-orange-50 p-1.5 rounded-lg border border-orange-200 mt-2">
                          <strong>Active Correction Request:</strong> {client.kycCorrectionNotes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => setSelectedClientForProfile(client)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Files
                    </button>

                    {canReviewKyc && (
                      <button
                        onClick={() => {
                          setQuickReviewClient(client);
                          setQuickDecision('APPROVED');
                        }}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Execute KYC Review
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 5-STEP MEMBERSHIP PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
            <h3 className="font-bold text-sm text-slate-900">Cooperative Membership Onboarding Workflow</h3>
            <p className="text-slate-500">
              Under RA 9520 (Philippine Cooperative Code), regular member-borrowers undergo a 5-step lifecycle:
              Application Submission → Staff Verification & PMES Seminar → CBU / Capital Payment → Background Investigation → BOD Approval.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { step: 'SUBMITTED', title: '1. Application Filed', desc: 'Pre-membership intake' },
              { step: 'STAFF_VERIFIED', title: '2. Staff & PMES', desc: 'Document audit & seminar' },
              { step: 'PAYMENT_PROCESSED', title: '3. Capital Payment', desc: 'Initial share capital' },
              { step: 'EDUCATION_COMM_BI', title: '4. BI & Inspection', desc: 'Education comm report' },
              { step: 'BOD_APPROVED', title: '5. BOD Resolution', desc: 'Full member & book record' },
            ].map((s) => {
              const count = membershipApplications.filter((a) => a.currentStep === s.step).length;
              return (
                <div key={s.step} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-blue-600">{s.title}</span>
                  <p className="text-lg font-extrabold text-slate-900">{count}</p>
                  <p className="text-[10px] text-slate-400">{s.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            {membershipApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{app.applicantName}</span>
                    <span className="font-mono text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold">
                      {app.applicationNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      Step: {app.currentStep}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-1">
                    Phone: {app.phone} • Income: {formatCurrency(app.monthlyIncome)} • Initial CBU: {formatCurrency(app.initialShareCapital)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {app.currentStep === 'SUBMITTED' && (
                    <button
                      onClick={() => staffVerifyMembershipApp(app.id, 2000)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition"
                    >
                      Verify & Log PMES
                    </button>
                  )}
                  {app.currentStep === 'PAYMENT_PROCESSED' && (
                    <button
                      onClick={() =>
                        educationCommRecordBI(app.id, {
                          investigatorName: currentUser.name,
                          investigationDate: new Date().toISOString().split('T')[0],
                          residenceConfirmed: true,
                          incomeSourceVerified: true,
                          pmesSeminarAttended: true,
                          findingsNotes: 'Passed background investigation and residency confirmation.',
                          communityReputation: 'Excellent',
                          recommendation: 'RECOMMEND_APPROVAL',
                        })
                      }
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition"
                    >
                      Record BI Report
                    </button>
                  )}
                  {app.currentStep === 'EDUCATION_COMM_BI' && (
                    <button
                      onClick={() => bodApproveMembershipApp(app.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition"
                    >
                      BOD Approval
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL & STATUS HISTORY */}
      {activeTab === 'audit' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              Client Status & KYC Compliance Logs
            </h3>
            <p className="text-slate-500">
              Complete audit trail of all status updates, suspensions, reactivations, and KYC verification approvals across all branches.
            </p>

            <div className="space-y-2.5 pt-2">
              {filteredBorrowers.flatMap((b) => (b.statusLogs || []).map((log) => ({ ...log, clientName: b.fullName, clientId: b.borrowerNumber || b.clientId }))).length === 0 ? (
                <p className="text-slate-400 italic p-4 text-center">No status changes recorded yet.</p>
              ) : (
                filteredBorrowers
                  .flatMap((b) =>
                    (b.statusLogs || []).map((log) => ({
                      ...log,
                      clientName: b.fullName,
                      clientId: b.borrowerNumber || b.clientId,
                    }))
                  )
                  .map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{log.clientName}</span>
                            <span className="font-mono text-[10px] text-slate-500">({log.clientId})</span>
                            <span className="font-semibold text-blue-700">• {log.fromStatus} → {log.toStatus}</span>
                          </div>
                          <p className="text-slate-600 mt-1">{log.reason}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Authorized Actor: {log.changedBy}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{log.date}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW CLIENT */}
      <ClientRegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onClientRegistered={(newClient) => {
          setSelectedClientForProfile(newClient);
        }}
      />

      {/* MODAL: FULL CLIENT PROFILE */}
      <ClientProfileModal
        client={selectedClientForProfile}
        isOpen={!!selectedClientForProfile}
        onClose={() => setSelectedClientForProfile(null)}
        onOpenNewLoan={onOpenNewLoanForClient}
        onEditClient={(clientToEdit) => {
          setEditBorrower(clientToEdit);
          setIsEditModalOpen(true);
        }}
      />

      {/* MODAL: EDIT CLIENT INFORMATION */}
      <BorrowerModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditBorrower(null);
        }}
        editBorrower={editBorrower}
      />

      {/* MODAL: QUICK KYC DECISION */}
      {quickReviewClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                KYC Review: {quickReviewClient.fullName}
              </h3>
              <button onClick={() => setQuickReviewClient(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickDecisionSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'APPROVED', label: 'Approve', color: 'bg-emerald-50 text-emerald-800 border-emerald-400' },
                    { id: 'CORRECTION_REQUESTED', label: 'Correction', color: 'bg-orange-50 text-orange-800 border-orange-400' },
                    { id: 'REJECTED', label: 'Reject', color: 'bg-rose-50 text-rose-800 border-rose-400' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setQuickDecision(d.id as any)}
                      className={`p-2 rounded-xl border text-center font-bold transition ${
                        quickDecision === d.id ? `${d.color} ring-2 ring-blue-500/20` : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Officer Notes</label>
                <textarea
                  rows={3}
                  required={quickDecision !== 'APPROVED'}
                  placeholder="Enter remarks or correction instructions..."
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickReviewClient(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Confirm Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
