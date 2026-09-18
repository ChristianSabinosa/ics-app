import './Ics214Print.css'

interface ResourceRow {
  name: string
  icsPosition: string
  agencyOffice: string
}

interface ActivityRow {
  date: string
  time: string
  notableActivities: string
}

interface Ics214PrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  name: string
  icsPosition: string
  agencyOffice: string
  resources: ResourceRow[]
  activityLog: ActivityRow[]
  preparedByName: string
  preparedBySig: string
  preparedDate: string
  preparedTime: string
  onClose: () => void
}

const fmtTime = (t: string) => t ? t.replace(':', '') + 'H' : ''
const fmtDT = (d: string, t: string) => (!d && !t) ? '' : `${d} ${fmtTime(t)}`.trim()

const MIN_ROWS = 10

export default function Ics214Print(props: Ics214PrintProps) {
  const handlePrint = () => window.print()

  const resourceRows = [...props.resources]
  while (resourceRows.length < MIN_ROWS) {
    resourceRows.push({ name: '', icsPosition: '', agencyOffice: '' })
  }

  const activityRows = [...props.activityLog]
  while (activityRows.length < MIN_ROWS) {
    activityRows.push({ date: '', time: '', notableActivities: '' })
  }

  return (
    <div className="ics214-print-overlay">
      <div className="ics214-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      <div className="ics214-print-page">
        <table className="ics214-form">
          <thead>
            <tr>
              <td colSpan={3} className="header-cell">
                <div className="header-content">
                  <div className="logo-section">
                    <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
                  </div>
                  <div className="title-section">
                    <div className="main-title">ACTIVITY LOG</div>
                    <div className="form-number">ICS 214</div>
                  </div>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            {/* Row 1: Incident Name + Operational Period */}
            <tr>
              <td colSpan={3} className="top-cell" style={{ padding: 0 }}>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: '50%', borderRight: '1px solid #000', padding: '6px 10px' }}>
                    <div className="field-label">1. INCIDENT/EVENT NAME</div>
                    <div className="field-value">{props.incidentName || '\u00A0'}</div>
                  </div>
                  <div style={{ width: '50%', padding: '6px 10px' }}>
                    <div className="field-label">2. OPERATIONAL PERIOD</div>
                    <div className="field-value">From (Date and Time): {fmtDT(props.opFromDate, props.opFromTime) || '\u00A0'}</div>
                    <div className="field-value">To (Date and Time): {fmtDT(props.opToDate, props.opToTime) || '\u00A0'}</div>
                  </div>
                </div>
              </td>
            </tr>

            {/* Row 2: Name, ICS Position, Agency/Office */}
            <tr>
              <td className="top-cell" style={{ width: '33%' }}>
                <div className="field-label">3. NAME</div>
                <div className="field-value">{props.name || '\u00A0'}</div>
              </td>
              <td className="top-cell" style={{ width: '33%' }}>
                <div className="field-label">4. ICS POSITION</div>
                <div className="field-value">{props.icsPosition || '\u00A0'}</div>
              </td>
              <td className="top-cell">
                <div className="field-label">5. AGENCY/OFFICE</div>
                <div className="field-value">{props.agencyOffice || '\u00A0'}</div>
              </td>
            </tr>

            {/* Section 6: Resources Assigned */}
            <tr>
              <td colSpan={3} className="content-cell" style={{ padding: 0 }}>
                <div className="field-label" style={{ padding: '4px 8px' }}>6. RESOURCES ASSIGNED</div>
                <table className="print-subtable">
                  <thead>
                    <tr>
                      <th style={{ width: '33.3333%' }}>Name</th>
                      <th style={{ width: '33.3333%' }}>ICS Position</th>
                      <th style={{ width: '33.3333%' }}>Agency/Office</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resourceRows.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ height: '18pt' }}>{row.name || '\u00A0'}</td>
                        <td>{row.icsPosition || '\u00A0'}</td>
                        <td>{row.agencyOffice || '\u00A0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Section 7: Activity Log */}
            <tr>
              <td colSpan={3} className="content-cell" style={{ padding: 0 }}>
                <div className="field-label" style={{ padding: '4px 8px' }}>7. ACTIVITY LOG</div>
                <table className="print-subtable">
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Date</th>
                      <th style={{ width: '12%' }}>Time</th>
                      <th>Notable Activities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityRows.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ height: '18pt' }}>{row.date || '\u00A0'}</td>
                        <td>{row.time ? fmtTime(row.time) : '\u00A0'}</td>
                        <td>{row.notableActivities || '\u00A0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Use additional sheets note */}
            <tr>
              <td colSpan={3} className="use-additional">
                Use additional sheets as needed
              </td>
            </tr>

            {/* Section 8: Prepared by */}
            <tr>
              <td className="sig-cell" colSpan={3}>
                <div className="sig-row-print">
                  <div className="sig-num">8. Prepared by (___)</div>
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
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
