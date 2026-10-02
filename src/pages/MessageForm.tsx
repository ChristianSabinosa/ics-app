import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  fetchMyIncidents,
  fetchRecipients,
  notifyMessage,
  saveMessage,
  type MessagePayload,
  type RecipientCandidate,
} from '../lib/messages'
import type { AppMessage, MessageIncident } from '../lib/types'
import Ics213Print from './Ics213Print'
import './Ics213Form.css'
import './MessagesPage.css'

/**
 * Compose — the ICS 213 General Message form used as the template.
 *
 * Three entry points share it:
 *   /messages/compose             new message
 *   /messages/compose?reply=<id>  threaded reply, addressed to the other party
 *   /messages/compose?draft=<id>  continue a message that was never sent
 *
 * A sent message is immutable from here: the sender's copy and the recipient's
 * copy are the same row, so letting either side rewrite the body after the fact
 * would change what the other person read. Sections 7–9 are edited in the
 * reading pane instead.
 */
export default function MessageForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const draftId = searchParams.get('draft')
  const replyToId = searchParams.get('reply')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  const [incidents, setIncidents] = useState<MessageIncident[]>([])
  const [recipients, setRecipients] = useState<RecipientCandidate[]>([])

  const [incidentId, setIncidentId] = useState('')
  const [incidentName, setIncidentName] = useState('')
  const [msgDate, setMsgDate] = useState('')
  const [msgTime, setMsgTime] = useState('')

  const [recipientId, setRecipientId] = useState('')
  const [toName, setToName] = useState('')
  const [toPosition, setToPosition] = useState('')

  const [fromName, setFromName] = useState('')
  const [fromPosition, setFromPosition] = useState('')

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const [approvedByName, setApprovedByName] = useState('')
  const [approvedByPosition, setApprovedByPosition] = useState('')
  const [approvedBySig, setApprovedBySig] = useState('')
  const [approvedDate, setApprovedDate] = useState('')
  const [approvedTime, setApprovedTime] = useState('')

  const [reply, setReply] = useState('')

  const [receivedByName, setReceivedByName] = useState('')
  const [receivedByPosition, setReceivedByPosition] = useState('')
  const [receivedBySig, setReceivedBySig] = useState('')

  const load = useCallback(async () => {
    if (!user) return

    const sourceId = draftId ?? replyToId
    let source: AppMessage | null = null
    if (sourceId) {
      const { data } = await supabase.from('messages').select('*').eq('id', sourceId).maybeSingle()
      source = (data as AppMessage) ?? null
      if (!source) setError('That message could not be found — it may have been deleted.')
    }

    // Everything below happens after an await, so no state is written
    // synchronously from the effect that calls this.
    const myIncidents = await fetchMyIncidents(user.id)
    setIncidents(myIncidents)

    const now = new Date()
    const firstName = user.user_metadata?.first_name || ''
    const lastName = user.user_metadata?.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()
    setFromName(source?.sender_name || fullName || user.email || '')
    setMsgDate(source?.msg_date || now.toISOString().slice(0, 10))
    setMsgTime(source?.msg_time || now.toTimeString().slice(0, 5))

    const chosen = source?.incident_id || myIncidents[0]?.incident_id || ''
    setIncidentId(chosen)
    setIncidentName(source?.incident_name || myIncidents.find((i) => i.incident_id === chosen)?.name || '')

    const list = await fetchRecipients(user.id, chosen || undefined)
    setRecipients(list)

    if (source && draftId) {
      // Continuing your own draft: carry every field over untouched.
      setRecipientId(source.recipient_user_id)
      setToName(source.to_name)
      setToPosition(source.to_position)
      setFromPosition(source.sender_position)
      setSubject(source.subject)
      setMessage(source.message)
      setApprovedByName(source.approved_by_name)
      setApprovedByPosition(source.approved_by_position)
      setApprovedBySig(source.approved_by_sig)
      setApprovedDate(source.approved_date)
      setApprovedTime(source.approved_time)
      setReply(source.reply)
      setReceivedByName(source.received_by_name)
      setReceivedByPosition(source.received_by_position)
      setReceivedBySig(source.received_by_sig)
    } else if (source && replyToId) {
      // Replying: address whoever is on the other end of the original.
      const iAmSender = source.sender_user_id === user.id
      const otherId = iAmSender ? source.recipient_user_id : source.sender_user_id
      const otherName = iAmSender ? source.to_name : source.sender_name
      const other = list.find((r) => r.id === otherId)
      setRecipientId(otherId)
      setToName(otherName || other?.name || '')
      setToPosition(other?.role || (iAmSender ? source.to_position : source.sender_position) || '')
      if (!/^\s*re:/i.test(source.subject)) setSubject(`Re: ${source.subject}`)
      else setSubject(source.subject)
    }

    setLoading(false)
  }, [user, draftId, replyToId])

  useEffect(() => {
    load()
  }, [load])

  const changeIncident = async (id: string) => {
    setIncidentId(id)
    const chosen = incidents.find((i) => i.incident_id === id)
    setIncidentName(chosen?.name ?? '')
    if (user) setRecipients(await fetchRecipients(user.id, id || undefined))
  }

  const changeRecipient = (id: string) => {
    setRecipientId(id)
    const found = recipients.find((r) => r.id === id)
    if (found) {
      setToName(found.name)
      setToPosition(found.role)
    }
  }

  const save = async (status: 'Draft' | 'Sent') => {
    if (!user) return

    if (!incidentId) {
      setError('Choose which incident this message belongs to.')
      return
    }
    if (!recipientId) {
      setError('Choose who this message is addressed to.')
      return
    }
    if (status === 'Sent' && !message.trim()) {
      setError('Write the message before sending.')
      return
    }

    setSaving(true)
    setError('')

    const payload: MessagePayload = {
      incident_id: incidentId,
      incident_name: incidentName,
      parent_id: replyToId,
      recipient_user_id: recipientId,
      to_name: toName,
      to_position: toPosition,
      sender_user_id: user.id,
      sender_name: fromName,
      sender_position: fromPosition,
      msg_date: msgDate,
      msg_time: msgTime,
      subject,
      message,
    }

    const { id, error: saveError } = await saveMessage(payload, status, draftId)
    if (saveError) {
      setSaving(false)
      setError(saveError)
      return
    }

    if (status === 'Sent' && id) {
      // The message is already durable at this point — a failed notice must
      // never send the user back to an empty form.
      await notifyMessage(id)
      setSaving(false)
      navigate(`/messages?folder=sent&msg=${id}`)
      return
    }

    setSaving(false)
    navigate(id ? `/messages?folder=drafts&msg=${id}` : '/messages?folder=drafts')
  }

  if (loading) {
    return (
      <div className="msg-page">
        <div className="ics213-loading">Loading message...</div>
      </div>
    )
  }

  const recipientMembers = recipients.filter((r) => r.inIncident)
  const recipientOthers = recipients.filter((r) => !r.inIncident)

  return (
    <div className="msg-page">
      <header className="msg-header no-print">
        <div className="header-brand" onClick={() => navigate('/messages')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="msg-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate('/messages')}>&larr; Messages</button>
          <span className="form-badge">ICS 213</span>
          <span className="list-title">
            {draftId ? 'Edit draft' : replyToId ? 'Reply' : 'New message'}
          </span>
        </div>
        <div className="topbar-actions">
          <button className="action-btn save" onClick={() => save('Draft')} disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button className="action-btn submit" onClick={() => save('Sent')} disabled={saving}>
            {saving ? 'Sending...' : 'Send'}
          </button>
          <button className="action-btn print" onClick={() => setShowPrint(true)} disabled={saving}>
            Print
          </button>
        </div>
      </div>

      <main className="msg-main no-print">
        <div className="ics213-container" style={{ maxWidth: 900 }}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-header-section">
            <h2>GENERAL MESSAGE</h2>
            <h3>ICS 213</h3>
          </div>

          {/* Section 1: Incident + Date/Time */}
          <div className="form-section">
            <div className="form-row two-col">
              <div className="form-field">
                <label>1. INCIDENT/EVENT NAME *</label>
                <select value={incidentId} onChange={(e) => changeIncident(e.target.value)}>
                  <option value="">Select an incident...</option>
                  {incidents.map((i) => (
                    <option key={i.incident_id} value={i.incident_id}>{i.name}</option>
                  ))}
                </select>
                {incidents.length === 0 && (
                  <span className="msg-sign-hint">
                    You are not part of any incident yet — join or create one first.
                  </span>
                )}
              </div>
              <div className="form-field">
                <label>2. DATE / TIME</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="date" value={msgDate} onChange={(e) => setMsgDate(e.target.value)} style={{ flex: 1 }} />
                  <input type="time" value={msgTime} onChange={(e) => setMsgTime(e.target.value)} style={{ flex: 1 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: To */}
          <div className="form-section">
            <div className="form-field">
              <label>3. TO [NAME &amp; POSITION] *</label>
              <select value={recipientId} onChange={(e) => changeRecipient(e.target.value)}>
                <option value="">Select a recipient...</option>
                {recipientMembers.length > 0 && (
                  <optgroup label={incidentName ? `In this incident — ${incidentName}` : 'In this incident'}>
                    {recipientMembers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}{r.email ? ` — ${r.email}` : ''}{r.role ? ` (${r.role})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {recipientOthers.length > 0 && (
                  <optgroup label="Everyone else">
                    {recipientOthers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}{r.email ? ` — ${r.email}` : ''}{r.role ? ` (${r.role})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {recipients.length === 0 && (
                <span className="msg-sign-hint">No other accounts are registered yet.</span>
              )}
            </div>
            <div className="form-field" style={{ marginTop: 8 }}>
              <label>Position / Title</label>
              <input type="text" value={toPosition} onChange={(e) => setToPosition(e.target.value)} />
            </div>
          </div>

          {/* Section 4: From */}
          <div className="form-section">
            <div className="form-row two-col">
              <div className="form-field">
                <label>4. FROM [NAME]</label>
                <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} />
              </div>
              <div className="form-field">
                <label>POSITION / TITLE</label>
                <input type="text" value={fromPosition} onChange={(e) => setFromPosition(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section 5: Subject */}
          <div className="form-section">
            <div className="form-field">
              <label>5. SUBJECT</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          </div>

          {/* Section 6: Message */}
          <div className="form-section">
            <div className="form-field">
              <label>6. MESSAGE *</label>
              <textarea
                className="large"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Request for additional personnel, resources, supplies, vehicles..."
              />
            </div>
          </div>

          {/* Section 7: Approved by */}
          <div className="form-section signature-section">
            <label>7. APPROVED BY</label>
            <div className="sig-row">
              <div className="sig-field num">Name</div>
              <div className="sig-field">
                <input type="text" value={approvedByName} onChange={(e) => setApprovedByName(e.target.value)} />
              </div>
              <div className="sig-field">
                <label>Position / Title:</label>
                <input type="text" value={approvedByPosition} onChange={(e) => setApprovedByPosition(e.target.value)} />
              </div>
              <div className="sig-field">
                <label>Signature:</label>
                <input type="text" value={approvedBySig} onChange={(e) => setApprovedBySig(e.target.value)} />
              </div>
            </div>
            <div className="form-row two-col" style={{ marginTop: 8 }}>
              <div className="form-field">
                <label>Date</label>
                <input type="date" value={approvedDate} onChange={(e) => setApprovedDate(e.target.value)} />
              </div>
              <div className="form-field">
                <label>Time</label>
                <input type="time" value={approvedTime} onChange={(e) => setApprovedTime(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section 8: Reply */}
          <div className="form-section">
            <div className="form-field">
              <label>8. REPLY</label>
              <textarea
                className="large"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Leave blank — the recipient fills this in after receiving the message."
              />
            </div>
          </div>

          {/* Section 9: Received by */}
          <div className="form-section signature-section">
            <label>9. RECEIVED BY</label>
            <div className="sig-row">
              <div className="sig-field num">Name</div>
              <div className="sig-field">
                <input type="text" value={receivedByName} onChange={(e) => setReceivedByName(e.target.value)} />
              </div>
              <div className="sig-field">
                <label>Position / Title:</label>
                <input type="text" value={receivedByPosition} onChange={(e) => setReceivedByPosition(e.target.value)} />
              </div>
              <div className="sig-field">
                <label>Signature:</label>
                <input type="text" value={receivedBySig} onChange={(e) => setReceivedBySig(e.target.value)} />
              </div>
            </div>
            <span className="msg-sign-hint">
              Sections 7–9 can also be completed later, by either party, from the message itself.
            </span>
          </div>
        </div>
      </main>

      {showPrint && (
        <Ics213Print
          incidentName={incidentName}
          msgDate={msgDate}
          msgTime={msgTime}
          toName={toName}
          toPosition={toPosition}
          fromName={fromName}
          fromPosition={fromPosition}
          subject={subject}
          message={message}
          approvedByName={approvedByName}
          approvedByPosition={approvedByPosition}
          approvedBySig={approvedBySig}
          approvedDate={approvedDate}
          approvedTime={approvedTime}
          reply={reply}
          receivedByName={receivedByName}
          receivedByPosition={receivedByPosition}
          receivedBySig={receivedBySig}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
