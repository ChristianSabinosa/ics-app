import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Ics206AidStation, Ics206Ambulance, Ics206Hospital } from '../lib/types'
import Ics206Print from './Ics206Print'
import './Ics206Form.css'

const emptyAidStation: Omit<Ics206AidStation, 'id' | 'form_id'> = {
  name: '', location: '', contact_person: '', contact_numbers: '', remarks: '', with_paramedics: false, sort_order: 0,
}

const emptyAmbulance: Omit<Ics206Ambulance, 'id' | 'form_id'> = {
  name: '', location: '', contact_person: '', contact_numbers: '', remarks: '', level_of_service: '', sort_order: 0,
}

const emptyHospital: Omit<Ics206Hospital, 'id' | 'form_id'> = {
  name: '', location: '', contact_person: '', contact_numbers: '',
  travel_time_air: '', travel_time_land: '',
  with_trauma_center: false, with_burn_center: false, with_helipad: false, sort_order: 0,
}

export default function Ics206Form() {
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

  const [aidStations, setAidStations] = useState<Omit<Ics206AidStation, 'id' | 'form_id'>[]>([])
  const [ambulances, setAmbulances] = useState<Omit<Ics206Ambulance, 'id' | 'form_id'>[]>([])
  const [hospitals, setHospitals] = useState<Omit<Ics206Hospital, 'id' | 'form_id'>[]>([])
  const [medicalEmergencyProcedures, setMedicalEmergencyProcedures] = useState('')
  const [aviationAssetsUsed, setAviationAssetsUsed] = useState(false)

  const [preparedBy, setPreparedBy] = useState('')
  const [datePrepared, setDatePrepared] = useState('')
  const [timePrepared, setTimePrepared] = useState('')
  const [reviewedBy, setReviewedBy] = useState('')
  const [dateReviewed, setDateReviewed] = useState('')
  const [timeReviewed, setTimeReviewed] = useState('')
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
    const pad = (n: number) => String(n).padStart(2, '0')
    setPreparedBy(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    setDatePrepared(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
    setTimePrepared(`${pad(now.getHours())}:${pad(now.getMinutes())}`)
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
      const { data } = await supabase.from('ics_206_forms').select('*').eq('id', formParam).single()
      formToLoad = data
    } else {
      const { data } = await supabase
        .from('ics_206_forms').select('*').eq('incident_id', incidentId)
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
      setMedicalEmergencyProcedures(formToLoad.medical_emergency_procedures)
      setAviationAssetsUsed(formToLoad.aviation_assets_used)
      setPreparedBy(formToLoad.prepared_by)
      setDatePrepared(formToLoad.date_prepared)
      setTimePrepared(formToLoad.time_prepared)
      setReviewedBy(formToLoad.reviewed_by)
      setDateReviewed(formToLoad.date_reviewed)
      setTimeReviewed(formToLoad.time_reviewed)
      setStatus(formToLoad.status)

      const { data: aidData } = await supabase
        .from('ics_206_aid_stations').select('*').eq('form_id', formToLoad.id).order('sort_order')
      if (aidData) setAidStations(aidData.map(({ id: _id, form_id: _fid, ...rest }) => rest))

      const { data: ambData } = await supabase
        .from('ics_206_ambulances').select('*').eq('form_id', formToLoad.id).order('sort_order')
      if (ambData) setAmbulances(ambData.map(({ id: _id, form_id: _fid, ...rest }) => rest))

      const { data: hospData } = await supabase
        .from('ics_206_hospitals').select('*').eq('form_id', formToLoad.id).order('sort_order')
      if (hospData) setHospitals(hospData.map(({ id: _id, form_id: _fid, ...rest }) => rest))
    } else {
      setAidStations([{ ...emptyAidStation, sort_order: 0 }])
      setAmbulances([{ ...emptyAmbulance, sort_order: 0 }])
      setHospitals([{ ...emptyHospital, sort_order: 0 }])
    }

    setLoading(false)
  }

  const updateAidStation = (index: number, field: string, value: string | boolean) => {
    const updated = [...aidStations]
    updated[index] = { ...updated[index], [field]: value }
    setAidStations(updated)
  }

  const addAidStation = () => {
    setAidStations([...aidStations, { ...emptyAidStation, sort_order: aidStations.length }])
  }

  const removeAidStation = (index: number) => {
    setAidStations(aidStations.filter((_, i) => i !== index))
  }

  const updateAmbulance = (index: number, field: string, value: string | boolean) => {
    const updated = [...ambulances]
    updated[index] = { ...updated[index], [field]: value }
    setAmbulances(updated)
  }

  const addAmbulance = () => {
    setAmbulances([...ambulances, { ...emptyAmbulance, sort_order: ambulances.length }])
  }

  const removeAmbulance = (index: number) => {
    setAmbulances(ambulances.filter((_, i) => i !== index))
  }

  const updateHospital = (index: number, field: string, value: string | boolean) => {
    const updated = [...hospitals]
    updated[index] = { ...updated[index], [field]: value }
    setHospitals(updated)
  }

  const addHospital = () => {
    setHospitals([...hospitals, { ...emptyHospital, sort_order: hospitals.length }])
  }

  const removeHospital = (index: number) => {
    setHospitals(hospitals.filter((_, i) => i !== index))
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
      medical_emergency_procedures: medicalEmergencyProcedures,
      aviation_assets_used: aviationAssetsUsed,
      status: formStatus,
      prepared_by: preparedBy,
      date_prepared: formStatus === 'Submitted' ? localDate : datePrepared,
      time_prepared: formStatus === 'Submitted' ? localTime : timePrepared,
      reviewed_by: reviewedBy,
      date_reviewed: formStatus === 'Submitted' ? localDate : dateReviewed,
      time_reviewed: formStatus === 'Submitted' ? localTime : timeReviewed,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_206_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else if (!fId) {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_206_forms').insert(formData).select().single()
      if (insertError) { setError(insertError.message); setSaving(false); return }
      fId = inserted.id
      setFormId(fId)
    }

    if (fId) {
      await supabase.from('ics_206_aid_stations').delete().eq('form_id', fId)
      await supabase.from('ics_206_ambulances').delete().eq('form_id', fId)
      await supabase.from('ics_206_hospitals').delete().eq('form_id', fId)

      if (aidStations.length > 0) {
        const { error: e } = await supabase.from('ics_206_aid_stations').insert(
          aidStations.map((c, i) => ({ form_id: fId!, ...c, sort_order: i }))
        )
        if (e) { setError(e.message); setSaving(false); return }
      }
      if (ambulances.length > 0) {
        const { error: e } = await supabase.from('ics_206_ambulances').insert(
          ambulances.map((c, i) => ({ form_id: fId!, ...c, sort_order: i }))
        )
        if (e) { setError(e.message); setSaving(false); return }
      }
      if (hospitals.length > 0) {
        const { error: e } = await supabase.from('ics_206_hospitals').insert(
          hospitals.map((c, i) => ({ form_id: fId!, ...c, sort_order: i }))
        )
        if (e) { setError(e.message); setSaving(false); return }
      }
    }

    setSaving(false)
    setStatus(formStatus)
    setIsEditing(false)
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 206 submitted successfully!')
  }

  if (loading) {
    return (
      <div className="ics206-page">
        <div className="ics206-loading">Loading ICS Form 206...</div>
      </div>
    )
  }

  return (
    <div className="ics206-page">
      <header className="ics206-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics206-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="form-badge">ICS 206</span>
          <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
        </div>
      </div>

      <main className="ics206-main no-print">
        <div className="ics206-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>MEDICAL PLAN</h2>
            <h3>ICS 206</h3>
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

          {/* Section 3: Medical Aid Stations */}
          <div className="form-section">
            <h4>3. MEDICAL AID STATIONS</h4>
            <div className="channels-table-wrapper">
              <table className="channels-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Contact Person</th>
                    <th>Contact Number(s)</th>
                    <th>With Paramedics?</th>
                    <th>Remarks</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {aidStations.map((a, i) => (
                    <tr key={i}>
                      <td><input value={a.name} onChange={(e) => updateAidStation(i, 'name', e.target.value)} /></td>
                      <td><input value={a.location} onChange={(e) => updateAidStation(i, 'location', e.target.value)} /></td>
                      <td><input value={a.contact_person} onChange={(e) => updateAidStation(i, 'contact_person', e.target.value)} /></td>
                      <td><input value={a.contact_numbers} onChange={(e) => updateAidStation(i, 'contact_numbers', e.target.value)} /></td>
                      <td className="radio-cell">
                        <label className="radio-label"><input type="radio" checked={a.with_paramedics === true} onChange={() => updateAidStation(i, 'with_paramedics', true)} /> Yes</label>
                        <label className="radio-label"><input type="radio" checked={a.with_paramedics === false} onChange={() => updateAidStation(i, 'with_paramedics', false)} /> No</label>
                      </td>
                      <td><input value={a.remarks} onChange={(e) => updateAidStation(i, 'remarks', e.target.value)} /></td>
                      <td className="actions-cell"><button className="remove-row-btn" onClick={() => removeAidStation(i)}>&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="add-row-buttons">
              <button className="add-row-btn" onClick={addAidStation}>+ Add Aid Station</button>
            </div>
          </div>

          {/* Section 4: Ambulance/Medical Transportation */}
          <div className="form-section">
            <h4>4. AMBULANCE/MEDICAL TRANSPORTATION SERVICES</h4>
            <div className="channels-table-wrapper">
              <table className="channels-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Contact Person</th>
                    <th>Contact Number(s)</th>
                    <th>Level of Service</th>
                    <th>Remarks</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ambulances.map((a, i) => (
                    <tr key={i}>
                      <td><input value={a.name} onChange={(e) => updateAmbulance(i, 'name', e.target.value)} /></td>
                      <td><input value={a.location} onChange={(e) => updateAmbulance(i, 'location', e.target.value)} /></td>
                      <td><input value={a.contact_person} onChange={(e) => updateAmbulance(i, 'contact_person', e.target.value)} /></td>
                      <td><input value={a.contact_numbers} onChange={(e) => updateAmbulance(i, 'contact_numbers', e.target.value)} /></td>
                      <td className="radio-cell">
                        <label className="radio-label"><input type="radio" checked={a.level_of_service === 'BLS'} onChange={() => updateAmbulance(i, 'level_of_service', 'BLS')} /> BLS</label>
                        <label className="radio-label"><input type="radio" checked={a.level_of_service === 'ALS'} onChange={() => updateAmbulance(i, 'level_of_service', 'ALS')} /> ALS</label>
                      </td>
                      <td><input value={a.remarks} onChange={(e) => updateAmbulance(i, 'remarks', e.target.value)} /></td>
                      <td className="actions-cell"><button className="remove-row-btn" onClick={() => removeAmbulance(i)}>&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="add-row-buttons">
              <button className="add-row-btn" onClick={addAmbulance}>+ Add Ambulance</button>
            </div>
          </div>

          {/* Section 5: Hospitals */}
          <div className="form-section">
            <h4>5. HOSPITALS</h4>
            <div className="channels-table-wrapper">
              <table className="channels-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Contact Person</th>
                    <th>Contact Number(s)</th>
                    <th>Travel Time</th>
                    <th>With Trauma Center?</th>
                    <th>With Burn Center?</th>
                    <th>With Helipad?</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {hospitals.map((h, i) => (
                    <tr key={i}>
                      <td><input value={h.name} onChange={(e) => updateHospital(i, 'name', e.target.value)} /></td>
                      <td><input value={h.location} onChange={(e) => updateHospital(i, 'location', e.target.value)} /></td>
                      <td><input value={h.contact_person} onChange={(e) => updateHospital(i, 'contact_person', e.target.value)} /></td>
                      <td><input value={h.contact_numbers} onChange={(e) => updateHospital(i, 'contact_numbers', e.target.value)} /></td>
                      <td className="travel-time-cell">
                        <div className="travel-time-row">
                          <label>Air:</label><input value={h.travel_time_air} onChange={(e) => updateHospital(i, 'travel_time_air', e.target.value)} />
                        </div>
                        <div className="travel-time-row">
                          <label>Land:</label><input value={h.travel_time_land} onChange={(e) => updateHospital(i, 'travel_time_land', e.target.value)} />
                        </div>
                      </td>
                      <td className="radio-cell">
                        <label className="radio-label"><input type="radio" checked={h.with_trauma_center === true} onChange={() => updateHospital(i, 'with_trauma_center', true)} /> Yes</label>
                        <label className="radio-label"><input type="radio" checked={h.with_trauma_center === false} onChange={() => updateHospital(i, 'with_trauma_center', false)} /> No</label>
                      </td>
                      <td className="radio-cell">
                        <label className="radio-label"><input type="radio" checked={h.with_burn_center === true} onChange={() => updateHospital(i, 'with_burn_center', true)} /> Yes</label>
                        <label className="radio-label"><input type="radio" checked={h.with_burn_center === false} onChange={() => updateHospital(i, 'with_burn_center', false)} /> No</label>
                      </td>
                      <td className="radio-cell">
                        <label className="radio-label"><input type="radio" checked={h.with_helipad === true} onChange={() => updateHospital(i, 'with_helipad', true)} /> Yes</label>
                        <label className="radio-label"><input type="radio" checked={h.with_helipad === false} onChange={() => updateHospital(i, 'with_helipad', false)} /> No</label>
                      </td>
                      <td className="actions-cell"><button className="remove-row-btn" onClick={() => removeHospital(i)}>&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="add-row-buttons">
              <button className="add-row-btn" onClick={addHospital}>+ Add Hospital</button>
            </div>
          </div>

          {/* Section 6: Medical Emergency Procedures */}
          <div className="form-section">
            <h4>6. MEDICAL EMERGENCY PROCEDURES</h4>
            <textarea
              className="coordinating-textarea"
              rows={6}
              value={medicalEmergencyProcedures}
              onChange={(e) => setMedicalEmergencyProcedures(e.target.value)}
              placeholder="Enter medical emergency procedures..."
            />
            <div className="aviation-toggle">
              <label className="toggle-label">
                <input type="checkbox" checked={aviationAssetsUsed} onChange={(e) => setAviationAssetsUsed(e.target.checked)} />
                Check if aviation assets are utilized for rescue. If assets are used, coordinate with Air Operations Branch.
              </label>
            </div>
          </div>

          {/* Footer: Prepared by + Reviewed by */}
          <div className="footer-section">
            <div className="footer-row">
              <div className="footer-label">7. Prepared by MEDL</div>
              <div className="footer-field">
                <label>Name and Signature:</label>
                <input type="text" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} />
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
            <div className="footer-row">
              <div className="footer-label">8. Reviewed by SOFR</div>
              <div className="footer-field">
                <label>Name and Signature:</label>
                <input type="text" value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} />
              </div>
              <div className="footer-field">
                <label>Date Reviewed:</label>
                <input type="date" value={dateReviewed} onChange={(e) => setDateReviewed(e.target.value)} />
              </div>
              <div className="footer-field">
                <label>Time Reviewed:</label>
                <input type="time" value={timeReviewed} onChange={(e) => setTimeReviewed(e.target.value)} />
              </div>
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
        <Ics206Print
          incidentName={incidentName}
          opFromDate={opFromDate}
          opFromTime={opFromTime}
          opToDate={opToDate}
          opToTime={opToTime}
          aidStations={aidStations}
          ambulances={ambulances}
          hospitals={hospitals}
          medicalEmergencyProcedures={medicalEmergencyProcedures}
          aviationAssetsUsed={aviationAssetsUsed}
          preparedBy={preparedBy}
          datePrepared={datePrepared}
          timePrepared={timePrepared}
          reviewedBy={reviewedBy}
          dateReviewed={dateReviewed}
          timeReviewed={timeReviewed}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
