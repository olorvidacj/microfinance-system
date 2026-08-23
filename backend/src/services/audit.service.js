import { supabase } from '../config/supabase.js';

/**
 * Audit logging (spec §16). Failures are logged but never block the
 * business response — audit is best-effort at the API layer; DB-level
 * triggers remain the guaranteed layer for financial tables.
 */
export async function audit({ actorId = null, action, entityType, entityId = null, before = null, after = null }) {
  try {
    const row = {
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: before,
      new_values: after,
    };
    const { error } = await supabase.from('audit_logs').insert(row);
    if (error) throw error;
  } catch (err) {
    console.error('[audit] failed to write audit log:', err?.message || err);
  }
}
