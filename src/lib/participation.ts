import { supabase } from './supabase'
import { generateRoleId } from './utils'
import type { Incident, IncidentParticipant } from './types'

/**
 * Shared participation helpers for the incident lists.
 *
 * Two rules live here:
 * 1. The creator always belongs to their incident. Creation inserts the IMT
 *    row, but older incidents (and any row lost later) predate that — when a
 *    list finds the viewing user is the creator with no Active row, it
 *    self-heals by inserting the missing IMT row once.
 * 2. "Checked in" is derived from check-in manifests, not the
 *    participant.checked_in flag alone. The flag flips only on manifest
 *    Submit (and its update can fail silently), while the Incident page
 *    banner counts any manifest — so the lists use the same definition as
 *    the banner: a manifest from this user exists (draft or submitted).
 *    The legacy flag is kept as an OR fallback, never the sole source.
 */

export function displayUserName(user: {
  user_metadata?: Record<string, unknown>
  email?: string | null
}): string {
  const first = user.user_metadata?.first_name
  const last = user.user_metadata?.last_name
  if (typeof first === 'string' && first) {
    return `${first} ${typeof last === 'string' ? last : ''}`.trim()
  }
  return user.email || ''
}

/** Insert the missing creator-IMT row for incidents this user created. */
export async function ensureCreatorParticipation(
  incidents: Incident[],
  userId: string,
  userName: string,
  userEmail: string,
): Promise<void> {
  const created = incidents.filter(i => i.created_by === userId)
  if (created.length === 0) return
  const ids = created.map(i => i.incident_id)
  const { data: existing } = await supabase
    .from('incident_participants')
    .select('incident_id')
    .in('incident_id', ids)
    .eq('user_id', userId)
    .eq('status', 'Active')
  const have = new Set((existing ?? []).map(r => r.incident_id as string))
  const missing = created.filter(i => !have.has(i.incident_id))
  if (missing.length === 0) return
  // Best-effort repair: a failure here just leaves the lists as they were —
  // the creator can still join manually, and the next visit retries.
  await supabase.from('incident_participants').insert(
    missing.map(i => ({
      incident_id: i.incident_id,
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      role: 'IMT',
      role_id: generateRoleId('IMT'),
      status: 'Active',
    })),
  )
}

export interface Participation {
  participants: Map<string, IncidentParticipant>
  /** Incident ids where this user has a check-in manifest (any status). */
  checkedIn: Set<string>
}

/** Active participant rows + manifest-derived check-in state for one user. */
export async function fetchParticipation(
  incidentIds: string[],
  userId: string,
): Promise<Participation> {
  const participants = new Map<string, IncidentParticipant>()
  const checkedIn = new Set<string>()
  if (incidentIds.length === 0 || !userId) return { participants, checkedIn }

  const [{ data: partRows }, { data: manifestRows }] = await Promise.all([
    supabase
      .from('incident_participants')
      .select('*')
      .in('incident_id', incidentIds)
      .eq('user_id', userId)
      .eq('status', 'Active'),
    supabase
      .from('checkin_manifests')
      .select('incident_id')
      .in('incident_id', incidentIds)
      .eq('user_id', userId),
  ])

  for (const p of partRows ?? []) participants.set(p.incident_id, p as IncidentParticipant)
  for (const m of manifestRows ?? []) checkedIn.add(m.incident_id as string)
  return { participants, checkedIn }
}

/** Checked in by manifest, or by the legacy submitted flag as fallback. */
export function isCheckedIn(
  participation: Participation,
  incidentId: string,
): boolean {
  if (participation.checkedIn.has(incidentId)) return true
  return participation.participants.get(incidentId)?.checked_in === true
}
