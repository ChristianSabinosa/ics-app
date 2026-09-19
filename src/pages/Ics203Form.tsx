import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics203Print from './Ics203Print'
import './Ics203Form.css'

interface Position {
  position_key: string
  position_title: string
  abbreviation: string
  section: string
  person_name: string
  agency: string
  parent_key: string | null
}

export default function Ics203Form() {
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

  const [positions, setPositions] = useState<Position[]>([])

  const [preparedByName, setPreparedByName] = useState('')
  const [preparedBySig, setPreparedBySig] = useState('')
  const [preparedDate, setPreparedDate] = useState('')
  const [preparedTime, setPreparedTime] = useState('')

  const [status, setStatus] = useState<'Draft' | 'Submitted'>('Draft')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPrint, setShowPrint] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const [has207, setHas207] = useState(true)
  const [has202, setHas202] = useState(true)

  const loadForm = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)

    // Load incident name
    const { data: incident } = await supabase
      .from('incidents')
      .select('name')
      .eq('incident_id', incidentId)
      .single()
    if (incident) setIncidentName(incident.name)

    // Load operational period from 202
    const { data: form202 } = await supabase
      .from('ics_202_forms')
      .select('op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (form202) {
      setOpFromDate(form202.op_period_from_date)
      setOpFromTime(form202.op_period_from_time)
      setOpToDate(form202.op_period_to_date)
      setOpToTime(form202.op_period_to_time)
      setHas202(true)
    } else {
      setHas202(false)
    }

    // Load positions from 207 (prefer expanded, fall back to standard)
    let form207 = null
    const { data: expanded207 } = await supabase
      .from('ics_207_forms')
      .select('id')
      .eq('incident_id', incidentId)
      .eq('form_type', 'expanded')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (expanded207) {
      form207 = expanded207
    } else {
      const { data: standard207 } = await supabase
        .from('ics_207_forms')
        .select('id')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      form207 = standard207
    }

    if (form207) {
      setHas207(true)
      const { data: posData } = await supabase
        .from('ics_207_positions')
        .select('position_key, position_title, abbreviation, section, person_name, agency, parent_key')
        .eq('form_id', form207.id)
        .order('sort_order')

      if (posData) setPositions(posData)
    } else {
      setHas207(false)
    }

    // Load existing 203 form
    const formParam = searchParams.get('form')
    let formToLoad = null

    if (formParam) {
      const { data: form } = await supabase
        .from('ics_203_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    } else {
      const { data: existingForm } = await supabase
        .from('ics_203_forms')
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
      setPreparedByName(formToLoad.prepared_by_name)
      setPreparedBySig(formToLoad.prepared_by_sig)
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
      prepared_by_name: preparedByName,
      prepared_by_sig: preparedBySig,
      prepared_date: formStatus === 'Submitted' ? now.toISOString().slice(0, 10) : preparedDate,
      prepared_time: formStatus === 'Submitted' ? now.toTimeString().slice(0, 5) : preparedTime,
      status: formStatus,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_203_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_203_forms')
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
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 203 submitted successfully!')
  }

  const fmtTime = (t: string) => t ? t.replace(':', '') + 'H' : ''
  const fmtDT = (d: string, t: string) => {
    if (!d && !t) return ''
    return `${d} ${fmtTime(t)}`.trim()
  }

  const getPosition = (key: string) => positions.find(p => p.position_key === key)
  const getPositionsBySection = (section: string) => positions.filter(p => p.section === section)

  const ic = getPosition('ic')
  const pio = getPosition('pio')
  const sofr = getPosition('sofr')
  const lofr = getPosition('lofr')
  const osc = getPosition('osc')
  const psc = getPosition('psc')
  const lsc = getPosition('lsc')
  const fasc = getPosition('fasc')
  const agencyReps = getPositionsBySection('PSC Agency Rep')
  const pscSub = getPositionsBySection('PSC Sub')
  const pscTechSpec = getPositionsBySection('PSC Tech Specialist')
  const lscSub = getPositionsBySection('LSC Sub')
  const fascSub = getPositionsBySection('FASC Sub')
  const oscBranches = getPositionsBySection('OSC Branch')
  const oscDivisions = getPositionsBySection('OSC Division')
  const oscGroups = getPositionsBySection('OSC Group')

  const getSupport = (key: string) => positions.filter(p => p.section === `${key} Support`)

  const supportIC = getSupport('ic')
  const supportOSC = getSupport('osc')
  const supportPSC = getSupport('psc')
  const supportLSC = getSupport('lsc')
  const supportFASC = getSupport('fasc')

  if (loading) {
    return (
      <div className="ics203-page">
        <div className="ics203-loading">Loading ICS Form 203...</div>
      </div>
    )
  }

  const isReadonly = status === 'Submitted' && !isEditing

  return (
    <div className="ics203-page">
      <header className="ics203-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics203-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
          <span className="form-badge">ICS 203</span>
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

      <main className="ics203-main no-print">
        <div className="ics203-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>ORGANIZATION ASSIGNMENT LIST</h2>
            <h3>ICS 203</h3>
          </div>

          {!has207 && (
            <div className="warning-message">
              Please complete your organizational chart using ICS form 207 first.
            </div>
          )}

          {!has202 && (
            <div className="warning-message">
              Please indicate the operational period using ICS form 202.
            </div>
          )}

          <div className="form-section">
            <div className="form-row two-col">
              <div className="form-field">
                <label>1. INCIDENT/EVENT NAME</label>
                <input type="text" value={incidentName} readOnly className="readonly" />
              </div>
              <div className="form-field">
                <label>2. OPERATIONAL PERIOD</label>
                <div className="op-period-display">
                  <span>From: {fmtDT(opFromDate, opFromTime) || '\u00A0'}</span>
                </div>
                <div className="op-period-display">
                  <span>To: {fmtDT(opToDate, opToTime) || '\u00A0'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <label>3. INCIDENT COMMANDER AND COMMAND STAFF</label>
            <div className="staff-grid">
              <div className="staff-row">
                <span className="staff-role">Incident Commander</span>
                <span className="staff-name">{ic?.person_name || '\u00A0'}</span>
              </div>
              {supportIC.map(s => (
                <div key={s.position_key} className="staff-row">
                  <span className="staff-role">Deputy</span>
                  <span className="staff-name">{s.person_name || '\u00A0'}</span>
                </div>
              ))}
              <div className="staff-row">
                <span className="staff-role">Safety Officer</span>
                <span className="staff-name">{sofr?.person_name || '\u00A0'}</span>
              </div>
              <div className="staff-row">
                <span className="staff-role">Information Officer</span>
                <span className="staff-name">{pio?.person_name || '\u00A0'}</span>
              </div>
              <div className="staff-row">
                <span className="staff-role">Liaison Officer</span>
                <span className="staff-name">{lofr?.person_name || '\u00A0'}</span>
              </div>
            </div>
          </div>

          <div className="form-section">
            <label>4. AGENCY REPRESENTATIVES</label>
            {agencyReps.length > 0 ? (
              <div className="staff-grid">
                {agencyReps.map(ar => (
                  <div key={ar.position_key} className="staff-row">
                    <span className="staff-role">{ar.agency || 'Agency'}</span>
                    {isReadonly ? (
                      <span className="staff-name">{ar.person_name || '\u00A0'}</span>
                    ) : (
                      <input
                        type="text"
                        className="staff-input"
                        value={ar.person_name}
                        placeholder="Name"
                        onChange={(e) => {
                          setPositions(prev => prev.map(p =>
                            p.position_key === ar.position_key ? { ...p, person_name: e.target.value } : p
                          ))
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="staff-grid">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="staff-row">
                    <span className="staff-role">&nbsp;</span>
                    <span className="staff-name">&nbsp;</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-section">
            <label>5. PLANNING SECTION</label>
            <div className="staff-grid">
              <div className="staff-row">
                <span className="staff-role">Chief</span>
                <span className="staff-name">{psc?.person_name || '\u00A0'}</span>
              </div>
              {supportPSC.map(s => (
                <div key={s.position_key} className="staff-row">
                  <span className="staff-role">Deputy</span>
                  <span className="staff-name">{s.person_name || '\u00A0'}</span>
                </div>
              ))}
              {pscSub.map(p => (
                <div key={p.position_key} className="staff-row">
                  <span className="staff-role">{p.position_title}</span>
                  <span className="staff-name">{p.person_name || '\u00A0'}</span>
                </div>
              ))}
              {pscTechSpec.length > 0 && (
                <div className="staff-row">
                  <span className="staff-role">Technical Specialists</span>
                  <span className="staff-name">{pscTechSpec.map(t => t.person_name || t.position_title).join(', ') || '\u00A0'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <label>6. LOGISTICS SECTION</label>
            <div className="staff-grid">
              <div className="staff-row">
                <span className="staff-role">Chief</span>
                <span className="staff-name">{lsc?.person_name || '\u00A0'}</span>
              </div>
              {supportLSC.map(s => (
                <div key={s.position_key} className="staff-row">
                  <span className="staff-role">Deputy</span>
                  <span className="staff-name">{s.person_name || '\u00A0'}</span>
                </div>
              ))}
              <div className="staff-row branch-label">
                <span className="staff-role"><strong>SUPPORT BRANCH</strong></span>
              </div>
              {lscSub.filter(p => ['Supply Unit', 'Facilities Unit', 'Ground Support Unit'].some(k => p.position_title.includes(k))).map(p => (
                <div key={p.position_key} className="staff-row">
                  <span className="staff-role">{p.position_title}</span>
                  <span className="staff-name">{p.person_name || '\u00A0'}</span>
                </div>
              ))}
              <div className="staff-row branch-label">
                <span className="staff-role"><strong>SERVICE BRANCH</strong></span>
              </div>
              {lscSub.filter(p => ['Communications Unit', 'Medical Unit', 'Food Unit'].some(k => p.position_title.includes(k))).map(p => (
                <div key={p.position_key} className="staff-row">
                  <span className="staff-role">{p.position_title}</span>
                  <span className="staff-name">{p.person_name || '\u00A0'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label>7. OPERATIONS SECTION</label>
            <div className="staff-grid">
              <div className="staff-row">
                <span className="staff-role">Chief</span>
                <span className="staff-name">{osc?.person_name || '\u00A0'}</span>
              </div>
              {supportOSC.map(s => (
                <div key={s.position_key} className="staff-row">
                  <span className="staff-role">Deputy</span>
                  <span className="staff-name">{s.person_name || '\u00A0'}</span>
                </div>
              ))}
              {oscBranches.map(branch => (
                <div key={branch.position_key}>
                  <div className="staff-row branch-label">
                    <span className="staff-role"><strong>{branch.position_title}</strong></span>
                  </div>
                  <div className="staff-row">
                    <span className="staff-role">Branch Director</span>
                    <span className="staff-name">{branch.person_name || '\u00A0'}</span>
                  </div>
                  {positions.filter(p => p.parent_key === branch.position_key).map(div => (
                    <div key={div.position_key} className="staff-row">
                      <span className="staff-role">Division/Group</span>
                      <span className="staff-name">{div.person_name || div.position_title || '\u00A0'}</span>
                    </div>
                  ))}
                </div>
              ))}
              {oscDivisions.filter(d => !oscBranches.some(b => d.parent_key === b.position_key)).map(div => (
                <div key={div.position_key} className="staff-row">
                  <span className="staff-role">Division/Group</span>
                  <span className="staff-name">{div.person_name || div.position_title || '\u00A0'}</span>
                </div>
              ))}
              {oscGroups.filter(g => !oscBranches.some(b => g.parent_key === b.position_key)).map(grp => (
                <div key={grp.position_key} className="staff-row">
                  <span className="staff-role">Division/Group</span>
                  <span className="staff-name">{grp.person_name || grp.position_title || '\u00A0'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label>8. FINANCE/ADMINISTRATIVE SECTION</label>
            <div className="staff-grid">
              <div className="staff-row">
                <span className="staff-role">Chief</span>
                <span className="staff-name">{fasc?.person_name || '\u00A0'}</span>
              </div>
              {supportFASC.map(s => (
                <div key={s.position_key} className="staff-row">
                  <span className="staff-role">Deputy</span>
                  <span className="staff-name">{s.person_name || '\u00A0'}</span>
                </div>
              ))}
              {fascSub.map(p => (
                <div key={p.position_key} className="staff-row">
                  <span className="staff-role">{p.position_title}</span>
                  <span className="staff-name">{p.person_name || '\u00A0'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-section signature-section">
            <div className="sig-row">
              <div className="sig-field num">9. Prepared by RESL</div>
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
        <Ics203Print
          incidentName={incidentName}
          opFromDate={opFromDate}
          opFromTime={opFromTime}
          opToDate={opToDate}
          opToTime={opToTime}
          positions={positions}
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
