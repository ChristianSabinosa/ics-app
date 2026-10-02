import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { AppMessage, MessageFolder, MessageIncident } from './types'

// ============================================================================
// Folder keys
//
// Inbox / Sent / Drafts / Archive / Trash are computed views, never rows —
// only user-created folders exist in message_folders. `f:<id>` is one of those.
// ============================================================================

export type MailFolderKey = 'inbox' | 'sent' | 'drafts' | 'archive' | 'trash' | `f:${string}`

export const SYSTEM_FOLDERS: Array<{ key: MailFolderKey; label: string; icon: string }> = [
  { key: 'inbox', label: 'Inbox', icon: '📥' },
  { key: 'drafts', label: 'Drafts', icon: '📝' },
  { key: 'sent', label: 'Sent', icon: '📤' },
  { key: 'archive', label: 'Archive', icon: '🗄️' },
  { key: 'trash', label: 'Trash', icon: '🗑️' },
]

/**
 * Which copy of a message belongs to this account.
 *
 * A self-addressed message returns BOTH views — it is legitimately in Sent and
 * in Inbox, and the two boxes are tracked independently.
 */
export function myBoxes(m: AppMessage, userId: string): Array<{ box: string; folderId: string | null }> {
  const views: Array<{ box: string; folderId: string | null }> = []

  if (m.sender_user_id === userId) {
    // A draft is its own system view; it never reaches anyone else's inbox.
    if (m.status === 'Draft') views.push({ box: 'drafts', folderId: null })
    else views.push({ box: m.sender_box, folderId: m.sender_folder_id })
  }

  if (m.recipient_user_id === userId && m.status === 'Sent') {
    views.push({ box: m.recipient_box, folderId: m.recipient_folder_id })
  }

  return views
}

export function isInFolder(m: AppMessage, userId: string, key: MailFolderKey): boolean {
  const views = myBoxes(m, userId)

  if (key.startsWith('f:')) {
    const folderId = key.slice(2)
    return views.some((v) => v.box !== 'drafts' && v.folderId === folderId)
  }
  if (key === 'drafts') return views.some((v) => v.box === 'drafts')
  // System boxes only ever hold messages that are not filed into a custom folder.
  return views.some((v) => v.box === key && v.folderId === null)
}

/** Unread means: addressed to me, arrived, still sitting in Inbox, never opened. */
export function isUnread(m: AppMessage, userId: string): boolean {
  return (
    m.recipient_user_id === userId &&
    m.status === 'Sent' &&
    m.read_at === null &&
    m.recipient_box === 'inbox' &&
    m.recipient_folder_id === null
  )
}

/** True when this account is allowed to fill in ICS 213 sections 7 and 9. */
export function canSign(m: AppMessage, userId: string): boolean {
  if (m.sender_user_id === userId) return true
  return m.recipient_user_id === userId && m.status === 'Sent'
}

export function matchesSearch(m: AppMessage, term: string): boolean {
  if (!term) return true
  const needle = term.toLowerCase()
  return [m.subject, m.message, m.sender_name, m.to_name, m.incident_name].some((field) =>
    (field ?? '').toLowerCase().includes(needle),
  )
}

// ============================================================================
// Thread helpers — replies hang off parent_id, so a "conversation" is every
// message sharing the same root.
// ============================================================================

export function threadRootId(m: AppMessage, byId: Map<string, AppMessage>): string {
  let cursor = m
  const guard = new Set<string>()
  while (cursor.parent_id && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    const parent = byId.get(cursor.parent_id)
    if (!parent) return cursor.parent_id
    cursor = parent
  }
  return cursor.id
}

