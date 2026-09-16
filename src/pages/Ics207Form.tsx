import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Ics207Print from './Ics207Print'
import Ics207ExpandedExport from './Ics207ExpandedExport'
import './Ics207Form.css'

interface PersonnelWithAgency {
  id: string
  manifest_id: string
  role: string
  name: string
  agency: string
  capabilities: string
  participant_role: string
}

interface Position {
  position_key: string
  position_title: string
  abbreviation: string
  section: string
  person_name: string
  agency: string
  parent_key?: string
}

const DEFAULT_POSITIONS: Position[] = [
  { position_key: 'ic', position_title: 'Incident Commander', abbreviation: 'IC', section: 'Command', person_name: '', agency: '' },
  { position_key: 'pio', position_title: 'Public Information Officer', abbreviation: 'PIO', section: 'Command Staff', person_name: '', agency: '' },
  { position_key: 'sofr', position_title: 'Safety Officer', abbreviation: 'SOFR', section: 'Command Staff', person_name: '', agency: '' },
  { position_key: 'lofr', position_title: 'Liaison Officer', abbreviation: 'LOFR', section: 'Command Staff', person_name: '', agency: '' },
  { position_key: 'osc', position_title: 'Operations Section Chief', abbreviation: 'OSC', section: 'General Staff', person_name: '', agency: '' },
  { position_key: 'psc', position_title: 'Planning Section Chief', abbreviation: 'PSC', section: 'General Staff', person_name: '', agency: '' },
  { position_key: 'lsc', position_title: 'Logistics Section Chief', abbreviation: 'LSC', section: 'General Staff', person_name: '', agency: '' },
  { position_key: 'fasc', position_title: 'Finance/Admin Section Chief', abbreviation: 'FASC', section: 'General Staff', person_name: '', agency: '' },
]

const SUB_POSITION_OPTIONS: Record<string, Position[]> = {
  osc: [
    { position_key: 'osc-stam', position_title: 'Staging Area Manager', abbreviation: 'STAM', section: 'OSC Sub', person_name: '', agency: '' },
  ],
  psc: [
    { position_key: 'psc-resl', position_title: 'Resources Unit Leader', abbreviation: 'RESL', section: 'PSC Sub', person_name: '', agency: '' },
    { position_key: 'psc-sitl', position_title: 'Situation Unit Leader', abbreviation: 'SITL', section: 'PSC Sub', person_name: '', agency: '' },
    { position_key: 'psc-docl', position_title: 'Documentation Unit Leader', abbreviation: 'DOCL', section: 'PSC Sub', person_name: '', agency: '' },
    { position_key: 'psc-dmob', position_title: 'Demobilization Unit Leader', abbreviation: 'DMOB', section: 'PSC Sub', person_name: '', agency: '' },
  ],
  lsc: [
    { position_key: 'lsc-spul', position_title: 'Supply Unit Leader', abbreviation: 'SPUL', section: 'LSC Sub', person_name: '', agency: '' },
    { position_key: 'lsc-facl', position_title: 'Facilities Unit Leader', abbreviation: 'FACL', section: 'LSC Sub', person_name: '', agency: '' },
    { position_key: 'lsc-gsul', position_title: 'Ground Support Unit Leader', abbreviation: 'GSUL', section: 'LSC Sub', person_name: '', agency: '' },
    { position_key: 'lsc-coml', position_title: 'Communications Unit Leader', abbreviation: 'COML', section: 'LSC Sub', person_name: '', agency: '' },
    { position_key: 'lsc-medl', position_title: 'Medical Unit Leader', abbreviation: 'MEDL', section: 'LSC Sub', person_name: '', agency: '' },
    { position_key: 'lsc-fdul', position_title: 'Food Unit Leader', abbreviation: 'FDUL', section: 'LSC Sub', person_name: '', agency: '' },
  ],
  fasc: [
    { position_key: 'fasc-time', position_title: 'Time Unit Leader', abbreviation: 'TIME', section: 'FASC Sub', person_name: '', agency: '' },
    { position_key: 'fasc-comp', position_title: 'Compensation/Claims Unit Leader', abbreviation: 'COMP', section: 'FASC Sub', person_name: '', agency: '' },
    { position_key: 'fasc-cost', position_title: 'Cost Unit Leader', abbreviation: 'COST', section: 'FASC Sub', person_name: '', agency: '' },
    { position_key: 'fasc-proc', position_title: 'Procurement Unit Leader', abbreviation: 'PROC', section: 'FASC Sub', person_name: '', agency: '' },
  ],
}

const EXPANDED_SUB_OPTIONS: Record<string, Position[]> = {
  osc: [
    { position_key: 'osc-stam', position_title: 'Staging Area Manager', abbreviation: 'STAM', section: 'OSC Sub', person_name: '', agency: '' },
    { position_key: 'osc-aob', position_title: 'Air Operations Branch Director', abbreviation: 'AOB', section: 'OSC Sub', person_name: '', agency: '' },
  ],
  psc: [
    { position_key: 'psc-resl', position_title: 'Resources Unit Leader', abbreviation: 'RESL', section: 'PSC Sub', person_name: '', agency: '' },
    { position_key: 'psc-sitl', position_title: 'Situation Unit Leader', abbreviation: 'SITL', section: 'PSC Sub', person_name: '', agency: '' },
    { position_key: 'psc-docl', position_title: 'Documentation Unit Leader', abbreviation: 'DOCL', section: 'PSC Sub', person_name: '', agency: '' },
    { position_key: 'psc-dmob', position_title: 'Demobilization Unit Leader', abbreviation: 'DMOB', section: 'PSC Sub', person_name: '', agency: '' },
  ],
  lsc: [
    { position_key: 'lsc-spul', position_title: 'Supply Unit Leader', abbreviation: 'SPUL', section: 'LSC Sub', person_name: '', agency: '' },
    { position_key: 'lsc-facl', position_title: 'Facilities Unit Leader', abbreviation: 'FACL', section: 'LSC Sub', person_name: '', agency: '' },
    { position_key: 'lsc-gsul', position_title: 'Ground Support Unit Leader', abbreviation: 'GSUL', section: 'LSC Sub', person_name: '', agency: '' },
    { position_key: 'lsc-coml', position_title: 'Communications Unit Leader', abbreviation: 'COML', section: 'LSC Sub', person_name: '', agency: '' },
    { position_key: 'lsc-medl', position_title: 'Medical Unit Leader', abbreviation: 'MEDL', section: 'LSC Sub', person_name: '', agency: '' },
    { position_key: 'lsc-fdul', position_title: 'Food Unit Leader', abbreviation: 'FDUL', section: 'LSC Sub', person_name: '', agency: '' },
  ],
  fasc: [
    { position_key: 'fasc-time', position_title: 'Time Unit Leader', abbreviation: 'TIME', section: 'FASC Sub', person_name: '', agency: '' },
    { position_key: 'fasc-comp', position_title: 'Compensation/Claims Unit Leader', abbreviation: 'COMP', section: 'FASC Sub', person_name: '', agency: '' },
    { position_key: 'fasc-cost', position_title: 'Cost Unit Leader', abbreviation: 'COST', section: 'FASC Sub', person_name: '', agency: '' },
    { position_key: 'fasc-proc', position_title: 'Procurement Unit Leader', abbreviation: 'PROC', section: 'FASC Sub', person_name: '', agency: '' },
  ],
}

