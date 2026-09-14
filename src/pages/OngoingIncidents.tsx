import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Incident } from '../lib/types'
import './OngoingIncidents.css'

export default function OngoingIncidents() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Edit modal
  const [editing, setEditing] = useState<Incident | null>(null)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editType, setEditType] = useState<'Incident' | 'Planned Event' | 'Training'>('Incident')
  const [editStatus, setEditStatus] = useState<'Ongoing' | 'Closed'>('Ongoing')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchIncidents()
  }, [])

  const fetchIncidents = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setIncidents(data || [])
    }
    setLoading(false)
  }

  const openEdit = (incident: Incident) => {
    setEditing(incident)
    setEditName(incident.name)
    setEditLocation(incident.location)
    setEditType(incident.type)
    setEditStatus(incident.status)
  }

  const handleUpdate = async () => {
    if (!editing) return
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase
      .from('incidents')
      .update({
        name: editName,
        location: editLocation,
        type: editType,
        status: editStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editing.id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setEditing(null)
      fetchIncidents()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this incident?')) return

    setError('')
    const { error: deleteError } = await supabase
      .from('incidents')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      fetchIncidents()
    }
  }

  const isOwner = (incident: Incident) => incident.created_by === user?.id

  return (
    <div className="ongoing-page">
      <header className="page-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <main className="ongoing-main">
        <div className="ongoing-container">
          <div className="ongoing-header">
            <div>
              <h2>Ongoing Incidents</h2>
              <p className="ongoing-subtitle">View, edit, and manage all incidents</p>
            </div>
            <button className="btn-create-new" onClick={() => navigate('/create-incident')}>+ New Incident</button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <p className="loading-text">Loading incidents...</p>
          ) : incidents.length === 0 ? (
            <div className="empty-state">
              <p>No incidents found.</p>
              <button onClick={() => navigate('/create-incident')}>Create your first incident</button>
            </div>
          ) : (
            <div className="incidents-table-wrapper">
              <table className="incidents-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((incident) => (
                    <tr key={incident.id}>
                      <td className="code-cell">{incident.incident_id}</td>
                      <td className="name-cell">{incident.name}</td>
                      <td>{incident.location}</td>
                      <td>
                        <span className={`type-badge ${incident.type.toLowerCase().replace(/\s/g, '-')}`}>
                          {incident.type}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${incident.status.toLowerCase()}`}>
                          {incident.status}
                        </span>
                      </td>
                      <td>{incident.created_by_name}</td>
                      <td className="date-cell">{new Date(incident.created_at).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <button className="btn-checkin" onClick={() => navigate(`/incident/${incident.incident_id}/checkin`)}>
                          Check-in
                        </button>
                        {isOwner(incident) && (
                          <>
                            <button className="btn-edit" onClick={() => openEdit(incident)}>Edit</button>
                            <button className="btn-delete" onClick={() => handleDelete(incident.id)}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button className="btn-back" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </main>

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Incident</h3>
            <p className="modal-id">{editing.incident_id}</p>

            <div className="form-group">
              <label htmlFor="edit-name">Incident Name</label>
              <input
                type="text"
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-location">Location</label>
              <input
                type="text"
                id="edit-location"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-type">Type</label>
              <select
                id="edit-type"
                value={editType}
                onChange={(e) => setEditType(e.target.value as typeof editType)}
              >
                <option value="Incident">Incident</option>
                <option value="Planned Event">Planned Event</option>
                <option value="Training">Training</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edit-status">Status</label>
              <select
                id="edit-status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as typeof editStatus)}
              >
                <option value="Ongoing">Ongoing</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button className="btn-save" onClick={handleUpdate} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
