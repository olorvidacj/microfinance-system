import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  FileCheck,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Eye,
  FileText,
  Phone,
  Mail,
  ShieldCheck,
  Send,
  Calendar,
  DollarSign,
  Briefcase,
  Home,
  MessageSquare,
  Facebook,
  UserCheck,
  XCircle,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import {
  MembershipApplication,
  MemberUpdateRequest,
  Borrower,
  MemberFollowUpLog,
  BackgroundInvestigation,
  UpdateChannel,
} from '../types';
import { formatCurrency } from '../utils/loanMath';

export const MembershipView: React.FC = () => {
  const {
    membershipApplications,
    memberUpdateRequests,
    memberFollowUpLogs,
    borrowers,
    currentUser,
    submitMembershipApplication,
    staffVerifyMembershipApp,
    educationCommRecordBI,
    bodApproveMembershipApp,
    rejectMembershipApp,
    submitMemberUpdateRequest,
    approveMemberUpdateRequest,
    rejectMemberUpdateRequest,
    logMemberFollowUp,
    reactivateMember,
  } = useLoan();

  const [activeSubTab, setActiveSubTab] = useState<'applications' | 'updates' | 'inactive' | 'members'>(
    'applications'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [showNewAppModal, setShowNewAppModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<MembershipApplication | null>(null);
  const [showBIModal, setShowBIModal] = useState(false);
  const [showNewUpdateModal, setShowNewUpdateModal] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<MemberUpdateRequest | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedMemberForFollowUp, setSelectedMemberForFollowUp] = useState<Borrower | null>(null);
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<Borrower | null>(null);

  // New Application Form State
  const [newAppForm, setNewAppForm] = useState({
    applicantName: '',
    dateOfBirth: '1992-05-14',
    civilStatus: 'Single' as 'Single' | 'Married' | 'Widowed' | 'Separated',
    phone: '0917-555-0199',
    email: '',
    facebookAccount: '',
    address: 'Brgy. San Jose, Pasig City',
    occupation: 'Teacher / Small Business Owner',
    employerOrBusiness: 'Department of Education / Sari-Sari Store',
    monthlyIncome: 32000,
    validIdAttached: true,
    proofOfIncomeAttached: true,
    twoByTwoPhotoAttached: true,
    initialShareCapital: 2000,
  });

  // Background Investigation Form State
  const [biForm, setBiForm] = useState<BackgroundInvestigation>({
    investigatorName: '',
    investigationDate: new Date().toISOString().split('T')[0],
    communityReputation: 'Satisfactory',
    residenceConfirmed: false,
    incomeSourceVerified: false,
    pmesSeminarAttended: false,
    recommendation: 'CONDITIONAL',
    findingsNotes: 'Confirmed permanent resident for over 4 years. Good standing in community. Satisfactory PMES seminar engagement.',
  });

  // New Member Update Request Form State
  const [updateForm, setUpdateForm] = useState<{
    memberId: string;
    channel: UpdateChannel;
    fieldToUpdate: 'Civil Status' | 'Address' | 'Contact Number' | 'Employment' | 'Beneficiary';
    newValue: string;
    reason: string;
    supportingDocType: 'Marriage Contract' | 'Barangay Certificate' | 'Valid ID' | 'Proof of Billing' | 'Other';
    supportingDocFileName: string;
  }>({
    memberId: '',
    channel: 'Office Visit',
    fieldToUpdate: 'Civil Status',
    newValue: 'Married (Spouse: Roberto Santos)',
    reason: 'Recent marriage on Oct 12, 2025. Requesting update in cooperative records.',
    supportingDocType: 'Marriage Contract',
    supportingDocFileName: 'Official_Marriage_Certificate_PSA.pdf',
  });

  // Follow-up Form State
  const [followUpForm, setFollowUpForm] = useState<{
    contactChannel: 'Facebook' | 'SMS' | 'Phone Call' | 'Education Committee Field Visit';
    purpose: 'Inactivity Check' | 'Loan Follow-up' | 'Savings Reactivation' | 'General Welfare';
    memberResponse: string;
    actionTaken: 'Payment Promised' | 'Restructuring Requested' | 'Contact Updated' | 'No Answer' | 'Reactivated';
    nextFollowUpDate: string;
  }>({
    contactChannel: 'Facebook',
    purpose: 'Loan Follow-up',
    memberResponse: 'Member replied on FB Messenger promising to visit branch to deposit and settle balance on Friday.',
    actionTaken: 'Payment Promised',
    nextFollowUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  // Filtered lists
  const filteredApps = membershipApplications.filter((app) => {
    const matchesSearch =
      app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.phone.includes(searchTerm);
    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && app.currentStep === statusFilter;
  });

  const inactiveMembers = borrowers.filter((b) => {
    const isInactive = b.memberStatus === 'Inactive' || b.memberStatus === 'Irregular';
    const matchesSearch =
      b.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.borrowerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.phone.includes(searchTerm);
    return isInactive && matchesSearch;
  });

  const handleCreateApplication = (e: React.FormEvent) => {
    e.preventDefault();
    submitMembershipApplication(newAppForm);
    setShowNewAppModal(false);
  };

  const handleSaveBI = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    educationCommRecordBI(selectedApp.id, biForm);
    setShowBIModal(false);
    setSelectedApp(null);
  };

  const handleCreateUpdateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    submitMemberUpdateRequest(updateForm);
    setShowNewUpdateModal(false);
  };

  const handleSaveFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForFollowUp) return;
    logMemberFollowUp({
      memberId: selectedMemberForFollowUp.id,
      memberName: selectedMemberForFollowUp.fullName,
      memberNumber: selectedMemberForFollowUp.borrowerNumber,
      contactChannel: followUpForm.contactChannel,
      purpose: followUpForm.purpose,
      memberResponse: followUpForm.memberResponse,
      actionTaken: followUpForm.actionTaken,
      nextFollowUpDate: followUpForm.nextFollowUpDate,
      outstandingLoanAmount: selectedMemberForFollowUp.totalBorrowed - selectedMemberForFollowUp.totalRepaid,
    });
    setShowFollowUpModal(false);
    setSelectedMemberForFollowUp(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner: Cooperative Membership Workflow Overview */}
      <div className="bg-gradient-to-r from-navy-950 to-navy-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/20 text-slate-300 border border-gold-400/30 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-gold-300" />
              1. Membership Services Module
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cooperative Membership & Governance</h1>
            <p className="text-sm text-slate-300/90 max-w-2xl leading-relaxed">
              Complete 5-step approval pipeline from application to Board of Directors sign-off (~1 month), member info updates via multiple channels, and proactive inactive member monitoring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="new-mem-app-btn"
              onClick={() => setShowNewAppModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gold-500 hover:bg-navy-900 text-white rounded-xl text-sm font-semibold transition shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              New Membership Application
            </button>
            <button
              id="new-mem-update-btn"
              onClick={() => setShowNewUpdateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-medium transition"
            >
              <FileText className="w-4 h-4" />
              Request Member Info Update
            </button>
          </div>
        </div>

        {/* 5-Step Process Timeline Cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-5 gap-3 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-gold-300">
              <span className="w-5 h-5 rounded-full bg-gold-500/30 flex items-center justify-center text-[10px] text-white">1</span>
              Submission
            </div>
            <p className="text-xs font-medium text-white mt-1">Application & Requirements</p>
            <p className="text-[11px] text-slate-300/70 mt-0.5">Valid ID, Proof of Income, 2x2 Photo</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <span className="w-5 h-5 rounded-full bg-amber-500/30 flex items-center justify-center text-[10px] text-white">2</span>
              Staff Verification
            </div>
            <p className="text-xs font-medium text-white mt-1">Check, Encode & Fee</p>
            <p className="text-[11px] text-amber-200/70 mt-0.5">₱500 Fee + Initial Share Capital</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
              <span className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-[10px] text-white">3</span>
              Education Comm.
            </div>
            <p className="text-xs font-medium text-white mt-1">B.I. & PMES Seminar</p>
            <p className="text-[11px] text-purple-200/70 mt-0.5">Background Investigation rating</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <span className="w-5 h-5 rounded-full bg-emerald-500/30 flex items-center justify-center text-[10px] text-white">4</span>
              Board Approval
            </div>
            <p className="text-xs font-medium text-white mt-1">BOD Final Review</p>
            <p className="text-[11px] text-emerald-200/70 mt-0.5">~1 Month Complete Timeline</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <span className="w-5 h-5 rounded-full bg-cyan-500/30 flex items-center justify-center text-[10px] text-white">5</span>
              Full Member
            </div>
            <p className="text-xs font-medium text-white mt-1">Passbook & Savings</p>
            <p className="text-[11px] text-cyan-200/70 mt-0.5">Eligible for savings & loans</p>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('applications')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'applications'
              ? 'border-gold-500 text-gold-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Membership Applications ({membershipApplications.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('updates')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'updates'
              ? 'border-gold-500 text-gold-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Info Update Requests ({memberUpdateRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('inactive')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'inactive'
              ? 'border-gold-500 text-gold-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>Inactive & Field Visits ({inactiveMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'members'
              ? 'border-gold-500 text-gold-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Master Member Directory ({borrowers.length})</span>
        </button>
      </div>

      {/* ========================================== */}
      {/* SUB-TAB 1: MEMBERSHIP APPLICATIONS PIPELINE */}
      {/* ========================================== */}
      {activeSubTab === 'applications' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search applicant name, number, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700"
              >
                <option value="ALL">All Application Stages</option>
                <option value="SUBMITTED">1. Submitted (Pending Staff)</option>
                <option value="PAYMENT_PROCESSED">2. Encoded & Fee Paid (Pending B.I.)</option>
                <option value="EDUCATION_COMM_BI">3. B.I. Completed (Pending BOD)</option>
                <option value="BOD_APPROVED">4. BOD Approved (Active Member)</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Applications List */}
          <div className="grid grid-cols-1 gap-4">
            {filteredApps.map((app) => {
              const isSubmitted = app.currentStep === 'SUBMITTED';
              const isEncoded = app.currentStep === 'PAYMENT_PROCESSED';
              const isBICompleted = app.currentStep === 'EDUCATION_COMM_BI';
              const isApproved = app.currentStep === 'BOD_APPROVED';
              const isRejected = app.currentStep === 'REJECTED';

              return (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:border-gold-400/30 transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Applicant Primary Info */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gold-500/10 border border-gold-400/30 flex items-center justify-center text-gold-600 font-bold text-lg">
                        {app.applicantName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{app.applicantName}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                            {app.applicationNumber}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                          <span>📞 {app.phone}</span>
                          <span>🏢 {app.occupation}</span>
                          <span>💍 {app.civilStatus}</span>
                          {app.facebookAccount && <span className="text-gold-600 font-medium">FB: {app.facebookAccount}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Step Status Badge */}
                    <div className="flex items-center gap-3">
                      {isSubmitted && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/10 text-gold-700 border border-gold-400/30 text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5 text-gold-600" />
                          Step 1: Submitted (Pending Staff Check)
                        </span>
                      )}
                      {isEncoded && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                          <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                          Step 2: Encoded & Fee Paid (Pending B.I.)
                        </span>
                      )}
                      {isBICompleted && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                          Step 3: B.I. Finished (Pending BOD Approval)
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Step 4: BOD Approved (Active Member)
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Application Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Requirements & Investigation Summary Pillbox */}
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <div className="text-slate-400">Required Documents</div>
                      <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                        {app.validIdAttached && app.proofOfIncomeAttached && app.twoByTwoPhotoAttached ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Complete (ID, Income, 2x2)
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Incomplete Docs
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <div className="text-slate-400">Membership Fee & Capital</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {app.membershipFeePaid ? (
                          <span className="text-emerald-700">₱500 Paid + ₱{app.initialShareCapital?.toLocaleString()} CBU</span>
                        ) : (
                          <span className="text-amber-600 font-medium">₱500 Pending Collection</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <div className="text-slate-400">Education Comm. B.I.</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {app.backgroundInvestigation ? (
                          <span className="text-purple-700 font-medium">
                            {app.backgroundInvestigation.recommendation} ({app.backgroundInvestigation.communityReputation})
                          </span>
                        ) : (
                          <span className="text-slate-400">Awaiting Investigation</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <div className="text-slate-400">Approval Timeline</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        Target: {app.targetCompletionDate} (~1 mo.)
                      </div>
                    </div>
                  </div>

                  {/* Actions for current step */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-400">
                      Submitted: {app.submittedDate} • Monthly Income: ₱{app.monthlyIncome.toLocaleString()}
                    </div>

                    <div className="flex items-center gap-2">
                      {isSubmitted && (
                        <button
                          onClick={() => staffVerifyMembershipApp(app.id, app.initialShareCapital)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          Encode Info & Process ₱500 Fee
                        </button>
                      )}

                      {isEncoded && (
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setShowBIModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Education Comm: Conduct B.I. & PMES
                        </button>
                      )}

                      {isBICompleted && (
                        <button
                          onClick={() => bodApproveMembershipApp(app.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Board of Directors: Approve Membership
                        </button>
                      )}

                      {!isApproved && !isRejected && (
                        <button
                          onClick={() => rejectMembershipApp(app.id, 'Did not meet cooperative membership qualification requirements')}
                          className="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-medium transition"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 2: MEMBER INFORMATION UPDATE REQUESTS */}
      {/* ========================================== */}
      {activeSubTab === 'updates' && (
        <div className="space-y-4">
          <div className="bg-gold-500/10 border border-gold-400/30 rounded-2xl p-4 flex items-start gap-3 text-sm text-navy-900">
            <Info className="w-5 h-5 text-gold-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Cooperative Member Information Policy:</span> Members can request updates to personal information via office visit, mobile, or Facebook. Required supporting documents (e.g. Marriage Contract for civil status change to married) must be submitted and verified before approval.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {memberUpdateRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:border-slate-200 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{req.memberName}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                        {req.memberNumber}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-gold-500/10 text-gold-700 font-medium">
                        Via {req.channel}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Requested on {req.requestDate}</div>
                  </div>

                  <div>
                    {req.status === 'Approved' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Approved & Updated in Master File
                      </span>
                    ) : req.status === 'Rejected' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Pending Verification
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400">Field to Update:</span>
                    <p className="font-bold text-slate-800 mt-0.5">{req.fieldToUpdate}</p>
                    <p className="text-slate-500 mt-0.5">Previous: {req.oldValue || 'None'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">New Value Requested:</span>
                    <p className="font-bold text-gold-600 mt-0.5">{req.newValue}</p>
                    <p className="text-slate-500 mt-0.5">{req.reason}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Supporting Document:</span>
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-700 mt-0.5">
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>{req.supportingDocType}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono truncate block mt-0.5">
                      {req.supportingDocFileName}
                    </span>
                  </div>
                </div>

                {req.status === 'Pending' && (
                  <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => rejectMemberUpdateRequest(req.id, 'Supporting document unverified')}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-medium text-slate-700"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => approveMemberUpdateRequest(req.id)}
                      className="px-4 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold"
                    >
                      Verify Document & Approve Update
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 3: INACTIVE & IRREGULAR MEMBERS MONITORING */}
      {/* ========================================== */}
      {activeSubTab === 'inactive' && (
        <div className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-sm text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Inactive & Irregular Member Protocol:</span> Member accounts are regularly monitored for inactivity. Members with outstanding loans are actively contacted through their Facebook accounts, mobile SMS, or directly visited by the Education Committee to encourage reactivation and settlement.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {inactiveMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:border-amber-200 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <img
                      src={member.avatar}
                      alt={member.fullName}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{member.fullName}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                          {member.borrowerNumber}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            member.memberStatus === 'Inactive'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {member.memberStatus} Status
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                        <span>📞 {member.phone}</span>
                        {member.facebookAccount && (
                          <span className="text-gold-600 font-medium">FB: {member.facebookAccount}</span>
                        )}
                        <span>📍 {member.address}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Savings Balance</div>
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(member.savingsBalance)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Active Loans</div>
                      <div className="text-sm font-bold text-rose-600">
                        {member.activeLoansCount > 0 ? `${member.activeLoansCount} Active Loan(s)` : 'No Active Loan'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Follow-up Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Last Account Activity: {member.lastActivityDate || 'Over 90 days ago'}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedMemberForFollowUp(member);
                        setShowFollowUpModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Log Facebook / Field Follow-Up
                    </button>

                    <button
                      onClick={() => reactivateMember(member.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-semibold transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Reactivate Account
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Follow-up Logs Ledger */}
          <div className="mt-8 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gold-600" />
              Follow-Up & Field Visit Audit History ({memberFollowUpLogs.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Member</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Conducted By</th>
                    <th className="py-2.5 px-3">Response</th>
                    <th className="py-2.5 px-3">Action Taken</th>
                    <th className="py-2.5 px-3">Next Visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {memberFollowUpLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{log.date}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{log.memberName}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-700 font-medium">
                          {log.contactChannel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{log.conductedBy}</td>
                      <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate">{log.memberResponse}</td>
                      <td className="py-2.5 px-3 font-medium text-emerald-700">{log.actionTaken}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{log.nextFollowUpDate || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 4: MASTER MEMBER DIRECTORY */}
      {/* ========================================== */}
      {activeSubTab === 'members' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Cooperative Members Directory</h3>
            <span className="text-xs text-slate-500 font-mono">{borrowers.length} Registered Members</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-3.5">Member Name</th>
                  <th className="py-3 px-3.5">Member ID</th>
                  <th className="py-3 px-3.5">Civil Status</th>
                  <th className="py-3 px-3.5">Savings Balance</th>
                  <th className="py-3 px-3.5">Share Capital</th>
                  <th className="py-3 px-3.5">Active Loans</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {borrowers.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <img src={b.avatar} alt={b.fullName} className="w-7 h-7 rounded-full object-cover" />
                        <div>
                          <div className="font-semibold text-slate-900">{b.fullName}</div>
                          <div className="text-[11px] text-slate-400">{b.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-600">{b.borrowerNumber}</td>
                    <td className="py-3 px-3.5 font-medium text-slate-700">{b.civilStatus}</td>
                    <td className="py-3 px-3.5 font-bold text-slate-900">{formatCurrency(b.savingsBalance)}</td>
                    <td className="py-3 px-3.5 font-bold text-gold-700">{formatCurrency(b.shareCapital)}</td>
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${b.activeLoansCount > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                        {b.activeLoansCount} active
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${b.memberStatus === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                        {b.memberStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        onClick={() => setSelectedMemberDetail(b)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium text-[11px]"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 1: NEW MEMBERSHIP APPLICATION */}
      {/* ========================================== */}
      {showNewAppModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gold-500/20 text-gold-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">New Membership Application Form</h3>
                  <p className="text-xs text-slate-400">Step 1: Submission of Application & Required Documents</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewAppModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Applicant Name *</label>
                  <input
                    type="text"
                    required
                    value={newAppForm.applicantName}
                    onChange={(e) => setNewAppForm({ ...newAppForm, applicantName: e.target.value })}
                    placeholder="e.g. Maria Teresa Cruz"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Civil Status *</label>
                  <select
                    value={newAppForm.civilStatus}
                    onChange={(e) => setNewAppForm({ ...newAppForm, civilStatus: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Contact *</label>
                  <input
                    type="text"
                    required
                    value={newAppForm.phone}
                    onChange={(e) => setNewAppForm({ ...newAppForm, phone: e.target.value })}
                    placeholder="0917-000-0000"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Facebook Account Name</label>
                  <input
                    type="text"
                    value={newAppForm.facebookAccount}
                    onChange={(e) => setNewAppForm({ ...newAppForm, facebookAccount: e.target.value })}
                    placeholder="e.g. Maria Cruz Official"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address *</label>
                  <input
                    type="text"
                    required
                    value={newAppForm.address}
                    onChange={(e) => setNewAppForm({ ...newAppForm, address: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Occupation / Business *</label>
                  <input
                    type="text"
                    required
                    value={newAppForm.occupation}
                    onChange={(e) => setNewAppForm({ ...newAppForm, occupation: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Gross Income (₱) *</label>
                  <input
                    type="number"
                    required
                    value={newAppForm.monthlyIncome}
                    onChange={(e) => setNewAppForm({ ...newAppForm, monthlyIncome: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Requirements Checklist */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Mandatory Submission Requirements Checklist
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newAppForm.validIdAttached}
                      onChange={(e) => setNewAppForm({ ...newAppForm, validIdAttached: e.target.checked })}
                      className="rounded text-gold-600"
                    />
                    Valid Government ID
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newAppForm.proofOfIncomeAttached}
                      onChange={(e) => setNewAppForm({ ...newAppForm, proofOfIncomeAttached: e.target.checked })}
                      className="rounded text-gold-600"
                    />
                    Proof of Income / ITR
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newAppForm.twoByTwoPhotoAttached}
                      onChange={(e) => setNewAppForm({ ...newAppForm, twoByTwoPhotoAttached: e.target.checked })}
                      className="rounded text-gold-600"
                    />
                    2x2 ID Photos (2 copies)
                  </label>
                </div>
              </div>

              <div className="bg-gold-500/10 p-3.5 rounded-2xl border border-gold-400/30 text-xs text-navy-900">
                <span className="font-bold">Next Stage:</span> Staff encodes info and collects ₱500 membership fee + initial share capital, followed by Education Committee Background Investigation and Board of Directors Approval (~1 month total).
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewAppModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-sm font-semibold shadow-xs"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: EDUCATION COMMITTEE B.I. EVALUATION */}
      {/* ========================================== */}
      {showBIModal && selectedApp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Education Committee B.I. & PMES</h3>
                  <p className="text-xs text-slate-400">Applicant: {selectedApp.applicantName}</p>
                </div>
              </div>
              <button onClick={() => setShowBIModal(false)} className="text-slate-400 text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveBI} className="mt-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Investigator / Committee Member</label>
                <input
                  type="text"
                  required
                  value={biForm.investigatorName}
                  onChange={(e) => setBiForm({ ...biForm, investigatorName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={biForm.pmesSeminarAttended}
                    onChange={(e) => setBiForm({ ...biForm, pmesSeminarAttended: e.target.checked })}
                    className="rounded text-purple-600"
                  />
                  <span className="font-semibold text-slate-800">PMES Attended</span>
                </label>

                <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={biForm.residenceConfirmed}
                    onChange={(e) => setBiForm({ ...biForm, residenceConfirmed: e.target.checked })}
                    className="rounded text-purple-600"
                  />
                  <span className="font-semibold text-slate-800">Residence Confirmed</span>
                </label>

                <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={biForm.incomeSourceVerified}
                    onChange={(e) => setBiForm({ ...biForm, incomeSourceVerified: e.target.checked })}
                    className="rounded text-purple-600"
                  />
                  <span className="font-semibold text-slate-800">Income Verified</span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Community Reputation / Standing</label>
                <select
                  value={biForm.communityReputation}
                  onChange={(e) => setBiForm({ ...biForm, communityReputation: e.target.value as any })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="Excellent">Excellent - Highly respected in neighborhood & parish</option>
                  <option value="Good">Good - Well-regarded, steady employment</option>
                  <option value="Satisfactory">Satisfactory - No disputes or criminal background</option>
                  <option value="Poor">Poor - Negative records or community disputes</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Investigation Findings & Remarks</label>
                <textarea
                  rows={2}
                  value={biForm.findingsNotes}
                  onChange={(e) => setBiForm({ ...biForm, findingsNotes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Committee Final Recommendation to Board</label>
                <select
                  value={biForm.recommendation}
                  onChange={(e) => setBiForm({ ...biForm, recommendation: e.target.value as any })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-purple-900"
                >
                  <option value="RECOMMEND_APPROVAL">Recommend for Full Approval</option>
                  <option value="CONDITIONAL">Conditional Approval</option>
                  <option value="DEFER">Defer for Further Background Checking</option>
                  <option value="REJECT">Reject Application</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBIModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold"
                >
                  Save B.I. & Forward to BOD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: NEW MEMBER INFO UPDATE REQUEST */}
      {/* ========================================== */}
      {showNewUpdateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gold-500/20 text-gold-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Request Member Information Update</h3>
                  <p className="text-xs text-slate-400">Office visit, Mobile or Facebook submission</p>
                </div>
              </div>
              <button onClick={() => setShowNewUpdateModal(false)} className="text-slate-400 text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateUpdateRequest} className="mt-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Cooperative Member *</label>
                <select
                  required
                  value={updateForm.memberId}
                  onChange={(e) => setUpdateForm({ ...updateForm, memberId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                >
                  <option value="">-- Choose Member --</option>
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName} ({b.borrowerNumber} - Current: {b.civilStatus})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Submission Channel *</label>
                  <select
                    value={updateForm.channel}
                    onChange={(e) => setUpdateForm({ ...updateForm, channel: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Office Visit">Office Visit</option>
                    <option value="Mobile">Mobile Phone / SMS</option>
                    <option value="Facebook">Facebook Messenger Account</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Field to Update *</label>
                  <select
                    value={updateForm.fieldToUpdate}
                    onChange={(e) => setUpdateForm({ ...updateForm, fieldToUpdate: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Civil Status">Civil Status (e.g. to Married)</option>
                    <option value="Address">Residential Address</option>
                    <option value="Contact Number">Mobile Contact</option>
                    <option value="Employment">Employer / Occupation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Value to Record *</label>
                <input
                  type="text"
                  required
                  value={updateForm.newValue}
                  onChange={(e) => setUpdateForm({ ...updateForm, newValue: e.target.value })}
                  placeholder="e.g. Married (Spouse: Roberto Santos)"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supporting Document Required *</label>
                  <select
                    value={updateForm.supportingDocType}
                    onChange={(e) => setUpdateForm({ ...updateForm, supportingDocType: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-navy-900"
                  >
                    <option value="Marriage Contract">Marriage Contract (PSA/Local)</option>
                    <option value="Barangay Certificate">Barangay Certificate</option>
                    <option value="Valid Government ID">Valid Government ID</option>
                    <option value="Proof of Billing">Proof of Billing</option>
                    <option value="Other">Other Official Document</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Document File Reference</label>
                  <input
                    type="text"
                    value={updateForm.supportingDocFileName}
                    onChange={(e) => setUpdateForm({ ...updateForm, supportingDocFileName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Update Request</label>
                <textarea
                  rows={2}
                  value={updateForm.reason}
                  onChange={(e) => setUpdateForm({ ...updateForm, reason: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewUpdateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-sm font-semibold"
                >
                  Submit Update Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 4: LOG FACEBOOK / FIELD VISIT FOLLOW-UP */}
      {/* ========================================== */}
      {showFollowUpModal && selectedMemberForFollowUp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Log Follow-Up & Contact</h3>
                  <p className="text-xs text-slate-400">Member: {selectedMemberForFollowUp.fullName}</p>
                </div>
              </div>
              <button onClick={() => setShowFollowUpModal(false)} className="text-slate-400 text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveFollowUp} className="mt-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Channel *</label>
                  <select
                    value={followUpForm.contactChannel}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, contactChannel: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Facebook">Facebook Messenger</option>
                    <option value="SMS">SMS Text Message</option>
                    <option value="Phone Call">Direct Phone Call</option>
                    <option value="Home Visit (Education Comm)">Home Visit (Education Comm)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Action Outcome *</label>
                  <select
                    value={followUpForm.actionTaken}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, actionTaken: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-emerald-800"
                  >
                    <option value="Payment Promised">Payment Promised</option>
                    <option value="Account Reactivated">Account Reactivated</option>
                    <option value="Restructuring Requested">Restructuring Requested</option>
                    <option value="Unable to Contact">Unable to Contact</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Member Response & Conversation Log *</label>
                <textarea
                  rows={3}
                  required
                  value={followUpForm.memberResponse}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, memberResponse: e.target.value })}
                  placeholder="Record member statements, payment commitments, or field observations..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Next Scheduled Follow-Up Date</label>
                <input
                  type="date"
                  value={followUpForm.nextFollowUpDate}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, nextFollowUpDate: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-sm font-semibold"
                >
                  Save Log Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
