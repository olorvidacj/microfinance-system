import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
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
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { normalizeRole } from '../../../auth/permissions';
import { ToastProvider } from '../../../portal/components/ui/Toast';
import { BranchProvider, useBranchContext } from '../../context/BranchContext';
import { notificationsService } from '../../services';
import { useBranchPermission } from '../../hooks/useBranchPermission';

export const BRANCH_ROLES = new Set([
  'LOAN_OFFICER',
  'LOAN_PROCESSOR',
  'CASHIER_TELLER',
  'TELLER',
  'CLIENT_SERVICES_STAFF',
  'MANAGER',
  'BOOKKEEPER',
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
}

const MAIN_NAV: NavItem[] = [
  { to: '/staff/app', label: 'Dashboard', icon: LayoutDashboard, permissions: [], matchEnd: true },
  { to: '/staff/app/performance', label: 'Performance', icon: TrendingUp, permissions: [] },
  { to: '/staff/app/clients', label: 'Clients', icon: Users, permissions: ['view_client_info', 'register_clients', 'manage_kyc'] },
  { to: '/staff/app/kyc', label: 'KYC Queue', icon: FileCheck2, permissions: ['manage_kyc', 'view_client_info'] },
  { to: '/staff/app/applications', label: 'Loan Applications', icon: FileText, permissions: ['process_loan_applications', 'review_client_loan_info', 'manage_loan_applications'] },
  { to: '/staff/app/loans', label: 'Loans', icon: HandCoins, permissions: ['review_client_loan_info', 'monitor_loan_repayment'] },
  { to: '/staff/app/collections', label: 'Collections', icon: ReceiptText, permissions: ['process_loan_repayments', 'view_transaction_records'] },
  { to: '/staff/app/payments', label: 'Process Payment', icon: Wallet, permissions: ['process_loan_repayments'] },
  { to: '/staff/app/savings', label: 'Savings', icon: PiggyBank, permissions: ['process_savings_deposits', 'process_savings_withdrawals'] },
  { to: '/staff/app/groups', label: 'Group Lending', icon: Users, permissions: ['view_client_info', 'manage_loan_applications', 'register_clients'] },
  { to: '/staff/app/transactions', label: 'Transactions', icon: ScrollText, permissions: ['view_transaction_records'] },
  { to: '/staff/app/documents', label: 'Documents', icon: FolderOpen, permissions: ['view_client_info', 'register_clients', 'manage_kyc'] },
  { to: '/staff/app/reports', label: 'Reports', icon: PieChart, permissions: ['view_transaction_records', 'view_all_records', 'monitor_loan_repayment'] },
  { to: '/staff/app/activity', label: 'Activity Log', icon: ScrollText, permissions: [] },
];

const ACCOUNT_NAV: NavItem[] = [
  { to: '/staff/app/notifications', label: 'Notifications', icon: Bell, permissions: [] },
  { to: '/staff/app/profile', label: 'My Profile', icon: UserRound, permissions: [] },
];

const BOTTOM_NAV: NavItem[] = [
  { to: '/staff/app', label: 'Home', icon: LayoutDashboard, permissions: [], matchEnd: true },
  { to: '/staff/app/clients', label: 'Clients', icon: Users, permissions: ['view_client_info', 'register_clients'] },
  { to: '/staff/app/loans', label: 'Loans', icon: HandCoins, permissions: ['review_client_loan_info'] },
  { to: '/staff/app/payments', label: 'Pay', icon: Wallet, permissions: ['process_loan_repayments'] },
  { to: '/staff/app/collections', label: 'Collect', icon: ReceiptText, permissions: ['process_loan_repayments'] },
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
        className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white"
        title={name}
      >
        <span className="text-xs font-bold">{getInitials(name)}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name || 'Avatar'}
      style={style}
      className="shrink-0 rounded-full object-cover"
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
      `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-700 text-white shadow-sm'
          : 'text-slate-600 hover:bg-blue-50 hover:text-blue-800'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-700'}`} />
        <span className="flex-1">{item.label}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
              isActive ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
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

const SidebarContent: React.FC<{ unread: number; onNavigate?: () => void }> = ({ unread, onNavigate }) => {
  const { user, logout } = useAuth();
  const { personnel, ctx } = useBranchContext();
  const main = usePermissionNav(MAIN_NAV);
  const account = usePermissionNav(ACCOUNT_NAV);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-md">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <span className="block truncate text-base font-bold leading-none text-slate-900">HOSCOMO</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">{ctx?.branch?.name || 'Branch Portal'}</span>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Operations</p>
          {main.map((item) => (
            <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Account</p>
          {account.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              badge={item.label === 'Notifications' ? unread : undefined}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-100 p-4">
        <Link to="/staff/app/profile" className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50">
          <Avatar src={personnel?.avatar || user?.avatar} name={personnel?.name || user?.fullName} size={38} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">{personnel?.name || user?.fullName}</div>
            <div className="truncate text-xs text-slate-400">{personnel?.title || personnel?.role}</div>
          </div>
        </Link>
        <button
          onClick={logout}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
};

const BranchLayoutInner: React.FC = () => {
  const { user } = useAuth();
  const { personnel } = useBranchContext();
  const [unread, setUnread] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Branch Portal · HOSCOMO';
  }, []);

  const refreshBadge = useCallback(async () => {
    try {
      const data = await notificationsService.list();
      setUnread(data.unreadCount);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge, location.pathname]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent unread={unread} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent unread={unread} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur lg:pl-64">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <span className="block text-base font-bold leading-none text-slate-900">HOSCOMO</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Branch Portal</span>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm text-slate-500">
                Good day, <span className="font-semibold text-slate-800">{personnel?.name || user?.fullName}</span>
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                {personnel?.title || personnel?.role || 'Staff'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/staff/app/notifications"
              className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-700"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
            <Link to="/staff/app/profile" className="rounded-xl p-1 transition hover:bg-slate-100">
              <Avatar src={personnel?.avatar || user?.avatar} name={personnel?.name || user?.fullName} size={34} />
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 pb-24 pt-6 sm:px-6 lg:ml-64 lg:pb-10">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {usePermissionNav(BOTTOM_NAV).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.matchEnd}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-700' : ''}`} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => navigate('/staff/app/profile')}
            className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium text-slate-400"
          >
            <UserRound className="h-5 w-5" />
            Profile
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
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Landmark className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">No branch assignment</h2>
          <p className="mt-2 text-sm text-slate-500">
            This account is not associated with a branch. Please contact your system administrator to assign you to a
            branch before using the Branch Portal.
          </p>
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