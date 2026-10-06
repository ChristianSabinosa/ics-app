import { useCallback, useEffect, useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal'
import { clearDeletionRequest, finalizeAccountDeletion, listUsers, type AdminUser } from '../../lib/admin'
import './AdminLayout.css'

function displayName(u: AdminUser) {
  const name = `${u.first_name} ${u.last_name}`.trim()
  return name || u.email
}

/**
 * Authority A: the queue the profile page has been pointing at all along.
 *
 * ProfilePage sets `deletion_requested` and tells the user to "contact your
 * administrator" — this is where that request is honoured (full cascade) or
 * declined (the account is untouched and the flag is cleared).
 */
export default function AdminDeletionRequestsPage() {
  const [requests, setRequests] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  // Account waiting for the password-confirmed hard delete.
  const [approving, setApproving] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await listUsers()
      setRequests(rows.filter((r) => r.deletion_requested))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const decline = async (u: AdminUser) => {
    setError('')
    setNotice('')
    setBusyId(u.id)
    try {
      await clearDeletionRequest(u.id, 'Declined from the deletion queue')
      setNotice(`The request from ${u.email} was declined — their account is unchanged.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  const confirmApprove = async () => {
    const target = approving
    if (!target) return
    setApproving(null)
    setError('')
    setNotice('')
    setBusyId(target.id)
    try {
      const summary = await finalizeAccountDeletion(target.id, 'Approved from the deletion queue')
      const incidents = summary.incidents_deleted ?? 0
      const tables = Object.entries(summary.rows_deleted ?? {})
        .map(([table, count]) => `${count} × ${table}`)
        .join(', ')
      setNotice(
        `${target.email} has been deleted permanently` +
          (incidents > 0 ? ` with ${incidents} incident${incidents === 1 ? '' : 's'}` : '') +
          (tables ? ` — also cleared: ${tables}` : '') +
          '.',
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-toolbar">
        <h3>Deletion requests</h3>
      </div>

      <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: 14 }}>
        Approving removes the account and everything it owns: the incidents they created (forms,
        manifests and roster included), their messages and their notifications. Declining leaves
        the account exactly as it is and clears the request.
      </p>

      {error && <div className="admin-error">{error}</div>}
      {notice && <div className="admin-success">{notice}</div>}

      {loading ? (
        <div className="admin-loading">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="admin-empty">No accounts are waiting for a deletion decision.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Why they are leaving</th>
                <th>Requested</th>
                <th style={{ textAlign: 'right' }}>Decision</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((u) => (
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
                  <td>{u.deletion_reason || <em style={{ color: '#888' }}>No reason given</em>}</td>
                  <td>{u.deletion_requested_at ? new Date(u.deletion_requested_at).toLocaleString() : '—'}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="admin-btn sm success"
                        disabled={busyId === u.id}
                        onClick={() => setApproving(u)}
                      >
                        Approve deletion
                      </button>
                      <button
                        className="admin-btn sm"
                        disabled={busyId === u.id}
                        onClick={() => decline(u)}
                      >
                        Decline
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approving && (
        <ConfirmModal
          title="Approve account deletion"
          message={`This permanently deletes ${approving.email} together with every incident they created, their messages, notifications and check-in manifests. This cannot be undone. Enter your email and password to confirm.`}
          onConfirm={confirmApprove}
          onCancel={() => setApproving(null)}
        />
      )}
    </div>
  )
}
