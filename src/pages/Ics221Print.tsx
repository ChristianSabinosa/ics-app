import React from 'react'
import './Ics221Print.css'

interface UnitSignoff {
  unit_name: string
  checked: boolean
  remarks: string
  name: string
  signature: string
}

interface Ics221PrintProps {
  incidentName: string
  resourceToRelease: string
  plannedReleaseDate: string
  plannedReleaseTime: string
  logisticsUnits: UnitSignoff[]
  financeUnits: UnitSignoff[]
  planningUnits: UnitSignoff[]
  operationsUnits: UnitSignoff[]
  remarks: string
  forReassignment: boolean
  reassignmentIncident: string
  reassignmentLocation: string
  roomOvernight: boolean
  etd: string
  destination: string
  travelMethod: string
  manifest: boolean
  actualReleaseDate: string
  actualReleaseTime: string
  contactDetails: string
  agencyNotified: string
  preparedByName: string
  preparedBySig: string
  preparedDate: string
  preparedTime: string
  onClose: () => void
}

const fmtTime = (t: string) => t ? t.replace(':', '') + 'H' : ''
const fmtDT = (d: string, t: string) => (!d && !t) ? '' : `${d} ${fmtTime(t)}`.trim()

export default function Ics221Print(props: Ics221PrintProps) {
  const handlePrint = () => window.print()

  const renderClearanceTable = (title: string, units: UnitSignoff[]) => (
    <React.Fragment>
      <tr>
        <td colSpan={5} className="section-header-cell">{title}</td>
      </tr>
      <tr className="sub-header-row">
        <td className="col-check"></td>
        <td className="col-unit-header">Unit/Manager</td>
        <td className="col-remarks-header">Remarks</td>
        <td className="col-name-header">Name</td>
        <td className="col-sig-header">Signature</td>
      </tr>
      {units.map((unit, i) => (
        <tr key={i}>
          <td className="check-cell">
            <span className="checkbox-mark">{unit.checked ? '\u2611' : '\u2610'}</span>
          </td>
          <td className="unit-cell">{unit.unit_name}</td>
          <td className="remarks-cell">{unit.remarks || '\u00A0'}</td>
          <td className="name-cell">{unit.name || '\u00A0'}</td>
          <td className="sig-cell">{unit.signature || '\u00A0'}</td>
        </tr>
      ))}
    </React.Fragment>
  )

  return (
    <div className="ics221-print-overlay">
      <div className="ics221-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      <div className="ics221-print-page">
        <table className="ics221-form">
          <thead>
            <tr>
              <td colSpan={4} className="header-cell">
                <div className="header-content">
                  <div className="logo-section">
                    <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
                  </div>
                  <div className="title-section">
                    <div className="main-title">DEMOBILIZATION CHECK-OUT</div>
                    <div className="form-number">ICS 221</div>
                  </div>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            {/* Row 1: Incident Name, Resource, Planned Release */}
            <tr>
              <td className="top-cell" style={{ width: '33%' }}>
                <div className="field-label">1. INCIDENT/EVENT NAME</div>
                <div className="field-value">{props.incidentName || '\u00A0'}</div>
              </td>
              <td className="top-cell" style={{ width: '33%' }}>
                <div className="field-label">2. RESOURCE TO BE RELEASED</div>
                <div className="field-value">{props.resourceToRelease || '\u00A0'}</div>
              </td>
              <td colSpan={2} className="top-cell">
                <div className="field-label">3. PLANNED RELEASE DATE AND TIME</div>
                <div className="field-value">{fmtDT(props.plannedReleaseDate, props.plannedReleaseTime) || '\u00A0'}</div>
              </td>
            </tr>

            {/* Row 2: Clearance */}
            <tr>
              <td colSpan={4} className="content-cell clearance-cell">
                <div className="field-label">4. CLEARANCE</div>
                <div className="clearance-desc">
                  You and your resources are in the process of being released. Resources are not released until the checked boxes below have been signed off by the appropriate overhead and the Demobilization Unit Leader (or Planning Section representative).
                </div>
              </td>
            </tr>

            {/* Logistics Section */}
            {renderClearanceTable('LOGISTICS SECTION', props.logisticsUnits)}

            {/* Finance Section */}
            {renderClearanceTable('FINANCE/ADMINISTRATION SECTION', props.financeUnits)}

            {/* Planning Section */}
            {renderClearanceTable('PLANNING SECTION', props.planningUnits)}

            {/* Operations Section */}
            {renderClearanceTable('OPERATIONS SECTION', props.operationsUnits)}

            {/* Row: Remarks + Reassignment + Travel */}
            <tr>
              <td colSpan={2} className="content-cell remarks-cell">
                <div className="field-label">5. REMARKS</div>
                <div className="field-textarea">{props.remarks || '\u00A0'}</div>

                <div className="field-label" style={{ marginTop: '12px' }}>6. REASSIGNMENT INFORMATION</div>
                <div className="field-value">
                  For reassignment? {props.forReassignment ? '\u2611' : '\u2610'} Yes &nbsp;
                  {!props.forReassignment ? '\u2611' : '\u2610'} No
                </div>
                <div className="field-value">Name of Incident/Event: {props.reassignmentIncident || '\u00A0'}</div>
                <div className="field-value">Location: {props.reassignmentLocation || '\u00A0'}</div>
              </td>
              <td colSpan={2} className="content-cell travel-cell">
                <div className="field-label">7. TRAVEL INFORMATION</div>
                <div className="field-value">Room overnight: {props.roomOvernight ? '\u2611' : '\u2610'} Yes &nbsp;
                  {!props.roomOvernight ? '\u2611' : '\u2610'} No</div>
                <div className="field-value">Estimated Time of Departure: {props.etd || '\u00A0'}</div>
                <div className="field-value">Destination: {props.destination || '\u00A0'}</div>
                <div className="field-value">Travel Method: {props.travelMethod || '\u00A0'}</div>
                <div className="field-value">Manifest: {props.manifest ? '\u2611' : '\u2610'} Yes &nbsp;
                  {!props.manifest ? '\u2611' : '\u2610'} No</div>
                <div className="field-value">Actual Release Date and Time: {fmtDT(props.actualReleaseDate, props.actualReleaseTime) || '\u00A0'}</div>
                <div className="field-value">Contact Details: {props.contactDetails || '\u00A0'}</div>
                <div className="field-value">Agency/Office Notified: {props.agencyNotified || '\u00A0'}</div>
              </td>
            </tr>

            {/* Prepared by */}
            <tr>
              <td colSpan={4} className="sig-cell">
                <div className="sig-row-print">
                  <div className="sig-num">8. Prepared by DMOB:</div>
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
