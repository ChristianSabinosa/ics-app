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

  return (
    <div className="ics208-print-overlay">
      <div className="ics208-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      <div className="ics208-print-page">
        <table className="ics208-form">
          <thead>
            <tr>
              <td colSpan={2} className="header-cell">
                <div className="header-content">
                  <div className="logo-section">
                    <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
                  </div>
                  <div className="title-section">
                    <div className="main-title">SAFETY MESSAGE/ PLAN</div>
                    <div className="form-number">ICS 208</div>
                  </div>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="field-cell" style={{ width: '50%' }}>
                <div className="field-label">1. INCIDENT/ EVENT NAME</div>
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
                <div className="field-label">3. SAFETY MESSAGE</div>
                <div className="field-value tall">{props.safetyMessage || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="field-cell" colSpan={2}>
                <div className="field-label">4. SITE SAFETY PLAN REQUIRED?</div>
                <div className="field-value">
                  <span className="check-item">
                    <input type="checkbox" checked={props.safetyPlanRequired === true} readOnly className="print-checkbox" /> YES
                  </span>
                  <span className="check-item">
                    <input type="checkbox" checked={props.safetyPlanRequired === false} readOnly className="print-checkbox" /> NO
                  </span>
                </div>
                <div className="field-value">
                  LOCATION OF SAFETY PLAN: {props.safetyPlanLocation || '\u00A0'}
                </div>
              </td>
            </tr>
            <tr>
              <td className="field-cell sig-cell" colSpan={2}>
                <div className="sig-row-print">
                  <div className="sig-num">5. Prepared by SOFR</div>
                  <div className="sig-field-print">
                    <span className="sig-label">Name and Signature:</span>
                    <span className="sig-value">{props.preparedByName || '\u00A0'}</span>
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
          </tbody>
        </table>
      </div>
    </div>
  )
}
