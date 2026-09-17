-- ICS 205 FORM - COMMUNICATIONS PLAN

create table if not exists ics_205_forms (
  id uuid default gen_random_uuid() primary key,
  incident_id text not null references incidents(incident_id),
  incident_name text not null default '',
  op_period_from_date text not null default '',
  op_period_from_time text not null default '',
  op_period_to_date text not null default '',
  op_period_to_time text not null default '',
  coordinating_instructions text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  prepared_by text not null default '',
  date_prepared text not null default '',
  time_prepared text not null default '',
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table ics_205_forms enable row level security;

do $$ begin
  create policy "Authenticated users can view 205 forms"
    on ics_205_forms for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 205 forms"
    on ics_205_forms for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 205 forms"
    on ics_205_forms for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_205_forms_incident_idx on ics_205_forms (incident_id);

-- ICS 205 CHANNELS (Basic Radio Channel Utilization)

create table if not exists ics_205_channels (
  id uuid default gen_random_uuid() primary key,
  form_id uuid not null references ics_205_forms(id) on delete cascade,
  radio_type text not null default '',
  system text not null default '',
  channel text not null default '',
  function text not null default '',
  tone_offset text not null default '',
  frequency text not null default '',
  others text not null default '',
  assignment text not null default '',
  remarks text not null default '',
  sort_order integer not null default 0
);

alter table ics_205_channels enable row level security;

do $$ begin
  create policy "Authenticated users can view 205 channels"
    on ics_205_channels for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 205 channels"
    on ics_205_channels for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can delete 205 channels"
    on ics_205_channels for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_205_channels_form_idx on ics_205_channels (form_id, sort_order);
