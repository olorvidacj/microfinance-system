import type { Request, Response } from 'express';
import { getDb } from '../db/index';
import { HttpError, type AppDb } from '../kyc/errors';
import { sendOtpEmail } from '../services/emailService';
import { sendError } from '../routes/httpErrors';
import { requestEmailCode, verifyEmailCode, type CodeMailer } from './emailVerification';

export const registrationMailer: CodeMailer = {
  async sendCode(to, code) {
    const result = await sendOtpEmail({ to, code, purpose: 'registration' });
    return result.sent;
  },
};

export function onboardingDb(): AppDb {
  const db = getDb();
  if (!db) throw new HttpError(503, 'The database is not available right now.', 'DB_UNAVAILABLE');
  return db as unknown as AppDb;
}

/** POST { email } -> sends a one-time registration code. */
export async function handleSendEmailCode(req: Request, res: Response) {
  try {
    const result = await requestEmailCode(onboardingDb(), req.body?.email, registrationMailer);
    res.json({
      success: true,
      email: result.email,
      expiresInSeconds: result.expiresInSeconds,
      message: `We sent a 6-digit code to ${result.email}. It expires in ${Math.round(result.expiresInSeconds / 60)} minutes.`,
    });
  } catch (err) {
    sendError(res, err, 'email-code');
  }
}

/** POST { email, code | otp } -> { verificationToken } for registration. */
export async function handleVerifyEmailCode(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const result = await verifyEmailCode(onboardingDb(), body.email, body.code ?? body.otp);
    res.json({ success: true, verified: true, email: result.email, verificationToken: result.verificationToken, expiresInSeconds: result.expiresInSeconds });
  } catch (err) {
    sendError(res, err, 'email-code-verify');
  }
}
