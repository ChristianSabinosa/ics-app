/**
 * Training Mode data access.
 *
 * A training is a top-level entity (see supabase-training-schema.sql). Every
 * group owns a CHILD incident row (`incidents.type = 'Training'`,
 * `incidents.training_id` = the training) so all existing ICS forms, prints,
 * the map, check-in and the IAP pipeline are reused untouched — the group's
 * incident id is what trainees navigate to.
 */

import { supabase } from './supabase'
import { generateIncidentId, generateRoleId } from './utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Training {
  id: string
  training_id: string
  name: string
  location: string
  scenario: string
  status: 'Setup' | 'Ongoing' | 'Closed'
  invite_token: string
  started_at: string | null
  created_by: string
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface TrainingGroup {
  id: string
  training_id: string
  name: string
  incident_id: string | null
  sort_order: number
  created_at: string
}

export interface TrainingMember {
  id: string
  training_id: string
  user_id: string
  user_name: string
  user_email: string
  role: 'trainor' | 'trainee'
  group_id: string | null
  joined_at: string
}

export interface TrainingAnnouncement {
  id: string
  training_id: string
  group_id: string | null
  title: string
  body: string
  created_by: string
  created_by_name: string
  created_at: string
}

export type GuideStatus = 'done' | 'skipped'

