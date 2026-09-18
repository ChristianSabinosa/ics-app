-- ICS 209 - Incident Status Summary

create table if not exists ics_209_forms (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references incidents(incident_id) on delete cascade,
  incident_name text not null default '',

  op_period_from_date text not null default '',
  op_period_from_time text not null default '',
  op_period_to_date text not null default '',
  op_period_to_time text not null default '',

  report_no integer not null default 1,
  report_type text not null default 'Initial' check (report_type in ('Initial', 'Update', 'Final')),

  prepared_by_name text not null default '',
  prepared_by_sig text not null default '',
  prepared_date text not null default '',
  prepared_time text not null default '',
  approved_by_name text not null default '',
  approved_by_sig text not null default '',
  approved_date text not null default '',
  approved_time text not null default '',

  general_description text not null default '',
  policy_guidance text not null default '',
  objectives text not null default '',

  address_location text not null default '',
  jurisdiction text not null default '',
  gps_coordinates text not null default '',
  landmarks text not null default '',

  significant_events text not null default '',

  cluster_assessment jsonb not null default '[]'::jsonb,

  public_status jsonb not null default '[]'::jsonb,

  responders_status jsonb not null default '[]'::jsonb,

  threat_management jsonb not null default '{}'::jsonb,

  weather_concerns text not null default '',

  escalation_12h text not null default '',
  escalation_24h text not null default '',
  escalation_48h text not null default '',
  escalation_72h text not null default '',
  escalation_after72h text not null default '',

  threats_risk_12h text not null default '',
  threats_risk_24h text not null default '',
  threats_risk_48h text not null default '',
  threats_risk_72h text not null default '',
  threats_risk_after72h text not null default '',

  critical_resources_12h text not null default '',
  critical_resources_24h text not null default '',
  critical_resources_48h text not null default '',
  critical_resources_72h text not null default '',
  critical_resources_after72h text not null default '',

  planned_actions text not null default '',
  other_concerns text not null default '',
  anticipated_costs text not null default '',
  projected_costs text not null default '',

  resources jsonb not null default '[]'::jsonb,

  assisting_agencies jsonb not null default '[]'::jsonb,

  status text not null default 'Draft' check (status in ('Draft', 'Submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ics_209_forms enable row level security;

do $$ begin
  create policy "Authenticated users can view 209 forms"
    on ics_209_forms for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 209 forms"
    on ics_209_forms for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 209 forms"
    on ics_209_forms for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_209_forms_incident_idx on ics_209_forms (incident_id);
