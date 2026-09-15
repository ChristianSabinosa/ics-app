import './Ics207Print.css'

interface Position {
  position_key: string
  position_title: string
  abbreviation: string
  section: string
  person_name: string
  agency: string
}

interface Ics207PrintProps {
  incidentName: string
  positions: Position[]
  preparedBy: string
  datePrepared: string
  timePrepared: string
  onClose: () => void
}

const BW = 170
const BH = 52
const LW = 100
const LH = 34

export default function Ics207Print({ incidentName, positions, preparedBy, datePrepared, timePrepared, onClose }: Ics207PrintProps) {
  const ic = positions.find((p) => p.position_key === 'ic')
  const cmd = positions.filter((p) => p.section === 'Command Staff')
  const gen = positions.filter((p) => p.section === 'General Staff')

  const IC_X = 285
  const IC_Y = 10
  const IC_CX = IC_X + BW / 2
  const IC_BOT = IC_Y + BH

  const TRUNK_X = IC_CX

  const CMD_JY = 175
  const CMD_LX = 395
  const CMD_LY = CMD_JY - LH / 2
  const CMD_LR = CMD_LX + LW

  const BRKT_X = 570
  const CMD_BOX_X = 600
  const CMD_CY = [95, 205, 315]

  const GS_LX = TRUNK_X - LW / 2
  const GS_LY = 305

  const BAR_Y = 370
  const GEN_BOX_Y = 395
  const GEN_BOXES = [
    { x: 30, cx: 112 },
    { x: 235, cx: 317 },
    { x: 440, cx: 522 },
    { x: 645, cx: 730 },
  ]

  const lines: string[] = []

  // Trunk: IC bottom → horizontal bar
  lines.push(`M ${TRUNK_X} ${IC_BOT} L ${TRUNK_X} ${BAR_Y}`)
  // Branch to COMMAND STAFF label
  lines.push(`M ${TRUNK_X} ${CMD_JY} L ${CMD_LX} ${CMD_JY}`)
  // COMMAND STAFF label → bracket
  lines.push(`M ${CMD_LR} ${CMD_JY} L ${BRKT_X} ${CMD_JY}`)
  // Bracket vertical
  const brktTop = cmd.length > 0 ? CMD_CY[0] : CMD_JY
  const brktBot = cmd.length > 0 ? CMD_CY[cmd.length - 1] : CMD_JY
  lines.push(`M ${BRKT_X} ${brktTop} L ${BRKT_X} ${brktBot}`)
  // Bracket → command staff boxes
  cmd.forEach((_, i) => {
    if (i < CMD_CY.length) {
      lines.push(`M ${BRKT_X} ${CMD_CY[i]} L ${CMD_BOX_X} ${CMD_CY[i]}`)
    }
  })
  // Horizontal bar
  if (gen.length > 1) {
    lines.push(`M ${GEN_BOXES[0].cx} ${BAR_Y} L ${GEN_BOXES[gen.length - 1].cx} ${BAR_Y}`)
  } else if (gen.length === 1) {
    lines.push(`M ${GEN_BOXES[0].cx} ${BAR_Y} L ${GEN_BOXES[0].cx} ${BAR_Y}`)
  }
  // Bar → general staff boxes
  gen.forEach((_, i) => {
    if (i < GEN_BOXES.length) {
      lines.push(`M ${GEN_BOXES[i].cx} ${BAR_Y} L ${GEN_BOXES[i].cx} ${GEN_BOX_Y}`)
    }
  })

  const renderBox = (x: number, y: number, w: number, h: number, name: string, title: string) => (
    <g key={`box-${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h} fill="#d9d9d9" stroke="#000" strokeWidth="2" />
      <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#000">
        {name || 'not activated'}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize="9" fontWeight="600" fill="#333">
        {title}
      </text>
    </g>
  )

  const renderLabel = (x: number, y: number, w: number, h: number, label: string) => (
    <g key={`label-${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h} fill="#d9d9d9" stroke="#000" strokeWidth="2" />
      {label.split('\n').map((line, i) => (
        <text key={i} x={x + w / 2} y={y + h / 2 + (i - (label.split('\n').length - 1) / 2) * 13} textAnchor="middle" fontSize="9" fontWeight="700" fill="#000">
          {line}
        </text>
      ))}
    </g>
  )

  const handlePrint = () => window.print()

  return (
    <div className="print-overlay">
      <div className="print-toolbar no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="print-page">
        <div className="print-header">
          <div className="print-logo">
            <img src="/ndrrmc-logo.png" alt="Logo" />
          </div>
          <div className="print-title">
            <h1>INCIDENT ORGANIZATION CHART</h1>
            <h2>ICS 207</h2>
          </div>
        </div>

        <div className="print-info-bar">
          <div className="print-field">
            <label>1. Incident Name:</label>
            <span>{incidentName}</span>
          </div>
        </div>

        <div className="print-org-chart">
          <svg viewBox="0 0 950 460" xmlns="http://www.w3.org/2000/svg" className="org-svg">
            {lines.map((d, i) => (
              <path key={i} d={d} stroke="#000" strokeWidth="2" fill="none" />
            ))}

            {ic && renderBox(IC_X, IC_Y, BW, BH, ic.person_name, 'INCIDENT COMMANDER')}

            {renderLabel(CMD_LX, CMD_LY, LW, LH, 'COMMAND\nSTAFF')}

            {cmd.map((pos, i) => {
              if (i >= CMD_CY.length) return null
              return renderBox(CMD_BOX_X, CMD_CY[i] - BH / 2, BW, BH, pos.person_name, pos.position_title.toUpperCase())
            })}

            {renderLabel(GS_LX, GS_LY, LW, LH, 'GENERAL\nSTAFF')}

            {gen.map((pos, i) => {
              if (i >= GEN_BOXES.length) return null
              return renderBox(GEN_BOXES[i].x, GEN_BOX_Y, BW, BH, pos.person_name, pos.position_title.toUpperCase())
            })}
          </svg>
        </div>

        <div className="print-footer">
          <div className="print-footer-field">
            <label>2. Prepared by:</label>
            <span>{preparedBy}</span>
          </div>
          <div className="print-footer-field">
            <label>Date:</label>
            <span>{datePrepared}</span>
          </div>
          <div className="print-footer-field">
            <label>Time:</label>
            <span>{timePrepared}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
