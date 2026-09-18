import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics209Print from './Ics209Print'
import './Ics209Form.css'

interface ClusterRow {
  cluster: string
  status: string
}

interface StatusRow {
  description: string
  opPeriod: string
  totalCases: string
  casesResponded: string
  totalResponded: string
  remaining: string
  remarks: string
}

interface ResourceRow {
  agency: string
  kind: string
  number: string
  additionalPersonnel: string
  totalPersonnel: string
  remarks: string
}

const DEFAULT_CLUSTERS = [
  'Food and Non-Food Items',
  'HEALTH (WASH, Health, Nutrition and Psychological Services)',
  'Protection',
  'Camp Coordination and Management',
  'Logistics',
  'Emergency Telecommunications',
  'Education',
  'Search, Rescue and Retrieval',
  'Management of the Dead and the Missing',
  'Law and Order',
  'International Humanitarian Assistance',
]

const DEFAULT_STATUS_DESCRIPTIONS = [
  'Dead',
  'Injured',
  'Missing',
  'Needs treatment/immunization',
  'Needs evacuation',
  'Others',
]

const THREAT_CHECKBOXES = [
  'No likely threat',
  'Potential Future Threat',
  'Mass notification in progress',
  'Mass notification completed',
  'No evacuation imminent',
  'Planning for evacuation',
  'Evacuation in progress',
  'Planning for shelter-in-place',
  'Shelter-in-place in progress',
  'Repopulation in progress',
  'Mass immunization in progress',
  'Mass immunization complete',
  'Quarantine in progress',
  'Area restriction in effect',
]

function emptyStatusRow(description: string): StatusRow {
  return { description, opPeriod: '', totalCases: '', casesResponded: '', totalResponded: '', remaining: '', remarks: '' }
}

function emptyResourceRow(): ResourceRow {
  return { agency: '', kind: '', number: '', additionalPersonnel: '', totalPersonnel: '', remarks: '' }
}

