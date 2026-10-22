import type { Response } from 'express';
import { HttpError } from '../kyc/errors';

/**
 * Sends a refusal from the KYC/onboarding services as JSON. Unexpected errors
 * are logged and answered with a generic 500 so internals are not leaked.
 */
export function sendError(res: Response, err: unknown, context: string): void {
  if (err instanceof HttpError) {
    const details = err.details && typeof err.details === 'object' ? err.details : {};
    res.status(err.status).json({ success: false, error: err.message, code: err.code, ...details });
    return;
  }
  const status = Number((err as any)?.status);
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    res.status(status).json({ success: false, error: (err as any)?.message || 'Request refused.', code: (err as any)?.code });
    return;
  }
  console.error(`[${context}]`, err);
  res.status(500).json({ success: false, error: 'Something went wrong on our side. Please try again.' });
}
