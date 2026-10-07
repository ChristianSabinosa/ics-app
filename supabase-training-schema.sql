-- Training Mode: trainings, groups, members, guide progress, announcements
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
--
-- Design notes:
--   * A training is its own top-level entity (NOT an incident). Each of its
--     groups owns a CHILD incident row (incidents.type = 'Training' with
--     training_id set) so every existing ICS form, print overlay, map,
--     check-in and IAP flow is reused untouched.
--   * Regular incidents keep training_id = null and behave exactly as before.
--
-- The script is idempotent AND self-healing: if a previous (older/failed) run
-- left a training table behind with the wrong shape, `create table if not
-- exists` would skip it and every later statement would fail with
-- "column ... does not exist". Step 0 detects that, drops the empty outdated
-- table so it can be recreated, and refuses to touch a non-empty one.

-- ============================================================
-- 0) Preflight — verify base tables and heal outdated shapes
-- ============================================================
do $$
declare
  tbl text;
  req text[];
  missing text[];
  cnt bigint;
begin
  if to_regclass('public.incidents') is null then
    raise exception 'Table public.incidents does not exist — run supabase-schema.sql first.';
  end if;

  -- Every table this script creates, with the columns the app writes to.
  for tbl, req in
    select * from (values
      ('trainings',             array['training_id','name','location','scenario','status','invite_token','started_at','created_by','created_by_name','created_at','updated_at']),
      ('training_groups',       array['training_id','name','incident_id','sort_order','created_at']),
      ('training_members',      array['training_id','user_id','user_name','user_email','role','group_id','joined_at']),
      ('training_guide_progress', array['training_id','user_id','step_key','status','updated_at']),
      ('training_announcements',array['training_id','group_id','title','body','created_by','created_by_name','created_at']),
      ('training_announcement_reads', array['announcement_id','user_id','read_at'])
    ) as t(tbl, req)
  loop
    if to_regclass(format('public.%I', tbl)) is not null then
      select array_agg(r.c order by r.c) into missing
      from unnest(req) as r(c)
      where not exists (
        select 1 from information_schema.columns ic
        where ic.table_schema = 'public'
          and ic.table_name = tbl
          and ic.column_name = r.c
      );

      if missing is not null then
        execute format('select count(*) from public.%I', tbl) into cnt;
        if cnt > 0 then
          raise exception
            'Table public.% already exists with an outdated shape (missing columns: %) and contains % row(s). These are leftovers from an earlier attempt — run supabase-training-cleanup.sql first (or drop table public.% cascade yourself), then re-run this script.',
            tbl, array_to_string(missing, ', '), cnt, tbl;
        end if;
        raise notice 'Dropping empty outdated table public.% (missing columns: %).', tbl, array_to_string(missing, ', ');
        execute format('drop table public.%I cascade', tbl);
      end if;
    end if;
  end loop;
end $$;

-- ============================================================
-- Link child incidents to their parent training
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'incidents' and column_name = 'training_id'
  ) then
    alter table public.incidents add column training_id uuid;
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'incidents' and indexname = 'incidents_training_id_idx'
  ) then
    create index incidents_training_id_idx on public.incidents (training_id);
  end if;
end $$;

