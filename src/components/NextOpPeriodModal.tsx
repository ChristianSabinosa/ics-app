import { useState } from 'react'
import type { OpPeriodInput } from '../lib/rollover'
import './ConfirmModal.css'
import './NextOpPeriodModal.css'

interface NextOpPeriodModalProps {
  /** Raw previous-period dates, used to prefill and to warn on overlap. */
  prevFromDate: string
  prevToDate: string
  prevToTime: string
  onConfirm: (op: OpPeriodInput) => Promise<void>
  onCancel: () => void
}

const sameDurationTo = (fromDate: string, pFrom: string, pTo: string): string => {
  if (!fromDate || !pFrom || !pTo) return ''
  const days =
    Math.round(
      (new Date(`${pTo}T00:00`).getTime() - new Date(`${pFrom}T00:00`).getTime()) / 86400000,
    ) || 0
  const d = new Date(`${fromDate}T00:00`)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function NextOpPeriodModal({
  prevFromDate,
  prevToDate,
  prevToTime,
  onConfirm,
  onCancel,
}: NextOpPeriodModalProps) {
  const [fromDate, setFromDate] = useState(prevToDate)
  const [fromTime, setFromTime] = useState(prevToTime)
  const [toDate, setToDate] = useState(() => sameDurationTo(prevToDate, prevFromDate, prevToDate))
  const [toTime, setToTime] = useState(prevToTime)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  const handleConfirm = async () => {
    setError('')
    if (!fromDate || !toDate) {
      setError('Enter a from-date and a to-date for the new period.')
      return
    }
    if (`${fromDate}T${fromTime || '00:00'}` >= `${toDate}T${toTime || '00:00'}`) {
      setError('The new period must end after it starts.')
      return
    }
    setWorking(true)
    try {
      await onConfirm({ from_date: fromDate, from_time: fromTime, to_date: toDate, to_time: toTime })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the next period.')
      setWorking(false)
    }
  }

  const overlaps =
    !!prevToDate && !!fromDate && `${fromDate}T${fromTime || '00:00'}` < `${prevToDate}T${prevToTime || '00:00'}`

  return (
    <div className="modal-overlay" onClick={() => { if (!working) onCancel() }}>
      <div className="modal-content next-op-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Next Operational Period</h3>
        <p className="modal-message">
          Every form is copied forward as a new Draft with its current inputs kept, so the
          team revises them for the new period. Submitted history is preserved. The incident
          map and check-ins are unchanged.
        </p>
        {error && <div className="modal-error">{error}</div>}
        {overlaps && (
          <div className="modal-warning">
            The new period starts before the previous one ends — the two periods will overlap.
          </div>
        )}
        <div className="next-op-grid">
          <div className="modal-field">
            <label htmlFor="next-op-from-date">From date</label>
            <input id="next-op-from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={working} />
          </div>
          <div className="modal-field">
            <label htmlFor="next-op-from-time">From time</label>
            <input id="next-op-from-time" type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} disabled={working} />
          </div>
          <div className="modal-field">
            <label htmlFor="next-op-to-date">To date</label>
            <input id="next-op-to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={working} />
          </div>
          <div className="modal-field">
            <label htmlFor="next-op-to-time">To time</label>
            <input id="next-op-to-time" type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} disabled={working} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onCancel} disabled={working}>Cancel</button>
          <button className="modal-btn confirm" onClick={handleConfirm} disabled={working}>
            {working ? 'Rolling over…' : 'Start Next Period'}
          </button>
        </div>
      </div>
    </div>
  )
}
