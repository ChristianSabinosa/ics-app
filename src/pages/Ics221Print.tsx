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

const EMPTY_ROWS: number[] = []

export default function Ics221Print(props: Ics221PrintProps) {
  const handlePrint = () => window.print()

  const renderClearanceSection = (
    title: string,
    units: UnitSignoff[],
    extraEmptyRows: number[] = EMPTY_ROWS,
  ) => (
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
      {units.map((unit, i) => (
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
      {extraEmptyRows.map((_, i) => (
        <tr key={`empty-${i}`}>
          <td colSpan={2} className="unit-cell">&nbsp;</td>
          <td colSpan={2} className="remarks-cell">&nbsp;</td>
          <td colSpan={3} className="name-cell">&nbsp;</td>
          <td colSpan={2} className="sig-cell">&nbsp;</td>
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
            {renderClearanceSection('LOGISTICS SECTION', props.logisticsUnits, [0, 0])}

            {/* Finance Section */}
            {renderClearanceSection('FINANCE/ADMINISTRATION SECTION', props.financeUnits, [0, 0, 0])}

            {/* Planning Section */}
            {renderClearanceSection('PLANNING SECTION', props.planningUnits, [0, 0])}

            {/* Operations Section */}
            {renderClearanceSection('OPERATIONS SECTION', props.operationsUnits, [0, 0])}

            {/* R33-37: Remarks (left) + Travel Information (right) */}
            <tr>
              <td colSpan={5} rowSpan={5} className="content-cell remarks-cell">
                <div className="field-label">5. REMARKS</div>
                <div className="field-textarea">{props.remarks || '\u00A0'}</div>
              </td>
              <td colSpan={4} className="content-cell travel-label-cell">
                <div className="field-label">7. TRAVEL INFORMATION</div>
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="content-cell travel-cell">
                <div className="field-value">Room overnight: ___Yes ___No</div>
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="content-cell travel-cell">
                <div className="field-value">Estimated Time of Departure: _____</div>
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="content-cell travel-cell">
                <div className="field-value">Destination: ________________________</div>
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="content-cell travel-cell">
                <div className="field-value">Travel Method: _____________________</div>
              </td>
            </tr>

            {/* R38-39: Reassignment + remaining travel */}
            <tr>
              <td colSpan={5} rowSpan={4} className="content-cell remarks-cell">
                <div className="field-label">6. REASSIGNMENT INFORMATION</div>
                <div className="field-value">For reassignment? ___Yes ___No</div>
                <div className="field-value">Name of Incident/Event______________</div>
                <div className="field-value">Location: _________________________</div>
              </td>
              <td colSpan={4} className="content-cell travel-cell">
                <div className="field-value">Manifest: ___Yes ___No</div>
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="content-cell travel-cell">
                <div className="field-value">Actual Release Date and Time: _____</div>
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="content-cell travel-cell">
                <div className="field-value">Contact Details: ________________</div>
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="content-cell travel-cell">
                <div className="field-value">Agency/Office Notified: ___________</div>
              </td>
            </tr>

            {/* R42: Prepared by DMOB */}
            <tr>
              <td colSpan={3} className="sig-cell-content">
                <div className="sig-num">8. Prepared by DMOB:</div>
                <div className="sig-field-print">
                  <span className="sig-label">Name and Signature:</span>
                  <span className="sig-value">{props.preparedByName || props.preparedBySig || '\u00A0'}</span>
                </div>
              </td>
              <td colSpan={3} className="sig-cell-content">
                <div className="sig-field-print">
                  <span className="sig-label">Date Prepared:</span>
                  <span className="sig-value">{props.preparedDate || '\u00A0'}</span>
                </div>
              </td>
              <td colSpan={3} className="sig-cell-content">
                <div className="sig-field-print">
                  <span className="sig-label">Time Prepared:</span>
                  <span className="sig-value">{fmtTime(props.preparedTime) || '\u00A0'}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
