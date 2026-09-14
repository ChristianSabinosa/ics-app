import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { generateRoleId } from '../lib/utils'
import type { Incident, IncidentParticipant, CheckinManifest, CheckinPersonnel, CheckinVehicle, CheckinEquipment } from '../lib/types'
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

  const [manifests, setManifests] = useState<CheckinManifest[]>([])
  const [allPersonnel, setAllPersonnel] = useState<CheckinPersonnel[]>([])
  const [allVehicles, setAllVehicles] = useState<CheckinVehicle[]>([])
  const [allEquipment, setAllEquipment] = useState<CheckinEquipment[]>([])

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

    const { data: manifestsData } = await supabase
      .from('checkin_manifests')
      .select('*')
      .eq('incident_id', id)
      .order('submitted_at', { ascending: false })

    if (manifestsData && manifestsData.length > 0) {
      setManifests(manifestsData)

      const manifestIds = manifestsData.map((m) => m.id)

      const [personnelRes, vehiclesRes, equipmentRes] = await Promise.all([
        supabase.from('checkin_personnel').select('*').in('manifest_id', manifestIds),
        supabase.from('checkin_vehicles').select('*').in('manifest_id', manifestIds),
        supabase.from('checkin_equipment').select('*').in('manifest_id', manifestIds),
      ])

      setAllPersonnel(personnelRes.data || [])
      setAllVehicles(vehiclesRes.data || [])
      setAllEquipment(equipmentRes.data || [])
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

          {isIMTOrTactical && (
            <div className="checkin-proceed-section">
              <button
                className="checkin-proceed-btn"
                onClick={() => navigate(`/incident/${incident.incident_id}/checkin`)}
              >
                Proceed to Check-in
              </button>
            </div>
          )}

          <div className="resource-section">
            <h3>Checked-in Resources</h3>

            {allPersonnel.length === 0 && allVehicles.length === 0 && allEquipment.length === 0 ? (
              <p className="no-resources-text">No resources have been checked in yet.</p>
            ) : (
              <>
                {allPersonnel.length > 0 && (
                  <div className="resource-group">
                    <h4>Personnel ({allPersonnel.length})</h4>
                    <table className="resource-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Age</th>
                          <th>Gender</th>
                          <th>Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allPersonnel.map((p, idx) => (
                          <tr key={p.id}>
                            <td>{idx + 1}</td>
                            <td>{p.name}</td>
                            <td>{p.role}</td>
                            <td>{p.age}</td>
                            <td>{p.gender}</td>
                            <td>{p.contact_details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {allVehicles.length > 0 && (
                  <div className="resource-group">
                    <h4>Vehicles ({allVehicles.length})</h4>
                    <table className="resource-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Kind</th>
                          <th>Type</th>
                          <th>Plate Number</th>
                          <th>Operator</th>
                          <th>Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allVehicles.map((v, idx) => (
                          <tr key={v.id}>
                            <td>{idx + 1}</td>
                            <td>{v.kind}</td>
                            <td>{v.type}</td>
                            <td>{v.plate_number}</td>
                            <td>{v.operator_name}</td>
                            <td>{v.contact_details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {allEquipment.length > 0 && (
                  <div className="resource-group">
                    <h4>Equipment ({allEquipment.length})</h4>
                    <table className="resource-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Kind</th>
                          <th>Type</th>
                          <th>Power Source</th>
                          <th>Operator</th>
                          <th>Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allEquipment.map((e, idx) => (
                          <tr key={e.id}>
                            <td>{idx + 1}</td>
                            <td>{e.kind}</td>
                            <td>{e.type}</td>
                            <td>{e.source_of_power}</td>
                            <td>{e.operator_name}</td>
                            <td>{e.contact_details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {manifests.length > 0 && (
            <div className="manifests-section">
              <h3>Check-in Manifests</h3>
              <div className="manifest-list">
                {manifests.map((m) => (
                  <div key={m.id} className="manifest-card">
                    <div className="manifest-info">
                      <span className="manifest-id">{m.checkin_id}</span>
                      <span className="manifest-agency">{m.agency_name}</span>
                      <span className="manifest-date">{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <div className="manifest-actions">
                      <button
                        className="manifest-btn view"
                        onClick={() => navigate(`/incident/${incident.incident_id}/checkin/view`)}
                      >
                        View
                      </button>
                      <button
                        className="manifest-btn print"
                        onClick={() => navigate(`/incident/${incident.incident_id}/checkin/view?print=true`)}
                      >
                        Print
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