export default function Ics209Form() {
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

  const [reportNo, setReportNo] = useState(1)
  const [reportType, setReportType] = useState<'Initial' | 'Update' | 'Final'>('Initial')

  const [preparedByName, setPreparedByName] = useState('')
  const [preparedBySig, setPreparedBySig] = useState('')
  const [preparedDate, setPreparedDate] = useState('')
  const [preparedTime, setPreparedTime] = useState('')
  const [approvedByName, setApprovedByName] = useState('')
  const [approvedBySig, setApprovedBySig] = useState('')
  const [approvedDate, setApprovedDate] = useState('')
  const [approvedTime, setApprovedTime] = useState('')

  const [generalDescription, setGeneralDescription] = useState('')
  const [policyGuidance, setPolicyGuidance] = useState('')
  const [objectives, setObjectives] = useState('')

  const [addressLocation, setAddressLocation] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [gpsCoordinates, setGpsCoordinates] = useState('')
  const [landmarks, setLandmarks] = useState('')

  const [significantEvents, setSignificantEvents] = useState('')
  const [clusterAssessment, setClusterAssessment] = useState<ClusterRow[]>(
    DEFAULT_CLUSTERS.map(c => ({ cluster: c, status: '' }))
  )

  const [publicStatus, setPublicStatus] = useState<StatusRow[]>(
    DEFAULT_STATUS_DESCRIPTIONS.map(d => emptyStatusRow(d))
  )
  const [respondersStatus, setRespondersStatus] = useState<StatusRow[]>(
    DEFAULT_STATUS_DESCRIPTIONS.map(d => emptyStatusRow(d))
  )

  const [threatManagement, setThreatManagement] = useState<Record<string, boolean>>(
    Object.fromEntries(THREAT_CHECKBOXES.map(c => [c, false]))
  )
  const [threatOthers, setThreatOthers] = useState(false)
  const [threatOthersText, setThreatOthersText] = useState('')
  const [weatherConcerns, setWeatherConcerns] = useState('')

  const [escalation12h, setEscalation12h] = useState('')
  const [escalation24h, setEscalation24h] = useState('')
  const [escalation48h, setEscalation48h] = useState('')
  const [escalation72h, setEscalation72h] = useState('')
  const [escalationAfter72h, setEscalationAfter72h] = useState('')

  const [threatsRisk12h, setThreatsRisk12h] = useState('')
  const [threatsRisk24h, setThreatsRisk24h] = useState('')
  const [threatsRisk48h, setThreatsRisk48h] = useState('')
  const [threatsRisk72h, setThreatsRisk72h] = useState('')
  const [threatsRiskAfter72h, setThreatsRiskAfter72h] = useState('')

  const [criticalResources12h, setCriticalResources12h] = useState('')
  const [criticalResources24h, setCriticalResources24h] = useState('')
  const [criticalResources48h, setCriticalResources48h] = useState('')
  const [criticalResources72h, setCriticalResources72h] = useState('')
  const [criticalResourcesAfter72h, setCriticalResourcesAfter72h] = useState('')

  const [plannedActions, setPlannedActions] = useState('')
  const [otherConcerns, setOtherConcerns] = useState('')
  const [anticipatedCosts, setAnticipatedCosts] = useState('')
  const [projectedCosts, setProjectedCosts] = useState('')

  const [resources, setResources] = useState<ResourceRow[]>([emptyResourceRow()])
  const [assistingAgencies, setAssistingAgencies] = useState<string[]>([''])

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
    setPreparedByName(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    setPreparedDate(now.toISOString().slice(0, 10))
    setPreparedTime(now.toTimeString().slice(0, 5))
    loadForm()
  }, [incidentId, user, searchParams])

  const loadForm = async () => {
    if (!incidentId) return
    setLoading(true)

    const { data: incident } = await supabase
      .from('incidents')
      .select('name, location')
      .eq('incident_id', incidentId)
      .single()
    if (incident) {
      setIncidentName(incident.name)
      setAddressLocation(incident.location || '')
    }

    const { data: form202 } = await supabase
      .from('ics_202_forms')
      .select('op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time, objectives')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (form202) {
      setOpFromDate(form202.op_period_from_date || '')
      setOpFromTime(form202.op_period_from_time || '')
      setOpToDate(form202.op_period_to_date || '')
      setOpToTime(form202.op_period_to_time || '')
      if (form202.objectives) setObjectives(form202.objectives)
    }

    const { count } = await supabase
      .from('ics_209_forms')
      .select('id', { count: 'exact', head: true })
      .eq('incident_id', incidentId)
    setReportNo((count || 0) + 1)

    const formParam = searchParams.get('form')
    let formToLoad = null

    if (formParam) {
      const { data: form } = await supabase
        .from('ics_209_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    } else {
      const { data: existingForm } = await supabase
        .from('ics_209_forms')
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
      setReportNo(formToLoad.report_no)
      setReportType(formToLoad.report_type)
      setPreparedByName(formToLoad.prepared_by_name)
      setPreparedBySig(formToLoad.prepared_by_sig)
      setPreparedDate(formToLoad.prepared_date)
      setPreparedTime(formToLoad.prepared_time)
      setApprovedByName(formToLoad.approved_by_name)
      setApprovedBySig(formToLoad.approved_by_sig)
      setApprovedDate(formToLoad.approved_date)
      setApprovedTime(formToLoad.approved_time)
      setGeneralDescription(formToLoad.general_description)
      setPolicyGuidance(formToLoad.policy_guidance)
      setObjectives(formToLoad.objectives)
      setAddressLocation(formToLoad.address_location)
      setJurisdiction(formToLoad.jurisdiction)
      setGpsCoordinates(formToLoad.gps_coordinates)
      setLandmarks(formToLoad.landmarks)
      setSignificantEvents(formToLoad.significant_events)

      if (formToLoad.cluster_assessment && Array.isArray(formToLoad.cluster_assessment)) {
        setClusterAssessment(formToLoad.cluster_assessment)
      }
      if (formToLoad.public_status && Array.isArray(formToLoad.public_status)) {
        setPublicStatus(formToLoad.public_status)
      }
      if (formToLoad.responders_status && Array.isArray(formToLoad.responders_status)) {
        setRespondersStatus(formToLoad.responders_status)
      }
      if (formToLoad.threat_management && typeof formToLoad.threat_management === 'object') {
        const tm = formToLoad.threat_management
        setThreatManagement(prev => {
          const updated = { ...prev }
          for (const key of Object.keys(updated)) {
            updated[key] = tm[key] || false
          }
          return updated
        })
        setThreatOthers(tm._others || false)
        setThreatOthersText(tm._othersText || '')
      }

      setWeatherConcerns(formToLoad.weather_concerns)
      setEscalation12h(formToLoad.escalation_12h)
      setEscalation24h(formToLoad.escalation_24h)
      setEscalation48h(formToLoad.escalation_48h)
      setEscalation72h(formToLoad.escalation_72h)
      setEscalationAfter72h(formToLoad.escalation_after72h)
      setThreatsRisk12h(formToLoad.threats_risk_12h)
      setThreatsRisk24h(formToLoad.threats_risk_24h)
      setThreatsRisk48h(formToLoad.threats_risk_48h)
      setThreatsRisk72h(formToLoad.threats_risk_72h)
      setThreatsRiskAfter72h(formToLoad.threats_risk_after72h)
      setCriticalResources12h(formToLoad.critical_resources_12h)
      setCriticalResources24h(formToLoad.critical_resources_24h)
      setCriticalResources48h(formToLoad.critical_resources_48h)
      setCriticalResources72h(formToLoad.critical_resources_72h)
      setCriticalResourcesAfter72h(formToLoad.critical_resources_after72h)
      setPlannedActions(formToLoad.planned_actions)
      setOtherConcerns(formToLoad.other_concerns)
      setAnticipatedCosts(formToLoad.anticipated_costs)
      setProjectedCosts(formToLoad.projected_costs)

      if (formToLoad.resources && Array.isArray(formToLoad.resources)) {
        setResources(formToLoad.resources)
      }
      if (formToLoad.assisting_agencies && Array.isArray(formToLoad.assisting_agencies)) {
        setAssistingAgencies(formToLoad.assisting_agencies)
      }

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
      op_period_from_date: opFromDate,
      op_period_from_time: opFromTime,
      op_period_to_date: opToDate,
      op_period_to_time: opToTime,
      report_no: reportNo,
      report_type: reportType,
      prepared_by_name: preparedByName,
      prepared_by_sig: preparedBySig,
      prepared_date: formStatus === 'Submitted' ? now.toISOString().slice(0, 10) : preparedDate,
      prepared_time: formStatus === 'Submitted' ? now.toTimeString().slice(0, 5) : preparedTime,
      approved_by_name: approvedByName,
      approved_by_sig: approvedBySig,
      approved_date: approvedDate,
      approved_time: approvedTime,
      general_description: generalDescription,
      policy_guidance: policyGuidance,
      objectives,
      address_location: addressLocation,
      jurisdiction,
      gps_coordinates: gpsCoordinates,
      landmarks,
      significant_events: significantEvents,
      cluster_assessment: clusterAssessment,
      public_status: publicStatus,
      responders_status: respondersStatus,
      threat_management: { ...threatManagement, _others: threatOthers, _othersText: threatOthersText },
      weather_concerns: weatherConcerns,
      escalation_12h: escalation12h,
      escalation_24h: escalation24h,
      escalation_48h: escalation48h,
      escalation_72h: escalation72h,
      escalation_after72h: escalationAfter72h,
      threats_risk_12h: threatsRisk12h,
      threats_risk_24h: threatsRisk24h,
      threats_risk_48h: threatsRisk48h,
      threats_risk_72h: threatsRisk72h,
      threats_risk_after72h: threatsRiskAfter72h,
      critical_resources_12h: criticalResources12h,
      critical_resources_24h: criticalResources24h,
      critical_resources_48h: criticalResources48h,
      critical_resources_72h: criticalResources72h,
      critical_resources_after72h: criticalResourcesAfter72h,
      planned_actions: plannedActions,
      other_concerns: otherConcerns,
      anticipated_costs: anticipatedCosts,
      projected_costs: projectedCosts,
      resources,
      assisting_agencies: assistingAgencies,
      status: formStatus,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_209_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_209_forms')
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
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 209 submitted successfully!')
  }

  if (loading) {
    return (
      <div className="ics209-page">
        <div className="ics209-loading">Loading ICS Form 209...</div>
      </div>
    )
  }

  const isReadonly = status === 'Submitted' && !isEditing

  const updateCluster = (idx: number, field: keyof ClusterRow, value: string) => {
    setClusterAssessment(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }
  const addCluster = () => setClusterAssessment(prev => [...prev, { cluster: '', status: '' }])
  const removeCluster = (idx: number) => setClusterAssessment(prev => prev.filter((_, i) => i !== idx))

  const updatePublicStatus = (idx: number, field: keyof StatusRow, value: string) => {
    setPublicStatus(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }
  const addPublicStatus = () => setPublicStatus(prev => [...prev, emptyStatusRow('')])
  const removePublicStatus = (idx: number) => setPublicStatus(prev => prev.filter((_, i) => i !== idx))

  const updateRespondersStatus = (idx: number, field: keyof StatusRow, value: string) => {
    setRespondersStatus(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }
  const addRespondersStatus = () => setRespondersStatus(prev => [...prev, emptyStatusRow('')])
  const removeRespondersStatus = (idx: number) => setRespondersStatus(prev => prev.filter((_, i) => i !== idx))

  const updateResource = (idx: number, field: keyof ResourceRow, value: string) => {
    setResources(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const updated = { ...r, [field]: value }
      const num = parseInt(updated.number) || 0
      const add = parseInt(updated.additionalPersonnel) || 0
      updated.totalPersonnel = String(num + add)
      return updated
    }))
  }
  const addResource = () => setResources(prev => [...prev, emptyResourceRow()])
  const removeResource = (idx: number) => setResources(prev => prev.filter((_, i) => i !== idx))

  const totalResources = resources.reduce((sum, r) => sum + (parseInt(r.totalPersonnel) || 0), 0)

  return (
    <div className="ics209-page">
      <header className="ics209-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics209-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="form-badge">ICS 209</span>
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

      <main className="ics209-main no-print">
        <div className="ics209-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>INCIDENT STATUS SUMMARY</h2>
            <h3>ICS 209</h3>
          </div>

          {/* Section 1-3: Header fields */}
          <div className="form-section">
            <div className="form-row three-col">
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
              <div className="form-field">
                <label>3. REPORT NO</label>
                <input type="text" value={String(reportNo).padStart(3, '0')} readOnly className="readonly" />
                <div className="report-type-row">
                  {(['Initial', 'Update', 'Final'] as const).map(t => (
                    <label key={t} className="report-type-label">
                      <input
                        type="radio"
                        name="reportType"
                        checked={reportType === t}
                        onChange={() => setReportType(t)}
                        disabled={isReadonly}
                      /> {t}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4-5: Signatures */}
          <div className="form-section signature-section">
            <div className="sig-row">
              <div className="sig-field num">4. PREPARED BY SITL</div>
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
            <div className="sig-row">
              <div className="sig-field num">5. APPROVED BY IC</div>
              <div className="sig-field">
                <label>Name and Signature:</label>
                <input type="text" value={approvedByName} onChange={e => setApprovedByName(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Date Approved:</label>
                <input type="date" value={approvedDate} onChange={e => setApprovedDate(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Time Approved:</label>
                <input type="time" value={approvedTime} onChange={e => setApprovedTime(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
          </div>

          {/* Section 6: Incident/Event Details */}
          <div className="form-section">
            <label>6. INCIDENT/EVENT DETAILS</label>
            <div className="form-field">
              <label>6.a. General Description of the Incident/Event</label>
              <textarea className="large" value={generalDescription} onChange={e => setGeneralDescription(e.target.value)} disabled={isReadonly} />
            </div>
            <div className="form-field" style={{ marginTop: 12 }}>
              <label>6.b. Policy Guidance from the Responsible Official</label>
              <textarea className="large" value={policyGuidance} onChange={e => setPolicyGuidance(e.target.value)} disabled={isReadonly} />
            </div>
            <div className="form-field" style={{ marginTop: 12 }}>
              <label>6.c. Objectives for the Operational Period</label>
              <textarea className="large" value={objectives} onChange={e => setObjectives(e.target.value)} disabled={isReadonly} />
            </div>
          </div>

          {/* Section 7: Location Information */}
          <div className="form-section">
            <label>7. INCIDENT/EVENT LOCATION INFORMATION</label>
            <div className="form-field">
              <label>7.a. Address/Location</label>
              <input type="text" value={addressLocation} onChange={e => setAddressLocation(e.target.value)} disabled={isReadonly} />
            </div>
            <div className="form-row three-col" style={{ marginTop: 12 }}>
              <div className="form-field">
                <label>7.b. Jurisdiction</label>
                <input type="text" value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="form-field">
                <label>7.c. GPS Coordinates (if any)</label>
                <input type="text" value={gpsCoordinates} onChange={e => setGpsCoordinates(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="form-field">
                <label>7.d. Landmarks</label>
                <input type="text" value={landmarks} onChange={e => setLandmarks(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
          </div>

          {/* Section 8: Incident/Event Summary */}
          <div className="form-section">
            <label>8. INCIDENT/EVENT SUMMARY</label>
            <div className="form-field">
              <label>8.a. Significant Events during the Operational Period</label>
              <textarea className="large" value={significantEvents} onChange={e => setSignificantEvents(e.target.value)} disabled={isReadonly} />
            </div>
          </div>

          {/* 8.b. Cluster Assessment */}
          <div className="form-section">
            <label>8.b. Cluster Assessment (Fill as appropriate)</label>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Cluster</th>
                  <th>Status</th>
                  {!isReadonly && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {clusterAssessment.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        value={row.cluster}
                        onChange={e => updateCluster(idx, 'cluster', e.target.value)}
                        disabled={isReadonly}
                        placeholder="Cluster name"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.status}
                        onChange={e => updateCluster(idx, 'status', e.target.value)}
                        disabled={isReadonly}
                        placeholder="Status"
                      />
                    </td>
                    {!isReadonly && (
                      <td>
                        <button className="remove-row-btn" onClick={() => removeCluster(idx)}>&times;</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!isReadonly && (
              <button className="add-row-btn" onClick={addCluster}>+ Add Cluster</button>
            )}
          </div>

          {/* Public Status Summary */}
          <div className="form-section">
            <label>Public Status Summary</label>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>No. of cases for this operational period</th>
                    <th>Total Cases</th>
                    <th>No. of cases responded</th>
                    <th>Total Cases of Responded</th>
                    <th>Remaining Cases</th>
                    <th>Remarks</th>
                    {!isReadonly && <th style={{ width: 40 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {publicStatus.map((row, idx) => (
                    <tr key={idx}>
                      <td><input type="text" value={row.description} onChange={e => updatePublicStatus(idx, 'description', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.opPeriod} onChange={e => updatePublicStatus(idx, 'opPeriod', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.totalCases} onChange={e => updatePublicStatus(idx, 'totalCases', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.casesResponded} onChange={e => updatePublicStatus(idx, 'casesResponded', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.totalResponded} onChange={e => updatePublicStatus(idx, 'totalResponded', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.remaining} onChange={e => updatePublicStatus(idx, 'remaining', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.remarks} onChange={e => updatePublicStatus(idx, 'remarks', e.target.value)} disabled={isReadonly} /></td>
                      {!isReadonly && (
                        <td><button className="remove-row-btn" onClick={() => removePublicStatus(idx)}>&times;</button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isReadonly && (
              <button className="add-row-btn" onClick={addPublicStatus}>+ Add Row</button>
            )}
          </div>

          {/* Responders Status Summary */}
          <div className="form-section">
            <label>Responders Status Summary</label>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>No. of cases for this operational period</th>
                    <th>Total Cases</th>
                    <th>No. of cases responded</th>
                    <th>Total Cases of Responded</th>
                    <th>Remaining Cases</th>
                    <th>Remarks</th>
                    {!isReadonly && <th style={{ width: 40 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {respondersStatus.map((row, idx) => (
                    <tr key={idx}>
                      <td><input type="text" value={row.description} onChange={e => updateRespondersStatus(idx, 'description', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.opPeriod} onChange={e => updateRespondersStatus(idx, 'opPeriod', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.totalCases} onChange={e => updateRespondersStatus(idx, 'totalCases', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.casesResponded} onChange={e => updateRespondersStatus(idx, 'casesResponded', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.totalResponded} onChange={e => updateRespondersStatus(idx, 'totalResponded', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.remaining} onChange={e => updateRespondersStatus(idx, 'remaining', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.remarks} onChange={e => updateRespondersStatus(idx, 'remarks', e.target.value)} disabled={isReadonly} /></td>
                      {!isReadonly && (
                        <td><button className="remove-row-btn" onClick={() => removeRespondersStatus(idx)}>&times;</button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isReadonly && (
              <button className="add-row-btn" onClick={addRespondersStatus}>+ Add Row</button>
            )}
          </div>

          {/* Life, Safety and Health Threat Management */}
          <div className="form-section">
            <label>Life, Safety and Health Threat Management (Check if active)</label>
            <div className="checkbox-grid">
              {THREAT_CHECKBOXES.map(cb => (
                <label key={cb} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={threatManagement[cb] || false}
                    onChange={e => setThreatManagement(prev => ({ ...prev, [cb]: e.target.checked }))}
                    disabled={isReadonly}
                  /> {cb}
                </label>
              ))}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={threatOthers}
                  onChange={e => setThreatOthers(e.target.checked)}
                  disabled={isReadonly}
                /> Others - specify:
              </label>
            </div>
            {threatOthers && (
              <div className="form-field" style={{ marginTop: 8 }}>
                <input type="text" value={threatOthersText} onChange={e => setThreatOthersText(e.target.value)} disabled={isReadonly} placeholder="Specify others" />
              </div>
            )}
          </div>

          {/* Weather Concerns */}
          <div className="form-section">
            <label>Weather Concerns</label>
            <textarea className="medium" value={weatherConcerns} onChange={e => setWeatherConcerns(e.target.value)} disabled={isReadonly} />
          </div>

          {/* Potential Incident Escalation */}
          <div className="form-section">
            <label>Potential Incident Escalation</label>
            <div className="timeframe-row">
              <span className="timeframe-label">12 hours:</span>
              <textarea value={escalation12h} onChange={e => setEscalation12h(e.target.value)} disabled={isReadonly} rows={2} />
            </div>
            <div className="timeframe-row">
              <span className="timeframe-label">24 hours:</span>
              <textarea value={escalation24h} onChange={e => setEscalation24h(e.target.value)} disabled={isReadonly} rows={2} />
            </div>
            <div className="timeframe-row">
              <span className="timeframe-label">48 hours:</span>
              <textarea value={escalation48h} onChange={e => setEscalation48h(e.target.value)} disabled={isReadonly} rows={2} />
            </div>
            <div className="timeframe-row">
              <span className="timeframe-label">72 hours:</span>
              <textarea value={escalation72h} onChange={e => setEscalation72h(e.target.value)} disabled={isReadonly} rows={2} />
            </div>
            <div className="timeframe-row">
              <span className="timeframe-label">After 72 hours:</span>
              <textarea value={escalationAfter72h} onChange={e => setEscalationAfter72h(e.target.value)} disabled={isReadonly} rows={2} />
            </div>
          </div>

          {/* Section 9: Additional Decision Support */}
          <div className="form-section">
            <label>9. ADDITIONAL INCIDENT/EVENT DECISION SUPPORT</label>

            <div className="sub-section">
              <div className="sub-section-title">Threats and Risk Information</div>
              <div className="timeframe-row">
                <span className="timeframe-label">12 hours:</span>
                <textarea value={threatsRisk12h} onChange={e => setThreatsRisk12h(e.target.value)} disabled={isReadonly} rows={2} />
              </div>
              <div className="timeframe-row">
                <span className="timeframe-label">24 hours:</span>
                <textarea value={threatsRisk24h} onChange={e => setThreatsRisk24h(e.target.value)} disabled={isReadonly} rows={2} />
              </div>
              <div className="timeframe-row">
                <span className="timeframe-label">48 hours:</span>
                <textarea value={threatsRisk48h} onChange={e => setThreatsRisk48h(e.target.value)} disabled={isReadonly} rows={2} />
              </div>
              <div className="timeframe-row">
                <span className="timeframe-label">72 hours:</span>
                <textarea value={threatsRisk72h} onChange={e => setThreatsRisk72h(e.target.value)} disabled={isReadonly} rows={2} />
              </div>
              <div className="timeframe-row">
                <span className="timeframe-label">After 72 hours:</span>
                <textarea value={threatsRiskAfter72h} onChange={e => setThreatsRiskAfter72h(e.target.value)} disabled={isReadonly} rows={2} />
              </div>
            </div>

            <div className="sub-section">
              <div className="sub-section-title">Critical Resource Needs</div>
              <div className="timeframe-row">
                <span className="timeframe-label">12 hours:</span>
                <textarea value={criticalResources12h} onChange={e => setCriticalResources12h(e.target.value)} disabled={isReadonly} rows={2} />
              </div>
              <div className="timeframe-row">
                <span className="timeframe-label">24 hours:</span>
                <textarea value={criticalResources24h} onChange={e => setCriticalResources24h(e.target.value)} disabled={isReadonly} rows={2} />
              </div>
              <div className="timeframe-row">
                <span className="timeframe-label">48 hours:</span>
                <textarea value={criticalResources48h} onChange={e => setCriticalResources48h(e.target.value)} disabled={isReadonly} rows={2} />
              </div>
              <div className="timeframe-row">
                <span className="timeframe-label">72 hours:</span>
                <textarea value={criticalResources72h} onChange={e => setCriticalResources72h(e.target.value)} disabled={isReadonly} rows={2} />
              </div>
              <div className="timeframe-row">
                <span className="timeframe-label">After 72 hours:</span>
                <textarea value={criticalResourcesAfter72h} onChange={e => setCriticalResourcesAfter72h(e.target.value)} disabled={isReadonly} rows={2} />
              </div>
            </div>

            <div className="sub-section">
              <div className="sub-section-title">Planned Actions for Next Operational Period</div>
              <textarea className="large" value={plannedActions} onChange={e => setPlannedActions(e.target.value)} disabled={isReadonly} />
            </div>

            <div className="sub-section">
              <div className="sub-section-title">Other Concerns</div>
              <textarea className="large" value={otherConcerns} onChange={e => setOtherConcerns(e.target.value)} disabled={isReadonly} />
            </div>

            <div className="costs-row" style={{ marginTop: 12 }}>
              <div className="form-field">
                <label>Anticipated Incident Costs to Date</label>
                <input type="text" value={anticipatedCosts} onChange={e => setAnticipatedCosts(e.target.value)} disabled={isReadonly} placeholder="e.g., PHP 500,000" />
              </div>
              <div className="form-field">
                <label>Projected Final Incident Cost Estimate</label>
                <input type="text" value={projectedCosts} onChange={e => setProjectedCosts(e.target.value)} disabled={isReadonly} placeholder="e.g., PHP 1,200,000" />
              </div>
            </div>
          </div>

          {/* Section 10: Resource Summary */}
          <div className="form-section">
            <label>10. RESOURCE SUMMARY</label>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Agency/Office</th>
                    <th>Kind</th>
                    <th>Number</th>
                    <th>Additional Personnel not assigned to a resource</th>
                    <th>Total Personnel</th>
                    <th>Remarks</th>
                    {!isReadonly && <th style={{ width: 40 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {resources.map((row, idx) => (
                    <tr key={idx}>
                      <td><input type="text" value={row.agency} onChange={e => updateResource(idx, 'agency', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.kind} onChange={e => updateResource(idx, 'kind', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.number} onChange={e => updateResource(idx, 'number', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.additionalPersonnel} onChange={e => updateResource(idx, 'additionalPersonnel', e.target.value)} disabled={isReadonly} /></td>
                      <td><input type="text" value={row.totalPersonnel} readOnly className="readonly" /></td>
                      <td><input type="text" value={row.remarks} onChange={e => updateResource(idx, 'remarks', e.target.value)} disabled={isReadonly} /></td>
                      {!isReadonly && (
                        <td><button className="remove-row-btn" onClick={() => removeResource(idx)}>&times;</button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 700 }}>Total Resources</td>
                    <td style={{ fontWeight: 700 }}>{totalResources}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {!isReadonly && (
              <button className="add-row-btn" onClick={addResource}>+ Add Resource</button>
            )}
          </div>

          {/* Section 11: Assisting Agencies */}
          <div className="form-section">
            <label>11. LIST OF ASSISTING AND COOPERATING AGENCIES</label>
            {assistingAgencies.map((agency, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={agency}
                  onChange={e => setAssistingAgencies(prev => prev.map((a, i) => i === idx ? e.target.value : a))}
                  disabled={isReadonly}
                  placeholder="Agency name"
                  style={{ flex: 1 }}
                />
                {!isReadonly && (
                  <button className="remove-row-btn" onClick={() => setAssistingAgencies(prev => prev.filter((_, i) => i !== idx))}>&times;</button>
                )}
              </div>
            ))}
            {!isReadonly && (
              <button className="add-row-btn" onClick={() => setAssistingAgencies(prev => [...prev, ''])}>+ Add Agency</button>
            )}
          </div>

        </div>
      </main>

      {showPrint && (
        <Ics209Print
          incidentName={incidentName}
          opFromDate={opFromDate}
          opFromTime={opFromTime}
          opToDate={opToDate}
          opToTime={opToTime}
          reportNo={reportNo}
          reportType={reportType}
          preparedByName={preparedByName}
          preparedBySig={preparedBySig}
          preparedDate={preparedDate}
          preparedTime={preparedTime}
          approvedByName={approvedByName}
          approvedBySig={approvedBySig}
          approvedDate={approvedDate}
          approvedTime={approvedTime}
          generalDescription={generalDescription}
          policyGuidance={policyGuidance}
          objectives={objectives}
          addressLocation={addressLocation}
          jurisdiction={jurisdiction}
          gpsCoordinates={gpsCoordinates}
          landmarks={landmarks}
          significantEvents={significantEvents}
          clusterAssessment={clusterAssessment}
          publicStatus={publicStatus}
          respondersStatus={respondersStatus}
          threatManagement={threatManagement}
          threatOthers={threatOthers}
          threatOthersText={threatOthersText}
          weatherConcerns={weatherConcerns}
          escalation12h={escalation12h}
          escalation24h={escalation24h}
          escalation48h={escalation48h}
          escalation72h={escalation72h}
          escalationAfter72h={escalationAfter72h}
          threatsRisk12h={threatsRisk12h}
          threatsRisk24h={threatsRisk24h}
          threatsRisk48h={threatsRisk48h}
          threatsRisk72h={threatsRisk72h}
          threatsRiskAfter72h={threatsRiskAfter72h}
          criticalResources12h={criticalResources12h}
          criticalResources24h={criticalResources24h}
          criticalResources48h={criticalResources48h}
          criticalResources72h={criticalResources72h}
          criticalResourcesAfter72h={criticalResourcesAfter72h}
          plannedActions={plannedActions}
          otherConcerns={otherConcerns}
          anticipatedCosts={anticipatedCosts}
          projectedCosts={projectedCosts}
          resources={resources}
          assistingAgencies={assistingAgencies}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
