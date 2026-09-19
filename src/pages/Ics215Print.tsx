import React from 'react'
import { formatMilitaryTimeShort } from '../lib/utils'
import './Ics215Print.css'

interface ResourceEntry {
  identifier: string
  required: number
  have: number
  need: number
}

interface WorkAssignment {
  id: string
  branch: string
  division_group: string
  work_assignment: string
  resources: ResourceEntry[]
  overhead_position: string
  special_equipment: string
  reporting_location: string
  requested_arrival_time: string
}

interface Ics215PrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  resourceIdentifiers: string[]
  workAssignments: WorkAssignment[]
  preparedBy: string
  datePrepared: string
  timePrepared: string
  onClose: () => void
}

export default function Ics215Print({
  incidentName, opFromDate, opFromTime, opToDate, opToTime,
  resourceIdentifiers, workAssignments,
  preparedBy, datePrepared, timePrepared, onClose,
}: Ics215PrintProps) {
  const handlePrint = () => window.print()
  const opFrom = `${opFromDate} ${formatMilitaryTimeShort(opFromTime)}`.trim()
  const opTo = `${opToDate} ${formatMilitaryTimeShort(opToTime)}`.trim()

  const EMPTY_WA = 6
  const rFields = ['required', 'have', 'need'] as const
  const rLabels: Record<string, string> = { required: 'Required', have: 'Have', need: 'Need' }

  const getVal = (resources: ResourceEntry[], id: string, f: string) => {
    const e = resources.find(r => r.identifier === id)
    return e ? ((e as any)[f] || 0) : 0
  }

  const total = (id: string, f: string) => workAssignments.reduce((s, wa) => {
    const e = wa.resources.find(r => r.identifier === id)
    return s + (e ? ((e as any)[f] || 0) : 0)
  }, 0)

  const resIds = resourceIdentifiers.length > 0 ? resourceIdentifiers : ['']
  const resSlots = Array.from({ length: 12 }, (_, i) => resIds[i] ?? '')

  // Layout: Title(50%) cols 1-10 | Incident(18%) cols 11-16 | Period(32%) cols 17-20
  const gridCols = '8% 8% 8% 8% 3% 3% 3% 3% 3% 3% 3% 3% 3% 3% 3% 3% 8% 8% 8% 8%'

  const periodStart = 17

  const R = (row: number) => `${row}`

  let nextRow = 3

  const renderWorkAssignments = () => {
    const elements: React.ReactNode[] = []
    const waList = workAssignments.length > 0 ? workAssignments : Array.from({ length: EMPTY_WA }, (_, i) => ({
      id: `empty-${i}`, branch: '', division_group: '', work_assignment: '',
      resources: [] as ResourceEntry[], overhead_position: '', special_equipment: '',
      reporting_location: '', requested_arrival_time: '',
    }))

    waList.forEach((wa) => {
      const startRow = nextRow
      nextRow += 3

      rFields.forEach((f, fi) => {
        const row = startRow + fi
        elements.push(
          <React.Fragment key={`${wa.id}-${f}`}>
            {fi === 0 && (
              <>
                <div className="g-cell branch-cell" style={{ gridColumn: '1', gridRow: `${R(startRow)} / ${R(startRow + 3)}` }}>{wa.branch}</div>
                <div className="g-cell div-cell" style={{ gridColumn: '2', gridRow: `${R(startRow)} / ${R(startRow + 3)}` }}>{wa.division_group}</div>
                <div className="g-cell work-cell" style={{ gridColumn: '3', gridRow: `${R(startRow)} / ${R(startRow + 3)}` }}>{wa.work_assignment}</div>
              </>
            )}
            <div className="g-cell lbl-cell" style={{ gridColumn: '4', gridRow: R(row) }}>{rLabels[f]}</div>
            {resSlots.map((id, ri) => (
              <div key={ri} className="g-cell num-cell" style={{ gridColumn: String(5 + ri), gridRow: R(row) }}>
                {id ? getVal(wa.resources, id, f) || '' : ''}
              </div>
            ))}
            {fi === 0 && (
              <>
                <div className="g-cell" style={{ gridColumn: String(periodStart), gridRow: `${R(startRow)} / ${R(startRow + 3)}` }}>{wa.overhead_position}</div>
                <div className="g-cell" style={{ gridColumn: String(periodStart + 1), gridRow: `${R(startRow)} / ${R(startRow + 3)}` }}>{wa.special_equipment}</div>
                <div className="g-cell" style={{ gridColumn: String(periodStart + 2), gridRow: `${R(startRow)} / ${R(startRow + 3)}` }}>{wa.reporting_location}</div>
                <div className="g-cell" style={{ gridColumn: String(periodStart + 3), gridRow: `${R(startRow)} / ${R(startRow + 3)}` }}>{wa.requested_arrival_time}</div>
              </>
            )}
          </React.Fragment>
        )
      })
    })
    return elements
  }

  const renderBottomRows = () => {
    const items = [
      { n: '11', l: 'TOTAL RESOURCES REQUIRED', field: 'required' as const },
      { n: '12', l: 'TOTAL RESOURCES ON HAND', field: 'have' as const },
      { n: '13', l: 'TOTAL RESOURCES NEEDED TO REQUEST', field: 'need' as const },
    ]

    const preparedCells = (
      <>
        <div className="g-cell prep-cell" style={{ gridColumn: '17 / 21', gridRow: `${R(nextRow)} / ${R(nextRow + 3)}` }}>
          <div className="prep-title">14. PREPARED BY OSC</div>
          <div className="prep-field">Name and Signature:</div>
          <div className="prep-value">{preparedBy}</div>
        </div>
        <div className="g-cell prep-cell" style={{ gridColumn: '17 / 19', gridRow: `${R(nextRow + 3)} / ${R(nextRow + 6)}` }}>
          <div className="prep-field">Date Prepared:</div>
          <div className="prep-value">{datePrepared}</div>
        </div>
        <div className="g-cell prep-cell" style={{ gridColumn: '19 / 21', gridRow: `${R(nextRow + 3)} / ${R(nextRow + 6)}` }}>
          <div className="prep-field">Time Prepared:</div>
          <div className="prep-value">{formatMilitaryTimeShort(timePrepared)}</div>
        </div>
      </>
    )

    return items.map(({ n, l, field }, i) => {
      const r1 = nextRow + i * 2
      const r2 = r1 + 1
      return (
        <React.Fragment key={n}>
          <div className="g-cell tot-lbl" style={{ gridColumn: '1 / 3', gridRow: `${R(r1)} / ${R(r2 + 1)}` }}>
            <strong>{n}.</strong> {l}
          </div>
          <div className="g-cell tot-type" style={{ gridColumn: '3 / 5', gridRow: `${R(r1)} / ${R(r2 + 1)}` }}>
            Single Resource<br />ST or TF
          </div>
          {resSlots.map((id, ri) => (
            <>
              <div key={`${ri}-r1`} className="g-cell num-cell tot-num" style={{ gridColumn: String(5 + ri), gridRow: R(r1) }}>
                {id ? total(id, field) || '' : ''}
              </div>
              <div key={`${ri}-r2`} className="g-cell num-cell tot-num" style={{ gridColumn: String(5 + ri), gridRow: R(r2) }} />
            </>
          ))}
          {i === 0 && preparedCells}
        </React.Fragment>
      )
    })
  }

  return (
    <div className="print-overlay">
      <div className="print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="print-page">
        <div className="ics215-grid" style={{ gridTemplateColumns: gridCols, gridTemplateRows: `59px 70px repeat(${EMPTY_WA * 3}, 16px) repeat(6, 30px)` }}>

          {/* ROW 1: TITLE + INCIDENT + OPERATIONAL PERIOD */}
          <div className="g-cell title-cell" style={{ gridColumn: '1 / 11', gridRow: '1' }}>
            <div className="title-inner">
              <img src="/ndrrmc-logo.png" alt="" className="logo" />
              <div className="title-text">
                <div className="title-main">OPERATIONAL PLANNING WORKSHEET</div>
                <div className="title-sub">ICS 215</div>
              </div>
            </div>
          </div>
          <div className="g-cell incident-cell" style={{ gridColumn: '11 / 17', gridRow: '1' }}>
            <div className="section-label">1. INCIDENT/EVENT NAME</div>
            <div className="incident-val">{incidentName}</div>
          </div>
          <div className="g-cell period-cell" style={{ gridColumn: '17 / 21', gridRow: '1' }}>
            <div className="section-label">2. OPERATIONAL PERIOD</div>
            <div className="period-val">From (Date and Time): {opFrom}</div>
            <div className="period-val">To (Date and Time): {opTo}</div>
          </div>

          {/* ROW 2: COLUMN HEADERS */}
          <div className="g-cell col-header" style={{ gridColumn: '1', gridRow: '2' }}>3.<br />BRANCH</div>
          <div className="g-cell col-header" style={{ gridColumn: '2', gridRow: '2' }}>4.<br />DIVISION /<br />GROUP /<br />OTHERS</div>
          <div className="g-cell col-header" style={{ gridColumn: '3', gridRow: '2' }}>5. WORK<br />ASSIGNMENT</div>
          <div className="g-cell col-header" style={{ gridColumn: '4', gridRow: '2' }}>6.<br />RESOURCES</div>
          {resSlots.map((id, i) => (
            <div key={i} className="g-cell col-header res-hdr" style={{ gridColumn: String(5 + i), gridRow: '2' }}>{id || ''}</div>
          ))}
          <div className="g-cell col-header" style={{ gridColumn: String(periodStart), gridRow: '2' }}>7.<br />OVERHEAD<br />POSITION</div>
          <div className="g-cell col-header" style={{ gridColumn: String(periodStart + 1), gridRow: '2' }}>8. SPECIAL<br />EQPT. AND<br />SUPPLIES</div>
          <div className="g-cell col-header" style={{ gridColumn: String(periodStart + 2), gridRow: '2' }}>9.<br />REPORTING<br />LOCATION</div>
          <div className="g-cell col-header" style={{ gridColumn: String(periodStart + 3), gridRow: '2' }}>10.<br />REQUESTED<br />ARRIVAL<br />TIME</div>

          {/* DATA ROWS */}
          {renderWorkAssignments()}

          {/* BOTTOM TOTALS */}
          {renderBottomRows()}
        </div>
      </div>
    </div>
  )
}
