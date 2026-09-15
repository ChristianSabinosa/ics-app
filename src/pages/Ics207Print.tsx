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

export default function Ics207Print({ incidentName, positions, preparedBy, datePrepared, timePrepared, onClose }: Ics207PrintProps) {
  const find = (key: string) => positions.find((p) => p.position_key === key)
  const get = (key: string) => find(key)?.person_name || ''

  const oscSubs = positions.filter((p) => p.position_key.startsWith('osc-') && p.position_key !== 'osc-stam')
  const stam = find('osc-stam')
  const pscSub = positions.filter((p) => p.position_key.startsWith('psc-'))
  const lscSub = positions.filter((p) => p.position_key.startsWith('lsc-'))
  const fascSub = positions.filter((p) => p.position_key.startsWith('fasc-'))

  // Box sizes
  const BW = 140, BH = 38    // Chief / Command Staff boxes
  const SW = 100, SH = 32    // Sub-position boxes
  const LW = 55, LH = 44     // Label boxes (rounded)
  const IC_W = 160, IC_H = 44

  // IC position
  const IC_CX = 420
  const IC_Y = 10
  const IC_BOT = IC_Y + IC_H

  // Junction (where trunk splits to Command Staff and General Staff)
  const JUNCTION_Y = IC_BOT + 60

  // Command Staff (right side of trunk)
  const CMD_LABEL_X = IC_CX + 70
  const CMD_BRKT_X = CMD_LABEL_X + LW + 5
  const CMD_BOX_X = CMD_BRKT_X + 18
  const CMD_CY = [JUNCTION_Y - 45, JUNCTION_Y, JUNCTION_Y + 45]

  // General Staff (below junction)
  const GS_Y = JUNCTION_Y + 42

  // Horizontal bar
  const BAR_Y = GS_Y + LH + 30

  // Section chiefs
  const CHIEF_Y = BAR_Y + 15
  const CHIEF_CX = [120, 310, 520, 730]

  // Sub-positions
  const SUB_START_Y = CHIEF_Y + BH + 15
  const SUB_GAP = 40

  const maxSubRows = Math.max(
    Math.ceil((oscSubs.length + (stam ? 1 : 0))),
    Math.ceil(pscSub.length / 2),
    Math.ceil(lscSub.length / 2),
    Math.ceil(fascSub.length / 2)
  )
  const H = Math.max(480, SUB_START_Y + maxSubRows * SUB_GAP + 20)

  // ── Lines (connecting box edges, not centers) ──
  const lines: string[] = []

  // IC bottom → junction
  lines.push(`M ${IC_CX} ${IC_BOT} L ${IC_CX} ${JUNCTION_Y}`)

  // Junction → right to Command Staff label left edge
  lines.push(`M ${IC_CX} ${JUNCTION_Y} L ${CMD_LABEL_X} ${JUNCTION_Y}`)

  // Command Staff label right edge → bracket
  lines.push(`M ${CMD_LABEL_X + LW} ${JUNCTION_Y} L ${CMD_BRKT_X} ${JUNCTION_Y}`)

  // Bracket vertical (spans all 3 boxes)
  lines.push(`M ${CMD_BRKT_X} ${CMD_CY[0]} L ${CMD_BRKT_X} ${CMD_CY[2]}`)

  // Bracket → right to each Command Staff box left edge
  CMD_CY.forEach((cy) => {
    lines.push(`M ${CMD_BRKT_X} ${cy} L ${CMD_BOX_X} ${cy}`)
  })

  // Junction → down to General Staff label top edge
  lines.push(`M ${IC_CX} ${JUNCTION_Y} L ${IC_CX} ${GS_Y}`)

  // General Staff label bottom edge → down to bar
  lines.push(`M ${IC_CX} ${GS_Y + LH} L ${IC_CX} ${BAR_Y}`)

  // Horizontal bar (spans all 4 chiefs)
  lines.push(`M ${CHIEF_CX[0]} ${BAR_Y} L ${CHIEF_CX[3]} ${BAR_Y}`)

  // Bar → down to each chief top edge
  CHIEF_CX.forEach((cx) => {
    lines.push(`M ${cx} ${BAR_Y} L ${cx} ${CHIEF_Y}`)
  })

  // Each chief bottom → down to sub-positions
  CHIEF_CX.forEach((cx) => {
    lines.push(`M ${cx} ${CHIEF_Y + BH} L ${cx} ${SUB_START_Y}`)
  })

  // ── Render functions ──
  const renderBox = (cx: number, y: number, w: number, h: number, name: string, title: string, fill: string, tc = '#ccc', fs = 10) => {
    const x = cx - w / 2
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke="#000" strokeWidth="1.5" rx={5} />
        <text x={cx} y={y + h / 2 - 3} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff">{name || 'not activated'}</text>
        <text x={cx} y={y + h / 2 + 10} textAnchor="middle" fontSize="7" fontWeight="600" fill={tc}>{title}</text>
      </g>
    )
  }

  const renderSmall = (cx: number, y: number, w: number, h: number, name: string, title: string, fill: string) => {
    const x = cx - w / 2
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke="#000" strokeWidth="1" rx={4} />
        <text x={cx} y={y + h / 2 - 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">{name || 'not activated'}</text>
        <text x={cx} y={y + h / 2 + 9} textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#eee">{title}</text>
      </g>
    )
  }

  const renderLabel = (cx: number, cy: number, w: number, h: number, label: string, fill: string) => {
    const x = cx - w / 2
    const y = cy - h / 2
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke="#000" strokeWidth="1.5" rx={10} />
        {label.split('\n').map((line, i) => (
          <text key={i} x={cx} y={cy + (i - 0.5) * 11} textAnchor="middle" fontSize="9" fontWeight="700" fill="white">{line}</text>
        ))}
      </g>
    )
  }

  const handlePrint = () => window.print()

  return (
    <div className="print-overlay">
      <div className="print-toolbar no-print">
        <button onClick={handlePrint}>Print</button>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="print-page">
        <div className="print-header">
          <div className="print-logo"><img src="/ndrrmc-logo.png" alt="Logo" /></div>
          <div className="print-title"><h1>INCIDENT ORGANIZATION CHART</h1><h2>ICS 207</h2></div>
        </div>
        <div className="print-info-bar">
          <div className="print-field"><label>1. Incident Name:</label><span>{incidentName}</span></div>
        </div>
        <div className="print-org-chart">
          <svg viewBox={`0 0 860 ${H}`} xmlns="http://www.w3.org/2000/svg" className="org-svg" preserveAspectRatio="xMidYMid meet">
            {lines.map((d, i) => <path key={i} d={d} stroke="#000" strokeWidth="1.5" fill="none" />)}

            {/* IC - Blue */}
            {renderBox(IC_CX, IC_Y, IC_W, IC_H, get('ic'), 'INCIDENT COMMANDER', '#003366', '#ccc', 11)}

            {/* Command Staff label - Dark Red */}
            {renderLabel(CMD_LABEL_X + LW / 2, JUNCTION_Y, LW, LH, 'Command\nStaff', '#5c1a1a')}

            {/* Command Staff boxes - Green */}
            {['pio', 'sofr', 'lofr'].map((key, i) => (
              renderBox(CMD_BOX_X + BW / 2, CMD_CY[i] - BH / 2, BW, BH, get(key), key.toUpperCase(), '#1a5c3a')
            ))}

            {/* General Staff label - Dark Red */}
            {renderLabel(IC_CX, GS_Y + LH / 2, LW, LH, 'General\nStaff', '#5c1a1a')}

            {/* OSC - Dark Red */}
            {renderBox(CHIEF_CX[0], CHIEF_Y, BW, BH, get('osc'), 'OPERATIONS\nSECTION CHIEF', '#8b0000')}

            {/* OSC Subs - Orange (single column) */}
            {[stam, ...oscSubs].filter(Boolean).slice(0, 4).map((pos, i) => (
              renderSmall(CHIEF_CX[0], SUB_START_Y + i * SUB_GAP, SW, SH, pos!.person_name, pos!.position_title, '#d2691e')
            ))}

            {/* PSC - Dark Red */}
            {renderBox(CHIEF_CX[1], CHIEF_Y, BW, BH, get('psc'), 'PLANNING\nSECTION CHIEF', '#8b0000')}

            {/* PSC Subs - Blue (single column) */}
            {[...pscSub, ...Array(Math.max(0, 4 - pscSub.length)).fill(null)].slice(0, 4).map((pos, i) => (
              renderSmall(CHIEF_CX[1], SUB_START_Y + i * SUB_GAP, SW, SH, pos?.person_name || '', pos?.position_title || '', '#1e5cb3')
            ))}

            {/* LSC - Dark Red */}
            {renderBox(CHIEF_CX[2], CHIEF_Y, BW, BH, get('lsc'), 'LOGISTICS\nSECTION CHIEF', '#8b0000')}

            {/* LSC Subs - Pink (2-col grid) */}
            {[...lscSub, ...Array(Math.max(0, 6 - lscSub.length)).fill(null)].slice(0, 6).map((pos, i) => {
              const row = Math.floor(i / 2), col = i % 2
              const cx = CHIEF_CX[2] - 60 - SW / 2 - 5 + col * (SW + 10) + SW / 2
              return renderSmall(cx, SUB_START_Y + row * SUB_GAP, SW, SH, pos?.person_name || '', pos?.position_title || '', '#c71585')
            })}

            {/* FASC - Dark Red */}
            {renderBox(CHIEF_CX[3], CHIEF_Y, BW, BH, get('fasc'), 'FINANCE/ADMIN\nSECTION CHIEF', '#8b0000')}

            {/* FASC Subs - Purple (single column) */}
            {[...fascSub, ...Array(Math.max(0, 4 - fascSub.length)).fill(null)].slice(0, 4).map((pos, i) => (
              renderSmall(CHIEF_CX[3], SUB_START_Y + i * SUB_GAP, SW, SH, pos?.person_name || '', pos?.position_title || '', '#6a0dad')
            ))}
          </svg>
        </div>
        <div className="print-footer">
          <div className="print-footer-field"><label>2. Prepared by:</label><span>{preparedBy}</span></div>
          <div className="print-footer-field"><label>Date:</label><span>{datePrepared}</span></div>
          <div className="print-footer-field"><label>Time:</label><span>{timePrepared}</span></div>
        </div>
      </div>
    </div>
  )
}
