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

const HAZARD_COLS = 7
const DATA_ROWS = 5
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

  const hazards = hazardIdentifiers.slice(0, HAZARD_COLS)
  while (hazards.length < HAZARD_COLS) hazards.push('')

  const divList = divisions.length > 0
    ? divisions
    : Array.from({ length: EMPTY_DIV }, (_, i) => ({
        id: `empty-${i}`, division_group: '', hazards: [] as Hazard[],
      }))

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
        <div className="ics215a-grid">

          {/* ROW 1: Title + NDRRMC Logo */}
          <div className="g-cell title-cell" style={{ gridColumn: '1 / 14', gridRow: '1' }}>
            <div className="title-inner">
              <img src="/ndrrmc-logo.png" alt="" className="logo" />
              <div className="title-text">
                <div className="title-main">INCIDENT/EVENT SAFETY, RISK AND HEALTH ANALYSIS</div>
                <div className="title-sub">ICS 215-A</div>
              </div>
            </div>
          </div>

          {/* ROW 2-4: Incident Name + Operational Period */}
          <div className="g-cell section-label-cell" style={{ gridColumn: '1 / 9', gridRow: '2 / 5' }}>
            <div className="section-label">1. INCIDENT/EVENT NAME</div>
            <div className="field-value">{incidentName}</div>
          </div>
          <div className="g-cell section-label-cell" style={{ gridColumn: '9 / 14', gridRow: '2' }}>
            <div className="section-label">2. OPERATIONAL PERIOD</div>
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: '9 / 14', gridRow: '3' }}>
            From (Date and Time): {opFrom}
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: '9 / 14', gridRow: '4' }}>
            To (Date and Time): {opTo}
          </div>

          {/* ROW 5-7: Column Headers */}
          <div className="g-cell col-header div-header" style={{ gridColumn: '1 / 4', gridRow: '5 / 8' }}>
            3. DIVISION/ GROUP / OTHERS
          </div>
          <div className="g-cell col-header hazard-header" style={{ gridColumn: '4 / 11', gridRow: '5' }}>
            4. POTENTIAL HAZARDS/ THREATS
          </div>
          <div className="g-cell col-header measures-header" style={{ gridColumn: '11 / 14', gridRow: '5 / 8' }}>
            5. MITIGATING MEASURES
          </div>

          {/* Hazard sub-headers */}
          {hazards.map((hz, i) => (
            <div key={i} className="g-cell hazard-subheader" style={{ gridColumn: String(4 + i), gridRow: '6' }}>
              {hz}
            </div>
          ))}

          {/* Check box label */}
          <div className="g-cell check-label" style={{ gridColumn: '4 / 11', gridRow: '7' }}>
            (Check box if the hazard applies)
          </div>

          {/* DATA ROWS */}
          {divList.slice(0, DATA_ROWS).map((div, ri) => {
            const row = 8 + ri
            return (
              <React.Fragment key={div.id}>
                <div className="g-cell div-cell" style={{ gridColumn: '1 / 4', gridRow: String(row) }}>
                  {div.division_group}
                </div>
                {hazards.map((hzId, ci) => (
                  <div key={ci} className="g-cell check-cell" style={{ gridColumn: String(4 + ci), gridRow: String(row) }}>
                    {getHazardApply(div, hzId) ? '✓' : ''}
                  </div>
                ))}
                <div className="g-cell measures-cell" style={{ gridColumn: '11 / 14', gridRow: String(row) }}>
                  {getHazardMeasures(div, hazards[0])}
                </div>
              </React.Fragment>
            )
          })}

          {/* ROW 13: Use additional sheets */}
          <div className="g-cell note-cell" style={{ gridColumn: '1 / 14', gridRow: '13' }}>
            <em>Use additional sheets as necessary.</em>
          </div>

          {/* ROW 14: Prepared by SOFR */}
          <div className="g-cell section-label-cell" style={{ gridColumn: '1 / 3', gridRow: '14' }}>
            <div className="section-label">6. Prepared by SOFR</div>
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: '3 / 8', gridRow: '14' }}>
            Name and Signature: {preparedBySofr}
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: '8 / 12', gridRow: '14' }}>
            Date Prepared: {datePreparedSofr}
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: '12 / 14', gridRow: '14' }}>
            Time Prepared: {formatMilitaryTimeShort(timePreparedSofr)}
          </div>

          {/* ROW 15: Prepared by OSC */}
          <div className="g-cell section-label-cell" style={{ gridColumn: '1 / 3', gridRow: '15' }}>
            <div className="section-label">7. Prepared by OSC</div>
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: '3 / 8', gridRow: '15' }}>
            Name and Signature: {preparedByOsc}
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: '8 / 12', gridRow: '15' }}>
            Date Prepared: {datePreparedOsc}
          </div>
          <div className="g-cell field-cell" style={{ gridColumn: '12 / 14', gridRow: '15' }}>
            Time Prepared: {formatMilitaryTimeShort(timePreparedOsc)}
          </div>

        </div>
      </div>
    </div>
  )
}
