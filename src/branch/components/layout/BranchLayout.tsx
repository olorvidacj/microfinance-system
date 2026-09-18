import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronRight,
  FileCheck2,
  FileText,
  FolderOpen,
  HandCoins,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PieChart,
  PiggyBank,
  ScrollText,
  Search,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { setStoredToken, useAuth } from '../../../context/AuthContext';
import { normalizeRole } from '../../../auth/permissions';
import { AppShell, AppNavItem, AppNavSection, Avatar } from '../../../ui';
import { ToastProvider } from '../../../portal/components/ui/Toast';
import { BranchProvider, useBranchContext } from '../../context/BranchContext';
import { notificationsService, kycService, branchService } from '../../services';
import { BranchAssignmentNotice } from '../BranchAssignmentNotice';
import { StaffBranchAssignmentResponse } from '../../types';

export const BRANCH_ROLES = new Set([
  'LOAN_OFFICER',
  'LOAN_PROCESSOR',
  'CASHIER_TELLER',
  'TELLER',
  'CLIENT_SERVICES_STAFF',
  'MANAGER',
  'BOOKKEEPER',
  'ADMINISTRATOR',
  'SUPER_ADMIN',
  'AUDITOR',
  'CREDIT_COMMITTEE',
  'EDUCATION_COMMITTEE',
  'BOARD_OF_DIRECTORS',
]);

// Any authenticated staff role may open the operations portal. Nav items are
// permission-filtered, so governance/oversight roles get a read-only view.
export function isBranchStaffRole(role?: string | null): boolean {
  if (!role) return false;
  return normalizeRole(role) !== 'CLIENT';
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions: string[];
  matchEnd?: boolean;
  badgeKey?: 'unread' | 'kyc';
}

const PRIMARY_OPERATIONS_NAV: NavItem[] = [
  { to: '/staff/app', label: 'Dashboard', icon: LayoutDashboard, permissions: [], matchEnd: true },
  { to: '/staff/app/clients', label: 'Client Management', icon: Users, permissions: ['view_client_info', 'register_clients', 'manage_kyc'] },
  { to: '/staff/app/kyc', label: 'KYC Verification', icon: FileCheck2, permissions: ['manage_kyc', 'view_client_info'], badgeKey: 'kyc' },
  { to: '/staff/app/loans', label: 'Loan Management', icon: HandCoins, permissions: ['review_client_loan_info', 'monitor_loan_repayment'] },
  { to: '/staff/app/applications', label: 'Loan Applications', icon: FileText, permissions: ['process_loan_applications', 'review_client_loan_info', 'manage_loan_applications'] },
  { to: '/staff/app/savings', label: 'Savings Management', icon: PiggyBank, permissions: ['process_savings_deposits', 'process_savings_withdrawals'] },
  { to: '/staff/app/transactions', label: 'Financial Transactions', icon: ScrollText, permissions: ['view_transaction_records'] },
  { to: '/staff/app/payments', label: 'Record Payment', icon: Wallet, permissions: ['process_loan_repayments'] },
  { to: '/staff/app/groups', label: 'Lending Groups', icon: UserCheck, permissions: ['view_client_info', 'manage_loan_applications', 'register_clients'] },
  { to: '/staff/app/reports', label: 'Reports & Analytics', icon: PieChart, permissions: ['view_transaction_records', 'view_all_records', 'monitor_loan_repayment'] },
  { to: '/staff/app/performance', label: 'Branch Performance', icon: TrendingUp, permissions: [] },
  { to: '/staff/app/documents', label: 'Document Archives', icon: FolderOpen, permissions: ['view_client_info', 'register_clients', 'manage_kyc'] },
];

const ACCOUNT_NAV: NavItem[] = [
  { to: '/staff/app/notifications', label: 'Notifications', icon: Bell, permissions: [], badgeKey: 'unread' },
  { to: '/staff/app/profile', label: 'My Profile', icon: UserRound, permissions: [] },
];

const BOTTOM_NAV: NavItem[] = [
  { to: '/staff/app', label: 'Home', icon: LayoutDashboard, permissions: [], matchEnd: true },
  { to: '/staff/app/clients', label: 'Clients', icon: Users, permissions: ['view_client_info', 'register_clients'] },
  { to: '/staff/app/kyc', label: 'KYC', icon: FileCheck2, permissions: ['manage_kyc'] },
  { to: '/staff/app/loans', label: 'Loans', icon: HandCoins, permissions: ['review_client_loan_info'] },
  { to: '/staff/app/transactions', label: 'Ledger', icon: ScrollText, permissions: ['view_transaction_records'] },
];

function usePermissionNav(items: NavItem[]): NavItem[] {
  const { permissions } = useBranchContext();
  return useMemo(
    () => items.filter((item) => item.permissions.length === 0 || item.permissions.some((p) => permissions.includes(p))),
    [items, permissions]
  );
}

