import React, { useEffect, useState } from 'react';
import { LoanProvider } from './context/LoanContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useLoan } from './context/LoanContext';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { LoansView } from './components/LoansView';
import { BorrowersView } from './components/BorrowersView';
import { PaymentsView } from './components/PaymentsView';
import { RemindersView } from './components/RemindersView';
import { CalculatorView } from './components/CalculatorView';
import { BranchesView } from './components/BranchesView';
import { ProductsView } from './components/ProductsView';
import { ReportsView } from './components/ReportsView';
import { MembershipView } from './components/MembershipView';
import { ClientManagementView } from './components/ClientManagementView';
import { SavingsView } from './components/SavingsView';
import { GroupLendingView } from './components/GroupLendingView';
import { ClientPortalView } from './components/ClientPortalView';
import { RolesAdminView } from './components/RolesAdminView';
import { LoginView } from './components/LoginView';
import { LandingView } from './components/LandingView';
import { Building2, Loader2, LogOut } from 'lucide-react';
import { useAccess } from './hooks/useAccess';

import { NewLoanModal } from './components/NewLoanModal';
import { LoanDetailModal } from './components/LoanDetailModal';
import { LoanApprovalModal } from './components/LoanApprovalModal';
import { LoanDisbursementModal } from './components/LoanDisbursementModal';
import { BorrowerModal } from './components/BorrowerModal';
import { BorrowerDetailModal } from './components/BorrowerDetailModal';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { ReceiptModal } from './components/ReceiptModal';
import { RestructureModal } from './components/RestructureModal';
import { BranchModal } from './components/BranchModal';
import { ProductModal } from './components/ProductModal';

import { Borrower, Branch, InterestType, Loan, LoanProduct, PaymentRecord, RepaymentFrequency } from './types';

interface NewLoanParams {
  principalAmount?: number;
  termMonths?: number;
  interestRate?: number;
  interestType?: InterestType;
  repaymentFrequency?: RepaymentFrequency;
}

