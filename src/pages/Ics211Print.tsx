import { formatMilitaryTime, formatMilitaryTimeShort } from '../lib/utils'
import './Ics211Print.css'

interface Ics211PrintProps {
  incidentName: string
  startDate: string
  startTime: string
  checkinLocation: string[]
  resources: Array<{
    order_request_no: string
    checkin_datetime: string
    kind: string
    type: string
    resource_identifier_single: boolean
    resource_identifier_st: boolean
    resource_identifier_tf: boolean
    agency_name: string
    leader_name: string
    contact_details: string
    total_personnel: number
    departure_point_of_origin: string
    departure_datetime: string
    departure_method_of_travel: string
    with_manifest: boolean
    incident_assignment: string
    other_qualifications: string
    data_sent_to_resl: string
  }>
  preparedBy: string
  datePrepared: string
  timePrepared: string
  onClose: () => void
}

export default function Ics211Print({
  incidentName, startDate, startTime, checkinLocation,
  resources, preparedBy, datePrepared, timePrepared, onClose,
}: Ics211PrintProps) {
  const handlePrint = () => window.print()

  const rowsPerPage = 10
  const totalPages = Math.max(1, Math.ceil(resources.length / rowsPerPage))
  const pages = Array.from({ length: totalPages }, (_, pi) =>
    resources.slice(pi * rowsPerPage, (pi + 1) * rowsPerPage)
  )

  return (
    <div className="ics211-print-overlay">
      <div className="ics211-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={onClose}>Close</button>
      </div>

      {pages.map((pageResources, pi) => (
        <div key={pi} className="ics211-print-page">
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
                          <h1>INCIDENT CHECK-IN LIST</h1>
                          <h2>ICS 211</h2>
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
                          <span className="field-num">2.</span> <strong>START DATE AND TIME</strong>
                          <div className="field-data">Date: {startDate}</div>
                          <div className="field-data">Time: {formatMilitaryTimeShort(startTime)}</div>
                        </td>
                        <td className="field-box">
                          <span className="field-num">3.</span> <strong>CHECK-IN LOCATION</strong>
                          <div className="checkbox-print-row">
                            {['Base', 'Camp', 'Staging Area', 'ICP', 'Others'].map((loc) => (
                              <span key={loc} className="print-checkbox">
                                {checkinLocation.includes(loc) ? '☑' : '☐'} {loc}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="section-title"><strong>4. CHECK-IN INFORMATION</strong></div>

                  <table className="data-grid">
                    <thead>
                      <tr>
                        <th>Order/<br/>Request No.</th>
                        <th>Check-In<br/>Date and<br/>Time</th>
                        <th>Kind</th>
                        <th>Type</th>
                        <th className="ri-header">
                          Resource<br/>Identifier<br/>
                          <span className="ri-sub">Single | ST | TF</span>
                        </th>
                        <th>Name of<br/>Agency /<br/>Office /<br/>Home Base</th>
                        <th>Name of<br/>Leader</th>
                        <th>Contact<br/>Details</th>
                        <th>Total<br/>No. of<br/>Pers.</th>
                        <th className="dep-header">
                          Departure Details<br/>
                          <span className="dep-sub">Origin | Date/Time | Method</span>
                        </th>
                        <th>With<br/>Manifest?</th>
                        <th>Incident<br/>Assignment</th>
                        <th>Other<br/>Qualifi-<br/>cations</th>
                        <th>Data<br/>Sent to<br/>RESL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageResources.map((r, i) => (
                        <tr key={i}>
                          <td>{r.order_request_no}</td>
                          <td>{r.checkin_datetime ? formatMilitaryTime(r.checkin_datetime) : ''}</td>
                          <td>{r.kind}</td>
                          <td>{r.type}</td>
                          <td className="ri-cell">
                            {r.resource_identifier_single && <span>Single</span>}
                            {r.resource_identifier_st && <span>ST</span>}
                            {r.resource_identifier_tf && <span>TF</span>}
                          </td>
                          <td>{r.agency_name}</td>
                          <td>{r.leader_name}</td>
                          <td>{r.contact_details}</td>
                          <td className="num-cell">{r.total_personnel || ''}</td>
                          <td className="dep-cell">
                            {r.departure_point_of_origin} {r.departure_datetime ? formatMilitaryTime(r.departure_datetime) : ''} {r.departure_method_of_travel}
                          </td>
                          <td className="bool-cell">{r.with_manifest ? 'Yes' : 'No'}</td>
                          <td>{r.incident_assignment}</td>
                          <td>{r.other_qualifications}</td>
                          <td>{r.data_sent_to_resl ? formatMilitaryTime(r.data_sent_to_resl) : ''}</td>
                        </tr>
                      ))}
                      {Array.from({ length: Math.max(0, rowsPerPage - pageResources.length) }).map((_, i) => (
                        <tr key={`empty-${i}`}>
                          {Array.from({ length: 14 }).map((_, j) => <td key={j}>&nbsp;</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="use-additional">Use additional sheets as needed</div>

                  <table className="footer-fields">
                    <tbody>
                      <tr>
                        <td className="page-cell">Page {pi + 1} of {totalPages}</td>
                        <td className="prepared-cell">
                          <strong>5. Prepared by (_____)</strong>&nbsp;&nbsp;
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
      ))}
    </div>
  )
}
