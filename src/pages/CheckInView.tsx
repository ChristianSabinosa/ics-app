import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { CheckinManifest, CheckinPersonnel, CheckinVehicle, CheckinEquipment } from '../lib/types'
import CheckInPrint from './CheckInPrint'
import './CheckInView.css'

export default function CheckInView() {
  const { id: incidentId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [manifest, setManifest] = useState<CheckinManifest | null>(null)
  const [personnel, setPersonnel] = useState<CheckinPersonnel[]>([])
  const [vehicles, setVehicles] = useState<CheckinVehicle[]>([])
  const [equipment, setEquipment] = useState<CheckinEquipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!incidentId || !user) return
    fetchManifest()
  }, [incidentId, user])

  const fetchManifest = async () => {
    setLoading(true)
    const { data: m, error: me } = await supabase
      .from('checkin_manifests')
      .select('*')
      .eq('incident_id', incidentId)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

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
  }

  const handlePrint = () => window.print()

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
          <button onClick={() => navigate(`/incident/${incidentId}`)}>Back to Incident</button>
        </div>
      </div>
    )
  }

  const leader = personnel.find((p) => p.role === 'Leader')
  const members = personnel.filter((p) => p.role === 'Member')

  return (
    <div className="checkin-view-page">
      <header className="checkin-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="checkin-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="checkin-id-badge">{manifest.checkin_id}</span>
          <span className={`status-badge ${manifest.status.toLowerCase()}`}>{manifest.status}</span>
        </div>
        <div className="topbar-actions">
          <button className="topbar-btn edit" onClick={() => navigate(`/incident/${incidentId}/checkin`)}>Edit</button>
          <button className="topbar-btn print" onClick={handlePrint}>Print</button>
        </div>
      </div>

      <main className="checkin-view-main">
        <div className="checkin-view-container print-area">
          <div className="manifest-header">
            <h2>Check-in Manifest</h2>
            <div className="manifest-meta">
              <span><strong>Check-in ID:</strong> {manifest.checkin_id}</span>
              <span><strong>Incident:</strong> {manifest.incident_id}</span>
              <span><strong>Status:</strong> {manifest.status}</span>
              {manifest.prepared_by_timestamp && (
                <span><strong>Submitted:</strong> {new Date(manifest.prepared_by_timestamp).toLocaleString()}</span>
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
                    <tr><td>{leader.name}</td><td>{leader.age}</td><td>{leader.gender}</td><td>{leader.weight}</td><td>{leader.contact_details}</td><td>{leader.capabilities}</td><td>{leader.others}</td></tr>
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
                      <tr key={m.id}><td>{m.name}</td><td>{m.age}</td><td>{m.gender}</td><td>{m.weight}</td><td>{m.contact_details}</td><td>{m.capabilities}</td><td>{m.others}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          <section className="view-section">
            <h3>Vehicles</h3>
            <p><strong>Total Number of Vehicles:</strong> {manifest.total_vehicles}</p>
            {vehicles.length > 0 && (
              <table className="view-table">
                <thead>
                  <tr><th>ID</th><th>Operator</th><th>Kind</th><th>Type</th><th>Plate</th><th>Fuel</th><th>Weight</th><th>Contact</th><th>Capabilities</th><th>Others</th></tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id}><td>{v.vehicle_id}</td><td>{v.operator_name}</td><td>{v.kind}</td><td>{v.type}</td><td>{v.plate_number}</td><td>{v.fuel_type}</td><td>{v.weight}</td><td>{v.contact_details}</td><td>{v.capabilities}</td><td>{v.others}</td></tr>
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
                    <tr key={eq.id}><td>{eq.equipment_id}</td><td>{eq.operator_name}</td><td>{eq.kind}</td><td>{eq.type}</td><td>{eq.source_of_power}</td><td>{eq.fuel_type}</td><td>{eq.weight}</td><td>{eq.contact_details}</td><td>{eq.capabilities}</td><td>{eq.others}</td></tr>
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
              <p><strong>Timestamp:</strong> {new Date(manifest.prepared_by_timestamp).toLocaleString()}</p>
            )}
          </section>
        </div>
      </main>

      <CheckInPrint manifest={manifest} personnel={personnel} vehicles={vehicles} equipment={equipment} />
    </div>
  )
}
