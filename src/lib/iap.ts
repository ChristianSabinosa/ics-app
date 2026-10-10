import { supabase } from './supabase'
import { offLatest, offAll, offChildren, offGetMap } from './offline/store'
import type { OfflineRow } from './offline/db'
import { OPS_POSITIONS } from './ics204'
import type { Ics204RowInput } from './ics204'
import {
  asCustomSymbols,
  asLiveMarkers,
  asLiveShapes,
} from './map'
import type { CustomSymbolDef, LiveMarker, LiveShape } from './map'
import type { Ics204CommsRow, Ics204OpsPerson, Ics204Row } from './types'

/** Operational period of an IAP (entered by the user, prefilled from ICS 202). */
export interface IapOpPeriod {
  from_date: string
  from_time: string
  to_date: string
  to_time: string
}

export interface IapPosition {
  position_key: string
  position_title: string
  abbreviation: string
  section: string
  person_name: string
  agency: string
  parent_key?: string | null
}

export interface IapForm202 {
  objectives: string
  command_emphasis: string
  weather_forecast: string
  safety_message: string
  safety_plan_required: boolean
  safety_plan_location: string
  attach_203: boolean
  attach_204: boolean
  attach_205: boolean
  attach_206: boolean
  attach_209: boolean
  attach_map: boolean
  attach_others: boolean
  attach_others_text: string
  prepared_by_name: string
  prepared_by_sig: string
  prepared_date: string
  prepared_time: string
  approved_by_name: string
  approved_by_sig: string
  approved_date: string
  approved_time: string
}

export interface IapForm203 {
  positions: IapPosition[]
  prepared_by_name: string
  prepared_by_sig: string
  prepared_date: string
  prepared_time: string
}

export interface IapForm204 {
  id: string
  branch: string
  group_name: string
  division: string
  staging_area: string
  ops_personnel: Ics204OpsPerson[]
  specific_work_assignment: string
  special_instructions: string
  comms: Ics204CommsRow[]
  prepared_by_name: string
  prepared_by_sig: string
  prepared_date: string
  prepared_time: string
  rows: Ics204RowInput[]
}

export interface IapChannel {
  radio_type: string
  system: string
  channel: string
  function: string
  tone_offset: string
  frequency: string
  others: string
  assignment: string
  remarks: string
}

export interface IapForm205 {
  channels: IapChannel[]
  coordinating_instructions: string
  prepared_by: string
  date_prepared: string
  time_prepared: string
}

export interface IapAidStation {
  name: string
  location: string
  contact_person: string
  contact_numbers: string
  remarks: string
  with_paramedics: boolean
}

export interface IapAmbulance {
  name: string
  location: string
  contact_person: string
  contact_numbers: string
  remarks: string
  level_of_service: string
}

export interface IapHospital {
  name: string
  location: string
  contact_person: string
  contact_numbers: string
  travel_time_air: string
  travel_time_land: string
  with_trauma_center: boolean
  with_burn_center: boolean
  with_helipad: boolean
}

export interface IapForm206 {
  aid_stations: IapAidStation[]
  ambulances: IapAmbulance[]
  hospitals: IapHospital[]
  medical_emergency_procedures: string
  aviation_assets_used: boolean
  prepared_by: string
  date_prepared: string
  time_prepared: string
  reviewed_by: string
  date_reviewed: string
  time_reviewed: string
}

export interface IapForm208 {
  safety_message: string
  safety_plan_required: boolean | null
  safety_plan_location: string
  prepared_by_name: string
  prepared_date: string
  prepared_time: string
}

/**
 * Everything needed to render an Incident Action Plan document.
 * Stored as JSONB on approved IAPs so the approved document never changes.
 */
