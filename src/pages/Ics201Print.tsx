import OrgChart from '../components/OrgChart'
import type { OrgChartPosition } from '../components/OrgChart'
import type { Ics201ActionRow, Ics201ResourceRow } from './Ics201Form'
import './Ics201Print.css'

interface Ics201PrintProps {
  incidentName: string
  datePrepared: string
  timePrepared: string
  mapImage: string
  situationSummary: string
  objectives: string[]
  actions: Ics201ActionRow[]
  orgPositions: OrgChartPosition[]
  resources: Ics201ResourceRow[]
  preparedByName: string
  preparedBySig: string
  preparedDate: string
  preparedTime: string
  onClose: () => void
}

const fmtTime = (t: string) => t ? t.replace(':', '') + 'H' : ''

const PageHeader = ({ formNumber }: { formNumber: string }) => (
  <div className="header-content">
    <div className="logo-section">
      <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
    </div>
    <div className="title-section">
      <div className="main-title">INCIDENT BRIEFING</div>
      <div className="form-number">ICS 201-{formNumber}</div>
    </div>
  </div>
)

interface FooterProps {
  num: string
  name: string
  sig: string
  date?: string
  time?: string
}

const PageFooter = ({ num, name, sig, date, time }: FooterProps) => (
  <div className={`footer-row ${date !== undefined ? 'with-datetime' : ''}`}>
    <div className="footer-num">{num}. Prepared by IC</div>
    <div className="footer-field">
      <span className="footer-label">Name and Signature:</span>
      <span className="footer-value">{name || sig || '\u00A0'}</span>
    </div>
    {date !== undefined && (
      <>
        <div className="footer-field">
          <span className="footer-label">Date Prepared:</span>
          <span className="footer-value">{date || '\u00A0'}</span>
        </div>
        <div className="footer-field">
          <span className="footer-label">Time Prepared:</span>
          <span className="footer-value">{fmtTime(time || '') || '\u00A0'}</span>
        </div>
      </>
    )}
  </div>
)

