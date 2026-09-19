import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics215APrint from './Ics215APrint'
import './Ics215AForm.css'

let _nextId = 0
const uid = () => `id-${Date.now()}-${++_nextId}`

interface HazardEntry {
  id: string
  identifier: string
  applies: boolean
  mitigating_measures: string
}

interface DivisionEntry {
  id: string
  division_group: string
  hazards: HazardEntry[]
  mitigating_measures: string
}

const MAX_HAZARDS = 30
const DEFAULT_HAZARDS = [
  'Structural Collapse',
  'Hazardous Materials',
  'Fire/Explosion',
  'Flood/Water',
  'Electrical',
  'Weather',
  'Wildlife/Animals',
  'Medical/Biological',
  'Terrain/Access',
  'Other',
]

const makeDivision = (divisionGroup: string = ''): DivisionEntry => ({
  id: uid(),
  division_group: divisionGroup,
  hazards: [],
  mitigating_measures: '',
})

export default function Ics215AForm() {
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

  const [divisions, setDivisions] = useState<DivisionEntry[]>([])
  const [hazardIdentifiers, setHazardIdentifiers] = useState<string[]>([])

  const [preparedBySofr, setPreparedBySofr] = useState('')
  const [datePreparedSofr, setDatePreparedSofr] = useState('')
  const [timePreparedSofr, setTimePreparedSofr] = useState('')
  const [preparedByOsc, setPreparedByOsc] = useState('')
  const [datePreparedOsc, setDatePreparedOsc] = useState('')
  const [timePreparedOsc, setTimePreparedOsc] = useState('')

  const [status, setStatus] = useState<'Draft' | 'Submitted'>('Draft')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPrint, setShowPrint] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const isReadonly = status === 'Submitted' && !isEditing

  const loadForm = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)

    const { data: incident } = await supabase
      .from('incidents')
      .select('name')
      .eq('incident_id', incidentId)
      .single()
    if (incident) setIncidentName(incident.name)

    const { data: form202 } = await supabase
      .from('ics_202_forms')
      .select('op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (form202) {
      setOpFromDate(form202.op_period_from_date)
      setOpFromTime(form202.op_period_from_time)
      setOpToDate(form202.op_period_to_date)
      setOpToTime(form202.op_period_to_time)
    }

    const formParam = searchParams.get('form')
    let formToLoad: any = null
    if (formParam) {
      const { data } = await supabase.from('ics_215a_forms').select('*').eq('id', formParam).single()
      formToLoad = data
    } else {
      const { data } = await supabase
        .from('ics_215a_forms')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      formToLoad = data
    }

    if (formToLoad) {
      setFormId(formToLoad.id)
      setIncidentName(formToLoad.incident_name || '')
      setOpFromDate(formToLoad.op_period_from_date || '')
      setOpFromTime(formToLoad.op_period_from_time || '')
      setOpToDate(formToLoad.op_period_to_date || '')
      setOpToTime(formToLoad.op_period_to_time || '')
      setPreparedBySofr(formToLoad.prepared_by_sofr || '')
      setDatePreparedSofr(formToLoad.date_prepared_sofr || '')
      setTimePreparedSofr(formToLoad.time_prepared_sofr || '')
      setPreparedByOsc(formToLoad.prepared_by_osc || '')
      setDatePreparedOsc(formToLoad.date_prepared_osc || '')
      setTimePreparedOsc(formToLoad.time_prepared_osc || '')
      setStatus(formToLoad.status)
      setHazardIdentifiers(formToLoad.hazard_identifiers ?? [])

      if (formToLoad.divisions?.length > 0) {
        setDivisions(
          formToLoad.divisions.map((d: any) => ({
            id: d.id || uid(),
            division_group: d.division_group || '',
            hazards: (d.hazards || []).map((h: any) => ({
              id: h.id || uid(),
              identifier: h.identifier || '',
              applies: h.applies ?? false,
              mitigating_measures: h.mitigating_measures || '',
            })),
            mitigating_measures: d.mitigating_measures || '',
          }))
        )
      } else {
        await prefillDivisionsFrom215()
      }
    } else {
      setHazardIdentifiers([...DEFAULT_HAZARDS])
      await prefillDivisionsFrom215()
    }

    setLoading(false)
  }, [incidentId, searchParams])

  const prefillDivisionsFrom215 = async () => {
    if (!incidentId) return
    const { data: latest215 } = await supabase
      .from('ics_215_forms')
      .select('work_assignments')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest215 && latest215.work_assignments && latest215.work_assignments.length > 0) {
      const assignments = latest215.work_assignments as any[]
      const divNames: string[] = [
        ...new Set(
          assignments
            .map((wa: any) => wa.division_group as string)
            .filter(Boolean)
        ),
      ]
      setDivisions(divNames.map(name => makeDivision(name)))
    }
  }

  useEffect(() => {
    if (!user) return
    const now = new Date()
    const firstName = user.user_metadata?.first_name || ''
    const lastName = user.user_metadata?.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim() || user.email || ''
    setPreparedBySofr(fullName)
    setPreparedByOsc(fullName)
    setDatePreparedSofr(now.toISOString().slice(0, 10))
    setTimePreparedSofr(now.toTimeString().slice(0, 5))
    setDatePreparedOsc(now.toISOString().slice(0, 10))
    setTimePreparedOsc(now.toTimeString().slice(0, 5))
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

    const formData: any = {
      incident_id: incidentId,
      incident_name: incidentName,
      op_period_from_date: opFromDate,
      op_period_from_time: opFromTime,
      op_period_to_date: opToDate,
      op_period_to_time: opToTime,
      hazard_identifiers: hazardIdentifiers,
      divisions: divisions,
      status: formStatus,
      prepared_by_sofr: preparedBySofr,
      date_prepared_sofr: formStatus === 'Submitted' ? localDate : datePreparedSofr,
      time_prepared_sofr: formStatus === 'Submitted' ? localTime : timePreparedSofr,
      prepared_by_osc: preparedByOsc,
      date_prepared_osc: formStatus === 'Submitted' ? localDate : datePreparedOsc,
      time_prepared_osc: formStatus === 'Submitted' ? localTime : timePreparedOsc,
      updated_at: now.toISOString(),
    }

    let fId = formId
    if (fId) {
      const { error: e } = await supabase.from('ics_215a_forms').update(formData).eq('id', fId)
      if (e) {
        setError(e.message)
        setSaving(false)
        return
      }
    } else {
      const { data: inserted, error: e } = await supabase.from('ics_215a_forms').insert(formData).select().single()
      if (e) {
        setError(e.message)
        setSaving(false)
        return
      }
      fId = inserted.id
      setFormId(fId)
    }
    setStatus(formStatus)
    setIsEditing(false)
    setSaving(false)
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS 215-A submitted successfully!')
  }

  const addDivision = () => setDivisions(prev => [...prev, makeDivision()])
  const removeDivision = (id: string) => setDivisions(prev => prev.filter(d => d.id !== id))

  const updateDivision = (divId: string, field: keyof DivisionEntry, value: any) => {
    setDivisions(prev => prev.map(d => (d.id === divId ? { ...d, [field]: value } : d)))
  }

  const getHazardApplies = (divId: string, hazardId: string): boolean => {
    const div = divisions.find(d => d.id === divId)
    if (!div) return false
    const h = div.hazards.find(hz => hz.identifier === hazardId)
    return h?.applies ?? false
  }

  const setHazardApplies = (divId: string, hazardId: string, applies: boolean) => {
    setDivisions(prev =>
      prev.map(d => {
        if (d.id !== divId) return d
        const hazards = [...d.hazards]
        const idx = hazards.findIndex(h => h.identifier === hazardId)
        if (idx >= 0) {
          hazards[idx] = { ...hazards[idx], applies }
        } else {
          hazards.push({ id: uid(), identifier: hazardId, applies, mitigating_measures: '' })
        }
        return { ...d, hazards }
      })
    )
  }

  const addHazardIdentifier = () => {
    if (hazardIdentifiers.length >= MAX_HAZARDS) return
    setHazardIdentifiers(prev => [...prev, ''])
  }

  const updateHazardIdentifier = (index: number, value: string) => {
    setHazardIdentifiers(prev => {
      const n = [...prev]
      const oldVal = n[index]
      n[index] = value
      if (oldVal !== value) {
        setDivisions(divs =>
          divs.map(d => ({
            ...d,
            hazards: d.hazards.map(h =>
              h.identifier === oldVal ? { ...h, identifier: value } : h
            ),
          }))
        )
      }
      return n
    })
  }

  const removeHazardIdentifier = (index: number) => {
    const removedId = hazardIdentifiers[index]
    setHazardIdentifiers(prev => prev.filter((_, i) => i !== index))
    if (removedId) {
      setDivisions(prev =>
        prev.map(d => ({
          ...d,
          hazards: d.hazards.filter(h => h.identifier !== removedId),
        }))
      )
    }
  }

  if (loading)
    return (
      <div className="ics215a-page">
        <div className="ics215a-loading">Loading ICS Form 215-A...</div>
      </div>
    )

  return (
    <div className="ics215a-page">
      <header className="ics215a-header no-print">
        <div
          className="header-brand"
          onClick={() => navigate(`/incident/${incidentId}`)}
          style={{ cursor: 'pointer' }}
        >
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics215a-topbar no-print">
        <div className="topbar-left">
          <button
            className="topbar-btn back"
            onClick={() => navigate(`/incident/${incidentId}`)}
          >
            &larr; Back
          </button>
          <span className="form-badge">ICS 215-A</span>
          <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
        </div>
        <div className="topbar-actions">
          <button
            className="action-btn save"
            onClick={() => saveForm('Draft')}
            disabled={saving || isReadonly}
          >
            {saving ? 'Saving...' : 'Save Progress'}
          </button>
          <button
            className="action-btn submit"
            onClick={() => saveForm('Submitted')}
            disabled={saving || isReadonly}
          >
            {saving ? 'Submitting...' : 'Submit'}
          </button>
          {status === 'Submitted' && !isEditing && (
            <button className="action-btn edit" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          )}
          <button className="action-btn print" onClick={() => setShowPrint(true)} disabled={saving}>
            Print
          </button>
        </div>
      </div>

      <main className="ics215a-main no-print">
        <div className="ics215a-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>INCIDENT/EVENT SAFETY, RISK AND HEALTH ANALYSIS</h2>
            <h3>ICS 215-A</h3>
          </div>

          <div className="form-section">
            <div className="form-row two-col">
              <div className="form-field">
                <label>1. INCIDENT/EVENT NAME</label>
                <input
                  type="text"
                  value={incidentName}
                  onChange={e => setIncidentName(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
              <div className="form-field">
                <label>2. OPERATIONAL PERIOD</label>
                <div className="op-period-row">
                  <span>From:</span>
                  <input
                    type="date"
                    value={opFromDate}
                    onChange={e => setOpFromDate(e.target.value)}
                    disabled={isReadonly}
                  />
                  <input
                    type="time"
                    value={opFromTime}
                    onChange={e => setOpFromTime(e.target.value)}
                    disabled={isReadonly}
                    step="3600"
                  />
                </div>
                <div className="op-period-row">
                  <span>To:</span>
                  <input
                    type="date"
                    value={opToDate}
                    onChange={e => setOpToDate(e.target.value)}
                    disabled={isReadonly}
                  />
                  <input
                    type="time"
                    value={opToTime}
                    onChange={e => setOpToTime(e.target.value)}
                    disabled={isReadonly}
                    step="3600"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="form-section table-section">
            <label>3. DIVISION / GROUP / HAZARD ANALYSIS</label>
            <p className="table-hint">Check applicable hazards and specify mitigating measures for each division.</p>
            <div className="table-wrapper">
              <table className="hz-main-table">
                <thead>
                  <tr>
                    <th className="col-div-group">Division/Group/Others</th>
                    {hazardIdentifiers.map((hid, i) => (
                      <th key={i} className={`col-hz-id ${!isReadonly ? 'edit-mode' : ''}`}>
                        <div className="hz-th-top">
                          <input
                            type="text"
                            value={hid}
                            onChange={e => updateHazardIdentifier(i, e.target.value)}
                            disabled={isReadonly}
                            placeholder={`Hazard ${i + 1}`}
                            className="hz-th-input"
                          />
                          {!isReadonly && (
                            <button className="hz-th-remove" onClick={() => removeHazardIdentifier(i)}>
                              &times;
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    {!isReadonly && hazardIdentifiers.length < MAX_HAZARDS && (
                      <th className="col-add-hz">
                        <button className="add-hz-btn" onClick={addHazardIdentifier}>
                          +add hazard
                        </button>
                      </th>
                    )}
                    <th className="col-measures">MITIGATING MEASURES</th>
                    <th className="col-action"></th>
                  </tr>
                </thead>
                <tbody>
                  {divisions.map(div => (
                    <tr key={div.id}>
                        <td className="cell-text">
                          <input
                            type="text"
                            value={div.division_group}
                            onChange={e => updateDivision(div.id, 'division_group', e.target.value)}
                            disabled={isReadonly}
                            placeholder="Division/Group/Others"
                          />
                        </td>
                        {hazardIdentifiers.map((hid, hi) => (
                          <td key={hi} className="cell-check">
                            <input
                              type="checkbox"
                              className="checkbox-lg"
                              checked={getHazardApplies(div.id, hid)}
                              onChange={e => setHazardApplies(div.id, hid, e.target.checked)}
                              disabled={isReadonly}
                            />
                          </td>
                        ))}
                        {!isReadonly && hazardIdentifiers.length < MAX_HAZARDS && <td></td>}
                        <td className="cell-measures">
                          <input
                            type="text"
                            value={div.mitigating_measures}
                            onChange={e => updateDivision(div.id, 'mitigating_measures', e.target.value)}
                            disabled={isReadonly}
                            placeholder="e.g., Always wear proper PPEs"
                            className="measures-input"
                          />
                        </td>
                        <td className="col-action">
                          {!isReadonly && (
                            <button className="div-remove-btn" onClick={() => removeDivision(div.id)}>
                              &times;
                            </button>
                          )}
                        </td>
                      </tr>
                  ))}
                  {divisions.length === 0 && (
                    <tr>
                      <td
                        colSpan={2 + Math.max(hazardIdentifiers.length, 1) + 1}
                        className="div-empty-cell"
                      >
                        No divisions yet. Click "+add division" below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!isReadonly && (
              <button className="add-entry-btn" onClick={addDivision}>
                +add division
              </button>
            )}
          </div>

          <div className="form-section signature-section">
            <div className="sig-row">
              <div className="sig-field num">4. PREPARED BY SOFR</div>
              <div className="sig-field">
                <label>Name and Signature:</label>
                <input
                  type="text"
                  value={preparedBySofr}
                  onChange={e => setPreparedBySofr(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
              <div className="sig-field">
                <label>Date Prepared:</label>
                <input
                  type="date"
                  value={datePreparedSofr}
                  onChange={e => setDatePreparedSofr(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
              <div className="sig-field">
                <label>Time Prepared:</label>
                <input
                  type="time"
                  value={timePreparedSofr}
                  onChange={e => setTimePreparedSofr(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
            </div>
            <div className="sig-row">
              <div className="sig-field num">5. PREPARED BY OSC</div>
              <div className="sig-field">
                <label>Name and Signature:</label>
                <input
                  type="text"
                  value={preparedByOsc}
                  onChange={e => setPreparedByOsc(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
              <div className="sig-field">
                <label>Date Prepared:</label>
                <input
                  type="date"
                  value={datePreparedOsc}
                  onChange={e => setDatePreparedOsc(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
              <div className="sig-field">
                <label>Time Prepared:</label>
                <input
                  type="time"
                  value={timePreparedOsc}
                  onChange={e => setTimePreparedOsc(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {showPrint && (
        <Ics215APrint
          incidentName={incidentName}
          opFromDate={opFromDate}
          opFromTime={opFromTime}
          opToDate={opToDate}
          opToTime={opToTime}
          hazardIdentifiers={hazardIdentifiers}
          divisions={divisions}
          preparedBySofr={preparedBySofr}
          datePreparedSofr={datePreparedSofr}
          timePreparedSofr={timePreparedSofr}
          preparedByOsc={preparedByOsc}
          datePreparedOsc={datePreparedOsc}
          timePreparedOsc={timePreparedOsc}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
