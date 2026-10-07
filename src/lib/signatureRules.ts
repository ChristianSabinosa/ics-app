/**
 * Signature rules for TRAINING MODE (they do not apply to real incidents).
 *
 * Every ICS form is "prepared by" a position from the group's ICS 207 org
 * chart. The 207 position rows carry a `user_id` (accounts), which is what
 * this module resolves against. If a designated position — or the IC — is
 * unfilled, the form falls back to manual entry so the guided flow never
 * stalls; the IC, once assigned, can prepare any form (overrides all).
 *
 * The rules are enforced in two places:
 *   - <FormAccess> uses `resolveTrainingAccess` to decide edit/view/none
 *   - each form page uses `useTrainingSignature` to prefill its signature
 *     fields from the org chart (prefill stays editable)
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'
import type { FormKey } from './permissions'
import { userDisplayName } from './training'

// ---------------------------------------------------------------------------
// The rule table
// ---------------------------------------------------------------------------

export interface SignatureRule {
  /** Position keys allowed to prepare the form ("or" rules list both). */
  keys: string[]
  /** True when any trainee in the group may prepare it (209, 211, 213, 214...). */
  any?: boolean
}

export const SIGNATURE_RULES: Record<FormKey, SignatureRule> = {
  '201': { keys: ['ic'] },
  '202': { keys: ['psc'] }, // approved by IC (separate block)
  '203': { keys: ['psc-resl', 'psc'] },
  '204': { keys: ['psc-resl', 'psc'] },
  '205': { keys: ['lsc-coml', 'lsc'] },
  '206': { keys: ['lsc-medl', 'sofr'] },
  '207': { keys: [], any: true }, // bootstraps every other position
  '208': { keys: ['sofr'] },
  '209': { keys: [], any: true },
  '211': { keys: [], any: true },
  '213': { keys: [], any: true },
  '214': { keys: [], any: true },
  '215': { keys: ['osc'] },
  '215-A': { keys: ['sofr', 'osc'] }, // two lines: SOFR + OSC
  '221': { keys: ['psc-dmob', 'psc'] },
  MAP: { keys: [], any: true },
  CHECKIN: { keys: [], any: true },
  IAP: { keys: [], any: true },
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export interface PositionHolder {
  position_key: string
  position_title: string
  abbreviation: string
  person_name: string
  user_id: string | null
}

export interface TrainingAccess {
  trainingId: string
  groupId: string | null
  role: 'trainor' | 'trainee' | null
  /** False for the trainer (observe only) and for anyone outside the group. */
  canEdit: boolean
  /** The user is a trainee of THIS group's incident. */
  inGroup: boolean
  /** Positions keyed by position_key (only rows with data are included). */
  holders: Map<string, PositionHolder>
  /** Position keys held by the signed-in user. */
  myKeys: string[]
  /**
   * Signature prefill values, resolved from the org chart:
   *   prepared  — the form's "Prepared by" line
   *   approved  — ICS 202's "Approved by IC" line
   *   sofr/osc  — ICS 215A's two lines
   * Null means "stay manual" (position unfilled).
   */
  prefill: { prepared: string | null; approved: string | null; sofr: string | null; osc: string | null }
  /** Human-readable hint for the prefill, e.g. "Auto-filled from ICS 207 — IC". */
  hint: string | null
}

const isFilled = (p: PositionHolder | undefined): boolean =>
  !!p && (!!p.user_id || !!(p.person_name && p.person_name.trim()))

function holderName(p: PositionHolder | undefined): string | null {
  return isFilled(p) ? (p!.person_name || '') : null
}

/**
 * Pure edit rule for one form (shared by <FormAccess> and the incident
 * sidebar): the designated position holder, or the IC (who overrides all
 * forms), may prepare it; "any" forms are open to every trainee; when neither
 * the designated position nor the IC exists yet, the form stays editable so
 * the guided flow never stalls.
 */
export function canPrepareWith(
  rule: SignatureRule,
  holders: Map<string, PositionHolder>,
  myKeys: string[],
): boolean {
  if (rule.any) return true
  if (myKeys.some((k) => rule.keys.includes(k)) || myKeys.includes('ic')) return true
  const designatedFilled = rule.keys.some((k) => isFilled(holders.get(k)))
  const icFilled = isFilled(holders.get('ic'))
  return !designatedFilled && !icFilled
}

/**
 * Returns null when the incident is not part of a training (regular incident
 * behaviour is entirely untouched).
 */
export async function resolveTrainingAccess(
  incidentId: string,
  userId: string,
  form: FormKey,
  displayName: string,
): Promise<TrainingAccess | null> {
  const { data: incident } = await supabase
    .from('incidents')
    .select('training_id')
    .eq('incident_id', incidentId)
    .maybeSingle()

  const trainingId = (incident as { training_id: string | null } | null)?.training_id
  if (!trainingId) return null

  const empty: TrainingAccess = {
    trainingId,
    groupId: null,
    role: null,
    canEdit: false,
    inGroup: false,
    holders: new Map(),
    myKeys: [],
    prefill: { prepared: null, approved: null, sofr: null, osc: null },
    hint: null,
  }

  const [{ data: memberRow }, { data: groupRow }] = await Promise.all([
    supabase.from('training_members').select('*').eq('training_id', trainingId).eq('user_id', userId).maybeSingle(),
    supabase
      .from('training_groups')
      .select('id, incident_id')
      .eq('training_id', trainingId)
      .order('sort_order', { ascending: true }),
  ])

  const member = memberRow as { role: 'trainor' | 'trainee'; group_id: string | null } | null
  if (!member) return empty // not a member of this training at all

  const groups = (groupRow ?? []) as { id: string; incident_id: string | null }[]
  const myGroup = groups.find((g) => g.id === member.group_id) ?? null
  const inGroup = !!myGroup && myGroup.incident_id === incidentId

  if (member.role === 'trainor' || !inGroup) {
    return { ...empty, role: member.role, groupId: member.group_id, inGroup: false }
  }

  // Load the group's LATEST 207 and its position holders.
  const holders = await loadPositionHolders(incidentId)
  // Held by this user: linked account first, exact name as the fallback for
  // positions that were typed instead of picked from the group accounts.
  const myPositionRows = [...holders.values()].filter(
    (h) => h.user_id === userId || (!!displayName && h.person_name === displayName),
  )
  const myKeys = myPositionRows.map((h) => h.position_key)

  const rule = SIGNATURE_RULES[form] ?? { keys: [], any: true }
  const canEdit = canPrepareWith(rule, holders, myKeys)

  // ---- signature prefill -------------------------------------------------
  const designatedHolder =
    rule.keys.map((k) => holders.get(k)).find(isFilled) ?? holders.get('ic')
  const icHolder = holders.get('ic')

  const prefilled = rule.any ? displayName || null : null

  const prepared = rule.any ? prefilled : holderName(designatedHolder)
  const designated = rule.keys.map((k) => holders.get(k)).find(isFilled)

  const hint = designated
    ? `Auto-filled from ICS 207 — ${designated.abbreviation || designated.position_key}`
    : isFilled(icHolder)
      ? `No ${rule.keys.map((k) => k.toUpperCase()).join('/')} assigned — signed by IC per ICS 207`
      : rule.any
        ? 'Prepared by you'
        : `No ${rule.keys.map((k) => k.toUpperCase()).join('/')} or IC assigned in ICS 207 — signature stays manual`

  return {
    trainingId,
    groupId: member.group_id,
    role: member.role,
    canEdit,
    inGroup: true,
    holders,
    myKeys,
    prefill: {
      prepared,
      approved: holderName(icHolder),
      sofr: holderName(holders.get('sofr')) ?? holderName(icHolder),
      osc: holderName(holders.get('osc')) ?? holderName(icHolder),
    },
    hint,
  }
}

/** Latest 207 form's positions, keyed by position_key (only filled rows). */
export async function loadPositionHolders(incidentId: string): Promise<Map<string, PositionHolder>> {
  const holders = new Map<string, PositionHolder>()

  const { data: form } = await supabase
    .from('ics_207_forms')
    .select('id')
    .eq('incident_id', incidentId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!form) return holders

  const { data: positions } = await supabase
    .from('ics_207_positions')
    .select('position_key, position_title, abbreviation, person_name, user_id')
    .eq('form_id', form.id)

  ;(positions ?? []).forEach((row) => {
    const holder = row as unknown as PositionHolder
    if (isFilled(holder)) holders.set(holder.position_key, holder)
  })

  return holders
}

// ---------------------------------------------------------------------------
// Hook used by the form pages for prefill
// ---------------------------------------------------------------------------

export interface TrainingSignatureState {
  /** False for regular incidents — forms skip all prefill logic then. */
  enabled: boolean
  loading: boolean
  access: TrainingAccess | null
  /** "Prepared by" value from the org chart (null = stay manual). */
  prepared: string | null
  /** ICS 202's "Approved by IC" value. */
  approved: string | null
  /** ICS 215A lines. */
  sofr: string | null
  osc: string | null
  hint: string | null
  canEdit: boolean
}

const IDLE: TrainingSignatureState = {
  enabled: false,
  loading: false,
  access: null,
  prepared: null,
  approved: null,
  sofr: null,
  osc: null,
  hint: null,
  canEdit: true,
}

/**
 * Resolves this form's training signature for the signed-in user. Returns
 * `{ enabled: false }` on regular incidents, so call sites can guard cheaply:
 *
 *   const sig = useTrainingSignature('205')
 *   useEffect(() => { if (sig.enabled && !preparedBy) setPreparedBy(sig.prepared) }, [...])
 */
export function useTrainingSignature(form: FormKey): TrainingSignatureState {
  const { id: incidentId } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<TrainingSignatureState>(IDLE)

  const userId = user?.id
  const displayName = userDisplayName(user)

  useEffect(() => {
    let cancelled = false
    if (!incidentId || !userId || authLoading) {
      setState(IDLE)
      return
    }

    setState((s) => ({ ...s, loading: true }))
    resolveTrainingAccess(incidentId, userId, form, displayName).then((access) => {
      if (cancelled) return
      if (!access) {
        setState(IDLE)
        return
      }
      setState({
        enabled: true,
        loading: false,
        access,
        prepared: access.prefill.prepared,
        approved: access.prefill.approved,
        sofr: access.prefill.sofr,
        osc: access.prefill.osc,
        hint: access.hint,
        canEdit: access.canEdit,
      })
    })

    return () => { cancelled = true }
  }, [incidentId, userId, form, authLoading, displayName])

  return state
}
