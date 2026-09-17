import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronRight,
  FileCheck2,
  FileText,
  FolderOpen,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  PiggyBank,
  ReceiptText,
  ScrollText,
  Search,
  Shield,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { normalizeRole } from '../../../auth/permissions';
import { ToastProvider } from '../../../portal/components/ui/Toast';
import { BranchProvider, useBranchContext } from '../../context/BranchContext';
import { notificationsService, kycService } from '../../services';

export const BRANCH_ROLES = new Set([
  'LOAN_OFFICER',
  'LOAN_PROCESSOR',
  'CASHIER_TELLER',
  'TELLER',
  'CLIENT_SERVICES_STAFF',
  'MANAGER',
  'BOOKKEEPER',
  'ADMINISTRATOR',
]);

export function isBranchStaffRole(role?: string | null): boolean {
  return BRANCH_ROLES.has(normalizeRole(role));
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
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

const getInitials = (name?: string) =>
  (name || 'S')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const Avatar: React.FC<{ src?: string; name?: string; size?: number }> = ({ src, name, size = 36 }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!src || failed) {
    return (
      <div
        style={style}
        className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-bold shadow-sm"
        title={name}
      >
        <span className="text-xs">{getInitials(name)}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name || 'Avatar'}
      style={style}
      className="shrink-0 rounded-full object-cover ring-1 ring-slate-200"
      onError={() => setFailed(true)}
    />
  );
};

const SidebarLink: React.FC<{ item: NavItem; badge?: number; onNavigate?: () => void }> = ({
  item,
  badge,
  onNavigate,
}) => (
  <NavLink
    to={item.to}
    end={item.matchEnd}
    onClick={onNavigate}
    className={({ isActive }) =>
      `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        isActive
          ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-300 font-semibold border-l-4 border-amber-400 pl-2.5'
          : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <item.icon
          className={`h-[18px] w-[18px] shrink-0 transition-colors ${
            isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-300'
          }`}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold leading-none ${
              isActive
                ? 'bg-amber-400 text-slate-950'
                : 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30'
            }`}
          >
            {badge}
          </span>
        )}
      </>
    )}
  </NavLink>
);

function usePermissionNav(items: NavItem[]): NavItem[] {
  const { permissions } = useBranchContext();
  return useMemo(
    () => items.filter((item) => item.permissions.length === 0 || item.permissions.some((p) => permissions.includes(p))),
    [items, permissions]
  );
}

