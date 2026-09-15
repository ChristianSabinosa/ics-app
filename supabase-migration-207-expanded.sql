-- ICS 207 Expansion: Standard vs Expanded form types
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Add form_type column to distinguish standard vs expanded
alter table ics_207_forms add column if not exists form_type text not null default 'standard';

-- 2. Create sub_positions table for expanded org chart
create table if not exists ics_207_sub_positions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references ics_207_forms(id) on delete cascade,
  parent_key text not null,
  sub_key text not null,
  sub_title text not null default '',
  resource_type text default '',
  resource_id uuid,
  resource_name text not null default '',
  agency text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ics_207_sub_positions enable row level security;

do $$ begin
  create policy "Authenticated users can view 207 sub positions"
    on ics_207_sub_positions for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can insert 207 sub positions"
    on ics_207_sub_positions for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can update 207 sub positions"
    on ics_207_sub_positions for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can delete 207 sub positions"
    on ics_207_sub_positions for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;

create index if not exists ics_207_sub_positions_form_idx on ics_207_sub_positions (form_id, parent_key, sort_order);
