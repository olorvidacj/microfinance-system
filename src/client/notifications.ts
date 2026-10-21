import { and, desc, eq, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { HttpError, type AppDb } from '../kyc/errors';
import type { ClientNotificationView } from '../../shared/client';
import type { LendingClient } from '../lending/service';

/** Notifications addressed to this member (audience CLIENT, 0024); staff messages are never included. */
const memberFeed = (borrowerId: string) => and(eq(schema.branchNotifications.audience, 'CLIENT'), eq(schema.branchNotifications.borrowerId, borrowerId));

const PAGE = 50;

/** The member's latest notifications and how many of all of them are unread. */
export async function clientNotifications(db: AppDb, client: LendingClient): Promise<{ notifications: ClientNotificationView[]; unreadCount: number }> {
  const rows = await db.select().from(schema.branchNotifications).where(memberFeed(client.borrowerId)).orderBy(desc(schema.branchNotifications.createdAt)).limit(PAGE);
  const [unread] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.branchNotifications)
    .where(and(memberFeed(client.borrowerId), eq(schema.branchNotifications.isRead, false)));
  return {
    notifications: rows.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      category: n.type,
      isRead: Boolean(n.isRead),
      createdAt: String(n.createdAt),
    })),
    unreadCount: Number(unread?.n ?? 0),
  };
}

/** Marks one of the member's own notifications read; another member's id is "not found". */
export async function markNotificationRead(db: AppDb, client: LendingClient, id: string): Promise<void> {
  const updated = await db
    .update(schema.branchNotifications)
    .set({ isRead: true })
    .where(and(eq(schema.branchNotifications.id, id), memberFeed(client.borrowerId)))
    .returning({ id: schema.branchNotifications.id });
  if (updated.length === 0) throw new HttpError(404, 'Notification not found.', 'NOT_FOUND');
}

export async function markAllNotificationsRead(db: AppDb, client: LendingClient): Promise<void> {
  await db.update(schema.branchNotifications).set({ isRead: true }).where(and(memberFeed(client.borrowerId), eq(schema.branchNotifications.isRead, false)));
}
