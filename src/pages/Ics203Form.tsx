import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics203Print from './Ics203Print'
import { useFormAccess } from '../components/FormAccess'
import { useTrainingSignature } from '../lib/signatureRules'
import { isOfflinePath, getOperatorName } from '../lib/offline/mode'
import {
  getOfflineIncident,
  offAll,
  offChildren,
  offLatest,
  offGet,
  offInsert,
  offUpdate,
  touchOfflineIncident,
} from '../lib/offline/store'
import {
  emptyOps,
  coerceOpsData,
  buildOpsFromPositions,
  emptyBranch,
  type OpsData,
  type OpsDivision,
} from '../lib/ops203'
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

// 207 Standard and Expanded are separate form records. Merge both so 203
// reflects the org no matter which tab it was built on. Positions are keyed
// by position_key (the two tabs use different key spaces for user-added
// subs); on key conflicts the record with an assigned name wins, else
// Expanded wins.
const merge207Positions = (primary: Position[], secondary: Position[]): Position[] => {
  const merged = new Map(primary.map(p => [p.position_key, p]))
  for (const p of secondary) {
    const cur = merged.get(p.position_key)
    if (!cur) merged.set(p.position_key, p)
    else if (!cur.person_name && p.person_name) merged.set(p.position_key, p)
  }
  return [...merged.values()]
}

const toPosition = (p: Record<string, unknown>): Position => ({
  position_key: p.position_key as string,
  position_title: p.position_title as string,
  abbreviation: p.abbreviation as string,
  section: p.section as string,
  person_name: (p.person_name as string) ?? '',
  agency: (p.agency as string) ?? '',
  parent_key: (p.parent_key as string | null) ?? null,
})

