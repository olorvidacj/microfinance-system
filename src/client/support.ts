import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { HttpError, type AppDb } from '../kyc/errors';
import type { LendingClient } from '../lending/service';
import { validateSupportRequest, type FaqView, type SupportContactView, type SupportRequestView } from '../../shared/client';

/** Answers shown to members in the portal and the app. */
export const SUPPORT_FAQS: FaqView[] = [
  { id: 'faq-l1', category: 'Loans', question: 'How do I know if my loan was approved?', answer: 'You get a notification as soon as the decision is made, and the status is shown under My Loans.' },
  { id: 'faq-l2', category: 'Loans', question: 'When will my loan be released?', answer: 'Once it is approved and all requirements are complete, your branch schedules the release and notifies you.' },
  { id: 'faq-p1', category: 'Payments', question: 'How can I pay?', answer: 'Pay over the counter at your branch, or send a GCash, Maya or bank transfer and upload the proof under Payments. Your branch checks the proof before it is posted.' },
  { id: 'faq-p2', category: 'Payments', question: 'Can I pay my loan in full early?', answer: 'Yes. Open the loan in My Loans to see the exact amount that settles it today, then pay it at the branch or send proof of a transfer.' },
  { id: 'faq-s1', category: 'Savings', question: 'How do I make a savings deposit?', answer: 'Deposit over the counter at your branch. Withdrawal requests can be filed from the Savings page.' },
  { id: 'faq-s2', category: 'Savings', question: 'How much interest do my savings earn?', answer: 'Each account shows its yearly rate and how interest is computed on the Savings page. Interest is credited at the end of each month.' },
  { id: 'faq-a1', category: 'Account', question: 'How do I reset my password?', answer: 'Use "Forgot password" on the sign-in page. A verification code is sent to your registered email.' },
  { id: 'faq-a2', category: 'Account', question: 'How do I update my contact details?', answer: 'Go to My Profile and choose Edit to change your mobile number, address and work details. Your name, date of birth and gender come from your verified KYC; to change them, update your KYC or visit your branch.' },
  { id: 'faq-g1', category: 'Groups', question: 'What is a solidarity group?', answer: "A circle of members who meet regularly and are jointly liable for each other's loans. If a member cannot pay, the group's solidarity fund covers the installment and the member pays it back." },
];

/** The branch the member belongs to; it answers their messages. */
export async function supportContact(db: AppDb, client: LendingClient): Promise<SupportContactView> {
  const [row] = await db
    .select({ branchName: schema.branches.name, address: schema.branches.address, city: schema.branches.city, phone: schema.branches.phone })
    .from(schema.borrowers)
    .innerJoin(schema.branches, eq(schema.branches.id, schema.borrowers.branchId))
    .where(eq(schema.borrowers.id, client.borrowerId))
    .limit(1);
  if (!row) throw new HttpError(404, 'Your branch was not found. Please contact the cooperative.', 'NOT_FOUND');
  return row;
}

/**
 * A member's message to their branch. It is delivered as a staff notification
 * for the member's branch (and audited); the branch answers by phone, SMS or
 * at the counter. There is no in-app reply thread.
 */
export async function sendSupportRequest(db: AppDb, client: LendingClient, input: { subject?: unknown; category?: unknown; message?: unknown }): Promise<SupportRequestView> {
  const v = validateSupportRequest(input);
  if (!v.ok) throw new HttpError(400, 'Check the highlighted fields.', 'INVALID_REQUEST', { fields: v.errors });
  const { subject, category, message } = v.value;
  const [member] = await db.select({ branchId: schema.borrowers.branchId, number: schema.borrowers.borrowerNumber }).from(schema.borrowers).where(eq(schema.borrowers.id, client.borrowerId)).limit(1);
  if (!member) throw new HttpError(404, 'Your member record was not found.', 'NOT_FOUND');
  const at = new Date().toISOString();
  const id = `ntf-${crypto.randomUUID()}`;
  await db.transaction(async (tx) => {
    await tx.insert(schema.branchNotifications).values({
      id,
      branchId: member.branchId,
      audience: 'STAFF',
      borrowerId: client.borrowerId,
      type: 'SUPPORT_REQUEST',
      title: `[${category}] ${subject}`,
      message: `${client.name} (${member.number}): ${message}`,
      relatedType: 'Borrower',
      relatedId: client.borrowerId,
      isRead: false,
      createdAt: at,
    });
    await tx.insert(schema.auditLogs).values({
      id: `aud-${crypto.randomUUID()}`,
      timestamp: at,
      action: 'SUPPORT_REQUEST',
      details: `${client.name} wrote to the branch: [${category}] ${subject}`,
      performedBy: client.userId,
      branchId: member.branchId,
      type: 'MEMBERSHIP',
      userName: client.name,
      userRole: 'CLIENT',
      targetType: 'Borrower',
      targetId: client.borrowerId,
    });
  });
  return { id, subject, category, sentAt: at, read: false };
}

/** The member's own requests, newest first, with whether branch staff have opened them. */
export async function supportRequests(db: AppDb, client: LendingClient): Promise<SupportRequestView[]> {
  const rows = await db
    .select()
    .from(schema.branchNotifications)
    .where(and(eq(schema.branchNotifications.type, 'SUPPORT_REQUEST'), eq(schema.branchNotifications.relatedId, client.borrowerId)))
    .orderBy(desc(schema.branchNotifications.createdAt))
    .limit(50);
  return rows.map((r) => {
    const m = /^\[([^\]]+)\] (.*)$/.exec(r.title);
    return { id: r.id, category: m?.[1] ?? 'Other', subject: m?.[2] ?? r.title, sentAt: r.createdAt ? String(r.createdAt) : null, read: Boolean(r.isRead) };
  });
}
