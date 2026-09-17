export interface Incident {
  id: string
  incident_id: string
  name: string
  location: string
  type: 'Incident' | 'Planned Event' | 'Training'
  status: 'Ongoing' | 'Closed'
  created_by: string
  created_by_name: string
  created_by_email: string
  created_at: string
  updated_at: string
}

export interface IncidentParticipant {
  id: string
  incident_id: string
  user_id: string
  user_name: string
  user_email: string
  role: 'IMT' | 'Tactical Resources' | 'Observer'
  role_id: string
  status: 'Active' | 'Left'
  checked_in: boolean
  joined_at: string
  left_at: string | null
}

export interface CheckinManifest {
  id: string
  checkin_id: string
  incident_id: string
  user_id: string
  user_name: string
  agency_name: string
  total_personnel: number
  total_vehicles: number
  total_equipment: number
  others: string
  prepared_by_name: string
  prepared_by_timestamp: string | null
  status: 'Draft' | 'Submitted'
  created_at: string
  updated_at: string
}

export interface CheckinPersonnel {
  id: string
  manifest_id: string
  role: 'Leader' | 'Member'
  name: string
  age: string
  gender: string
  weight: string
  contact_details: string
  capabilities: string
  others: string
}

export interface CheckinVehicle {
  id: string
  manifest_id: string
  vehicle_id: string
  operator_name: string
  kind: string
  type: string
  method_of_travel: string
  plate_number: string
  fuel_type: string
  weight: string
  contact_details: string
  capabilities: string
  others: string
}

export interface CheckinEquipment {
  id: string
  manifest_id: string
  equipment_id: string
  operator_name: string
  kind: string
  type: string
  source_of_power: string
  fuel_type: string
  weight: string
  contact_details: string
  capabilities: string
  others: string
}

export interface Ics211Form {
  id: string
  incident_id: string
  incident_name: string
  start_date: string
  start_time: string
  checkin_location: string
  status: 'Draft' | 'Submitted'
  prepared_by: string
  date_prepared: string
  time_prepared: string
  created_at: string
  updated_at: string
}

export interface Ics211Resource {
  id: string
  form_id: string
  order_request_no: string
  checkin_datetime: string
  kind: string
  type: string
  resource_identifier_single: boolean
  resource_identifier_st: boolean
  resource_identifier_tf: boolean
  agency_name: string
  leader_name: string
  contact_details: string
  total_personnel: number
  departure_point_of_origin: string
  departure_datetime: string
  departure_method_of_travel: string
  with_manifest: boolean
  incident_assignment: string
  other_qualifications: string
  data_sent_to_resl: string
  sort_order: number
}

export interface Ics207Form {
  id: string
  incident_id: string
  incident_name: string
  form_type: 'standard' | 'expanded'
  status: 'Draft' | 'Submitted'
  prepared_by: string
  date_prepared: string
  time_prepared: string
  created_at: string
  updated_at: string
}

export interface Ics207Position {
  id: string
  form_id: string
  position_key: string
  position_title: string
  abbreviation: string
  section: string
  person_name: string
  agency: string
  sort_order: number
}

export interface Ics207SubPosition {
  id: string
  form_id: string
  parent_key: string
  sub_key: string
  sub_title: string
  resource_type: 'personnel' | 'vehicle' | 'equipment' | ''
  resource_id: string | null
  resource_name: string
  agency: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Ics205Form {
  id: string
  incident_id: string
  incident_name: string
  op_period_from_date: string
  op_period_from_time: string
  op_period_to_date: string
  op_period_to_time: string
  coordinating_instructions: string
  status: 'Draft' | 'Submitted'
  prepared_by: string
  date_prepared: string
  time_prepared: string
  created_at: string
  updated_at: string
}

export interface Ics205Channel {
  id: string
  form_id: string
  radio_type: string
  system: string
  channel: string
  function: string
  tone_offset: string
  frequency: string
  others: string
  assignment: string
  remarks: string
  sort_order: number
}

export interface Ics206Form {
  id: string
  incident_id: string
  incident_name: string
  op_period_from_date: string
  op_period_from_time: string
  op_period_to_date: string
  op_period_to_time: string
  medical_emergency_procedures: string
  aviation_assets_used: boolean
  status: 'Draft' | 'Submitted'
  prepared_by: string
  date_prepared: string
  time_prepared: string
  reviewed_by: string
  date_reviewed: string
  time_reviewed: string
  created_at: string
  updated_at: string
}

export interface Ics206AidStation {
  id: string
  form_id: string
  name: string
  location: string
  contact_person: string
  contact_numbers: string
  remarks: string
  with_paramedics: boolean
  sort_order: number
}

export interface Ics206Ambulance {
  id: string
  form_id: string
  name: string
  location: string
  contact_person: string
  contact_numbers: string
  remarks: string
  level_of_service: string
  sort_order: number
}

export interface Ics206Hospital {
  id: string
  form_id: string
  name: string
  location: string
  contact_person: string
  contact_numbers: string
  travel_time_air: string
  travel_time_land: string
  with_trauma_center: boolean
  with_burn_center: boolean
  with_helipad: boolean
  sort_order: number
}
