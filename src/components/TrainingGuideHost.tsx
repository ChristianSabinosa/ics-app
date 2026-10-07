import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  fetchTraining,
  fetchMyMembership,
  fetchGuideProgress,
  saveGuideStep,
  fetchAnnouncements,
  markAnnouncementRead,
  syncGroupParticipants,
  type Training,
  type TrainingMember,
  type TrainingAnnouncement,
} from '../lib/training'
import { GUIDE_STEPS, findStepByRoute, stepPath, isStepComplete, type GuideStep } from '../lib/trainingGuideSteps'
import './TrainingGuide.css'

interface GuideContext {
  training: Training
  incidentId: string
  progress: Map<string, 'done' | 'skipped'>
  announcements: TrainingAnnouncement[]
}

/**
 * Renders the skippable window guides INSIDE a group's incident workspace.
 *
 * Behaviour:
 *   - only for trainees of a STARTED training, only on their own group's
 *     incident routes — regular incident users never see it;
 *   - on a form route: shows that form's window (if the step is unfinished);
 *   - on the incident hub: shows the earliest unfinished step (the walkthrough
 *     driver) with a button that jumps straight to the right form;
 *   - a step auto-completes when its form is submitted;
 *   - every window can be skipped or dismissed (it returns on the next
 *     navigation), and progress is stored per trainee.
 *
 * The panel floats bottom-right and never blocks the form underneath.
 */