export default function Ics201Print(props: Ics201PrintProps) {
  const handlePrint = () => window.print()

  // Pad tables so pages match the reference layout
  const actionRows: Ics201ActionRow[] = [
    ...props.actions,
    ...Array.from({ length: Math.max(0, 10 - props.actions.length) }, () => ({ date_time: '', action: '' })),
  ]

  const resourceRows: Ics201ResourceRow[] = [
    ...props.resources,
    ...Array.from({ length: Math.max(0, 20 - props.resources.length) }, () => ({ resource: '', identifier: '', requested: '', eta: '', arrived: '', remarks: '' })),
  ]

  const objectives = props.objectives.length > 0 ? props.objectives : ['']

  return (
    <div className="ics201-print-overlay">
      <div className="ics201-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      {/* ══════════ PAGE 1 — ICS 201-1 ══════════ */}
      <div className="ics201-print-page">
        <table className="ics201-form">
          <thead>
            <tr>
              <td className="header-cell"><PageHeader formNumber="1" /></td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="top-row">
                <div className="top-row-grid">
                  <div className="top-cell">
                    <div className="field-label">1. INCIDENT/EVENT NAME</div>
                    <div className="field-value">{props.incidentName || '\u00A0'}</div>
                  </div>
                  <div className="top-cell">
                    <div className="field-label">2. DATE PREPARED</div>
                    <div className="field-value">{props.datePrepared || '\u00A0'}</div>
                  </div>
                  <div className="top-cell">
                    <div className="field-label">3. TIME PREPARED</div>
                    <div className="field-value">{fmtTime(props.timePrepared) || '\u00A0'}</div>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td className="content-cell map-cell">
                <div className="section-bar">4. MAP SKETCH</div>
                <div className="section-hint">
                  (Show graphical sketch/map image of the incident/event area depicting current situation and resource assignments)
                </div>
                <div className="map-body">
                  {props.mapImage && <img src={props.mapImage} alt="Map sketch" className="map-print-img" />}
                </div>
              </td>
            </tr>
            <tr>
              <td className="content-cell situation-cell">
                <div className="section-bar">5. SITUATION SUMMARY AND HEALTH AND SAFETY BRIEFING</div>
                <div className="section-hint">
                  (For briefings or transfer of command; indicate the potential health and safety hazards recognized and the necessary
                  measures initially developed to protect responders)
                </div>
                <div className="field-textarea">{props.situationSummary || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="footer-cell">
                <PageFooter num="6" name={props.preparedByName} sig={props.preparedBySig} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ══════════ PAGE 2 — ICS 201-2 ══════════ */}
      <div className="ics201-print-page">
        <table className="ics201-form">
          <thead>
            <tr>
              <td className="header-cell"><PageHeader formNumber="2" /></td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="content-cell objectives-cell">
                <div className="section-bar">7. OBJECTIVES</div>
                <ul className="objectives-list">
                  {objectives.map((o, i) => <li key={i}>{o || '\u00A0'}</li>)}
                </ul>
              </td>
            </tr>
            <tr>
              <td className="content-cell actions-cell">
                <div className="section-bar">8. SUMMARY OF CURRENT AND PLANNED ACTIONS</div>
                <table className="print-entry-table actions-print-table">
                  <thead>
                    <tr>
                      <th className="col-datetime">DATE and TIME</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionRows.map((a, i) => (
                      <tr key={i}>
                        <td>{a.date_time || '\u00A0'}</td>
                        <td>{a.action || '\u00A0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="sheet-note">Use additional sheets as needed</div>
              </td>
            </tr>
            <tr>
              <td className="footer-cell">
                <PageFooter num="9" name={props.preparedByName} sig={props.preparedBySig} date={props.preparedDate} time={props.preparedTime} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ══════════ PAGE 3 — ICS 201-3 ══════════ */}
      <div className="ics201-print-page">
        <table className="ics201-form">
          <thead>
            <tr>
              <td className="header-cell"><PageHeader formNumber="3" /></td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="content-cell org-cell">
                <div className="section-bar">10. CURRENT ORGANIZATION</div>
                <div className="section-hint">[ fill in organization as appropriate ]</div>
                <div className="org-body">
                  <OrgChart positions={props.orgPositions} />
                </div>
              </td>
            </tr>
            <tr>
              <td className="footer-cell">
                <PageFooter num="11" name={props.preparedByName} sig={props.preparedBySig} date={props.preparedDate} time={props.preparedTime} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ══════════ PAGE 4 — ICS 201-4 ══════════ */}
      <div className="ics201-print-page">
        <table className="ics201-form">
          <thead>
            <tr>
              <td className="header-cell"><PageHeader formNumber="4" /></td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="content-cell resources-cell">
                <div className="section-bar">12. RESOURCES SUMMARY</div>
                <table className="print-entry-table resources-print-table">
                  <thead>
                    <tr>
                      <th>RESOURCE</th>
                      <th>RESOURCE<br />IDENTIFIER</th>
                      <th>DATE AND TIME<br />REQUESTED</th>
                      <th>ETA<br />(DATE AND TIME)</th>
                      <th>ARRIVED/<br />ON SCENE?</th>
                      <th>REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resourceRows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.resource || '\u00A0'}</td>
                        <td>{r.identifier || '\u00A0'}</td>
                        <td>{r.requested || '\u00A0'}</td>
                        <td>{r.eta || '\u00A0'}</td>
                        <td>{r.arrived || '\u00A0'}</td>
                        <td>{r.remarks || '\u00A0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="sheet-note">Use additional sheets as needed</div>
              </td>
            </tr>
            <tr>
              <td className="footer-cell">
                <PageFooter num="13" name={props.preparedByName} sig={props.preparedBySig} date={props.preparedDate} time={props.preparedTime} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
