import Dexie, { type Table } from 'dexie'

/** Offline incident row — same shape as the online `incidents` rows we use. */
export interface OfflineIncident {
  incident_id: string
  name: string
  location: string
  created_at: string
  updated_at: string
}

/** Generic row for every ICS form / child table. Unknown columns ride along. */
export interface OfflineRow {
  id?: string | number
  incident_id?: string
  form_id?: string
  manifest_id?: string
  sort_order?: number
  status?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface OfflineMapRow {
  incident_id: string
  map_type: string
  map_image: string | null
  sketch_markers: unknown
  live_markers: unknown
  sketch_shapes: unknown
  live_shapes: unknown
  custom_symbols: unknown
  center_lat: number
  center_lng: number
  zoom: number
  updated_at: string
}

export interface OfflineIapRow {
  id: string
  incident_id: string
  cover_image: string | null
  status: 'Draft' | 'Submitted' | 'Approved'
  operational_period: string
  op_period_from_date: string
  op_period_from_time: string
  op_period_to_date: string
  op_period_to_time: string
  snapshot: unknown
  approved_at: string | null
  approved_by: string
  submitted_at: string | null
  created_at: string
  updated_at: string
}

class OfflineDb extends Dexie {
  incidents!: Table<OfflineIncident, string>
  rows!: Table<OfflineRow, string | number>
  maps!: Table<OfflineMapRow, string>
  iaps!: Table<OfflineIapRow, string>

  constructor() {
    super('ics-offline')
    // v1 (P1 build): dedicated 211 stores. Kept so existing devices upgrade cleanly.
    this.version(1).stores({
      incidents: 'incident_id, updated_at',
      ics211forms: 'id, incident_id, created_at',
      ics211resources: '++id, form_id, sort_order',
    })
    // v2: one generic store for every form/child table (`table` discriminates).
    this.version(2)
      .stores({
        incidents: 'incident_id, updated_at',
        ics211forms: null,
        ics211resources: null,
        rows: '++_key, id, incident_id, form_id, manifest_id, table, status, created_at',
        maps: 'incident_id',
        iaps: 'id, incident_id, status, created_at',
      })
      .upgrade(async (tx) => {
        // Carry any P1 ICS 211 data into the generic store.
        const forms = await tx.table('ics211forms').toArray()
        const resources = await tx.table('ics211resources').toArray()
        for (const f of forms) {
          await tx.table('rows').add({ ...f, table: 'ics_211_forms' })
        }
        for (const r of resources) {
          const { id: _id, ...rest } = r
          const parent = forms.find((f: { id: string }) => f.id === r.form_id)
          await tx.table('rows').add({
            ...rest,
            table: 'ics_211_resources',
            incident_id: parent?.incident_id,
          })
        }
      })
  }
}

export const offlineDb = new OfflineDb()

export function newId(): string {
  return crypto.randomUUID()
}
