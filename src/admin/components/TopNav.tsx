import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, ChevronDown, User, LogOut, Settings, Moon, Sun } from 'lucide-react';
import { MOCK_NOTIFICATIONS } from '../data/mockData';

interface TopNavProps {
  onToggleSidebar: () => void;
  adminName: string;
  adminRole: string;
  onLogout: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onToggleSidebar, adminName, adminRole, onLogout }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
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
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 h-16 shrink-0">
      <div className="flex items-center gap-3 h-full px-4 sm:px-6">
        <button onClick={onToggleSidebar} className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-slate-100 text-slate-500 transition">
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden md:block w-full max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients, loans, transactions..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <button
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle dark mode"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"
          >
            {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          {/* Notifications */}
          <div className="relative" ref={containerRef}>
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
              className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {unread}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">Notifications</span>
                  <Link to="/admin/notifications" className="text-xs text-blue-600 font-medium hover:underline">View all</Link>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {MOCK_NOTIFICATIONS.slice(0, 5).map((n) => (
                    <Link
                      key={n.id}
                      to="/admin/notifications"
                      onClick={() => setShowNotifications(false)}
                      className={`block px-4 py-3 hover:bg-slate-50 transition border-b border-slate-50 last:border-0 ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                        <span className="text-sm font-semibold text-slate-800">{n.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{n.timestamp}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
              className="flex items-center gap-2.5 pl-2 pr-1 py-1.5 hover:bg-slate-100 rounded-xl transition"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-800 to-slate-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                {adminName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-slate-800 leading-tight">{adminName}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{adminRole}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">{adminName}</p>
                  <p className="text-xs text-slate-400">{adminRole}</p>
                </div>
                <Link to="/admin/settings" onClick={() => setShowProfileMenu(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                  <Settings className="w-4 h-4" /> Settings
                </Link>
                <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};