import { supabase } from './supabase'
import type { Ics204CommsRow, Ics204OpsPerson, Ics204Row, Ics204Summary } from './types'

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
