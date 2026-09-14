import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { generateCheckinId } from '../lib/utils'
import type { CheckinPersonnel, CheckinVehicle, CheckinEquipment } from '../lib/types'
import './CheckInForm.css'

const emptyLeader: Omit<CheckinPersonnel, 'id' | 'manifest_id'> = {
  role: 'Leader', name: '', age: '', gender: '', weight: '', contact_details: '', capabilities: '', others: '',
}
const emptyMember: Omit<CheckinPersonnel, 'id' | 'manifest_id'> = {
  role: 'Member', name: '', age: '', gender: '', weight: '', contact_details: '', capabilities: '', others: '',
}
const emptyVehicle: Omit<CheckinVehicle, 'id' | 'manifest_id'> = {
  vehicle_id: '', operator_name: '', kind: '', type: '', method_of_travel: '', plate_number: '', fuel_type: '', weight: '', contact_details: '', capabilities: '', others: '',
}
const emptyEquipment: Omit<CheckinEquipment, 'id' | 'manifest_id'> = {
  equipment_id: '', operator_name: '', kind: '', type: '', source_of_power: '', fuel_type: '', weight: '', contact_details: '', capabilities: '', others: '',
}

export default function CheckInForm() {
  const { id: incidentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [checkinId, setCheckinId] = useState('')
  const [manifestId, setManifestId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [agencyName, setAgencyName] = useState('')
  const [totalPersonnel, setTotalPersonnel] = useState(0)
  const [totalVehicles, setTotalVehicles] = useState(0)
  const [totalEquipment, setTotalEquipment] = useState(0)
  const [others, setOthers] = useState('')
  const [preparedByName, setPreparedByName] = useState('')

  const [leader, setLeader] = useState<Omit<CheckinPersonnel, 'id' | 'manifest_id'>>(emptyLeader)
  const [members, setMembers] = useState<Omit<CheckinPersonnel, 'id' | 'manifest_id'>[]>([])
  const [vehicles, setVehicles] = useState<Omit<CheckinVehicle, 'id' | 'manifest_id'>[]>([])
  const [equipment, setEquipment] = useState<Omit<CheckinEquipment, 'id' | 'manifest_id'>[]>([])

  const landCount = vehicles.filter((v) => v.method_of_travel === 'Land').length
  const waterCount = vehicles.filter((v) => v.method_of_travel === 'Water').length
  const airCount = vehicles.filter((v) => v.method_of_travel === 'Air').length

  useEffect(() => {
    if (!user) return
    setPreparedByName(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    loadOrInitManifest()
  }, [incidentId, user, searchParams])

  const loadOrInitManifest = async () => {
    if (!incidentId || !user) return
    setLoading(true)

    const manifestParam = searchParams.get('manifest')

    let existing = null

    if (manifestParam) {
      const { data } = await supabase
        .from('checkin_manifests')
        .select('*')
        .eq('id', manifestParam)
        .eq('incident_id', incidentId)
        .single()
      existing = data
    } else {
      const { data } = await supabase
        .from('checkin_manifests')
        .select('*')
        .eq('incident_id', incidentId)
        .eq('user_id', user.id)
        .eq('status', 'Draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      existing = data
    }

    if (existing) {
      setManifestId(existing.id)
      setCheckinId(existing.checkin_id)
      setAgencyName(existing.agency_name)
      setTotalPersonnel(existing.total_personnel)
      setTotalVehicles(existing.total_vehicles)
      setTotalEquipment(existing.total_equipment)
      setOthers(existing.others)
      setPreparedByName(existing.prepared_by_name)

      const { data: personnel } = await supabase.from('checkin_personnel').select('*').eq('manifest_id', existing.id)
      if (personnel) {
        const l = personnel.find((p) => p.role === 'Leader')
        if (l) setLeader({ role: 'Leader', name: l.name, age: l.age, gender: l.gender, weight: l.weight, contact_details: l.contact_details, capabilities: l.capabilities, others: l.others })
        setMembers(personnel.filter((p) => p.role === 'Member').map(({ id: _id, manifest_id: _mid, ...rest }) => rest))
      }

      const { data: veh } = await supabase.from('checkin_vehicles').select('*').eq('manifest_id', existing.id)
      if (veh) setVehicles(veh.map(({ id: _id, manifest_id: _mid, ...rest }) => rest))

      const { data: eq } = await supabase.from('checkin_equipment').select('*').eq('manifest_id', existing.id)
      if (eq) setEquipment(eq.map(({ id: _id, manifest_id: _mid, ...rest }) => rest))
    } else {
      setCheckinId(generateCheckinId())
    }

    setLoading(false)
  }

  const updateMember = (index: number, field: string, value: string) => {
    const updated = [...members]
    updated[index] = { ...updated[index], [field]: value }
    setMembers(updated)
  }

  const addMember = () => setMembers([...members, { ...emptyMember }])
  const removeMember = (index: number) => setMembers(members.filter((_, i) => i !== index))

  const updateVehicle = (index: number, field: string, value: string) => {
    const updated = [...vehicles]
    updated[index] = { ...updated[index], [field]: value }
    setVehicles(updated)
  }

  const addVehicle = () => setVehicles([...vehicles, { ...emptyVehicle }])
  const removeVehicle = (index: number) => setVehicles(vehicles.filter((_, i) => i !== index))

  const updateEquipment = (index: number, field: string, value: string) => {
    const updated = [...equipment]
    updated[index] = { ...updated[index], [field]: value }
    setEquipment(updated)
  }

  const addEquipment = () => setEquipment([...equipment, { ...emptyEquipment }])
  const removeEquipment = (index: number) => setEquipment(equipment.filter((_, i) => i !== index))

  const saveManifest = async (status: 'Draft' | 'Submitted') => {
    if (!incidentId || !user) return
    setSaving(true)
    setError('')
    setSuccess('')

    const manifestData = {
      incident_id: incidentId,
      user_id: user.id,
      user_name: preparedByName,
      agency_name: agencyName,
      total_personnel: 1 + members.length,
      total_vehicles: vehicles.length,
      total_equipment: equipment.length,
      others,
      prepared_by_name: preparedByName,
      prepared_by_timestamp: status === 'Submitted' ? new Date().toISOString() : null,
      status,
      updated_at: new Date().toISOString(),
    }

    let mId = manifestId

    if (mId) {
      const { error: updateError } = await supabase.from('checkin_manifests').update(manifestData).eq('id', mId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('checkin_manifests')
        .insert({ ...manifestData, checkin_id: checkinId })
        .select()
        .single()
      if (insertError) { setError(insertError.message); setSaving(false); return }
      mId = inserted.id
      setManifestId(mId)
    }

    await supabase.from('checkin_personnel').delete().eq('manifest_id', mId)
    await supabase.from('checkin_vehicles').delete().eq('manifest_id', mId)
    await supabase.from('checkin_equipment').delete().eq('manifest_id', mId)

    const personnelRows = [
      { manifest_id: mId, ...leader },
      ...members.map((m) => ({ manifest_id: mId!, ...m })),
    ]
    if (personnelRows.length > 0) {
      await supabase.from('checkin_personnel').insert(personnelRows)
    }

    const vehicleRows = vehicles.map((v) => ({ manifest_id: mId!, ...v }))
    if (vehicleRows.length > 0) {
      await supabase.from('checkin_vehicles').insert(vehicleRows)
    }

    const equipmentRows = equipment.map((e) => ({ manifest_id: mId!, ...e }))
    if (equipmentRows.length > 0) {
      await supabase.from('checkin_equipment').insert(equipmentRows)
    }

    if (status === 'Submitted') {
      await supabase.from('incident_participants').update({ checked_in: true }).eq('incident_id', incidentId).eq('user_id', user.id).eq('status', 'Active')
    }

    setSaving(false)
    setSuccess(status === 'Draft' ? 'Progress saved as draft.' : 'Check-in manifest submitted successfully!')

    if (status === 'Submitted') {
      setTimeout(() => navigate(`/incident/${incidentId}/checkin/view`), 1000)
    }
  }

  if (loading) {
    return (
      <div className="checkin-page">
        <div className="checkin-loading">Loading check-in form...</div>
      </div>
    )
  }

  return (
    <div className="checkin-page">
      <header className="checkin-header">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="checkin-topbar">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="checkin-id-badge">{checkinId}</span>
          <span className="incident-ref-badge">{incidentId}</span>
        </div>
      </div>

      <main className="checkin-main">
        <div className="checkin-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <section className="form-section">
            <h3>Agency Information</h3>
            <div className="form-group">
              <label>Name of Agency / Office / Home Base</label>
              <input type="text" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Enter agency name" />
            </div>
          </section>

          <section className="form-section">
            <h3>Personnel</h3>
            <div className="form-group">
              <label>Total Number of Personnel</label>
              <input type="number" min="0" value={totalPersonnel} onChange={(e) => setTotalPersonnel(parseInt(e.target.value) || 0)} />
            </div>

            <h4>Leader</h4>
            <div className="personnel-row">
              <input placeholder="Name" value={leader.name} onChange={(e) => setLeader({ ...leader, name: e.target.value })} />
              <input placeholder="Age" value={leader.age} onChange={(e) => setLeader({ ...leader, age: e.target.value })} />
              <select value={leader.gender} onChange={(e) => setLeader({ ...leader, gender: e.target.value })}>
                <option value="">Gender</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
              <input placeholder="Weight" value={leader.weight} onChange={(e) => setLeader({ ...leader, weight: e.target.value })} />
              <input placeholder="Contact Details" value={leader.contact_details} onChange={(e) => setLeader({ ...leader, contact_details: e.target.value })} />
              <input placeholder="Capabilities/Specialization" value={leader.capabilities} onChange={(e) => setLeader({ ...leader, capabilities: e.target.value })} />
              <input placeholder="Others" value={leader.others} onChange={(e) => setLeader({ ...leader, others: e.target.value })} />
            </div>

            <h4>Members</h4>
            {members.map((m, i) => (
              <div key={i} className="personnel-row">
                <input placeholder="Name" value={m.name} onChange={(e) => updateMember(i, 'name', e.target.value)} />
                <input placeholder="Age" value={m.age} onChange={(e) => updateMember(i, 'age', e.target.value)} />
                <select value={m.gender} onChange={(e) => updateMember(i, 'gender', e.target.value)}>
                  <option value="">Gender</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
                <input placeholder="Weight" value={m.weight} onChange={(e) => updateMember(i, 'weight', e.target.value)} />
                <input placeholder="Contact Details" value={m.contact_details} onChange={(e) => updateMember(i, 'contact_details', e.target.value)} />
                <input placeholder="Capabilities/Specialization" value={m.capabilities} onChange={(e) => updateMember(i, 'capabilities', e.target.value)} />
                <input placeholder="Others" value={m.others} onChange={(e) => updateMember(i, 'others', e.target.value)} />
                <button className="remove-row-btn" onClick={() => removeMember(i)}>&times;</button>
              </div>
            ))}
            <button className="add-row-btn" onClick={addMember}>+ Add Member</button>
          </section>

          <section className="form-section">
            <h3>Vehicles</h3>
            <div className="form-group">
              <label>Total Number of Vehicles</label>
              <input type="number" min="0" value={totalVehicles} onChange={(e) => setTotalVehicles(parseInt(e.target.value) || 0)} />
            </div>
            <div className="vehicle-counts">
              <div className="vehicle-count-item"><label>Land</label><span className="count-value">{landCount}</span></div>
              <div className="vehicle-count-item"><label>Water</label><span className="count-value">{waterCount}</span></div>
              <div className="vehicle-count-item"><label>Air</label><span className="count-value">{airCount}</span></div>
            </div>

            {vehicles.map((v, i) => (
              <div key={i} className="vehicle-row">
                <input placeholder="Name of Operator" value={v.operator_name} onChange={(e) => updateVehicle(i, 'operator_name', e.target.value)} />
                <input placeholder="Kind (e.g. Ambulance, Boat)" value={v.kind} onChange={(e) => updateVehicle(i, 'kind', e.target.value)} />
                <input placeholder="Type" value={v.type} onChange={(e) => updateVehicle(i, 'type', e.target.value)} />
                <select value={v.method_of_travel} onChange={(e) => updateVehicle(i, 'method_of_travel', e.target.value)}>
                  <option value="">Method of Travel</option>
                  <option value="Land">Land</option>
                  <option value="Water">Water</option>
                  <option value="Air">Air</option>
                </select>
                <input placeholder="Plate Number" value={v.plate_number} onChange={(e) => updateVehicle(i, 'plate_number', e.target.value)} />
                <select value={v.fuel_type} onChange={(e) => updateVehicle(i, 'fuel_type', e.target.value)}>
                  <option value="">Fuel Type</option><option>Gasoline</option><option>Diesel</option><option>Kerosene</option><option>EV</option><option>Others</option>
                </select>
                <input placeholder="Weight" value={v.weight} onChange={(e) => updateVehicle(i, 'weight', e.target.value)} />
                <input placeholder="Contact Details" value={v.contact_details} onChange={(e) => updateVehicle(i, 'contact_details', e.target.value)} />
                <input placeholder="Capabilities/Specialization" value={v.capabilities} onChange={(e) => updateVehicle(i, 'capabilities', e.target.value)} />
                <input placeholder="Others" value={v.others} onChange={(e) => updateVehicle(i, 'others', e.target.value)} />
                <button className="remove-row-btn" onClick={() => removeVehicle(i)}>&times;</button>
              </div>
            ))}
            <button className="add-row-btn" onClick={addVehicle}>+ Add Vehicle</button>
          </section>

          <section className="form-section">
            <h3>Equipment</h3>
            <div className="form-group">
              <label>Total Number of Equipment</label>
              <input type="number" min="0" value={totalEquipment} onChange={(e) => setTotalEquipment(parseInt(e.target.value) || 0)} />
            </div>

            {equipment.map((eq, i) => (
              <div key={i} className="equipment-row">
                <input placeholder="Name of Operator" value={eq.operator_name} onChange={(e) => updateEquipment(i, 'operator_name', e.target.value)} />
                <input placeholder="Kind" value={eq.kind} onChange={(e) => updateEquipment(i, 'kind', e.target.value)} />
                <input placeholder="Type" value={eq.type} onChange={(e) => updateEquipment(i, 'type', e.target.value)} />
                <input placeholder="Source of Power" value={eq.source_of_power} onChange={(e) => updateEquipment(i, 'source_of_power', e.target.value)} />
                <select value={eq.fuel_type} onChange={(e) => updateEquipment(i, 'fuel_type', e.target.value)}>
                  <option value="">Fuel Type</option><option>Gasoline</option><option>Diesel</option><option>Kerosene</option><option>Battery</option><option>Solar</option><option>Others</option><option>N/A</option>
                </select>
                <input placeholder="Weight" value={eq.weight} onChange={(e) => updateEquipment(i, 'weight', e.target.value)} />
                <input placeholder="Contact Details" value={eq.contact_details} onChange={(e) => updateEquipment(i, 'contact_details', e.target.value)} />
                <input placeholder="Capabilities/Specialization" value={eq.capabilities} onChange={(e) => updateEquipment(i, 'capabilities', e.target.value)} />
                <input placeholder="Others" value={eq.others} onChange={(e) => updateEquipment(i, 'others', e.target.value)} />
                <button className="remove-row-btn" onClick={() => removeEquipment(i)}>&times;</button>
              </div>
            ))}
            <button className="add-row-btn" onClick={addEquipment}>+ Add Equipment</button>
          </section>

          <section className="form-section">
            <h3>Others</h3>
            <textarea value={others} onChange={(e) => setOthers(e.target.value)} placeholder="Additional information..." rows={4} />
          </section>

          <div className="form-actions">
            <button className="action-btn back" onClick={() => navigate(`/incident/${incidentId}`)} disabled={saving}>Back</button>
            <button className="action-btn save" onClick={() => saveManifest('Draft')} disabled={saving}>
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
            <button className="action-btn submit" onClick={() => saveManifest('Submitted')} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
