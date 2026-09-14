import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './ConfirmModal.css'

interface ConfirmModalProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ title, message, onConfirm, onCancel }: ConfirmModalProps) {
  const { user, signIn } = useAuth()
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await signIn(email, password)

    if (authError) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    setLoading(false)
    onConfirm()
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="modal-message">{message}</p>

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label htmlFor="confirm-email">Email</label>
            <input
              id="confirm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="modal-field">
            <label htmlFor="confirm-password">Password</label>
            <input
              id="confirm-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password to confirm"
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="modal-btn cancel" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="modal-btn confirm" disabled={loading}>
              {loading ? 'Verifying...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
