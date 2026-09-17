import React, { useMemo, useState } from 'react';
import {
  Bell, BellOff, ShieldCheck, UserPlus, Landmark, ArrowLeftRight, Settings,
  CheckCheck, Trash2, TriangleAlert, Inbox,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { ConfirmDialog } from '../components/Modal';
import { MOCK_NOTIFICATIONS, AdminNotification, formatDate } from '../data/mockData';

const TYPE_META: Record<AdminNotification['type'], { icon: React.ElementType; bg: string; fg: string; label: string }> = {
  KYC: { icon: ShieldCheck, bg: 'bg-blue-50', fg: 'text-blue-600', label: 'KYC' },
  Client: { icon: UserPlus, bg: 'bg-emerald-50', fg: 'text-emerald-600', label: 'Client' },
  Loan: { icon: Landmark, bg: 'bg-indigo-50', fg: 'text-indigo-600', label: 'Loan' },
  Transaction: { icon: ArrowLeftRight, bg: 'bg-amber-50', fg: 'text-amber-600', label: 'Transaction' },
  System: { icon: Settings, bg: 'bg-slate-100', fg: 'text-slate-500', label: 'System' },
};

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<AdminNotification[]>(MOCK_NOTIFICATIONS);
  const [tab, setTab] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [clearTarget, setClearTarget] = useState(false);
  const [toast, setToast] = useState('');

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
    setToast('All notifications marked as read.');
  };

  const toggleRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n)));
  };

  const clearAll = () => {
    setNotifications([]);
    setClearTarget(false);
    setToast('All notifications cleared.');
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Notifications' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-0.5 text-sm text-slate-500">System alerts and updates for the administrator.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={markAllRead} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm">
            <CheckCheck className="w-4 h-4 text-emerald-600" /> Mark All Read
          </button>
          <button onClick={() => setClearTarget(true)} disabled={notifications.length === 0} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition shadow-sm disabled:opacity-50 disabled:pointer-events-none">
            <Trash2 className="w-4 h-4 text-red-500" /> Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Notifications" value={notifications.length} icon={Bell} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <StatCard title="Unread" value={unread} icon={BellOff} iconColor="text-red-500" iconBg="bg-red-50" />
        <StatCard title="System Alerts" value={notifications.filter((n) => n.type === 'System').length} icon={TriangleAlert} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <StatCard title="Read" value={notifications.length - unread} icon={CheckCheck} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {(['all', 'unread', 'read'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition ${
                  tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t}
                {t === 'unread' && unread > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{unread}</span>
                )}
              </button>
            ))}
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-slate-700 sm:w-44">
            <option value="">All Types</option>
            <option>KYC</option>
            <option>Client</option>
            <option>Loan</option>
            <option>Transaction</option>
            <option>System</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Inbox className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No notifications here</p>
            <p className="text-sm text-slate-400 mt-1">New alerts will appear in this list.</p>
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
                  className={`w-full flex items-start gap-3.5 p-4 rounded-xl border text-left transition hover:border-slate-300 hover:bg-slate-50/50 ${
                    n.isRead ? 'bg-white border-slate-100' : 'bg-blue-50/40 border-blue-100'
                  }`}
                >
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                    <Icon className={`w-5 h-5 ${meta.fg}`} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`font-semibold truncate ${n.isRead ? 'text-slate-800' : 'text-slate-900'}`}>{n.title}</span>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                    </span>
                    <span className="block text-sm text-slate-500 mt-0.5">{n.message}</span>
                    <span className="flex items-center gap-2 mt-2">
                      <Badge variant="default">{meta.label}</Badge>
                      <span className="text-[11px] text-slate-400">{formatDate(n.timestamp.slice(0, 10))} · {n.timestamp.slice(11)}</span>
                    </span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide mt-1 shrink-0">{n.isRead ? 'Read' : 'Unread'}</span>
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
        title="Clear All Notifications"
        message="All notifications will be permanently removed. This action cannot be undone."
        confirmLabel="Clear All"
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};