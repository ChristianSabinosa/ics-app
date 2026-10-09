import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { isOfflinePath } from '../lib/offline/mode'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useFormAccess } from '../components/FormAccess'
import SymbolIcon from '../components/SymbolIcon'
import {
  ALAMINOS_CENTER,
  BADGE_FAMILIES,
  CUSTOM_SHAPES,
  DEFAULT_ZOOM,
  GENERIC_PIN,
  SHAPE_COLORS,
  SHAPE_EDGE,
  SHAPE_FILL,
  badgeText,
  cropSketchMarkers,
  cropSketchShapes,
  customChar,
  drawSketchSnapshot,
  fetchMapRow,
  isCustomSymbol,
  isValidCustomChar,
  newId,
  nextSeq,
  saveMapRow,
  snapshotLiveMap,
  symbolInfo,
  symbolUrl,
  type CustomSymbolDef,
  type LiveMarker,
  type LiveShape,
  type MapType,
  type ShapeColor,
  type SketchMarker,
  type SketchShape,
} from '../lib/map'
import './IncidentMapForm.css'

interface CropRect { x: number; y: number; w: number; h: number } // percentages of the displayed image

type HandleDir = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface DragState {
  dir: HandleDir
  startX: number
  startY: number
  startCrop: CropRect
  rectW: number
  rectH: number
  minW: number
  minH: number
}

const FULL_CROP: CropRect = { x: 0, y: 0, w: 100, h: 100 }
const HANDLES: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN_CROP_PX = 40
const MAX_OUTPUT = 2048 // cap the saved crop at 2048px on the longest side

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

const isAcceptedImage = (file: File) =>
  ['image/jpeg', 'image/png', 'image/jpg'].includes(file.type) || /\.(jpe?g|png)$/i.test(file.name)

/** Crop the source image to the given rect and return a (downscaled) data URL. */
const cropToDataUrl = (src: string, crop: CropRect): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      const sx = clamp(Math.round((crop.x / 100) * nw), 0, nw - 1)
      const sy = clamp(Math.round((crop.y / 100) * nh), 0, nh - 1)
      const sw = clamp(Math.round((crop.w / 100) * nw), 1, nw - sx)
      const sh = clamp(Math.round((crop.h / 100) * nh), 1, nh - sy)

      const scale = Math.min(1, MAX_OUTPUT / Math.max(sw, sh))
      const outW = Math.max(1, Math.round(sw * scale))
      const outH = Math.max(1, Math.round(sh * scale))

      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas is not supported.')); return }

      const isPng = src.startsWith('data:image/png')
      if (!isPng) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, outW, outH)
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
      resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => reject(new Error('Failed to load the image.'))
    img.src = src
  })

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const badgeHtml = (symbol: string, seq?: number) => {
  if (symbol === 'helispot') {
    return `<span class="live-badge"><span class="lt">H</span><span class="bd">-${seq ?? 1}</span></span>`
  }
  return `<span class="live-badge">${escHtml(badgeText(symbol, seq))}</span>`
}