export interface IapData {
  incident_name: string
  op: IapOpPeriod
  form202: IapForm202 | null
  form203: IapForm203 | null
  forms204: IapForm204[]
  form205: IapForm205 | null
  form206: IapForm206 | null
  form208: IapForm208 | null
  map_image: string
  map_type: string
  map_markers: LiveMarker[]
  map_shapes: LiveShape[]
  map_custom: CustomSymbolDef[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const bool = (v: unknown): boolean => v === true
const nullableBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

const stripRow = <T extends object>(row: Record<string, unknown>): T => {
  const { id: _id, form_id: _formId, ...rest } = row
  return rest as T
}

/** "2026-10-01 0800H to 2026-10-01 2000H" — the same wording used on the incident page. */
export function formatOpPeriod(op: IapOpPeriod): string {
  const mil = (t: string) => (t ? t.replace(':', '') + 'H' : '')
  const part = (d: string, t: string) => (d ? `${d} ${mil(t)}`.trim() : mil(t))
  const from = part(op.from_date, op.from_time)
  const to = part(op.to_date, op.to_time)
  if (!from && !to) return ''
  return `${from} to ${to}`
}

/** Loads every page of an IAP (202, 203, all 204s, 205, 206, 208, map) for an incident. */
export async function loadIapData(
  incidentId: string,
  op: IapOpPeriod,
  incidentName: string,
  offline = false,
): Promise<IapData> {
  type Rec = Record<string, unknown>
  type ListRes = { data: unknown[] | null }

  let r202: Rec | null
  let r203: Rec | null
  let r205: Rec | null
  let r206: Rec | null
  let r208: Rec | null
  let r204s: ListRes
  let r207s: ListRes
  let rMap: { data: { map_image?: string | null; map_type?: string | null; live_markers?: unknown; live_shapes?: unknown; custom_symbols?: unknown } | null }

  if (offline) {
    const offLatestRow = async (table: string): Promise<Rec | null> =>
      ((await offLatest(table, incidentId)) as Rec | undefined) ?? null
    const newestFirst = (rows: OfflineRow[]) =>
      [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

    ;[r202, r203, r205, r206, r208] = await Promise.all([
      offLatestRow('ics_202_forms'),
      offLatestRow('ics_203_forms'),
      offLatestRow('ics_205_forms'),
      offLatestRow('ics_206_forms'),
      offLatestRow('ics_208_forms'),
    ])
    r204s = { data: newestFirst(await offAll('ics_204_forms', incidentId)) }
    r207s = {
      data: newestFirst(await offAll('ics_207_forms', incidentId))
        .slice(0, 50)
        .map((f) => ({ id: f.id, form_type: f.form_type })),
    }
    const localMap = await offGetMap(incidentId)
    rMap = {
      data: localMap
        ? {
            map_image: localMap.map_image,
            map_type: localMap.map_type,
            live_markers: localMap.live_markers,
            live_shapes: localMap.live_shapes,
            custom_symbols: localMap.custom_symbols,
          }
        : null,
    }
  } else {
    const latest = async (table: string): Promise<Record<string, unknown> | null> => {
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return (data as Record<string, unknown>) ?? null
    }

    ;[r202, r203, r205, r206, r208, r204s, r207s, rMap] = await Promise.all([
      latest('ics_202_forms'),
      latest('ics_203_forms'),
      latest('ics_205_forms'),
      latest('ics_206_forms'),
      latest('ics_208_forms'),
      supabase
        .from('ics_204_forms')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false }),
      supabase
        .from('ics_207_forms')
        .select('id, form_type')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('incident_maps').select('map_image, map_type, live_markers, live_shapes, custom_symbols').eq('incident_id', incidentId).maybeSingle(),
    ])
  }

  // Same "expanded first, otherwise latest" rule the ICS 203 form uses
  const forms207 = (r207s.data ?? []) as Array<{ id: string; form_type?: string | null }>
  const form207Id =
    forms207.find((f) => f.form_type === 'expanded')?.id ?? forms207[0]?.id ?? null

  const rawForms204 = (r204s.data ?? []) as Array<Record<string, unknown>>
  const form204Ids = rawForms204.map((f) => String(f.id))

  let posRes: ListRes
  let chRes: ListRes
  let aidRes: ListRes
  let ambRes: ListRes
  let hospRes: ListRes
  let rowsRes: ListRes

  if (offline) {
    // Local child rows carry store bookkeeping columns — drop them so the shape matches online.
    const clean = (rows: OfflineRow[]): Rec[] =>
      rows.map((r) => {
        const { _key: _k, table: _t, incident_id: _i, created_at: _c, updated_at: _u, ...rest } = r
        return rest
      })
    const children = async (table: string, formId: unknown): Promise<ListRes> => ({
      data: formId ? clean(await offChildren(table, String(formId))) : null,
    })

    posRes = form207Id
      ? {
          data: (await offChildren('ics_207_positions', form207Id)).map((p) => ({
            position_key: p.position_key,
            position_title: p.position_title,
            abbreviation: p.abbreviation,
            section: p.section,
            person_name: p.person_name,
            agency: p.agency,
            parent_key: p.parent_key,
          })),
        }
      : { data: null }
    chRes = await children('ics_205_channels', r205?.id)
    aidRes = await children('ics_206_aid_stations', r206?.id)
    ambRes = await children('ics_206_ambulances', r206?.id)
    hospRes = await children('ics_206_hospitals', r206?.id)

    const allRows: Rec[] = []
    for (const id of form204Ids) allRows.push(...clean(await offChildren('ics_204_rows', id)))
    rowsRes = { data: form204Ids.length > 0 ? allRows : null }
  } else {
    ;[posRes, chRes, aidRes, ambRes, hospRes, rowsRes] = await Promise.all([
      form207Id
        ? supabase
            .from('ics_207_positions')
            .select('position_key, position_title, abbreviation, section, person_name, agency, parent_key')
            .eq('form_id', form207Id)
            .order('sort_order')
        : Promise.resolve({ data: null as unknown[] | null }),
      r205?.id
        ? supabase.from('ics_205_channels').select('*').eq('form_id', r205.id).order('sort_order')
        : Promise.resolve({ data: null as unknown[] | null }),
      r206?.id
        ? supabase.from('ics_206_aid_stations').select('*').eq('form_id', r206.id).order('sort_order')
        : Promise.resolve({ data: null as unknown[] | null }),
      r206?.id
        ? supabase.from('ics_206_ambulances').select('*').eq('form_id', r206.id).order('sort_order')
        : Promise.resolve({ data: null as unknown[] | null }),
      r206?.id
        ? supabase.from('ics_206_hospitals').select('*').eq('form_id', r206.id).order('sort_order')
        : Promise.resolve({ data: null as unknown[] | null }),
      form204Ids.length > 0
        ? supabase.from('ics_204_rows').select('*').in('form_id', form204Ids).order('sort_order')
        : Promise.resolve({ data: null as unknown[] | null }),
    ])
  }

  const rowsByForm = new Map<string, Ics204RowInput[]>()
  for (const row of (rowsRes.data ?? []) as Ics204Row[]) {
    const list = rowsByForm.get(row.form_id) ?? []
    list.push(stripRow<Ics204RowInput>(row as unknown as Record<string, unknown>))
    rowsByForm.set(row.form_id, list)
  }

  const form202: IapForm202 | null = r202
    ? {
        objectives: str(r202.objectives),
        command_emphasis: str(r202.command_emphasis),
        weather_forecast: str(r202.weather_forecast),
        safety_message: str(r202.safety_message),
        safety_plan_required: bool(r202.safety_plan_required),
        safety_plan_location: str(r202.safety_plan_location),
        attach_203: bool(r202.attach_203),
        attach_204: bool(r202.attach_204),
        attach_205: bool(r202.attach_205),
        attach_206: bool(r202.attach_206),
        attach_209: bool(r202.attach_209),
        attach_map: bool(r202.attach_map),
        attach_others: bool(r202.attach_others),
        attach_others_text: str(r202.attach_others_text),
        prepared_by_name: str(r202.prepared_by_name),
        prepared_by_sig: str(r202.prepared_by_sig),
        prepared_date: str(r202.prepared_date),
        prepared_time: str(r202.prepared_time),
        approved_by_name: str(r202.approved_by_name),
        approved_by_sig: str(r202.approved_by_sig),
        approved_date: str(r202.approved_date),
        approved_time: str(r202.approved_time),
      }
    : null

  const form203: IapForm203 | null = r203
    ? {
        positions: (posRes.data ?? []) as IapPosition[],
        prepared_by_name: str(r203.prepared_by_name),
        prepared_by_sig: str(r203.prepared_by_sig),
        prepared_date: str(r203.prepared_date),
        prepared_time: str(r203.prepared_time),
      }
    : null

  const forms204: IapForm204[] = rawForms204.map((f) => {
    const stored = arr<Ics204OpsPerson>(f.ops_personnel)
    const byPos = new Map(stored.map((p) => [p.position, p]))
    return {
      id: str(f.id),
      branch: str(f.branch),
      group_name: str(f.group_name),
      division: str(f.division),
      staging_area: str(f.staging_area),
      ops_personnel: OPS_POSITIONS.map((position) => {
        const s = byPos.get(position)
        return { position, name: str(s?.name), contact: str(s?.contact) }
      }),
      specific_work_assignment: str(f.specific_work_assignment),
      special_instructions: str(f.special_instructions),
      comms: arr<Ics204CommsRow>(f.comms),
      prepared_by_name: str(f.prepared_by_name),
      prepared_by_sig: str(f.prepared_by_sig),
      prepared_date: str(f.prepared_date),
      prepared_time: str(f.prepared_time),
      rows: rowsByForm.get(str(f.id)) ?? [],
    }
  })

  const form205: IapForm205 | null = r205
    ? {
        channels: ((chRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
          radio_type: str(c.radio_type),
          system: str(c.system),
          channel: str(c.channel),
          function: str(c.function),
          tone_offset: str(c.tone_offset),
          frequency: str(c.frequency),
          others: str(c.others),
          assignment: str(c.assignment),
          remarks: str(c.remarks),
        })),
        coordinating_instructions: str(r205.coordinating_instructions),
        prepared_by: str(r205.prepared_by),
        date_prepared: str(r205.date_prepared),
        time_prepared: str(r205.time_prepared),
      }
    : null

