import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics221Print from './Ics221Print'
import './Ics221Form.css'

interface UnitSignoff {
  unit_name: string
  checked: boolean
  remarks: string
  name: string
  signature: string
}

interface Position203 {
  position_key: string
  position_title: string
  section: string
  person_name: string
}

const LOGISTICS_UNITS = [
  'Chief', 'Supply Unit', 'Communications Unit',
  'Facilities Unit', 'Ground Support', 'Security Unit',
]

const FINANCE_UNITS = [
  'Chief', 'Time Unit', 'Procurement Unit',
  'Cost Unit', 'Compensation/Claims Unit',
]

const PLANNING_UNITS = [
  'Chief', 'Resources Unit', 'Situation Unit',
  'Documentation Unit', 'Demobilization Unit',
]

const OPERATIONS_UNITS = [
  'Chief', 'Air Operations Branch', 'Staging Area Manager',
  'Communications Unit', 'Medical Unit', 'Safety Officer',
]

const UNIT_TO_POSITION_KEY: Record<string, string[]> = {
  'Logistics Section': ['lsc'],
  'Supply Unit': ['lsc-spul'],
  'Communications Unit': ['lsc-coml'],
  'Facilities Unit': ['lsc-facl'],
  'Ground Support': ['lsc-gsul'],
  'Security Unit': [],
  'Finance/Administration Section': ['fasc'],
  'Time Unit': ['fasc-time'],
  'Procurement Unit': ['fasc-proc'],
  'Cost Unit': ['fasc-cost'],
  'Compensation/Claims Unit': ['fasc-comp'],
  'Planning Section': ['psc'],
  'Resources Unit': ['psc-resl'],
  'Situation Unit': ['psc-sitl'],
  'Documentation Unit': ['psc-docl'],
  'Demobilization Unit': ['psc-dmob'],
  'Operations Section': ['osc'],
  'Air Operations Branch': ['osc-aob'],
  'Staging Area Manager': ['osc-stam'],
  'Medical Unit': ['lsc-medl'],
  'Safety Officer': ['sofr'],
}

const SECTION_TO_POSITION_KEY: Record<string, string[]> = {
  'LOGISTICS SECTION': ['lsc'],
  'FINANCE/ADMINISTRATION SECTION': ['fasc'],
  'PLANNING SECTION': ['psc'],
  'OPERATIONS SECTION': ['osc'],
}

const makeUnits = (names: string[]): UnitSignoff[] =>
  names.map(unit_name => ({
    unit_name,
    checked: false,
    remarks: '',
    name: '',
    signature: '',
  }))

