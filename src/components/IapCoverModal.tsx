import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatOpPeriod } from '../lib/iap'
import { notifyIncident } from '../lib/notifications'
import { useAuth } from '../context/AuthContext'
import type { IapOpPeriod } from '../lib/iap'
import './IapCoverModal.css'

interface CropRect { x: number; y: number; w: number; h: number } // percentages of the displayed image

type HandleDir = 'move' | 'nw' | 'ne' | 'sw' | 'se'

interface DragState {
  dir: HandleDir
  startX: number
  startY: number
  startCrop: CropRect
  rectW: number
  rectH: number
}

export type IapStatus = '' | 'Draft' | 'Submitted' | 'Approved'

const A4_W = 210
const A4_H = 297
const A4_ASPECT = A4_W / A4_H // 0.7071 — portrait
const MIN_CROP_PX = 60
const MAX_OUTPUT = 2048 // cap the saved page at 2048px on the long side
const HANDLES: HandleDir[] = ['nw', 'ne', 'se', 'sw']

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

const isAcceptedImage = (file: File) =>
  ['image/jpeg', 'image/png', 'image/jpg'].includes(file.type) || /\.(jpe?g|png)$/i.test(file.name)

/** px-height of the crop per px-width, expressed in percent terms: h% = w% * k */
const aspectK = (rectW: number, rectH: number) => rectW / rectH / A4_ASPECT

/** Largest A4-portrait rectangle that fits in the stage, centered. */
const defaultCrop = (rectW: number, rectH: number): CropRect => {
  const k = aspectK(rectW, rectH)
  const w = k <= 1 ? 100 : 100 / k
  const h = k <= 1 ? 100 * k : 100
  return { x: (100 - w) / 2, y: (100 - h) / 2, w, h }
}

/** Neutral starting crop before the image has been measured (replaced on image load). */
function blankCrop(): CropRect {
  return { x: 0, y: 0, w: 100, h: 100 }
}

/** Crop to the A4 portrait rect and return an exactly-A4 (210x297) data URL. */
const cropToA4DataUrl = (src: string, crop: CropRect): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      const sx = clamp(Math.round((crop.x / 100) * nw), 0, nw - 1)
      const sy = clamp(Math.round((crop.y / 100) * nh), 0, nh - 1)
      const sw = clamp(Math.round((crop.w / 100) * nw), 1, nw - sx)
      const sh = clamp(Math.round((crop.h / 100) * nh), 1, nh - sy)

      // exact A4 portrait output (the crop is aspect-locked, so this is a rounding-only adjustment)
      const outH = Math.max(1, Math.min(MAX_OUTPUT, sh))
      const outW = Math.max(1, Math.round(outH * A4_ASPECT))

      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas is not supported.')); return }

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, outW, outH)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => reject(new Error('Failed to load the image.'))
    img.src = src
  })

interface IapCoverModalProps {
  incidentId: string
  incidentName?: string
  onClose: () => void
  /** Called after every successful save/submit so the parent can refresh its badge. */
  onStatusChange: (status: IapStatus) => void
  /** Called when the user presses Proceed on the operational-period step. */
  onProceed: (iapId: string) => void
}

