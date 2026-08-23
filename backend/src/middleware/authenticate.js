import { supabase } from '../config/supabase.js';
import { getProfileByUserId } from '../services/profile.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError, forbidden, serviceUnavailable, unauthorized } from '../utils/ApiError.js';

function extractBearerToken(headerValue) {
  if (!headerValue) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match ? match[1].trim() : null;
}

/**
 * Verifies the Supabase access token and loads the caller's profile.
 * Attaches:
 *   req.authUser = { id, email }        (auth.users identity)
 *   req.user     = profiles row         (role, client_id, is_active)
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) throw unauthorized('Missing bearer token', 'AUTH_TOKEN_MISSING');

  let authUser;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw unauthorized('Invalid or expired token', 'AUTH_TOKEN_INVALID');
    }
    authUser = data.user;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw serviceUnavailable(
      'Authentication service unreachable',
      'AUTH_SERVICE_UNAVAILABLE'
    );
  }

  const profile = await getProfileByUserId(authUser.id);
  if (!profile) throw forbidden('Profile not found. Contact an administrator.', 'PROFILE_NOT_FOUND');
  if (!profile.is_active) {
    throw forbidden('Account has been deactivated.', 'ACCOUNT_DEACTIVATED');
  }

  req.authUser = { id: authUser.id, email: authUser.email };
  req.user = profile;
  next();
});
