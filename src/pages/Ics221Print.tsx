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

  const renderClearanceSection = (
    title: string,
    units: UnitSignoff[],
  ) => {
    // Skip untouched blank custom rows; fixed rows always print.
    const rows = units.filter(u =>
      u.unit_name.trim() !== '' || u.checked || u.remarks.trim() !== '' || u.name.trim() !== '' || u.signature.trim() !== '',
    )
    return (
    <React.Fragment>
      <tr>
        <td colSpan={9} className="section-header-cell">{title}</td>
      </tr>
      <tr className="sub-header-row">
        <td colSpan={2} className="col-unit-header">Unit/Manager</td>
        <td colSpan={2} className="col-remarks-header">Remarks</td>
        <td colSpan={3} className="col-name-header">Name</td>
        <td colSpan={2} className="col-sig-header">Signature</td>
      </tr>
      {rows.map((unit, i) => (
        <tr key={i}>
          <td colSpan={2} className="unit-cell">
            <span className="checkbox-mark">{unit.checked ? '\u2611 ' : '\u2610 '}</span>
            {unit.unit_name}
          </td>
          <td colSpan={2} className="remarks-cell">{unit.remarks || '\u00A0'}</td>
          <td colSpan={3} className="name-cell">{unit.name || '\u00A0'}</td>
          <td colSpan={2} className="sig-cell">{unit.signature || '\u00A0'}</td>
        </tr>
      ))}
    </React.Fragment>
    )
  }

  return (
    <div className="ics221-print-overlay">
      <div className="ics221-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      <div className="ics221-print-page">
        <table className="ics221-form">
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '7%' }} />
          </colgroup>
          <thead>
            {/* R0: Header - Logo + Title merged across all columns */}
            <tr>
              <td colSpan={9} className="header-cell">
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
            {/* R1: Incident Name, Resource, Planned Release */}
            <tr>
              <td colSpan={3} className="top-cell">
                <div className="field-label">1. INCIDENT/EVENT NAME</div>
                <div className="field-value">{props.incidentName || '\u00A0'}</div>
              </td>
              <td colSpan={3} className="top-cell">
                <div className="field-label">2. RESOURCES TO BE RELEASED</div>
                <div className="field-value">{props.resourceToRelease || '\u00A0'}</div>
              </td>
              <td colSpan={3} className="top-cell">
                <div className="field-label">3. PLANNED RELEASED DATE AND TIME</div>
                <div className="field-value">{fmtDT(props.plannedReleaseDate, props.plannedReleaseTime) || '\u00A0'}</div>
              </td>
            </tr>

            {/* R3: Clearance description */}
            <tr>
              <td colSpan={9} className="content-cell clearance-cell">
                <div className="field-label">4. CLEARANCE:</div>
                <div className="clearance-inline">You and your resources are in the process of being released.  Resources are not released until the checked boxes below have been signed off by the appropriate overhead and the Demobilization Unit Leader (or Planning Section representative)</div>
              </td>
            </tr>

            {/* Logistics Section */}
            {renderClearanceSection('LOGISTICS SECTION', props.logisticsUnits)}

            {/* Finance Section */}
            {renderClearanceSection('FINANCE/ADMINISTRATION SECTION', props.financeUnits)}

            {/* Planning Section */}
            {renderClearanceSection('PLANNING SECTION', props.planningUnits)}

            {/* Operations Section */}
            {renderClearanceSection('OPERATIONS SECTION', props.operationsUnits)}

            {/* R33-41: Remarks + Reassignment (left) / Travel Information (right) */}
            <tr>
              <td colSpan={5} className="content-cell left-stack-cell">
                <div className="remarks-box">
                  <div className="field-label">5. REMARKS</div>
                  <div className="field-textarea">{props.remarks || '\u00A0'}</div>
                </div>
                <div className="reassign-box">
                  <div className="field-label">6. REASSIGNMENT INFORMATION</div>
                  <div className="field-value">For reassignment? {props.forReassignment ? '\u2611' : '\u2610'} Yes {props.forReassignment ? '\u2610' : '\u2611'} No</div>
                  <div className="field-value">Name of Incident/Event: {props.reassignmentIncident || '________________________'}</div>
                  <div className="field-value">Location: {props.reassignmentLocation || '________________________'}</div>
                </div>
              </td>
              <td colSpan={4} className="content-cell travel-box-cell">
                <div className="field-label">7. TRAVEL INFORMATION</div>
                <div className="field-value">Room overnight: {props.roomOvernight ? '\u2611' : '\u2610'} Yes {props.roomOvernight ? '\u2610' : '\u2611'} No</div>
                <div className="field-value">Estimated Time of Departure: {props.etd || '________________________'}</div>
                <div className="field-value">Destination: {props.destination || '________________________'}</div>
                <div className="field-value">Travel Method: {props.travelMethod || '______________________'}</div>
                <div className="field-value">Manifest: {props.manifest ? '\u2611' : '\u2610'} Yes {props.manifest ? '\u2610' : '\u2611'} No</div>
                <div className="field-value">Actual Release Date and Time: {fmtDT(props.actualReleaseDate, props.actualReleaseTime) || '_______________'}</div>
                <div className="field-value">Contact Details: {props.contactDetails || '_______________________'}</div>
                <div className="field-value">Agency/Office Notified: {props.agencyNotified || '___________________'}</div>
              </td>
            </tr>

            {/* R42: Prepared by DMOB */}
            <tr>
              <td colSpan={2} className="sig-cell-content sig-inline-cell"><strong>8. Prepared by DMOB</strong></td>
              <td colSpan={3} className="sig-cell-content sig-inline-cell">Name and Signature: {props.preparedByName || props.preparedBySig || '\u00A0'}</td>
              <td colSpan={2} className="sig-cell-content sig-inline-cell">Date Prepared: {props.preparedDate || '\u00A0'}</td>
              <td colSpan={2} className="sig-cell-content sig-inline-cell">Time Prepared: {fmtTime(props.preparedTime) || '\u00A0'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
