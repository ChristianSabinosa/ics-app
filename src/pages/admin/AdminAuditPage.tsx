import { useCallback, useEffect, useState } from 'react'
import { fetchAuditLog, type AdminAuditEntry } from '../../lib/admin'
import './AdminLayout.css'

/** Human labels for the actions written by the admin RPCs. */
const ACTIONS: Record<string, string> = {
  admin_granted: 'Granted system admin',
  admin_revoked: 'Revoked system admin',
  user_suspended: 'Suspended account',
  user_restored: 'Restored account',
  user_deleted: 'Deleted account',
  deletion_request_declined: 'Declined deletion request',
  incident_deleted: 'Deleted incident',
  incident_status_changed: 'Changed incident status',
  participant_set: 'Changed a roster role',
  participant_removed: 'Removed from roster',
  broadcast_sent: 'Sent broadcast',
  setting_updated: 'Changed settings',
}

/**
 * Authority G: the record of everything an administrator did. It is written by
 * the RPCs themselves (there is no insert policy on admin_audit_log), so this
 * page can only read it.
 */
export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setEntries(await fetchAuditLog())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const q = filter.trim().toLowerCase()
  const filtered = q
    ? entries.filter((e) =>
        `${e.action} ${e.actor_email} ${e.target_type} ${e.target_id} ${JSON.stringify(e.detail)}`
          .toLowerCase()
          .includes(q),
      )
    : entries

  return (
    <div className="admin-card">
      <div className="admin-toolbar">
        <h3>Audit log</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="admin-search"
            type="search"
            placeholder="Filter by action, account, target…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter audit log"
          />
          <button className="admin-btn" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-loading">Loading the audit log…</div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">Nothing has been recorded yet.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>By</th>
                <th>Target</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(entry.created_at).toLocaleString()}</td>
                  <td>
                    <span className="admin-badge info">
                      {ACTIONS[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td>{entry.actor_email || <em style={{ color: '#888' }}>deleted account</em>}</td>
                  <td>
                    {entry.target_type || '—'}
                    {entry.target_id && (
                      <div className="admin-mono" style={{ color: '#888', fontSize: '0.78rem' }}>
                        {entry.target_id}
                      </div>
                    )}
                  </td>
                  <td className="admin-detail">
                    {Object.keys(entry.detail ?? {}).length > 0
                      ? JSON.stringify(entry.detail, null, 1)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
