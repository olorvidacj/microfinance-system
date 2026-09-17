import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileSpreadsheet,
  PiggyBank,
  ArrowLeftRight,
  Users2,
  Building2,
  BarChart3,
  ScrollText,
  Bell,
  Settings,
  LogOut,
  X,
  ShieldCheck,
} from 'lucide-react';

export interface NavItemDef {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  unreadCount: number;
  onLogout: () => void;
}

const NAV_ITEMS: { section: string; items: NavItemDef[] }[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Management',
    items: [
      { label: 'User Management', path: '/admin/users', icon: Users },
      { label: 'Client Management', path: '/admin/clients', icon: UserCheck },
      { label: 'KYC Verification', path: '/admin/kyc', icon: ShieldCheck },
      { label: 'Loan Management', path: '/admin/loans', icon: FileSpreadsheet },
      { label: 'Savings Management', path: '/admin/savings', icon: PiggyBank },
      { label: 'Financial Transactions', path: '/admin/transactions', icon: ArrowLeftRight },
      { label: 'Lending Groups', path: '/admin/groups', icon: Users2 },
      { label: 'Branch Management', path: '/admin/branches', icon: Building2 },
    ],
  },
  {
    section: 'Insights',
    items: [
      { label: 'Reports & Analytics', path: '/admin/reports', icon: BarChart3 },
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: ScrollText },
      { label: 'Notifications', path: '/admin/notifications', icon: Bell },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'System Settings', path: '/admin/settings', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose, unreadCount, onLogout }) => {
  const location = useLocation();

  const content = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-slate-900 font-black text-lg shadow-lg">
            H
          </div>
          <div>
            <div className="font-bold text-white text-sm tracking-tight leading-tight">HOSCOMO</div>
            <div className="text-[10px] text-amber-400/90 font-medium uppercase tracking-widest">Admin Console</div>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
        {NAV_ITEMS.map((section) => (
          <div key={section.section} className="mb-5">
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {section.section}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition group ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-inner'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    <span className="flex-1 whitespace-nowrap">{item.label}</span>
                    {item.path === '/admin/notifications' && unreadCount > 0 && (
                      <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-900">
                        {unreadCount}
                      </span>
                    )}
                    {isActive && (
                      <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800 shrink-0">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-950/40 hover:text-red-300 transition w-full"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block w-64 shrink-0 bg-slate-900">
        <div className="sticky top-0 h-screen">
          <div className="h-full">{content}</div>
        </div>
      </aside>

      {/* Mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl">{content}</div>
        </div>
      )}
    </>
  );
};