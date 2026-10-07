import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listOfflineIncidents,
  createOfflineIncident,
  deleteOfflineIncident,
} from '../lib/offline/store'
import { exportOfflineIncident, importOfflineBundle } from '../lib/offline/bundle'
import { getOperatorName, setOperatorName } from '../lib/offline/mode'
import type { OfflineIncident } from '../lib/offline/db'
import './Training.css'

/**
 * Offline Mode home — no login, no server. Incidents live in this device's
 * IndexedDB and move between devices as exported files.
 */
export default function OfflineHome() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<OfflineIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [operator, setOperator] = useState(getOperatorName())
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setRows(await listOfflineIncidents())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Warn when the device is running low on storage (map/IAP images are the bulk).
  const [lowStorage, setLowStorage] = useState('')
  useEffect(() => {
    if (!navigator.storage?.estimate) return
    navigator.storage.estimate().then(({ usage = 0, quota = 0 }) => {
      if (quota > 0 && usage / quota > 0.8) {
        setLowStorage(`Device storage for this app is ${Math.round((usage / quota) * 100)}% full. Export and delete old incidents to free space.`)
      }
    })
  }, [rows])

  const handleCreate = async () => {
    if (!name.trim()) return
    setError('')
    setCreating(true)
    try {
      const row = await createOfflineIncident(name, location)
      setName('')
      setLocation('')
      navigate(`/offline/${row.incident_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the incident.')
      setCreating(false)
    }
  }

  const handleDelete = async (row: OfflineIncident) => {
    if (!window.confirm(`Delete "${row.name}" from this device? Export a file first if you need a copy.`)) return
    setBusyId(row.incident_id)
    await deleteOfflineIncident(row.incident_id)
    setRows((prev) => prev.filter((r) => r.incident_id !== row.incident_id))
    setBusyId(null)
  }

  const handleExport = async (row: OfflineIncident) => {
    setError('')
    setBusyId(row.incident_id)
    try {
      await exportOfflineIncident(row.incident_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the incident.')
    }
    setBusyId(null)
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setNotice('')
    try {
      const row = await importOfflineBundle(file)
      setNotice(`Imported "${row.name}".`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that file.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="training-page">
      <header className="page-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Offline Mode</h1>
            <p>On-device incidents — no account, no connection needed</p>
          </div>
        </div>
        <button className="training-back" onClick={() => navigate('/dashboard')}>Dashboard</button>
      </header>

      <main className="training-main">
        {error && <div className="error-message">{error}</div>}
        {notice && <div className="training-notice">{notice}</div>}
        {lowStorage && <div className="error-message">{lowStorage}</div>}

        <section className="training-panel">
          <h2>Encoder name</h2>
          <p className="training-hint">Stamped on forms you prepare on this device.</p>
          <input
            value={operator}
            onChange={(e) => { setOperator(e.target.value); setOperatorName(e.target.value) }}
            placeholder="Encoder"
          />
        </section>

        <section className="training-panel">
          <h2>New offline incident</h2>
          <div className="training-form">
            <div className="form-group">
              <label htmlFor="off-name">Incident name</label>
              <input
                id="off-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Flood Response Drill"
              />
            </div>
            <div className="form-group">
              <label htmlFor="off-location">Location (optional)</label>
              <input
                id="off-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Barangay I"
              />
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !name.trim()}>
                {creating ? 'Creating…' : 'Create offline incident'}
              </button>
              <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
                Open incident file…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.icsdoc.json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => handleImportFile(e.target.files?.[0])}
              />
            </div>
          </div>
        </section>

        <section className="training-list">
          <h2>On this device</h2>
          {loading ? (
            <p className="training-empty">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="training-empty">No offline incidents yet. Create one above or open an incident file.</p>
          ) : (
            <div className="training-cards">
              {rows.map((row) => (
                <div
                  key={row.incident_id}
                  className="training-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/offline/${row.incident_id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/offline/${row.incident_id}`) }}
                >
                  <div className="training-card-top">
                    <span className="training-status ongoing">Local</span>
                  </div>
                  <h3>{row.name}</h3>
                  <p className="training-card-meta">{row.incident_id}{row.location ? ` · ${row.location}` : ''}</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      className="btn-secondary"
                      disabled={busyId === row.incident_id}
                      onClick={(e) => { e.stopPropagation(); handleExport(row) }}
                    >
                      Export file
                    </button>
                    <button
                      className="btn-secondary"
                      disabled={busyId === row.incident_id}
                      onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
                    >
                      {busyId === row.incident_id ? 'Working…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
