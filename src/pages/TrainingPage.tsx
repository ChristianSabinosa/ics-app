import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  fetchTraining,
  fetchGroups,
  fetchMembers,
  fetchMyMembership,
  joinTraining,
  assignTrainee,
  addGroup,
  renameGroup,
  removeGroup,
  startTraining,
  closeTraining,
  trainingInviteUrl,
  userDisplayName,
  postAnnouncement,
  fetchAnnouncements,
  markAnnouncementRead,
  fetchGuideProgress,
  syncGroupParticipants,
  fetchGroupMonitors,
  resetGuideProgress,
  type Training,
  type TrainingGroup,
  type TrainingMember,
  type TrainingAnnouncement,
  type GroupMonitor,
} from '../lib/training'
import { GUIDE_STEPS } from '../lib/trainingGuideSteps'
import './Training.css'

type Tab = 'overview' | 'groups' | 'roster' | 'monitor' | 'announcements'

const TOTAL_STEPS = GUIDE_STEPS.length

/**
 * The training's home:
 *   - trainer:  setup lobby (groups + QR invite), roster & assignment,
 *               the monitoring card, announcements
 *   - trainee:  waiting lobby until assigned, then their group workspace,
 *               guide progress and the trainer's announcements
 */
export default function TrainingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [training, setTraining] = useState<Training | null>(null)
  const [members, setMembers] = useState<TrainingMember[]>([])
  const [groups, setGroups] = useState<TrainingGroup[]>([])
  const [me, setMe] = useState<TrainingMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [tab, setTab] = useState<Tab>('overview')

  // Groups & invite
  const [newGroupName, setNewGroupName] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Roster
  const [savingMember, setSavingMember] = useState<string | null>(null)

  // Monitor
  const [monitors, setMonitors] = useState<GroupMonitor[]>([])
  const [monitorLoading, setMonitorLoading] = useState(false)
  const [guideCounts, setGuideCounts] = useState<Record<string, number>>({})
  const [approvedIaps, setApprovedIaps] = useState<{ incident_id: string; id: string; group: string; approved_at: string | null }[]>([])

  // Announcements
  const [announcements, setAnnouncements] = useState<TrainingAnnouncement[]>([])
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')
  const [annTarget, setAnnTarget] = useState<string>('all')
  const [postBusy, setPostBusy] = useState(false)

  // Trainee guide progress
  const [guideDone, setGuideDone] = useState(0)

  // Trainee group rename
  const [traineeRenaming, setTraineeRenaming] = useState(false)
  const [traineeGroupName, setTraineeGroupName] = useState('')

  const isTrainer = me?.role === 'trainor'
  const myGroup = groups.find((g) => g.id === me?.group_id) ?? null

  const load = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)
    setError('')

    const [t, membership] = await Promise.all([fetchTraining(id), fetchMyMembership(id, user.id)])
    if (!t) {
      setError('Training not found.')
      setLoading(false)
      return
    }
    setTraining(t)
    setMe(membership)

    const [g, m] = await Promise.all([fetchGroups(id), fetchMembers(id)])
    setGroups(g)
    setMembers(m)

    // A trainee with a group keeps their participant rows in sync (self-owned
    // writes only — RLS allows them): join current group, close stale ones.
    if (membership?.role === 'trainee' && membership.group_id) {
      await syncGroupParticipants(id, user.id, membership)
      const progress = await fetchGuideProgress(id, user.id)
      setGuideDone([...progress.values()].filter((s) => s === 'done' || s === 'skipped').length)
    }

    setLoading(false)
  }, [id, user])

  useEffect(() => { load() }, [load])

  // Trainer-side data
  const loadMonitor = useCallback(async () => {
    if (!id || !isTrainer) return
    setMonitorLoading(true)
    const [mons, iaps] = await Promise.all([
      fetchGroupMonitors(id),
      loadApprovedIaps(groups),
    ])
    setMonitors(mons)
    setApprovedIaps(iaps)

    const counts: Record<string, number> = {}
    await Promise.all(
      members.map(async (m) => {
        const progress = await fetchGuideProgress(id, m.user_id)
        counts[m.user_id] = [...progress.values()].filter((s) => s === 'done' || s === 'skipped').length
      }),
    )
    setGuideCounts(counts)
    setMonitorLoading(false)
  }, [id, isTrainer, members, groups])

  const loadAnnouncements = useCallback(async () => {
    if (!id) return
    if (isTrainer) {
      const { data } = await supabase
        .from('training_announcements')
        .select('*')
        .eq('training_id', id)
        .order('created_at', { ascending: false })
      setAnnouncements((data as TrainingAnnouncement[]) ?? [])
    } else {
      setAnnouncements(await fetchAnnouncements(id, me?.group_id ?? null))
    }
  }, [id, isTrainer, me?.group_id])

  useEffect(() => { loadMonitor() }, [loadMonitor])
  useEffect(() => { loadAnnouncements() }, [loadAnnouncements])

  // ------------------------------------------------------------------
  // Actions — trainer
  // ------------------------------------------------------------------

  const requireTrainer = () => {
    if (!isTrainer || !training) return false
    return true
  }

  const handleStart = async () => {
    if (!requireTrainer() || !training) return
    setError('')
    try {
      await startTraining(training.id)
      setTraining({ ...training, status: 'Ongoing', started_at: new Date().toISOString() })
      setNotice('Training started — trainees can now follow the guided walkthrough.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the training.')
    }
  }

  const handleClose = async () => {
    if (!training || !window.confirm('Close this training? Trainees will no longer be guided through it.')) return
    await closeTraining(training.id)
    setTraining({ ...training, status: 'Closed' })
  }

  const handleAddGroup = async () => {
    if (!training || !newGroupName.trim()) return
    setError('')
    try {
      const group = await addGroup(training, newGroupName.trim())
      setGroups([...groups, group])
      setNewGroupName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the group.')
    }
  }

  const handleRenameGroup = async () => {
    if (!renaming || !renaming.name.trim()) return
    try {
      await renameGroup(groups.find((g) => g.id === renaming.id)!, renaming.name.trim())
      setGroups(groups.map((g) => (g.id === renaming.id ? { ...g, name: renaming.name.trim() } : g)))
      setRenaming(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename the group.')
    }
  }

  const handleRemoveGroup = async (group: TrainingGroup) => {
    const assigned = members.filter((m) => m.group_id === group.id).length
    if (assigned > 0) {
      setError(`Reassign the ${assigned} trainee(s) in ${group.name} before deleting it.`)
      return
    }
    if (!window.confirm(`Delete ${group.name}?`)) return
    try {
      await removeGroup(group)
      setGroups(groups.filter((g) => g.id !== group.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the group.')
    }
  }

  const handleAssign = async (member: TrainingMember, groupId: string) => {
    if (!requireTrainer()) return
    setSavingMember(member.id)
    setError('')
    try {
      await assignTrainee(member.id, groupId || null)
      setMembers(members.map((m) => (m.id === member.id ? { ...m, group_id: groupId || null } : m)))
      setNotice(groupId ? `${member.user_name} assigned.` : `${member.user_name} moved to unassigned.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign the trainee.')
    }
    setSavingMember(null)
  }

  const handlePost = async () => {
    if (!training || !user || !annTitle.trim()) return
    setPostBusy(true)
    setError('')
    try {
      await postAnnouncement(training.id, {
        groupId: annTarget === 'all' ? null : annTarget,
        title: annTitle.trim(),
        body: annBody,
        author: { id: user.id, name: userDisplayName(user) },
      })
      setAnnTitle('')
      setAnnBody('')
      setAnnTarget('all')
      await loadAnnouncements()
      setNotice('Announcement posted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post the announcement.')
    }
    setPostBusy(false)
  }

  // ------------------------------------------------------------------
  // Actions — trainee
  // ------------------------------------------------------------------

  const handleJoinNow = async () => {
    if (!training || !user) return
    const member = await joinTraining(training, { id: user.id, name: userDisplayName(user), email: user.email || '' })
    setMe(member)
    setMembers([...members, member])
  }

  const handleReplayGuide = async () => {
    if (!training || !user) return
    if (!window.confirm('Restart the guided walkthrough from the beginning?')) return
    await resetGuideProgress(training.id, user.id)
    setGuideDone(0)
    setNotice('Guide restarted — open your workspace to begin again.')
  }

  const handleReadAnnouncement = async (ann: TrainingAnnouncement) => {
    if (!user || isTrainer) return
    await markAnnouncementRead(ann.id, user.id)
  }

  // Trainees may rename their own group once the trainer assigned them.
  const handleTraineeRename = async () => {
    if (!myGroup || !traineeGroupName.trim()) return
    setError('')
    try {
      await renameGroup(myGroup, traineeGroupName.trim())
      setGroups(groups.map((g) => (g.id === myGroup.id ? { ...g, name: traineeGroupName.trim() } : g)))
      setTraineeRenaming(false)
      setNotice('Your group was renamed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename the group.')
    }
  }

  const copyLink = async () => {
    if (!training) return
    await navigator.clipboard.writeText(trainingInviteUrl(training.invite_token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (loading) {
    return <div className="training-page"><main className="training-main"><p className="training-empty">Loading training…</p></main></div>
  }

  if (!training) {
    return (
      <div className="training-page">
        <main className="training-main">
          <div className="error-message">{error || 'Training not found.'}</div>
          <button className="btn-primary" onClick={() => navigate('/training')}>Back to Training Mode</button>
        </main>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="training-page">
        <header className="page-header">
          <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
            <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
            <div><h1>Training Mode</h1><p>{training.name}</p></div>
          </div>
        </header>
        <main className="training-main">
          <div className="training-form-card">
            <h2>{training.name}</h2>
            <p>You are not a member of this training yet. Join it to participate.</p>
            {error && <div className="error-message">{error}</div>}
            <button className="btn-primary" onClick={handleJoinNow}>Join this training</button>
          </div>
        </main>
      </div>
    )
  }

  const inviteUrl = trainingInviteUrl(training.invite_token)

  return (
    <div className="training-page">
      <header className="page-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>{training.name}</h1>
            <p>{training.training_id} · {training.location}</p>
          </div>
        </div>
        <div className="training-header-right">
          <span className={`training-status ${training.status.toLowerCase()}`}>{training.status}</span>
          <span className={`training-role ${me.role}`}>{isTrainer ? 'Trainer' : 'Trainee'}</span>
          <button className="training-back" onClick={() => navigate('/training')}>All trainings</button>
        </div>
      </header>

      <main className="training-main">
        {error && <div className="error-message">{error}</div>}
        {notice && (
          <div className="training-notice">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Dismiss">&times;</button>
          </div>
        )}

        {isTrainer ? (
          <>
            <nav className="training-tabs">
              {(['overview', 'groups', 'roster', 'monitor', 'announcements'] as Tab[]).map((t) => (
                <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                  {t === 'overview' ? 'Overview'
                    : t === 'groups' ? 'Groups & Invite'
                    : t === 'roster' ? 'Roster & Assignment'
                    : t === 'monitor' ? 'Monitoring'
                    : 'Announcements'}
                </button>
              ))}
            </nav>

            {tab === 'overview' && (
              <section className="training-panel">
                <h2>Overview</h2>
                <div className="training-overview-grid">
                  <div className="training-stat"><span>Groups</span><strong>{groups.length}</strong></div>
                  <div className="training-stat"><span>Trainees</span><strong>{members.filter((m) => m.role === 'trainee').length}</strong></div>
                  <div className="training-stat"><span>Unassigned</span><strong>{members.filter((m) => m.role === 'trainee' && !m.group_id).length}</strong></div>
                  <div className="training-stat"><span>Started</span><strong>{training.started_at ? new Date(training.started_at).toLocaleString() : 'Not yet'}</strong></div>
                </div>
                {training.scenario && (
                  <div className="training-scenario"><h3>Scenario</h3><p>{training.scenario}</p></div>
                )}
                <div className="form-actions">
                  {training.status === 'Setup' && (
                    <button className="btn-primary" onClick={handleStart}>Start Training</button>
                  )}
                  {training.status === 'Ongoing' && (
                    <button className="btn-secondary" onClick={handleClose}>Close Training</button>
                  )}
                  {training.status === 'Closed' && <p className="training-empty">This training is closed.</p>}
                </div>
                <p className="training-hint">
                  Trainees can join at any time — even after the training starts. Assign them from the
                  Roster tab; you can move trainees between groups whenever you need to rebalance.
                </p>
              </section>
            )}

            {tab === 'groups' && (
              <section className="training-panel">
                <h2>Groups</h2>
                <div className="training-group-list">
                  {groups.map((group) => (
                    <div key={group.id} className="training-group-row">
                      {renaming?.id === group.id ? (
                        <>
                          <input value={renaming.name} onChange={(e) => setRenaming({ id: group.id, name: e.target.value })} />
                          <button className="btn-primary" onClick={handleRenameGroup}>Save</button>
                          <button className="btn-secondary" onClick={() => setRenaming(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <div>
                            <strong>{group.name}</strong>
                            <span className="training-group-meta">
                              {members.filter((m) => m.group_id === group.id).length} member(s)
                              {group.incident_id ? ` · workspace ${group.incident_id}` : ''}
                            </span>
                          </div>
                          <div className="training-group-actions">
                            <button className="btn-secondary" onClick={() => setRenaming({ id: group.id, name: group.name })}>Rename</button>
                            <button
                              className="btn-secondary"
                              onClick={() => group.incident_id && navigate(`/incident/${group.incident_id}`)}
                            >
                              Open
                            </button>
                            <button className="btn-danger" onClick={() => handleRemoveGroup(group)}>Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="training-add-group">
                  <input
                    placeholder="New group name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                  <button className="btn-primary" onClick={handleAddGroup} disabled={!newGroupName.trim()}>
                    Add group
                  </button>
                </div>

                <h2>Invite trainees</h2>
                <div className="training-invite-panel">
                  <QRCodeSVG value={inviteUrl} size={168} marginSize={2} />
                  <div className="training-invite-details">
                    <p>Trainees scan the QR code or open the link. They create their own account and join — you then assign them to a group.</p>
                    <code className="training-invite-link">{inviteUrl}</code>
                    <div className="training-invite-buttons">
                      <button className="btn-primary" onClick={copyLink}>{copied ? 'Copied!' : 'Copy link'}</button>
                      <button className="btn-secondary" onClick={() => window.print()}>Print QR</button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === 'roster' && (
              <section className="training-panel">
                <h2>Roster &amp; Assignment</h2>
                <p className="training-hint">
                  Assign trainees to groups, or move them between groups at any time — even while the
                  training is running — to rebalance when someone cannot finish.
                </p>
                <table className="training-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Joined</th><th>Group</th></tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td>{member.user_name || member.user_email}</td>
                        <td>{member.user_email}</td>
                        <td>{new Date(member.joined_at).toLocaleDateString()}</td>
                        <td>
                          {member.role === 'trainor' ? (
                            <span className="training-role trainor">Trainer</span>
                          ) : (
                            <select
                              value={member.group_id || ''}
                              disabled={savingMember === member.id}
                              onChange={(e) => handleAssign(member, e.target.value)}
                            >
                              <option value="">— Unassigned —</option>
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {tab === 'monitor' && (
              <section className="training-panel">
                <h2>Monitoring</h2>
                <p className="training-hint">
                  Progress of every group. Each group works on its own ICS package; only that group's
                  members can see it. Select a row to open a group's workspace.
                </p>
                {monitorLoading ? (
                  <p className="training-empty">Loading progress…</p>
                ) : (
                  <>
                    <div className="training-monitor-scroll">
                      <table className="training-table training-monitor-table">
                        <thead>
                          <tr>
                            <th>Step</th>
                            {monitors.map(({ group }) => (
                              <th key={group.id}>{group.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <MonitorRow label="Check-in" monitors={monitors} field="CHECKIN" />
                          <MonitorRow label="ICS 211" monitors={monitors} field="211" />
                          <MonitorRow label="ICS 207" monitors={monitors} field="207" />
                          <MonitorRow label="ICS 201" monitors={monitors} field="201" />
                          <MonitorRow label="ICS 202" monitors={monitors} field="202" />
                          <MonitorRow label="ICS 203" monitors={monitors} field="203" />
                          <MonitorRow label="Incident Map" monitors={monitors} field="MAP" />
                          <MonitorRow label="ICS 205" monitors={monitors} field="205" />
                          <MonitorRow label="ICS 206" monitors={monitors} field="206" />
                          <MonitorRow label="ICS 208" monitors={monitors} field="208" />
                          <MonitorRow label="ICS 215" monitors={monitors} field="215" />
                          <MonitorRow label="ICS 215A" monitors={monitors} field="215A" />
                          <MonitorRow label="ICS 204s" monitors={monitors} field="204" />
                          <MonitorRow label="IAP" monitors={monitors} field="IAP" />
                        </tbody>
                      </table>
                    </div>

                    <h3>Groups &amp; trainees</h3>
                    <div className="training-monitor-cards">
                      {monitors.map(({ group, members: groupMembers }) => (
                        <div key={group.id} className="training-monitor-card">
                          <div className="training-monitor-card-head">
                            <strong>{group.name}</strong>
                            {group.incident_id && (
                              <button className="btn-secondary" onClick={() => navigate(`/incident/${group.incident_id}`)}>
                                Open workspace
                              </button>
                            )}
                          </div>
                          {groupMembers.length === 0 ? (
                            <p className="training-empty">No trainees assigned yet.</p>
                          ) : (
                            <ul>
                              {groupMembers.map((m) => (
                                <li key={m.id}>
                                  <span>{m.user_name || m.user_email}</span>
                                  <span className="training-guide-chip">
                                    {guideCounts[m.user_id] ?? 0}/{TOTAL_STEPS} guide steps
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>

                    <h3>Approved IAPs</h3>
                    {approvedIaps.length === 0 ? (
                      <p className="training-empty">No approved IAPs yet.</p>
                    ) : (
                      <ul className="training-iap-list">
                        {approvedIaps.map((iap) => (
                          <li key={iap.id}>
                            <button
                              className="link-button"
                              onClick={() => navigate(`/incident/${iap.incident_id}/iap/${iap.id}`)}
                            >
                              {iap.group} — IAP
                            </button>
                            <span>{iap.approved_at ? new Date(iap.approved_at).toLocaleString() : ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>
            )}

            {tab === 'announcements' && (
              <section className="training-panel">
                <h2>Announcements</h2>
                <p className="training-hint">
                  The announcement box your groups read — push scenario updates and instructions for
                  the activity packet here.
                </p>
                <div className="training-ann-compose">
                  <input placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
                  <select value={annTarget} onChange={(e) => setAnnTarget(e.target.value)}>
                    <option value="all">All groups</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <textarea
                    placeholder="Message for the groups…"
                    rows={4}
                    value={annBody}
                    onChange={(e) => setAnnBody(e.target.value)}
                  />
                  <button className="btn-primary" onClick={handlePost} disabled={postBusy || !annTitle.trim()}>
                    {postBusy ? 'Posting…' : 'Push announcement'}
                  </button>
                </div>
                <AnnouncementList announcements={announcements} onRead={() => {}} />
              </section>
            )}
          </>
        ) : (
          /* ------------------------------ trainee ------------------------------ */
          <>
            {training.status === 'Setup' && (
              <section className="training-panel training-waiting">
                <h2>Waiting for the trainer</h2>
                <p>
                  <strong>{training.created_by_name}</strong> has not started the training yet.
                  You'll be assigned to a group and can enter your workspace from here.
                </p>
                <p className="training-hint">Groups so far: {groups.map((g) => g.name).join(', ') || 'none yet'}</p>
              </section>
            )}

            {!me.group_id ? (
              <section className="training-panel training-waiting">
                <h2>Waiting for a group assignment</h2>
                <p>The trainer will assign you to a group. Once assigned, your group's workspace and guided walkthrough appear below.</p>
              </section>
            ) : (
              <section className="training-panel">
                <h2>My Group</h2>
                <div className="training-my-group">
                  <div>
                    {traineeRenaming ? (
                      <div className="training-group-rename">
                        <input
                          value={traineeGroupName}
                          onChange={(e) => setTraineeGroupName(e.target.value)}
                          placeholder="Group name"
                        />
                        <button className="btn-primary" onClick={handleTraineeRename} disabled={!traineeGroupName.trim()}>
                          Save
                        </button>
                        <button className="btn-secondary" onClick={() => setTraineeRenaming(false)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <strong className="training-my-group-name">{myGroup?.name}</strong>
                        <button
                          className="link-button training-rename-btn"
                          onClick={() => { setTraineeGroupName(myGroup?.name ?? ''); setTraineeRenaming(true) }}
                        >
                          Rename
                        </button>
                      </>
                    )}
                    <p className="training-card-meta">
                      Members: {members.filter((m) => m.group_id === me.group_id).map((m) => m.user_name || m.user_email).join(', ')}
                    </p>
                  </div>
                  {myGroup?.incident_id && training.status !== 'Closed' && (
                    <button className="btn-primary" onClick={() => navigate(`/incident/${myGroup.incident_id}`)}>
                      Open group workspace
                    </button>
                  )}
                </div>

                <h3>Guided walkthrough</h3>
                <div className="training-guide-progress">
                  <div className="training-progress-bar">
                    <span style={{ width: `${Math.round((guideDone / TOTAL_STEPS) * 100)}%` }} />
                  </div>
                  <span>{guideDone} of {TOTAL_STEPS} steps completed or skipped</span>
                  <button className="btn-secondary" onClick={handleReplayGuide}>Restart guide</button>
                </div>
                <p className="training-hint">
                  The guide windows appear as you open each form in your workspace. Every step can be skipped.
                </p>
              </section>
            )}

            <section className="training-panel">
              <h2>Announcements</h2>
              <AnnouncementList announcements={announcements} onRead={handleReadAnnouncement} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function MonitorRow({ label, monitors, field }: { label: string; monitors: GroupMonitor[]; field: string }) {
  return (
    <tr>
      <td>{label}</td>
      {monitors.map(({ group, statuses, iapStatus }) => {
        const raw = field === 'IAP' ? iapStatus : statuses[field] || ''
        const cls = raw === 'Submitted' || raw === 'Approved' || raw === 'Saved'
          ? 'done'
          : raw === 'Draft'
            ? 'draft'
            : ''
        return (
          <td key={group.id}>
            <span className={`training-status-cell ${cls}`}>
              {raw === 'Submitted' ? 'Submitted'
                : raw === 'Approved' ? 'Approved'
                : raw === 'Saved' ? 'Saved'
                : raw === 'Draft' ? 'Draft'
                : '—'}
            </span>
          </td>
        )
      })}
    </tr>
  )
}

function AnnouncementList({ announcements, onRead }: { announcements: TrainingAnnouncement[]; onRead: (a: TrainingAnnouncement) => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (announcements.length === 0) {
    return <p className="training-empty">No announcements yet.</p>
  }
  return (
    <div className="training-ann-list">
      {announcements.map((ann) => (
        <div key={ann.id} className="training-ann-item">
          <button
            className="training-ann-head"
            onClick={() => {
              const next = openId === ann.id ? null : ann.id
              setOpenId(next)
              if (next) onRead(ann)
            }}
          >
            <strong>{ann.title}</strong>
            <span>
              {new Date(ann.created_at).toLocaleString()}
              {ann.created_by_name ? ` · ${ann.created_by_name}` : ''}
            </span>
          </button>
          {openId === ann.id && <p className="training-ann-body">{ann.body}</p>}
        </div>
      ))}
    </div>
  )
}

async function loadApprovedIaps(groups: TrainingGroup[]) {
  const ids = groups.map((g) => g.incident_id).filter((x): x is string => !!x)
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('incident_iap')
    .select('id, incident_id, approved_at, status')
    .in('incident_id', ids)
    .eq('status', 'Approved')
    .order('approved_at', { ascending: false })

  return (data ?? []).map((row) => ({
    id: row.id as string,
    incident_id: row.incident_id as string,
    group: groups.find((g) => g.incident_id === row.incident_id)?.name || row.incident_id,
    approved_at: (row.approved_at as string | null) ?? null,
  }))
}
