import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  fetchMyTrainings,
  createTraining,
  fetchTrainingByToken,
  joinTraining,
  deleteTraining,
  userDisplayName,
  type Training,
  type TrainingMember,
} from '../lib/training'
import './Training.css'

/**
 * Training Mode landing page. From here a user can:
 *   - open a training they already belong to (as trainer or trainee),
 *   - create a new training (they become the trainer), or
 *   - paste an invite link to join someone else's training.
 */
export default function TrainingHub() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [rows, setRows] = useState<{ training: Training; member: TrainingMember }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [scenario, setScenario] = useState('')
  const [groupCount, setGroupCount] = useState(4)
  const [creating, setCreating] = useState(false)

  // Join by link
  const [joinLink, setJoinLink] = useState('')
  const [joining, setJoining] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    if (!user) return
    setLoading(true)
    setRows(await fetchMyTrainings(user.id))
    setLoading(false)
  }

  useEffect(() => { load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError('')
    setCreating(true)
    try {
      const training = await createTraining({
        name,
        location,
        scenario,
        groupCount,
        trainer: { id: user.id, name: userDisplayName(user) },
      })
      navigate(`/training/${training.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the training.')
      setCreating(false)
    }
  }

  const handleDelete = async (training: Training) => {
    if (!window.confirm(`Permanently delete "${training.name}" and all its groups and data?`)) return
    setError('')
    setDeletingId(training.id)
    try {
      await deleteTraining(training)
      setRows((prev) => prev.filter((r) => r.training.id !== training.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the training.')
    }
    setDeletingId(null)
  }

  const handleJoin = async () => {
    if (!user || !joinLink.trim()) return
    setError('')
    setJoining(true)
    try {
      // Accept a full invite URL or just the token.
      const token = joinLink.trim().split('/training/join/').pop()!.trim()
      const training = await fetchTrainingByToken(token)
      if (!training) {
        setError('Training not found. Check the invite link and try again.')
        setJoining(false)
        return
      }
      await joinTraining(training, { id: user.id, name: userDisplayName(user), email: user.email || '' })
      navigate(`/training/${training.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the training.')
      setJoining(false)
    }
  }

  return (
    <div className="training-page">
      <header className="page-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Training Mode</h1>
            <p>Incident Command System — drills &amp; exercises</p>
          </div>
        </div>
        <button className="training-back" onClick={() => navigate('/dashboard')}>Dashboard</button>
      </header>

      <main className="training-main">
        {error && <div className="error-message">{error}</div>}

        <section className="training-actions">
          <button className="training-action-card create" onClick={() => setShowCreate((v) => !v)}>
            <span className="training-action-icon">+</span>
            <h3>Create a Training</h3>
            <p>You become the trainer: set up groups, invite trainees, monitor progress</p>
          </button>

          <div className="training-action-card join">
            <span className="training-action-icon">→</span>
            <h3>Join with an invite link</h3>
            <div className="training-join-row">
              <input
                type="text"
                placeholder="Paste the invite link or code"
                value={joinLink}
                onChange={(e) => setJoinLink(e.target.value)}
              />
              <button onClick={handleJoin} disabled={joining || !joinLink.trim()}>
                {joining ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
        </section>

        {showCreate && (
          <section className="training-form-card">
            <h2>Create a Training</h2>
            <form onSubmit={handleCreate} className="training-form">
              <div className="form-group">
                <label htmlFor="tr-name">Training Name</label>
                <input id="tr-name" value={name} onChange={(e) => setName(e.target.value)} required
                  placeholder="e.g. Flood Response Drill 2026" />
              </div>
              <div className="form-group">
                <label htmlFor="tr-location">Location</label>
                <input id="tr-location" value={location} onChange={(e) => setLocation(e.target.value)} required
                  placeholder="e.g. Barangay I, Alaminos, Laguna" />
              </div>
              <div className="form-group">
                <label htmlFor="tr-scenario">Scenario (optional)</label>
                <textarea id="tr-scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}
                  placeholder="Short description of the drill scenario" rows={3} />
              </div>
              <div className="form-group">
                <label htmlFor="tr-groups">Default number of groups</label>
                <input id="tr-groups" type="number" min={1} max={12} value={groupCount}
                  onChange={(e) => setGroupCount(Number(e.target.value))} />
                <small>You start with this many groups — you can add or remove groups later.</small>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Training'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="training-list">
          <h2>My Trainings</h2>
          {loading ? (
            <p className="training-empty">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="training-empty">No trainings yet. Create one or join with an invite link.</p>
          ) : (
            <div className="training-cards">
              {rows.map(({ training, member }) => (
                <div key={training.id} className="training-card" role="button" tabIndex={0}
                  onClick={() => navigate(`/training/${training.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/training/${training.id}`) }}>
                  <div className="training-card-top">
                    <span className={`training-status ${training.status.toLowerCase()}`}>{training.status}</span>
                    <span className={`training-role ${member.role}`}>{member.role === 'trainor' ? 'Trainer' : 'Trainee'}</span>
                  </div>
                  <h3>{training.name}</h3>
                  <p className="training-card-meta">{training.training_id} · {training.location}</p>
                  <p className="training-card-meta">{member.group_id ? 'Assigned to a group' : 'No group assigned yet'}</p>
                  {member.role === 'trainor' && training.status === 'Closed' && (
                    <button
                      className="btn-secondary"
                      disabled={deletingId === training.id}
                      onClick={(e) => { e.stopPropagation(); handleDelete(training) }}
                    >
                      {deletingId === training.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