export function buildThread(rootId: string, all: AppMessage[]): AppMessage[] {
  const byId = new Map(all.map((m) => [m.id, m]))
  return all
    .filter((m) => threadRootId(m, byId) === rootId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

// ============================================================================
// Loading
// ============================================================================

const MAILBOX_LIMIT = 500

/**
 * Everything the signed-in account can see. Row-level security already scopes
 * this to "my sent messages plus messages addressed to me once they are sent",
 * so there is no second filter to get wrong — and folder switching, search and
 * unread counts become instant instead of a round trip each.
 */
export async function fetchMailbox(userId: string): Promise<AppMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAILBOX_LIMIT)

  if (error) {
    // Table missing (schema not installed yet) — show nothing instead of crashing.
    if (!/messages/.test(error.message)) console.warn('[messages]', error.message)
    return []
  }
  void userId
  return (data ?? []) as AppMessage[]
}

export async function fetchFolders(userId: string): Promise<MessageFolder[]> {
  const { data, error } = await supabase
    .from('message_folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    if (!/message_folders/.test(error.message)) console.warn('[messages]', error.message)
    return []
  }
  return (data ?? []) as MessageFolder[]
}

export interface RecipientCandidate {
  id: string
  name: string
  email: string
  role: string
  /** True when this account is an Active participant of the incident being composed against. */
  inIncident: boolean
}

/**
 * Every account that can be addressed.
 *
 * There is no profiles table, so users are reconstructed from incident
 * participation (which carries user_name / user_email / role) plus the
 * creators of incidents, since somebody who created but never joined an
 * incident appears in neither an active roster.
 *
 * `inIncident` only affects presentation — the picker lists shared incidents
 * first — because addressing is deliberately open to any signed-in account.
 */
export async function fetchRecipients(
  excludeUserId: string,
  incidentId?: string,
): Promise<RecipientCandidate[]> {
  const byId = new Map<string, RecipientCandidate>()

  const [{ data: participants }, { data: incidents }] = await Promise.all([
    supabase
      .from('incident_participants')
      .select('user_id, user_name, user_email, role, status')
      .order('status', { ascending: true }), // 'Active' sorts before 'Left'
    supabase.from('incidents').select('created_by, created_by_name, created_by_email'),
  ])

  for (const p of participants ?? []) {
    if (!p.user_id || p.user_id === excludeUserId || byId.has(p.user_id)) continue
    byId.set(p.user_id, {
      id: p.user_id,
      name: (p.user_name ?? '').trim(),
      email: (p.user_email ?? '').trim(),
      role: (p.role ?? '').trim(),
      inIncident: false,
    })
  }

  for (const i of incidents ?? []) {
    if (!i.created_by || i.created_by === excludeUserId || byId.has(i.created_by)) continue
    byId.set(i.created_by, {
      id: i.created_by,
      name: (i.created_by_name ?? '').trim(),
      email: (i.created_by_email ?? '').trim(),
      role: 'IMT',
      inIncident: false,
    })
  }

  if (incidentId) {
    const { data: roster } = await supabase
      .from('incident_participants')
      .select('user_id')
      .eq('incident_id', incidentId)
      .eq('status', 'Active')
    for (const r of roster ?? []) {
      const found = byId.get(r.user_id)
      if (found) found.inIncident = true
    }
  }

  return Array.from(byId.values()).filter((r) => r.name || r.email)
    .sort((a, b) => Number(b.inIncident) - Number(a.inIncident) || a.name.localeCompare(b.name))
}

/** Incidents this account can attach a message to: the ones it belongs to plus the ones it created. */
export async function fetchMyIncidents(userId: string): Promise<MessageIncident[]> {
  const [{ data: mine }, { data: created }] = await Promise.all([
    supabase.from('incident_participants').select('incident_id').eq('user_id', userId),
    supabase.from('incidents').select('incident_id, name').eq('created_by', userId),
  ])

  const ids = new Set<string>()
  for (const p of mine ?? []) ids.add(p.incident_id)
  for (const c of created ?? []) ids.add(c.incident_id)
  if (ids.size === 0) return []

  const { data, error } = await supabase
    .from('incidents')
    .select('incident_id, name')
    .in('incident_id', Array.from(ids))
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[messages]', error.message)
    return []
  }
  return (data ?? []) as MessageIncident[]
}

// ============================================================================
// Folders
// ============================================================================