export default function Ics221Form() {
  const { id: incidentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [formId, setFormId] = useState<string | null>(null)
  const [incidentName, setIncidentName] = useState('')
  const [resourceToRelease, setResourceToRelease] = useState('')
  const [plannedReleaseDate, setPlannedReleaseDate] = useState('')
  const [plannedReleaseTime, setPlannedReleaseTime] = useState('')

  const [logisticsUnits, setLogisticsUnits] = useState<UnitSignoff[]>(makeUnits(LOGISTICS_UNITS))
  const [financeUnits, setFinanceUnits] = useState<UnitSignoff[]>(makeUnits(FINANCE_UNITS))
  const [planningUnits, setPlanningUnits] = useState<UnitSignoff[]>(makeUnits(PLANNING_UNITS))
  const [operationsUnits, setOperationsUnits] = useState<UnitSignoff[]>(makeUnits(OPERATIONS_UNITS))

  const [remarks, setRemarks] = useState('')
  const [forReassignment, setForReassignment] = useState(false)
  const [reassignmentIncident, setReassignmentIncident] = useState('')
  const [reassignmentLocation, setReassignmentLocation] = useState('')

  const [roomOvernight, setRoomOvernight] = useState(false)
  const [etd, setEtd] = useState('')
  const [destination, setDestination] = useState('')
  const [travelMethod, setTravelMethod] = useState('')
  const [manifest, setManifest] = useState(false)
  const [actualReleaseDate, setActualReleaseDate] = useState('')
  const [actualReleaseTime, setActualReleaseTime] = useState('')
  const [contactDetails, setContactDetails] = useState('')
  const [agencyNotified, setAgencyNotified] = useState('')

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
  const [positions203, setPositions203] = useState<Position203[]>([])

  const loadPositionsFrom203 = useCallback(async () => {
    if (!incidentId) return

    const { data: form203 } = await supabase
      .from('ics_203_forms')
      .select('id')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!form203) {
      setPositions203([])
      return
    }

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
      const { data: posData } = await supabase
        .from('ics_207_positions')
        .select('position_key, position_title, section, person_name')
        .eq('form_id', form207.id)
        .order('sort_order')

      if (posData) setPositions203(posData)
    }
  }, [incidentId])

  const lookupName = (unitName: string, sectionKey: string): string => {
    const keys = UNIT_TO_POSITION_KEY[unitName] || []
    for (const key of keys) {
      const pos = positions203.find(p => p.position_key === key)
      if (pos) return pos.person_name || 'N/A'
    }
    const sectionKeys = SECTION_TO_POSITION_KEY[sectionKey] || []
    for (const key of sectionKeys) {
      const pos = positions203.find(p => p.position_key === key)
      if (pos) return pos.person_name || 'N/A'
    }
    return 'N/A'
  }

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
        .from('ics_221_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    } else {
      const { data: existingForm } = await supabase
        .from('ics_221_forms')
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
      setResourceToRelease(formToLoad.resource_to_release)
      setPlannedReleaseDate(formToLoad.planned_release_date)
      setPlannedReleaseTime(formToLoad.planned_release_time)
      if (formToLoad.logistics_units?.length) setLogisticsUnits(formToLoad.logistics_units)
      if (formToLoad.finance_units?.length) setFinanceUnits(formToLoad.finance_units)
      if (formToLoad.planning_units?.length) setPlanningUnits(formToLoad.planning_units)
      if (formToLoad.operations_units?.length) setOperationsUnits(formToLoad.operations_units)
      setRemarks(formToLoad.remarks)
      setForReassignment(formToLoad.for_reassignment)
      setReassignmentIncident(formToLoad.reassignment_incident)
      setReassignmentLocation(formToLoad.reassignment_location)
      setRoomOvernight(formToLoad.room_overnight)
      setEtd(formToLoad.etd)
      setDestination(formToLoad.destination)
      setTravelMethod(formToLoad.travel_method)
      setManifest(formToLoad.manifest)
      setActualReleaseDate(formToLoad.actual_release_date)
      setActualReleaseTime(formToLoad.actual_release_time)
      setContactDetails(formToLoad.contact_details)
      setAgencyNotified(formToLoad.agency_notified)
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
    loadPositionsFrom203()
  }, [incidentId, user, searchParams, loadForm, loadPositionsFrom203])

  useEffect(() => {
    if (positions203.length === 0) return

    const updatedLogistics = logisticsUnits.map(u => ({
      ...u,
      name: u.name || lookupName(u.unit_name, 'LOGISTICS SECTION'),
    }))
    const updatedFinance = financeUnits.map(u => ({
      ...u,
      name: u.name || lookupName(u.unit_name, 'FINANCE/ADMINISTRATION SECTION'),
    }))
    const updatedPlanning = planningUnits.map(u => ({
      ...u,
      name: u.name || lookupName(u.unit_name, 'PLANNING SECTION'),
    }))
    const updatedOperations = operationsUnits.map(u => ({
      ...u,
      name: u.name || lookupName(u.unit_name, 'OPERATIONS SECTION'),
    }))

    const hasChanges =
      JSON.stringify(updatedLogistics) !== JSON.stringify(logisticsUnits) ||
      JSON.stringify(updatedFinance) !== JSON.stringify(financeUnits) ||
      JSON.stringify(updatedPlanning) !== JSON.stringify(planningUnits) ||
      JSON.stringify(updatedOperations) !== JSON.stringify(operationsUnits)

    if (hasChanges) {
      setLogisticsUnits(updatedLogistics)
      setFinanceUnits(updatedFinance)
      setPlanningUnits(updatedPlanning)
      setOperationsUnits(updatedOperations)
    }
  }, [positions203])

  const saveForm = async (formStatus: 'Draft' | 'Submitted') => {
    if (!incidentId || !user) return
    setSaving(true)
    setError('')
    setSuccess('')

    const now = new Date()
    const formData = {
      incident_id: incidentId,
      incident_name: incidentName,
      resource_to_release: resourceToRelease,
      planned_release_date: plannedReleaseDate,
      planned_release_time: plannedReleaseTime,
      logistics_units: logisticsUnits,
      finance_units: financeUnits,
      planning_units: planningUnits,
      operations_units: operationsUnits,
      remarks,
      for_reassignment: forReassignment,
      reassignment_incident: reassignmentIncident,
      reassignment_location: reassignmentLocation,
      room_overnight: roomOvernight,
      etd,
      destination,
      travel_method: travelMethod,
      manifest,
      actual_release_date: actualReleaseDate,
      actual_release_time: actualReleaseTime,
      contact_details: contactDetails,
      agency_notified: agencyNotified,
      prepared_by_name: preparedByName,
      prepared_by_sig: preparedBySig,
      prepared_date: formStatus === 'Submitted' ? now.toISOString().slice(0, 10) : preparedDate,
      prepared_time: formStatus === 'Submitted' ? now.toTimeString().slice(0, 5) : preparedTime,
      status: formStatus,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_221_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_221_forms')
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
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 221 submitted successfully!')
  }

  const updateUnit = (
    setter: React.Dispatch<React.SetStateAction<UnitSignoff[]>>,
    index: number,
    field: keyof UnitSignoff,
    value: string | boolean,
  ) => {
    setter(prev => prev.map((u, i) => i === index ? { ...u, [field]: value } : u))
  }

  if (loading) {
    return (
      <div className="ics221-page">
        <div className="ics221-loading">Loading ICS Form 221...</div>
      </div>
    )
  }

  const isReadonly = status === 'Submitted' && !isEditing

  const renderClearanceSection = (
    title: string,
    units: UnitSignoff[],
    setter: React.Dispatch<React.SetStateAction<UnitSignoff[]>>,
  ) => (
    <div className="clearance-section">
      <h3 className="section-title">{title}</h3>
      <div className="clearance-table-header">
        <div className="col-check"></div>
        <div className="col-unit">Unit/Manager</div>
        <div className="col-remarks">Remarks</div>
        <div className="col-name">Name</div>
        <div className="col-sig">Signature</div>
      </div>
      {units.map((unit, i) => (
        <div key={i} className="clearance-row">
          <div className="col-check">
            <input
              type="checkbox"
              checked={unit.checked}
              onChange={e => updateUnit(setter, i, 'checked', e.target.checked)}
              disabled={isReadonly}
            />
          </div>
          <div className="col-unit">{unit.unit_name}</div>
          <div className="col-remarks">
            <input
              type="text"
              value={unit.remarks}
              onChange={e => updateUnit(setter, i, 'remarks', e.target.value)}
              disabled={isReadonly}
            />
          </div>
          <div className="col-name">
            <input
              type="text"
              value={unit.name}
              onChange={e => updateUnit(setter, i, 'name', e.target.value)}
              disabled={isReadonly}
            />
          </div>
          <div className="col-sig">
            <input
              type="text"
              value={unit.signature}
              onChange={e => updateUnit(setter, i, 'signature', e.target.value)}
              disabled={isReadonly}
            />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="ics221-page">
      <header className="ics221-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics221-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
          <span className="form-badge">ICS 221</span>
          <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
        </div>
        <div className="topbar-actions">
          <button className="action-btn save" onClick={() => saveForm('Draft')} disabled={saving || isReadonly}>
            {saving ? 'Saving...' : 'Save Progress'}
          </button>
          <button className="action-btn submit" onClick={() => saveForm('Submitted')} disabled={saving || isReadonly}>
            Submit
          </button>
          {status === 'Submitted' && (
            <button className="action-btn edit" onClick={() => setIsEditing(true)} disabled={isEditing}>
              Edit
            </button>
          )}
          {status === 'Submitted' && (
            <button className="action-btn print" onClick={() => setShowPrint(true)}>
              Print
            </button>
          )}
        </div>
      </div>

      <main className="ics221-main">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="ics221-container">
          <div className="form-header-section">
            <h2>DEMOBILIZATION CHECK-OUT</h2>
            <h3>ICS 221</h3>
          </div>

          <div className="form-row three-col">
            <div className="form-field">
              <label>1. INCIDENT/EVENT NAME</label>
              <input type="text" value={incidentName} readOnly className="readonly" />
            </div>
            <div className="form-field">
              <label>2. RESOURCE TO BE RELEASED</label>
              <input
                type="text"
                value={resourceToRelease}
                onChange={e => setResourceToRelease(e.target.value)}
                disabled={isReadonly}
              />
            </div>
            <div className="form-field">
              <label>3. PLANNED RELEASE DATE AND TIME</label>
              <div className="op-period-row">
                <input
                  type="date"
                  value={plannedReleaseDate}
                  onChange={e => setPlannedReleaseDate(e.target.value)}
                  disabled={isReadonly}
                />
                <input
                  type="time"
                  value={plannedReleaseTime}
                  onChange={e => setPlannedReleaseTime(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
            </div>
          </div>

          <div className="form-section clearance-block">
            <label>4. CLEARANCE</label>
            <p className="clearance-desc">
              You and your resources are in the process of being released. Resources are not released until the checked boxes below have been signed off by the appropriate overhead and the Demobilization Unit Leader (or Planning Section representative).
            </p>

            {renderClearanceSection('LOGISTICS SECTION', logisticsUnits, setLogisticsUnits)}
            {renderClearanceSection('FINANCE/ADMINISTRATION SECTION', financeUnits, setFinanceUnits)}
            {renderClearanceSection('PLANNING SECTION', planningUnits, setPlanningUnits)}
            {renderClearanceSection('OPERATIONS SECTION', operationsUnits, setOperationsUnits)}
          </div>

          <div className="form-row two-col">
            <div className="form-section">
              <label>5. REMARKS</label>
              <textarea
                rows={5}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                disabled={isReadonly}
              />
            </div>
            <div className="form-section">
              <label>6. REASSIGNMENT INFORMATION</label>
              <div className="toggle-row">
                <span className="toggle-label-text">For reassignment?</span>
                <label className="toggle-label">
                  <input
                    type="radio"
                    name="reassignment"
                    checked={forReassignment}
                    onChange={() => setForReassignment(true)}
                    disabled={isReadonly}
                  /> Yes
                </label>
                <label className="toggle-label">
                  <input
                    type="radio"
                    name="reassignment"
                    checked={!forReassignment}
                    onChange={() => setForReassignment(false)}
                    disabled={isReadonly}
                  /> No
                </label>
              </div>
              <div className="form-field">
                <label>Name of Incident/Event</label>
                <input
                  type="text"
                  value={reassignmentIncident}
                  onChange={e => setReassignmentIncident(e.target.value)}
                  disabled={isReadonly || !forReassignment}
                />
              </div>
              <div className="form-field">
                <label>Location</label>
                <input
                  type="text"
                  value={reassignmentLocation}
                  onChange={e => setReassignmentLocation(e.target.value)}
                  disabled={isReadonly || !forReassignment}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <label>7. TRAVEL INFORMATION</label>
            <div className="travel-grid">
              <div className="form-field">
                <label>Room overnight?</label>
                <div className="toggle-row">
                  <label className="toggle-label">
                    <input
                      type="radio"
                      name="room"
                      checked={roomOvernight}
                      onChange={() => setRoomOvernight(true)}
                      disabled={isReadonly}
                    /> Yes
                  </label>
                  <label className="toggle-label">
                    <input
                      type="radio"
                      name="room"
                      checked={!roomOvernight}
                      onChange={() => setRoomOvernight(false)}
                      disabled={isReadonly}
                    /> No
                  </label>
                </div>
              </div>
              <div className="form-field">
                <label>Estimated Time of Departure</label>
                <input
                  type="time"
                  value={etd}
                  onChange={e => setEtd(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
              <div className="form-field">
                <label>Destination</label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
              <div className="form-field">
                <label>Travel Method</label>
                <select
                  value={travelMethod}
                  onChange={e => setTravelMethod(e.target.value)}
                  disabled={isReadonly}
                >
                  <option value="">Select...</option>
                  <option value="Land">Land</option>
                  <option value="Air">Air</option>
                  <option value="Water">Water</option>
                </select>
              </div>
              <div className="form-field">
                <label>Manifest (from ICS 211)?</label>
                <div className="toggle-row">
                  <label className="toggle-label">
                    <input
                      type="radio"
                      name="manifest"
                      checked={manifest}
                      onChange={() => setManifest(true)}
                      disabled={isReadonly}
                    /> Yes
                  </label>
                  <label className="toggle-label">
                    <input
                      type="radio"
                      name="manifest"
                      checked={!manifest}
                      onChange={() => setManifest(false)}
                      disabled={isReadonly}
                    /> No
                  </label>
                </div>
              </div>
              <div className="form-field">
                <label>Actual Release Date and Time</label>
                <div className="op-period-row">
                  <input
                    type="date"
                    value={actualReleaseDate}
                    onChange={e => setActualReleaseDate(e.target.value)}
                    disabled={isReadonly}
                  />
                  <input
                    type="time"
                    value={actualReleaseTime}
                    onChange={e => setActualReleaseTime(e.target.value)}
                    disabled={isReadonly}
                  />
                </div>
              </div>
              <div className="form-field">
                <label>Contact Details</label>
                <input
                  type="text"
                  value={contactDetails}
                  onChange={e => setContactDetails(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
              <div className="form-field">
                <label>Agency/Office Notified</label>
                <input
                  type="text"
                  value={agencyNotified}
                  onChange={e => setAgencyNotified(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
            </div>
          </div>

          <div className="form-section signature-section">
            <div className="sig-row">
              <div className="sig-field num">8. Prepared by DMOB</div>
              <div className="sig-field">
                <label>Name and Signature:</label>
                <input
                  type="text"
                  value={preparedByName}
                  onChange={e => setPreparedByName(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
              <div className="sig-field">
                <label>Date Prepared:</label>
                <input
                  type="date"
                  value={preparedDate}
                  onChange={e => setPreparedDate(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
              <div className="sig-field">
                <label>Time Prepared:</label>
                <input
                  type="time"
                  value={preparedTime}
                  onChange={e => setPreparedTime(e.target.value)}
                  disabled={isReadonly}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {showPrint && (
        <Ics221Print
          incidentName={incidentName}
          resourceToRelease={resourceToRelease}
          plannedReleaseDate={plannedReleaseDate}
          plannedReleaseTime={plannedReleaseTime}
          logisticsUnits={logisticsUnits}
          financeUnits={financeUnits}
          planningUnits={planningUnits}
          operationsUnits={operationsUnits}
          remarks={remarks}
          forReassignment={forReassignment}
          reassignmentIncident={reassignmentIncident}
          reassignmentLocation={reassignmentLocation}
          roomOvernight={roomOvernight}
          etd={etd}
          destination={destination}
          travelMethod={travelMethod}
          manifest={manifest}
          actualReleaseDate={actualReleaseDate}
          actualReleaseTime={actualReleaseTime}
          contactDetails={contactDetails}
          agencyNotified={agencyNotified}
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
