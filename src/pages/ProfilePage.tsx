import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  AVAILABILITY_OPTIONS,
  displayName,
  emptyProfile,
  fetchProfile,
  removeAvatar,
  requestAccountDeletion,
  uploadAvatar,
  upsertProfile,
  type UserProfile,
} from '../lib/profile'
import { useReferenceData } from '../lib/settings'
import './ProfilePage.css'

type Notice = { kind: 'success' | 'error'; text: string } | null

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  // Option lists served from app_settings, with the built-in lists as fallback.
  const reference = useReferenceData()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const [password, setPassword] = useState({ next: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [pwNotice, setPwNotice] = useState<Notice>(null)

  const [deleteReason, setDeleteReason] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteNotice, setDeleteNotice] = useState<Notice>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchProfile(user.id)
      .then((row) => {
        const base = row ?? emptyProfile(user.id)
        // Seed names from auth metadata for accounts created before profiles existed.
        if (!base.first_name) base.first_name = (user.user_metadata?.first_name as string) ?? ''
        if (!base.last_name) base.last_name = (user.user_metadata?.last_name as string) ?? ''
        setProfile(base)
      })
      .catch(() => setNotice({ kind: 'error', text: 'Could not load your profile. Please reload.' }))
      .finally(() => setLoading(false))
  }, [user])

  const verified = Boolean(user?.email_confirmed_at)
  const memberSince = useMemo(() => {
    const raw = user?.created_at
    if (!raw) return '—'
    return new Date(raw).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  }, [user])

  const fullName = profile ? displayName(profile) || user?.email || 'User' : 'User'
  const avatarSrc = preview ?? (profile?.avatar_url || '')
  const othersChecked = profile?.trainings.includes('Others') ?? false

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setProfile((p) => (p ? { ...p, [key]: value } : p))

  const toggleTraining = (option: string) => {
    if (!profile) return
    const has = profile.trainings.includes(option)
    set(
      'trainings',
      has ? profile.trainings.filter((t) => t !== option) : [...profile.trainings, option],
    )
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !profile || saving) return
    if (!profile.first_name.trim() || !profile.last_name.trim()) {
      setNotice({ kind: 'error', text: 'First name and last name are required.' })
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      const { error: metaError } = await supabase.auth.updateUser({
        data: { first_name: profile.first_name.trim(), last_name: profile.last_name.trim() },
      })
      if (metaError) throw metaError
      await upsertProfile(user.id, {
        first_name: profile.first_name.trim(),
        middle_name: profile.middle_name.trim(),
        last_name: profile.last_name.trim(),
        agency_office: profile.agency_office.trim(),
        position: profile.position.trim(),
        preferred_ics_position: profile.preferred_ics_position,
        availability_status: profile.availability_status,
        trainings: othersChecked
          ? profile.trainings
          : profile.trainings.filter((t) => t !== 'Others'),
        trainings_other: othersChecked ? profile.trainings_other.trim() : '',
      })
      setNotice({ kind: 'success', text: 'Profile saved.' })
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save profile.' })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarPick = async (file: File) => {
    if (!user || !profile) return
    setAvatarBusy(true)
    setNotice(null)
    try {
      const localUrl = URL.createObjectURL(file)
      setPreview(localUrl)
      const publicUrl = await uploadAvatar(user.id, file)
      await upsertProfile(user.id, { avatar_url: publicUrl })
      set('avatar_url', publicUrl)
      setPreview(null)
      URL.revokeObjectURL(localUrl)
      setNotice({ kind: 'success', text: 'Profile picture updated.' })
    } catch (err) {
      setPreview(null)
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not upload picture.' })
    } finally {
      setAvatarBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user || !profile?.avatar_url || avatarBusy) return
    setAvatarBusy(true)
    try {
      await removeAvatar(user.id, profile.avatar_url)
      await upsertProfile(user.id, { avatar_url: '' })
      set('avatar_url', '')
      setNotice({ kind: 'success', text: 'Profile picture removed.' })
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not remove picture.' })
    } finally {
      setAvatarBusy(false)
    }
  }

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwNotice(null)
    if (password.next.length < 6) {
      setPwNotice({ kind: 'error', text: 'New password must be at least 6 characters.' })
      return
    }
    if (password.next !== password.confirm) {
      setPwNotice({ kind: 'error', text: 'Passwords do not match.' })
      return
    }
    setPwBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: password.next })
      if (error) throw error
      setPassword({ next: '', confirm: '' })
      setPwNotice({ kind: 'success', text: 'Password changed.' })
    } catch (err) {
      setPwNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not change password.' })
    } finally {
      setPwBusy(false)
    }
  }

  const handleRequestDeletion = async () => {
    if (!user || deleteBusy) return
    if (!deleteConfirm) {
      setDeleteNotice({ kind: 'error', text: 'Please tick the confirmation checkbox first.' })
      return
    }
    setDeleteBusy(true)
    setDeleteNotice(null)
    try {
      await requestAccountDeletion(user.id, deleteReason.trim())
      await signOut()
      navigate('/login', {
        state: {
          notice:
            'Your deletion request was recorded. Please contact your administrator to finalize removal of your account.',
        },
      })
    } catch (err) {
      setDeleteNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not record request.' })
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="profile-page">
      <header className="page-header">
        <div className="header-brand">
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
        <button className="header-back" onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
      </header>

      <main className="profile-main">
        <div className="profile-title">
          <h2>Profile</h2>
          <p>Manage your personal, professional, and account settings.</p>
        </div>

        {notice && <div className={`profile-notice ${notice.kind}`}>{notice.text}</div>}

        {loading || !profile ? (
          <div className="profile-loading">Loading profile…</div>
        ) : (
          <div className="profile-grid">
            {/* Identity card */}
            <aside className="profile-card identity">
              <div className="avatar-wrap">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Profile" className="avatar-img" />
                ) : (
                  <span className="avatar-fallback">{fullName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <h3>{fullName}</h3>
              <p className="identity-email">{user?.email}</p>
              <div className="identity-badges">
                <span className={`badge ${verified ? 'ok' : 'warn'}`}>
                  {verified ? 'Email verified' : 'Email not verified'}
                </span>
                <span className={`badge status-${profile.availability_status}`}>
                  {profile.availability_status}
                </span>
              </div>
              <p className="identity-meta">Member since {memberSince}</p>
              {profile.agency_office && <p className="identity-meta">{profile.agency_office}</p>}

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleAvatarPick(f)
                }}
              />
              <div className="avatar-actions">
                <button type="button" disabled={avatarBusy} onClick={() => fileRef.current?.click()}>
                  {avatarBusy ? 'Uploading…' : profile.avatar_url ? 'Change picture' : 'Upload picture'}
                </button>
                {profile.avatar_url && (
                  <button type="button" className="link" disabled={avatarBusy} onClick={() => void handleRemoveAvatar()}>
                    Remove
                  </button>
                )}
              </div>
              <p className="hint">Round crop. JPG, PNG, or WebP up to 2MB — works for office logos too.</p>
            </aside>

            <div className="profile-forms">
              {/* Personal + professional */}
              <form className="profile-card" onSubmit={handleSave}>
                <h3>Personal information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="pf-first">First name *</label>
                    <input
                      id="pf-first"
                      value={profile.first_name}
                      onChange={(e) => set('first_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pf-middle">Middle name</label>
                    <input
                      id="pf-middle"
                      value={profile.middle_name}
                      onChange={(e) => set('middle_name', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pf-last">Last name *</label>
                    <input
                      id="pf-last"
                      value={profile.last_name}
                      onChange={(e) => set('last_name', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <h3>Professional details</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="pf-agency">Agency / Office name</label>
                    <input
                      id="pf-agency"
                      placeholder="e.g. MDRRMO Alaminos"
                      value={profile.agency_office}
                      onChange={(e) => set('agency_office', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pf-position">Position</label>
                    <input
                      id="pf-position"
                      placeholder="e.g. Admin Aide III"
                      value={profile.position}
                      onChange={(e) => set('position', e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="pf-ics">Preferred ICS position</label>
                    <select
                      id="pf-ics"
                      value={profile.preferred_ics_position}
                      onChange={(e) => set('preferred_ics_position', e.target.value)}
                    >
                      <option value="">Select…</option>
                      {reference.positions.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="pf-avail">Availability status</label>
                    <select
                      id="pf-avail"
                      value={profile.availability_status}
                      onChange={(e) =>
                        set('availability_status', e.target.value as UserProfile['availability_status'])
                      }
                    >
                      {AVAILABILITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <h3>Trainings</h3>
                <div className="training-list">
                  {reference.trainings.map((t) => (
                    <label key={t} className="check">
                      <input
                        type="checkbox"
                        checked={profile.trainings.includes(t)}
                        onChange={() => toggleTraining(t)}
                      />
                      {t}
                    </label>
                  ))}
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={othersChecked}
                      onChange={() => toggleTraining('Others')}
                    />
                    Others (specify below)
                  </label>
                </div>
                {othersChecked && (
                  <div className="form-group">
                    <label htmlFor="pf-other-training">Other trainings</label>
                    <input
                      id="pf-other-training"
                      placeholder="e.g. WASAR, First Aid"
                      value={profile.trainings_other}
                      onChange={(e) => set('trainings_other', e.target.value)}
                    />
                  </div>
                )}

                <button type="submit" className="primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </form>

              {/* Security */}
              <form className="profile-card" onSubmit={handlePassword}>
                <h3>Change password</h3>
                {pwNotice && <div className={`profile-notice ${pwNotice.kind}`}>{pwNotice.text}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="pw-next">New password</label>
                    <input
                      id="pw-next"
                      type="password"
                      autoComplete="new-password"
                      value={password.next}
                      onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pw-confirm">Confirm new password</label>
                    <input
                      id="pw-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={password.confirm}
                      onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="secondary" disabled={pwBusy}>
                  {pwBusy ? 'Updating…' : 'Update password'}
                </button>
              </form>

              {/* Deletion request */}
              <section className="profile-card danger">
                <h3>Delete account</h3>
                <p>
                  Requests are reviewed by an administrator — your account is flagged and signed
                  out now, and an admin finalizes the hard delete.
                </p>
                {profile.deletion_requested ? (
                  <div className="profile-notice warn">
                    A deletion request is already on file
                    {profile.deletion_requested_at
                      ? ` (${new Date(profile.deletion_requested_at).toLocaleString()})`
                      : ''}
                    . Please contact your administrator.
                  </div>
                ) : (
                  <>
                    {deleteNotice && (
                      <div className={`profile-notice ${deleteNotice.kind}`}>{deleteNotice.text}</div>
                    )}
                    <div className="form-group">
                      <label htmlFor="del-reason">Reason (optional)</label>
                      <textarea
                        id="del-reason"
                        rows={3}
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        placeholder="Tell the admin why you are leaving…"
                      />
                    </div>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.checked)}
                      />
                      I understand an administrator must finalize deletion and I will be signed out.
                    </label>
                    <button
                      type="button"
                      className="danger-btn"
                      disabled={deleteBusy}
                      onClick={() => void handleRequestDeletion()}
                    >
                      {deleteBusy ? 'Recording…' : 'Request account deletion'}
                    </button>
                  </>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
