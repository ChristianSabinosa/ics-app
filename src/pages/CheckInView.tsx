import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMilitaryTime } from '../lib/utils'
import type { CheckinManifest, CheckinPersonnel, CheckinVehicle, CheckinEquipment } from '../lib/types'
import CheckInPrint from './CheckInPrint'
import { useFormAccess } from '../components/FormAccess'
import { isOfflinePath, getOperatorId } from '../lib/offline/mode'
import { offGet, offAll, offChildren } from '../lib/offline/store'
import type { OfflineRow } from '../lib/offline/db'
import './CheckInView.css'

export default function CheckInView() {
  const { id: incidentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canEdit } = useFormAccess()

  // Offline Mode (/offline/...): same page, local IndexedDB store, no auth.
  const offMode = isOfflinePath(useLocation().pathname)
  const homePath = offMode ? `/offline/${incidentId}` : `/incident/${incidentId}`

  const [manifest, setManifest] = useState<CheckinManifest | null>(null)
  const [personnel, setPersonnel] = useState<CheckinPersonnel[]>([])
  const [vehicles, setVehicles] = useState<CheckinVehicle[]>([])
  const [equipment, setEquipment] = useState<CheckinEquipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  const fetchManifest = useCallback(async () => {
    setLoading(true)
    const manifestId = searchParams.get('manifest')

    if (offMode) {
      if (!incidentId) { setLoading(false); return }
      let m: OfflineRow | undefined
      if (manifestId) {
        const found = await offGet('checkin_manifests', manifestId)
        m = found && found.incident_id === incidentId ? found : undefined
      } else {
        const mine = (await offAll('checkin_manifests', incidentId))
          .filter((r) => r.user_id === getOperatorId())
          .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        m = mine[0]
      }

      if (!m) {
        setError('No check-in manifest found.')
        setLoading(false)
        return
      }

      const mid = m.id as string
      const withIds = <T,>(rows: OfflineRow[]) =>
        rows.map((r) => ({ ...r, id: String(r.id ?? r._key) })) as unknown as T[]

      setManifest(m as unknown as CheckinManifest)
      setPersonnel(withIds<CheckinPersonnel>(await offChildren('checkin_personnel', mid)))
      setVehicles(withIds<CheckinVehicle>(await offChildren('checkin_vehicles', mid)))
      setEquipment(withIds<CheckinEquipment>(await offChildren('checkin_equipment', mid)))
      setLoading(false)
      return
    }

    let query = supabase
      .from('checkin_manifests')
      .select('*')
      .eq('incident_id', incidentId)

    if (manifestId) {
      query = query.eq('id', manifestId)
    } else {
      query = query
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
    }

    const { data: m, error: me } = await query.single()

    if (me || !m) {
      setError('No check-in manifest found.')
      setLoading(false)
      return
    }

    setManifest(m)

    const { data: p } = await supabase.from('checkin_personnel').select('*').eq('manifest_id', m.id)
    if (p) setPersonnel(p)

    const { data: v } = await supabase.from('checkin_vehicles').select('*').eq('manifest_id', m.id)
    if (v) setVehicles(v)

    const { data: e } = await supabase.from('checkin_equipment').select('*').eq('manifest_id', m.id)
    if (e) setEquipment(e)

    setLoading(false)
  }, [incidentId, user, searchParams, offMode])

  useEffect(() => {
    fetchManifest()
  }, [fetchManifest])

  if (loading) {
    return (
      <div className="checkin-view-page">
        <div className="checkin-loading">Loading manifest...</div>
      </div>
    )
  }

  if (error || !manifest) {
    return (
      <div className="checkin-view-page">
        <div className="checkin-error">
          <p>{error || 'Manifest not found.'}</p>
          <button onClick={() => navigate(homePath)}>Back to Incident</button>
        </div>
      </div>
    )
  }

  const leader = personnel.find((p) => p.role === 'Leader')
  const members = personnel.filter((p) => p.role === 'Member')
  const landVehicles = vehicles.filter((v) => v.method_of_travel === 'Land').length
  const waterVehicles = vehicles.filter((v) => v.method_of_travel === 'Water').length
  const airVehicles = vehicles.filter((v) => v.method_of_travel === 'Air').length

  return (
    <div className="checkin-view-page">
      <header className="checkin-header no-print">
        <div className="header-brand" onClick={() => navigate(homePath)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="checkin-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(homePath)}>&larr; Back</button>
          <span className="form-badge">Check-In Manifest</span>
          <span className={`status-badge ${manifest.status.toLowerCase()}`}>{manifest.status}</span>
        </div>
        <div className="topbar-actions">
          {canEdit && (
            <button className="action-btn edit" onClick={() => navigate(`${homePath}/checkin?manifest=${manifest.id}`)}>Edit</button>
          )}
          <button className="action-btn print" onClick={() => setShowPrint(true)}>Print</button>
        </div>
      </div>

      <main className="checkin-view-main no-print">
        <div className="checkin-view-container print-area">
          <div className="manifest-header">
            <h2>Check-in Manifest</h2>
            <div className="manifest-meta">
              <span><strong>Check-in ID:</strong> {manifest.checkin_id}</span>
              <span><strong>Incident:</strong> {manifest.incident_id}</span>
              <span><strong>Status:</strong> {manifest.status}</span>
              {manifest.prepared_by_timestamp && (
                <span><strong>Submitted:</strong> {new Date(manifest.prepared_by_timestamp).toLocaleDateString()} {formatMilitaryTime(manifest.prepared_by_timestamp)}</span>
              )}
            </div>
          </div>

          <section className="view-section">
            <h3>Agency Information</h3>
            <p><strong>Name of Agency / Office / Home Base:</strong> {manifest.agency_name || '-'}</p>
          </section>

          <section className="view-section">
            <h3>Personnel</h3>
            <p><strong>Total Number of Personnel:</strong> {manifest.total_personnel}</p>

            {leader && (
              <>
                <h4>Leader</h4>
                <table className="view-table">
                  <thead>
                    <tr><th>Name</th><th>Age</th><th>Gender</th><th>Weight</th><th>Contact</th><th>Capabilities</th><th>Others</th></tr>
                  </thead>
                  <tbody>
                    <tr><td data-label="Name">{leader.name}</td><td data-label="Age">{leader.age}</td><td data-label="Gender">{leader.gender}</td><td data-label="Weight">{leader.weight}</td><td data-label="Contact">{leader.contact_details}</td><td data-label="Capabilities">{leader.capabilities}</td><td data-label="Others">{leader.others}</td></tr>
                  </tbody>
                </table>
              </>
            )}

            {members.length > 0 && (
              <>
                <h4>Members</h4>
                <table className="view-table">
                  <thead>
                    <tr><th>Name</th><th>Age</th><th>Gender</th><th>Weight</th><th>Contact</th><th>Capabilities</th><th>Others</th></tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}><td data-label="Name">{m.name}</td><td data-label="Age">{m.age}</td><td data-label="Gender">{m.gender}</td><td data-label="Weight">{m.weight}</td><td data-label="Contact">{m.contact_details}</td><td data-label="Capabilities">{m.capabilities}</td><td data-label="Others">{m.others}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          <section className="view-section">
            <h3>Vehicles</h3>
            <p><strong>Total Number of Vehicles:</strong> {manifest.total_vehicles}</p>
            <p className="vehicle-type-breakdown">
              <strong>Land:</strong> {landVehicles} &nbsp;|&nbsp; <strong>Water:</strong> {waterVehicles} &nbsp;|&nbsp; <strong>Air:</strong> {airVehicles}
            </p>
            {vehicles.length > 0 && (
              <table className="view-table">
                <thead>
                  <tr><th>ID</th><th>Operator</th><th>Kind</th><th>Type</th><th>Plate</th><th>Fuel</th><th>Weight</th><th>Contact</th><th>Capabilities</th><th>Others</th></tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id}><td data-label="ID">{v.vehicle_id}</td><td data-label="Operator">{v.operator_name}</td><td data-label="Kind">{v.kind}</td><td data-label="Type">{v.type}</td><td data-label="Plate">{v.plate_number}</td><td data-label="Fuel">{v.fuel_type}</td><td data-label="Weight">{v.weight}</td><td data-label="Contact">{v.contact_details}</td><td data-label="Capabilities">{v.capabilities}</td><td data-label="Others">{v.others}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="view-section">
            <h3>Equipment</h3>
            <p><strong>Total Number of Equipment:</strong> {manifest.total_equipment}</p>
            {equipment.length > 0 && (
              <table className="view-table">
                <thead>
                  <tr><th>ID</th><th>Operator</th><th>Kind</th><th>Type</th><th>Power</th><th>Fuel</th><th>Weight</th><th>Contact</th><th>Capabilities</th><th>Others</th></tr>
                </thead>
                <tbody>
                  {equipment.map((eq) => (
                    <tr key={eq.id}><td data-label="ID">{eq.equipment_id}</td><td data-label="Operator">{eq.operator_name}</td><td data-label="Kind">{eq.kind}</td><td data-label="Type">{eq.type}</td><td data-label="Power">{eq.source_of_power}</td><td data-label="Fuel">{eq.fuel_type}</td><td data-label="Weight">{eq.weight}</td><td data-label="Contact">{eq.contact_details}</td><td data-label="Capabilities">{eq.capabilities}</td><td data-label="Others">{eq.others}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {manifest.others && (
            <section className="view-section">
              <h3>Others</h3>
              <p>{manifest.others}</p>
            </section>
          )}

          <section className="view-section">
            <h3>Prepared By</h3>
            <p><strong>Name:</strong> {manifest.prepared_by_name}</p>
            {manifest.prepared_by_timestamp && (
              <p><strong>Timestamp:</strong> {new Date(manifest.prepared_by_timestamp).toLocaleDateString()} {formatMilitaryTime(manifest.prepared_by_timestamp)}</p>
            )}
          </section>
        </div>
      </main>

      <CheckInPrint manifest={manifest} personnel={personnel} vehicles={vehicles} equipment={equipment} showPrint={showPrint} onClose={() => setShowPrint(false)} />
    </div>
  )
}
