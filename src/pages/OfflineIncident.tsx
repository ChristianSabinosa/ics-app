import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getOfflineIncident,
  offAll,
  offLatest,
  offGetMap,
  offListIaps,
} from '../lib/offline/store'
import { exportOfflineIncident } from '../lib/offline/bundle'
import type { OfflineIncident as OfflineIncidentRow, OfflineIapRow } from '../lib/offline/db'
import IapCoverModal, { type IapStatus } from '../components/IapCoverModal'
import './Training.css'

interface FormEntry {
  key: string
  name: string
  path: string
  table?: string
  /** Many instances per incident — show a count instead of a status. */
  multi?: boolean
}

const FORMS: FormEntry[] = [
  { key: '201', name: 'ICS 201 — Incident Briefing', path: 'ics-201', table: 'ics_201_forms' },
  { key: '202', name: 'ICS 202 — Incident Objectives', path: 'ics-202', table: 'ics_202_forms' },
  { key: '203', name: 'ICS 203 — Organization Assignment List', path: 'ics-203', table: 'ics_203_forms' },
  { key: '204', name: 'ICS 204 — Assignment List', path: 'ics-204', table: 'ics_204_forms', multi: true },
  { key: '205', name: 'ICS 205 — Communications Plan', path: 'ics-205', table: 'ics_205_forms' },
  { key: '206', name: 'ICS 206 — Medical Plan', path: 'ics-206', table: 'ics_206_forms' },
  { key: '207', name: 'ICS 207 — Incident Organization Chart', path: 'ics-207', table: 'ics_207_forms' },
  { key: '208', name: 'ICS 208 — Safety Message/Plan', path: 'ics-208', table: 'ics_208_forms' },
  { key: '209', name: 'ICS 209 — Incident Status Summary', path: 'ics-209', table: 'ics_209_forms' },
  { key: '211', name: 'ICS 211 — Incident Check-in List', path: 'ics-211', table: 'ics_211_forms' },
  { key: '213', name: 'ICS 213 — General Message', path: 'ics-213', table: 'ics_213_forms' },
  { key: '214', name: 'ICS 214 — Activity Log', path: 'ics-214', table: 'ics_214_forms', multi: true },
  { key: '215', name: 'ICS 215 — Operational Planning Worksheet', path: 'ics-215', table: 'ics_215_forms' },
  { key: '215A', name: 'ICS 215-A — Safety/Risk/Health Analysis', path: 'ics-215a', table: 'ics_215a_forms' },
  { key: '221', name: 'ICS 221 — Demobilization Check-out', path: 'ics-221', table: 'ics_221_forms', multi: true },
  { key: 'MAP', name: 'Incident Map', path: 'incident-map' },
]

/** Forms that must be Submitted (and the map saved) before an IAP can be built. */
const IAP_REQUIREMENTS = ['202', '203', '204', '205', '206', '208', 'MAP']

/**
 * Offline incident workspace: the same forms as an online incident, stored on
 * this device. Everything leaves the device as an exported file.
 */
