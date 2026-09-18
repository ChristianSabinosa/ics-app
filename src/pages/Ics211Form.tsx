import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Ics211Resource } from '../lib/types'
import Ics211Print from './Ics211Print'
import './Ics211Form.css'

const emptyResource: Omit<Ics211Resource, 'id' | 'form_id'> = {
  order_request_no: '', checkin_datetime: '', kind: '', type: '',
  resource_identifier_single: false, resource_identifier_st: false, resource_identifier_tf: false,
  agency_name: '', leader_name: '', contact_details: '', total_personnel: 0,
  departure_point_of_origin: '', departure_datetime: '', departure_method_of_travel: '',
  with_manifest: false, incident_assignment: 'Waiting for assignment', other_qualifications: '',
  data_sent_to_resl: '', sort_order: 0,
}

export default function Ics211Form() {
  const { id: incidentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [formId, setFormId] = useState<string | null>(null)
  const [incidentName, setIncidentName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [checkinLocation, setCheckinLocation] = useState<string[]>([])
  const [resources, setResources] = useState<Omit<Ics211Resource, 'id' | 'form_id'>[]>([])
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

  const loadFromManifests = useCallback(async () => {
    if (!incidentId) return

    const { data: manifests } = await supabase
      .from('checkin_manifests')
      .select('*')
      .eq('incident_id', incidentId)
      .eq('status', 'Submitted')
      .order('created_at')

    if (!manifests || manifests.length === 0) return

    const manifestIds = manifests.map((m) => m.id)
    const { data: allPersonnel } = await supabase
      .from('checkin_personnel')
      .select('*')
      .in('manifest_id', manifestIds)

    const loadedResources: Omit<Ics211Resource, 'id' | 'form_id'>[] = []

    for (const manifest of manifests) {
      const manifestPersonnel = allPersonnel?.filter((p) => p.manifest_id === manifest.id) || []
      const leader = manifestPersonnel.find((p) => p.role === 'Leader')

      const checkinTs = manifest.prepared_by_timestamp || manifest.created_at
      const checkinDt = checkinTs ? new Date(checkinTs).toISOString().slice(0, 16) : ''

      loadedResources.push({
        order_request_no: manifest.checkin_id,
        checkin_datetime: checkinDt,
        kind: '',
        type: '',
        resource_identifier_single: true,
        resource_identifier_st: false,
        resource_identifier_tf: false,
        agency_name: manifest.agency_name,
        leader_name: leader?.name || '',
        contact_details: leader?.contact_details || '',
        total_personnel: manifest.total_personnel,
        departure_point_of_origin: '',
        departure_datetime: '',
        departure_method_of_travel: '',
        with_manifest: true,
        incident_assignment: 'Waiting for assignment',
        other_qualifications: leader?.capabilities || '',
        data_sent_to_resl: '',
        sort_order: loadedResources.length,
      })
    }

    if (loadedResources.length > 0) {
      setResources(loadedResources)
    }
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
        .from('ics_211_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    } else {
      const { data: existingForm } = await supabase
        .from('ics_211_forms')
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
      setStartDate(formToLoad.start_date)
      setStartTime(formToLoad.start_time)
      setCheckinLocation(formToLoad.checkin_location ? formToLoad.checkin_location.split(',').filter(Boolean) : [])
      setPreparedBy(formToLoad.prepared_by)
      setDatePrepared(formToLoad.date_prepared)
      setTimePrepared(formToLoad.time_prepared)
      setStatus(formToLoad.status)

      const { data: resData } = await supabase
        .from('ics_211_resources')
        .select('*')
        .eq('form_id', formToLoad.id)
        .order('sort_order')

      if (resData) {
        setResources(resData.map(({ id: _id, form_id: _fid, ...rest }) => rest))
      }
    } else {
      await loadFromManifests()
    }

    setLoading(false)
  }, [incidentId, searchParams, loadFromManifests])

  useEffect(() => {
    if (!user) return
    const now = new Date()
    setPreparedBy(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    setDatePrepared(now.toISOString().slice(0, 10))
    setTimePrepared(now.toTimeString().slice(0, 5))
    loadForm()
  }, [incidentId, user, searchParams, loadForm])

  const fetchFromCheckins = async () => {
    if (!incidentId) return

    const { data: manifests } = await supabase
      .from('checkin_manifests')
      .select('*')
      .eq('incident_id', incidentId)
      .eq('status', 'Submitted')
      .order('created_at')

    if (!manifests || manifests.length === 0) {
      setError('No submitted check-ins found for this incident.')
      return
    }

    const manifestIds = manifests.map((m) => m.id)
    const { data: allPersonnel } = await supabase
      .from('checkin_personnel')
      .select('*')
      .in('manifest_id', manifestIds)

    const existingCheckinIds = new Set(
      resources.map((r) => r.order_request_no).filter(Boolean)
    )

    const newResources: Omit<Ics211Resource, 'id' | 'form_id'>[] = []

    for (const manifest of manifests) {
      if (existingCheckinIds.has(manifest.checkin_id)) continue

      const manifestPersonnel = allPersonnel?.filter((p) => p.manifest_id === manifest.id) || []
      const leader = manifestPersonnel.find((p) => p.role === 'Leader')

      const checkinTs = manifest.prepared_by_timestamp || manifest.created_at
      const checkinDt = checkinTs ? new Date(checkinTs).toISOString().slice(0, 16) : ''

      newResources.push({
        order_request_no: manifest.checkin_id,
        checkin_datetime: checkinDt,
        kind: '',
        type: '',
        resource_identifier_single: true,
        resource_identifier_st: false,
        resource_identifier_tf: false,
        agency_name: manifest.agency_name,
        leader_name: leader?.name || '',
        contact_details: leader?.contact_details || '',
        total_personnel: manifest.total_personnel,
        departure_point_of_origin: '',
        departure_datetime: '',
        departure_method_of_travel: '',
        with_manifest: true,
        incident_assignment: 'Waiting for assignment',
        other_qualifications: leader?.capabilities || '',
        data_sent_to_resl: '',
        sort_order: resources.length + newResources.length,
      })
    }

    if (newResources.length > 0) {
      setResources([...resources, ...newResources])
      setSuccess(`Fetched ${newResources.length} new check-in(s) from other agencies.`)
    } else {
      setSuccess('All check-ins are already included in the form.')
    }
  }

  const handleLocationToggle = (loc: string) => {
    setCheckinLocation((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    )
  }

  const updateResource = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...resources]
    updated[index] = { ...updated[index], [field]: value }
    setResources(updated)
  }

  const setResourceIdentifier = (index: number, choice: 'single' | 'st' | 'tf') => {
    const updated = [...resources]
    updated[index] = {
      ...updated[index],
      resource_identifier_single: choice === 'single',
      resource_identifier_st: choice === 'st',
      resource_identifier_tf: choice === 'tf',
    }
    setResources(updated)
  }

  const addResource = () => {
    setResources([...resources, { ...emptyResource, with_manifest: false, sort_order: resources.length }])
  }

  const removeResource = (index: number) => {
    setResources(resources.filter((_, i) => i !== index))
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
      start_date: startDate,
      start_time: startTime,
      checkin_location: checkinLocation.join(','),
      status: formStatus,
      prepared_by: preparedBy,
      date_prepared: formStatus === 'Submitted' ? now.toISOString().slice(0, 10) : datePrepared,
      time_prepared: formStatus === 'Submitted' ? now.toTimeString().slice(0, 5) : timePrepared,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_211_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_211_forms')
        .insert(formData)
        .select()
        .single()
      if (insertError) { setError(insertError.message); setSaving(false); return }
      fId = inserted.id
      setFormId(fId)
    }

    await supabase.from('ics_211_resources').delete().eq('form_id', fId)

    if (resources.length > 0) {
      const now211 = formStatus === 'Submitted' ? (() => {
        const d = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      })() : ''
      const resourceRows = resources.map((r, i) => ({
        form_id: fId!,
        ...r,
        data_sent_to_resl: formStatus === 'Submitted' ? now211 : r.data_sent_to_resl,
        sort_order: i,
      }))
      const { error: resError } = await supabase.from('ics_211_resources').insert(resourceRows)
      if (resError) { setError(resError.message); setSaving(false); return }
    }

    setSaving(false)
    setStatus(formStatus)
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 211 submitted successfully!')
  }

  if (loading) {
    return (
      <div className="ics211-page">
        <div className="ics211-loading">Loading ICS Form 211...</div>
      </div>
    )
  }

  return (
    <div className="ics211-page">
      <header className="ics211-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics211-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="form-badge">ICS 211</span>
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

      <main className="ics211-main no-print">
        <div className="ics211-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>INCIDENT CHECK-IN LIST</h2>
            <h3>ICS 211</h3>
          </div>

          <div className="form-top-row">
            <div className="form-field wide">
              <label>1. INCIDENT/EVENT NAME</label>
              <input type="text" value={incidentName} onChange={(e) => setIncidentName(e.target.value)} />
            </div>
            <div className="form-field">
              <label>2. START DATE AND TIME</label>
              <div className="datetime-row">
                <div><label>Date:</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                <div><label>Time:</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
              </div>
            </div>
            <div className="form-field">
              <label>3. CHECK-IN LOCATION</label>
              <div className="checkbox-group">
                {['Base', 'Camp', 'Staging Area', 'ICP', 'Others'].map((loc) => (
                  <label key={loc} className="checkbox-label">
                    <input type="checkbox" checked={checkinLocation.includes(loc)} onChange={() => handleLocationToggle(loc)} />
                    {loc}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="resources-section">
            <h4>4. CHECK-IN INFORMATION</h4>
            <div className="cards-container">
              {resources.map((r, i) => (
                <div key={i} className="resource-card">
                  <div className="card-header">
                    <span className="card-number">Resource {i + 1}</span>
                    <span className={`manifest-label ${r.with_manifest ? 'yes' : 'no'}`}>
                      {r.with_manifest ? 'From Check-in Manifest' : 'Manually Added'}
                    </span>
                    <button className="remove-card-btn" onClick={() => removeResource(i)}>&times; Remove</button>
                  </div>
                  <div className="card-body">
                    <div className="card-field">
                      <label>Order/Request No.</label>
                      <input value={r.order_request_no} onChange={(e) => updateResource(i, 'order_request_no', e.target.value)} />
                    </div>
                    <div className="card-field">
                      <label>Check-In Date and Time</label>
                      <input type="datetime-local" value={r.checkin_datetime} onChange={(e) => updateResource(i, 'checkin_datetime', e.target.value)} />
                    </div>
                    <div className="card-field">
                      <label>Kind</label>
                      <input value={r.kind} onChange={(e) => updateResource(i, 'kind', e.target.value)} />
                    </div>
                    <div className="card-field">
                      <label>Type</label>
                      <input value={r.type} onChange={(e) => updateResource(i, 'type', e.target.value)} />
                    </div>
                    <div className="card-field">
                      <label>Resource Identifier</label>
                      <div className="ri-group">
                        <label><input type="radio" name={`ri-${i}`} checked={r.resource_identifier_single} onChange={() => setResourceIdentifier(i, 'single')} /> Single</label>
                        <label><input type="radio" name={`ri-${i}`} checked={r.resource_identifier_st} onChange={() => setResourceIdentifier(i, 'st')} /> ST</label>
                        <label><input type="radio" name={`ri-${i}`} checked={r.resource_identifier_tf} onChange={() => setResourceIdentifier(i, 'tf')} /> TF</label>
                      </div>
                    </div>
                    <div className="card-field span-2">
                      <label>Name of Agency/Office/Home Base</label>
                      <textarea rows={1} value={r.agency_name} onChange={(e) => { updateResource(i, 'agency_name', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />
                    </div>
                    <div className="card-field">
                      <label>Name of Leader</label>
                      <textarea rows={1} value={r.leader_name} onChange={(e) => { updateResource(i, 'leader_name', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />
                    </div>
                    <div className="card-field">
                      <label>Contact Details</label>
                      <textarea rows={1} value={r.contact_details} onChange={(e) => { updateResource(i, 'contact_details', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />
                    </div>
                    <div className="card-field">
                      <label>Total No. of Pers.</label>
                      <input type="number" min="0" value={r.total_personnel} onChange={(e) => updateResource(i, 'total_personnel', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="card-field">
                      <label>Departure: Point of Origin</label>
                      <textarea rows={1} value={r.departure_point_of_origin} onChange={(e) => { updateResource(i, 'departure_point_of_origin', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />
                    </div>
                    <div className="card-field">
                      <label>Departure: Date and Time</label>
                      <input type="datetime-local" value={r.departure_datetime} onChange={(e) => updateResource(i, 'departure_datetime', e.target.value)} />
                    </div>
                    <div className="card-field">
                      <label>Departure: Method of Travel</label>
                      <select value={r.departure_method_of_travel} onChange={(e) => updateResource(i, 'departure_method_of_travel', e.target.value)}>
                        <option value="">-</option>
                        <option value="Land">Land</option>
                        <option value="Water">Water</option>
                        <option value="Air">Air</option>
                      </select>
                    </div>
                    <div className="card-field span-2">
                      <label>Incident Assignment</label>
                      <textarea rows={1} value={r.incident_assignment} onChange={(e) => { updateResource(i, 'incident_assignment', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />
                    </div>
                    <div className="card-field span-2">
                      <label>Other Qualifications</label>
                      <textarea rows={1} value={r.other_qualifications} onChange={(e) => { updateResource(i, 'other_qualifications', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />
                    </div>
                    <div className="card-field">
                      <label>Data Sent to RESL</label>
                      <span className="resl-text">{r.data_sent_to_resl ? r.data_sent_to_resl.replace('T', ' ') : '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="add-row-buttons">
              <button className="add-row-btn" onClick={addResource}>+ Add Resource</button>
              <button className="add-row-btn manifest" onClick={fetchFromCheckins}>Copy from Check-in Manifest</button>
            </div>
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
        </div>
      </main>

      {showPrint && (
        <Ics211Print
          incidentName={incidentName}
          startDate={startDate}
          startTime={startTime}
          checkinLocation={checkinLocation}
          resources={resources}
          preparedBy={preparedBy}
          datePrepared={datePrepared}
          timePrepared={timePrepared}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
