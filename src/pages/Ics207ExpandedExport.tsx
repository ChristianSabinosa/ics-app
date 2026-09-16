import { useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng, toSvg } from 'html-to-image'
import jsPDF from 'jspdf'
import './Ics207ExpandedExport.css'

interface Position_ {
  position_key: string
  position_title: string
  abbreviation: string
  section: string
  person_name: string
  agency: string
  parent_key?: string
}

interface Ics207ExpandedExportProps {
  incidentName: string
  positions: Position_[]
  preparedBy: string
  datePrepared: string
  timePrepared: string
  onClose: () => void
}

const W = 160, H = 52
const GAP_X = 50, GAP_Y = 70
const SUPPORT_GAP_X = 60

function getColor(section: string): { bg: string; border: string; text: string } {
  if (section.includes('Support')) return { bg: '#6b7280', border: '#4b5563', text: '#fff' }
  switch (section) {
    case 'ic': return { bg: '#1e3a5f', border: '#0f2940', text: '#fff' }
    case 'Command Staff': return { bg: '#166534', border: '#14532d', text: '#fff' }
    case 'General Staff': return { bg: '#166534', border: '#14532d', text: '#fff' }
    case 'OSC': return { bg: '#991b1b', border: '#7f1d1d', text: '#fff' }
    case 'OSC Sub':
    case 'OSC Branch': return { bg: '#c2410c', border: '#9a3412', text: '#fff' }
    case 'OSC Division':
    case 'OSC Group':
    case 'OSC Task Force':
    case 'OSC Strike Team':
    case 'OSC Single Resource': return { bg: '#ea580c', border: '#c2410c', text: '#fff' }
    case 'PSC': return { bg: '#991b1b', border: '#7f1d1d', text: '#fff' }
    case 'PSC Sub': return { bg: '#1e40af', border: '#1e3a8a', text: '#fff' }
    case 'PSC Tech Specialist': return { bg: '#1e40af', border: '#1e3a8a', text: '#fff' }
    case 'LSC': return { bg: '#991b1b', border: '#7f1d1d', text: '#fff' }
    case 'LSC Sub': return { bg: '#be185d', border: '#9d174d', text: '#fff' }
    case 'FASC': return { bg: '#991b1b', border: '#7f1d1d', text: '#fff' }
    case 'FASC Sub': return { bg: '#6d28d9', border: '#5b21b6', text: '#fff' }
    case 'PSC Agency Rep': return { bg: '#6b7280', border: '#4b5563', text: '#fff' }
    default: return { bg: '#6b7280', border: '#4b5563', text: '#fff' }
  }
}

function CustomNode({ data }: NodeProps) {
  const d = data as any
  const c = getColor(d.section)

  return (
    <div
      className={`rf-node ${d.isLabel ? 'rf-label-node' : ''}`}
      style={{ background: c.bg, borderColor: c.border, color: c.text }}
    >
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <div className="rf-node-title">{d.position_title}</div>
      {!d.isLabel && <div className="rf-node-name">{d.person_name || 'not activated'}</div>}
      {d.agency && <div className="rf-node-agency">{d.agency}</div>}
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
    </div>
  )
}

const nodeTypes = { icsNode: CustomNode }

// ─── Layout engine ──────────────────────────────────────────────────────────

interface LayoutNode {
  id: string
  pos: Position_ | null
  section: string
  isLabel?: boolean
  label?: string
  support: Position_[]
  children: LayoutNode[]
}

let _id = 0
const uid = () => `n${++_id}`

