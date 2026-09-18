import './Ics209Print.css'

interface ClusterRow {
  cluster: string
  status: string
}

interface StatusRow {
  description: string
  opPeriod: string
  totalCases: string
  casesResponded: string
  totalResponded: string
  remaining: string
  remarks: string
}

interface ResourceRow {
  agency: string
  kind: string
  number: string
  additionalPersonnel: string
  totalPersonnel: string
  remarks: string
}

export interface Ics209PrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  reportNo: number
  reportType: string
  preparedByName: string
  preparedBySig: string
  preparedDate: string
  preparedTime: string
  approvedByName: string
  approvedBySig: string
  approvedDate: string
  approvedTime: string
  generalDescription: string
  policyGuidance: string
  objectives: string
  addressLocation: string
  jurisdiction: string
  gpsCoordinates: string
  landmarks: string
  significantEvents: string
  clusterAssessment: ClusterRow[]
  publicStatus: StatusRow[]
  respondersStatus: StatusRow[]
  threatManagement: Record<string, boolean>
  threatOthers: boolean
  threatOthersText: string
  weatherConcerns: string
  escalation12h: string
  escalation24h: string
  escalation48h: string
  escalation72h: string
  escalationAfter72h: string
  threatsRisk12h: string
  threatsRisk24h: string
  threatsRisk48h: string
  threatsRisk72h: string
  threatsRiskAfter72h: string
  criticalResources12h: string
  criticalResources24h: string
  criticalResources48h: string
  criticalResources72h: string
  criticalResourcesAfter72h: string
  plannedActions: string
  otherConcerns: string
  anticipatedCosts: string
  projectedCosts: string
  resources: ResourceRow[]
  assistingAgencies: string[]
  onClose: () => void
}

const fmtTime = (t: string) => t ? t.replace(':', '') + 'H' : ''
const fmtDT = (d: string, t: string) => (!d && !t) ? '' : `${d} ${fmtTime(t)}`.trim()
const CB = (v: boolean) => v ? '\u2611' : '\u2610'

const THREAT_CHECKBOXES = [
  'No likely threat',
  'Potential Future Threat',
  'Mass notification in progress',
  'Mass notification completed',
  'No evacuation imminent',
  'Planning for evacuation',
  'Evacuation in progress',
  'Planning for shelter-in-place',
  'Shelter-in-place in progress',
  'Repopulation in progress',
  'Mass immunization in progress',
  'Mass immunization complete',
  'Quarantine in progress',
  'Area restriction in effect',
]

