import './Ics207ExpandedPrint.css'

interface Position {
  position_key: string
  position_title: string
  abbreviation: string
  section: string
  person_name: string
  agency: string
  parent_key?: string
}

interface Ics207ExpandedPrintProps {
  incidentName: string
  positions: Position[]
  preparedBy: string
  datePrepared: string
  timePrepared: string
}

export default function Ics207ExpandedPrint({ incidentName, positions, preparedBy, datePrepared, timePrepared }: Ics207ExpandedPrintProps) {
  const get = (key: string) => positions.find(p => p.position_key === key)
  const getSupport = (parentKey: string) => positions.filter(p => p.section === `${parentKey} Support`)

  const icSupport = getSupport('ic')
  const commandStaff = positions.filter(p => p.section === 'Command Staff')
  const oscSub = positions.filter(p => p.section === 'OSC Sub')
  const oscBranches = positions.filter(p => p.section === 'OSC Branch')
  const oscDivisions = positions.filter(p => p.section === 'OSC Division')
  const oscGroups = positions.filter(p => p.section === 'OSC Group')
  const oscTF = positions.filter(p => p.section === 'OSC Task Force' && !p.parent_key)
  const oscST = positions.filter(p => p.section === 'OSC Strike Team' && !p.parent_key)
  const oscSR = positions.filter(p => p.section === 'OSC Single Resource' && !p.parent_key)
  const oscSupport = getSupport('osc')
  const pscSub = positions.filter(p => p.section === 'PSC Sub')
  const pscTechSpec = positions.filter(p => p.section === 'PSC Tech Specialist')
  const pscAgencyRep = positions.filter(p => p.section === 'PSC Agency Rep')
  const pscSupport = getSupport('psc')
  const lscSub = positions.filter(p => p.section === 'LSC Sub')
  const lscSupport = getSupport('lsc')
  const fascSub = positions.filter(p => p.section === 'FASC Sub')
  const fascSupport = getSupport('fasc')

  const renderPosCard = (pos: Position, colorClass: string) => (
    <div key={pos.position_key} className={`export-card ${colorClass}`}>
      <div className="export-card-abbr">{pos.abbreviation}</div>
      <div className="export-card-title">{pos.position_title}</div>
      <div className="export-card-name">{pos.person_name || 'not activated'}</div>
      {pos.agency && <div className="export-card-agency">{pos.agency}</div>}
    </div>
  )

  const renderSupportCard = (pos: Position) => (
    <div key={pos.position_key} className="export-card export-card-support">
      <div className="export-card-abbr">{pos.abbreviation}</div>
      <div className="export-card-title">{pos.position_title}</div>
      <div className="export-card-name">{pos.person_name || 'not activated'}</div>
    </div>
  )

  return (
    <div className="export-target" id="ics207-expanded-export">
      <div className="export-page">
        <div className="export-header">
          <img src="/ndrrmc-logo.png" alt="Logo" className="export-logo" />
          <div>
            <h1>INCIDENT ORGANIZATION CHART</h1>
            <h2>ICS 207 - Expanded</h2>
          </div>
        </div>

        <div className="export-info">
          <label>1. Incident Name:</label>
          <span>{incidentName}</span>
        </div>

        <div className="export-org">
          <div className="export-section">
            <div className="export-section-label">Command</div>
            <div className="export-row">
              {get('ic') && renderPosCard(get('ic')!, 'export-card-red')}
              {icSupport.map(s => renderSupportCard(s))}
            </div>
          </div>

          <div className="export-section">
            <div className="export-section-label">Command Staff</div>
            <div className="export-row">
              {commandStaff.map(p => renderPosCard(p, 'export-card-blue'))}
              {commandStaff.map(p => getSupport(p.position_key).map(s => renderSupportCard(s)))}
            </div>
          </div>

          <div className="export-section">
            <div className="export-section-label">Operations Section</div>
            <div className="export-row">
              {get('osc') && renderPosCard(get('osc')!, 'export-card-green')}
              {oscSupport.map(s => renderSupportCard(s))}
            </div>
            {oscSub.length > 0 && (
              <div className="export-row export-sub">{oscSub.map(p => renderPosCard(p, 'export-card-green-sub'))}</div>
            )}
            {oscBranches.length > 0 && (
              <div className="export-sub-group">
                <div className="export-sub-label">Branches</div>
                <div className="export-row">{oscBranches.map(p => renderPosCard(p, 'export-card-green-sub'))}</div>
              </div>
            )}
            {oscDivisions.length > 0 && (
              <div className="export-sub-group">
                <div className="export-sub-label">Divisions</div>
                <div className="export-row">{oscDivisions.map(p => renderPosCard(p, 'export-card-green-sub'))}</div>
              </div>
            )}
            {oscGroups.length > 0 && oscGroups.map(group => {
              const children = positions.filter(p => p.parent_key === group.position_key)
              return (
                <div key={group.position_key} className="export-sub-group">
                  <div className="export-sub-label">{group.position_title}</div>
                  <div className="export-row">{renderPosCard(group, 'export-card-green-sub')}</div>
                  {children.length > 0 && (
                    <div className="export-row export-children">
                      {children.map(c => renderPosCard(c, 'export-card-green-sub'))}
                    </div>
                  )}
                </div>
              )
            })}
            {oscTF.length > 0 && (
              <div className="export-sub-group">
                <div className="export-sub-label">Task Forces</div>
                <div className="export-row">{oscTF.map(p => renderPosCard(p, 'export-card-green-sub'))}</div>
              </div>
            )}
            {oscST.length > 0 && (
              <div className="export-sub-group">
                <div className="export-sub-label">Strike Teams</div>
                <div className="export-row">{oscST.map(p => renderPosCard(p, 'export-card-green-sub'))}</div>
              </div>
            )}
            {oscSR.length > 0 && (
              <div className="export-sub-group">
                <div className="export-sub-label">Single Resources</div>
                <div className="export-row">{oscSR.map(p => renderPosCard(p, 'export-card-green-sub'))}</div>
              </div>
            )}
          </div>

          <div className="export-section">
            <div className="export-section-label">Planning Section</div>
            <div className="export-row">
              {get('psc') && renderPosCard(get('psc')!, 'export-card-purple')}
              {pscSupport.map(s => renderSupportCard(s))}
            </div>
            <div className="export-row export-sub">{pscSub.map(p => renderPosCard(p, 'export-card-purple-sub'))}</div>
            {pscTechSpec.length > 0 && (
              <div className="export-sub-group">
                <div className="export-sub-label">Technical Specialists</div>
                <div className="export-row">{pscTechSpec.map(p => renderPosCard(p, 'export-card-purple-sub'))}</div>
              </div>
            )}
          </div>

          <div className="export-section">
            <div className="export-section-label">Logistics Section</div>
            <div className="export-row">
              {get('lsc') && renderPosCard(get('lsc')!, 'export-card-teal')}
              {lscSupport.map(s => renderSupportCard(s))}
            </div>
            <div className="export-row export-sub">{lscSub.map(p => renderPosCard(p, 'export-card-teal-sub'))}</div>
          </div>

          <div className="export-section">
            <div className="export-section-label">Finance/Admin Section</div>
            <div className="export-row">
              {get('fasc') && renderPosCard(get('fasc')!, 'export-card-orange')}
              {fascSupport.map(s => renderSupportCard(s))}
            </div>
            <div className="export-row export-sub">{fascSub.map(p => renderPosCard(p, 'export-card-orange-sub'))}</div>
          </div>
        </div>

        {pscAgencyRep.length > 0 && (
          <div className="export-section">
            <div className="export-section-label">Others / Agency Representatives</div>
            <div className="export-row">{pscAgencyRep.map(p => renderPosCard(p, 'export-card-support'))}</div>
          </div>
        )}

        <div className="export-footer">
          <div><label>2. Prepared by:</label> <span>{preparedBy}</span></div>
          <div><label>Date:</label> <span>{datePrepared}</span></div>
          <div><label>Time:</label> <span>{timePrepared}</span></div>
        </div>
      </div>
    </div>
  )
}
