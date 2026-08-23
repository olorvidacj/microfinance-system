import { supabase } from '../config/supabase.js';
import { CLIENT_STATUSES, KYC_STATUSES } from '../utils/constants.js';
import {
  conflict,
  forbidden,
  notFound,
  serviceUnavailable,
  unauthorized,
} from '../utils/ApiError.js';
import { getProfileByUserId, updateProfile } from './profile.service.js';
import { audit } from './audit.service.js';

function toAuthError(error) {
  const message = error?.message || 'Authentication failed';

  if (/already registered|already exists/i.test(message)) {
    return conflict('An account with this email already exists', 'EMAIL_ALREADY_REGISTERED');
  }
  if (/invalid login credentials/i.test(message)) {
    return unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (/email not confirmed/i.test(message)) {
    return unauthorized('Email address has not been confirmed', 'EMAIL_NOT_CONFIRMED');
  }
  return serviceUnavailable(`Authentication service error: ${message}`, 'AUTH_SERVICE_ERROR');
}

/**
 * Client self-registration:
 *  1. Reuse an existing walk-in client record matching this email (if any),
 *     otherwise create a new clients row (pending_verification / KYC pending).
 *  2. Create the Supabase auth user; trigger handle_new_user provisions profiles.
 *  3. Link profile -> clients row.
 */
export async function registerClient({ fullName, email, password, phone = null, clientCode = null }) {
  // ---- 1. Resolve or create the clients record --------------------------
  const selectFields = 'id, client_code, full_name, status, kyc_status';
  let existingClient = null;

  const byEmail = await supabase
    .from('clients')
    .select(selectFields)
    .ilike('email', email)
    .maybeSingle();
  if (byEmail.error) throw serviceUnavailable(`Database unavailable (${byEmail.error.message})`, 'DB_UNAVAILABLE');
  existingClient = byEmail.data;

  if (existingClient && clientCode && existingClient.client_code !== clientCode) {
    throw conflict(
      `This email is already registered under client code ${existingClient.client_code}`,
      'CLIENT_EMAIL_MISMATCH'
    );
  }

  if (!existingClient && clientCode) {
    const byCode = await supabase
      .from('clients')
      .select(selectFields)
      .eq('client_code', clientCode)
      .maybeSingle();
    if (byCode.error) throw serviceUnavailable(`Database unavailable (${byCode.error.message})`, 'DB_UNAVAILABLE');
    if (!byCode.data) throw notFound(`No client found for code ${clientCode}`, 'CLIENT_CODE_NOT_FOUND');
    existingClient = byCode.data;
  }

  let clientId;
  let client;

  if (existingClient) {
    const claimant = await supabase
      .from('profiles')
      .select('id')
      .eq('client_id', existingClient.id)
      .limit(1)
      .maybeSingle();
    if (claimant.error) {
      throw serviceUnavailable(`Database unavailable (${claimant.error.message})`, 'DB_UNAVAILABLE');
    }
    if (claimant.data) {
      throw conflict('This client record is already linked to an account', 'CLIENT_ALREADY_LINKED');
    }
    clientId = existingClient.id;
    client = existingClient;
  } else {
    const created = await supabase
      .from('clients')
      .insert({
        full_name: fullName,
        email,
        phone,
        status: CLIENT_STATUSES.PENDING_VERIFICATION,
        kyc_status: KYC_STATUSES.PENDING,
      })
      .select(selectFields)
      .single();
    if (created.error) {
      if (created.error.code === '23505') {
        throw conflict('A client with this email already exists', 'DUPLICATE_CLIENT_EMAIL');
      }
      throw serviceUnavailable(`Database unavailable (${created.error.message})`, 'DB_UNAVAILABLE');
    }
    clientId = created.data.id;
    client = created.data;
  }

  // ---- 2. Create the auth user (trigger auto-provisions profiles) -------
  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } },
  });
  if (signUp.error) throw toAuthError(signUp.error);

  const userId = signUp.data.user?.id;
  if (!userId) {
    throw serviceUnavailable('Signup succeeded but no user id returned', 'AUTH_NO_USER_ID');
  }

  // ---- 3. Link the provisioned profile to the client record -------------
  try {
    await updateProfile(userId, { client_id: clientId });
  } catch (err) {
    console.error('[auth] failed to link profile to client — needs manual fix:', {
      userId,
      clientId,
    });
    throw err;
  }

  const profile = await getProfileByUserId(userId);

  await audit({
    actorId: userId,
    action: 'AUTH_CLIENT_REGISTERED',
    entityType: 'clients',
    entityId: clientId,
    after: { client_code: client.client_code },
  });

  return {
    needsEmailVerification: !signUp.data.session,
    session: signUp.data.session ?? null,
    user: signUp.data.user,
    profile,
    client,
  };
}

export async function login({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw toAuthError(error);

  const profile = await getProfileByUserId(data.user.id);
  if (!profile) {
    throw unauthorized('Profile missing for authenticated user', 'PROFILE_NOT_FOUND');
  }
  if (!profile.is_active) {
    throw forbidden('Account has been deactivated.', 'ACCOUNT_DEACTIVATED');
  }
  return { session: data.session, user: data.user, profile };
}

export async function currentUser(userId) {
  return getProfileByUserId(userId);
}

export async function logout(accessToken) {
  // Revokes the refresh token server-side; access token dies naturally at expiry.
  const { error } = await supabase.auth.signOut(accessToken);
  if (error) throw toAuthError(error);
  return true;
}

export async function createStaffAccount(actorId, { email, password, fullName, role }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) {
    if (/already/i.test(error.message)) {
      throw conflict('An account with this email already exists', 'EMAIL_ALREADY_REGISTERED');
    }
    throw serviceUnavailable(`Failed to create staff user (${error.message})`, 'AUTH_SERVICE_ERROR');
  }

  const profile = await getProfileByUserId(data.user.id);

  await audit({
    actorId,
    action: 'AUTH_STAFF_CREATED',
    entityType: 'profiles',
    entityId: data.user.id,
    after: { email, role },
  });

  return { user: data.user, profile };
}

export async function setAccountStatus(actorId, targetUserId, isActive) {
  // Hard-block in GoTrue as well so banned users cannot refresh tokens.
  const banDuration = isActive ? 'none' : '876000h'; // ~100 years
  const banned = await supabase.auth.admin.updateUserById(targetUserId, {
    ban_duration: banDuration,
  });
  if (banned.error && !/user not found/i.test(banned.error.message ?? '')) {
    throw serviceUnavailable(
      `Failed to update auth user (${banned.error.message})`,
      'AUTH_SERVICE_ERROR'
    );
  }

  const profile = await updateProfile(targetUserId, { is_active: isActive });
  if (!profile) throw notFound('User not found', 'USER_NOT_FOUND');

  await audit({
    actorId,
    action: isActive ? 'AUTH_ACCOUNT_ENABLED' : 'AUTH_ACCOUNT_DISABLED',
    entityType: 'profiles',
    entityId: targetUserId,
    after: { is_active: isActive },
  });

  return profile;
}
