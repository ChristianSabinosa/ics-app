-- ICS 207 - Incident Organization Chart
-- Only run this portion if the base tables already exist

create table if not exists ics_207_forms (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references incidents(incident_id) on delete cascade,
  incident_name text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  prepared_by text not null default '',
  date_prepared text not null default '',
  time_prepared text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ics_207_forms enable row level security;

do $$ begin
  create policy "Authenticated users can view 207 forms"
    on ics_207_forms for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 207 forms"
    on ics_207_forms for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 207 forms"
    on ics_207_forms for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_207_forms_incident_idx on ics_207_forms (incident_id);

create table if not exists ics_207_positions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references ics_207_forms(id) on delete cascade,
  position_key text not null,
  position_title text not null default '',
  abbreviation text not null default '',
  section text not null default '',
  person_name text not null default '',
  agency text not null default '',
  sort_order integer not null default 0
);

alter table ics_207_positions enable row level security;

do $$ begin
  create policy "Authenticated users can view 207 positions"
    on ics_207_positions for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 207 positions"
    on ics_207_positions for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 207 positions"
    on ics_207_positions for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can delete 207 positions"
    on ics_207_positions for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_207_positions_form_idx on ics_207_positions (form_id, sort_order);
