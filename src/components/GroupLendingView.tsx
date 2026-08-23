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
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency } from '../utils/loanMath';
import { SolidarityGroup, SolidarityGroupMember } from '../types';

export const INITIAL_GROUPS: SolidarityGroup[] = [
  {
    id: 'grp-1',
    groupCode: 'GRP-HOS-01',
    groupName: 'Kababaihan Pag-asa Group',
    centerName: 'Holy Spirit Barangay Hall Center #1',
    branchId: 'br-1',
    formedDate: '2025-03-15',
    meetingDay: 'Wednesday',
    meetingTime: '08:30 AM',
    meetingLocation: 'Center 1 Pavilion, Holy Spirit, Quezon City',
    loanOfficerId: 'st-1',
    loanOfficerName: 'Maria Santos, CPA',
    leaderBorrowerId: 'b-1',
    leaderName: 'Elena Cruz Dela Peña',
    leaderPhone: '0917-882-9901',
    jointLiabilityAgreed: true,
    status: 'Active',
    repaymentRate: 98.4,
    solidarityFundBalance: 24500,
    totalActiveLoans: 145000,
    totalGroupSavings: 48200,
    members: [
      {
        borrowerId: 'b-1',
        fullName: 'Elena Cruz Dela Peña',
        phone: '0917-882-9901',
        role: 'Leader',
        activeLoanAmount: 40000,
        remainingBalance: 28000,
        savingsBalance: 14200,
        status: 'Good Standing',
        weeklyDues: 1850,
      },
      {
        borrowerId: 'b-2',
        fullName: 'Roberto Mendoza Reyes',
        phone: '0918-554-1209',
        role: 'Treasurer',
        activeLoanAmount: 35000,
        remainingBalance: 21000,
        savingsBalance: 11500,
        status: 'Good Standing',
        weeklyDues: 1600,
      },
      {
        borrowerId: 'b-3',
        fullName: 'Carmelita Gomez Tan',
        phone: '0922-311-8844',
        role: 'Secretary',
        activeLoanAmount: 30000,
        remainingBalance: 18500,
        savingsBalance: 9800,
        status: 'Good Standing',
        weeklyDues: 1400,
      },
      {
        borrowerId: 'b-4',
        fullName: 'Lourdes Bautista Ramos',
        phone: '0919-445-6677',
        role: 'Member',
        activeLoanAmount: 25000,
        remainingBalance: 15200,
        savingsBalance: 7200,
        status: 'Good Standing',
        weeklyDues: 1150,
      },
      {
        borrowerId: 'b-5',
        fullName: 'Rosanna Diaz Villanueva',
        phone: '0915-223-9911',
        role: 'Member',
        activeLoanAmount: 15000,
        remainingBalance: 9800,
        savingsBalance: 5500,
        status: 'Good Standing',
        weeklyDues: 750,
      },
    ],
  },
  {
    id: 'grp-2',
    groupCode: 'GRP-HOS-02',
    groupName: 'Sikap-Kaunlaran Micro-Enterprise Circle',
    centerName: 'San Simon Market Center #3',
    branchId: 'br-1',
    formedDate: '2025-06-20',
    meetingDay: 'Thursday',
    meetingTime: '09:00 AM',
    meetingLocation: 'San Simon Multipurpose Building',
    loanOfficerId: 'st-1',
    loanOfficerName: 'Maria Santos, CPA',
    leaderBorrowerId: 'b-6',
    leaderName: 'Corazon Aquino Mercado',
    leaderPhone: '0920-771-3344',
    jointLiabilityAgreed: true,
    status: 'Active',
    repaymentRate: 95.8,
    solidarityFundBalance: 18200,
    totalActiveLoans: 110000,
    totalGroupSavings: 36400,
    members: [
      {
        borrowerId: 'b-6',
        fullName: 'Corazon Aquino Mercado',
        phone: '0920-771-3344',
        role: 'Leader',
        activeLoanAmount: 30000,
        remainingBalance: 20000,
        savingsBalance: 8900,
        status: 'Good Standing',
        weeklyDues: 1400,
      },
      {
        borrowerId: 'b-7',
        fullName: 'Marilou Santos Castro',
        phone: '0917-334-5566',
        role: 'Treasurer',
        activeLoanAmount: 30000,
        remainingBalance: 24500,
        savingsBalance: 9200,
        status: 'Due',
        weeklyDues: 1400,
      },
      {
        borrowerId: 'b-8',
        fullName: 'Teresita David Morales',
        phone: '0928-119-4455',
        role: 'Secretary',
        activeLoanAmount: 25000,
        remainingBalance: 16000,
        savingsBalance: 8100,
        status: 'Good Standing',
        weeklyDues: 1150,
      },
      {
        borrowerId: 'b-9',
        fullName: 'Josephine Flores Aguilar',
        phone: '0916-889-2233',
        role: 'Member',
        activeLoanAmount: 25000,
        remainingBalance: 19800,
        savingsBalance: 10200,
        status: 'Good Standing',
        weeklyDues: 1150,
      },
    ],
  },
];

