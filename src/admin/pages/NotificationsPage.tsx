import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell, BellOff, ShieldCheck, UserPlus, Landmark, ArrowLeftRight, Settings,
  CheckCheck, Trash2, TriangleAlert, Inbox, Clock,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { ConfirmDialog } from '../components/Modal';
import { AdminNotification, formatDate } from '../data/mockData';
import { adminApi } from '../services/adminApi';

const TYPE_META: Record<AdminNotification['type'], { icon: React.ElementType; bg: string; fg: string; label: string }> = {
  KYC: { icon: ShieldCheck, bg: 'bg-gold-500/10 border-gold-400/30', fg: 'text-gold-600', label: 'KYC Compliance' },
  Client: { icon: UserPlus, bg: 'bg-emerald-50 border-emerald-200', fg: 'text-emerald-600', label: 'Member Services' },
  Loan: { icon: Landmark, bg: 'bg-amber-50 border-amber-200', fg: 'text-amber-600', label: 'Credit Facility' },
  Transaction: { icon: ArrowLeftRight, bg: 'bg-gold-500/10 border-gold-400/30', fg: 'text-gold-600', label: 'Ledger Transfer' },
  System: { icon: Settings, bg: 'bg-slate-100 border-slate-200', fg: 'text-slate-600', label: 'System Notice' },
};

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [tab, setTab] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [clearTarget, setClearTarget] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    adminApi.notifications().then(setNotifications).catch(() => setNotifications([]));
  }, []);

  const unread = notifications.filter((n) => !n.isRead).length;

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const matchesTab = tab === 'all' ? true : tab === 'unread' ? !n.isRead : n.isRead;
      const matchesType = !typeFilter || n.type === typeFilter;
      return matchesTab && matchesType;
    });
  }, [notifications, tab, typeFilter]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setToast('All administrative alerts marked as read.');
  };

  const toggleRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n)));
  };

  const clearAll = () => {
    setNotifications([]);
    setClearTarget(false);
    setToast('All notification alerts cleared.');
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Institutional Communications & Alerts' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">System Alerts & Notifications</h1>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-900 border border-amber-400">
                {unread} Action Required
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time compliance alerts, high-value teller movements, loan approvals, and member lifecycle notifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> Mark All Read
          </button>
          <button
            onClick={() => setClearTarget(true)}
            disabled={notifications.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition shadow-xs disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Administrative Dispatches" value={notifications.length} icon={Bell} iconColor="text-gold-600" iconBg="bg-gold-500/10" />
        <StatCard title="Unread Compliance Items" value={unread} icon={BellOff} iconColor="text-amber-600" iconBg="bg-amber-50" accentBorder={unread > 0} />
        <StatCard title="Critical System Alerts" value={notifications.filter((n) => n.type === 'System').length} icon={TriangleAlert} iconColor="text-rose-600" iconBg="bg-rose-50" />
        <StatCard title="Acknowledged Alerts" value={notifications.length - unread} icon={CheckCheck} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
          <div className="flex gap-1 bg-slate-100/90 rounded-xl p-1 w-fit border border-slate-200/50">
            {(['all', 'unread', 'read'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg capitalize transition flex items-center gap-1.5 ${
                  tab === t ? 'bg-[#091527] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{t}</span>
                {t === 'unread' && unread > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${tab === 'unread' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>
                    {unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-700 sm:w-48"
          >
            <option value="">All Categories</option>
            <option value="KYC">KYC Verification</option>
            <option value="Client">Member Services</option>
            <option value="Loan">Credit Facility</option>
            <option value="Transaction">Transactions</option>
            <option value="System">System Notices</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
              <Inbox className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-700 font-bold text-sm">Inbox Clear</p>
            <p className="text-xs text-slate-400 mt-0.5">No administrative dispatches match your selected filter parameters.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((n) => {
              const meta = TYPE_META[n.type];
              const Icon = meta.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => toggleRead(n.id)}
                  className={`w-full flex items-start gap-3.5 p-4 rounded-xl border text-left transition ${
                    n.isRead
                      ? 'bg-white border-slate-200/60 hover:bg-slate-50/70'
                      : 'bg-amber-50/20 border-amber-200/80 hover:bg-amber-50/40 shadow-xs'
                  }`}
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg}`}>
                    <Icon className={`w-4 h-4 ${meta.fg}`} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`font-bold text-xs truncate ${n.isRead ? 'text-slate-800' : 'text-slate-950 font-black'}`}>
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-slate-900">
                          NEW
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</span>
                    <span className="flex items-center gap-3 mt-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                        {meta.label}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {formatDate(n.timestamp.slice(0, 10))} at {n.timestamp.slice(11)}
                      </span>
                    </span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded text-slate-400 shrink-0">
                    {n.isRead ? 'Read' : 'Mark Read'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={clearTarget}
        onClose={() => setClearTarget(false)}
        onConfirm={clearAll}
        title="Purge Administrative Dispatches"
        message="All notifications in the system ledger will be permanently removed. This action cannot be reversed."
        confirmLabel="Purge All"
        variant="warning"
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#091527] border border-amber-500/40 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {toast}
        </div>
      )}
    </div>
  );
};
