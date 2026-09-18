import React, { useState } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  PiggyBank,
  Users,
  ShieldCheck,
  Check,
  Trash2,
  ArrowRight,
  Clock,
  Filter,
} from 'lucide-react';
import { ClientNotification, ClientNotificationCategory } from '../../types';
import { formatDate } from '../../utils/loanMath';

interface ClientNotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: ClientNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll?: () => void;
  onNavigateTab: (tab: 'home' | 'loans' | 'savings' | 'pay' | 'apply' | 'group' | 'profile' | 'kyc' | 'repayments' | 'schedule') => void;
}

export const ClientNotificationDrawer: React.FC<ClientNotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNavigateTab,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ClientNotificationCategory>('ALL');

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (selectedCategory === 'ALL') return true;
    return n.category === selectedCategory;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'LOAN_APPROVAL':
      case 'LOAN_DISBURSED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'LOAN_REJECTED':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'OVERDUE_PAYMENT':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'UPCOMING_PAYMENT':
      case 'PAYMENT_CONFIRMATION':
        return <CreditCard className="w-4 h-4 text-gold-500" />;
      case 'SAVINGS_TRANSACTION':
        return <PiggyBank className="w-4 h-4 text-gold-500" />;
      case 'GROUP_LENDING_ALERT':
        return <Users className="w-4 h-4 text-purple-500" />;
      case 'KYC_STATUS':
        return <ShieldCheck className="w-4 h-4 text-teal-500" />;
      default:
        return <Bell className="w-4 h-4 text-gold-500" />;
    }
  };

  const getCategoryBg = (type: string) => {
    switch (type) {
      case 'LOAN_APPROVAL':
      case 'LOAN_DISBURSED':
        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'LOAN_REJECTED':
        return 'bg-rose-50 border-rose-200 text-rose-800';
      case 'OVERDUE_PAYMENT':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'UPCOMING_PAYMENT':
      case 'PAYMENT_CONFIRMATION':
        return 'bg-gold-500/10 border-gold-400/30 text-gold-800';
      case 'SAVINGS_TRANSACTION':
        return 'bg-gold-500/10 border-gold-400/30 text-gold-800';
      case 'GROUP_LENDING_ALERT':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-navy-900/30 border border-gold-500/40 flex items-center justify-center text-gold-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Notification Center</h3>
              <p className="text-[11px] text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                title="Mark all as read"
                className="text-[11px] font-semibold text-gold-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Read all</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex gap-1.5 overflow-x-auto no-scrollbar text-xs">
          {(['ALL', 'LOANS', 'PAYMENTS', 'SAVINGS', 'GROUP'] as ClientNotificationCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg font-semibold transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat === 'ALL'
                ? 'All'
                : cat === 'LOANS'
                ? 'Loans'
                : cat === 'PAYMENTS'
                ? 'Payments'
                : cat === 'SAVINGS'
                ? 'Savings'
                : 'Group'}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400 mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Notifications</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                You don't have any updates in this category right now. Alerts for loan approvals, upcoming dues, and savings will appear here.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) onMarkAsRead(notif.id);
                  if (notif.actionTab) {
                    onNavigateTab(notif.actionTab);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-2xl border transition text-left cursor-pointer relative ${
                  notif.isRead
                    ? 'bg-white border-slate-200 hover:border-slate-300'
                    : 'bg-gold-500/10 border-gold-400/30 shadow-xs hover:bg-gold-500/10'
                }`}
              >
                {!notif.isRead && (
                  <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-navy-900"></span>
                )}

                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${getCategoryBg(notif.type)}`}>
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="font-bold text-xs text-slate-900 truncate">{notif.title}</h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(notif.timestamp)}
                      </span>
                      {notif.actionTab && (
                        <span className="font-semibold text-gold-600 flex items-center gap-0.5 hover:underline">
                          View details <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 px-4">
          <span>HOSCOMCO Cooperative Alerts</span>
          {onClearAll && notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-slate-500 hover:text-rose-600 flex items-center gap-1 font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
