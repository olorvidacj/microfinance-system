import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
import { Building2, Loader2 } from 'lucide-react';
import { useAccess } from './hooks/useAccess';

// Client Portal (routed app)
import { PortalLayout } from './portal/components/layout/PortalLayout';
import { PublicPortalLayout } from './portal/components/layout/PublicPortalLayout';
import { PORTAL_ROUTES } from './portal/routers/PortalRoutes';
import ClientLoginPage from './portal/pages/ClientLoginPage';
import ClientRegisterPage from './portal/pages/ClientRegisterPage';

// Branch Personnel Portal (routed app)
import StaffLoginPage from './branch/pages/StaffLoginPage';
import BranchRoutes from './branch/routers/BranchRoutes';
import { isBranchStaffRole } from './branch/components/layout/BranchLayout';

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
    return (
      <Routes>
        <Route
          path="/"
          element={
            showAuth ? (
              <LoginView
                initialMode={authInitialMode}
                onBack={() => setShowAuth(false)}
                onAuthenticated={() => setShowAuth(false)}
              />
            ) : (
              <LandingView
                onSignIn={(mode = 'signin') => {
                  setAuthInitialMode(mode);
                  setShowAuth(true);
                }}
              />
            )
          }
        />
        <Route path="/portal" element={<Navigate to="/portal/login" replace />} />
        <Route
          path="/portal/login"
          element={
            <PublicPortalLayout>
              <ClientLoginPage />
            </PublicPortalLayout>
          }
        />
        <Route
          path="/portal/register"
          element={
            <PublicPortalLayout>
              <ClientRegisterPage />
            </PublicPortalLayout>
          }
        />
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/staff/*" element={<Navigate to="/staff/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (user.role === 'CLIENT') {
    return (
      <Routes>
        <Route path="/portal" element={<PortalLayout />}>
          {PORTAL_ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }

  if (user.role === 'STAFF' && isBranchStaffRole(user.staffRole)) {
    return <BranchRoutes />;
  }

  return (
    <LoanProvider>
      <Routes>
        <Route path="*" element={<MainApp />} />
      </Routes>
    </LoanProvider>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
