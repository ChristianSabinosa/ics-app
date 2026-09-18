-- ICS 213 - General Message

create table if not exists ics_213_forms (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references incidents(incident_id) on delete cascade,
  incident_name text not null default '',

  msg_date text not null default '',
  msg_time text not null default '',

  to_name text not null default '',
  to_position text not null default '',

  from_name text not null default '',
  from_position text not null default '',

  subject text not null default '',
  message text not null default '',

  approved_by_name text not null default '',
  approved_by_position text not null default '',
  approved_by_sig text not null default '',
  approved_date text not null default '',
  approved_time text not null default '',

  reply text not null default '',

  received_by_name text not null default '',
  received_by_position text not null default '',
  received_by_sig text not null default '',

  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ics_213_forms enable row level security;

do $$ begin
  create policy "Authenticated users can view 213 forms"
    on ics_213_forms for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 213 forms"
    on ics_213_forms for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 213 forms"
    on ics_213_forms for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_213_forms_incident_idx on ics_213_forms (incident_id);
