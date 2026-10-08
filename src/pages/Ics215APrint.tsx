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
  mitigating_measures: string
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

const EMPTY_DIV = 8

export default function Ics215APrint({
  incidentName, opFromDate, opFromTime, opToDate, opToTime,
  hazardIdentifiers, divisions,
  preparedBySofr, datePreparedSofr, timePreparedSofr,
  preparedByOsc, datePreparedOsc, timePreparedOsc, onClose,
}: Ics215APrintProps) {
  const handlePrint = () => window.print()
  const opFrom = `${opFromDate} ${formatMilitaryTimeShort(opFromTime)}`.trim()
  const opTo = `${opToDate} ${formatMilitaryTimeShort(opToTime)}`.trim()

  const hazards = hazardIdentifiers.length > 0 ? [...hazardIdentifiers] : ['']
  const hazardCount = hazards.length

  const divList = divisions.length > 0
    ? divisions
    : Array.from({ length: EMPTY_DIV }, (_, i) => ({
        id: `empty-${i}`, division_group: '', mitigating_measures: '', hazards: [] as Hazard[],
      }))
  const divCount = divList.length

  // total columns = 3 (division) + hazardCount + 3 (measures)
  const totalCols = 3 + hazardCount + 3
  const endCol = totalCols + 1 // exclusive end for gridColumn

  // Prepared-by proportional splits (ratio 2:5:4:2 from original 13-col)
  const labelCols = 2
  const timeCols = 2
  const nameDateTotal = totalCols - labelCols - timeCols
  const nameCols = Math.round(nameDateTotal * 5 / 9)
  const dateCols = nameDateTotal - nameCols
  const nameEnd = labelCols + nameCols + 1
  const dateEnd = nameEnd + dateCols

  // Row offsets
  const noteRow = 8 + divCount
  const sofrRow = noteRow + 1
  const oscRow = sofrRow + 1

  // Dynamic grid-template-rows
  const gridTemplateRows = [
    '60px',  // row 1: title
    '22px',  // row 2: op period label
    '22px',  // row 3: from
    '22px',  // row 4: to
    '24px',  // row 5: hazard header
    '50px',  // row 6: hazard sub-headers
    '20px',  // row 7: check box label
    ...Array(divCount).fill('50px'), // data rows
    '20px',  // note
    '28px',  // SOFR
    '28px',  // OSC
  ].join(' ')

  const R = (row: number) => String(row)

  const getHazardApply = (div: Division, hazardId: string): boolean => {
    const h = div.hazards.find(hz => hz.identifier === hazardId)
    return h ? h.applies : false
  }

  const getHazardMeasures = (div: Division, hazardId: string): string => {
    const h = div.hazards.find(hz => hz.identifier === hazardId)
    return h ? h.mitigating_measures : ''
  }

  return (
    <div className="print-overlay">
      <div className="print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="print-page">
        <div
          className="ics215a-grid"
          style={{
            gridTemplateColumns: `repeat(3, 1fr) repeat(${hazardCount}, 1fr) repeat(3, 1fr)`,
            gridTemplateRows,
          }}
        >

          {/* ROW 1: Title + NDRRMC Logo */}
          <div className="g-cell title-cell" style={{ gridColumn: `1 / ${endCol}`, gridRow: '1' }}>
            <div className="title-inner">
              <img src="/ndrrmc-logo.png" alt="" className="logo" />
              <div className="title-text">
                <div className="title-main">INCIDENT/EVENT SAFETY, RISK AND HEALTH ANALYSIS</div>
                <div className="title-sub">ICS 215-A</div>
              </div>
            </div>
          </div>

          {/* ROW 2-4: Incident Name + Operational Period */}
          <div className="g-cell section-label-cell" style={{ gridColumn: `1 / ${3 + 5 + 1}`, gridRow: '2 / 5' }}>
            <div className="section-label">1. INCIDENT/EVENT NAME</div>
            <div className="field-value">{incidentName}</div>
          </div>
          <div className="g-cell section-label-cell" style={{ gridColumn: `${3 + 5 + 1} / ${endCol}`, gridRow: '2' }}>
            <div className="section-label">2. OPERATIONAL PERIOD</div>
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: `${3 + 5 + 1} / ${endCol}`, gridRow: '3' }}>
            From (Date and Time): {opFrom}
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: `${3 + 5 + 1} / ${endCol}`, gridRow: '4' }}>
            To (Date and Time): {opTo}
          </div>

          {/* ROW 5-7: Column Headers */}
          <div className="g-cell col-header div-header" style={{ gridColumn: '1 / 4', gridRow: '5 / 8' }}>
            3. DIVISION/ GROUP / OTHERS
          </div>
          <div className="g-cell col-header hazard-header" style={{ gridColumn: `4 / ${4 + hazardCount}`, gridRow: '5' }}>
            4. POTENTIAL HAZARDS/ THREATS
          </div>
          <div className="g-cell col-header measures-header" style={{ gridColumn: `${4 + hazardCount} / ${endCol}`, gridRow: '5 / 8' }}>
            5. MITIGATING MEASURES
          </div>

          {/* Hazard sub-headers */}
          {hazards.map((hz, i) => (
            <div key={i} className="g-cell hazard-subheader" style={{ gridColumn: String(4 + i), gridRow: '6' }}>
              {hz}
            </div>
          ))}

          {/* Check box label */}
          <div className="g-cell check-label" style={{ gridColumn: `4 / ${4 + hazardCount}`, gridRow: '7' }}>
            (Check box if the hazard applies)
          </div>

          {/* DATA ROWS */}
          {divList.map((div, ri) => {
            const row = 8 + ri
            return (
              <React.Fragment key={div.id}>
                <div className="g-cell div-cell" style={{ gridColumn: '1 / 4', gridRow: R(row) }}>
                  {div.division_group}
                </div>
                {hazards.map((hzId, ci) => (
                  <div key={ci} className="g-cell check-cell" style={{ gridColumn: String(4 + ci), gridRow: R(row) }}>
                    {getHazardApply(div, hzId) ? '✓' : ''}
                  </div>
                ))}
                <div className="g-cell measures-cell" style={{ gridColumn: `${4 + hazardCount} / ${endCol}`, gridRow: R(row) }}>
                  {div.mitigating_measures || getHazardMeasures(div, hazards[0])}
                </div>
              </React.Fragment>
            )
          })}

          {/* NOTE ROW */}
          <div className="g-cell note-cell" style={{ gridColumn: `1 / ${endCol}`, gridRow: R(noteRow) }}>
            <em>Use additional sheets as necessary.</em>
          </div>

          {/* SOFR ROW */}
          <div className="g-cell section-label-cell" style={{ gridColumn: `1 / ${labelCols + 1}`, gridRow: R(sofrRow) }}>
            <div className="section-label">6. Prepared by SOFR</div>
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: `${labelCols + 1} / ${nameEnd}`, gridRow: R(sofrRow) }}>
            Name and Signature: {preparedBySofr}
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: `${nameEnd} / ${dateEnd}`, gridRow: R(sofrRow) }}>
            Date Prepared: {datePreparedSofr}
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: `${dateEnd} / ${endCol}`, gridRow: R(sofrRow) }}>
            Time Prepared: {formatMilitaryTimeShort(timePreparedSofr)}
          </div>

          {/* OSC ROW */}
          <div className="g-cell section-label-cell" style={{ gridColumn: `1 / ${labelCols + 1}`, gridRow: R(oscRow) }}>
            <div className="section-label">7. Prepared by OSC</div>
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: `${labelCols + 1} / ${nameEnd}`, gridRow: R(oscRow) }}>
            Name and Signature: {preparedByOsc}
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: `${nameEnd} / ${dateEnd}`, gridRow: R(oscRow) }}>
            Date Prepared: {datePreparedOsc}
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: `${dateEnd} / ${endCol}`, gridRow: R(oscRow) }}>
            Time Prepared: {formatMilitaryTimeShort(timePreparedOsc)}
          </div>

        </div>
      </div>
    </div>
  )
}