const BranchLayoutInner: React.FC = () => {
  const { user, logout } = useAuth();
  const { personnel, ctx } = useBranchContext();
  const [unread, setUnread] = useState(0);
  const [pendingKyc, setPendingKyc] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'HOSCOMCO Microfinance Cooperative · Staff Portal (Tacloban)';
  }, []);

  const refreshBadges = useCallback(async () => {
    try {
      const [notifData, kycQueue] = await Promise.all([
        notificationsService.list().catch(() => ({ unreadCount: 0 })),
        kycService.queue().catch(() => []),
      ]);
      setUnread(notifData.unreadCount || 0);
      setPendingKyc(Array.isArray(kycQueue) ? kycQueue.length : 0);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges, location.pathname]);

  // Derive current breadcrumb title
  const currentTitle = useMemo(() => {
    const path = location.pathname;
    if (path === '/staff/app') return 'Staff Dashboard';
    if (path.startsWith('/staff/app/clients')) return 'Client Management';
    if (path.startsWith('/staff/app/kyc')) return 'KYC Verification Queue';
    if (path.startsWith('/staff/app/applications')) return 'Loan Applications';
    if (path.startsWith('/staff/app/loans')) return 'Loan Management';
    if (path.startsWith('/staff/app/savings')) return 'Savings Accounts';
    if (path.startsWith('/staff/app/transactions')) return 'Financial Transactions Ledger';
    if (path.startsWith('/staff/app/payments')) return 'Process Payment';
    if (path.startsWith('/staff/app/collections')) return 'Collections Desk';
    if (path.startsWith('/staff/app/groups')) return 'Solidarity Lending Groups';
    if (path.startsWith('/staff/app/reports')) return 'Reports & Analytics';
    if (path.startsWith('/staff/app/performance')) return 'Branch Performance';
    if (path.startsWith('/staff/app/documents')) return 'Document Repository';
    if (path.startsWith('/staff/app/notifications')) return 'Notifications Center';
    if (path.startsWith('/staff/app/profile')) return 'Staff Profile & Security';
    if (path.startsWith('/staff/app/activity')) return 'Staff Activity Log';
    return 'Staff Portal';
  }, [location.pathname]);

  const getBadge = (key?: 'unread' | 'kyc') => {
    if (key === 'unread') return unread;
    if (key === 'kyc') return pendingKyc;
    return undefined;
  };

  const operations = usePermissionNav(PRIMARY_OPERATIONS_NAV);
  const account = usePermissionNav(ACCOUNT_NAV);
  const bottomNav = usePermissionNav(BOTTOM_NAV);

  const toAppItem = (item: NavItem): AppNavItem => ({
    to: item.to,
    label: item.label,
    icon: item.icon,
    end: item.matchEnd,
    badge: getBadge(item.badgeKey),
  });

  const sections: AppNavSection[] = [
    { title: 'Operations & Services', items: operations.map(toAppItem) },
    { title: 'Staff Account', items: account.map(toAppItem) },
  ];

  return (
    <AppShell
      sections={sections}
      brandName="HOSCOMCO"
      brandSubtitle="Microfinance Cooperative"
      brandTag="Staff"
      brandMeta="Tacloban, Leyte, PH"
      onBrandClick={() => navigate('/staff/app')}
      status={
        <div className="flex items-center justify-between bg-navy-900/60 px-4 py-2.5 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Assigned Branch</p>
            <p className="truncate font-semibold text-slate-200">{ctx?.branch?.name || 'Tacloban Main Branch'}</p>
          </div>
          <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" title="Online & Connected" />
        </div>
      }
      sidebarFooter={({ collapsed }) => (
        <div className="p-3">
          <Link
            to="/staff/app/profile"
            className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-navy-800/80"
          >
            <Avatar src={personnel?.avatar || user?.avatar} name={personnel?.name || user?.fullName} size={38} />
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-gold-300">
                    {personnel?.name || user?.fullName}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {personnel?.title || personnel?.role || 'Staff Member'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300" />
              </>
            )}
          </Link>
          <button
            onClick={logout}
            title="Sign out of Portal"
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-navy-700 bg-navy-900/60 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 ${
              collapsed ? 'px-2' : ''
            }`}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && <span>Sign out of Portal</span>}
          </button>
        </div>
      )}
      bottomNav={
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
            {bottomNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.matchEnd}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    isActive ? 'text-gold-600' : 'text-slate-500 hover:text-slate-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`h-5 w-5 ${isActive ? 'text-gold-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
            <Link
              to="/staff/app/profile"
              className="flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold text-slate-500"
            >
              <UserRound className="h-5 w-5 text-slate-400" />
              <span>Profile</span>
            </Link>
          </div>
        </nav>
      }
      topbar={({ openSidebar }) => (
        <header className="z-20 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            {/* Left: Mobile hamburger & breadcrumbs */}
            <div className="flex items-center gap-3">
              <button
                onClick={openSidebar}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Mobile Branding */}
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-400 text-xs font-black text-navy-950">
                  H
                </div>
                <span className="text-sm font-bold text-slate-900">HOSCOMCO</span>
              </div>

              {/* Desktop Breadcrumbs & Title */}
              <div className="hidden text-xs text-slate-500 lg:flex lg:items-center lg:gap-2">
                <span className="font-medium text-slate-400">Staff Portal</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                <span className="font-semibold text-slate-800">{currentTitle}</span>
                <span className="mx-2 text-slate-300">|</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  <Building2 className="h-3 w-3 text-gold-600" />
                  {ctx?.branch?.name || 'Tacloban Main Branch'}
                </span>
              </div>
            </div>

            {/* Right: Quick Search, Notifications, Profile Card */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/staff/app/clients')}
                className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-500 transition-colors hover:border-gold-300 hover:bg-white hover:text-slate-700 md:flex"
                title="Search clients and loan records"
              >
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span>Search clients or loans…</span>
                <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  ⌘K
                </kbd>
              </button>

              <Link
                to="/staff/app/notifications"
                className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-gold-300 hover:bg-gold-500/10 hover:text-gold-700"
                aria-label="Staff notifications"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-navy-950 ring-2 ring-white">
                    {unread}
                  </span>
                )}
              </Link>

              <Link
                to="/staff/app/profile"
                className="group flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 transition-all hover:border-gold-300 hover:shadow-sm"
              >
                <Avatar src={personnel?.avatar || user?.avatar} name={personnel?.name || user?.fullName} size={30} />
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-bold leading-tight text-slate-900 group-hover:text-gold-700">
                    {personnel?.name || user?.fullName}
                  </p>
                  <p className="text-[10px] font-medium text-slate-500">
                    {personnel?.title || personnel?.role || 'Staff'}
                  </p>
                </div>
              </Link>

              <button
                onClick={logout}
                className="hidden items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 lg:flex"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>
      )}
    >
      <Outlet />
    </AppShell>
  );
};

