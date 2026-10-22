import type { NextFunction, Request, Response } from 'express';

/**
 * A per-user cap on request volume, kept in this server's memory. It bounds
 * floods (each KYC upload is decoded and analysed before anything is stored);
 * the limits that must hold across servers and restarts are counted in the
 * database (see KYC_LIMITS in src/kyc/service.ts).
 */
export function perUserLimit(opts: { max: number; windowMs: number; key: (req: Request) => string | null; message: string }) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = opts.key(req);
    if (!key) return next();
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
    if (recent.length >= opts.max) {
      const retryAfter = Math.ceil((opts.windowMs - (now - recent[0])) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
      return res.status(429).json({ success: false, error: opts.message, code: 'RATE_LIMITED' });
    }
    recent.push(now);
    hits.set(key, recent);
    // Forget users who have gone quiet, so the map stays small.
    if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= opts.windowMs)) hits.delete(k);
    next();
  };
}
