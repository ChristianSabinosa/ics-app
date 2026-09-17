-- ICS 208 - Safety Message/Plan

create table if not exists ics_208_forms (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references incidents(incident_id) on delete cascade,
  incident_name text not null default '',

  op_period_from_date text not null default '',
  op_period_from_time text not null default '',
  op_period_to_date text not null default '',
  op_period_to_time text not null default '',

  safety_message text not null default '',
  safety_plan_required boolean not null default false,
  safety_plan_location text not null default '',

  prepared_by_name text not null default '',
  prepared_date text not null default '',
  prepared_time text not null default '',

  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ics_208_forms enable row level security;

do $$ begin
  create policy "Authenticated users can view 208 forms"
    on ics_208_forms for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 208 forms"
    on ics_208_forms for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 208 forms"
    on ics_208_forms for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_208_forms_incident_idx on ics_208_forms (incident_id);
