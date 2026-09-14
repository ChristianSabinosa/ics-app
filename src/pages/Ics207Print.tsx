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

const BW = 190
const BH = 68
const SW = 130
const SH = 40

export default function Ics207Print({ incidentName, positions, preparedBy, datePrepared, timePrepared, onClose }: Ics207PrintProps) {
  const ic = positions.find((p) => p.position_key === 'ic')
  const commandStaff = positions.filter((p) => p.section === 'Command Staff')
  const generalStaff = positions.filter((p) => p.section === 'General Staff')

  const icX = 400
  const icY = 15
  const icCX = icX + BW / 2
  const icBot = icY + BH

  const cmdColX = 660
  const cmdStartY = 95
  const cmdSpacing = 90
  const cmdLeft = cmdColX

  const trunkMidX = (icCX + cmdLeft) / 2
  const cmdMidY = cmdStartY + (BH / 2) + ((commandStaff.length - 1) * cmdSpacing) / 2

  const genY = 370
  const genCX = 465
  const genTop = genY
  const genSpacing = 220
  const barY = genY - 25
  const firstGenCX = genCX - (genSpacing * 1.5)

  const renderBox = (x: number, y: number, w: number, h: number, name: string, title: string) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h} fill="#d9d9d9" stroke="#000" strokeWidth="2" />
      <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#000">
        {name || 'not activated'}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize="9" fontWeight="600" fill="#333">
        {title}
      </text>
    </g>
  )

  const renderSmallBox = (x: number, y: number, w: number, h: number, label: string) => (
    <g key={`label-${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h} fill="#d9d9d9" stroke="#000" strokeWidth="2" />
      {label.split('\n').map((line, i) => (
        <text key={i} x={x + w / 2} y={y + h / 2 + (i - (label.split('\n').length - 1) / 2) * 13} textAnchor="middle" fontSize="9" fontWeight="700" fill="#000">
          {line}
        </text>
      ))}
    </g>
  )

  const lines: string[] = []

  // IC vertical down
  lines.push(`M ${icCX} ${icBot} L ${icCX} ${cmdMidY}`)
  // Horizontal trunk to command branch
  lines.push(`M ${icCX} ${cmdMidY} L ${cmdLeft} ${cmdMidY}`)
  // Vertical command spine
  if (commandStaff.length >= 2) {
    lines.push(`M ${cmdLeft} ${cmdStartY + BH / 2} L ${cmdLeft} ${cmdStartY + BH / 2 + (commandStaff.length - 1) * cmdSpacing}`)
  }
  // Horizontal drops to each command staff
  commandStaff.forEach((_, i) => {
    const cy = cmdStartY + BH / 2 + i * cmdSpacing
    lines.push(`M ${cmdLeft} ${cy} L ${cmdColX} ${cy}`)
  })
  // Trunk continuation to general staff
  lines.push(`M ${icCX} ${cmdMidY} L ${icCX} ${barY}`)
  // Horizontal bar
  lines.push(`M ${firstGenCX} ${barY} L ${firstGenCX + genSpacing * 3} ${barY}`)
  // Drops from bar to general staff
  generalStaff.forEach((_, i) => {
    const cx = firstGenCX + i * genSpacing
    lines.push(`M ${cx} ${barY} L ${cx} ${genTop}`)
  })

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
          <svg viewBox="0 0 950 480" xmlns="http://www.w3.org/2000/svg" className="org-svg">
            {lines.map((d, i) => (
              <path key={i} d={d} stroke="#000" strokeWidth="2" fill="none" />
            ))}

            {ic && renderBox(icX, icY, BW, BH, ic.person_name, 'INCIDENT COMMANDER')}

            {renderSmallBox(trunkMidX - SW / 2, cmdMidY - SH / 2, SW, SH, 'COMMAND\nSTAFF')}

            {commandStaff.map((pos, i) => {
              const y = cmdStartY + i * cmdSpacing
              return renderBox(cmdColX, y, BW, BH, pos.person_name, pos.position_title.toUpperCase())
            })}

            {renderSmallBox(icCX - SW / 2, barY - SH / 2, SW, SH, 'GENERAL\nSTAFF')}

            {generalStaff.map((pos, i) => {
              const x = firstGenCX + i * genSpacing - BW / 2
              return renderBox(x, genY, BW, BH, pos.person_name, pos.position_title.toUpperCase())
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