export default function Ics203Form() {
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

  const [positions, setPositions] = useState<Position[]>([])

  const [preparedByName, setPreparedByName] = useState('')
  const [preparedBySig, setPreparedBySig] = useState('')

  // Training Mode: prepared by RESL or PSC (ICS 207)
  const sig = useTrainingSignature('203')
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

  const [has207, setHas207] = useState(true)
  const [has202, setHas202] = useState(true)

  const loadForm = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)

    if (offMode) {
      const incident = await getOfflineIncident(incidentId)
      if (incident) setIncidentName(incident.name)

      const form202 = await offLatest('ics_202_forms', incidentId)
      if (form202) {
        setOpFromDate(form202.op_period_from_date as string)
        setOpFromTime(form202.op_period_from_time as string)
        setOpToDate(form202.op_period_to_date as string)
        setOpToTime(form202.op_period_to_time as string)
        setHas202(true)
      } else {
        setHas202(false)
      }

      // Load positions from BOTH 207 variants (latest Expanded + latest
      // Standard) and merge them, so 203 reflects the org no matter which
      // tab it was built on.
      const forms207 = (await offAll('ics_207_forms', incidentId))
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
      const expanded207 = forms207.find(f => ((f.form_type as string) || 'standard') === 'expanded')
      const standard207 = forms207.find(f => ((f.form_type as string) || 'standard') === 'standard')
      const loadOffPos = async (form: typeof expanded207): Promise<Position[]> => {
        if (!form) return []
        return (await offChildren('ics_207_positions', form.id as string)).map(toPosition)
      }
      if (expanded207 || standard207) {
        setHas207(true)
        setPositions(merge207Positions(await loadOffPos(expanded207), await loadOffPos(standard207)))
      } else {
        setHas207(false)
      }

      const formParam = searchParams.get('form')
      const formToLoad = formParam
        ? await offGet('ics_203_forms', formParam)
        : await offLatest('ics_203_forms', incidentId)

      if (formToLoad) {
        setFormId(formToLoad.id as string)
        setIncidentName(formToLoad.incident_name as string)
        setPreparedByName(formToLoad.prepared_by_name as string)
        setPreparedBySig(formToLoad.prepared_by_sig as string)
        setPreparedDate(formToLoad.prepared_date as string)
        setPreparedTime(formToLoad.prepared_time as string)
        setStatus(formToLoad.status as 'Draft' | 'Submitted')
        const coerced = coerceOpsData(formToLoad.ops_data)
        if (coerced) setOps(coerced)
      }

      setLoading(false)
      return
    }

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

    // Load positions from BOTH 207 variants (latest Expanded + latest
    // Standard, standard included even when form_type is null from old rows)
    // and merge them, so 203 reflects the org no matter which tab it was
    // built on.
    const loadPos = async (formId: string): Promise<Position[]> => {
      const { data: posData } = await supabase
        .from('ics_207_positions')
        .select('position_key, position_title, abbreviation, section, person_name, agency, parent_key')
        .eq('form_id', formId)
        .order('sort_order')
      return (posData ?? []).map(p => ({ ...p, parent_key: p.parent_key ?? null }))
    }
    const { data: expanded207 } = await supabase
      .from('ics_207_forms')
      .select('id')
      .eq('incident_id', incidentId)
      .eq('form_type', 'expanded')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    const { data: standard207 } = await supabase
      .from('ics_207_forms')
      .select('id')
      .eq('incident_id', incidentId)
      .or('form_type.eq.standard,form_type.is.null')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (expanded207 || standard207) {
      setHas207(true)
      setPositions(merge207Positions(
        expanded207 ? await loadPos(expanded207.id) : [],
        standard207 ? await loadPos(standard207.id) : [],
      ))
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
      const coercedOnline = coerceOpsData(formToLoad.ops_data)
      if (coercedOnline) setOps(coercedOnline)
    }

    setLoading(false)
  }, [incidentId, searchParams, offMode])

  useEffect(() => {
    if (!user && !offMode) return
    const now = new Date()
    setPreparedByName((user?.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user?.email || '') || (offMode ? getOperatorName() : ''))
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
    // ops_data holds the manual Operations Section snapshot. If the column
    // does not exist yet in Supabase (migration not run), the save falls back
    // to storing the rest of the form and warns instead of failing.
    const formData: Record<string, unknown> = {
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
      ops_data: ops,
    }
    const withoutOps = () => {
      const rest = { ...formData }
      delete rest.ops_data
      return rest
    }
    const missingOpsColumn = (message: string) => /ops_data/i.test(message)

    let fId = formId
    let opsWarning = ''

    if (offMode) {
      try {
        if (fId) {
          await offUpdate('ics_203_forms', fId, formData)
        } else {
          const inserted = await offInsert('ics_203_forms', formData)
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
      setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 203 submitted successfully!')
      return
    }

    if (fId) {
      const { error: updateError } = await supabase.from('ics_203_forms').update(formData).eq('id', fId)
      if (updateError) {
        if (missingOpsColumn(updateError.message)) {
          const { error: retryError } = await supabase.from('ics_203_forms').update(withoutOps()).eq('id', fId)
          if (retryError) { setError(retryError.message); setSaving(false); return }
          opsWarning = 'Saved, but the Operations structure was not stored — the database is missing the ops_data column.'
        } else {
          setError(updateError.message); setSaving(false); return
        }
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_203_forms')
        .insert(formData)
        .select()
        .single()
      if (insertError) {
        if (missingOpsColumn(insertError.message)) {
          const { data: retryInserted, error: retryError } = await supabase
            .from('ics_203_forms')
            .insert(withoutOps())
            .select()
            .single()
          if (retryError) { setError(retryError.message); setSaving(false); return }
          fId = retryInserted.id
          setFormId(fId)
          opsWarning = 'Saved, but the Operations structure was not stored — the database is missing the ops_data column.'
        } else {
          setError(insertError.message); setSaving(false); return
        }
      } else {
        fId = inserted.id
        setFormId(fId)
      }
    }

    setSaving(false)
    setStatus(formStatus)
    setIsEditing(false)
    setSuccess((formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 203 submitted successfully!') + (opsWarning ? ` ${opsWarning}` : ''))
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

  // Manual Operations Section (box 7): the preparer owns this structure.
  // "Import from 207" snapshots the 207 org chart once; after that it is a
  // free snapshot saved with the form (ops_data).
  const [ops, setOps] = useState<OpsData>(() => emptyOps())
  const [opsImported, setOpsImported] = useState(false)

  const importFrom207 = useCallback(() => {
    setOps(buildOpsFromPositions(positions))
    setOpsImported(true)
  }, [positions])

  const addOpsBranch = () =>
    setOps(prev => ({ ...prev, branches: [...prev.branches, emptyBranch(prev.branches.length)] }))

  const removeOpsBranch = (bi: number) =>
    setOps(prev => ({ ...prev, branches: prev.branches.filter((_, i) => i !== bi) }))

  const setOpsBranchField = (bi: number, field: 'label' | 'director' | 'deputy', value: string) =>
    setOps(prev => ({
      ...prev,
      branches: prev.branches.map((b, i) => (i === bi ? { ...b, [field]: value } : b)),
    }))

  const addOpsDivision = (bi: number) =>
    setOps(prev => ({
      ...prev,
      branches: prev.branches.map((b, i) =>
        i === bi ? { ...b, divisions: [...b.divisions, { name: '', personnel: '' }] } : b,
      ),
    }))

  const removeOpsDivision = (bi: number, di: number) =>
    setOps(prev => ({
      ...prev,
      branches: prev.branches.map((b, i) =>
        i === bi ? { ...b, divisions: b.divisions.filter((_, j) => j !== di) } : b,
      ),
    }))

  const setOpsDivision = (bi: number, di: number, field: keyof OpsDivision, value: string) =>
    setOps(prev => ({
      ...prev,
      branches: prev.branches.map((b, i) =>
        i === bi ? { ...b, divisions: b.divisions.map((d, j) => (j === di ? { ...d, [field]: value } : d)) } : b,
      ),
    }))

  const addOpsStandalone = () => setOps(prev => ({ ...prev, standalone: [...prev.standalone, { name: '', personnel: '' }] }))

  const removeOpsStandalone = (si: number) =>
    setOps(prev => ({ ...prev, standalone: prev.standalone.filter((_, i) => i !== si) }))

  const setOpsStandalone = (si: number, field: keyof OpsDivision, value: string) =>
    setOps(prev => ({ ...prev, standalone: prev.standalone.map((s, i) => (i === si ? { ...s, [field]: value } : s)) }))

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

  const isReadonly = (status === 'Submitted' && !isEditing) || !canEdit

  return (
    <div className="ics203-page">
      <header className="ics203-header no-print">
        <div className="header-brand" onClick={() => navigate(homePath)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics203-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(homePath)}>&larr; Back</button>
          <span className="form-badge">ICS 203</span>
          <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
        </div>
        <div className="topbar-actions">
          {!canEdit && <span className="view-only-badge">View only</span>}
          <button className="action-btn save" onClick={() => saveForm('Draft')} disabled={saving || isReadonly}>
            {saving ? 'Saving...' : 'Save Progress'}
          </button>
          <button className="action-btn submit" onClick={() => saveForm('Submitted')} disabled={saving || isReadonly}>
            {saving ? 'Submitting...' : 'Submit'}
          </button>
          {status === 'Submitted' && !isEditing && canEdit && (
            <button className="action-btn edit" onClick={() => setIsEditing(true)}>Edit</button>
          )}
          <button className="action-btn print" onClick={() => setShowPrint(true)} disabled={saving}>Print</button>
        </div>
      </div>

      <main className="ics203-main no-print">
        <div className="ics203-container">
          {error && <div className="error-message">{error}</div>}
          {sig.enabled && sig.hint && <p className="sig-autofill-hint no-print">{sig.hint}</p>}
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
            {!isReadonly && (
              <div className="ops-toolbar no-print">
                <button
                  type="button"
                  className="action-btn"
                  onClick={importFrom207}
                  disabled={positions.length === 0}
                  title="Fill the structure below once from the 207 org chart; you can edit it freely after"
                >
                  Import from 207
                </button>
                <button type="button" className="action-btn" onClick={addOpsBranch}>
                  + Add Branch
                </button>
                <button type="button" className="action-btn" onClick={addOpsStandalone}>
                  + Add Division/Group
                </button>
              </div>
            )}
            {opsImported && !isReadonly && (
              <p className="sig-autofill-hint no-print">
                Filled from 207 — adjust the structure and names below as needed.
              </p>
            )}
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
              {ops.branches.map((branch, bi) => (
                <div key={bi}>
                  <div className="staff-row branch-label">
                    {isReadonly ? (
                      <span className="staff-role"><strong>{branch.label || '\u00A0'}</strong></span>
                    ) : (
                      <>
                        <input
                          type="text"
                          className="staff-input branch-label-input"
                          value={branch.label}
                          placeholder="BRANCH I"
                          onChange={e => setOpsBranchField(bi, 'label', e.target.value)}
                        />
                        <button type="button" className="ops-remove" onClick={() => removeOpsBranch(bi)} title="Remove branch">
                          &times;
                        </button>
                      </>
                    )}
                  </div>
                  <div className="staff-row">
                    <span className="staff-role">Branch Director</span>
                    {isReadonly ? (
                      <span className="staff-name">{branch.director || '\u00A0'}</span>
                    ) : (
                      <input
                        type="text"
                        className="staff-input"
                        value={branch.director}
                        placeholder="Name"
                        onChange={e => setOpsBranchField(bi, 'director', e.target.value)}
                      />
                    )}
                  </div>
                  <div className="staff-row">
                    <span className="staff-role">Deputy</span>
                    {isReadonly ? (
                      <span className="staff-name">{branch.deputy || '\u00A0'}</span>
                    ) : (
                      <input
                        type="text"
                        className="staff-input"
                        value={branch.deputy}
                        placeholder="Name"
                        onChange={e => setOpsBranchField(bi, 'deputy', e.target.value)}
                      />
                    )}
                  </div>
                  {branch.divisions.map((div, di) => (
                    <div key={di} className="staff-row ops-div-row">
                      <span className="staff-role">Division/Group</span>
                      {isReadonly ? (
                        <span className="staff-name">{div.name || '\u00A0'}</span>
                      ) : (
                        <input
                          type="text"
                          className="staff-input"
                          value={div.name}
                          placeholder="Division/Group name"
                          onChange={e => setOpsDivision(bi, di, 'name', e.target.value)}
                        />
                      )}
                      {isReadonly ? (
                        <span className="staff-name">{div.personnel || '\u00A0'}</span>
                      ) : (
                        <>
                          <input
                            type="text"
                            className="staff-input"
                            value={div.personnel}
                            placeholder="Personnel"
                            onChange={e => setOpsDivision(bi, di, 'personnel', e.target.value)}
                          />
                          <button type="button" className="ops-remove" onClick={() => removeOpsDivision(bi, di)} title="Remove row">
                            &times;
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {!isReadonly && (
                    <button type="button" className="ops-add-row no-print" onClick={() => addOpsDivision(bi)}>
                      + Division/Group row
                    </button>
                  )}
                </div>
              ))}
              {ops.standalone.map((div, si) => (
                <div key={`s-${si}`} className="staff-row ops-div-row">
                  <span className="staff-role">Division/Group</span>
                  {isReadonly ? (
                    <span className="staff-name">{div.name || '\u00A0'}</span>
                  ) : (
                    <input
                      type="text"
                      className="staff-input"
                      value={div.name}
                      placeholder="Division/Group name"
                      onChange={e => setOpsStandalone(si, 'name', e.target.value)}
                    />
                  )}
                  {isReadonly ? (
                    <span className="staff-name">{div.personnel || '\u00A0'}</span>
                  ) : (
                    <>
                      <input
                        type="text"
                        className="staff-input"
                        value={div.personnel}
                        placeholder="Personnel"
                        onChange={e => setOpsStandalone(si, 'personnel', e.target.value)}
                      />
                      <button type="button" className="ops-remove" onClick={() => removeOpsStandalone(si)} title="Remove row">
                        &times;
                      </button>
                    </>
                  )}
                </div>
              ))}
              {!isReadonly && ops.branches.length === 0 && ops.standalone.length === 0 && (
                <p className="sig-autofill-hint no-print">
                  No branches or divisions/groups yet — use Import from 207 or add them manually.
                </p>
              )}
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
          ops={ops}
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
