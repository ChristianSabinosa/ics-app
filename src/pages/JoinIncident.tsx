import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { generateRoleId } from '../lib/utils'
import type { Incident, IncidentParticipant } from '../lib/types'
import './JoinIncident.css'

export default function JoinIncident() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [searchCode, setSearchCode] = useState('')
  const [error, setError] = useState('')
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [joining, setJoining] = useState<string | null>(null)
  const [userParticipants, setUserParticipants] = useState<Map<string, IncidentParticipant>>(new Map())

  useEffect(() => {
    fetchIncidents()
  }, [])

  const fetchIncidents = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('status', 'Ongoing')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const incidentList = data || []
    setIncidents(incidentList)

    if (user && incidentList.length > 0) {
      const incidentIds = incidentList.map((i) => i.incident_id)
      const { data: participants } = await supabase
        .from('incident_participants')
        .select('*')
        .in('incident_id', incidentIds)
        .eq('user_id', user.id)
        .eq('status', 'Active')

      if (participants) {
        const map = new Map<string, IncidentParticipant>()
        participants.forEach((p) => map.set(p.incident_id, p))
        setUserParticipants(map)
      }
    }

    setLoading(false)
  }

  const handleJoinByCode = () => {
    const code = searchCode.trim().toUpperCase()
    if (!code) return

    const found = incidents.find((i) => i.incident_id === code)
    if (found) {
      setExpandedCardId(found.id)
    } else {
      setError('Incident not found. Check the code and try again.')
    }
  }

  const handleCardClick = (incidentId: string) => {
    setExpandedCardId(expandedCardId === incidentId ? null : incidentId)
  }

  const handleRoleSelect = async (incidentId: string, role: 'IMT' | 'Tactical Resources' | 'Observer') => {
    if (!user) return
    setJoining(incidentId)
    setError('')

    const roleId = generateRoleId(role)
    const userName = user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || ''

    const { error: insertError } = await supabase
      .from('incident_participants')
      .insert({
        incident_id: incidentId,
        user_id: user.id,
        user_name: userName,
        user_email: user.email || '',
        role,
        role_id: roleId,
        status: 'Active',
      })

    if (insertError) {
      setError(insertError.message)
      setJoining(null)
      return
    }

    navigate(`/incident/${incidentId}?role=${encodeURIComponent(role)}`)
  }

  return (
    <div className="join-page">
      <header className="page-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <main className="join-main">
        <div className="join-container">
          <h2>Join an Incident</h2>
          <p className="join-subtitle">Enter an incident code or select from ongoing incidents below</p>

          {error && <div className="error-message">{error}</div>}

          <div className="search-bar">
            <input
              type="text"
              placeholder="Enter Incident ID (e.g. ICS-20260913-1234)"
              value={searchCode}
              onChange={(e) => { setSearchCode(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
            />
            <button onClick={handleJoinByCode} className="search-btn">Join</button>
          </div>

          <div className="incident-list">
            <h3>Ongoing Incidents ({incidents.length})</h3>
            {loading ? (
              <p className="loading-text">Loading incidents...</p>
            ) : incidents.length === 0 ? (
              <p className="empty-text">No ongoing incidents found.</p>
            ) : (
              <div className="incident-cards">
                {incidents.map((incident) => {
                  const participant = userParticipants.get(incident.incident_id)
                  const isJoined = !!participant
                  const isCheckedIn = participant?.checked_in === true

                  return (
                    <div key={incident.id} className={`incident-card ${expandedCardId === incident.id ? 'expanded' : ''}`}>
                      <div className="incident-card-content" onClick={() => handleCardClick(incident.id)}>
                        <div className="incident-card-header">
                          <span className="incident-code">{incident.incident_id}</span>
                          <span className={`incident-type-badge ${incident.type.toLowerCase().replace(/\s/g, '-')}`}>
                            {incident.type}
                          </span>
                        </div>
                        <h4>{incident.name}</h4>
                        <p className="incident-location">{incident.location}</p>
                        <div className="incident-meta">
                          <span>Created by {incident.created_by_name}</span>
                          <span>{new Date(incident.created_at).toLocaleDateString()}</span>
                        </div>

                        {isJoined && (
                          <div className="joined-status">
                            <div className="joined-info">
                              <span className={`joined-badge ${participant!.role.toLowerCase().replace(/\s/g, '-')}`}>
                                Joined as {participant!.role}
                              </span>
                              <span className="joined-timestamp">
                                {new Date(participant!.joined_at).toLocaleString()}
                              </span>
                            </div>
                            {isCheckedIn && (
                              <div className="checkedin-info">
                                <span className="checkedin-badge">Checked-in</span>
                                <span className="checkedin-timestamp">
                                  {participant!.checked_in ? new Date(participant!.joined_at).toLocaleString() : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {expandedCardId === incident.id && (
                        <div className="role-selection-bar">
                          {isJoined ? (
                            <>
                              <div className="role-selection-header">
                                <span className="role-label">Your Participation</span>
                                <button className="collapse-btn" onClick={(e) => { e.stopPropagation(); setExpandedCardId(null) }}>
                                  &times;
                                </button>
                              </div>
                              <div className="joined-actions">
                                {isCheckedIn ? (
                                  <button
                                    className="action-btn proceed-view"
                                    onClick={() => navigate(`/incident/${incident.incident_id}`)}
                                  >
                                    View Incident
                                  </button>
                                ) : (
                                  <button
                                    className="action-btn proceed-checkin"
                                    onClick={() => navigate(`/incident/${incident.incident_id}/checkin`)}
                                  >
                                    Proceed to Check-in
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="role-selection-header">
                                <span className="role-label">Request to Join as?</span>
                                <button className="collapse-btn" onClick={(e) => { e.stopPropagation(); setExpandedCardId(null) }}>
                                  &times;
                                </button>
                              </div>
                              <div className="role-buttons">
                                <button
                                  className="role-btn imt"
                                  disabled={joining === incident.id}
                                  onClick={() => handleRoleSelect(incident.incident_id, 'IMT')}
                                >
                                  {joining === incident.id ? 'Joining...' : 'IMT'}
                                </button>
                                <button
                                  className="role-btn tactical"
                                  disabled={joining === incident.id}
                                  onClick={() => handleRoleSelect(incident.incident_id, 'Tactical Resources')}
                                >
                                  {joining === incident.id ? 'Joining...' : 'Tactical Resources'}
                                </button>
                                <button
                                  className="role-btn observer"
                                  disabled={joining === incident.id}
                                  onClick={() => handleRoleSelect(incident.incident_id, 'Observer')}
                                >
                                  {joining === incident.id ? 'Joining...' : 'Observer'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <button className="btn-back" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </main>
    </div>
  )
}
