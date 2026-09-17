import './Ics202Print.css'

interface Ics202PrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  objectives: string
  commandEmphasis: string
  weatherForecast: string
  safetyMessage: string
  safetyPlanRequired: boolean
  safetyPlanLocation: string
  attach203: boolean
  attach204: boolean
  attach205: boolean
  attach206: boolean
  attach209: boolean
  attachMap: boolean
  attachOthers: boolean
  attachOthersText: string
  preparedByName: string
  preparedBySig: string
  preparedDate: string
  preparedTime: string
  approvedByName: string
  approvedBySig: string
  approvedDate: string
  approvedTime: string
  onClose: () => void
}

const fmtTime = (t: string) => t ? t.replace(':', '') + 'H' : ''
const fmtDT = (d: string, t: string) => (!d && !t) ? '' : `${d} ${fmtTime(t)}`.trim()

export default function Ics202Print(props: Ics202PrintProps) {
  const handlePrint = () => window.print()

  return (
    <div className="ics202-print-overlay">
      <div className="ics202-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      <div className="ics202-print-page">
        <table className="ics202-form">
          <thead>
            <tr>
              <td colSpan={2} className="header-cell">
                <div className="header-content">
                  <div className="logo-section">
                    <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
                  </div>
                  <div className="title-section">
                    <div className="main-title">INCIDENT OBJECTIVES</div>
                    <div className="form-number">ICS 202</div>
                  </div>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="top-cell" style={{ width: '50%' }}>
                <div className="field-label">1. INCIDENT/EVENT NAME</div>
                <div className="field-value">{props.incidentName || '\u00A0'}</div>
              </td>
              <td className="top-cell">
                <div className="field-label">2. OPERATIONAL PERIOD</div>
                <div className="field-value">From (Date and Time): {fmtDT(props.opFromDate, props.opFromTime) || '\u00A0'}</div>
                <div className="field-value">To (Date and Time): {fmtDT(props.opToDate, props.opToTime) || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="content-cell objective-cell">
                <div className="field-label">3. OBJECTIVES FOR THE OPERATIONAL PERIOD</div>
                <div className="field-textarea">{props.objectives || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="content-cell emphasis-cell">
                <div className="field-label">4. OPERATIONAL PERIOD COMMAND EMPHASIS</div>
                <div className="field-textarea">{props.commandEmphasis || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="content-cell weather-cell">
                <div className="field-label">5. GENERAL SITUATION AWARENESS (WEATHER FORECAST)</div>
                <div className="field-textarea">{props.weatherForecast || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="content-cell safety-cell">
                <div className="field-label">6. GENERAL SAFETY MESSAGE</div>
                <div className="field-textarea">{props.safetyMessage || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="content-cell safety-plan-cell">
                <div className="field-label">7. SITE SAFETY PLAN REQUIRED?</div>
                <div className="field-value safety-options">
                  <span className="checkbox-mark">{props.safetyPlanRequired ? '\u2611' : '\u2610'}</span> YES
                  &nbsp;&nbsp;&nbsp;
                  <span className="checkbox-mark">{!props.safetyPlanRequired ? '\u2611' : '\u2610'}</span> NO
                </div>
                <div className="field-value">Location of Approved Site Safety Plan: {props.safetyPlanLocation || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="content-cell attachments-cell">
                <div className="field-label">8. ATTACHMENTS (CHECK IF ATTACHED)</div>
                <div className="attachments-grid">
                  <div className="attachment-col">
                    <div className="attachment-item">
                      <span className="checkbox-mark">{props.attach203 ? '\u2611' : '\u2610'}</span>
                      <span>ORGANIZATION LIST - ICS 203</span>
                    </div>
                    <div className="attachment-item">
                      <span className="checkbox-mark">{props.attach204 ? '\u2611' : '\u2610'}</span>
                      <span>DIV. ASSIGNMENT LISTS - ICS 204</span>
                    </div>
                    <div className="attachment-item">
                      <span className="checkbox-mark">{props.attach205 ? '\u2611' : '\u2610'}</span>
                      <span>COMMUNICATIONS PLAN - ICS 205</span>
                    </div>
                  </div>
                  <div className="attachment-col">
                    <div className="attachment-item">
                      <span className="checkbox-mark">{props.attach206 ? '\u2611' : '\u2610'}</span>
                      <span>MEDICAL PLAN - ICS 206</span>
                    </div>
                    <div className="attachment-item">
                      <span className="checkbox-mark">{props.attach209 ? '\u2611' : '\u2610'}</span>
                      <span>SAFETY MESSAGE/PLAN - ICS 208</span>
                    </div>
                    <div className="attachment-item">
                      <span className="checkbox-mark">{props.attachMap ? '\u2611' : '\u2610'}</span>
                      <span>INCIDENT/EVENT MAP</span>
                    </div>
                  </div>
                  <div className="attachment-col others-col">
                    <div className="field-label">OTHERS:</div>
                    <div className="field-value">{props.attachOthers ? props.attachOthersText || '\u00A0' : '\u00A0'}</div>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td className="sig-cell" colSpan={2}>
                <div className="sig-row-print">
                  <div className="sig-num">9. Prepared by PSC</div>
                  <div className="sig-field-print">
                    <span className="sig-label">Name and Signature:</span>
                    <span className="sig-value">{props.preparedByName || props.preparedBySig || '\u00A0'}</span>
                  </div>
                  <div className="sig-field-print">
                    <span className="sig-label">Date Prepared:</span>
                    <span className="sig-value">{props.preparedDate || '\u00A0'}</span>
                  </div>
                  <div className="sig-field-print">
                    <span className="sig-label">Time Prepared:</span>
                    <span className="sig-value">{fmtTime(props.preparedTime) || '\u00A0'}</span>
                  </div>
                </div>
                <div className="sig-row-print">
                  <div className="sig-num">10. Approved by IC</div>
                  <div className="sig-field-print">
                    <span className="sig-label">Name and Signature:</span>
                    <span className="sig-value">{props.approvedByName || props.approvedBySig || '\u00A0'}</span>
                  </div>
                  <div className="sig-field-print">
                    <span className="sig-label">Date Approved:</span>
                    <span className="sig-value">{props.approvedDate || '\u00A0'}</span>
                  </div>
                  <div className="sig-field-print">
                    <span className="sig-label">Time Approved:</span>
                    <span className="sig-value">{fmtTime(props.approvedTime) || '\u00A0'}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
