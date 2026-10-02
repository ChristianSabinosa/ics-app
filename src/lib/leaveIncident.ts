import { supabase } from './supabase'

export interface LeaveResult {
  /** non-null when something went wrong; the leave itself may still have been recorded */
  error: string | null
}

/**
 * Incident-scoped tables — REMOVED on purpose.
 *
 * The old client-side fallback looped a list of tables deleting
 * `incident_id = ...` before touching the incidents row. It could never finish
 * the job (incident_participants has no RLS delete policy, so those rows were
 * silently skipped and the final delete hit a foreign key), but it DID delete
 * whatever tables happened to have a permissive delete policy first — ics_211_
 * and ics_221_forms among them. In other words it destroyed part of an incident
 * and then failed, leaving the rest behind.
 *
 * There is no fallback now: delete_incident() is the only path, and when it is
 * missing we say so without touching a single row.
 */

/**
 * Hard-deletes an incident and everything attached to it.
 * Returns null on success, or an error message on failure.
 *
 * Entirely delegated to the delete_incident() SQL function: it is SECURITY
 * DEFINER, so it can reach the tables that have no delete policy at all and it
 * walks the foreign key catalog for us. Every branch below leaves the incident
 * untouched when it does not succeed.
 *
 * Only the incident's creator gets through — the check lives inside the
 * function itself, because SECURITY DEFINER bypasses RLS.
 */
export async function deleteIncidentData(incidentId: string): Promise<string | null> {
  const { error } = await supabase.rpc('delete_incident', { p_incident_id: incidentId })
  if (!error) return null

  // Always keep the server's own words: supabase-js throws away the response
  // body in the console, so this is the only place PGRST202/PGRST205 survive.
  const msg = error.message || String(error)

  if (msg.includes('only the creator')) return 'Only the creator of this incident can delete it.'
  if (msg.includes('incident not found')) return 'This incident no longer exists.'

  if (/could not find the function|does not exist/i.test(msg)) {
    return `Full deletion is not installed, or PostgREST has not reloaded its schema cache. Server said: "${msg}"`
  }

  return `The incident could not be deleted: ${msg}`
}

/**
 * How many Active IMT members exist besides `excludeParticipantId`.
 *
 * Returns null when the roster could not be read, so callers can fail safe —
 * null means "unknown", never "nobody left".
 *
 * Drives the demob gate on Ongoing Incidents: the creator cannot wipe an
 * incident while other IMTs are still working in it, so those members are
 * notified to finish their check-out first.
 */
export async function countOtherActiveImts(
  incidentId: string,
  excludeParticipantId?: string | null,
): Promise<number | null> {
  let query = supabase
    .from('incident_participants')
    .select('id')
    .eq('incident_id', incidentId)
    .eq('status', 'Active')
    .eq('role', 'IMT')
  if (excludeParticipantId) query = query.neq('id', excludeParticipantId)

  const { data, error } = await query
  if (error) return null
  return (data ?? []).length
}

/**
 * Finishes a leave: this participant is marked Left.
 *
 * The incident itself is never removed here. Deletion belongs exclusively to
 * the incident's creator (Ongoing Incidents -> deleteIncidentData), so losing
 * the last IMT member just leaves an incident that still has an owner to
 * dispose of it.
 */
export async function completeLeave(participantId: string): Promise<LeaveResult> {
  const { error } = await supabase
    .from('incident_participants')
    .update({ status: 'Left', left_at: new Date().toISOString() })
    .eq('id', participantId)
  return { error: error?.message ?? null }
}
