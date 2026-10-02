import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotificationToasts, NOTIFICATION_ICONS, markNotificationRead } from '../lib/notifications'
import './NotificationToast.css'

/**
 * Transient popup for a notification that arrives while the app is open.
 * Mounted once in App.tsx — it is only a nudge; the list itself lives in the
 * profile dropdown on the Dashboard.
 */
export default function NotificationToast() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast, dismiss } = useNotificationToasts(user?.id)

  if (!toast) return null

  const open = async () => {
    const target = toast
    dismiss()
    await markNotificationRead(target.id)
    if (target.link) navigate(target.link)
  }

  return (
    <div
      className="notif-toast"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }}
    >
      <span className="notif-toast-icon" aria-hidden="true">
        {NOTIFICATION_ICONS[toast.type] ?? '🔔'}
      </span>
      <span className="notif-toast-body">
        <span className="notif-toast-title">{toast.title}</span>
        {toast.body && <span className="notif-toast-text">{toast.body}</span>}
      </span>
      <button
        type="button"
        className="notif-toast-close"
        aria-label="Dismiss"
        onClick={(event) => {
          event.stopPropagation()
          dismiss()
        }}
      >
        &times;
      </button>
    </div>
  )
}
