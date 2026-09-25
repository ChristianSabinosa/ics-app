-- ICS 204: Assignment List
-- Unlike the other ICS forms, an incident may have MANY ICS 204s
-- (one per Branch/Division/Group assignment), so there is deliberately
-- NO unique constraint on incident_id.

create table if not exists ics_204_forms (
  id uuid default gen_random_uuid() primary key,
  incident_id text not null references incidents(incident_id),
  incident_name text not null default '',

  -- 2. Operational period (prefilled from ICS 202)
  op_period_from_date text not null default '',
  op_period_from_time text not null default '',
  op_period_to_date text not null default '',
  op_period_to_time text not null default '',

  -- 3. Branch / Group / Division / Staging Area
  branch text not null default '',
  group_name text not null default '',
  division text not null default '',
  staging_area text not null default '',

  -- 4. Operations Personnel (JSONB array of {position, name, contact})
  ops_personnel jsonb not null default '[]'::jsonb,

  -- 6. Specific work assignment
  specific_work_assignment text not null default '',

  -- 7. Special instructions / safety measures (prefilled from ICS 215A)
  special_instructions text not null default '',

  -- 8. Communications summary (JSONB array of {function, system, channel, frequency, others})
  comms jsonb not null default '[]'::jsonb,

  -- 9. Prepared by RESL
  prepared_by_name text not null default '',
  prepared_by_sig text not null default '',
  prepared_date text not null default '',
  prepared_time text not null default '',

  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table ics_204_forms enable row level security;

-- 5. Resources assigned for this period (one child row per resource)
create table if not exists ics_204_rows (
  id uuid default gen_random_uuid() primary key,
  form_id uuid not null references ics_204_forms(id) on delete cascade,
  resource_identifier text not null default '',
  leader_name text not null default '',
  contact_numbers text not null default '',
  personnel text not null default '',
  trans_needed boolean not null default false,
  drop_off text not null default '',
  pick_up_time text not null default '',
  remarks text not null default '',
  sort_order integer not null default 0
);

alter table ics_204_rows enable row level security;

do $$
begin
  create policy "Authenticated users can view 204 forms"
    on ics_204_forms for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can insert 204 forms"
    on ics_204_forms for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can update 204 forms"
    on ics_204_forms for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can delete 204 forms"
    on ics_204_forms for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can view 204 rows"
    on ics_204_rows for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can insert 204 rows"
    on ics_204_rows for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can update 204 rows"
    on ics_204_rows for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can delete 204 rows"
    on ics_204_rows for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_204_forms_incident_idx on ics_204_forms (incident_id);
create index if not exists ics_204_rows_form_idx on ics_204_rows (form_id, sort_order);