const getInitials = (name?: string) =>
  (name || 'U')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const SafeAvatar: React.FC<{ src?: string; name?: string; className?: string }> = ({ src, name, className }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={`${className || ''} bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold`}
        title={name}
      >
        {getInitials(name)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name || 'Avatar'}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const { staffList, setCurrentUser } = useLoan();
  const { canAccessTab, roleKey } = useAccess();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const personaAppliedRef = React.useRef(false);

  // When role changes, if current activeTab is not permitted, switch to first allowed tab
  useEffect(() => {
    if (!canAccessTab(activeTab)) {
      if (roleKey === 'CLIENT') {
        setActiveTab('clientPortal');
      } else if (canAccessTab('dashboard')) {
        setActiveTab('dashboard');
      } else if (canAccessTab('loans')) {
        setActiveTab('loans');
      } else if (canAccessTab('membership')) {
        setActiveTab('membership');
      } else if (canAccessTab('payments')) {
        setActiveTab('payments');
      }
    }
  }, [roleKey, activeTab, canAccessTab]);

  // Sync the authenticated staff account with the console persona (once)
  useEffect(() => {
    if (!user || user.role !== 'STAFF' || personaAppliedRef.current || staffList.length === 0) return;
    const match =
      staffList.find((s) => s.id === user.staffId) ||
      staffList.find((s) => s.email.toLowerCase() === user.email.toLowerCase());
    if (match) {
      setCurrentUser(match);
      personaAppliedRef.current = true;
    }
  }, [user, staffList, setCurrentUser]);

  // Modal States
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
  const [newLoanBorrower, setNewLoanBorrower] = useState<Borrower | null>(null);
  const [newLoanParams, setNewLoanParams] = useState<NewLoanParams | null>(null);

  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [targetPaymentLoan, setTargetPaymentLoan] = useState<Loan | null>(null);

  const [isAddBorrowerOpen, setIsAddBorrowerOpen] = useState(false);
  const [editBorrower, setEditBorrower] = useState<Borrower | null>(null);

  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  const [activeReceipt, setActiveReceipt] = useState<PaymentRecord | null>(null);
  const [restructureTargetLoan, setRestructureTargetLoan] = useState<Loan | null>(null);
  const [approvalTargetLoan, setApprovalTargetLoan] = useState<Loan | null>(null);
  const [disbursementTargetLoan, setDisbursementTargetLoan] = useState<Loan | null>(null);

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<LoanProduct | null>(null);

  // Handlers
  const handleOpenNewLoan = (borrower?: Borrower | null, params?: NewLoanParams) => {
    setNewLoanBorrower(borrower || null);
    setNewLoanParams(params || null);
    setIsNewLoanOpen(true);
  };

  const handleOpenRecordPayment = (loan?: Loan | null) => {
    setTargetPaymentLoan(loan || null);
    setIsRecordPaymentOpen(true);
  };

  const handleOriginateFromCalculator = (params: {
    principalAmount: number;
    termMonths: number;
    interestRate: number;
    interestType: InterestType;
    repaymentFrequency: RepaymentFrequency;
  }) => {
    handleOpenNewLoan(null, params);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans antialiased flex flex-col">
      {/* Header with Branch Selector and Staff Persona Switcher */}
      <Header
        onOpenNewLoan={() => handleOpenNewLoan()}
        onOpenRecordPayment={() => handleOpenRecordPayment()}
        onOpenAddBorrower={() => {
          setEditBorrower(null);
          setIsAddBorrowerOpen(true);
        }}
      />

      {/* Main Tab Navigation Bar */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            onSelectLoan={(loan) => setSelectedLoan(loan)}
            onOpenNewLoan={() => handleOpenNewLoan()}
            onOpenRecordPayment={() => handleOpenRecordPayment()}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'membership' && (
          <ClientManagementView
            onSelectClient={(b) => setSelectedBorrower(b)}
            onOpenNewLoanForClient={(b) => handleOpenNewLoan(b)}
          />
        )}

        {activeTab === 'loans' && (
          <LoansView
            onSelectLoan={(loan) => setSelectedLoan(loan)}
            onOpenNewLoan={() => handleOpenNewLoan()}
            onOpenRecordPaymentForLoan={(loan) => handleOpenRecordPayment(loan)}
            onOpenRestructureForLoan={(loan) => setRestructureTargetLoan(loan)}
            onOpenApprovalDesk={(loan) => setApprovalTargetLoan(loan)}
            onOpenDisbursementDesk={(loan) => setDisbursementTargetLoan(loan)}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentsView
            onOpenRecordPayment={() => handleOpenRecordPayment()}
            onViewReceipt={(p) => setActiveReceipt(p)}
          />
        )}

        {activeTab === 'savings' && <SavingsView />}

        {activeTab === 'groupLending' && <GroupLendingView />}

        {activeTab === 'roles' && <RolesAdminView />}

        {activeTab === 'clientPortal' && <ClientPortalView />}

        {activeTab === 'reminders' && <RemindersView />}

        {activeTab === 'calculator' && (
          <CalculatorView onOriginateCalculatedLoan={handleOriginateFromCalculator} />
        )}

        {activeTab === 'branches' && (
          <BranchesView
            onOpenAddBranch={() => {
              setEditBranch(null);
              setIsBranchModalOpen(true);
            }}
            onEditBranch={(b) => {
              setEditBranch(b);
              setIsBranchModalOpen(true);
            }}
          />
        )}

        {activeTab === 'products' && (
          <ProductsView
            onOpenAddProduct={() => {
              setEditProduct(null);
              setIsProductModalOpen(true);
            }}
            onEditProduct={(p) => {
              setEditProduct(p);
              setIsProductModalOpen(true);
            }}
          />
        )}

        {activeTab === 'reports' && <ReportsView />}
      </main>

      {/* Global Modals */}
      <NewLoanModal
        isOpen={isNewLoanOpen}
        onClose={() => setIsNewLoanOpen(false)}
        preSelectedBorrower={newLoanBorrower}
        initialParams={newLoanParams}
      />

      <LoanDetailModal
        loan={selectedLoan}
        isOpen={!!selectedLoan}
        onClose={() => setSelectedLoan(null)}
        onOpenRecordPayment={(loan) => handleOpenRecordPayment(loan)}
        onOpenRestructure={(loan) => setRestructureTargetLoan(loan)}
        onOpenApprovalDesk={(loan) => setApprovalTargetLoan(loan)}
        onOpenDisbursementDesk={(loan) => setDisbursementTargetLoan(loan)}
      />

      <LoanApprovalModal
        loan={approvalTargetLoan}
        isOpen={!!approvalTargetLoan}
        onClose={() => setApprovalTargetLoan(null)}
        onApproved={() => {
          setApprovalTargetLoan(null);
        }}
      />

      <LoanDisbursementModal
        loan={disbursementTargetLoan}
        isOpen={!!disbursementTargetLoan}
        onClose={() => setDisbursementTargetLoan(null)}
        onDisbursed={() => {
          setDisbursementTargetLoan(null);
        }}
      />

      <BorrowerModal
        isOpen={isAddBorrowerOpen}
        onClose={() => setIsAddBorrowerOpen(false)}
        editBorrower={editBorrower}
      />

      <BorrowerDetailModal
        borrower={selectedBorrower}
        isOpen={!!selectedBorrower}
        onClose={() => setSelectedBorrower(null)}
        onSelectLoan={(loan) => setSelectedLoan(loan)}
        onOpenNewLoan={(b) => handleOpenNewLoan(b)}
        onEditBorrower={(b) => {
          setSelectedBorrower(null);
          setEditBorrower(b);
          setIsAddBorrowerOpen(true);
        }}
      />

      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        targetLoan={targetPaymentLoan}
        onPaymentSuccess={(receipt) => setActiveReceipt(receipt)}
      />

      <ReceiptModal
        payment={activeReceipt}
        isOpen={!!activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />

      <RestructureModal
        loan={restructureTargetLoan}
        isOpen={!!restructureTargetLoan}
        onClose={() => setRestructureTargetLoan(null)}
      />

      <BranchModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        editBranch={editBranch}
      />

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        editProduct={editProduct}
      />
    </div>
  );
};

// Slim shell for authenticated CLIENT accounts: portal only, no staff console
const ClientAppShell: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <LoanProvider>
      <div className="min-h-screen bg-slate-50 text-gray-900 font-sans antialiased flex flex-col">
        {/* Client Top Bar */}
        <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-xs">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 tracking-tight leading-none block">HOSCOMO</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Client Portal</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SafeAvatar
                src={user?.avatar}
                name={user?.fullName}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
              />
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold text-slate-800 leading-tight">{user?.fullName}</div>
                <div className="text-[10px] text-slate-400 font-mono leading-tight">{user?.email}</div>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="ml-1 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-6 pb-12">
          <ClientPortalView lockedBorrowerId={user?.borrowerId || undefined} isClientSession />
        </main>
      </div>
    </LoanProvider>
  );
};

const ShieldInfoIcon: React.FC = () => (
  <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto">
    <Building2 className="w-7 h-7 text-blue-600" />
  </div>
);

// Root gate: restores session, shows public landing, blocks app until authenticated, routes by role
const AuthGate: React.FC = () => {
  const { user, isRestoring } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'register'>('signin');

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 font-sans">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-lg animate-pulse">
          <Building2 className="w-7 h-7" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Restoring secure session…
        </div>
      </div>
    );
  }

  if (!user) {
    if (showAuth) {
      return (
        <LoginView
          initialMode={authInitialMode}
          onBack={() => setShowAuth(false)}
          onAuthenticated={() => setShowAuth(false)}
        />
      );
    }
    return (
      <LandingView
        onSignIn={(mode = 'signin') => {
          setAuthInitialMode(mode);
          setShowAuth(true);
        }}
      />
    );
  }

  if (user.role === 'CLIENT') return <ClientAppShell />;

  return (
    <LoanProvider>
      <MainApp />
    </LoanProvider>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
};

export default App;
