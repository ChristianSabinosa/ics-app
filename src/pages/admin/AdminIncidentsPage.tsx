import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/ConfirmModal'
import {
  deleteIncidentAsAdmin,
  listUsers,
  setIncidentStatus,
  setParticipant,
  type AdminUser,
} from '../../lib/admin'
import type { Incident, IncidentParticipant } from '../../lib/types'
import './AdminLayout.css'

const ROLES: IncidentParticipant['role'][] = ['IMT', 'Tactical Resources', 'Observer']

/**
 * Authority C + D: every incident in the system, with the controls an owner
 * would have (close, reopen, delete) plus roster management for incidents that
 * belong to somebody else.
 *
 * Opening an incident lands on the normal incident page in read-only mode —
 * an admin outside their own incidents can read every form and change none of
 * them (src/lib/permissions.ts, and the restrictive policies in
 * supabase-admin-guardrails.sql).
 */
export default function AdminIncidentsPage() {
  const navigate = useNavigate()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [participants, setParticipants] = useState<IncidentParticipant[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [openRoster, setOpenRoster] = useState<string | null>(null)
  const [rosterUserId, setRosterUserId] = useState('')
  const [rosterRole, setRosterRole] = useState<IncidentParticipant['role']>('Observer')
  const [deleting, setDeleting] = useState<Incident | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [incidentsRes, participantsRes, userRows] = await Promise.all([
        supabase.from('incidents').select('*').is('training_id', null).order('created_at', { ascending: false }),
        supabase.from('incident_participants').select('*'),
        listUsers(),
      ])
      if (incidentsRes.error) throw new Error(incidentsRes.error.message)
      if (participantsRes.error) throw new Error(participantsRes.error.message)
      setIncidents((incidentsRes.data ?? []) as Incident[])
      setParticipants((participantsRes.data ?? []) as IncidentParticipant[])
      setUsers(userRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (id: string, action: () => Promise<void>) => {
    setError('')
    setNotice('')
    setBusyId(id)
    try {
      await action()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  const activeRoster = (incidentId: string) =>
    participants.filter((p) => p.incident_id === incidentId && p.status === 'Active')

  const toggleStatus = (incident: Incident) =>
    run(incident.incident_id, async () => {
      await setIncidentStatus(incident.incident_id, incident.status === 'Ongoing' ? 'Closed' : 'Ongoing')
      setNotice(
        `${incident.incident_id} is now ${incident.status === 'Ongoing' ? 'Closed' : 'Ongoing'}.`,
      )
    })

  const confirmDelete = async () => {
    const target = deleting
    if (!target) return
    setDeleting(null)
    await run(target.incident_id, async () => {
      await deleteIncidentAsAdmin(target.incident_id, 'Deleted from System Administration')
      setNotice(`${target.incident_id} and all of its data have been deleted.`)
    })
  }

  const addParticipant = (incident: Incident) => {
    if (!rosterUserId) return
    void run(incident.incident_id, async () => {
      await setParticipant(incident.incident_id, rosterUserId, rosterRole, 'set')
      setNotice(`Enrolled in ${incident.incident_id} as ${rosterRole}.`)
      setRosterUserId('')
    })
  }

  const changeRole = (incident: Incident, participant: IncidentParticipant, role: IncidentParticipant['role']) => {
    void run(incident.incident_id, async () => {
      await setParticipant(incident.incident_id, participant.user_id, role, 'set')
      setNotice(`${participant.user_name || participant.user_email} is now ${role} in ${incident.incident_id}.`)
    })
  }

  const removeParticipant = (incident: Incident, participant: IncidentParticipant) => {
    void run(incident.incident_id, async () => {
      await setParticipant(incident.incident_id, participant.user_id, participant.role, 'remove')
      setNotice(`${participant.user_name || participant.user_email} was removed from ${incident.incident_id}.`)
    })
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? incidents.filter((i) =>
        `${i.incident_id} ${i.name} ${i.location} ${i.created_by_name}`.toLowerCase().includes(q),
      )
    : incidents

  // Enrolment picker: everybody not already Active in this incident.
  const enrolmentOptions = (incidentId: string) => {
    const present = new Set(activeRoster(incidentId).map((p) => p.user_id))
    return users.filter((u) => !present.has(u.id))
  }

  const rosterIncident = openRoster
    ? incidents.find((i) => i.incident_id === openRoster) ?? null
    : null
  const rosterOptions = rosterIncident ? enrolmentOptions(rosterIncident.incident_id) : []

  return (
    <div className="admin-card">
      <div className="admin-toolbar">
        <h3>Incidents</h3>
        <input
          className="admin-search"
          type="search"
          placeholder="Search by id, name, location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search incidents"
        />
      </div>

      {error && <div className="admin-error">{error}</div>}
      {notice && <div className="admin-success">{notice}</div>}

      {loading ? (
        <div className="admin-loading">Loading incidents…</div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No incidents match “{query}”.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created by</th>
                <th>Roster</th>
                <th style={{ textAlign: 'right' }}>Authorities</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((incident) => {
                const roster = activeRoster(incident.incident_id)
                const isOpen = openRoster === incident.incident_id
                return (
                  <tr key={incident.id}>
                    <td>
                      <strong className="admin-mono">{incident.incident_id}</strong>
                      <div>{incident.name}</div>
                      <div style={{ color: '#888', fontSize: '0.8rem' }}>{incident.location}</div>
                    </td>
                    <td>
                      <span className={`admin-badge ${incident.type === 'Incident' ? 'info' : 'muted'}`}>
                        {incident.type}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${incident.status === 'Ongoing' ? 'ok' : 'muted'}`}>
                        {incident.status}
                      </span>
                    </td>
                    <td>
                      {incident.created_by_name || '—'}
                      <div style={{ color: '#888', fontSize: '0.8rem' }}>{incident.created_by_email}</div>
                    </td>
                    <td>
                      {roster.length} active
                      <div style={{ color: '#888', fontSize: '0.8rem' }}>
                        {roster.filter((r) => r.role === 'IMT').length} IMT
                      </div>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="admin-btn sm primary"
                          onClick={() => navigate(`/incident/${incident.incident_id}`)}
                        >
                          Open
                        </button>
                        <button
                          className="admin-btn sm"
                          onClick={() => setOpenRoster(isOpen ? null : incident.incident_id)}
                        >
                          {isOpen ? 'Close roster' : 'Roster'}
                        </button>
                        <button
                          className="admin-btn sm"
                          disabled={busyId === incident.incident_id}
                          onClick={() => toggleStatus(incident)}
                        >
                          {incident.status === 'Ongoing' ? 'Close incident' : 'Reopen'}
                        </button>
                        <button
                          className="admin-btn sm danger"
                          disabled={busyId === incident.incident_id}
                          onClick={() => setDeleting(incident)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {openRoster && (
        <div className="admin-roster">
          <h4>Roster — {openRoster}</h4>

          {activeRoster(openRoster).length === 0 && (
            <p style={{ color: '#888', fontSize: '0.88rem' }}>
              Nobody has joined this incident yet.
            </p>
          )}

          {activeRoster(openRoster).map((p) => (
            <div className="admin-roster-row" key={p.id}>
              <div className="who">
                <strong>{p.user_name || p.user_email}</strong>
                <span>{p.user_email}{p.role_id ? ` · ${p.role_id}` : ''}</span>
              </div>
              <div className="admin-actions">
                <select
                  value={p.role}
                  onChange={(e) => rosterIncident && changeRole(rosterIncident, p, e.target.value as IncidentParticipant['role'])}
                  disabled={busyId === openRoster}
                  aria-label={`Role for ${p.user_name || p.user_email}`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button
                  className="admin-btn sm danger"
                  disabled={busyId === openRoster}
                  onClick={() => rosterIncident && removeParticipant(rosterIncident, p)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="admin-add-row">
            <select
              value={rosterUserId}
              onChange={(e) => setRosterUserId(e.target.value)}
              aria-label="Account to enrol"
            >
              <option value="">Choose an account…</option>
              {rosterOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {`${u.first_name} ${u.last_name}`.trim() || u.email} — {u.email}
                </option>
              ))}
            </select>
            <select
              value={rosterRole}
              onChange={(e) => setRosterRole(e.target.value as IncidentParticipant['role'])}
              aria-label="Role to assign"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              className="admin-btn sm primary"
              disabled={!rosterUserId || busyId === openRoster || !rosterIncident}
              onClick={() => rosterIncident && addParticipant(rosterIncident)}
            >
              Enrol
            </button>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete incident"
          message={`This permanently deletes ${deleting.name} (${deleting.incident_id}) and every form, manifest and participant record in it. Everyone still in it will be notified. This cannot be undone. Enter your email and password to confirm.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
