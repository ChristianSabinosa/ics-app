-- Incident Action Plan (IAP)
-- One row per operational period; approved rows are frozen read-only documents.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query > Run).
-- Safe to run more than once: the create/alter statements below are all idempotent
-- and also migrate a table created by the earlier version of this file.

create table if not exists incident_iap (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references incidents(incident_id) on delete cascade,
  cover_image text,
  operational_period text not null default '',
  op_period_from_date text not null default '',
  op_period_from_time text not null default '',
  op_period_to_date text not null default '',
  op_period_to_time text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Submitted', 'Approved')),
  snapshot jsonb,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Migration for a table created with the earlier (one-row-per-incident) shape ──
alter table incident_iap drop constraint if exists incident_iap_incident_id_key;
alter table incident_iap add column if not exists operational_period text not null default '';
alter table incident_iap add column if not exists op_period_from_date text not null default '';
alter table incident_iap add column if not exists op_period_from_time text not null default '';
alter table incident_iap add column if not exists op_period_to_date text not null default '';
alter table incident_iap add column if not exists op_period_to_time text not null default '';
alter table incident_iap add column if not exists snapshot jsonb;
alter table incident_iap add column if not exists submitted_at timestamptz;
alter table incident_iap add column if not exists approved_at timestamptz;
alter table incident_iap add column if not exists approved_by text not null default '';
alter table incident_iap drop constraint if exists incident_iap_status_check;
alter table incident_iap add constraint incident_iap_status_check
  check (status in ('Draft', 'Submitted', 'Approved'));

-- ── Row level security ──
alter table incident_iap enable row level security;

do $$ begin
  create policy "Authenticated users can view IAP"
    on incident_iap for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert IAP"
    on incident_iap for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update IAP"
    on incident_iap for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists incident_iap_incident_idx on incident_iap (incident_id);
create index if not exists incident_iap_status_idx on incident_iap (incident_id, status);