const liveIcon = (m: LiveMarker, selected: boolean, customMeaning?: string) => {
  const url = symbolUrl(m.symbol)
  const info = symbolInfo(m.symbol, customMeaning)
  let media: string
  if (url) {
    media = `<img src="${url}" alt="" onerror="this.remove()" draggable="false" /><span class="live-pin-glyph">${escHtml(info.initials)}</span>`
  } else if (m.symbol === GENERIC_PIN) {
    media = `<span class="live-pin-glyph generic">📍</span>`
  } else {
    media = badgeHtml(m.symbol, m.seq)
  }
  return L.divIcon({
    className: `live-pin-wrap${selected ? ' selected' : ''}`,
    html: `<div class="live-pin">${media}${m.label.trim() ? `<span class="live-pin-label">${escHtml(m.label)}</span>` : ''}</div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  })
}

const vertexIcon = () =>
  L.divIcon({
    className: 'live-vertex-wrap',
    html: '<span class="live-vertex"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })

/** Places a marker / polygon vertex on map click (disabled for view-only roles). */
function LiveClickHandler({ disabled, onAdd }: { disabled: boolean; onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (!disabled) onAdd(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Persists pan/zoom into state so Save stores the current view. */
function LiveViewTracker({ onMove }: { onMove: (lat: number, lng: number, zoom: number) => void }) {
  const map = useMap()
  useEffect(() => {
    const h = () => {
      const c = map.getCenter()
      onMove(c.lat, c.lng, map.getZoom())
    }
    map.on('moveend', h)
    map.on('zoomend', h)
    return () => {
      map.off('moveend', h)
      map.off('zoomend', h)
    }
  }, [map, onMove])
  return null
}

/** Recenters the map when the "My location" button is pressed. */
function LiveRecenter({ center, nonce }: { center: { lat: number; lng: number }; nonce: number }) {
  const map = useMap()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    map.setView([center.lat, center.lng], Math.max(map.getZoom(), 15))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce])
  return null
}

/** Re-fits Leaflet when the 4:3 map window resizes (rotation / breakpoint / layout shift). */
function MapSizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ debounceMoveend: true })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

export default function IncidentMapForm() {
  const { id: incidentId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canEdit } = useFormAccess()

  // Offline Mode (/offline/...): same page, local IndexedDB store, no auth.
  const offMode = isOfflinePath(useLocation().pathname)
  const homePath = offMode ? `/offline/${incidentId}` : `/incident/${incidentId}`

  const [tab, setTab] = useState<MapType>('sketch')

  // ── Sketch tab state ──
  const [imgSrc, setImgSrc] = useState('')
  const [crop, setCrop] = useState<CropRect>(FULL_CROP)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [sketchMarkers, setSketchMarkers] = useState<SketchMarker[]>([])
  const [sketchShapes, setSketchShapes] = useState<SketchShape[]>([])
  const [draftSketch, setDraftSketch] = useState<{ x: number; y: number }[]>([])

  // ── Live tab state ──
  const [center, setCenter] = useState(ALAMINOS_CENTER)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [liveMarkers, setLiveMarkers] = useState<LiveMarker[]>([])
  const [liveShapes, setLiveShapes] = useState<LiveShape[]>([])
  const [draftLive, setDraftLive] = useState<{ lat: number; lng: number }[]>([])
  const [locateNonce, setLocateNonce] = useState(0)
  const [locating, setLocating] = useState(false)

  // ── Shared state ──
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [selectedShape, setSelectedShape] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState(false)
  const [shapeColor, setShapeColor] = useState<ShapeColor>('red')
  const [customDefs, setCustomDefs] = useState<CustomSymbolDef[]>([])
  const [newChar, setNewChar] = useState('')
  const [newMeaning, setNewMeaning] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedType, setSavedType] = useState<MapType | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const stageRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const liveShotRef = useRef<HTMLDivElement>(null)
  const markerDrag = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null)
  const vertexDrag = useRef<{ shapeId: string; index: number } | null>(null)

  const tabMarkers = tab === 'sketch' ? sketchMarkers : liveMarkers
  const baseExists = useMemo(() => tabMarkers.some((m) => m.symbol === 'base'), [tabMarkers])
  const meaningOf = useCallback(
    (symbol: string, fallback?: string) =>
      customDefs.find((d) => `custom:${d.char}` === symbol)?.meaning ?? fallback ?? '',
    [customDefs],
  )

  // ── Load the saved incident map ──
  const loadMap = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)
    try {
      const row = await fetchMapRow(incidentId, offMode)
      if (row) {
        setTab(row.map_type)
        setSavedType(row.map_image ? row.map_type : null)
        setSaved(!!row.map_image)
        if (row.map_image) setImgSrc(row.map_image)
        setSketchMarkers(row.sketch_markers)
        setLiveMarkers(row.live_markers)
        setSketchShapes(row.sketch_shapes)
        setLiveShapes(row.live_shapes)
        setCustomDefs(row.custom_symbols)
        if (row.center_lat != null && row.center_lng != null) {
          setCenter({ lat: row.center_lat, lng: row.center_lng })
        }
        if (row.zoom != null) setZoom(row.zoom)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the incident map.')
    }
    setLoading(false)
  }, [incidentId, offMode])

  useEffect(() => {
    loadMap()
  }, [loadMap])

  useEffect(() => {
    setSelectedMarker(null)
    setSelectedShape(null)
    setDrawMode(false)
    setDraftSketch([])
    setDraftLive([])
  }, [tab])

  // ── Crop drag / resize ──
  useEffect(() => {
    if (!drag) return

    const onMove = (e: MouseEvent) => {
      e.preventDefault()
      const dx = ((e.clientX - drag.startX) / drag.rectW) * 100
      const dy = ((e.clientY - drag.startY) / drag.rectH) * 100
      const s = drag.startCrop
      const d = drag.dir

      if (d === 'move') {
        setCrop({
          x: clamp(s.x + dx, 0, 100 - s.w),
          y: clamp(s.y + dy, 0, 100 - s.h),
          w: s.w,
          h: s.h,
        })
        return
      }

      const W = d === 'nw' || d === 'w' || d === 'sw'
      const E = d === 'ne' || d === 'e' || d === 'se'
      const N = d === 'nw' || d === 'n' || d === 'ne'
      const S = d === 'sw' || d === 's' || d === 'se'

      let { x, y, w, h } = s

      if (W) {
        const nx = clamp(s.x + dx, 0, s.x + s.w - drag.minW)
        w = s.w + (s.x - nx)
        x = nx
      }
      if (E) {
        w = clamp(s.w + dx, drag.minW, 100 - s.x)
      }
      if (N) {
        const ny = clamp(s.y + dy, 0, s.y + s.h - drag.minH)
        h = s.h + (s.y - ny)
        y = ny
      }
      if (S) {
        h = clamp(s.h + dy, drag.minH, 100 - s.y)
      }

      setCrop({ x, y, w, h })
    }

    const onUp = () => setDrag(null)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag])

  const startDrag = (dir: HandleDir) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!stageRef.current || saving || !canEdit) return
    const rect = stageRef.current.getBoundingClientRect()
    setDrag({
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: crop,
      rectW: rect.width,
      rectH: rect.height,
      minW: (MIN_CROP_PX / rect.width) * 100,
      minH: (MIN_CROP_PX / rect.height) * 100,
    })
  }

  // ── Symbol placement (shared) ──
  // Numbering restarts per tab: only one map (sketch OR live) is kept
  // per incident, so S1 on the live map does not consume S1 on the sketch.
  const placeMarker = (symbol: string, at: { x: number; y: number } | { lat: number; lng: number }) => {
    if (symbol === 'base' && baseExists) {
      setError('There can only be one Base (B) on this map.')
      return
    }
    const seq = nextSeq(symbol, tabMarkers)
    const custom = isCustomSymbol(symbol) ? meaningOf(symbol) : undefined
    if ('lat' in at) {
      const m: LiveMarker = { id: newId(), symbol, label: '', seq, custom, ...at }
      setLiveMarkers((ms) => [...ms, m])
      setSelectedMarker(m.id)
    } else {
      const m: SketchMarker = { id: newId(), symbol, label: '', seq, custom, ...at }
      setSketchMarkers((ms) => [...ms, m])
      setSelectedMarker(m.id)
    }
    setError('')
    setSuccess('')
  }

  const pickSymbol = (symbol: string) => {
    if (!canEdit) return
    setDrawMode(false)
    setSelectedSymbol((cur) => (cur === symbol ? null : symbol))
  }

  const addCustomFacility = () => {
    const char = newChar.trim().toUpperCase()
    const meaning = newMeaning.trim()
    if (!char || !meaning) {
      setError('Enter both a letter/shape and what it stands for (e.g. E = Evacuation Center).')
      return
    }
    if (!isValidCustomChar(newChar.trim())) {
      setError('Letters S, C, B, H are reserved for Staging, Camp, Base, and Heli units. Pick another letter or a shape (+ ★ ▲ ● ◆ ■).')
      return
    }
    const key = `custom:${CUSTOM_SHAPES.includes(newChar.trim()) ? newChar.trim() : char}`
    setCustomDefs((ds) => {
      const exists = ds.some((d) => `custom:${d.char}` === key)
      if (exists) {
        return ds.map((d) => (`custom:${d.char}` === key ? { ...d, meaning } : d))
      }
      return [...ds, { char: key.slice('custom:'.length), meaning }]
    })
    setSelectedSymbol(key)
    setDrawMode(false)
    setNewChar('')
    setNewMeaning('')
    setError('')
  }

  // ── Sketch marker + vertex interactions ──
  const stagePos = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    }
  }

  const onStageClick = (e: React.MouseEvent) => {
    if (!canEdit || !imgSrc || saving) return
    // Ignore clicks on existing markers, vertices, or the crop box.
    if ((e.target as HTMLElement).closest('.sketch-marker, .sketch-vertex, .crop-rect')) return
    const p = stagePos(e.clientX, e.clientY)
    if (!p) return
    if (drawMode) {
      setDraftSketch((d) => [...d, p])
      return
    }
    if (selectedSymbol) placeMarker(selectedSymbol, p)
  }

  const onMarkerPointerDown = (m: SketchMarker) => (e: React.PointerEvent) => {
    if (!canEdit || saving || drawMode) return
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    markerDrag.current = { id: m.id, startX: e.clientX, startY: e.clientY, origX: m.x, origY: m.y, moved: false }
  }

  const onMarkerPointerMove = (e: React.PointerEvent) => {
    const d = markerDrag.current
    if (!d || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const dx = ((e.clientX - d.startX) / rect.width) * 100
    const dy = ((e.clientY - d.startY) / rect.height) * 100
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4) d.moved = true
    if (!d.moved) return
    e.stopPropagation()
    const nx = clamp(d.origX + dx, 0, 100)
    const ny = clamp(d.origY + dy, 0, 100)
    setSketchMarkers((ms) => ms.map((m) => (m.id === d.id ? { ...m, x: nx, y: ny } : m)))
  }

  const onMarkerPointerUp = (m: SketchMarker) => (e: React.PointerEvent) => {
    const d = markerDrag.current
    markerDrag.current = null
    if (!d) return
    e.stopPropagation()
    if (!d.moved) {
      setSelectedMarker(m.id)
      setSelectedShape(null)
    }
  }

  const onVertexPointerDown = (shapeId: string, index: number) => (e: React.PointerEvent) => {
    if (!canEdit || saving) return
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    vertexDrag.current = { shapeId, index }
  }

  const onVertexPointerMove = (e: React.PointerEvent) => {
    const v = vertexDrag.current
    if (!v) return
    const p = stagePos(e.clientX, e.clientY)
    if (!p) return
    e.stopPropagation()
    setSketchShapes((ss) =>
      ss.map((s) =>
        s.id === v.shapeId ? { ...s, points: s.points.map((pt, i) => (i === v.index ? p : pt)) } : s,
      ),
    )
  }

  const onVertexPointerUp = (e: React.PointerEvent) => {
    vertexDrag.current = null
    e.stopPropagation()
  }

  // ── File upload (jpg / png only) ──
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !canEdit) return

    if (!isAcceptedImage(file)) {
      setError('Invalid file. Only JPG and PNG images are allowed.')
      setSuccess('')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImgSrc(String(reader.result))
      setCrop(FULL_CROP)
      setSketchMarkers([])
      setSketchShapes([])
      setDraftSketch([])
      setSelectedMarker(null)
      setSelectedShape(null)
      setSaved(false)
      setError('')
      setSuccess('')
    }
    reader.onerror = () => setError('Failed to read the selected file.')
    reader.readAsDataURL(file)
  }

  // ── Live map interactions ──
  const onLiveClick = useCallback(
    (lat: number, lng: number) => {
      if (!canEdit || saving) return
      if (drawMode) {
        setDraftLive((d) => [...d, { lat, lng }])
        return
      }
      placeMarker(selectedSymbol ?? GENERIC_PIN, { lat, lng })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, saving, drawMode, selectedSymbol, liveMarkers, customDefs],
  )

  const onLiveMove = useCallback((lat: number, lng: number, z: number) => {
    setCenter({ lat, lng })
    setZoom(z)
  }, [])

  const locateMe = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocateNonce((n) => n + 1)
        setLocating(false)
      },
      () => {
        setError('Could not get your location. Check browser location permission.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  // ── Shape finishing / editing (shared) ──
  const finishShape = () => {
    const pts = tab === 'sketch' ? draftSketch.length : draftLive.length
    if (pts < 3) {
      setError('An affected area needs at least 3 points. Click on the map to add more, or cancel.')
      return
    }
    if (tab === 'sketch') {
      const s: SketchShape = { id: newId(), label: '', color: shapeColor, points: draftSketch }
      setSketchShapes((ss) => [...ss, s])
      setDraftSketch([])
      setSelectedShape(s.id)
      setSelectedMarker(null)
    } else {
      const s: LiveShape = { id: newId(), label: '', color: shapeColor, points: draftLive }
      setLiveShapes((ss) => [...ss, s])
      setDraftLive([])
      setSelectedShape(s.id)
      setSelectedMarker(null)
    }
    setDrawMode(false)
    setError('')
  }

  const cancelShape = () => {
    setDrawMode(false)
    setDraftSketch([])
    setDraftLive([])
  }

  const selectedSketch = sketchMarkers.find((m) => m.id === selectedMarker) ?? null
  const selectedLive = liveMarkers.find((m) => m.id === selectedMarker) ?? null
  const selectedSketchShape = sketchShapes.find((s) => s.id === selectedShape) ?? null
  const selectedLiveShape = liveShapes.find((s) => s.id === selectedShape) ?? null

  const updateSelectedLabel = (label: string) => {
    if (selectedSketch) {
      setSketchMarkers((ms) => ms.map((m) => (m.id === selectedSketch.id ? { ...m, label } : m)))
    } else if (selectedLive) {
      setLiveMarkers((ms) => ms.map((m) => (m.id === selectedLive.id ? { ...m, label } : m)))
    } else if (selectedSketchShape) {
      setSketchShapes((ss) => ss.map((s) => (s.id === selectedSketchShape.id ? { ...s, label } : s)))
    } else if (selectedLiveShape) {
      setLiveShapes((ss) => ss.map((s) => (s.id === selectedLiveShape.id ? { ...s, label } : s)))
    }
  }

  const updateSelectedColor = (color: ShapeColor) => {
    setShapeColor(color)
    if (selectedSketchShape) {
      setSketchShapes((ss) => ss.map((s) => (s.id === selectedSketchShape.id ? { ...s, color } : s)))
    } else if (selectedLiveShape) {
      setLiveShapes((ss) => ss.map((s) => (s.id === selectedLiveShape.id ? { ...s, color } : s)))
    }
  }

  const deleteSelected = () => {
    if (selectedSketch) {
      setSketchMarkers((ms) => ms.filter((m) => m.id !== selectedSketch.id))
    } else if (selectedLive) {
      setLiveMarkers((ms) => ms.filter((m) => m.id !== selectedLive.id))
    } else if (selectedSketchShape) {
      setSketchShapes((ss) => ss.filter((s) => s.id !== selectedSketchShape.id))
    } else if (selectedLiveShape) {
      setLiveShapes((ss) => ss.filter((s) => s.id !== selectedLiveShape.id))
    }
    setSelectedMarker(null)
    setSelectedShape(null)
  }

  const editorTarget = selectedSketch ?? selectedLive ?? selectedSketchShape ?? selectedLiveShape
  const editorIsShape = !!(selectedSketchShape || selectedLiveShape)

  // ── Save ──
  // Only one map per incident: saving a tab stores that tab alone and
  // clears the other tab (stored row + in-editor state), so numbering
  // restarts when the user picks the other map.
  const pruneDefs = (markers: { symbol: string }[]) => {
    const used = new Set(
      markers.filter((m) => isCustomSymbol(m.symbol)).map((m) => customChar(m.symbol)),
    )
    setCustomDefs((ds) => ds.filter((d) => used.has(d.char)))
  }

  const saveSketch = async () => {
    if (!incidentId || !canEdit) return
    if (!imgSrc) {
      setError('Upload a JPG or PNG image first.')
      return
    }
    if (savedType === 'live' && !window.confirm('Saving the sketch map will replace the saved Live GPS map. Continue?')) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const cropped = await cropToDataUrl(imgSrc, crop)
      const kept = cropSketchMarkers(sketchMarkers, crop)
      const keptShapes = cropSketchShapes(sketchShapes, crop)
      const dropped = sketchMarkers.length - kept.length
      const dataUrl = await drawSketchSnapshot(cropped, kept, keptShapes)
      await saveMapRow(incidentId, {
        map_type: 'sketch',
        map_image: dataUrl,
        sketch_markers: kept,
        live_markers: [],
        sketch_shapes: keptShapes,
        live_shapes: [],
        custom_symbols: customDefs.filter((d) =>
          kept.some((m) => m.symbol === `custom:${d.char}`),
        ),
        center_lat: null,
        center_lng: null,
        zoom: null,
      }, offMode)

      setImgSrc(dataUrl)
      setCrop(FULL_CROP)
      setSketchMarkers(kept)
      setSketchShapes(keptShapes)
      setLiveMarkers([])
      setLiveShapes([])
      setDraftSketch([])
      setDraftLive([])
      pruneDefs(kept)
      setSelectedMarker(null)
      setSelectedShape(null)
      setDrawMode(false)
      setSaved(true)
      setSavedType('sketch')
      setSuccess(
        (dropped > 0
          ? `Sketch map saved! ${dropped} symbol${dropped === 1 ? '' : 's'} fell outside the crop and ${dropped === 1 ? 'was' : 'were'} removed.`
          : 'Sketch map saved successfully! This fixed map now shows in the IAP and ICS 201.') +
          ' The Live GPS map was replaced.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the sketch map.')
    }

    setSaving(false)
  }

  const saveLive = async () => {
    if (!incidentId || !canEdit) return
    if (savedType === 'sketch' && !window.confirm('Saving the live map will replace the saved Sketch map. Continue?')) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      let dataUrl = ''
      let snapshotOk = true
      try {
        if (!liveShotRef.current) throw new Error('Map view is not ready.')
        dataUrl = await snapshotLiveMap(liveShotRef.current)
      } catch {
        snapshotOk = false
      }

      const prevImage = savedType === 'live' ? imgSrc : ''
      await saveMapRow(incidentId, {
        map_type: 'live',
        map_image: dataUrl || prevImage,
        sketch_markers: [],
        live_markers: liveMarkers,
        sketch_shapes: [],
        live_shapes: liveShapes,
        custom_symbols: customDefs.filter((d) =>
          liveMarkers.some((m) => m.symbol === `custom:${d.char}`),
        ),
        center_lat: center.lat,
        center_lng: center.lng,
        zoom,
      }, offMode)

      if (dataUrl) setImgSrc(dataUrl)
      setSketchMarkers([])
      setSketchShapes([])
      setDraftSketch([])
      setDraftLive([])
      pruneDefs(liveMarkers)
      setSelectedMarker(null)
      setSelectedShape(null)
      setDrawMode(false)
      setSaved(!!(dataUrl || prevImage))
      setSavedType(dataUrl || prevImage ? 'live' : savedType)
      setSuccess(
        (snapshotOk
          ? 'Live map saved successfully! This fixed map now shows in the IAP and ICS 201.'
          : 'Pins and view saved, but the fixed-map snapshot failed (map tiles blocked it). The IAP still shows the previous map — try saving again.') +
          ' The Sketch map was replaced.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the live map.')
    }

    setSaving(false)
  }

  // ── Palette / legend ──
  const legendMarkers = tab === 'sketch' ? sketchMarkers : liveMarkers
  const legendShapes = tab === 'sketch' ? sketchShapes : liveShapes

  const palette = useMemo(
    () => (
      <div className="symbol-palette">
        <div className="palette-group">
          <h4>Command posts</h4>
          <div className="palette-grid">
            {[
              { key: 'icp', label: 'Incident Command Post' },
              { key: 'eoc', label: 'Emergency Operations Center' },
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                className={`palette-item${selectedSymbol === s.key ? ' active' : ''}`}
                onClick={() => pickSymbol(s.key)}
                disabled={!canEdit}
                title={s.label}
              >
                <SymbolIcon symbol={s.key} size={34} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="palette-group">
          <h4>Numbered units (auto)</h4>
          <div className="palette-grid">
            {BADGE_FAMILIES.map((f) => {
              const disabled = !canEdit || (f.key === 'base' && baseExists)
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`palette-item${selectedSymbol === f.key ? ' active' : ''}`}
                  onClick={() => pickSymbol(f.key)}
                  disabled={disabled}
                  title={f.key === 'base' && baseExists ? 'Only one Base (B) on this map' : f.label}
                >
                  <SymbolIcon symbol={f.key} seq={f.key === 'base' ? 1 : nextSeq(f.key, tabMarkers)} size={34} />
                  <span>{f.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="palette-group">
          <h4>Other facilities</h4>
          {customDefs.length > 0 && (
            <div className="palette-grid">
              {customDefs.map((d) => {
                const key = `custom:${d.char}`
                return (
                  <button
                    key={key}
                    type="button"
                    className={`palette-item${selectedSymbol === key ? ' active' : ''}`}
                    onClick={() => pickSymbol(key)}
                    disabled={!canEdit}
                    title={`${d.char} = ${d.meaning}`}
                  >
                    <SymbolIcon symbol={key} seq={nextSeq(key, tabMarkers)} size={34} />
                    <span>{d.char} = {d.meaning}</span>
                  </button>
                )
              })}
            </div>
          )}
          {canEdit && (
            <div className="custom-add">
              <input
                className="custom-char"
                value={newChar}
                maxLength={1}
                placeholder="E"
                title="A letter (not S/C/B/H) or shape (+ ★ ▲ ● ◆ ■)"
                onChange={(e) => setNewChar(e.target.value.toUpperCase())}
              />
              <input
                className="custom-meaning"
                value={newMeaning}
                placeholder="e.g. Evacuation Center"
                maxLength={40}
                onChange={(e) => setNewMeaning(e.target.value)}
              />
              <button type="button" className="map-tool-btn" onClick={addCustomFacility}>Add</button>
            </div>
          )}
        </div>
        <div className="palette-group">
          <button
            type="button"
            className={`draw-toggle${drawMode ? ' active' : ''}`}
            onClick={() => {
              if (!canEdit) return
              setDrawMode((d) => !d)
              setSelectedSymbol(null)
            }}
            disabled={!canEdit}
          >
            {drawMode ? '✎ Drawing affected area… (click to stop)' : '✎ Draw affected / damaged area'}
          </button>
          <label className="shape-color-row">
            Color
            <select value={shapeColor} onChange={(e) => updateSelectedColor(e.target.value as ShapeColor)} disabled={!canEdit}>
              {SHAPE_COLORS.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>
        {(legendMarkers.length > 0 || legendShapes.length > 0) && (
          <div className="palette-group">
            <h4>On this map</h4>
            <div className="legend-list">
              {legendMarkers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`legend-item${selectedMarker === m.id ? ' active' : ''}`}
                  onClick={() => { setSelectedMarker(m.id); setSelectedShape(null) }}
                >
                  <SymbolIcon symbol={m.symbol} seq={m.seq} custom={m.custom ?? meaningOf(m.symbol)} size={24} />
                  <span>
                    <strong>{badgeText(m.symbol, m.seq) || symbolInfo(m.symbol, m.custom ?? meaningOf(m.symbol)).label}</strong>
                    {m.label ? ` — ${m.label}` : ` — ${symbolInfo(m.symbol, m.custom ?? meaningOf(m.symbol)).label}`}
                  </span>
                </button>
              ))}
              {legendShapes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`legend-item${selectedShape === s.id ? ' active' : ''}`}
                  onClick={() => { setSelectedShape(s.id); setSelectedMarker(null) }}
                >
                  <span className="legend-dot" style={{ background: SHAPE_FILL[s.color], borderColor: SHAPE_EDGE[s.color] }} />
                  <span>{s.label || 'Unnamed affected area'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {!canEdit && <p className="palette-note">View only — your role cannot edit this map.</p>}
        {canEdit && (
          <p className="palette-note">
            {drawMode
              ? 'Click on the map to mark the damaged/affected area, then Finish.'
              : selectedSymbol
                ? `Placing: ${symbolInfo(selectedSymbol, meaningOf(selectedSymbol)).label} — click on the map. Click the symbol again to stop.`
                : 'Pick a symbol, then click on the map to place it. (Live map: clicking with nothing picked drops a generic pin.)'}
          </p>
        )}
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, selectedSymbol, selectedMarker, selectedShape, drawMode, shapeColor, customDefs, newChar, newMeaning, baseExists, tabMarkers, legendMarkers, legendShapes],
  )

  const editor = editorTarget && canEdit && (
    <div className="marker-editor">
      {editorIsShape ? (
        <span className="legend-dot" style={{
          background: SHAPE_FILL[(editorTarget as SketchShape | LiveShape).color],
          borderColor: SHAPE_EDGE[(editorTarget as SketchShape | LiveShape).color],
        }} />
      ) : (
        <SymbolIcon
          symbol={(editorTarget as SketchMarker | LiveMarker).symbol}
          seq={(editorTarget as SketchMarker | LiveMarker).seq}
          custom={(editorTarget as SketchMarker | LiveMarker).custom ?? meaningOf((editorTarget as SketchMarker | LiveMarker).symbol)}
          size={30}
        />
      )}
      <input
        type="text"
        placeholder={editorIsShape ? 'Name this area (e.g. Flooded — Brgy. Poblacion)' : 'Label this symbol (e.g. Staging — Old Plaza)'}
        value={editorTarget.label}
        onChange={(e) => updateSelectedLabel(e.target.value)}
        maxLength={80}
      />
      {editorIsShape && (
        <select value={shapeColor} onChange={(e) => updateSelectedColor(e.target.value as ShapeColor)}>
          {SHAPE_COLORS.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      )}
      <button type="button" className="map-tool-btn danger" onClick={deleteSelected}>Delete</button>
      <button type="button" className="map-tool-btn" onClick={() => { setSelectedMarker(null); setSelectedShape(null) }}>Done</button>
    </div>
  )

  const draftCount = tab === 'sketch' ? draftSketch.length : draftLive.length
  const drawBar = canEdit && (drawMode || draftCount > 0) && (
    <div className="draw-bar">
      <span>
        {draftCount === 0
          ? 'Click on the map to mark each corner of the damaged/affected area.'
          : `${draftCount} point${draftCount === 1 ? '' : 's'} marked — keep clicking, then Finish.`}
      </span>
      <button type="button" className="map-tool-btn primary" onClick={finishShape} disabled={draftCount < 3}>
        Finish shape
      </button>
      <button type="button" className="map-tool-btn" onClick={cancelShape}>Cancel</button>
    </div>
  )

  if (loading) {
    return (
      <div className="map-page">
        <div className="map-loading">Loading Incident Map...</div>
      </div>
    )
  }

  const svgPoints = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="map-page">
      <header className="map-header no-print">
        <div className="header-brand" onClick={() => navigate(homePath)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="map-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(homePath)}>&larr; Back</button>
          <span className="form-badge">Incident Map</span>
          <span className={`map-state ${saved ? 'saved' : 'empty'}`}>
            {saved ? `Saved · ${savedType === 'live' ? 'Live GPS' : 'Sketch'}` : 'No map'}
          </span>
        </div>
        <div className="map-tabs">
          <button
            type="button"
            className={`map-tab${tab === 'sketch' ? ' active' : ''}`}
            onClick={() => setTab('sketch')}
          >
            Sketch Map (JPEG)
          </button>
          <button
            type="button"
            className={`map-tab${tab === 'live' ? ' active' : ''}`}
            onClick={() => setTab('live')}
          >
            Live Map (GPS)
          </button>
        </div>
        <div className="topbar-actions">
          {canEdit ? (
            tab === 'sketch' ? (
              <>
                <button className="action-btn upload" onClick={() => fileRef.current?.click()} disabled={saving}>
                  {imgSrc ? 'Replace Image' : 'Upload Image'}
                </button>
                <button className="action-btn submit" onClick={saveSketch} disabled={saving || !imgSrc}>
                  {saving ? 'Saving...' : 'Save Sketch Map'}
                </button>
              </>
            ) : (
              <>
                <button className="action-btn upload" onClick={locateMe} disabled={saving || locating}>
                  {locating ? 'Locating...' : '📍 My Location'}
                </button>
                <button className="action-btn submit" onClick={saveLive} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Live Map'}
                </button>
              </>
            )
          ) : (
            <span className="view-only-badge">View only</span>
          )}
        </div>
      </div>

      <main className="map-main no-print">
        <div className="map-container wide">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {tab === 'sketch' ? (
            <div className="map-card">
              <div className="map-card-header">
                <h2>SKETCH MAP</h2>
                <p>Upload a <strong>JPG or PNG</strong> image, place unit badges and facilities, outline damaged areas, adjust the crop box, then save. Only <strong>one map per incident</strong> is kept — saving here replaces the Live GPS map. Saving freezes a fixed map for the IAP and ICS 201.</p>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,.jpg,.jpeg,.png"
                onChange={onFileChange}
                hidden
              />

              {imgSrc ? (
                <div className="map-workspace">
                  {palette}
                  <div className="map-stage-col">
                    {editor}
                    {drawBar}
                    <div className="crop-viewport">
                      <div
                        className={`crop-stage${selectedSymbol && !drawMode ? ' placing' : ''}${drawMode ? ' drawing' : ''}`}
                        ref={stageRef}
                        onClick={onStageClick}
                      >
                        <img src={imgSrc} alt="Incident map" draggable={false} onDragStart={(e) => e.preventDefault()} />
                        <svg className="sketch-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {sketchShapes.map((s) => (
                            <polygon
                              key={s.id}
                              points={svgPoints(s.points)}
                              fill={SHAPE_FILL[s.color]}
                              stroke={SHAPE_EDGE[s.color]}
                              strokeWidth={0.6}
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}
                          {draftSketch.length > 0 && (
                            <polyline
                              points={svgPoints(draftSketch)}
                              fill="none"
                              stroke={SHAPE_EDGE[shapeColor]}
                              strokeWidth={2}
                              strokeDasharray="5 3"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}
                        </svg>
                        {(selectedShape || drawMode) && canEdit && (
                          <svg className="sketch-svg vertices" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {(selectedShape
                              ? (sketchShapes.find((s) => s.id === selectedShape)?.points ?? [])
                              : draftSketch
                            ).map((p, i) => (
                              <circle
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                r={1.1}
                                className="sketch-vertex"
                                vectorEffect="non-scaling-stroke"
                                style={selectedShape ? undefined : { pointerEvents: 'none' }}
                                onPointerDown={selectedShape ? onVertexPointerDown(selectedShape, i) : undefined}
                                onPointerMove={onVertexPointerMove}
                                onPointerUp={onVertexPointerUp}
                              />
                            ))}
                          </svg>
                        )}
                        {sketchMarkers.map((m) => (
                          <span
                            key={m.id}
                            className={`sketch-marker${selectedMarker === m.id ? ' selected' : ''}`}
                            style={{ left: `${m.x}%`, top: `${m.y}%` }}
                            onPointerDown={onMarkerPointerDown(m)}
                            onPointerMove={onMarkerPointerMove}
                            onPointerUp={onMarkerPointerUp(m)}
                            title={m.label || symbolInfo(m.symbol, m.custom ?? meaningOf(m.symbol)).label}
                          >
                            <SymbolIcon symbol={m.symbol} seq={m.seq} custom={m.custom ?? meaningOf(m.symbol)} size={36} />
                            {(m.label.trim() || badgeText(m.symbol, m.seq)) && (
                              <span className="sketch-marker-label">
                                {[badgeText(m.symbol, m.seq), m.label.trim()].filter(Boolean).join(' — ')}
                              </span>
                            )}
                          </span>
                        ))}
                        <div
                          className="crop-rect"
                          style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%` }}
                          onMouseDown={startDrag('move')}
                        >
                          {HANDLES.map((d) => (
                            <span key={d} className={`crop-handle ${d}`} onMouseDown={startDrag(d)} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="crop-toolbar">
                      <span className="crop-hint">
                        {canEdit
                          ? 'Pick a symbol to place it (the crop box pauses while placing/drawing) • drag badges to move • drag the box to move it, corners/edges to crop • badges outside the crop are dropped on save'
                          : 'View only — your role cannot change the incident map'}
                      </span>
                      {canEdit && (
                        <div className="crop-actions">
                          <button className="map-tool-btn" onClick={() => setCrop(FULL_CROP)} disabled={saving}>Reset Crop</button>
                          <button className="map-tool-btn" onClick={() => fileRef.current?.click()} disabled={saving}>Replace Image</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="map-empty" onClick={() => { if (canEdit) fileRef.current?.click() }}>
                  <div className="map-empty-icon">&#128247;</div>
                  <div className="map-empty-text">No sketch map uploaded yet</div>
                  {canEdit && <div className="map-empty-sub">Click here or use Upload Image &mdash; JPG or PNG only</div>}
                </div>
              )}
            </div>
          ) : (
            <div className="map-card">
              <div className="map-card-header">
                <h2>LIVE MAP</h2>
                <p>Click to drop a badge at its real GPS coordinates, or outline a damaged/affected area. Only <strong>one map per incident</strong> is kept — saving here replaces the Sketch map. Saving freezes a fixed map for the IAP and ICS 201.</p>
              </div>

              <div className="map-workspace">
                {palette}
                <div className="map-stage-col">
                  {editor}
                  {drawBar}
                  <div className="live-shot" ref={liveShotRef}>
                    <MapContainer
                      key={incidentId}
                      center={[center.lat, center.lng]}
                      zoom={zoom}
                      className="live-leaflet"
                      scrollWheelZoom
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <LiveClickHandler disabled={!canEdit} onAdd={onLiveClick} />
                      <LiveViewTracker onMove={onLiveMove} />
                      <LiveRecenter center={center} nonce={locateNonce} />
                      <MapSizeWatcher />
                      {liveShapes.map((s) => (
                        <Polygon
                          key={s.id}
                          positions={s.points.map((p) => [p.lat, p.lng] as [number, number])}
                          pathOptions={{
                            color: SHAPE_EDGE[s.color],
                            fillColor: SHAPE_FILL[s.color],
                            fillOpacity: 0.5,
                            weight: selectedShape === s.id ? 4 : 2,
                          }}
                          bubblingMouseEvents={false}
                          eventHandlers={{ click: () => { setSelectedShape(s.id); setSelectedMarker(null) } }}
                        />
                      ))}
                      {draftLive.length > 1 && (
                        <Polyline
                          positions={draftLive.map((p) => [p.lat, p.lng] as [number, number])}
                          pathOptions={{ color: SHAPE_EDGE[shapeColor], dashArray: '6 4', weight: 2 }}
                        />
                      )}
                      {(selectedShape || drawMode) && canEdit && (
                        <>
                          {(selectedShape
                            ? (liveShapes.find((s) => s.id === selectedShape)?.points ?? [])
                            : draftLive
                          ).map((p, i) => (
                            <Marker
                              key={`v-${i}`}
                              position={'lat' in p ? [p.lat, p.lng] : [0, 0]}
                              icon={vertexIcon()}
                              draggable={!!selectedShape}
                              bubblingMouseEvents={false}
                              eventHandlers={{
                                dragend: (e) => {
                                  if (!selectedShape) return
                                  const mk = (e.target as L.Marker).getLatLng()
                                  setLiveShapes((ss) =>
                                    ss.map((s) =>
                                      s.id === selectedShape
                                        ? { ...s, points: s.points.map((pt, j) => (j === i ? { lat: mk.lat, lng: mk.lng } : pt)) }
                                        : s,
                                    ),
                                  )
                                },
                              }}
                            />
                          ))}
                        </>
                      )}
                      {liveMarkers.map((m) => (
                        <Marker
                          key={m.id}
                          position={[m.lat, m.lng]}
                          icon={liveIcon(m, selectedMarker === m.id, m.custom ?? meaningOf(m.symbol))}
                          draggable={canEdit && !drawMode}
                          bubblingMouseEvents={false}
                          eventHandlers={{
                            click: () => { setSelectedMarker(m.id); setSelectedShape(null) },
                            dragend: (e) => {
                              const mk = (e.target as L.Marker).getLatLng()
                              setLiveMarkers((ms) =>
                                ms.map((x) => (x.id === m.id ? { ...x, lat: mk.lat, lng: mk.lng } : x)),
                              )
                            },
                          }}
                        />
                      ))}
                    </MapContainer>
                  </div>
                  <div className="crop-toolbar">
                    <span className="crop-hint">
                      {liveMarkers.length} badge{liveMarkers.length === 1 ? '' : 's'} • {liveShapes.length} area{liveShapes.length === 1 ? '' : 's'} • centered {center.lat.toFixed(4)}, {center.lng.toFixed(4)} (zoom {zoom})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
