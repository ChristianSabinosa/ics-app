-- Incidents table for the Incident Command System
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

create table if not exists incidents (
  id uuid default gen_random_uuid() primary key,
  incident_id text unique not null,
  name text not null,
  location text not null,
  type text not null check (type in ('Incident', 'Planned Event', 'Training')),
  status text not null default 'Ongoing' check (status in ('Ongoing', 'Closed')),
  created_by uuid references auth.users(id) not null,
  created_by_name text not null default '',
  created_by_email text not null default '',
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Enable Row Level Security
alter table incidents enable row level security;

-- Policy: Any authenticated user can read incidents
create policy "Authenticated users can view incidents"
  on incidents for select
  to authenticated
  using (true);

-- Policy: Any authenticated user can create incidents
create policy "Authenticated users can create incidents"
  on incidents for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Policy: Users can update incidents they created
create policy "Users can update own incidents"
  on incidents for update
  to authenticated
  using (auth.uid() = created_by)
  with check (true);

-- Policy: Users can delete incidents they created
create policy "Users can delete own incidents"
  on incidents for delete
  to authenticated
  using (auth.uid() = created_by);

-- Index for faster queries
create index if not exists incidents_status_idx on incidents (status);
create index if not exists incidents_created_by_idx on incidents (created_by);

-- ============================================================
-- Incident Participants table
-- Tracks which users joined an incident and in what role
-- ============================================================

create table if not exists incident_participants (
  id uuid default gen_random_uuid() primary key,
  incident_id text not null references incidents(incident_id),
  user_id uuid references auth.users(id) not null,
  user_name text not null default '',
  user_email text not null default '',
  role text not null check (role in ('IMT', 'Tactical Resources', 'Observer')),
  role_id text unique not null,
  status text not null default 'Active' check (status in ('Active', 'Left')),
  joined_at timestamp with time zone default now() not null,
  left_at timestamp with time zone
);

alter table incident_participants enable row level security;

-- Policy: Any authenticated user can read participants
create policy "Authenticated users can view participants"
  on incident_participants for select
  to authenticated
  using (true);

-- Policy: Authenticated users can insert their own participant record
create policy "Users can insert own participant record"
  on incident_participants for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Policy: Users can update their own participant record
create policy "Users can update own participant record"
  on incident_participants for update
  to authenticated
  using (auth.uid() = user_id)
  with check (true);

create index if not exists participants_incident_id_idx on incident_participants (incident_id);
create index if not exists participants_user_id_idx on incident_participants (user_id);
create index if not exists participants_role_idx on incident_participants (role);

-- Add checked_in column
alter table incident_participants add column if not exists checked_in boolean not null default false;

-- ============================================================
-- Check-in Manifests
-- ============================================================

create table if not exists checkin_manifests (
  id uuid default gen_random_uuid() primary key,
  checkin_id text unique not null,
  incident_id text not null references incidents(incident_id),
  user_id uuid references auth.users(id) not null,
  user_name text not null default '',
  agency_name text not null default '',
  total_personnel integer not null default 0,
  total_vehicles integer not null default 0,
  total_equipment integer not null default 0,
  others text not null default '',
  prepared_by_name text not null default '',
  prepared_by_timestamp timestamp with time zone,
  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table checkin_manifests enable row level security;

create policy "Authenticated users can view manifests"
  on checkin_manifests for select to authenticated using (true);

create policy "Users can insert own manifest"
  on checkin_manifests for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own manifest"
  on checkin_manifests for update to authenticated
  using (auth.uid() = user_id) with check (true);

create index if not exists manifests_incident_id_idx on checkin_manifests (incident_id);
create index if not exists manifests_user_id_idx on checkin_manifests (user_id);

-- ============================================================
-- Check-in Personnel (Leaders + Members)
-- ============================================================

create table if not exists checkin_personnel (
  id uuid default gen_random_uuid() primary key,
  manifest_id uuid not null references checkin_manifests(id) on delete cascade,
  role text not null check (role in ('Leader', 'Member')),
  name text not null default '',
  age text not null default '',
  gender text not null default '',
  weight text not null default '',
  contact_details text not null default '',
  capabilities text not null default '',
  others text not null default ''
);

alter table checkin_personnel enable row level security;

create policy "Authenticated users can view personnel"
  on checkin_personnel for select to authenticated using (true);

create policy "Authenticated users can insert personnel"
  on checkin_personnel for insert to authenticated with check (true);

create policy "Authenticated users can update personnel"
  on checkin_personnel for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete personnel"
  on checkin_personnel for delete to authenticated using (true);

create index if not exists personnel_manifest_idx on checkin_personnel (manifest_id);

-- ============================================================
-- Check-in Vehicles
-- ============================================================

create table if not exists checkin_vehicles (
  id uuid default gen_random_uuid() primary key,
  manifest_id uuid not null references checkin_manifests(id) on delete cascade,
  vehicle_id text not null default '',
  operator_name text not null default '',
  kind text not null default '',
  type text not null default '',
  plate_number text not null default '',
  fuel_type text not null default '',
  weight text not null default '',
  contact_details text not null default '',
  capabilities text not null default '',
  others text not null default ''
);

alter table checkin_vehicles enable row level security;

create policy "Authenticated users can view vehicles"
  on checkin_vehicles for select to authenticated using (true);

create policy "Authenticated users can insert vehicles"
  on checkin_vehicles for insert to authenticated with check (true);

create policy "Authenticated users can update vehicles"
  on checkin_vehicles for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete vehicles"
  on checkin_vehicles for delete to authenticated using (true);

create index if not exists vehicles_manifest_idx on checkin_vehicles (manifest_id);

-- ============================================================
-- Check-in Equipment
-- ============================================================

create table if not exists checkin_equipment (
  id uuid default gen_random_uuid() primary key,
  manifest_id uuid not null references checkin_manifests(id) on delete cascade,
  equipment_id text not null default '',
  operator_name text not null default '',
  kind text not null default '',
  type text not null default '',
  source_of_power text not null default '',
  fuel_type text not null default '',
  weight text not null default '',
  contact_details text not null default '',
  capabilities text not null default '',
  others text not null default ''
);

alter table checkin_equipment enable row level security;

create policy "Authenticated users can view equipment"
  on checkin_equipment for select to authenticated using (true);

create policy "Authenticated users can insert equipment"
  on checkin_equipment for insert to authenticated with check (true);

create policy "Authenticated users can update equipment"
  on checkin_equipment for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete equipment"
  on checkin_equipment for delete to authenticated using (true);

create index if not exists equipment_manifest_idx on checkin_equipment (manifest_id);
