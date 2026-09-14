import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { generateRoleId } from '../lib/utils'
import type { Incident, IncidentParticipant } from '../lib/types'
import ConfirmModal from '../components/ConfirmModal'
import './IncidentPage.css'

export default function IncidentPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [incident, setIncident] = useState<Incident | null>(null)
  const [participant, setParticipant] = useState<IncidentParticipant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showRolePicker, setShowRolePicker] = useState(false)
  const [showConfirmChange, setShowConfirmChange] = useState(false)
  const [pendingNewRole, setPendingNewRole] = useState<'IMT' | 'Tactical Resources' | 'Observer' | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (id) fetchData()
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    setError('')

    const { data: incidentData, error: incidentError } = await supabase
      .from('incidents')
      .select('*')
      .eq('incident_id', id)
      .single()

    if (incidentError || !incidentData) {
      setError('Incident not found.')
      setLoading(false)
      return
    }

    setIncident(incidentData)

    if (user) {
      const { data: participantData } = await supabase
        .from('incident_participants')
        .select('*')
        .eq('incident_id', id)
        .eq('user_id', user.id)
        .eq('status', 'Active')
        .order('joined_at', { ascending: false })
        .limit(1)
        .single()

      setParticipant(participantData)
    }

    setLoading(false)
  }

  const handleLeaveIncident = async () => {
    if (!participant) return
    setProcessing(true)

    const { error: updateError } = await supabase
      .from('incident_participants')
      .update({
        status: 'Left',
        left_at: new Date().toISOString(),
      })
      .eq('id', participant.id)

    setProcessing(false)
    setShowLeaveModal(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    navigate('/dashboard')
  }

  const handlePickRole = (newRole: 'IMT' | 'Tactical Resources' | 'Observer') => {
    if (newRole === role) return
    setPendingNewRole(newRole)
    setShowRolePicker(false)
    setShowConfirmChange(true)
  }

  const handleChangeRoleConfirm = async () => {
    if (!participant || !user || !pendingNewRole) return
    setProcessing(true)

    const { error: updateError } = await supabase
      .from('incident_participants')
      .update({
        status: 'Left',
        left_at: new Date().toISOString(),
      })
      .eq('id', participant.id)

    if (updateError) {
      setError(updateError.message)
      setProcessing(false)
      setShowConfirmChange(false)
      return
    }

    const newRoleId = generateRoleId(pendingNewRole)
    const { error: insertError } = await supabase
      .from('incident_participants')
      .insert({
        incident_id: participant.incident_id,
        user_id: user.id,
        user_name: participant.user_name,
        user_email: participant.user_email,
        role: pendingNewRole,
        role_id: newRoleId,
        status: 'Active',
      })

    setProcessing(false)
    setShowConfirmChange(false)
    setPendingNewRole(null)

    if (insertError) {
      setError(insertError.message)
      return
    }

    navigate(`/incident/${participant.incident_id}?role=${encodeURIComponent(pendingNewRole)}`)
  }

  if (loading) {
    return (
      <div className="incident-page">
        <div className="incident-loading">Loading incident...</div>
      </div>
    )
  }

  if (error || !incident) {
    return (
      <div className="incident-page">
        <div className="incident-error">
          <p>{error || 'Incident not found.'}</p>
          <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    )
  }

  const role = participant?.role || searchParams.get('role') || 'Observer'
  const roleId = participant?.role_id || ''
  const isIMTOrTactical = role === 'IMT' || role === 'Tactical Resources'

  return (
    <div className="incident-page">
      <header className="incident-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="incident-topbar">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate('/join-incident')}>
            &larr; Back
          </button>
          <div className="topbar-info">
            <span className="incident-code-badge">{incident.incident_id}</span>
            <span className={`role-badge ${role.toLowerCase().replace(/\s/g, '-')}`}>{role}</span>
            {roleId && <span className="role-id-badge">{roleId}</span>}
          </div>
        </div>
        <div className="topbar-actions">
          <button className="topbar-btn change-role" disabled={processing} onClick={() => setShowRolePicker(true)}>
            Change Role
          </button>
          <button className="topbar-btn leave" disabled={processing} onClick={() => setShowLeaveModal(true)}>
            Leave Incident
          </button>
        </div>
      </div>

      <main className="incident-main">
        <div className="incident-container">
          <div className="incident-info-bar">
            <h2>{incident.name}</h2>
            <p className="incident-location-text">{incident.location}</p>
            <div className="incident-meta-row">
              <span>Type: {incident.type}</span>
              <span>Created by {incident.created_by_name}</span>
              <span>{new Date(incident.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {isIMTOrTactical ? (
            <div className="incident-content">
              <h3>Check-in Manifest</h3>
              <p className="placeholder-text">
                Proceed to the check-in form to check in personnel, vehicles, and equipment resources.
              </p>
              <button
                className="checkin-proceed-btn"
                onClick={() => navigate(`/incident/${incident.incident_id}/checkin`)}
              >
                Proceed to Check-in
              </button>
            </div>
          ) : (
            <div className="incident-content">
              <h3>Incident Overview</h3>
              <p className="placeholder-text">
                Incident overview and summary will be displayed here. As an Observer, you have read-only access to incident information.
              </p>
            </div>
          )}
        </div>
      </main>

      {showLeaveModal && (
        <ConfirmModal
          title="Leave Incident"
          message={`Are you sure you want to leave incident ${incident.incident_id}? Enter your password to confirm.`}
          onConfirm={handleLeaveIncident}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}

      {showRolePicker && (
        <div className="modal-overlay" onClick={() => setShowRolePicker(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Change Role</h3>
            <p className="modal-message">
              Select a new role for incident {incident.incident_id}. Your current role ({role}) will be deactivated.
            </p>
            <div className="role-picker-buttons">
              {(['IMT', 'Tactical Resources', 'Observer'] as const).map((r) => (
                <button
                  key={r}
                  className={`role-picker-btn ${r.toLowerCase().replace(/\s/g, '-')} ${r === role ? 'current' : ''}`}
                  disabled={r === role}
                  onClick={() => handlePickRole(r)}
                >
                  {r === role ? `${r} (Current)` : r}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowRolePicker(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmChange && pendingNewRole && (
        <ConfirmModal
          title="Confirm Role Change"
          message={`Enter your password to confirm changing from ${role} to ${pendingNewRole}.`}
          onConfirm={handleChangeRoleConfirm}
          onCancel={() => {
            setShowConfirmChange(false)
            setPendingNewRole(null)
          }}
        />
      )}
    </div>
  )
}
