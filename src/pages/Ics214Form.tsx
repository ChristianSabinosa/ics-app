import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics214Print from './Ics214Print'
import { useFormAccess } from '../components/FormAccess'
import { useTrainingSignature } from '../lib/signatureRules'
import { isOfflinePath, getOperatorName } from '../lib/offline/mode'
import {
  getOfflineIncident,
  offLatest,
  offGet,
  offInsert,
  offUpdate,
  touchOfflineIncident,
} from '../lib/offline/store'
import './Ics214Form.css'

interface ResourceRow {
  name: string
  icsPosition: string
  agencyOffice: string
}

interface ActivityRow {
  date: string
  time: string
  notableActivities: string
}

function emptyResourceRow(): ResourceRow {
  return { name: '', icsPosition: '', agencyOffice: '' }
}

function emptyActivityRow(): ActivityRow {
  const now = new Date()
  return { date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5), notableActivities: '' }
}

export default function Ics214Form() {
  const { id: incidentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canEdit } = useFormAccess()

  // Offline Mode (/offline/...): same form, local IndexedDB store, no auth.
  const offMode = isOfflinePath(useLocation().pathname)
  const homePath = offMode ? `/offline/${incidentId}` : `/incident/${incidentId}`

  const [formId, setFormId] = useState<string | null>(null)
  const [incidentName, setIncidentName] = useState('')

  const [opFromDate, setOpFromDate] = useState('')
  const [opFromTime, setOpFromTime] = useState('')
  const [opToDate, setOpToDate] = useState('')
  const [opToTime, setOpToTime] = useState('')

  const [name, setName] = useState('')
  const [icsPosition, setIcsPosition] = useState('')
  const [agencyOffice, setAgencyOffice] = useState('')

  const [resources, setResources] = useState<ResourceRow[]>([emptyResourceRow()])
  const [activityLog, setActivityLog] = useState<ActivityRow[]>([emptyActivityRow()])

  const [preparedByName, setPreparedByName] = useState('')
  const [preparedBySig, setPreparedBySig] = useState('')

  // Training Mode: ICS 214 may be prepared by any trainee
  const sig = useTrainingSignature('214')
  useEffect(() => {
    if (sig.enabled && sig.prepared && !preparedByName && !preparedBySig) {
      setPreparedByName(sig.prepared)
      setPreparedBySig(sig.prepared)
    }
  }, [sig.enabled, sig.prepared, preparedByName, preparedBySig])
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

    if (offMode) {
      const incident = await getOfflineIncident(incidentId)
      if (incident) setIncidentName(incident.name)

      const form202 = await offLatest('ics_202_forms', incidentId)
      if (form202) {
        setOpFromDate((form202.op_period_from_date as string) || '')
        setOpFromTime((form202.op_period_from_time as string) || '')
        setOpToDate((form202.op_period_to_date as string) || '')
        setOpToTime((form202.op_period_to_time as string) || '')
      }

      const formParam = searchParams.get('form')
      const saved = formParam ? await offGet('ics_214_forms', formParam) : undefined
      if (saved) {
        setFormId(saved.id as string)
        setIncidentName(saved.incident_name as string)
        setOpFromDate(saved.op_period_from_date as string)
        setOpFromTime(saved.op_period_from_time as string)
        setOpToDate(saved.op_period_to_date as string)
        setOpToTime(saved.op_period_to_time as string)
        setName(saved.name as string)
        setIcsPosition(saved.ics_position as string)
        setAgencyOffice(saved.agency_office as string)
        if (Array.isArray(saved.resources_assigned)) setResources(saved.resources_assigned as ResourceRow[])
        if (Array.isArray(saved.activity_log)) setActivityLog(saved.activity_log as ActivityRow[])
        setPreparedByName(saved.prepared_by_name as string)
        setPreparedBySig(saved.prepared_by_sig as string)
        setPreparedDate(saved.prepared_date as string)
        setPreparedTime(saved.prepared_time as string)
        setStatus(saved.status as 'Draft' | 'Submitted')
      }
      setLoading(false)
      return
    }

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

    // Many 214s per incident (same as ICS 204/221): only ?form=<id> opens a
    // saved activity log — every other visit starts a brand-new one.
    if (formParam) {
      const { data: form } = await supabase
        .from('ics_214_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    }

    if (formToLoad) {
      setFormId(formToLoad.id)
      setIncidentName(formToLoad.incident_name)
      setOpFromDate(formToLoad.op_period_from_date)
      setOpFromTime(formToLoad.op_period_from_time)
      setOpToDate(formToLoad.op_period_to_date)
      setOpToTime(formToLoad.op_period_to_time)
      setName(formToLoad.name)
      setIcsPosition(formToLoad.ics_position)
      setAgencyOffice(formToLoad.agency_office)
      if (formToLoad.resources_assigned && Array.isArray(formToLoad.resources_assigned)) {
        setResources(formToLoad.resources_assigned)
      }
      if (formToLoad.activity_log && Array.isArray(formToLoad.activity_log)) {
        setActivityLog(formToLoad.activity_log)
      }
      setPreparedByName(formToLoad.prepared_by_name)
      setPreparedBySig(formToLoad.prepared_by_sig)
      setPreparedDate(formToLoad.prepared_date)
      setPreparedTime(formToLoad.prepared_time)
      setStatus(formToLoad.status)
    }

    setLoading(false)
  }, [incidentId, searchParams, offMode])

  useEffect(() => {
    if (!user && !offMode) return
    const now = new Date()
    const firstName = user?.user_metadata?.first_name || ''
    const lastName = user?.user_metadata?.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim() || user?.email || (offMode ? getOperatorName() : '')
    setName(fullName)
    setPreparedByName(fullName)
    setPreparedDate(now.toISOString().slice(0, 10))
    setPreparedTime(now.toTimeString().slice(0, 5))
    loadForm()
  }, [incidentId, user, searchParams, loadForm, offMode])

  const saveForm = async (formStatus: 'Draft' | 'Submitted') => {
    if (!incidentId || (!user && !offMode)) return
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
      name,
      ics_position: icsPosition,
      agency_office: agencyOffice,
      resources_assigned: resources,
      activity_log: activityLog,
      prepared_by_name: preparedByName,
      prepared_by_sig: preparedBySig,
      prepared_date: formStatus === 'Submitted' ? now.toISOString().slice(0, 10) : preparedDate,
      prepared_time: formStatus === 'Submitted' ? now.toTimeString().slice(0, 5) : preparedTime,
      status: formStatus,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (offMode) {
      try {
        if (fId) {
          await offUpdate('ics_214_forms', fId, formData)
        } else {
          const inserted = await offInsert('ics_214_forms', formData)
          fId = inserted.id as string
          setFormId(fId)
        }
        await touchOfflineIncident(incidentId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save the form.')
        setSaving(false)
        return
      }
      setSaving(false)
      setStatus(formStatus)
      setIsEditing(false)
      setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 214 submitted successfully!')
      return
    }

    if (fId) {
      const { error: updateError } = await supabase.from('ics_214_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_214_forms')
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
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 214 submitted successfully!')
  }

  const updateResource = (idx: number, field: keyof ResourceRow, value: string) => {
    setResources(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }
  const addResource = () => setResources(prev => [...prev, emptyResourceRow()])
  const removeResource = (idx: number) => setResources(prev => prev.filter((_, i) => i !== idx))

  const updateActivity = (idx: number, field: keyof ActivityRow, value: string) => {
    setActivityLog(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }
  const addActivity = () => setActivityLog(prev => [...prev, emptyActivityRow()])
  const removeActivity = (idx: number) => setActivityLog(prev => prev.filter((_, i) => i !== idx))

  if (loading) {
    return (
      <div className="ics214-page">
        <div className="ics214-loading">Loading ICS Form 214...</div>
      </div>
    )
  }

  const isForcedView = searchParams.get('view') === '1'
  const isReadonly = (status === 'Submitted' && !isEditing) || !canEdit || isForcedView

  return (
    <div className="ics214-page">
      <header className="ics214-header no-print">
        <div className="header-brand" onClick={() => navigate(homePath)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics214-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(`${homePath}/ics-214`)}>&larr; Back</button>
          <span className="form-badge">ICS 214</span>
          <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
        </div>
        <div className="topbar-actions">
          {(!canEdit || isForcedView) && <span className="view-only-badge">View only</span>}
          <button className="action-btn save" onClick={() => saveForm('Draft')} disabled={saving || isReadonly}>
            {saving ? 'Saving...' : 'Save Progress'}
          </button>
          <button className="action-btn submit" onClick={() => saveForm('Submitted')} disabled={saving || isReadonly}>
            {saving ? 'Submitting...' : 'Submit'}
          </button>
          {status === 'Submitted' && !isEditing && canEdit && !isForcedView && (
            <button className="action-btn edit" onClick={() => setIsEditing(true)}>Edit</button>
          )}
          <button className="action-btn print" onClick={() => setShowPrint(true)} disabled={saving}>Print</button>
        </div>
      </div>

      <main className="ics214-main no-print">
        <div className="ics214-container">
          {error && <div className="error-message">{error}</div>}
          {sig.enabled && sig.hint && <p className="sig-autofill-hint no-print">{sig.hint}</p>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>ACTIVITY LOG</h2>
            <h3>ICS 214</h3>
          </div>

          {/* Section 1-2: Incident Name + Operational Period */}
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

          {/* Section 3-5: Name, Position, Agency */}
          <div className="form-section">
            <div className="form-row three-col">
              <div className="form-field">
                <label>3. NAME</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="form-field">
                <label>4. ICS POSITION</label>
                <input type="text" value={icsPosition} onChange={e => setIcsPosition(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="form-field">
                <label>5. AGENCY/OFFICE</label>
                <input type="text" value={agencyOffice} onChange={e => setAgencyOffice(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
          </div>

          {/* Section 6: Resources Assigned */}
          <div className="form-section">
            <label>6. RESOURCES ASSIGNED</label>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ICS Position</th>
                  <th>Agency/Office</th>
                  {!isReadonly && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {resources.map((row, idx) => (
                  <tr key={idx}>
                    <td><input type="text" value={row.name} onChange={e => updateResource(idx, 'name', e.target.value)} disabled={isReadonly} /></td>
                    <td><input type="text" value={row.icsPosition} onChange={e => updateResource(idx, 'icsPosition', e.target.value)} disabled={isReadonly} /></td>
                    <td><input type="text" value={row.agencyOffice} onChange={e => updateResource(idx, 'agencyOffice', e.target.value)} disabled={isReadonly} /></td>
                    {!isReadonly && (
                      <td><button className="remove-row-btn" onClick={() => removeResource(idx)} disabled={isReadonly}>&times;</button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!isReadonly && (
              <button className="add-row-btn" onClick={addResource} disabled={isReadonly}>+ Add Resource</button>
            )}
          </div>

          {/* Section 7: Activity Log */}
          <div className="form-section">
            <label>7. ACTIVITY LOG</label>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Date</th>
                  <th style={{ width: 100 }}>Time</th>
                  <th>Notable Activities</th>
                  {!isReadonly && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {activityLog.map((row, idx) => (
                  <tr key={idx}>
                    <td><input type="date" value={row.date} onChange={e => updateActivity(idx, 'date', e.target.value)} disabled={isReadonly} /></td>
                    <td><input type="time" value={row.time} onChange={e => updateActivity(idx, 'time', e.target.value)} disabled={isReadonly} /></td>
                    <td><input type="text" value={row.notableActivities} onChange={e => updateActivity(idx, 'notableActivities', e.target.value)} disabled={isReadonly} /></td>
                    {!isReadonly && (
                      <td><button className="remove-row-btn" onClick={() => removeActivity(idx)} disabled={isReadonly}>&times;</button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!isReadonly && (
              <button className="add-row-btn" onClick={addActivity} disabled={isReadonly}>+ Add Activity</button>
            )}
          </div>

          {/* Section 8: Prepared by */}
          <div className="form-section signature-section">
            <div className="sig-row">
              <div className="sig-field num">8. PREPARED BY</div>
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
          </div>

        </div>
      </main>

      {showPrint && (
        <Ics214Print
          incidentName={incidentName}
          opFromDate={opFromDate}
          opFromTime={opFromTime}
          opToDate={opToDate}
          opToTime={opToTime}
          name={name}
          icsPosition={icsPosition}
          agencyOffice={agencyOffice}
          resources={resources}
          activityLog={activityLog}
          preparedByName={preparedByName}
          preparedBySig={preparedBySig}
          preparedDate={preparedDate}
          preparedTime={preparedTime}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
