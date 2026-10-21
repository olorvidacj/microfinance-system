import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { getDb, schema } from '../db/index';
import { eq, desc, and } from 'drizzle-orm';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../auth/index';
import { getServerSupabase } from '../db/supabaseServer';
import { supabaseGetUser, supabaseSendEmailOtp, supabaseVerifyEmailOtp, ensureLocalClientUser } from '../auth/supabaseAuth';
import { authStore } from '../auth/index';
import { normalizeRole } from '../auth/permissions';
import { isPasswordStrong, STRONG_PASSWORD_ERROR_MESSAGE } from '../utils/passwordValidator';
import type { AppDb } from '../kyc/errors';
import { sendError } from './httpErrors';
import { handleSendEmailCode, handleVerifyEmailCode } from '../onboarding/http';
import { HttpError } from '../kyc/errors';
import { manilaToday } from '../kyc/service';
import { productToDto, quoteToDto, validateLoanTerms } from '../../shared/lending';
import { cancelApplication, clientLoans, createApplication, listProducts, loanDetail, quoteFor, submitApplication, type LendingClient } from '../lending/service';
import { clientProofs, loanPayments, payoffQuote, receiptFor, submitProof } from '../lending/repayment';
import { storeLoanDocuments } from '../lending/documents';
import { cancelWithdrawalRequest, listAccounts, requestWithdrawal, statement, withdrawalRequests } from '../savings/service';
import { myGroup, recordConsent } from '../groups/service';
import { changePassword, setPassword } from '../auth/passwords';
import { clientDashboard } from '../client/dashboard';
import { ownProfile, updateOwnProfile } from '../client/profile';
import { clientDocumentLink, clientDocuments } from '../client/documents';
import { clientNotifications, markAllNotificationsRead, markNotificationRead } from '../client/notifications';
import { SUPPORT_FAQS, sendSupportRequest, supportContact, supportRequests } from '../client/support';
import { clientTransaction, clientTransactions } from '../client/transactions';
import type { SignInView } from '../../shared/client';


export interface AuthedRequest extends Request {
  authUser?: {
    id: string;
    role: 'STAFF' | 'CLIENT';
    staffRole?: string | null;
    staffId?: string | null;
    borrowerId?: string | null;
    email: string;
    fullName?: string | null;
    phone?: string | null;
    avatar?: string | null;
  };
}

function requireAuth(roles?: Array<'STAFF' | 'CLIENT'>) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    let auth = req.authUser;

    if (!auth) {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (token) {
        const payload = verifyToken(token);
        if (payload) {
          auth = {
            id: payload.sub,
            role: payload.role,
            staffRole: payload.staffRole || null,
            staffId: payload.staffId || null,
            borrowerId: payload.borrowerId || null,
            email: payload.email,
            fullName: payload.fullName || null,
          };
        } else {
          try {
            const sbUser = await supabaseGetUser(token);
            if (sbUser) {
              const email = String(sbUser.email || sbUser.user_metadata?.email || '').toLowerCase();
              let record = await authStore.findById(sbUser.id);
              if (!record && email) {
                record = await authStore.findByEmailOrPhone(email);
              }
              if (!record || (record.role === 'CLIENT' && !record.borrowerId)) {
                try {
                  record = await ensureLocalClientUser({
                    id: sbUser.id,
                    email,
                    fullName: String(sbUser.user_metadata?.full_name || email.split('@')[0] || 'User'),
                    phone: sbUser.user_metadata?.phone || sbUser.phone || null,
                  });
                } catch {}
              }
              if (record && record.isActive !== false) {
                auth = {
                  id: record.id,
                  role: record.role as 'STAFF' | 'CLIENT',
                  staffRole: record.staffRole || null,
                  staffId: record.staffId || null,
                  borrowerId: record.borrowerId || null,
                  email: record.email,
                  fullName: record.fullName,
                  phone: record.phone || null,
                };
              } else if (sbUser) {
                auth = {
                  id: sbUser.id,
                  role: 'CLIENT',
                  staffRole: null,
                  staffId: null,
                  borrowerId: null,
                  email,
                  fullName: String(sbUser.user_metadata?.full_name || email.split('@')[0] || 'User'),
                  phone: sbUser.user_metadata?.phone || sbUser.phone || null,
                };
              }
            }
          } catch {}
        }
      }
    }

    req.authUser = auth;

    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    // The member link comes only from users.borrower_id, which registration sets.
    // It is never guessed from contact details: registration does not prove
    // ownership of a phone number.
    if (req.authUser.role === 'CLIENT' && !req.authUser.borrowerId) {
      const db = getDb();
      if (db) {
        const userRows = await db.select().from(schema.users).where(eq(schema.users.id, req.authUser.id)).limit(1);
        if (userRows[0]?.borrowerId) req.authUser.borrowerId = userRows[0].borrowerId;
      }
      if (!req.authUser.borrowerId) {
        req.authUser.borrowerId = req.authUser.id;
      }
    }

    if (roles && roles.length > 0 && !roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: 'Access forbidden: Insufficient role permissions.' });
    }
    next();
  };
}

