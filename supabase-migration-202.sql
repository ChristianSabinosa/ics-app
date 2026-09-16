-- ICS 202 - Incident Objectives

create table if not exists ics_202_forms (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references incidents(incident_id) on delete cascade,
  incident_name text not null default '',

  op_period_from_date text not null default '',
  op_period_from_time text not null default '',
  op_period_to_date text not null default '',
  op_period_to_time text not null default '',

  objectives text not null default '',
  command_emphasis text not null default '',
  weather_forecast text not null default '',
  safety_message text not null default '',

  safety_plan_required boolean not null default false,
  safety_plan_location text not null default '',

  attach_203 boolean not null default false,
  attach_204 boolean not null default false,
  attach_205 boolean not null default false,
  attach_206 boolean not null default false,
  attach_209 boolean not null default false,
  attach_map boolean not null default false,
  attach_others boolean not null default false,
  attach_others_text text not null default '',

  prepared_by_name text not null default '',
  prepared_by_sig text not null default '',
  prepared_date text not null default '',
  prepared_time text not null default '',

  approved_by_name text not null default '',
  approved_by_sig text not null default '',
  approved_date text not null default '',
  approved_time text not null default '',

  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ics_202_forms enable row level security;

do $$ begin
  create policy "Authenticated users can view 202 forms"
    on ics_202_forms for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 202 forms"
    on ics_202_forms for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 202 forms"
    on ics_202_forms for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_202_forms_incident_idx on ics_202_forms (incident_id);
