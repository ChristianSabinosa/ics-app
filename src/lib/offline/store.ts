import { offlineDb, newId, type OfflineRow, type OfflineIncident, type OfflineMapRow, type OfflineIapRow } from './db'

/**
 * Minimal local mirror of the Supabase queries the forms make. Every ICS
 * form and child table lives in one generic store, discriminated by `table`.
 */

interface RowFilter {
  table: string
  incident_id?: string
  form_id?: string
  manifest_id?: string
  status?: string
}

async function queryRows(filter: RowFilter): Promise<OfflineRow[]> {
  let coll = offlineDb.rows.where('table').equals(filter.table)
  if (filter.incident_id) {
    coll = offlineDb.rows.where('table').equals(filter.table)
      .and(r => r.incident_id === filter.incident_id)
  }
  if (filter.form_id) {
    coll = offlineDb.rows.where('table').equals(filter.table)
      .and(r => r.form_id === filter.form_id)
  }
  if (filter.manifest_id) {
    coll = offlineDb.rows.where('table').equals(filter.table)
      .and(r => r.manifest_id === filter.manifest_id)
  }
  if (filter.status) {
    coll = coll.and(r => r.status === filter.status)
  }
  return coll.toArray()
}

export async function offAll(table: string, incidentId: string): Promise<OfflineRow[]> {
  return queryRows({ table, incident_id: incidentId })
}

export async function offLatest(table: string, incidentId: string): Promise<OfflineRow | undefined> {
  const rows = await queryRows({ table, incident_id: incidentId })
  rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return rows[0]
}

export async function offGet(table: string, id: string | number): Promise<OfflineRow | undefined> {
  return offlineDb.rows.where('table').equals(table).and(r => r.id === id).first()
}

export async function offChildren(table: string, formId: string): Promise<OfflineRow[]> {
  const rows = await queryRows({ table, form_id: formId })
  rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return rows
}

export async function offInsert(
  table: string,
  data: Record<string, unknown>,
  withId = true,
): Promise<OfflineRow> {
  const now = new Date().toISOString()
  const row: OfflineRow = {
    ...data,
    table,
    id: withId ? (data.id as string) ?? newId() : undefined,
    created_at: (data.created_at as string) ?? now,
    updated_at: now,
  }
  await offlineDb.rows.add(row as OfflineRow & { _key?: number })
  return row
}

export async function offUpdate(
  table: string,
  id: string | number,
  data: Record<string, unknown>,
): Promise<void> {
  await offlineDb.rows.where('table').equals(table).and(r => r.id === id).modify({
    ...data,
    updated_at: new Date().toISOString(),
  })
}

export async function offDelete(table: string, id: string | number): Promise<void> {
  await offlineDb.rows.where('table').equals(table).and(r => r.id === id).delete()
}

export async function offDeleteChildren(table: string, formId: string): Promise<void> {
  await offlineDb.rows.where('table').equals(table).and(r => r.form_id === formId).delete()
}

export async function offDeleteWhere(table: string, incidentId: string): Promise<void> {
  await offlineDb.rows.where('table').equals(table).and(r => r.incident_id === incidentId).delete()
}

/**
 * Submitted check-in manifests for an incident (oldest first), each with its
 * personnel rows attached — the local twin of the `checkin_manifests` +
 * `checkin_personnel` queries the 201/211 "copy from check-in" code runs online.
 * Drafts are ignored.
 */
export async function offSubmittedManifests(
  incidentId: string,
): Promise<{ manifest: OfflineRow; personnel: OfflineRow[] }[]> {
  const manifests = (await offAll('checkin_manifests', incidentId)).filter(m => m.status === 'Submitted')
  manifests.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  const personnel = await offAll('checkin_personnel', incidentId)
  return manifests.map(manifest => ({
    manifest,
    personnel: personnel.filter(p => p.manifest_id === manifest.id),
  }))
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export async function listOfflineIncidents(): Promise<OfflineIncident[]> {
  return offlineDb.incidents.orderBy('updated_at').reverse().toArray()
}

export async function createOfflineIncident(name: string, location: string): Promise<OfflineIncident> {
  const now = new Date().toISOString()
  const row: OfflineIncident = {
    incident_id: newId(),
    name: name.trim(),
    location: location.trim(),
    created_at: now,
    updated_at: now,
  }
  await offlineDb.incidents.add(row)
  return row
}

export async function getOfflineIncident(incidentId: string): Promise<OfflineIncident | undefined> {
  return offlineDb.incidents.get(incidentId)
}

export async function touchOfflineIncident(incidentId: string): Promise<void> {
  await offlineDb.incidents.update(incidentId, { updated_at: new Date().toISOString() })
}

export async function deleteOfflineIncident(incidentId: string): Promise<void> {
  await offlineDb.rows.where('incident_id').equals(incidentId).delete()
  await offlineDb.maps.where('incident_id').equals(incidentId).delete()
  await offlineDb.iaps.where('incident_id').equals(incidentId).delete()
  await offlineDb.incidents.delete(incidentId)
}

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

export async function offGetMap(incidentId: string) {
  return offlineDb.maps.get(incidentId)
}

export async function offUpsertMap(incidentId: string, payload: Record<string, unknown>): Promise<void> {
  const existing = await offlineDb.maps.get(incidentId)
  if (existing) {
    await offlineDb.maps.update(incidentId, { ...payload, updated_at: new Date().toISOString() })
  } else {
    await offlineDb.maps.add({ incident_id: incidentId, ...payload, updated_at: new Date().toISOString() } as OfflineMapRow)
  }
}

// ---------------------------------------------------------------------------
// IAPs
// ---------------------------------------------------------------------------

export async function offListIaps(incidentId: string) {
  const rows = await offlineDb.iaps.where('incident_id').equals(incidentId).toArray()
  rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return rows
}

export async function offGetIap(iapId: string) {
  return offlineDb.iaps.get(iapId)
}

export async function offUpsertIap(iapId: string, payload: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString()
  const existing = await offlineDb.iaps.get(iapId)
  if (existing) {
    await offlineDb.iaps.update(iapId, { ...payload, updated_at: now })
  } else {
    await offlineDb.iaps.add({ id: iapId, created_at: now, updated_at: now, ...payload } as OfflineIapRow)
  }
}
