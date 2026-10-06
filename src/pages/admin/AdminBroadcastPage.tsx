import { useState } from 'react'
import { sendBroadcast } from '../../lib/admin'
import './AdminLayout.css'

/**
 * Authority F: one announcement, delivered as an in-app notification to every
 * account that is not suspended.
 *
 * The row is written by send_broadcast() (SECURITY DEFINER, admin-checked) with
 * the sentinel incident id 'SYSTEM', so it lands in the normal notification
 * list and the live toast exactly like an incident notification does.
 */
export default function AdminBroadcastPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setSending(true)
    try {
      const recipients = await sendBroadcast(title, body, link.trim())
      setNotice(`Sent to ${recipients} account${recipients === 1 ? '' : 's'}.`)
      setTitle('')
      setBody('')
      setLink('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-toolbar">
        <h3>Broadcast</h3>
      </div>

      <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: 14 }}>
        Everyone signed up to the system receives this in their notification list. Suspended
        accounts are skipped. Leave the link empty for a plain announcement.
      </p>

      {error && <div className="admin-error">{error}</div>}
      {notice && <div className="admin-success">{notice}</div>}

      <form onSubmit={submit} style={{ maxWidth: 640 }}>
        <div className="admin-field">
          <label htmlFor="broadcast-title">Title</label>
          <input
            id="broadcast-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="System maintenance tonight"
            required
            maxLength={140}
          />
        </div>

        <div className="admin-field">
          <label htmlFor="broadcast-body">Message</label>
          <textarea
            id="broadcast-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What should everybody know?"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="broadcast-link">Link (optional)</label>
          <input
            id="broadcast-link"
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/dashboard"
          />
          <div className="hint">Where the notification takes the reader when it is clicked.</div>
        </div>

        <button className="admin-btn primary" type="submit" disabled={sending || !title.trim()}>
          {sending ? 'Sending…' : 'Send broadcast'}
        </button>
      </form>
    </div>
  )
}