const SidebarContent: React.FC<{ unread: number; pendingKyc: number; onNavigate?: () => void }> = ({
  unread,
  pendingKyc,
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const { personnel, ctx } = useBranchContext();
  const operations = usePermissionNav(PRIMARY_OPERATIONS_NAV);
  const account = usePermissionNav(ACCOUNT_NAV);

  const getBadge = (key?: 'unread' | 'kyc') => {
    if (key === 'unread') return unread;
    if (key === 'kyc') return pendingKyc;
    return undefined;
  };

  return (
    <div className="flex h-full flex-col bg-[#091527] text-white">
      {/* Cooperative Brand Header */}
      <div className="border-b border-slate-800/80 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 ring-1 ring-amber-300/40">
            <Building2 className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-white">HOSCOMO</span>
              <span className="rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                Staff
              </span>
            </div>
            <p className="truncate text-xs font-medium text-slate-300">Microfinance Cooperative</p>
            <p className="text-[10px] text-amber-400/90 font-medium">Tacloban, Leyte, PH</p>
          </div>
        </div>

        {/* Branch indicator card */}
        <div className="mt-3.5 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Assigned Branch</p>
            <p className="truncate font-semibold text-slate-200">{ctx?.branch?.name || 'Tacloban Main Branch'}</p>
          </div>
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" title="Online & Connected" />
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-thumb-slate-800">
        <div>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Operations & Services
          </p>
          <div className="space-y-1">
            {operations.map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                badge={getBadge(item.badgeKey)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Staff Account
          </p>
          <div className="space-y-1">
            {account.map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                badge={getBadge(item.badgeKey)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* Staff Profile & Logout Footer */}
      <div className="border-t border-slate-800/90 bg-slate-950/60 p-3">
        <Link
          to="/staff/app/profile"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-800/80 group"
        >
          <Avatar src={personnel?.avatar || user?.avatar} name={personnel?.name || user?.fullName} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
              {personnel?.name || user?.fullName}
            </p>
            <p className="truncate text-xs text-slate-400">{personnel?.title || personnel?.role || 'Staff Member'}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300" />
        </Link>
        <button
          onClick={logout}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out of Portal
        </button>
      </div>
    </div>
  );
};

const BranchLayoutInner: React.FC = () => {
  const { user, logout } = useAuth();
  const { personnel, ctx } = useBranchContext();
  const [unread, setUnread] = useState(0);
  const [pendingKyc, setPendingKyc] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'HOSCOMO Microfinance Cooperative · Staff Portal (Tacloban)';
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

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 antialiased selection:bg-amber-400 selection:text-slate-950">
      {/* Desktop Persistent Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800/80 bg-[#091527] shadow-xl lg:block">
        <SidebarContent unread={unread} pendingKyc={pendingKyc} />
      </aside>

      {/* Mobile Slide-out Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#091527] shadow-2xl transition-transform">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              unread={unread}
              pendingKyc={pendingKyc}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Modern High-End Top Navigation */}
      <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 backdrop-blur-md lg:pl-64">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          {/* Left: Mobile hamburger & breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Mobile Branding */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-slate-950 font-black text-xs">
                H
              </div>
              <span className="font-bold text-slate-900 text-sm">HOSCOMO</span>
            </div>

            {/* Desktop Breadcrumbs & Title */}
            <div className="hidden lg:flex lg:items-center lg:gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-400">Staff Portal</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span className="font-semibold text-slate-800">{currentTitle}</span>
              <span className="mx-2 text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                <Building2 className="h-3 w-3 text-amber-600" />
                {ctx?.branch?.name || 'Tacloban Main Branch'}
              </span>
            </div>
          </div>

          {/* Right: Quick Search, Notifications, Profile Card */}
          <div className="flex items-center gap-3">
            {/* Quick Action Search Link */}
            <button
              onClick={() => navigate('/staff/app/clients')}
              className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-500 transition-colors hover:border-amber-300 hover:bg-white hover:text-slate-700"
              title="Search clients and loan records"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span>Search clients or loans…</span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                ⌘K
              </kbd>
            </button>

            {/* Notifications Button */}
            <Link
              to="/staff/app/notifications"
              className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-amber-300 hover:bg-amber-50/40 hover:text-amber-800"
              aria-label="Staff notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950 ring-2 ring-white animate-pulse">
                  {unread}
                </span>
              )}
            </Link>

            {/* Staff Member Pill */}
            <Link
              to="/staff/app/profile"
              className="flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 transition-all hover:border-amber-300 hover:shadow-sm group"
            >
              <Avatar src={personnel?.avatar || user?.avatar} name={personnel?.name || user?.fullName} size={30} />
              <div className="hidden text-left sm:block">
                <p className="text-xs font-bold leading-tight text-slate-900 group-hover:text-amber-800">
                  {personnel?.name || user?.fullName}
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  {personnel?.title || personnel?.role || 'Staff'}
                </p>
              </div>
            </Link>

            {/* Quick Logout Icon (Desktop) */}
            <button
              onClick={logout}
              className="hidden lg:flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="px-4 pb-24 pt-6 sm:px-6 lg:ml-64 lg:pb-12">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {usePermissionNav(BOTTOM_NAV).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.matchEnd}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-amber-600' : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => navigate('/staff/app/profile')}
            className="flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold text-slate-500"
          >
            <UserRound className="h-5 w-5 text-slate-400" />
            <span>Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export const BranchLayout: React.FC = () => {
  const { user } = useAuth();

  if (!user || user.role !== 'STAFF' || !isBranchStaffRole(user.staffRole)) {
    return <Navigate to="/staff/login" replace />;
  }

  if (!user.branchId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-white shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-400 ring-1 ring-amber-400/30">
            <Landmark className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-bold">No Branch Assignment</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your staff account is currently not assigned to a cooperative branch. Please contact your HOSCOMO System
            Administrator to assign you to Tacloban Main Branch.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
          >
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <BranchProvider>
        <BranchLayoutInner />
      </BranchProvider>
    </ToastProvider>
  );
};

export default BranchLayout;
