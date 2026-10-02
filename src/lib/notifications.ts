import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { AppNotification, NotificationType } from './types'

// ============================================================================
// Shared presentation helpers (profile menu list + arrival toast)
// ============================================================================

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  join: '🙋',
  imt_join: '⭐',
  leave: '👋',
  ic_left: '⚠️',
  assigned: '📋',
  ic_assigned: '⭐',
  role_change: '🔁',
  incident_created: '🚨',
  incident_deleted: '🗑️',
  demob_requested: '🧳',
  iap_approved: '✅',
  iap_submitted: '📤',
  message: '✉️',
}

export function notificationRelativeTime(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString()
}

// ============================================================================
// Sending — every call is fire-and-forget: a notification problem must never
// break the join / save / approve action that triggered it.
// ============================================================================

interface RecipientOptions {
  /** Roles to notify. Omit to notify every active participant. */
  roles?: Array<'IMT' | 'Tactical Resources' | 'Observer'>
  /** Never notify this user (the actor who caused the event). */
  excludeUserId?: string
  /**
   * Notify exactly these accounts instead of the whole roster (used for ICS 207
   * assignments). The server still validates they are active participants.
   */
  userIds?: string[]
}

/**
 * Resolves the active participants of an incident who should receive a
 * notification. The server-side function re-validates this list anyway —
 * this is just the client-side selection.
 */
async function activeParticipantUserIds(
  incidentId: string,
  options: RecipientOptions = {},
): Promise<string[]> {
  if (options.userIds && options.userIds.length > 0) {
    // Restrict the given accounts to this incident's active roster.
    const { data, error } = await supabase
      .from('incident_participants')
      .select('user_id')
      .eq('incident_id', incidentId)
      .eq('status', 'Active')
      .in('user_id', options.userIds)
    if (error || !data) return []
    const ids = data.map((p) => p.user_id as string)
    return options.excludeUserId ? ids.filter((id) => id !== options.excludeUserId) : ids
  }

  let query = supabase
    .from('incident_participants')
    .select('user_id, role')
    .eq('incident_id', incidentId)
    .eq('status', 'Active')

  if (options.roles && options.roles.length > 0) {
    query = query.in('role', options.roles)
  }

  const { data, error } = await query
  if (error || !data) return []

  const ids = data.map((p) => p.user_id as string)
  return options.excludeUserId ? ids.filter((id) => id !== options.excludeUserId) : ids
}

interface NotifyInput extends RecipientOptions {
  type: NotificationType
  title: string
  body?: string
  /** Deep link inside the app, e.g. /incident/ICS-20260913-1234/ics-207 */
  link?: string
}

/**
 * Name currently assigned to the Incident Commander seat on the latest ICS 207
 * of an incident (empty string when no 207 exists or the seat is vacant).
 * Matching is by name because ics_207_positions stores person_name, not a user id.
 */
export async function getIncidentCommanderName(incidentId: string): Promise<string> {
  try {
    const { data: form } = await supabase
      .from('ics_207_forms')
      .select('id')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!form) return ''

    const { data: pos } = await supabase
      .from('ics_207_positions')
      .select('person_name')
      .eq('form_id', form.id)
      .eq('position_key', 'ic')
      .maybeSingle()

    return (pos?.person_name ?? '').trim()
  } catch {
    return ''
  }
}

/**
 * Sends one notification to each eligible participant of an incident.
 * Swallows every error — returns true only when the server confirmed delivery.
 */