export interface GuideProgressRow {
  training_id: string
  user_id: string
  step_key: string
  status: GuideStatus
  updated_at: string
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** TRN-YYYYMMDD-NNNN — the human-readable training code. */
export function generateTrainingId(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `TRN-${y}${m}${d}-${rand}`
}

/** URL-safe invite token (no dependencies, plenty for an invite link). */
function generateInviteToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function trainingInviteUrl(token: string): string {
  return `${window.location.origin}/training/join/${token}`
}

export function userDisplayName(user: {
  user_metadata?: Record<string, unknown>
  email?: string | null
} | null): string {
  const first = (user?.user_metadata?.first_name as string) || ''
  const last = (user?.user_metadata?.last_name as string) || ''
  const full = `${first} ${last}`.trim()
  return full || user?.email || ''
}

// ---------------------------------------------------------------------------
// Create / load trainings
// ---------------------------------------------------------------------------

export interface CreateTrainingInput {
  name: string
  location: string
  scenario: string
  /** Number of default groups to scaffold (the trainer asked for 4). */
  groupCount: number
  trainer: { id: string; name: string }
}

/**
 * Creates the training row, its default groups (each with a child incident),
 * and the trainer's membership. Runs sequentially because groups reference the
 * training id and each child incident must exist before its group row.
 */
export async function createTraining(input: CreateTrainingInput): Promise<Training> {
  const trainingRow = {
    training_id: generateTrainingId(),
    name: input.name,
    location: input.location,
    scenario: input.scenario,
    status: 'Setup' as const,
    invite_token: generateInviteToken(),
    created_by: input.trainer.id,
    created_by_name: input.trainer.name,
  }

  const { data: training, error: trainingError } = await supabase
    .from('trainings')
    .insert(trainingRow)
    .select()
    .single()

  if (trainingError || !training) {
    throw new Error(
      trainingError?.code === '23505'
        ? 'A training code collided with an existing one — please try creating again.'
        : trainingError?.message || 'Could not create the training.',
    )
  }

  const { error: memberError } = await supabase.from('training_members').insert({
    training_id: training.id,
    user_id: input.trainer.id,
    user_name: input.trainer.name,
    user_email: '',
    role: 'trainor',
  })
  if (memberError) throw new Error(memberError.message)

  const count = Math.max(1, input.groupCount)
  for (let i = 0; i < count; i++) {
    await createGroup(training as Training, `Group ${i + 1}`, i)
  }

  return training as Training
}

/**
 * Creates one group and its child incident. The child incident carries
 * `type = 'Training'` and `training_id`, which is what marks it as internal —
 * regular incident lists filter those out.
 */
async function createGroup(training: Training, name: string, sortOrder: number): Promise<TrainingGroup> {
  // The incident code pool is shared with regular incidents — retry a couple
  // of times on the (rare) unique-code collision.
  let incident: { incident_id: string } | null = null
  let incidentError: { message: string } | null = null
  for (let attempt = 0; attempt < 3 && !incident; attempt++) {
    const res = await supabase
      .from('incidents')
      .insert({
        incident_id: generateIncidentId(),
        name: `${training.name} — ${name}`,
        location: training.location,
        type: 'Training',
        status: 'Ongoing',
        training_id: training.id,
        created_by: training.created_by,
        created_by_name: training.created_by_name,
        created_by_email: '',
      })
      .select()
      .single()
    if (res.error) {
      incidentError = res.error
      if (res.error.code !== '23505') break // not a code collision — fail fast
    } else {
      incident = res.data
    }
  }

  if (!incident) {
    throw new Error(incidentError?.message || 'Could not create the group incident.')
  }

  const { data: group, error: groupError } = await supabase
    .from('training_groups')
    .insert({
      training_id: training.id,
      name,
      incident_id: incident.incident_id,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (groupError || !group) {
    throw new Error(groupError?.message || 'Could not create the group.')
  }
  return group as TrainingGroup
}

export async function addGroup(training: Training, name: string): Promise<TrainingGroup> {
  const { data: existing } = await supabase
    .from('training_groups')
    .select('sort_order')
    .eq('training_id', training.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (existing?.sort_order ?? -1) + 1
  return createGroup(training, name, nextOrder)
}

/** Rename a group and keep the child incident's display name in sync. */
export async function renameGroup(group: TrainingGroup, name: string): Promise<void> {
  const { error } = await supabase.from('training_groups').update({ name }).eq('id', group.id)
  if (error) throw new Error(error.message)
  if (group.incident_id) {
    // Best effort — the group rename already succeeded if this fails.
    await supabase.from('incidents').update({ name, updated_at: new Date().toISOString() }).eq('incident_id', group.incident_id)
  }
}

/** Removes an empty group (and its child incident) from a Setup training. */
export async function removeGroup(group: TrainingGroup): Promise<void> {
  if (group.incident_id) {
    await supabase.from('incidents').delete().eq('incident_id', group.incident_id)
  }
  await supabase.from('training_groups').delete().eq('id', group.id)
}

export async function fetchTraining(trainingId: string): Promise<Training | null> {
  const { data } = await supabase.from('trainings').select('*').eq('id', trainingId).maybeSingle()
  return (data as Training) ?? null
}

export async function fetchGroups(trainingId: string): Promise<TrainingGroup[]> {
  const { data } = await supabase
    .from('training_groups')
    .select('*')
    .eq('training_id', trainingId)
    .order('sort_order', { ascending: true })
  return (data as TrainingGroup[]) ?? []
}

export async function fetchMembers(trainingId: string): Promise<TrainingMember[]> {
  const { data } = await supabase
    .from('training_members')
    .select('*')
    .eq('training_id', trainingId)
    .order('joined_at', { ascending: true })
  return (data as TrainingMember[]) ?? []
}

/** The signed-in user's membership in one training (or null). */
export async function fetchMyMembership(trainingId: string, userId: string): Promise<TrainingMember | null> {
  const { data } = await supabase
    .from('training_members')
    .select('*')
    .eq('training_id', trainingId)
    .eq('user_id', userId)
    .maybeSingle()
  return (data as TrainingMember) ?? null
}

/** Trainings the user belongs to, newest first. */
export async function fetchMyTrainings(userId: string): Promise<{ training: Training; member: TrainingMember }[]> {
  const { data: memberships } = await supabase
    .from('training_members')
    .select('*')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })

  const rows = memberships as TrainingMember[] | null
  if (!rows || rows.length === 0) return []

  const { data: trainings } = await supabase
    .from('trainings')
    .select('*')
    .in('id', rows.map((m) => m.training_id))
    .order('created_at', { ascending: false })

  const byId = new Map<string, Training>()
  ;((trainings as Training[]) ?? []).forEach((t) => byId.set(t.id, t))

  return rows
    .map((member) => {
      const training = byId.get(member.training_id)
      return training ? { training, member } : null
    })
    .filter((x): x is { training: Training; member: TrainingMember } => x !== null)
}

/** Finds a training by its invite token (used by the join link). */
export async function fetchTrainingByToken(token: string): Promise<Training | null> {
  const { data } = await supabase.from('trainings').select('*').eq('invite_token', token).maybeSingle()
  return (data as Training) ?? null
}

// ---------------------------------------------------------------------------
// Joining & assignment
// ---------------------------------------------------------------------------

/** Adds the signed-in user to a training as a trainee (idempotent). */
export async function joinTraining(training: Training, user: { id: string; name: string; email: string }): Promise<TrainingMember> {
  const existing = await fetchMyMembership(training.id, user.id)
  if (existing) return existing

  const { data, error } = await supabase
    .from('training_members')
    .insert({
      training_id: training.id,
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      role: 'trainee',
    })
    .select()
    .single()

  if (error || !data) {
    // A concurrent join (double click / reload) hits the unique constraint.
    const raced = await fetchMyMembership(training.id, user.id)
    if (raced) return raced
    throw new Error(error?.message || 'Could not join the training.')
  }
  return data as TrainingMember
}

/**
 * Assigns (or transfers) a trainee to a group.
 *
 * The trainer only updates `training_members.group_id` — the participant row
 * inside the group's child incident is inserted by the TRAINEE themselves on
 * their next visit (RLS only lets you insert your own participant record).
 * `syncGroupParticipants` below also closes stale rows after a transfer.
 */
export async function assignTrainee(memberId: string, groupId: string | null): Promise<void> {
  const { error } = await supabase.from('training_members').update({ group_id: groupId }).eq('id', memberId)
  if (error) throw new Error(error.message)
}

/**
 * Called by a TRAINEE when they open their training. Makes sure:
 *  - an Active participant row exists in their CURRENT group's incident, and
 *  - stale Active participant rows in any OTHER group of the same training are
 *    marked Left (after a transfer they no longer belong to the old group).
 *
 * Both writes are on rows owned by the calling user, so RLS allows them.
 */
export async function syncGroupParticipants(trainingId: string, userId: string, member: TrainingMember): Promise<void> {
  const groups = await fetchGroups(trainingId)
  const current = groups.find((g) => g.id === member.group_id)
  const trainingIncidentIds = groups.map((g) => g.incident_id).filter((x): x is string => !!x)

  // Close stale rows first.
  if (trainingIncidentIds.length > 0) {
    const { data: mine } = await supabase
      .from('incident_participants')
      .select('id, incident_id')
      .in('incident_id', trainingIncidentIds)
      .eq('user_id', userId)
      .eq('status', 'Active')

    const stale = (mine ?? []).filter((row) => row.incident_id !== current?.incident_id)
    for (const row of stale) {
      await supabase.from('incident_participants').update({ status: 'Left', left_at: new Date().toISOString() }).eq('id', row.id)
    }
  }

  if (!current?.incident_id) return

  const { data: existing } = await supabase
    .from('incident_participants')
    .select('id')
    .eq('incident_id', current.incident_id)
    .eq('user_id', userId)
    .eq('status', 'Active')
    .maybeSingle()

  if (existing) return

  await supabase.from('incident_participants').insert({
    incident_id: current.incident_id,
    user_id: userId,
    user_name: member.user_name,
    user_email: member.user_email,
    role: 'IMT', // trainees run their group's whole ICS package
    role_id: generateRoleId('IMT'),
    status: 'Active',
  })
}

// ---------------------------------------------------------------------------
// Training lifecycle
// ---------------------------------------------------------------------------

export async function startTraining(trainingId: string): Promise<void> {
  const { error } = await supabase
    .from('trainings')
    .update({ status: 'Ongoing', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', trainingId)
  if (error) throw new Error(error.message)
}

export async function closeTraining(trainingId: string): Promise<void> {
  const { error } = await supabase
    .from('trainings')
    .update({ status: 'Closed', updated_at: new Date().toISOString() })
    .eq('id', trainingId)
  if (error) throw new Error(error.message)
}

/**
 * Permanently deletes a Closed training and its group workspaces.
 * Each child incident goes through public.delete_incident() (same catalog
 * walk as a manual incident delete) because several incident-child FKs have
 * no ON DELETE CASCADE (participants, messages, ...). The training row —
 * with groups/members/progress/announcements cascading from it — is removed
 * last.
 */
export async function deleteTraining(training: Training): Promise<void> {
  if (training.status !== 'Closed') {
    throw new Error('Only closed trainings can be deleted.')
  }
  const { data: incidents, error: fetchError } = await supabase
    .from('incidents')
    .select('incident_id')
    .eq('training_id', training.id)
  if (fetchError) throw new Error(fetchError.message)
  for (const row of (incidents ?? []) as { incident_id: string }[]) {
    const { error: rpcError } = await supabase.rpc('delete_incident', { p_incident_id: row.incident_id })
    if (rpcError) throw new Error(rpcError.message)
  }
  const { error } = await supabase.from('trainings').delete().eq('id', training.id)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export async function postAnnouncement(
  trainingId: string,
  input: { groupId: string | null; title: string; body: string; author: { id: string; name: string } },
): Promise<void> {
  const { error } = await supabase.from('training_announcements').insert({
    training_id: trainingId,
    group_id: input.groupId,
    title: input.title,
    body: input.body,
    created_by: input.author.id,
    created_by_name: input.author.name,
  })
  if (error) throw new Error(error.message)
}

/** Announcements visible to a group (broadcasts + the ones aimed at them). */
export async function fetchAnnouncements(trainingId: string, groupId: string | null): Promise<TrainingAnnouncement[]> {
  let query = supabase
    .from('training_announcements')
    .select('*')
    .eq('training_id', trainingId)
    .order('created_at', { ascending: false })

  if (groupId) {
    query = query.or(`group_id.is.null,group_id.eq.${groupId}`)
  } else {
    query = query.is('group_id', null)
  }

  const { data } = await query
  return (data as TrainingAnnouncement[]) ?? []
}

export async function markAnnouncementRead(announcementId: string, userId: string): Promise<void> {
  await supabase
    .from('training_announcement_reads')
    .upsert({ announcement_id: announcementId, user_id: userId }, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true })
}

export async function fetchReadAnnouncementIds(trainingId: string, userId: string): Promise<Set<string>> {
  const { data: announcements } = await supabase
    .from('training_announcements')
    .select('id')
    .eq('training_id', trainingId)
  const ids = (announcements ?? []).map((a) => a.id as string)
  if (ids.length === 0) return new Set()

  const { data: reads } = await supabase
    .from('training_announcement_reads')
    .select('announcement_id')
    .eq('user_id', userId)
    .in('announcement_id', ids)

  return new Set((reads ?? []).map((r) => r.announcement_id as string))
}

// ---------------------------------------------------------------------------
// Guide progress (per trainee)
// ---------------------------------------------------------------------------

export async function fetchGuideProgress(trainingId: string, userId: string): Promise<Map<string, GuideStatus>> {
  const { data } = await supabase
    .from('training_guide_progress')
    .select('step_key, status')
    .eq('training_id', trainingId)
    .eq('user_id', userId)

  const map = new Map<string, GuideStatus>()
  ;(data ?? []).forEach((row) => map.set(row.step_key as string, row.status as GuideStatus))
  return map
}

export async function saveGuideStep(trainingId: string, userId: string, stepKey: string, status: GuideStatus): Promise<void> {
  await supabase
    .from('training_guide_progress')
    .upsert(
      { training_id: trainingId, user_id: userId, step_key: stepKey, status, updated_at: new Date().toISOString() },
      { onConflict: 'training_id,user_id,step_key' },
    )
}

export async function resetGuideProgress(trainingId: string, userId: string): Promise<void> {
  await supabase.from('training_guide_progress').delete().eq('training_id', trainingId).eq('user_id', userId)
}

// ---------------------------------------------------------------------------
// Trainer monitoring — form statuses across every group incident
// ---------------------------------------------------------------------------

export interface GroupMonitor {
  group: TrainingGroup
  members: TrainingMember[]
  /** Form key → 'Draft' | 'Submitted' | 'Saved' | '' (empty = untouched). */
  statuses: Record<string, string>
  iapStatus: string
}

/** Form keys the monitor surfaces, mirroring the guided sequence. */
const MONITOR_FORMS: { key: string; table: string; single?: boolean }[] = [
  { key: '211', table: 'ics_211_forms' },
  { key: '207', table: 'ics_207_forms' },
  { key: '201', table: 'ics_201_forms' },
  { key: '202', table: 'ics_202_forms' },
  { key: '203', table: 'ics_203_forms' },
  { key: '205', table: 'ics_205_forms' },
  { key: '206', table: 'ics_206_forms' },
  { key: '208', table: 'ics_208_forms' },
  { key: '215', table: 'ics_215_forms' },
  { key: '215A', table: 'ics_215a_forms' },
  { key: '204', table: 'ics_204_forms' },
]

/** Latest-status projection for each group's child incident (parallel). */
export async function fetchGroupMonitors(trainingId: string): Promise<GroupMonitor[]> {
  const [groups, members] = await Promise.all([fetchGroups(trainingId), fetchMembers(trainingId)])
  const incidentIds = groups.map((g) => g.incident_id).filter((x): x is string => !!x)

  const statusMaps = await Promise.all(
    MONITOR_FORMS.map(async ({ key, table }) => {
      if (incidentIds.length === 0) return { key, map: new Map<string, string>() }
      const { data } = await supabase
        .from(table)
        .select('incident_id, status, updated_at')
        .in('incident_id', incidentIds)
        .order('updated_at', { ascending: false })

      const map = new Map<string, string>()
      // First occurrence per incident is the most recently updated row.
      ;(data ?? []).forEach((row) => {
        const inc = row.incident_id as string
        if (!map.has(inc)) map.set(inc, row.status as string)
      })
      return { key, map }
    }),
  )

  const [checkins, maps, iaps] = await Promise.all([
    incidentIds.length
      ? supabase.from('checkin_manifests').select('incident_id, status, updated_at').in('incident_id', incidentIds).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] as { incident_id: string; status: string }[] }),
    incidentIds.length
      ? supabase.from('incident_maps').select('incident_id').in('incident_id', incidentIds)
      : Promise.resolve({ data: [] as { incident_id: string }[] }),
    incidentIds.length
      ? supabase.from('incident_iap').select('incident_id, status, updated_at').in('incident_id', incidentIds).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] as { incident_id: string; status: string }[] }),
  ])

  const checkinMap = new Map<string, string>()
  ;(checkins.data ?? []).forEach((row) => {
    if (!checkinMap.has(row.incident_id)) checkinMap.set(row.incident_id, row.status)
  })
  const mapSet = new Set((maps.data ?? []).map((r) => r.incident_id))
  const iapMap = new Map<string, string>()
  ;(iaps.data ?? []).forEach((row) => {
    if (!iapMap.has(row.incident_id)) iapMap.set(row.incident_id, row.status)
  })

  return groups.map((group) => {
    const inc = group.incident_id || ''
    const statuses: Record<string, string> = {}
    statusMaps.forEach(({ key, map }) => {
      statuses[key] = map.get(inc) || ''
    })
    statuses['CHECKIN'] = checkinMap.get(inc) || ''
    statuses['MAP'] = mapSet.has(inc) ? 'Saved' : ''

    return {
      group,
      members: members.filter((m) => m.group_id === group.id),
      statuses,
      iapStatus: iapMap.get(inc) || '',
    }
  })
}
