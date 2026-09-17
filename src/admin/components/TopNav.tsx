import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  Moon,
  Sun,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Building,
} from 'lucide-react';
import { MOCK_NOTIFICATIONS } from '../data/mockData';

interface TopNavProps {
  onToggleSidebar: () => void;
  adminName: string;
  adminRole: string;
  onLogout: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onToggleSidebar,
  adminName,
  adminRole,
  onLogout,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const unread = MOCK_NOTIFICATIONS.filter((n) => !n.isRead).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 h-16 shrink-0 transition-colors">
      <div className="flex items-center justify-between gap-3 h-full px-4 sm:px-6">
        {/* Left section: Toggle & Brand / Branch status */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-600 transition"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 font-medium text-slate-700">
              <Building className="w-3.5 h-3.5 text-amber-600" />
              <span>Tacloban Main Branch</span>
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-slate-400 text-[11px]">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>PST (GMT+8)</span>
            </span>
          </div>
        </div>

        {/* Middle: Global Quick Search */}
        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members, loan ID, reference number..."
              className="w-full pl-9 pr-12 py-2 text-xs sm:text-sm bg-slate-50/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition placeholder:text-slate-400 shadow-sm"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden xl:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-2xl">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right Controls: Dark toggle, Notifications & Profile */}
        <div className="flex items-center gap-2 sm:gap-3" ref={containerRef}>
          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle color theme"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileMenu(false);
              }}
              className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute 1 top-1 right-1 min-w-[17px] h-[17px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-amber-500 ring-2 ring-white rounded-full">
                  {unread}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Notifications</span>
                    {unread > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        {unread} unread
                      </span>
                    )}
                  </div>
                  <Link
                    to="/admin/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
                  >
                    View All
                  </Link>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {MOCK_NOTIFICATIONS.slice(0, 5).map((n) => (
                    <Link
                      key={n.id}
                      to="/admin/notifications"
                      onClick={() => setShowNotifications(false)}
                      className={`block px-4 py-3 hover:bg-slate-50/80 transition ${
                        !n.isRead ? 'bg-amber-500/[0.04]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          )}
                          <p className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-1">
                            {n.title}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {n.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    </Link>
                  ))}
                </div>

                <div className="p-2 border-t border-slate-100 text-center">
                  <Link
                    to="/admin/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs font-semibold text-slate-600 hover:text-amber-600 transition"
                  >
                    Open Notification Center →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-[1px] bg-slate-200 mx-0.5" />

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 hover:bg-slate-100 rounded-xl transition group"
              aria-label="Admin Profile Menu"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#091527] to-[#1e3a8a] text-amber-400 ring-2 ring-amber-400/50 flex items-center justify-center text-xs font-bold shadow-sm">
                  {adminName
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>

              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition leading-tight">
                  {adminName}
                </p>
                <p className="text-[10px] text-slate-400 font-medium leading-tight">
                  {adminRole}
                </p>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block group-hover:text-slate-600 transition" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                      Verified Admin
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-1">{adminName}</p>
                  <p className="text-xs text-slate-500">{adminRole}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Tacloban Main Branch</p>
                </div>

                <div className="py-1">
                  <Link
                    to="/admin/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>System Settings</span>
                  </Link>
                  <Link
                    to="/admin/audit-logs"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                    <span>Audit Trail</span>
                  </Link>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs sm:text-sm text-rose-600 hover:bg-rose-50 font-medium transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};