export default function Ics209Print(props: Ics209PrintProps) {
  const handlePrint = () => window.print()
  const totalResources = props.resources.reduce((sum, r) => sum + (parseInt(r.totalPersonnel) || 0), 0)

  return (
    <div className="ics209-print-overlay">
      <div className="ics209-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      <div className="ics209-print-page">
        <table className="ics209-form">
          <thead>
            <tr>
              <td colSpan={3} className="header-cell">
                <div className="header-content">
                  <div className="logo-section">
                    <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
                  </div>
                  <div className="title-section">
                    <div className="main-title">INCIDENT STATUS SUMMARY</div>
                    <div className="form-number">ICS 209</div>
                  </div>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            {/* Row 1: Incident Name, Operational Period, Report No */}
            <tr>
              <td className="top-cell" style={{ width: '33%' }}>
                <div className="field-label">1. INCIDENT/ EVENT NAME</div>
                <div className="field-value">{props.incidentName || '\u00A0'}</div>
              </td>
              <td className="top-cell" style={{ width: '38%' }}>
                <div className="field-label">2. OPERATIONAL PERIOD</div>
                <div className="field-value">From (Date and Time): {fmtDT(props.opFromDate, props.opFromTime) || '\u00A0'}</div>
                <div className="field-value">To (Date and Time): {fmtDT(props.opToDate, props.opToTime) || '\u00A0'}</div>
              </td>
              <td className="top-cell" style={{ width: '29%' }}>
                <div className="field-label">3. REPORT NO {String(props.reportNo).padStart(3, '0')}</div>
                <div className="field-value" style={{ marginTop: 4 }}>
                  {CB(props.reportType === 'Initial')} Initial &nbsp;&nbsp;
                  {CB(props.reportType === 'Update')} Update &nbsp;&nbsp;
                  {CB(props.reportType === 'Final')} Final
                </div>
              </td>
            </tr>

            {/* Row 2-3: Prepared by / Approved by */}
            <tr>
              <td className="sig-cell" colSpan={3}>
                <div className="sig-row-print">
                  <div className="sig-num">4. PREPARED BY SITL</div>
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
                  <div className="sig-num">5. APPROVED BY IC</div>
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

            {/* Section 6: Incident/Event Details */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">6. INCIDENT/EVENT DETAILS</div>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">General Description of the Incident/Event</div>
                <div className="field-textarea">{props.generalDescription || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Policy Guidance from the Responsible Official</div>
                <div className="field-textarea">{props.policyGuidance || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Objectives for the Operational Period</div>
                <div className="field-textarea">{props.objectives || '\u00A0'}</div>
              </td>
            </tr>

            {/* Section 7: Location */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">7. INCIDENT/EVENT LOCATION INFORMATION</div>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Address/Location</div>
                <div className="field-value">{props.addressLocation || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="content-cell" style={{ width: '33%' }}>
                <div className="field-label">Jurisdiction</div>
                <div className="field-value">{props.jurisdiction || '\u00A0'}</div>
              </td>
              <td className="content-cell" style={{ width: '33%' }}>
                <div className="field-label">GPS Coordinates (if any)</div>
                <div className="field-value">{props.gpsCoordinates || '\u00A0'}</div>
              </td>
              <td className="content-cell" style={{ width: '34%' }}>
                <div className="field-label">Landmarks</div>
                <div className="field-value">{props.landmarks || '\u00A0'}</div>
              </td>
            </tr>

            {/* Section 8: Summary */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">8. INCIDENT/EVENT SUMMARY</div>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Significant Events during the Operational Period:</div>
                <div className="field-textarea">{props.significantEvents || '\u00A0'}</div>
              </td>
            </tr>

            {/* Cluster Assessment */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Cluster Assessment (Fill as appropriate):</div>
                <table className="print-subtable">
                  <thead>
                    <tr>
                      <th style={{ width: '50%' }}>Cluster</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.clusterAssessment.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.cluster || '\u00A0'}</td>
                        <td>{row.status || '\u00A0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Public Status Summary */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Public Status Summary</div>
                <table className="print-subtable">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>No of cases for this operational period</th>
                      <th>Total cases</th>
                      <th>No of cases responded</th>
                      <th>Total cases responded</th>
                      <th>Remaining cases</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.publicStatus.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.description || '\u00A0'}</td>
                        <td>{row.opPeriod || '\u00A0'}</td>
                        <td>{row.totalCases || '\u00A0'}</td>
                        <td>{row.casesResponded || '\u00A0'}</td>
                        <td>{row.totalResponded || '\u00A0'}</td>
                        <td>{row.remaining || '\u00A0'}</td>
                        <td>{row.remarks || '\u00A0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Responders Status Summary */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Responders Status Summary</div>
                <table className="print-subtable">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>No of cases for this operational period</th>
                      <th>Total Cases</th>
                      <th>No of cases responded</th>
                      <th>Total cases responded</th>
                      <th>Remaining cases</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.respondersStatus.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.description || '\u00A0'}</td>
                        <td>{row.opPeriod || '\u00A0'}</td>
                        <td>{row.totalCases || '\u00A0'}</td>
                        <td>{row.casesResponded || '\u00A0'}</td>
                        <td>{row.totalResponded || '\u00A0'}</td>
                        <td>{row.remaining || '\u00A0'}</td>
                        <td>{row.remarks || '\u00A0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Life, Safety and Health Threat Management */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Life, Safety and Health Threat Management (Check if active)</div>
                <div className="checkbox-print-grid">
                  {THREAT_CHECKBOXES.map(cb => (
                    <div key={cb} className="checkbox-print-item">
                      <span className="checkbox-mark">{CB(props.threatManagement[cb] || false)}</span>
                      <span>{cb}</span>
                    </div>
                  ))}
                  <div className="checkbox-print-item">
                    <span className="checkbox-mark">{CB(props.threatOthers)}</span>
                    <span>Others - specify: {props.threatOthersText || '\u00A0'}</span>
                  </div>
                </div>
              </td>
            </tr>

            {/* Weather Concerns */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Weather Concerns</div>
                <div className="field-textarea" style={{ minHeight: 30 }}>{props.weatherConcerns || '\u00A0'}</div>
              </td>
            </tr>

            {/* Potential Incident Escalation */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Potential Incident Escalation</div>
              </td>
            </tr>
            <tr>
              <td className="timeframe-cell" style={{ width: '20%' }}>
                <span className="timeframe-label">12 hours:</span>
              </td>
              <td colSpan={2} className="content-cell">
                <div className="timeframe-value">{props.escalation12h || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="timeframe-cell">
                <span className="timeframe-label">24 hours:</span>
              </td>
              <td colSpan={2} className="content-cell">
                <div className="timeframe-value">{props.escalation24h || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="timeframe-cell">
                <span className="timeframe-label">48 hours:</span>
              </td>
              <td colSpan={2} className="content-cell">
                <div className="timeframe-value">{props.escalation48h || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="timeframe-cell">
                <span className="timeframe-label">72 hours:</span>
              </td>
              <td colSpan={2} className="content-cell">
                <div className="timeframe-value">{props.escalation72h || '\u00A0'}</div>
              </td>
            </tr>
            <tr>
              <td className="timeframe-cell">
                <span className="timeframe-label">After 72 hours:</span>
              </td>
              <td colSpan={2} className="content-cell">
                <div className="timeframe-value">{props.escalationAfter72h || '\u00A0'}</div>
              </td>
            </tr>

            {/* Section 9: Decision Support */}
            <tr>
              <td colSpan={3} className="section-divider" style={{ textAlign: 'center' }}>
                9. ADDITIONAL INCIDENT/EVENT DECISION SUPPORT
              </td>
            </tr>

            {/* Threats and Risk Information */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Threats and Risk Information</div>
              </td>
            </tr>
            <tr>
              <td className="timeframe-cell"><span className="timeframe-label">12 hours:</span></td>
              <td colSpan={2} className="content-cell"><div className="timeframe-value">{props.threatsRisk12h || '\u00A0'}</div></td>
            </tr>
            <tr>
              <td className="timeframe-cell"><span className="timeframe-label">24 hours:</span></td>
              <td colSpan={2} className="content-cell"><div className="timeframe-value">{props.threatsRisk24h || '\u00A0'}</div></td>
            </tr>
            <tr>
              <td className="timeframe-cell"><span className="timeframe-label">48 hours:</span></td>
              <td colSpan={2} className="content-cell"><div className="timeframe-value">{props.threatsRisk48h || '\u00A0'}</div></td>
            </tr>
            <tr>
              <td className="timeframe-cell"><span className="timeframe-label">72 hours:</span></td>
              <td colSpan={2} className="content-cell"><div className="timeframe-value">{props.threatsRisk72h || '\u00A0'}</div></td>
            </tr>
            <tr>
              <td className="timeframe-cell"><span className="timeframe-label">After 72 hours:</span></td>
              <td colSpan={2} className="content-cell"><div className="timeframe-value">{props.threatsRiskAfter72h || '\u00A0'}</div></td>
            </tr>

            {/* Critical Resource Needs */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Critical Resource Needs</div>
              </td>
            </tr>
            <tr>
              <td className="timeframe-cell"><span className="timeframe-label">12 hours:</span></td>
              <td colSpan={2} className="content-cell"><div className="timeframe-value">{props.criticalResources12h || '\u00A0'}</div></td>
            </tr>
            <tr>
              <td className="timeframe-cell"><span className="timeframe-label">24 hours:</span></td>
              <td colSpan={2} className="content-cell"><div className="timeframe-value">{props.criticalResources24h || '\u00A0'}</div></td>
            </tr>
            <tr>
              <td className="timeframe-cell"><span className="timeframe-label">48 hours:</span></td>
              <td colSpan={2} className="content-cell"><div className="timeframe-value">{props.criticalResources48h || '\u00A0'}</div></td>
            </tr>
            <tr>
              <td className="timeframe-cell"><span className="timeframe-label">72 hours:</span></td>
              <td colSpan={2} className="content-cell"><div className="timeframe-value">{props.criticalResources72h || '\u00A0'}</div></td>
            </tr>
            <tr>
              <td className="timeframe-cell"><span className="timeframe-label">After 72 hours:</span></td>
              <td colSpan={2} className="content-cell"><div className="timeframe-value">{props.criticalResourcesAfter72h || '\u00A0'}</div></td>
            </tr>

            {/* Planned Actions */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Planned Actions For Next Operational Period</div>
                <div className="field-textarea" style={{ minHeight: 60 }}>{props.plannedActions || '\u00A0'}</div>
              </td>
            </tr>

            {/* Other Concerns */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="field-label">Other Concerns</div>
                <div className="field-textarea" style={{ minHeight: 60 }}>{props.otherConcerns || '\u00A0'}</div>
              </td>
            </tr>

            {/* Costs */}
            <tr>
              <td colSpan={3} className="content-cell" style={{ padding: 0 }}>
                <div className="costs-row-print">
                  <div className="costs-cell">
                    <div className="field-label">Anticipated Incident Costs to Date</div>
                    <div className="field-value" style={{ minHeight: 30 }}>{props.anticipatedCosts || '\u00A0'}</div>
                  </div>
                  <div className="costs-cell">
                    <div className="field-label">Projected Final Incident Cost Estimate</div>
                    <div className="field-value" style={{ minHeight: 30 }}>{props.projectedCosts || '\u00A0'}</div>
                  </div>
                </div>
              </td>
            </tr>

            {/* Section 10: Resource Summary */}
            <tr>
              <td colSpan={3} className="section-divider" style={{ textAlign: 'center' }}>
                10. RESOURCE SUMMARY
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="content-cell" style={{ padding: 0 }}>
                <table className="print-subtable">
                  <thead>
                    <tr>
                      <th>Agency/ Office</th>
                      <th>Kind</th>
                      <th>Number</th>
                      <th>Additional personnel not assigned to a resource</th>
                      <th>Total Personnel</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.resources.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.agency || '\u00A0'}</td>
                        <td>{row.kind || '\u00A0'}</td>
                        <td>{row.number || '\u00A0'}</td>
                        <td>{row.additionalPersonnel || '\u00A0'}</td>
                        <td>{row.totalPersonnel || '\u00A0'}</td>
                        <td>{row.remarks || '\u00A0'}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 700 }}>Total Resources</td>
                      <td style={{ fontWeight: 700 }}>{totalResources || '\u00A0'}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Section 11: Assisting Agencies */}
            <tr>
              <td colSpan={3} className="section-divider" style={{ textAlign: 'center' }}>
                11. LIST OF ASSISTING AND COOPERATING AGENCIES
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="content-cell">
                {props.assistingAgencies.filter(a => a).map((agency, idx) => (
                  <div key={idx} style={{ marginBottom: 4 }}>{idx + 1}. {agency}</div>
                ))}
                {props.assistingAgencies.filter(a => a).length === 0 && '\u00A0'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