export const clientMobileRouter = Router();

// -------------------------------------------------------------
// 1. Mobile Authentication & OTP Verification
// -------------------------------------------------------------

// Registration email codes: same service as /api/auth/email-code (src/onboarding).
clientMobileRouter.post('/auth/send-registration-otp', handleSendEmailCode);
clientMobileRouter.post('/auth/verify-registration-otp', handleVerifyEmailCode);

// Forgot password - Send 6-digit OTP via Supabase
clientMobileRouter.post('/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }
    const normEmail = String(email).trim().toLowerCase();
    await supabaseSendEmailOtp(normEmail);

    console.log(`[Mobile Auth] Supabase password reset OTP sent to ${normEmail}`);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normEmail}. Please check your Gmail inbox.`,
      expiresInMinutes: 15,
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Verify OTP
clientMobileRouter.post('/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and 6-digit OTP code are required' });
    }
    const normEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim().replace(/\D/g, '');

    await supabaseVerifyEmailOtp(normEmail, cleanOtp);

    res.json({
      success: true,
      message: 'Email verified successfully with Supabase. You may now set your new password.',
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message || 'Invalid or expired verification code.' });
  }
});

// Reset Password with verified OTP
clientMobileRouter.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, OTP, and new password are required' });
    }
    if (!isPasswordStrong(String(newPassword))) {
      return res.status(400).json({ success: false, error: STRONG_PASSWORD_ERROR_MESSAGE });
    }

    const normEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim().replace(/\D/g, '');

    await supabaseVerifyEmailOtp(normEmail, cleanOtp);

    // Both credential stores change together (src/auth/passwords.ts); updating
    // only the local hash left the old password working through Supabase Auth.
    const db = getDb();
    if (db) {
      const [user] = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(eq(schema.users.email, normEmail)).limit(1);
      if (user) await setPassword(db as unknown as AppDb, user, String(newPassword));
    }

    res.json({
      success: true,
      message: 'Your password has been successfully reset. Please log in with your new credentials.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Change password (signed in): the current password is required; the new one
// must pass the shared strength rules (shared/auth/password.ts).
clientMobileRouter.post('/auth/change-password', requireAuth(), async (req: AuthedRequest, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
  try {
    await changePassword(db as unknown as AppDb, String(req.authUser?.id), req.body || {});
    res.json({ success: true, message: 'Your password has been changed.' });
  } catch (err) {
    sendError(res, err, 'client-change-password');
  }
});

// Secure Logout
clientMobileRouter.post('/auth/logout', requireAuth(), (req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out securely' });
});

// -------------------------------------------------------------
// 2. Client Dashboard
// -------------------------------------------------------------
clientMobileRouter.get('/dashboard', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-dashboard', async (db) => {
    res.json({ success: true, data: await clientDashboard(db, lendingClientOf(req)) });
  }),
);

// -------------------------------------------------------------
// 3. Client Profile & Allowed Edits & KYC Verification
// -------------------------------------------------------------
clientMobileRouter.get('/profile', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-profile', async (db) => {
    res.json({ success: true, profile: await ownProfile(db, lendingClientOf(req)) });
  }),
);

// Edit profile: contact and work details only; identity fields come from KYC.
clientMobileRouter.patch('/profile', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-profile-update', async (db) => {
    await updateOwnProfile(db, lendingClientOf(req), req.body || {});
    res.json({ success: true, message: 'Your details were saved.' });
  }),
);

// Upload/Update Profile Picture
clientMobileRouter.post('/upload-avatar', requireAuth(), async (req: AuthedRequest, res: Response) => {
  try {
    const { avatarUrl } = req.body;
    const value = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
    if (!/^(https:\/\/|data:image\/(png|jpe?g|webp);base64,)/i.test(value) || value.length > 2_000_000) {
      return res.status(400).json({ success: false, error: 'Upload a PNG, JPEG or WebP image (or an https link to one).' });
    }

    const db = getDb();
    if (db && req.authUser?.id) {
      await db.update(schema.users).set({ avatar: value }).where(eq(schema.users.id, req.authUser.id));
    }

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      avatarUrl,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 4. Loan products, calculator and applications (src/lending/service.ts)
// -------------------------------------------------------------

function lendingClientOf(req: AuthedRequest): LendingClient {
  if (req.authUser?.role !== 'CLIENT') throw new HttpError(403, 'Sign in with a member account.', 'CLIENT_ONLY');
  const borrowerId = req.authUser?.borrowerId ? String(req.authUser.borrowerId) : '';
  if (!borrowerId) throw new HttpError(403, 'This sign-in is not linked to a member profile.', 'NO_MEMBER');
  return { kind: 'client', userId: String(req.authUser?.id), name: String(req.authUser?.fullName || 'Member'), borrowerId };
}

clientMobileRouter.get('/loan-products', async (_req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
  try {
    const products = await listProducts(db as unknown as AppDb);
    res.json({ success: true, products: products.map(productToDto) });
  } catch (err) {
    sendError(res, err, 'client-loan-products');
  }
});

// Server-side quote for clients that cannot run shared/lending (the portal computes it locally).
clientMobileRouter.post('/calculate-loan', async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
  try {
    const { productId, amount, termMonths } = req.body || {};
    const product = (await listProducts(db as unknown as AppDb)).find((p) => p.id === String(productId ?? ''));
    if (!product) return res.status(404).json({ success: false, error: 'Choose an available loan product.' });
    const terms = validateLoanTerms(product, amount, termMonths);
    if (!terms.ok || !terms.value) return res.status(400).json({ success: false, error: 'Check the amount and term.', fields: terms.errors });
    const q = quoteFor(product, terms.value.principal, terms.value.termMonths, manilaToday());
    res.json({ success: true, quote: quoteToDto(q) });
  } catch (err) {
    sendError(res, err, 'client-calculate-loan');
  }
});

clientMobileRouter.post('/apply-loan', requireAuth(), async (req: AuthedRequest, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
  try {
    const actor = lendingClientOf(req);
    const body = req.body || {};
    const documents = await storeLoanDocuments(actor.borrowerId, body.documents);
    const result = await createApplication(
      db as unknown as AppDb,
      actor,
      { ...body, borrowerId: undefined, requestKey: req.get('Idempotency-Key') || body.requestKey },
      documents,
    );
    res.status(result.replayed ? 200 : 201).json({ success: true, replayed: result.replayed, application: result.loan });
  } catch (err) {
    sendError(res, err, 'client-apply-loan');
  }
});

async function sendClientLoans(req: AuthedRequest, res: Response) {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
  try {
    const actor = lendingClientOf(req);
    const loans = await clientLoans(db as unknown as AppDb, actor.borrowerId);
    res.json({ success: true, ...loans });
  } catch (err) {
    sendError(res, err, 'client-loans');
  }
}

clientMobileRouter.get('/loans', requireAuth(), sendClientLoans);
clientMobileRouter.get('/loan-applications', requireAuth(), sendClientLoans);

clientMobileRouter.get('/loans/:loanId', requireAuth(), async (req: AuthedRequest, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
  try {
    const actor = lendingClientOf(req);
    const loan = await loanDetail(db as unknown as AppDb, actor, req.params.loanId);
    const payments = await db
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.loanId, loan.id), eq(schema.payments.borrowerId, actor.borrowerId)))
      .orderBy(desc(schema.payments.paymentDate));
    res.json({ success: true, loan, payments });
  } catch (err) {
    sendError(res, err, 'client-loan-detail');
  }
});

clientMobileRouter.get('/loans/:loanId/schedule', requireAuth(), async (req: AuthedRequest, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
  try {
    const loan = await loanDetail(db as unknown as AppDb, lendingClientOf(req), req.params.loanId);
    res.json({ success: true, loanId: loan.id, scheduleKind: loan.scheduleKind, schedule: loan.schedule });
  } catch (err) {
    sendError(res, err, 'client-loan-schedule');
  }
});

clientMobileRouter.post('/loans/:loanId/submit', requireAuth(), async (req: AuthedRequest, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
  try {
    const loan = await submitApplication(db as unknown as AppDb, lendingClientOf(req), req.params.loanId, req.body || {});
    res.json({ success: true, loan });
  } catch (err) {
    sendError(res, err, 'client-loan-submit');
  }
});

clientMobileRouter.post('/loans/:loanId/cancel', requireAuth(), async (req: AuthedRequest, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
  try {
    const loan = await cancelApplication(db as unknown as AppDb, lendingClientOf(req), req.params.loanId, (req.body || {}).reason);
    res.json({ success: true, loan });
  } catch (err) {
    sendError(res, err, 'client-loan-cancel');
  }
});

// -------------------------------------------------------------
// 6. Payments, receipts and payment proofs (src/lending/repayment.ts)
//
// A member never posts a payment. They upload proof of a bank or e-wallet
// transfer; staff verify it, and only then is the payment posted.
// -------------------------------------------------------------

async function clientRoute(res: Response, context: string, run: (db: AppDb) => Promise<unknown>) {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, error: 'The database is not available right now.' });
  try {
    return await run(db as unknown as AppDb);
  } catch (err) {
    sendError(res, err, context);
  }
}

clientMobileRouter.get('/loans/:loanId/payments', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-loan-payments', async (db) => {
    const actor = lendingClientOf(req);
    await loanDetail(db, actor, req.params.loanId);
    res.json({ success: true, payments: await loanPayments(db, req.params.loanId) });
  }),
);

clientMobileRouter.get('/loans/:loanId/payoff', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-payoff', async (db) => {
    res.json({ success: true, payoff: await payoffQuote(db, lendingClientOf(req), req.params.loanId) });
  }),
);

clientMobileRouter.get('/payments', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-payments', async (db) => {
    const actor = lendingClientOf(req);
    const loans = await db.select({ id: schema.loans.id }).from(schema.loans).where(eq(schema.loans.borrowerId, actor.borrowerId));
    const payments = (await Promise.all(loans.map((l) => loanPayments(db, l.id)))).flat().sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    res.json({ success: true, payments });
  }),
);

clientMobileRouter.get('/payments/:paymentId/receipt', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-receipt', async (db) => {
    res.json({ success: true, receipt: await receiptFor(db, lendingClientOf(req), req.params.paymentId) });
  }),
);

clientMobileRouter.post('/submit-payment-proof', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-submit-proof', async (db) => {
    const body = req.body || {};
    const proof = await submitProof(db, lendingClientOf(req), {
      loanId: body.loanId,
      amount: body.amount,
      method: body.method ?? body.paymentMethod,
      referenceNumber: body.referenceNumber,
      paymentDate: body.paymentDate,
      notes: body.notes,
      fileBase64: body.fileBase64 ?? body.receiptProofBase64,
      fileName: body.fileName ?? body.receiptProofName,
    });
    res.status(201).json({ success: true, proof });
  }),
);

clientMobileRouter.get('/payment-proofs', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-proofs', async (db) => {
    const proofs = (await clientProofs(db, lendingClientOf(req).borrowerId)).map((p) => ({ ...p, storageRef: undefined }));
    res.json({ success: true, proofs });
  }),
);



// -------------------------------------------------------------
// 7. Client Notifications
// -------------------------------------------------------------
clientMobileRouter.get('/notifications', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-notifications', async (db) => {
    res.json({ success: true, ...(await clientNotifications(db, lendingClientOf(req))) });
  }),
);

clientMobileRouter.patch('/notifications/:id/read', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-notification-read', async (db) => {
    await markNotificationRead(db, lendingClientOf(req), req.params.id);
    res.json({ success: true, message: 'Notification marked as read' });
  }),
);

clientMobileRouter.post('/notifications/mark-all-read', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-notifications-read-all', async (db) => {
    await markAllNotificationsRead(db, lendingClientOf(req));
    res.json({ success: true, message: 'All notifications marked as read' });
  }),
);

// -------------------------------------------------------------
// 8. Client Savings (src/savings/service.ts)
// A member sees their own accounts and statements and files withdrawal
// requests; money only moves when branch staff approve the request.
// -------------------------------------------------------------
clientMobileRouter.get('/savings', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-savings', async (db) => {
    res.json({ success: true, accounts: await listAccounts(db, lendingClientOf(req)) });
  }),
);

clientMobileRouter.get('/savings/withdrawal-requests', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-savings-requests', async (db) => {
    res.json({ success: true, requests: await withdrawalRequests(db, lendingClientOf(req), 'ALL') });
  }),
);

clientMobileRouter.post('/savings/withdrawal-requests/:id/cancel', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-savings-request-cancel', async (db) => {
    res.json({ success: true, request: await cancelWithdrawalRequest(db, lendingClientOf(req), req.params.id) });
  }),
);

clientMobileRouter.get('/savings/:accountId/statement', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-savings-statement', async (db) => {
    const range = { from: req.query.from ? String(req.query.from) : undefined, to: req.query.to ? String(req.query.to) : undefined };
    res.json({ success: true, statement: await statement(db, lendingClientOf(req), req.params.accountId, range) });
  }),
);

clientMobileRouter.post('/savings/withdraw', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-savings-withdraw', async (db) => {
    const request = await requestWithdrawal(db, lendingClientOf(req), req.body || {});
    res.status(201).json({ success: true, request });
  }),
);

// -------------------------------------------------------------
// 9. Client Financial Transactions (History)
// -------------------------------------------------------------
clientMobileRouter.get('/transactions', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-transactions', async (db) => {
    const q = req.query;
    res.json({ success: true, transactions: await clientTransactions(db, lendingClientOf(req), { kind: q.kind, search: q.search, from: q.from }) });
  }),
);

clientMobileRouter.get('/transactions/:id', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-transaction', async (db) => {
    res.json({ success: true, transaction: await clientTransaction(db, lendingClientOf(req), req.params.id) });
  }),
);

// -------------------------------------------------------------
// 10. Client Group Lending (src/groups/service.ts)
// A member sees their group (names and roles, not others' balances), what
// they owe the solidarity fund, and the group loans waiting for their consent.
// -------------------------------------------------------------
clientMobileRouter.get('/groups/my', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-my-group', async (db) => {
    res.json({ success: true, group: await myGroup(db, lendingClientOf(req)) });
  }),
);

clientMobileRouter.post('/groups/loans/:loanId/consent', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-group-consent', async (db) => {
    const body = req.body || {};
    await recordConsent(db, lendingClientOf(req), req.params.loanId, { decision: body.decision, note: body.note });
    res.json({ success: true, group: await myGroup(db, lendingClientOf(req)) });
  }),
);

// -------------------------------------------------------------
// 11. Client Documents
// -------------------------------------------------------------
clientMobileRouter.get('/documents', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-documents', async (db) => {
    res.json({ success: true, documents: await clientDocuments(db, lendingClientOf(req)) });
  }),
);

clientMobileRouter.get('/documents/:id/file', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-document-file', async (db) => {
    res.json({ success: true, ...(await clientDocumentLink(db, lendingClientOf(req), req.params.id)) });
  }),
);

// -------------------------------------------------------------
/// 12. Client Settings
// -------------------------------------------------------------
// Recent sign-ins come from the audit log (every login writes a LOGIN row).
// Notification and privacy preferences were removed: they were fixed values
// that were never stored or acted on.
clientMobileRouter.get('/settings/sessions', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-sessions', async (db) => {
    const userId = String(req.authUser?.id || '');
    const rows = await db
      .select({ id: schema.auditLogs.id, timestamp: schema.auditLogs.timestamp })
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, 'LOGIN'), eq(schema.auditLogs.performedBy, userId)))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(10);
    const sessions: SignInView[] = rows.map((r) => ({ id: r.id, time: r.timestamp }));
    res.json({ success: true, sessions });
  }),
);

// -------------------------------------------------------------
// 13. Client Help & Support
// -------------------------------------------------------------
clientMobileRouter.get('/support/faqs', requireAuth(), (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, faqs: SUPPORT_FAQS });
});

// The member's own branch: who answers their messages and how to reach it.
clientMobileRouter.get('/support/contact', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-support-contact', async (db) => {
    res.json({ success: true, contact: await supportContact(db, lendingClientOf(req)) });
  }),
);

clientMobileRouter.get('/support/tickets', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-support-list', async (db) => {
    res.json({ success: true, tickets: await supportRequests(db, lendingClientOf(req)) });
  }),
);

// A message to the member's branch (delivered as a staff notification).
clientMobileRouter.post('/support/submit', requireAuth(), (req: AuthedRequest, res: Response) =>
  clientRoute(res, 'client-support-send', async (db) => {
    res.status(201).json({ success: true, ticket: await sendSupportRequest(db, lendingClientOf(req), req.body || {}) });
  }),
);