function addEdge(
  edges: Edge[],
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
  dashed = false,
) {
  edges.push({
    id: `e${source}-${target}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'smoothstep',
    style: { stroke: '#000', strokeWidth: 1.5, strokeDasharray: dashed ? '6 3' : undefined },
  })
}

function subtreeWidth(node: LayoutNode): number {
  const ownW = node.support.length > 0 ? W + SUPPORT_GAP_X : W
  if (node.children.length === 0) return ownW
  const childrenW = node.children.reduce((s, c) => s + subtreeWidth(c) + GAP_X, -GAP_X)
  return Math.max(ownW, childrenW)
}

function layout(
  node: LayoutNode,
  cx: number,
  y: number,
  nodes: Node[],
  edges: Edge[],
) {
  const myW = node.support.length > 0 ? W + SUPPORT_GAP_X : W
  const nodeId = node.id

  nodes.push({
    id: nodeId,
    type: 'icsNode',
    position: { x: cx - myW / 2, y },
    data: {
      position_title: node.label || node.pos?.position_title || '',
      section: node.section,
      isLabel: node.isLabel,
      person_name: node.pos?.person_name || '',
      agency: node.pos?.agency || '',
    },
  })

  node.support.forEach((s, i) => {
    const sid = uid()
    const sx = cx + W / 2 + SUPPORT_GAP_X
    const sy = y + i * (H + 10)
    nodes.push({
      id: sid,
      type: 'icsNode',
      position: { x: sx, y: sy },
      data: {
        position_title: s.position_title,
        section: s.section,
        person_name: s.person_name,
        agency: s.agency,
      },
    })
    addEdge(edges, nodeId, sid, 'right', 'left', true)
  })

  if (node.children.length > 0) {
    const childY = y + H + GAP_Y
    const totalW = node.children.reduce((s, c) => s + subtreeWidth(c) + GAP_X, -GAP_X)
    let startX = cx - totalW / 2

    node.children.forEach(child => {
      const cw = subtreeWidth(child)
      const childCx = startX + cw / 2
      layout(child, childCx, childY, nodes, edges)
      addEdge(edges, nodeId, child.id, 'bottom', 'top', false)
      startX += cw + GAP_X
    })
  }
}

// ─── Build tree from positions ──────────────────────────────────────────────

function buildTree(positions: Position_[]): LayoutNode | null {
  const find = (key: string) => positions.find(p => p.position_key === key)
  const getSupport = (parentKey: string) =>
    positions.filter(p => p.section === `${parentKey} Support`)

  const ic = find('ic')
  if (!ic) return null

  const icNode: LayoutNode = {
    id: uid(),
    pos: ic,
    section: 'ic',
    support: getSupport('ic'),
    children: [],
  }

  const agencyReps = positions.filter(p => p.section === 'PSC Agency Rep')
  if (agencyReps.length > 0) {
    icNode.children.push({
      id: uid(),
      pos: null,
      section: 'PSC Agency Rep',
      isLabel: true,
      label: 'Agency Rep',
      support: [],
      children: agencyReps.map(ar => ({
        id: uid(),
        pos: ar,
        section: ar.section,
        support: [],
        children: [],
      })),
    })
  }

  const commandStaff = positions.filter(p => p.section === 'Command Staff')
  icNode.children.push({
    id: uid(),
    pos: null,
    section: 'Command Staff',
    isLabel: true,
    label: 'Command\nStaff',
    support: [],
    children: commandStaff.map(cs => ({
      id: uid(),
      pos: cs,
      section: cs.section,
      support: getSupport(cs.position_key),
      children: [],
    })),
  })

  const osc = find('osc')
  const psc = find('psc')
  const lsc = find('lsc')
  const fasc = find('fasc')

  const sectionTrees = [osc, psc, lsc, fasc].filter(Boolean).map(sec => {
    const secKey = sec!.position_key
    const getSupport2 = (k: string) => positions.filter(p => p.section === `${k} Support`)

    let directChildren: LayoutNode[] = []

    if (secKey === 'osc') {
      const allDirect = positions.filter(p =>
        ['OSC Sub', 'OSC Branch', 'OSC Division', 'OSC Group', 'OSC Task Force', 'OSC Strike Team', 'OSC Single Resource'].includes(p.section) && !p.parent_key
      )
      directChildren = allDirect.map(child => ({
        id: uid(),
        pos: child,
        section: child.section,
        support: getSupport2(child.position_key),
        children: positions.filter(p => p.parent_key === child.position_key).map(kid => ({
          id: uid(),
          pos: kid,
          section: kid.section,
          support: getSupport2(kid.position_key),
          children: positions.filter(p => p.parent_key === kid.position_key).map(gk => ({
            id: uid(),
            pos: gk,
            section: gk.section,
            support: getSupport2(gk.position_key),
            children: [],
          })),
        })),
      }))
    } else if (secKey === 'psc') {
      const allDirect = positions.filter(p =>
        (p.section === 'PSC Sub' || p.section === 'PSC Tech Specialist') && !p.parent_key
      )
      directChildren = allDirect.map(c => ({
        id: uid(),
        pos: c,
        section: c.section,
        support: getSupport2(c.position_key),
        children: [],
      }))
    } else if (secKey === 'lsc') {
      directChildren = positions.filter(p => p.section === 'LSC Sub' && !p.parent_key).map(c => ({
        id: uid(),
        pos: c,
        section: c.section,
        support: getSupport2(c.position_key),
        children: [],
      }))
    } else if (secKey === 'fasc') {
      directChildren = positions.filter(p => p.section === 'FASC Sub' && !p.parent_key).map(c => ({
        id: uid(),
        pos: c,
        section: c.section,
        support: getSupport2(c.position_key),
        children: [],
      }))
    }

    return {
      id: uid(),
      pos: sec!,
      section: sec!.section,
      support: getSupport2(secKey),
      children: directChildren,
    }
  })

  icNode.children.push({
    id: uid(),
    pos: null,
    section: 'General Staff',
    isLabel: true,
    label: 'General\nStaff',
    support: [],
    children: sectionTrees,
  })

  return icNode
}

// ─── Build flow data ────────────────────────────────────────────────────────

function buildFlow(positions: Position_[]): { nodes: Node[]; edges: Edge[] } {
  _id = 0
  const tree = buildTree(positions)
  if (!tree) return { nodes: [], edges: [] }

  const nodes: Node[] = []
  const edges: Edge[] = []

  layout(tree, 600, 0, nodes, edges)

  const gsNode = nodes.find(n => n.data.section === 'General Staff' && n.data.isLabel)
  const cmdStaffNodes = nodes.filter(n => n.data.section === 'Command Staff')

  if (gsNode && cmdStaffNodes.length > 0) {
    const lowestCmd = Math.max(...cmdStaffNodes.map(n => n.position.y + H))
    const desiredGsY = lowestCmd + 50
    if (gsNode.position.y < desiredGsY) {
      const delta = desiredGsY - gsNode.position.y
      const descendants = new Set<string>()
      const findDesc = (nid: string) => {
        edges.filter(e => e.source === nid).forEach(e => {
          descendants.add(e.target)
          findDesc(e.target)
        })
      }
      findDesc(gsNode.id)
      nodes.forEach(n => {
        if (descendants.has(n.id)) {
          n.position = { ...n.position, y: n.position.y + delta }
        }
      })
    }
  }

  return { nodes, edges }
}

// ─── ReactFlow wrapper with export ──────────────────────────────────────────

function FlowCanvas({
  nodes,
  edges,
  incidentName,
  preparedBy,
  datePrepared,
  timePrepared,
  onClose,
}: Ics207ExpandedExportProps & { nodes: Node[]; edges: Edge[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { fitView } = useReactFlow()

  const doExport = useCallback(async (format: 'png' | 'jpg' | 'pdf') => {
    const el = wrapperRef.current
    if (!el) return

    fitView({ padding: 0.15, duration: 0 })
    await new Promise(r => setTimeout(r, 500))

    const viewport = el.querySelector('.react-flow__viewport') as HTMLElement
    if (!viewport) return

    const filename = `ICS207-Expanded-${incidentName.replace(/\s+/g, '_')}`

    try {
      if (format === 'pdf') {
        const svgData = await toSvg(viewport, {
          quality: 1,
          backgroundColor: '#ffffff',
          filter: (node: Element) => {
            const cls = (node as HTMLElement).className?.toString() || ''
            return !cls.includes('react-flow__controls') && !cls.includes('react-flow__minimap')
          },
        })
        const img = new Image()
        img.src = svgData
        await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject })
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [img.width, img.height],
        })
        pdf.addImage(svgData, 'PNG', 0, 0, img.width, img.height)
        pdf.save(`${filename}.pdf`)
      } else {
        const dataUrl = await toPng(viewport, {
          quality: format === 'jpg' ? 0.95 : 1,
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          filter: (node: Element) => {
            const cls = (node as HTMLElement).className?.toString() || ''
            return !cls.includes('react-flow__controls') && !cls.includes('react-flow__minimap')
          },
        })
        const link = document.createElement('a')
        link.download = `${filename}.${format}`
        link.href = dataUrl
        link.click()
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
  }, [fitView, incidentName])

  return (
    <div className="rf-overlay">
      <div className="rf-toolbar no-print">
        <div className="rf-toolbar-left">
          <h3>ICS 207 - Expanded</h3>
          <span>{incidentName}</span>
          {preparedBy && <span>By: {preparedBy}</span>}
          {datePrepared && <span>{datePrepared}</span>}
          {timePrepared && <span>{timePrepared}</span>}
        </div>
        <div className="rf-toolbar-actions">
          <button onClick={() => doExport('pdf')}>Export PDF</button>
          <button onClick={() => doExport('png')}>Export PNG</button>
          <button onClick={() => doExport('jpg')}>Export JPG</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="rf-wrapper" ref={wrapperRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        />
      </div>
    </div>
  )
}

export default function Ics207ExpandedExport(props: Ics207ExpandedExportProps) {
  const { nodes, edges } = useMemo(() => buildFlow(props.positions), [props.positions])

  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} nodes={nodes} edges={edges} />
    </ReactFlowProvider>
  )
}
