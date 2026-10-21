import { eq } from 'drizzle-orm';
import { schema } from '../db/index';
import { HttpError, type AppDb } from '../kyc/errors';
import { evaluatePassword, STRONG_PASSWORD_ERROR_MESSAGE } from '../../shared/auth/password';
import { hashPassword, verifyPassword } from './index';
import { getServerSupabase } from '../db/supabaseServer';
import { SupabaseAuthError, supabaseSignIn, writeAuditLog } from './supabaseAuth';

/**
 * Passwords live in two places: Supabase Auth (the primary credential when
 * Supabase is configured) and the local users.password_hash (the fallback
 * login path). Both must change together, or the old password keeps working
 * through whichever store was not updated.
 */
export async function setPassword(db: AppDb, user: { id: string; email: string }, newPassword: string): Promise<void> {
  const supabase = getServerSupabase();
  if (supabase) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
    // Accounts created before Supabase Auth was connected only have the local hash.
    if (error && !/not.?found|user_not_found|invalid.*uuid/i.test(`${error.message} ${(error as { code?: string }).code ?? ''}`)) {
      throw new HttpError(502, 'The password could not be changed right now. Please try again.', 'AUTH_PROVIDER');
    }
  }
  await db.update(schema.users).set({ passwordHash: hashPassword(newPassword) }).where(eq(schema.users.id, user.id));
}

/** Whether `password` is the user's current password, in either store. */
async function isCurrentPassword(user: { email: string; passwordHash: string }, password: string): Promise<boolean> {
  if (verifyPassword(password, user.passwordHash)) return true;
  if (!getServerSupabase()) return false;
  try {
    await supabaseSignIn(user.email, password);
    return true;
  } catch (err) {
    if (err instanceof SupabaseAuthError && [400, 401, 404].includes(err.status)) return false;
    throw new HttpError(502, 'Your current password could not be checked right now. Please try again.', 'AUTH_PROVIDER');
  }
}

/** A signed-in user changes their own password; the current one is required. */
export async function changePassword(db: AppDb, userId: string, input: { currentPassword?: unknown; newPassword?: unknown }) {
  const current = typeof input.currentPassword === 'string' ? input.currentPassword : '';
  const next = typeof input.newPassword === 'string' ? input.newPassword : '';
  const fields: Record<string, string> = {};
  if (!current) fields.currentPassword = 'Enter your current password.';
  if (!evaluatePassword(next).isStrong) fields.newPassword = STRONG_PASSWORD_ERROR_MESSAGE;
  else if (next === current) fields.newPassword = 'Choose a password different from your current one.';
  if (Object.keys(fields).length) throw new HttpError(400, 'Check the highlighted fields.', 'INVALID_PASSWORD', { fields });

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user || user.isActive === false) throw new HttpError(401, 'Please sign in again.', 'UNAUTHENTICATED');
  if (!(await isCurrentPassword(user, current))) {
    throw new HttpError(400, 'Your current password is not correct.', 'WRONG_PASSWORD', { fields: { currentPassword: 'This is not your current password.' } });
  }
  await setPassword(db, user, next);
  await writeAuditLog({
    action: 'PASSWORD_CHANGED',
    type: 'AUTH',
    details: `${user.email} changed their password`,
    performedBy: user.id,
    userName: user.fullName,
    userRole: user.role,
    targetType: 'user',
    targetId: user.id,
  }).catch(() => undefined);
}
