import React, { useState, useMemo, useEffect } from 'react';
import {
  Smartphone,
  CreditCard,
  PiggyBank,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  QrCode,
  Shield,
  ShieldCheck,
  User,
  History,
  Send,
  Sparkles,
  ChevronRight,
  Download,
  Info,
  RefreshCw,
  Eye,
  EyeOff,
  Bell,
  Check,
  FileText,
  Clock,
  Printer,
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  ChevronDown,
  ChevronUp,
  Sliders,
  Award,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate, calculateLoanSchedule } from '../utils/loanMath';
import {
  Borrower,
  Loan,
  PaymentRecord,
  SavingsTransaction,
  SolidarityGroup,
  GroupLoan,
  ClientNotification,
  InstallmentScheduleItem,
  MemberUpdateRequest,
} from '../types';
import { ReceiptModal } from './ReceiptModal';
import { SavingsReceiptModal } from './SavingsReceiptModal';
import { ClientNotificationDrawer } from './portal/ClientNotificationDrawer';
import { ClientKycModal } from './portal/ClientKycModal';
import { ClientUpdateRequestModal } from './portal/ClientUpdateRequestModal';

interface ClientPortalViewProps {
  /** When provided (client session), the portal is locked to this member only */
  lockedBorrowerId?: string;
  /** Hides staff-demo controls and adjusts copy for real client sessions */
  isClientSession?: boolean;
}

