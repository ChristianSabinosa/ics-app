import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics201Print from './Ics201Print'
import OrgChart from '../components/OrgChart'
import type { OrgChartPosition } from '../components/OrgChart'
import { useFormAccess } from '../components/FormAccess'
import './Ics201Form.css'

export interface Ics201ActionRow {
  date_time: string
  action: string
}

export interface Ics201ResourceRow {
  resource: string
  identifier: string
  requested: string
  eta: string
  arrived: string
  remarks: string
}

const emptyAction = (): Ics201ActionRow => ({ date_time: '', action: '' })
const emptyResource = (): Ics201ResourceRow => ({ resource: '', identifier: '', requested: '', eta: '', arrived: '', remarks: '' })

export default function Ics201Form() {
  const { id: incidentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canEdit } = useFormAccess()

  const [formId, setFormId] = useState<string | null>(null)
  const [incidentName, setIncidentName] = useState('')

  // ICS 201-1
  const [datePrepared, setDatePrepared] = useState('')
  const [timePrepared, setTimePrepared] = useState('')
  const [mapImage, setMapImage] = useState('') // incident map, loaded from the Incident Map menu
  const [showMapPreview, setShowMapPreview] = useState(false)
  const [situationSummary, setSituationSummary] = useState('')

  // ICS 201-2
  const [objectives, setObjectives] = useState<string[]>([''])
  const [actions, setActions] = useState<Ics201ActionRow[]>([emptyAction()])

  // ICS 201-3
  const [orgPositions, setOrgPositions] = useState<OrgChartPosition[]>([])

  // ICS 201-4
  const [resources, setResources] = useState<Ics201ResourceRow[]>([])

  // Prepared by IC
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

  // ── ICS 201-3: retrieve organization chart from ICS 207 ──
  const loadOrgChart = useCallback(async () => {
    if (!incidentId) return
    const { data: form207 } = await supabase
      .from('ics_207_forms')
      .select('id')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!form207) { setOrgPositions([]); return }

    const { data: posData } = await supabase
      .from('ics_207_positions')
      .select('position_key, position_title, abbreviation, section, person_name, agency')
      .eq('form_id', form207.id)
      .order('sort_order')

    setOrgPositions(posData || [])
  }, [incidentId])

  // ── ICS 201-4: retrieve resources from check-in manifests ──
  const pullFromCheckins = useCallback(async (current: Ics201ResourceRow[], manual: boolean) => {
    if (!incidentId) return

    const { data: manifests } = await supabase
      .from('checkin_manifests')
      .select('*')
      .eq('incident_id', incidentId)
      .eq('status', 'Submitted')
      .order('created_at')

    if (!manifests || manifests.length === 0) {
      if (manual) setError('No submitted check-ins found for this incident.')
      return
    }

    const existingIds = new Set(current.map((r) => r.identifier).filter(Boolean))
    const fmtDT = (iso: string) => {
      if (!iso) return ''
      const d = new Date(iso)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    const rows: Ics201ResourceRow[] = []
    for (const m of manifests) {
      if (existingIds.has(m.checkin_id)) continue
      rows.push({
        resource: m.agency_name || '',
        identifier: m.checkin_id || '',
        requested: '',
        eta: '',
        arrived: fmtDT(m.prepared_by_timestamp || m.created_at),
        remarks: m.total_personnel ? `${m.total_personnel} personnel` : '',
      })
    }

    if (rows.length === 0) {
      if (manual) setSuccess('All checked-in resources are already listed.')
      return
    }
    setResources((prev) => [...prev, ...rows])
    if (manual) setSuccess(`${rows.length} resource(s) loaded from check-in manifests.`)
  }, [incidentId])

  const loadForm = useCallback(async () => {
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
        .from('ics_201_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    } else {
      const { data: existingForm } = await supabase
        .from('ics_201_forms')
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
      setDatePrepared(formToLoad.date_prepared)
      setTimePrepared(formToLoad.time_prepared)
      setSituationSummary(formToLoad.situation_summary)
      setObjectives(Array.isArray(formToLoad.objectives) && formToLoad.objectives.length > 0 ? formToLoad.objectives : [''])
      setActions(Array.isArray(formToLoad.actions) && formToLoad.actions.length > 0 ? formToLoad.actions : [emptyAction()])
      setResources(Array.isArray(formToLoad.resources) ? formToLoad.resources : [])
      setPreparedByName(formToLoad.prepared_by_name)
      setPreparedBySig(formToLoad.prepared_by_sig)
      setPreparedDate(formToLoad.prepared_date)
      setPreparedTime(formToLoad.prepared_time)
      setStatus(formToLoad.status)

      if (!Array.isArray(formToLoad.resources) || formToLoad.resources.length === 0) {
        await pullFromCheckins([], false)
      }
    } else {
      // First load: pre-fill the resource summary from check-in manifests
      await pullFromCheckins([], false)
    }

    // Incident map (uploaded/cropped in the Incident Map menu)
    const { data: mapData } = await supabase
      .from('incident_maps')
      .select('map_image')
      .eq('incident_id', incidentId)
      .maybeSingle()
    setMapImage(mapData?.map_image || '')

    setLoading(false)
  }, [incidentId, searchParams, pullFromCheckins])

  useEffect(() => {
    if (!user) return
    const now = new Date()
    setPreparedByName(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    setDatePrepared(now.toISOString().slice(0, 10))
    setTimePrepared(now.toTimeString().slice(0, 5))
    setPreparedDate(now.toISOString().slice(0, 10))
    setPreparedTime(now.toTimeString().slice(0, 5))
    loadForm()
    loadOrgChart()
  }, [incidentId, user, searchParams, loadForm, loadOrgChart])

  const saveForm = async (formStatus: 'Draft' | 'Submitted') => {
    if (!incidentId || !user) return
    setSaving(true)
    setError('')
    setSuccess('')

    const now = new Date()
    const formData = {
      incident_id: incidentId,
      incident_name: incidentName,
      date_prepared: datePrepared,
      time_prepared: timePrepared,
      situation_summary: situationSummary,
      objectives: objectives.filter((o) => o.trim() !== ''),
      actions: actions.filter((a) => a.date_time.trim() !== '' || a.action.trim() !== ''),
      resources: resources.filter((r) => Object.values(r).some((v) => v.trim() !== '')),
      prepared_by_name: preparedByName,
      prepared_by_sig: preparedBySig,
      prepared_date: formStatus === 'Submitted' ? now.toISOString().slice(0, 10) : preparedDate,
      prepared_time: formStatus === 'Submitted' ? now.toTimeString().slice(0, 5) : preparedTime,
      status: formStatus,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_201_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_201_forms')
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
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 201 submitted successfully!')
  }

  // ── Row helpers ──
  const updateObjective = (i: number, value: string) => setObjectives((prev) => prev.map((o, idx) => (idx === i ? value : o)))
  const addObjective = () => setObjectives((prev) => [...prev, ''])
  const removeObjective = (i: number) => setObjectives((prev) => prev.filter((_, idx) => idx !== i))

  const updateAction = (i: number, key: keyof Ics201ActionRow, value: string) =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)))
  const addAction = () => setActions((prev) => [...prev, emptyAction()])
  const removeAction = (i: number) => setActions((prev) => prev.filter((_, idx) => idx !== i))

  const updateResource = (i: number, key: keyof Ics201ResourceRow, value: string) =>
    setResources((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))
  const addResource = () => setResources((prev) => [...prev, emptyResource()])
  const removeResource = (i: number) => setResources((prev) => prev.filter((_, idx) => idx !== i))

  if (loading) {
    return (
      <div className="ics201-page">
        <div className="ics201-loading">Loading ICS Form 201...</div>
      </div>
    )
  }

  const isReadonly = (status === 'Submitted' && !isEditing) || !canEdit

  const preparedFooter = (num: string, withDateTime: boolean) => (
    <div className={`sheet-footer ${withDateTime ? 'with-datetime' : ''}`}>
      <div className="footer-num">{num}. Prepared by IC</div>
      <div className="footer-field">
        <label>Name and Signature:</label>
        <input
          type="text"
          value={preparedByName || preparedBySig}
          onChange={(e) => { setPreparedByName(e.target.value); setPreparedBySig(e.target.value) }}
          disabled={isReadonly}
        />
      </div>
      {withDateTime && (
        <>
          <div className="footer-field">
            <label>Date Prepared:</label>
            <input type="date" value={preparedDate} onChange={(e) => setPreparedDate(e.target.value)} disabled={isReadonly} />
          </div>
          <div className="footer-field">
            <label>Time Prepared:</label>
            <input type="time" value={preparedTime} onChange={(e) => setPreparedTime(e.target.value)} disabled={isReadonly} />
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="ics201-page">
      <header className="ics201-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics201-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
          <span className="form-badge">ICS 201</span>
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

      <main className="ics201-main no-print">
        <div className="ics201-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {/* ══════════ PAGE 1 — ICS 201-1 ══════════ */}
          <section className="form-sheet">
            <div className="sheet-header">
              <img src="/ndrrmc-logo.png" alt="NDRRMC" className="sheet-logo" />
              <div className="sheet-title">
                <h2>INCIDENT BRIEFING</h2>
                <h3>ICS 201-1</h3>
              </div>
            </div>

            <div className="sheet-row three-col">
              <div className="form-field">
                <label>1. INCIDENT/EVENT NAME</label>
                <input type="text" value={incidentName} readOnly className="readonly" />
              </div>
              <div className="form-field">
                <label>2. DATE PREPARED</label>
                <input type="date" value={datePrepared} onChange={(e) => setDatePrepared(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="form-field">
                <label>3. TIME PREPARED</label>
                <input type="time" value={timePrepared} onChange={(e) => setTimePrepared(e.target.value)} disabled={isReadonly} />
              </div>
            </div>

            <div className="sheet-block">
              <div className="block-title">4. MAP SKETCH</div>
              <div className="block-hint">
                (Show graphical sketch/map image of the incident/event area depicting current situation and resource assignments)
              </div>
              <div className="map-actions">
                <button
                  type="button"
                  className="map-btn view"
                  onClick={() => setShowMapPreview(true)}
                  disabled={!mapImage}
                  title={mapImage ? 'View the saved incident map' : 'No incident map uploaded yet'}
                >
                  View Map
                </button>
                <button
                  type="button"
                  className="map-btn upload"
                  onClick={() => navigate(`/incident/${incidentId}/incident-map`)}
                  title="Upload and crop the incident map"
                >
                  Upload Map
                </button>
              </div>
              <div className="map-preview">
                {mapImage && <img src={mapImage} alt="Map sketch" />}
              </div>
            </div>

            <div className="sheet-block">
              <div className="block-title">5. SITUATION SUMMARY AND HEALTH AND SAFETY BRIEFING</div>
              <div className="block-hint">
                (For briefings or transfer of command; indicate the potential health and safety hazards recognized and the necessary
                measures initially developed to protect responders)
              </div>
              <textarea
                className="block-textarea"
                value={situationSummary}
                onChange={(e) => setSituationSummary(e.target.value)}
                disabled={isReadonly}
                rows={7}
              />
            </div>

            {preparedFooter('6', false)}
          </section>

          {/* ══════════ PAGE 2 — ICS 201-2 ══════════ */}
          <section className="form-sheet">
            <div className="sheet-header">
              <img src="/ndrrmc-logo.png" alt="NDRRMC" className="sheet-logo" />
              <div className="sheet-title">
                <h2>INCIDENT BRIEFING</h2>
                <h3>ICS 201-2</h3>
              </div>
            </div>

            <div className="sheet-block">
              <div className="block-title">7. OBJECTIVES</div>
              <div className="bullet-list">
                {objectives.map((obj, i) => (
                  <div key={i} className="bullet-row">
                    <span className="bullet-mark">&bull;</span>
                    <input
                      type="text"
                      value={obj}
                      onChange={(e) => updateObjective(i, e.target.value)}
                      placeholder={`Objective ${i + 1}`}
                      disabled={isReadonly}
                    />
                    <button className="remove-row" onClick={() => removeObjective(i)} disabled={isReadonly} title="Remove">&times;</button>
                  </div>
                ))}
              </div>
              <div className="add-row-buttons">
                <button className="add-row-btn" onClick={addObjective} disabled={isReadonly}>+ Add Objective</button>
              </div>
            </div>

            <div className="sheet-block">
              <div className="block-title">8. SUMMARY OF CURRENT AND PLANNED ACTIONS</div>
              <table className="entry-table actions-table">
                <thead>
                  <tr>
                    <th className="col-datetime">DATE and TIME</th>
                    <th>ACTIONS</th>
                    <th className="remove-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a, i) => (
                    <tr key={i}>
                      <td><input type="text" value={a.date_time} onChange={(e) => updateAction(i, 'date_time', e.target.value)} placeholder="MM/DD/YYYY 0000H" disabled={isReadonly} /></td>
                      <td><input type="text" value={a.action} onChange={(e) => updateAction(i, 'action', e.target.value)} disabled={isReadonly} /></td>
                      <td className="remove-cell"><button className="remove-row" onClick={() => removeAction(i)} disabled={isReadonly}>&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="add-row-buttons">
                <button className="add-row-btn" onClick={addAction} disabled={isReadonly}>+ Add Action</button>
              </div>
              <div className="sheet-note">Use additional sheets as needed</div>
            </div>

            {preparedFooter('9', true)}
          </section>

          {/* ══════════ PAGE 3 — ICS 201-3 ══════════ */}
          <section className="form-sheet">
            <div className="sheet-header">
              <img src="/ndrrmc-logo.png" alt="NDRRMC" className="sheet-logo" />
              <div className="sheet-title">
                <h2>INCIDENT BRIEFING</h2>
                <h3>ICS 201-3</h3>
              </div>
            </div>

            <div className="sheet-block">
              <div className="block-title">10. CURRENT ORGANIZATION</div>
              <div className="block-hint">[ fill in organization as appropriate ]</div>
              <div className="org-preview">
                {orgPositions.length > 0 ? (
                  <OrgChart positions={orgPositions} />
                ) : (
                  <div className="org-empty">
                    No ICS 207 organization found. Create the organization chart in ICS 207 first.
                  </div>
                )}
              </div>
            </div>

            {preparedFooter('11', true)}
          </section>

          {/* ══════════ PAGE 4 — ICS 201-4 ══════════ */}
          <section className="form-sheet">
            <div className="sheet-header">
              <img src="/ndrrmc-logo.png" alt="NDRRMC" className="sheet-logo" />
              <div className="sheet-title">
                <h2>INCIDENT BRIEFING</h2>
                <h3>ICS 201-4</h3>
              </div>
            </div>

            <div className="sheet-block">
              <div className="block-title">12. RESOURCES SUMMARY</div>
              <table className="entry-table resources-table">
                <thead>
                  <tr>
                    <th>RESOURCE</th>
                    <th>RESOURCE IDENTIFIER</th>
                    <th>DATE AND TIME REQUESTED</th>
                    <th>ETA (DATE AND TIME)</th>
                    <th>ARRIVED/ ON SCENE</th>
                    <th>REMARKS</th>
                    <th className="remove-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r, i) => (
                    <tr key={i}>
                      <td><input type="text" value={r.resource} onChange={(e) => updateResource(i, 'resource', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={r.identifier} onChange={(e) => updateResource(i, 'identifier', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={r.requested} onChange={(e) => updateResource(i, 'requested', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={r.eta} onChange={(e) => updateResource(i, 'eta', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={r.arrived} onChange={(e) => updateResource(i, 'arrived', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={r.remarks} onChange={(e) => updateResource(i, 'remarks', e.target.value)} disabled={isReadonly} /></td>
                      <td className="remove-cell"><button className="remove-row" onClick={() => removeResource(i)} disabled={isReadonly}>&times;</button></td>
                    </tr>
                  ))}
                  {resources.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={7}>No resources yet. Use the buttons below to add or retrieve them from the database.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="add-row-buttons">
                <button className="add-row-btn" onClick={addResource} disabled={isReadonly}>+ Add Row</button>
                <button className="add-row-btn manifest" onClick={() => pullFromCheckins(resources, true)} disabled={isReadonly}>
                  Load from Check-in Manifest
                </button>
              </div>
              <div className="sheet-note">Use additional sheets as needed</div>
            </div>

            {preparedFooter('13', true)}
          </section>
        </div>
      </main>

      {showMapPreview && mapImage && (
        <div className="map-modal-overlay no-print" onClick={() => setShowMapPreview(false)}>
          <div className="map-modal" onClick={(e) => e.stopPropagation()}>
            <div className="map-modal-header">
              <h3>Incident Map</h3>
              <button className="map-modal-close" onClick={() => setShowMapPreview(false)}>&times;</button>
            </div>
            <img src={mapImage} alt="Incident map" />
          </div>
        </div>
      )}

      {showPrint && (
        <Ics201Print
          incidentName={incidentName}
          datePrepared={datePrepared}
          timePrepared={timePrepared}
          mapImage={mapImage}
          situationSummary={situationSummary}
          objectives={objectives}
          actions={actions}
          orgPositions={orgPositions}
          resources={resources}
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
