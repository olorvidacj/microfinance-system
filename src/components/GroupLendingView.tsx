import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingUp,
  Receipt,
  UserCheck,
  Search,
  Filter,
  DollarSign,
  Phone,
  Layers,
  FileText,
  AlertTriangle,
  CreditCard,
  ArrowDownRight,
  Sparkles,
  UserPlus,
  Trash2,
  Edit3,
  ChevronRight,
  Info,
  Coins,
  Activity,
  Award,
  Check,
  X,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency } from '../utils/loanMath';
import {
  SolidarityGroup,
  SolidarityGroupMember,
  GroupLoan,
  GroupLoanMemberObligation,
  GroupMeetingLog,
} from '../types';

export const GroupLendingView: React.FC = () => {
  const {
    filteredSolidarityGroups,
    filteredGroupLoans,
    groupMeetingLogs,
    borrowers,
    loanProducts,
    currentUser,
    createSolidarityGroup,
    updateSolidarityGroup,
    deleteSolidarityGroup,
    addMemberToGroup,
    removeMemberFromGroup,
    assignGroupLeader,
    createGroupLoan,
    approveGroupLoan,
    disburseGroupLoan,
    recordCenterMeeting,
    recordGroupRepayment,
    activateSolidarityBridge,
  } = useLoan();

  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    return filteredSolidarityGroups[0]?.id || '';
  });

  const selectedGroup = filteredSolidarityGroups.find((g) => g.id === selectedGroupId) || filteredSolidarityGroups[0] || null;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'groupLoans' | 'meetingSheet' | 'meetingsHistory' | 'solidarityFund' | 'createGroup' | 'createGroupLoan'>('overview');

  // Meeting State
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [meetingAttendance, setMeetingAttendance] = useState<Record<string, boolean>>({});
  const [meetingCollections, setMeetingCollections] = useState<Record<string, number>>({});
  const [meetingSolidarityFund, setMeetingSolidarityFund] = useState<Record<string, number>>({});
  const [meetingNotes, setMeetingNotes] = useState('');

  // Repayment Modal
  const [showRepayModal, setShowRepayModal] = useState<{
    open: boolean;
    groupLoanId: string;
    borrowerId: string;
    borrowerName: string;
    weeklyDue: number;
    remainingBalance: number;
  }>({
    open: false,
    groupLoanId: '',
    borrowerId: '',
    borrowerName: '',
    weeklyDue: 0,
    remainingBalance: 0,
  });
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [repayPaymentMethod, setRepayPaymentMethod] = useState<string>('Cash');

  // Solidarity Bridge Modal
  const [showBridgeModal, setShowBridgeModal] = useState<{
    open: boolean;
    group: SolidarityGroup | null;
    member: SolidarityGroupMember | null;
  }>({
    open: false,
    group: null,
    member: null,
  });
  const [bridgeShortfallAmount, setBridgeShortfallAmount] = useState<number>(0);
  const [bridgeReason, setBridgeReason] = useState('Medical emergency / temporary business cashflow slowdown');

  // Add Member Modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedNewBorrowerId, setSelectedNewBorrowerId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'Member' | 'Treasurer' | 'Secretary'>('Member');

  // Create Group Form
  const [newGroupName, setNewGroupName] = useState('');
  const [newCenterName, setNewCenterName] = useState('');
  const [newMeetingDay, setNewMeetingDay] = useState<SolidarityGroup['meetingDay']>('Wednesday');
  const [newMeetingTime, setNewMeetingTime] = useState('09:00 AM');
  const [newLocation, setNewLocation] = useState('');
  const [newSelectedBorrowers, setNewSelectedBorrowers] = useState<string[]>([]);
  const [newLeaderId, setNewLeaderId] = useState('');

  // Create Group Loan Form
  const [loanGroupId, setLoanGroupId] = useState(selectedGroup?.id || '');
  const [loanProductId, setLoanProductId] = useState('lp-2');
  const [loanTermMonths, setLoanTermMonths] = useState(6);
  const [loanInterestRate, setLoanInterestRate] = useState(2.5);
  const [loanFrequency, setLoanFrequency] = useState<'Weekly' | 'Bi-Weekly' | 'Monthly'>('Weekly');
  const [loanPurpose, setLoanPurpose] = useState('Working capital & inventory replenishment for micro-business');
  const [memberAllocations, setMemberAllocations] = useState<Record<string, number>>({});

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Filter groups
  const filteredGroups = filteredSolidarityGroups.filter((g) => {
    const matchesSearch =
      g.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.groupCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.centerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.leaderName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || g.status === filterStatus || g.delinquencyStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate high level metrics
  const totalGroupPortfolio = filteredGroupLoans.reduce((sum, gl) => (gl.status === 'Active' ? sum + gl.remainingBalance : sum), 0);
  const totalSolidarityReserve = filteredSolidarityGroups.reduce((sum, g) => sum + g.solidarityFundBalance, 0);
  const totalGroupMembersCount = filteredSolidarityGroups.reduce((sum, g) => sum + g.members.length, 0);
  const healthyGroupsCount = filteredSolidarityGroups.filter((g) => g.delinquencyStatus === 'Healthy').length;

  // Start Meeting Flow
  const handleStartMeeting = (grp: SolidarityGroup) => {
    setSelectedGroupId(grp.id);
    setIsMeetingActive(true);
    setActiveTab('meetingSheet');
    const initAtt: Record<string, boolean> = {};
    const initCol: Record<string, number> = {};
    const initSol: Record<string, number> = {};

    grp.members.forEach((m) => {
      initAtt[m.borrowerId] = true;
      initCol[m.borrowerId] = m.weeklyDues || 1200;
      initSol[m.borrowerId] = 100; // ₱100 weekly solidarity fund
    });

    setMeetingAttendance(initAtt);
    setMeetingCollections(initCol);
    setMeetingSolidarityFund(initSol);
    setMeetingNotes(`Weekly center meeting for ${grp.groupName}. Attendance, solidarity mutual check-in, and collections.`);
  };

  // Complete Meeting
  const handleCompleteMeeting = () => {
    if (!selectedGroup) return;

    const attendances = selectedGroup.members.map((m) => ({
      borrowerId: m.borrowerId,
      borrowerName: m.fullName,
      role: m.role,
      status: (meetingAttendance[m.borrowerId] ? 'Present' : 'Absent') as 'Present' | 'Absent' | 'Excused',
    }));

    const collections = selectedGroup.members.map((m) => {
      const expectedDue = m.weeklyDues || 1200;
      const amountPaid = meetingCollections[m.borrowerId] || 0;
      const solidarityCont = meetingSolidarityFund[m.borrowerId] || 100;
      const isFull = amountPaid >= expectedDue;
      const isPartial = amountPaid > 0 && amountPaid < expectedDue;

      return {
        borrowerId: m.borrowerId,
        borrowerName: m.fullName,
        expectedDue,
        amountPaid,
        solidarityContribution: solidarityCont,
        paymentStatus: isFull
          ? ('Paid in Full' as const)
          : isPartial
          ? ('Partial' as const)
          : ('Unpaid' as const),
        notes: isFull ? 'On-time collection' : isPartial ? 'Partial payment recorded' : 'Unpaid at center meeting',
      };
    });

    const newMeeting = recordCenterMeeting({
      groupId: selectedGroup.id,
      groupCode: selectedGroup.groupCode,
      groupName: selectedGroup.groupName,
      centerName: selectedGroup.centerName,
      meetingDate: new Date().toISOString().split('T')[0],
      meetingTime: selectedGroup.meetingTime,
      meetingLocation: selectedGroup.meetingLocation,
      meetingNotes,
      attendances,
      collections,
    });

    setIsMeetingActive(false);
    showToast(`Weekly Center Meeting ${newMeeting.meetingNumber} recorded! ₱${newMeeting.totalActualCollections.toLocaleString()} collected & ₱${newMeeting.totalSolidarityFundCollected.toLocaleString()} saved to Solidarity Reserve.`);
    setActiveTab('overview');
  };

  // Handle Form Group
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newCenterName.trim()) {
      showToast('Please provide a group name and center station name.', 'error');
      return;
    }
    if (newSelectedBorrowers.length < 3) {
      showToast('Microfinance solidarity circles require at least 3 members for mutual guarantee.', 'error');
      return;
    }

    const groupMembers: SolidarityGroupMember[] = newSelectedBorrowers.map((bId, idx) => {
      const b = borrowers.find((item) => item.id === bId);
      const isLeader = bId === (newLeaderId || newSelectedBorrowers[0]);
      return {
        borrowerId: bId,
        fullName: b?.fullName || 'Member',
        phone: b?.phone || '0900-000-0000',
        role: isLeader ? 'Leader' : idx === 1 ? 'Treasurer' : idx === 2 ? 'Secretary' : 'Member',
        activeLoanAmount: 0,
        remainingBalance: 0,
        savingsBalance: b?.savingsBalance || 2000,
        status: 'Good Standing',
        weeklyDues: 0,
        totalPaidToDate: 0,
        daysLate: 0,
      };
    });

    const leaderObj = borrowers.find((b) => b.id === (newLeaderId || newSelectedBorrowers[0]));

    const newGroup = createSolidarityGroup({
      groupName: newGroupName,
      centerName: newCenterName,
      meetingDay: newMeetingDay,
      meetingTime: newMeetingTime,
      meetingLocation: newLocation || 'Barangay Multi-Purpose Hall',
      leaderBorrowerId: leaderObj?.id || newSelectedBorrowers[0],
      leaderName: leaderObj?.fullName || 'Center Leader',
      leaderPhone: leaderObj?.phone || '0917-000-0000',
      members: groupMembers,
      solidarityFundBalance: groupMembers.length * 1000, // Initial ₱1,000 equity per member
    });

    setSelectedGroupId(newGroup.id);
    setActiveTab('overview');
    setNewGroupName('');
    setNewCenterName('');
    setNewSelectedBorrowers([]);
    setNewLeaderId('');
    showToast(`Solidarity Group "${newGroup.groupName}" (${newGroup.groupCode}) created successfully!`);
  };

  // Open Create Group Loan Form
  const handleOpenCreateGroupLoan = (grp: SolidarityGroup) => {
    setLoanGroupId(grp.id);
    const initialAllocations: Record<string, number> = {};
    grp.members.forEach((m) => {
      initialAllocations[m.borrowerId] = 25000; // Default ₱25k per member
    });
    setMemberAllocations(initialAllocations);
    setActiveTab('createGroupLoan');
  };

  // Submit Group Loan Application
  const handleSubmitGroupLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const grp = filteredSolidarityGroups.find((g) => g.id === loanGroupId);
    if (!grp) {
      showToast('Please select a valid solidarity group.', 'error');
      return;
    }

    const prod = loanProducts.find((p) => p.id === loanProductId) || loanProducts[1];
    const totalPrincipal = Object.values(memberAllocations).reduce((sum, val) => sum + (val || 0), 0);

    if (totalPrincipal <= 0) {
      showToast('Please allocate principal amounts for the members.', 'error');
      return;
    }

    const totalInstallments = loanFrequency === 'Weekly' ? loanTermMonths * 4 : loanFrequency === 'Bi-Weekly' ? loanTermMonths * 2 : loanTermMonths;

    const obligations: GroupLoanMemberObligation[] = grp.members.map((m) => {
      const principal = memberAllocations[m.borrowerId] || 25000;
      const memberInterest = Math.round(principal * (loanInterestRate / 100) * loanTermMonths);
      const totalObl = principal + memberInterest;
      const periodicDues = Math.round(totalObl / totalInstallments);

      return {
        borrowerId: m.borrowerId,
        borrowerName: m.fullName,
        phone: m.phone,
        role: m.role,
        allocatedPrincipal: principal,
        allocatedInterest: memberInterest,
        totalObligation: totalObl,
        periodicDues,
        totalPaid: 0,
        remainingBalance: totalObl,
        status: 'Current',
        solidarityCoveredAmount: 0,
        daysInArrears: 0,
      };
    });

    const newLoan = createGroupLoan({
      groupId: grp.id,
      groupCode: grp.groupCode,
      groupName: grp.groupName,
      centerName: grp.centerName,
      branchId: grp.branchId,
      productId: prod?.id || 'lp-2',
      productName: prod?.name || 'Micro-Negosyo Group Loan',
      totalPrincipalAmount: totalPrincipal,
      interestRate: loanInterestRate,
      termMonths: loanTermMonths,
      repaymentFrequency: loanFrequency,
      purpose: loanPurpose,
      memberObligations: obligations,
    });

    showToast(`Group Loan ${newLoan.groupLoanNumber} for ₱${totalPrincipal.toLocaleString()} created and disbursed with 100% Peer Guarantee!`);
    setActiveTab('groupLoans');
  };

  // Record Member Individual Repayment
  const handleConfirmRepayment = () => {
    if (!showRepayModal.groupLoanId || !showRepayModal.borrowerId || repayAmount <= 0) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }

    const res = recordGroupRepayment({
      groupLoanId: showRepayModal.groupLoanId,
      borrowerId: showRepayModal.borrowerId,
      amount: repayAmount,
      paymentMethod: repayPaymentMethod,
    });

    if (res.success) {
      showToast(`Recorded payment of ₱${repayAmount.toLocaleString()} for ${showRepayModal.borrowerName}!`);
      setShowRepayModal({ open: false, groupLoanId: '', borrowerId: '', borrowerName: '', weeklyDue: 0, remainingBalance: 0 });
      setRepayAmount(0);
    } else {
      showToast(res.error || 'Payment failed.', 'error');
    }
  };

  // Trigger Solidarity Bridge
  const handleConfirmBridge = () => {
    if (!showBridgeModal.group || !showBridgeModal.member || bridgeShortfallAmount <= 0) {
      showToast('Please enter a valid bridge shortfall amount.', 'error');
      return;
    }

    const res = activateSolidarityBridge({
      groupId: showBridgeModal.group.id,
      borrowerId: showBridgeModal.member.borrowerId,
      shortfallAmount: bridgeShortfallAmount,
      reason: bridgeReason,
    });

    if (res.success) {
      showToast(res.message);
      setShowBridgeModal({ open: false, group: null, member: null });
      setBridgeShortfallAmount(0);
    } else {
      showToast(res.message, 'error');
    }
  };

  // Add Member to Selected Group
  const handleAddMemberToGroup = () => {
    if (!selectedGroup || !selectedNewBorrowerId) return;
    const b = borrowers.find((item) => item.id === selectedNewBorrowerId);
    if (!b) return;

    addMemberToGroup(selectedGroup.id, {
      borrowerId: b.id,
      fullName: b.fullName,
      phone: b.phone,
      role: newMemberRole,
      activeLoanAmount: 0,
      remainingBalance: 0,
      savingsBalance: b.savingsBalance || 1500,
      status: 'Good Standing',
      weeklyDues: 0,
    });

    showToast(`Added ${b.fullName} as ${newMemberRole} to ${selectedGroup.groupName}!`);
    setShowAddMemberModal(false);
    setSelectedNewBorrowerId('');
  };

  // Remove Member
  const handleRemoveMember = (borrowerId: string, name: string) => {
    if (!selectedGroup) return;
    if (selectedGroup.members.length <= 3) {
      showToast('Cannot remove member. Minimum 3 members required for solidarity group.', 'error');
      return;
    }
    if (window.confirm(`Are you sure you want to remove ${name} from this solidarity group?`)) {
      removeMemberFromGroup(selectedGroup.id, borrowerId);
      showToast(`Removed ${name} from the group.`);
    }
  };

  // Assign Leader
  const handleAssignLeader = (borrowerId: string) => {
    if (!selectedGroup) return;
    assignGroupLeader(selectedGroup.id, borrowerId);
    showToast('New Center Leader assigned successfully.');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-900'
              : toastMessage.type === 'info'
              ? 'bg-gold-500/10 border border-gold-400/30 text-navy-900'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{toastMessage.text}</p>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-xs font-semibold underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-gold-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>HOSCOMO Microfinance Group Lending & Solidarity System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Group Lending & Solidarity Mechanism
            </h1>
            <p className="text-slate-200/80 text-sm mt-2 max-w-2xl">
              Center-based solidarity lending with Grameen peer liability, automated center meetings, joint guarantee reserves, and collective delinquency monitoring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('createGroup')}
              className="flex items-center gap-2 bg-gold-500 hover:bg-navy-900 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg shadow-gold-500/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Lending Group</span>
            </button>
            {selectedGroup && (
              <button
                onClick={() => handleOpenCreateGroupLoan(selectedGroup)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-600/30 transition"
              >
                <DollarSign className="w-4 h-4" />
                <span>Apply Group Loan</span>
              </button>
            )}
          </div>
        </div>

        {/* Top Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10 text-xs">
          <div>
            <span className="text-slate-300 block">Active Lending Groups</span>
            <span className="text-xl font-bold text-white mt-1 block">
              {filteredSolidarityGroups.length} Circles ({totalGroupMembersCount} Members)
            </span>
          </div>
          <div>
            <span className="text-slate-300 block">Total Group Outstanding</span>
            <span className="text-xl font-bold text-white mt-1 block">
              {formatCurrency(totalGroupPortfolio)}
            </span>
          </div>
          <div>
            <span className="text-slate-300 block">Solidarity Reserve Fund</span>
            <span className="text-xl font-bold text-emerald-400 mt-1 block">
              {formatCurrency(totalSolidarityReserve)}
            </span>
          </div>
          <div>
            <span className="text-slate-300 block">Peer Health Score</span>
            <span className="text-xl font-bold text-gold-300 mt-1 block">
              {healthyGroupsCount} / {filteredSolidarityGroups.length} Healthy (98.6% On-Time)
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs sm:text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-gold-500/10 text-gold-700 font-semibold'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Group Circles</span>
        </button>
        <button
          onClick={() => setActiveTab('groupLoans')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs sm:text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'groupLoans'
              ? 'bg-gold-500/10 text-gold-700 font-semibold'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Group Loans ({filteredGroupLoans.length})</span>
        </button>
        <button
          onClick={() => {
            if (selectedGroup) setActiveTab('meetingSheet');
          }}
          className={`flex-1 min-w-[160px] py-2.5 px-3 text-xs sm:text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'meetingSheet'
              ? 'bg-gold-500/10 text-gold-700 font-semibold'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Center Meeting Sheet</span>
        </button>
        <button
          onClick={() => setActiveTab('meetingsHistory')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs sm:text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'meetingsHistory'
              ? 'bg-gold-500/10 text-gold-700 font-semibold'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Meeting Logs ({groupMeetingLogs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('solidarityFund')}
          className={`flex-1 min-w-[170px] py-2.5 px-3 text-xs sm:text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'solidarityFund'
              ? 'bg-gold-500/10 text-gold-700 font-semibold'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Solidarity & Peer Guarantee</span>
        </button>
      </div>

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Group List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search group, center, or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full p-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 font-medium"
                >
                  <option value="all">All Group Standings</option>
                  <option value="Healthy">Healthy (No Arrears)</option>
                  <option value="At Risk">At Risk / Delinquent</option>
                  <option value="Solidarity Covered">Solidarity Covered</option>
                </select>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredGroups.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No lending groups match criteria
                  </div>
                ) : (
                  filteredGroups.map((grp) => {
                    const isSelected = selectedGroup?.id === grp.id;
                    return (
                      <div
                        key={grp.id}
                        onClick={() => setSelectedGroupId(grp.id)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'border-gold-500 bg-gold-500/10 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-gold-600 bg-gold-500/10 px-2 py-0.5 rounded-md">
                            {grp.groupCode}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              grp.delinquencyStatus === 'Healthy'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : grp.delinquencyStatus === 'Solidarity Covered'
                                ? 'bg-gold-500/10 text-gold-700 border border-gold-400/30'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {grp.delinquencyStatus}
                          </span>
                        </div>
                        <h4 className="font-semibold text-slate-900 text-sm mt-1.5">{grp.groupName}</h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{grp.centerName}</span>
                        </p>
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
                          <span className="flex items-center gap-1 font-medium">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {grp.members.length} Members
                          </span>
                          <span className="font-bold text-slate-900">{formatCurrency(grp.totalActiveLoans)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Selected Group Deep-Dive */}
          {selectedGroup ? (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gold-600 bg-gold-500/10 px-2.5 py-0.5 rounded-lg border border-gold-400/30">
                        {selectedGroup.groupCode}
                      </span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Peer Guarantee Active
                      </span>
                      {selectedGroup.activeGroupLoanNumber && (
                        <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          Loan #{selectedGroup.activeGroupLoanNumber}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">{selectedGroup.groupName}</h2>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedGroup.centerName} • {selectedGroup.meetingLocation}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleStartMeeting(selectedGroup)}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Weekly Meeting</span>
                    </button>
                    <button
                      onClick={() => handleOpenCreateGroupLoan(selectedGroup)}
                      className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Loan</span>
                    </button>
                    <button
                      onClick={() => setShowAddMemberModal(true)}
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add Member</span>
                    </button>
                  </div>
                </div>

                {/* Group Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-500 block">Meeting Schedule</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block">
                      Every {selectedGroup.meetingDay} @ {selectedGroup.meetingTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Center Leader</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{selectedGroup.leaderName}</span>
                    <span className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {selectedGroup.leaderPhone}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Solidarity Fund Balance</span>
                    <span className="font-bold text-emerald-600 text-sm mt-0.5 block">
                      {formatCurrency(selectedGroup.solidarityFundBalance)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Repayment Health</span>
                    <span className="font-bold text-gold-600 text-sm mt-0.5 block">
                      {selectedGroup.repaymentRate.toFixed(1)}% On-Time
                    </span>
                  </div>
                </div>

                {/* Member Roster & Individual Obligations */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-gold-600" />
                      <span>Group Members & Individual Obligations ({selectedGroup.members.length})</span>
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      Joint Liability: 100% Peer Guaranteed
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                          <th className="py-3 px-3">Member & Role</th>
                          <th className="py-3 px-3">Active Loan</th>
                          <th className="py-3 px-3">Remaining Balance</th>
                          <th className="py-3 px-3">Savings Equity</th>
                          <th className="py-3 px-3">Periodic Dues</th>
                          <th className="py-3 px-3">Standing</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedGroup.members.map((m) => (
                          <tr key={m.borrowerId} className="hover:bg-slate-50/70 transition">
                            <td className="py-3.5 px-3">
                              <div className="font-semibold text-slate-900">{m.fullName}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    m.role === 'Leader'
                                      ? 'bg-amber-100 text-amber-800'
                                      : m.role === 'Treasurer'
                                      ? 'bg-gold-500/20 text-gold-800'
                                      : m.role === 'Secretary'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {m.role}
                                </span>
                                <span>{m.phone}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 font-medium text-slate-800">
                              {formatCurrency(m.activeLoanAmount)}
                            </td>
                            <td className="py-3.5 px-3 font-bold text-slate-900">
                              {formatCurrency(m.remainingBalance)}
                            </td>
                            <td className="py-3.5 px-3 font-semibold text-emerald-600">
                              {formatCurrency(m.savingsBalance)}
                            </td>
                            <td className="py-3.5 px-3 font-semibold text-gold-600">
                              {formatCurrency(m.weeklyDues)}/wk
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  m.status === 'Good Standing'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : m.status === 'Solidarity Covered'
                                    ? 'bg-gold-500/10 text-gold-700 border border-gold-400/30'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {m.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {m.remainingBalance > 0 && selectedGroup.activeGroupLoanId && (
                                  <button
                                    onClick={() => {
                                      setShowRepayModal({
                                        open: true,
                                        groupLoanId: selectedGroup.activeGroupLoanId || '',
                                        borrowerId: m.borrowerId,
                                        borrowerName: m.fullName,
                                        weeklyDue: m.weeklyDues,
                                        remainingBalance: m.remainingBalance,
                                      });
                                      setRepayAmount(m.weeklyDues || 1200);
                                    }}
                                    className="px-2.5 py-1 bg-gold-500/10 text-gold-700 hover:bg-gold-500/20 rounded-lg text-[11px] font-semibold transition"
                                  >
                                    Pay Dues
                                  </button>
                                )}

                                {m.status === 'Arrears' && (
                                  <button
                                    onClick={() => {
                                      setShowBridgeModal({
                                        open: true,
                                        group: selectedGroup,
                                        member: m,
                                      });
                                      setBridgeShortfallAmount(m.weeklyDues || 1400);
                                    }}
                                    className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[11px] font-semibold border border-amber-200 transition"
                                  >
                                    Bridge
                                  </button>
                                )}

                                {m.role !== 'Leader' && (
                                  <button
                                    onClick={() => handleAssignLeader(m.borrowerId)}
                                    title="Make Center Leader"
                                    className="p-1 text-slate-400 hover:text-amber-600 rounded"
                                  >
                                    <Award className="w-4 h-4" />
                                  </button>
                                )}

                                <button
                                  onClick={() => handleRemoveMember(m.borrowerId, m.fullName)}
                                  title="Remove Member"
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 bg-white rounded-3xl p-12 border border-slate-200 text-center text-slate-400 text-sm">
              Select or create a solidarity group to view details
            </div>
          )}
        </div>
      )}

      {/* 2. GROUP LOANS TAB */}
      {activeTab === 'groupLoans' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900">Group Loan Master Portfolio</h2>
              <p className="text-xs text-slate-500">
                Track all group loans, member allocations, joint guarantee agreements, and repayment progress.
              </p>
            </div>

            {selectedGroup && (
              <button
                onClick={() => handleOpenCreateGroupLoan(selectedGroup)}
                className="flex items-center gap-2 bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Originate New Group Loan</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredGroupLoans.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center text-slate-400 text-sm">
                No active group loans found. Click "Originate New Group Loan" to create one.
              </div>
            ) : (
              filteredGroupLoans.map((gl) => (
                <div key={gl.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gold-600 bg-gold-500/10 px-2.5 py-0.5 rounded-lg border border-gold-400/30">
                          {gl.groupLoanNumber}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {gl.groupName} ({gl.groupCode})
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            gl.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {gl.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-2">{gl.productName}</h3>
                      <p className="text-xs text-slate-500">{gl.purpose}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="text-right">
                        <span className="text-slate-400 block">Total Principal</span>
                        <span className="text-base font-bold text-slate-900">{formatCurrency(gl.totalPrincipalAmount)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block">Remaining Balance</span>
                        <span className="text-base font-bold text-emerald-600">{formatCurrency(gl.remainingBalance)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
                      <span>Repayment Collection Progress: {gl.repaymentRate?.toFixed(1) || 0}%</span>
                      <span>
                        {formatCurrency(gl.totalPaid)} / {formatCurrency(gl.totalPayable)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (gl.totalPaid / gl.totalPayable) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Member Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Individual Member Obligations ({gl.memberObligations.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {gl.memberObligations.map((o) => (
                        <div key={o.borrowerId} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{o.borrowerName}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                o.status === 'Current' || o.status === 'Settled'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : o.status === 'Solidarity Covered'
                                  ? 'bg-gold-500/20 text-gold-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {o.status}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-600">
                            <span>Principal: {formatCurrency(o.allocatedPrincipal)}</span>
                            <span className="font-bold text-slate-900">Due: {formatCurrency(o.periodicDues)}/wk</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                            <span>Paid: {formatCurrency(o.totalPaid)}</span>
                            <span className="font-semibold text-emerald-700">Bal: {formatCurrency(o.remainingBalance)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. CENTER MEETING SHEET TAB */}
      {activeTab === 'meetingSheet' && selectedGroup && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Center Meeting Session
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">
                Weekly Center Meeting & Collection Sheet: {selectedGroup.groupName}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {selectedGroup.centerName} • {selectedGroup.meetingLocation} • Officer: {currentUser.name}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCompleteMeeting}
                className="bg-navy-900 hover:bg-navy-800 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-md shadow-gold-500/20 transition flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save & Finalize Center Meeting</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-3">Attendance</th>
                  <th className="py-3 px-3">Member Name & Role</th>
                  <th className="py-3 px-3">Expected Weekly Dues</th>
                  <th className="py-3 px-3">Weekly Dues Collected (₱)</th>
                  <th className="py-3 px-3">Solidarity Reserve Fund (₱)</th>
                  <th className="py-3 px-3 text-right">Solidarity Guarantor Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedGroup.members.map((m) => {
                  const isPresent = meetingAttendance[m.borrowerId] ?? true;
                  const collected = meetingCollections[m.borrowerId] ?? (m.weeklyDues || 1200);
                  const solidarity = meetingSolidarityFund[m.borrowerId] ?? 100;

                  return (
                    <tr key={m.borrowerId} className={!isPresent ? 'bg-rose-50/40' : ''}>
                      <td className="py-3.5 px-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isPresent}
                            onChange={(e) =>
                              setMeetingAttendance({
                                ...meetingAttendance,
                                [m.borrowerId]: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded text-gold-600 focus:ring-gold-500"
                          />
                          <span className={isPresent ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                            {isPresent ? 'Present' : 'Absent'}
                          </span>
                        </label>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        <div>{m.fullName}</div>
                        <span className="text-[11px] text-slate-500 font-normal">{m.role} • {m.phone}</span>
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        {formatCurrency(m.weeklyDues || 1200)}
                      </td>
                      <td className="py-3.5 px-3">
                        <input
                          type="number"
                          value={collected}
                          onChange={(e) =>
                            setMeetingCollections({
                              ...meetingCollections,
                              [m.borrowerId]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-28 p-1.5 rounded-lg border border-slate-200 font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-gold-500"
                        />
                      </td>
                      <td className="py-3.5 px-3">
                        <input
                          type="number"
                          value={solidarity}
                          onChange={(e) =>
                            setMeetingSolidarityFund({
                              ...meetingSolidarityFund,
                              [m.borrowerId]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-24 p-1.5 rounded-lg border border-slate-200 font-semibold text-emerald-700 text-xs focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <span className="bg-gold-500/10 text-gold-700 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-gold-400/30">
                          Co-Guaranteed by Center
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Center Meeting Minutes & Observation Notes</label>
            <textarea
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              rows={3}
              placeholder="Record any member absences, mutual support agreements, or micro-enterprise updates..."
              className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
            />
          </div>
        </div>
      )}

      {/* 4. MEETINGS HISTORY TAB */}
      {activeTab === 'meetingsHistory' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Historical Center Meeting Logs</h2>
            <p className="text-xs text-slate-500">
              Audit trail of all weekly center meetings, attendance rates, and solidarity reserve collection logs.
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-3">Meeting #</th>
                  <th className="py-3 px-3">Group & Center</th>
                  <th className="py-3 px-3">Meeting Date & Time</th>
                  <th className="py-3 px-3">Presided By</th>
                  <th className="py-3 px-3">Attendance</th>
                  <th className="py-3 px-3">Total Dues Collected</th>
                  <th className="py-3 px-3 text-right">Solidarity Pool Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupMeetingLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-3 font-mono font-bold text-gold-600">{log.meetingNumber}</td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-900">{log.groupName}</div>
                      <span className="text-[11px] text-slate-500">{log.centerName}</span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-700">
                      <div>{log.meetingDate}</div>
                      <span className="text-[11px] text-slate-400">{log.meetingTime}</span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-700 font-medium">{log.presidedBy}</td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {log.attendanceRate.toFixed(0)}% Present
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">
                      {formatCurrency(log.totalActualCollections)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-600">
                      +{formatCurrency(log.totalSolidarityFundCollected)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. SOLIDARITY FUND & PEER GUARANTEE EXPLANATION */}
      {activeTab === 'solidarityFund' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">HOSCOMO Solidarity & Peer Guarantee</h3>
                <p className="text-xs text-slate-500">Social collateral & joint liability architecture</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-1">1. Peer Guarantee & Joint Liability</h4>
                <p>
                  Solidarity groups consist of 3 to 8 trusted micro-entrepreneurs from the same community. Group members co-guarantee each other’s loans. If a member faces hardship, the circle steps in to support before formal collections.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-1">2. Solidarity Reserve Fund</h4>
                <p>
                  Every member deposits ₱100 each weekly meeting into the pooled Solidarity Reserve Fund. This emergency fund provides an instant buffer for members experiencing temporary emergency shortfalls without damaging the group’s rating.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-1">3. Graduated Credit Ceilings</h4>
                <p>
                  Groups maintaining an exemplary 98%+ on-time weekly repayment record unlock progressive credit escalations from ₱25,000 up to ₱150,000 per member.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gold-600" />
              <span>Solidarity Performance Indicators</span>
            </h3>

            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Active Solidarity Groups</span>
                <span className="font-bold text-slate-900 text-base">{filteredSolidarityGroups.length} Circles</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Average Meeting Attendance Rate</span>
                <span className="font-bold text-emerald-600 text-base">96.8%</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Total Cumulative Solidarity Reserve Pool</span>
                <span className="font-bold text-emerald-700 text-base">{formatCurrency(totalSolidarityReserve)}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Group Loan Portfolio in Arrears (PAR &gt; 30)</span>
                <span className="font-bold text-gold-600 text-base">0.45% (Exceptional)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. CREATE GROUP FORM TAB */}
      {activeTab === 'createGroup' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Form New Solidarity Lending Group</h2>
            <p className="text-xs text-slate-500 mt-1">
              Assemble 3 to 8 registered cooperative members into a joint-liability solidarity circle.
            </p>
          </div>

          <form onSubmit={handleCreateGroup} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Group Circle Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sambayanang Masigasig Circle"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Center Name / Station *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Center #4, Holy Spirit Station"
                  value={newCenterName}
                  onChange={(e) => setNewCenterName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Meeting Day</label>
                <select
                  value={newMeetingDay}
                  onChange={(e) => setNewMeetingDay(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
                >
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Meeting Time</label>
                <input
                  type="text"
                  placeholder="09:00 AM"
                  value={newMeetingTime}
                  onChange={(e) => setNewMeetingTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Meeting Location</label>
                <input
                  type="text"
                  placeholder="e.g. Barangay Hall Pavilion"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
                />
              </div>
            </div>

            {/* Select Members */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Select Members for Solidarity Circle (Minimum 3 required)
                </label>
                <span className="text-gold-600 font-bold">{newSelectedBorrowers.length} selected</span>
              </div>
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5">
                {borrowers.map((b) => {
                  const isChecked = newSelectedBorrowers.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                        isChecked ? 'bg-gold-500/10 border border-gold-400/30' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewSelectedBorrowers([...newSelectedBorrowers, b.id]);
                              if (!newLeaderId) setNewLeaderId(b.id);
                            } else {
                              setNewSelectedBorrowers(newSelectedBorrowers.filter((id) => id !== b.id));
                              if (newLeaderId === b.id) setNewLeaderId('');
                            }
                          }}
                          className="w-4 h-4 rounded text-gold-600"
                        />
                        <span className="font-semibold text-slate-900">{b.fullName}</span>
                        <span className="text-slate-400">({b.borrowerNumber})</span>
                      </div>
                      <span className="text-emerald-600 font-medium">{formatCurrency(b.savingsBalance || 1000)} Savings</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {newSelectedBorrowers.length > 0 && (
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Center Leader</label>
                <select
                  value={newLeaderId}
                  onChange={(e) => setNewLeaderId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500 font-medium"
                >
                  {newSelectedBorrowers.map((id) => {
                    const b = borrowers.find((item) => item.id === id);
                    return (
                      <option key={id} value={id}>
                        {b?.fullName} (Leader)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-semibold shadow-md shadow-gold-500/20"
              >
                Confirm & Form Group Circle
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. CREATE GROUP LOAN APPLICATION TAB */}
      {activeTab === 'createGroupLoan' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Originate Group Loan Application</h2>
            <p className="text-xs text-slate-500 mt-1">
              Create a co-guaranteed microfinance group loan and allocate individual principal amounts for each solidarity member.
            </p>
          </div>

          <form onSubmit={handleSubmitGroupLoan} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Solidarity Group *</label>
                <select
                  value={loanGroupId}
                  onChange={(e) => {
                    setLoanGroupId(e.target.value);
                    const grp = filteredSolidarityGroups.find((g) => g.id === e.target.value);
                    if (grp) {
                      const newAllocs: Record<string, number> = {};
                      grp.members.forEach((m) => (newAllocs[m.borrowerId] = 25000));
                      setMemberAllocations(newAllocs);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold text-slate-900 focus:ring-2 focus:ring-gold-500"
                >
                  {filteredSolidarityGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.groupName} ({g.groupCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Loan Product</label>
                <select
                  value={loanProductId}
                  onChange={(e) => setLoanProductId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold text-slate-900 focus:ring-2 focus:ring-gold-500"
                >
                  {loanProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.interestRate}% monthly)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Term (Months)</label>
                <select
                  value={loanTermMonths}
                  onChange={(e) => setLoanTermMonths(parseInt(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
                >
                  <option value={3}>3 Months (12 Weeks)</option>
                  <option value={6}>6 Months (24 Weeks)</option>
                  <option value={12}>12 Months (48 Weeks)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Monthly Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={loanInterestRate}
                  onChange={(e) => setLoanInterestRate(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Repayment Frequency</label>
                <select
                  value={loanFrequency}
                  onChange={(e) => setLoanFrequency(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
                >
                  <option value="Weekly">Weekly Center Dues</option>
                  <option value="Bi-Weekly">Bi-Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Individual Member Allocations */}
            <div>
              <label className="font-semibold text-slate-700 block mb-2">
                Allocate Member Principal Loan Amounts:
              </label>
              {(() => {
                const targetGrp = filteredSolidarityGroups.find((g) => g.id === loanGroupId) || selectedGroup;
                if (!targetGrp) return null;
                return (
                  <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-slate-50">
                    {targetGrp.members.map((m) => (
                      <div key={m.borrowerId} className="flex items-center justify-between gap-4 p-2 bg-white rounded-xl border border-slate-100">
                        <div>
                          <div className="font-semibold text-slate-900">{m.fullName}</div>
                          <span className="text-[11px] text-slate-500">{m.role}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">₱</span>
                          <input
                            type="number"
                            value={memberAllocations[m.borrowerId] ?? 25000}
                            onChange={(e) =>
                              setMemberAllocations({
                                ...memberAllocations,
                                [m.borrowerId]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-32 p-1.5 rounded-lg border border-slate-200 font-bold text-slate-900 text-xs focus:ring-2 focus:ring-gold-500"
                          />
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-between items-center pt-3 border-t border-slate-200 font-bold text-sm text-slate-900">
                      <span>Total Group Principal Amount:</span>
                      <span className="text-emerald-700 text-base">
                        {formatCurrency(
                          Object.values(memberAllocations).reduce((sum, val) => sum + (val || 0), 0)
                        )}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Loan Purpose & Livelihood Activity</label>
              <textarea
                value={loanPurpose}
                onChange={(e) => setLoanPurpose(e.target.value)}
                rows={2}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-600/20"
              >
                Disburse Group Loan with Peer Guarantee
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Pay Individual Group Member Dues */}
      {showRepayModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Record Member Dues Repayment</h3>
              <button
                onClick={() => setShowRepayModal({ open: false, groupLoanId: '', borrowerId: '', borrowerName: '', weeklyDue: 0, remainingBalance: 0 })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gold-500/10 rounded-xl text-navy-900 space-y-1">
              <div className="font-bold">{showRepayModal.borrowerName}</div>
              <div className="text-[11px] text-gold-700">
                Scheduled Dues: {formatCurrency(showRepayModal.weeklyDue)} | Balance: {formatCurrency(showRepayModal.remainingBalance)}
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Repayment Amount (₱)</label>
              <input
                type="number"
                value={repayAmount}
                onChange={(e) => setRepayAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 text-sm focus:ring-2 focus:ring-gold-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Payment Method</label>
              <select
                value={repayPaymentMethod}
                onChange={(e) => setRepayPaymentMethod(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
              >
                <option value="Cash">Cash (Center Collector)</option>
                <option value="GCash">GCash / Maya</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowRepayModal({ open: false, groupLoanId: '', borrowerId: '', borrowerName: '', weeklyDue: 0, remainingBalance: 0 })}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRepayment}
                className="px-5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-semibold shadow-sm"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Activate Solidarity Reserve Fund Bridge */}
      {showBridgeModal.open && showBridgeModal.group && showBridgeModal.member && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-up text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-gold-600" />
                <h3 className="font-bold text-slate-900 text-sm">Activate Solidarity Reserve Fund Bridge</h3>
              </div>
              <button
                onClick={() => setShowBridgeModal({ open: false, group: null, member: null })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-gold-500/10 rounded-2xl text-navy-950 space-y-1.5 border border-gold-400/30">
              <div className="font-bold text-sm">{showBridgeModal.member.fullName}</div>
              <p className="text-[11px] text-gold-800 leading-relaxed">
                Utilize the group's pooled <strong>Solidarity Reserve Fund</strong> (Available: {formatCurrency(showBridgeModal.group.solidarityFundBalance)}) to bridge delinquent dues. This maintains the group’s 100% on-time credit rating without triggering penalty interest.
              </p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Bridge Shortfall Amount (₱)</label>
              <input
                type="number"
                value={bridgeShortfallAmount}
                onChange={(e) => setBridgeShortfallAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 text-sm focus:ring-2 focus:ring-gold-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Reason for Peer Bridge Authorization</label>
              <input
                type="text"
                value={bridgeReason}
                onChange={(e) => setBridgeReason(e.target.value)}
                placeholder="e.g. Medical emergency / temporary inventory delay"
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-gold-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowBridgeModal({ open: false, group: null, member: null })}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBridge}
                className="px-5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-semibold shadow-md shadow-gold-500/20"
              >
                Authorize Solidarity Bridge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Member */}
      {showAddMemberModal && selectedGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add Member to {selectedGroup.groupName}</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Select Registered Member</label>
              <select
                value={selectedNewBorrowerId}
                onChange={(e) => setSelectedNewBorrowerId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
              >
                <option value="">-- Choose Member --</option>
                {borrowers
                  .filter((b) => !selectedGroup.members.some((m) => m.borrowerId === b.id))
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName} ({b.borrowerNumber})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Assigned Group Role</label>
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
              >
                <option value="Member">Member</option>
                <option value="Treasurer">Treasurer</option>
                <option value="Secretary">Secretary</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMemberToGroup}
                disabled={!selectedNewBorrowerId}
                className="px-5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-semibold disabled:opacity-50"
              >
                Add to Circle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
