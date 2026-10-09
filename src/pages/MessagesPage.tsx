import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  SYSTEM_FOLDERS,
  buildThread,
  canSign,
  createFolder,
  deleteFolder,
  deleteMessage,
  fillMessageSections,
  isUnread,
  isInFolder,
  matchesSearch,
  markMessageRead,
  moveMessage,
  renameFolder,
  threadRootId,
  useMailbox,
  type MailFolderKey,
} from '../lib/messages'
import type { AppMessage } from '../lib/types'
import Ics213Print from './Ics213Print'
import './Ics213Form.css'
import './MessagesPage.css'

// ---------------------------------------------------------------------------
// The reading pane — ICS 213 rendered exactly as the form draws it, with
// sections 7, 8 and 9 live for whoever is meant to sign them.
// ---------------------------------------------------------------------------

interface DocumentProps {
  message: AppMessage
  canEditSign: boolean
  onSaved: () => void
}

function MessageDocument({ message, canEditSign, onSaved }: DocumentProps) {
  const m = message
  const [approvedByName, setApprovedByName] = useState(m.approved_by_name)
  const [approvedByPosition, setApprovedByPosition] = useState(m.approved_by_position)
  const [approvedBySig, setApprovedBySig] = useState(m.approved_by_sig)
  const [approvedDate, setApprovedDate] = useState(m.approved_date)
  const [approvedTime, setApprovedTime] = useState(m.approved_time)
  const [reply, setReply] = useState(m.reply)
  const [receivedByName, setReceivedByName] = useState(m.received_by_name)
  const [receivedByPosition, setReceivedByPosition] = useState(m.received_by_position)
  const [receivedBySig, setReceivedBySig] = useState(m.received_by_sig)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const dirty =
    approvedByName !== m.approved_by_name ||
    approvedByPosition !== m.approved_by_position ||
    approvedBySig !== m.approved_by_sig ||
    approvedDate !== m.approved_date ||
    approvedTime !== m.approved_time ||
    reply !== m.reply ||
    receivedByName !== m.received_by_name ||
    receivedByPosition !== m.received_by_position ||
    receivedBySig !== m.received_by_sig

  const save = async () => {
    setSaving(true)
    setError('')
    const err = await fillMessageSections(m.id, {
      approved_by_name: approvedByName,
      approved_by_position: approvedByPosition,
      approved_by_sig: approvedBySig,
      approved_date: approvedDate,
      approved_time: approvedTime,
      reply,
      received_by_name: receivedByName,
      received_by_position: receivedByPosition,
      received_by_sig: receivedBySig,
    })
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    onSaved()
  }

  return (
    <div className="msg-doc">
      {error && <div className="error-message">{error}</div>}

      <div className="form-header-section">
        <h2>GENERAL MESSAGE</h2>
        <h3>ICS 213</h3>
      </div>

      <div className="form-section">
        <div className="form-row two-col">
          <div className="form-field">
            <label>1. INCIDENT/EVENT NAME</label>
            <input type="text" value={m.incident_name} readOnly className="readonly" />
          </div>
          <div className="form-field">
            <label>2. DATE / TIME</label>
            <div className="msg-datetime-row">
              <input type="text" value={m.msg_date} readOnly className="readonly" />
              <input
                type="text"
                value={m.msg_time ? `${m.msg_time.replace(':', '')}H` : ''}
                readOnly
                className="readonly"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-field">
          <label>3. TO [NAME &amp; POSITION]</label>
          <input type="text" value={m.to_name} readOnly className="readonly" />
        </div>
        <div className="form-field" style={{ marginTop: 8 }}>
          <label>Position / Title</label>
          <input type="text" value={m.to_position} readOnly className="readonly" />
        </div>
      </div>

      <div className="form-section">
        <div className="form-row two-col">
          <div className="form-field">
            <label>4. FROM [NAME]</label>
            <input type="text" value={m.sender_name} readOnly className="readonly" />
          </div>
          <div className="form-field">
            <label>POSITION / TITLE</label>
            <input type="text" value={m.sender_position} readOnly className="readonly" />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-field">
          <label>5. SUBJECT</label>
          <input type="text" value={m.subject} readOnly className="readonly" />
        </div>
      </div>

      <div className="form-section">
        <div className="form-field">
          <label>6. MESSAGE</label>
          <textarea className="large" value={m.message} readOnly disabled />
        </div>
      </div>

      <div className="form-section signature-section">
        <label>7. APPROVED BY</label>
        <div className="sig-row">
          <div className="sig-field num">Name</div>
          <div className="sig-field">
            <input
              type="text"
              value={approvedByName}
              onChange={(e) => setApprovedByName(e.target.value)}
              disabled={!canEditSign}
            />
          </div>
          <div className="sig-field">
            <label>Position / Title:</label>
            <input
              type="text"
              value={approvedByPosition}
              onChange={(e) => setApprovedByPosition(e.target.value)}
              disabled={!canEditSign}
            />
          </div>
          <div className="sig-field">
            <label>Signature:</label>
            <input
              type="text"
              value={approvedBySig}
              onChange={(e) => setApprovedBySig(e.target.value)}
              disabled={!canEditSign}
            />
          </div>
        </div>
        <div className="form-row two-col" style={{ marginTop: 8 }}>
          <div className="form-field">
            <label>Date</label>
            <input
              type="date"
              value={approvedDate}
              onChange={(e) => setApprovedDate(e.target.value)}
              disabled={!canEditSign}
            />
          </div>
          <div className="form-field">
            <label>Time</label>
            <input
              type="time"
              value={approvedTime}
              onChange={(e) => setApprovedTime(e.target.value)}
              disabled={!canEditSign}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-field">
          <label>8. REPLY</label>
          <textarea
            className="large"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={!canEditSign}
            placeholder={canEditSign ? 'Enter reply message here...' : ''}
          />
        </div>
      </div>

      <div className="form-section signature-section">
        <label>9. RECEIVED BY</label>
        <div className="sig-row">
          <div className="sig-field num">Name</div>
          <div className="sig-field">
            <input
              type="text"
              value={receivedByName}
              onChange={(e) => setReceivedByName(e.target.value)}
              disabled={!canEditSign}
            />
          </div>
          <div className="sig-field">
            <label>Position / Title:</label>
            <input
              type="text"
              value={receivedByPosition}
              onChange={(e) => setReceivedByPosition(e.target.value)}
              disabled={!canEditSign}
            />
          </div>
          <div className="sig-field">
            <label>Signature:</label>
            <input
              type="text"
              value={receivedBySig}
              onChange={(e) => setReceivedBySig(e.target.value)}
              disabled={!canEditSign}
            />
          </div>
        </div>
        {canEditSign && (
          <div className="msg-sign-actions">
            <button className="action-btn submit" onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving...' : 'Save signatures'}
            </button>
            {!dirty && <span className="msg-sign-hint">Sections 7–9 are yours to complete.</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The mailbox itself
// ---------------------------------------------------------------------------

const BOX_OF: Record<string, string> = { inbox: 'inbox', sent: 'sent', archive: 'archived', trash: 'trashed' }

/** Which of my two copies this folder refers to — the one the action should hit. */
function activeSide(m: AppMessage, userId: string, folder: MailFolderKey): 'sender' | 'recipient' | null {
  const isSender = m.sender_user_id === userId
  const isRecipient = m.recipient_user_id === userId && m.status === 'Sent'
  if (!isSender && !isRecipient) return null

  if (folder === 'sent' || folder === 'drafts') return isSender ? 'sender' : null
  if (folder === 'inbox') return isRecipient ? 'recipient' : isSender ? 'sender' : null

  if (folder === 'archive' || folder === 'trash') {
    const box = BOX_OF[folder]
    if (isRecipient && m.recipient_box === box && !m.recipient_folder_id) return 'recipient'
    if (isSender && m.sender_box === box && !m.sender_folder_id) return 'sender'
    return null
  }

  if (folder.startsWith('f:')) {
    const folderId = folder.slice(2)
    if (isRecipient && m.recipient_folder_id === folderId) return 'recipient'
    if (isSender && m.sender_folder_id === folderId) return 'sender'
  }
  return null
}

export default function MessagesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const mailbox = useMailbox(user?.id)

  const folder = (searchParams.get('folder') ?? 'inbox') as MailFolderKey
  const selectedId = searchParams.get('msg')
  const search = searchParams.get('q') ?? ''

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')

  const setParam = (key: string, value: string | null, replace = false) => {
    const next = new URLSearchParams(searchParams)
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace })
  }

  /** Switching folders clears the open message — otherwise the list changes but the reading pane still shows whatever was selected. */
  const changeFolder = (key: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (key) next.set('folder', key)
    else next.delete('folder')
    next.delete('msg')
    setSearchParams(next)
  }

  const userId = user?.id ?? ''
  const list = useMemo(
    () => mailbox.messages.filter((m) => isInFolder(m, userId, folder) && matchesSearch(m, search)),
    [mailbox.messages, userId, folder, search],
  )
  const selected = selectedId ? (mailbox.messages.find((m) => m.id === selectedId) ?? null) : null

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const key of [...SYSTEM_FOLDERS.map((f) => f.key), ...mailbox.folders.map((f) => `f:${f.id}`)]) {
      map.set(key, mailbox.messages.filter((m) => isInFolder(m, userId, key as MailFolderKey)).length)
    }
    return map
  }, [mailbox.messages, mailbox.folders, userId])

  // Opening a message is what marks it read. Guarded on `isUnread` so the
  // patch below ends the loop on the next render.
  const selectedUnread = selected ? isUnread(selected, userId) : false
  useEffect(() => {
    if (!selectedId || !selectedUnread) return
    markMessageRead(selectedId).then(() =>
      mailbox.patch(selectedId, { read_at: new Date().toISOString() }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedUnread])

  const thread = useMemo(() => {
    if (!selected) return []
    const byId = new Map(mailbox.messages.map((m) => [m.id, m]))
    return buildThread(threadRootId(selected, byId), mailbox.messages)
  }, [selected, mailbox.messages])

  const side = selected ? activeSide(selected, userId, folder) : null
  /**
   * Which copy the toolbar acts on. `side` is the one this folder refers to;
   * when it is null (a message reached through a thread that spans folders, or
   * a direct ?msg= link) fall back to whichever copy actually belongs to us.
   */
  const targetSide: 'sender' | 'recipient' | null = selected
    ? side ?? (selected.sender_user_id === userId ? 'sender' : 'recipient')
    : null
  const signable = selected ? canSign(selected, userId) : false
  const isDraftRow = selected?.status === 'Draft'

  const doMove = async (box: string, folderId: string | null) => {
    if (!selected || busy || !targetSide) return
    setBusy(true)
    setError('')
    const err = await moveMessage(selected.id, targetSide, box, folderId)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    // The message has left this folder, so stop showing it in the pane —
    // otherwise the toolbar would still offer actions for a folder it is no
    // longer in.
    setParam('msg', null, true)
    await mailbox.refresh()
  }

  const handleDelete = async () => {
    if (!selected || busy) return

    // Only the sender can destroy the row — RLS enforces that, so the button
    // for a recipient offers a trash move instead (handled by doMove).
    if (targetSide !== 'sender') {
      const ok = window.confirm('Move this message to Trash? You can restore it from there.')
      if (!ok) return
      await doMove('trashed', null)
      return
    }

    const ok = window.confirm(
      'Delete this message permanently?\n\nIt will be removed for you AND for the person you sent it to. This cannot be undone.',
    )
    if (!ok) return

    setBusy(true)
    setError('')
    const err = await deleteMessage(selected.id)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setParam('msg', null)
    await mailbox.refresh()
  }

  const addFolder = async () => {
    if (!user) return
    const { id, error: err } = await createFolder(user.id, newFolderName)
    if (err) {
      setError(err)
      return
    }
    setError('')
    setNewFolderName('')
    setShowNewFolder(false)
    if (id) {
      mailbox.addFolder({ id, user_id: user.id, name: newFolderName.trim(), created_at: new Date().toISOString() })
    }
  }

  const saveFolderRename = async () => {
    if (!editingFolderId) return
    const err = await renameFolder(editingFolderId, editingFolderName)
    if (err) {
      setError(err)
      return
    }
    mailbox.renameLocalFolder(editingFolderId, editingFolderName.trim())
    setEditingFolderId(null)
    setError('')
  }

  const removeFolder = async (id: string, name: string) => {
    const ok = window.confirm(
      `Delete the folder "${name}"?\n\nMessages inside it are not deleted — they go back to Inbox or Sent.`,
    )
    if (!ok) return
    const err = await deleteFolder(id)
    if (err) {
      setError(err)
      return
    }
    mailbox.dropFolder(id)
    if (folder === `f:${id}`) changeFolder(null)
    setError('')
  }

  if (!user) return null

  if (mailbox.loading) {
    return (
      <div className="msg-page">
        <div className="ics213-loading">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="msg-page">
      <header className="msg-header no-print">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="msg-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate('/dashboard')}>&larr; Dashboard</button>
          <span className="form-badge">ICS 213</span>
          <span className="list-title">Messages</span>
        </div>
        <div className="topbar-actions">
          <input
            className="msg-search"
            type="search"
            placeholder="Search subject, sender, message..."
            value={search}
            onChange={(e) => setParam('q', e.target.value, true)}
          />
          <button className="action-btn submit" onClick={() => navigate('/messages/compose')}>
            + New message
          </button>
        </div>
      </div>

      <main className="msg-main no-print">
        {error && <div className="error-message">{error}</div>}

        <div className="msg-layout">
          {/* Folder rail ------------------------------------------------- */}
          <nav className="msg-rail">
            <ul className="msg-folder-list">
              {SYSTEM_FOLDERS.map((f) => (
                <li key={f.key}>
                  <button
                    className={`msg-folder ${folder === f.key ? 'active' : ''}`}
                    onClick={() => changeFolder(f.key)}
                  >
                    <span className="msg-folder-icon" aria-hidden="true">{f.icon}</span>
                    <span className="msg-folder-name">{f.label}</span>
                    {(counts.get(f.key) ?? 0) > 0 && (
                      <span className="msg-folder-count">{counts.get(f.key)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <div className="msg-rail-section">
              <span className="msg-rail-title">My folders</span>
            </div>

            {mailbox.folders.length === 0 ? (
              <p className="msg-rail-empty">No folders yet.</p>
            ) : (
              <ul className="msg-folder-list">
                {mailbox.folders.map((f) => (
                  <li key={f.id} className="msg-folder-row">
                    {editingFolderId === f.id ? (
                      <span className="msg-folder-edit">
                        <input
                          autoFocus
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveFolderRename()
                            if (e.key === 'Escape') setEditingFolderId(null)
                          }}
                        />
                        <button className="msg-mini-btn" onClick={saveFolderRename} title="Save">✓</button>
                      </span>
                    ) : (
                      <>
                        <button
                          className={`msg-folder ${folder === `f:${f.id}` ? 'active' : ''}`}
                          onClick={() => changeFolder(`f:${f.id}`)}
                        >
                          <span className="msg-folder-icon" aria-hidden="true">📁</span>
                          <span className="msg-folder-name">{f.name}</span>
                          {(counts.get(`f:${f.id}`) ?? 0) > 0 && (
                            <span className="msg-folder-count">{counts.get(`f:${f.id}`)}</span>
                          )}
                        </button>
                        <span className="msg-folder-tools">
                          <button
                            className="msg-mini-btn"
                            title="Rename folder"
                            onClick={() => {
                              setEditingFolderId(f.id)
                              setEditingFolderName(f.name)
                            }}
                          >
                            ✎
                          </button>
                          <button
                            className="msg-mini-btn"
                            title="Delete folder"
                            onClick={() => removeFolder(f.id, f.name)}
                          >
                            ×
                          </button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {showNewFolder ? (
              <div className="msg-new-folder">
                <input
                  autoFocus
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addFolder()
                    if (e.key === 'Escape') setShowNewFolder(false)
                  }}
                />
                <div className="msg-new-folder-actions">
                  <button className="msg-mini-btn" onClick={addFolder}>Add</button>
                  <button className="msg-mini-btn" onClick={() => setShowNewFolder(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="msg-add-folder" onClick={() => setShowNewFolder(true)}>
                + New folder
              </button>
            )}
          </nav>

          {/* List -------------------------------------------------------- */}
          <section className="msg-list">
            {list.length === 0 ? (
              <div className="empty-state">
                <p>
                  {search
                    ? 'No messages match your search.'
                    : folder === 'inbox'
                      ? 'Your inbox is empty.'
                      : `Nothing in ${folder.startsWith('f:') ? 'this folder' : folder}.`}
                </p>
                <button className="action-btn submit" onClick={() => navigate('/messages/compose')}>
                  + New message
                </button>
              </div>
            ) : (
              <ul className="msg-rows">
                {list.map((m) => {
                  const unread = isUnread(m, userId)
                  const mine = m.sender_user_id === userId
                  return (
                    <li key={m.id}>
                      <button
                        className={`msg-row ${selectedId === m.id ? 'active' : ''} ${unread ? 'unread' : ''}`}
                        onClick={() => setParam('msg', m.id)}
                      >
                        <span className="msg-row-dot" aria-hidden="true">{unread ? '●' : ''}</span>
                        <span className="msg-row-body">
                          <span className="msg-row-top">
                            <span className="msg-row-name">
                              {mine ? `To: ${m.to_name || '—'}` : m.sender_name || '—'}
                            </span>
                            <span className="msg-row-date">
                              {new Date(m.created_at).toLocaleDateString()}
                            </span>
                          </span>
                          <span className="msg-row-subject">
                            {m.subject || '(no subject)'}
                            {m.status === 'Draft' && <span className="msg-tag draft">Draft</span>}
                            {m.status === 'Sent' && mine && (
                              <span className={`msg-tag ${m.read_at ? 'read' : 'sent'}`}>
                                {m.read_at ? 'Read' : 'Unread'}
                              </span>
                            )}
                            {m.parent_id && <span className="msg-tag reply">↩</span>}
                          </span>
                          <span className="msg-row-snippet">{m.message}</span>
                          <span className="msg-row-incident">{m.incident_name}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Reading pane ------------------------------------------------ */}
          <section className="msg-reader">
            {!selected ? (
              <div className="empty-state">
                <p>Select a message to read it.</p>
              </div>
            ) : (
              <>
                <div className="msg-reader-bar">
                  <div className="msg-reader-bar-left">
                    {isDraftRow ? (
                      <button
                        className="action-btn edit"
                        onClick={() => navigate(`/messages/compose?draft=${selected.id}`)}
                      >
                        Continue editing
                      </button>
                    ) : (
                      <button
                        className="action-btn submit"
                        onClick={() => navigate(`/messages/compose?reply=${selected.id}`)}
                      >
                        Reply
                      </button>
                    )}
                    <button className="action-btn print" onClick={() => setShowPrint(true)}>
                      Print
                    </button>
                    {!isDraftRow && (
                      <>
                        <button
                          className="action-btn save"
                          disabled={busy || !targetSide}
                          onClick={() => doMove('archived', null)}
                          title="Archive hides it from Inbox but keeps it"
                        >
                          Archive
                        </button>
                        <select
                          className="msg-move-select"
                          value=""
                          disabled={busy || !targetSide}
                          onChange={(e) => {
                            const value = e.target.value
                            if (!value) return
                            if (value === 'inbox') doMove('inbox', null)
                            else if (value === 'sent') doMove('sent', null)
                            else if (value === 'archive') doMove('archived', null)
                            else if (value === 'trash') doMove('trashed', null)
                            else if (value.startsWith('f:')) {
                              doMove(targetSide === 'sender' ? 'sent' : 'inbox', value.slice(2))
                            }
                          }}
                        >
                          <option value="">Move to…</option>
                          {targetSide === 'recipient' && <option value="inbox">Inbox</option>}
                          {targetSide === 'sender' && <option value="sent">Sent</option>}
                          <option value="archive">Archive</option>
                          <option value="trash">Trash</option>
                          {mailbox.folders.length > 0 && (
                            <optgroup label="Folders">
                              {mailbox.folders.map((f) => (
                                <option key={f.id} value={`f:${f.id}`}>{f.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </>
                    )}
                    <button className="action-btn delete" disabled={busy} onClick={handleDelete}>
                      {targetSide === 'sender' ? 'Delete' : 'Trash'}
                    </button>
                  </div>
                </div>

                {thread.length > 1 && (
                  <div className="msg-thread">
                    <span className="msg-thread-title">
                      Conversation ({thread.length})
                    </span>
                    {thread.map((t) => (
                      <button
                        key={t.id}
                        className={`msg-thread-chip ${t.id === selected.id ? 'active' : ''}`}
                        onClick={() => setParam('msg', t.id)}
                        title={t.subject}
                      >
                        {t.sender_name || '—'} · {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    ))}
                  </div>
                )}

                <div className="msg-doc-scroll">
                  <MessageDocument
                    key={selected.id}
                    message={selected}
                    canEditSign={signable}
                    onSaved={() => mailbox.refresh()}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {showPrint && selected && (
        <Ics213Print
          incidentName={selected.incident_name}
          msgDate={selected.msg_date}
          msgTime={selected.msg_time}
          toName={selected.to_name}
          toPosition={selected.to_position}
          fromName={selected.sender_name}
          fromPosition={selected.sender_position}
          subject={selected.subject}
          message={selected.message}
          approvedByName={selected.approved_by_name}
          approvedByPosition={selected.approved_by_position}
          approvedBySig={selected.approved_by_sig}
          approvedDate={selected.approved_date}
          approvedTime={selected.approved_time}
          reply={selected.reply}
          receivedByName={selected.received_by_name}
          receivedByPosition={selected.received_by_position}
          receivedBySig={selected.received_by_sig}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}

