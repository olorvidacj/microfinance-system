import React from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import { AuditLogRow } from '../types';
import { Card, CardHeader, CardTitle } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';

export const ActivityFeed: React.FC<{ items: AuditLogRow[]; className?: string }> = ({ items, className = '' }) => {
  const list = items.slice(0, 12);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <ActivityIcon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <div className="divide-y divide-slate-100">
        {list.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400">No recent activity.</p>}
        {list.map((item) => (
          <div key={item.id} className="flex items-start gap-3 px-5 py-3">
            <StatusBadge status={item.action} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-700">{item.details}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {item.performedBy} · {new Date(item.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};