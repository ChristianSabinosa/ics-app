import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics202Print from './Ics202Print'
import './Ics202Form.css'

export default function Ics202Form() {
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

  const [objectives, setObjectives] = useState('')
  const [commandEmphasis, setCommandEmphasis] = useState('')
  const [weatherForecast, setWeatherForecast] = useState('')
  const [safetyMessage, setSafetyMessage] = useState('')

  const [safetyPlanRequired, setSafetyPlanRequired] = useState(false)
  const [safetyPlanLocation, setSafetyPlanLocation] = useState('')

  const [attach203, setAttach203] = useState(false)
  const [attach204, setAttach204] = useState(false)
  const [attach205, setAttach205] = useState(false)
  const [attach206, setAttach206] = useState(false)
  const [attach209, setAttach209] = useState(false)
  const [attachMap, setAttachMap] = useState(false)
  const [attachOthers, setAttachOthers] = useState(false)
  const [attachOthersText, setAttachOthersText] = useState('')

  const [preparedByName, setPreparedByName] = useState('')
  const [preparedBySig, setPreparedBySig] = useState('')
  const [preparedDate, setPreparedDate] = useState('')
  const [preparedTime, setPreparedTime] = useState('')

  const [approvedByName, setApprovedByName] = useState('')
  const [approvedBySig, setApprovedBySig] = useState('')
  const [approvedDate, setApprovedDate] = useState('')
  const [approvedTime, setApprovedTime] = useState('')

  const [status, setStatus] = useState<'Draft' | 'Submitted'>('Draft')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPrint, setShowPrint] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!user) return
    const now = new Date()
    setPreparedByName(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    setPreparedDate(now.toISOString().slice(0, 10))
    setPreparedTime(now.toTimeString().slice(0, 5))
    loadForm()
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
        .from('ics_202_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    } else {
      const { data: existingForm } = await supabase
        .from('ics_202_forms')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      formToLoad = existingForm
    }

    if (formToLoad) {
      setFormId(formToLoad.id)
      setIncidentName(formToLoad.incident_name)
      setOpFromDate(formToLoad.op_period_from_date)
      setOpFromTime(formToLoad.op_period_from_time)
      setOpToDate(formToLoad.op_period_to_date)
      setOpToTime(formToLoad.op_period_to_time)
      setObjectives(formToLoad.objectives)
      setCommandEmphasis(formToLoad.command_emphasis)
      setWeatherForecast(formToLoad.weather_forecast)
      setSafetyMessage(formToLoad.safety_message)
      setSafetyPlanRequired(formToLoad.safety_plan_required)
      setSafetyPlanLocation(formToLoad.safety_plan_location)
      setAttach203(formToLoad.attach_203)
      setAttach204(formToLoad.attach_204)
      setAttach205(formToLoad.attach_205)
      setAttach206(formToLoad.attach_206)
      setAttach209(formToLoad.attach_209)
      setAttachMap(formToLoad.attach_map)
      setAttachOthers(formToLoad.attach_others)
      setAttachOthersText(formToLoad.attach_others_text)
      setPreparedByName(formToLoad.prepared_by_name)
      setPreparedBySig(formToLoad.prepared_by_sig)
      setPreparedDate(formToLoad.prepared_date)
      setPreparedTime(formToLoad.prepared_time)
      setApprovedByName(formToLoad.approved_by_name)
      setApprovedBySig(formToLoad.approved_by_sig)
      setApprovedDate(formToLoad.approved_date)
      setApprovedTime(formToLoad.approved_time)
      setStatus(formToLoad.status)
    }

    // Auto-check attachments based on submitted forms
    await autoCheckAttachments(incidentId)

    setLoading(false)
  }

  const autoCheckAttachments = async (incId: string) => {
    const checks = [
      { table: 'ics_203_forms', setter: setAttach203 },
      { table: 'ics_204_forms', setter: setAttach204 },
      { table: 'ics_205_forms', setter: setAttach205 },
      { table: 'ics_206_forms', setter: setAttach206 },
      { table: 'ics_209_forms', setter: setAttach209 },
    ]
    for (const check of checks) {
      const { data } = await supabase
        .from(check.table)
        .select('id')
        .eq('incident_id', incId)
        .limit(1)
      if (data && data.length > 0) check.setter(true)
    }
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
      op_period_from_date: opFromDate,
      op_period_from_time: opFromTime,
      op_period_to_date: opToDate,
      op_period_to_time: opToTime,
      objectives,
      command_emphasis: commandEmphasis,
      weather_forecast: weatherForecast,
      safety_message: safetyMessage,
      safety_plan_required: safetyPlanRequired,
      safety_plan_location: safetyPlanLocation,
      attach_203: attach203,
      attach_204: attach204,
      attach_205: attach205,
      attach_206: attach206,
      attach_209: attach209,
      attach_map: attachMap,
      attach_others: attachOthers,
      attach_others_text: attachOthersText,
      prepared_by_name: preparedByName,
      prepared_by_sig: preparedBySig,
      prepared_date: formStatus === 'Submitted' ? now.toISOString().slice(0, 10) : preparedDate,
      prepared_time: formStatus === 'Submitted' ? now.toTimeString().slice(0, 5) : preparedTime,
      approved_by_name: approvedByName,
      approved_by_sig: approvedBySig,
      approved_date: approvedDate,
      approved_time: approvedTime,
      status: formStatus,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_202_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_202_forms')
        .insert(formData)
        .select()
        .single()
      if (insertError) { setError(insertError.message); setSaving(false); return }
      fId = inserted.id
      setFormId(fId)
    }

    setSaving(false)
    setStatus(formStatus)
    setIsEditing(false)
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 202 submitted successfully!')
  }

  if (loading) {
    return (
      <div className="ics202-page">
        <div className="ics202-loading">Loading ICS Form 202...</div>
      </div>
    )
  }

  const isReadonly = status === 'Submitted' && !isEditing

  return (
    <div className="ics202-page">
      <header className="ics202-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics202-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="form-badge">ICS 202</span>
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

      <main className="ics202-main no-print">
        <div className="ics202-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>INCIDENT OBJECTIVES</h2>
            <h3>ICS 202</h3>
          </div>

          <div className="form-section">
            <div className="form-row two-col">
              <div className="form-field">
                <label>1. INCIDENT/EVENT NAME</label>
                <input type="text" value={incidentName} readOnly className="readonly" />
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

          <div className="form-section">
            <label>3. OBJECTIVES FOR THE OPERATIONAL PERIOD</label>
            <textarea
              value={objectives}
              onChange={e => setObjectives(e.target.value)}
              disabled={isReadonly}
              rows={5}
              placeholder="e.g., Ensure the safety of the responders and the general public at all times."
            />
          </div>

          <div className="form-section">
            <label>4. OPERATIONAL PERIOD COMMAND EMPHASIS</label>
            <textarea
              value={commandEmphasis}
              onChange={e => setCommandEmphasis(e.target.value)}
              disabled={isReadonly}
              rows={4}
            />
          </div>

          <div className="form-section">
            <label>5. GENERAL SITUATION AWARENESS (WEATHER FORECAST)</label>
            <textarea
              value={weatherForecast}
              onChange={e => setWeatherForecast(e.target.value)}
              disabled={isReadonly}
              rows={4}
            />
          </div>

          <div className="form-section">
            <label>6. GENERAL SAFETY MESSAGE</label>
            <textarea
              value={safetyMessage}
              onChange={e => setSafetyMessage(e.target.value)}
              disabled={isReadonly}
              rows={4}
            />
          </div>

          <div className="form-section">
            <label>7. SITE SAFETY PLAN REQUIRED?</label>
            <div className="toggle-row">
              <label className="toggle-label">
                <input
                  type="radio"
                  name="safetyPlan"
                  checked={safetyPlanRequired === true}
                  onChange={() => setSafetyPlanRequired(true)}
                  disabled={isReadonly}
                /> YES
              </label>
              <label className="toggle-label">
                <input
                  type="radio"
                  name="safetyPlan"
                  checked={safetyPlanRequired === false}
                  onChange={() => setSafetyPlanRequired(false)}
                  disabled={isReadonly}
                /> NO
              </label>
            </div>
            {safetyPlanRequired && (
              <div className="form-field inline-field">
                <label>Location of Approved Site Safety Plan:</label>
                <input
                  type="text"
                  value={safetyPlanLocation}
                  onChange={e => setSafetyPlanLocation(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
            )}
          </div>

          <div className="form-section">
            <label>8. ATTACHMENTS (CHECK IF ATTACHED)</label>
            <div className="attachments-grid">
              <div className="attach-col">
                <label className="attach-item">
                  <input type="checkbox" checked={attach203} onChange={e => setAttach203(e.target.checked)} disabled={isReadonly} />
                  <span>ORGANIZATION LIST - ICS 203</span>
                </label>
                <label className="attach-item">
                  <input type="checkbox" checked={attach204} onChange={e => setAttach204(e.target.checked)} disabled={isReadonly} />
                  <span>DIV. ASSIGNMENT LISTS - ICS 204</span>
                </label>
                <label className="attach-item">
                  <input type="checkbox" checked={attach205} onChange={e => setAttach205(e.target.checked)} disabled={isReadonly} />
                  <span>COMMUNICATIONS PLAN - ICS 205</span>
                </label>
              </div>
              <div className="attach-col">
                <label className="attach-item">
                  <input type="checkbox" checked={attach206} onChange={e => setAttach206(e.target.checked)} disabled={isReadonly} />
                  <span>MEDICAL PLAN - ICS 206</span>
                </label>
                <label className="attach-item">
                  <input type="checkbox" checked={attach209} onChange={e => setAttach209(e.target.checked)} disabled={isReadonly} />
                  <span>SAFETY MESSAGE/PLAN - ICS 208</span>
                </label>
                <label className="attach-item">
                  <input type="checkbox" checked={attachMap} onChange={e => setAttachMap(e.target.checked)} disabled={isReadonly} />
                  <span>INCIDENT/EVENT MAP</span>
                </label>
              </div>
              <div className="attach-col others-col">
                <label className="attach-item">
                  <input type="checkbox" checked={attachOthers} onChange={e => setAttachOthers(e.target.checked)} disabled={isReadonly} />
                  <span>OTHERS:</span>
                </label>
                {attachOthers && (
                  <input
                    type="text"
                    className="others-input"
                    value={attachOthersText}
                    onChange={e => setAttachOthersText(e.target.value)}
                    disabled={isReadonly}
                    placeholder="Specify"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="form-section signature-section">
            <div className="sig-row">
              <div className="sig-field num">9. Prepared by PSC</div>
              <div className="sig-field">
                <label>Name and Signature:</label>
                <input type="text" value={preparedByName} onChange={e => setPreparedByName(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Date Prepared:</label>
                <input type="date" value={preparedDate} onChange={e => setPreparedDate(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Time Prepared:</label>
                <input type="time" value={preparedTime} onChange={e => setPreparedTime(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
            <div className="sig-row">
              <div className="sig-field num">10. Approved by IC</div>
              <div className="sig-field">
                <label>Name and Signature:</label>
                <input type="text" value={approvedByName} onChange={e => setApprovedByName(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Date Approved:</label>
                <input type="date" value={approvedDate} onChange={e => setApprovedDate(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Time Approved:</label>
                <input type="time" value={approvedTime} onChange={e => setApprovedTime(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
          </div>

        </div>
      </main>

      {showPrint && (
        <Ics202Print
          incidentName={incidentName}
          opFromDate={opFromDate}
          opFromTime={opFromTime}
          opToDate={opToDate}
          opToTime={opToTime}
          objectives={objectives}
          commandEmphasis={commandEmphasis}
          weatherForecast={weatherForecast}
          safetyMessage={safetyMessage}
          safetyPlanRequired={safetyPlanRequired}
          safetyPlanLocation={safetyPlanLocation}
          attach203={attach203}
          attach204={attach204}
          attach205={attach205}
          attach206={attach206}
          attach209={attach209}
          attachMap={attachMap}
          attachOthers={attachOthers}
          attachOthersText={attachOthersText}
          preparedByName={preparedByName}
          preparedBySig={preparedBySig}
          preparedDate={preparedDate}
          preparedTime={preparedTime}
          approvedByName={approvedByName}
          approvedBySig={approvedBySig}
          approvedDate={approvedDate}
          approvedTime={approvedTime}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
