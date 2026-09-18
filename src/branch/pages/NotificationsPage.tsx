import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { notificationsService } from '../services';

const ICONS: Record<string, string> = {
  KYC: 'bg-amber-50 text-amber-600',
  LOAN_APPLICATION: 'bg-emerald-50 text-emerald-600',
  PAYMENT: 'bg-emerald-50 text-emerald-600',
  SAVINGS: 'bg-teal-50 text-teal-600',
  GROUP: 'bg-gold-500/10 text-gold-600',
  SYSTEM: 'bg-slate-100 text-slate-500',
};

const NotificationsPage: React.FC = () => {
  const toast = useToast();
  const fetcher = useCallback(() => notificationsService.list(), []);
  const { data, loading, error, reload } = useBranchData(fetcher);

  const notifications = data?.notifications || [];
  const unread = data?.unreadCount || 0;

  const markAll = async () => {
    try {
      await notificationsService.markAllRead();
      reload();
      toast.success('All notifications marked as read');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to update notifications.');
    }
  };

  const markOne = async (id: string) => {
    try {
      await notificationsService.markRead(id);
      reload();
    } catch {
      /* non-fatal */
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'You are all caught up'}
        actions={
          unread > 0 && (
            <Button variant="outline" onClick={markAll}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          )
        }
      />

      {loading ? (
        <LoadingState label="Loading notifications…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="Branch notifications will appear here." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${n.isRead ? 'opacity-70' : ''}`}
              onClick={() => !n.isRead && markOne(n.id)}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ICONS[n.type] || ICONS.SYSTEM}`}>
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                  {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
                </div>
                <p className="text-sm text-slate-600">{n.message}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>{n.type}</span>
                  <span>·</span>
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
              </div>
              {n.relatedId && n.relatedType === 'Loan' && (
                <Link
                  to={`/staff/app/loans/${n.relatedId}`}
                  className="shrink-0 self-center text-xs font-semibold text-amber-600 hover:text-amber-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  View →
                </Link>
              )}
              {n.relatedId && n.relatedType === 'Borrower' && (
                <Link
                  to={`/staff/app/clients/${n.relatedId}`}
                  className="shrink-0 self-center text-xs font-semibold text-amber-600 hover:text-amber-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  View →
                </Link>
              )}
            </button>
          ))}
        </Card>
      )}
    </div>
  );
};

export default NotificationsPage;