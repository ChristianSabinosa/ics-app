import { supabase } from './supabase'

export interface LeaveResult {
  /** true when the incident (and all of its data) was removed */
  deleted: boolean
  /** non-null when something went wrong; the leave itself may still have been recorded */
  error: string | null
}

/**
 * Incident-scoped tables — used only by the client-side fallback path, when the
 * delete_incident() SQL function (supabase-leave-schema.sql) has not been installed yet.
 * Tables whose rows belong to a form are handled by their `on delete cascade` FKs
 * (ics_204_rows, ics_211_resources, ics_207_positions, ...), so listing the parents is enough.
 * Best effort: rows blocked by an RLS delete policy are silently skipped.
 */
const INCIDENT_SCOPED_TABLES = [
  'incident_iap',
  'incident_maps',
  'ics_204_forms',
  'ics_211_forms',
  'ics_207_forms',
  'ics_201_forms',
  'ics_202_forms',
  'ics_203_forms',
  'ics_205_forms',
  'ics_206_forms',
  'ics_208_forms',
  'ics_209_forms',
  'ics_213_forms',
  'ics_214_forms',
  'ics_215_forms',
  'ics_215a_forms',
  'ics_221_forms',
  'checkin_manifests',
  'incident_participants',
]

/**
 * Hard-deletes an incident and everything attached to it.
 * Returns null on success, or an error message (with a fix hint) on failure.
 */
export async function deleteIncidentData(incidentId: string): Promise<string | null> {
  // Preferred path: the SECURITY DEFINER SQL function sweeps every foreign key server-side.
  const { error: rpcError } = await supabase.rpc('delete_incident', { p_incident_id: incidentId })
  if (!rpcError) return null

  // Fallback: best-effort client sweep, then the incident row itself.
  for (const table of INCIDENT_SCOPED_TABLES) {
    await supabase.from(table).delete().eq('incident_id', incidentId)
  }

  const { error } = await supabase.from('incidents').delete().eq('incident_id', incidentId)
  if (error) {
    return `The incident could not be deleted (${error.message}). Run supabase-leave-schema.sql in the Supabase SQL Editor to install full deletion, then try again.`
  }
  return null
}

/**
 * Finishes a leave.
 *  - If at least one IMT member stays Active, only this participant is marked Left.
 *  - When no IMT member remains (Tactical Resources / Observers only, or nobody left),
 *    the incident and all of its data are hard-deleted.
 */
export async function completeLeave(incidentId: string, participantId: string): Promise<LeaveResult> {
  const { data: others, error: readError } = await supabase
    .from('incident_participants')
    .select('id, role')
    .eq('incident_id', incidentId)
    .eq('status', 'Active')
    .neq('id', participantId)

  if (readError) return { deleted: false, error: readError.message }

  const imtRemains = (others ?? []).some((p) => p.role === 'IMT')

  if (imtRemains) {
    const { error } = await supabase
      .from('incident_participants')
      .update({ status: 'Left', left_at: new Date().toISOString() })
      .eq('id', participantId)
    return { deleted: false, error: error?.message ?? null }
  }

  const deleteError = await deleteIncidentData(incidentId)
  if (!deleteError) return { deleted: true, error: null }

  // Deletion failed — still record the leave so the user is not stuck in the incident.
  await supabase
    .from('incident_participants')
    .update({ status: 'Left', left_at: new Date().toISOString() })
    .eq('id', participantId)
  return { deleted: false, error: deleteError }
}
