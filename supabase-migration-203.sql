-- ICS 203 - Organization Assignment List

create table if not exists ics_203_forms (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references incidents(incident_id) on delete cascade,
  incident_name text not null default '',

  op_period_from_date text not null default '',
  op_period_from_time text not null default '',
  op_period_to_date text not null default '',
  op_period_to_time text not null default '',

  prepared_by_name text not null default '',
  prepared_by_sig text not null default '',
  prepared_date text not null default '',
  prepared_time text not null default '',

  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ics_203_forms enable row level security;

do $$ begin
  create policy "Authenticated users can view 203 forms"
    on ics_203_forms for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 203 forms"
    on ics_203_forms for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 203 forms"
    on ics_203_forms for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_203_forms_incident_idx on ics_203_forms (incident_id);
