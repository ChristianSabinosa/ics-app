import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { generateIncidentId } from '../lib/utils'
import { notifySelfIncident } from '../lib/notifications'
import './CreateIncident.css'

export default function CreateIncident() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [type, setType] = useState<'Incident' | 'Planned Event'>('Incident')

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const incidentId = generateIncidentId()
    const firstName = user?.user_metadata?.first_name || ''
    const lastName = user?.user_metadata?.last_name || ''
    const createdBy = [firstName, lastName].filter(Boolean).join(' ') || user?.email || 'Unknown'

    const { error: insertError } = await supabase.from('incidents').insert({
      incident_id: incidentId,
      name,
      location,
      type,
      status: 'Ongoing',
      created_by: user?.id,
      created_by_name: createdBy,
      created_by_email: user?.email || '',
    })

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
    } else {
      // Confirmation addressed to the creator: they are the initial IC and
      // still need to complete the form and designate the IMT. Fire-and-forget
      // (and deliberately linkless) so a notification problem never blocks the
      // creation itself.
      notifySelfIncident(incidentId, {
        type: 'incident_created',
        title: "You've successfully created an incident",
        body: `${name} — you are the initial IC. Complete the form and designate the IMT.`,
      })
      navigate('/ongoing-incidents')
    }
  }

  return (
    <div className="create-incident-page">
      <header className="page-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <main className="create-main">
        <div className="form-card">
          <h2>Create an Incident</h2>
          <p className="form-subtitle">Fill in the details below to create a new incident</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleCreate} className="incident-form">
            <div className="form-group">
              <label htmlFor="incident-name">Incident Name</label>
              <input
                type="text"
                id="incident-name"
                placeholder="e.g. Typhoon response, Building fire"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="incident-location">Location</label>
              <input
                type="text"
                id="incident-location"
                placeholder="e.g. Barangay I, Alaminos, Laguna"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="incident-type">Type of Incident</label>
              <select
                id="incident-type"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                required
              >
                <option value="Incident">Incident</option>
                <option value="Planned Event">Planned Event</option>
              </select>
              <small>Looking for a drill? Trainings are created from Training Mode on the dashboard.</small>
            </div>

            <div className="form-group">
              <label>Timestamp</label>
              <div className="timestamp-display">
                {new Date().toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-back" onClick={() => navigate('/dashboard')} disabled={loading}>
                Back
              </button>
              <button type="submit" className="btn-create" disabled={loading}>
                {loading ? 'Creating...' : 'Create Incident'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
