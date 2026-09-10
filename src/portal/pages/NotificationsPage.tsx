import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, CheckCheck, HandCoins, Info, Megaphone, PiggyBank, ReceiptText, TriangleAlert } from 'lucide-react';
import { notificationService } from '../services/notifications';
import { NotificationCategory, PortalNotification } from '../types';
import { formatDate } from '../../utils/loanMath';
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, LoadingState } from '../components/ui';
import { categoryTone } from '../components/ui/StatusBadge';
import { useToast } from '../components/ui/Toast';

const CATEGORIES: { id: NotificationCategory | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'loan_update', label: 'Loans' },
  { id: 'upcoming_payment', label: 'Reminders' },
  { id: 'payment_confirmation', label: 'Payments' },
  { id: 'savings_update', label: 'Savings' },
  { id: 'announcement', label: 'Announcements' },
];

const categoryIcon = (c: NotificationCategory) => {
  switch (c) {
    case 'loan_update':
    case 'approval_rejection':
      return HandCoins;
    case 'upcoming_payment':
      return Bell;
    case 'overdue_payment':
      return TriangleAlert;
    case 'payment_confirmation':
      return ReceiptText;
    case 'savings_update':
      return PiggyBank;
    case 'announcement':
      return Megaphone;
    default:
      return Info;
  }
};

const NotificationsPage: React.FC = () => {
  const toast = useToast();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<NotificationCategory | 'ALL'>('ALL');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await notificationService.list();
      setItems(data.notifications);
    } catch (err: any) {
      setError(err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    const next = items.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    setItems(next);
    try {
      await notificationService.markRead(id);
    } catch {
      /* local state updated regardless */
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success('All notifications marked as read.');
    try {
      await notificationService.markAllRead();
    } catch {
      /* ignore */
    }
  };

  const filtered = useMemo(() => (filter === 'ALL' ? items : items.filter((n) => n.category === filter)), [items, filter]);
  const unread = items.filter((n) => !n.isRead).length;

  if (loading) return <LoadingState label="Loading notifications…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            {unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'You are all caught up.'}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === c.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <span className="text-xs text-slate-400">{filtered.length} notification(s)</span>
        </CardHeader>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<BellOff className="h-6 w-6" />}
            title="No notifications"
            description="Notifications about your loans, savings, and cooperative updates will appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((n) => {
              const Icon = categoryIcon(n.category);
              const tone = categoryTone(n.category);
              const toneClass: Record<string, string> = {
                green: 'bg-emerald-50 text-emerald-600',
                red: 'bg-rose-50 text-rose-500',
                amber: 'bg-amber-50 text-amber-600',
                blue: 'bg-blue-50 text-blue-600',
                purple: 'bg-violet-50 text-violet-600',
                slate: 'bg-slate-100 text-slate-500',
              };
              return (
                <li
                  key={n.id}
                  className={`flex cursor-pointer items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50 ${!n.isRead ? 'bg-emerald-50/40' : ''}`}
                  onClick={() => !n.isRead && markRead(n.id)}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneClass[tone]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold ${n.isRead ? 'text-slate-600' : 'text-slate-900'}`}>{n.title}</p>
                      <span className="shrink-0 text-xs text-slate-400">{formatDate(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                  </div>
                  {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default NotificationsPage;