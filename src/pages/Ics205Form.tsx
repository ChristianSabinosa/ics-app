import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Ics205Channel } from '../lib/types'
import Ics205Print from './Ics205Print'
import './Ics205Form.css'

const emptyChannel: Omit<Ics205Channel, 'id' | 'form_id'> = {
  radio_type: '', system: '', channel: '', function: '',
  tone_offset: '', frequency: '', others: '', assignment: '', remarks: '', sort_order: 0,
}

export default function Ics205Form() {
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
  const [channels, setChannels] = useState<Omit<Ics205Channel, 'id' | 'form_id'>[]>([])
  const [coordinatingInstructions, setCoordinatingInstructions] = useState('')
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
  const isReadonly = status === 'Submitted' && !isEditing

  useEffect(() => {
    if (!user) return
    const now = new Date()
    setPreparedBy(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    setDatePrepared(now.toISOString().slice(0, 10))
    setTimePrepared(now.toTimeString().slice(0, 5))
    loadForm()
  }, [incidentId, user, searchParams])

  const loadForm = async () => {
    if (!incidentId) return
    setLoading(true)

    const { data: incident } = await supabase
      .from('incidents').select('name').eq('incident_id', incidentId).single()
    if (incident) setIncidentName(incident.name)

    const { data: form202 } = await supabase
      .from('ics_202_forms')
      .select('op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false }).limit(1).single()
    if (form202) {
      setOpFromDate(form202.op_period_from_date || '')
      setOpFromTime(form202.op_period_from_time || '')
      setOpToDate(form202.op_period_to_date || '')
      setOpToTime(form202.op_period_to_time || '')
    }

    const formParam = searchParams.get('form')
    let formToLoad = null

    if (formParam) {
      const { data } = await supabase.from('ics_205_forms').select('*').eq('id', formParam).single()
      formToLoad = data
    } else {
      const { data } = await supabase
        .from('ics_205_forms').select('*').eq('incident_id', incidentId)
        .order('created_at', { ascending: false }).limit(1).single()
      formToLoad = data
    }

    if (formToLoad) {
      setFormId(formToLoad.id)
      setIncidentName(formToLoad.incident_name)
      setOpFromDate(formToLoad.op_period_from_date)
      setOpFromTime(formToLoad.op_period_from_time)
      setOpToDate(formToLoad.op_period_to_date)
      setOpToTime(formToLoad.op_period_to_time)
      setCoordinatingInstructions(formToLoad.coordinating_instructions)
      setPreparedBy(formToLoad.prepared_by)
      setDatePrepared(formToLoad.date_prepared)
      setTimePrepared(formToLoad.time_prepared)
      setStatus(formToLoad.status)

      const { data: chData } = await supabase
        .from('ics_205_channels').select('*').eq('form_id', formToLoad.id).order('sort_order')
      if (chData) {
        setChannels(chData.map(({ id: _id, form_id: _fid, ...rest }) => rest))
      }
    } else {
      setChannels([{ ...emptyChannel, sort_order: 0 }])
    }

    setLoading(false)
  }

  const updateChannel = (index: number, field: string, value: string) => {
    const updated = [...channels]
    updated[index] = { ...updated[index], [field]: value }
    setChannels(updated)
  }

  const addChannel = () => {
    setChannels([...channels, { ...emptyChannel, sort_order: channels.length }])
  }

  const removeChannel = (index: number) => {
    setChannels(channels.filter((_, i) => i !== index))
  }

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
      coordinating_instructions: coordinatingInstructions,
      status: formStatus,
      prepared_by: preparedBy,
      date_prepared: formStatus === 'Submitted' ? localDate : datePrepared,
      time_prepared: formStatus === 'Submitted' ? localTime : timePrepared,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_205_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else if (!fId) {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_205_forms').insert(formData).select().single()
      if (insertError) { setError(insertError.message); setSaving(false); return }
      fId = inserted.id
      setFormId(fId)
    }

    if (fId) {
      await supabase.from('ics_205_channels').delete().eq('form_id', fId)

      if (channels.length > 0) {
        const channelRows = channels.map((c, i) => ({
          form_id: fId!,
          ...c,
          sort_order: i,
        }))
        const { error: chError } = await supabase.from('ics_205_channels').insert(channelRows)
        if (chError) { setError(chError.message); setSaving(false); return }
      }
    }

    setSaving(false)
    setStatus(formStatus)
    setIsEditing(false)
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 205 submitted successfully!')
  }

  if (loading) {
    return (
      <div className="ics205-page">
        <div className="ics205-loading">Loading ICS Form 205...</div>
      </div>
    )
  }

  return (
    <div className="ics205-page">
      <header className="ics205-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics205-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="form-badge">ICS 205</span>
          <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
        </div>
      </div>

      <main className="ics205-main no-print">
        <div className="ics205-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>COMMUNICATIONS PLAN</h2>
            <h3>ICS 205</h3>
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
            <h4>3. BASIC RADIO CHANNEL UTILIZATION</h4>
            <div className="channels-table-wrapper">
              <table className="channels-table">
                <thead>
                  <tr>
                    <th>Radio Type</th>
                    <th>System</th>
                    <th>Channel</th>
                    <th>Function</th>
                    <th>Tone/Offset</th>
                    <th>Frequency</th>
                    <th>Others (mobile phone, satellite phone, etc.)</th>
                    <th>Assignment</th>
                    <th>Remarks</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((c, i) => (
                    <tr key={i}>
                      <td>
                        <select value={c.radio_type} onChange={(e) => updateChannel(i, 'radio_type', e.target.value)}>
                          <option value="">-</option>
                          <option value="VHF">VHF</option>
                          <option value="UHF">UHF</option>
                          <option value="PoC">PoC</option>
                          <option value="Others">Others</option>
                        </select>
                      </td>
                      <td><input value={c.system} onChange={(e) => updateChannel(i, 'system', e.target.value)} /></td>
                      <td><input value={c.channel} onChange={(e) => updateChannel(i, 'channel', e.target.value)} /></td>
                      <td>
                        <select value={c.function} onChange={(e) => updateChannel(i, 'function', e.target.value)}>
                          <option value="">-</option>
                          <option value="IMT">IMT</option>
                          <option value="Tactical">Tactical</option>
                          <option value="Support">Support</option>
                          <option value="Others">Others</option>
                        </select>
                      </td>
                      <td><input value={c.tone_offset} onChange={(e) => updateChannel(i, 'tone_offset', e.target.value)} /></td>
                      <td><input value={c.frequency} onChange={(e) => updateChannel(i, 'frequency', e.target.value)} /></td>
                      <td><input value={c.others} onChange={(e) => updateChannel(i, 'others', e.target.value)} /></td>
                      <td><input value={c.assignment} onChange={(e) => updateChannel(i, 'assignment', e.target.value)} /></td>
                      <td><input value={c.remarks} onChange={(e) => updateChannel(i, 'remarks', e.target.value)} /></td>
                      <td className="actions-cell">
                        <button className="remove-row-btn" onClick={() => removeChannel(i)}>&times;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="add-row-buttons">
              <button className="add-row-btn" onClick={addChannel}>+ Add Channel</button>
            </div>
          </div>

          <div className="form-section">
            <h4>4. COORDINATING INSTRUCTIONS</h4>
            <textarea
              className="coordinating-textarea"
              rows={6}
              value={coordinatingInstructions}
              onChange={(e) => setCoordinatingInstructions(e.target.value)}
              placeholder="Enter coordinating instructions..."
            />
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

          <div className="form-actions">
            <button className="action-btn back" onClick={() => navigate(`/incident/${incidentId}`)} disabled={saving}>Back</button>
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
      </main>

      {showPrint && (
        <Ics205Print
          incidentName={incidentName}
          opFromDate={opFromDate}
          opFromTime={opFromTime}
          opToDate={opToDate}
          opToTime={opToTime}
          channels={channels}
          coordinatingInstructions={coordinatingInstructions}
          preparedBy={preparedBy}
          datePrepared={datePrepared}
          timePrepared={timePrepared}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
