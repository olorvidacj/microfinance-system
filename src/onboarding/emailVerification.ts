import crypto from 'crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { EMAIL_CODE, normalizeEmail } from '../../shared/kyc-core';
import { HttpError, type AppDb } from '../kyc/errors';

export interface CodeMailer {
  /** Resolves true when the message was handed to a mail server. */
  sendCode(to: string, code: string): Promise<boolean>;
}

const MAX_CODES_PER_HOUR = 5;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new HttpError(500, 'AUTH_SECRET must be set for email verification.', 'CONFIG');
  return s;
}

function hashCode(email: string, code: string): string {
  return crypto.createHmac('sha256', secret()).update(`${email}:${code}`).digest('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function requireEmail(raw: unknown): string {
  const email = normalizeEmail(raw);
  if (!email) throw new HttpError(400, 'Enter a valid email address.', 'BAD_EMAIL');
  return email;
}

/** Sends a one-time registration code. The account must not exist yet. */
export async function requestEmailCode(db: AppDb, rawEmail: unknown, mailer: CodeMailer, now = new Date()) {
  const email = requireEmail(rawEmail);
  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`).limit(1);
  if (existing[0]) throw new HttpError(409, 'An account with this email already exists. Please sign in instead.', 'ACCOUNT_EXISTS');

  const recent = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.emailVerifications)
    .where(and(eq(schema.emailVerifications.email, email), gt(schema.emailVerifications.createdAt, new Date(now.getTime() - 3600_000))));
  if ((recent[0]?.n ?? 0) >= MAX_CODES_PER_HOUR) {
    throw new HttpError(429, 'Too many codes were requested for this email. Please wait an hour and try again.', 'RATE_LIMITED');
  }

  const code = String(crypto.randomInt(0, 10 ** EMAIL_CODE.length)).padStart(EMAIL_CODE.length, '0');
  await db.insert(schema.emailVerifications).values({
    id: `ev-${crypto.randomUUID()}`,
    email,
    purpose: 'REGISTRATION',
    codeHash: hashCode(email, code),
    expiresAt: new Date(now.getTime() + EMAIL_CODE.ttlMinutes * 60_000),
    createdAt: now,
  });

  const delivered = await mailer.sendCode(email, code);
  if (!delivered && process.env.NODE_ENV === 'production') {
    throw new HttpError(503, 'We could not send the verification email. Please try again later.', 'MAIL_FAILED');
  }
  return { email, expiresInSeconds: EMAIL_CODE.ttlMinutes * 60, delivered };
}

/** Checks a code. On success returns a single-use token that registration consumes. */
export async function verifyEmailCode(db: AppDb, rawEmail: unknown, rawCode: unknown, now = new Date()) {
  const email = requireEmail(rawEmail);
  const code = String(rawCode ?? '').replace(/\D/g, '');
  if (code.length !== EMAIL_CODE.length) throw new HttpError(400, `Enter the ${EMAIL_CODE.length}-digit code from the email.`, 'BAD_CODE');

  const [row] = await db
    .select()
    .from(schema.emailVerifications)
    .where(and(eq(schema.emailVerifications.email, email), isNull(schema.emailVerifications.verifiedAt), gt(schema.emailVerifications.expiresAt, now)))
    .orderBy(desc(schema.emailVerifications.createdAt))
    .limit(1);
  if (!row) throw new HttpError(400, 'This code has expired. Please request a new one.', 'CODE_EXPIRED');
  if (row.attempts >= EMAIL_CODE.maxAttempts) throw new HttpError(429, 'Too many incorrect attempts. Please request a new code.', 'TOO_MANY_ATTEMPTS');

  const attempts = row.attempts + 1;
  const expected = Buffer.from(row.codeHash, 'hex');
  const given = Buffer.from(hashCode(email, code), 'hex');
  if (!crypto.timingSafeEqual(expected, given)) {
    await db.update(schema.emailVerifications).set({ attempts }).where(eq(schema.emailVerifications.id, row.id));
    const left = EMAIL_CODE.maxAttempts - attempts;
    throw new HttpError(400, left > 0 ? `That code is incorrect. ${left} attempt${left === 1 ? '' : 's'} left.` : 'That code is incorrect. Please request a new one.', 'WRONG_CODE');
  }

  const token = crypto.randomBytes(32).toString('base64url');
  await db
    .update(schema.emailVerifications)
    .set({ attempts, verifiedAt: now, tokenHash: hashToken(token), tokenExpiresAt: new Date(now.getTime() + EMAIL_CODE.tokenTtlMinutes * 60_000) })
    .where(eq(schema.emailVerifications.id, row.id));
  return { email, verificationToken: token, expiresInSeconds: EMAIL_CODE.tokenTtlMinutes * 60 };
}

/** Marks a verification token used, inside the registration transaction. */
export async function consumeEmailToken(tx: AppDb, email: string, token: unknown, consumedBy: string, now = new Date()): Promise<void> {
  const t = String(token ?? '');
  if (!t) throw new HttpError(400, 'Verify your email address first.', 'EMAIL_NOT_VERIFIED');
  const [row] = await tx
    .select()
    .from(schema.emailVerifications)
    .where(and(eq(schema.emailVerifications.tokenHash, hashToken(t)), eq(schema.emailVerifications.email, email)))
    .for('update')
    .limit(1);
  if (!row || row.consumedAt || !row.tokenExpiresAt || row.tokenExpiresAt <= now) {
    throw new HttpError(400, 'Your email verification has expired or was already used. Please verify your email again.', 'EMAIL_NOT_VERIFIED');
  }
  await tx.update(schema.emailVerifications).set({ consumedAt: now, consumedBy }).where(eq(schema.emailVerifications.id, row.id));
}