export const GroupLendingView: React.FC = () => {
  const { branches, borrowers } = useLoan();
  const [groups, setGroups] = useState<SolidarityGroup[]>(INITIAL_GROUPS);
  const [selectedGroup, setSelectedGroup] = useState<SolidarityGroup | null>(INITIAL_GROUPS[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'meetingSheet' | 'solidarityFund' | 'createGroup'>('overview');
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [meetingAttendance, setMeetingAttendance] = useState<Record<string, boolean>>({});
  const [meetingCollections, setMeetingCollections] = useState<Record<string, boolean>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [newCenterName, setNewCenterName] = useState('');
  const [newMeetingDay, setNewMeetingDay] = useState<SolidarityGroup['meetingDay']>('Wednesday');
  const [newMeetingTime, setNewMeetingTime] = useState('09:00 AM');
  const [newLocation, setNewLocation] = useState('');
  const [newSelectedBorrowers, setNewSelectedBorrowers] = useState<string[]>([]);
  const [newLeaderId, setNewLeaderId] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState('');

  const filteredGroups = groups.filter(
    (g) =>
      g.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.groupCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.centerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartMeeting = (grp: SolidarityGroup) => {
    setSelectedGroup(grp);
    setIsMeetingActive(true);
    setActiveTab('meetingSheet');
    const initAtt: Record<string, boolean> = {};
    const initCol: Record<string, boolean> = {};
    grp.members.forEach((m) => {
      initAtt[m.borrowerId] = true;
      initCol[m.borrowerId] = true;
    });
    setMeetingAttendance(initAtt);
    setMeetingCollections(initCol);
  };

  const handleCompleteMeeting = () => {
    if (!selectedGroup) return;
    const totalCollected = selectedGroup.members.reduce((acc, m) => {
      return acc + (meetingCollections[m.borrowerId] ? m.weeklyDues : 0);
    }, 0);

    setShowSuccessToast(`Weekly Center Meeting completed! Total ₱${totalCollected.toLocaleString()} recorded to Group Ledger & Solidarity Fund.`);
    setIsMeetingActive(false);
    setTimeout(() => setShowSuccessToast(''), 6000);
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName || !newCenterName || newSelectedBorrowers.length < 3) {
      alert('Please provide a group name, center name, and select at least 3 members for solidarity guarantee.');
      return;
    }

    const groupMembers: SolidarityGroupMember[] = newSelectedBorrowers.map((bId, idx) => {
      const b = borrowers.find((item) => item.id === bId);
      return {
        borrowerId: bId,
        fullName: b?.fullName || 'Member',
        phone: b?.phone || '0900-000-0000',
        role: bId === newLeaderId ? 'Leader' : idx === 1 ? 'Treasurer' : idx === 2 ? 'Secretary' : 'Member',
        activeLoanAmount: 25000,
        remainingBalance: 25000,
        savingsBalance: b?.savingsBalance || 2000,
        status: 'Good Standing',
        weeklyDues: 1200,
      };
    });

    const leaderObj = borrowers.find((b) => b.id === newLeaderId) || borrowers.find((b) => b.id === newSelectedBorrowers[0]);

    const newGroup: SolidarityGroup = {
      id: `grp-${Date.now()}`,
      groupCode: `GRP-HOS-0${groups.length + 1}`,
      groupName: newGroupName,
      centerName: newCenterName,
      branchId: 'br-1',
      formedDate: new Date().toISOString().split('T')[0],
      meetingDay: newMeetingDay,
      meetingTime: newMeetingTime,
      meetingLocation: newLocation || 'Barangay Hall Multi-Purpose Center',
      loanOfficerId: 'st-1',
      loanOfficerName: 'Maria Santos, CPA',
      leaderBorrowerId: leaderObj?.id || newSelectedBorrowers[0],
      leaderName: leaderObj?.fullName || 'Group Leader',
      leaderPhone: leaderObj?.phone || '0917-000-0000',
      members: groupMembers,
      totalActiveLoans: groupMembers.length * 25000,
      totalGroupSavings: groupMembers.reduce((acc, m) => acc + m.savingsBalance, 0),
      repaymentRate: 100,
      solidarityFundBalance: groupMembers.length * 1000,
      jointLiabilityAgreed: true,
      status: 'Active',
    };

    setGroups([newGroup, ...groups]);
    setSelectedGroup(newGroup);
    setActiveTab('overview');
    setShowSuccessToast(`Solidarity Group "${newGroupName}" successfully formed with 100% Peer Guarantee Agreement!`);
    setTimeout(() => setShowSuccessToast(''), 5000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-medium">{showSuccessToast}</p>
          </div>
          <button onClick={() => setShowSuccessToast('')} className="text-xs text-emerald-700 font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>HOSCOMO Microfinance Group Lending & Solidarity Submodule</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Group Lending & Solidarity Mechanism
            </h1>
            <p className="text-blue-100/80 text-sm mt-2 max-w-2xl">
              Manage Center-based solidarity microfinance groups, peer guarantee circles, weekly center meetings, joint liability enforcement, and solidarity reserve funds.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('createGroup')}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-lg shadow-blue-500/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Form Solidarity Group</span>
            </button>
          </div>
        </div>

        {/* Top Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10 text-xs">
          <div>
            <span className="text-blue-200 block">Active Groups</span>
            <span className="text-xl font-bold text-white mt-1 block">{groups.length} Circles</span>
          </div>
          <div>
            <span className="text-blue-200 block">Total Group Portfolio</span>
            <span className="text-xl font-bold text-white mt-1 block">
              {formatCurrency(groups.reduce((acc, g) => acc + g.totalActiveLoans, 0))}
            </span>
          </div>
          <div>
            <span className="text-blue-200 block">Solidarity Reserve Fund</span>
            <span className="text-xl font-bold text-emerald-400 mt-1 block">
              {formatCurrency(groups.reduce((acc, g) => acc + g.solidarityFundBalance, 0))}
            </span>
          </div>
          <div>
            <span className="text-blue-200 block">Solidarity Repayment Rate</span>
            <span className="text-xl font-bold text-blue-300 mt-1 block">97.6% on-time</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Group Circles Overview</span>
        </button>
        <button
          onClick={() => {
            if (selectedGroup) setActiveTab('meetingSheet');
          }}
          className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'meetingSheet'
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Weekly Center Meeting Sheet</span>
        </button>
        <button
          onClick={() => setActiveTab('solidarityFund')}
          className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'solidarityFund'
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Joint Liability & Solidarity Fund</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Group List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search group, center, or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                {filteredGroups.map((grp) => {
                  const isSelected = selectedGroup?.id === grp.id;
                  return (
                    <div
                      key={grp.id}
                      onClick={() => setSelectedGroup(grp)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                          {grp.groupCode}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {grp.repaymentRate}% Repaid
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900 text-sm mt-1">{grp.groupName}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{grp.centerName}</span>
                      </p>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
                        <span>{grp.members.length} Solidarity Members</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(grp.totalActiveLoans)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Group Detail */}
          {selectedGroup && (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg">
                        {selectedGroup.groupCode}
                      </span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Joint Liability Active
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">{selectedGroup.groupName}</h2>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedGroup.meetingLocation}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartMeeting(selectedGroup)}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Start Weekly Meeting</span>
                    </button>
                  </div>
                </div>

                {/* Group Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-b border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-500 block">Meeting Schedule</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block">
                      Every {selectedGroup.meetingDay} @ {selectedGroup.meetingTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Center Leader</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block">{selectedGroup.leaderName}</span>
                    <span className="text-slate-400 text-[11px]">{selectedGroup.leaderPhone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Assigned Officer</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block">{selectedGroup.loanOfficerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Solidarity Fund</span>
                    <span className="font-bold text-emerald-600 mt-0.5 block">
                      {formatCurrency(selectedGroup.solidarityFundBalance)}
                    </span>
                  </div>
                </div>

                {/* Members List with Solidarity Status */}
                <div className="mt-6">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                    <span>Solidarity Group Members ({selectedGroup.members.length})</span>
                    <span className="text-xs font-normal text-slate-500">Peer Liability: 100% Guaranteed</span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="pb-3">Member & Role</th>
                          <th className="pb-3">Active Loan</th>
                          <th className="pb-3">Remaining Balance</th>
                          <th className="pb-3">Savings Balance</th>
                          <th className="pb-3">Weekly Dues</th>
                          <th className="pb-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedGroup.members.map((m) => (
                          <tr key={m.borrowerId} className="hover:bg-slate-50/70">
                            <td className="py-3.5 pr-2">
                              <div className="font-semibold text-slate-900">{m.fullName}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <span className="bg-slate-100 px-1.5 py-0.2 rounded font-medium text-slate-700">{m.role}</span>
                                <span>{m.phone}</span>
                              </div>
                            </td>
                            <td className="py-3.5 font-medium text-slate-800">{formatCurrency(m.activeLoanAmount)}</td>
                            <td className="py-3.5 font-bold text-slate-900">{formatCurrency(m.remainingBalance)}</td>
                            <td className="py-3.5 font-semibold text-emerald-600">{formatCurrency(m.savingsBalance)}</td>
                            <td className="py-3.5 font-semibold text-blue-600">{formatCurrency(m.weeklyDues)}/wk</td>
                            <td className="py-3.5 text-right">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                  m.status === 'Good Standing'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {m.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meeting Sheet Tab */}
      {activeTab === 'meetingSheet' && selectedGroup && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                Center Meeting Session
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">
                Weekly Meeting & Collection Sheet: {selectedGroup.groupName}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {selectedGroup.centerName} • {selectedGroup.meetingLocation} • Officer: {selectedGroup.loanOfficerName}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCompleteMeeting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-md shadow-blue-600/20 transition flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save & Finalize Center Collection</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                  <th className="py-3 px-3">Attendance</th>
                  <th className="py-3 px-3">Member Name & Role</th>
                  <th className="py-3 px-3">Expected Weekly Dues</th>
                  <th className="py-3 px-3">Collection Collected</th>
                  <th className="py-3 px-3">Solidarity Savings (₱100)</th>
                  <th className="py-3 px-3 text-right">Solidarity Guarantor Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedGroup.members.map((m) => {
                  const isPresent = meetingAttendance[m.borrowerId] ?? true;
                  const isPaid = meetingCollections[m.borrowerId] ?? true;
                  return (
                    <tr key={m.borrowerId} className={!isPresent ? 'bg-rose-50/30' : ''}>
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
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className={isPresent ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-medium'}>
                            {isPresent ? 'Present' : 'Absent'}
                          </span>
                        </label>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        <div>{m.fullName}</div>
                        <span className="text-[11px] text-slate-500 font-normal">{m.role}</span>
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-800">{formatCurrency(m.weeklyDues)}</td>
                      <td className="py-3.5 px-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isPaid}
                            onChange={(e) =>
                              setMeetingCollections({
                                ...meetingCollections,
                                [m.borrowerId]: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className={`font-semibold ${isPaid ? 'text-emerald-700' : 'text-amber-600'}`}>
                            {isPaid ? 'Paid in Full (₱' + m.weeklyDues.toLocaleString() + ')' : 'Uncollected'}
                          </span>
                        </label>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-blue-600">₱100.00 / session</td>
                      <td className="py-3.5 px-3 text-right">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-blue-200">
                          Co-Guaranteed by Center
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Solidarity Fund & Joint Liability Explanation Tab */}
      {activeTab === 'solidarityFund' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">HOSCOMO Solidarity & Grameen Protocol</h3>
                <p className="text-xs text-slate-500">Peer accountability & social collateral guidelines</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong>1. Mutual Guarantee (Joint Liability):</strong> Each solidarity group consists of 4 to 8 micro-entrepreneurs. If one member encounters financial difficulty, co-members in the solidarity circle assist with weekly collections or counseling before triggering default procedures.
              </p>
              <p>
                <strong>2. Solidarity Reserve Fund:</strong> Every member deposits ₱100 per weekly center meeting into the group's pooled emergency reserve. This fund covers emergency hospitalizations and temporary installment bridges.
              </p>
              <p>
                <strong>3. Graduated Credit Ladder:</strong> Groups that maintain 98%+ on-time center repayment records automatically unlock higher individual credit ceilings from ₱25,000 up to ₱150,000.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Solidarity Performance Metrics</span>
            </h3>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Average Center Meeting Attendance</span>
                <span className="font-bold text-emerald-600 text-sm">96.4%</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Group Loan Default Rate (PAR &gt; 30)</span>
                <span className="font-bold text-blue-600 text-sm">0.82% (Excellent)</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Total Cumulative Solidarity Fund</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatCurrency(groups.reduce((acc, g) => acc + g.solidarityFundBalance, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal Tab */}
      {activeTab === 'createGroup' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Form New Solidarity Microfinance Group</h2>
            <p className="text-xs text-slate-500 mt-1">
              Assemble 3 to 8 registered HOSCOMO members into a co-guaranteed solidarity circle.
            </p>
          </div>

          <form onSubmit={handleCreateGroup} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Group Circle Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sambayanang Masigasig Group"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Center Name / Station *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Holy Spirit Barangay Hall Center #2"
                  value={newCenterName}
                  onChange={(e) => setNewCenterName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Meeting Day</label>
                <select
                  value={newMeetingDay}
                  onChange={(e) => setNewMeetingDay(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
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
                  placeholder="08:30 AM"
                  value={newMeetingTime}
                  onChange={(e) => setNewMeetingTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Location Details</label>
                <input
                  type="text"
                  placeholder="e.g. Center Pavilion 2"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Select Members */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Select Members for Solidarity Circle (Minimum 3 required)
              </label>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5">
                {borrowers.map((b) => {
                  const isChecked = newSelectedBorrowers.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                        isChecked ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
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
                          className="w-4 h-4 rounded text-blue-600"
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
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/20"
              >
                Confirm & Form Group Circle
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
