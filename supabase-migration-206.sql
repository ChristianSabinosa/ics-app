-- ICS 206 FORM - MEDICAL PLAN

create table if not exists ics_206_forms (
  id uuid default gen_random_uuid() primary key,
  incident_id text not null references incidents(incident_id),
  incident_name text not null default '',
  op_period_from_date text not null default '',
  op_period_from_time text not null default '',
  op_period_to_date text not null default '',
  op_period_to_time text not null default '',
  medical_emergency_procedures text not null default '',
  aviation_assets_used boolean not null default false,
  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  prepared_by text not null default '',
  date_prepared text not null default '',
  time_prepared text not null default '',
  reviewed_by text not null default '',
  date_reviewed text not null default '',
  time_reviewed text not null default '',
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table ics_206_forms enable row level security;

do $$ begin
  create policy "Authenticated users can view 206 forms"
    on ics_206_forms for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 206 forms"
    on ics_206_forms for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 206 forms"
    on ics_206_forms for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_206_forms_incident_idx on ics_206_forms (incident_id);

-- ICS 206 MEDICAL AID STATIONS

create table if not exists ics_206_aid_stations (
  id uuid default gen_random_uuid() primary key,
  form_id uuid not null references ics_206_forms(id) on delete cascade,
  name text not null default '',
  location text not null default '',
  contact_person text not null default '',
  contact_numbers text not null default '',
  remarks text not null default '',
  with_paramedics boolean not null default false,
  sort_order integer not null default 0
);

alter table ics_206_aid_stations enable row level security;

do $$ begin
  create policy "Authenticated users can view 206 aid stations"
    on ics_206_aid_stations for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 206 aid stations"
    on ics_206_aid_stations for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can delete 206 aid stations"
    on ics_206_aid_stations for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_206_aid_stations_form_idx on ics_206_aid_stations (form_id, sort_order);

-- ICS 206 AMBULANCES

create table if not exists ics_206_ambulances (
  id uuid default gen_random_uuid() primary key,
  form_id uuid not null references ics_206_forms(id) on delete cascade,
  name text not null default '',
  location text not null default '',
  contact_person text not null default '',
  contact_numbers text not null default '',
  remarks text not null default '',
  level_of_service text not null default '' check (level_of_service in ('', 'BLS', 'ALS')),
  sort_order integer not null default 0
);

alter table ics_206_ambulances enable row level security;

do $$ begin
  create policy "Authenticated users can view 206 ambulances"
    on ics_206_ambulances for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 206 ambulances"
    on ics_206_ambulances for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can delete 206 ambulances"
    on ics_206_ambulances for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_206_ambulances_form_idx on ics_206_ambulances (form_id, sort_order);

-- ICS 206 HOSPITALS

create table if not exists ics_206_hospitals (
  id uuid default gen_random_uuid() primary key,
  form_id uuid not null references ics_206_forms(id) on delete cascade,
  name text not null default '',
  location text not null default '',
  contact_person text not null default '',
  contact_numbers text not null default '',
  travel_time_air text not null default '',
  travel_time_land text not null default '',
  with_trauma_center boolean not null default false,
  with_burn_center boolean not null default false,
  with_helipad boolean not null default false,
  sort_order integer not null default 0
);

alter table ics_206_hospitals enable row level security;

do $$ begin
  create policy "Authenticated users can view 206 hospitals"
    on ics_206_hospitals for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 206 hospitals"
    on ics_206_hospitals for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can delete 206 hospitals"
    on ics_206_hospitals for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_206_hospitals_form_idx on ics_206_hospitals (form_id, sort_order);
