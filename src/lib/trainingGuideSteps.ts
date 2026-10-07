/**
 * The skippable window-guide sequence for Training Mode.
 *
 * Trainees are walked through the ICS process step by step: each window
 * explains what to do next and links straight to the relevant existing form.
 * Every step can be skipped, and progress is stored per trainee
 * (training_guide_progress). Regular incident users never see any of this.
 *
 * The order mirrors the training syllabus:
 *   check-in → 211 → 207 → activity packet → 201 → 202 → 203 → map →
 *   205 → 206 → 208 → 215 → 215A → 204s → cover page → generate IAP →
 *   approve IAP
 *
 * ICS 213 (messages), 209 and 221 stay available without guide steps.
 */

import { supabase } from './supabase'

export interface GuideStep {
  key: string
  /** Step heading, e.g. "Step 5 — ICS 201". */
  title: string
  /** Sidebar/checklist label. */
  label: string
  /** Instruction paragraphs shown in the window. */
  body: string[]
  /** Pathname patterns that mean "the trainee is on this step". */
  routes: RegExp[]
  /** Primary button of the window. */
  action: { label: string; path: string | null }
  /** True for steps driven from the incident hub (no dedicated route). */
  hub?: boolean
}

/** `:id` is replaced with the group's incident id when navigating. */
export const GUIDE_STEPS: GuideStep[] = [
  {
    key: 'checkin',
    title: 'Step 1 — Check-in',
    label: 'Check-in',
    body: [
      'Welcome to the training. Your first task is to check in your resources so the incident knows who is on the ground.',
      'Open the check-in form and submit a manifest for your group (personnel, vehicles and equipment).',
    ],
    routes: [/^\/incident\/[^/]+\/checkin(?:\/view)?$/],
    action: { label: 'Open Check-in', path: '/incident/:id/checkin' },
  },
  {
    key: '211',
    title: 'Step 2 — ICS 211 Check-in List',
    label: 'ICS 211',
    body: [
      'Record arriving resources on ICS 211 (Incident Check-in List).',
      'Every unit that arrives gets a row: identifier, agency, leader and contact details.',
    ],
    routes: [/^\/incident\/[^/]+\/ics-211$/],
    action: { label: 'Open ICS 211', path: '/incident/:id/ics-211' },
  },
  {
    key: '207',
    title: 'Step 3 — ICS 207 Org Chart',
    label: 'ICS 207',
    body: [
      'Build your group\'s organization chart on ICS 207.',
      'Assign each trainee to a position — pick them from your group\'s accounts so their name links to the position.',
      'Important: every signature on the later forms comes from this chart, so fill it in before moving on.',
    ],
    routes: [/^\/incident\/[^/]+\/ics-207$/],
    action: { label: 'Open ICS 207', path: '/incident/:id/ics-207' },
  },
  {
    key: 'packet',
    title: 'Step 4 — Activity Packet',
    label: 'Read activity packet',
    body: [
      'Your trainer posts updates for the scenario in the announcement box.',
      'Read the latest announcement (your activity packet) carefully — the next forms depend on the scenario it describes.',
    ],
    routes: [/^\/incident\/[^/]+$/],
    hub: true,
    action: { label: "I've read it", path: null },
  },
  {
    key: '201',
    title: 'Step 5 — ICS 201 Incident Briefing',
    label: 'ICS 201',
    body: [
      'Update ICS 201 based on the scenario in your activity packet.',
      'In Training Mode the "Prepared by" signature is pre-filled from your ICS 207 org chart (the IC signs 201).',
    ],
    routes: [/^\/incident\/[^/]+\/ics-201$/],
    action: { label: 'Open ICS 201', path: '/incident/:id/ics-201' },
  },
  {
    key: '202',
    title: 'Step 6 — ICS 202 Incident Objectives',
    label: 'ICS 202',
    body: [
      'Set the operational period and objectives for your group on ICS 202.',
      'Prepared by the PSC and approved by the IC — both signatures come from ICS 207.',
    ],
    routes: [/^\/incident\/[^/]+\/ics-202$/],
    action: { label: 'Open ICS 202', path: '/incident/:id/ics-202' },
  },
  {
    key: '203',
    title: 'Step 7 — ICS 203 Organization Assignment List',
    label: 'ICS 203',
    body: [
      'ICS 203 lists your organization. It is autofilled from the positions you entered on ICS 207.',
      'Review the autofilled names, complete anything missing, then submit.',
    ],
    routes: [/^\/incident\/[^/]+\/ics-203$/],
    action: { label: 'Open ICS 203', path: '/incident/:id/ics-203' },
  },
  {
    key: 'map',
    title: 'Step 8 — Incident Map',
    label: 'Incident Map',
    body: [
      'Mark up your group\'s incident map: sketch or live map with the symbols for your scenario.',
      'The saved map becomes part of the Incident Action Plan.',
    ],
    routes: [/^\/incident\/[^/]+\/incident-map$/],
    action: { label: 'Open Incident Map', path: '/incident/:id/incident-map' },
  },
  {
    key: '205',
    title: 'Step 9 — ICS 205 Communications Plan',
    label: 'ICS 205',
    body: [
      'Document your communications plan on ICS 205: channels, frequencies and assignments.',
      'Prepared by the COML (or LSC) from your org chart.',
    ],
    routes: [/^\/incident\/[^/]+\/ics-205$/],
    action: { label: 'Open ICS 205', path: '/incident/:id/ics-205' },
  },
  {
    key: '206',
    title: 'Step 10 — ICS 206 Medical Plan',
    label: 'ICS 206',
    body: [
      'Complete the medical plan: aid stations, ambulances and hospitals for your scenario.',
      'Prepared by the MEDL (or SOFR) from your org chart.',
    ],
    routes: [/^\/incident\/[^/]+\/ics-206$/],
    action: { label: 'Open ICS 206', path: '/incident/:id/ics-206' },
  },
  {
    key: '208',
    title: 'Step 11 — ICS 208 Safety Message/Plan',
    label: 'ICS 208',
    body: [
      'Write the safety message and plan for your operational period on ICS 208.',
      'Prepared by the SOFR from your org chart.',
    ],
    routes: [/^\/incident\/[^/]+\/ics-208$/],
    action: { label: 'Open ICS 208', path: '/incident/:id/ics-208' },
  },
  {
    key: '215',
    title: 'Step 12 — ICS 215 Operational Planning Worksheet',
    label: 'ICS 215',
    body: [
      'Lay out the work assignments for your operational period on ICS 215.',
      'Prepared by the OSC from your org chart.',
    ],
    routes: [/^\/incident\/[^/]+\/ics-215$/],
    action: { label: 'Open ICS 215', path: '/incident/:id/ics-215' },
  },
  {
    key: '215a',
    title: 'Step 13 — ICS 215A Safety/Risk Analysis',
    label: 'ICS 215A',
    body: [
      'Analyse the safety risks of the assignments on ICS 215A.',
      'Prepared by the SOFR and the OSC — both signature lines come from your org chart.',
    ],
    routes: [/^\/incident\/[^/]+\/ics-215a$/],
    action: { label: 'Open ICS 215A', path: '/incident/:id/ics-215a' },
  },
  {
    key: '204',
    title: 'Step 14 — ICS 204 Assignment List',
    label: 'ICS 204s',
    body: [
      'Break the operational period down into assignment lists — one ICS 204 per assignment as needed.',
      'Prepared by the RESL (or PSC) from your org chart.',
    ],
    routes: [/^\/incident\/[^/]+\/ics-204(\/edit)?$/],
    action: { label: 'Open ICS 204', path: '/incident/:id/ics-204' },
  },
  {
    key: 'cover',
    title: 'Step 15 — IAP Cover Page',
    label: 'IAP cover page',
    body: [
      'Your group\'s forms are in. Now prepare the Incident Action Plan, starting with the cover page.',
      'On the incident page, press "Generate IAP" and upload the cover image for your group.',
    ],
    routes: [/^\/incident\/[^/]+$/],
    hub: true,
    action: { label: 'Go to incident page', path: null },
  },
  {
    key: 'generate',
    title: 'Step 16 — Generate the IAP',
    label: 'Generate IAP',
    body: [
      'Press "Generate IAP" on the incident page. The plan assembles your submitted 202, 203, 204, 205, 206, 208 and the map.',
      'The operational period is taken from ICS 202 — check it before submitting.',
    ],
    routes: [/^\/incident\/[^/]+$/],
    hub: true,
    action: { label: 'Go to incident page', path: null },
  },
  {
    key: 'approve',
    title: 'Step 17 — Approve the IAP',
    label: 'Approve IAP',
    body: [
      'Open your generated IAP and press "Approve IAP". Approved IAPs freeze into a read-only document your trainer can review from the monitoring card.',
    ],
    routes: [/^\/incident\/[^/]+\/iap\/[^/]+$/, /^\/incident\/[^/]+$/],
    hub: true,
    action: { label: 'Go to incident page', path: null },
  },
]

