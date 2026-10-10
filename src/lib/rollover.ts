import { supabase } from './supabase'
import { offAll, offChildren, offInsert, offLatest } from './offline/store'

export interface OpPeriodInput {
  from_date: string
  from_time: string
  to_date: string
  to_time: string
}

/** Parent tables that keep a single "latest wins" row per incident. */
const SINGLE_TABLES = [
  'ics_202_forms',
  'ics_203_forms',
  'ics_205_forms',
  'ics_206_forms',
  'ics_208_forms',
  'ics_209_forms',
  'ics_211_forms',
  'ics_201_forms',
  'ics_213_forms',
  'ics_215_forms',
  'ics_215a_forms',
  'ics_207_forms',
]

/** Parent tables with many instances per incident — every instance rolls over. */
const MULTI_TABLES = ['ics_204_forms', 'ics_214_forms', 'ics_221_forms']

/** Child tables linked to a parent by `form_id`. */
const CHILD_TABLES = [
  'ics_207_positions',
  'ics_204_rows',
  'ics_205_channels',
  'ics_206_aid_stations',
  'ics_206_ambulances',
  'ics_206_hospitals',
  'ics_211_resources',
]

/** Stored op-period columns, when present, follow the new period. */
const OP_OVERWRITES: Record<keyof OpPeriodInput, string> = {
  from_date: 'op_period_from_date',
  from_time: 'op_period_from_time',
  to_date: 'op_period_to_date',
  to_time: 'op_period_to_time',
}

export interface RolloverResult {
  parents: number
  children: number
  /** Tables that could not be cloned (legacy schema, etc.) — everything else went through. */
  failed: string[]
}

type Row = Record<string, unknown>

/* Write status/updated_at only when the source row already carries the column:
   older databases (e.g. ics_205_channels without updated_at) reject unknown
   columns via the schema cache. */
const freshParent = (src: Row, op: OpPeriodInput): Row => {
  const { id: _id, created_at: _created, table: _table, _key: _omitKey, ...rest } = src
  const out: Row = { ...rest }
  for (const [field, column] of Object.entries(OP_OVERWRITES)) {
    if (column in out) out[column] = op[field as keyof OpPeriodInput]
  }
  if ('status' in out) out.status = 'Draft'
  if ('updated_at' in out) out.updated_at = new Date().toISOString()
  return out
}

const freshChild = (src: Row, formId: string | number): Row => {
  const { id: _cid, created_at: _ccreated, table: _ctable, _key: _ckey, ...rest } = src
  const out: Row = { ...rest, form_id: formId }
  if ('updated_at' in out) out.updated_at = new Date().toISOString()
  return out
}

/** Skip rows this run already cloned (safe immediate retry after a failure).
 *  Tables without updated_at fall back to matching the requested op dates. */
const alreadyRolled = (row: Row, runStart: string, op: OpPeriodInput): boolean => {
  if (row.status !== 'Draft') return false
  if (typeof row.updated_at === 'string') return row.updated_at >= runStart
  return (
    (row.op_period_from_date ?? '') === op.from_date &&
    (row.op_period_to_date ?? '') === op.to_date &&
    op.from_date !== ''
  )
}

async function cloneChildrenOnline(oldFormId: string | number, newFormId: string | number): Promise<number> {
  let count = 0
  for (const child of CHILD_TABLES) {
    const { data, error } = await supabase.from(child).select('*').eq('form_id', oldFormId)
    if (error) {
      // A missing child table (older database) is not a rollover failure.
      if (/relation|does not exist|schema cache/i.test(error.message)) continue
      throw new Error(`${child}: ${error.message}`)
    }
    for (const row of (data ?? []) as Row[]) {
      const { error: insError } = await supabase.from(child).insert(freshChild(row, newFormId))
      if (insError) throw new Error(`${child}: ${insError.message}`)
      count += 1
    }
  }
  return count
}