const SUPPORT_POSITIONS: Record<string, { title: string; abbr: string; type: 'deputy' | 'assistant' }> = {
  ic:    { title: 'Deputy Incident Commander', abbr: 'DIC', type: 'deputy' },
  pio:   { title: 'Assistant PIO',  abbr: 'A-PIO',  type: 'assistant' },
  sofr:  { title: 'Assistant SOFR', abbr: 'A-SOFR', type: 'assistant' },
  lofr:  { title: 'Assistant LOFR', abbr: 'A-LOFR', type: 'assistant' },
  osc:   { title: 'Deputy OSC',  abbr: 'D-OSC',  type: 'deputy' },
  psc:   { title: 'Deputy PSC',  abbr: 'D-PSC',  type: 'deputy' },
  lsc:   { title: 'Deputy LSC',  abbr: 'D-LSC',  type: 'deputy' },
  fasc:  { title: 'Deputy FASC', abbr: 'D-FASC', type: 'deputy' },
  branch: { title: 'Deputy Branch Director', abbr: 'D-BR', type: 'deputy' },
  unit:   { title: 'Assistant Unit Leader', abbr: 'A-UL', type: 'assistant' },
  st:     { title: 'Assistant ST Leader', abbr: 'A-STL', type: 'assistant' },
  tf:     { title: 'Assistant TF Leader',  abbr: 'A-TFL', type: 'assistant' },
  sr:     { title: 'Assistant SR Leader',  abbr: 'A-SRL', type: 'assistant' },
}

type OscSubType = 'branch' | 'division' | 'group'
type GroupChildType = 'tf' | 'st' | 'sr'

const OSC_SUB_TYPE_LABELS: Record<OscSubType, string> = {
  branch: 'Branch',
  division: 'Division',
  group: 'Group',
}

const OSC_SUB_TYPE_ABBR: Record<OscSubType, string> = {
  branch: 'BR',
  division: 'DIV',
  group: 'GR',
}

