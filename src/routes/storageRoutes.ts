import { Router } from 'express';
import { resolveUploadPath, verifyUploadToken } from '../db/localFiles';

/**
 * /api/storage: files from the local store, through signed expiring links only
 * (src/db/localFiles.ts). The token is the authorization, exactly like a
 * Supabase signed URL; the route that hands it out has already checked branch
 * scope or ownership. Raw paths, including old /api/storage/<path> links, are
 * refused: stored rows with such a link are re-signed by documentFileLink.
 *
 *   no token                -> 401
 *   forged or expired token -> 403
 *   path outside uploads/, under kyc/, or missing -> 404
 */
export const storageRouter = Router();

storageRouter.get('/:token', (req, res) => {
  const check = verifyUploadToken(req.params.token);
  if ('refused' in check) {
    return res.status(403).json({ error: check.refused === 'EXPIRED' ? 'This link has expired. Open the document again.' : 'This link is not valid.' });
  }
  const full = resolveUploadPath(check.path);
  if (!full) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(full, { dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'File not found' });
  });
});

// Anything else (no token, or a raw file path) needs a signed link.
storageRouter.use((_req, res) => {
  res.status(401).json({ error: 'A signed link is required to open this file.' });
});
