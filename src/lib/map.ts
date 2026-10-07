import { supabase } from './supabase'
import { offGetMap, offUpsertMap, touchOfflineIncident } from './offline/store'

/** Default live-map view: Alaminos, Laguna. */
export const ALAMINOS_CENTER = { lat: 14.0634, lng: 121.4236 }
export const DEFAULT_ZOOM = 13

export type MapType = 'sketch' | 'live'

/* ── Symbols ───────────────────────────────────────────────
   Only ICP and EOC are PNG art. Every other unit is an
   auto-numbered badge; other facilities are user-defined
   single letters/shapes with a meaning (e.g. E = Evacuation). */

export type BadgeFamily = 'staging' | 'camp' | 'base' | 'helispot' | 'helibase'

export const PNG_SYMBOLS = [
  { key: 'icp', label: 'Incident Command Post', file: 'icp.png', initials: 'ICP' },
  { key: 'eoc', label: 'Emergency Operations Center', file: 'eoc.png', initials: 'EOC' },
] as const

export type PngSymbolKey = (typeof PNG_SYMBOLS)[number]['key']

export const BADGE_FAMILIES: { key: BadgeFamily; label: string; prefix: string }[] = [
  { key: 'staging', label: 'Staging Area', prefix: 'S' },
  { key: 'camp', label: 'Camp', prefix: 'C' },
  { key: 'base', label: 'Base (only one)', prefix: 'B' },
  { key: 'helispot', label: 'Helispot (H-1, H-2…)', prefix: 'H-' },
  { key: 'helibase', label: 'Helibase (H1, H2…)', prefix: 'H' },
]

/** Letters reserved for the numbered units — not allowed as custom facilities. */
export const RESERVED_CHARS = ['S', 'C', 'B', 'H']

/** Extra shapes allowed for custom facilities besides A–Z. */
export const CUSTOM_SHAPES = ['+', '★', '▲', '●', '◆', '■']

/** Pseudo-symbol used when the user drops a pin with no palette symbol selected. */
export const GENERIC_PIN = '__pin__'

/** Labels/initials for symbol keys from the previous registry (render as placeholders). */
const LEGACY_SYMBOLS: Record<string, { label: string; initials: string }> = {
  operations: { label: 'Operations Section', initials: 'OPS' },
  planning: { label: 'Planning Section', initials: 'PLN' },
  logistics: { label: 'Logistics Section', initials: 'LOG' },
  finance: { label: 'Finance/Admin Section', initials: 'FIN' },
  checkin: { label: 'Check-In', initials: 'CHK' },
  comms: { label: 'Communications Unit', initials: 'COM' },
  medical: { label: 'Medical Unit', initials: 'MED' },
  hospital: { label: 'Hospital', initials: 'HOS' },
  fire: { label: 'Fire Incident', initials: 'FIR' },
  flood: { label: 'Flood Area', initials: 'FLD' },
  evacuation: { label: 'Evacuation Center', initials: 'EVC' },
  checkpoint: { label: 'Checkpoint', initials: 'CPT' },
  'barangay-hall': { label: 'Barangay Hall', initials: 'BRG' },
  school: { label: 'School', initials: 'SCH' },
  church: { label: 'Church', initials: 'CHU' },
  water: { label: 'Water Point', initials: 'WTR' },
  landing: { label: 'Landing Zone', initials: 'LZ' },
  shelter: { label: 'Shelter', initials: 'SHL' },
}

export interface SymbolInfo {
  kind: 'png' | 'badge' | 'custom' | 'pin' | 'legacy'
  label: string
  file: string
  initials: string
}

export const isCustomSymbol = (symbol: string): boolean => symbol.startsWith('custom:')

export const customChar = (symbol: string): string =>
  isCustomSymbol(symbol) ? symbol.slice('custom:'.length) : ''

export const isBadgeFamily = (symbol: string): symbol is BadgeFamily =>
  (BADGE_FAMILIES as { key: string }[]).some((f) => f.key === symbol)

export const isPngSymbol = (symbol: string): boolean =>
  (PNG_SYMBOLS as readonly { key: string }[]).some((s) => s.key === symbol)

