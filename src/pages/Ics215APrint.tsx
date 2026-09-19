import React from 'react'
import { formatMilitaryTimeShort } from '../lib/utils'
import './Ics215APrint.css'

interface Hazard {
  id: string
  identifier: string
  applies: boolean
  mitigating_measures: string
}

interface Division {
  id: string
  division_group: string
  hazards: Hazard[]
}

interface Ics215APrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  hazardIdentifiers: string[]
  divisions: Division[]
  preparedBySofr: string
  datePreparedSofr: string
  timePreparedSofr: string
  preparedByOsc: string
  datePreparedOsc: string
  timePreparedOsc: string
  onClose: () => void
}

export default function Ics215APrint({
  incidentName, opFromDate, opFromTime, opToDate, opToTime,
  hazardIdentifiers, divisions,
  preparedBySofr, datePreparedSofr, timePreparedSofr,
  preparedByOsc, datePreparedOsc, timePreparedOsc, onClose,
}: Ics215APrintProps) {
  const handlePrint = () => window.print()
  const opFrom = `${opFromDate} ${formatMilitaryTimeShort(opFromTime)}`.trim()
  const opTo = `${opToDate} ${formatMilitaryTimeShort(opToTime)}`.trim()

  const hazards = hazardIdentifiers.length > 0 ? hazardIdentifiers : ['']
  const hazardCount = hazards.length

  const EMPTY_DIV = 8

  const getHazardApply = (div: Division, hazardId: string): boolean => {
    const h = div.hazards.find(hz => hz.identifier === hazardId)
    return h ? h.applies : false
  }

  const getHazardMeasures = (div: Division, hazardId: string): string => {
    const h = div.hazards.find(hz => hz.identifier === hazardId)
    return h ? h.mitigating_measures : ''
  }

  const divList = divisions.length > 0 ? divisions : Array.from({ length: EMPTY_DIV }, (_, i) => ({
    id: `empty-${i}`, division_group: '', hazards: [] as Hazard[],
  }))

  // Column layout: Division (12%) | N hazard cols (3% each) | Mitigating Measures (remaining)
  const gridCols = `12% repeat(${hazardCount}, 3%) auto`

  const R = (row: number) => `${row}`

  let nextRow = 3

  const renderDataRows = () => {
    const elements: React.ReactNode[] = []

    divList.forEach((div) => {
      const row = nextRow
      nextRow += 1

      elements.push(
        <React.Fragment key={div.id}>
          <div className="g-cell div-cell" style={{ gridColumn: '1', gridRow: R(row) }}>
            {div.division_group}
          </div>
          {hazards.map((hzId, hi) => (
            <div key={hi} className="g-cell check-cell" style={{ gridColumn: String(2 + hi), gridRow: R(row) }}>
              {getHazardApply(div, hzId) ? '✓' : ''}
            </div>
          ))}
          <div className="g-cell measures-cell" style={{ gridColumn: String(2 + hazardCount), gridRow: R(row) }}>
            {getHazardMeasures(div, hazards[0])}
          </div>
        </React.Fragment>
      )
    })

    return elements
  }

  const dataEndRow = nextRow

  const renderPreparedBy = () => {
    const startRow = nextRow
    nextRow += 4
    const midRow = startRow + 2

    return (
      <React.Fragment key="prepared">
        <div className="g-cell prep-cell" style={{ gridColumn: `1 / ${2 + hazardCount + 1}`, gridRow: `${R(startRow)} / ${R(midRow)}` }}>
          <div className="prep-title">6. PREPARED BY SOFR</div>
          <div className="prep-field">Name and Signature:</div>
          <div className="prep-value">{preparedBySofr}</div>
        </div>
        <div className="g-cell prep-cell" style={{ gridColumn: `1 / ${2 + Math.floor(hazardCount / 2)}`, gridRow: `${R(midRow)} / ${R(nextRow)}` }}>
          <div className="prep-field">Date Prepared:</div>
          <div className="prep-value">{datePreparedSofr}</div>
        </div>
        <div className="g-cell prep-cell" style={{ gridColumn: `${2 + Math.floor(hazardCount / 2)} / ${2 + hazardCount + 1}`, gridRow: `${R(midRow)} / ${R(nextRow)}` }}>
          <div className="prep-field">Time Prepared:</div>
          <div className="prep-value">{formatMilitaryTimeShort(timePreparedSofr)}</div>
        </div>

        <div className="g-cell prep-cell" style={{ gridColumn: `1 / ${2 + hazardCount + 1}`, gridRow: `${R(nextRow)} / ${R(nextRow + 2)}` }}>
          <div className="prep-title">7. PREPARED BY OSC</div>
          <div className="prep-field">Name and Signature:</div>
          <div className="prep-value">{preparedByOsc}</div>
        </div>
        <div className="g-cell prep-cell" style={{ gridColumn: `1 / ${2 + Math.floor(hazardCount / 2)}`, gridRow: `${R(nextRow + 2)} / ${R(nextRow + 4)}` }}>
          <div className="prep-field">Date Prepared:</div>
          <div className="prep-value">{datePreparedOsc}</div>
        </div>
        <div className="g-cell prep-cell" style={{ gridColumn: `${2 + Math.floor(hazardCount / 2)} / ${2 + hazardCount + 1}`, gridRow: `${R(nextRow + 2)} / ${R(nextRow + 4)}` }}>
          <div className="prep-field">Time Prepared:</div>
          <div className="prep-value">{formatMilitaryTimeShort(timePreparedOsc)}</div>
        </div>
      </React.Fragment>
    )
  }

  return (
    <div className="print-overlay">
      <div className="print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="print-page">
        <div className="ics215a-grid" style={{ gridTemplateColumns: gridCols, gridTemplateRows: `60px 50px repeat(${divList.length}, auto) auto` }}>

          {/* ROW 1: TITLE + INCIDENT + OPERATIONAL PERIOD */}
          <div className="g-cell title-cell" style={{ gridColumn: `1 / ${1 + hazardCount + 2}`, gridRow: '1' }}>
            <div className="title-inner">
              <img src="/ndrrmc-logo.png" alt="" className="logo" />
              <div className="title-text">
                <div className="title-main">INCIDENT/EVENT SAFETY, RISK AND HEALTH ANALYSIS</div>
                <div className="title-sub">ICS 215-A</div>
              </div>
            </div>
          </div>
          <div className="g-cell incident-cell" style={{ gridColumn: `1 / ${1 + hazardCount + 2}`, gridRow: '2' }}>
            <div className="incident-row">
              <div className="incident-field">
                <div className="prep-title">1. INCIDENT/EVENT NAME</div>
                <div className="incident-val">{incidentName}</div>
              </div>
              <div className="period-field">
                <div className="prep-title">2. OPERATIONAL PERIOD</div>
                <div className="period-val">From (Date and Time): {opFrom}</div>
                <div className="period-val">To (Date and Time): {opTo}</div>
              </div>
            </div>
          </div>

          {/* ROW 2: COLUMN HEADERS */}
          <div className="g-cell col-header div-header" style={{ gridColumn: '1', gridRow: '3' }}>
            3. DIVISION /<br />GROUP /<br />OTHERS
          </div>
          {hazards.map((hzId, i) => (
            <div key={i} className="g-cell col-header hazard-header" style={{ gridColumn: String(2 + i), gridRow: '3' }}>
              4. {hzId}
            </div>
          ))}
          <div className="g-cell col-header measures-header" style={{ gridColumn: String(2 + hazardCount), gridRow: '3' }}>
            5. MITIGATING<br />MEASURES
          </div>

          {/* DATA ROWS */}
          {renderDataRows()}

          {/* USE ADDITIONAL SHEETS NOTE */}
          <div className="g-cell note-cell" style={{ gridColumn: `1 / ${2 + hazardCount + 1}`, gridRow: R(dataEndRow) }}>
            <em>Use additional sheets as necessary.</em>
          </div>

          {/* PREPARED BY */}
          {renderPreparedBy()}
        </div>
      </div>
    </div>
  )
}
