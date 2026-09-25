import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadIcs204List } from '../lib/ics204'
import type { Ics204Summary } from '../lib/types'
import './Ics204List.css'

export default function Ics204List() {
  const { id: incidentId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [items, setItems] = useState<Ics204Summary[]>([])
  const [incidentName, setIncidentName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadList = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)
    setError('')
    const [incidentRes, list] = await Promise.all([
      supabase.from('incidents').select('name').eq('incident_id', incidentId).single(),
      loadIcs204List(incidentId),
    ])
    if (incidentRes.data) setIncidentName(incidentRes.data.name)
    setItems(list)
    setLoading(false)
  }, [incidentId])

  useEffect(() => {
    loadList()
  }, [loadList])

  const instanceLabel = (item: Ics204Summary) =>
    item.division || item.group_name || item.branch || 'Untitled'

  const handleDelete = async (formId: string) => {
    if (!confirm('Are you sure you want to delete this assignment list?')) return
    setError('')
    // children first so deletion works regardless of FK cascade
    const { error: rowsError } = await supabase.from('ics_204_rows').delete().eq('form_id', formId)
    if (rowsError) { setError(rowsError.message); return }
    const { error: delError } = await supabase.from('ics_204_forms').delete().eq('id', formId)
    if (delError) { setError(delError.message); return }
    setItems((prev) => prev.filter((i) => i.id !== formId))
  }

  if (loading) {
    return (
      <div className="ics204list-page">
        <div className="ics204list-loading">Loading assignment lists...</div>
      </div>
    )
  }

  return (
    <div className="ics204list-page">
      <header className="ics204list-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics204list-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
          <span className="form-badge">ICS 204</span>
          <span className="list-title">Assignment Lists{incidentName ? ` — ${incidentName}` : ''}</span>
        </div>
        <div className="topbar-actions">
          <button className="action-btn submit" onClick={() => navigate(`/incident/${incidentId}/ics-204/edit?new=1`)}>
            + New Assignment List
          </button>
        </div>
      </div>

      <main className="ics204list-main no-print">
        <div className="ics204list-container">
          {error && <div className="error-message">{error}</div>}

          {items.length === 0 ? (
            <div className="empty-state">
              <p>No assignment lists yet.</p>
              <p className="empty-hint">Create one ICS 204 for each Branch, Division, or Group assignment in this incident.</p>
              <button className="action-btn submit" onClick={() => navigate(`/incident/${incidentId}/ics-204/edit?new=1`)}>
                + New Assignment List
              </button>
            </div>
          ) : (
            <div className="ics204list-table-wrapper">
              <table className="ics204list-table">
                <thead>
                  <tr>
                    <th>Division / Group</th>
                    <th>Branch</th>
                    <th>Staging Area</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="label-cell">{instanceLabel(item)}</td>
                      <td>{item.branch || '—'}</td>
                      <td>{item.staging_area || '—'}</td>
                      <td>
                        <span className={`list-status-badge ${item.status.toLowerCase()}`}>{item.status}</span>
                      </td>
                      <td className="date-cell">{new Date(item.updated_at).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <button
                          className="list-btn edit"
                          onClick={() => navigate(`/incident/${incidentId}/ics-204/edit?form=${item.id}`)}
                        >
                          Edit
                        </button>
                        <button className="list-btn delete" onClick={() => handleDelete(item.id)}>
                          Delete
                        </button>
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