export default function OfflineIncident() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [incident, setIncident] = useState<OfflineIncidentRow | null>(null)
  const [error, setError] = useState('')
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [checkinCount, setCheckinCount] = useState(0)
  const [iaps, setIaps] = useState<OfflineIapRow[]>([])
  const [showIapModal, setShowIapModal] = useState(false)
  const [, setIapStatus] = useState<IapStatus>('')

  const refresh = useCallback(async () => {
    if (!id) return
    const row = await getOfflineIncident(id)
    if (!row) {
      setError('Offline incident not found on this device.')
      return
    }
    setIncident(row)

    const nextStatuses: Record<string, string> = {}
    const nextCounts: Record<string, number> = {}
    for (const f of FORMS) {
      if (!f.table) continue
      if (f.multi) {
        const all = await offAll(f.table, id)
        nextCounts[f.key] = all.length
        nextStatuses[f.key] = all.some(r => r.status === 'Submitted') ? 'Submitted' : all.length ? 'Draft' : ''
      } else {
        const latest = await offLatest(f.table, id)
        nextStatuses[f.key] = (latest?.status as string) || ''
      }
    }
    const map = await offGetMap(id)
    nextStatuses['MAP'] = map?.map_image ? 'Saved' : ''
    setStatuses(nextStatuses)
    setCounts(nextCounts)

    setCheckinCount((await offAll('checkin_manifests', id)).length)
    setIaps(await offListIaps(id))
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  const handleExport = async () => {
    if (!incident) return
    try {
      await exportOfflineIncident(incident.incident_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the incident.')
    }
  }

  if (error) {
    return (
      <div className="training-page">
        <main className="training-main">
          <div className="error-message">{error}</div>
          <button className="btn-secondary" onClick={() => navigate('/offline')}>Back to Offline Mode</button>
        </main>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="training-page">
        <main className="training-main">
          <p className="training-empty">Loading…</p>
        </main>
      </div>
    )
  }

  const base = `/offline/${incident.incident_id}`
  const requirementMet = (key: string) => (key === 'MAP' ? statuses.MAP === 'Saved' : statuses[key] === 'Submitted')
  const metCount = IAP_REQUIREMENTS.filter(requirementMet).length
  const iapReady = metCount === IAP_REQUIREMENTS.length
  const workingIap = iaps.find(i => i.status !== 'Approved')
  const approvedIaps = iaps.filter(i => i.status === 'Approved')

  return (
    <div className="training-page">
      <header className="page-header">
        <div className="header-brand" onClick={() => navigate('/offline')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>{incident.name}</h1>
            <p>{incident.incident_id}{incident.location ? ` · ${incident.location}` : ''} · stored on this device</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="training-back" onClick={handleExport}>Export file</button>
          <button className="training-back" onClick={() => navigate('/offline')}>Offline home</button>
        </div>
      </header>

      <main className="training-main">
        <section className="training-panel">
          <h2>Check-in</h2>
          <p className="training-hint">
            {checkinCount === 0 ? 'No check-in manifests recorded yet.' : `${checkinCount} manifest(s) recorded.`}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => navigate(`${base}/checkin`)}>New check-in manifest</button>
            {checkinCount > 0 && (
              <button className="btn-secondary" onClick={() => navigate(`${base}/checkin/view`)}>View latest</button>
            )}
          </div>
        </section>

        <section className="training-list">
          <h2>ICS forms</h2>
          <div className="training-cards">
            {FORMS.map(f => {
              const status = statuses[f.key] || ''
              const label = status || 'Not started'
              return (
                <div
                  key={f.key}
                  className="training-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`${base}/${f.path}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`${base}/${f.path}`) }}
                >
                  <div className="training-card-top">
                    <span className={`training-status ${status === 'Submitted' || status === 'Saved' ? 'ongoing' : status === 'Draft' ? 'setup' : 'closed'}`}>
                      {label}
                    </span>
                    {f.multi && counts[f.key] ? <span className="training-role trainee">×{counts[f.key]}</span> : null}
                  </div>
                  <h3>{f.name}</h3>
                </div>
              )
            })}
          </div>
        </section>

        <section className="training-panel">
          <h2>Incident Action Plan</h2>
          <p className="training-hint">
            Requires submitted ICS 202, 203, 204, 205, 206, 208 and a saved incident map — {metCount} of {IAP_REQUIREMENTS.length} ready.
          </p>
          <div className="training-progress-bar">
            <span style={{ width: `${Math.round((metCount / IAP_REQUIREMENTS.length) * 100)}%` }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            <button className="btn-primary" disabled={!iapReady} onClick={() => setShowIapModal(true)}>
              {workingIap ? 'Update cover page / Generate IAP' : 'Generate IAP'}
            </button>
            {workingIap?.status === 'Submitted' && (
              <button className="btn-secondary" onClick={() => navigate(`${base}/iap/${workingIap.id}`)}>Review IAP</button>
            )}
          </div>

          {approvedIaps.length > 0 && (
            <>
              <h3 style={{ marginTop: '16px' }}>Approved IAPs</h3>
              <div className="training-ann-list">
                {approvedIaps.map(i => (
                  <div key={i.id} className="training-ann-item">
                    <button className="training-ann-head" onClick={() => navigate(`${base}/iap/${i.id}`)}>
                      <strong>{i.operational_period || 'IAP'}</strong>
                      <span>{i.approved_at ? new Date(i.approved_at).toLocaleString() : ''}</span>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      {showIapModal && (
        <IapCoverModal
          incidentId={incident.incident_id}
          incidentName={incident.name}
          onClose={() => { setShowIapModal(false); refresh() }}
          onStatusChange={setIapStatus}
          onProceed={(iapId) => {
            setShowIapModal(false)
            navigate(`${base}/iap/${iapId}`)
          }}
        />
      )}
    </div>
  )
}
