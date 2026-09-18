import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics213Print from './Ics213Print'
import './Ics213Form.css'

interface PersonnelSuggestion {
  name: string
  role: string
  agency: string
}

export default function Ics213Form() {
  const { id: incidentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [formId, setFormId] = useState<string | null>(null)
  const [incidentName, setIncidentName] = useState('')

  const [msgDate, setMsgDate] = useState('')
  const [msgTime, setMsgTime] = useState('')

  const [toName, setToName] = useState('')
  const [toPosition, setToPosition] = useState('')
  const [toSuggestions, setToSuggestions] = useState<PersonnelSuggestion[]>([])
  const [showToSuggestions, setShowToSuggestions] = useState(false)
  const toRef = useRef<HTMLDivElement>(null)

  const [fromName, setFromName] = useState('')
  const [fromPosition, setFromPosition] = useState('')

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const [approvedByName, setApprovedByName] = useState('')
  const [approvedByPosition, setApprovedByPosition] = useState('')
  const [approvedBySig, setApprovedBySig] = useState('')
  const [approvedDate, setApprovedDate] = useState('')
  const [approvedTime, setApprovedTime] = useState('')

  const [reply, setReply] = useState('')

  const [receivedByName, setReceivedByName] = useState('')
  const [receivedByPosition, setReceivedByPosition] = useState('')
  const [receivedBySig, setReceivedBySig] = useState('')

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
    const firstName = user.user_metadata?.first_name || ''
    const lastName = user.user_metadata?.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()
    setFromName(fullName || user.email || '')
    setMsgDate(now.toISOString().slice(0, 10))
    setMsgTime(now.toTimeString().slice(0, 5))
    loadForm()
  }, [incidentId, user, searchParams])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toRef.current && !toRef.current.contains(e.target as Node)) {
        setShowToSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadForm = async () => {
    if (!incidentId) return
    setLoading(true)

    const { data: incident } = await supabase
      .from('incidents')
      .select('name')
      .eq('incident_id', incidentId)
      .single()
    if (incident) setIncidentName(incident.name)

    const { data: manifestsData } = await supabase
      .from('checkin_manifests')
      .select('id')
      .eq('incident_id', incidentId)

    if (manifestsData && manifestsData.length > 0) {
      const manifestIds = manifestsData.map(m => m.id)
      const { data: personnelData } = await supabase
        .from('checkin_personnel')
        .select('name, role, capabilities')
        .in('manifest_id', manifestIds)

      if (personnelData) {
        const suggestions: PersonnelSuggestion[] = personnelData.map(p => ({
          name: p.name,
          role: p.role,
          agency: p.capabilities || '',
        }))
        setToSuggestions(suggestions)
      }
    }

    const formParam = searchParams.get('form')
    let formToLoad = null

    if (formParam) {
      const { data: form } = await supabase
        .from('ics_213_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    } else {
      const { data: existingForm } = await supabase
        .from('ics_213_forms')
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
      setMsgDate(formToLoad.msg_date)
      setMsgTime(formToLoad.msg_time)
      setToName(formToLoad.to_name)
      setToPosition(formToLoad.to_position)
      setFromName(formToLoad.from_name)
      setFromPosition(formToLoad.from_position)
      setSubject(formToLoad.subject)
      setMessage(formToLoad.message)
      setApprovedByName(formToLoad.approved_by_name)
      setApprovedByPosition(formToLoad.approved_by_position)
      setApprovedBySig(formToLoad.approved_by_sig)
      setApprovedDate(formToLoad.approved_date)
      setApprovedTime(formToLoad.approved_time)
      setReply(formToLoad.reply)
      setReceivedByName(formToLoad.received_by_name)
      setReceivedByPosition(formToLoad.received_by_position)
      setReceivedBySig(formToLoad.received_by_sig)
      setStatus(formToLoad.status)
    }

    setLoading(false)
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
      msg_date: msgDate,
      msg_time: msgTime,
      to_name: toName,
      to_position: toPosition,
      from_name: fromName,
      from_position: fromPosition,
      subject,
      message,
      approved_by_name: approvedByName,
      approved_by_position: approvedByPosition,
      approved_by_sig: approvedBySig,
      approved_date: approvedDate,
      approved_time: approvedTime,
      reply,
      received_by_name: receivedByName,
      received_by_position: receivedByPosition,
      received_by_sig: receivedBySig,
      status: formStatus,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_213_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_213_forms')
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
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 213 submitted successfully!')
  }

  const selectToSuggestion = (suggestion: PersonnelSuggestion) => {
    setToName(suggestion.name)
    setToPosition(suggestion.role)
    setShowToSuggestions(false)
  }

  if (loading) {
    return (
      <div className="ics213-page">
        <div className="ics213-loading">Loading ICS Form 213...</div>
      </div>
    )
  }

  const isReadonly = status === 'Submitted' && !isEditing

  return (
    <div className="ics213-page">
      <header className="ics213-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics213-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="form-badge">ICS 213</span>
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

      <main className="ics213-main no-print">
        <div className="ics213-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>GENERAL MESSAGE</h2>
            <h3>ICS 213</h3>
          </div>

          {/* Section 1: Incident Name + Date/Time */}
          <div className="form-section">
            <div className="form-row two-col">
              <div className="form-field">
                <label>1. INCIDENT/EVENT NAME</label>
                <input type="text" value={incidentName} readOnly className="readonly" />
              </div>
              <div className="form-field">
                <label>2. DATE / TIME</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="date" value={msgDate} onChange={e => setMsgDate(e.target.value)} disabled={isReadonly} style={{ flex: 1 }} />
                  <input type="time" value={msgTime} onChange={e => setMsgTime(e.target.value)} disabled={isReadonly} style={{ flex: 1 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: To */}
          <div className="form-section">
            <div className="form-field" ref={toRef} style={{ position: 'relative' }}>
              <label>3. TO [NAME &amp; POSITION]</label>
              <input
                type="text"
                value={toName}
                onChange={e => {
                  setToName(e.target.value)
                  if (e.target.value.length > 0) setShowToSuggestions(true)
                  else setShowToSuggestions(false)
                }}
                onFocus={() => { if (toName.length > 0 && toSuggestions.length > 0) setShowToSuggestions(true) }}
                disabled={isReadonly}
                placeholder="Start typing to search checked-in personnel..."
              />
              {showToSuggestions && toSuggestions.length > 0 && (
                <div className="suggestions-list">
                  {toSuggestions
                    .filter(s => s.name.toLowerCase().includes(toName.toLowerCase()))
                    .slice(0, 10)
                    .map((s, idx) => (
                      <div key={idx} className="suggestion-item" onClick={() => selectToSuggestion(s)}>
                        <div className="suggestion-name">{s.name}</div>
                        <div className="suggestion-detail">{s.role}{s.agency ? ` - ${s.agency}` : ''}</div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
            <div className="form-field" style={{ marginTop: 8 }}>
              <label>Position / Title</label>
              <input type="text" value={toPosition} onChange={e => setToPosition(e.target.value)} disabled={isReadonly} />
            </div>
          </div>

          {/* Section 4: From */}
          <div className="form-section">
            <div className="form-row two-col">
              <div className="form-field">
                <label>4. FROM [NAME]</label>
                <input type="text" value={fromName} onChange={e => setFromName(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="form-field">
                <label>POSITION / TITLE</label>
                <input type="text" value={fromPosition} onChange={e => setFromPosition(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
          </div>

          {/* Section 5: Subject */}
          <div className="form-section">
            <div className="form-field">
              <label>5. SUBJECT</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} disabled={isReadonly} />
            </div>
          </div>

          {/* Section 6: Message */}
          <div className="form-section">
            <div className="form-field">
              <label>6. MESSAGE</label>
              <textarea
                className="large"
                value={message}
                onChange={e => setMessage(e.target.value)}
                disabled={isReadonly}
                placeholder="e.g. Request for additional personnel, resources, supplies, vehicles..."
              />
            </div>
          </div>

          {/* Section 7: Approved by */}
          <div className="form-section signature-section">
            <label>7. APPROVED BY</label>
            <div className="sig-row">
              <div className="sig-field num">Name</div>
              <div className="sig-field">
                <input type="text" value={approvedByName} onChange={e => setApprovedByName(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Position / Title:</label>
                <input type="text" value={approvedByPosition} onChange={e => setApprovedByPosition(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Signature:</label>
                <input type="text" value={approvedBySig} onChange={e => setApprovedBySig(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
            <div className="form-row two-col" style={{ marginTop: 8 }}>
              <div className="form-field">
                <label>Date</label>
                <input type="date" value={approvedDate} onChange={e => setApprovedDate(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="form-field">
                <label>Time</label>
                <input type="time" value={approvedTime} onChange={e => setApprovedTime(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
          </div>

          {/* Section 8: Reply */}
          <div className="form-section">
            <div className="form-field">
              <label>8. REPLY</label>
              <textarea
                className="large"
                value={reply}
                onChange={e => setReply(e.target.value)}
                disabled={isReadonly}
                placeholder="Enter reply message here..."
              />
            </div>
          </div>

          {/* Section 9: Received by */}
          <div className="form-section signature-section">
            <label>9. RECEIVED BY</label>
            <div className="sig-row">
              <div className="sig-field num">Name</div>
              <div className="sig-field">
                <input type="text" value={receivedByName} onChange={e => setReceivedByName(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Position / Title:</label>
                <input type="text" value={receivedByPosition} onChange={e => setReceivedByPosition(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Signature:</label>
                <input type="text" value={receivedBySig} onChange={e => setReceivedBySig(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
          </div>

        </div>
      </main>

      {showPrint && (
        <Ics213Print
          incidentName={incidentName}
          msgDate={msgDate}
          msgTime={msgTime}
          toName={toName}
          toPosition={toPosition}
          fromName={fromName}
          fromPosition={fromPosition}
          subject={subject}
          message={message}
          approvedByName={approvedByName}
          approvedByPosition={approvedByPosition}
          approvedBySig={approvedBySig}
          approvedDate={approvedDate}
          approvedTime={approvedTime}
          reply={reply}
          receivedByName={receivedByName}
          receivedByPosition={receivedByPosition}
          receivedBySig={receivedBySig}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
