import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAdmin } from '../context/AdminContext'
import { generateRoleId, formatMilitaryTime } from '../lib/utils'
import type { Incident, IncidentParticipant, CheckinManifest, CheckinPersonnel } from '../lib/types'
import { getFormAccess, type FormKey } from '../lib/permissions'
import { notifyIncident } from '../lib/notifications'
import { fetchMyMembership, userDisplayName } from '../lib/training'
import { loadPositionHolders, canPrepareWith, SIGNATURE_RULES } from '../lib/signatureRules'
import ConfirmModal from '../components/ConfirmModal'
import IapCoverModal, { type IapStatus } from '../components/IapCoverModal'
import './IncidentPage.css'

// Only these fields are rendered on this page, so queries select just these columns
type ManifestSummary = Pick<CheckinManifest, 'id' | 'checkin_id' | 'incident_id' | 'user_id' | 'agency_name' | 'total_personnel' | 'created_at'>
type PersonnelSummary = Pick<CheckinPersonnel, 'manifest_id' | 'name' | 'role' | 'capabilities'>

// One IAP row per operational period; approved rows are frozen read-only documents
interface IapSummary {
  id: string
  status: string
  operational_period: string
  approved_at: string | null
}

// Prerequisites for generating the Incident Action Plan (IAP)
const IAP_REQUIREMENTS = [
  { num: '202', label: 'Incident Objectives' },
  { num: '203', label: 'Organization Assignment List' },
  { num: '204', label: 'Assignment List' },
  { num: '205', label: 'Communications Plan' },
  { num: '206', label: 'Medical Plan' },
  { num: '208', label: 'Safety Message/Plan' },
  { num: 'MAP', label: 'Incident Map' },
]

const ICS_FORMS = [
  { num: '201', name: 'Incident Briefing' },
  { num: '202', name: 'Incident Objectives' },
  { num: '203', name: 'Organization Assignment List' },
  { num: '204', name: 'Assignment List' },
  { num: '205', name: 'Communications Plan' },
  { num: '206', name: 'Medical Plan' },
  { num: '207', name: 'Incident Organization Chart' },
  { num: '208', name: 'Safety Message/Plan' },
  { num: '209', name: 'Incident Status Summary' },
  { num: '211', name: 'Incident Check-in List' },
  { num: '213', name: 'General Message' },
  { num: '214', name: 'Activity Log' },
  { num: '215', name: 'Operational Planning Worksheet' },
  { num: '215-A', name: 'Incident/Event Safety, Risk and Health Analysis' },
  { num: '221', name: 'Demobilization Check-out' },
  { num: 'MAP', name: 'Incident Map' },
]