  const mapRows = <T extends object>(data: unknown[]): T[] =>
    (data as Record<string, unknown>[]).map((r) => stripRow<T>(r))

  const form206: IapForm206 | null = r206
    ? {
        aid_stations: mapRows<IapAidStation>(aidRes.data ?? []),
        ambulances: mapRows<IapAmbulance>(ambRes.data ?? []),
        hospitals: mapRows<IapHospital>(hospRes.data ?? []),
        medical_emergency_procedures: str(r206.medical_emergency_procedures),
        aviation_assets_used: bool(r206.aviation_assets_used),
        prepared_by: str(r206.prepared_by),
        date_prepared: str(r206.date_prepared),
        time_prepared: str(r206.time_prepared),
        reviewed_by: str(r206.reviewed_by),
        date_reviewed: str(r206.date_reviewed),
        time_reviewed: str(r206.time_reviewed),
      }
    : null

  const form208: IapForm208 | null = r208
    ? {
        safety_message: str(r208.safety_message),
        safety_plan_required: nullableBool(r208.safety_plan_required),
        safety_plan_location: str(r208.safety_plan_location),
        prepared_by_name: str(r208.prepared_by_name),
        prepared_date: str(r208.prepared_date),
        prepared_time: str(r208.prepared_time),
      }
    : null

  const mapRow = (rMap.data ?? {}) as {
    map_image?: string
    map_type?: string
    live_markers?: unknown
    live_shapes?: unknown
    custom_symbols?: unknown
  }
  const mapMarkers: LiveMarker[] = asLiveMarkers(mapRow.live_markers)
  const mapShapes: LiveShape[] = asLiveShapes(mapRow.live_shapes)
  const mapCustom: CustomSymbolDef[] = asCustomSymbols(mapRow.custom_symbols)

  return {
    incident_name: incidentName,
    op,
    form202,
    form203,
    forms204,
    form205,
    form206,
    form208,
    map_image: str(mapRow.map_image),
    map_type: mapRow.map_type === 'live' ? 'live' : 'sketch',
    map_markers: mapMarkers,
    map_shapes: mapShapes,
    map_custom: mapCustom,
  }
}
