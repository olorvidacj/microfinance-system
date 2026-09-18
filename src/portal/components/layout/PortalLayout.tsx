import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  Home,
  HandCoins,
  FilePlus2,
  ReceiptText,
  PiggyBank,
  ArrowLeftRight,
  Users,
  Bell,
  Files,
  LifeBuoy,
  Settings,
  LogOut,
  UserRound,
  ShieldCheck,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { AppShell, AppNavItem, AppNavSection, Avatar } from '../../../ui';
import { ToastProvider } from '../ui/Toast';
import { ErrorBoundary } from '../ErrorBoundary';
import { notificationService } from '../../services/notifications';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matchEnd?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { to: '/portal', label: 'Dashboard', icon: Home, matchEnd: true },
  { to: '/portal/loans', label: 'My Loans', icon: HandCoins },
  { to: '/portal/apply', label: 'Apply for Loan', icon: FilePlus2 },
  { to: '/portal/payments', label: 'Payments', icon: ReceiptText },
  { to: '/portal/savings', label: 'Savings', icon: PiggyBank },
  { to: '/portal/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/portal/groups', label: 'Group Lending', icon: Users },
];

const ACCOUNT_NAV: NavItem[] = [
  { to: '/portal/kyc', label: 'KYC Verification', icon: ShieldCheck },
  { to: '/portal/notifications', label: 'Notifications', icon: Bell },
  { to: '/portal/documents', label: 'Documents', icon: Files },
  { to: '/portal/support', label: 'Help & Support', icon: LifeBuoy },
  { to: '/portal/settings', label: 'Settings', icon: Settings },
];

const BOTTOM_NAV: NavItem[] = [
  { to: '/portal', label: 'Home', icon: Home, matchEnd: true },
  { to: '/portal/loans', label: 'Loans', icon: HandCoins },
  { to: '/portal/payments', label: 'Pay', icon: ReceiptText },
  { to: '/portal/groups', label: 'Group', icon: Users },
];

const toAppItem = (item: NavItem, badge?: number): AppNavItem => ({
  to: item.to,
  label: item.label,
  icon: item.icon,
  end: item.matchEnd,
  badge,
});

const PortalLayoutInner: React.FC = () => {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  useEffect(() => {
    document.title = 'Client Portal · HOSCOMO';
  }, []);

  const refreshBadge = useCallback(async () => {
    if (!user) return;
    try {
      const data = await notificationService.list();
      setUnread(data.unreadCount);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge, location.pathname]);

  const sections: AppNavSection[] = [
    { title: 'Main', items: MAIN_NAV.map((item) => toAppItem(item)) },
    {
      title: 'Account',
      items: ACCOUNT_NAV.map((item) =>
        toAppItem(item, item.label === 'Notifications' ? unread : undefined)
      ),
    },
  ];

  return (
    <AppShell
      sections={sections}
      brandName="HOSCOMO"
      brandSubtitle="Client Portal"
      brandTag="Member"
      contentMaxWidth="max-w-6xl"
      sidebarFooter={({ collapsed }) => (
        <div className="p-3">
          <Link
            to="/portal/profile"
            className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-navy-800/80"
          >
            <Avatar src={user?.avatar} name={user?.fullName} size={38} />
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white group-hover:text-gold-300">
                    {user?.fullName}
                  </div>
                  <div className="truncate text-xs text-slate-400">{user?.email}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300" />
              </>
            )}
          </Link>
          <button
            onClick={logout}
            title="Sign out"
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-navy-700 bg-navy-900/60 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 ${
              collapsed ? 'px-2' : ''
            }`}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      )}
      topbar={({ openSidebar }) => (
        <header className="z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={openSidebar}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="lg:hidden">
                <span className="block text-base font-bold leading-none text-slate-900">HOSCOMO</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Client Portal</span>
              </div>
              <div className="hidden text-sm text-slate-500 lg:block">
                Welcome back, <span className="font-semibold text-slate-800">{user?.fullName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/portal/notifications"
                className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-gold-700"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </Link>
              <Link to="/portal/profile" className="rounded-xl p-1 transition hover:bg-slate-100">
                <Avatar src={user?.avatar} name={user?.fullName} size={34} />
              </Link>
            </div>
          </div>
        </header>
      )}
      bottomNav={
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
            {BOTTOM_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.matchEnd}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-gold-700' : 'text-slate-400 hover:text-slate-600'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`h-5 w-5 ${isActive ? 'text-gold-600' : ''}`} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
            <NavLink
              to="/portal/profile"
              className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium text-slate-400"
            >
              <UserRound className="h-5 w-5" />
              Profile
            </NavLink>
          </div>
        </nav>
      }
    >
      <Outlet />
    </AppShell>
  );
};

export const PortalLayout: React.FC = () => {
  const { user } = useAuth();

  if (!user || user.role !== 'CLIENT') {
    return <Navigate to="/portal/login" replace />;
  }

  return (
    <ToastProvider>
      <ErrorBoundary fallbackTitle="Portal Error" fallbackMessage="Something went wrong in the client portal. Please try again.">
        <PortalLayoutInner />
      </ErrorBoundary>
    </ToastProvider>
  );
};