export function symbolInfo(symbol: string, customMeaning?: string): SymbolInfo {
  const png = (PNG_SYMBOLS as readonly { key: string; label: string; file: string; initials: string }[]).find(
    (s) => s.key === symbol,
  )
  if (png) return { kind: 'png', label: png.label, file: png.file, initials: png.initials }
  const fam = BADGE_FAMILIES.find((f) => f.key === symbol)
  if (fam) return { kind: 'badge', label: fam.label, file: '', initials: fam.prefix }
  if (isCustomSymbol(symbol)) {
    const char = customChar(symbol)
    return { kind: 'custom', label: customMeaning || `Facility ${char}`, file: '', initials: char }
  }
  if (symbol === GENERIC_PIN) return { kind: 'pin', label: 'Generic pin', file: '', initials: '📍' }
  // Old badge key without a sequence, or retired png key → placeholder.
  if (symbol === 'helibase') return { kind: 'badge', label: 'Helibase (H1, H2…)', file: '', initials: 'H' }
  const legacy = LEGACY_SYMBOLS[symbol]
  if (legacy) return { kind: 'legacy', label: legacy.label, file: '', initials: legacy.initials }
  return { kind: 'pin', label: 'Generic pin', file: '', initials: '📍' }
}

export const symbolUrl = (symbol: string): string => {
  const info = symbolInfo(symbol)
  return info.kind === 'png' && info.file ? `/symbols/${info.file}` : ''
}

/** Numbering key: units number within their family, custom facilities within their letter. */
const seqKey = (symbol: string): string | null => {
  if (isBadgeFamily(symbol) || symbol === 'helibase') return symbol
  if (isCustomSymbol(symbol)) return symbol
  return null
}

export function nextSeq(symbol: string, markers: { symbol: string; seq?: number }[]): number {
  const key = seqKey(symbol)
  if (!key) return 1
  if (key === 'base') return 1 // only one Base exists; enforced separately
  let max = 0
  for (const m of markers) {
    if (seqKey(m.symbol) === key && typeof m.seq === 'number' && m.seq > max) max = m.seq
  }
  return max + 1
}

/** Badge text: S1, C2, B, H-1, H2, E1 … */
export function badgeText(symbol: string, seq?: number): string {
  const n = seq ?? 1
  switch (symbol) {
    case 'staging':
      return `S${n}`
    case 'camp':
      return `C${n}`
    case 'base':
      return 'B'
    case 'helispot':
      return `H-${n}`
    case 'helibase':
      return `H${n}`
    default:
      if (isCustomSymbol(symbol)) return `${customChar(symbol)}${n}`
      return ''
  }
}

export interface CustomSymbolDef {
  char: string
  meaning: string
}

export const isValidCustomChar = (char: string): boolean => {
  const c = char.toUpperCase()
  if (CUSTOM_SHAPES.includes(char)) return true
  return /^[A-Z]$/.test(c) && !RESERVED_CHARS.includes(c)
}

/* ── Markers ─────────────────────────────────────────────── */

interface MarkerBase {
  id: string
  symbol: string
  label: string
  seq?: number
  /** Meaning of a custom facility symbol, e.g. "Evacuation Center". */
  custom?: string
}

/** Marker on the sketch tab: x/y are percentages of the displayed image. */
export interface SketchMarker extends MarkerBase {
  x: number
  y: number
}

/** Marker on the live tab: real-world coordinates. */
export interface LiveMarker extends MarkerBase {
  lat: number
  lng: number
}

export type StoredMarker = SketchMarker | LiveMarker

/* ── Affected / damaged-area shapes ──────────────────────── */

export type ShapeColor = 'red' | 'orange' | 'blue'

export const SHAPE_COLORS: { key: ShapeColor; label: string }[] = [
  { key: 'red', label: 'Damaged (red)' },
  { key: 'orange', label: 'Affected (orange)' },
  { key: 'blue', label: 'Water-related (blue)' },
]

interface ShapeBase {
  id: string
  label: string
  color: ShapeColor
}

/** Polygon on the sketch tab: points are % of the displayed image. */
export interface SketchShape extends ShapeBase {
  points: { x: number; y: number }[]
}

/** Polygon on the live tab: real-world coordinates. */
export interface LiveShape extends ShapeBase {
  points: { lat: number; lng: number }[]
}

export const SHAPE_FILL: Record<ShapeColor, string> = {
  red: 'rgba(220,38,38,0.32)',
  orange: 'rgba(249,115,22,0.32)',
  blue: 'rgba(37,99,235,0.30)',
}

