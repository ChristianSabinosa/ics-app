import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics215Print from './Ics215Print'
import './Ics215Form.css'

interface ResourceEntry {
  identifier: string
  required: number
  have: number
  need: number
}

interface WorkAssignment {
  branch: string
  division_group: string
  work_assignment: string
  resource_type: 'Single Resource' | 'ST or TF'
  resources: ResourceEntry[]
  overhead_position: string
  special_equipment: string
  reporting_location: string
  requested_arrival_time: string
}

const emptyWorkAssignment: WorkAssignment = {
  branch: '', division_group: '', work_assignment: '',
  resource_type: 'Single Resource',
  resources: [],
  overhead_position: '', special_equipment: '',
  reporting_location: '', requested_arrival_time: '',
}

export default function Ics215Form() {
  const { id: incidentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [formId, setFormId] = useState<string | null>(null)
  const [incidentName, setIncidentName] = useState('')
  const [opFromDate, setOpFromDate] = useState('')
  const [opFromTime, setOpFromTime] = useState('')
  const [opToDate, setOpToDate] = useState('')
  const [opToTime, setOpToTime] = useState('')

  const [resourceIdentifiers, setResourceIdentifiers] = useState<string[]>([])
  const [workAssignments, setWorkAssignments] = useState<WorkAssignment[]>([])

  const [preparedBy, setPreparedBy] = useState('')
  const [datePrepared, setDatePrepared] = useState('')
  const [timePrepared, setTimePrepared] = useState('')

  const [status, setStatus] = useState<'Draft' | 'Submitted'>('Draft')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPrint, setShowPrint] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const [branchSuggestions, setBranchSuggestions] = useState<string[]>([])
  const [divGrpSuggestions, setDivGrpSuggestions] = useState<string[]>([])
  const [overheadSuggestions, setOverheadSuggestions] = useState<string[]>([])

  const isReadonly = status === 'Submitted' && !isEditing

  const loadForm = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)

    const { data: incident } = await supabase
      .from('incidents').select('name').eq('incident_id', incidentId).single()
    if (incident) setIncidentName(incident.name)

    const { data: form202 } = await supabase
      .from('ics_202_forms').select('op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time')
      .eq('incident_id', incidentId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (form202) {
      setOpFromDate(form202.op_period_from_date)
      setOpFromTime(form202.op_period_from_time)
      setOpToDate(form202.op_period_to_date)
      setOpToTime(form202.op_period_to_time)
    }

    const { data: form207 } = await supabase
      .from('ics_207_forms').select('id')
      .eq('incident_id', incidentId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (form207) {
      const { data: positions } = await supabase
        .from('ics_207_positions').select('position_title, section')
        .eq('form_id', form207.id)
      if (positions) {
        const branches = [...new Set(positions.filter((p: any) => p.section === 'OSC Branch').map((p: any) => p.position_title))].filter(Boolean)
        const divs = [...new Set(positions.filter((p: any) => ['OSC Division', 'OSC Group'].includes(p.section)).map((p: any) => p.position_title))].filter(Boolean)
        setBranchSuggestions(branches)
        setDivGrpSuggestions(divs)
      }
    }

    const { data: resources211 } = await supabase
      .from('ics_211_resources').select('leader_name')
      .eq('form_id', (await supabase.from('ics_211_forms').select('id').eq('incident_id', incidentId).order('created_at', { ascending: false }).limit(1).maybeSingle()).data?.id || '')
    if (resources211) {
      setOverheadSuggestions([...new Set(resources211.map((r: any) => r.leader_name).filter(Boolean))])
    }

    const formParam = searchParams.get('form')
    let formToLoad = null
    if (formParam) {
      const { data } = await supabase.from('ics_215_forms').select('*').eq('id', formParam).single()
      formToLoad = data
    } else {
      const { data } = await supabase.from('ics_215_forms').select('*')
        .eq('incident_id', incidentId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      formToLoad = data
    }

    if (formToLoad) {
      setFormId(formToLoad.id)
      setIncidentName(formToLoad.incident_name || '')
      setOpFromDate(formToLoad.op_period_from_date || '')
      setOpFromTime(formToLoad.op_period_from_time || '')
      setOpToDate(formToLoad.op_period_to_date || '')
      setOpToTime(formToLoad.op_period_to_time || '')
      setResourceIdentifiers(formToLoad.resource_identifiers || [])
      setWorkAssignments(formToLoad.work_assignments || [])
      setStatus(formToLoad.status)
      setPreparedBy(formToLoad.prepared_by || '')
      setDatePrepared(formToLoad.date_prepared || '')
      setTimePrepared(formToLoad.time_prepared || '')
    } else {
      setWorkAssignments([{ ...emptyWorkAssignment, resources: [] }])
    }

    setLoading(false)
  }, [incidentId, searchParams])

  useEffect(() => {
    if (!user) return
    const now = new Date()
    setPreparedBy(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    setDatePrepared(now.toISOString().slice(0, 10))
    setTimePrepared(now.toTimeString().slice(0, 5))
    loadForm()
  }, [incidentId, user, searchParams, loadForm])

  const saveForm = async (formStatus: 'Draft' | 'Submitted') => {
    if (!incidentId || !user) return
    setSaving(true)
    setError('')
    setSuccess('')

    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const localTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`

    const formData = {
      incident_id: incidentId,
      incident_name: incidentName,
      op_period_from_date: opFromDate,
      op_period_from_time: opFromTime,
      op_period_to_date: opToDate,
      op_period_to_time: opToTime,
      resource_identifiers: resourceIdentifiers,
      work_assignments: workAssignments,
      status: formStatus,
      prepared_by: preparedBy,
      date_prepared: formStatus === 'Submitted' ? localDate : datePrepared,
      time_prepared: formStatus === 'Submitted' ? localTime : timePrepared,
      updated_at: now.toISOString(),
    }

    let fId = formId
    if (fId) {
      const { error: e } = await supabase.from('ics_215_forms').update(formData).eq('id', fId)
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { data: inserted, error: e } = await supabase.from('ics_215_forms').insert(formData).select().single()
      if (e) { setError(e.message); setSaving(false); return }
      fId = inserted.id
      setFormId(fId)
    }

    setStatus(formStatus)
    setIsEditing(false)
    setSaving(false)
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS 215 submitted successfully!')
  }

  const updateWorkAssignment = (index: number, field: keyof WorkAssignment, value: any) => {
    const updated = [...workAssignments]
    updated[index] = { ...updated[index], [field]: value }
    setWorkAssignments(updated)
  }

  const updateResource = (waIndex: number, resIndex: number, field: keyof ResourceEntry, value: any) => {
    const updated = [...workAssignments]
    const resources = [...updated[waIndex].resources]
    resources[resIndex] = { ...resources[resIndex], [field]: value }
    updated[waIndex] = { ...updated[waIndex], resources }
    setWorkAssignments(updated)
  }

  const addResourceToWork = (waIndex: number) => {
    const updated = [...workAssignments]
    updated[waIndex] = {
      ...updated[waIndex],
      resources: [...updated[waIndex].resources, { identifier: '', required: 0, have: 0, need: 0 }]
    }
    setWorkAssignments(updated)
  }

  const removeResourceFromWork = (waIndex: number, resIndex: number) => {
    const updated = [...workAssignments]
    updated[waIndex] = {
      ...updated[waIndex],
      resources: updated[waIndex].resources.filter((_, i) => i !== resIndex)
    }
    setWorkAssignments(updated)
  }

  const addWorkAssignment = () => setWorkAssignments([...workAssignments, { ...emptyWorkAssignment, resources: [] }])
  const removeWorkAssignment = (index: number) => setWorkAssignments(workAssignments.filter((_, i) => i !== index))

  const addIdentifier = (id: string) => {
    if (id && !resourceIdentifiers.includes(id)) {
      setResourceIdentifiers([...resourceIdentifiers, id])
    }
  }
  const removeIdentifier = (id: string) => setResourceIdentifiers(resourceIdentifiers.filter(i => i !== id))

  const computeTotals = (resourceType: 'Single Resource' | 'ST or TF', field: 'required' | 'have' | 'need') => {
    return workAssignments
      .filter(wa => wa.resource_type === resourceType)
      .reduce((sum, wa) => sum + wa.resources.reduce((s, r) => s + ((r as any)[field] || 0), 0), 0)
  }

  const [newIdentifier, setNewIdentifier] = useState('')

  if (loading) {
    return <div className="ics215-page"><div className="ics215-loading">Loading ICS Form 215...</div></div>
  }

  return (
    <div className="ics215-page">
      <header className="ics215-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics215-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="form-badge">ICS 215</span>
          <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
        </div>
        <div className="topbar-actions">
          <button className="action-btn save" onClick={() => saveForm('Draft')} disabled={saving || isReadonly}>
            {saving ? 'Saving...' : 'Save Progress'}
          </button>
          <button className="action-btn submit" onClick={() => saveForm('Submitted')} disabled={saving || isReadonly}>
            {saving ? 'Submitting...' : 'Submit'}
          </button>
          {status === 'Submitted' && !isEditing && (
            <button className="action-btn edit" onClick={() => setIsEditing(true)}>Edit</button>
          )}
          <button className="action-btn print" onClick={() => setShowPrint(true)} disabled={saving}>Print</button>
        </div>
      </div>

      <main className="ics215-main no-print">
        <div className="ics215-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>OPERATIONAL PLANNING WORKSHEET</h2>
            <h3>ICS 215</h3>
          </div>

          <div className="form-top-row">
            <div className="form-field wide">
              <label>1. INCIDENT/EVENT NAME</label>
              <input type="text" value={incidentName} onChange={(e) => setIncidentName(e.target.value)} />
            </div>
            <div className="form-field">
              <label>2. OPERATIONAL PERIOD</label>
              <div className="op-period-grid">
                <div><label>From:</label><input type="date" value={opFromDate} onChange={(e) => setOpFromDate(e.target.value)} /><input type="time" value={opFromTime} onChange={(e) => setOpFromTime(e.target.value)} /></div>
                <div><label>To:</label><input type="date" value={opToDate} onChange={(e) => setOpToDate(e.target.value)} /><input type="time" value={opToTime} onChange={(e) => setOpToTime(e.target.value)} /></div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>3. RESOURCE IDENTIFIERS</h4>
            <div className="identifier-list">
              {resourceIdentifiers.map((id) => (
                <span key={id} className="identifier-tag">
                  {id}
                  <button className="remove-id" onClick={() => removeIdentifier(id)}>&times;</button>
                </span>
              ))}
            </div>
            <div className="identifier-input-row">
              <input
                type="text"
                value={newIdentifier}
                onChange={(e) => setNewIdentifier(e.target.value)}
                placeholder="Add resource identifier..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addIdentifier(newIdentifier)
                    setNewIdentifier('')
                  }
                }}
              />
              <button onClick={() => { addIdentifier(newIdentifier); setNewIdentifier('') }}>+ Add</button>
            </div>
          </div>

          <div className="form-section">
            <h4>4. WORK ASSIGNMENTS</h4>
            {workAssignments.map((wa, waIndex) => (
              <div key={waIndex} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: '0.85rem' }}>Work Assignment #{waIndex + 1}</strong>
                  <button className="remove-row-btn" onClick={() => removeWorkAssignment(waIndex)}>&times;</button>
                </div>
                <div className="form-top-row" style={{ marginBottom: 8 }}>
                  <div className="form-field">
                    <label>Branch</label>
                    <input
                      type="text"
                      list={`branch-list-${waIndex}`}
                      value={wa.branch}
                      onChange={(e) => updateWorkAssignment(waIndex, 'branch', e.target.value)}
                    />
                    <datalist id={`branch-list-${waIndex}`}>
                      {branchSuggestions.map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <div className="form-field">
                    <label>Division/Group</label>
                    <input
                      type="text"
                      list={`divgrp-list-${waIndex}`}
                      value={wa.division_group}
                      onChange={(e) => updateWorkAssignment(waIndex, 'division_group', e.target.value)}
                    />
                    <datalist id={`divgrp-list-${waIndex}`}>
                      {divGrpSuggestions.map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                </div>
                <div className="form-field" style={{ marginBottom: 8 }}>
                  <label>Work Assignment Description</label>
                  <input type="text" value={wa.work_assignment} onChange={(e) => updateWorkAssignment(waIndex, 'work_assignment', e.target.value)} />
                </div>
                <div className="form-top-row" style={{ marginBottom: 8 }}>
                  <div className="form-field">
                    <label>Resource Type</label>
                    <select value={wa.resource_type} onChange={(e) => updateWorkAssignment(waIndex, 'resource_type', e.target.value)}>
                      <option value="Single Resource">Single Resource</option>
                      <option value="ST or TF">ST or TF (Strike Team / Task Force)</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Overhead Position</label>
                    <input
                      type="text"
                      list={`overhead-list-${waIndex}`}
                      value={wa.overhead_position}
                      onChange={(e) => updateWorkAssignment(waIndex, 'overhead_position', e.target.value)}
                    />
                    <datalist id={`overhead-list-${waIndex}`}>
                      {overheadSuggestions.map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                </div>
                <div className="form-top-row" style={{ marginBottom: 8 }}>
                  <div className="form-field">
                    <label>Special Equipment</label>
                    <input type="text" value={wa.special_equipment} onChange={(e) => updateWorkAssignment(waIndex, 'special_equipment', e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Reporting Location</label>
                    <input type="text" value={wa.reporting_location} onChange={(e) => updateWorkAssignment(waIndex, 'reporting_location', e.target.value)} />
                  </div>
                </div>
                <div className="form-field" style={{ marginBottom: 8 }}>
                  <label>Requested Arrival Time</label>
                  <input type="time" value={wa.requested_arrival_time} onChange={(e) => updateWorkAssignment(waIndex, 'requested_arrival_time', e.target.value)} />
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: '0.8rem' }}>Resources</strong>
                    <button className="add-row-btn" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => addResourceToWork(waIndex)}>+ Add Resource</button>
                  </div>
                  <div className="channels-table-wrapper">
                    <table className="channels-table">
                      <thead>
                        <tr>
                          <th>Identifier</th>
                          <th>Required</th>
                          <th>Have</th>
                          <th>Need</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {wa.resources.map((r, rIndex) => (
                          <tr key={rIndex}>
                            <td><input value={r.identifier} onChange={(e) => updateResource(waIndex, rIndex, 'identifier', e.target.value)} /></td>
                            <td><input type="number" value={r.required || ''} onChange={(e) => updateResource(waIndex, rIndex, 'required', parseInt(e.target.value) || 0)} /></td>
                            <td><input type="number" value={r.have || ''} onChange={(e) => updateResource(waIndex, rIndex, 'have', parseInt(e.target.value) || 0)} /></td>
                            <td><input type="number" value={r.need || ''} onChange={(e) => updateResource(waIndex, rIndex, 'need', parseInt(e.target.value) || 0)} /></td>
                            <td className="actions-cell">
                              <button className="remove-row-btn" onClick={() => removeResourceFromWork(waIndex, rIndex)}>&times;</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
            <div className="add-row-buttons">
              <button className="add-row-btn" onClick={addWorkAssignment}>+ Add Work Assignment</button>
            </div>
          </div>

          <div className="form-section">
            <h4>TOTALS</h4>
            <div style={{ display: 'flex', gap: 24, fontSize: '0.85rem' }}>
              <div>
                <strong>Single Resource:</strong>{' '}
                Required: {computeTotals('Single Resource', 'required')} |{' '}
                Have: {computeTotals('Single Resource', 'have')} |{' '}
                Need: {computeTotals('Single Resource', 'need')}
              </div>
              <div>
                <strong>ST/TF:</strong>{' '}
                Required: {computeTotals('ST or TF', 'required')} |{' '}
                Have: {computeTotals('ST or TF', 'have')} |{' '}
                Need: {computeTotals('ST or TF', 'need')}
              </div>
            </div>
          </div>

          <div className="form-footer-section">
            <div className="footer-field">
              <label>5. Prepared by:</label>
              <input type="text" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} />
            </div>
            <div className="footer-field">
              <label>Name and Signature:</label>
              <input type="text" value={preparedBy} readOnly />
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
      </main>

      {showPrint && (
        <Ics215Print
          incidentName={incidentName}
          opFromDate={opFromDate}
          opFromTime={opFromTime}
          opToDate={opToDate}
          opToTime={opToTime}
          resourceIdentifiers={resourceIdentifiers}
          workAssignments={workAssignments}
          preparedBy={preparedBy}
          datePrepared={datePrepared}
          timePrepared={timePrepared}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
