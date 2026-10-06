import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { listUsers } from '../../lib/admin'
import './AdminLayout.css'

const TABS = [
  { to: 'users', label: 'Users' },
  { to: 'requests', label: 'Deletion requests' },
  { to: 'incidents', label: 'Incidents' },
  { to: 'broadcast', label: 'Broadcast' },
  { to: 'audit', label: 'Audit log' },
  { to: 'settings', label: 'Settings' },
]

/**
 * Chrome for /admin: brand bar, section title, tab strip, <Outlet>.
 *
 * It also does one cheap diagnostic on mount — admin_list_users() — so that a
 * half-installed schema shows an explicit warning instead of six empty tabs.
 * The pending-deletion count on the "Deletion requests" tab comes from the
 * same call, so nothing is fetched twice.
 */
export default function AdminLayout() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(0)
  const [schemaMissing, setSchemaMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    listUsers()
      .then((rows) => {
        if (cancelled) return
        setPending(rows.filter((r) => r.deletion_requested).length)
        setSchemaMissing(false)
      })
      .catch(() => {
        if (!cancelled) setSchemaMissing(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
        <button className="admin-btn ghost" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </header>

      <main className="admin-main">
        <div className="admin-container">
          <div className="admin-title-row">
            <div>
              <h2>System Administration</h2>
              <p className="admin-subtitle">
                Accounts, incidents and system-wide settings. Every action taken here is written
                to the audit log.
              </p>
            </div>
          </div>

          {schemaMissing && (
            <div className="admin-warning">
              The system-administration schema is not installed yet, so nothing can be managed from
              here. Run <strong>supabase-admin-schema.sql</strong> and then{' '}
              <strong>supabase-admin-guardrails.sql</strong> in the Supabase SQL Editor.
            </div>
          )}

          <nav className="admin-tabs">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) => `admin-tab${isActive ? ' active' : ''}`}
              >
                {tab.label}
                {tab.to === 'requests' && pending > 0 && (
                  <span className="admin-tab-badge">{pending}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <Outlet />
        </div>
      </main>
    </div>
  )
}