-- ============================================================
-- Trainings
-- ============================================================
create table if not exists trainings (
  id uuid primary key default gen_random_uuid(),
  training_id text unique not null,            -- TRN-YYYYMMDD-NNNN
  name text not null,
  location text not null default '',
  scenario text not null default '',
  status text not null default 'Setup' check (status in ('Setup', 'Ongoing', 'Closed')),
  invite_token text unique not null,           -- secret for the join link / QR
  started_at timestamp with time zone,
  created_by uuid references auth.users(id) not null,
  created_by_name text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table trainings enable row level security;

do $$ begin
  create policy "Authenticated users can view trainings"
    on trainings for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Trainers can create trainings"
    on trainings for insert to authenticated
    with check (auth.uid() = created_by);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Trainers can update own trainings"
    on trainings for update to authenticated
    using (auth.uid() = created_by) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Trainers can delete own trainings"
    on trainings for delete to authenticated
    using (auth.uid() = created_by);
exception when duplicate_object then null;
end $$;

create index if not exists trainings_created_by_idx on trainings (created_by);
create index if not exists trainings_invite_token_idx on trainings (invite_token);

-- ============================================================
-- Training groups (default 4, but any number is allowed)
-- Each group owns one child incident that carries all its ICS forms.
-- ============================================================
create table if not exists training_groups (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings(id) on delete cascade,
  name text not null,
  incident_id text unique references incidents(incident_id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now()
);

alter table training_groups enable row level security;

do $$ begin
  create policy "Authenticated users can view training groups"
    on training_groups for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Trainers can manage training groups"
    on training_groups for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Trainers can update training groups"
    on training_groups for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Trainers can delete training groups"
    on training_groups for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;

create index if not exists training_groups_training_idx on training_groups (training_id, sort_order);

-- ============================================================
-- Training members (the trainer + the trainees)
-- group_id stays NULL until the trainer assigns the trainee.
-- ============================================================
create table if not exists training_members (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null default '',
  user_email text not null default '',
  role text not null default 'trainee' check (role in ('trainor', 'trainee')),
  group_id uuid references training_groups(id) on delete set null,
  joined_at timestamp with time zone not null default now(),
  unique (training_id, user_id)
);

alter table training_members enable row level security;

do $$ begin
  create policy "Authenticated users can view training members"
    on training_members for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can insert own training membership"
    on training_members for insert to authenticated
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Training memberships can be managed"
    on training_members for update to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can delete own training membership"
    on training_members for delete to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create index if not exists training_members_training_idx on training_members (training_id);
create index if not exists training_members_user_idx on training_members (user_id);

-- ============================================================
-- Guide progress — one row per trainee per guided step
-- status 'done' (completed) or 'skipped' (deliberately bypassed)
-- ============================================================
create table if not exists training_guide_progress (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_key text not null,
  status text not null check (status in ('done', 'skipped')),
  updated_at timestamp with time zone not null default now(),
  unique (training_id, user_id, step_key)
);

alter table training_guide_progress enable row level security;

do $$ begin
  create policy "Users can view guide progress"
    on training_guide_progress for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can record own guide progress"
    on training_guide_progress for insert to authenticated
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can update own guide progress"
    on training_guide_progress for update to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can delete own guide progress"
    on training_guide_progress for delete to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create index if not exists guide_progress_user_idx on training_guide_progress (training_id, user_id);

-- ============================================================
-- Announcements — the trainer's box, read by the groups
-- group_id NULL = broadcast to every group
-- ============================================================
create table if not exists training_announcements (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings(id) on delete cascade,
  group_id uuid references training_groups(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  created_by uuid references auth.users(id) not null,
  created_by_name text not null default '',
  created_at timestamp with time zone not null default now()
);

alter table training_announcements enable row level security;

do $$ begin
  create policy "Authenticated users can view announcements"
    on training_announcements for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Trainers can post announcements"
    on training_announcements for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Trainers can delete announcements"
    on training_announcements for delete to authenticated using (true);
exception when duplicate_object then null;
end $$;

create index if not exists training_announcements_training_idx on training_announcements (training_id, created_at);

-- Read receipts so the guide knows a trainee actually opened the packet
create table if not exists training_announcement_reads (
  announcement_id uuid not null references training_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamp with time zone not null default now(),
  primary key (announcement_id, user_id)
);

alter table training_announcement_reads enable row level security;

do $$ begin
  create policy "Users can view own read receipts"
    on training_announcement_reads for select to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can record own read receipts"
    on training_announcement_reads for insert to authenticated
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- ============================================================
-- ICS 207 positions linked to real accounts
-- (signature rules resolve "who holds this position" from user_id;
--  person_name stays as the printable display value)
-- ============================================================
do $$
begin
  if to_regclass('public.ics_207_positions') is null then
    raise exception 'Table public.ics_207_positions does not exist — run the ICS forms schema (supabase-schema.sql and friends) first.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ics_207_positions' and column_name = 'user_id'
  ) then
    alter table public.ics_207_positions add column user_id uuid references auth.users(id);
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'ics_207_positions' and indexname = 'ics_207_positions_user_idx'
  ) then
    create index ics_207_positions_user_idx on public.ics_207_positions (user_id);
  end if;
end $$;

-- ============================================================
-- Repair foreign keys (only relevant when step 0 had to drop and
-- recreate a parent table — otherwise these already exist)
-- ============================================================
do $$
declare
  fk record;
begin
  for fk in
    select * from (values
      ('training_groups',          'training_id',   'trainings',               'id'),
      ('training_members',         'training_id',   'trainings',               'id'),
      ('training_members',         'group_id',      'training_groups',         'id'),
      ('training_guide_progress',  'training_id',   'trainings',               'id'),
      ('training_announcements',   'training_id',   'trainings',               'id'),
      ('training_announcements',   'group_id',      'training_groups',         'id'),
      ('training_announcement_reads','announcement_id','training_announcements','id')
    ) as t(child, col, parent, pcol)
  loop
    if not exists (
      select 1
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = format('public.%I', fk.child)::regclass
        and c.confrelid = format('public.%I', fk.parent)::regclass
        and pg_get_constraintdef(c.oid) like format('FOREIGN KEY (%I)%%', fk.col)
    ) then
      execute format('alter table public.%I add foreign key (%I) references public.%I (%I)',
                     fk.child, fk.col, fk.parent, fk.pcol);
      raise notice 'Recreated foreign key %.% -> %.%', fk.child, fk.col, fk.parent, fk.pcol;
    end if;
  end loop;
end $$;

-- ============================================================
-- Final verification — fail loudly (with the object's name) instead of
-- letting the app break at runtime.
-- ============================================================
do $$
declare
  tbl text;
  col text;
begin
  for tbl, col in
    select * from (values
      ('incidents', 'training_id'),
      ('ics_207_positions', 'user_id')
    ) as t(tbl, col)
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = col
    ) then
      raise exception 'Verification failed: %.% is missing.', tbl, col;
    end if;
  end loop;

  for tbl in
    select unnest(array[
      'trainings','training_groups','training_members','training_guide_progress',
      'training_announcements','training_announcement_reads'
    ])
  loop
    if to_regclass(format('public.%I', tbl)) is null then
      raise exception 'Verification failed: table public.% is missing.', tbl;
    end if;
  end loop;

  -- Every training table except read receipts is keyed by training_id.
  for tbl in
    select unnest(array[
      'trainings','training_groups','training_members','training_guide_progress','training_announcements'
    ])
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'training_id'
    ) then
      raise exception 'Verification failed: %.training_id is missing.', tbl;
    end if;
  end loop;

  raise notice 'Training Mode schema installed successfully.';
end $$;
