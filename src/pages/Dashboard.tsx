import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { useNotifications } from '../lib/notifications'
import { useUnreadMessageCount } from '../lib/messages'
import ProfileNotifications from '../components/ProfileNotifications'
import { useProfile } from '../lib/profile'
import './Dashboard.css'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Message carried over from a completed action (e.g. leaving an incident / deleting it)
  const [notice, setNotice] = useState(
    () => ((location.state as { notice?: string } | null)?.notice ?? ''),
  )
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Notification list for the profile dropdown — one instance, so there is
  // only one realtime subscription for this page.
  const notifications = useNotifications(user?.id)
  // Unread mail count on the Messages entry below. Its own subscription: the
  // badge has to work on every page, and fetching the whole mailbox just to
  // render a number would be wasteful.
  const unreadMessages = useUnreadMessageCount(user?.id)
  const { profile } = useProfile(user?.id)

  const closeMenu = () => {
    setShowMenu(false)
    setShowNotifications(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const userDisplayName = user?.user_metadata?.first_name || user?.email || 'User'

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-brand">
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
        <div className="header-right">
          <div className="user-menu-container" ref={menuRef}>
            <button className="user-menu-trigger" onClick={() => setShowMenu(!showMenu)}>
              <span className="user-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : userDisplayName.charAt(0).toUpperCase()}</span>
              <span className="user-name">{userDisplayName}</span>
              <span className={`user-menu-arrow ${showMenu ? 'open' : ''}`}>&#9662;</span>
            </button>
            {showMenu && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <span className="dropdown-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : userDisplayName.charAt(0).toUpperCase()}</span>
                  <div className="dropdown-user-info">
                    <span className="dropdown-name">{userDisplayName}</span>
                    <span className="dropdown-email">{user?.email}</span>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={() => { closeMenu(); navigate('/profile') }}>
                  <span className="dropdown-icon">&#128100;</span> Profile
                </button>
                <button
                  className={`dropdown-item ${showNotifications ? 'active' : ''}`}
                  onClick={() => setShowNotifications((open) => !open)}
                >
                  <span className="dropdown-icon">&#128276;</span> Notifications
                  {notifications.count > 0 && (
                    <span className="dropdown-badge">{notifications.count}</span>
                  )}
                  <span className={`dropdown-caret ${showNotifications ? 'open' : ''}`}>&#9662;</span>
                </button>
                {showNotifications && (
                  <ProfileNotifications
                    state={notifications}
                    onNavigate={closeMenu}
                  />
                )}
                <button
                  className="dropdown-item"
                  onClick={() => { closeMenu(); navigate('/messages') }}
                >
                  <span className="dropdown-icon">&#128172;</span> Messages
                  {unreadMessages > 0 && (
                    <span className="dropdown-badge">{unreadMessages}</span>
                  )}
                </button>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item signout" onClick={() => { closeMenu(); handleSignOut() }}>
                  <span className="dropdown-icon">&#10140;</span> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {notice && (
          <div className="dashboard-notice">
            <span>{notice}</span>
            <button className="dashboard-notice-close" onClick={() => setNotice('')} aria-label="Dismiss">
              &times;
            </button>
          </div>
        )}

        <div className="welcome-section">
          <h2>Welcome, {user?.user_metadata?.first_name || 'User'}</h2>
          <p>What would you like to do?</p>
        </div>

        <div className="action-cards">
          <button className="action-card create" onClick={() => navigate('/create-incident')}>
            <div className="action-icon">+</div>
            <h3>Create an Incident</h3>
            <p>Report a new incident and start command operations</p>
          </button>

          <button className="action-card join" onClick={() => navigate('/join-incident')}>
            <div className="action-icon">→</div>
            <h3>Join an Incident</h3>
            <p>Enter an incident code to join an ongoing response</p>
          </button>

          <button className="action-card view" onClick={() => navigate('/ongoing-incidents')}>
            <div className="action-icon">≡</div>
            <h3>View Ongoing Incidents</h3>
            <p>Monitor all active incidents in the municipality</p>
          </button>
        </div>
      </main>
    </div>
  )
}
