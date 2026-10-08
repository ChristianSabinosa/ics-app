/**
 * Manual ICS 203 Operations Section (box 7) model.
 *
 * The preparer owns this structure: they choose how many branches and
 * standalone divisions/groups are activated and type the names, like the
 * paper form. "Import from 207" fills it once from the 207 org chart; after
 * that it is a free snapshot saved with the 203 form (ops_data JSONB).
 */

export interface OpsDivision {
  /** Division/Group name, e.g. "SAR Group". */
  name: string
  /** Assigned personnel, e.g. "Andres Bonifacio". */
  personnel: string
}

export interface OpsBranch {
  label: string
  director: string
  deputy: string
  divisions: OpsDivision[]
}

export interface OpsData {
  branches: OpsBranch[]
  standalone: OpsDivision[]
}

export interface OpsPosition {
  position_key: string
  position_title: string
  section: string
  person_name: string
  parent_key: string | null
}

export const MIN_DIVISION_ROWS = 4

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export function defaultBranchLabel(index: number): string {
  return `BRANCH ${ROMAN[index] ?? index + 1}`
}

export function emptyBranch(index: number): OpsBranch {
  return { label: defaultBranchLabel(index), director: '', deputy: '', divisions: [{ name: '', personnel: '' }] }
}

export function emptyOps(): OpsData {
  return { branches: [], standalone: [] }
}

const isOpsDivision = (v: unknown): v is OpsDivision =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as OpsDivision).name === 'string' &&
  typeof (v as OpsDivision).personnel === 'string'

export function isOpsData(v: unknown): v is OpsData {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    Array.isArray(o.branches) &&
    Array.isArray(o.standalone) &&
    (o.branches as unknown[]).every(
      b =>
        typeof b === 'object' &&
        b !== null &&
        typeof (b as OpsBranch).label === 'string' &&
        Array.isArray((b as OpsBranch).divisions) &&
        ((b as OpsBranch).divisions as unknown[]).every(isOpsDivision),
    ) &&
    (o.standalone as unknown[]).every(isOpsDivision)
  )
}

/** Accept legacy snapshots that stored plain name strings. */
export function coerceOpsData(v: unknown): OpsData | null {
  if (isOpsData(v)) return v
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  if (!Array.isArray(o.branches) || !Array.isArray(o.standalone)) return null
  const div = (d: unknown): OpsDivision =>
    typeof d === 'string' ? { name: d, personnel: '' } : isOpsDivision(d) ? d : { name: '', personnel: '' }
  try {
    return {
      branches: (o.branches as unknown[]).map(b => {
        const bb = b as Partial<OpsBranch>
        return {
          label: typeof bb.label === 'string' ? bb.label : 'BRANCH',
          director: typeof bb.director === 'string' ? bb.director : '',
          deputy: typeof bb.deputy === 'string' ? bb.deputy : '',
          divisions: Array.isArray(bb.divisions) ? (bb.divisions as unknown[]).map(div) : [],
        }
      }),
      standalone: (o.standalone as unknown[]).map(div),
    }
  } catch {
    return null
  }
}

// Standard-tab 207 stores Branch/Division/Group subs with section 'OSC Sub';
// recognize them by their auto-generated keys osc-brN / osc-divN / osc-grN
// (built-ins like osc-stam / osc-aob don't match).
const stdOscType = (p: OpsPosition): 'branch' | 'division' | 'group' | null => {
  if (p.section !== 'OSC Sub') return null
  if (p.position_key.startsWith('osc-br')) return 'branch'
  if (p.position_key.startsWith('osc-div')) return 'division'
  if (p.position_key.startsWith('osc-gr')) return 'group'
  return null
}

/** Branches from both 207 variants: Expanded 'OSC Branch' + Standard-tab subs. */
export function getOpsBranches(positions: OpsPosition[]): OpsPosition[] {
  return positions.filter(
    p => p.section === 'OSC Branch' || stdOscType(p) === 'branch',
  )
}