export async function createFolder(
  userId: string,
  name: string,
): Promise<{ id: string | null; error: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { id: null, error: 'Enter a folder name.' }

  const { data, error } = await supabase
    .from('message_folders')
    .insert({ user_id: userId, name: trimmed })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { id: null, error: 'You already have a folder with that name.' }
    return { id: null, error: error.message }
  }
  return { id: data.id as string, error: '' }
}

export async function renameFolder(id: string, name: string): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) return 'Enter a folder name.'
  const { error } = await supabase.from('message_folders').update({ name: trimmed }).eq('id', id)
  if (error) {
    if (error.code === '23505') return 'You already have a folder with that name.'
    return error.message
  }
  return ''
}

/**
 * Deletes a folder and returns its messages to their system box.
 * Goes through delete_my_folder(): a plain DELETE would fire ON DELETE SET NULL
 * as the caller, which the sender-only update policy on messages blocks for
 * every row where they are only the recipient.
 */
export async function deleteFolder(id: string): Promise<string> {
  const { error } = await supabase.rpc('delete_my_folder', { p_folder_id: id })
  return error?.message ?? ''
}

// ============================================================================
// Reading / writing messages
// ============================================================================

export async function markMessageRead(id: string): Promise<string> {
  const { error } = await supabase.rpc('mark_message_read', { p_message_id: id })
  return error?.message ?? ''
}

export async function moveMessage(
  id: string,
  side: 'sender' | 'recipient',
  box: string,
  folderId: string | null,
): Promise<string> {
  const { error } = await supabase.rpc('move_message', {
    p_message_id: id,
    p_side: side,
    p_box: box,
    p_folder_id: folderId,
  })
  return error?.message ?? ''
}

/**
 * Removes the row for good. Only the sender can do this — RLS enforces it —
 * so a recipient trashes their copy instead of destroying the sender's.
 * Verifies afterwards, because a delete silently blocked by RLS reports no error.
 */
export async function deleteMessage(id: string): Promise<string> {
  const { error } = await supabase.from('messages').delete().eq('id', id)
  if (error) return error.message

  const { data: stillThere } = await supabase
    .from('messages')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (stillThere) {
    return 'This message could not be deleted — only the person who sent it can remove it permanently. Move it to Trash instead.'
  }
  return ''
}

export interface MessagePayload {
  incident_id: string
  incident_name: string
  parent_id: string | null
  recipient_user_id: string
  to_name: string
  to_position: string
  sender_user_id: string
  sender_name: string
  sender_position: string
  msg_date: string
  msg_time: string
  subject: string
  message: string
}

interface SaveResult {
  id: string | null
  error: string
}

/**
 * Writes the row. `status: 'Sent'` is what makes it visible to the addressee —
 * the read policy requires it — so a draft can be saved and re-opened without
 * anybody receiving it half-finished.
 */
export async function saveMessage(
  payload: MessagePayload,
  status: 'Draft' | 'Sent',
  existingId: string | null,
): Promise<SaveResult> {
  const row = { ...payload, status, updated_at: new Date().toISOString() }

  if (existingId) {
    const { error } = await supabase.from('messages').update(row).eq('id', existingId)
    if (error) return { id: null, error: error.message }
    return { id: existingId, error: '' }
  }

  const { data, error } = await supabase.from('messages').insert(row).select('id').single()
  if (error) return { id: null, error: error.message }
  return { id: data.id as string, error: '' }
}

/**
 * Arrival notice. Fire-and-forget: a notification problem must never lose the
 * message that was already written. Self-addressed messages skip it (the
 * server returns 0 anyway — nobody needs telling about their own mail).
 */
export async function notifyMessage(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('notify_message', { p_message_id: id })
    if (error) {
      console.warn('[messages] notify failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[messages] notify failed:', err)
    return false
  }
}

export interface SignaturePayload {
  approved_by_name: string
  approved_by_position: string
  approved_by_sig: string
  approved_date: string
  approved_time: string
  reply: string
  received_by_name: string
  received_by_position: string
  received_by_sig: string
}

