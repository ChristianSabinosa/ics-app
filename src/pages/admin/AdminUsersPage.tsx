import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import ConfirmModal from '../../components/ConfirmModal'
import {
  finalizeAccountDeletion,
  listUsers,
  setSystemAdmin,
  setSuspended,
  type AdminUser,
} from '../../lib/admin'
import './AdminLayout.css'

function displayName(u: AdminUser) {
  const name = `${u.first_name} ${u.last_name}`.trim()
  return name || u.email.split('@')[0] || 'Unnamed account'
}

/**
 * Authority A + B: the user directory.
 *
 *   - list every account with the state that matters (admin, suspended,
 *     deletion requested);
 *   - nominate or revoke system admins;
 *   - suspend / restore (the lock-out is enforced by the database);
 *   - approve a pending deletion with a full cascade.
 *
 * The last two go through ConfirmModal, which asks for the account password
 * again before anything irreversible happens.
 */
export default function AdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // Account waiting for the password-confirmed destructive delete.
  const [deleting, setDeleting] = useState<AdminUser | null>(null)
  // Account being suspended, plus the reason collected in the modal.
  const [suspending, setSuspending] = useState<AdminUser | null>(null)
  const [suspendReason, setSuspendReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setUsers(await listUsers())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (id: string, action: () => Promise<void>, after?: () => void) => {
    setError('')
    setNotice('')
    setBusyId(id)
    try {
      await action()
      after?.()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  const toggleAdmin = (u: AdminUser) =>
    run(u.id, () => setSystemAdmin(u.id, !u.is_system_admin), () =>
      setNotice(
        u.is_system_admin
          ? `${u.email} is no longer a system admin.`
          : `${u.email} is now a system admin.`,
      ),
    )

  const confirmSuspend = async () => {
    const target = suspending
    if (!target) return
    const reason = suspendReason
    setSuspending(null)
    setSuspendReason('')
    await run(target.id, () => setSuspended(target.id, true, reason), () =>
      setNotice(`${target.email} has been suspended and signed out of every session.`),
    )
  }

  const restore = (u: AdminUser) =>
    run(u.id, () => setSuspended(u.id, false), () =>
      setNotice(`${u.email} has been restored.`),
    )

  const confirmDelete = async () => {
    const target = deleting
    if (!target) return
    setDeleting(null)
    await run(target.id, async () => {
      const summary = await finalizeAccountDeletion(target.id, 'Approved from the Users tab')
      const incidents = summary.incidents_deleted ?? 0
      setNotice(
        `${target.email} has been deleted permanently` +
          (incidents > 0 ? ` together with ${incidents} incident${incidents === 1 ? '' : 's'}` : '') +
          '.',
      )
    })
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? users.filter((u) =>
        `${u.email} ${u.first_name} ${u.last_name} ${u.agency_office} ${u.position}`
          .toLowerCase()
          .includes(q),
      )
    : users

  return (
    <div className="admin-card">
      <div className="admin-toolbar">
        <h3>Users</h3>
        <input
          className="admin-search"
          type="search"
          placeholder="Search by name, email, office…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search users"
        />
      </div>

      {error && <div className="admin-error">{error}</div>}
      {notice && <div className="admin-success">{notice}</div>}

      {loading ? (
        <div className="admin-loading">Loading accounts…</div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No accounts match “{query}”.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Office / Position</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th style={{ textAlign: 'right' }}>Authorities</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.id === user?.id
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-cell-user">
                        <span className="admin-avatar">
                          {u.avatar_url ? <img src={u.avatar_url} alt="" /> : displayName(u).charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <strong>{displayName(u)}</strong>
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.agency_office || '—'}
                      {u.position && <div style={{ color: '#888', fontSize: '0.82rem' }}>{u.position}</div>}
                    </td>
                    <td>
                      {u.is_system_admin && <span className="admin-badge admin">System admin</span>}
                      {u.suspended && <span className="admin-badge suspended">Suspended</span>}
                      {u.deletion_requested && <span className="admin-badge request">Deletion requested</span>}
                      {!u.suspended && !u.deletion_requested && !u.is_system_admin && (
                        <span className="admin-badge ok">Active</span>
                      )}
                      {u.deletion_requested && u.deletion_reason && (
                        <div style={{ color: '#92400e', fontSize: '0.8rem', marginTop: 4 }}>
                          “{u.deletion_reason}”
                        </div>
                      )}
                    </td>
                    <td>
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString()
                        : 'Never'}
                      <div style={{ color: '#888', fontSize: '0.8rem' }}>
                        Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </div>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="admin-btn sm"
                          disabled={busyId === u.id || isSelf}
                          title={isSelf ? 'You cannot change your own admin flag' : undefined}
                          onClick={() => toggleAdmin(u)}
                        >
                          {u.is_system_admin ? 'Revoke admin' : 'Make admin'}
                        </button>

                        {u.suspended ? (
                          <button
                            className="admin-btn sm success"
                            disabled={busyId === u.id}
                            onClick={() => restore(u)}
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            className="admin-btn sm"
                            disabled={busyId === u.id || isSelf}
                            title={isSelf ? 'You cannot suspend yourself' : undefined}
                            onClick={() => {
                              setSuspending(u)
                              setSuspendReason('')
                            }}
                          >
                            Suspend
                          </button>
                        )}

                        <button
                          className="admin-btn sm danger"
                          disabled={busyId === u.id || isSelf}
                          title={isSelf ? 'You cannot delete yourself' : undefined}
                          onClick={() => setDeleting(u)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {suspending && (
        <div className="admin-modal-overlay" onClick={() => setSuspending(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Suspend {suspending.email}</h3>
            <p className="admin-modal-text">
              Their sessions are revoked immediately and the database refuses them every table
              until the account is restored. They stay signed out on their next attempt.
            </p>
            <div className="admin-field">
              <label htmlFor="suspend-reason">Reason (shown to the account)</label>
              <textarea
                id="suspend-reason"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Why is this account being suspended?"
              />
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={() => setSuspending(null)}>Cancel</button>
              <button className="admin-btn danger" onClick={confirmSuspend}>Suspend account</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete account"
          message={`This permanently deletes ${deleting.email} together with every incident they created, their messages, notifications and check-in manifests. This cannot be undone. Enter your email and password to confirm the deletion.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