export async function notifyIncident(
  incidentId: string,
  input: NotifyInput,
): Promise<boolean> {
  try {
    const recipients = await activeParticipantUserIds(incidentId, {
      roles: input.roles,
      excludeUserId: input.excludeUserId,
      userIds: input.userIds,
    })
    if (recipients.length === 0) return false

    const { error } = await supabase.rpc('send_notification', {
      p_incident_id: incidentId,
      p_type: input.type,
      p_title: input.title,
      p_body: input.body ?? '',
      p_link: input.link ?? '',
      p_recipient_ids: recipients,
    })
    if (error) {
      // Most likely supabase-notifications-schema.sql has not been run yet.
      console.warn('[notifications] send failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[notifications] send failed:', err)
    return false
  }
}

interface SelfNotifyInput {
  type: NotificationType
  title: string
  body?: string
  /** Deep link inside the app. Leave unset for a plain confirmation. */
  link?: string
}

/**
 * Sends a notification to the CALLER only — used for confirmations such as
 * "you created this incident".
 *
 * This cannot go through notifyIncident(): that RPC deliberately excludes its
 * sender (p.user_id <> v_sender) and requires the caller to already be an
 * Active participant, neither of which holds when you have just created an
 * incident and have not joined it yet. The separate send_self_notification()
 * therefore authorises against incidents.created_by instead, and the only row
 * it can ever write is recipient = auth.uid(), so there is no spam surface.
 */
export async function notifySelfIncident(
  incidentId: string,
  input: SelfNotifyInput,
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('send_self_notification', {
      p_incident_id: incidentId,
      p_type: input.type,
      p_title: input.title,
      p_body: input.body ?? '',
      p_link: input.link ?? '',
    })
    if (error) {
      // Most likely supabase-notifications-schema.sql has not been run yet.
      console.warn('[notifications] self send failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[notifications] self send failed:', err)
    return false
  }
}

// ============================================================================
// Reading
// ============================================================================

const UNREAD_LIMIT = 50

export async function fetchUnread(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(UNREAD_LIMIT)

  if (error) {
    // Table missing (schema not installed yet) — show nothing instead of crashing.
    if (!/notifications/.test(error.message)) console.warn('[notifications]', error.message)
    return []
  }
  return (data ?? []) as AppNotification[]
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  if (error) console.warn('[notifications] mark read failed:', error.message)
}

/**
 * Clears one notification for good (the per-item "Clear" button).
 * Best effort: the row is already gone from the local list either way.
 */
export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) console.warn('[notifications] delete failed:', error.message)
}

/**
 * Clears every notification addressed to this user (the "Clear all" button).
 * RLS scopes the delete to recipient_user_id = auth.uid(), so this can never
 * touch somebody else's rows.
 */
export async function deleteAllNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('recipient_user_id', userId)
  if (error) console.warn('[notifications] delete all failed:', error.message)
}

// ============================================================================
// Live updates — realtime INSERT stream with a polling fallback (mount,
// window focus and every 60 s) so the list stays correct even when the
// realtime publication was never enabled.
// ============================================================================

export function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<AppNotification[]>([])
  // Which account `items` belongs to — lets a sign-out/sign-in as someone else
  // show an empty list without resetting state inside an effect.
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined)
  const seenRef = useRef<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    if (!userId) return
    const unread = await fetchUnread(userId)
    setOwnerId(userId)
    setItems(unread)
    return unread
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

  // Realtime INSERT stream for this user's notifications.
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications:list:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as AppNotification
          if (!row?.id || seenRef.current.has(row.id)) return
          seenRef.current.add(row.id)

          setOwnerId(userId)
          setItems((prev) =>
            prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, UNREAD_LIMIT),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  /** Opens a notification: clears it from the list and marks it read. */
  const markRead = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((n) => n.id !== id))
      await markNotificationRead(id)
    },
    [],
  )

  /** Per-item Clear — deletes the row permanently. */
  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
    await deleteNotification(id)
  }, [])

  /** Clear all — deletes every notification addressed to this user. */
  const clearAll = useCallback(async () => {
    if (!userId) return
    setItems([])
    await deleteAllNotifications(userId)
  }, [userId])

  // Keep already-seen ids out of the dedupe set on the next refresh.
  useEffect(() => {
    seenRef.current = new Set(items.map((n) => n.id))
  }, [items])

  // Rows still belong to the previously signed-in account until a refresh for
  // the current one lands — treat them as belonging to nobody instead of
  // clearing state from inside an effect.
  const visible = ownerId === userId ? items : []

  return {
    unread: visible,
    count: visible.length,
    markRead,
    remove,
    clearAll,
    refresh,
  }
}

/**
 * Transient arrival toast, subscribed independently of the profile-menu list
 * so notifications still surface on pages where the menu isn't mounted.
 * The channel topic is distinct from the list's to keep the two apart.
 */
export function useNotificationToasts(
  userId: string | undefined,
): { toast: AppNotification | null; dismiss: () => void } {
  const [toast, setToast] = useState<AppNotification | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications:toast:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as AppNotification
          if (!row?.id) return
          setToast(row)
          if (timerRef.current) window.clearTimeout(timerRef.current)
          timerRef.current = window.setTimeout(() => setToast(null), 6000)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      setToast(null)
    }
  }, [userId])

  const dismiss = useCallback(() => {
    setToast(null)
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

  return { toast, dismiss }
}
