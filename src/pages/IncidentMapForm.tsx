import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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

export default function IncidentMapForm() {
  const { id: incidentId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [imgSrc, setImgSrc] = useState('')
  const [crop, setCrop] = useState<CropRect>(FULL_CROP)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [saved, setSaved] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const stageRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load the saved incident map ──
  const loadMap = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)
    const { data } = await supabase
      .from('incident_maps')
      .select('map_image')
      .eq('incident_id', incidentId)
      .maybeSingle()

    if (data?.map_image) {
      setImgSrc(data.map_image)
      setSaved(true)
    }
    setLoading(false)
  }, [incidentId])

  useEffect(() => {
    loadMap()
  }, [loadMap])

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
    if (!stageRef.current || saving) return
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

  // ── File upload (jpg / png only) ──
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!isAcceptedImage(file)) {
      setError('Invalid file. Only JPG and PNG images are allowed.')
      setSuccess('')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImgSrc(String(reader.result))
      setCrop(FULL_CROP)
      setSaved(false)
      setError('')
      setSuccess('')
    }
    reader.onerror = () => setError('Failed to read the selected file.')
    reader.readAsDataURL(file)
  }

  // ── Crop + save ──
  const saveMap = async () => {
    if (!incidentId) return
    if (!imgSrc) {
      setError('Upload a JPG or PNG image first.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const dataUrl = await cropToDataUrl(imgSrc, crop)
      const { error: upsertError } = await supabase
        .from('incident_maps')
        .upsert(
          {
            incident_id: incidentId,
            map_image: dataUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'incident_id' }
        )

      if (upsertError) {
        setError(upsertError.message)
        setSaving(false)
        return
      }

      setImgSrc(dataUrl)
      setCrop(FULL_CROP)
      setSaved(true)
      setSuccess('Incident map saved successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process the image.')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="map-page">
        <div className="map-loading">Loading Incident Map...</div>
      </div>
    )
  }

  return (
    <div className="map-page">
      <header className="map-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="map-topbar no-print">
        <div className="topbar-left">
          <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
          <span className="form-badge">Incident Map</span>
          <span className={`map-state ${saved ? 'saved' : 'empty'}`}>{saved ? 'Saved' : 'No map'}</span>
        </div>
        <div className="topbar-actions">
          <button className="action-btn upload" onClick={() => fileRef.current?.click()} disabled={saving}>
            {imgSrc ? 'Replace Image' : 'Upload Image'}
          </button>
          <button className="action-btn submit" onClick={saveMap} disabled={saving || !imgSrc}>
            {saving ? 'Saving...' : 'Save Map'}
          </button>
        </div>
      </div>

      <main className="map-main no-print">
        <div className="map-container">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="map-card">
            <div className="map-card-header">
              <h2>INCIDENT MAP</h2>
              <p>Upload a <strong>JPG or PNG</strong> image of the incident/event area, adjust the crop box, then save.</p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,.jpg,.jpeg,.png"
              onChange={onFileChange}
              hidden
            />

            {imgSrc ? (
              <>
                <div className="crop-viewport">
                  <div className="crop-stage" ref={stageRef}>
                    <img src={imgSrc} alt="Incident map" draggable={false} onDragStart={(e) => e.preventDefault()} />
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
                  <span className="crop-hint">Drag the box to move it &bull; drag the corners/edges to crop</span>
                  <div className="crop-actions">
                    <button className="map-tool-btn" onClick={() => setCrop(FULL_CROP)} disabled={saving}>Reset Crop</button>
                    <button className="map-tool-btn" onClick={() => fileRef.current?.click()} disabled={saving}>Replace Image</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="map-empty" onClick={() => fileRef.current?.click()}>
                <div className="map-empty-icon">&#128247;</div>
                <div className="map-empty-text">No map uploaded yet</div>
                <div className="map-empty-sub">Click here or use Upload Image &mdash; JPG or PNG only</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
