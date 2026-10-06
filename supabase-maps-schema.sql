-- ============================================================
-- Interactive incident maps: sketch + live GPS tabs
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- as the project OWNER (role: postgres).
-- If you get "permission denied for schema public", see
-- supabase-profiles-schema-minimal.sql for the role fix.
-- The app keeps working without this migration (snapshot-only
-- fallback), but per-tab markers and the live view won't persist.
-- ============================================================

-- Older projects may not have the table at all (it previously had
-- no SQL file in the repo) — create it if missing.
create table if not exists incident_maps (
  incident_id text primary key references incidents(incident_id) on delete cascade,
  map_image text not null default '',
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table incident_maps add column if not exists map_type text not null default 'sketch'
  check (map_type in ('sketch', 'live'));
alter table incident_maps add column if not exists sketch_markers jsonb not null default '[]';
alter table incident_maps add column if not exists live_markers jsonb not null default '[]';
alter table incident_maps add column if not exists sketch_shapes jsonb not null default '[]';
alter table incident_maps add column if not exists live_shapes jsonb not null default '[]';
alter table incident_maps add column if not exists custom_symbols jsonb not null default '[]';
alter table incident_maps add column if not exists center_lat double precision;
alter table incident_maps add column if not exists center_lng double precision;
alter table incident_maps add column if not exists zoom integer;

-- Legacy single-column shape (kept for reading old rows only)
alter table incident_maps add column if not exists markers jsonb not null default '[]';

alter table incident_maps enable row level security;

do $$ begin
  create policy "Authenticated users can view incident maps"
    on incident_maps for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert incident maps"
    on incident_maps for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update incident maps"
    on incident_maps for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists incident_maps_type_idx on incident_maps (map_type);
