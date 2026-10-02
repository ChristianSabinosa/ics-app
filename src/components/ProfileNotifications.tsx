import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NOTIFICATION_ICONS, notificationRelativeTime } from '../lib/notifications'
import type { AppNotification } from '../lib/types'
import './ProfileNotifications.css'

/** Slice of `useNotifications()` that the profile menu needs. */
export interface NotificationListState {
  unread: AppNotification[]
  count: number
  markRead: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}

interface Props {
  state: NotificationListState
  /** Called after an item is opened so the parent can close the profile menu. */
  onNavigate?: () => void
}

/**
 * Notification list rendered inside the Dashboard profile dropdown (the
 * "Notifications" entry). Each row can be opened or cleared individually, and
 * a Clear all button wipes the whole list.
 */
export default function ProfileNotifications({ state, onNavigate }: Props) {
  const navigate = useNavigate()
  const { unread, count, markRead, remove, clearAll } = state
  const [now, setNow] = useState(() => Date.now())

  // Keep the relative timestamps fresh while the menu is open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const open = async (item: AppNotification) => {
    await markRead(item.id)
    onNavigate?.()
    if (item.link) navigate(item.link)
  }

  const clearOne = async (event: React.MouseEvent, item: AppNotification) => {
    event.stopPropagation()
    await remove(item.id)
  }

  return (
    <div className="profile-notifs">
      <div className="profile-notifs-head">
        <span className="profile-notifs-title">
          Notifications{count > 0 && <span className="profile-notifs-count">{count}</span>}
        </span>
        {count > 0 && (
          <button
            type="button"
            className="profile-notifs-clear-all"
            onClick={() => clearAll()}
          >
            Clear all
          </button>
        )}
      </div>

      {count === 0 ? (
        <p className="profile-notifs-empty">You're all caught up.</p>
      ) : (
        <ul className="profile-notifs-list">
          {unread.map((item) => (
            <li key={item.id} className="profile-notifs-row">
              <button
                type="button"
                className="profile-notifs-item"
                onClick={() => open(item)}
                title={new Date(item.created_at).toLocaleString()}
              >
                <span className="profile-notifs-icon" aria-hidden="true">
                  {NOTIFICATION_ICONS[item.type] ?? '🔔'}
                </span>
                <span className="profile-notifs-body">
                  <span className="profile-notifs-item-title">{item.title}</span>
                  {item.body && <span className="profile-notifs-item-text">{item.body}</span>}
                  <span className="profile-notifs-time">
                    {notificationRelativeTime(item.created_at, now)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="profile-notifs-clear"
                aria-label={`Clear notification: ${item.title}`}
                title="Clear this notification"
                onClick={(event) => clearOne(event, item)}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
