import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
  Menu,
  X,
  Building2,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ToastProvider } from '../ui/Toast';
import { notificationService } from '../../services/notifications';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
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

const getInitials = (name?: string) =>
  (name || 'U')
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
        className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white"
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
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-600'}`} />
        <span className="flex-1">{item.label}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
              isActive ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {badge}
          </span>
        )}
      </>
    )}
  </NavLink>
);

const SidebarContent: React.FC<{ unread: number; onNavigate?: () => void }> = ({ unread, onNavigate }) => {
  const { user, logout } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <span className="block text-base font-bold leading-none text-slate-900">HOSCOMO</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Client Portal</span>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Main</p>
          {MAIN_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Account</p>
          {ACCOUNT_NAV.map((item) => (
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
        <Link to="/portal/profile" className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50">
          <Avatar src={user?.avatar} name={user?.fullName} size={38} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">{user?.fullName}</div>
            <div className="truncate text-xs text-slate-400">{user?.email}</div>
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

const PortalLayoutInner: React.FC = () => {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent unread={unread} />
      </aside>

      {/* Mobile drawer */}
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

      {/* Top bar */}
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
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Client Portal</span>
            </div>
            <div className="hidden lg:block text-sm text-slate-500">
              Welcome back, <span className="font-semibold text-slate-800">{user?.fullName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/portal/notifications"
              className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-700"
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

      {/* Main content */}
      <main className="px-4 pb-24 pt-6 sm:px-6 lg:ml-64 lg:pb-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {BOTTOM_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.matchEnd}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-emerald-600' : ''}`} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => navigate('/portal/profile')}
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

export const PortalLayout: React.FC = () => {
  const { user } = useAuth();

  if (!user || user.role !== 'CLIENT') {
    return <Navigate to="/portal/login" replace />;
  }

  return (
    <ToastProvider>
      <PortalLayoutInner />
    </ToastProvider>
  );
};