type PortalTab =
  | 'home'
  | 'profile'
  | 'loans'
  | 'apply'
  | 'schedule'
  | 'pay'
  | 'repayments'
  | 'savings'
  | 'group';

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  lockedBorrowerId,
  isClientSession,
}) => {
  const {
    borrowers,
    loans,
    loanProducts,
    payments,
    savingsAccounts,
    savingsTransactions,
    withdrawalRequests,
    solidarityGroups,
    groupLoans,
    groupMeetingLogs,
    requestSavingsWithdrawal,
    recordPayment,
    createLoanApplication,
    uploadKycDocument,
    submitMemberUpdateRequest,
  } = useLoan();

  // Active Member Selection (Locked when client is authenticated; switchable for staff demo)
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    lockedBorrowerId || borrowers[0]?.id || 'b-1'
  );

  // Sync if lockedBorrowerId changes
  useEffect(() => {
    if (lockedBorrowerId) {
      setSelectedMemberId(lockedBorrowerId);
    }
  }, [lockedBorrowerId]);

  // Current Member Data Isolation
  const currentMember: Borrower | undefined = useMemo(() => {
    const targetId = lockedBorrowerId || selectedMemberId;
    return borrowers.find((b) => b.id === targetId) || (lockedBorrowerId ? undefined : borrowers[0]);
  }, [borrowers, lockedBorrowerId, selectedMemberId]);

  // UI State
  const [portalTab, setPortalTab] = useState<PortalTab>('home');
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(false);
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState<boolean>(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState<boolean>(false);
  const [isUpdateRequestOpen, setIsUpdateRequestOpen] = useState<boolean>(false);

  // Modals for receipts
  const [activePaymentReceipt, setActivePaymentReceipt] = useState<PaymentRecord | null>(null);
  const [activeSavingsReceipt, setActiveSavingsReceipt] = useState<SavingsTransaction | null>(null);

  // Selected Loan for Schedule View
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'UPCOMING' | 'PAID'>('ALL');

  // Self Service Loan Application Form State
  const [applyProductId, setApplyProductId] = useState<string>(loanProducts[0]?.id || '');
  const [applyAmount, setApplyAmount] = useState<number>(25000);
  const [applyTermMonths, setApplyTermMonths] = useState<number>(6);
  const [applyFrequency, setApplyFrequency] = useState<'Weekly' | 'Bi-Weekly' | 'Monthly'>('Monthly');
  const [applyPurpose, setApplyPurpose] = useState<string>('Sari-sari store inventory replenishment');
  const [applyGuarantorName, setApplyGuarantorName] = useState<string>('');
  const [applyGuarantorPhone, setApplyGuarantorPhone] = useState<string>('');
  const [applyCollateralDesc, setApplyCollateralDesc] = useState<string>('');
  const [applySuccessMessage, setApplySuccessMessage] = useState<string>('');

  // Self Service Withdrawal State
  const [withdrawAmount, setWithdrawAmount] = useState<number>(1000);
  const [withdrawReason, setWithdrawReason] = useState<string>('Family medical & school emergency allowance');
  const [withdrawSuccessMessage, setWithdrawSuccessMessage] = useState<string>('');

  // Digital Repayment State
  const [payLoanId, setPayLoanId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<number>(1850);
  const [payMethod, setPayMethod] = useState<'GCash' | 'Maya' | 'Bank Transfer' | 'Cash'>('GCash');
  const [payRef, setPayRef] = useState<string>(() => 'GCASH-' + Math.floor(100000 + Math.random() * 900000));
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string>('');
  const [lastPaymentRecord, setLastPaymentRecord] = useState<PaymentRecord | null>(null);

  // Notifications state (with local read tracker)
  const [readNotifIds, setReadNotifIds] = useState<Record<string, boolean>>({});

  // ----------------------------------------------------
  // ISOLATED MEMBER DATA COMPUTATIONS
  // ----------------------------------------------------
  const memberLoans = useMemo(() => {
    if (!currentMember) return [];
    return loans.filter((l) => l.borrowerId === currentMember.id);
  }, [loans, currentMember]);

  const activeLoan = useMemo(() => {
    return memberLoans.find((l) => l.status === 'Disbursed' || l.status === 'Active' || l.status === 'In Arrears') || memberLoans[0];
  }, [memberLoans]);

  const targetScheduleLoan = useMemo(() => {
    if (selectedLoanId) {
      return memberLoans.find((l) => l.id === selectedLoanId) || activeLoan;
    }
    return activeLoan;
  }, [memberLoans, selectedLoanId, activeLoan]);

  const memberPayments = useMemo(() => {
    if (!currentMember) return [];
    return payments
      .filter((p) => p.borrowerId === currentMember.id)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [payments, currentMember]);

  const memberSavingsAccount = useMemo(() => {
    if (!currentMember) return undefined;
    return savingsAccounts.find(
      (a) => a.clientId === currentMember.id || a.memberId === currentMember.id
    );
  }, [savingsAccounts, currentMember]);

  const memberSavingsTransactions = useMemo(() => {
    if (!currentMember) return [];
    return savingsTransactions
      .filter((t) => t.memberId === currentMember.id || t.clientId === currentMember.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [savingsTransactions, currentMember]);

  const memberWithdrawals = useMemo(() => {
    if (!currentMember) return [];
    return withdrawalRequests
      .filter((w) => w.memberId === currentMember.id)
      .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [withdrawalRequests, currentMember]);

  const memberSolidarityGroup: SolidarityGroup | undefined = useMemo(() => {
    if (!currentMember) return undefined;
    return solidarityGroups.find(
      (g) =>
        g.leaderBorrowerId === currentMember.id ||
        g.members.some((m) => m.borrowerId === currentMember.id)
    );
  }, [solidarityGroups, currentMember]);

  const memberGroupObligation = useMemo(() => {
    if (!memberSolidarityGroup || !currentMember) return undefined;
    return memberSolidarityGroup.members.find((m) => m.borrowerId === currentMember.id);
  }, [memberSolidarityGroup, currentMember]);

  const memberGroupLoans = useMemo(() => {
    if (!memberSolidarityGroup) return [];
    return groupLoans.filter((gl) => gl.groupId === memberSolidarityGroup.id);
  }, [groupLoans, memberSolidarityGroup]);

  // Selected Product for Application Preview
  const selectedProduct = useMemo(() => {
    return loanProducts.find((p) => p.id === applyProductId) || loanProducts[0];
  }, [loanProducts, applyProductId]);

  // Dynamic live schedule calculation for loan application
  const liveApplicationEstimate = useMemo(() => {
    if (!selectedProduct) return null;
    const calc = calculateLoanSchedule({
      principal: applyAmount,
      annualInterestRate: selectedProduct.interestRate,
      termMonths: applyTermMonths,
      repaymentFrequency: applyFrequency,
      interestType: selectedProduct.interestType,
      processingFeePercentage: selectedProduct.processingFeePercentage || 2,
      startDate: new Date().toISOString().split('T')[0],
    });

    const netProceeds = applyAmount - calc.processingFee;

    return {
      totalPayable: calc.totalPayable,
      totalInterest: calc.totalInterest,
      periodicInstallment: calc.installmentAmount,
      processingFee: calc.processingFee,
      netProceeds,
      installmentsCount: calc.totalInstallments,
    };
  }, [selectedProduct, applyAmount, applyTermMonths, applyFrequency]);

  // ----------------------------------------------------
  // GENERATE DYNAMIC NOTIFICATIONS FOR MEMBER
  // ----------------------------------------------------
  const memberNotifications: ClientNotification[] = useMemo(() => {
    if (!currentMember) return [];
    const notifs: ClientNotification[] = [];

    // 1. Loan Approval / Disbursement / Pipeline Updates
    memberLoans.forEach((loan) => {
      if (loan.coopStep === 'MANAGER_APPROVED' || loan.status === 'Approved') {
        notifs.push({
          id: `notif-appr-${loan.id}`,
          borrowerId: currentMember.id,
          type: 'LOAN_APPROVAL',
          category: 'LOANS',
          title: 'Loan Approved by Management',
          message: `Your loan application ${loan.loanNumber} for ${formatCurrency(loan.principalAmount)} was approved! Disbursement voucher is prepared.`,
          timestamp: loan.approvalDate || loan.applicationDate,
          isRead: !!readNotifIds[`notif-appr-${loan.id}`],
          actionTab: 'loans',
          metadata: { loanId: loan.id, loanNumber: loan.loanNumber, amount: loan.principalAmount },
        });
      }
      if (loan.status === 'Disbursed' || loan.coopStep === 'DISBURSED') {
        notifs.push({
          id: `notif-disb-${loan.id}`,
          borrowerId: currentMember.id,
          type: 'LOAN_DISBURSED',
          category: 'LOANS',
          title: 'Funds Disbursed & Released',
          message: `Proceeds of ${formatCurrency(loan.principalAmount)} for ${loan.productName} (${loan.loanNumber}) have been released to your account.`,
          timestamp: loan.disbursedDate || loan.applicationDate,
          isRead: !!readNotifIds[`notif-disb-${loan.id}`],
          actionTab: 'loans',
          metadata: { loanId: loan.id, loanNumber: loan.loanNumber, amount: loan.principalAmount },
        });
      }
      if (loan.status === 'Rejected') {
        notifs.push({
          id: `notif-rej-${loan.id}`,
          borrowerId: currentMember.id,
          type: 'LOAN_REJECTED',
          category: 'LOANS',
          title: 'Loan Application Update',
          message: `Application ${loan.loanNumber} was reviewed: ${loan.rejectionReason || 'Capacity to pay evaluation did not meet criteria'}.`,
          timestamp: loan.applicationDate,
          isRead: !!readNotifIds[`notif-rej-${loan.id}`],
          actionTab: 'loans',
        });
      }

      // Upcoming & Overdue installments
      if (loan.status === 'Disbursed' || loan.status === 'In Arrears') {
        if (loan.daysInArrears && loan.daysInArrears > 0) {
          notifs.push({
            id: `notif-overdue-${loan.id}`,
            borrowerId: currentMember.id,
            type: 'OVERDUE_PAYMENT',
            category: 'PAYMENTS',
            title: 'Urgent: Overdue Payment Reminder',
            message: `Account ${loan.loanNumber} is ${loan.daysInArrears} days past due. Please settle your installment to prevent late penalty charges.`,
            timestamp: new Date().toISOString(),
            isRead: !!readNotifIds[`notif-overdue-${loan.id}`],
            actionTab: 'pay',
            metadata: { loanId: loan.id, loanNumber: loan.loanNumber },
          });
        } else if (loan.nextPaymentDate) {
          notifs.push({
            id: `notif-upc-${loan.id}`,
            borrowerId: currentMember.id,
            type: 'UPCOMING_PAYMENT',
            category: 'PAYMENTS',
            title: 'Upcoming Installment Due Soon',
            message: `Next installment of approx ${formatCurrency(Math.round(loan.totalPayable / loan.totalInstallments))} is due on ${formatDate(loan.nextPaymentDate)}.`,
            timestamp: loan.nextPaymentDate,
            isRead: !!readNotifIds[`notif-upc-${loan.id}`],
            actionTab: 'pay',
            metadata: { loanId: loan.id, loanNumber: loan.loanNumber, dueDate: loan.nextPaymentDate },
          });
        }
      }
    });

    // 2. Payment Confirmations
    memberPayments.slice(0, 3).forEach((p) => {
      notifs.push({
        id: `notif-pay-${p.id}`,
        borrowerId: currentMember.id,
        type: 'PAYMENT_CONFIRMATION',
        category: 'PAYMENTS',
        title: 'Payment Received & Confirmed',
        message: `Official Receipt ${p.receiptNumber} generated for payment of ${formatCurrency(p.amount)} via ${p.paymentMethod}.`,
        timestamp: p.paymentDate,
        isRead: !!readNotifIds[`notif-pay-${p.id}`],
        actionTab: 'repayments',
        metadata: { receiptNumber: p.receiptNumber, amount: p.amount },
      });
    });

    // 3. Savings Transactions
    memberSavingsTransactions.slice(0, 2).forEach((t) => {
      notifs.push({
        id: `notif-sav-${t.id}`,
        borrowerId: currentMember.id,
        type: 'SAVINGS_TRANSACTION',
        category: 'SAVINGS',
        title: `${t.type} Recorded`,
        message: `${t.type} of ${formatCurrency(t.amount)} posted to your Savings Account. New balance: ${formatCurrency(t.balanceAfter)}.`,
        timestamp: t.date,
        isRead: !!readNotifIds[`notif-sav-${t.id}`],
        actionTab: 'savings',
        metadata: { amount: t.amount },
      });
    });

    // 4. Group Lending Alert
    if (memberSolidarityGroup) {
      notifs.push({
        id: `notif-grp-${memberSolidarityGroup.id}`,
        borrowerId: currentMember.id,
        type: 'GROUP_LENDING_ALERT',
        category: 'GROUP',
        title: `Center Meeting Notice: ${memberSolidarityGroup.groupName}`,
        message: `Weekly solidarity circle meeting is scheduled every ${memberSolidarityGroup.meetingDay} at ${memberSolidarityGroup.meetingTime}. Weekly dues: ${formatCurrency(memberGroupObligation?.weeklyDues || 300)}.`,
        timestamp: memberSolidarityGroup.formedDate || '2026-08-01',
        isRead: !!readNotifIds[`notif-grp-${memberSolidarityGroup.id}`],
        actionTab: 'group',
        metadata: { groupCode: memberSolidarityGroup.groupCode },
      });
    }

    return notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [
    currentMember,
    memberLoans,
    memberPayments,
    memberSavingsTransactions,
    memberSolidarityGroup,
    memberGroupObligation,
    readNotifIds,
  ]);

  const unreadNotifCount = memberNotifications.filter((n) => !n.isRead).length;

  const handleMarkNotifAsRead = (id: string) => {
    setReadNotifIds((prev) => ({ ...prev, [id]: true }));
  };

  const handleMarkAllNotifsAsRead = () => {
    const updated: Record<string, boolean> = {};
    memberNotifications.forEach((n) => {
      updated[n.id] = true;
    });
    setReadNotifIds(updated);
  };

  // ----------------------------------------------------
  // EVENT HANDLERS
  // ----------------------------------------------------
  const handleApplyLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember || !selectedProduct) return;

    const newLoan = createLoanApplication({
      borrowerId: currentMember.id,
      borrowerName: currentMember.fullName,
      borrowerPhone: currentMember.phone,
      branchId: currentMember.branchId,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      principalAmount: applyAmount,
      interestRate: selectedProduct.interestRate,
      interestType: selectedProduct.interestType,
      repaymentFrequency: applyFrequency,
      termMonths: applyTermMonths,
      purpose: applyPurpose,
      collaterals: applyCollateralDesc
        ? [
            {
              id: 'col-' + Date.now(),
              type: 'Appliance / Vehicle / Property',
              description: applyCollateralDesc,
              estimatedValue: applyAmount * 1.2,
            },
          ]
        : [],
      guarantors: applyGuarantorName
        ? [
            {
              id: 'guar-' + Date.now(),
              fullName: applyGuarantorName,
              relationship: 'Co-Maker / Family',
              phone: applyGuarantorPhone || '0917-000-0000',
              idNumber: 'ID-' + Math.floor(10000 + Math.random() * 90000),
              monthlyIncome: 25000,
            },
          ]
        : [],
    });

    setApplySuccessMessage(
      `Loan application submitted successfully! Reference Number: ${newLoan.loanNumber}. It is now in the Loan Processor verification queue.`
    );
    setTimeout(() => {
      setApplySuccessMessage('');
      setPortalTab('loans');
    }, 3500);
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember) return;
    const currentBal = currentMember.savingsBalance || 1000;
    if (withdrawAmount > currentBal - 1000) {
      alert('Withdrawal exceeds allowable limit. You must maintain ₱1,000 maintaining balance.');
      return;
    }

    const res = requestSavingsWithdrawal({
      memberId: currentMember.id,
      amount: withdrawAmount,
      reason: withdrawReason,
    });

    if (res.success) {
      setWithdrawSuccessMessage(
        `Withdrawal request for ₱${withdrawAmount.toLocaleString()} submitted for Branch Manager Review!`
      );
    } else {
      alert(res.error || 'Failed to submit withdrawal');
    }
    setTimeout(() => setWithdrawSuccessMessage(''), 6000);
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    const loanToPay = memberLoans.find((l) => l.id === payLoanId) || activeLoan;
    if (!loanToPay) {
      alert('No active loan found to apply repayment.');
      return;
    }

    const rec = recordPayment({
      loanId: loanToPay.id,
      amount: payAmount,
      paymentMethod: payMethod as any,
      transactionReference: payRef,
      notes: `Self-Service Client Portal Online Payment (${payMethod})`,
      date: new Date().toISOString().split('T')[0],
    });

    if (rec) {
      setLastPaymentRecord(rec);
      setPaymentSuccessMessage(
        `Payment of ₱${payAmount.toLocaleString()} received successfully! Official Receipt #${rec.receiptNumber} is generated.`
      );
      // Generate new mock ref for next payment
      setPayRef('GCASH-' + Math.floor(100000 + Math.random() * 900000));
    }
  };

  // Helper for 6-step timeline badge
  const getPipelineStepIndex = (step?: string, status?: string) => {
    if (status === 'Disbursed' || step === 'DISBURSED') return 6;
    if (status === 'Approved' || step === 'MANAGER_APPROVED') return 5;
    if (step === 'VOUCHER_PREPARED') return 4;
    if (step === 'CREDIT_COMM_INTERVIEW') return 3;
    if (step === 'BOOKKEEPER_VERIFIED') return 2;
    if (step === 'PROCESSOR_VERIFIED') return 1;
    return 0;
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Top Banner & Client Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            <Smartphone className="w-4 h-4" />
            <span>HOSCOMO Client Self-Service Portal {isClientSession ? '' : '(Staff Simulation View)'}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isClientSession
              ? `Mabuhay, ${currentMember?.fullName || 'Member'}`
              : 'Client Self-Service & Digital Passbook'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            {isClientSession
              ? 'Manage your active loans, track loan approvals, view passbook savings, pay dues online, and download official receipts.'
              : 'Simulate member experience: borrowers have strict data isolation to inspect their own profile, KYC, passbook, group dues, and loan schedules.'}
          </p>
        </div>

        {/* Member Selector (Staff Demo Only) & Quick Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {!lockedBorrowerId && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 font-medium">Viewing Member:</span>
              <select
                value={selectedMemberId}
                onChange={(e) => {
                  setSelectedMemberId(e.target.value);
                  setSelectedLoanId('');
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                {borrowers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.fullName} ({b.borrowerNumber})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notifications Button */}
          <button
            onClick={() => setIsNotifDrawerOpen(true)}
            className="relative p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {/* Mobile Phone Mockup Toggle */}
          {!lockedBorrowerId && (
            <button
              onClick={() => setIsMobileFrame(!isMobileFrame)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                isMobileFrame
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{isMobileFrame ? 'Wide View' : 'Phone Frame'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Responsive Canvas or Phone Shell */}
      <div className={`mx-auto transition-all ${isMobileFrame ? 'max-w-md' : 'max-w-6xl'}`}>
        <div
          className={`bg-slate-900 text-white transition-all overflow-hidden ${
            isMobileFrame
              ? 'rounded-[44px] p-4 shadow-2xl border-4 border-slate-800 ring-8 ring-slate-950'
              : 'rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800'
          }`}
        >
          {/* Phone Frame Speaker Notch */}
          {isMobileFrame && (
            <div className="flex justify-center mb-4">
              <div className="w-24 h-4 bg-slate-800 rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
              </div>
            </div>
          )}

          {/* Member Profile Quick Card in Portal Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 border border-white/20 flex items-center justify-center text-white font-bold text-xl shadow-md">
                {currentMember?.fullName.charAt(0) || 'M'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-blue-200 uppercase font-semibold tracking-wider">
                    Cooperative Member
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      currentMember?.kycStatus === 'Verified'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    KYC {currentMember?.kycStatus || 'Verified'}
                  </span>
                </div>
                <h2 className="font-bold text-white text-lg leading-tight">{currentMember?.fullName}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-300 font-mono mt-0.5">
                  <span>{currentMember?.borrowerNumber}</span>
                  <span>•</span>
                  <span>Credit Tier {currentMember?.creditTier || 'Good'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:self-center">
              <button
                onClick={() => setPortalTab('profile')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-blue-300" />
                <span>My Profile</span>
              </button>
              <button
                onClick={() => setIsKycModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 text-xs font-semibold border border-teal-500/30 transition flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
                <span>KYC Vault</span>
              </button>
            </div>
          </div>

          {/* Navigation Bar / Tabs */}
          <div className="flex gap-1.5 py-4 overflow-x-auto no-scrollbar text-xs border-b border-white/10">
            {[
              { id: 'home', label: 'Overview', icon: Layers },
              { id: 'profile', label: 'Profile & KYC', icon: User },
              { id: 'loans', label: `My Loans (${memberLoans.length})`, icon: CreditCard },
              { id: 'apply', label: '+ Apply Loan', icon: Sparkles },
              { id: 'schedule', label: 'Amortization', icon: Calendar },
              { id: 'pay', label: 'Pay Online', icon: QrCode },
              { id: 'repayments', label: 'Payment History', icon: History },
              { id: 'savings', label: 'Savings & Passbook', icon: PiggyBank },
              { id: 'group', label: 'Solidarity Group', icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = portalTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setPortalTab(tab.id as PortalTab)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Notification / Alert Banners */}
          {(applySuccessMessage || withdrawSuccessMessage || paymentSuccessMessage) && (
            <div className="my-4 p-4 bg-emerald-950/90 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{applySuccessMessage || withdrawSuccessMessage || paymentSuccessMessage}</span>
              </div>
              {lastPaymentRecord && (
                <button
                  onClick={() => setActivePaymentReceipt(lastPaymentRecord)}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shrink-0 flex items-center gap-1 shadow-md"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Receipt</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {portalTab === 'home' && (
            <div className="space-y-6 pt-2">
              {/* Virtual ATM / Savings Card */}
              <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 rounded-3xl shadow-xl relative overflow-hidden text-white border border-white/10">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] text-blue-100/90 uppercase tracking-wider font-semibold">
                      HOSCOMO Regular Savings Passbook
                    </span>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-3xl sm:text-4xl font-bold tracking-tight">
                        {showBalance ? formatCurrency(currentMember?.savingsBalance || 1500) : '₱ ••••••••'}
                      </span>
                      <button
                        onClick={() => setShowBalance(!showBalance)}
                        className="p-1 text-blue-200 hover:text-white transition"
                        title={showBalance ? 'Hide balance' : 'Show balance'}
                      >
                        {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <span className="text-xs text-blue-200/80 font-mono mt-1 block">
                      Account: {memberSavingsAccount?.accountNumber || `SAV-2026-${currentMember?.borrowerNumber?.replace(/\D/g, '') || '101'}`}
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                    <PiggyBank className="w-6 h-6" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3 text-xs border-t border-white/15 pt-4">
                  <div>
                    <span className="text-[10px] text-blue-200 block">Share Capital Equity</span>
                    <span className="font-bold text-white text-sm">
                      {formatCurrency(currentMember?.shareCapital || 15000)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-200 block">Available Withdrawable</span>
                    <span className="font-bold text-emerald-300 text-sm">
                      {formatCurrency(Math.max(0, (currentMember?.savingsBalance || 1500) - 1000))}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-200 block">Interest Yield</span>
                    <span className="font-semibold text-emerald-300">1.0% p.a. Compounded</span>
                  </div>
                </div>
              </div>

              {/* Active Loan Quick Card */}
              {activeLoan ? (
                <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-3xl space-y-4 shadow-md">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400 font-bold text-sm">{activeLoan.loanNumber}</span>
                      <span className="text-slate-400 font-medium">• {activeLoan.productName}</span>
                    </div>
                    <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full font-semibold">
                      {activeLoan.status}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Remaining Loan Balance</span>
                      <span className="text-2xl sm:text-3xl font-bold text-white">
                        {formatCurrency(activeLoan.remainingBalance)}
                      </span>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        of {formatCurrency(activeLoan.totalPayable)} Total Payable ({Math.round(((activeLoan.totalPaid || 0) / activeLoan.totalPayable) * 100)}% Repaid)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedLoanId(activeLoan.id);
                          setPortalTab('schedule');
                        }}
                        className="px-3.5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Schedule</span>
                      </button>
                      <button
                        onClick={() => {
                          setPayLoanId(activeLoan.id);
                          setPortalTab('pay');
                        }}
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Pay Due</span>
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="w-full bg-slate-700/80 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-emerald-400 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round(((activeLoan.totalPaid || 0) / activeLoan.totalPayable) * 100))}%`,
                        }}
                      ></div>
                    </div>
                    <div className="text-[11px] text-slate-400 flex justify-between pt-1">
                      <span>Total Paid: {formatCurrency(activeLoan.totalPaid || 0)}</span>
                      <span>Next Due: {formatDate(activeLoan.nextPaymentDate || '2026-08-30')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/50 border border-slate-700/60 p-6 rounded-3xl text-center space-y-3">
                  <CreditCard className="w-8 h-8 text-blue-400 mx-auto" />
                  <h4 className="font-bold text-white text-sm">No Active Loan Accounts</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    You currently have zero outstanding loan balance. You are eligible to apply for instant micro-credit or seasonal agriculture financing.
                  </p>
                  <button
                    onClick={() => setPortalTab('apply')}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md transition inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Apply for Member Loan</span>
                  </button>
                </div>
              )}

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => setPortalTab('pay')}
                  className="bg-slate-800 hover:bg-slate-750 p-4 rounded-2xl border border-slate-700 text-left transition space-y-1.5"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-white block">Pay Loan Online</span>
                  <span className="text-[11px] text-slate-400 block">GCash / Maya / Bank</span>
                </button>

                <button
                  onClick={() => setPortalTab('apply')}
                  className="bg-slate-800 hover:bg-slate-750 p-4 rounded-2xl border border-slate-700 text-left transition space-y-1.5"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-white block">Apply Micro-Loan</span>
                  <span className="text-[11px] text-slate-400 block">Fast credit scoring</span>
                </button>

                <button
                  onClick={() => setPortalTab('savings')}
                  className="bg-slate-800 hover:bg-slate-750 p-4 rounded-2xl border border-slate-700 text-left transition space-y-1.5"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-white block">Savings Withdrawal</span>
                  <span className="text-[11px] text-slate-400 block">Submit to branch teller</span>
                </button>

                <button
                  onClick={() => setPortalTab('repayments')}
                  className="bg-slate-800 hover:bg-slate-750 p-4 rounded-2xl border border-slate-700 text-left transition space-y-1.5"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-white block">Official Receipts</span>
                  <span className="text-[11px] text-slate-400 block">View & download slips</span>
                </button>
              </div>

              {/* Solidarity Group Quick Snippet if member belongs to a group */}
              {memberSolidarityGroup && (
                <div className="bg-slate-800/70 border border-purple-500/30 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] text-purple-300 uppercase tracking-wider font-semibold">
                        Solidarity Circle • {memberSolidarityGroup.groupCode}
                      </span>
                      <h4 className="font-bold text-white text-sm">{memberSolidarityGroup.groupName}</h4>
                      <p className="text-xs text-slate-400">
                        Meets every {memberSolidarityGroup.meetingDay} {memberSolidarityGroup.meetingTime} • Weekly Dues: {formatCurrency(memberGroupObligation?.weeklyDues || 300)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setPortalTab('group')}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition shrink-0"
                  >
                    View Group Standing
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROFILE & KYC */}
          {portalTab === 'profile' && currentMember && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Member Profile & Verified Identity</h3>
                  <p className="text-xs text-slate-400">Official cooperative membership record & KYC tier</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsUpdateRequestOpen(true)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Request Update</span>
                  </button>
                  <button
                    onClick={() => setIsKycModalOpen(true)}
                    className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Manage Documents</span>
                  </button>
                </div>
              </div>

              {/* Grid of Profile Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Personal Information */}
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-700 pb-2">
                    <User className="w-4 h-4 text-blue-400" />
                    Personal & Membership Info
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Full Legal Name</span>
                      <span className="font-semibold text-white">{currentMember.fullName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Member ID Number</span>
                      <span className="font-mono font-bold text-blue-400">{currentMember.borrowerNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Date of Birth</span>
                      <span>{currentMember.dateOfBirth ? formatDate(currentMember.dateOfBirth) : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Civil Status / Gender</span>
                      <span>{currentMember.civilStatus || 'Single'} • {currentMember.gender || 'Female'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Primary ID / TIN</span>
                      <span className="font-mono">{currentMember.idNumber || 'PH-ID-2026-9901'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Member Status</span>
                      <span className="text-emerald-400 font-semibold">{currentMember.memberStatus || 'Active Member'}</span>
                    </div>
                  </div>
                </div>

                {/* Contact & Residential */}
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-700 pb-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    Contact & Residential Address
                  </h4>
                  <div className="space-y-2 text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Primary Phone</span>
                      <span className="font-mono font-semibold text-white">{currentMember.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Email Address</span>
                      <span className="font-mono">{currentMember.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Home Address</span>
                      <span>{currentMember.address}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Home Ownership</span>
                        <span>{currentMember.homeOwnership || 'Owned'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Years at Residence</span>
                        <span>{currentMember.yearsAtAddress || 5} years</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Employment & Business */}
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-700 pb-2">
                    <Briefcase className="w-4 h-4 text-amber-400" />
                    Livelihood & Financial Profile
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Employment Type</span>
                      <span className="font-semibold text-white">{currentMember.employmentStatus}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Occupation / Business</span>
                      <span>{currentMember.occupation}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Business / Employer</span>
                      <span>{currentMember.employerOrBusiness}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Monthly Gross Income</span>
                      <span className="font-bold text-emerald-400">{formatCurrency(currentMember.monthlyIncome)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Monthly Expenses</span>
                      <span className="text-slate-300">{formatCurrency(currentMember.monthlyExpenses)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Estimated Net Surplus</span>
                      <span className="font-bold text-blue-300">
                        {formatCurrency(Math.max(0, currentMember.monthlyIncome - currentMember.monthlyExpenses))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact & Beneficiary */}
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-700 pb-2">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    Emergency Contact & Beneficiary
                  </h4>
                  <div className="space-y-2 text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Contact Person / Co-Maker</span>
                      <span className="font-semibold text-white">
                        {currentMember.emergencyContactName || 'Family Co-Maker'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Relationship</span>
                      <span>{currentMember.emergencyContactRelation || 'Spouse / Parent'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Emergency Phone</span>
                      <span className="font-mono">{currentMember.emergencyContactPhone || '0918-000-0000'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KYC Document Vault preview banner */}
              <div className="bg-slate-800/80 border border-teal-500/30 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Cooperative KYC Document Vault</h4>
                    <p className="text-xs text-slate-400">
                      {currentMember.kycDocuments?.length || 3} uploaded identity documents on file • Tier {currentMember.creditTier || 'Good'} status
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsKycModalOpen(true)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shrink-0"
                >
                  Open Document Vault
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MY LOANS & APPROVAL PIPELINE */}
          {portalTab === 'loans' && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Loan Accounts & Approval Status</h3>
                  <p className="text-xs text-slate-400">Monitor active balances, terms, and committee review pipelines</p>
                </div>
                <button
                  onClick={() => setPortalTab('apply')}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+ New Loan Application</span>
                </button>
              </div>

              {memberLoans.length === 0 ? (
                <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-3xl text-center space-y-3">
                  <CreditCard className="w-10 h-10 text-slate-500 mx-auto" />
                  <h4 className="font-bold text-white text-sm">No Loan Records Found</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    You have no previous or active loans on record. Apply for a micro-enterprise loan or salary advance today.
                  </p>
                  <button
                    onClick={() => setPortalTab('apply')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md"
                  >
                    Start Online Loan Application
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {memberLoans.map((loan) => {
                    const stepIdx = getPipelineStepIndex(loan.coopStep, loan.status);
                    const isPending =
                      loan.status === 'Submitted' ||
                      loan.status === 'Under Review' ||
                      loan.status === 'Draft' ||
                      (loan.coopStep && loan.coopStep !== 'DISBURSED' && loan.coopStep !== 'REJECTED');

                    return (
                      <div
                        key={loan.id}
                        className="bg-slate-800 p-5 rounded-3xl border border-slate-700 space-y-4 text-xs shadow-md"
                      >
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-blue-400">{loan.loanNumber}</span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  loan.status === 'Disbursed' || loan.status === 'Active'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : loan.status === 'In Arrears'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : loan.status === 'Rejected'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {loan.status}
                              </span>
                            </div>
                            <span className="text-white font-semibold text-sm mt-0.5 block">{loan.productName}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedLoanId(loan.id);
                                setPortalTab('schedule');
                              }}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-semibold transition"
                            >
                              Amortization Schedule
                            </button>
                            {(loan.status === 'Disbursed' || loan.status === 'In Arrears' || loan.status === 'Active') && (
                              <button
                                onClick={() => {
                                  setPayLoanId(loan.id);
                                  setPortalTab('pay');
                                }}
                                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-md transition"
                              >
                                Pay Dues
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Loan Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
                          <div>
                            <span className="text-slate-500 block text-[11px]">Principal Disbursed</span>
                            <span className="font-bold text-white text-sm">{formatCurrency(loan.principalAmount)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Outstanding Balance</span>
                            <span className="font-bold text-emerald-400 text-sm">{formatCurrency(loan.remainingBalance)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Interest & Tenor</span>
                            <span>{loan.interestRate}% • {loan.termMonths} Mos ({loan.repaymentFrequency})</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Next Installment Due</span>
                            <span className="font-semibold text-white">
                              {loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'Settled'}
                            </span>
                          </div>
                        </div>

                        {/* 6-Step Approval Timeline Tracker */}
                        {isPending && (
                          <div className="pt-2 border-t border-slate-700/60 space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-400" />
                                6-Step Cooperative Approval Pipeline Tracker
                              </span>
                              <span className="text-blue-300 font-bold">
                                Step {Math.min(6, stepIdx + 1)} of 6
                              </span>
                            </div>

                            <div className="grid grid-cols-6 gap-1 pt-1">
                              {[
                                '1. Submitted',
                                '2. Processor',
                                '3. Bookkeeper',
                                '4. Credit Comm',
                                '5. Voucher',
                                '6. Disbursed',
                              ].map((stepName, i) => (
                                <div key={stepName} className="space-y-1">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      i <= stepIdx
                                        ? 'bg-blue-500 shadow-sm'
                                        : 'bg-slate-700'
                                    }`}
                                  ></div>
                                  <span
                                    className={`block text-[9px] truncate ${
                                      i <= stepIdx ? 'text-blue-300 font-semibold' : 'text-slate-500'
                                    }`}
                                  >
                                    {stepName}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {loan.creditCommitteeEval?.committeeNotes && (
                              <div className="p-2.5 bg-slate-900/80 rounded-xl text-[11px] text-slate-400 border border-slate-700/50 mt-2">
                                <strong className="text-slate-300">Credit Committee Remarks: </strong>
                                {loan.creditCommitteeEval.committeeNotes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: APPLY MICRO-LOAN WIZARD */}
          {portalTab === 'apply' && (
            <div className="space-y-6 pt-2">
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 space-y-5">
                <div>
                  <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span>HOSCOMO Automated Loan Origination</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Self-Service Loan Application</h3>
                  <p className="text-xs text-slate-400">
                    Calculate your exact repayments, check eligibility, and submit your request directly to the loan processing queue.
                  </p>
                </div>

                <form onSubmit={handleApplyLoan} className="space-y-4 text-xs">
                  {/* Select Product */}
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1.5">Select Loan Product</label>
                    <select
                      value={applyProductId}
                      onChange={(e) => setApplyProductId(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {loanProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.interestRate}% annual • {p.description})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount and Tenor */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">
                        Principal Amount (₱): {formatCurrency(applyAmount)}
                      </label>
                      <input
                        type="number"
                        min={selectedProduct?.minAmount || 5000}
                        max={selectedProduct?.maxAmount || 200000}
                        step={1000}
                        value={applyAmount}
                        onChange={(e) => setApplyAmount(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Tenor (Months)</label>
                      <input
                        type="number"
                        min={selectedProduct?.minTermMonths || 1}
                        max={selectedProduct?.maxTermMonths || 36}
                        value={applyTermMonths}
                        onChange={(e) => setApplyTermMonths(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Repayment Frequency</label>
                      <select
                        value={applyFrequency}
                        onChange={(e) => setApplyFrequency(e.target.value as any)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium"
                      >
                        <option value="Weekly">Weekly Installments</option>
                        <option value="Bi-Weekly">Bi-Weekly (Semi-Monthly)</option>
                        <option value="Monthly">Monthly Installments</option>
                      </select>
                    </div>
                  </div>

                  {/* Stated Purpose */}
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Stated Purpose of Funds</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sari-sari store inventory, farm inputs, school tuition"
                      value={applyPurpose}
                      onChange={(e) => setApplyPurpose(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>

                  {/* Optional Co-Maker / Guarantor & Collateral */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-slate-400 block mb-1">Co-Maker / Guarantor Name (Optional)</label>
                      <input
                        type="text"
                        placeholder="Full Name of Co-Maker"
                        value={applyGuarantorName}
                        onChange={(e) => setApplyGuarantorName(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Co-Maker Phone Number</label>
                      <input
                        type="text"
                        placeholder="0917-xxx-xxxx"
                        value={applyGuarantorPhone}
                        onChange={(e) => setApplyGuarantorPhone(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  {/* Live Amortization Calculator Summary Box */}
                  {liveApplicationEstimate && (
                    <div className="p-4 bg-slate-900/90 rounded-2xl border border-blue-500/40 space-y-3">
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Percent className="w-4 h-4 text-blue-400" />
                          Live Amortization & Proceeds Estimate
                        </span>
                        <span className="text-blue-300 font-mono">
                          {liveApplicationEstimate.installmentsCount} Installments
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Est. Installment Due</span>
                          <span className="font-bold text-emerald-400 text-base">
                            {formatCurrency(liveApplicationEstimate.periodicInstallment)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Total Interest</span>
                          <span className="font-semibold text-slate-200">
                            {formatCurrency(liveApplicationEstimate.totalInterest)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Processing Fee</span>
                          <span className="text-slate-300">
                            {formatCurrency(liveApplicationEstimate.processingFee)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Est. Net Proceeds</span>
                          <span className="font-bold text-blue-300 text-sm">
                            {formatCurrency(liveApplicationEstimate.netProceeds)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition text-sm flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Loan Application for Officer Review</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 5: AMORTIZATION SCHEDULE */}
          {portalTab === 'schedule' && (
            <div className="space-y-6 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">Loan Amortization Schedule</h3>
                  <p className="text-xs text-slate-400">Installment breakdown, due dates, and payment allocations</p>
                </div>

                {memberLoans.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Account:</span>
                    <select
                      value={targetScheduleLoan?.id || ''}
                      onChange={(e) => setSelectedLoanId(e.target.value)}
                      className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold"
                    >
                      {memberLoans.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.loanNumber} ({l.productName})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {targetScheduleLoan ? (
                <div className="space-y-4">
                  {/* Schedule Filter Buttons */}
                  <div className="flex gap-2 text-xs">
                    {(['ALL', 'UPCOMING', 'PAID'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setScheduleFilter(f)}
                        className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                          scheduleFilter === f
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {f === 'ALL' ? 'All Installments' : f === 'UPCOMING' ? 'Upcoming & Due' : 'Completed (Paid)'}
                      </button>
                    ))}
                  </div>

                  {/* Schedule Table */}
                  <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                          <tr>
                            <th className="py-3 px-4">#</th>
                            <th className="py-3 px-4">Due Date</th>
                            <th className="py-3 px-4">Principal</th>
                            <th className="py-3 px-4">Interest</th>
                            <th className="py-3 px-4">Total Due</th>
                            <th className="py-3 px-4">Amount Paid</th>
                            <th className="py-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60">
                          {(targetScheduleLoan.schedule || [])
                            .filter((item) => {
                              if (scheduleFilter === 'PAID') return item.status === 'Paid';
                              if (scheduleFilter === 'UPCOMING') return item.status !== 'Paid';
                              return true;
                            })
                            .map((item) => (
                              <tr key={item.installmentNumber} className="hover:bg-slate-750 transition">
                                <td className="py-3 px-4 font-mono text-slate-400">{item.installmentNumber}</td>
                                <td className="py-3 px-4 font-semibold text-white">{formatDate(item.dueDate)}</td>
                                <td className="py-3 px-4 text-slate-300">{formatCurrency(item.principal)}</td>
                                <td className="py-3 px-4 text-slate-300">{formatCurrency(item.interest)}</td>
                                <td className="py-3 px-4 font-bold text-white">{formatCurrency(item.totalDue)}</td>
                                <td className="py-3 px-4 text-emerald-400 font-semibold">
                                  {item.amountPaid ? formatCurrency(item.amountPaid) : '—'}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                      item.status === 'Paid'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : item.status === 'Overdue'
                                        ? 'bg-rose-500/20 text-rose-300'
                                        : item.status === 'Due' || item.status === 'Due Today'
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-slate-700 text-slate-300'
                                    }`}
                                  >
                                    {item.status === 'Paid' ? (
                                      <CheckCircle2 className="w-3 h-3" />
                                    ) : item.status === 'Overdue' ? (
                                      <AlertTriangle className="w-3 h-3" />
                                    ) : (
                                      <Clock className="w-3 h-3" />
                                    )}
                                    {item.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-800/50 rounded-3xl border border-slate-700 text-slate-400 text-xs">
                  No active schedule available.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PAY ONLINE */}
          {portalTab === 'pay' && (
            <div className="space-y-6 pt-2">
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Digital Loan Repayment Portal</h3>
                    <p className="text-xs text-slate-400">GCash, Maya, and Online Bank transfer with instant official receipts</p>
                  </div>
                  <QrCode className="w-8 h-8 text-blue-400" />
                </div>

                <form onSubmit={handlePay} className="space-y-4 text-xs">
                  {/* Select loan to pay */}
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Select Loan Account</label>
                    <select
                      value={payLoanId || activeLoan?.id || ''}
                      onChange={(e) => {
                        setPayLoanId(e.target.value);
                        const selected = memberLoans.find((l) => l.id === e.target.value);
                        if (selected) {
                          setPayAmount(Math.round(selected.totalPayable / selected.totalInstallments));
                        }
                      }}
                      className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium"
                    >
                      {memberLoans.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.loanNumber} • {l.productName} (Balance: {formatCurrency(l.remainingBalance)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-semibold">Repayment Amount (₱)</label>
                      {activeLoan && (
                        <button
                          type="button"
                          onClick={() => setPayAmount(activeLoan.remainingBalance)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Pay Full Balance ({formatCurrency(activeLoan.remainingBalance)})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min={100}
                      value={payAmount}
                      onChange={(e) => setPayAmount(Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-lg"
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Payment Method</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['GCash', 'Maya', 'Bank Transfer', 'Cash'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPayMethod(m)}
                          className={`p-3 rounded-xl border font-bold text-xs transition text-center ${
                            payMethod === m
                              ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-850'
                          }`}
                        >
                          {m === 'GCash'
                            ? 'GCash'
                            : m === 'Maya'
                            ? 'Maya Wallet'
                            : m === 'Bank Transfer'
                            ? 'Online Bank'
                            : 'Branch Counter'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference # */}
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Reference / Transaction Number</label>
                    <input
                      type="text"
                      required
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg transition text-sm flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Post Digital Repayment</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 7: REPAYMENT HISTORY & OFFICIAL RECEIPTS */}
          {portalTab === 'repayments' && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Official Repayment History & Receipts</h3>
                  <p className="text-xs text-slate-400">View and download BIR/CDA compliant collection receipts</p>
                </div>
              </div>

              {memberPayments.length === 0 ? (
                <div className="p-8 text-center bg-slate-800/50 rounded-3xl border border-slate-700 text-slate-400 text-xs">
                  No payment records found for this account.
                </div>
              ) : (
                <div className="space-y-3">
                  {memberPayments.map((p) => (
                    <div
                      key={p.id}
                      className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm hover:border-slate-600 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-sm">{p.receiptNumber}</span>
                            <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                              {p.paymentMethod}
                            </span>
                          </div>
                          <span className="text-slate-400 text-[11px] block mt-0.5">
                            Loan: {p.loanNumber} • Ref: {p.transactionReference} • {formatDate(p.paymentDate)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                        <div className="text-left sm:text-right">
                          <span className="text-[11px] text-slate-400 block">Amount Paid</span>
                          <span className="font-bold text-emerald-400 text-base">{formatCurrency(p.amount)}</span>
                        </div>

                        <button
                          onClick={() => setActivePaymentReceipt(p)}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition flex items-center gap-1 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>View / Print Receipt</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: SAVINGS & PASSBOOK */}
          {portalTab === 'savings' && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Savings Passbook & Capital Build-up</h3>
                  <p className="text-xs text-slate-400">Track regular deposits, dividend accruals, and withdrawal requests</p>
                </div>
              </div>

              {/* Savings Overview Banner */}
              <div className="bg-slate-800 p-5 rounded-3xl border border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Regular Savings Balance</span>
                  <span className="text-xl font-bold text-white">
                    {formatCurrency(currentMember?.savingsBalance || 1500)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Maintaining Balance</span>
                  <span className="text-slate-300 font-semibold">₱1,000.00 Required</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Withdrawable Balance</span>
                  <span className="text-xl font-bold text-emerald-400">
                    {formatCurrency(Math.max(0, (currentMember?.savingsBalance || 1500) - 1000))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Share Capital Equity</span>
                  <span className="text-xl font-bold text-blue-300">
                    {formatCurrency(currentMember?.shareCapital || 15000)}
                  </span>
                </div>
              </div>

              {/* Submit Withdrawal Request Form */}
              <div className="bg-slate-800 p-5 rounded-3xl border border-slate-700 space-y-4 text-xs">
                <h4 className="font-bold text-white text-sm flex items-center justify-between">
                  <span>Request Savings Withdrawal</span>
                  <span className="text-[11px] text-amber-400">Branch Manager Approval Required</span>
                </h4>

                <form onSubmit={handleWithdraw} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Amount to Withdraw (₱)</label>
                      <input
                        type="number"
                        min={100}
                        max={Math.max(100, (currentMember?.savingsBalance || 1500) - 1000)}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Reason / Purpose</label>
                      <input
                        type="text"
                        required
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md transition"
                  >
                    Submit Withdrawal Request to Teller Desk
                  </button>
                </form>
              </div>

              {/* Passbook Transactions Ledger */}
              <div className="space-y-3">
                <h4 className="font-bold text-white text-sm">Passbook Transaction History</h4>
                {memberSavingsTransactions.length === 0 ? (
                  <div className="p-6 text-center bg-slate-800/40 rounded-2xl border border-slate-700 text-slate-400 text-xs">
                    No savings transactions recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memberSavingsTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="bg-slate-800 p-3.5 rounded-2xl border border-slate-700 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              tx.type === 'Deposit' || tx.type === 'Interest Credited'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {tx.type === 'Deposit' || tx.type === 'Interest Credited' ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownLeft className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-white">{tx.type}</span>
                            <span className="text-[11px] text-slate-400 block font-mono">
                              {formatDate(tx.date)} • Ref: {tx.transactionNumber}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span
                              className={`font-bold block ${
                                tx.type === 'Deposit' || tx.type === 'Interest Credited'
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {tx.type === 'Deposit' || tx.type === 'Interest Credited' ? '+' : '-'}
                              {formatCurrency(tx.amount)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Bal: {formatCurrency(tx.balanceAfter)}
                            </span>
                          </div>
                          <button
                            onClick={() => setActiveSavingsReceipt(tx)}
                            title="View Slip"
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: SOLIDARITY GROUP & CENTER */}
          {portalTab === 'group' && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Solidarity Group & Center Information</h3>
                  <p className="text-xs text-slate-400">Microfinance peer-guarantee circle and center meetings</p>
                </div>
              </div>

              {memberSolidarityGroup ? (
                <div className="space-y-4 text-xs">
                  {/* Group Main Card */}
                  <div className="bg-slate-800 p-5 rounded-3xl border border-slate-700 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-purple-400">
                            {memberSolidarityGroup.groupCode}
                          </span>
                          <span className="bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            {memberSolidarityGroup.status}
                          </span>
                        </div>
                        <h4 className="text-white font-bold text-base mt-0.5">{memberSolidarityGroup.groupName}</h4>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-slate-400 block text-[11px]">Solidarity Reserve Pool</span>
                        <span className="text-emerald-400 font-bold text-base">
                          {formatCurrency(memberSolidarityGroup.solidarityFundBalance)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Meeting Schedule</span>
                        <span className="font-semibold text-white">
                          Every {memberSolidarityGroup.meetingDay} {memberSolidarityGroup.meetingTime}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Center Station</span>
                        <span>{memberSolidarityGroup.centerName} ({memberSolidarityGroup.meetingLocation})</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Assigned Loan Officer</span>
                        <span>{memberSolidarityGroup.loanOfficerName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Center Leader</span>
                        <span>{memberSolidarityGroup.leaderName} ({memberSolidarityGroup.leaderPhone})</span>
                      </div>
                    </div>
                  </div>

                  {/* Peer Circle Members List */}
                  <div className="bg-slate-800 p-5 rounded-3xl border border-slate-700 space-y-3">
                    <h4 className="font-bold text-white text-sm flex items-center justify-between">
                      <span>Circle Members & Standing</span>
                      <span className="text-xs text-slate-400 font-normal">
                        {memberSolidarityGroup.members.length} Total Co-Guarantors
                      </span>
                    </h4>

                    <div className="space-y-2">
                      {memberSolidarityGroup.members.map((m) => {
                        const isSelf = m.borrowerId === currentMember?.id;
                        return (
                          <div
                            key={m.borrowerId}
                            className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                              isSelf
                                ? 'bg-purple-950/40 border-purple-500/40 shadow-xs'
                                : 'bg-slate-900 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center font-bold">
                                {m.fullName.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{m.fullName}</span>
                                  {isSelf && (
                                    <span className="text-[10px] text-purple-300 font-semibold bg-purple-500/20 px-1.5 py-0.2 rounded-md">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 block">
                                  Role: {m.role} • Weekly Dues: {formatCurrency(m.weeklyDues)}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  m.status === 'Good Standing'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {m.status}
                              </span>
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                Balance: {formatCurrency(m.remainingBalance)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-800/50 rounded-3xl border border-slate-700 text-slate-400 text-xs">
                  You are currently an Individual Borrower and not enrolled in a Group Lending Solidarity Circle.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* GLOBAL MODALS ACCESSIBLE FROM PORTAL */}
      {/* ---------------------------------------------------- */}

      {/* Official Payment Receipt Modal */}
      {activePaymentReceipt && (
        <ReceiptModal
          payment={activePaymentReceipt}
          isOpen={!!activePaymentReceipt}
          onClose={() => setActivePaymentReceipt(null)}
        />
      )}

      {/* Official Savings Slip Modal */}
      {activeSavingsReceipt && (
        <SavingsReceiptModal
          transaction={activeSavingsReceipt}
          isOpen={!!activeSavingsReceipt}
          onClose={() => setActiveSavingsReceipt(null)}
        />
      )}

      {/* Notification Drawer */}
      <ClientNotificationDrawer
        isOpen={isNotifDrawerOpen}
        onClose={() => setIsNotifDrawerOpen(false)}
        notifications={memberNotifications}
        onMarkAsRead={handleMarkNotifAsRead}
        onMarkAllAsRead={handleMarkAllNotifsAsRead}
        onNavigateTab={(tab) => setPortalTab(tab as PortalTab)}
      />

      {/* KYC Document Vault Modal */}
      {currentMember && (
        <ClientKycModal
          isOpen={isKycModalOpen}
          onClose={() => setIsKycModalOpen(false)}
          member={currentMember}
          onUploadDocument={(doc) => {
            uploadKycDocument(currentMember.id, doc);
          }}
        />
      )}

      {/* Profile Update Request Modal */}
      {currentMember && (
        <ClientUpdateRequestModal
          isOpen={isUpdateRequestOpen}
          onClose={() => setIsUpdateRequestOpen(false)}
          member={currentMember}
          onSubmitUpdateRequest={(req) => {
            submitMemberUpdateRequest(req);
          }}
        />
      )}
    </div>
  );
};
export default ClientPortalView;
