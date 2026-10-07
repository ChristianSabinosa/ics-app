import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isOfflinePath } from '../lib/offline/mode'
import { getOfflineIncident, offAll, offDelete, touchOfflineIncident } from '../lib/offline/store'
import type { Ics221Summary } from '../lib/types'
import { useFormAccess } from '../components/FormAccess'
import './Ics221List.css'

export default function Ics221List() {
  const { id: incidentId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canEdit } = useFormAccess()

  // Offline Mode (/offline/...): list from the local IndexedDB store.
  const offMode = isOfflinePath(useLocation().pathname)
  const homePath = offMode ? `/offline/${incidentId}` : `/incident/${incidentId}`

  const [items, setItems] = useState<Ics221Summary[]>([])
  const [incidentName, setIncidentName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadList = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)
    setError('')
    if (offMode) {
      const [offIncident, rows] = await Promise.all([
        getOfflineIncident(incidentId),
        offAll('ics_221_forms', incidentId),
      ])
      if (offIncident) setIncidentName(offIncident.name)
      rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      setItems(rows as unknown as Ics221Summary[])
      setLoading(false)
      return
    }
    const [incidentRes, listRes] = await Promise.all([
      supabase.from('incidents').select('name').eq('incident_id', incidentId).single(),
      supabase
        .from('ics_221_forms')
        .select('id, resource_to_release, planned_release_date, planned_release_time, status, created_at, updated_at')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false }),
    ])
    if (incidentRes.data) setIncidentName(incidentRes.data.name)
    if (listRes.error) setError(listRes.error.message)
    setItems((listRes.data ?? []) as Ics221Summary[])
    setLoading(false)
  }, [incidentId, offMode])

  useEffect(() => {
    loadList()
  }, [loadList])

  const formatRelease = (item: Ics221Summary) => {
    if (!item.planned_release_date) return '—'
    const date = new Date(`${item.planned_release_date}T00:00:00`).toLocaleDateString()
    return item.planned_release_time ? `${date} ${item.planned_release_time}` : date
  }

  const handleDelete = async (formId: string) => {
    if (!canEdit) return
    if (!confirm('Are you sure you want to delete this demobilization check-out?')) return
    setError('')
    if (offMode) {
      try {
        await offDelete('ics_221_forms', formId)
        if (incidentId) await touchOfflineIncident(incidentId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete the check-out.')
        return
      }
      setItems((prev) => prev.filter((i) => i.id !== formId))
      return
    }
    const { error: delError } = await supabase.from('ics_221_forms').delete().eq('id', formId)
    if (delError) { setError(delError.message); return }

    // A delete silently blocked by RLS reports no error — verify the row is gone.
    const { data: stillThere } = await supabase
      .from('ics_221_forms')
      .select('id')
      .eq('id', formId)
      .maybeSingle()
    if (stillThere) {
      setError('This check-out could not be deleted. Run supabase-leave-schema.sql in the Supabase SQL Editor to enable deleting ICS 221 forms.')
      return
    }

    setItems((prev) => prev.filter((i) => i.id !== formId))
  }

  if (loading) {
    return (
      <div className="ics221list-page">
        <div className="ics221list-loading">Loading demobilization check-outs...</div>
      </div>
    )
  }

  return (
    <div className="ics221list-page">
      <header className="ics221list-header no-print">
        <div className="header-brand" onClick={() => navigate(homePath)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics221list-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(homePath)}>&larr; Back</button>
          <span className="form-badge">ICS 221</span>
          <span className="list-title">Demobilization Check-outs{incidentName ? ` — ${incidentName}` : ''}</span>
        </div>
        <div className="topbar-actions">
          {!canEdit && <span className="view-only-badge">View only</span>}
          {canEdit && (
            <button className="action-btn submit" onClick={() => navigate(`${homePath}/ics-221/edit?new=1`)}>
              + New Demobilization Check-out
            </button>
          )}
        </div>
      </div>

      <main className="ics221list-main no-print">
        <div className="ics221list-container">
          {error && <div className="error-message">{error}</div>}

          {items.length === 0 ? (
            <div className="empty-state">
              <p>No demobilization check-outs yet.</p>
              <p className="empty-hint">Create one ICS 221 for each resource or team being released from this incident.</p>
              {canEdit && (
                <button className="action-btn submit" onClick={() => navigate(`${homePath}/ics-221/edit?new=1`)}>
                  + New Demobilization Check-out
                </button>
              )}
            </div>
          ) : (
            <div className="ics221list-table-wrapper">
              <table className="ics221list-table">
                <thead>
                  <tr>
                    <th>Resource to be Released</th>
                    <th>Planned Release</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="label-cell">{item.resource_to_release || 'Untitled resource'}</td>
                      <td className="date-cell">{formatRelease(item)}</td>
                      <td>
                        <span className={`list-status-badge ${item.status.toLowerCase()}`}>{item.status}</span>
                      </td>
                      <td className="date-cell">{new Date(item.updated_at).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <button
                          className="list-btn view"
                          onClick={() => navigate(`${homePath}/ics-221/edit?form=${item.id}&view=1`)}
                        >
                          View
                        </button>
                        {canEdit && (
                          <>
                            <button
                              className="list-btn edit"
                              onClick={() => navigate(`${homePath}/ics-221/edit?form=${item.id}`)}
                            >
                              Edit
                            </button>
                            <button className="list-btn delete" onClick={() => handleDelete(item.id)}>
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
