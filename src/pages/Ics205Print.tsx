import { formatMilitaryTimeShort } from '../lib/utils'
import './Ics205Print.css'

interface Ics205PrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  channels: Array<{
    radio_type: string
    system: string
    channel: string
    function: string
    tone_offset: string
    frequency: string
    others: string
    assignment: string
    remarks: string
  }>
  coordinatingInstructions: string
  preparedBy: string
  datePrepared: string
  timePrepared: string
  onClose: () => void
}

export default function Ics205Print({
  incidentName, opFromDate, opFromTime, opToDate, opToTime,
  channels, coordinatingInstructions,
  preparedBy, datePrepared, timePrepared, onClose,
}: Ics205PrintProps) {
  const handlePrint = () => window.print()

  const emptyRows = Math.max(0, 8 - channels.length)
  const opFrom = `${opFromDate} ${formatMilitaryTimeShort(opFromTime)}`.trim()
  const opTo = `${opToDate} ${formatMilitaryTimeShort(opToTime)}`.trim()

  return (
    <div className="ics205-print-overlay">
      <div className="ics205-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="ics205-print-page">
        <table className="form-frame">
          <tbody>
            <tr>
              <td>
                <table className="form-header">
                  <tbody>
                    <tr>
                      <td className="logo-cell">
                        <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
                      </td>
                      <td className="title-cell">
                        <h1>COMMUNICATIONS PLAN</h1>
                        <h2>ICS 205</h2>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="top-fields">
                  <tbody>
                    <tr>
                      <td className="field-box wide">
                        <span className="field-num">1.</span> <strong>INCIDENT/EVENT NAME</strong>
                        <div className="field-data">{incidentName}</div>
                      </td>
                      <td className="field-box">
                        <span className="field-num">2.</span> <strong>OPERATIONAL PERIOD</strong>
                        <div className="field-data">From (Date and Time): {opFrom}</div>
                        <div className="field-data">To (Date and Time): {opTo}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="section-title"><strong>3. BASIC RADIO CHANNEL UTILIZATION</strong></div>

                <table className="data-grid">
                  <thead>
                    <tr>
                      <th>Radio Type</th>
                      <th>System</th>
                      <th>Channel</th>
                      <th>Function</th>
                      <th>Tone/ Offset</th>
                      <th>Frequency</th>
                      <th>Others (mobile phone, satellite phone, etc.)</th>
                      <th>Assignment</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((c, i) => (
                      <tr key={i}>
                        <td>{c.radio_type}</td>
                        <td>{c.system}</td>
                        <td>{c.channel}</td>
                        <td>{c.function}</td>
                        <td>{c.tone_offset}</td>
                        <td>{c.frequency}</td>
                        <td>{c.others}</td>
                        <td>{c.assignment}</td>
                        <td>{c.remarks}</td>
                      </tr>
                    ))}
                    {Array.from({ length: emptyRows }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        {Array.from({ length: 9 }).map((_, j) => <td key={j}>&nbsp;</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="section-title"><strong>4. COORDINATING INSTRUCTIONS</strong></div>
                <div className="coordinating-box">{coordinatingInstructions || '\u00A0'}</div>

                <table className="footer-fields">
                  <tbody>
                    <tr>
                      <td className="prepared-cell">
                        <strong>5. Prepared by COML</strong>&nbsp;&nbsp;
                        Name and Signature: {preparedBy}
                      </td>
                      <td className="date-cell">
                        Date Prepared: {datePrepared}
                      </td>
                      <td className="time-cell">
                        Time Prepared: {formatMilitaryTimeShort(timePrepared)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
