import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isOfflinePath } from '../lib/offline/mode'
import { getOfflineIncident, offAll, offDelete, touchOfflineIncident } from '../lib/offline/store'
import type { Ics214Summary } from '../lib/types'
import { useFormAccess } from '../components/FormAccess'
import './Ics214List.css'

export default function Ics214List() {
  const { id: incidentId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canEdit } = useFormAccess()

  // Offline Mode (/offline/...): list from the local IndexedDB store.
  const offMode = isOfflinePath(useLocation().pathname)
  const homePath = offMode ? `/offline/${incidentId}` : `/incident/${incidentId}`

  const [items, setItems] = useState<Ics214Summary[]>([])
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
        offAll('ics_214_forms', incidentId),
      ])
      if (offIncident) setIncidentName(offIncident.name)
      rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      setItems(rows as unknown as Ics214Summary[])
      setLoading(false)
      return
    }
    const [incidentRes, listRes] = await Promise.all([
      supabase.from('incidents').select('name').eq('incident_id', incidentId).single(),
      supabase
        .from('ics_214_forms')
        .select('id, name, ics_position, op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time, status, created_at, updated_at')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false }),
    ])
    if (incidentRes.data) setIncidentName(incidentRes.data.name)
    if (listRes.error) setError(listRes.error.message)
    setItems((listRes.data ?? []) as Ics214Summary[])
    setLoading(false)
  }, [incidentId, offMode])

  useEffect(() => {
    loadList()
  }, [loadList])

  const formatOpPeriod = (item: Ics214Summary) => {
    const fmt = (date?: string, time?: string) => {
      const d = date ? new Date(`${date}T00:00:00`).toLocaleDateString() : ''
      return [d, time || ''].filter(Boolean).join(' ')
    }
    const from = fmt(item.op_period_from_date, item.op_period_from_time)
    const to = fmt(item.op_period_to_date, item.op_period_to_time)
    if (!from && !to) return '—'
    return `${from || '—'} to ${to || '—'}`
  }

  const handleDelete = async (formId: string) => {
    if (!canEdit) return
    if (!confirm('Are you sure you want to delete this activity log?')) return
    setError('')
    if (offMode) {
      try {
        await offDelete('ics_214_forms', formId)
        if (incidentId) await touchOfflineIncident(incidentId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete the activity log.')
        return
      }
      setItems((prev) => prev.filter((i) => i.id !== formId))
      return
    }
    const { error: delError } = await supabase.from('ics_214_forms').delete().eq('id', formId)
    if (delError) { setError(delError.message); return }

    // A delete silently blocked by RLS reports no error — verify the row is gone.
    const { data: stillThere } = await supabase
      .from('ics_214_forms')
      .select('id')
      .eq('id', formId)
      .maybeSingle()
    if (stillThere) {
      setError('This activity log could not be deleted — the database is not yet allowing deletes on ICS 214 forms (ics_214_forms). Ask your administrator to add a delete policy for that table in Supabase.')
      return
    }

    setItems((prev) => prev.filter((i) => i.id !== formId))
  }

  if (loading) {
    return (
      <div className="ics214list-page">
        <div className="ics214list-loading">Loading activity logs...</div>
      </div>
    )
  }

  return (
    <div className="ics214list-page">
      <header className="ics214list-header no-print">
        <div className="header-brand" onClick={() => navigate(homePath)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics214list-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(homePath)}>&larr; Back</button>
          <span className="form-badge">ICS 214</span>
          <span className="list-title">Activity Logs{incidentName ? ` — ${incidentName}` : ''}</span>
        </div>
        <div className="topbar-actions">
          {!canEdit && <span className="view-only-badge">View only</span>}
          {canEdit && (
            <button className="action-btn submit" onClick={() => navigate(`${homePath}/ics-214/edit?new=1`)}>
              + New Activity Log
            </button>
          )}
        </div>
      </div>

      <main className="ics214list-main no-print">
        <div className="ics214list-container">
          {error && <div className="error-message">{error}</div>}

          {items.length === 0 ? (
            <div className="empty-state">
              <p>No activity logs yet.</p>
              <p className="empty-hint">Create one ICS 214 for each operational period or team keeping its own activity log.</p>
              {canEdit && (
                <button className="action-btn submit" onClick={() => navigate(`${homePath}/ics-214/edit?new=1`)}>
                  + New Activity Log
                </button>
              )}
            </div>
          ) : (
            <div className="ics214list-table-wrapper">
              <table className="ics214list-table">
                <thead>
                  <tr>
                    <th>Prepared By</th>
                    <th>Operational Period</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="label-cell">{item.name || 'Untitled activity log'}</td>
                      <td className="date-cell">{formatOpPeriod(item)}</td>
                      <td>
                        <span className={`list-status-badge ${item.status.toLowerCase()}`}>{item.status}</span>
                      </td>
                      <td className="date-cell">{new Date(item.updated_at).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <button
                          className="list-btn view"
                          onClick={() => navigate(`${homePath}/ics-214/edit?form=${item.id}&view=1`)}
                        >
                          View
                        </button>
                        {canEdit && (
                          <>
                            <button
                              className="list-btn edit"
                              onClick={() => navigate(`${homePath}/ics-214/edit?form=${item.id}`)}
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
