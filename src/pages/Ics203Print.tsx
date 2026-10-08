import './Ics203Print.css'
import {
  buildOpsFromPositions,
  padOpsForPrint,
  formatDivision,
  isDefaultOps,
  defaultOpsTemplate,
  showAirWaterPlaceholders,
  branchLetter,
  type OpsData,
  type OpsPosition,
} from '../lib/ops203'

interface Position {
  position_key: string
  position_title: string
  abbreviation: string
  section: string
  person_name: string
  agency: string
  parent_key?: string | null
}

interface Ics203PrintProps {
  incidentName: string
  opFromDate: string
  opFromTime: string
  opToDate: string
  opToTime: string
  positions: Position[]
  /** Manual Operations snapshot; falls back to a 207 import when absent. */
  ops?: OpsData | null
  preparedByName: string
  preparedBySig: string
  preparedDate: string
  preparedTime: string
  onClose: () => void
}

const fmtTime = (t: string) => t ? t.replace(':', '') + 'H' : ''
const fmtDT = (d: string, t: string) => (!d && !t) ? '' : `${d} ${fmtTime(t)}`.trim()

export default function Ics203Print(props: Ics203PrintProps) {
  const handlePrint = () => window.print()
  const { positions: pos } = props

  const getPosition = (key: string) => pos.find(p => p.position_key === key)
  const getBySection = (section: string) => pos.filter(p => p.section === section)
  const getSupport = (key: string) => pos.filter(p => p.section === `${key} Support`)

  const ic = getPosition('ic')
  const pio = getPosition('pio')
  const sofr = getPosition('sofr')
  const lofr = getPosition('lofr')
  const osc = getPosition('osc')
  const psc = getPosition('psc')
  const lsc = getPosition('lsc')
  const fasc = getPosition('fasc')
  const agencyReps = getBySection('PSC Agency Rep')
  const pscSub = getBySection('PSC Sub')
  const pscTechSpec = getBySection('PSC Tech Specialist')
  const lscSub = getBySection('LSC Sub')
  const fascSub = getBySection('FASC Sub')
  // Manual snapshot when present; old forms without one fall back to a 207
  // import. Untouched snapshots print the paper default (blank BRANCH I–III
  // + Air/Water); customized ones print as built, with D./E. placeholders
  // only while the structure still fits the template.
  const opsPos: OpsPosition[] = pos.map(p => ({ ...p, parent_key: p.parent_key ?? null }))
  const snapshot = props.ops ?? buildOpsFromPositions(opsPos)
  const effective = isDefaultOps(snapshot) ? defaultOpsTemplate() : snapshot
  const opsData = padOpsForPrint(effective)
  const showPlaceholders = showAirWaterPlaceholders(effective)
  const supportIC = getSupport('ic')
  const supportOSC = getSupport('osc')
  const supportPSC = getSupport('psc')
  const supportLSC = getSupport('lsc')
  const supportFASC = getSupport('fasc')

  // Helper: find position by title substring
  const findSub = (list: Position[], substr: string) => list.find(p => p.position_title.toLowerCase().includes(substr.toLowerCase()))

  // ─── Left Column: Sections 3-6 ────────────────────────────────
  const deputyIC = supportIC[0]

  const section3Rows = [
    { role: 'Incident Commander', name: ic?.person_name || '' },
    { role: 'Deputy', name: deputyIC?.person_name || '' },
    { role: 'Safety Officer', name: sofr?.person_name || '' },
    { role: 'Information Officer', name: pio?.person_name || '' },
    { role: 'Liaison Officer', name: lofr?.person_name || '' },
  ]

  const section4Rows = (() => {
    const rows: Array<{ agency: string; name: string }> = []
    for (let i = 0; i < Math.max(agencyReps.length, 5); i++) {
      const ar = agencyReps[i]
      rows.push({ agency: ar?.agency || '', name: ar?.person_name || '' })
    }
    return rows
  })()

  const deputyPSC = supportPSC[0]
  const resourceUnit = findSub(pscSub, 'Resource')
  const situationUnit = findSub(pscSub, 'Situation')
  const docUnit = findSub(pscSub, 'Documentation')
  const demoUnit = findSub(pscSub, 'Demobilization')

  const section5Rows = [
    { role: 'Chief', name: psc?.person_name || '' },
    { role: 'Deputy', name: deputyPSC?.person_name || '' },
    { role: 'Resource Unit', name: resourceUnit?.person_name || '' },
    { role: 'Situation Unit', name: situationUnit?.person_name || '' },
    { role: 'Documentation Unit', name: docUnit?.person_name || '' },
    { role: 'Demobilization Unit', name: demoUnit?.person_name || '' },
    { role: 'Technical Specialists', name: pscTechSpec.length > 0 ? pscTechSpec.map(t => t.person_name || t.position_title).join(', ') : '' },
  ]

  const deputyLSC = supportLSC[0]
  const supplyUnit = findSub(lscSub, 'Supply')
  const facilitiesUnit = findSub(lscSub, 'Facilities')
  const groundSupportUnit = findSub(lscSub, 'Ground Support')
  const commsUnit = findSub(lscSub, 'Communications')
  const medicalUnit = findSub(lscSub, 'Medical')
  const foodUnit = findSub(lscSub, 'Food')

  const section6Rows = [
    { role: 'Chief', name: lsc?.person_name || '' },
    { role: 'Deputy', name: deputyLSC?.person_name || '' },
    { role: 'SUPPORT BRANCH', name: '', bold: true },
    { role: 'Director', name: '', indent: true },
    { role: 'Supply Unit', name: supplyUnit?.person_name || '', indent: true },
    { role: 'Facilities Unit', name: facilitiesUnit?.person_name || '', indent: true },
    { role: 'Ground Support Unit', name: groundSupportUnit?.person_name || '', indent: true },
    { role: 'SERVICE BRANCH', name: '', bold: true },
    { role: 'Director', name: '', indent: true },
    { role: 'Communications Unit', name: commsUnit?.person_name || '', indent: true },
    { role: 'Medical Unit', name: medicalUnit?.person_name || '', indent: true },
    { role: 'Food Unit', name: foodUnit?.person_name || '', indent: true },
  ]

  // ─── Right Column: Sections 7-8 ───────────────────────────────
  const deputyOSC = supportOSC[0]

  // Manual snapshot (padded to paper-form minimums so blanks print as empty
  // lines); falls back to a 207 import for old forms without one.
  const section7Rows = [
    { role: 'Chief', name: osc?.person_name || '' },
    { role: 'Deputy', name: deputyOSC?.person_name || '' },
    ...opsData.branches.flatMap((branch, bi) => [
      { role: `${branchLetter(bi)}. ${branch.label.trim() || 'BRANCH'}`.toUpperCase(), name: '', bold: true },
      { role: 'Branch Director', name: branch.director, indent: true },
      { role: 'Deputy', name: branch.deputy, indent: true },
      ...branch.divisions.map(div => ({ role: 'Division/Group', name: formatDivision(div), indent: true })),
    ]),
    ...opsData.standalone.map(div => ({ role: 'Division/Group', name: formatDivision(div) })),
    ...(showPlaceholders
      ? [
          { role: 'D. AIR OPERATIONS BRANCH', name: '', bold: true },
          { role: 'E. WATER OPERATIONS BRANCH', name: '', bold: true },
        ]
      : []),
  ]

  const timeUnit = findSub(fascSub, 'Time')
  const procurementUnit = findSub(fascSub, 'Procurement')
  const compensationUnit = findSub(fascSub, 'Compensation') || findSub(fascSub, 'Claims')
  const costUnit = findSub(fascSub, 'Cost')

  const section8Rows = [
    { role: 'Chief', name: fasc?.person_name || '' },
    { role: 'Deputy', name: supportFASC[0]?.person_name || '' },
    { role: 'Time Unit', name: timeUnit?.person_name || '' },
    { role: 'Procurement Unit', name: procurementUnit?.person_name || '' },
    { role: 'Compensation/Claims Unit', name: compensationUnit?.person_name || '' },
    { role: 'Cost Unit', name: costUnit?.person_name || '' },
  ]

  // ─── Pagination ────────────────────────────────────────────────
  const ROWS_PER_COL = 30



  const allLeftRows = [
    { type: 'title' as const, text: '3. INCIDENT COMMANDER AND COMMAND STAFF' },
    ...section3Rows.map(r => ({ type: 'row' as const, ...r })),
    { type: 'title' as const, text: '4. AGENCY REPRESENTATIVES' },
    { type: 'header' as const, role: 'Agency', name: 'Names' },
    ...section4Rows.map(r => ({ type: 'row' as const, role: r.agency, name: r.name })),
    { type: 'title' as const, text: '5. PLANNING SECTION' },
    ...section5Rows.map(r => ({ type: 'row' as const, ...r })),
    { type: 'title' as const, text: '6. LOGISTICS SECTION' },
    ...section6Rows.map(r => ({ type: 'row' as const, ...r })),
  ]

  const allRightRows = [
    { type: 'title' as const, text: '7. OPERATIONS SECTION' },
    ...section7Rows.map(r => ({ type: 'row' as const, ...r })),
    { type: 'title' as const, text: '8. FINANCE/ADMINISTRATIVE SECTION' },
    ...section8Rows.map(r => ({ type: 'row' as const, ...r })),
  ]

  // Split into pages
  const leftPages: Array<Array<typeof allLeftRows[0]>> = []
  {
    let current: typeof allLeftRows = []
    let count = 0
    for (const item of allLeftRows) {
      if (item.type === 'title') {
        if (count + 2 > ROWS_PER_COL && current.length > 0) {
          leftPages.push(current)
          current = []
          count = 0
        }
        count += 2
      } else {
        count++
      }
      current.push(item)
    }
    if (current.length > 0) leftPages.push(current)
    if (leftPages.length === 0) leftPages.push([])
  }

  const rightPages: Array<Array<typeof allRightRows[0]>> = []
  {
    let current: typeof allRightRows = []
    let count = 0
    for (const item of allRightRows) {
      if (item.type === 'title') {
        if (count + 2 > ROWS_PER_COL && current.length > 0) {
          rightPages.push(current)
          current = []
          count = 0
        }
        count += 2
      } else {
        count++
      }
      current.push(item)
    }
    if (current.length > 0) rightPages.push(current)
    if (rightPages.length === 0) rightPages.push([])
  }

  const totalPages = Math.max(leftPages.length, rightPages.length)

  const renderLeftContent = (items: typeof allLeftRows) => (
    <>
      {items.map((item, i) => {
        if (item.type === 'title') {
          return <div key={i} className="print-section-title">{item.text}</div>
        }
        if (item.type === 'header') {
          return (
            <table key={i} className="print-staff-table header-table">
              <tbody>
                <tr>
                  <td className="role-cell header-cell-inner">{item.role}</td>
                  <td className="name-cell header-cell-inner">{item.name}</td>
                </tr>
              </tbody>
            </table>
          )
        }
        return (
          <table key={i} className="print-staff-table">
            <tbody>
              <tr>
                <td className={`role-cell ${(item as any).indent ? 'indent' : ''}`}>{(item as any).role}</td>
                <td className="name-cell">{(item as any).name}</td>
              </tr>
            </tbody>
          </table>
        )
      })}
    </>
  )

  const renderRightContent = (items: typeof allRightRows) => (
    <>
      {items.map((item, i) => {
        if (item.type === 'title') {
          return <div key={i} className="print-section-title">{item.text}</div>
        }
        return (
          <table key={i} className="print-staff-table">
            <tbody>
              <tr className={(item as any).bold ? 'bold-row' : ''}>
                <td className={`role-cell ${(item as any).indent ? 'indent' : ''}`}>{(item as any).role}</td>
                <td className="name-cell">{(item as any).name}</td>
              </tr>
            </tbody>
          </table>
        )
      })}
    </>
  )

  return (
    <div className="ics203-print-overlay">
      <div className="ics203-print-controls no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={props.onClose}>Close</button>
      </div>

      {Array.from({ length: totalPages }).map((_, pi) => {
        const leftItems = leftPages[pi] || []
        const rightItems = rightPages[pi] || []

        return (
          <div key={pi} className="ics203-print-page">
            <table className="ics203-form">
              <thead>
                <tr>
                  <td colSpan={2} className="header-cell">
                    <div className="header-content">
                      <div className="logo-section">
                        <img src="/ndrrmc-logo.png" alt="NDRRMC" className="ndrrmc-logo" />
                      </div>
                      <div className="title-section">
                        <div className="main-title">ORGANIZATION ASSIGNMENT LIST</div>
                        <div className="form-number">ICS 203</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="top-cell" style={{ width: '50%' }}>
                    <div className="field-label">1. INCIDENT/EVENT NAME</div>
                    <div className="field-value">{props.incidentName || '\u00A0'}</div>
                  </td>
                  <td className="top-cell">
                    <div className="field-label">2. OPERATIONAL PERIOD</div>
                    <div className="field-value">From (Date and Time): {fmtDT(props.opFromDate, props.opFromTime) || '\u00A0'}</div>
                    <div className="field-value">To (Date and Time): {fmtDT(props.opToDate, props.opToTime) || '\u00A0'}</div>
                  </td>
                </tr>
                <tr>
                  <td className="content-cell" style={{ width: '50%', verticalAlign: 'top' }}>
                    {renderLeftContent(leftItems)}
                  </td>
                  <td className="content-cell" style={{ verticalAlign: 'top' }}>
                    {renderRightContent(rightItems)}
                  </td>
                </tr>
              </tbody>
            </table>
            {/* 9. Prepared by — single-row footer table, copied from the 208 print */}
            <table className="ics203-footer">
              <tbody>
                <tr>
                  <td className="ics203-c1">
                    <span className="ics203-strong">9. Prepared by RESL</span>
                  </td>
                  <td className="ics203-c2">
                    Name and Signature: <span className="ics203-value">{props.preparedByName || props.preparedBySig || '\u00A0'}</span>
                  </td>
                  <td className="ics203-c3">
                    Date Prepared: <span className="ics203-value">{props.preparedDate || '\u00A0'}</span>
                  </td>
                  <td className="ics203-c4">
                    Time Prepared: <span className="ics203-value">{fmtTime(props.preparedTime) || '\u00A0'}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="page-number">Page {pi + 1} of {totalPages}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
