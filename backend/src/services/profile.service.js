import { supabase } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';

const PROFILE_COLUMNS =
  'id, email, full_name, phone, role, client_id, is_active, created_at, updated_at';

function toDbError(error, fallbackMessage) {
  if (!error) return new ApiError(500, fallbackMessage, 'DB_ERROR');
  const e = new Error(error.message || fallbackMessage);
  e.code = error.code;
  e.statusCode = 500;
  e.errorCode = 'DB_ERROR';
  return e;
}

export async function getProfileByUserId(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw toDbError(error, 'Failed to load profile');
  return data; // null when the auth user has no profile yet
}

export async function updateProfile(userId, patch) {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw toDbError(error, 'Failed to update profile');
  return data;
}