/**
 * ICS 213 sections 7 (Approved by), 8 (Reply) and 9 (Received by).
 * The recipient has no UPDATE policy on messages, so these three blocks come
 * back through an RPC that only touches these columns — the subject and body
 * the sender wrote can never be rewritten by whoever received them.
 */
export async function fillMessageSections(
  id: string,
  payload: SignaturePayload,
): Promise<string> {
  const { error } = await supabase.rpc('fill_message_sections', {
    p_message_id: id,
    p_approved_by_name: payload.approved_by_name,
    p_approved_by_position: payload.approved_by_position,
    p_approved_by_sig: payload.approved_by_sig,
    p_approved_date: payload.approved_date,
    p_approved_time: payload.approved_time,
    p_reply: payload.reply,
    p_received_by_name: payload.received_by_name,
    p_received_by_position: payload.received_by_position,
    p_received_by_sig: payload.received_by_sig,
  })
  return error?.message ?? ''
}

// ============================================================================
// Live updates — realtime INSERT/UPDATE stream with the same polling fallback
// (mount, window focus, every 60 s) the notifications hook uses, so the mailbox
// stays correct even when the realtime publication was never enabled.
// ============================================================================

export function useMailbox(userId: string | undefined) {
  const [messages, setMessages] = useState<AppMessage[]>([])
  const [folders, setFolders] = useState<MessageFolder[]>([])
  const [loading, setLoading] = useState(true)
  // Which account `messages` belongs to — lets a sign-out/sign-in as someone
  // else show an empty mailbox without resetting state inside an effect.
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined)
  const seenRef = useRef<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    if (!userId) return
    const [nextMessages, nextFolders] = await Promise.all([
      fetchMailbox(userId),
      fetchFolders(userId),
    ])
    setOwnerId(userId)
    setMessages(nextMessages)
    setFolders(nextFolders)
    setLoading(false)
  }, [userId])

  // Initial load + focus/interval polling.
  useEffect(() => {
    if (!userId) return
    refresh()

    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    const interval = window.setInterval(() => refresh(), 60_000)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(interval)
    }
  }, [userId, refresh])

  // Realtime stream. No column filter: Supabase applies row-level security to
  // realtime, which already yields exactly these rows — and a filter cannot
  // express "sender = me OR recipient = me" anyway.
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`messages:mailbox:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        refresh()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        refresh()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, () => {
        refresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  /** Local-only mutations so the list reacts before the round trip lands. */
  const patch = useCallback((id: string, changes: Partial<AppMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)))
  }, [])

  const remove = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const addFolder = useCallback((folder: MessageFolder) => {
    setFolders((prev) => [...prev, folder])
  }, [])

  const dropFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const renameLocalFolder = useCallback((id: string, name: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)))
  }, [])

  // Keep already-seen ids out of the dedupe set on the next refresh.
  useEffect(() => {
    seenRef.current = new Set(messages.map((m) => m.id))
  }, [messages])

  const visible = ownerId === userId ? messages : []

  return {
    messages: visible,
    folders: ownerId === userId ? folders : [],
    loading,
    refresh,
    patch,
    remove,
    addFolder,
    dropFolder,
    renameLocalFolder,
  }
}

/**
 * Unread count for the Dashboard profile dropdown.
 *
 * Deliberately its own subscription: the dropdown badge must work on every
 * page, and fetching the whole mailbox just to render a number would be
 * wasteful. `head: true` makes this a count-only query.
 */
export function useUnreadMessageCount(userId: string | undefined): number {
  const [count, setCount] = useState(0)
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined)

  const refresh = useCallback(async () => {
    if (!userId) return
    const { count: next, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .eq('status', 'Sent')
      .eq('recipient_box', 'inbox')
      .is('recipient_folder_id', null)
      .is('read_at', null)

    if (error) {
      if (!/messages/.test(error.message)) console.warn('[messages]', error.message)
      return
    }
    setOwnerId(userId)
    setCount(next ?? 0)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    refresh()

    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    const interval = window.setInterval(() => refresh(), 60_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(interval)
    }
  }, [userId, refresh])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`messages:badge:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        refresh()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        refresh()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  return ownerId === userId ? count : 0
}
