import { formatMilitaryTimeShort } from '../lib/utils'
import './Ics206Print.css'

interface Ics206PrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  aidStations: Array<{
    name: string
    location: string
    contact_person: string
    contact_numbers: string
    remarks: string
    with_paramedics: boolean
  }>
  ambulances: Array<{
    name: string
    location: string
    contact_person: string
    contact_numbers: string
    remarks: string
    level_of_service: string
  }>
  hospitals: Array<{
    name: string
    location: string
    contact_person: string
    contact_numbers: string
    travel_time_air: string
    travel_time_land: string
    with_trauma_center: boolean
    with_burn_center: boolean
    with_helipad: boolean
  }>
  medicalEmergencyProcedures: string
  aviationAssetsUsed: boolean
  preparedBy: string
  datePrepared: string
  timePrepared: string
  reviewedBy: string
  dateReviewed: string
  timeReviewed: string
  onClose: () => void
}

export default function Ics206Print({
  incidentName, opFromDate, opFromTime, opToDate, opToTime,
  aidStations, ambulances, hospitals,
  medicalEmergencyProcedures, aviationAssetsUsed,
  preparedBy, datePrepared, timePrepared,
  reviewedBy, dateReviewed, timeReviewed, onClose,
}: Ics206PrintProps) {
  const handlePrint = () => window.print()

  const emptyAidRows = Math.max(0, 5 - aidStations.length)
  const emptyAmbRows = Math.max(0, 5 - ambulances.length)
  const emptyHospRows = Math.max(0, 5 - hospitals.length)
  const opFrom = `${opFromDate} ${formatMilitaryTimeShort(opFromTime)}`.trim()
  const opTo = `${opToDate} ${formatMilitaryTimeShort(opToTime)}`.trim()

  return (
    <div className="ics206-print-overlay">
      <div className="ics206-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="ics206-print-page">
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
                        <h1>MEDICAL PLAN</h1>
                        <h2>ICS 206</h2>
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

                <div className="section-title"><strong>3. MEDICAL AID STATIONS</strong></div>
                <table className="data-grid">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Location</th>
                      <th>Contact Person</th>
                      <th>Contact Number(s)</th>
                      <th colSpan={2}>With Paramedics?</th>
                      <th>Remarks</th>
                    </tr>
                    <tr className="sub-header">
                      <th colSpan={4}></th>
                      <th>Yes</th>
                      <th>No</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {aidStations.map((a, i) => (
                      <tr key={i}>
                        <td>{a.name}</td>
                        <td>{a.location}</td>
                        <td>{a.contact_person}</td>
                        <td>{a.contact_numbers}</td>
                        <td className="check-cell">{a.with_paramedics ? 'X' : ''}</td>
                        <td className="check-cell">{!a.with_paramedics ? 'X' : ''}</td>
                        <td>{a.remarks}</td>
                      </tr>
                    ))}
                    {Array.from({ length: emptyAidRows }).map((_, i) => (
                      <tr key={`empty-aid-${i}`}>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="section-title"><strong>4. AMBULANCE/ MEDICAL TRANSPORTATION SERVICES</strong></div>
                <table className="data-grid">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Location</th>
                      <th>Contact Person</th>
                      <th>Contact Number(s)</th>
                      <th colSpan={2}>Level of Service</th>
                      <th>Remarks</th>
                    </tr>
                    <tr className="sub-header">
                      <th colSpan={4}></th>
                      <th>BLS</th>
                      <th>ALS</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ambulances.map((a, i) => (
                      <tr key={i}>
                        <td>{a.name}</td>
                        <td>{a.location}</td>
                        <td>{a.contact_person}</td>
                        <td>{a.contact_numbers}</td>
                        <td className="check-cell">{a.level_of_service === 'BLS' ? 'X' : ''}</td>
                        <td className="check-cell">{a.level_of_service === 'ALS' ? 'X' : ''}</td>
                        <td>{a.remarks}</td>
                      </tr>
                    ))}
                    {Array.from({ length: emptyAmbRows }).map((_, i) => (
                      <tr key={`empty-amb-${i}`}>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="section-title"><strong>5. HOSPITALS</strong></div>
                <table className="data-grid">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Location</th>
                      <th>Contact Person</th>
                      <th>Contact Number(s)</th>
                      <th colSpan={2}>Travel Time</th>
                      <th colSpan={2}>With Trauma Center?</th>
                      <th colSpan={2}>With Burn Center?</th>
                      <th colSpan={2}>With Helipad?</th>
                    </tr>
                    <tr className="sub-header">
                      <th colSpan={4}></th>
                      <th>Air</th>
                      <th>Land</th>
                      <th>Yes</th>
                      <th>No</th>
                      <th>Yes</th>
                      <th>No</th>
                      <th>Yes</th>
                      <th>No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospitals.map((h, i) => (
                      <tr key={i}>
                        <td>{h.name}</td>
                        <td>{h.location}</td>
                        <td>{h.contact_person}</td>
                        <td>{h.contact_numbers}</td>
                        <td className="check-cell">{h.travel_time_air}</td>
                        <td className="check-cell">{h.travel_time_land}</td>
                        <td className="check-cell">{h.with_trauma_center ? 'X' : ''}</td>
                        <td className="check-cell">{!h.with_trauma_center ? 'X' : ''}</td>
                        <td className="check-cell">{h.with_burn_center ? 'X' : ''}</td>
                        <td className="check-cell">{!h.with_burn_center ? 'X' : ''}</td>
                        <td className="check-cell">{h.with_helipad ? 'X' : ''}</td>
                        <td className="check-cell">{!h.with_helipad ? 'X' : ''}</td>
                      </tr>
                    ))}
                    {Array.from({ length: emptyHospRows }).map((_, i) => (
                      <tr key={`empty-hosp-${i}`}>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="section-title"><strong>6. MEDICAL EMERGENCY PROCEDURES</strong></div>
                <div className="procedures-box">{medicalEmergencyProcedures || '\u00A0'}</div>
                <div className="aviation-line">
                  {aviationAssetsUsed ? 'X' : '___'} Check if aviation assets are utilized for rescue. If assets are used, coordinate with Air Operations Branch.
                </div>

                <table className="footer-fields">
                  <tbody>
                    <tr>
                      <td className="footer-label-cell"><strong>7. Prepared by MEDL</strong></td>
                      <td className="prepared-cell">Name and Signature: {preparedBy}</td>
                      <td className="date-cell">Date Prepared: {datePrepared}</td>
                      <td className="time-cell">Time Prepared: {formatMilitaryTimeShort(timePrepared)}</td>
                    </tr>
                    <tr>
                      <td className="footer-label-cell"><strong>8. Reviewed by SOFR</strong></td>
                      <td className="prepared-cell">Name and Signature: {reviewedBy}</td>
                      <td className="date-cell">Date Reviewed: {dateReviewed}</td>
                      <td className="time-cell">Time Reviewed: {formatMilitaryTimeShort(timeReviewed)}</td>
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
