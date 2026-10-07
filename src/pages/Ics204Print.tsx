import { OPS_POSITIONS, emptyResourceRow } from '../lib/ics204'
import type { Ics204RowInput } from '../lib/ics204'
import type { Ics204CommsRow, Ics204OpsPerson } from '../lib/types'
import './Ics204Print.css'

interface Ics204PrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  branch: string
  groupName: string
  division: string
  stagingArea: string
  opsPersonnel: Ics204OpsPerson[]
  resourceRows: Ics204RowInput[]
  specificWorkAssignment: string
  specialInstructions: string
  comms: Ics204CommsRow[]
  preparedByName: string
  preparedBySig: string
  preparedDate: string
  preparedTime: string
  onClose: () => void
}

const fmtTime = (t: string) => (t ? t.replace(':', '') + 'H' : '')
const fmtDT = (d: string, t: string) => {
  if (!d && !t) return ''
  return `${d} ${fmtTime(t)}`.trim()
}

const NBSP = '\u00A0'

const rowHasContent = (r: Ics204RowInput) =>
  r.trans_needed ||
  r.resource_identifier || r.leader_name || r.contact_numbers ||
  r.personnel || r.drop_off || r.pick_up_time || r.remarks

const commsHasContent = (c: Ics204CommsRow) =>
  c.function || c.system || c.channel || c.frequency || c.others

const MIN_RESOURCE_ROWS = 5
const MIN_COMMS_ROWS = 5