export default function TrainingGuideHost() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [ctx, setCtx] = useState<GuideContext | null>(null)
  const [step, setStep] = useState<GuideStep | null>(null)
  const [busy, setBusy] = useState(false)

  const incidentCache = useRef<Map<string, string | null>>(new Map())
  const runId = useRef(0)
  /** Workspaces whose participant row we already synced this session. */
  const syncedRef = useRef<Set<string>>(new Set())
  /** Step key dismissed with × — returns on the next navigation. */
  const dismissedRef = useRef<string | null>(null)

  const incidentId = parseIncidentId(location.pathname)

  const recompute = useCallback(
    async (current: GuideContext | null, currentIncident: string | null) => {
      if (!currentIncident || !user || !current) {
        setStep(null)
        return
      }

      const onHub = location.pathname === `/incident/${currentIncident}`

      // Which step is this page about?
      let candidate: GuideStep | null = null
      if (onHub) {
        // The walkthrough driver: earliest unfinished step of the sequence.
        candidate = GUIDE_STEPS.find((s) => !current.progress.has(s.key)) ?? null
      } else {
        const matched = findStepByRoute(location.pathname)
        if (matched && !current.progress.has(matched.key)) candidate = matched
        else if (matched && current.progress.has(matched.key)) candidate = null
        else candidate = null
      }

      if (!candidate) {
        setStep(null)
        return
      }

      // Auto-complete: tick off any step whose underlying work is already
      // submitted (catches up several steps at once after a restart).
      while (candidate) {
        const complete = await isStepComplete(currentIncident, candidate.key)
        if (!complete) break
        await saveGuideStep(current.training.id, user.id, candidate.key, 'done')
        const next = new Map(current.progress)
        next.set(candidate.key, 'done')
        current.progress = next
        candidate = onHub
          ? GUIDE_STEPS.find((s) => !next.has(s.key)) ?? null
          : null // on a form route, just clear — they're done with this page
      }

      if (!candidate || dismissedRef.current === candidate.key) {
        setStep(null)
        return
      }
      setStep(candidate)
    },
    [location.pathname, user],
  )

  useEffect(() => {
    // A dismissed window comes back once the trainee moves on.
    dismissedRef.current = null
  }, [location.pathname])

  useEffect(() => {
    const id = runId.current + 1
    runId.current = id

    const load = async () => {
      if (!incidentId || !user) {
        setCtx(null)
        setStep(null)
        return
      }

      // Cached: is this incident part of a training?
      if (!incidentCache.current.has(incidentId)) {
        const { data } = await supabase.from('incidents').select('training_id').eq('incident_id', incidentId).maybeSingle()
        incidentCache.current.set(incidentId, (data as { training_id: string | null } | null)?.training_id ?? null)
      }
      const trainingId = incidentCache.current.get(incidentId)
      if (!trainingId) {
        if (runId.current === id) { setCtx(null); setStep(null) }
        return
      }

      const [training, member] = await Promise.all([fetchTraining(trainingId), fetchMyMembership(trainingId, user.id)])
      const valid =
        training &&
        member?.role === 'trainee' &&
        !!member.group_id &&
        training.status === 'Ongoing'
      if (!valid || runId.current !== id) {
        if (runId.current === id) { setCtx(null); setStep(null) }
        return
      }

      // Make sure this trainee actually belongs to THIS group's incident.
      const { data: groupRow } = await supabase
        .from('training_groups')
        .select('incident_id')
        .eq('training_id', trainingId)
        .eq('id', member!.group_id!)
        .maybeSingle()
      if (runId.current !== id) return
      if (!groupRow || groupRow.incident_id !== incidentId) {
        setCtx(null)
        setStep(null)
        return
      }

      // Make sure this trainee actually has a participant row in the group
      // workspace (RLS only lets them write their own row — hence self-sync).
      if (!syncedRef.current.has(incidentId)) {
        syncedRef.current.add(incidentId)
        await syncGroupParticipants(trainingId, user.id, member as TrainingMember)
        if (runId.current !== id) return
      }

      const [progress, announcements] = await Promise.all([
        fetchGuideProgress(trainingId, user.id),
        fetchAnnouncements(trainingId, member!.group_id),
      ])
      if (runId.current !== id) return

      const nextCtx: GuideContext = { training: training!, incidentId, progress, announcements }
      setCtx(nextCtx)
      await recompute(nextCtx, incidentId)
    }

    load()
  }, [incidentId, user, location.pathname, recompute])

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const mark = async (s: GuideStep, status: 'done' | 'skipped') => {
    if (!ctx || !user || busy) return
    setBusy(true)
    await saveGuideStep(ctx.training.id, user.id, s.key, status)
    ctx.progress.set(s.key, status)
    dismissedRef.current = null
    await recompute(ctx, ctx.incidentId)
    setBusy(false)
  }

  const handleOpen = (s: GuideStep) => {
    const path = stepPath(s, incidentId!)
    if (path) navigate(path)
    // Hub-only steps: "I've read it" / "Got it" simply tick the step off.
    if (!path) mark(s, 'done')
  }

  const handlePacketRead = async () => {
    if (!ctx || !user || !step) return
    await Promise.all(ctx.announcements.map((a) => markAnnouncementRead(a.id, user.id)))
    await mark(step, 'done')
  }

  if (!step || !ctx) return null

  const index = GUIDE_STEPS.findIndex((s) => s.key === step.key)
  const isPacket = step.key === 'packet'
  const path = stepPath(step, ctx.incidentId)

  return (
    <aside className="guide-window" role="dialog" aria-label={step.title}>
      <header className="guide-head">
        <div>
          <span className="guide-step-count">Step {index + 1} of {GUIDE_STEPS.length}</span>
          <h4>{step.title}</h4>
        </div>
        <button className="guide-close" onClick={() => { dismissedRef.current = step.key; setStep(null) }} aria-label="Close guide">&times;</button>
      </header>

      <div className="guide-body">
        {step.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}

        {isPacket && (
          <div className="guide-announcements">
            {ctx.announcements.length === 0 ? (
              <p className="guide-empty">No announcement posted yet — check back when your trainer pushes the activity packet.</p>
            ) : (
              ctx.announcements.map((a) => (
                <div key={a.id} className="guide-ann">
                  <strong>{a.title}</strong>
                  <span>{new Date(a.created_at).toLocaleString()}</span>
                  <p>{a.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <footer className="guide-actions">
        <button className="guide-btn ghost" onClick={() => mark(step, 'skipped')} disabled={busy}>
          Skip
        </button>
        {isPacket ? (
          <button className="guide-btn primary" onClick={handlePacketRead} disabled={busy || ctx.announcements.length === 0}>
            I've read it
          </button>
        ) : path ? (
          <>
            <button className="guide-btn ghost" onClick={() => mark(step, 'done')} disabled={busy}>
              Mark done
            </button>
            <button className="guide-btn primary" onClick={() => handleOpen(step)} disabled={busy}>
              {step.action.label}
            </button>
          </>
        ) : (
          <button className="guide-btn primary" onClick={() => handleOpen(step)} disabled={busy}>
            Got it
          </button>
        )}
      </footer>
    </aside>
  )
}

/** /incident/<id>/... → <id> */
function parseIncidentId(pathname: string): string | null {
  const m = pathname.match(/^\/incident\/([^/]+)/)
  return m ? m[1] : null
}
