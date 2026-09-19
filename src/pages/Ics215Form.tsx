import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics215Print from './Ics215Print'
import './Ics215Form.css'

let _nextId = 0
const uid = () => `id-${Date.now()}-${++_nextId}`

interface ResourceEntry {
  identifier: string
  required: number
  have: number
  need: number
}

interface WorkAssignment {
  id: string
  branch: string
  division_group: string
  work_assignment: string
  resources: ResourceEntry[]
  overhead_position: string
  special_equipment: string
  reporting_location: string
  requested_arrival_time: string
}

const MAX_SPAN = 7
const MAX_RESOURCES = 30
const HEALTH_KEYWORDS = ['emt', 'med', 'health', 'first aid', 'ambulance', 'paramedic', 'nurse', 'rescue']
const LOCATION_SUGGESTIONS = ['ICP', 'Base', 'Camp', 'Staging Area', 'Other']

const makeWorkAssignment = (): WorkAssignment => ({
  id: uid(), branch: '', division_group: '', work_assignment: '', resources: [],
  overhead_position: '', special_equipment: '', reporting_location: '', requested_arrival_time: '',
})

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

  const [workAssignments, setWorkAssignments] = useState<WorkAssignment[]>([])
  const [resourceIdentifiers, setResourceIdentifiers] = useState<string[]>([])
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

  const [overheadSuggestions, setOverheadSuggestions] = useState<string[]>([])

  const isReadonly = status === 'Submitted' && !isEditing

  const loadForm = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)

    const { data: incident } = await supabase.from('incidents').select('name').eq('incident_id', incidentId).single()
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

    const { data: resources211 } = await supabase
      .from('ics_211_resources').select('leader_name')
      .eq('form_id', (await supabase.from('ics_211_forms').select('id').eq('incident_id', incidentId).order('created_at', { ascending: false }).limit(1).maybeSingle()).data?.id || '')
    if (resources211) {
      setOverheadSuggestions([...new Set(resources211.map((r: any) => r.leader_name).filter(Boolean))])
    }

    const formParam = searchParams.get('form')
    let formToLoad: any = null
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
      setPreparedBy(formToLoad.prepared_by || '')
      setDatePrepared(formToLoad.date_prepared || '')
      setTimePrepared(formToLoad.time_prepared || '')
      setStatus(formToLoad.status)
      setResourceIdentifiers(formToLoad.resource_identifiers ?? [])

      if (formToLoad.work_assignments?.length > 0) {
        setWorkAssignments(formToLoad.work_assignments.map((wa: any) => ({
          id: wa.id || uid(),
          branch: wa.branch || '',
          division_group: wa.division_group || '',
          work_assignment: wa.work_assignment || '',
          resources: wa.resources || [],
          overhead_position: wa.overhead_position || '',
          special_equipment: wa.special_equipment || '',
          reporting_location: wa.reporting_location || '',
          requested_arrival_time: wa.requested_arrival_time || '',
        })))
      }
    }

    setLoading(false)
  }, [incidentId, searchParams])

  useEffect(() => {
    if (!user) return
    const now = new Date()
    setPreparedBy(user.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim() : user.email || '')
    setDatePrepared(now.toISOString().slice(0, 10))
    setTimePrepared(now.toTimeString().slice(0, 5))
    loadForm()
  }, [incidentId, user, searchParams, loadForm])

  const saveForm = async (formStatus: 'Draft' | 'Submitted') => {
    if (!incidentId || !user) return
    setSaving(true); setError(''); setSuccess('')
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const localTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`

    const formData: any = {
      incident_id: incidentId,
      incident_name: incidentName,
      op_period_from_date: opFromDate, op_period_from_time: opFromTime,
      op_period_to_date: opToDate, op_period_to_time: opToTime,
      resource_identifiers: resourceIdentifiers,
      work_assignments: workAssignments,
      status: formStatus, prepared_by: preparedBy,
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
      fId = inserted.id; setFormId(fId)
    }
    setStatus(formStatus); setIsEditing(false); setSaving(false)
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS 215 submitted successfully!')
  }

  const addWorkAssignment = () => setWorkAssignments(prev => [...prev, makeWorkAssignment()])
  const removeWorkAssignment = (id: string) => setWorkAssignments(prev => prev.filter(wa => wa.id !== id))

  const updateWa = (waId: string, field: keyof WorkAssignment, value: any) => {
    setWorkAssignments(prev => prev.map(wa => wa.id === waId ? { ...wa, [field]: value } : wa))
  }

  const getResVal = (waId: string, identifier: string, field: 'required' | 'have' | 'need'): number => {
    const wa = workAssignments.find(w => w.id === waId)
    if (!wa) return 0
    const entry = wa.resources.find(r => r.identifier === identifier)
    return entry ? ((entry as any)[field] || 0) : 0
  }

  const setResVal = (waId: string, identifier: string, field: 'required' | 'have' | 'need', value: number) => {
    setWorkAssignments(prev => prev.map(wa => {
      if (wa.id !== waId) return wa
      const resources = [...wa.resources]
      const idx = resources.findIndex(r => r.identifier === identifier)
      if (idx >= 0) {
        resources[idx] = { ...resources[idx], [field]: value }
      } else {
        resources.push({ identifier, required: 0, have: 0, need: 0, [field]: value })
      }
      return { ...wa, resources }
    }))
  }

  const addResourceIdentifier = () => {
    if (resourceIdentifiers.length >= MAX_RESOURCES) return
    setResourceIdentifiers(prev => [...prev, ''])
  }

  const updateResourceIdentifier = (index: number, value: string) => {
    setResourceIdentifiers(prev => { const n = [...prev]; n[index] = value; return n })
  }

  const removeResourceIdentifier = (index: number) => {
    const removedId = resourceIdentifiers[index]
    setResourceIdentifiers(prev => prev.filter((_, i) => i !== index))
    if (removedId) {
      setWorkAssignments(prev => prev.map(wa => ({
        ...wa,
        resources: wa.resources.filter(r => r.identifier !== removedId)
      })))
    }
  }

  const computeTotal = (identifier: string, field: 'required' | 'have' | 'need') => {
    return workAssignments.reduce((sum, wa) => {
      const entry = wa.resources.find(r => r.identifier === identifier)
      return sum + (entry ? ((entry as any)[field] || 0) : 0)
    }, 0)
  }

  const spanWarnings = useMemo(() => {
    const warnings: string[] = []
    const branches = [...new Set(workAssignments.map(wa => wa.branch).filter(Boolean))]
    if (branches.length > MAX_SPAN) {
      warnings.push(`Span of control exceeded: ${branches.length} branches (max ${MAX_SPAN}).`)
    }
    const divGroups = [...new Set(workAssignments.map(wa => wa.division_group).filter(Boolean))]
    if (divGroups.length > MAX_SPAN) {
      warnings.push(`Span of control exceeded: ${divGroups.length} divisions/groups (max ${MAX_SPAN}).`)
    }
    return warnings
  }, [workAssignments])

  const resourceSuggestions = useMemo(() => {
    const suggestions: string[] = []
    const allIds = resourceIdentifiers.map(id => id.toUpperCase())
    const healthRelated = allIds.filter(id => HEALTH_KEYWORDS.some(kw => id.toLowerCase().includes(kw)))
    if (healthRelated.length >= 3) {
      suggestions.push(`You have ${healthRelated.length} health-related resources (${healthRelated.join(', ')}). Consider combining them into a Health Group.`)
    }
    return suggestions
  }, [resourceIdentifiers])

  if (loading) return <div className="ics215-page"><div className="ics215-loading">Loading ICS Form 215...</div></div>

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
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
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
          {spanWarnings.map((w, i) => <div key={`w-${i}`} className="warning-message">{w}</div>)}
          {resourceSuggestions.map((s, i) => <div key={`s-${i}`} className="info-message">{s}</div>)}

          <div className="form-header-section">
            <h2>OPERATIONAL PLANNING WORKSHEET</h2>
            <h3>ICS 215</h3>
          </div>

          <div className="form-section">
            <div className="form-row two-col">
              <div className="form-field">
                <label>1. INCIDENT/EVENT NAME</label>
                <input type="text" value={incidentName} onChange={e => setIncidentName(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="form-field">
                <label>2. OPERATIONAL PERIOD</label>
                <div className="op-period-row">
                  <span>From:</span>
                  <input type="date" value={opFromDate} onChange={e => setOpFromDate(e.target.value)} disabled={isReadonly} />
                  <input type="time" value={opFromTime} onChange={e => setOpFromTime(e.target.value)} disabled={isReadonly} step="3600" />
                </div>
                <div className="op-period-row">
                  <span>To:</span>
                  <input type="date" value={opToDate} onChange={e => setOpToDate(e.target.value)} disabled={isReadonly} />
                  <input type="time" value={opToTime} onChange={e => setOpToTime(e.target.value)} disabled={isReadonly} step="3600" />
                </div>
              </div>
            </div>
          </div>

          <div className="form-section table-section">
            <label>3. WORK ASSIGNMENTS</label>
            <div className="table-wrapper">
              <table className="wa-main-table">
                <thead>
                  <tr>
                    <th>BRANCH</th>
                    <th>DIV/GROUP</th>
                    <th>WORK ASSIGNMENT</th>
                    <th>RESOURCES</th>
                    {resourceIdentifiers.map((rid, i) => (
                      <th key={i} className="col-res-id">
                        <div className="res-th-top">
                          <input type="text" value={rid} onChange={e => updateResourceIdentifier(i, e.target.value)} disabled={isReadonly} placeholder={`Res ${i + 1}`} className="res-th-input" />
                          {!isReadonly && <button className="res-th-remove" onClick={() => removeResourceIdentifier(i)}>&times;</button>}
                        </div>
                      </th>
                    ))}
                    {!isReadonly && resourceIdentifiers.length < MAX_RESOURCES && (
                      <th className="col-add-res">
                        <button className="add-res-btn" onClick={addResourceIdentifier}>+add</button>
                      </th>
                    )}
                    <th>OVERHEAD</th>
                    <th>EQPT</th>
                    <th>LOCATION</th>
                    <th>ARRIVAL</th>
                    <th className="col-action"></th>
                  </tr>
                </thead>
                <tbody>
                  {workAssignments.map(wa => (
                    ['required', 'have', 'need'].map((field, fi) => {
                      const isFirst = fi === 0
                      return (
                        <tr key={`${wa.id}-${field}`}>
                          {isFirst && <td rowSpan={3} className="cell-text"><input type="text" value={wa.branch} onChange={e => updateWa(wa.id, 'branch', e.target.value)} disabled={isReadonly} placeholder="Branch" /></td>}
                          {isFirst && <td rowSpan={3} className="cell-text"><input type="text" value={wa.division_group} onChange={e => updateWa(wa.id, 'division_group', e.target.value)} disabled={isReadonly} placeholder="Div/Group" /></td>}
                          {isFirst && <td rowSpan={3} className="cell-text"><input type="text" value={wa.work_assignment} onChange={e => updateWa(wa.id, 'work_assignment', e.target.value)} disabled={isReadonly} placeholder="Work assignment" /></td>}
                          <td className="cell-label">{field === 'required' ? 'Required' : field === 'have' ? 'Have' : 'Need'}</td>
                          {resourceIdentifiers.map((rid, ri) => (
                            <td key={ri} className="cell-num">
                              <input type="number" min="0" value={getResVal(wa.id, rid, field as any) || ''} onChange={e => setResVal(wa.id, rid, field as any, parseInt(e.target.value) || 0)} disabled={isReadonly} />
                            </td>
                          ))}
                          {!isReadonly && resourceIdentifiers.length < MAX_RESOURCES && <td className="cell-num"></td>}
                          {isFirst && <td rowSpan={3} className="cell-text"><input type="text" list={`overhead-${wa.id}`} value={wa.overhead_position} onChange={e => updateWa(wa.id, 'overhead_position', e.target.value)} disabled={isReadonly} placeholder="Position" />
                            <datalist id={`overhead-${wa.id}`}>{overheadSuggestions.map(s => <option key={s} value={s} />)}</datalist>
                          </td>}
                          {isFirst && <td rowSpan={3} className="cell-text"><input type="text" value={wa.special_equipment} onChange={e => updateWa(wa.id, 'special_equipment', e.target.value)} disabled={isReadonly} placeholder="Equipment" /></td>}
                          {isFirst && <td rowSpan={3} className="cell-text"><input type="text" list={`location-${wa.id}`} value={wa.reporting_location} onChange={e => updateWa(wa.id, 'reporting_location', e.target.value)} disabled={isReadonly} placeholder="Location" />
                            <datalist id={`location-${wa.id}`}>{LOCATION_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                          </td>}
                          {isFirst && <td rowSpan={3} className="cell-time"><input type="time" value={wa.requested_arrival_time} onChange={e => updateWa(wa.id, 'requested_arrival_time', e.target.value)} disabled={isReadonly} /></td>}
                          {isFirst && <td rowSpan={3} className="col-action">{!isReadonly && <button className="wa-remove-btn" onClick={() => removeWorkAssignment(wa.id)}>&times;</button>}</td>}
                        </tr>
                      )
                    })
                  ))}
                  {workAssignments.length === 0 && (
                    <tr><td colSpan={4 + Math.max(resourceIdentifiers.length, 1) + 5} className="wa-empty-cell">No work assignments yet. Click "+add entry" below.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {!isReadonly && (
              <button className="add-entry-btn" onClick={addWorkAssignment}>+add entry</button>
            )}
          </div>

          <div className="form-section">
            <label>TOTALS</label>
            {resourceIdentifiers.length > 0 ? (
              <div className="totals-wrapper">
                <table className="totals-table">
                  <thead>
                    <tr>
                      <th></th>
                      {resourceIdentifiers.map((rid, i) => <th key={i}>{rid || `Res ${i + 1}`}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>12. Total Required</td>
                      {resourceIdentifiers.map((rid, i) => <td key={i}>{computeTotal(rid, 'required')}</td>)}
                    </tr>
                    <tr>
                      <td>13. Total Have</td>
                      {resourceIdentifiers.map((rid, i) => <td key={i}>{computeTotal(rid, 'have')}</td>)}
                    </tr>
                    <tr>
                      <td>14. Total Needed</td>
                      {resourceIdentifiers.map((rid, i) => <td key={i}>{computeTotal(rid, 'need')}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="wa-empty-hint">Add resource identifiers above to see totals.</p>
            )}
          </div>

          <div className="form-section signature-section">
            <div className="sig-row">
              <div className="sig-field num">15. PREPARED BY OSC</div>
              <div className="sig-field">
                <label>Name and Signature:</label>
                <input type="text" value={preparedBy} onChange={e => setPreparedBy(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Date Prepared:</label>
                <input type="date" value={datePrepared} onChange={e => setDatePrepared(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Time Prepared:</label>
                <input type="time" value={timePrepared} onChange={e => setTimePrepared(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {showPrint && (
        <Ics215Print
          incidentName={incidentName}
          opFromDate={opFromDate} opFromTime={opFromTime}
          opToDate={opToDate} opToTime={opToTime}
          resourceIdentifiers={resourceIdentifiers}
          workAssignments={workAssignments}
          preparedBy={preparedBy} datePrepared={datePrepared} timePrepared={timePrepared}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