export const SHAPE_EDGE: Record<ShapeColor, string> = {
  red: '#b91c1c',
  orange: '#c2410c',
  blue: '#1d4ed8',
}

/* ── Row ─────────────────────────────────────────────────── */

export interface IncidentMapRow {
  map_type: MapType
  map_image: string
  sketch_markers: SketchMarker[]
  live_markers: LiveMarker[]
  sketch_shapes: SketchShape[]
  live_shapes: LiveShape[]
  custom_symbols: CustomSymbolDef[]
  center_lat: number | null
  center_lng: number | null
  zoom: number | null
}

export const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const clampPct = (v: number) => Math.min(100, Math.max(0, v))

/**
 * Re-base sketch markers (stored as % of the full uploaded image) into the
 * crop rect. Markers that fall outside the crop are dropped.
 */
export function cropSketchMarkers(
  markers: SketchMarker[],
  crop: { x: number; y: number; w: number; h: number },
): SketchMarker[] {
  if (crop.w <= 0 || crop.h <= 0) return []
  const out: SketchMarker[] = []
  for (const m of markers) {
    const cx = ((m.x - crop.x) / crop.w) * 100
    const cy = ((m.y - crop.y) / crop.h) * 100
    if (cx < 0 || cx > 100 || cy < 0 || cy > 100) continue
    out.push({ ...m, x: clampPct(cx), y: clampPct(cy) })
  }
  return out
}

/**
 * Re-base sketch polygons into the crop rect. Points outside are kept
 * (canvas/SVG clip them); the shape is dropped only if <3 points remain.
 */
export function cropSketchShapes(
  shapes: SketchShape[],
  crop: { x: number; y: number; w: number; h: number },
): SketchShape[] {
  if (crop.w <= 0 || crop.h <= 0) return []
  const out: SketchShape[] = []
  for (const s of shapes) {
    const pts = s.points.map((p) => ({
      x: ((p.x - crop.x) / crop.w) * 100,
      y: ((p.y - crop.y) / crop.h) * 100,
    }))
    if (pts.length < 3) continue
    out.push({ ...s, points: pts })
  }
  return out
}

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

const drawLabel = (
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  top: number,
  maxW: number,
  fontPx: number,
) => {
  ctx.font = `600 ${fontPx}px sans-serif`
  const tw = ctx.measureText(text).width
  const pad = 6
  const bw = tw + pad * 2
  const bh = fontPx + pad * 2
  const bx = Math.min(Math.max(cx - bw / 2, 2), maxW - bw - 2)
  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.fillRect(bx, top, bw, bh)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(text, bx + pad, top + pad)
}

/**
 * Composite the cropped base image + affected-area shapes + markers into the
 * fixed PNG snapshot stored as `map_image` (what IAP / ICS 201 display).
 */
