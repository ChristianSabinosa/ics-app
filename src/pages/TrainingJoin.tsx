import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchTrainingByToken, joinTraining, userDisplayName, type Training } from '../lib/training'
import './Training.css'

/**
 * Invite landing page (/training/join/:token) — reached from the QR code or
 * the link the trainer shares. Trainees create an account (or sign in) right
 * here and are added to the training immediately; the trainer then assigns
 * them to a group.
 */
export default function TrainingJoin() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, signIn, signUp } = useAuth()

  const [training, setTraining] = useState<Training | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Auth forms shown when signed out
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchTrainingByToken(token || '').then((t) => {
      if (!cancelled) {
        setTraining(t)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [token])

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: authError } =
      mode === 'signup'
        ? await signUp(email, password, { first_name: firstName, last_name: lastName })
        : await signIn(email, password)
    setBusy(false)
    if (authError) setError(authError.message)
    // On success the auth listener updates `user`, which swaps the form for
    // the Join button below.
  }

  const handleJoin = async () => {
    if (!training || !user) return
    setError('')
    setBusy(true)
    try {
      await joinTraining(training, { id: user.id, name: userDisplayName(user), email: user.email || '' })
      navigate(`/training/${training.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the training.')
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="training-join-page"><p className="training-empty">Checking your invite…</p></div>
  }

  if (!training) {
    return (
      <div className="training-join-page">
        <div className="training-form-card">
          <h2>Invite not found</h2>
          <p>This training invite link is invalid or has expired.</p>
          <button className="btn-primary" onClick={() => navigate('/training')}>Go to Training Mode</button>
        </div>
      </div>
    )
  }

  return (
    <div className="training-join-page">
      <header className="page-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Training Mode</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <main className="training-main">
        <div className="training-invite-card">
          <span className="training-invite-badge">Training invite</span>
          <h2>{training.name}</h2>
          <p className="training-card-meta">{training.training_id} · {training.location}</p>
          {training.scenario && <p className="training-invite-scenario">{training.scenario}</p>}
          <p className="training-invite-trainer">Trainer: <strong>{training.created_by_name}</strong></p>

          {error && <div className="error-message">{error}</div>}

          {!user ? (
            <form onSubmit={handleAuth} className="training-form">
              <div className="training-auth-tabs">
                <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
                  Create account
                </button>
                <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
                  Sign in
                </button>
              </div>
              {mode === 'signup' && (
                <div className="training-auth-names">
                  <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              )}
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Working…' : mode === 'signup' ? 'Create account & join' : 'Sign in & join'}
              </button>
            </form>
          ) : (
            <div className="training-invite-actions">
              <p>Joining as <strong>{userDisplayName(user)}</strong></p>
              <button className="btn-primary" onClick={handleJoin} disabled={busy}>
                {busy ? 'Joining…' : 'Join this training'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
