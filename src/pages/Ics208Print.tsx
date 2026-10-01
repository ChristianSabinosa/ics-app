import './Ics208Print.css'

interface Ics208PrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  safetyMessage: string
  safetyPlanRequired: boolean | null
  safetyPlanLocation: string
  preparedByName: string
  preparedDate: string
  preparedTime: string
  onClose: () => void
}

export default function Ics208Print(props: Ics208PrintProps) {
  const handlePrint = () => window.print()

  const formatMilitaryTime = (time: string) => {
    if (!time) return ''
    return time.replace(':', '') + 'H'
  }

  const formatDateTime = (date: string, time: string) => {
    if (!date && !time) return ''
    return `${date} ${formatMilitaryTime(time)}`.trim()
  }

  const nbsp = '\u00A0'

  return (
    <div className="ics208-print-overlay">
      <div className="ics208-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      <div className="ics208-print-page">
        <div className="ics208-frame">
          {/* Header: logo left, title centred across the page */}
          <table className="ics208-form-header">
            <tbody>
              <tr>
                <td className="ics208-logo-cell">
                  <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ics208-logo" />
                </td>
                <td className="ics208-title-cell">
                  <div className="ics208-main-title">SAFETY MESSAGE/ PLAN</div>
                  <div className="ics208-form-number">ICS 208</div>
                </td>
                <td className="ics208-logo-cell ics208-spacer" />
              </tr>
            </tbody>
          </table>

          {/* 1. Incident/Event name  |  2. Operational period */}
          <table className="ics208-top-fields">
            <tbody>
              <tr>
                <td className="ics208-field-cell ics208-wide">
                  <div className="ics208-field-label">1. INCIDENT/ EVENT NAME</div>
                  <div className="ics208-field-data">{props.incidentName || nbsp}</div>
                </td>
                <td className="ics208-field-cell ics208-op">
                  <div className="ics208-field-label">2. OPERATIONAL PERIOD</div>
                  <div className="ics208-field-data">
                    From (Date and Time): {formatDateTime(props.opFromDate, props.opFromTime) || nbsp}
                  </div>
                  <div className="ics208-field-data">
                    To (Date and Time): {formatDateTime(props.opToDate, props.opToTime) || nbsp}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 3. Safety message */}
          <div className="ics208-section-title">3. SAFETY MESSAGE</div>
          <div className="ics208-message-box">{props.safetyMessage || nbsp}</div>

          {/* 4. Site safety plan required? */}
          <table className="ics208-plan">
            <tbody>
              <tr>
                <td>
                  <div className="ics208-line">
                    <span className="ics208-strong">4. SITE SAFETY PLAN REQUIRED?</span>
                    <span className="ics208-opt">
                      <input type="checkbox" checked={props.safetyPlanRequired === true} readOnly className="ics208-checkbox" /> YES
                    </span>
                    <span className="ics208-opt">
                      <input type="checkbox" checked={props.safetyPlanRequired === false} readOnly className="ics208-checkbox" /> NO
                    </span>
                  </div>
                  <div className="ics208-line">
                    <span className="ics208-strong">LOCATION OF SAFETY PLAN:</span>
                    <span className="ics208-loc">{props.safetyPlanLocation || nbsp}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 5. Prepared by */}
          <table className="ics208-footer">
            <tbody>
              <tr>
                <td className="ics208-c1">
                  <span className="ics208-strong">5. Prepared by SOFR</span>
                </td>
                <td className="ics208-c2">
                  Name and Signature: <span className="ics208-value">{props.preparedByName || nbsp}</span>
                </td>
                <td className="ics208-c3">
                  Date Prepared: <span className="ics208-value">{props.preparedDate || nbsp}</span>
                </td>
                <td className="ics208-c4">
                  Time Prepared: <span className="ics208-value">{formatMilitaryTime(props.preparedTime) || nbsp}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