export default function Ics207Form() {
  const { id: incidentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [formId, setFormId] = useState<string | null>(null)
  const [formType, setFormType] = useState<'standard' | 'expanded'>('standard')
  const [incidentName, setIncidentName] = useState('')
  const [positions, setPositions] = useState<Position[]>(DEFAULT_POSITIONS)
  const [preparedBy, setPreparedBy] = useState('')
  const [datePrepared, setDatePrepared] = useState('')
  const [timePrepared, setTimePrepared] = useState('')
  const [status, setStatus] = useState<'Draft' | 'Submitted'>('Draft')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  const [allPersonnel, setAllPersonnel] = useState<PersonnelWithAgency[]>([])
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)
  const [personnelFilter, setPersonnelFilter] = useState('All')
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [oscSubType, setOscSubType] = useState<OscSubType>('branch')
  const [oscSubName, setOscSubName] = useState('')
  const [groupChildType, setGroupChildType] = useState<GroupChildType>('tf')

  const [supportCount, setSupportCount] = useState<Record<string, number>>({})
  const [branchCount, setBranchCount] = useState(0)
  const [divisionCount, setDivisionCount] = useState(0)
  const [groupCount, setGroupCount] = useState(0)
  const [tfCount, setTfCount] = useState(0)
  const [stCount, setStCount] = useState(0)
  const [srCount, setSrCount] = useState(0)
  const [unitSubCount, setUnitSubCount] = useState<Record<string, number>>({})
  const [techSpecCount, setTechSpecCount] = useState(0)
  const [agencyRepCount, setAgencyRepCount] = useState(0)
  const [showExpandedExport, setShowExpandedExport] = useState(false)

  const [branchName, setBranchName] = useState('')
  const [divisionName, setDivisionName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [tfName, setTfName] = useState('')
  const [tfAbbr, setTfAbbr] = useState('')
  const [stName, setStName] = useState('')
  const [stAbbr, setStAbbr] = useState('')
  const [srName, setSrName] = useState('')
  const [srAbbr, setSrAbbr] = useState('')
  const [unitSubTitle, setUnitSubTitle] = useState('')
  const [unitSubAbbr, setUnitSubAbbr] = useState('')
  const [techSpecTitle, setTechSpecTitle] = useState('')
  const [agencyRepName, setAgencyRepName] = useState('')

  useEffect(() => {
    if (!user) return
    const now = new Date()
    setPreparedBy(user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email || '')
    setDatePrepared(now.toISOString().slice(0, 10))
    setTimePrepared(now.toTimeString().slice(0, 5))
    loadForm()
    loadPersonnel()
  }, [incidentId, user, searchParams, formType])

  const loadForm = async () => {
    if (!incidentId) return
    setLoading(true)

    const { data: incident } = await supabase
      .from('incidents')
      .select('name')
      .eq('incident_id', incidentId)
      .single()
    if (incident) setIncidentName(incident.name)

    const formParam = searchParams.get('form')

    let formToLoad = null

    if (formParam) {
      const { data: form } = await supabase
        .from('ics_207_forms')
        .select('*')
        .eq('id', formParam)
        .single()
      formToLoad = form
    } else {
      const { data: existingForm } = await supabase
        .from('ics_207_forms')
        .select('*')
        .eq('incident_id', incidentId)
        .eq('form_type', formType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      formToLoad = existingForm
    }

    if (formToLoad) {
      setFormId(formToLoad.id)
      setFormType(formToLoad.form_type || 'standard')
      setIncidentName(formToLoad.incident_name)
      setPreparedBy(formToLoad.prepared_by)
      setDatePrepared(formToLoad.date_prepared)
      setTimePrepared(formToLoad.time_prepared)
      setStatus(formToLoad.status)

      const { data: posData } = await supabase
        .from('ics_207_positions')
        .select('*')
        .eq('form_id', formToLoad.id)
        .order('sort_order')

      if (posData && posData.length > 0) {
        setPositions(posData.map(({ position_key, position_title, abbreviation, section, person_name, agency }) => ({
          position_key, position_title, abbreviation, section, person_name, agency
        })))
        restoreCounters(posData.map(({ position_key, position_title, abbreviation, section, person_name, agency }) => ({
          position_key, position_title, abbreviation, section, person_name, agency
        })))
      }
    } else {
      setPositions(DEFAULT_POSITIONS)
    }

    setLoading(false)
  }

  const restoreCounters = (loadedPositions: Position[]) => {
    const newSupportCount: Record<string, number> = {}
    let newBranchCount = 0
    let newDivisionCount = 0
    let newGroupCount = 0
    let newTfCount = 0
    let newStCount = 0
    let newSrCount = 0
    const newUnitSubCount: Record<string, number> = {}
    let newTechSpecCount = 0
    let newAgencyRepCount = 0

    for (const pos of loadedPositions) {
      if (pos.section.endsWith(' Support')) {
        const parentKey = pos.section.replace(' Support', '')
        newSupportCount[parentKey] = (newSupportCount[parentKey] || 0) + 1
      }
      if (pos.section === 'OSC Branch') newBranchCount++
      if (pos.section === 'OSC Division') newDivisionCount++
      if (pos.section === 'OSC Group') newGroupCount++
      if (pos.section === 'OSC Task Force') newTfCount++
      if (pos.section === 'OSC Strike Team') newStCount++
      if (pos.section === 'OSC Single Resource') newSrCount++
      if (pos.section.endsWith(' Sub') && pos.position_key.includes('-sub')) {
        const unitKey = pos.section.replace(' Sub', '')
        newUnitSubCount[unitKey] = (newUnitSubCount[unitKey] || 0) + 1
      }
      if (pos.section === 'PSC Tech Specialist') newTechSpecCount++
      if (pos.section === 'PSC Agency Rep') newAgencyRepCount++
    }

    setSupportCount(newSupportCount)
    setBranchCount(newBranchCount)
    setDivisionCount(newDivisionCount)
    setGroupCount(newGroupCount)
    setTfCount(newTfCount)
    setStCount(newStCount)
    setSrCount(newSrCount)
    setUnitSubCount(newUnitSubCount)
    setTechSpecCount(newTechSpecCount)
    setAgencyRepCount(newAgencyRepCount)
  }

  const loadPersonnel = async () => {
    if (!incidentId) return

    const { data: manifests } = await supabase
      .from('checkin_manifests')
      .select('id, agency_name, user_id')
      .eq('incident_id', incidentId)
      .eq('status', 'Submitted')

    if (!manifests || manifests.length === 0) return

    const manifestIds = manifests.map((m) => m.id)
    const { data: personnel } = await supabase
      .from('checkin_personnel')
      .select('*')
      .in('manifest_id', manifestIds)

    const userIds = [...new Set(manifests.map((m) => m.user_id).filter(Boolean))]
    const { data: participants } = await supabase
      .from('incident_participants')
      .select('user_id, role')
      .eq('incident_id', incidentId)
      .eq('status', 'Active')
      .in('user_id', userIds)

    const participantMap = new Map((participants || []).map((p) => [p.user_id, p.role]))
    const manifestMap = new Map(manifests.map((m) => [m.id, m]))

    if (personnel) {
      setAllPersonnel(personnel.map((p) => {
        const manifest = manifestMap.get(p.manifest_id)
        return {
          id: p.id,
          manifest_id: p.manifest_id,
          role: p.role,
          name: p.name,
          agency: manifest?.agency_name || '',
          capabilities: p.capabilities,
          participant_role: participantMap.get(manifest?.user_id) || '',
        }
      }))
    }
  }

  const assignPersonToPosition = (positionKey: string, personName: string, agency: string) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.position_key === positionKey ? { ...p, person_name: personName, agency } : p
      )
    )
    setSelectedPosition(null)
  }

  const clearPosition = (positionKey: string) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.position_key === positionKey ? { ...p, person_name: '', agency: '' } : p
      )
    )
  }

  const addSubPosition = (_parentKey: string, subPosition: Position) => {
    setPositions((prev) => [...prev, subPosition])
    setAddingTo(null)
  }

  const addOscSubPosition = () => {
    const oscSubs = positions.filter((p) => p.position_key.startsWith('osc-') && p.position_key !== 'osc-stam')
    const nextNum = oscSubs.length + 1
    const abbr = OSC_SUB_TYPE_ABBR[oscSubType]
    const newSub: Position = {
      position_key: `osc-${abbr.toLowerCase()}${nextNum}`,
      position_title: oscSubName || `${OSC_SUB_TYPE_LABELS[oscSubType]} ${nextNum}`,
      abbreviation: `${abbr}${nextNum}`,
      section: 'OSC Sub',
      person_name: '',
      agency: '',
    }
    setPositions((prev) => [...prev, newSub])
    setAddingTo(null)
    setOscSubName('')
  }

  const removeSubPosition = (positionKey: string) => {
    setPositions((prev) => prev.filter((p) => p.position_key !== positionKey))
  }

  const getAvailableSubs = (parentKey: string) => {
    const subs = formType === 'expanded' ? EXPANDED_SUB_OPTIONS : SUB_POSITION_OPTIONS
    const options = subs[parentKey] || []
    const activeKeys = positions.map((p) => p.position_key)
    return options.filter((opt) => !activeKeys.includes(opt.position_key))
  }

  const addSupport = (parentKey: string) => {
    const def = SUPPORT_POSITIONS[parentKey]
    if (!def) return
    const count = (supportCount[parentKey] || 0) + 1
    const suffix = count > 1 ? ` ${count}` : ''
    const newSub: Position = {
      position_key: `${parentKey}-sup${count}`,
      position_title: `${def.title}${suffix}`,
      abbreviation: `${def.abbr}${suffix}`,
      section: `${parentKey} Support`,
      person_name: '',
      agency: '',
    }
    setPositions((prev) => [...prev, newSub])
    setSupportCount((prev) => ({ ...prev, [parentKey]: count }))
    setAddingTo(null)
  }

  const addBranch = () => {
    const next = branchCount + 1
    const newBranch: Position = {
      position_key: `branch${next}`,
      position_title: branchName || `Branch ${next}`,
      abbreviation: `BR${next}`,
      section: 'OSC Branch',
      person_name: '',
      agency: '',
    }
    setPositions((prev) => [...prev, newBranch])
    setBranchCount(next)
    setAddingTo(null)
    setBranchName('')
  }

  const addDivision = () => {
    const next = divisionCount + 1
    const newDiv: Position = {
      position_key: `div${next}`,
      position_title: divisionName || `Division ${next}`,
      abbreviation: `DIV${next}`,
      section: 'OSC Division',
      person_name: '',
      agency: '',
    }
    setPositions((prev) => [...prev, newDiv])
    setDivisionCount(next)
    setAddingTo(null)
    setDivisionName('')
  }

  const addGroup = () => {
    const next = groupCount + 1
    const newGrp: Position = {
      position_key: `grp${next}`,
      position_title: groupName || `Group ${next}`,
      abbreviation: `GRP${next}`,
      section: 'OSC Group',
      person_name: '',
      agency: '',
    }
    setPositions((prev) => [...prev, newGrp])
    setGroupCount(next)
    setAddingTo(null)
    setGroupName('')
  }

  const addTaskForce = () => {
    const next = tfCount + 1
    const newTf: Position = {
      position_key: `tf${next}`,
      position_title: tfName || `Task Force ${next}`,
      abbreviation: tfAbbr || `TF${next}`,
      section: 'OSC Task Force',
      person_name: '',
      agency: '',
    }
    setPositions((prev) => [...prev, newTf])
    setTfCount(next)
    setAddingTo(null)
    setTfName('')
    setTfAbbr('')
  }

  const addStrikeTeam = () => {
    const next = stCount + 1
    const newSt: Position = {
      position_key: `st${next}`,
      position_title: stName || `Strike Team ${next}`,
      abbreviation: stAbbr || `ST${next}`,
      section: 'OSC Strike Team',
      person_name: '',
      agency: '',
    }
    setPositions((prev) => [...prev, newSt])
    setStCount(next)
    setAddingTo(null)
    setStName('')
    setStAbbr('')
  }

  const addSingleResource = () => {
    if (!srName.trim()) return
    const next = srCount + 1
    const newSr: Position = {
      position_key: `sr${next}`,
      position_title: srName,
      abbreviation: srAbbr || `SR${next}`,
      section: 'OSC Single Resource',
      person_name: '',
      agency: '',
    }
    setPositions((prev) => [...prev, newSr])
    setSrCount(next)
    setAddingTo(null)
    setSrName('')
    setSrAbbr('')
  }

  const addUnitSubFunction = (unitKey: string) => {
    if (!unitSubTitle.trim()) return
    const next = (unitSubCount[unitKey] || 0) + 1
    const newSub: Position = {
      position_key: `${unitKey}-sub${next}`,
      position_title: unitSubTitle,
      abbreviation: unitSubAbbr || `${next}`,
      section: `${unitKey} Sub`,
      person_name: '',
      agency: '',
    }
    setPositions((prev) => [...prev, newSub])
    setUnitSubCount((prev) => ({ ...prev, [unitKey]: next }))
    setAddingTo(null)
    setUnitSubTitle('')
    setUnitSubAbbr('')
  }

  const addTechSpecialist = () => {
    if (!techSpecTitle.trim()) return
    const next = techSpecCount + 1
    const newSpec: Position = {
      position_key: `psc-tsp${next}`,
      position_title: techSpecTitle,
      abbreviation: `TSP${next}`,
      section: 'PSC Tech Specialist',
      person_name: '',
      agency: '',
    }
    setPositions((prev) => [...prev, newSpec])
    setTechSpecCount(next)
    setAddingTo(null)
    setTechSpecTitle('')
  }

  const addAgencyRep = () => {
    if (!agencyRepName.trim()) return
    const next = agencyRepCount + 1
    const newRep: Position = {
      position_key: `psc-agency${next}`,
      position_title: `${agencyRepName} Representative`,
      abbreviation: `OAR${next}`,
      section: 'PSC Agency Rep',
      person_name: '',
      agency: agencyRepName,
    }
    setPositions((prev) => [...prev, newRep])
    setAgencyRepCount(next)
    setAddingTo(null)
    setAgencyRepName('')
  }

  const switchToTab = async (newType: 'standard' | 'expanded') => {
    if (newType === formType) return

    if (newType === 'expanded' && formType === 'standard') {
      const confirmed = window.confirm(
        'Switch to Expanded 207? Your current Standard 207 positions will be carried over.'
      )
      if (!confirmed) return
      await saveForm(status)
      setFormType('expanded')
    } else if (newType === 'standard' && formType === 'expanded') {
      const confirmed = window.confirm(
        'Switch to Standard 207? Expanded-only positions will be removed.'
      )
      if (!confirmed) return
      const standardKeys = DEFAULT_POSITIONS.map(p => p.position_key)
      const standardSubKeys = Object.values(SUB_POSITION_OPTIONS).flat().map(p => p.position_key)
      const allowedKeys = [...standardKeys, ...standardSubKeys]
      setPositions(prev => prev.filter(p => allowedKeys.includes(p.position_key)))
      setFormType('standard')
    }
  }

  const saveForm = async (formStatus: 'Draft' | 'Submitted') => {
    if (!incidentId || !user) return
    setSaving(true)
    setError('')
    setSuccess('')

    const now = new Date()
    const formData = {
      incident_id: incidentId,
      incident_name: incidentName,
      form_type: formType,
      status: formStatus,
      prepared_by: preparedBy,
      date_prepared: formStatus === 'Submitted' ? now.toISOString().slice(0, 10) : datePrepared,
      time_prepared: formStatus === 'Submitted' ? now.toTimeString().slice(0, 5) : timePrepared,
      updated_at: now.toISOString(),
    }

    let fId = formId

    if (fId) {
      const { error: updateError } = await supabase.from('ics_207_forms').update(formData).eq('id', fId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ics_207_forms')
        .insert(formData)
        .select()
        .single()
      if (insertError) { setError(insertError.message); setSaving(false); return }
      fId = inserted.id
      setFormId(fId)
    }

    await supabase.from('ics_207_positions').delete().eq('form_id', fId)

    const posRows = positions.map((p, i) => ({
      form_id: fId!,
      position_key: p.position_key,
      position_title: p.position_title,
      abbreviation: p.abbreviation,
      section: p.section,
      person_name: p.person_name,
      agency: p.agency,
      sort_order: i,
    }))
    const { error: posError } = await supabase.from('ics_207_positions').insert(posRows)
    if (posError) { setError(posError.message); setSaving(false); return }

    setSaving(false)
    setStatus(formStatus)
    setSuccess(formStatus === 'Draft' ? 'Progress saved as draft.' : 'ICS Form 207 submitted successfully!')
  }

  const assignedPersonnel = positions.filter((p) => p.person_name).map((p) => p.person_name)
  const icPosition = positions.find((p) => p.position_key === 'ic')
  const commandStaff = positions.filter((p) => p.section === 'Command Staff')
  const oscPosition = positions.find((p) => p.position_key === 'osc')
  const oscSub = positions.filter((p) => p.section === 'OSC Sub')
  const oscBranches = positions.filter((p) => p.section === 'OSC Branch')
  const oscDivisions = positions.filter((p) => p.section === 'OSC Division')
  const oscGroups = positions.filter((p) => p.section === 'OSC Group')
  const oscTF = positions.filter((p) => p.section === 'OSC Task Force')
  const oscST = positions.filter((p) => p.section === 'OSC Strike Team')
  const oscSR = positions.filter((p) => p.section === 'OSC Single Resource')
  const pscPosition = positions.find((p) => p.position_key === 'psc')
  const pscSub = positions.filter((p) => p.section === 'PSC Sub')
  const pscTechSpec = positions.filter((p) => p.section === 'PSC Tech Specialist')
  const pscAgencyRep = positions.filter((p) => p.section === 'PSC Agency Rep')
  const lscPosition = positions.find((p) => p.position_key === 'lsc')
  const lscSub = positions.filter((p) => p.section === 'LSC Sub')
  const fascPosition = positions.find((p) => p.position_key === 'fasc')
  const fascSub = positions.filter((p) => p.section === 'FASC Sub')

  const allPscExpanded = [...pscSub, ...pscTechSpec]

  const filteredPersonnel = (() => {
    let pool = allPersonnel
    if (personnelFilter !== 'All') {
      pool = pool.filter((p) => p.role === personnelFilter)
    }
    return pool
  })()

  if (loading) {
    return (
      <div className="ics207-page">
        <div className="ics207-loading">Loading ICS Form 207...</div>
      </div>
    )
  }

  const renderPositionCard = (pos: Position, accentClass: string, isSub = false) => {
    const isSelected = selectedPosition === pos.position_key
    return (
      <div
        key={pos.position_key}
        className={`position-card ${accentClass} ${isSelected ? 'selected' : ''} ${pos.person_name ? 'filled' : ''}`}
        onClick={() => setSelectedPosition(isSelected ? null : pos.position_key)}
      >
        <div className="card-top">
          <span className="card-abbr">{pos.abbreviation}</span>
          <div className="card-top-actions">
            {pos.person_name && (
              <button className="card-clear" onClick={(e) => { e.stopPropagation(); clearPosition(pos.position_key) }}>&times;</button>
            )}
            {isSub && (
              <button className="card-remove" onClick={(e) => { e.stopPropagation(); removeSubPosition(pos.position_key) }}>&times;</button>
            )}
          </div>
        </div>
        <div className="card-title">{pos.position_title}</div>
        {pos.person_name ? (
          <div className="card-person">
            <span className="card-person-name">{pos.person_name}</span>
            {pos.agency && <span className="card-person-agency">{pos.agency}</span>}
          </div>
        ) : (
          <div className="card-empty">Click a person from the pool to assign</div>
        )}
      </div>
    )
  }

  const renderSupportButton = (parentKey: string) => {
    if (formType !== 'expanded') return null
    const def = SUPPORT_POSITIONS[parentKey]
    if (!def) return null
    const existingCount = positions.filter(p => p.section === `${parentKey} Support`).length
    if (existingCount > 0) return null
    return (
      <div className="cards-add">
        <button className="add-support-btn" onClick={() => addSupport(parentKey)}>
          + {def.title}
        </button>
      </div>
    )
  }

  const renderOscExpandedAddButtons = () => {
    if (formType !== 'expanded') return null
    return (
      <div className="expanded-add-section">
        <div className="expanded-add-row">
          {addingTo === 'osc-branch' ? (
            <div className="sub-position-picker">
              <div className="picker-label">Add Branch:</div>
              <input type="text" placeholder="Branch name (e.g., Air Operations)" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
              <div className="picker-actions">
                <button className="picker-confirm" onClick={addBranch}>Add</button>
                <button className="picker-cancel" onClick={() => { setAddingTo(null); setBranchName('') }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="add-position-btn" onClick={() => setAddingTo('osc-branch')}>+ Branch</button>
          )}
          {addingTo === 'osc-division' ? (
            <div className="sub-position-picker">
              <div className="picker-label">Add Division:</div>
              <input type="text" placeholder="Division name" value={divisionName} onChange={(e) => setDivisionName(e.target.value)} />
              <div className="picker-actions">
                <button className="picker-confirm" onClick={addDivision}>Add</button>
                <button className="picker-cancel" onClick={() => { setAddingTo(null); setDivisionName('') }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="add-position-btn" onClick={() => setAddingTo('osc-division')}>+ Division</button>
          )}
          {addingTo === 'osc-group' ? (
            <div className="sub-position-picker">
              <div className="picker-label">Add Group:</div>
              <input type="text" placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              <div className="picker-actions">
                <button className="picker-confirm" onClick={addGroup}>Add</button>
                <button className="picker-cancel" onClick={() => { setAddingTo(null); setGroupName('') }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="add-position-btn" onClick={() => setAddingTo('osc-group')}>+ Group</button>
          )}
        </div>
        <div className="expanded-add-row">
          {addingTo === 'osc-tf' ? (
            <div className="sub-position-picker">
              <div className="picker-label">Add Task Force:</div>
              <input type="text" placeholder="Name (e.g., Restoration TF)" value={tfName} onChange={(e) => setTfName(e.target.value)} />
              <input type="text" placeholder="Abbreviation (e.g., RSTF)" value={tfAbbr} onChange={(e) => setTfAbbr(e.target.value)} />
              <div className="picker-actions">
                <button className="picker-confirm" onClick={addTaskForce}>Add</button>
                <button className="picker-cancel" onClick={() => { setAddingTo(null); setTfName(''); setTfAbbr('') }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="add-position-btn" onClick={() => setAddingTo('osc-tf')}>+ Task Force</button>
          )}
          {addingTo === 'osc-st' ? (
            <div className="sub-position-picker">
              <div className="picker-label">Add Strike Team:</div>
              <input type="text" placeholder="Name (e.g., PNP ST)" value={stName} onChange={(e) => setStName(e.target.value)} />
              <input type="text" placeholder="Abbreviation (e.g., PNP)" value={stAbbr} onChange={(e) => setStAbbr(e.target.value)} />
              <div className="picker-actions">
                <button className="picker-confirm" onClick={addStrikeTeam}>Add</button>
                <button className="picker-cancel" onClick={() => { setAddingTo(null); setStName(''); setStAbbr('') }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="add-position-btn" onClick={() => setAddingTo('osc-st')}>+ Strike Team</button>
          )}
          {addingTo === 'osc-sr' ? (
            <div className="sub-position-picker">
              <div className="picker-label">Add Single Resource:</div>
              <input type="text" placeholder="Name (e.g., EMT)" value={srName} onChange={(e) => setSrName(e.target.value)} />
              <input type="text" placeholder="Abbreviation (e.g., EMT)" value={srAbbr} onChange={(e) => setSrAbbr(e.target.value)} />
              <div className="picker-actions">
                <button className="picker-confirm" onClick={addSingleResource}>Add</button>
                <button className="picker-cancel" onClick={() => { setAddingTo(null); setSrName(''); setSrAbbr('') }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="add-position-btn" onClick={() => setAddingTo('osc-sr')}>+ Single Resource</button>
          )}
        </div>
      </div>
    )
  }

  const renderUnitSubFunctionAdders = () => {
    if (formType !== 'expanded') return null
    const units = pscSub.filter(p => p.section === 'PSC Sub')
    return (
      <div className="unit-sub-sections">
        {units.map(unit => (
          <div key={unit.position_key} className="unit-sub-row">
            <span className="unit-sub-label">{unit.abbreviation}</span>
            {addingTo === `sub-${unit.position_key}` ? (
              <div className="sub-position-picker inline">
                <input type="text" placeholder="Sub-function name" value={unitSubTitle} onChange={(e) => setUnitSubTitle(e.target.value)} />
                <input type="text" placeholder="Abbreviation" value={unitSubAbbr} onChange={(e) => setUnitSubAbbr(e.target.value)} />
                <div className="picker-actions">
                  <button className="picker-confirm" onClick={() => addUnitSubFunction(unit.position_key)}>Add</button>
                  <button className="picker-cancel" onClick={() => { setAddingTo(null); setUnitSubTitle(''); setUnitSubAbbr('') }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="add-sub-fn-btn" onClick={() => setAddingTo(`sub-${unit.position_key}`)}>+ Add Sub-Function</button>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="ics207-page">
      <header className="ics207-header no-print">
        <div className="header-brand" onClick={() => navigate(`/incident/${incidentId}`)} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="ics207-topbar no-print">
        <button className="topbar-btn back" onClick={() => navigate(`/incident/${incidentId}`)}>&larr; Back</button>
        <div className="topbar-info">
          <span className="form-badge">ICS 207</span>
          <div className="form-type-tabs">
            <button className={`form-type-tab ${formType === 'standard' ? 'active' : ''}`} onClick={() => switchToTab('standard')}>Standard</button>
            <button className={`form-type-tab ${formType === 'expanded' ? 'active' : ''}`} onClick={() => switchToTab('expanded')}>Expanded</button>
          </div>
          <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
        </div>
        <div className="topbar-actions">
          <button className="action-btn save" onClick={() => saveForm('Draft')} disabled={saving}>
            {saving ? 'Saving...' : 'Save Progress'}
          </button>
          <button className="action-btn submit" onClick={() => saveForm('Submitted')} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit'}
          </button>
          {formType === 'expanded' ? (
            <button className="action-btn export" onClick={() => setShowExpandedExport(true)} disabled={saving}>Export</button>
          ) : (
            <button className="action-btn print" onClick={() => setShowPrint(true)} disabled={saving}>Print</button>
          )}
        </div>
      </div>

      <main className="ics207-main no-print">
        <div className="ics207-layout">
          <div className="ics207-content">
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="form-header-section">
              <h2>INCIDENT ORGANIZATION CHART</h2>
              <h3>ICS 207 {formType === 'expanded' ? '- Expanded' : ''}</h3>
            </div>

            <div className="form-top-row">
              <div className="form-field wide">
                <label>1. INCIDENT/EVENT NAME</label>
                <input type="text" value={incidentName} onChange={(e) => setIncidentName(e.target.value)} />
              </div>
            </div>

            <div className="org-cards-section">
              <h4>2. ORGANIZATION</h4>

              {/* ── Command ── */}
              <div className="cards-group">
                <div className="cards-group-label">Command</div>
                <div className="cards-row">
                  {icPosition && renderPositionCard(icPosition, 'card-accent-red')}
                </div>
                {positions.filter(p => p.section === 'ic Support').length > 0 && (
                  <div className="cards-row cards-sub">
                    {positions.filter(p => p.section === 'ic Support').map(pos => renderPositionCard(pos, 'card-accent-support', true))}
                  </div>
                )}
                {renderSupportButton('ic')}
              </div>

              {/* ── Command Staff ── */}
              <div className="cards-group">
                <div className="cards-group-label">Command Staff</div>
                <div className="cards-row">
                  {commandStaff.map((pos) => (
                    <div key={pos.position_key} className="card-with-support">
                      {renderPositionCard(pos, 'card-accent-blue')}
                      {positions.filter(p => p.section === `${pos.position_key} Support`).map(s => (
                        <div key={s.position_key} className="card-support-inline">
                          {renderPositionCard(s, 'card-accent-support', true)}
                        </div>
                      ))}
                      {renderSupportButton(pos.position_key)}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Operations Section ── */}
              <div className="cards-group">
                <div className="cards-group-label">Operations Section</div>
                <div className="cards-row">
                  {oscPosition && renderPositionCard(oscPosition, 'card-accent-green')}
                </div>
                {renderSupportButton('osc')}

                <div className="cards-row cards-sub">
                  {oscSub.map((pos) => renderPositionCard(pos, 'card-accent-green-sub', true))}
                </div>

                {formType === 'expanded' && oscBranches.length > 0 && (
                  <div className="osc-hierarchy-section">
                    <div className="hierarchy-label">Branches</div>
                    {oscBranches.map(branch => (
                      <div key={branch.position_key} className="hierarchy-group">
                        {renderPositionCard(branch, 'card-accent-green-sub', true)}
                      </div>
                    ))}
                  </div>
                )}

                {formType === 'expanded' && oscDivisions.length > 0 && (
                  <div className="osc-hierarchy-section">
                    <div className="hierarchy-label">Divisions</div>
                    <div className="cards-row cards-sub">
                      {oscDivisions.map(pos => renderPositionCard(pos, 'card-accent-green-sub', true))}
                    </div>
                  </div>
                )}

                {formType === 'expanded' && oscGroups.length > 0 && (
                  <div className="osc-hierarchy-section">
                    <div className="hierarchy-label">Groups</div>
                    {oscGroups.map(group => {
                      const groupChildren = positions.filter(p => p.parent_key === group.position_key)
                      return (
                        <div key={group.position_key} className="hierarchy-group">
                          {renderPositionCard(group, 'card-accent-green-sub', true)}
                          {groupChildren.length > 0 && (
                            <div className="cards-row cards-sub hierarchy-children">
                              {groupChildren.map(child => renderPositionCard(child, 'card-accent-green-sub', true))}
                            </div>
                          )}
                          <div className="hierarchy-add-child">
                            {addingTo === `group-child-${group.position_key}` ? (
                              <div className="sub-position-picker inline">
                                <select value={groupChildType} onChange={(e) => setGroupChildType(e.target.value as GroupChildType)}>
                                  <option value="tf">Task Force</option>
                                  <option value="st">Strike Team</option>
                                  <option value="sr">Single Resource</option>
                                </select>
                                <input type="text" placeholder="Name" value={tfName} onChange={(e) => setTfName(e.target.value)} />
                                <input type="text" placeholder="Abbr" value={tfAbbr} onChange={(e) => setTfAbbr(e.target.value)} />
                                <div className="picker-actions">
                                  <button className="picker-confirm" onClick={() => {
                                    if (groupChildType === 'tf') { const n = tfCount+1; setPositions(prev=>[...prev,{position_key:`tf${n}`,position_title:tfName||`Task Force ${n}`,abbreviation:tfAbbr||`TF${n}`,section:'OSC Task Force',person_name:'',agency:'',parent_key:group.position_key}]); setTfCount(n) }
                                    else if (groupChildType === 'st') { const n = stCount+1; setPositions(prev=>[...prev,{position_key:`st${n}`,position_title:stName||`Strike Team ${n}`,abbreviation:stAbbr||`ST${n}`,section:'OSC Strike Team',person_name:'',agency:'',parent_key:group.position_key}]); setStCount(n) }
                                    else { const n = srCount+1; if(srName.trim()){setPositions(prev=>[...prev,{position_key:`sr${n}`,position_title:srName,abbreviation:srAbbr||`SR${n}`,section:'OSC Single Resource',person_name:'',agency:'',parent_key:group.position_key}]); setSrCount(n)} }
                                    setAddingTo(null); setTfName(''); setTfAbbr(''); setSrName(''); setSrAbbr('')
                                  }}>Add</button>
                                  <button className="picker-cancel" onClick={() => { setAddingTo(null); setTfName(''); setTfAbbr(''); setSrName(''); setSrAbbr('') }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button className="add-sub-fn-btn" onClick={() => setAddingTo(`group-child-${group.position_key}`)}>+ Add TF/ST/SR</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {formType === 'expanded' && oscTF.filter(p => !p.parent_key).length > 0 && (
                  <div className="osc-hierarchy-section">
                    <div className="hierarchy-label">Task Forces (unassigned)</div>
                    <div className="cards-row cards-sub">
                      {oscTF.filter(p => !p.parent_key).map(pos => renderPositionCard(pos, 'card-accent-green-sub', true))}
                    </div>
                  </div>
                )}

                {formType === 'expanded' && oscST.filter(p => !p.parent_key).length > 0 && (
                  <div className="osc-hierarchy-section">
                    <div className="hierarchy-label">Strike Teams (unassigned)</div>
                    <div className="cards-row cards-sub">
                      {oscST.filter(p => !p.parent_key).map(pos => renderPositionCard(pos, 'card-accent-green-sub', true))}
                    </div>
                  </div>
                )}

                {formType === 'expanded' && oscSR.filter(p => !p.parent_key).length > 0 && (
                  <div className="osc-hierarchy-section">
                    <div className="hierarchy-label">Single Resources (unassigned)</div>
                    <div className="cards-row cards-sub">
                      {oscSR.filter(p => !p.parent_key).map(pos => renderPositionCard(pos, 'card-accent-green-sub', true))}
                    </div>
                  </div>
                )}

                {positions.filter(p => p.section === 'osc Support').length > 0 && (
                  <div className="cards-row cards-sub">
                    {positions.filter(p => p.section === 'osc Support').map(pos => renderPositionCard(pos, 'card-accent-support', true))}
                  </div>
                )}

                {formType === 'standard' ? (
                  <div className="cards-add">
                    {addingTo === 'osc' ? (
                      <div className="sub-position-picker osc-picker">
                        <div className="picker-label">Add Branch/Division/Group:</div>
                        <div className="osc-type-row">
                          {(['branch', 'division', 'group'] as OscSubType[]).map((type) => (
                            <button key={type} className={`osc-type-btn ${oscSubType === type ? 'active' : ''}`} onClick={() => setOscSubType(type)}>
                              {OSC_SUB_TYPE_LABELS[type]}
                            </button>
                          ))}
                        </div>
                        <input type="text" className="osc-name-input" placeholder={`${OSC_SUB_TYPE_LABELS[oscSubType]} name (e.g., Air Operations)`} value={oscSubName} onChange={(e) => setOscSubName(e.target.value)} />
                        <div className="picker-actions">
                          <button className="picker-confirm" onClick={addOscSubPosition}>Add</button>
                          <button className="picker-cancel" onClick={() => { setAddingTo(null); setOscSubName('') }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="add-position-btn" onClick={() => setAddingTo('osc')}>+ Add Branch/Division/Group</button>
                    )}
                  </div>
                ) : (
                  renderOscExpandedAddButtons()
                )}
              </div>

              {/* ── Planning Section ── */}
              <div className="cards-group">
                <div className="cards-group-label">Planning Section</div>
                <div className="cards-row">
                  {pscPosition && renderPositionCard(pscPosition, 'card-accent-purple')}
                </div>

                {positions.filter(p => p.section === 'psc Support').length > 0 && (
                  <div className="cards-row cards-sub">
                    {positions.filter(p => p.section === 'psc Support').map(pos => renderPositionCard(pos, 'card-accent-support', true))}
                  </div>
                )}
                {renderSupportButton('psc')}
                <div className="cards-row cards-sub">
                  {(formType === 'expanded' ? allPscExpanded : pscSub).map((pos) => renderPositionCard(pos, 'card-accent-purple-sub', true))}
                </div>

                {formType === 'expanded' && renderUnitSubFunctionAdders()}

                {formType === 'expanded' && pscTechSpec.length > 0 && (
                  <div className="cards-row cards-sub">
                    {pscTechSpec.map(pos => renderPositionCard(pos, 'card-accent-purple-sub', true))}
                  </div>
                )}

                {formType === 'expanded' && (
                  <div className="cards-add">
                    {addingTo === 'psc' ? (
                      <div className="sub-position-picker">
                        <div className="picker-label">Add Position:</div>
                        <div className="picker-options">
                          {getAvailableSubs('psc').map((opt) => (
                            <button key={opt.position_key} className="picker-btn" onClick={() => addSubPosition('psc', opt)}>
                              {opt.abbreviation} - {opt.position_title}
                            </button>
                          ))}
                        </div>
                        <button className="picker-cancel" onClick={() => setAddingTo(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="add-position-btn" onClick={() => setAddingTo('psc')}>+ Add Position</button>
                    )}
                  </div>
                )}

                {formType === 'expanded' && (
                  <div className="cards-add">
                    {addingTo === 'psc-tech' ? (
                      <div className="sub-position-picker">
                        <div className="picker-label">Add Technical Specialist:</div>
                        <input type="text" placeholder="Specialist type (e.g., Structural Engineer)" value={techSpecTitle} onChange={(e) => setTechSpecTitle(e.target.value)} />
                        <div className="picker-actions">
                          <button className="picker-confirm" onClick={addTechSpecialist}>Add</button>
                          <button className="picker-cancel" onClick={() => { setAddingTo(null); setTechSpecTitle('') }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="add-position-btn" onClick={() => setAddingTo('psc-tech')}>+ Add Technical Specialist</button>
                    )}
                  </div>
                )}

                {formType === 'standard' && getAvailableSubs('psc').length > 0 && (
                  <div className="cards-add">
                    {addingTo === 'psc' ? (
                      <div className="sub-position-picker">
                        <div className="picker-label">Add Position:</div>
                        <div className="picker-options">
                          {getAvailableSubs('psc').map((opt) => (
                            <button key={opt.position_key} className="picker-btn" onClick={() => addSubPosition('psc', opt)}>
                              {opt.abbreviation} - {opt.position_title}
                            </button>
                          ))}
                        </div>
                        <button className="picker-cancel" onClick={() => setAddingTo(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="add-position-btn" onClick={() => setAddingTo('psc')}>+ Add Position</button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Logistics Section ── */}
              <div className="cards-group">
                <div className="cards-group-label">Logistics Section</div>
                <div className="cards-row">
                  {lscPosition && renderPositionCard(lscPosition, 'card-accent-teal')}
                </div>

                {positions.filter(p => p.section === 'lsc Support').length > 0 && (
                  <div className="cards-row cards-sub">
                    {positions.filter(p => p.section === 'lsc Support').map(pos => renderPositionCard(pos, 'card-accent-support', true))}
                  </div>
                )}
                {renderSupportButton('lsc')}
                <div className="cards-row cards-sub">
                  {lscSub.map((pos) => renderPositionCard(pos, 'card-accent-teal-sub', true))}
                </div>

                {formType === 'standard' ? (
                  getAvailableSubs('lsc').length > 0 && (
                    <div className="cards-add">
                      {addingTo === 'lsc' ? (
                        <div className="sub-position-picker">
                          <div className="picker-label">Add Position:</div>
                          <div className="picker-options">
                            {getAvailableSubs('lsc').map((opt) => (
                              <button key={opt.position_key} className="picker-btn" onClick={() => addSubPosition('lsc', opt)}>
                                {opt.abbreviation} - {opt.position_title}
                              </button>
                            ))}
                          </div>
                          <button className="picker-cancel" onClick={() => setAddingTo(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="add-position-btn" onClick={() => setAddingTo('lsc')}>+ Add Position</button>
                      )}
                    </div>
                  )
                ) : (
                  getAvailableSubs('lsc').length > 0 && (
                    <div className="cards-add">
                      {addingTo === 'lsc' ? (
                        <div className="sub-position-picker">
                          <div className="picker-label">Add Position:</div>
                          <div className="picker-options">
                            {getAvailableSubs('lsc').map((opt) => (
                              <button key={opt.position_key} className="picker-btn" onClick={() => addSubPosition('lsc', opt)}>
                                {opt.abbreviation} - {opt.position_title}
                              </button>
                            ))}
                          </div>
                          <button className="picker-cancel" onClick={() => setAddingTo(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="add-position-btn" onClick={() => setAddingTo('lsc')}>+ Add Position</button>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* ── Finance/Admin Section ── */}
              <div className="cards-group">
                <div className="cards-group-label">Finance/Admin Section</div>
                <div className="cards-row">
                  {fascPosition && renderPositionCard(fascPosition, 'card-accent-orange')}
                </div>

                {positions.filter(p => p.section === 'fasc Support').length > 0 && (
                  <div className="cards-row cards-sub">
                    {positions.filter(p => p.section === 'fasc Support').map(pos => renderPositionCard(pos, 'card-accent-support', true))}
                  </div>
                )}
                {renderSupportButton('fasc')}
                <div className="cards-row cards-sub">
                  {fascSub.map((pos) => renderPositionCard(pos, 'card-accent-orange-sub', true))}
                </div>

                {getAvailableSubs('fasc').length > 0 && (
                  <div className="cards-add">
                    {addingTo === 'fasc' ? (
                      <div className="sub-position-picker">
                        <div className="picker-label">Add Position:</div>
                        <div className="picker-options">
                          {getAvailableSubs('fasc').map((opt) => (
                            <button key={opt.position_key} className="picker-btn" onClick={() => addSubPosition('fasc', opt)}>
                              {opt.abbreviation} - {opt.position_title}
                            </button>
                          ))}
                        </div>
                        <button className="picker-cancel" onClick={() => setAddingTo(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="add-position-btn" onClick={() => setAddingTo('fasc')}>+ Add Position</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {formType === 'expanded' && (
              <div className="org-cards-section">
                <h4>3. OTHERS / AGENCY REPRESENTATIVES</h4>
                <div className="cards-row">
                  {pscAgencyRep.map(pos => renderPositionCard(pos, 'card-accent-support', true))}
                </div>
                {addingTo === 'psc-agency' ? (
                  <div className="sub-position-picker">
                    <div className="picker-label">Add Other Agency Representative:</div>
                    <input type="text" placeholder="Agency name (e.g., DSWD, DILG, PNP, BFP)" value={agencyRepName} onChange={(e) => setAgencyRepName(e.target.value)} />
                    <div className="picker-actions">
                      <button className="picker-confirm" onClick={addAgencyRep}>Add</button>
                      <button className="picker-cancel" onClick={() => { setAddingTo(null); setAgencyRepName('') }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="cards-add">
                    <button className="add-position-btn" onClick={() => setAddingTo('psc-agency')}>+ Add Agency Representative</button>
                  </div>
                )}
              </div>
            )}

            <div className="form-footer-section">
              <div className="footer-field">
                <label>3. Prepared by:</label>
                <input type="text" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} />
              </div>
              <div className="footer-field">
                <label>Date Prepared:</label>
                <input type="date" value={datePrepared} onChange={(e) => setDatePrepared(e.target.value)} />
              </div>
              <div className="footer-field">
                <label>Time Prepared:</label>
                <input type="time" value={timePrepared} onChange={(e) => setTimePrepared(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="ics207-sidebar">
            <div className="personnel-pool-header">
              <h3>Personnel Pool</h3>
              <select value={personnelFilter} onChange={(e) => setPersonnelFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="Leader">Leaders Only</option>
                <option value="Member">Members Only</option>
              </select>
            </div>

            {selectedPosition && (
              <div className="assignment-indicator">
                Assigning to: <strong>{positions.find((p) => p.position_key === selectedPosition)?.position_title}</strong>
                <button className="cancel-assign-btn" onClick={() => setSelectedPosition(null)}>Cancel</button>
              </div>
            )}

            <div className="personnel-list">
              {filteredPersonnel.map((person) => {
                const isAssigned = assignedPersonnel.includes(person.name)
                const isSelected = selectedPosition !== null
                return (
                  <div
                    key={person.id}
                    className={`personnel-item ${isAssigned ? 'assigned' : ''} ${isSelected && !isAssigned ? 'selectable' : ''}`}
                    onClick={() => {
                      if (selectedPosition && !isAssigned) {
                        assignPersonToPosition(selectedPosition, person.name, person.agency || '')
                      }
                    }}
                  >
                    <div className="person-info">
                      <span className="person-name">{person.name}</span>
                      <span className="person-role">{person.participant_role} - {person.role}</span>
                      {person.agency && <span className="person-agency">{person.agency}</span>}
                      {person.capabilities && <span className="person-caps">{person.capabilities}</span>}
                    </div>
                    {isAssigned && <span className="assigned-badge">Assigned</span>}
                  </div>
                )
              })}
              {filteredPersonnel.length === 0 && (
                <div className="no-personnel">
                  {selectedPosition
                    ? 'No available personnel to assign.'
                    : 'No checked-in personnel found.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showPrint && formType === 'standard' && (
        <Ics207Print
          incidentName={incidentName}
          positions={positions}
          preparedBy={preparedBy}
          datePrepared={datePrepared}
          timePrepared={timePrepared}
          onClose={() => setShowPrint(false)}
        />
      )}

      {formType === 'expanded' && showExpandedExport && (
        <Ics207ExpandedExport
          incidentName={incidentName}
          positions={positions}
          preparedBy={preparedBy}
          datePrepared={datePrepared}
          timePrepared={timePrepared}
          onClose={() => setShowExpandedExport(false)}
        />
      )}
    </div>
  )
}