async function cloneChildrenOffline(oldFormId: string, newFormId: string | number): Promise<number> {
  let count = 0
  for (const child of CHILD_TABLES) {
    const rows = await offChildren(child, oldFormId)
    for (const row of rows) {
      await offInsert(child, freshChild(row as Row, newFormId))
      count += 1
    }
  }
  return count
}

async function rolloverOnline(incidentId: string, op: OpPeriodInput): Promise<RolloverResult> {
  const runStart = new Date().toISOString()
  let parents = 0
  let children = 0
  const failed: string[] = []

  const cloneParent = async (table: string, src: Row) => {
    const { data, error } = await supabase
      .from(table)
      .insert(freshParent(src, op))
      .select('id')
      .single()
    if (error) throw new Error(`${table}: ${error.message}`)
    parents += 1
    children += await cloneChildrenOnline(src.id as string | number, (data as Row).id as string | number)
  }

  // One bad table must not abort the other fourteen — collect and report.
  const rollTable = async (table: string, rows: Row[]) => {
    const pending = rows.filter((r) => !alreadyRolled(r, runStart, op))
    if (pending.length === 0 && rows.length > 0) return
    try {
      for (const row of pending) await cloneParent(table, row)
    } catch (err) {
      failed.push(err instanceof Error ? err.message : `${table}: unknown error`)
    }
  }

  for (const table of SINGLE_TABLES) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`${table}: ${error.message}`)
      if (data) await rollTable(table, [data as Row])
    } catch (err) {
      failed.push(err instanceof Error ? err.message : `${table}: unknown error`)
    }
  }

  for (const table of MULTI_TABLES) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw new Error(`${table}: ${error.message}`)
      await rollTable(table, ((data ?? []) as Row[]).slice().reverse())
    } catch (err) {
      failed.push(err instanceof Error ? err.message : `${table}: unknown error`)
    }
  }

  return { parents, children, failed }
}

async function rolloverOffline(incidentId: string, op: OpPeriodInput): Promise<RolloverResult> {
  const runStart = new Date().toISOString()
  let parents = 0
  let children = 0
  const failed: string[] = []

  const cloneParent = async (table: string, src: Row) => {
    const inserted = await offInsert(table, { ...freshParent(src, op), incident_id: incidentId })
    parents += 1
    children += await cloneChildrenOffline(String(src.id), inserted.id as string | number)
  }

  const rollTable = async (table: string, rows: Row[]) => {
    const pending = rows.filter((r) => !alreadyRolled(r, runStart, op))
    if (pending.length === 0 && rows.length > 0) return
    try {
      for (const row of pending) await cloneParent(table, row)
    } catch (err) {
      failed.push(err instanceof Error ? err.message : `${table}: unknown error`)
    }
  }

  for (const table of SINGLE_TABLES) {
    try {
      const latest = await offLatest(table, incidentId)
      if (latest) await rollTable(table, [latest as Row])
    } catch (err) {
      failed.push(err instanceof Error ? err.message : `${table}: unknown error`)
    }
  }

  for (const table of MULTI_TABLES) {
    try {
      const rows = await offAll(table, incidentId)
      await rollTable(table, (rows as Row[]).slice().reverse())
    } catch (err) {
      failed.push(err instanceof Error ? err.message : `${table}: unknown error`)
    }
  }

  return { parents, children, failed }
}

/**
 * Starts the next operational period: every form row is cloned forward as a
 * new Draft that keeps its inputs (op-period columns follow the new period).
 * Submitted history is never mutated. Map, manifests and participants stay put.
 */
export async function rolloverOperationalPeriod(
  incidentId: string,
  op: OpPeriodInput,
  offline = false,
): Promise<RolloverResult> {
  if (!op.from_date || !op.to_date) throw new Error('The new period needs a from-date and a to-date.')
  return offline ? rolloverOffline(incidentId, op) : rolloverOnline(incidentId, op)
}