export default function Ics204Print(props: Ics204PrintProps) {
  const handlePrint = () => window.print()

  // Section 4: the five fixed positions, in printed order
  const opsRows = OPS_POSITIONS.map((position) => {
    const p = props.opsPersonnel.find((o) => o.position === position)
    return { position, name: p?.name || '', contact: p?.contact || '' }
  })

  // Section 5: filled rows first, padded to the printed minimum
  const filledResources = props.resourceRows.filter(rowHasContent)
  const resourceRows: Ics204RowInput[] = [
    ...filledResources,
    ...Array.from(
      { length: Math.max(0, MIN_RESOURCE_ROWS - filledResources.length) },
      () => emptyResourceRow(),
    ),
  ]

  // Section 8: filled rows, padded to the printed minimum
  const filledComms = props.comms.filter(commsHasContent)
  const commsRows: Ics204CommsRow[] = [
    ...filledComms,
    ...Array.from(
      { length: Math.max(0, MIN_COMMS_ROWS - filledComms.length) },
      () => ({ function: '', system: '', channel: '', frequency: '', others: '' }),
    ),
  ]

  return (
    <div className="ics204-print-overlay">
      <div className="ics204-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      <div className="ics204-print-page">
        <table className="ics204-form">
          <tbody>
            {/* Title block */}
            <tr>
              <td colSpan={3} className="header-cell">
                <div className="header-content">
                  <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
                  <div className="title-section">
                    <div className="main-title">ASSIGNMENT LIST</div>
                    <div className="form-number">ICS 204</div>
                  </div>
                  <div className="logo-spacer" />
                </div>
              </td>
            </tr>

            {/* Boxes 1 / 2 / 3 */}
            <tr>
              <td className="top-cell" style={{ width: '33%' }}>
                <div className="field-label">1. INCIDENT/ EVENT NAME</div>
                <div className="field-value">{props.incidentName || NBSP}</div>
              </td>
              <td className="top-cell" style={{ width: '34%' }}>
                <div className="field-label">2. OPERATIONAL PERIOD</div>
                <div className="field-value">From (Date and Time): {fmtDT(props.opFromDate, props.opFromTime) || NBSP}</div>
                <div className="field-value">To (Date and Time): {fmtDT(props.opToDate, props.opToTime) || NBSP}</div>
              </td>
              <td className="top-cell">
                <div className="field-label">3.</div>
                <div className="field-value">Branch: {props.branch || NBSP}</div>
                <div className="field-value">Group: {props.groupName || NBSP}</div>
                <div className="field-value">Division: {props.division || NBSP}</div>
                <div className="field-value">Staging Area: {props.stagingArea || NBSP}</div>
              </td>
            </tr>

            {/* Section 4 */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="section-title center">4. OPERATIONS PERSONNEL</div>
                <table className="print-subtable ops-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Name</th>
                      <th>Contact Number(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opsRows.map((r) => (
                      <tr key={r.position}>
                        <td>{r.position}</td>
                        <td>{r.name || NBSP}</td>
                        <td>{r.contact || NBSP}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Section 5 */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="section-title center">5. RESOURCES ASSIGNED FOR THIS PERIOD</div>
                <table className="print-subtable resources-table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Resource Identifier</th>
                      <th rowSpan={2}>Name of Leader</th>
                      <th rowSpan={2}>Contact Numbers</th>
                      <th rowSpan={2}>No. of Personnel</th>
                      <th colSpan={2} className="center">Trans. Needed?</th>
                      <th rowSpan={2}>Drop-off point and time at area of assignment</th>
                      <th rowSpan={2}>Pick-up time from area of assignment</th>
                      <th rowSpan={2}>Remarks</th>
                    </tr>
                    <tr>
                      <th className="center">Yes</th>
                      <th className="center">No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resourceRows.map((r, i) => {
                      const has = rowHasContent(r)
                      return (
                        <tr key={i}>
                          <td>{r.resource_identifier || NBSP}</td>
                          <td>{r.leader_name || NBSP}</td>
                          <td>{r.contact_numbers || NBSP}</td>
                          <td className="center">{r.personnel || NBSP}</td>
                          <td className="center">{has && r.trans_needed ? '✓' : ''}</td>
                          <td className="center">{has && !r.trans_needed ? '✓' : ''}</td>
                          <td>{r.drop_off || NBSP}</td>
                          <td>{r.pick_up_time || NBSP}</td>
                          <td>{r.remarks || NBSP}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Section 6 */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="section-title">6. SPECIFIC WORK ASSIGNMENT</div>
                <div className="print-textbox">{props.specificWorkAssignment || NBSP}</div>
              </td>
            </tr>

            {/* Section 7 */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="section-title">7. SPECIAL INSTRUCTIONS/ SAFETY MEASURES</div>
                <div className="print-textbox">{props.specialInstructions || NBSP}</div>
              </td>
            </tr>

            {/* Section 8 */}
            <tr>
              <td colSpan={3} className="content-cell">
                <div className="section-title center">8. COMMUNICATIONS SUMMARY</div>
                <table className="print-subtable comms-table">
                  <thead>
                    <tr>
                      <th>Function</th>
                      <th>System</th>
                      <th>Channel</th>
                      <th>Frequency</th>
                      <th>Others (mobile, satellite phone, etc.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commsRows.map((c, i) => (
                      <tr key={i}>
                        <td>{c.function || NBSP}</td>
                        <td>{c.system || NBSP}</td>
                        <td>{c.channel || NBSP}</td>
                        <td>{c.frequency || NBSP}</td>
                        <td>{c.others || NBSP}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Section 9 */}
            <tr>
              <td colSpan={3} className="footer-cell">
                <div className="footer-row">
                  <div className="footer-num">9. Prepared by RESL</div>
                  <div className="footer-field">
                    <span className="footer-label">Name and Signature:</span>
                    <span className="footer-value">{props.preparedByName || props.preparedBySig || NBSP}</span>
                  </div>
                  <div className="footer-field">
                    <span className="footer-label">Date Prepared:</span>
                    <span className="footer-value">{props.preparedDate || NBSP}</span>
                  </div>
                  <div className="footer-field">
                    <span className="footer-label">Time Prepared:</span>
                    <span className="footer-value">{fmtTime(props.preparedTime) || NBSP}</span>
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
