import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { generateRoleId, formatMilitaryTime } from '../lib/utils'
import type { Incident, IncidentParticipant, CheckinManifest, CheckinPersonnel } from '../lib/types'
import ConfirmModal from '../components/ConfirmModal'
import './IncidentPage.css'

const ICS_FORMS = [
  { num: '201', name: 'Incident Briefing' },
  { num: '202', name: 'Incident Objectives' },
  { num: '203', name: 'Organization Assignment List' },
  { num: '204', name: 'Assignment List' },
  { num: '205', name: 'Communications Plan' },
  { num: '206', name: 'Medical Plan' },
  { num: '207', name: 'Incident Organization Chart' },
  { num: '208', name: 'Safety Message/Plan' },
  { num: '209', name: 'Incident Status Summary' },
  { num: '211', name: 'Incident Check-in List' },
  { num: '213', name: 'General Message' },
  { num: '214', name: 'Activity Log' },
  { num: '215', name: 'Operational Planning Worksheet' },
  { num: '215-A', name: 'Incident/Event Safety, Risk and Health Analysis' },
  { num: '221', name: 'Demobilization Check-out' },
]

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
  const [formStatuses, setFormStatuses] = useState<Record<string, string>>({})
  const [operationalPeriod, setOperationalPeriod] = useState('')
  const [incidentCommander, setIncidentCommander] = useState('')
  const [publicStatus, setPublicStatus] = useState<{ description: string; totalCases: string }[]>([])

  const fetchData = useCallback(async () => {
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
      .order('created_at', { ascending: false })

    if (manifestsData && manifestsData.length > 0) {
      setManifests(manifestsData)
      const manifestIds = manifestsData.map((m) => m.id)
      const { data: personnelData } = await supabase
        .from('checkin_personnel')
        .select('*')
        .in('manifest_id', manifestIds)
      setAllPersonnel(personnelData || [])
    }

    const statuses: Record<string, string> = {}
    const { data: forms211 } = await supabase
      .from('ics_211_forms')
      .select('id, status, incident_id')
      .eq('incident_id', id)
    if (forms211 && forms211.length > 0) {
      statuses['211'] = forms211[0].status
    }
    const { data: forms207 } = await supabase
      .from('ics_207_forms')
      .select('id, status, incident_id')
      .eq('incident_id', id)
    if (forms207 && forms207.length > 0) {
      statuses['207'] = forms207[0].status
    }
    const { data: forms202 } = await supabase
      .from('ics_202_forms')
      .select('id, status, incident_id')
      .eq('incident_id', id)
    if (forms202 && forms202.length > 0) {
      statuses['202'] = forms202[0].status
    }
    const { data: forms203 } = await supabase
      .from('ics_203_forms')
      .select('id, status, incident_id')
      .eq('incident_id', id)
    if (forms203 && forms203.length > 0) {
      statuses['203'] = forms203[0].status
    }
    const { data: forms205 } = await supabase
      .from('ics_205_forms')
      .select('id, status, incident_id')
      .eq('incident_id', id)
    if (forms205 && forms205.length > 0) {
      statuses['205'] = forms205[0].status
    }
    const { data: forms206 } = await supabase
      .from('ics_206_forms')
      .select('id, status, incident_id')
      .eq('incident_id', id)
    if (forms206 && forms206.length > 0) {
      statuses['206'] = forms206[0].status
    }
    const { data: forms208 } = await supabase
      .from('ics_208_forms')
      .select('id, status, incident_id')
      .eq('incident_id', id)
    if (forms208 && forms208.length > 0) {
      statuses['208'] = forms208[0].status
    }
    const { data: forms209 } = await supabase
      .from('ics_209_forms')
      .select('id, status, incident_id')
      .eq('incident_id', id)
    if (forms209 && forms209.length > 0) {
      statuses['209'] = forms209[0].status
    }
    const { data: forms213 } = await supabase
      .from('ics_213_forms')
      .select('id, status, incident_id')
      .eq('incident_id', id)
    if (forms213 && forms213.length > 0) {
      statuses['213'] = forms213[0].status
    }
    const { data: forms214 } = await supabase
      .from('ics_214_forms')
      .select('id, status, incident_id')
      .eq('incident_id', id)
    if (forms214 && forms214.length > 0) {
      statuses['214'] = forms214[0].status
    }
    setFormStatuses(statuses)

    // Fetch operational period from 202
    const { data: form202Data } = await supabase
      .from('ics_202_forms')
      .select('op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time')
      .eq('incident_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (form202Data && (form202Data.op_period_from_date || form202Data.op_period_to_date)) {
      const fmtMil = (t: string) => t ? t.replace(':', '') + 'H' : ''
      const from = form202Data.op_period_from_date
        ? `${form202Data.op_period_from_date} ${fmtMil(form202Data.op_period_from_time)}`.trim()
        : fmtMil(form202Data.op_period_from_time)
      const to = form202Data.op_period_to_date
        ? `${form202Data.op_period_to_date} ${fmtMil(form202Data.op_period_to_time)}`.trim()
        : fmtMil(form202Data.op_period_to_time)
      setOperationalPeriod(`${from} to ${to}`)
    } else {
      setOperationalPeriod('')
    }

    // Fetch incident commander from 207
    const { data: form207Data } = await supabase
      .from('ics_207_forms')
      .select('id')
      .eq('incident_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (form207Data) {
      const { data: icPos } = await supabase
        .from('ics_207_positions')
        .select('person_name')
        .eq('form_id', form207Data.id)
        .eq('position_key', 'ic')
        .single()
      setIncidentCommander(icPos?.person_name || '')
    } else {
      setIncidentCommander('')
    }

    // Fetch public status from ICS 209
    const { data: form209Data } = await supabase
      .from('ics_209_forms')
      .select('public_status')
      .eq('incident_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (form209Data?.public_status && Array.isArray(form209Data.public_status)) {
      setPublicStatus(form209Data.public_status)
    } else {
      setPublicStatus([])
    }

    setLoading(false)
  }, [id, user])

  useEffect(() => {
    if (id) fetchData()
  }, [id, fetchData])

  const handleLeaveIncident = async () => {
    if (!participant) return
    setProcessing(true)
    const { error: updateError } = await supabase
      .from('incident_participants')
      .update({ status: 'Left', left_at: new Date().toISOString() })
      .eq('id', participant.id)
    setProcessing(false)
    setShowLeaveModal(false)
    if (updateError) { setError(updateError.message); return }
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
      .update({ status: 'Left', left_at: new Date().toISOString() })
      .eq('id', participant.id)
    if (updateError) { setError(updateError.message); setProcessing(false); setShowConfirmChange(false); return }
    const newRoleId = generateRoleId(pendingNewRole)
    const { error: insertError } = await supabase
      .from('incident_participants')
      .insert({ incident_id: participant.incident_id, user_id: user.id, user_name: participant.user_name, user_email: participant.user_email, role: pendingNewRole, role_id: newRoleId, status: 'Active' })
    setProcessing(false)
    setShowConfirmChange(false)
    setPendingNewRole(null)
    if (insertError) { setError(insertError.message); return }
    navigate(`/incident/${participant.incident_id}?role=${encodeURIComponent(pendingNewRole)}`)
  }

  if (loading) {
    return <div className="incident-page"><div className="incident-loading">Loading incident...</div></div>
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

  const handleFormClick = (formNum: string) => {
    if (formNum === '211') {
      navigate(`/incident/${incident.incident_id}/ics-211`)
    } else if (formNum === '207') {
      navigate(`/incident/${incident.incident_id}/ics-207`)
    } else if (formNum === '202') {
      navigate(`/incident/${incident.incident_id}/ics-202`)
    } else if (formNum === '203') {
      navigate(`/incident/${incident.incident_id}/ics-203`)
    } else if (formNum === '205') {
      navigate(`/incident/${incident.incident_id}/ics-205`)
    } else if (formNum === '206') {
      navigate(`/incident/${incident.incident_id}/ics-206`)
    } else if (formNum === '208') {
      navigate(`/incident/${incident.incident_id}/ics-208`)
    } else if (formNum === '209') {
      navigate(`/incident/${incident.incident_id}/ics-209`)
    } else if (formNum === '213') {
      navigate(`/incident/${incident.incident_id}/ics-213`)
    } else if (formNum === '214') {
      navigate(`/incident/${incident.incident_id}/ics-214`)
    }
  }

  const getFormStatus = (formNum: string): string => {
    return formStatuses[formNum] || ''
  }

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
          <button className="topbar-btn back" onClick={() => navigate('/join-incident')}>&larr; Back</button>
          <div className="topbar-info">
            <span className="incident-code-badge">{incident.incident_id}</span>
            <span className={`role-badge ${role.toLowerCase().replace(/\s/g, '-')}`}>{role}</span>
            {roleId && <span className="role-id-badge">{roleId}</span>}
          </div>
        </div>
        <div className="topbar-actions">
          <button className="topbar-btn change-role" disabled={processing} onClick={() => setShowRolePicker(true)}>Change Role</button>
          <button className="topbar-btn leave" disabled={processing} onClick={() => setShowLeaveModal(true)}>Leave Incident</button>
        </div>
      </div>

      <main className="incident-main">
        <div className="incident-layout">
          <div className="incident-content">
            <div className="incident-info-bar">
              <h2>{incident.name}</h2>
              <p className="incident-location-text">{incident.location}</p>
              <div className="incident-meta-row">
                <span>Type: {incident.type}</span>
                <span>Created by {incident.created_by_name}</span>
                <span>{new Date(incident.created_at).toLocaleDateString()}</span>
              </div>
              <div className="incident-meta-row">
                <span>
                  Operational Period: {operationalPeriod || <em>Please indicate the operational period using ICS form 202</em>}
                </span>
              </div>
              <div className="incident-meta-row">
                <span>
                  Incident Commander: {incidentCommander || <em>Please assign the Incident Commander in the organizational chart</em>}
                </span>
              </div>
            </div>

            {publicStatus.length > 0 && (() => {
              const getVal = (desc: string) => {
                const row = publicStatus.find(r => r.description?.toLowerCase() === desc.toLowerCase())
                return row?.totalCases || '0'
              }
              const items = [
                { label: 'Dead', value: getVal('Dead'), icon: '🪦', color: '#991b1b', bg: '#fee2e2' },
                { label: 'Injured', value: getVal('Injured'), icon: '🩹', color: '#92400e', bg: '#fef3c7' },
                { label: 'Missing', value: getVal('Missing'), icon: '?', color: '#1e40af', bg: '#dbeafe' },
                { label: 'Needs Treatment', value: getVal('Needs treatment/immunization'), icon: '🩺', color: '#065f46', bg: '#d1fae5' },
                { label: 'Needs Evacuation', value: getVal('Needs evacuation'), icon: '⛺', color: '#7c2d12', bg: '#ffedd5' },
              ]
              return (
                <div className="public-status-card">
                  {items.map((item, idx) => (
                    <div key={idx} className="public-status-item">
                      <div className="public-status-icon" style={{ background: item.bg, color: item.color }}>{item.icon}</div>
                      <div className="public-status-info">
                        <span className="public-status-number">{item.value}</span>
                        <span className="public-status-label">{item.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

            {isIMTOrTactical && (() => {
              const myManifest = manifests.find((m) => m.user_id === user?.id)
              const isCheckedIn = !!myManifest
              return (
                <div className="checkin-proceed-section">
                  {isCheckedIn ? (
                    <div className="checked-in-status">
                      <span className="checked-in-badge">Already Checked-in</span>
                      <span className="checked-in-id">{myManifest.checkin_id}</span>
                      <button className="manifest-btn view" onClick={() => navigate(`/incident/${incident.incident_id}/checkin/view?manifest=${myManifest.id}`)}>View My Check-in</button>
                      <button className="manifest-btn edit" onClick={() => navigate(`/incident/${incident.incident_id}/checkin?manifest=${myManifest.id}`)}>Edit</button>
                    </div>
                  ) : (
                    <button className="checkin-proceed-btn" onClick={() => navigate(`/incident/${incident.incident_id}/checkin`)}>
                      Proceed to Check-in
                    </button>
                  )}
                </div>
              )
            })()}

            <div className="resource-section">
              <h3>Checked-in Resources</h3>
              {manifests.length === 0 ? (
                <p className="no-resources-text">No resources have been checked in yet.</p>
              ) : (
                <div className="resource-table-wrapper">
                  <table className="resource-table">
                    <thead>
                      <tr>
                        <th>Check-in ID</th>
                        <th>Timestamp</th>
                        <th>Agency Name</th>
                        <th>Leader</th>
                        <th>Personnel</th>
                        <th>Capabilities</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manifests.map((m) => {
                        const manifestPersonnel = allPersonnel.filter((p) => p.manifest_id === m.id)
                        const leader = manifestPersonnel.find((p) => p.role === 'Leader')
                        return (
                          <tr key={m.id}>
                            <td className="code-cell">{m.checkin_id}</td>
                            <td className="date-cell">{new Date(m.created_at).toLocaleDateString()} {formatMilitaryTime(m.created_at)}</td>
                            <td>{m.agency_name}</td>
                            <td>{leader ? leader.name : '-'}</td>
                            <td className="number-cell">{m.total_personnel}</td>
                            <td>{leader?.capabilities || '-'}</td>
                            <td className="actions-cell">
                              <button className="manifest-btn view" onClick={() => navigate(`/incident/${incident.incident_id}/checkin/view?manifest=${m.id}`)}>
                                View
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <aside className="ics-sidebar">
            <div className="ics-sidebar-header">
              <h3>ICS Forms</h3>
            </div>
            <div className="ics-sidebar-list">
              {ICS_FORMS.map((form) => {
                const status = getFormStatus(form.num)
                const isActive = form.num === '211'
                return (
                  <div
                    key={form.num}
                    className={`ics-sidebar-item ${isActive ? 'active' : ''} ${status ? 'has-status' : ''}`}
                    onClick={() => handleFormClick(form.num)}
                  >
                    <span className="sidebar-form-num">{form.num}</span>
                    <span className="sidebar-form-name">{form.name}</span>
                    {status && (
                      <span className={`sidebar-status-badge ${status.toLowerCase()}`}>{status}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </aside>
        </div>
      </main>

      {showLeaveModal && (
        <ConfirmModal title="Leave Incident" message={`Are you sure you want to leave incident ${incident.incident_id}? Enter your password to confirm.`} onConfirm={handleLeaveIncident} onCancel={() => setShowLeaveModal(false)} />
      )}

      {showRolePicker && (
        <div className="modal-overlay" onClick={() => setShowRolePicker(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Change Role</h3>
            <p className="modal-message">Select a new role for incident {incident.incident_id}. Your current role ({role}) will be deactivated.</p>
            <div className="role-picker-buttons">
              {(['IMT', 'Tactical Resources', 'Observer'] as const).map((r) => (
                <button key={r} className={`role-picker-btn ${r.toLowerCase().replace(/\s/g, '-')} ${r === role ? 'current' : ''}`} disabled={r === role} onClick={() => handlePickRole(r)}>
                  {r === role ? `${r} (Current)` : r}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowRolePicker(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmChange && pendingNewRole && (
        <ConfirmModal title="Confirm Role Change" message={`Enter your password to confirm changing from ${role} to ${pendingNewRole}.`} onConfirm={handleChangeRoleConfirm} onCancel={() => { setShowConfirmChange(false); setPendingNewRole(null) }} />
      )}
    </div>
  )
}
