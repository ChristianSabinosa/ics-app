import { supabase } from './supabase'
import type { Ics204CommsRow, Ics204OpsPerson, Ics204Row, Ics204Summary } from './types'
import { offAll, offChildren } from './offline/store'

// ---------------------------------------------------------------------------
// Offline Mode (IndexedDB) variants of the prefill helpers below
// ---------------------------------------------------------------------------

const newestFirst = <T extends { created_at?: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

/** Offline: Operations Section Chief name from the latest local ICS 207. */
export async function loadOscNameOffline(incidentId: string): Promise<string> {
  const forms = newestFirst(await offAll('ics_207_forms', incidentId))
  const form = forms.find((f) => f.form_type === 'expanded') ?? forms[0]
  if (!form) return ''
  const positions = await offChildren('ics_207_positions', form.id as string)
  const osc = positions.find((p) => p.position_key === 'osc')
  return (osc?.person_name as string) || ''
}

/** Offline: communications summary rows from the latest local ICS 205. */
export async function load205CommsOffline(incidentId: string): Promise<Ics204CommsRow[]> {
  const form = newestFirst(await offAll('ics_205_forms', incidentId))[0]
  if (!form) return []
  const channels = await offChildren('ics_205_channels', form.id as string)
  return channels.map((c) => ({
    function: (c.function as string) || '',
    system: (c.system as string) || '',
    channel: (c.channel as string) || '',
    frequency: (c.frequency as string) || '',
    others: (c.others as string) || '',
  }))
}

/** Offline: mitigating measures from the latest local ICS 215A. */
export async function load215AMitigatingOffline(incidentId: string, divisionLabel: string): Promise<string> {
  const form = newestFirst(await offAll('ics_215a_forms', incidentId))[0]
  const divisions = (form?.divisions as Array<{ division_group?: string; mitigating_measures?: string }>) ?? []
  if (divisions.length === 0) return ''

  const label = divisionLabel.trim().toLowerCase()
  if (label) {
    const match = divisions.find((d) => {
      const g = (d.division_group || '').trim().toLowerCase()
      if (!g) return false
      return g === label || g.includes(label) || label.includes(g)
    })
    if (match?.mitigating_measures?.trim()) return match.mitigating_measures
  }

  return divisions
    .map((d) => (d.mitigating_measures || '').trim())
    .filter(Boolean)
    .join('\n\n')
}

/** Offline: all local 204 instances for an incident (newest first). */
export async function loadIcs204ListOffline(incidentId: string): Promise<Ics204Summary[]> {
  const rows = newestFirst(await offAll('ics_204_forms', incidentId))
  return rows as unknown as Ics204Summary[]
}

// Fixed section-4 rows shown on every ICS 204 (order matches the printed form)
export const OPS_POSITIONS = [
  'Operations Section Chief',
  'Branch Director',
  'Staging Area Manager',
  'Division/Group Supervisor',
  'Air/Water/Tactical Group Supervisor',
] as const

export const emptyOpsPersonnel = (): Ics204OpsPerson[] =>
  OPS_POSITIONS.map((position) => ({ position, name: '', contact: '' }))

export const emptyCommsRow = (): Ics204CommsRow => ({
  function: '', system: '', channel: '', frequency: '', others: '',
})

export type Ics204RowInput = Omit<Ics204Row, 'id' | 'form_id'>

export const emptyResourceRow = (): Ics204RowInput => ({
  resource_identifier: '', leader_name: '', contact_numbers: '', personnel: '',
  trans_needed: false, drop_off: '', pick_up_time: '', remarks: '', sort_order: 0,
})

/** All 204 instances for an incident (lightweight — used by the list page and status badge). */
export async function loadIcs204List(incidentId: string): Promise<Ics204Summary[]> {
  const { data } = await supabase
    .from('ics_204_forms')
    .select('id, branch, group_name, division, staging_area, status, created_at, updated_at')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Ics204Summary[]
}

/** One 204 instance plus its resource rows. */
export async function loadIcs204WithRows(
  formId: string,
): Promise<{ form: (Record<string, unknown> & { id: string }) | null; rows: Ics204Row[] }> {
  const { data: form } = await supabase.from('ics_204_forms').select('*').eq('id', formId).single()
  if (!form) return { form: null, rows: [] }
  const { data: rows } = await supabase
    .from('ics_204_rows')
    .select('*')
    .eq('form_id', formId)
    .order('sort_order')
  return { form, rows: (rows ?? []) as Ics204Row[] }
}

/**
 * Operations Section Chief name as displayed on ICS 203.
 * ICS 203 itself renders positions from the latest ICS 207 org chart
 * (expanded preferred), so we read from the same source.
 */
export async function loadOscName(incidentId: string): Promise<string> {
  const { data: expanded } = await supabase
    .from('ics_207_forms')
    .select('id')
    .eq('incident_id', incidentId)
    .eq('form_type', 'expanded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let formId: string | null = expanded?.id ?? null
  if (!formId) {
    const { data: any207 } = await supabase
      .from('ics_207_forms')
      .select('id')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    formId = any207?.id ?? null
  }
  if (!formId) return ''

  const { data: pos } = await supabase
    .from('ics_207_positions')
    .select('person_name')
    .eq('form_id', formId)
    .eq('position_key', 'osc')
    .maybeSingle()
  return pos?.person_name || ''
}

/** Communications summary rows prefilled from the latest ICS 205. */
export async function load205Comms(incidentId: string): Promise<Ics204CommsRow[]> {
  const { data: form } = await supabase
    .from('ics_205_forms')
    .select('id')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!form) return []

  const { data: channels } = await supabase
    .from('ics_205_channels')
    .select('function, system, channel, frequency, others')
    .eq('form_id', form.id)
    .order('sort_order')

  return (channels ?? []).map((c) => ({
    function: c.function || '',
    system: c.system || '',
    channel: c.channel || '',
    frequency: c.frequency || '',
    others: c.others || '',
  }))
}

/**
 * Safety measures for section 7 from the latest ICS 215A.
 * Prefers the division/group whose label matches; otherwise joins every
 * non-empty mitigating-measures block.
 */
export async function load215AMitigating(incidentId: string, divisionLabel: string): Promise<string> {
  const { data: form } = await supabase
    .from('ics_215a_forms')
    .select('divisions')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const divisions: Array<{ division_group?: string; mitigating_measures?: string }> =
    (form?.divisions as Array<Record<string, unknown>>) ?? []
  if (divisions.length === 0) return ''

  const label = divisionLabel.trim().toLowerCase()
  if (label) {
    const match = divisions.find((d) => {
      const g = (d.division_group || '').trim().toLowerCase()
      if (!g) return false
      return g === label || g.includes(label) || label.includes(g)
    })
    if (match?.mitigating_measures?.trim()) return match.mitigating_measures
  }

  return divisions
    .map((d) => (d.mitigating_measures || '').trim())
    .filter(Boolean)
    .join('\n\n')
}
