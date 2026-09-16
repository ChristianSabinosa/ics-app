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

export default function Ics202Print(props: Ics202PrintProps) {
  const handlePrint = () => window.print()

  const formatMilitaryTime = (time: string) => {
    if (!time) return ''
    return time.replace(':', '') + 'H'
  }

  const formatDateTime = (date: string, time: string) => {
    if (!date && !time) return ''
    return `${date} ${formatMilitaryTime(time)}`.trim()
  }

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
              <td className="field-cell" style={{ width: '50%' }}>
                <div className="field-label">1. INCIDENT/EVENT NAME</div>
                <div className="field-value">{props.incidentName || '\u00A0'}</div>
              </td>
              <td className="field-cell">
                <div className="field-label">2. OPERATIONAL PERIOD</div>
                <div className="field-value">
                  From (Date and Time): {formatDateTime(props.opFromDate, props.opFromTime) || '\u00A0'}
                </div>
                <div className="field-value">
                  To (Date and Time): {formatDateTime(props.opToDate, props.opToTime) || '\u00A0'}
                </div>
              </td>
            </tr>
            <tr>
              <td className="field-cell" colSpan={2}>
                <div className="field-label">3. OBJECTIVES FOR THE OPERATIONAL PERIOD</div>
                <div className="field-value tall">{props.objectives || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="field-cell" colSpan={2}>
                <div className="field-label">4. OPERATIONAL PERIOD COMMAND EMPHASIS</div>
                <div className="field-value tall">{props.commandEmphasis || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="field-cell" colSpan={2}>
                <div className="field-label">5. GENERAL SITUATION AWARENESS (WEATHER FORECAST)</div>
                <div className="field-value tall">{props.weatherForecast || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="field-cell" colSpan={2}>
                <div className="field-label">6. GENERAL SAFETY MESSAGE</div>
                <div className="field-value tall">{props.safetyMessage || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="field-cell" colSpan={2}>
                <div className="field-label">7. SITE SAFETY PLAN REQUIRED?</div>
                <div className="field-value">
                  <span className="check-item">
                    <input type="checkbox" checked={props.safetyPlanRequired === true} readOnly className="print-checkbox" /> YES
                  </span>
                  <span className="check-item">
                    <input type="checkbox" checked={props.safetyPlanRequired === false} readOnly className="print-checkbox" /> NO
                  </span>
                </div>
                <div className="field-value">
                  Location of Approved Site Safety Plan: {props.safetyPlanLocation || '\u00A0'}
                </div>
              </td>
            </tr>
            <tr>
              <td className="field-cell" colSpan={2}>
                <div className="field-label">8. ATTACHMENTS (CHECK IF ATTACHED)</div>
                <table className="attachments-table">
                  <tbody>
                    <tr>
                      <td>
                        <input type="checkbox" checked={props.attach203} readOnly className="print-checkbox" />
                        ORGANIZATION LIST - ICS 203
                      </td>
                      <td>
                        <input type="checkbox" checked={props.attach206} readOnly className="print-checkbox" />
                        MEDICAL PLAN - ICS 206
                      </td>
                      <td className="others-cell">
                        OTHERS: {props.attachOthers ? (props.attachOthersText || '________') : '\u00A0'}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <input type="checkbox" checked={props.attach204} readOnly className="print-checkbox" />
                        DIV. ASSIGNMENT LISTS - ICS 204
                      </td>
                      <td>
                        <input type="checkbox" checked={props.attach209} readOnly className="print-checkbox" />
                        SAFETY MESSAGE/PLAN - ICS 208
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td>
                        <input type="checkbox" checked={props.attach205} readOnly className="print-checkbox" />
                        COMMUNICATIONS PLAN - ICS 205
                      </td>
                      <td>
                        <input type="checkbox" checked={props.attachMap} readOnly className="print-checkbox" />
                        INCIDENT/EVENT MAP
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td className="field-cell sig-cell" colSpan={2}>
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
                    <span className="sig-value">{formatMilitaryTime(props.preparedTime) || '\u00A0'}</span>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td className="field-cell sig-cell" colSpan={2}>
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
                    <span className="sig-value">{formatMilitaryTime(props.approvedTime) || '\u00A0'}</span>
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
