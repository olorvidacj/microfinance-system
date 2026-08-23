import * as authService from '../services/auth.service.js';
import { ok } from '../utils/respond.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { unauthorized } from '../utils/ApiError.js';

export const clientSignup = asyncHandler(async (req, res) => {
  const result = await authService.registerClient(req.body);
  return ok(res, result, 201);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ok(res, {
    accessToken: result.session.access_token,
    refreshToken: result.session.refresh_token,
    expiresAt: result.session.expires_at,
    user: {
      id: result.user.id,
      email: result.user.email,
      role: result.profile.role,
      fullName: result.profile.full_name,
      clientId: result.profile.client_id,
    },
  });
});

export const me = asyncHandler(async (req, res) => {
  // req.user was attached by authenticate middleware (already fresh).
  return ok(res, { profile: req.user, authUser: req.authUser });
});

export const logout = asyncHandler(async (req, res) => {
  const header = req.headers.authorization || '';
  const token = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1];
  if (!token) throw unauthorized('Missing bearer token', 'AUTH_TOKEN_MISSING');

  await authService.logout(token);
  return ok(res, { loggedOut: true });
});

export const createStaff = asyncHandler(async (req, res) => {
  const result = await authService.createStaffAccount(req.user.id, req.body);
  return ok(
    res,
    {
      userId: result.user.id,
      email: result.user.email,
      role: result.profile.role,
      fullName: result.profile.full_name,
    },
    201
  );
});

export const setStaffStatus = asyncHandler(async (req, res) => {
  const profile = await authService.setAccountStatus(
    req.user.id,
    req.params.userId,
    req.body.isActive
  );
  return ok(res, profile);
});