export default function IapCoverModal({ incidentId, incidentName, onClose, onStatusChange, onProceed }: IapCoverModalProps) {
  const { user } = useAuth()
  const [imgSrc, setImgSrc] = useState('')
  const [crop, setCrop] = useState<CropRect>(blankCrop())
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dirty, setDirty] = useState(false) // unsaved changes since the last successful save

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<IapStatus>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tableMissing, setTableMissing] = useState(false)

  const [iapId, setIapId] = useState('')
  const [step, setStep] = useState<'cover' | 'period'>('cover')
  const [op, setOp] = useState<IapOpPeriod>({ from_date: '', from_time: '', to_date: '', to_time: '' })
  const [prefilling, setPrefilling] = useState(false)
  const [canReuse, setCanReuse] = useState(false)
  const [reusing, setReusing] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load the working (not yet approved) IAP for this incident ──
  const loadCover = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)

    // Does an already-approved IAP exist? (its cover can be reused for the next period)
    const prevCoverPromise = supabase
      .from('incident_iap')
      .select('id')
      .eq('incident_id', incidentId)
      .eq('status', 'Approved')
      .not('cover_image', 'is', null)
      .limit(1)

    // Step 1: identify the working row using columns that exist in every table shape
    const [rowQuery, prevCoverQuery] = await Promise.all([
      supabase
        .from('incident_iap')
        .select('id, cover_image, status')
        .eq('incident_id', incidentId)
        .neq('status', 'Approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      prevCoverPromise,
    ])
    const { data, error: loadError } = rowQuery
    setCanReuse((prevCoverQuery.data ?? []).length > 0)

    if (loadError) {
      setTableMissing(loadError.message.includes('incident_iap'))
      setLoading(false)
      return
    }

    if (data) {
      setIapId(data.id ?? '')
      if (data.cover_image) {
        setImgSrc(data.cover_image)
        setStatus((data.status as IapStatus) ?? 'Draft')
        setDirty(false)
      }

      // Step 2: operational period columns (added later — ignore if the SQL has not been run)
      const { data: opRow, error: opError } = await supabase
        .from('incident_iap')
        .select('op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time')
        .eq('id', data.id)
        .maybeSingle()
      if (opError) {
        setTableMissing(opError.message.includes('incident_iap'))
      } else if (opRow) {
        setOp({
          from_date: opRow.op_period_from_date || '',
          from_time: opRow.op_period_from_time || '',
          to_date: opRow.op_period_to_date || '',
          to_time: opRow.op_period_to_time || '',
        })
      }
    }
    setLoading(false)
  }, [incidentId])

  useEffect(() => {
    loadCover()
  }, [loadCover])

  // ── Once the image is laid out, set the default A4 crop ──
  const onImgLoad = () => {
    // measure on the next frame so the stage already has its final size
    requestAnimationFrame(() => {
      const rect = stageRef.current?.getBoundingClientRect()
      if (rect && rect.width > 0 && rect.height > 0) {
        setCrop(defaultCrop(rect.width, rect.height))
      }
    })
  }

  // ── Crop drag / resize (aspect-locked to A4 portrait) ──
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

      const k = aspectK(drag.rectW, drag.rectH)
      const isWest = d.includes('w') // nw / sw
      const isSouth = d.includes('s') // sw / se

      // raw size implied by the pointer, per axis
      const rawW = isWest ? s.w - dx : s.w + dx
      const rawH = isSouth ? s.h + dy : s.h - dy
      // drive the resize from whichever axis the user moved further
      const byWidth = rawW
      const byHeight = rawH / k
      let w = Math.abs(byHeight - s.w) > Math.abs(byWidth - s.w) ? byHeight : byWidth

      // fixed corner anchors (the opposite corner does not move)
      const anchorX = isWest ? s.x + s.w : s.x
      const anchorY = isSouth ? s.y : s.y + s.h

      const maxW = Math.min(
        isWest ? anchorX : 100 - anchorX,
        isSouth ? (100 - anchorY) / k : anchorY / k,
      )
      const minW = Math.max(
        (MIN_CROP_PX / drag.rectW) * 100,
        (MIN_CROP_PX / drag.rectH) * 100 / k,
      )
      w = clamp(w, Math.min(minW, maxW), maxW)

      const h = w * k
      const x = isWest ? anchorX - w : anchorX
      const y = isSouth ? anchorY : anchorY - h

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
    })
    setDirty(true)
    setSuccess('')
  }

  // ── File upload (jpg / png only) ──
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!isAcceptedImage(file)) {
      setError('Invalid file. Only JPG and PNG images are allowed.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImgSrc(String(reader.result))
      setDirty(true)
      setError('')
      setSuccess('')
    }
    reader.onerror = () => setError('Failed to read the selected file.')
    reader.readAsDataURL(file)
  }

  const resetCrop = () => {
    const rect = stageRef.current?.getBoundingClientRect()
    setCrop(rect && rect.width > 0 ? defaultCrop(rect.width, rect.height) : blankCrop())
    setDirty(true)
    setSuccess('')
  }

  // Pull the cover page from the most recent approved IAP for this incident
  const reusePreviousCover = async () => {
    setReusing(true)
    setError('')
    setSuccess('')
    const { data, error: prevError } = await supabase
      .from('incident_iap')
      .select('cover_image, operational_period')
      .eq('incident_id', incidentId)
      .eq('status', 'Approved')
      .not('cover_image', 'is', null)
      .order('approved_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    setReusing(false)

    if (prevError) {
      setTableMissing(prevError.message.includes('incident_iap'))
      setError(prevError.message)
      return
    }
    if (!data?.cover_image) {
      setError('No approved cover page is available to reuse yet.')
      setCanReuse(false)
      return
    }

    setImgSrc(data.cover_image)
    setDirty(true)
    setSuccess(
      data.operational_period
        ? `Cover page copied from the approved IAP for ${data.operational_period} — press Save to keep it on this one.`
        : 'Cover page copied from the previous approved IAP — press Save to keep it on this one.',
    )
  }

  const setOpField = (field: keyof IapOpPeriod) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setOp((prev) => ({ ...prev, [field]: e.target.value }))
    setError('')
  }

  // ── Persist the cover page (and the operational period when submitting) ──
  const persist = async (nextStatus: Exclude<IapStatus, '' | 'Approved'>, withOp: boolean): Promise<string | null> => {
    if (!imgSrc) {
      setError('Upload a cover page image first.')
      return null
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const dataUrl = await cropToA4DataUrl(imgSrc, crop)
      const payload: Record<string, unknown> = {
        incident_id: incidentId,
        cover_image: dataUrl,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      }

      if (withOp) {
        payload.op_period_from_date = op.from_date
        payload.op_period_from_time = op.from_time
        payload.op_period_to_date = op.to_date
        payload.op_period_to_time = op.to_time
        payload.operational_period = formatOpPeriod(op)
        payload.submitted_at = new Date().toISOString()
      }

      let savedId = iapId
      if (iapId) {
        const { error: updateError } = await supabase.from('incident_iap').update(payload).eq('id', iapId)
        if (updateError) throw new Error(updateError.message)
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('incident_iap')
          .insert(payload)
          .select('id')
          .single()

        if (insertError && (insertError as { code?: string }).code === '23505') {
          // A row already exists for this incident (old one-row-per-incident table) → update it
          const { data: existing } = await supabase
            .from('incident_iap')
            .select('id')
            .eq('incident_id', incidentId)
            .limit(1)
            .maybeSingle()
          if (!existing) throw new Error(insertError.message)
          const { error: fallbackError } = await supabase
            .from('incident_iap')
            .update(payload)
            .eq('id', existing.id)
          if (fallbackError) throw new Error(fallbackError.message)
          savedId = existing.id
          setIapId(savedId)
        } else if (insertError) {
          throw new Error(insertError.message)
        } else {
          savedId = inserted.id
          setIapId(savedId)
        }
      }

      setImgSrc(dataUrl)
      setCrop(blankCrop())
      setDirty(false)
      setStatus(nextStatus)
      onStatusChange(nextStatus)
      setSuccess(
        withOp
          ? 'Incident Action Plan submitted for review.'
          : 'Cover page saved as draft.',
      )

      // A submitted IAP is the IMT's cue to review it (fire-and-forget).
      if (nextStatus === 'Submitted') {
        notifyIncident(incidentId, {
          type: 'iap_submitted',
          title: 'Incident Action Plan submitted for review',
          body: `${incidentName || incidentId}${payload.operational_period ? ` — ${String(payload.operational_period)}` : ''}`,
          link: `/incident/${incidentId}/iap/${savedId}`,
          roles: ['IMT'],
          excludeUserId: user?.id,
        })
      }

      return savedId
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process the image.'
      setTableMissing(message.includes('incident_iap'))
      setError(message)
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    persist('Draft', false)
  }

  // Submit → ask for the operational period
  const handleStartPeriodStep = async () => {
    setError('')
    setSuccess('')
    setStep('period')

    const empty = !op.from_date && !op.from_time && !op.to_date && !op.to_time
    if (!empty) return

    // autopopulate from ICS 202
    setPrefilling(true)
    const { data } = await supabase
      .from('ics_202_forms')
      .select('op_period_from_date, op_period_from_time, op_period_to_date, op_period_to_time')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setOp({
        from_date: data.op_period_from_date || '',
        from_time: data.op_period_from_time || '',
        to_date: data.op_period_to_date || '',
        to_time: data.op_period_to_time || '',
      })
    }
    setPrefilling(false)
  }

  const handleProceed = async () => {
    if (!op.from_date || !op.to_date) {
      setError('Enter the start and end dates of the operational period.')
      return
    }
    const savedId = await persist('Submitted', true)
    if (savedId) onProceed(savedId)
  }

  const hasImage = !!imgSrc
  const canSave = hasImage && !saving && dirty
  const canSubmit = hasImage && !saving && !dirty
  const canProceed = !saving && !prefilling && !!op.from_date && !!op.to_date

  return (
    <div className="iap-modal-overlay" onMouseDown={onClose}>
      <div className="iap-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="iap-modal-header">
          <div className="iap-modal-heading">
            <h3>{step === 'cover' ? 'Generate Incident Action Plan' : 'Operational Period'}</h3>
            <p>
              {step === 'cover' ? (
                <>
                  {incidentName ? `${incidentName} · ` : ''}Upload a cover page — default size <strong>A4 portrait ({A4_W} &times; {A4_H} mm)</strong>. Adjust the crop, save, then submit.
                </>
              ) : (
                <>
                  Autopopulated from ICS Form 202 — one IAP is created per operational period. Adjust if needed, then proceed.
                </>
              )}
            </p>
          </div>
          <button className="iap-modal-close" onClick={onClose} aria-label="Close" disabled={saving}>&times;</button>
        </div>

        <div className="iap-modal-body">
          {error && <div className="iap-error-message">{error}</div>}
          {success && <div className="iap-success-message">{success}</div>}
          {tableMissing && (
            <div className="iap-warning-message">
              The <code>incident_iap</code> table is missing or out of date — run <code>supabase-iap-schema.sql</code> in the Supabase SQL editor, then reload this dialog. It drops the old unique constraint and adds the operational-period columns.
            </div>
          )}

          {step === 'period' ? (
            <div className="iap-op-step">
              <div className="iap-op-grid">
                <label className="iap-op-field">
                  <span>From (Date)</span>
                  <input type="date" value={op.from_date} onChange={setOpField('from_date')} disabled={saving || prefilling} />
                </label>
                <label className="iap-op-field">
                  <span>From (Time)</span>
                  <input type="time" value={op.from_time} onChange={setOpField('from_time')} disabled={saving || prefilling} />
                </label>
                <label className="iap-op-field">
                  <span>To (Date)</span>
                  <input type="date" value={op.to_date} onChange={setOpField('to_date')} disabled={saving || prefilling} />
                </label>
                <label className="iap-op-field">
                  <span>To (Time)</span>
                  <input type="time" value={op.to_time} onChange={setOpField('to_time')} disabled={saving || prefilling} />
                </label>
              </div>

              <div className="iap-op-summary">
                Operational Period: <strong>{formatOpPeriod(op) || '—'}</strong>
              </div>

              <p className="iap-op-hint">
                {prefilling
                  ? 'Autofilling from ICS Form 202...'
                  : 'Times are optional and shown in military format (e.g. 0800H).'}
              </p>
            </div>
          ) : loading ? (
            <p className="iap-modal-loading">Loading cover page...</p>
          ) : hasImage ? (
            <>
              <div className="iap-crop-viewport">
                <div className="iap-crop-stage" ref={stageRef}>
                  <img src={imgSrc} alt="Cover page" draggable={false} onLoad={onImgLoad} onDragStart={(e) => e.preventDefault()} />
                  <div
                    className="iap-crop-rect"
                    style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%` }}
                    onMouseDown={startDrag('move')}
                  >
                    <span className="iap-crop-label">A4 &middot; {A4_W} &times; {A4_H} mm</span>
                    {HANDLES.map((d) => (
                      <span key={d} className={`iap-crop-handle ${d}`} onMouseDown={startDrag(d)} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="iap-crop-toolbar">
                <span className="iap-crop-hint">Drag the box to move it &bull; drag the corners to crop &bull; the box stays A4 portrait</span>
                <div className="iap-crop-actions">
                  <button type="button" className="iap-tool-btn" onClick={resetCrop} disabled={saving}>Reset Crop</button>
                  <button type="button" className="iap-tool-btn" onClick={() => fileRef.current?.click()} disabled={saving}>Replace Image</button>
                  {canReuse && (
                    <button type="button" className="iap-tool-btn" onClick={reusePreviousCover} disabled={saving || reusing}>
                      {reusing ? 'Loading...' : 'Use Previous Cover'}
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="iap-upload-zone" onClick={() => fileRef.current?.click()}>
                <div className="iap-upload-icon">&#128196;</div>
                <div className="iap-upload-text">Upload cover page</div>
                <div className="iap-upload-sub">Click here &mdash; JPG or PNG only &bull; defaults to A4 portrait</div>
              </div>
              {canReuse && (
                <button
                  type="button"
                  className="iap-reuse-btn"
                  onClick={reusePreviousCover}
                  disabled={reusing || saving}
                >
                  {reusing ? 'Loading cover...' : 'Reuse cover from previous IAP'}
                </button>
              )}
            </>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,.jpg,.jpeg,.png"
            onChange={onFileChange}
            hidden
          />
        </div>

        <div className="iap-modal-footer">
          {step === 'cover' ? (
            <>
              <span className="iap-footer-hint">
                {status === 'Approved'
                  ? 'This IAP is approved — start a new one from the incident page.'
                  : status === 'Submitted'
                    ? 'Submitted — you can still adjust the cover page before approval.'
                    : dirty
                      ? 'Unsaved changes — save before submitting.'
                      : status === 'Draft'
                        ? 'Draft saved — you can submit now.'
                        : 'Save the cover page, then submit.'}
              </span>
              <div className="iap-footer-actions">
                <button type="button" className="iap-footer-btn cancel" onClick={onClose} disabled={saving}>Cancel</button>
                <button type="button" className="iap-footer-btn save" onClick={handleSave} disabled={!canSave}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="iap-footer-btn submit" onClick={handleStartPeriodStep} disabled={!canSubmit}>
                  Submit
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="iap-footer-hint">One IAP is created per operational period.</span>
              <div className="iap-footer-actions">
                <button type="button" className="iap-footer-btn cancel" onClick={() => { setStep('cover'); setError(''); setSuccess('') }} disabled={saving}>
                  Back
                </button>
                <button type="button" className="iap-footer-btn submit" onClick={handleProceed} disabled={!canProceed}>
                  {saving ? 'Saving...' : 'Proceed'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
