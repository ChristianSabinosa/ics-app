import { formatMilitaryTimeShort } from '../lib/utils'
import './Ics215Print.css'

interface ResourceEntry {
  identifier: string
  required: number
  have: number
  need: number
}

interface WorkAssignment {
  branch: string
  division_group: string
  work_assignment: string
  resource_type: 'Single Resource' | 'ST or TF'
  resources: ResourceEntry[]
  overhead_position: string
  special_equipment: string
  reporting_location: string
  requested_arrival_time: string
}

interface Ics215PrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  resourceIdentifiers: string[]
  workAssignments: WorkAssignment[]
  preparedBy: string
  datePrepared: string
  timePrepared: string
  onClose: () => void
}

export default function Ics215Print({
  incidentName, opFromDate, opFromTime, opToDate, opToTime,
  resourceIdentifiers, workAssignments,
  preparedBy, datePrepared, timePrepared, onClose,
}: Ics215PrintProps) {
  const handlePrint = () => window.print()

  const opFrom = `${opFromDate} ${formatMilitaryTimeShort(opFromTime)}`.trim()
  const opTo = `${opToDate} ${formatMilitaryTimeShort(opToTime)}`.trim()

  const emptyWaRows = Math.max(0, 6 - workAssignments.length)

  const computeTotals = (resourceType: 'Single Resource' | 'ST or TF', field: 'required' | 'have' | 'need') => {
    return workAssignments
      .filter(wa => wa.resource_type === resourceType)
      .reduce((sum, wa) => sum + wa.resources.reduce((s, r) => s + ((r as any)[field] || 0), 0), 0)
  }

  return (
    <div className="ics215-print-overlay">
      <div className="ics215-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="ics215-print-page">
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
                        <h1>OPERATIONAL PLANNING WORKSHEET</h1>
                        <h2>ICS 215</h2>
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

                <div className="section-title"><strong>3. RESOURCE IDENTIFIERS</strong></div>
                <div className="resource-identifiers-box">
                  {resourceIdentifiers.length > 0
                    ? resourceIdentifiers.join(', ')
                    : '\u00A0'}
                </div>

                <div className="section-title"><strong>4. WORK ASSIGNMENTS</strong></div>
                <table className="data-grid">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Division/Group</th>
                      <th>Work Assignment</th>
                      <th>Resource Type</th>
                      <th>Identifier</th>
                      <th>Required</th>
                      <th>Have</th>
                      <th>Need</th>
                      <th>Overhead Position</th>
                      <th>Special Equipment</th>
                      <th>Reporting Location</th>
                      <th>Requested Arrival</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workAssignments.map((wa, i) => (
                      wa.resources.length > 0
                        ? wa.resources.map((r, ri) => (
                          <tr key={`${i}-${ri}`}>
                            {ri === 0 && <td rowSpan={wa.resources.length}>{wa.branch}</td>}
                            {ri === 0 && <td rowSpan={wa.resources.length}>{wa.division_group}</td>}
                            {ri === 0 && <td rowSpan={wa.resources.length}>{wa.work_assignment}</td>}
                            {ri === 0 && <td rowSpan={wa.resources.length}>{wa.resource_type}</td>}
                            <td>{r.identifier}</td>
                            <td>{r.required || ''}</td>
                            <td>{r.have || ''}</td>
                            <td>{r.need || ''}</td>
                            {ri === 0 && <td rowSpan={wa.resources.length}>{wa.overhead_position}</td>}
                            {ri === 0 && <td rowSpan={wa.resources.length}>{wa.special_equipment}</td>}
                            {ri === 0 && <td rowSpan={wa.resources.length}>{wa.reporting_location}</td>}
                            {ri === 0 && <td rowSpan={wa.resources.length}>{wa.requested_arrival_time}</td>}
                          </tr>
                        ))
                        : (
                          <tr key={`${i}-0`}>
                            <td>{wa.branch}</td>
                            <td>{wa.division_group}</td>
                            <td>{wa.work_assignment}</td>
                            <td>{wa.resource_type}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>{wa.overhead_position}</td>
                            <td>{wa.special_equipment}</td>
                            <td>{wa.reporting_location}</td>
                            <td>{wa.requested_arrival_time}</td>
                          </tr>
                        )
                    ))}
                    {Array.from({ length: emptyWaRows }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        {Array.from({ length: 12 }).map((_, j) => <td key={j}>&nbsp;</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="totals-row">
                  <div className="total-cell">
                    <strong>Single Resource Totals:</strong>
                    Required: {computeTotals('Single Resource', 'required')}
                    &nbsp;&nbsp;Have: {computeTotals('Single Resource', 'have')}
                    &nbsp;&nbsp;Need: {computeTotals('Single Resource', 'need')}
                  </div>
                  <div className="total-cell">
                    <strong>ST/TF Totals:</strong>
                    Required: {computeTotals('ST or TF', 'required')}
                    &nbsp;&nbsp;Have: {computeTotals('ST or TF', 'have')}
                    &nbsp;&nbsp;Need: {computeTotals('ST or TF', 'need')}
                  </div>
                </div>

                <table className="footer-fields">
                  <tbody>
                    <tr>
                      <td className="prepared-cell">
                        <strong>5. Prepared by:</strong>&nbsp;&nbsp;
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
