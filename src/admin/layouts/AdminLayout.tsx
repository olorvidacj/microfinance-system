import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  Users2,
} from 'lucide-react';
import { AppShell, AppNavSection } from '../../ui';
import { TopNav } from '../components/TopNav';
import { adminApi } from '../services/adminApi';
import { useAuth } from '../../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  useEffect(() => {
    adminApi.notifications()
      .then((items) => setUnreadCount(items.filter((n) => !n.isRead).length))
      .catch(() => setUnreadCount(0));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const adminName = user?.fullName || 'Administrator';
  const adminRole = user?.staffRole ? String(user.staffRole).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'System Administrator';

  const sections: AppNavSection[] = [
    {
      title: 'Overview',
      items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      title: 'Core Banking & Members',
      items: [
        { to: '/admin/users', label: 'User Management', icon: Users },
        { to: '/admin/clients', label: 'Client Management', icon: UserCheck },
        { to: '/admin/kyc', label: 'KYC Verification', icon: ShieldCheck },
        { to: '/admin/loans', label: 'Loan Management', icon: FileSpreadsheet },
        { to: '/admin/savings', label: 'Savings Management', icon: PiggyBank },
        { to: '/admin/transactions', label: 'Financial Transactions', icon: ArrowLeftRight },
        { to: '/admin/groups', label: 'Lending Groups', icon: Users2 },
        { to: '/admin/branches', label: 'Branch Management', icon: Building2 },
      ],
    },
    {
      title: 'Compliance & Analytics',
      items: [
        { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
        { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
        { to: '/admin/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
      ],
    },
    {
      title: 'Configuration',
      items: [{ to: '/admin/settings', label: 'System Settings', icon: Settings }],
    },
  ];

  return (
    <AppShell
      sections={sections}
      collapsible
      brandName="HOSCOMCO"
      brandSubtitle="Tacloban, Leyte · Microfinance"
      brandTag="COOP"
      showStatusDot
      onBrandClick={() => navigate('/admin')}
      status={
        <div className="flex items-center justify-between bg-navy-900/70 px-4 py-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-300">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-gold-400" />
            <span>CDA Reg: 9520-08000421</span>
          </span>
          <span className="font-semibold text-emerald-400">ONLINE</span>
        </div>
      }
      sidebarFooter={({ collapsed }) => (
        <div className="p-3">
          {!collapsed && (
            <div className="mb-2 flex items-center gap-3 rounded-lg border border-navy-700 bg-navy-900 px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-gold-500 to-gold-400 text-navy-950">
                <Landmark className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] text-slate-400">Tacloban Main Branch</p>
                <p className="truncate text-[11px] font-semibold text-gold-400">PHP Settlement Node</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Sign out of Admin Console"
            className={`flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-rose-900/50 hover:bg-rose-950/40 hover:text-rose-300 sm:text-[13px] ${
              collapsed ? 'justify-center px-2' : ''
            }`}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}
      topbar={({ openSidebar }) => (
        <TopNav
          onToggleSidebar={openSidebar}
          adminName={adminName}
          adminRole={adminRole}
          onLogout={handleLogout}
        />
      )}
    >
      <Outlet />
    </AppShell>
  );
};

export default AdminLayout;
