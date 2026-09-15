import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics207Print from './Ics207Print'
import './Ics207Form.css'

interface PersonnelWithAgency {
  id: string
  manifest_id: string
  role: string
  name: string
  agency: string
  capabilities: string
  participant_role: string
}

interface Position {
  position_key: string
  position_title: string
  abbreviation: string
  section: string
  person_name: string
  agency: string
}

const DEFAULT_POSITIONS: Position[] = [
  { position_key: 'ic', position_title: 'Incident Commander', abbreviation: 'IC', section: 'Command', person_name: '', agency: '' },
  { position_key: 'pio', position_title: 'Public Information Officer', abbreviation: 'PIO', section: 'Command Staff', person_name: '', agency: '' },
  { position_key: 'sofr', position_title: 'Safety Officer', abbreviation: 'SOFR', section: 'Command Staff', person_name: '', agency: '' },
  { position_key: 'lofr', position_title: 'Liaison Officer', abbreviation: 'LOFR', section: 'Command Staff', person_name: '', agency: '' },
  { position_key: 'osc', position_title: 'Operations Section Chief', abbreviation: 'OSC', section: 'General Staff', person_name: '', agency: '' },
  { position_key: 'psc', position_title: 'Planning Section Chief', abbreviation: 'PSC', section: 'General Staff', person_name: '', agency: '' },
  { position_key: 'lsc', position_title: 'Logistics Section Chief', abbreviation: 'LSC', section: 'General Staff', person_name: '', agency: '' },
  { position_key: 'fasc', position_title: 'Finance/Admin Section Chief', abbreviation: 'FASC', section: 'General Staff', person_name: '', agency: '' },
]

