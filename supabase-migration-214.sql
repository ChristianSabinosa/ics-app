-- ICS 214 - Activity Log

create table if not exists ics_214_forms (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references incidents(incident_id) on delete cascade,
  incident_name text not null default '',

  op_period_from_date text not null default '',
  op_period_from_time text not null default '',
  op_period_to_date text not null default '',
  op_period_to_time text not null default '',

  name text not null default '',
  ics_position text not null default '',
  agency_office text not null default '',

  resources_assigned jsonb not null default '[]'::jsonb,

  activity_log jsonb not null default '[]'::jsonb,

  prepared_by_name text not null default '',
  prepared_by_sig text not null default '',
  prepared_date text not null default '',
  prepared_time text not null default '',

  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ics_214_forms enable row level security;

do $$ begin
  create policy "Authenticated users can view 214 forms"
    on ics_214_forms for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 214 forms"
    on ics_214_forms for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 214 forms"
    on ics_214_forms for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_214_forms_incident_idx on ics_214_forms (incident_id);