export const BranchLayout: React.FC = () => {
  const { user } = useAuth();

  if (!user || user.role !== 'STAFF') {
    return <Navigate to="/staff/login" replace />;
  }

  if (!user.branchId) {
    return <BranchAssignmentGate />;
  }

  return (
    <ToastProvider>
      <BranchProvider>
        <BranchLayoutInner />
      </BranchProvider>
    </ToastProvider>
  );
};

const REQUIRED_BRANCH_FALLBACK = {
  id: 'br-main',
  name: 'Tacloban Main Branch',
  code: 'TAC-MAIN',
  address: 'HOSCOMCO Cooperative Building, Real Street, Tacloban City, Leyte',
  city: 'Tacloban City',
  phone: '+63 (053) 832-4190',
};

// Live cooperative branch assignment gate for staff accounts with no branch yet.
// Fetches the real assignment from the backend, persists the refreshed JWT when a
// branch is confirmed, then hands off to the portal (or keeps showing the notice).
const BranchAssignmentGate: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [assignmentData, setAssignmentData] = useState<StaffBranchAssignmentResponse | null>(null);
  const [checking, setChecking] = useState(true);

  const refreshAssignment = useCallback(async (): Promise<void> => {
    try {
      const data = await Promise.race([
        branchService.getBranchAssignment(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Branch assignment check timed out. Please check your connection.')),
            8000
          )
        ),
      ]);
      // Persist the refreshed JWT returned by the backend so branch-scoped API
      // authorization carries the confirmed branchId.
      if (data.token) {
        setStoredToken(data.token);
      }
      if (data.staff?.branch) {
        await refreshUser();
      } else {
        setAssignmentData(data);
      }
    } catch (err: any) {
      // If the live check fails, still show the notice using the authenticated session.
      setAssignmentData({
        success: false,
        staff: {
          id: user?.staffId || user?.id || 'staff-unassigned',
          name: user?.fullName || 'Staff Member',
          email: user?.email || '',
          role: user?.staffRole || 'STAFF',
          title: user?.staffRole || 'Staff Member',
          avatar: user?.avatar || '',
          branch: null,
        },
        requiredBranch: REQUIRED_BRANCH_FALLBACK,
        message: err?.message || 'Unable to verify branch assignment. Please check your connection.',
      });
    }
  }, [user, refreshUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshAssignment();
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAssignment]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/staff/login', { replace: true });
  }, [logout, navigate]);

  const handleAssignmentSuccess = useCallback(async () => {
    await refreshUser();
  }, [refreshUser]);

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy-950 font-sans text-slate-100 selection:bg-gold-400 selection:text-navy-950">
        <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-tr from-gold-500 via-gold-400 to-gold-600 text-navy-950 shadow-lg">
          <Building2 className="h-7 w-7" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking cooperative branch assignment…
        </div>
        <p className="text-xs text-slate-500">HOSCOMCO Microfinance Cooperative · Staff Operations Portal</p>
      </div>
    );
  }

  return (
    <BranchAssignmentNotice
      assignmentData={assignmentData}
      onRefresh={refreshAssignment}
      onLogout={handleLogout}
      onAssignmentSuccess={handleAssignmentSuccess}
    />
  );
};

export default BranchLayout;