/** First step whose path pattern matches the current pathname. */
export function findStepByRoute(pathname: string): GuideStep | null {
  return GUIDE_STEPS.find((step) => step.routes.some((re) => re.test(pathname))) ?? null
}

/** Route (with :id substituted) for a step, or null for hub-only steps. */
export function stepPath(step: GuideStep, incidentId: string): string | null {
  return step.action.path ? step.action.path.replace(':id', incidentId) : null
}

// ---------------------------------------------------------------------------
// Auto-completion — a step marks itself done when its form is submitted
// ---------------------------------------------------------------------------

const SINGLE_FORM_TABLES: Record<string, string> = {
  '211': 'ics_211_forms',
  '207': 'ics_207_forms',
  '201': 'ics_201_forms',
  '202': 'ics_202_forms',
  '203': 'ics_203_forms',
  '205': 'ics_205_forms',
  '206': 'ics_206_forms',
  '208': 'ics_208_forms',
  '215': 'ics_215_forms',
  '215a': 'ics_215a_forms',
}

/**
 * True when the step's work already exists for this group incident — the
 * guide then marks the step done by itself (the trainee never has to press
 * anything). Falls back to false for the manual steps (packet, cover page).
 */
export async function isStepComplete(incidentId: string, stepKey: string): Promise<boolean> {
  try {
    if (stepKey === 'checkin') {
      const { data } = await supabase
        .from('checkin_manifests')
        .select('id')
        .eq('incident_id', incidentId)
        .eq('status', 'Submitted')
        .limit(1)
        .maybeSingle()
      return !!data
    }

    if (stepKey === '204') {
      const { data } = await supabase
        .from('ics_204_forms')
        .select('id')
        .eq('incident_id', incidentId)
        .eq('status', 'Submitted')
        .limit(1)
        .maybeSingle()
      return !!data
    }

    if (stepKey === 'map') {
      const { data } = await supabase.from('incident_maps').select('id').eq('incident_id', incidentId).limit(1).maybeSingle()
      return !!data
    }

    if (stepKey === 'cover' || stepKey === 'generate' || stepKey === 'approve') {
      const { data } = await supabase
        .from('incident_iap')
        .select('status')
        .eq('incident_id', incidentId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!data) return false
      if (stepKey === 'cover') return true // a cover page row exists
      if (stepKey === 'generate') return data.status === 'Submitted' || data.status === 'Approved'
      return data.status === 'Approved'
    }

    const table = SINGLE_FORM_TABLES[stepKey]
    if (table) {
      const { data } = await supabase
        .from(table)
        .select('status')
        .eq('incident_id', incidentId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data?.status === 'Submitted'
    }

    return false
  } catch {
    return false
  }
}
