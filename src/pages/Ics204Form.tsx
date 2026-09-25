import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  OPS_POSITIONS,
  emptyOpsPersonnel,
  emptyCommsRow,
  emptyResourceRow,
  load205Comms,
  load215AMitigating,
  loadOscName,
} from '../lib/ics204'
import type { Ics204RowInput } from '../lib/ics204'
import type { Ics204CommsRow, Ics204OpsPerson } from '../lib/types'
import Ics204Print from './Ics204Print'
import './Ics204Form.css'

export default function Ics204Form() {
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

  const [branch, setBranch] = useState('')
  const [groupName, setGroupName] = useState('')
  const [division, setDivision] = useState('')
  const [stagingArea, setStagingArea] = useState('')

  const [opsPersonnel, setOpsPersonnel] = useState<Ics204OpsPerson[]>(emptyOpsPersonnel())
  const [resourceRows, setResourceRows] = useState<Ics204RowInput[]>([emptyResourceRow()])
  const [specificWorkAssignment, setSpecificWorkAssignment] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [comms, setComms] = useState<Ics204CommsRow[]>([emptyCommsRow()])

  const [preparedByName, setPreparedByName] = useState('')
  const [preparedBySig, setPreparedBySig] = useState('')
  const [preparedDate, setPreparedDate] = useState('')
  const [preparedTime, setPreparedTime] = useState('')

  const [status, setStatus] = useState<'Draft' | 'Submitted'>('Draft')
  const [has202, setHas202] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchingSafety, setFetchingSafety] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPrint, setShowPrint] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const isReadonly = status === 'Submitted' && !isEditing

  const loadForm = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)
    setError('')

    const formParam = searchParams.get('form')

    // Wave 1: incident name + operational period (parallel)
    const [incidentRes, form202] = await Promise.all([
      supabase.from('incidents').select('name').eq('incident_id', incidentId).single(),
      supabase
        .from('ics_202_forms')
        .select('op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (incidentRes.data) setIncidentName(incidentRes.data.name)

    const op202 = form202.data
    setHas202(!!op202)

    if (formParam) {
      // Wave 2: the instance + its resource rows (form_id is already known)
      const [formRes, rowsRes] = await Promise.all([
        supabase.from('ics_204_forms').select('*').eq('id', formParam).single(),
        supabase.from('ics_204_rows').select('*').eq('form_id', formParam).order('sort_order'),
      ])
      const form = formRes.data
      if (!form) {
        setError('Assignment list not found.')
        setLoading(false)
        return
      }

      setFormId(form.id)
      setIncidentName(form.incident_name || incidentRes.data?.name || '')
      setOpFromDate(form.op_period_from_date || op202?.op_period_from_date || '')
      setOpFromTime(form.op_period_from_time || op202?.op_period_from_time || '')
      setOpToDate(form.op_period_to_date || op202?.op_period_to_date || '')
      setOpToTime(form.op_period_to_time || op202?.op_period_to_time || '')
      setBranch(form.branch || '')
      setGroupName(form.group_name || '')
      setDivision(form.division || '')
      setStagingArea(form.staging_area || '')

      // Normalize stored personnel back onto the five fixed positions
      const stored: Ics204OpsPerson[] = Array.isArray(form.ops_personnel) ? form.ops_personnel : []
      const byPos = new Map(stored.map((p) => [p.position, p]))
      setOpsPersonnel(
        OPS_POSITIONS.map((pos, i) => {
          const s = byPos.get(pos) || stored[i]
          return { position: pos, name: s?.name || '', contact: s?.contact || '' }
        }),
      )

      setSpecificWorkAssignment(form.specific_work_assignment || '')
      setSpecialInstructions(form.special_instructions || '')
      setComms(Array.isArray(form.comms) && form.comms.length > 0 ? form.comms : [emptyCommsRow()])

      setPreparedByName(form.prepared_by_name || '')
      setPreparedBySig(form.prepared_by_sig || '')
      setPreparedDate(form.prepared_date || '')
      setPreparedTime(form.prepared_time || '')
      setStatus(form.status || 'Draft')

      const rows = rowsRes.data ?? []
      setResourceRows(
        rows.length > 0
          ? rows.map(({ id: _id, form_id: _fid, ...rest }) => rest)
          : [emptyResourceRow()],
      )
    } else {
      // New instance: prefill op period from 202, OSC from the org chart, comms from 205
      if (op202) {
        setOpFromDate(op202.op_period_from_date || '')
        setOpFromTime(op202.op_period_from_time || '')
        setOpToDate(op202.op_period_to_date || '')
        setOpToTime(op202.op_period_to_time || '')
      }
      const [oscName, commsRows] = await Promise.all([
        loadOscName(incidentId),
        load205Comms(incidentId),
      ])
      if (oscName) {
        setOpsPersonnel((prev) =>
          prev.map((p) => (p.position === 'Operations Section Chief' ? { ...p, name: oscName } : p)),
        )
      }
      if (commsRows.length > 0) setComms(commsRows)
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

  const updateResourceRow = (index: number, field: keyof Ics204RowInput, value: string | boolean) => {
    setResourceRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }
  const addResourceRow = () =>
    setResourceRows((prev) => [...prev, { ...emptyResourceRow(), sort_order: prev.length }])
  const removeResourceRow = (index: number) =>
    setResourceRows((prev) => prev.filter((_, i) => i !== index))

  const updateCommsRow = (index: number, field: keyof Ics204CommsRow, value: string) => {
    setComms((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)))
  }
  const addCommsRow = () => setComms((prev) => [...prev, emptyCommsRow()])
  const removeCommsRow = (index: number) => setComms((prev) => prev.filter((_, i) => i !== index))

  const updateOpsPerson = (position: string, field: 'name' | 'contact', value: string) => {
    setOpsPersonnel((prev) => prev.map((p) => (p.position === position ? { ...p, [field]: value } : p)))
  }

  const handleFetchSafety = async () => {
    if (!incidentId || isReadonly || fetchingSafety) return
    setFetchingSafety(true)
    setError('')
    setSuccess('')
    const label = division || groupName || branch
    const text = await load215AMitigating(incidentId, label)
    setFetchingSafety(false)

    if (!text) {
      setError('No mitigating measures were found in ICS 215A for this incident.')
      return
    }
    if (specialInstructions.trim()) {
      if (!confirm('Replace the current special instructions with the measures from ICS 215A?')) return
    }
    setSpecialInstructions(text)
    setSuccess('Safety measures loaded from ICS 215A.')
  }

  const saveForm = async (formStatus: 'Draft' | 'Submitted') => {
    if (!incidentId || !user) return

    if (!branch.trim() && !groupName.trim() && !division.trim()) {
      setError('Enter a Branch, Group, or Division to identify this assignment list.')
      return
    }

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
      branch,
      group_name: groupName,
      division,
      staging_area: stagingArea,
      ops_personnel: opsPersonnel,
      specific_work_assignment: specificWorkAssignment,
      special_instructions: specialInstructions,
      comms,
      prepared_by_name: preparedByName,
      prepared_by_sig: preparedBySig,
      prepared_date: formStatus === 'Submitted' ? localDate : preparedDate,
      prepared_time: formStatus === 'Submitted' ? localTime : preparedTime,
      status: formStatus,
      updated_at: now.toISOString(),
    }

    let fId = formId
    if (fId) {
      const { error: updateError } = await supabase.from('ics_204_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_204_forms')
        .insert(formData)
        .select()
        .single()
      if (insertError) { setError(insertError.message); setSaving(false); return }
      fId = inserted.id
      setFormId(fId)
    }

    // Section 5 rows: wipe + reinsert (same pattern as ICS 205/207)
    const { error: delError } = await supabase.from('ics_204_rows').delete().eq('form_id', fId)
    if (delError) { setError(delError.message); setSaving(false); return }

    const rowsToSave = resourceRows.filter(
      (r) =>
        r.trans_needed ||
        r.resource_identifier || r.leader_name || r.contact_numbers ||
        r.personnel || r.drop_off || r.pick_up_time || r.remarks,
    )
    if (rowsToSave.length > 0) {
      const { error: rowError } = await supabase
        .from('ics_204_rows')
        .insert(rowsToSave.map((r, i) => ({ form_id: fId!, ...r, sort_order: i })))
      if (rowError) { setError(rowError.message); setSaving(false); return }
    }

    setSaving(false)
    setStatus(formStatus)
    setIsEditing(false)
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 204 submitted successfully!')
  }

  const instanceLabel = division || groupName || branch

  if (loading) {
    return (
      <div className="ics204-page">
        <div className="ics204-loading">Loading ICS Form 204...</div>
      </div>
    )
  }

  return (
    <div className="ics204-page">
      <header className="ics204-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics204-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}/ics-204`)}>&larr; Back</button>
          <span className="form-badge">ICS 204</span>
          {instanceLabel && <span className="instance-badge">{instanceLabel}</span>}
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

      <main className="ics204-main no-print">
        <div className="ics204-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-header-section">
            <h2>ASSIGNMENT LIST</h2>
            <h3>ICS 204</h3>
          </div>

          {!has202 && (
            <div className="warning-message">
              Please indicate the operational period using ICS form 202.
            </div>
          )}

          <div className="form-row two-col">
            <div className="form-field">
              <label>1. INCIDENT/EVENT NAME</label>
              <input type="text" value={incidentName} readOnly className="readonly" />
            </div>
            <div className="form-field">
              <label>2. OPERATIONAL PERIOD</label>
              <div className="op-period-grid">
                <div>
                  <label>From:</label>
                  <input type="date" value={opFromDate} onChange={(e) => setOpFromDate(e.target.value)} disabled={isReadonly} />
                  <input type="time" value={opFromTime} onChange={(e) => setOpFromTime(e.target.value)} disabled={isReadonly} />
                </div>
                <div>
                  <label>To:</label>
                  <input type="date" value={opToDate} onChange={(e) => setOpToDate(e.target.value)} disabled={isReadonly} />
                  <input type="time" value={opToTime} onChange={(e) => setOpToTime(e.target.value)} disabled={isReadonly} />
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <label>3. BRANCH / GROUP / DIVISION / STAGING AREA</label>
            <div className="bvd-grid">
              <div className="form-field">
                <label>Branch</label>
                <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} disabled={isReadonly} placeholder="Branch" />
              </div>
              <div className="form-field">
                <label>Group</label>
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} disabled={isReadonly} placeholder="Group" />
              </div>
              <div className="form-field">
                <label>Division</label>
                <input type="text" value={division} onChange={(e) => setDivision(e.target.value)} disabled={isReadonly} placeholder="Division" />
              </div>
              <div className="form-field">
                <label>Staging Area</label>
                <input type="text" value={stagingArea} onChange={(e) => setStagingArea(e.target.value)} disabled={isReadonly} placeholder="Staging Area" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <label>4. OPERATIONS PERSONNEL</label>
            <div className="ops-grid">
              <div className="ops-row ops-head">
                <span>Position</span>
                <span>Name</span>
                <span>Contact Number(s)</span>
              </div>
              {opsPersonnel.map((p) => (
                <div className="ops-row" key={p.position}>
                  <span className="ops-position">{p.position}</span>
                  <input
                    type="text"
                    value={p.name}
                    placeholder="Name"
                    disabled={isReadonly}
                    onChange={(e) => updateOpsPerson(p.position, 'name', e.target.value)}
                  />
                  <input
                    type="text"
                    value={p.contact}
                    placeholder="Contact Number(s)"
                    disabled={isReadonly}
                    onChange={(e) => updateOpsPerson(p.position, 'contact', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label>5. RESOURCES ASSIGNED FOR THIS PERIOD</label>
            <div className="ics204-table-wrapper">
              <table className="ics204-resources-table">
                <thead>
                  <tr>
                    <th>Resource Identifier</th>
                    <th>Name of Leader</th>
                    <th>Contact Numbers</th>
                    <th>No. of Personnel</th>
                    <th>Trans. Needed?</th>
                    <th>Drop-off Point &amp; Time</th>
                    <th>Pick-up Time</th>
                    <th>Remarks</th>
                    {!isReadonly && <th className="actions-col"></th>}
                  </tr>
                </thead>
                <tbody>
                  {resourceRows.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <input value={r.resource_identifier} disabled={isReadonly} onChange={(e) => updateResourceRow(i, 'resource_identifier', e.target.value)} />
                      </td>
                      <td>
                        <input value={r.leader_name} disabled={isReadonly} onChange={(e) => updateResourceRow(i, 'leader_name', e.target.value)} />
                      </td>
                      <td>
                        <input value={r.contact_numbers} disabled={isReadonly} onChange={(e) => updateResourceRow(i, 'contact_numbers', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min="0" value={r.personnel} disabled={isReadonly} onChange={(e) => updateResourceRow(i, 'personnel', e.target.value)} />
                      </td>
                      <td className="trans-cell">
                        <input
                          type="checkbox"
                          checked={r.trans_needed}
                          disabled={isReadonly}
                          onChange={(e) => updateResourceRow(i, 'trans_needed', e.target.checked)}
                          title="Transportation needed"
                        />
                      </td>
                      <td>
                        <input value={r.drop_off} disabled={isReadonly} onChange={(e) => updateResourceRow(i, 'drop_off', e.target.value)} />
                      </td>
                      <td>
                        <input value={r.pick_up_time} disabled={isReadonly} onChange={(e) => updateResourceRow(i, 'pick_up_time', e.target.value)} />
                      </td>
                      <td>
                        <input value={r.remarks} disabled={isReadonly} onChange={(e) => updateResourceRow(i, 'remarks', e.target.value)} />
                      </td>
                      {!isReadonly && (
                        <td className="actions-cell">
                          <button className="remove-row-btn" onClick={() => removeResourceRow(i)}>&times;</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isReadonly && (
              <div className="add-row-buttons">
                <button className="add-row-btn" onClick={addResourceRow}>+ Add Resource</button>
              </div>
            )}
          </div>

          <div className="form-section">
            <label>6. SPECIFIC WORK ASSIGNMENT</label>
            <textarea
              className="ics204-textarea"
              rows={7}
              value={specificWorkAssignment}
              disabled={isReadonly}
              onChange={(e) => setSpecificWorkAssignment(e.target.value)}
              placeholder="Enter the specific work assignment..."
            />
          </div>

          <div className="form-section">
            <div className="section-title-row">
              <label>7. SPECIAL INSTRUCTIONS / SAFETY MEASURES</label>
              {!isReadonly && (
                <button className="fetch-btn" onClick={handleFetchSafety} disabled={fetchingSafety}>
                  {fetchingSafety ? 'Loading...' : 'Fetch from ICS 215A'}
                </button>
              )}
            </div>
            <textarea
              className="ics204-textarea"
              rows={7}
              value={specialInstructions}
              disabled={isReadonly}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Special instructions and safety measures, or fetch them from ICS 215A..."
            />
          </div>

          <div className="form-section">
            <label>8. COMMUNICATIONS SUMMARY</label>
            <div className="ics204-table-wrapper">
              <table className="ics204-comms-table">
                <thead>
                  <tr>
                    <th>Function</th>
                    <th>System</th>
                    <th>Channel</th>
                    <th>Frequency</th>
                    <th>Others (mobile, satellite phone, etc.)</th>
                    {!isReadonly && <th className="actions-col"></th>}
                  </tr>
                </thead>
                <tbody>
                  {comms.map((c, i) => (
                    <tr key={i}>
                      <td><input value={c.function} disabled={isReadonly} onChange={(e) => updateCommsRow(i, 'function', e.target.value)} /></td>
                      <td><input value={c.system} disabled={isReadonly} onChange={(e) => updateCommsRow(i, 'system', e.target.value)} /></td>
                      <td><input value={c.channel} disabled={isReadonly} onChange={(e) => updateCommsRow(i, 'channel', e.target.value)} /></td>
                      <td><input value={c.frequency} disabled={isReadonly} onChange={(e) => updateCommsRow(i, 'frequency', e.target.value)} /></td>
                      <td><input value={c.others} disabled={isReadonly} onChange={(e) => updateCommsRow(i, 'others', e.target.value)} /></td>
                      {!isReadonly && (
                        <td className="actions-cell">
                          <button className="remove-row-btn" onClick={() => removeCommsRow(i)}>&times;</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isReadonly && (
              <div className="add-row-buttons">
                <button className="add-row-btn" onClick={addCommsRow}>+ Add Channel</button>
              </div>
            )}
          </div>

          <div className="form-section signature-section">
            <div className="sig-row">
              <div className="sig-field num">9. Prepared by RESL</div>
              <div className="sig-field">
                <label>Name and Signature:</label>
                <input type="text" value={preparedByName} onChange={(e) => setPreparedByName(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Date Prepared:</label>
                <input type="date" value={preparedDate} onChange={(e) => setPreparedDate(e.target.value)} disabled={isReadonly} />
              </div>
              <div className="sig-field">
                <label>Time Prepared:</label>
                <input type="time" value={preparedTime} onChange={(e) => setPreparedTime(e.target.value)} disabled={isReadonly} />
              </div>
            </div>
          </div>

        </div>
      </main>

      {showPrint && (
        <Ics204Print
          incidentName={incidentName}
          opFromDate={opFromDate}
          opFromTime={opFromTime}
          opToDate={opToDate}
          opToTime={opToTime}
          branch={branch}
          groupName={groupName}
          division={division}
          stagingArea={stagingArea}
          opsPersonnel={opsPersonnel}
          resourceRows={resourceRows}
          specificWorkAssignment={specificWorkAssignment}
          specialInstructions={specialInstructions}
          comms={comms}
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