export default function Ics207Form() {
  const { id: incidentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [formId, setFormId] = useState<string | null>(null)
  const [formType, setFormType] = useState<'standard' | 'expanded'>('standard')
  const [incidentName, setIncidentName] = useState('')
  const [positions, setPositions] = useState<Position[]>(DEFAULT_POSITIONS)
  const [preparedBy, setPreparedBy] = useState('')
  const [datePrepared, setDatePrepared] = useState('')
  const [timePrepared, setTimePrepared] = useState('')
  const [status, setStatus] = useState<'Draft' | 'Submitted'>('Draft')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  const [allPersonnel, setAllPersonnel] = useState<PersonnelWithAgency[]>([])
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)
  const [personnelFilter, setPersonnelFilter] = useState('All')

  useEffect(() => {
    if (!user) return
    const now = new Date()
    setPreparedBy(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    setDatePrepared(now.toISOString().slice(0, 10))
    setTimePrepared(now.toTimeString().slice(0, 5))
    loadForm()
    loadPersonnel()
  }, [incidentId, user, searchParams])

  const loadForm = async () => {
    if (!incidentId) return
    setLoading(true)

    const { data: incident } = await supabase
      .from('incidents')
      .select('name')
      .eq('incident_id', incidentId)
      .single()
    if (incident) setIncidentName(incident.name)

    const formParam = searchParams.get('form')

    let formToLoad = null

    if (formParam) {
      const { data: form } = await supabase
        .from('ics_207_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    } else {
      const { data: existingForm } = await supabase
        .from('ics_207_forms')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      formToLoad = existingForm
    }

    if (formToLoad) {
      setFormId(formToLoad.id)
      setFormType(formToLoad.form_type || 'standard')
      setIncidentName(formToLoad.incident_name)
      setPreparedBy(formToLoad.prepared_by)
      setDatePrepared(formToLoad.date_prepared)
      setTimePrepared(formToLoad.time_prepared)
      setStatus(formToLoad.status)

      const { data: posData } = await supabase
        .from('ics_207_positions')
        .select('*')
        .eq('form_id', formToLoad.id)
        .order('sort_order')

      if (posData && posData.length > 0) {
        setPositions(posData.map(({ position_key, position_title, abbreviation, section, person_name, agency }) => ({
          position_key, position_title, abbreviation, section, person_name, agency
        })))
      }
    }

    setLoading(false)
  }

  const loadPersonnel = async () => {
    if (!incidentId) return

    const { data: manifests } = await supabase
      .from('checkin_manifests')
      .select('id, agency_name, user_id')
      .eq('incident_id', incidentId)
      .eq('status', 'Submitted')

    if (!manifests || manifests.length === 0) return

    const manifestIds = manifests.map((m) => m.id)
    const { data: personnel } = await supabase
      .from('checkin_personnel')
      .select('*')
      .in('manifest_id', manifestIds)

    const userIds = [...new Set(manifests.map((m) => m.user_id).filter(Boolean))]
    const { data: participants } = await supabase
      .from('incident_participants')
      .select('user_id, role')
      .eq('incident_id', incidentId)
      .eq('status', 'Active')
      .in('user_id', userIds)

    const participantMap = new Map((participants || []).map((p) => [p.user_id, p.role]))
    const manifestMap = new Map(manifests.map((m) => [m.id, m]))

    if (personnel) {
      setAllPersonnel(personnel.map((p) => {
        const manifest = manifestMap.get(p.manifest_id)
        return {
          id: p.id,
          manifest_id: p.manifest_id,
          role: p.role,
          name: p.name,
          agency: manifest?.agency_name || '',
          capabilities: p.capabilities,
          participant_role: participantMap.get(manifest?.user_id) || '',
        }
      }))
    }
  }

  const assignPersonToPosition = (positionKey: string, personName: string, agency: string) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.position_key === positionKey ? { ...p, person_name: personName, agency } : p
      )
    )
    setSelectedPosition(null)
  }

  const clearPosition = (positionKey: string) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.position_key === positionKey ? { ...p, person_name: '', agency: '' } : p
      )
    )
  }

  const saveForm = async (formStatus: 'Draft' | 'Submitted') => {
    if (!incidentId || !user) return
    setSaving(true)
    setError('')
    setSuccess('')

    const now = new Date()
    const formData = {
      incident_id: incidentId,
      incident_name: incidentName,
      form_type: formType,
      status: formStatus,
      prepared_by: preparedBy,
      date_prepared: formStatus === 'Submitted' ? now.toISOString().slice(0, 10) : datePrepared,
      time_prepared: formStatus === 'Submitted' ? now.toTimeString().slice(0, 5) : timePrepared,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_207_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_207_forms')
        .insert(formData)
        .select()
        .single()
      if (insertError) { setError(insertError.message); setSaving(false); return }
      fId = inserted.id
      setFormId(fId)
    }

    await supabase.from('ics_207_positions').delete().eq('form_id', fId)

    const posRows = positions.map((p, i) => ({
      form_id: fId!,
      position_key: p.position_key,
      position_title: p.position_title,
      abbreviation: p.abbreviation,
      section: p.section,
      person_name: p.person_name,
      agency: p.agency,
      sort_order: i,
    }))
    const { error: posError } = await supabase.from('ics_207_positions').insert(posRows)
    if (posError) { setError(posError.message); setSaving(false); return }

    setSaving(false)
    setStatus(formStatus)
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 207 submitted successfully!')
  }

  const assignedPersonnel = positions.filter((p) => p.person_name).map((p) => p.person_name)
  const icPosition = positions.find((p) => p.position_key === 'ic')
  const commandStaff = positions.filter((p) => p.section === 'Command Staff')
  const generalStaff = positions.filter((p) => p.section === 'General Staff')

  const filteredPersonnel = (() => {
    let pool = allPersonnel
    if (personnelFilter !== 'All') {
      pool = pool.filter((p) => p.role === personnelFilter)
    }
    return pool
  })()

  if (loading) {
    return (
      <div className="ics207-page">
        <div className="ics207-loading">Loading ICS Form 207...</div>
      </div>
    )
  }

  const renderPositionCard = (pos: Position, accentClass: string) => {
    const isSelected = selectedPosition === pos.position_key
    return (
      <div
        key={pos.position_key}
        className={`position-card ${accentClass} ${isSelected ? 'selected' : ''} ${pos.person_name ? 'filled' : ''}`}
        onClick={() => setSelectedPosition(isSelected ? null : pos.position_key)}
      >
        <div className="card-top">
          <span className="card-abbr">{pos.abbreviation}</span>
          {pos.person_name && (
            <button className="card-clear" onClick={(e) => { e.stopPropagation(); clearPosition(pos.position_key) }}>&times;</button>
          )}
        </div>
        <div className="card-title">{pos.position_title}</div>
        {pos.person_name ? (
          <div className="card-person">
            <span className="card-person-name">{pos.person_name}</span>
            {pos.agency && <span className="card-person-agency">{pos.agency}</span>}
          </div>
        ) : (
          <div className="card-empty">Click a person from the pool to assign</div>
        )}
      </div>
    )
  }

  return (
    <div className="ics207-page">
      <header className="ics207-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics207-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="form-badge">ICS 207</span>
          <span className={`form-type-badge ${formType}`}>{formType === 'standard' ? 'Standard' : 'Expanded'}</span>
          <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
        </div>
        <div className="topbar-actions">
          <button className="action-btn save" onClick={() => saveForm('Draft')} disabled={saving}>
            {saving ? 'Saving...' : 'Save Progress'}
          </button>
          <button className="action-btn submit" onClick={() => saveForm('Submitted')} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit'}
          </button>
          <button className="action-btn print" onClick={() => setShowPrint(true)} disabled={saving}>Print</button>
        </div>
      </div>

      <main className="ics207-main no-print">
        <div className="ics207-layout">
          <div className="ics207-content">
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="form-header-section">
              <h2>INCIDENT ORGANIZATION CHART</h2>
              <h3>ICS 207</h3>
            </div>

            <div className="form-top-row">
              <div className="form-field wide">
                <label>1. INCIDENT/EVENT NAME</label>
                <input type="text" value={incidentName} onChange={(e) => setIncidentName(e.target.value)} />
              </div>
            </div>

            <div className="org-cards-section">
              <h4>2. ORGANIZATION</h4>

              <div className="cards-group">
                <div className="cards-group-label">Command</div>
                <div className="cards-row cards-row-center">
                  {icPosition && renderPositionCard(icPosition, 'card-accent-red')}
                </div>
              </div>

              <div className="cards-group">
                <div className="cards-group-label">Command Staff</div>
                <div className="cards-row">
                  {commandStaff.map((pos) => renderPositionCard(pos, 'card-accent-blue'))}
                </div>
              </div>

              <div className="cards-group">
                <div className="cards-group-label">General Staff</div>
                <div className="cards-row">
                  {generalStaff.map((pos) => renderPositionCard(pos, 'card-accent-green'))}
                </div>
              </div>
            </div>

            <div className="form-footer-section">
              <div className="footer-field">
                <label>3. Prepared by:</label>
                <input type="text" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} />
              </div>
              <div className="footer-field">
                <label>Date Prepared:</label>
                <input type="date" value={datePrepared} onChange={(e) => setDatePrepared(e.target.value)} />
              </div>
              <div className="footer-field">
                <label>Time Prepared:</label>
                <input type="time" value={timePrepared} onChange={(e) => setTimePrepared(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="ics207-sidebar">
            <div className="personnel-pool-header">
              <h3>Personnel Pool</h3>
              <select value={personnelFilter} onChange={(e) => setPersonnelFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="Leader">Leaders Only</option>
                <option value="Member">Members Only</option>
              </select>
            </div>

            {selectedPosition && (
              <div className="assignment-indicator">
                Assigning to: <strong>{positions.find((p) => p.position_key === selectedPosition)?.position_title}</strong>
                <button className="cancel-assign-btn" onClick={() => setSelectedPosition(null)}>Cancel</button>
              </div>
            )}

            <div className="personnel-list">
              {filteredPersonnel.map((person) => {
                const isAssigned = assignedPersonnel.includes(person.name)
                const isSelected = selectedPosition !== null
                return (
                  <div
                    key={person.id}
                    className={`personnel-item ${isAssigned ? 'assigned' : ''} ${isSelected && !isAssigned ? 'selectable' : ''}`}
                    onClick={() => {
                      if (selectedPosition && !isAssigned) {
                        assignPersonToPosition(selectedPosition, person.name, person.agency || '')
                      }
                    }}
                  >
                    <div className="person-info">
                      <span className="person-name">{person.name}</span>
                      <span className="person-role">{person.participant_role} - {person.role}</span>
                      {person.agency && <span className="person-agency">{person.agency}</span>}
                      {person.capabilities && <span className="person-caps">{person.capabilities}</span>}
                    </div>
                    {isAssigned && <span className="assigned-badge">Assigned</span>}
                  </div>
                )
              })}
              {filteredPersonnel.length === 0 && (
                <div className="no-personnel">
                  {selectedPosition
                    ? 'No available personnel to assign.'
                    : 'No checked-in personnel found.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showPrint && (
        <Ics207Print
          incidentName={incidentName}
          positions={positions}
          preparedBy={preparedBy}
          datePrepared={datePrepared}
          timePrepared={timePrepared}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
