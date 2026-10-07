import { offlineDb, type OfflineIncident, type OfflineRow, type OfflineMapRow, type OfflineIapRow } from './db'
import { deleteOfflineIncident } from './store'

export const OFFLINE_BUNDLE_VERSION = 2
export const OFFLINE_BUNDLE_EXT = 'icsdoc.json'

export interface OfflineBundle {
  bundle: 'ics-offline-incident'
  bundleVersion: number
  appVersion: string
  exportedAt: string
  incident: OfflineIncident
  rows: OfflineRow[]
  maps: OfflineMapRow[]
  iaps: OfflineIapRow[]
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function bundleFilename(incident: OfflineIncident): string {
  const date = (incident.created_at || '').slice(0, 10)
  const safeCode = incident.incident_id.replace(/[^A-Za-z0-9-]+/g, '')
  return `${safeCode}-${date}.${OFFLINE_BUNDLE_EXT}`
}

/** Collect every local row for one incident and download it as a file. */
export async function exportOfflineIncident(incidentId: string): Promise<void> {
  const incident = await offlineDb.incidents.get(incidentId)
  if (!incident) throw new Error('Incident not found on this device.')

  const [rows, maps, iaps] = await Promise.all([
    offlineDb.rows.where('incident_id').equals(incidentId).toArray(),
    offlineDb.maps.where('incident_id').equals(incidentId).toArray(),
    offlineDb.iaps.where('incident_id').equals(incidentId).toArray(),
  ])

  const bundle: OfflineBundle = {
    bundle: 'ics-offline-incident',
    bundleVersion: OFFLINE_BUNDLE_VERSION,
    appVersion: '0.0.0',
    exportedAt: new Date().toISOString(),
    incident,
    rows: rows.map(({ _key: _k, ...rest }) => rest),
    maps,
    iaps,
  }
  downloadText(bundleFilename(incident), JSON.stringify(bundle, null, 2))
}

/**
 * Import a bundle file onto this device. Last-file-wins: any existing local
 * incident with the same id is replaced wholesale — no merging.
 */
export async function importOfflineBundle(file: File): Promise<OfflineIncident> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not a valid incident file.')
  }
  const bundle = parsed as Partial<OfflineBundle>
  if (bundle?.bundle !== 'ics-offline-incident' || !bundle.incident?.incident_id) {
    throw new Error('That file is not an offline incident file.')
  }
  if ((bundle.bundleVersion ?? 0) > OFFLINE_BUNDLE_VERSION) {
    throw new Error('That file was exported by a newer app version. Update this app first.')
  }

  const incident = bundle.incident
  await deleteOfflineIncident(incident.incident_id)
  await offlineDb.incidents.add({ ...incident, updated_at: new Date().toISOString() })

  for (const r of bundle.rows ?? []) {
    await offlineDb.rows.add(r)
  }
  for (const m of bundle.maps ?? []) {
    await offlineDb.maps.add(m)
  }
  for (const i of bundle.iaps ?? []) {
    await offlineDb.iaps.add(i)
  }
  return incident
}