export default function IncidentPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isAdmin } = useAdmin()

  const [incident, setIncident] = useState<Incident | null>(null)
  const [participant, setParticipant] = useState<IncidentParticipant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showRolePicker, setShowRolePicker] = useState(false)
  const [showConfirmChange, setShowConfirmChange] = useState(false)
  const [pendingNewRole, setPendingNewRole] = useState<'IMT' | 'Tactical Resources' | 'Observer' | null>(null)
  const [processing, setProcessing] = useState(false)

  const [manifests, setManifests] = useState<ManifestSummary[]>([])
  const [allPersonnel, setAllPersonnel] = useState<PersonnelSummary[]>([])
  const [formStatuses, setFormStatuses] = useState<Record<string, string>>({})
  const [formCounts, setFormCounts] = useState<Record<string, number>>({})
  const [iapStatus, setIapStatus] = useState<IapStatus>('')
  const [iapRows, setIapRows] = useState<IapSummary[]>([])
  const [showIapModal, setShowIapModal] = useState(false)
  const [operationalPeriod, setOperationalPeriod] = useState('')
  const [incidentCommander, setIncidentCommander] = useState('')
  const [publicStatus, setPublicStatus] = useState<{ description: string; totalCases: string }[]>([])
  const [manifestsLoaded, setManifestsLoaded] = useState(false)
  const [detailsLoaded, setDetailsLoaded] = useState(false)
  /** Training Mode: per-form edit/view per the ICS 207 signature rules. */
  const [trainingAccess, setTrainingAccess] = useState<Record<string, 'edit' | 'view'> | null>(null)

  const fetchGen = useRef(0)
  const userId = user?.id

  const fetchData = useCallback(async () => {
    const gen = ++fetchGen.current
    const isCurrent = () => gen === fetchGen.current

    setLoading(true)
    setError('')
    setManifestsLoaded(false)
    setDetailsLoaded(false)
    setManifests([])
    setAllPersonnel([])
    setFormStatuses({})
    setFormCounts({})
    setOperationalPeriod('')
    setIncidentCommander('')
    setPublicStatus([])
    setIapStatus('')
    setIapRows([])

    // Wave 1: incident header + current participant (independent, run in parallel)
    const fetchParticipant = async (): Promise<IncidentParticipant | null> => {
      if (!userId) return null
      const { data } = await supabase
        .from('incident_participants')
        .select('*')
        .eq('incident_id', id)
        .eq('user_id', userId)
        .eq('status', 'Active')
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data ?? null
    }

    const [incidentResult, participantData] = await Promise.all([
      supabase.from('incidents').select('*').eq('incident_id', id).single(),
      fetchParticipant(),
    ])
    if (!isCurrent()) return

    const { data: incidentData, error: incidentError } = incidentResult
    if (incidentError || !incidentData) {
      setError('Incident not found.')
      setLoading(false)
      return
    }

    setIncident(incidentData)
    setParticipant(participantData)
    setLoading(false) // render the page shell now; remaining data fills in below

    // Wave 2: check-in manifests + every form status + operational period + public status
    // (one parallel batch instead of ~19 sequential queries)
    const fetchFormStatus = async (table: string): Promise<string | null> => {
      const { data } = await supabase.from(table).select('status').eq('incident_id', id).limit(1).maybeSingle()
      return data?.status ?? null
    }

    const [
      manifestsResult,
      status211, status201, status203, status205, status206, status208,
      status213, status215, status215a,
      forms204Result, forms214Result, forms221Result,
      mapResult, form202Result, form207Result, form209Result, iapResult,
    ] = await Promise.all([
      supabase
        .from('checkin_manifests')
        .select('id, checkin_id, incident_id, user_id, agency_name, total_personnel, created_at')
        .eq('incident_id', id)
        .order('created_at', { ascending: false }),
      fetchFormStatus('ics_211_forms'),
      fetchFormStatus('ics_201_forms'),
      fetchFormStatus('ics_203_forms'),
      fetchFormStatus('ics_205_forms'),
      fetchFormStatus('ics_206_forms'),
      fetchFormStatus('ics_208_forms'),
      fetchFormStatus('ics_213_forms'),
      fetchFormStatus('ics_215_forms'),
      fetchFormStatus('ics_215a_forms'),
      // ICS 204 / 214 / 221: many instances per incident — fetch all statuses for count + aggregate badge
      supabase.from('ics_204_forms').select('id, status').eq('incident_id', id).limit(100),
      supabase.from('ics_214_forms').select('id, status').eq('incident_id', id).limit(100),
      supabase.from('ics_221_forms').select('id, status').eq('incident_id', id).limit(100),
      supabase.from('incident_maps').select('id, map_image').eq('incident_id', id).maybeSingle(),
      supabase
        .from('ics_202_forms')
        .select('status, op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time')
        .eq('incident_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('ics_207_forms')
        .select('id, status')
        .eq('incident_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('ics_209_forms')
        .select('status, public_status')
        .eq('incident_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Incident Action Plan rows (silently ignored if the table has not been created yet)
      supabase
        .from('incident_iap')
        .select('id, status, operational_period, approved_at')
        .eq('incident_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    if (!isCurrent()) return

    const manifestsData = manifestsResult.data ?? []
    setManifests(manifestsData)
    setManifestsLoaded(true)

    const statuses: Record<string, string> = {}
    if (status211) statuses['211'] = status211
    if (status201) statuses['201'] = status201
    if (status203) statuses['203'] = status203
    if (status205) statuses['205'] = status205
    if (status206) statuses['206'] = status206
    if (status208) statuses['208'] = status208
    if (status213) statuses['213'] = status213
    if (status215) statuses['215'] = status215
    if (status215a) statuses['215-A'] = status215a
    if (mapResult.data?.map_image) statuses['MAP'] = 'Saved'
    if (form207Result.data?.status) statuses['207'] = form207Result.data.status
    if (form202Result.data?.status) statuses['202'] = form202Result.data.status
    if (form209Result.data?.status) statuses['209'] = form209Result.data.status
    // ICS 204 / 214 / 221: aggregate status (Draft if any instance is a draft) + instance
    // count for the sidebar ×N badge
    const forms204Rows: { status?: string }[] = forms204Result.data ?? []
    if (forms204Rows.length > 0) {
      statuses['204'] = forms204Rows.some((r) => r.status === 'Draft') ? 'Draft' : 'Submitted'
    }
    const forms214Rows: { status?: string }[] = forms214Result.data ?? []
    if (forms214Rows.length > 0) {
      statuses['214'] = forms214Rows.some((r) => r.status === 'Draft') ? 'Draft' : 'Submitted'
    }
    const forms221Rows: { status?: string }[] = forms221Result.data ?? []
    if (forms221Rows.length > 0) {
      statuses['221'] = forms221Rows.some((r) => r.status === 'Draft') ? 'Draft' : 'Submitted'
    }
    setFormStatuses(statuses)
    const counts: Record<string, number> = {}
    if (forms204Rows.length > 0) counts['204'] = forms204Rows.length
    if (forms214Rows.length > 0) counts['214'] = forms214Rows.length
    if (forms221Rows.length > 0) counts['221'] = forms221Rows.length
    setFormCounts(counts)
    const iapList = (!iapResult.error && (iapResult.data as IapSummary[] | null)) || []
    setIapRows(iapList)
    setIapStatus(iapList.find((r) => r.status !== 'Approved')?.status as IapStatus ?? '')

    // Operational period from the latest ICS 202
    const form202Data = form202Result.data
    if (form202Data && (form202Data.op_period_from_date || form202Data.op_period_to_date)) {
      const fmtMil = (t: string) => (t ? t.replace(':', '') + 'H' : '')
      const from = form202Data.op_period_from_date
        ? `${form202Data.op_period_from_date} ${fmtMil(form202Data.op_period_from_time)}`.trim()
        : fmtMil(form202Data.op_period_from_time)
      const to = form202Data.op_period_to_date
        ? `${form202Data.op_period_to_date} ${fmtMil(form202Data.op_period_to_time)}`.trim()
        : fmtMil(form202Data.op_period_to_time)
      setOperationalPeriod(`${from} to ${to}`)
    } else {
      setOperationalPeriod('')
    }

    // Public status from the latest ICS 209
    const form209Data = form209Result.data
    setPublicStatus(
      form209Data?.public_status && Array.isArray(form209Data.public_status)
        ? form209Data.public_status
        : [],
    )

    // Wave 3: personnel (needs manifest ids) + incident commander (needs latest 207 form id)
    const manifestIds = manifestsData.map((m: { id: string }) => m.id)
    const form207Id = form207Result.data?.id ?? null
    const [personnelResult, icPositionResult] = await Promise.all([
      (async () => {
        if (manifestIds.length === 0) return null
        return supabase
          .from('checkin_personnel')
          .select('manifest_id, name, role, capabilities')
          .in('manifest_id', manifestIds)
      })(),
      (async () => {
        if (!form207Id) return null
        return supabase
          .from('ics_207_positions')
          .select('person_name')
          .eq('form_id', form207Id)
          .eq('position_key', 'ic')
          .maybeSingle()
      })(),
    ])
    if (!isCurrent()) return

    setAllPersonnel(personnelResult?.data ?? [])
    setIncidentCommander(icPositionResult?.data?.person_name ?? '')
    setDetailsLoaded(true)
  }, [id, userId])

  useEffect(() => {
    if (id) fetchData()
  }, [id, fetchData])

  // Training Mode: a group's workspace only belongs to ITS trainees. Anyone
  // else landing here (wrong link, another group) is sent to the training.
  useEffect(() => {
    const trainingId = incident?.training_id
    if (!trainingId || !user?.id || !id) return
    let cancelled = false

    ;(async () => {
      const member = await fetchMyMembership(trainingId, user.id)
      if (cancelled) return
      if (!member) {
        // A system admin keeps read-only oversight instead of being bounced.
        if (isAdmin) {
          setTrainingAccess(Object.fromEntries(ICS_FORMS.map((f) => [f.num, 'view' as const])))
        } else {
          navigate(`/training/${trainingId}`, { replace: true })
        }
        return
      }
      if (member.role === 'trainor') {
        // The trainer observes every group.
        setTrainingAccess(Object.fromEntries(ICS_FORMS.map((f) => [f.num, 'view' as const])))
        return
      }

      if (!member.group_id) {
        navigate(`/training/${trainingId}`, { replace: true })
        return
      }
      const { data: group } = await supabase
        .from('training_groups')
        .select('incident_id')
        .eq('id', member.group_id)
        .maybeSingle()
      if (cancelled) return
      if (group?.incident_id !== id) {
        navigate(`/training/${trainingId}`, { replace: true })
        return
      }

      // Trainee of THIS group: edit rights follow the ICS 207 signature rules.
      const holders = await loadPositionHolders(id)
      if (cancelled) return
      const myName = userDisplayName(user)
      const myKeys = [...holders.values()]
        .filter((h) => h.user_id === user.id || (!!myName && h.person_name === myName))
        .map((h) => h.position_key)
      const map: Record<string, 'edit' | 'view'> = {}
      ICS_FORMS.forEach((f) => {
        const rule = SIGNATURE_RULES[f.num as keyof typeof SIGNATURE_RULES]
        map[f.num] = rule && canPrepareWith(rule, holders, myKeys) ? 'edit' : 'view'
      })
      setTrainingAccess(map)
    })()

    return () => { cancelled = true }
  }, [incident?.training_id, user?.id, id, navigate, isAdmin])

  // Leaving is a two-step form flow, not a single update: after the password confirm the
  // user is sent to ICS 211 (skipped when it is already Submitted) and then to ICS 221.
  // The membership only ends when that check-out is submitted (Ics221Form -> completeLeave).
  // The 211 status is re-read here rather than taken from state, because the leave button
  // can be clicked before the incident page has finished loading its form statuses.
  const handleLeaveIncident = async () => {
    if (!participant) {
      setShowLeaveModal(false) // already left — never strand the password dialog
      return
    }

    // The incident's creator never leaves. They are demoted to Observer in place,
    // which keeps them attached as the one person allowed to delete the incident —
    // getting rid of it is done by deleting it, not by walking away.
    if (incident?.created_by === user?.id) {
      const observerRoleId = generateRoleId('Observer')
      const { error: roleError } = await supabase
        .from('incident_participants')
        .update({ role: 'Observer', role_id: observerRoleId })
        .eq('id', participant.id)
      setShowLeaveModal(false)
      if (!roleError) {
        setParticipant({ ...participant, role: 'Observer', role_id: observerRoleId })
      }
      navigate('/dashboard', {
        state: {
          notice: roleError
            ? `You could not be switched to Observer: ${roleError.message}`
            : `As the creator of ${incident?.name || 'this incident'} you cannot leave it — your role is now Observer. To get rid of the incident, delete it from Ongoing Incidents.`,
        },
        replace: true,
      })
      return
    }

    const base = `/incident/${participant.incident_id}`
    const { data: form211 } = await supabase
      .from('ics_211_forms')
      .select('id')
      .eq('incident_id', participant.incident_id)
      .eq('status', 'Submitted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setShowLeaveModal(false)
    navigate(form211 ? `${base}/ics-221/edit?new=1&leave=1` : `${base}/ics-211?leave=1`)
  }

  const handlePickRole = async (newRole: 'IMT' | 'Tactical Resources' | 'Observer') => {
    if (newRole === role) return

    setPendingNewRole(newRole)
    setShowRolePicker(false)
    setShowConfirmChange(true)
  }

  const handleChangeRoleConfirm = async () => {
    if (!participant || !user || !pendingNewRole) return
    setProcessing(true)

    const { error: updateError } = await supabase
      .from('incident_participants')
      .update({ status: 'Left', left_at: new Date().toISOString() })
      .eq('id', participant.id)
    if (updateError) { setError(updateError.message); setProcessing(false); setShowConfirmChange(false); return }
    const newRoleId = generateRoleId(pendingNewRole)
    const { data: insertedRole, error: insertError } = await supabase
      .from('incident_participants')
      .insert({ incident_id: participant.incident_id, user_id: user.id, user_name: participant.user_name, user_email: participant.user_email, role: pendingNewRole, role_id: newRoleId, status: 'Active' })
      .select()
      .single()
    setProcessing(false)
    setShowConfirmChange(false)
    setPendingNewRole(null)
    if (insertError) { setError(insertError.message); return }
    // Switch the local participant immediately so the sidebar locks/unlocks
    // for the new role without a full reload
    if (insertedRole) setParticipant(insertedRole as IncidentParticipant)

    // Notify the IMT of the role change. Must happen AFTER the insert above:
    // send_notification() only accepts an Active sender, and until that new
    // row exists this user's only row is the one just marked 'Left'.
    notifyIncident(participant.incident_id, {
      type: 'role_change',
      title: `${participant.user_name} changed role`,
      body: `${participant.role} → ${pendingNewRole} — ${incident?.name || participant.incident_id}`,
      link: `/incident/${participant.incident_id}`,
      roles: ['IMT'],
      excludeUserId: user.id,
    })

    navigate(`/incident/${participant.incident_id}?role=${encodeURIComponent(pendingNewRole)}`)
  }

  if (loading) {
    return <div className="incident-page"><div className="incident-loading">Loading incident...</div></div>
  }

  if (error || !incident) {
    return (
      <div className="incident-page">
        <div className="incident-error">
          <p>{error || 'Incident not found.'}</p>
          <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    )
  }

  const role = participant?.role || searchParams.get('role') || 'Observer'
  const roleId = participant?.role_id || ''
  const isIMTOrTactical = role === 'IMT' || role === 'Tactical Resources'

  // System admin oversight (authority E). Outside the incidents they created or
  // joined, an admin reads every form and changes none of them — the sidebar
  // says so, every form renders read-only, and the restrictive policies in
  // supabase-admin-guardrails.sql refuse the write even if the screen were
  // talked into offering one.
  const adminReadOnly = isAdmin && !participant && incident.created_by !== user?.id

  // Role authorities (src/lib/permissions.ts): the sidebar locks every form the
  // current role may not open, and ?denied=<form> explains a blocked deep link.
  const deniedKey = searchParams.get('denied') as FormKey | null
  const deniedForm = deniedKey === 'IAP'
    ? { num: 'IAP', name: 'Incident Action Plan' }
    : ICS_FORMS.find((f) => f.num === deniedKey) ?? null
  const iapCanEdit = getFormAccess(role, 'IAP', { restrictToView: adminReadOnly }) === 'edit'

  const handleFormClick = (formNum: string) => {
    if (formNum === '211') {
      navigate(`/incident/${incident.incident_id}/ics-211`)
    } else if (formNum === '207') {
      navigate(`/incident/${incident.incident_id}/ics-207`)
    } else if (formNum === '201') {
      navigate(`/incident/${incident.incident_id}/ics-201`)
    } else if (formNum === 'MAP') {
      navigate(`/incident/${incident.incident_id}/incident-map`)
    } else if (formNum === '202') {
      navigate(`/incident/${incident.incident_id}/ics-202`)
    } else if (formNum === '203') {
      navigate(`/incident/${incident.incident_id}/ics-203`)
    } else if (formNum === '204') {
      navigate(`/incident/${incident.incident_id}/ics-204`)
    } else if (formNum === '205') {
      navigate(`/incident/${incident.incident_id}/ics-205`)
    } else if (formNum === '206') {
      navigate(`/incident/${incident.incident_id}/ics-206`)
    } else if (formNum === '208') {
      navigate(`/incident/${incident.incident_id}/ics-208`)
    } else if (formNum === '209') {
      navigate(`/incident/${incident.incident_id}/ics-209`)
    } else if (formNum === '213') {
      navigate(`/incident/${incident.incident_id}/ics-213`)
    } else if (formNum === '214') {
      navigate(`/incident/${incident.incident_id}/ics-214`)
    } else if (formNum === '215') {
      navigate(`/incident/${incident.incident_id}/ics-215`)
    } else if (formNum === '215-A') {
      navigate(`/incident/${incident.incident_id}/ics-215a`)
    } else if (formNum === '221') {
      navigate(`/incident/${incident.incident_id}/ics-221`)
    }
  }

  const getFormStatus = (formNum: string): string => {
    return formStatuses[formNum] || ''
  }

  // An IAP requirement is met when the form is Submitted (or the Incident Map is Saved)
  const isIapRequirementMet = (formNum: string): boolean => {
    if (formNum === 'MAP') return formStatuses['MAP'] === 'Saved'
    return formStatuses[formNum] === 'Submitted'
  }

  const iapRequirementsMet = detailsLoaded
    ? IAP_REQUIREMENTS.filter((r) => isIapRequirementMet(r.num)).length
    : 0
  const iapReady = detailsLoaded && iapRequirementsMet === IAP_REQUIREMENTS.length

  // One IAP per operational period: the working one (Draft/Submitted) plus every approved document
  const workingIap = iapRows.find((r) => r.status !== 'Approved') ?? null
  const approvedIaps = iapRows.filter((r) => r.status === 'Approved')
  const iapHref = (iapId: string) => `/incident/${incident.incident_id}/iap/${iapId}`

  const handleGenerateIap = () => {
    if (!iapReady) return
    setShowIapModal(true)
  }

  return (
    <div className="incident-page">
      <header className="incident-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="incident-topbar">
        <div className="topbar-left">
          <button
            className="topbar-btn back"
            onClick={() => navigate(incident.training_id ? `/training/${incident.training_id}` : '/join-incident')}
          >
            &larr; {incident.training_id ? 'Training' : 'Back'}
          </button>
          <div className="topbar-info">
            <span className="incident-code-badge">{incident.incident_id}</span>
            {incident.training_id && (
              <span
                className="incident-code-badge training-badge"
                title="Training Mode workspace — your group's ICS package, guided by the window walkthrough"
              >
                Training · group workspace
              </span>
            )}
            <span className={`role-badge ${role.toLowerCase().replace(/\s/g, '-')}`}>{role}</span>
            {roleId && <span className="role-id-badge">{roleId}</span>}
            {adminReadOnly && (
              <span className="admin-readonly-badge" title="System admin oversight: you can read every form in this incident, but only its own members may change them">
                System admin · read-only
              </span>
            )}
          </div>
        </div>
        {!incident.training_id && (
          <div className="topbar-actions">
            <button className="topbar-btn change-role" disabled={processing} onClick={() => setShowRolePicker(true)}>Change Role</button>
            <button className="topbar-btn leave" disabled={processing} onClick={() => setShowLeaveModal(true)}>
              {incident.created_by === user?.id ? 'Switch to Observer' : 'Leave Incident'}
            </button>
          </div>
        )}
      </div>

      <main className="incident-main">
        <div className="incident-layout">
          <div className="incident-content">
            {deniedForm && (
              <div className="incident-panel access-denied-notice" role="status">
                <span className="access-denied-icon" aria-hidden="true">🔒</span>
                <div>
                  <strong>Access restricted</strong>
                  <p>
                    Your role (<span className="denied-role-badge">{role}</span>) cannot open
                    ICS {deniedForm.num} &mdash; {deniedForm.name}.
                  </p>
                </div>
              </div>
            )}
            <div className="incident-panel incident-info-bar">
              <div className="panel-header">
                <div>
                  <h2>{incident.name}</h2>
                  <p className="incident-location-text">{incident.location}</p>
                </div>
              </div>
              <div className="incident-meta-row">
                <span>Type: {incident.type}</span>
                <span>Created by {incident.created_by_name}</span>
                <span>{new Date(incident.created_at).toLocaleDateString()}</span>
              </div>
              <div className="incident-meta-row">
                <span>
                  Operational Period: {detailsLoaded ? (operationalPeriod || <em>Please indicate the operational period using ICS form 202</em>) : <em>Loading...</em>}
                </span>
              </div>
              <div className="incident-meta-row">
                <span>
                  Incident Commander: {detailsLoaded ? (incidentCommander || <em>Please assign the Incident Commander in the organizational chart</em>) : <em>Loading...</em>}
                </span>
              </div>
            </div>

            {publicStatus.length > 0 && (() => {
              const getVal = (desc: string) => {
                const row = publicStatus.find(r => r.description?.toLowerCase() === desc.toLowerCase())
                return row?.totalCases || '0'
              }
              const items = [
                { label: 'Dead', value: getVal('Dead'), icon: '🪦', color: '#991b1b', bg: '#fee2e2' },
                { label: 'Injured', value: getVal('Injured'), icon: '🩹', color: '#92400e', bg: '#fef3c7' },
                { label: 'Missing', value: getVal('Missing'), icon: '?', color: '#1e40af', bg: '#dbeafe' },
                { label: 'Needs Treatment', value: getVal('Needs treatment/immunization'), icon: '🩺', color: '#065f46', bg: '#d1fae5' },
                { label: 'Needs Evacuation', value: getVal('Needs evacuation'), icon: '⛺', color: '#7c2d12', bg: '#ffedd5' },
              ]
              return (
                <div className="incident-panel public-status-card">
                  {items.map((item, idx) => (
                    <div key={idx} className="public-status-item">
                      <div className="public-status-icon" style={{ background: item.bg, color: item.color }}>{item.icon}</div>
                      <div className="public-status-info">
                        <span className="public-status-number">{item.value}</span>
                        <span className="public-status-label">{item.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

            {isIMTOrTactical && manifestsLoaded && (() => {
              const myManifest = manifests.find((m) => m.user_id === user?.id)
              const isCheckedIn = !!myManifest
              return (
                <div className="incident-panel checkin-proceed-section">
                  {isCheckedIn ? (
                    <div className="checked-in-status">
                      <span className="checked-in-badge">Already Checked-in</span>
                      <span className="checked-in-id">{myManifest.checkin_id}</span>
                      <button className="manifest-btn view" onClick={() => navigate(`/incident/${incident.incident_id}/checkin/view?manifest=${myManifest.id}`)}>View My Check-in</button>
                      <button className="manifest-btn edit" onClick={() => navigate(`/incident/${incident.incident_id}/checkin?manifest=${myManifest.id}`)}>Edit</button>
                    </div>
                  ) : (
                    <button className="checkin-proceed-btn" onClick={() => navigate(`/incident/${incident.incident_id}/checkin`)}>
                      Proceed to Check-in
                    </button>
                  )}
                </div>
              )
            })()}

            <div className={`incident-panel iap-card ${iapReady ? 'ready' : ''}`}>
              <div className="panel-header">
                <div className="iap-card-title">
                  <h3>
                    Incident Action Plan
                    {iapStatus && (
                      <span className={`iap-status-badge ${iapStatus.toLowerCase()}`}>{iapStatus}</span>
                    )}
                  </h3>
                  <p>
                    {!detailsLoaded
                      ? 'Checking required forms...'
                      : !iapCanEdit
                        ? 'Your role can review the Incident Action Plan and its approved copies below.'
                        : !iapReady
                          ? 'Complete all required forms below to enable generation.'
                          : iapStatus === 'Submitted'
                            ? 'All requirements are complete. Your IAP cover page is submitted.'
                            : iapStatus === 'Draft'
                              ? 'All requirements are complete. Your cover page draft is saved — submit when ready.'
                              : 'All requirements are complete. The plan is ready to generate.'}
                  </p>
                </div>
                <div className="iap-card-actions">
                  {iapStatus === 'Submitted' && workingIap?.id && (
                    <Link className="iap-open-btn" to={iapHref(workingIap.id)}>
                      Review IAP
                    </Link>
                  )}
                  {iapCanEdit && (
                    <button
                      className="iap-generate-btn"
                      disabled={!iapReady}
                      onClick={handleGenerateIap}
                      title={iapReady ? 'Generate Incident Action Plan' : 'Required forms are not yet complete'}
                    >
                      {iapStatus ? 'Update Cover Page' : 'Generate IAP'}
                    </button>
                  )}
                </div>
              </div>
              <ul className="iap-requirements">
                {IAP_REQUIREMENTS.map((req) => {
                  const met = detailsLoaded && isIapRequirementMet(req.num)
                  return (
                    <li key={req.num} className={`iap-req-item ${met ? 'met' : 'pending'}`}>
                      <span className="iap-req-check">{met ? '✓' : '○'}</span>
                      <span className="iap-req-num">{req.num}</span>
                      <span className="iap-req-name">{req.label}</span>
                      {!detailsLoaded ? (
                        <span className="iap-req-state">Checking...</span>
                      ) : (
                        <span className={`iap-req-state ${met ? 'ok' : 'wait'}`}>
                          {met ? 'Ready' : req.num === 'MAP' ? 'Not saved' : 'Not submitted'}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              <div className="iap-progress">
                <div className="iap-progress-track">
                  <div className="iap-progress-fill" style={{ width: `${(iapRequirementsMet / IAP_REQUIREMENTS.length) * 100}%` }} />
                </div>
                <span className="iap-progress-text">
                  {detailsLoaded ? `${iapRequirementsMet} of ${IAP_REQUIREMENTS.length} requirements complete` : 'Loading requirements...'}
                </span>
              </div>

              <div className="iap-approved-section">
                <div className="iap-approved-header">
                  <h4>Approved Incident Action Plans</h4>
                  <span className="approved-iap-count">{approvedIaps.length}</span>
                </div>
                {approvedIaps.length === 0 ? (
                  <p className="no-resources-text">
                    No approved IAPs yet. Once an Incident Action Plan is approved it is listed here with its operational period.
                  </p>
                ) : (
                  <div className="resource-table-wrapper">
                    <table className="resource-table">
                      <thead>
                        <tr>
                          <th>Operational Period</th>
                          <th>Approved</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedIaps.map((iap) => (
                          <tr key={iap.id}>
                            <td className="iap-op-cell">{iap.operational_period || '—'}</td>
                            <td className="date-cell">
                              {iap.approved_at ? new Date(iap.approved_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="actions-cell">
                              <Link className="manifest-btn view" to={iapHref(iap.id)}>
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="incident-panel resource-section">
              <h3>Checked-in Resources</h3>
              {!manifestsLoaded ? (
                <p className="no-resources-text">Loading check-ins...</p>
              ) : manifests.length === 0 ? (
                <p className="no-resources-text">No resources have been checked in yet.</p>
              ) : (
                <div className="resource-table-wrapper">
                  <table className="resource-table">
                    <thead>
                      <tr>
                        <th>Check-in ID</th>
                        <th>Timestamp</th>
                        <th>Agency Name</th>
                        <th>Leader</th>
                        <th>Personnel</th>
                        <th>Capabilities</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manifests.map((m) => {
                        const manifestPersonnel = allPersonnel.filter((p) => p.manifest_id === m.id)
                        const leader = manifestPersonnel.find((p) => p.role === 'Leader')
                        return (
                          <tr key={m.id}>
                            <td className="code-cell">{m.checkin_id}</td>
                            <td className="date-cell">{new Date(m.created_at).toLocaleDateString()} {formatMilitaryTime(m.created_at)}</td>
                            <td>{m.agency_name}</td>
                            <td>{leader ? leader.name : '-'}</td>
                            <td className="number-cell">{m.total_personnel}</td>
                            <td>{leader?.capabilities || '-'}</td>
                            <td className="actions-cell">
                              <button className="manifest-btn view" onClick={() => navigate(`/incident/${incident.incident_id}/checkin/view?manifest=${m.id}`)}>
                                View
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <aside className="ics-sidebar">
            <div className="ics-sidebar-header">
              <h3>ICS Forms</h3>
            </div>
            <div className="ics-sidebar-list">
              {ICS_FORMS.map((form) => {
                const access = trainingAccess
                  ? (trainingAccess[form.num] ?? 'view')
                  : getFormAccess(role, form.num as FormKey, { restrictToView: adminReadOnly })
                const locked = access === 'none'
                const status = locked ? '' : getFormStatus(form.num)
                const isActive = form.num === '211' && !locked
                const hint = locked
                  ? `Restricted — your role (${role}) cannot open this form`
                  : access === 'view'
                    ? trainingAccess
                      ? 'Training Mode — only the designated ICS 207 position (or the IC) can prepare this form'
                      : adminReadOnly
                        ? 'System admin oversight — readable, but only the incident\'s own members may change it'
                        : `View only — your role (${role}) cannot change this form`
                    : undefined
                return (
                  <div
                    key={form.num}
                    className={`ics-sidebar-item ${isActive ? 'active' : ''} ${status ? 'has-status' : ''} ${locked ? 'locked' : ''}`}
                    onClick={locked ? undefined : () => handleFormClick(form.num)}
                    title={hint}
                  >
                    <span className="sidebar-form-num">{form.num}</span>
                    <span className="sidebar-form-name">{form.name}</span>
                    {locked ? (
                      <span className="sidebar-lock-badge" aria-label="Restricted">&#128274;</span>
                    ) : (
                      <>
                        {(formCounts[form.num] || 0) > 0 && (
                          <span className="sidebar-count-badge">&times;{formCounts[form.num]}</span>
                        )}
                        {status && (
                          <span className={`sidebar-status-badge ${status.toLowerCase()}`}>{status}</span>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </aside>
        </div>
      </main>

      {showIapModal && (
        <IapCoverModal
          incidentId={incident.incident_id}
          incidentName={incident.name}
          onClose={() => setShowIapModal(false)}
          onStatusChange={setIapStatus}
          onProceed={(iapId) => {
            setShowIapModal(false)
            navigate(`/incident/${incident.incident_id}/iap/${iapId}`)
          }}
        />
      )}

      {showLeaveModal && (
        <ConfirmModal
          title={incident.created_by === user?.id ? 'Leave Incident (as Observer)' : 'Leave Incident'}
          message={
            incident.created_by === user?.id
              ? `You created ${incident.incident_id}, so you cannot leave it — you will be switched to Observer instead, and to get rid of the incident you delete it from Ongoing Incidents. Enter your password to confirm.`
              : `Are you sure you want to leave incident ${incident.incident_id}? Enter your password to confirm.`
          }
          onConfirm={handleLeaveIncident}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}

      {showRolePicker && (
        <div className="modal-overlay" onClick={() => setShowRolePicker(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Change Role</h3>
            <p className="modal-message">Select a new role for incident {incident.incident_id}. Your current role ({role}) will be deactivated.</p>
            <div className="role-picker-buttons">
              {(['IMT', 'Tactical Resources', 'Observer'] as const).map((r) => (
                <button key={r} className={`role-picker-btn ${r.toLowerCase().replace(/\s/g, '-')} ${r === role ? 'current' : ''}`} disabled={r === role} onClick={() => handlePickRole(r)}>
                  {r === role ? `${r} (Current)` : r}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowRolePicker(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmChange && pendingNewRole && (
        <ConfirmModal
          title="Confirm Role Change"
          message={`Enter your password to confirm changing from ${role} to ${pendingNewRole}.`}
          onConfirm={handleChangeRoleConfirm}
          onCancel={() => { setShowConfirmChange(false); setPendingNewRole(null) }}
        />
      )}
    </div>
  )
}
