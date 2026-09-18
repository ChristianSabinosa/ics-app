import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics208Print from './Ics208Print'
import './Ics208Form.css'

export default function Ics208Form() {
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

  const [safetyMessage, setSafetyMessage] = useState('')
  const [safetyPlanRequired, setSafetyPlanRequired] = useState<boolean | null>(null)
  const [safetyPlanLocation, setSafetyPlanLocation] = useState('')

  const [preparedByName, setPreparedByName] = useState('')
  const [preparedDate, setPreparedDate] = useState('')
  const [preparedTime, setPreparedTime] = useState('')

  const [status, setStatus] = useState<'Draft' | 'Submitted'>('Draft')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPrint, setShowPrint] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

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
      .single()
    if (form202) {
      setOpFromDate(form202.op_period_from_date || '')
      setOpFromTime(form202.op_period_from_time || '')
      setOpToDate(form202.op_period_to_date || '')
      setOpToTime(form202.op_period_to_time || '')
    }

    const formParam = searchParams.get('form')
    let formToLoad = null

    if (formParam) {
      const { data: form } = await supabase
        .from('ics_208_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    } else {
      const { data: existingForm } = await supabase
        .from('ics_208_forms')
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
      setSafetyMessage(formToLoad.safety_message)
      setSafetyPlanRequired(formToLoad.safety_plan_required)
      setSafetyPlanLocation(formToLoad.safety_plan_location)
      setPreparedByName(formToLoad.prepared_by_name)
      setPreparedDate(formToLoad.prepared_date)
      setPreparedTime(formToLoad.prepared_time)
      setStatus(formToLoad.status)
    }

    setLoading(false)
  }, [incidentId, searchParams])

  useEffect(() => {
    if (!user) return
    const now = new Date()
    setPreparedByName(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    setPreparedDate(now.toISOString().slice(0, 10))
    setPreparedTime(now.toTimeString().slice(0, 5))
    loadForm()
  }, [incidentId, user, searchParams, loadForm])

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
      safety_message: safetyMessage,
      safety_plan_required: safetyPlanRequired,
      safety_plan_location: safetyPlanLocation,
      prepared_by_name: preparedByName,
      prepared_date: formStatus === 'Submitted' ? now.toISOString().slice(0, 10) : preparedDate,
      prepared_time: formStatus === 'Submitted' ? now.toTimeString().slice(0, 5) : preparedTime,
      status: formStatus,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_208_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_208_forms')
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
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 208 submitted successfully!')
  }

  if (loading) {
    return (
      <div className="ics208-page">
        <div className="ics208-loading">Loading ICS Form 208...</div>
      </div>
    )
  }

  const isReadonly = status === 'Submitted' && !isEditing

  return (
    <div className="ics208-page">
      <header className="ics208-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics208-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="form-badge">ICS 208</span>
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

      <main className="ics208-main no-print">
        <div className="ics208-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>SAFETY MESSAGE/ PLAN</h2>
            <h3>ICS 208</h3>
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
            <label>3. SAFETY MESSAGE</label>
            <textarea
              value={safetyMessage}
              onChange={e => setSafetyMessage(e.target.value)}
              disabled={isReadonly}
              rows={10}
              placeholder="e.g., Always work in pairs, maintain situational awareness, always wear PPE, report all hazards immediately, know your evacuation routes, stay hydrated, use the buddy system, etc."
            />
          </div>

          <div className="form-section">
            <label>4. SITE SAFETY PLAN REQUIRED?</label>
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
                <label>LOCATION OF SAFETY PLAN:</label>
                <input
                  type="text"
                  value={safetyPlanLocation}
                  onChange={e => setSafetyPlanLocation(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
            )}
          </div>

          <div className="form-section signature-section">
            <div className="sig-row">
              <div className="sig-field num">5. Prepared by SOFR</div>
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
                <input type="time" value={preparedTime} onChange={e => setPreparedTime(e.target.value)} disabled={isReadonly} step="3600" />
              </div>
            </div>
          </div>

        </div>
      </main>

      {showPrint && (
        <Ics208Print
          incidentName={incidentName}
          opFromDate={opFromDate}
          opFromTime={opFromTime}
          opToDate={opToDate}
          opToTime={opToTime}
          safetyMessage={safetyMessage}
          safetyPlanRequired={safetyPlanRequired}
          safetyPlanLocation={safetyPlanLocation}
          preparedByName={preparedByName}
          preparedDate={preparedDate}
          preparedTime={preparedTime}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
