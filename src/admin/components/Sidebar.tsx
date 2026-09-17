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
  ChevronLeft,
  ChevronRight,
  Landmark,
  BadgeCheck,
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
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const NAV_ITEMS: { section: string; items: NavItemDef[] }[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Core Banking & Members',
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
    section: 'Compliance & Analytics',
    items: [
      { label: 'Reports & Analytics', path: '/admin/reports', icon: BarChart3 },
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: ScrollText },
      { label: 'Notifications', path: '/admin/notifications', icon: Bell },
    ],
  },
  {
    section: 'Configuration',
    items: [
      { label: 'System Settings', path: '/admin/settings', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  unreadCount,
  onLogout,
  collapsed = false,
  onToggleCollapse,
}) => {
  const location = useLocation();

  const content = (
    <div className="flex flex-col h-full bg-[#091527] text-slate-300 border-r border-[#15243d] select-none">
      {/* Brand Header */}
      <div className={`flex items-center justify-between px-4 h-16 border-b border-[#15243d] shrink-0 ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-600 flex items-center justify-center text-[#091527] font-black text-lg shadow-md shadow-amber-500/20">
              <Landmark className="w-5 h-5 text-[#091527]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#091527] flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </div>
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm tracking-tight truncate leading-tight">HOSCOMO</span>
                <span className="px-1 py-0.2 text-[9px] font-bold rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">COOP</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate tracking-tight">Tacloban, Leyte · Microfinance</p>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop collapse toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-amber-400 transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Official Registry Badge (visible when not collapsed) */}
      {!collapsed && (
        <div className="px-4 py-2 bg-[#0d1c33]/70 border-b border-[#15243d] flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-300">
            <BadgeCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>CDA Reg: 9520-08000421</span>
          </span>
          <span className="text-emerald-400 font-semibold">ONLINE</span>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
        {NAV_ITEMS.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {section.section}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-[13px] font-medium transition-all group ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-white font-semibold border-l-4 border-amber-400 shadow-sm'
                        : 'text-slate-400 hover:bg-[#11233f] hover:text-slate-100'
                    } ${collapsed ? 'justify-center px-2' : ''}`}
                  >
                    <item.icon
                      className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                        isActive
                          ? 'text-amber-400'
                          : 'text-slate-400 group-hover:text-amber-300'
                      }`}
                    />

                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.path === '/admin/notifications' && unreadCount > 0 && (
                          <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-[#091527] shadow-sm">
                            {unreadCount}
                          </span>
                        )}
                      </>
                    )}

                    {collapsed && item.path === '/admin/notifications' && unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-[#15243d] bg-[#07101f] shrink-0">
        {!collapsed && (
          <div className="px-3 py-2 mb-2 rounded-lg bg-[#0d1c33] border border-[#172b4c] text-[11px]">
            <p className="text-slate-400">Tacloban Main Branch</p>
            <p className="font-semibold text-amber-400">PHP Settlement Node</p>
          </div>
        )}
        <button
          onClick={onLogout}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-[13px] font-medium text-slate-400 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-900/50 border border-transparent transition w-full ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title="Sign out of Admin Console"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0 text-slate-400 group-hover:text-rose-300" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">
          <div className="h-full">{content}</div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};