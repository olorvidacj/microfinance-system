import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react';
import { StaffBranchAssignmentResponse } from '../types';
import { branchService } from '../services';

interface BranchAssignmentNoticeProps {
  assignmentData: StaffBranchAssignmentResponse | null;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  onAssignmentSuccess?: () => void;
}

export const BranchAssignmentNotice: React.FC<BranchAssignmentNoticeProps> = ({
  assignmentData,
  onRefresh,
  onLogout,
  onAssignmentSuccess,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSentMessage, setRequestSentMessage] = useState<string | null>(null);

  // Admin authorization simulation state
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPassword, setAdminPassword] = useState('Admin@123');
  const [adminAuthorizing, setAdminAuthorizing] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  const staff = assignmentData?.staff;
  const requiredBranch = assignmentData?.requiredBranch || {
    id: 'br-main',
    name: 'Tacloban Main Branch',
    code: 'TAC-MAIN',
    address: 'HOSCOMO Cooperative Building, Real Street, Tacloban City, Leyte',
    city: 'Tacloban City',
    phone: '+63 (053) 832-4190',
  };
  // Administrator contact delivered by the branch-assignment endpoint (derived from
  // the cooperative's seed data). Fallbacks reuse the same seeded records.
  const adminContact = assignmentData?.adminContact || {
    name: 'Elena Rostata',
    email: 'admin@hoscomo.coop',
    title: 'System Administrator & Operations Head',
    phone: '+63 (053) 832-4190',
    location: 'Tacloban Main Branch, HOSCOMO Bldg, Real Street',
  };
  const adminInitials =
    adminContact.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'SA';

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    setRefreshError(null);
    try {
      await onRefresh();
      const check = await branchService.getBranchAssignment();
      if (check.staff?.branch) {
        if (onAssignmentSuccess) {
          onAssignmentSuccess();
        }
      } else {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setRefreshMessage(
          `Checked HOSCOMO central directory at ${timeStr}. Account is still pending cooperative branch assignment by the System Administrator.`
        );
      }
    } catch (err: any) {
      setRefreshError(
        err?.message || 'Unable to communicate with HOSCOMO server. Please verify your connection.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyAccountInfo = () => {
    const text = [
      '--- HOSCOMO Staff Branch Assignment Request ---',
      `Staff Name: ${staff?.name || 'Staff Member'}`,
      `Staff ID: ${staff?.id || 'N/A'}`,
      `Email: ${staff?.email || 'N/A'}`,
      `Designation / Role: ${staff?.role || 'Staff'} (${staff?.title || 'Operational Staff'})`,
      'Current Branch: Not Assigned',
      `Target Branch: ${requiredBranch.name} (${requiredBranch.code})`,
      `Branch Location: ${requiredBranch.address}`,
      `Date Generated: ${new Date().toLocaleString()}`,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleSendRequestToAdmin = async () => {
    setSendingRequest(true);
    setRequestSentMessage(null);
    try {
      const res = await branchService.requestAssignment();
      setRequestSentMessage(
        res?.message || `Official assignment alert has been dispatched to ${adminContact.name} (System Administrator).`
      );
    } catch (err: any) {
      setRequestSentMessage(
        'Assignment request submitted to Administrator notifications queue.'
      );
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAdminAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff?.id) return;
    setAdminAuthorizing(true);
    setAdminAuthError(null);
    try {
      await branchService.assignBranch(staff.id, requiredBranch.id, adminPassword);
      await onRefresh();
      setIsContactModalOpen(false);
      if (onAssignmentSuccess) {
        onAssignmentSuccess();
      }
    } catch (err: any) {
      setAdminAuthError(err?.message || 'Failed to authorize branch assignment.');
    } finally {
      setAdminAuthorizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#091527] text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* Top HOSCOMO Brand Header */}
      <header className="border-b border-slate-800/80 bg-[#060e1a]/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/10">
            <Building2 className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                HOSCOMO Microfinance Cooperative
              </span>
              <span className="hidden sm:inline-flex items-center rounded-md bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                Staff Operations Portal
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-amber-400" />
              Tacloban, Leyte, Philippines · Main Operations Branch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
            <UserRound className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-medium text-slate-200">{staff?.name || 'Staff Member'}</span>
            <span className="text-[11px] text-slate-400 font-mono">({staff?.role || 'Staff'})</span>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Notice Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-3xl">
          {/* Ambient Glows */}
          <div className="relative">
            <div className="absolute -top-12 -left-12 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />

            {/* Alert Card */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0e1c31] shadow-2xl shadow-slate-950/60">
              {/* Card Accent Strip */}
              <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

              <div className="p-6 sm:p-8">
                {/* Header Badge & Title */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-800">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-400 shadow-inner">
                      <Building2 className="h-7 w-7 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300 mb-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        Branch Assignment Required
                      </div>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                        Cooperative Branch Assignment Required
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        HOSCOMO Microfinance Cooperative Security & Compliance Framework
                      </p>
                    </div>
                  </div>

                  <span className="self-start inline-flex items-center gap-1 rounded-md bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-xs font-bold text-rose-300">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                    Access Restricted
                  </span>
                </div>

                {/* Primary Official Notice Box */}
                <div className="my-6 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-amber-500/20 p-1.5 text-amber-400 mt-0.5 shrink-0">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-amber-200">
                        Official Notice
                      </p>
                      <p className="text-sm sm:text-base leading-relaxed text-slate-200 font-medium">
                        &ldquo;Your staff account is currently not assigned to a cooperative branch. Please contact your HOSCOMO System Administrator to assign you to Tacloban Main Branch.&rdquo;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Key Status Overview Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                  {/* Current Branch Box */}
                  <div className="rounded-xl border border-slate-800 bg-[#07111e] p-4">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Current Branch Status
                    </span>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-base font-bold text-slate-200">
                        Not Assigned
                      </span>
                      <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                        Pending
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Branch-level financial ledgers, disbursements, and loan underwritings are locked until assigned.
                    </p>
                  </div>

                  {/* Required Branch Box */}
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                      Required Cooperative Branch
                    </span>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-base font-bold text-emerald-200">
                        Tacloban Main Branch
                      </span>
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-xs font-mono font-bold text-emerald-300">
                        {requiredBranch.code}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300 leading-relaxed flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{requiredBranch.address}</span>
                    </p>
                  </div>
                </div>

                {/* Staff Credentials & Account Data Card */}
                <div className="rounded-xl border border-slate-800 bg-[#07111e]/80 p-4 sm:p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-amber-400" />
                      Staff Account Profile
                    </span>
                    <span className="text-[11px] text-slate-400">Authenticated via Core Security</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Staff Name</span>
                      <span className="font-semibold text-white mt-0.5 block truncate">
                        {staff?.name || 'Staff Member'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Staff ID</span>
                      <span className="font-mono font-semibold text-amber-300 mt-0.5 block truncate">
                        {staff?.id || 'staff-unassigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Work Email</span>
                      <span className="font-mono text-slate-300 mt-0.5 block truncate">
                        {staff?.email || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Operational Role</span>
                      <span className="font-semibold text-amber-400 mt-0.5 block truncate">
                        {staff?.role || 'LOAN_OFFICER'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messages: Refresh Feedback or Error */}
                {refreshMessage && (
                  <div className="mt-4 rounded-xl border border-gold-500/40 bg-gold-500/10 p-3.5 text-xs text-slate-300 flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-gold-400 mt-0.5 shrink-0" />
                    <span>{refreshMessage}</span>
                  </div>
                )}

                {refreshError && (
                  <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                    <span>{refreshError}</span>
                  </div>
                )}

                {/* Primary Action Buttons */}
                <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-5 border-t border-slate-800">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    {/* Contact System Administrator Button */}
                    <button
                      type="button"
                      onClick={() => setIsContactModalOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 transition hover:brightness-105 active:scale-95"
                    >
                      <Mail className="h-4 w-4 text-slate-950" />
                      <span>Contact System Administrator</span>
                    </button>

                    {/* Refresh Branch Assignment Button */}
                    <button
                      type="button"
                      onClick={handleRefreshClick}
                      disabled={isRefreshing}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition hover:border-amber-400 hover:bg-slate-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`h-4 w-4 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>{isRefreshing ? 'Checking Status…' : 'Refresh Branch Assignment'}</span>
                    </button>
                  </div>

                  {/* Sign Out Button */}
                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-300 transition hover:border-slate-700 hover:text-white active:scale-95"
                  >
                    <LogOut className="h-4 w-4 text-slate-400" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-3 px-6 text-center text-xs text-slate-400">
        HOSCOMO Microfinance Cooperative · Enterprise Staff Portal · Tacloban City, Leyte
      </footer>

      {/* Contact System Administrator Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0e1c31] text-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-[#0a1424]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    HOSCOMO System Administrator
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cooperative Branch Assignment Desk
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 leading-relaxed flex items-start gap-2.5">
                <HelpCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Please contact your system administrator to assign your cooperative branch. Once assigned, click &ldquo;Refresh Branch Assignment&rdquo; to access your operational dashboard.
                </span>
              </div>

              {/* Official Administrator Contact Profile */}
              <div className="rounded-xl border border-slate-800 bg-[#07111e] p-4 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Designated System Administrator
                </span>

                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 font-extrabold text-sm">
                    {adminInitials}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{adminContact.name}</h4>
                    <p className="text-xs text-amber-400 font-medium">{adminContact.title}</p>
                    <p className="text-[11px] text-slate-400">HOSCOMO Cooperative IT & Operations Directorate</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <a href={`mailto:${adminContact.email}`} className="hover:underline font-mono text-[11px]">
                      {adminContact.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="font-mono text-[11px]">{adminContact.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 sm:col-span-2">
                    <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="text-[11px]">{adminContact.location}</span>
                  </div>
                </div>
              </div>

              {/* Staff Account Summary for Reference */}
              <div className="rounded-xl border border-slate-800 bg-[#07111e]/80 p-4 space-y-2.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Your Account Details for Verification
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Staff Name:</span>
                    <span className="font-semibold text-white">{staff?.name || 'Staff Member'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Staff ID:</span>
                    <span className="font-mono text-amber-300 font-bold">{staff?.id || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Current Branch Status:</span>
                    <span className="font-semibold text-rose-400">Not Assigned</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Required Branch:</span>
                    <span className="font-semibold text-emerald-400">Tacloban Main Branch</span>
                  </div>
                </div>
              </div>

              {/* Dispatch Alert Message */}
              {requestSentMessage && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{requestSentMessage}</span>
                </div>
              )}

              {/* Administrator Assignment Action (For Testing / Case C Approval) */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                    <span>Administrator Authorization Desk</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdminAuth(!showAdminAuth)}
                    className="text-[11px] font-medium text-amber-400 hover:underline"
                  >
                    {showAdminAuth ? 'Hide Authorization' : 'Assign to Tacloban Branch'}
                  </button>
                </div>

                {showAdminAuth && (
                  <form onSubmit={handleAdminAssignSubmit} className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
                    <p className="text-[11px] text-slate-400">
                      Authorize branch assignment to <strong className="text-white">Tacloban Main Branch (TAC-MAIN)</strong> using System Administrator credentials:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Administrator Password"
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        disabled={adminAuthorizing}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {adminAuthorizing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Confirm & Assign</span>
                      </button>
                    </div>
                    {adminAuthError && (
                      <p className="text-[11px] text-rose-400 font-medium">{adminAuthError}</p>
                    )}
                  </form>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-slate-800 px-6 py-4 bg-[#0a1424]">
              <div className="flex items-center gap-2">
                {/* Copy Staff Account Information Button */}
                <button
                  type="button"
                  onClick={handleCopyAccountInfo}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400 hover:bg-slate-700 transition active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-amber-400" />
                      <span>Copy Account Information</span>
                    </>
                  )}
                </button>

                {/* Send Alert Request Button */}
                <button
                  type="button"
                  onClick={handleSendRequestToAdmin}
                  disabled={sendingRequest}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition active:scale-95 disabled:opacity-60"
                >
                  {sendingRequest ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Notify Administrator</span>
                </button>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default BranchAssignmentNotice;