export async function drawSketchSnapshot(
  croppedBaseDataUrl: string,
  markers: SketchMarker[],
  shapes: SketchShape[],
): Promise<string> {
  const base = await loadImage(croppedBaseDataUrl)
  if (!base) return croppedBaseDataUrl

  const canvas = document.createElement('canvas')
  canvas.width = base.naturalWidth
  canvas.height = base.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return croppedBaseDataUrl
  ctx.drawImage(base, 0, 0)

  const W = canvas.width
  const H = canvas.height
  const size = Math.min(64, Math.max(30, Math.min(W, H) * 0.055))
  const fontPx = Math.round(Math.max(12, size * 0.34))

  for (const s of shapes) {
    if (s.points.length < 3) continue
    ctx.beginPath()
    s.points.forEach((p, i) => {
      const px = (p.x / 100) * W
      const py = (p.y / 100) * H
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fillStyle = SHAPE_FILL[s.color] ?? SHAPE_FILL.red
    ctx.fill()
    ctx.lineWidth = Math.max(2, size * 0.07)
    ctx.strokeStyle = SHAPE_EDGE[s.color] ?? SHAPE_EDGE.red
    ctx.stroke()
    if (s.label.trim()) {
      const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length / 100 * W
      const top = Math.min(...s.points.map((p) => (p.y / 100) * H))
      drawLabel(ctx, s.label, cx, Math.max(2, top - fontPx - 14), W, fontPx)
    }
  }

  for (const m of markers) {
    const cx = (m.x / 100) * W
    const cy = (m.y / 100) * H
    const url = symbolUrl(m.symbol)
    const icon = url ? await loadImage(url) : null

    if (icon) {
      const s = size * 1.4
      ctx.drawImage(icon, cx - s / 2, cy - s / 2, s, s)
    } else if (m.symbol === GENERIC_PIN) {
      ctx.font = `${Math.round(size * 1.1)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('📍', cx, cy)
    } else {
      // Numbered-unit badge (or placeholder for retired keys)
      const text = badgeText(m.symbol, m.seq) || symbolInfo(m.symbol, m.custom).initials
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.lineWidth = Math.max(2, size * 0.06)
      ctx.strokeStyle = '#950606'
      ctx.stroke()
      ctx.fillStyle = '#950606'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (m.symbol === 'helispot') {
        // Regular-weight "H", bold sequence: H-1, H-2 …
        ctx.font = `400 ${fontPx}px sans-serif`
        const hw = ctx.measureText('H').width
        ctx.font = `700 ${fontPx}px sans-serif`
        const rest = text.slice(1)
        const rw = ctx.measureText(rest).width
        const x0 = cx - (hw + rw) / 2
        ctx.textAlign = 'left'
        ctx.font = `400 ${fontPx}px sans-serif`
        ctx.fillText('H', x0, cy + 1)
        ctx.font = `700 ${fontPx}px sans-serif`
        ctx.fillText(rest, x0 + hw, cy + 1)
      } else {
        ctx.font = `700 ${fontPx}px sans-serif`
        ctx.fillText(text, cx, cy + 1)
      }
    }

    if (m.label.trim()) {
      drawLabel(ctx, m.label, cx, cy + size / 2 + 4, W, fontPx)
    }
  }

  return canvas.toDataURL('image/jpeg', 0.88)
}

/** Capture the live Leaflet view (tiles + pins + polygons) as a PNG data URL. */
export async function snapshotLiveMap(node: HTMLElement): Promise<string> {
  const { toPng } = await import('html-to-image')
  return toPng(node, { pixelRatio: 1, cacheBust: true })
}

/* ── Persistence ─────────────────────────────────────────── */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Backfill sequences for rows saved before auto-numbering existed. */
function normalizeMarkers<T extends StoredMarker>(list: unknown): T[] {
  if (!Array.isArray(list)) return []
  const counters = new Map<string, number>()
  const out: T[] = []
  for (const raw of list as Record<string, unknown>[]) {
    if (!raw || typeof raw !== 'object') continue
    const symbol = typeof raw.symbol === 'string' ? raw.symbol : GENERIC_PIN
    const key = seqKey(symbol)
    let seq = typeof raw.seq === 'number' ? raw.seq : undefined
    if (key && key !== 'base' && seq == null) {
      const next = (counters.get(key) ?? 0) + 1
      counters.set(key, next)
      seq = next
    }
    if (key === 'base') seq = 1
    out.push({ ...(raw as object), symbol, seq } as T)
  }
  return out
}

const asSketchMarkers = (v: unknown): SketchMarker[] =>
  normalizeMarkers<SketchMarker>(v).filter((m) => isNum(m.x) && isNum(m.y))

const asLiveMarkers = (v: unknown): LiveMarker[] =>
  normalizeMarkers<LiveMarker>(v).filter((m) => isNum(m.lat) && isNum(m.lng))

const asSketchShapes = (v: unknown): SketchShape[] => {
  if (!Array.isArray(v)) return []
  const out: SketchShape[] = []
  for (const raw of v as Record<string, unknown>[]) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.points)) continue
    const pts = (raw.points as Record<string, unknown>[]).filter(
      (p): p is { x: number; y: number } => !!p && isNum(p.x) && isNum(p.y),
    )
    if (pts.length < 3) continue
    out.push({
      id: typeof raw.id === 'string' ? raw.id : newId(),
      label: typeof raw.label === 'string' ? raw.label : '',
      color: raw.color === 'orange' || raw.color === 'blue' ? raw.color : 'red',
      points: pts,
    })
  }
  return out
}

const asLiveShapes = (v: unknown): LiveShape[] => {
  if (!Array.isArray(v)) return []
  const out: LiveShape[] = []
  for (const raw of v as Record<string, unknown>[]) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.points)) continue
    const pts = (raw.points as Record<string, unknown>[]).filter(
      (p): p is { lat: number; lng: number } => !!p && isNum(p.lat) && isNum(p.lng),
    )
    if (pts.length < 3) continue
    out.push({
      id: typeof raw.id === 'string' ? raw.id : newId(),
      label: typeof raw.label === 'string' ? raw.label : '',
      color: raw.color === 'orange' || raw.color === 'blue' ? raw.color : 'red',
      points: pts,
    })
  }
  return out
}

const asCustomSymbols = (v: unknown): CustomSymbolDef[] => {
  if (!Array.isArray(v)) return []
  const out: CustomSymbolDef[] = []
  for (const raw of v as Record<string, unknown>[]) {
    if (!raw || typeof raw !== 'object') continue
    const char = typeof raw.char === 'string' ? raw.char : ''
    const meaning = typeof raw.meaning === 'string' ? raw.meaning : ''
    if (char && meaning && !out.some((d) => d.char === char)) out.push({ char, meaning })
  }
  return out
}

export async function fetchMapRow(incidentId: string, offline = false): Promise<IncidentMapRow | null> {
  let data: unknown
  if (offline) {
    data = (await offGetMap(incidentId)) ?? null
  } else {
    const res = await supabase
      .from('incident_maps')
      .select('*')
      .eq('incident_id', incidentId)
      .maybeSingle()
    if (res.error) throw res.error
    data = res.data
  }
  if (!data) return null
  const row = data as Record<string, unknown>
  // `markers` is the legacy single-column shape; prefer the per-tab columns.
  const legacy = Array.isArray(row.markers) ? (row.markers as StoredMarker[]) : []
  const isLive = row.map_type === 'live'
  return {
    map_type: isLive ? 'live' : 'sketch',
    map_image: typeof row.map_image === 'string' ? row.map_image : '',
    sketch_markers: asSketchMarkers(row.sketch_markers ?? (isLive ? [] : legacy)),
    live_markers: asLiveMarkers(row.live_markers ?? (isLive ? legacy : [])),
    sketch_shapes: asSketchShapes(row.sketch_shapes),
    live_shapes: asLiveShapes(row.live_shapes),
    custom_symbols: asCustomSymbols(row.custom_symbols),
    center_lat: typeof row.center_lat === 'number' ? row.center_lat : null,
    center_lng: typeof row.center_lng === 'number' ? row.center_lng : null,
    zoom: typeof row.zoom === 'number' ? row.zoom : null,
  }
}

export async function saveMapRow(
  incidentId: string,
  row: {
    map_type: MapType
    map_image: string
    sketch_markers: SketchMarker[]
    live_markers: LiveMarker[]
    sketch_shapes: SketchShape[]
    live_shapes: LiveShape[]
    custom_symbols: CustomSymbolDef[]
    center_lat: number | null
    center_lng: number | null
    zoom: number | null
  },
  offline = false,
) {
  if (offline) {
    await offUpsertMap(incidentId, {
      map_type: row.map_type,
      map_image: row.map_image,
      sketch_markers: row.sketch_markers,
      live_markers: row.live_markers,
      sketch_shapes: row.sketch_shapes,
      live_shapes: row.live_shapes,
      custom_symbols: row.custom_symbols,
      center_lat: row.center_lat,
      center_lng: row.center_lng,
      zoom: row.zoom,
    })
    await touchOfflineIncident(incidentId)
    return
  }
  const payload = {
    incident_id: incidentId,
    map_type: row.map_type,
    map_image: row.map_image,
    sketch_markers: row.sketch_markers,
    live_markers: row.live_markers,
    sketch_shapes: row.sketch_shapes,
    live_shapes: row.live_shapes,
    custom_symbols: row.custom_symbols,
    center_lat: row.center_lat,
    center_lng: row.center_lng,
    zoom: row.zoom,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('incident_maps').upsert(payload, { onConflict: 'incident_id' })
  if (!error) return
  // Database predates the interactive-map migration (no new columns):
  // fall back to the legacy snapshot-only shape so saving never breaks.
  if (/column|sketch_markers|live_markers|map_type|center_lat|zoom|shapes|custom_symbols/i.test(error.message)) {
    const { error: legacyError } = await supabase.from('incident_maps').upsert(
      {
        incident_id: incidentId,
        map_image: row.map_image,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'incident_id' },
    )
    if (legacyError) throw legacyError
    return
  }
  throw error
}