/** Divisions/groups not nested under a branch, from both 207 variants. */
export function getStandaloneDivGroups(
  positions: OpsPosition[],
  branches: OpsPosition[],
): OpsPosition[] {
  const underBranch = (p: OpsPosition) => branches.some(b => p.parent_key === b.position_key)
  return positions.filter(
    p =>
      ((p.section === 'OSC Division' || p.section === 'OSC Group') && !underBranch(p)) ||
      (stdOscType(p) === 'division' || stdOscType(p) === 'group'),
  )
}

/** Recursively collect division/group/task-force/strike-team/single-resource
 *  units under a branch (Expanded tab can nest group under division). */
function collectDescendants(
  positions: OpsPosition[],
  parentKey: string,
  out: OpsDivision[],
  seen: Set<string>,
): void {
  for (const p of positions) {
    if (p.parent_key !== parentKey || seen.has(p.position_key)) continue
    seen.add(p.position_key)
    if (
      p.section === 'OSC Division' ||
      p.section === 'OSC Group' ||
      p.section === 'OSC Task Force' ||
      p.section === 'OSC Strike Team' ||
      p.section === 'OSC Single Resource'
    ) {
      out.push({ name: p.position_title || '', personnel: p.person_name || '' })
    }
    collectDescendants(positions, p.position_key, out, seen)
  }
}

/** One-time snapshot of the 207 org chart into the manual 203 structure. */
export function buildOpsFromPositions(positions: OpsPosition[]): OpsData {
  const branches = getOpsBranches(positions)
  return {
    branches: branches.map(b => {
      const divisions: OpsDivision[] = []
      collectDescendants(positions, b.position_key, divisions, new Set())
      return {
        label: b.position_title || 'BRANCH',
        director: b.person_name || '',
        deputy: '',
        divisions,
      }
    }),
    standalone: getStandaloneDivGroups(positions, branches).map(p => ({
      name: p.position_title || '',
      personnel: p.person_name || '',
    })),
  }
}

/** Paper-form default: blank BRANCH I–III. Printed when the user hasn't
 *  customized the structure (see isDefaultOps). */
export function defaultOpsTemplate(): OpsData {
  return {
    branches: [0, 1, 2].map(i => ({ ...emptyBranch(i), divisions: [] })),
    standalone: [],
  }
}

const DEFAULT_BRANCH_LABEL = /^BRANCH (I|II|III|IV|V|VI|VII|VIII|IX|X|\d+)$/

const isBlankDiv = (d: OpsDivision): boolean => !d.name.trim() && !d.personnel.trim()

/** True when the snapshot is still the untouched default: no standalone
 *  content and every branch still carries an auto label with nothing filled
 *  in. (207 imports use title-case labels like "Branch 1", so they never
 *  match the all-caps auto labels and count as customized.) */
export function isDefaultOps(ops: OpsData): boolean {
  if (ops.standalone.some(s => !isBlankDiv(s))) return false
  if (ops.branches.length === 0) return true
  return ops.branches.every(
    b =>
      DEFAULT_BRANCH_LABEL.test(b.label.trim()) &&
      !b.director.trim() &&
      !b.deputy.trim() &&
      b.divisions.every(isBlankDiv),
  )
}

const AIR_WATER = /air|water/i

/** D./E. placeholder rows print only while the structure still fits the paper
 *  template: at most 3 branches and no branch that already is Air/Water. */
export function showAirWaterPlaceholders(ops: OpsData): boolean {
  return ops.branches.length <= 3 && !ops.branches.some(b => AIR_WATER.test(b.label))
}

/** Sequence letter for the nth branch: A, B, C, … (numbers past Z). */
export function branchLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}
/** Pad each branch to the paper-form minimum so blanks print as empty lines. */
export function padOpsForPrint(ops: OpsData): OpsData {
  const blank: OpsDivision = { name: '', personnel: '' }
  return {
    branches: ops.branches.map(b => ({
      ...b,
      divisions:
        b.divisions.length >= MIN_DIVISION_ROWS
          ? b.divisions
          : [...b.divisions, ...Array(MIN_DIVISION_ROWS - b.divisions.length).fill(blank)],
    })),
    standalone: ops.standalone,
  }
}

/** One-line rendering for print: "SAR Group — Andres Bonifacio". */
export function formatDivision(d: OpsDivision): string {
  if (d.name && d.personnel) return `${d.name} — ${d.personnel}`
  return d.name || d.personnel
}
